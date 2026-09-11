package api

import (
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/li-pdf/li-pdf/internal/config"
	"github.com/li-pdf/li-pdf/internal/models"
	"github.com/li-pdf/li-pdf/internal/preflight"
	"github.com/li-pdf/li-pdf/internal/queue"
	"github.com/li-pdf/li-pdf/internal/registry"
	"github.com/li-pdf/li-pdf/internal/storage"
)

type APIHandler struct {
	cfg       *config.Config
	registry  *registry.Registry
	preflight *preflight.Analyzer
	storage   storage.StorageManager
	queue     queue.JobQueue

	// In-memory store for state (complemented by DB in production)
	uploadsMu sync.RWMutex
	uploads   map[uuid.UUID]*models.FileUpload

	jobsMu sync.RWMutex
	jobs   map[uuid.UUID]*models.Job

	outputsMu sync.RWMutex
	outputs   map[uuid.UUID][]*models.Output

	idempotencyMu sync.RWMutex
	idempotentMap map[string]uuid.UUID
}

func NewAPIHandler(
	cfg *config.Config,
	reg *registry.Registry,
	pf *preflight.Analyzer,
	st storage.StorageManager,
	q queue.JobQueue,
) *APIHandler {
	return &APIHandler{
		cfg:           cfg,
		registry:      reg,
		preflight:     pf,
		storage:       st,
		queue:         q,
		uploads:       make(map[uuid.UUID]*models.FileUpload),
		jobs:          make(map[uuid.UUID]*models.Job),
		outputs:       make(map[uuid.UUID][]*models.Output),
		idempotentMap: make(map[string]uuid.UUID),
	}
}

// GetCapabilities returns all registered format conversions and limits.
func (h *APIHandler) GetCapabilities(c *gin.Context) {
	mimeFilter := c.Query("source_mime")
	if mimeFilter != "" {
		c.JSON(http.StatusOK, gin.H{"capabilities": h.registry.FindByMIME(mimeFilter)})
		return
	}
	c.JSON(http.StatusOK, gin.H{"capabilities": h.registry.ListAll()})
}

type PresignRequest struct {
	Filename  string `json:"filename" binding:"required"`
	SizeBytes int64  `json:"size_bytes" binding:"required"`
	MimeType  string `json:"mime_type" binding:"required"`
	SHA256    string `json:"sha256"`
}

// PresignUpload handles allocation of direct-to-storage upload URLs.
func (h *APIHandler) PresignUpload(c *gin.Context) {
	var req PresignRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request", "details": err.Error()})
		return
	}

	maxBytes := h.cfg.MaxUploadMB * 1024 * 1024
	if req.SizeBytes > maxBytes {
		c.JSON(http.StatusRequestEntityTooLarge, gin.H{"error": fmt.Sprintf("file size exceeds maximum allowed (%d MB)", h.cfg.MaxUploadMB)})
		return
	}

	uploadID := uuid.New()
	ext := filepath.Ext(req.Filename)
	storageKey := fmt.Sprintf("raw-uploads/%s%s", uploadID.String(), ext)

	presigned, err := h.storage.GeneratePresignedUpload(c.Request.Context(), storageKey, req.MimeType, 30*time.Minute)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate upload slot", "details": err.Error()})
		return
	}

	uploadRecord := &models.FileUpload{
		ID:               uploadID,
		StorageKey:       storageKey,
		OriginalFilename: filepath.Base(req.Filename),
		FileSize:         req.SizeBytes,
		MimeType:         req.MimeType,
		SHA256Hash:       req.SHA256,
		Status:           models.FileUploadPending,
		ExpiresAt:        time.Now().Add(h.cfg.DefaultTTL),
		CreatedAt:        time.Now(),
	}

	h.uploadsMu.Lock()
	h.uploads[uploadID] = uploadRecord
	h.uploadsMu.Unlock()

	c.JSON(http.StatusCreated, gin.H{
		"upload_id":   uploadID.String(),
		"storage_key": storageKey,
		"upload_url":  presigned.UploadURL,
		"expires_at":  presigned.ExpiresAt,
	})
}

type CreateJobRequest struct {
	UploadID   string         `json:"upload_id" binding:"required"`
	Operation  string         `json:"operation" binding:"required"`
	Parameters map[string]any `json:"parameters"`
}

// CreateJob enqueues a processing job with preflight analysis and idempotency check.
func (h *APIHandler) CreateJob(c *gin.Context) {
	idempotencyKey := c.GetHeader("Idempotency-Key")
	if idempotencyKey != "" {
		h.idempotencyMu.RLock()
		existingJobID, exists := h.idempotentMap[idempotencyKey]
		h.idempotencyMu.RUnlock()

		if exists {
			h.jobsMu.RLock()
			existingJob := h.jobs[existingJobID]
			h.jobsMu.RUnlock()
			if existingJob != nil {
				c.JSON(http.StatusOK, existingJob)
				return
			}
		}
	}

	var req CreateJobRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid job request", "details": err.Error()})
		return
	}

	uploadUUID, err := uuid.Parse(req.UploadID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid upload_id format"})
		return
	}

	h.uploadsMu.RLock()
	uploadRecord, found := h.uploads[uploadUUID]
	h.uploadsMu.RUnlock()

	if !found {
		c.JSON(http.StatusNotFound, gin.H{"error": "upload record not found"})
		return
	}

	// Preflight analysis
	cap, capFound := h.registry.FindOperation(req.Operation, uploadRecord.MimeType)
	resourceProfile := models.ProfilePDFStandard
	assignedQueue := "queue_pdf_std"
	if capFound {
		resourceProfile = cap.ResourceProfile
		assignedQueue = cap.Queue
	}

	jobID := uuid.New()
	job := &models.Job{
		ID:              jobID,
		IdempotencyKey:  &idempotencyKey,
		UploadID:        uploadUUID,
		Operation:       req.Operation,
		Parameters:      req.Parameters,
		Status:          models.JobStatusQueued,
		ProgressPercent: 0,
		ResourceProfile: resourceProfile,
		MaxRetries:      2,
		RetryCount:      0,
		CreatedAt:       time.Now(),
	}

	h.jobsMu.Lock()
	h.jobs[jobID] = job
	h.jobsMu.Unlock()

	if idempotencyKey != "" {
		h.idempotencyMu.Lock()
		h.idempotentMap[idempotencyKey] = jobID
		h.idempotencyMu.Unlock()
	}

	// Dispatch task to queue
	taskPayload := &queue.TaskPayload{
		JobID:           jobID,
		UploadID:        uploadUUID,
		Operation:       req.Operation,
		Parameters:      req.Parameters,
		ResourceProfile: resourceProfile,
		AssignedQueue:   assignedQueue,
		InputStorageKey: uploadRecord.StorageKey,
		OriginalName:    uploadRecord.OriginalFilename,
		MimeType:        uploadRecord.MimeType,
	}

	if err := h.queue.Enqueue(c.Request.Context(), assignedQueue, taskPayload); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to enqueue job", "details": err.Error()})
		return
	}

	c.JSON(http.StatusAccepted, gin.H{
		"job_id":            jobID.String(),
		"status":            job.Status,
		"progress_percent":  job.ProgressPercent,
		"resource_profile":  job.ResourceProfile,
		"events_stream_url": fmt.Sprintf("/v1/jobs/%s/events", jobID.String()),
	})
}

// GetJob returns current job state, progress, and download outputs.
func (h *APIHandler) GetJob(c *gin.Context) {
	jobIDStr := c.Param("id")
	jobUUID, err := uuid.Parse(jobIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid job id"})
		return
	}

	h.jobsMu.RLock()
	job, found := h.jobs[jobUUID]
	h.jobsMu.RUnlock()

	if !found {
		c.JSON(http.StatusNotFound, gin.H{"error": "job not found"})
		return
	}

	h.outputsMu.RLock()
	outs := h.outputs[jobUUID]
	h.outputsMu.RUnlock()

	// Generate fresh signed URLs for outputs
	var outputsWithURLs []models.Output
	for _, out := range outs {
		o := *out
		signedURL, err := h.storage.GeneratePresignedDownload(c.Request.Context(), o.StorageKey, o.Filename, 15*time.Minute)
		if err == nil {
			o.DownloadURL = signedURL
		}
		outputsWithURLs = append(outputsWithURLs, o)
	}

	c.JSON(http.StatusOK, gin.H{
		"job":     job,
		"outputs": outputsWithURLs,
	})
}

// CancelJob gracefully requests job cancellation.
func (h *APIHandler) CancelJob(c *gin.Context) {
	jobIDStr := c.Param("id")
	jobUUID, err := uuid.Parse(jobIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid job id"})
		return
	}

	h.jobsMu.Lock()
	job, found := h.jobs[jobUUID]
	if found && job.Status == models.JobStatusProcessing {
		job.Status = models.JobStatusCancelRequested
	} else if found && job.Status == models.JobStatusQueued {
		job.Status = models.JobStatusCancelled
	}
	h.jobsMu.Unlock()

	c.JSON(http.StatusOK, gin.H{"status": "cancellation_requested"})
}

// Local Storage Handler (for direct upload/download in local dev)
func (h *APIHandler) HandleLocalUpload(c *gin.Context) {
	localStorage, ok := h.storage.(*storage.LocalStorageManager)
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "local storage not enabled"})
		return
	}

	key := c.Query("key")
	exp := c.Query("exp")
	sig := c.Query("sig")

	if !localStorage.VerifySignature(key, exp, sig) {
		c.JSON(http.StatusForbidden, gin.H{"error": "invalid or expired signature"})
		return
	}

	localPath := localStorage.GetLocalPath(key)
	if err := os.MkdirAll(filepath.Dir(localPath), 0755); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	dst, err := os.Create(localPath)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer dst.Close()

	if _, err := io.Copy(dst, c.Request.Body); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.Status(http.StatusOK)
}

func (h *APIHandler) HandleLocalDownload(c *gin.Context) {
	localStorage, ok := h.storage.(*storage.LocalStorageManager)
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "local storage not enabled"})
		return
	}

	key := c.Query("key")
	filename := c.Query("filename")
	exp := c.Query("exp")
	sig := c.Query("sig")

	if !localStorage.VerifySignature(key, exp, sig) {
		c.JSON(http.StatusForbidden, gin.H{"error": "invalid or expired signature"})
		return
	}

	localPath := localStorage.GetLocalPath(key)
	if _, err := os.Stat(localPath); os.IsNotExist(err) {
		c.JSON(http.StatusNotFound, gin.H{"error": "file not found"})
		return
	}

	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s\"", filename))
	c.File(localPath)
}

// Internal worker hook to register job output
func (h *APIHandler) RegisterJobOutput(jobID uuid.UUID, out *models.Output) {
	h.outputsMu.Lock()
	h.outputs[jobID] = append(h.outputs[jobID], out)
	h.outputsMu.Unlock()
}

func (h *APIHandler) UpdateJobStatus(jobID uuid.UUID, status models.JobStatus, progress int) {
	h.jobsMu.Lock()
	if j, ok := h.jobs[jobID]; ok {
		j.Status = status
		j.ProgressPercent = progress
		if status == models.JobStatusCompleted || status == models.JobStatusFailed {
			now := time.Now()
			j.CompletedAt = &now
		}
	}
	h.jobsMu.Unlock()
}
