package engine

import (
	"bytes"
	"context"
	"image"
	"image/color"
	"image/png"
	"os"
	"path/filepath"
	"testing"
)

func createTestPNG(path string, width, height int) error {
	img := image.NewRGBA(image.Rect(0, 0, width, height))
	// Fill with simple color
	for y := 0; y < height; y++ {
		for x := 0; x < width; x++ {
			img.Set(x, y, color.RGBA{R: 200, G: 50, B: 50, A: 255})
		}
	}

	f, err := os.Create(path)
	if err != nil {
		return err
	}
	defer f.Close()

	return png.Encode(f, img)
}

func TestGenerateSimplePDFFromImages(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "lipdf_engine_test_")
	if err != nil {
		t.Fatalf("Failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	img1 := filepath.Join(tempDir, "img1.png")
	img2 := filepath.Join(tempDir, "img2.png")

	if err := createTestPNG(img1, 200, 200); err != nil {
		t.Fatalf("Failed to create test PNG 1: %v", err)
	}
	if err := createTestPNG(img2, 300, 300); err != nil {
		t.Fatalf("Failed to create test PNG 2: %v", err)
	}

	outPDF := filepath.Join(tempDir, "output.pdf")
	if err := generateSimplePDFFromImages([]string{img1, img2}, outPDF); err != nil {
		t.Fatalf("generateSimplePDFFromImages failed: %v", err)
	}

	pdfBytes, err := os.ReadFile(outPDF)
	if err != nil {
		t.Fatalf("Failed to read generated PDF: %v", err)
	}

	if !bytes.HasPrefix(pdfBytes, []byte("%PDF-1.4")) {
		t.Errorf("Expected PDF header %%PDF-1.4, got %s", string(pdfBytes[:8]))
	}

	if !bytes.Contains(pdfBytes, []byte("startxref")) {
		t.Errorf("PDF missing startxref cross reference table")
	}

	if !bytes.Contains(pdfBytes, []byte("%%EOF")) {
		t.Errorf("PDF missing %%EOF marker")
	}
}

func TestVipsImageProcessor_ImagesToPDF(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "lipdf_vips_test_")
	if err != nil {
		t.Fatalf("Failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	img1 := filepath.Join(tempDir, "img1.png")
	if err := createTestPNG(img1, 150, 150); err != nil {
		t.Fatalf("Failed to create test PNG: %v", err)
	}

	proc := NewVipsImageProcessor()
	outPDF := filepath.Join(tempDir, "out_vips.pdf")
	if err := proc.ImagesToPDF(context.Background(), []string{img1}, outPDF); err != nil {
		t.Fatalf("ImagesToPDF failed: %v", err)
	}

	pdfData, err := os.ReadFile(outPDF)
	if err != nil || len(pdfData) < 100 {
		t.Fatalf("Invalid output PDF: size %d, err %v", len(pdfData), err)
	}
}
