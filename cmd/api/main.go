package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/li-pdf/li-pdf/internal/api"
	"github.com/li-pdf/li-pdf/internal/config"
	"github.com/li-pdf/li-pdf/internal/engine"
	"github.com/li-pdf/li-pdf/internal/preflight"
	"github.com/li-pdf/li-pdf/internal/queue"
	"github.com/li-pdf/li-pdf/internal/registry"
	"github.com/li-pdf/li-pdf/internal/storage"
	"github.com/li-pdf/li-pdf/internal/validator"
	"github.com/li-pdf/li-pdf/internal/worker"
)

func main() {
	log.Println("==================================================")
	log.Println("  li-pdf: Production File Converter & Compressor  ")
	log.Println("==================================================")

	cfg := config.Load()
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// 1. Initialize Storage Manager
	var st storage.StorageManager
	var err error
	if cfg.StorageType == "s3" || cfg.StorageType == "r2" {
		st, err = storage.NewS3StorageManager(ctx, cfg)
		if err != nil {
			log.Fatalf("Failed to initialize S3 storage manager: %v", err)
		}
		log.Printf("Storage: S3/R2 Bucket '%s' at endpoint '%s'", cfg.S3Bucket, cfg.S3Endpoint)
	} else {
		apiBaseURL := fmt.Sprintf("http://localhost:%s", cfg.Port)
		st, err = storage.NewLocalStorageManager(cfg.StorageDir, apiBaseURL)
		if err != nil {
			log.Fatalf("Failed to initialize local storage manager: %v", err)
		}
		log.Printf("Storage: Local Filesystem at '%s'", cfg.StorageDir)
	}

	// 2. Initialize Queue
	var q queue.JobQueue
	if cfg.RedisURL != "" && cfg.StorageType != "local" {
		q, err = queue.NewRedisQueue(cfg.RedisURL)
		if err != nil {
			log.Printf("Warning: Failed to connect to Redis (%v), falling back to in-memory queue", err)
			q = queue.NewMemoryQueue()
		} else {
			log.Printf("Queue: Redis at '%s'", cfg.RedisURL)
		}
	} else {
		q = queue.NewMemoryQueue()
		log.Println("Queue: In-Memory Task Queue")
	}

	// 3. Initialize Capability Registry & Preflight Analyzer
	reg := registry.NewDefaultRegistry()
	pf := preflight.NewAnalyzer(reg)
	val := validator.NewProductionValidator()
	pdfEng := engine.NewQPDFStructuralProcessor()
	pdfRen := engine.NewPopplerPDFRenderer()
	imgEng := engine.NewVipsImageProcessor()
	docEng := engine.NewLibreOfficeDocumentConverter()

	// 4. Initialize API Handler & SSE Hub
	apiH := api.NewAPIHandler(cfg, reg, pf, st, q)
	sseHub := api.NewSSEHub(q)
	router := api.SetupRouter(apiH, sseHub)

	// 5. Start Embedded Background Worker Supervisor
	supervisor := worker.NewWorkerSupervisor(cfg, q, st, val, pdfEng, pdfRen, imgEng, docEng, apiH)
	workerQueues := []string{"queue_image_fast", "queue_pdf_std", "queue_pdf_heavy", "queue_office"}
	go supervisor.Start(ctx, workerQueues)

	// 6. Start HTTP Server
	server := &http.Server{
		Addr:         ":" + cfg.Port,
		Handler:      router,
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 30 * time.Second,
	}

	go func() {
		log.Printf("API Server listening on http://0.0.0.0:%s", cfg.Port)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("HTTP server failure: %v", err)
		}
	}()

	// Graceful Shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("Shutting down server gracefully...")
	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer shutdownCancel()

	if err := server.Shutdown(shutdownCtx); err != nil {
		log.Printf("Server forced shutdown: %v", err)
	}

	log.Println("Server exiting")
}
