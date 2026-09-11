package engine

import (
	"context"
	"io"
	"os"
)

type ImageFormat string

const (
	FormatJPEG ImageFormat = "jpg"
	FormatPNG  ImageFormat = "png"
	FormatWebP ImageFormat = "webp"
	FormatPDF  ImageFormat = "pdf"
)

type PageRange struct {
	StartPage int
	EndPage   int
}

type PDFOptimizeOptions struct {
	Preset          string // "maximum_quality", "balanced", "maximum_compression"
	DownsampleDPI   int    // e.g. 150, 96
	JPEGQuality     int    // e.g. 78, 60
	StripMetadata   bool
	LinearizeStream bool
}

type PDFSecurityOptions struct {
	UserPassword  string
	OwnerPassword string
	KeyLength     int // 128 or 256
	AllowPrint    bool
	AllowCopy     bool
	AllowModify   bool
}

type ImageOptions struct {
	Quality      int
	Lossless     bool
	Width        int
	Height       int
	KeepMetadata bool
}

// PDFRenderer abstracts PDF page rasterization into images.
type PDFRenderer interface {
	Name() string
	RenderPage(ctx context.Context, inputPath string, pageNum int, dpi int, format ImageFormat) (io.ReadCloser, error)
	RenderAllPages(ctx context.Context, inputPath string, dpi int, format ImageFormat, outputDir string) ([]string, error)
	GetPageCount(ctx context.Context, inputPath string) (int, error)
}

// PDFStructuralProcessor handles non-rasterizing structural mutations and security.
type PDFStructuralProcessor interface {
	Name() string
	Merge(ctx context.Context, inputPaths []string, outputPath string) error
	Split(ctx context.Context, inputPath string, ranges []PageRange, outputDir string) ([]string, error)
	Rotate(ctx context.Context, inputPath string, rotationAngle int, outputPath string) error
	RotatePages(ctx context.Context, inputPath string, pageRotations map[int]int, outputPath string) error
	ScrubMetadata(ctx context.Context, inputPath string, outputPath string) error
	OptimizeStreams(ctx context.Context, inputPath string, outputPath string, options PDFOptimizeOptions) error
	Encrypt(ctx context.Context, inputPath string, opts PDFSecurityOptions, outputPath string) error
	Decrypt(ctx context.Context, inputPath string, password string, outputPath string) error
	Watermark(ctx context.Context, inputPath string, watermarkText string, outputPath string) error
}

// ImageProcessor handles high-throughput raster transformations.
type ImageProcessor interface {
	Name() string
	Convert(ctx context.Context, inputPath string, targetFormat ImageFormat, options ImageOptions, outputPath string) error
	Resize(ctx context.Context, inputPath string, width, height int, preserveAspect bool, outputPath string) error
	Compress(ctx context.Context, inputPath string, quality int, outputPath string) error
	ImagesToPDF(ctx context.Context, imagePaths []string, outputPath string) error
}

// DocumentConverter handles Office document (DOCX, XLSX, PPTX, RTF, TXT, ODT) conversions.
type DocumentConverter interface {
	Name() string
	ConvertToPDF(ctx context.Context, inputPath string, outputPath string) error
	ConvertDocument(ctx context.Context, inputPath string, targetExt string, outputPath string) error
	ExtractText(ctx context.Context, inputPath string, outputPath string) error
	ConvertToHTML(ctx context.Context, inputPath string, outputPath string) error
}

// OutputValidator verifies generated file integrity prior to storage delivery.
type OutputValidator interface {
	Name() string
	ValidatePDF(ctx context.Context, filePath string, expectedMinPages int) error
	ValidateImage(ctx context.Context, filePath string, expectedFormat ImageFormat) error
	ValidateDocument(ctx context.Context, filePath string, expectedExt string) error
	ValidateText(ctx context.Context, filePath string) error
	ValidateHTML(ctx context.Context, filePath string) error
}

func fileExists(p string) bool {
	fi, err := os.Stat(p)
	return err == nil && fi.Size() > 0
}
