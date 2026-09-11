package worker

import (
	"context"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"time"

	"github.com/google/uuid"
	"github.com/li-pdf/li-pdf/internal/api"
	"github.com/li-pdf/li-pdf/internal/config"
	"github.com/li-pdf/li-pdf/internal/engine"
	"github.com/li-pdf/li-pdf/internal/models"
	"github.com/li-pdf/li-pdf/internal/queue"
	"github.com/li-pdf/li-pdf/internal/storage"
)

type WorkerSupervisor struct {
	cfg         *config.Config
	queue       queue.JobQueue
	storage     storage.StorageManager
	validator   engine.OutputValidator
	pdfEngine   engine.PDFStructuralProcessor
	pdfRenderer engine.PDFRenderer
	imgEngine   engine.ImageProcessor
	docEngine   engine.DocumentConverter
	ocrEngine   engine.OCREngine
	apiH        *api.APIHandler
	workDir     string
}

func NewWorkerSupervisor(
	cfg *config.Config,
	q queue.JobQueue,
	st storage.StorageManager,
	val engine.OutputValidator,
	pdf engine.PDFStructuralProcessor,
	pdfRen engine.PDFRenderer,
	img engine.ImageProcessor,
	doc engine.DocumentConverter,
	ocr engine.OCREngine,
	apiH *api.APIHandler,
) *WorkerSupervisor {
	wDir := filepath.Join(os.TempDir(), "lipdf_worker_scratch")
	_ = os.MkdirAll(wDir, 0755)

	return &WorkerSupervisor{
		cfg:         cfg,
		queue:       q,
		storage:     st,
		validator:   val,
		pdfEngine:   pdf,
		pdfRenderer: pdfRen,
		imgEngine:   img,
		docEngine:   doc,
		ocrEngine:   ocr,
		apiH:        apiH,
		workDir:     wDir,
	}
}

// Start runs the worker loop continuously.
func (w *WorkerSupervisor) Start(ctx context.Context, queueNames []string) {
	log.Printf("[Worker %s] Started listening on queues: %v", w.cfg.WorkerID, queueNames)

	for {
		select {
		case <-ctx.Done():
			log.Printf("[Worker %s] Shutting down", w.cfg.WorkerID)
			return
		default:
			task, err := w.queue.Dequeue(ctx, queueNames, 2*time.Second)
			if err != nil {
				time.Sleep(100 * time.Millisecond)
				continue
			}

			w.processTask(ctx, task)
		}
	}
}

func (w *WorkerSupervisor) processTask(ctx context.Context, task *queue.TaskPayload) {
	jobID := task.JobID
	log.Printf("[Worker %s] Processing Job %s (Op: %s, Profile: %s)", w.cfg.WorkerID, jobID, task.Operation, task.ResourceProfile)

	w.updateJob(jobID, models.JobStatusProcessing, 10, "Initializing worker environment")

	jobScratch := filepath.Join(w.workDir, jobID.String())
	_ = os.MkdirAll(jobScratch, 0755)
	defer os.RemoveAll(jobScratch) // Ephemeral scratch cleanup

	// 1. Download input file
	localInput := filepath.Join(jobScratch, "input_"+task.OriginalName)
	if err := w.storage.DownloadFile(ctx, task.InputStorageKey, localInput); err != nil {
		w.failJob(jobID, fmt.Sprintf("Failed to download input: %v", err))
		return
	}

	w.updateJob(jobID, models.JobStatusProcessing, 30, "Executing conversion pipeline")

	// 2. Execute target engine operation
	outputLocalPath := filepath.Join(jobScratch, "output_"+task.OriginalName)
	var generatedOutputs []string
	var outMime string
	var valFormat engine.ImageFormat

	switch task.Operation {
	case "pdf_compress":
		outMime = "application/pdf"
		outputLocalPath = filepath.Join(jobScratch, "compressed_"+task.OriginalName)
		opts := engine.PDFOptimizeOptions{
			Preset:          "balanced",
			DownsampleDPI:   150,
			JPEGQuality:     78,
			StripMetadata:   true,
			LinearizeStream: true,
		}
		if err := w.pdfEngine.OptimizeStreams(ctx, localInput, outputLocalPath, opts); err != nil {
			w.failJob(jobID, fmt.Sprintf("PDF compression failed: %v", err))
			return
		}
		generatedOutputs = append(generatedOutputs, outputLocalPath)

	case "pdf_rotate":
		outMime = "application/pdf"
		outputLocalPath = filepath.Join(jobScratch, "rotated_"+task.OriginalName)
		angle := 90
		if a, ok := task.Parameters["angle"].(float64); ok {
			angle = int(a)
		}
		if err := w.pdfEngine.Rotate(ctx, localInput, angle, outputLocalPath); err != nil {
			w.failJob(jobID, fmt.Sprintf("PDF rotate failed: %v", err))
			return
		}
		generatedOutputs = append(generatedOutputs, outputLocalPath)

	case "pdf_merge":
		outMime = "application/pdf"
		outputLocalPath = filepath.Join(jobScratch, "merged.pdf")
		if err := w.pdfEngine.Merge(ctx, []string{localInput}, outputLocalPath); err != nil {
			w.failJob(jobID, fmt.Sprintf("PDF merge failed: %v", err))
			return
		}
		generatedOutputs = append(generatedOutputs, outputLocalPath)

	case "pdf_split":
		outMime = "application/pdf"
		splitDir := filepath.Join(jobScratch, "splits")
		ranges := []engine.PageRange{{StartPage: 1, EndPage: 1}}
		outs, err := w.pdfEngine.Split(ctx, localInput, ranges, splitDir)
		if err != nil {
			w.failJob(jobID, fmt.Sprintf("PDF split failed: %v", err))
			return
		}
		generatedOutputs = outs

	case "pdf_encrypt":
		outMime = "application/pdf"
		outputLocalPath = filepath.Join(jobScratch, "encrypted_"+task.OriginalName)
		userPass := "protected123"
		if p, ok := task.Parameters["user_password"].(string); ok && p != "" {
			userPass = p
		}
		secOpts := engine.PDFSecurityOptions{
			UserPassword: userPass,
			KeyLength:    256,
			AllowPrint:   true,
			AllowCopy:    false,
		}
		if err := w.pdfEngine.Encrypt(ctx, localInput, secOpts, outputLocalPath); err != nil {
			w.failJob(jobID, fmt.Sprintf("PDF encryption failed: %v", err))
			return
		}
		generatedOutputs = append(generatedOutputs, outputLocalPath)

	case "pdf_decrypt":
		outMime = "application/pdf"
		outputLocalPath = filepath.Join(jobScratch, "decrypted_"+task.OriginalName)
		pass := "protected123"
		if p, ok := task.Parameters["password"].(string); ok && p != "" {
			pass = p
		}
		if err := w.pdfEngine.Decrypt(ctx, localInput, pass, outputLocalPath); err != nil {
			w.failJob(jobID, fmt.Sprintf("PDF decryption failed: %v", err))
			return
		}
		generatedOutputs = append(generatedOutputs, outputLocalPath)

	case "pdf_to_jpg", "pdf_to_png":
		targetFormat := engine.FormatJPEG
		outMime = "image/jpeg"
		valFormat = engine.FormatJPEG
		if task.Operation == "pdf_to_png" {
			targetFormat = engine.FormatPNG
			outMime = "image/png"
			valFormat = engine.FormatPNG
		}

		dpi := 150
		if d, ok := task.Parameters["dpi"].(float64); ok {
			dpi = int(d)
		}

		renderDir := filepath.Join(jobScratch, "rendered_pages")
		pages, err := w.pdfRenderer.RenderAllPages(ctx, localInput, dpi, targetFormat, renderDir)
		if err != nil {
			w.failJob(jobID, fmt.Sprintf("PDF rendering failed: %v", err))
			return
		}

		if len(pages) == 1 {
			generatedOutputs = pages
		} else {
			// Bundle multi-page into a single ZIP archive
			zipPath := filepath.Join(jobScratch, "pages_"+task.OriginalName+".zip")
			if err := engine.ZipFiles(pages, zipPath); err != nil {
				w.failJob(jobID, fmt.Sprintf("Failed to bundle rendered pages into ZIP: %v", err))
				return
			}
			outMime = "application/zip"
			generatedOutputs = append(generatedOutputs, zipPath)
		}

	case "png_to_webp", "jpg_to_webp":
		outMime = "image/webp"
		valFormat = engine.FormatWebP
		outputLocalPath = filepath.Join(jobScratch, "converted.webp")
		if err := w.imgEngine.Convert(ctx, localInput, engine.FormatWebP, engine.ImageOptions{Quality: 85}, outputLocalPath); err != nil {
			w.failJob(jobID, fmt.Sprintf("Image conversion to WebP failed: %v", err))
			return
		}
		generatedOutputs = append(generatedOutputs, outputLocalPath)

	case "webp_to_png", "jpg_to_png":
		outMime = "image/png"
		valFormat = engine.FormatPNG
		outputLocalPath = filepath.Join(jobScratch, "converted.png")
		if err := w.imgEngine.Convert(ctx, localInput, engine.FormatPNG, engine.ImageOptions{}, outputLocalPath); err != nil {
			w.failJob(jobID, fmt.Sprintf("Image conversion to PNG failed: %v", err))
			return
		}
		generatedOutputs = append(generatedOutputs, outputLocalPath)

	case "png_to_jpg", "webp_to_jpg":
		outMime = "image/jpeg"
		valFormat = engine.FormatJPEG
		outputLocalPath = filepath.Join(jobScratch, "converted.jpg")
		if err := w.imgEngine.Convert(ctx, localInput, engine.FormatJPEG, engine.ImageOptions{Quality: 85}, outputLocalPath); err != nil {
			w.failJob(jobID, fmt.Sprintf("Image conversion to JPG failed: %v", err))
			return
		}
		generatedOutputs = append(generatedOutputs, outputLocalPath)

	case "image_compress":
		outMime = "image/jpeg"
		valFormat = engine.FormatJPEG
		outputLocalPath = filepath.Join(jobScratch, "compressed_"+task.OriginalName)
		quality := 75
		if q, ok := task.Parameters["quality"].(float64); ok {
			quality = int(q)
		}
		if err := w.imgEngine.Compress(ctx, localInput, quality, outputLocalPath); err != nil {
			w.failJob(jobID, fmt.Sprintf("Image compression failed: %v", err))
			return
		}
		generatedOutputs = append(generatedOutputs, outputLocalPath)

	case "image_resize":
		outMime = "image/jpeg"
		valFormat = engine.FormatJPEG
		outputLocalPath = filepath.Join(jobScratch, "resized_"+task.OriginalName)
		wPx := 800
		hPx := 600
		if wVal, ok := task.Parameters["width"].(float64); ok {
			wPx = int(wVal)
		}
		if hVal, ok := task.Parameters["height"].(float64); ok {
			hPx = int(hVal)
		}
		if err := w.imgEngine.Resize(ctx, localInput, wPx, hPx, true, outputLocalPath); err != nil {
			w.failJob(jobID, fmt.Sprintf("Image resize failed: %v", err))
			return
		}
		generatedOutputs = append(generatedOutputs, outputLocalPath)

	case "jpg_to_pdf", "png_to_pdf":
		outMime = "application/pdf"
		outputLocalPath = filepath.Join(jobScratch, "output.pdf")
		if err := w.imgEngine.ImagesToPDF(ctx, []string{localInput}, outputLocalPath); err != nil {
			w.failJob(jobID, fmt.Sprintf("Image to PDF packaging failed: %v", err))
			return
		}
		generatedOutputs = append(generatedOutputs, outputLocalPath)

	// Office & Text Documents -> PDF
	case "docx_to_pdf", "xlsx_to_pdf", "pptx_to_pdf", "doc_to_pdf", "xls_to_pdf", "ppt_to_pdf", "odt_to_pdf", "rtf_to_pdf", "txt_to_pdf", "html_to_pdf":
		outMime = "application/pdf"
		outputLocalPath = filepath.Join(jobScratch, "converted.pdf")
		if err := w.docEngine.ConvertToPDF(ctx, localInput, outputLocalPath); err != nil {
			w.failJob(jobID, fmt.Sprintf("Document conversion to PDF failed: %v", err))
			return
		}
		generatedOutputs = append(generatedOutputs, outputLocalPath)

	// Document -> Text Extraction
	case "pdf_to_txt", "docx_to_txt":
		outMime = "text/plain"
		outputLocalPath = filepath.Join(jobScratch, "extracted.txt")
		if err := w.docEngine.ExtractText(ctx, localInput, outputLocalPath); err != nil {
			w.failJob(jobID, fmt.Sprintf("Text extraction failed: %v", err))
			return
		}
		generatedOutputs = append(generatedOutputs, outputLocalPath)

	// PDF -> HTML Conversion
	case "pdf_to_html":
		outMime = "text/html"
		outputLocalPath = filepath.Join(jobScratch, "converted.html")
		if err := w.docEngine.ConvertToHTML(ctx, localInput, outputLocalPath); err != nil {
			w.failJob(jobID, fmt.Sprintf("Document conversion to HTML failed: %v", err))
			return
		}
		generatedOutputs = append(generatedOutputs, outputLocalPath)

	// PDF -> DOCX Conversion
	case "pdf_to_docx":
		outMime = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
		outputLocalPath = filepath.Join(jobScratch, "converted.docx")
		if err := w.docEngine.ConvertDocument(ctx, localInput, "docx", outputLocalPath); err != nil {
			w.failJob(jobID, fmt.Sprintf("PDF to DOCX conversion failed: %v", err))
			return
		}
		generatedOutputs = append(generatedOutputs, outputLocalPath)

	// OCR Operations
	case "image_to_txt":
		outMime = "text/plain"
		outputLocalPath = filepath.Join(jobScratch, "ocr_extracted.txt")
		lang := "eng"
		if l, ok := task.Parameters["language"].(string); ok && l != "" {
			lang = l
		}
		opts := engine.OCROptions{Language: lang}
		if err := w.ocrEngine.ImageToText(ctx, localInput, opts, outputLocalPath); err != nil {
			w.failJob(jobID, fmt.Sprintf("Image OCR text extraction failed: %v", err))
			return
		}
		generatedOutputs = append(generatedOutputs, outputLocalPath)

	case "image_to_searchable_pdf":
		outMime = "application/pdf"
		outputLocalPath = filepath.Join(jobScratch, "searchable.pdf")
		lang := "eng"
		if l, ok := task.Parameters["language"].(string); ok && l != "" {
			lang = l
		}
		opts := engine.OCROptions{Language: lang}
		if err := w.ocrEngine.ImageToSearchablePDF(ctx, localInput, opts, outputLocalPath); err != nil {
			w.failJob(jobID, fmt.Sprintf("Searchable PDF creation failed: %v", err))
			return
		}
		generatedOutputs = append(generatedOutputs, outputLocalPath)

	case "pdf_ocr":
		outMime = "application/pdf"
		outputLocalPath = filepath.Join(jobScratch, "searchable.pdf")
		lang := "eng"
		if l, ok := task.Parameters["language"].(string); ok && l != "" {
			lang = l
		}
		opts := engine.OCROptions{Language: lang, DPI: 200}
		if err := w.ocrEngine.PDFToSearchablePDF(ctx, localInput, opts, outputLocalPath); err != nil {
			w.failJob(jobID, fmt.Sprintf("PDF OCR searchable layer generation failed: %v", err))
			return
		}
		generatedOutputs = append(generatedOutputs, outputLocalPath)

	default:
		w.failJob(jobID, fmt.Sprintf("Unsupported worker operation: %s", task.Operation))
		return
	}

	w.updateJob(jobID, models.JobStatusValidating, 75, "Performing output integrity validation")

	// 3. Run Output Validator
	for _, outPath := range generatedOutputs {
		switch outMime {
		case "application/pdf":
			if err := w.validator.ValidatePDF(ctx, outPath, 1); err != nil {
				w.failJob(jobID, fmt.Sprintf("Output validation failed (PDF): %v", err))
				return
			}
		case "text/plain":
			if err := w.validator.ValidateText(ctx, outPath); err != nil {
				w.failJob(jobID, fmt.Sprintf("Output validation failed (Text): %v", err))
				return
			}
		case "text/html":
			if err := w.validator.ValidateHTML(ctx, outPath); err != nil {
				w.failJob(jobID, fmt.Sprintf("Output validation failed (HTML): %v", err))
				return
			}
		case "application/zip":
			fi, err := os.Stat(outPath)
			if err != nil || fi.Size() < 50 {
				w.failJob(jobID, "Output validation failed: empty zip archive")
				return
			}
		case "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
			"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
			"application/vnd.openxmlformats-officedocument.presentationml.presentation":
			if err := w.validator.ValidateDocument(ctx, outPath, "docx"); err != nil {
				w.failJob(jobID, fmt.Sprintf("Output validation failed (Office Document): %v", err))
				return
			}
		default:
			if err := w.validator.ValidateImage(ctx, outPath, valFormat); err != nil {
				w.failJob(jobID, fmt.Sprintf("Output validation failed (Image): %v", err))
				return
			}
		}
	}

	w.updateJob(jobID, models.JobStatusProcessing, 90, "Uploading output files to storage")

	// 4. Upload validated output to object storage
	for i, outPath := range generatedOutputs {
		fi, _ := os.Stat(outPath)
		outName := filepath.Base(outPath)
		outputKey := fmt.Sprintf("processed-outputs/%s/%s", jobID.String(), outName)

		if err := w.storage.UploadFile(ctx, outPath, outputKey, outMime); err != nil {
			w.failJob(jobID, fmt.Sprintf("Failed to store output: %v", err))
			return
		}

		outputRecord := &models.Output{
			ID:               uuid.New(),
			JobID:            jobID,
			StorageKey:       outputKey,
			Filename:         outName,
			FileSize:         fi.Size(),
			MimeType:         outMime,
			PageNumber:       &i,
			ValidationPassed: true,
			ExpiresAt:        time.Now().Add(w.cfg.DefaultTTL),
			CreatedAt:        time.Now(),
		}

		if w.apiH != nil {
			w.apiH.RegisterJobOutput(jobID, outputRecord)
		}
	}

	// 5. Mark Completed
	w.updateJob(jobID, models.JobStatusCompleted, 100, "Processing complete")
	log.Printf("[Worker %s] Successfully completed Job %s", w.cfg.WorkerID, jobID)
}

func (w *WorkerSupervisor) updateJob(jobID uuid.UUID, status models.JobStatus, progress int, step string) {
	_ = w.queue.PublishProgress(context.Background(), jobID, progress, step)
	if w.apiH != nil {
		w.apiH.UpdateJobStatus(jobID, status, progress)
	}
}

func (w *WorkerSupervisor) failJob(jobID uuid.UUID, errMsg string) {
	log.Printf("[Worker %s] Job %s failed: %s", w.cfg.WorkerID, jobID, errMsg)
	_ = w.queue.PublishProgress(context.Background(), jobID, 0, "Failed: "+errMsg)
	if w.apiH != nil {
		w.apiH.UpdateJobStatus(jobID, models.JobStatusFailed, 0)
	}
}
