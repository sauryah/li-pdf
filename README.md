# li.pdf — Production Universal File Converter, Compressor & Document Utility

A production-grade, privacy-first universal file conversion and compression platform engineered with **Preflight Analysis**, **Engine Abstraction**, **Hostile Input Sandboxing**, and **Hardened Output Validation**.

---

## 🏗️ Architecture Overview

```
                              USER / CLIENT
                                    │
                                    ▼
                         NEXT.JS APP (FRONTEND)
                                    │
                             1. Request Presigned URL
                                    ▼
                              GO API GATEWAY
                                    │
                        ┌───────────┴───────────┐
                        │                       │
                        ▼                       ▼
                   PostgreSQL             Cloudflare R2 / S3
                        │                       ▲
                        │                       │ 2. Direct Upload (Payload)
                        └───────────┬───────────┘
                                    │
                             3. Job Created (POST /v1/jobs)
                                    ▼
                           PREFLIGHT ANALYZER
                        (Inspect MIME, Size, Pages,
                         Encryption, Image Density)
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
              `queue_image`   `queue_pdf_std`  `queue_pdf_heavy`
                    │               │               │
                    ▼               ▼               ▼
               [SANDBOXED]     [SANDBOXED]     [SANDBOXED]
              Image Worker     PDF Worker     Heavy Worker
                    │               │               │
                    └───────────────┼───────────────┘
                                    │
                                    ▼
                             OUTPUT VALIDATOR
                        (Parseability, Page Count,
                         Header Magic, Non-Blank Check)
                                    │
                         ┌──────────┴──────────┐
                         │                     │
                     [PASS]                 [FAIL]
                         │                     │
                         ▼                     ▼
                  Store Result in R2      Retry / Escalation
                         │                     │
                         ▼                     ▼
                  Signed Download      Structured Error Telemetry
```

---

## 🚀 Key Features

* **Direct-to-Storage Streaming:** Client uploads stream directly to Cloudflare R2 / S3 via presigned multipart URLs, ensuring zero memory overhead at the API gateway layer.
* **Preflight Dynamic Routing:** Automatically inspects incoming file headers, page count, and complexity to assign optimal **Workload-Specific Resource Profiles** (`IMAGE_SMALL`, `PDF_STANDARD`, `PDF_HEAVY`).
* **Selective PDF Compression:** Classifies embedded images before recompression to protect 1-bit text masks, CCITT/JBIG2, and CMYK color profiles from degradation.
* **Output Validator Gate:** Hard production gate verifying that output files are decodable, non-empty, parseable by `qpdf`, and contain non-blank pages before delivery.
* **Verifiable Ephemeral Storage:** Automated 1-hour Time-To-Live (TTL) auto-destruction of raw uploads and processed outputs.
* **Idempotent Job Dispatch:** Native `Idempotency-Key` HTTP header support to prevent duplicate job processing on network retries.

---

## 🛠️ Quickstart (Local Development)

### 1. Start Services via Docker Compose
```bash
cd deploy
docker compose up --build
```

Services will start:
* **API Gateway & Worker:** `http://localhost:8085`
* **PostgreSQL:** `localhost:5435`
* **Redis Task Queue:** `localhost:6385`
* **Next.js Frontend:** `http://localhost:3050`

---

## 📡 API Reference

### 1. `GET /v1/capabilities`
Returns the list of supported file format conversions, candidate engines, default queues, and fidelity ratings.

### 2. `POST /v1/uploads/presign`
Allocates an ephemeral upload slot and returns a presigned PUT URL.
```json
{
  "filename": "document.pdf",
  "size_bytes": 14502300,
  "mime_type": "application/pdf"
}
```

### 3. `POST /v1/jobs`
Creates and enqueues an asynchronous processing job.
* **Headers:** `Idempotency-Key: <unique-uuid>`
```json
{
  "upload_id": "upl_01h8v9...",
  "operation": "pdf_compress",
  "parameters": {
    "preset": "balanced",
    "downsample_dpi": 150,
    "jpeg_quality": 78
  }
}
```

### 4. `GET /v1/jobs/{id}/events`
Server-Sent Events (SSE) stream broadcasting real-time progress steps and final download links.

---

## 🧪 Running Integration Tests

Run the end-to-end integration test suite verifying healthchecks, presigned uploads, idempotent job replay, and output validator verification:

```bash
python tests/test_e2e.py
```
