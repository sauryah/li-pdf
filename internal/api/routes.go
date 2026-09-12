package api

import (
	"net/http"
	"strings"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/li-pdf/li-pdf/internal/metrics"
)

func SetupRouter(handler *APIHandler, sseHub *SSEHub) *gin.Engine {
	r := gin.Default()

	// CORS configuration for frontend
	corsConfig := cors.DefaultConfig()
	if handler.cfg.AllowedOrigins == "*" || handler.cfg.AllowedOrigins == "" {
		corsConfig.AllowAllOrigins = true
	} else {
		corsConfig.AllowOrigins = strings.Split(handler.cfg.AllowedOrigins, ",")
		corsConfig.AllowCredentials = true
	}
	corsConfig.AllowHeaders = []string{"Origin", "Content-Length", "Content-Type", "Idempotency-Key", "Authorization", "Accept", "X-Requested-With"}
	corsConfig.AllowMethods = []string{"GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"}
	r.Use(cors.New(corsConfig))

	// Health & Readiness Checks
	r.GET("/healthz", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status": "healthy",
			"system": "li-pdf-core-api",
		})
	})
	r.GET("/readyz", handler.ReadyCheck)

	// Prometheus Metrics Endpoint
	r.GET("/metrics", metrics.DefaultMetrics.Handler())

	v1 := r.Group("/v1")
	{
		// Capability Registry
		v1.GET("/capabilities", handler.GetCapabilities)

		// Direct Uploads & Jobs
		v1.POST("/uploads/presign", handler.PresignUpload)
		v1.POST("/jobs", handler.CreateJob)
		v1.POST("/jobs/batch", handler.CreateBatchJobs)
		v1.GET("/jobs/:id", handler.GetJob)
		v1.POST("/jobs/:id/cancel", handler.CancelJob)
		v1.GET("/jobs/:id/events", sseHub.StreamJobEvents)

		// Local storage fallback endpoints
		v1.PUT("/storage/upload", handler.HandleLocalUpload)
		v1.GET("/storage/download", handler.HandleLocalDownload)
	}

	return r
}
