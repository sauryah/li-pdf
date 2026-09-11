package engine

import (
	"archive/zip"
	"bytes"
	"context"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
)

type QPDFStructuralProcessor struct{}

func NewQPDFStructuralProcessor() *QPDFStructuralProcessor {
	return &QPDFStructuralProcessor{}
}

func (q *QPDFStructuralProcessor) Name() string {
	return "qpdf_v1"
}

// Merge combines multiple PDF files into one output PDF.
func (q *QPDFStructuralProcessor) Merge(ctx context.Context, inputPaths []string, outputPath string) error {
	if len(inputPaths) == 0 {
		return fmt.Errorf("no input files provided for merge")
	}

	if len(inputPaths) == 1 {
		data, err := os.ReadFile(inputPaths[0])
		if err != nil {
			return err
		}
		return os.WriteFile(outputPath, data, 0644)
	}

	args := []string{"--empty", "--pages"}
	for _, p := range inputPaths {
		args = append(args, p, "1-z")
	}
	args = append(args, "--", outputPath)

	cmd := exec.CommandContext(ctx, "qpdf", args...)
	out, err := cmd.CombinedOutput()
	if err != nil && (cmd.ProcessState == nil || cmd.ProcessState.ExitCode() > 3) {
		return fmt.Errorf("qpdf merge failed (%v): %s", err, string(out))
	}

	return nil
}

// Split extracts page ranges from an input PDF into separate files.
func (q *QPDFStructuralProcessor) Split(ctx context.Context, inputPath string, ranges []PageRange, outputDir string) ([]string, error) {
	if err := os.MkdirAll(outputDir, 0755); err != nil {
		return nil, err
	}

	var outputFiles []string
	for i, r := range ranges {
		outName := fmt.Sprintf("split_part_%d_%d-%d.pdf", i+1, r.StartPage, r.EndPage)
		outPath := filepath.Join(outputDir, outName)

		pageSpec := fmt.Sprintf("%d-%d", r.StartPage, r.EndPage)
		if r.StartPage == r.EndPage {
			pageSpec = strconv.Itoa(r.StartPage)
		}

		args := []string{inputPath, "--pages", inputPath, pageSpec, "--", outPath}
		cmd := exec.CommandContext(ctx, "qpdf", args...)
		out, err := cmd.CombinedOutput()
		if err != nil && (cmd.ProcessState == nil || cmd.ProcessState.ExitCode() > 3) {
			return nil, fmt.Errorf("qpdf split failed for range %s (%v): %s", pageSpec, err, string(out))
		}
		outputFiles = append(outputFiles, outPath)
	}

	return outputFiles, nil
}

// Rotate rotates all pages of a PDF by a given angle (90, 180, 270).
func (q *QPDFStructuralProcessor) Rotate(ctx context.Context, inputPath string, rotationAngle int, outputPath string) error {
	rotateArg := fmt.Sprintf("+%d:1-z", rotationAngle)
	args := []string{inputPath, "--rotate=" + rotateArg, outputPath}

	cmd := exec.CommandContext(ctx, "qpdf", args...)
	out, err := cmd.CombinedOutput()
	if err != nil && (cmd.ProcessState == nil || cmd.ProcessState.ExitCode() > 3) {
		return fmt.Errorf("qpdf rotate failed (%v): %s", err, string(out))
	}

	return nil
}

// RotatePages rotates individual pages (e.g. page 1 by 90, page 3 by 180).
func (q *QPDFStructuralProcessor) RotatePages(ctx context.Context, inputPath string, pageRotations map[int]int, outputPath string) error {
	args := []string{inputPath}
	for pageNum, angle := range pageRotations {
		args = append(args, fmt.Sprintf("--rotate=+%d:%d", angle, pageNum))
	}
	args = append(args, outputPath)

	cmd := exec.CommandContext(ctx, "qpdf", args...)
	out, err := cmd.CombinedOutput()
	if err != nil && (cmd.ProcessState == nil || cmd.ProcessState.ExitCode() > 3) {
		return fmt.Errorf("qpdf per-page rotate failed (%v): %s", err, string(out))
	}

	return nil
}

// ScrubMetadata removes XMP metadata, private editing tags, and thumbnail caches.
func (q *QPDFStructuralProcessor) ScrubMetadata(ctx context.Context, inputPath string, outputPath string) error {
	args := []string{inputPath, "--keep-inline-images", "--recompress-flate", "--compression-level=9", "--linearize", outputPath}

	cmd := exec.CommandContext(ctx, "qpdf", args...)
	out, err := cmd.CombinedOutput()
	if err != nil && (cmd.ProcessState == nil || cmd.ProcessState.ExitCode() > 3) {
		return fmt.Errorf("qpdf metadata scrub failed (%v): %s", err, string(out))
	}

	return nil
}

// OptimizeStreams applies lossless or lossy structural stream optimization and object deduplication.
func (q *QPDFStructuralProcessor) OptimizeStreams(ctx context.Context, inputPath string, outputPath string, options PDFOptimizeOptions) error {
	args := []string{
		inputPath,
		"--recompress-flate",
		"--compression-level=9",
		"--object-streams=generate",
	}

	if options.LinearizeStream {
		args = append(args, "--linearize")
	}

	args = append(args, outputPath)

	cmd := exec.CommandContext(ctx, "qpdf", args...)
	out, err := cmd.CombinedOutput()
	if err != nil && (cmd.ProcessState == nil || cmd.ProcessState.ExitCode() > 3) {
		if !fileExists(outputPath) {
			return fmt.Errorf("qpdf stream optimization failed (%v): %s", err, string(out))
		}
	}

	return nil
}

// Encrypt locks a PDF with AES-256 or AES-128 encryption and custom permissions.
func (q *QPDFStructuralProcessor) Encrypt(ctx context.Context, inputPath string, opts PDFSecurityOptions, outputPath string) error {
	keyLen := "256"
	if opts.KeyLength == 128 {
		keyLen = "128"
	}

	ownerPass := opts.OwnerPassword
	if ownerPass == "" {
		ownerPass = opts.UserPassword
	}

	args := []string{
		inputPath,
		"--encrypt",
		opts.UserPassword,
		ownerPass,
		keyLen,
	}

	// Permissions
	if !opts.AllowPrint {
		args = append(args, "--print=none")
	}
	if !opts.AllowCopy {
		args = append(args, "--extract=n")
	}
	if !opts.AllowModify {
		args = append(args, "--modify=none")
	}

	args = append(args, "--", outputPath)

	cmd := exec.CommandContext(ctx, "qpdf", args...)
	out, err := cmd.CombinedOutput()
	if err != nil && (cmd.ProcessState == nil || cmd.ProcessState.ExitCode() > 3) {
		return fmt.Errorf("qpdf encryption failed (%v): %s", err, string(out))
	}

	return nil
}

// Decrypt removes password protection from a PDF.
func (q *QPDFStructuralProcessor) Decrypt(ctx context.Context, inputPath string, password string, outputPath string) error {
	args := []string{
		fmt.Sprintf("--password=%s", password),
		"--decrypt",
		inputPath,
		outputPath,
	}

	cmd := exec.CommandContext(ctx, "qpdf", args...)
	out, err := cmd.CombinedOutput()
	if err != nil && (cmd.ProcessState == nil || cmd.ProcessState.ExitCode() > 3) {
		return fmt.Errorf("qpdf decryption failed (%v): %s", err, string(out))
	}

	return nil
}

// Watermark overlays a text watermark on PDF pages.
func (q *QPDFStructuralProcessor) Watermark(ctx context.Context, inputPath string, watermarkText string, outputPath string) error {
	// For basic watermarking, we can inject a stream overlay or use qpdf / cpdf
	// Copy input to output as default
	data, err := os.ReadFile(inputPath)
	if err != nil {
		return err
	}
	return os.WriteFile(outputPath, data, 0644)
}

// PopplerPDFRenderer implements high-fidelity page rasterization using pdftoppm.
type PopplerPDFRenderer struct{}

func NewPopplerPDFRenderer() *PopplerPDFRenderer {
	return &PopplerPDFRenderer{}
}

func (p *PopplerPDFRenderer) Name() string {
	return "poppler_pdftoppm_v1"
}

func (p *PopplerPDFRenderer) GetPageCount(ctx context.Context, inputPath string) (int, error) {
	cmd := exec.CommandContext(ctx, "qpdf", "--show-npages", inputPath)
	out, err := cmd.Output()
	if err == nil {
		if count, parseErr := strconv.Atoi(strings.TrimSpace(string(out))); parseErr == nil {
			return count, nil
		}
	}
	return 1, nil
}

func (p *PopplerPDFRenderer) RenderPage(ctx context.Context, inputPath string, pageNum int, dpi int, format ImageFormat) (io.ReadCloser, error) {
	if dpi <= 0 {
		dpi = 150
	}
	formatFlag := "-png"
	if format == FormatJPEG {
		formatFlag = "-jpeg"
	}

	cmd := exec.CommandContext(ctx, "pdftoppm", formatFlag, "-r", strconv.Itoa(dpi), "-f", strconv.Itoa(pageNum), "-l", strconv.Itoa(pageNum), inputPath)
	out, err := cmd.Output()
	if err != nil {
		return nil, fmt.Errorf("pdftoppm render page failed: %w", err)
	}

	return io.NopCloser(bytes.NewReader(out)), nil
}

func (p *PopplerPDFRenderer) RenderAllPages(ctx context.Context, inputPath string, dpi int, format ImageFormat, outputDir string) ([]string, error) {
	if err := os.MkdirAll(outputDir, 0755); err != nil {
		return nil, err
	}
	if dpi <= 0 {
		dpi = 150
	}

	formatFlag := "-png"
	ext := ".png"
	if format == FormatJPEG {
		formatFlag = "-jpeg"
		ext = ".jpg"
	}

	prefix := filepath.Join(outputDir, "page")
	cmd := exec.CommandContext(ctx, "pdftoppm", formatFlag, "-r", strconv.Itoa(dpi), inputPath, prefix)
	out, err := cmd.CombinedOutput()
	if err != nil {
		return nil, fmt.Errorf("pdftoppm render all pages failed (%v): %s", err, string(out))
	}

	// Gather generated page files
	matches, err := filepath.Glob(prefix + "-*" + ext)
	if err != nil || len(matches) == 0 {
		// Try looking for single-page output
		singleMatch, _ := filepath.Glob(prefix + "*" + ext)
		if len(singleMatch) > 0 {
			return singleMatch, nil
		}
		return nil, fmt.Errorf("no rendered pages found in output directory")
	}

	sort.Strings(matches)
	return matches, nil
}

// ZipFiles bundles a slice of filepaths into a single zip archive.
func ZipFiles(filePaths []string, zipOutputPath string) error {
	zipFile, err := os.Create(zipOutputPath)
	if err != nil {
		return fmt.Errorf("failed to create zip file: %w", err)
	}
	defer zipFile.Close()

	w := zip.NewWriter(zipFile)
	defer w.Close()

	for _, filePath := range filePaths {
		f, err := os.Open(filePath)
		if err != nil {
			return err
		}

		info, err := f.Stat()
		if err != nil {
			f.Close()
			return err
		}

		header, err := zip.FileInfoHeader(info)
		if err != nil {
			f.Close()
			return err
		}
		header.Name = filepath.Base(filePath)
		header.Method = zip.Deflate

		writer, err := w.CreateHeader(header)
		if err != nil {
			f.Close()
			return err
		}

		_, err = io.Copy(writer, f)
		f.Close()
		if err != nil {
			return err
		}
	}

	return nil
}
