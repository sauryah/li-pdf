package preflight

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/li-pdf/li-pdf/internal/models"
	"github.com/li-pdf/li-pdf/internal/registry"
)

type FileAnalysis struct {
	DetectedMIME    string                 `json:"detected_mime"`
	FileSize        int64                  `json:"file_size"`
	PageCount       int                    `json:"page_count"`
	IsEncrypted     bool                   `json:"is_encrypted"`
	HasScannedPages bool                   `json:"has_scanned_pages"`
	ResourceProfile models.ResourceProfile `json:"resource_profile"`
	AssignedQueue   string                 `json:"assigned_queue"`
	Capability      *registry.Capability   `json:"capability,omitempty"`
}

type Analyzer struct {
	reg *registry.Registry
}

func NewAnalyzer(reg *registry.Registry) *Analyzer {
	return &Analyzer{reg: reg}
}

// Analyze inspects the file at path and determines the appropriate resource profile and queue.
func (a *Analyzer) Analyze(ctx context.Context, filePath string, operation string) (*FileAnalysis, error) {
	fi, err := os.Stat(filePath)
	if err != nil {
		return nil, fmt.Errorf("failed to stat file: %w", err)
	}

	mimeType, err := detectMIME(filePath)
	if err != nil {
		mimeType = "application/octet-stream"
	}

	analysis := &FileAnalysis{
		DetectedMIME:    mimeType,
		FileSize:        fi.Size(),
		PageCount:       1,
		IsEncrypted:     false,
		HasScannedPages: false,
		ResourceProfile: models.ProfileImageSmall,
		AssignedQueue:   "queue_image_fast",
	}

	// Lookup capability from registry
	cap, found := a.reg.FindOperation(operation, mimeType)
	if !found {
		// Try finding without strict source MIME match
		cap, found = a.reg.FindOperation(operation, "")
	}
	if found {
		analysis.Capability = cap
		analysis.ResourceProfile = cap.ResourceProfile
		analysis.AssignedQueue = cap.Queue
	}

	// Specific PDF deep probes
	if strings.Contains(mimeType, "pdf") || strings.HasSuffix(strings.ToLower(filePath), ".pdf") {
		pageCount, encrypted, probeErr := probePDF(ctx, filePath)
		if probeErr == nil {
			analysis.PageCount = pageCount
			analysis.IsEncrypted = encrypted
		}

		// Dynamically elevate resource profile for large/heavy PDFs
		if analysis.PageCount > 50 || analysis.FileSize > 50*1024*1024 || operation == "pdf_compress" {
			analysis.ResourceProfile = models.ProfilePDFHeavy
			analysis.AssignedQueue = "queue_pdf_heavy"
		} else {
			analysis.ResourceProfile = models.ProfilePDFStandard
			analysis.AssignedQueue = "queue_pdf_std"
		}
	} else if strings.HasPrefix(mimeType, "image/") {
		if analysis.FileSize > 20*1024*1024 {
			analysis.ResourceProfile = models.ProfileImageLarge
		} else {
			analysis.ResourceProfile = models.ProfileImageSmall
		}
	} else if strings.Contains(mimeType, "officedocument") || strings.Contains(mimeType, "opendocument") || strings.Contains(mimeType, "msword") || strings.Contains(mimeType, "rtf") || strings.Contains(mimeType, "text/") {
		analysis.ResourceProfile = models.ProfileOffice
		analysis.AssignedQueue = "queue_office"
	}

	return analysis, nil
}

func detectMIME(filePath string) (string, error) {
	// First check extension for deterministic types
	ext := strings.ToLower(filepath.Ext(filePath))
	switch ext {
	case ".docx":
		return "application/vnd.openxmlformats-officedocument.wordprocessingml.document", nil
	case ".xlsx":
		return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", nil
	case ".pptx":
		return "application/vnd.openxmlformats-officedocument.presentationml.presentation", nil
	case ".doc":
		return "application/msword", nil
	case ".xls":
		return "application/vnd.ms-excel", nil
	case ".ppt":
		return "application/vnd.ms-powerpoint", nil
	case ".odt":
		return "application/vnd.oasis.opendocument.text", nil
	case ".rtf":
		return "application/rtf", nil
	case ".txt":
		return "text/plain", nil
	case ".html", ".htm":
		return "text/html", nil
	}

	f, err := os.Open(filePath)
	if err != nil {
		return "", err
	}
	defer f.Close()

	header := make([]byte, 512)
	n, err := f.Read(header)
	if err != nil && err != io.EOF {
		return "", err
	}
	header = header[:n]

	// Magic byte identification
	if bytes.HasPrefix(header, []byte("%PDF-")) {
		return "application/pdf", nil
	}
	if bytes.HasPrefix(header, []byte("\xFF\xD8\xFF")) {
		return "image/jpeg", nil
	}
	if bytes.HasPrefix(header, []byte("\x89PNG\r\n\x1a\n")) {
		return "image/png", nil
	}
	if len(header) >= 12 && string(header[0:4]) == "RIFF" && string(header[8:12]) == "WEBP" {
		return "image/webp", nil
	}
	if bytes.HasPrefix(header, []byte("{\\rtf1")) {
		return "application/rtf", nil
	}
	if bytes.HasPrefix(header, []byte("<!DOCTYPE html")) || bytes.HasPrefix(header, []byte("<html")) {
		return "text/html", nil
	}

	return "application/octet-stream", nil
}

func probePDF(ctx context.Context, filePath string) (int, bool, error) {
	// Probe page count via qpdf or pdfinfo if available
	cmd := exec.CommandContext(ctx, "qpdf", "--show-npages", filePath)
	out, err := cmd.Output()
	if err == nil {
		countStr := strings.TrimSpace(string(out))
		if count, parseErr := strconv.Atoi(countStr); parseErr == nil {
			return count, false, nil
		}
	}

	// Fallback lightweight regex inspection for /Count in /Pages
	data, readErr := os.ReadFile(filePath)
	if readErr == nil {
		isEncrypted := bytes.Contains(data, []byte("/Encrypt"))
		return 1, isEncrypted, nil
	}

	return 1, false, nil
}
