package models

import (
	"time"

	"github.com/google/uuid"
)

type UserTier string

const (
	TierFree       UserTier = "free"
	TierPro        UserTier = "pro"
	TierEnterprise UserTier = "enterprise"
)

type User struct {
	ID           uuid.UUID `json:"id"`
	Email        string    `json:"email"`
	PasswordHash string    `json:"-"`
	Tier         UserTier  `json:"tier"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

type FileUploadStatus string

const (
	FileUploadPending   FileUploadStatus = "pending"
	FileUploadUploaded  FileUploadStatus = "uploaded"
	FileUploadProcessed FileUploadStatus = "processed"
	FileUploadPurged    FileUploadStatus = "purged"
)

type FileUpload struct {
	ID               uuid.UUID        `json:"id"`
	UserID           *uuid.UUID       `json:"user_id,omitempty"`
	StorageKey       string           `json:"storage_key"`
	OriginalFilename string           `json:"original_filename"`
	FileSize         int64            `json:"file_size"`
	MimeType         string           `json:"mime_type"`
	SHA256Hash       string           `json:"sha256_hash"`
	Status           FileUploadStatus `json:"status"`
	ExpiresAt        time.Time        `json:"expires_at"`
	CreatedAt        time.Time        `json:"created_at"`
}

type JobStatus string

const (
	JobStatusQueued          JobStatus = "queued"
	JobStatusLeased          JobStatus = "leased"
	JobStatusProcessing      JobStatus = "processing"
	JobStatusValidating      JobStatus = "validating"
	JobStatusCompleted       JobStatus = "completed"
	JobStatusFailed          JobStatus = "failed"
	JobStatusRetrying        JobStatus = "retrying"
	JobStatusCancelRequested JobStatus = "cancel_requested"
	JobStatusCancelled       JobStatus = "cancelled"
)

type ResourceProfile string

const (
	ProfileImageSmall  ResourceProfile = "IMAGE_SMALL"
	ProfileImageLarge  ResourceProfile = "IMAGE_LARGE"
	ProfilePDFStandard ResourceProfile = "PDF_STANDARD"
	ProfilePDFHeavy    ResourceProfile = "PDF_HEAVY"
	ProfileOffice      ResourceProfile = "OFFICE"
	ProfileOCRBatch    ResourceProfile = "OCR_BATCH"
)

type Job struct {
	ID              uuid.UUID       `json:"id"`
	IdempotencyKey  *string         `json:"idempotency_key,omitempty"`
	BatchID         *uuid.UUID      `json:"batch_id,omitempty"`
	UserID          *uuid.UUID      `json:"user_id,omitempty"`
	UploadID        uuid.UUID       `json:"upload_id"`
	Operation       string          `json:"operation"`
	Parameters      map[string]any  `json:"parameters"`
	Status          JobStatus       `json:"status"`
	ProgressPercent int             `json:"progress_percent"`
	ActiveWorkerID  *string         `json:"active_worker_id,omitempty"`
	ResourceProfile ResourceProfile `json:"resource_profile"`
	MaxRetries      int             `json:"max_retries"`
	RetryCount      int             `json:"retry_count"`
	CreatedAt       time.Time       `json:"created_at"`
	CompletedAt     *time.Time      `json:"completed_at,omitempty"`
}

type JobAttempt struct {
	ID               uuid.UUID       `json:"id"`
	JobID            uuid.UUID       `json:"job_id"`
	AttemptNumber    int             `json:"attempt_number"`
	WorkerID         string          `json:"worker_id"`
	EngineName       string          `json:"engine_name"`
	ResourceProfile  ResourceProfile `json:"resource_profile"`
	StartedAt        time.Time       `json:"started_at"`
	EndedAt          *time.Time      `json:"ended_at,omitempty"`
	ExitCode         *int            `json:"exit_code,omitempty"`
	PeakMemoryBytes  *int64          `json:"peak_memory_bytes,omitempty"`
	ValidationStatus string          `json:"validation_status,omitempty"` // passed, failed, skipped
	ErrorCode        *string         `json:"error_code,omitempty"`
	ErrorDetails     *string         `json:"error_details,omitempty"`
}

type Output struct {
	ID               uuid.UUID `json:"id"`
	JobID            uuid.UUID `json:"job_id"`
	StorageKey       string    `json:"storage_key"`
	Filename         string    `json:"filename"`
	FileSize         int64     `json:"file_size"`
	MimeType         string    `json:"mime_type"`
	PageNumber       *int      `json:"page_number,omitempty"`
	ValidationPassed bool      `json:"validation_passed"`
	ExpiresAt        time.Time `json:"expires_at"`
	CreatedAt        time.Time `json:"created_at"`
	DownloadURL      string    `json:"download_url,omitempty"` // Populated dynamically with signed URL
}
