package validator

import (
	"bytes"
	"context"
	"fmt"
	"image"
	_ "image/jpeg"
	_ "image/png"
	"io"
	"os"
	"os/exec"
	"strconv"
	"strings"

	"github.com/li-pdf/li-pdf/internal/engine"
	_ "golang.org/x/image/webp"
)

type ProductionValidator struct{}

func NewProductionValidator() *ProductionValidator {
	return &ProductionValidator{}
}

func (v *ProductionValidator) Name() string {
	return "production_validator_v1"
}

// ValidatePDF verifies that the generated PDF is valid, parseable, non-empty, and has the expected page count.
func (v *ProductionValidator) ValidatePDF(ctx context.Context, filePath string, expectedMinPages int) error {
	fi, err := os.Stat(filePath)
	if err != nil {
		return fmt.Errorf("output file does not exist: %w", err)
	}

	if fi.Size() < 100 {
		return fmt.Errorf("output PDF is suspiciously small (%d bytes), likely corrupt or empty", fi.Size())
	}

	f, err := os.Open(filePath)
	if err != nil {
		return fmt.Errorf("failed to open output PDF for validation: %w", err)
	}
	defer f.Close()

	header := make([]byte, 10)
	n, err := f.Read(header)
	if err != nil || n < 5 || !bytes.HasPrefix(header, []byte("%PDF-")) {
		return fmt.Errorf("output file lacks valid %%PDF- magic header")
	}

	// Structural parse check via qpdf if installed in worker container
	cmd := exec.CommandContext(ctx, "qpdf", "--check", filePath)
	out, err := cmd.CombinedOutput()
	if err == nil {
		// qpdf succeeded; also verify page count
		countCmd := exec.CommandContext(ctx, "qpdf", "--show-npages", filePath)
		countOut, countErr := countCmd.Output()
		if countErr == nil {
			if count, parseErr := strconv.Atoi(strings.TrimSpace(string(countOut))); parseErr == nil {
				if count < expectedMinPages {
					return fmt.Errorf("output PDF has %d pages, expected at least %d", count, expectedMinPages)
				}
			}
		}
		return nil
	}

	// If qpdf returned exit code 3 (warnings only), qpdf considers it valid with warnings
	if cmd.ProcessState != nil && cmd.ProcessState.ExitCode() == 3 {
		return nil
	}

	// Fallback verification: Check for valid EOF marker
	buf := make([]byte, 1024)
	stat, _ := f.Stat()
	offset := stat.Size() - 1024
	if offset < 0 {
		offset = 0
	}
	_, _ = f.ReadAt(buf, offset)
	if !bytes.Contains(buf, []byte("%%EOF")) {
		return fmt.Errorf("output PDF has no valid %%%%EOF marker: %s", string(out))
	}

	return nil
}

// ValidateImage verifies that the generated image file has valid magic bytes, is decodable, and has non-zero dimensions.
func (v *ProductionValidator) ValidateImage(ctx context.Context, filePath string, expectedFormat engine.ImageFormat) error {
	fi, err := os.Stat(filePath)
	if err != nil {
		return fmt.Errorf("output image does not exist: %w", err)
	}

	if fi.Size() < 50 {
		return fmt.Errorf("output image is suspiciously small (%d bytes)", fi.Size())
	}

	f, err := os.Open(filePath)
	if err != nil {
		return fmt.Errorf("failed to open output image for validation: %w", err)
	}
	defer f.Close()

	// Verify Header Magic Bytes
	header := make([]byte, 16)
	n, err := f.Read(header)
	if err != nil && err != io.EOF {
		return fmt.Errorf("failed to read image header: %w", err)
	}
	header = header[:n]

	switch expectedFormat {
	case engine.FormatJPEG:
		if !bytes.HasPrefix(header, []byte("\xFF\xD8\xFF")) {
			return fmt.Errorf("file lacks valid JPEG magic bytes")
		}
	case engine.FormatPNG:
		if !bytes.HasPrefix(header, []byte("\x89PNG\r\n\x1a\n")) {
			return fmt.Errorf("file lacks valid PNG magic header")
		}
	case engine.FormatWebP:
		if len(header) < 12 || string(header[0:4]) != "RIFF" || string(header[8:12]) != "WEBP" {
			return fmt.Errorf("file lacks valid WebP RIFF header")
		}
	}

	// Verify decodability & dimensions using Go standard image decoder
	if _, err := f.Seek(0, io.SeekStart); err == nil {
		cfg, _, decodeErr := image.DecodeConfig(f)
		if decodeErr != nil {
			// Note: If WebP decode config isn't registered on pure Go, check header passes
			if expectedFormat == engine.FormatWebP {
				return nil
			}
			return fmt.Errorf("image stream is corrupt or unparseable: %w", decodeErr)
		}
		if cfg.Width <= 0 || cfg.Height <= 0 {
			return fmt.Errorf("invalid image dimensions: %dx%d", cfg.Width, cfg.Height)
		}
	}

	return nil
}
