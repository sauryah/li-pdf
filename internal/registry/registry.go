package registry

import (
	"strings"

	"github.com/li-pdf/li-pdf/internal/models"
)

type FidelityRating string

const (
	FidelityDeterministicHigh FidelityRating = "deterministic_high_fidelity"
	FidelityLossyConfigurable FidelityRating = "lossy_configurable"
	FidelityStructuralReflow  FidelityRating = "structural_reflow_limitations"
)

type Capability struct {
	SourceMIME         string                 `json:"source_mime"`
	SourceExt          string                 `json:"source_ext"`
	TargetMIME         string                 `json:"target_mime"`
	TargetExt          string                 `json:"target_ext"`
	Operation          string                 `json:"operation"`
	Interface          string                 `json:"interface"`
	CandidateEngines   []string               `json:"candidate_engines"`
	DefaultEngine      string                 `json:"default_engine"`
	Queue              string                 `json:"queue"`
	ResourceProfile    models.ResourceProfile `json:"resource_profile"`
	SupportsBatch      bool                   `json:"supports_batch"`
	SupportsPageRange  bool                   `json:"supports_page_range"`
	MaxInputSizeBytes  int64                  `json:"max_input_size_bytes"`
	FidelityRating     FidelityRating         `json:"fidelity_rating"`
	RequiresOCR        bool                   `json:"requires_ocr"`
	Description        string                 `json:"description"`
}

type Registry struct {
	capabilities []Capability
}

func NewDefaultRegistry() *Registry {
	return &Registry{
		capabilities: []Capability{
			// PDF to Image Operations
			{
				SourceMIME:        "application/pdf",
				SourceExt:         "pdf",
				TargetMIME:        "image/jpeg",
				TargetExt:         "jpg",
				Operation:         "pdf_to_jpg",
				Interface:         "pdf_renderer",
				CandidateEngines:  []string{"poppler_pdftoppm", "pdfium"},
				DefaultEngine:     "poppler_pdftoppm",
				Queue:             "queue_pdf_std",
				ResourceProfile:   models.ProfilePDFStandard,
				SupportsBatch:     true,
				SupportsPageRange: true,
				MaxInputSizeBytes: 500 * 1024 * 1024,
				FidelityRating:    FidelityDeterministicHigh,
				RequiresOCR:       false,
				Description:       "Convert PDF pages into high-resolution JPG images with selectable DPI and ZIP bundling.",
			},
			{
				SourceMIME:        "application/pdf",
				SourceExt:         "pdf",
				TargetMIME:        "image/png",
				TargetExt:         "png",
				Operation:         "pdf_to_png",
				Interface:         "pdf_renderer",
				CandidateEngines:  []string{"poppler_pdftoppm", "pdfium"},
				DefaultEngine:     "poppler_pdftoppm",
				Queue:             "queue_pdf_std",
				ResourceProfile:   models.ProfilePDFStandard,
				SupportsBatch:     true,
				SupportsPageRange: true,
				MaxInputSizeBytes: 500 * 1024 * 1024,
				FidelityRating:    FidelityDeterministicHigh,
				RequiresOCR:       false,
				Description:       "Convert PDF pages into lossless PNG images with individual page extraction.",
			},
			// PDF Compression
			{
				SourceMIME:        "application/pdf",
				SourceExt:         "pdf",
				TargetMIME:        "application/pdf",
				TargetExt:         "pdf",
				Operation:         "pdf_compress",
				Interface:         "pdf_optimizer",
				CandidateEngines:  []string{"qpdf_vips_pipeline"},
				DefaultEngine:     "qpdf_vips_pipeline",
				Queue:             "queue_pdf_heavy",
				ResourceProfile:   models.ProfilePDFHeavy,
				SupportsBatch:     true,
				SupportsPageRange: false,
				MaxInputSizeBytes: 500 * 1024 * 1024,
				FidelityRating:    FidelityLossyConfigurable,
				RequiresOCR:       false,
				Description:       "Optimize PDF file size via structural deduplication and image stream downsampling.",
			},
			// PDF Page Rotation
			{
				SourceMIME:        "application/pdf",
				SourceExt:         "pdf",
				TargetMIME:        "application/pdf",
				TargetExt:         "pdf",
				Operation:         "pdf_rotate",
				Interface:         "pdf_structural",
				CandidateEngines:  []string{"qpdf"},
				DefaultEngine:     "qpdf",
				Queue:             "queue_pdf_std",
				ResourceProfile:   models.ProfilePDFStandard,
				SupportsBatch:     false,
				SupportsPageRange: true,
				MaxInputSizeBytes: 500 * 1024 * 1024,
				FidelityRating:    FidelityDeterministicHigh,
				RequiresOCR:       false,
				Description:       "Rotate all or specific pages by 90°, 180°, or 270°.",
			},
			// PDF Merge
			{
				SourceMIME:        "application/pdf",
				SourceExt:         "pdf",
				TargetMIME:        "application/pdf",
				TargetExt:         "pdf",
				Operation:         "pdf_merge",
				Interface:         "pdf_structural",
				CandidateEngines:  []string{"qpdf"},
				DefaultEngine:     "qpdf",
				Queue:             "queue_pdf_std",
				ResourceProfile:   models.ProfilePDFStandard,
				SupportsBatch:     true,
				SupportsPageRange: false,
				MaxInputSizeBytes: 500 * 1024 * 1024,
				FidelityRating:    FidelityDeterministicHigh,
				RequiresOCR:       false,
				Description:       "Merge multiple PDF documents into a single document.",
			},
			// PDF Split
			{
				SourceMIME:        "application/pdf",
				SourceExt:         "pdf",
				TargetMIME:        "application/pdf",
				TargetExt:         "pdf",
				Operation:         "pdf_split",
				Interface:         "pdf_structural",
				CandidateEngines:  []string{"qpdf"},
				DefaultEngine:     "qpdf",
				Queue:             "queue_pdf_std",
				ResourceProfile:   models.ProfilePDFStandard,
				SupportsBatch:     false,
				SupportsPageRange: true,
				MaxInputSizeBytes: 500 * 1024 * 1024,
				FidelityRating:    FidelityDeterministicHigh,
				RequiresOCR:       false,
				Description:       "Split PDF into individual pages or specific page ranges.",
			},
			// PDF Security (Encrypt / Password Protect)
			{
				SourceMIME:        "application/pdf",
				SourceExt:         "pdf",
				TargetMIME:        "application/pdf",
				TargetExt:         "pdf",
				Operation:         "pdf_encrypt",
				Interface:         "pdf_structural",
				CandidateEngines:  []string{"qpdf"},
				DefaultEngine:     "qpdf",
				Queue:             "queue_pdf_std",
				ResourceProfile:   models.ProfilePDFStandard,
				SupportsBatch:     false,
				SupportsPageRange: false,
				MaxInputSizeBytes: 500 * 1024 * 1024,
				FidelityRating:    FidelityDeterministicHigh,
				RequiresOCR:       false,
				Description:       "Secure PDF with AES-256 password protection and print/copy restriction policies.",
			},
			// PDF Security (Decrypt / Remove Password)
			{
				SourceMIME:        "application/pdf",
				SourceExt:         "pdf",
				TargetMIME:        "application/pdf",
				TargetExt:         "pdf",
				Operation:         "pdf_decrypt",
				Interface:         "pdf_structural",
				CandidateEngines:  []string{"qpdf"},
				DefaultEngine:     "qpdf",
				Queue:             "queue_pdf_std",
				ResourceProfile:   models.ProfilePDFStandard,
				SupportsBatch:     false,
				SupportsPageRange: false,
				MaxInputSizeBytes: 500 * 1024 * 1024,
				FidelityRating:    FidelityDeterministicHigh,
				RequiresOCR:       false,
				Description:       "Remove password encryption from an authorized protected PDF.",
			},
			// Images to PDF
			{
				SourceMIME:        "image/jpeg",
				SourceExt:         "jpg",
				TargetMIME:        "application/pdf",
				TargetExt:         "pdf",
				Operation:         "jpg_to_pdf",
				Interface:         "image_to_pdf",
				CandidateEngines:  []string{"vips_pdf"},
				DefaultEngine:     "vips_pdf",
				Queue:             "queue_image_fast",
				ResourceProfile:   models.ProfileImageSmall,
				SupportsBatch:     true,
				SupportsPageRange: false,
				MaxInputSizeBytes: 100 * 1024 * 1024,
				FidelityRating:    FidelityDeterministicHigh,
				RequiresOCR:       false,
				Description:       "Package JPG images into a formatted PDF document.",
			},
			{
				SourceMIME:        "image/png",
				SourceExt:         "png",
				TargetMIME:        "application/pdf",
				TargetExt:         "pdf",
				Operation:         "png_to_pdf",
				Interface:         "image_to_pdf",
				CandidateEngines:  []string{"vips_pdf"},
				DefaultEngine:     "vips_pdf",
				Queue:             "queue_image_fast",
				ResourceProfile:   models.ProfileImageSmall,
				SupportsBatch:     true,
				SupportsPageRange: false,
				MaxInputSizeBytes: 100 * 1024 * 1024,
				FidelityRating:    FidelityDeterministicHigh,
				RequiresOCR:       false,
				Description:       "Package PNG images into a formatted PDF document.",
			},
			// Image to Image Conversions (JPG <-> PNG <-> WebP)
			{
				SourceMIME:        "image/png",
				SourceExt:         "png",
				TargetMIME:        "image/webp",
				TargetExt:         "webp",
				Operation:         "png_to_webp",
				Interface:         "image_processor",
				CandidateEngines:  []string{"libvips"},
				DefaultEngine:     "libvips",
				Queue:             "queue_image_fast",
				ResourceProfile:   models.ProfileImageSmall,
				SupportsBatch:     true,
				SupportsPageRange: false,
				MaxInputSizeBytes: 100 * 1024 * 1024,
				FidelityRating:    FidelityDeterministicHigh,
				RequiresOCR:       false,
				Description:       "Convert PNG images to next-gen WebP format.",
			},
			{
				SourceMIME:        "image/jpeg",
				SourceExt:         "jpg",
				TargetMIME:        "image/webp",
				TargetExt:         "webp",
				Operation:         "jpg_to_webp",
				Interface:         "image_processor",
				CandidateEngines:  []string{"libvips"},
				DefaultEngine:     "libvips",
				Queue:             "queue_image_fast",
				ResourceProfile:   models.ProfileImageSmall,
				SupportsBatch:     true,
				SupportsPageRange: false,
				MaxInputSizeBytes: 100 * 1024 * 1024,
				FidelityRating:    FidelityDeterministicHigh,
				RequiresOCR:       false,
				Description:       "Convert JPG images to modern WebP format.",
			},
			{
				SourceMIME:        "image/webp",
				SourceExt:         "webp",
				TargetMIME:        "image/png",
				TargetExt:         "png",
				Operation:         "webp_to_png",
				Interface:         "image_processor",
				CandidateEngines:  []string{"libvips"},
				DefaultEngine:     "libvips",
				Queue:             "queue_image_fast",
				ResourceProfile:   models.ProfileImageSmall,
				SupportsBatch:     true,
				SupportsPageRange: false,
				MaxInputSizeBytes: 100 * 1024 * 1024,
				FidelityRating:    FidelityDeterministicHigh,
				RequiresOCR:       false,
				Description:       "Convert WebP images to standard PNG format.",
			},
			{
				SourceMIME:        "image/png",
				SourceExt:         "png",
				TargetMIME:        "image/jpeg",
				TargetExt:         "jpg",
				Operation:         "png_to_jpg",
				Interface:         "image_processor",
				CandidateEngines:  []string{"libvips"},
				DefaultEngine:     "libvips",
				Queue:             "queue_image_fast",
				ResourceProfile:   models.ProfileImageSmall,
				SupportsBatch:     true,
				SupportsPageRange: false,
				MaxInputSizeBytes: 100 * 1024 * 1024,
				FidelityRating:    FidelityDeterministicHigh,
				RequiresOCR:       false,
				Description:       "Convert PNG images to universal JPG format.",
			},
			// Image Compression & Resize
			{
				SourceMIME:        "image/jpeg",
				SourceExt:         "jpg",
				TargetMIME:        "image/jpeg",
				TargetExt:         "jpg",
				Operation:         "image_compress",
				Interface:         "image_processor",
				CandidateEngines:  []string{"mozjpeg", "libvips"},
				DefaultEngine:     "mozjpeg",
				Queue:             "queue_image_fast",
				ResourceProfile:   models.ProfileImageSmall,
				SupportsBatch:     true,
				SupportsPageRange: false,
				MaxInputSizeBytes: 100 * 1024 * 1024,
				FidelityRating:    FidelityLossyConfigurable,
				RequiresOCR:       false,
				Description:       "Compress JPG images using perceptual quantization.",
			},
			{
				SourceMIME:        "image/png",
				SourceExt:         "png",
				TargetMIME:        "image/png",
				TargetExt:         "png",
				Operation:         "image_compress",
				Interface:         "image_processor",
				CandidateEngines:  []string{"oxipng", "libvips"},
				DefaultEngine:     "oxipng",
				Queue:             "queue_image_fast",
				ResourceProfile:   models.ProfileImageSmall,
				SupportsBatch:     true,
				SupportsPageRange: false,
				MaxInputSizeBytes: 100 * 1024 * 1024,
				FidelityRating:    FidelityLossyConfigurable,
				RequiresOCR:       false,
				Description:       "Losslessly optimize PNG DEFLATE streams.",
			},
			{
				SourceMIME:        "image/jpeg",
				SourceExt:         "jpg",
				TargetMIME:        "image/jpeg",
				TargetExt:         "jpg",
				Operation:         "image_resize",
				Interface:         "image_processor",
				CandidateEngines:  []string{"libvips"},
				DefaultEngine:     "libvips",
				Queue:             "queue_image_fast",
				ResourceProfile:   models.ProfileImageSmall,
				SupportsBatch:     true,
				SupportsPageRange: false,
				MaxInputSizeBytes: 100 * 1024 * 1024,
				FidelityRating:    FidelityDeterministicHigh,
				RequiresOCR:       false,
				Description:       "Resize image dimensions with high-quality resampling.",
			},
		},
	}
}

func (r *Registry) ListAll() []Capability {
	return r.capabilities
}

func (r *Registry) FindByMIME(mime string) []Capability {
	var result []Capability
	for _, c := range r.capabilities {
		if strings.EqualFold(c.SourceMIME, mime) {
			result = append(result, c)
		}
	}
	return result
}

func (r *Registry) FindOperation(operation string, sourceMIME string) (*Capability, bool) {
	for _, c := range r.capabilities {
		if strings.EqualFold(c.Operation, operation) && (sourceMIME == "" || strings.EqualFold(c.SourceMIME, sourceMIME)) {
			return &c, true
		}
	}
	return nil, false
}
