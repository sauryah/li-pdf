package engine

import (
	"bytes"
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strings"
)

type TesseractOCREngine struct {
	tesseractPath string
	qpdfPath      string
	pdftoppmPath  string
}

func NewTesseractOCREngine() *TesseractOCREngine {
	tess := "tesseract"
	if p, err := exec.LookPath("tesseract"); err == nil {
		tess = p
	}

	qpdf := "qpdf"
	if p, err := exec.LookPath("qpdf"); err == nil {
		qpdf = p
	}

	ppm := "pdftoppm"
	if p, err := exec.LookPath("pdftoppm"); err == nil {
		ppm = p
	}

	return &TesseractOCREngine{
		tesseractPath: tess,
		qpdfPath:      qpdf,
		pdftoppmPath:  ppm,
	}
}

func (t *TesseractOCREngine) Name() string {
	return "tesseract_ocr_v5"
}

// ImageToText extracts text from an image using Tesseract OCR.
func (t *TesseractOCREngine) ImageToText(ctx context.Context, inputPath string, opts OCROptions, outputPath string) error {
	if !fileExists(inputPath) {
		return fmt.Errorf("input image does not exist: %s", inputPath)
	}

	lang := opts.Language
	if lang == "" {
		lang = "eng"
	}

	tempDir, err := os.MkdirTemp("", "lipdf_ocr_txt_")
	if err != nil {
		return fmt.Errorf("failed to create temp dir: %w", err)
	}
	defer os.RemoveAll(tempDir)

	outBase := filepath.Join(tempDir, "ocr_output")
	args := []string{inputPath, outBase, "-l", lang, "txt"}

	cmd := exec.CommandContext(ctx, t.tesseractPath, args...)
	var stderr bytes.Buffer
	cmd.Stderr = &stderr

	if err := cmd.Run(); err != nil {
		return fmt.Errorf("tesseract OCR failed: %w (stderr: %s)", err, stderr.String())
	}

	generatedTxt := outBase + ".txt"
	if !fileExists(generatedTxt) {
		return fmt.Errorf("tesseract did not produce output text file")
	}

	_ = os.MkdirAll(filepath.Dir(outputPath), 0755)
	return copyOrMove(generatedTxt, outputPath)
}

// ImageToSearchablePDF embeds an invisible text layer over the image to create a searchable PDF.
func (t *TesseractOCREngine) ImageToSearchablePDF(ctx context.Context, inputPath string, opts OCROptions, outputPath string) error {
	if !fileExists(inputPath) {
		return fmt.Errorf("input image does not exist: %s", inputPath)
	}

	lang := opts.Language
	if lang == "" {
		lang = "eng"
	}

	tempDir, err := os.MkdirTemp("", "lipdf_ocr_pdf_")
	if err != nil {
		return fmt.Errorf("failed to create temp dir: %w", err)
	}
	defer os.RemoveAll(tempDir)

	outBase := filepath.Join(tempDir, "ocr_pdf")
	args := []string{inputPath, outBase, "-l", lang, "pdf"}

	cmd := exec.CommandContext(ctx, t.tesseractPath, args...)
	var stderr bytes.Buffer
	cmd.Stderr = &stderr

	if err := cmd.Run(); err != nil {
		return fmt.Errorf("tesseract searchable PDF creation failed: %w (stderr: %s)", err, stderr.String())
	}

	generatedPDF := outBase + ".pdf"
	if !fileExists(generatedPDF) {
		return fmt.Errorf("tesseract did not produce searchable PDF")
	}

	_ = os.MkdirAll(filepath.Dir(outputPath), 0755)
	return copyOrMove(generatedPDF, outputPath)
}

// PDFToSearchablePDF rasterizes scanned PDF pages, runs OCR on each page, and recombines into a searchable PDF.
func (t *TesseractOCREngine) PDFToSearchablePDF(ctx context.Context, inputPath string, opts OCROptions, outputPath string) error {
	if !fileExists(inputPath) {
		return fmt.Errorf("input PDF does not exist: %s", inputPath)
	}

	lang := opts.Language
	if lang == "" {
		lang = "eng"
	}

	dpi := opts.DPI
	if dpi <= 0 {
		dpi = 200
	}

	tempDir, err := os.MkdirTemp("", "lipdf_pdf_ocr_")
	if err != nil {
		return fmt.Errorf("failed to create temp dir: %w", err)
	}
	defer os.RemoveAll(tempDir)

	// 1. Rasterize PDF pages
	pagePrefix := filepath.Join(tempDir, "page")
	renderCmd := exec.CommandContext(ctx, t.pdftoppmPath, "-png", "-r", fmt.Sprintf("%d", dpi), inputPath, pagePrefix)
	var renderStderr bytes.Buffer
	renderCmd.Stderr = &renderStderr
	if err := renderCmd.Run(); err != nil {
		return fmt.Errorf("failed to rasterize PDF for OCR: %w (stderr: %s)", err, renderStderr.String())
	}

	// 2. Discover rendered page PNGs
	entries, err := os.ReadDir(tempDir)
	if err != nil {
		return fmt.Errorf("failed to read rendered pages: %w", err)
	}

	var pagePNGs []string
	for _, e := range entries {
		if !e.IsDir() && strings.HasPrefix(e.Name(), "page-") && strings.HasSuffix(e.Name(), ".png") {
			pagePNGs = append(pagePNGs, filepath.Join(tempDir, e.Name()))
		}
	}

	if len(pagePNGs) == 0 {
		return fmt.Errorf("no pages rendered from PDF")
	}

	sort.Strings(pagePNGs)

	// 3. OCR each page into a single-page searchable PDF
	var ocrPDFPages []string
	for i, pngPath := range pagePNGs {
		pageBase := filepath.Join(tempDir, fmt.Sprintf("ocr_page_%04d", i+1))
		tessCmd := exec.CommandContext(ctx, t.tesseractPath, pngPath, pageBase, "-l", lang, "pdf")
		var tessStderr bytes.Buffer
		tessCmd.Stderr = &tessStderr
		if err := tessCmd.Run(); err != nil {
			return fmt.Errorf("OCR failed on page %d: %w (stderr: %s)", i+1, err, tessStderr.String())
		}

		pagePDF := pageBase + ".pdf"
		if fileExists(pagePDF) {
			ocrPDFPages = append(ocrPDFPages, pagePDF)
		}
	}

	if len(ocrPDFPages) == 0 {
		return fmt.Errorf("failed to generate any OCR PDF pages")
	}

	// 4. Merge all searchable PDF pages into destination outputPath
	_ = os.MkdirAll(filepath.Dir(outputPath), 0755)

	if len(ocrPDFPages) == 1 {
		return copyOrMove(ocrPDFPages[0], outputPath)
	}

	mergeArgs := []string{"--empty", "--pages"}
	mergeArgs = append(mergeArgs, ocrPDFPages...)
	mergeArgs = append(mergeArgs, "--", outputPath)

	mergeCmd := exec.CommandContext(ctx, t.qpdfPath, mergeArgs...)
	var mergeStderr bytes.Buffer
	mergeCmd.Stderr = &mergeStderr
	if err := mergeCmd.Run(); err != nil {
		return fmt.Errorf("failed to merge OCR PDF pages: %w (stderr: %s)", err, mergeStderr.String())
	}

	if !fileExists(outputPath) {
		return fmt.Errorf("output searchable PDF missing after merge")
	}

	return nil
}
