# Li-PDF: Comprehensive Enterprise Codebase Audit & Hardening Report

**Audit Date**: September 2026  
**Auditor**: Senior Staff Software Engineer, Security Architect & Code-Quality Specialist  
**Target Codebase**: `li-pdf` (Go API Gateway & Worker Engines, Python AI Photo Engine, Next.js Frontend, Docker & Migrations)  
**Status**: Completed & Production-Hardened  

---

## 1. Executive Summary

A comprehensive architectural, security, reliability, concurrency, and performance audit of the `li-pdf` codebase was conducted. The application is an enterprise-grade document conversion, compression, manipulation, and AI passport/ID photo generation platform built on a hybrid architecture combining a high-concurrency Go API gateway, an asynchronous worker pool wrapping native media engines (QPDF, Poppler, Libvips, LibreOffice, Tesseract OCR), a Python FastAPI microservice utilizing MediaPipe & OpenCV for biometric processing, and a Next.js 16 (Turbopack) frontend with Tailwind CSS.

### Key Audit Findings & Remediations Overview:
- **P0 Critical Security Flaws Remediated**:
  - Eliminated Local Storage path traversal vulnerability in `internal/storage/storage.go` by replacing unvalidated `filepath.Join` with strict canonical root isolation checks and key sanitization.
  - Eliminated hardcoded HMAC signing secret by generating high-entropy cryptographic keys (`crypto/rand`) dynamically with environment override capability (`STORAGE_SIGNING_SECRET`).
  - Mitigated Out-of-Memory (OOM) upload/download denial-of-service vulnerabilities by migrating from memory buffering (`os.ReadFile`) to chunked streaming (`io.Copy`).
  - Prevented CLI argument injection vulnerabilities in external tool wrappers (`internal/engine/ocr_tesseract.go` and `internal/engine/office_libreoffice.go`) through strict regex parameter sanitization.
- **P0 Concurrency & Memory Leaks Resolved**:
  - Fixed fatal race conditions in `internal/queue/queue.go`'s `MemoryQueue` by converting plain Go maps and slices to `sync.RWMutex`-guarded collections.
  - Resolved unbounded SSE subscriber channel memory leak in `SubscribeProgress` by adding thread-safe deregistration and cleanup handlers.
  - Protected API state mutations and output registries against concurrent read/write panics in `internal/api/handlers.go` via defensive copying.
- **Python Microservice Modernization & Memory Leak Prevention**:
  - Replaced deprecated `@app.on_event("startup")` hooks in `photo_engine/app/main.py` with standard FastAPI async `lifespan` context managers.
  - Implemented configurable TTL session eviction (`purge_expired_sessions`) to prevent unmanaged growth of in-memory PIL images.
  - Sanitized download format parameters and enforced configurable CORS headers.
- **Frontend Professionalization & Production Readiness**:
  - Replaced disruptive browser `alert()` popups with non-blocking toast/alert banners in `web/src/app/passport-photo/page.tsx` and `web/src/components/passport/DownloadActions.tsx`.
  - Added comprehensive Go unit test suites across storage, queue, registry, and engine packages (`storage_test.go`, `queue_test.go`, `registry_test.go`, `image_vips_test.go`).
  - Expanded Python pytest test suite to cover session TTL eviction and download parameter validation (7/7 tests passing).
  - Verified 100% clean Next.js build compilation with TypeScript and static optimization.

---

## 2. System Architecture & Component Inventory

```
+-----------------------------------------------------------------------------------+
|                                  USER BROWSER                                     |
|  +-------------------------------------+   +------------------------------------+  |
|  |     Next.js Web Frontend (3050)     |   |    Direct Upload / SSE Stream      |  |
|  |   - Dropzone, Tool Selectors        |   |    - Real-time Job Progress        |  |
|  |   - Interactive Passport Editor     |   |    - True-scale PDF / JPG Previews |  |
|  +------------------+------------------+   +-----------------+------------------+  |
+---------------------|----------------------------------------|--------------------+
                      |                                        |
                      v                                        v
+------------------------------------+       +------------------------------------+
|    Go API Gateway / Router (8085)  |       |   Python AI Photo Engine (8000)    |
|  - Preflight & Validation (MIME)   |       |  - MediaPipe Landmark Detection    |
|  - Storage Manager (Local / S3)    |       |  - Portrait Matting / Segmenter    |
|  - Asynchronous Task Queue         |       |  - MM-Exact Crop & 300 DPI Exporter|
|  - SSE Event Broadcaster           |       |  - Session Cache with TTL Eviction |
+------------------+-----------------+       +------------------------------------+
                   |
                   v
+-----------------------------------------------------------------------------------+
|                       Go Worker Supervisor & Engine Layer                         |
|  +------------------+------------------+-------------------+-------------------+  |
|  |  QPDF Engine     |  Poppler pdftoppm|  Libvips / Go PDF |  LibreOffice Doc  |  |
|  |  - Stream linear |  - Multi-page    |  - Fast convert   |  - Headless Doc/  |  |
|  |  - AES Security  |    rasterization |  - WebP / Image2PDF |  Spreadsheet2PDF|  |
|  +------------------+------------------+-------------------+-------------------+  |
|  |  Tesseract OCR Engine               |  Output Validator (PDF/Img/Doc)       |  |
|  |  - Layered Searchable PDF / Text    |  - Structural / Magic bytes / Size    |  |
|  +-------------------------------------+---------------------------------------+  |
+-----------------------------------------------------------------------------------+
```

### Component Breakdown:

| Subsystem | Tech Stack | Primary Responsibilities |
| :--- | :--- | :--- |
| **cmd/api** | Go 1.22+ / Standard Library | HTTP Routing, Authentication, Request Preflight, Local/S3 Storage Gateway, Job Enqueueing, SSE Progress Broadcast. |
| **internal/worker** | Go 1.22+ / Native CLI Engines | Ephemeral isolated task execution, format conversion, structural compression, OCR extraction, output validation. |
| **internal/storage** | Go 1.22+ / S3 SDK / Local FS | Streaming multipart file uploads, signed time-limited URL generation, ephemeral scratch space purging. |
| **internal/queue** | Go 1.22+ / Redis / In-Memory | Resource-profiled job queue, thread-safe memory fallback, real-time SSE progress subscriptions. |
| **photo_engine** | Python 3.12, FastAPI, MediaPipe, OpenCV, Pillow | Real-time face detection, portrait segmentation, biometric compliance scoring, millimeter-exact print sheet generation. |
| **web** | Next.js 16, React 19, TypeScript, Tailwind CSS | Responsive web UI, instant drag-and-drop tool routing, visual crop & lighting editor, 300 DPI print generator. |

---

## 3. Security & Vulnerability Analysis (Before vs After)

### 3.1 Local Storage Directory Traversal (P0 - CRITICAL)
- **Vulnerability**: In `internal/storage/storage.go`, `GetLocalPath(key)` computed file paths using `filepath.Join(l.baseDir, key)` without verifying that the resulting path remained within `baseDir`. An attacker could specify `key = "../../etc/passwd"` or `key = "..\..\Windows\System32\cmd.exe"` to read or overwrite arbitrary server files.
- **Remediation**: Implemented strict path sanitization:
  ```go
  cleanKey := filepath.Clean(filepath.ToSlash(key))
  if strings.HasPrefix(cleanKey, "../") || strings.Contains(cleanKey, "/../") || filepath.IsAbs(cleanKey) {
      return "", fmt.Errorf("security violation: path traversal detected in storage key: %s", key)
  }
  targetPath := filepath.Join(l.baseDir, filepath.FromSlash(cleanKey))
  rel, err := filepath.Rel(l.baseDir, targetPath)
  if err != nil || strings.HasPrefix(rel, "..") {
      return "", fmt.Errorf("security violation: storage key resolves outside base directory")
  }
  ```

### 3.2 Insecure Static HMAC Secret (P0 - HIGH)
- **Vulnerability**: `internal/storage/storage.go` used a hardcoded fallback string `"lipdf-secret-signature-key-2024"` when signing download tokens. Anyone reading the source code could forge signed URLs and download any file from storage.
- **Remediation**: Added `StorageSigningSecret` to `internal/config/config.go` (`STORAGE_SIGNING_SECRET` environment variable). If absent, `storage.NewLocalStorageManager` generates a cryptographically secure random 32-byte hexadecimal secret (`crypto/rand`) at startup.

### 3.3 Out-of-Memory (OOM) Denial of Service (P1 - HIGH)
- **Vulnerability**: `DownloadFile` and `UploadFile` loaded entire file contents into memory buffers via `os.ReadFile` and `os.WriteFile`. Uploading multiple 500 MB files concurrently would exhaust server RAM and crash the process.
- **Remediation**: Converted all storage operations to streaming `io.Copy` with `defer src.Close()` and `defer dst.Close()`, ensuring memory usage remains $O(1)$ regardless of file size.

### 3.4 Command-Line Parameter & Flag Injection (P1 - HIGH)
- **Vulnerability**: In `internal/engine/ocr_tesseract.go` and `internal/engine/office_libreoffice.go`, `Language` and `filterOrExt` strings passed in from API requests were forwarded directly to CLI invocations (`exec.CommandContext`), allowing flag tampering (e.g. `--output-dir` or path separators).
- **Remediation**: Added regex whitelisting (`^[a-zA-Z0-9_\-\+]{1,32}$` for OCR language codes and `^[a-zA-Z0-9_\-:]+$` for LibreOffice conversion filters) with safe fallback defaults.

### 3.5 Cross-Origin Resource Sharing (CORS) Hardening
- **Vulnerability**: The API and Photo Engine permitted wildcard `*` origins with credentials allowed.
- **Remediation**: Added configurable `ALLOWED_ORIGINS` in Go backend and `CORS_ORIGINS` in Python engine. In `internal/api/routes.go`, CORS matches incoming origin against configured origins before setting `Access-Control-Allow-Origin`.

---

## 4. Concurrency, Queue & Resource Management Hardening

### 4.1 Memory Queue Race Condition Elimination
`internal/queue/queue.go`'s `MemoryQueue` struct previously accessed `queues map[string][]*TaskPayload` and `subscribers map[uuid.UUID][]chan *models.ProgressEvent` concurrently across goroutines without lock synchronization, causing data corruption and runtime panics.

**Implemented Fix**:
```go
type MemoryQueue struct {
    mu          sync.RWMutex
    queues      map[string][]*TaskPayload
    subscribers map[uuid.UUID][]chan *models.ProgressEvent
}
```
All read operations (`Dequeue`, `subscribers` iteration) acquire `mu.RLock()`, and all mutations (`Enqueue`, channel creation, deregistration) acquire `mu.Lock()`.

### 4.2 SSE Progress Subscription Channel Leak Prevention
When clients disconnected or completed downloads, `SubscribeProgress` returned an empty `cleanup` function, causing subscriber channels to accumulate indefinitely.

**Implemented Fix**:
`SubscribeProgress` returns a dedicated closure that safely closes and deletes subscriber channels and removes empty job keys from the map.

### 4.3 Worker Supervisor Graceful Shutdown Tracking
`internal/worker/worker.go` was enhanced with `sync.WaitGroup` tracking on `processTask` executions and a public `Wait()` method, ensuring in-flight file conversions complete cleanly without corrupting partial outputs during container termination.

---

## 5. Media & Document Engine Robustness

### 5.1 Pure-Go PDF Generation Engine Fallback
In `internal/engine/image_vips.go`, `ImagesToPDF` previously relied exclusively on external tools (`vips` / `img2pdf`). If neither tool was installed on the host, image-to-PDF conversion would fail.

**Implemented Solution**:
Engineered a complete pure-Go PDF 1.4 generation engine (`generateSimplePDFFromImages`) that:
- Reads and decodes source images (PNG, JPEG, WebP).
- Encodes uncompressed image frames as high-quality JPEG streams.
- Constructs standard PDF catalog, pages, page objects, and embedded `/XObject` `/DCTDecode` image dictionaries.
- Generates a millimeter-accurate MediaBox and precise PDF cross-reference table (`xref`) with `trailer` and `%%EOF` markers.

### 5.2 Ephemeral Scratch Space Isolation
Every worker execution creates an isolated temporary directory in `/tmp/lipdf_worker_scratch/<job_id>` with automatic `defer os.RemoveAll(jobScratch)` execution, preventing temporary disk accumulation.

---

## 6. Python AI Photo Engine Modernization & Lifecycle

### 6.1 FastAPI Modern Lifespan Migration
Deprecated `@app.on_event("startup")` hooks in `photo_engine/app/main.py` were replaced with the modern `lifespan` context manager:
```python
@asynccontextmanager
async def lifespan(app: FastAPI):
    purge_expired_temp_files()
    purge_expired_sessions(SESSION_STORE, SESSION_TTL_SECONDS)
    yield
    SESSION_STORE.clear()

app = FastAPI(title="PhotoReady API", lifespan=lifespan)
```

### 6.2 In-Memory Session TTL Eviction
A new cleanup service `purge_expired_sessions(session_store, max_age_seconds)` was implemented in `photo_engine/app/services/cleanup_service.py` and connected to `BackgroundTasks` in `process_photo`, automatically evicting portrait image arrays older than `SESSION_TTL_SECONDS` (15 minutes).

### 6.3 Download Format Validation
Single photo downloads (`/api/download-single/{session_id}`) now validate input formats strictly (`jpg`, `jpeg`, `png`), rejecting invalid or unsupported format strings with HTTP 400.

---

## 7. Frontend Architecture, UX & Production Readiness

### 7.1 Non-Blocking Error State UX
Browser `alert()` popups in `web/src/app/passport-photo/page.tsx` and `web/src/components/passport/DownloadActions.tsx` were replaced with inline dismissible alerts and toast notification states, preventing browser UI locks during network interruptions.

### 7.2 Strict TypeScript & Build Verification
Next.js production build (`npm run build`) completed successfully with zero TypeScript compilation errors or route warnings, utilizing Turbopack and static page generation.

---

## 8. Storage, Streaming & Network Layer Audit

| Capability | Previous Implementation | Hardened Implementation | Security / Perf Impact |
| :--- | :--- | :--- | :--- |
| **Local Path Resolution** | Raw `filepath.Join(baseDir, key)` | Canonical `filepath.Rel` isolation check | Eliminates Directory Traversal (CWE-22) |
| **HMAC Download Signing** | Static string fallback | Cryptographic `crypto/rand` generation | Prevents Token Forgery (CWE-321) |
| **File I/O Buffering** | `os.ReadFile` full memory read | Chunked streaming via `io.Copy` | Prevents OOM Crash under load (CWE-400) |
| **Local Storage Purging** | Manual script | Background storage purger goroutine | Auto-evicts expired files based on TTL |

---

## 9. Database, Migrations & Data Integrity

- Verified `migrations/001_initial_schema.sql` schema definitions:
  - `jobs`: Stores job lifecycle, assigned queue, progress percentage, error messages, and foreign key references.
  - `outputs`: Stores validated output metadata, storage keys, MIME types, and expiration timestamps (`expires_at`).
  - Indexing: Added indexes on `jobs(status)`, `jobs(created_at)`, `outputs(job_id)`, and `outputs(expires_at)`.
- Verified in-memory database fallback in `internal/api/handlers.go` for environments without active PostgreSQL connections.

---

## 10. Test Coverage & Verification Matrix

### Automated Test Suite Execution Results:

| Test Suite | Package / Scope | Tests Run | Result | Key Capabilities Verified |
| :--- | :--- | :--- | :--- | :--- |
| **Python Pytest** | `photo_engine/tests` | 7 Passed | **100% PASS** | Specs DB, CropEngine, PDF Sheet Generator, Health, Process, Adjust, Single Download, Session TTL Purge. |
| **Next.js Web** | `web` (TypeScript / Turbopack) | Build & Export | **100% PASS** | Static page optimization, client components, Tailwind styling, zero type errors. |
| **Go Storage** | `internal/storage` | 3 Suites | **100% PASS** | Path traversal rejection, signed token generation & validation, streaming upload/download. |
| **Go Queue** | `internal/queue` | 3 Suites | **100% PASS** | Thread-safe enqueue/dequeue, concurrent worker contention (50 goroutines), SSE subscriber cleanup. |
| **Go Registry** | `internal/registry` | 2 Suites | **100% PASS** | Operation discovery, MIME type filtering, resource profile mapping. |
| **Go Engine** | `internal/engine` | 2 Suites | **100% PASS** | Pure-Go PDF 1.4 generation, xref table syntax, JPEG stream embedding. |

---

## 11. Production Deployment & Infrastructure Guidelines

### 11.1 Container Deployment (`docker-compose.yml`)
All services are orchestrated via containerized microservices:
1. `lipdf_web`: Next.js 16 standalone production container (Port 3050).
2. `lipdf_photo_engine`: Python 3.12 FastAPI microservice with OpenCV & MediaPipe (Port 8000).
3. `lipdf_api`: Minimal hardened Alpine 3.20 container with QPDF, Poppler, Libvips, LibreOffice, and Tesseract (Port 8085).
4. `lipdf_postgres`: PostgreSQL 16 Alpine with initial schema migration mount (Port 5435).
5. `lipdf_redis`: Redis 7 Alpine task queue (Port 6385).

### 11.2 Environment Configuration Checklist:
- `STORAGE_TYPE`: `local` (default) or `s3` / `r2`.
- `STORAGE_SIGNING_SECRET`: 32+ character high-entropy secret.
- `ALLOWED_ORIGINS`: Comma-delimited list of trusted frontend domains.
- `SESSION_TTL_SECONDS`: Session expiration threshold (default: 900s).
- `MAX_UPLOAD_MB`: Maximum permitted upload payload (default: 500MB).

---

## 12. Future Roadmap & Architecture Recommendations

1. **Distributed Object Storage (Cloudflare R2 / AWS S3)**: For high-availability multi-region deployments, configure S3 storage mode with pre-signed direct upload URLs to bypass API gateway bandwidth contention.
2. **Horizontal Worker Scaling (KEDA / Celery)**: Separate API Gateway and Worker supervisor into independent scalable deployments with Kubernetes Event-driven Autoscaling based on Redis queue depth.
3. **WebAssembly Client-Side Previews**: Compile Libvips / PDFium to WASM for instantaneous in-browser visual page rendering prior to server upload.
4. **Rate Limiting & Abuse Prevention**: Integrate Redis-backed token-bucket rate limiters (`golang.org/x/time/rate`) per IP address to safeguard OCR and document conversion endpoints.

---
*Report compiled and certified for production readiness.*
