package engine

import (
	"context"
	"fmt"
	"image"
	"image/jpeg"
	"image/png"
	"os"
	"os/exec"
	"path/filepath"
	"strings"

	"golang.org/x/image/draw"
	_ "golang.org/x/image/webp"
)

type VipsImageProcessor struct{}

func NewVipsImageProcessor() *VipsImageProcessor {
	return &VipsImageProcessor{}
}

func (v *VipsImageProcessor) Name() string {
	return "vips_go_hybrid_v1"
}

// Convert transforms an image between JPG, PNG, and WebP formats.
func (v *VipsImageProcessor) Convert(ctx context.Context, inputPath string, targetFormat ImageFormat, options ImageOptions, outputPath string) error {
	// 1. Try vips CLI if available
	if vipsAvailable() {
		args := []string{"copy", inputPath, outputPath}
		if targetFormat == FormatJPEG && options.Quality > 0 {
			outputPath = fmt.Sprintf("%s[Q=%d]", outputPath, options.Quality)
			args = []string{"copy", inputPath, outputPath}
		}
		cmd := exec.CommandContext(ctx, "vips", args...)
		if err := cmd.Run(); err == nil && fileExists(outputPath) {
			return nil
		}
	}

	// 2. Pure Go high-fidelity fallback
	srcFile, err := os.Open(inputPath)
	if err != nil {
		return fmt.Errorf("failed to open input image: %w", err)
	}
	defer srcFile.Close()

	img, _, err := image.Decode(srcFile)
	if err != nil {
		return fmt.Errorf("failed to decode image: %w", err)
	}

	if err := os.MkdirAll(filepath.Dir(outputPath), 0755); err != nil {
		return err
	}

	dstFile, err := os.Create(outputPath)
	if err != nil {
		return fmt.Errorf("failed to create destination file: %w", err)
	}
	defer dstFile.Close()

	switch targetFormat {
	case FormatJPEG:
		q := options.Quality
		if q <= 0 {
			q = 85
		}
		return jpeg.Encode(dstFile, img, &jpeg.Options{Quality: q})
	case FormatPNG:
		return png.Encode(dstFile, img)
	case FormatWebP:
		// If WebP encoder binary exists (cwebp)
		if cwebpAvailable() {
			dstFile.Close()
			cmd := exec.CommandContext(ctx, "cwebp", "-q", fmt.Sprintf("%d", options.Quality), inputPath, "-o", outputPath)
			return cmd.Run()
		}
		// Fallback: encode as PNG
		return png.Encode(dstFile, img)
	default:
		return fmt.Errorf("unsupported target format: %s", targetFormat)
	}
}

// Resize scales an image using high-quality BiLinear/CatmullRom resampling.
func (v *VipsImageProcessor) Resize(ctx context.Context, inputPath string, width, height int, preserveAspect bool, outputPath string) error {
	srcFile, err := os.Open(inputPath)
	if err != nil {
		return err
	}
	defer srcFile.Close()

	srcImg, _, err := image.Decode(srcFile)
	if err != nil {
		return err
	}

	bounds := srcImg.Bounds()
	srcW := bounds.Dx()
	srcH := bounds.Dy()

	targetW := width
	targetH := height

	if preserveAspect {
		if width > 0 && height == 0 {
			targetH = int(float64(srcH) * (float64(width) / float64(srcW)))
		} else if height > 0 && width == 0 {
			targetW = int(float64(srcW) * (float64(height) / float64(srcH)))
		} else if width > 0 && height > 0 {
			ratioW := float64(width) / float64(srcW)
			ratioH := float64(height) / float64(srcH)
			ratio := ratioW
			if ratioH < ratio {
				ratio = ratioH
			}
			targetW = int(float64(srcW) * ratio)
			targetH = int(float64(srcH) * ratio)
		}
	}

	if targetW <= 0 {
		targetW = srcW
	}
	if targetH <= 0 {
		targetH = srcH
	}

	dstImg := image.NewRGBA(image.Rect(0, 0, targetW, targetH))
	draw.CatmullRom.Scale(dstImg, dstImg.Bounds(), srcImg, srcImg.Bounds(), draw.Over, nil)

	dstFile, err := os.Create(outputPath)
	if err != nil {
		return err
	}
	defer dstFile.Close()

	ext := strings.ToLower(filepath.Ext(outputPath))
	if ext == ".png" {
		return png.Encode(dstFile, dstImg)
	}
	return jpeg.Encode(dstFile, dstImg, &jpeg.Options{Quality: 85})
}

// Compress applies quantization and quality reduction.
func (v *VipsImageProcessor) Compress(ctx context.Context, inputPath string, quality int, outputPath string) error {
	if quality <= 0 || quality > 100 {
		quality = 80
	}
	return v.Convert(ctx, inputPath, FormatJPEG, ImageOptions{Quality: quality}, outputPath)
}

// ImagesToPDF stitches multiple raster images into a single PDF document.
func (v *VipsImageProcessor) ImagesToPDF(ctx context.Context, imagePaths []string, outputPath string) error {
	// If img2pdf or vips is available
	if img2pdfAvailable() {
		args := append(imagePaths, "-o", outputPath)
		cmd := exec.CommandContext(ctx, "img2pdf", args...)
		if err := cmd.Run(); err == nil && fileExists(outputPath) {
			return nil
		}
	}

	// Pure Go basic PDF generation embedding images
	return generateSimplePDFFromImages(imagePaths, outputPath)
}

func vipsAvailable() bool {
	_, err := exec.LookPath("vips")
	return err == nil
}

func cwebpAvailable() bool {
	_, err := exec.LookPath("cwebp")
	return err == nil
}

func img2pdfAvailable() bool {
	_, err := exec.LookPath("img2pdf")
	return err == nil
}

func generateSimplePDFFromImages(imagePaths []string, outputPath string) error {
	if len(imagePaths) == 0 {
		return fmt.Errorf("no input images provided for PDF generation")
	}

	if err := os.MkdirAll(filepath.Dir(outputPath), 0755); err != nil {
		return err
	}

	type pageData struct {
		width    int
		height   int
		jpegData []byte
	}

	var pages []pageData
	for _, p := range imagePaths {
		f, err := os.Open(p)
		if err != nil {
			return fmt.Errorf("failed to open image %s: %w", p, err)
		}

		img, _, err := image.Decode(f)
		f.Close()
		if err != nil {
			return fmt.Errorf("failed to decode image %s: %w", p, err)
		}

		bounds := img.Bounds()
		w := bounds.Dx()
		h := bounds.Dy()
		if w <= 0 || h <= 0 {
			w, h = 800, 600
		}

		var jBuf bytes.Buffer
		if err := jpeg.Encode(&jBuf, img, &jpeg.Options{Quality: 92}); err != nil {
			return fmt.Errorf("failed to encode image to JPEG: %w", err)
		}

		pages = append(pages, pageData{
			width:    w,
			height:   h,
			jpegData: jBuf.Bytes(),
		})
	}

	var pdfBuf bytes.Buffer
	var offsets []int

	// Helper to track byte offsets for PDF cross-reference table
	writeObj := func(objNum int, body string) {
		offsets = append(offsets, pdfBuf.Len())
		pdfBuf.WriteString(fmt.Sprintf("%d 0 obj\n", objNum))
		pdfBuf.WriteString(body)
		if !strings.HasSuffix(body, "\n") {
			pdfBuf.WriteString("\n")
		}
		pdfBuf.WriteString("endobj\n")
	}

	writeStreamObj := func(objNum int, dict string, streamBytes []byte) {
		offsets = append(offsets, pdfBuf.Len())
		pdfBuf.WriteString(fmt.Sprintf("%d 0 obj\n", objNum))
		pdfBuf.WriteString(dict)
		if !strings.HasSuffix(dict, "\n") {
			pdfBuf.WriteString("\n")
		}
		pdfBuf.WriteString("stream\n")
		pdfBuf.Write(streamBytes)
		pdfBuf.WriteString("\nendstream\nendobj\n")
	}

	// 1. Header
	pdfBuf.WriteString("%PDF-1.4\n")
	pdfBuf.WriteString("%\xE2\xE3\xCF\xD3\n")

	// Obj 1: Catalog
	writeObj(1, "<< /Type /Catalog /Pages 2 0 R >>")

	// Obj 2: Pages
	var kidRefs []string
	numPages := len(pages)
	for i := 0; i < numPages; i++ {
		pageObjNum := 3 + (i * 3)
		kidRefs = append(kidRefs, fmt.Sprintf("%d 0 R", pageObjNum))
	}
	pagesDict := fmt.Sprintf("<< /Type /Pages /Kids [%s] /Count %d >>", strings.Join(kidRefs, " "), numPages)
	writeObj(2, pagesDict)

	// Objects for each page:
	// Page Obj: 3 + i*3
	// Image Obj: 4 + i*3
	// Content Stream: 5 + i*3
	for i, page := range pages {
		pageObjNum := 3 + (i * 3)
		imgObjNum := 4 + (i * 3)
		contentObjNum := 5 + (i * 3)

		// Page object
		pageDict := fmt.Sprintf("<< /Type /Page /Parent 2 0 R /MediaBox [0 0 %d %d] /Resources << /ProcSet [/PDF /ImageC] /XObject << /Im1 %d 0 R >> >> /Contents %d 0 R >>",
			page.width, page.height, imgObjNum, contentObjNum)
		writeObj(pageObjNum, pageDict)

		// Image XObject
		imgDict := fmt.Sprintf("<< /Type /XObject /Subtype /Image /Width %d /Height %d /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length %d >>",
			page.width, page.height, len(page.jpegData))
		writeStreamObj(imgObjNum, imgDict, page.jpegData)

		// Content stream to draw image
		contentStream := fmt.Sprintf("q\n%d 0 0 %d 0 0 cm\n/Im1 Do\nQ\n", page.width, page.height)
		contentDict := fmt.Sprintf("<< /Length %d >>", len(contentStream))
		writeStreamObj(contentObjNum, contentDict, []byte(contentStream))
	}

	// Cross-Reference Table
	xrefOffset := pdfBuf.Len()
	totalObjects := 1 + (numPages * 3) + 2
	pdfBuf.WriteString(fmt.Sprintf("xref\n0 %d\n", totalObjects))
	pdfBuf.WriteString("0000000000 65535 f \n")
	for _, offset := range offsets {
		pdfBuf.WriteString(fmt.Sprintf("%010d 00000 n \n", offset))
	}

	// Trailer
	pdfBuf.WriteString(fmt.Sprintf("trailer\n<< /Size %d /Root 1 0 R >>\nstartxref\n%d\n%%%%EOF\n", totalObjects, xrefOffset))

	return os.WriteFile(outputPath, pdfBuf.Bytes(), 0644)
}
