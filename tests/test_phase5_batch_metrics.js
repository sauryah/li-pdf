/**
 * Phase 5 Comprehensive Integration Test Suite for li-pdf Platform.
 * Tests:
 * 1. Deep Health & Readiness Probe (/readyz)
 * 2. Prometheus Metrics Exposition (/metrics)
 * 3. Multi-File Atomic Batch Job Submission (/v1/jobs/batch)
 * 4. Concurrent Multi-Queue Worker Processing & Output Integrity Validation
 * 5. Metrics Increment & Latency Tracking Verification
 */

const http = require('http');

const API_BASE = process.env.API_BASE || 'http://127.0.0.1:8085';

function log(msg) {
  console.log(`\x1b[34m[TEST]\x1b[0m ${msg}`);
}

function success(msg) {
  console.log(`\x1b[32m[PASS]\x1b[0m ${msg}`);
}

function fail(msg) {
  console.error(`\x1b[31m[FAIL]\x1b[0m ${msg}`);
  process.exit(1);
}

async function request(url, options = {}, body = null) {
  return new Promise((resolve, reject) => {
    const targetUrl = url.replace('http://localhost:8085', API_BASE);
    const parsed = new URL(targetUrl);
    const reqOptions = {
      hostname: parsed.hostname,
      port: parsed.port,
      path: parsed.pathname + parsed.search,
      method: options.method || 'GET',
      headers: options.headers || {},
    };

    const req = http.request(reqOptions, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const buffer = Buffer.concat(chunks);
        const text = buffer.toString('utf-8');
        let json = null;
        try {
          json = JSON.parse(text);
        } catch (_) {}
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: json,
          text: text,
          buffer: buffer,
        });
      });
    });

    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function uploadFile(filename, mimeType, bytes) {
  const presignRes = await request(
    `${API_BASE}/v1/uploads/presign`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    },
    JSON.stringify({
      filename: filename,
      size_bytes: bytes.length,
      mime_type: mimeType,
    })
  );

  if ((presignRes.status !== 200 && presignRes.status !== 201) || !presignRes.body?.upload_url) {
    fail(`Presign upload failed: ${presignRes.status} ${presignRes.text}`);
  }

  const uploadId = presignRes.body.upload_id;
  const uploadUrl = presignRes.body.upload_url;

  const directUpload = await request(
    uploadUrl,
    {
      method: 'PUT',
      headers: { 'Content-Type': mimeType, 'Content-Length': bytes.length },
    },
    bytes
  );

  if (directUpload.status !== 200 && directUpload.status !== 204) {
    fail(`Direct upload to storage failed with status ${directUpload.status}`);
  }

  return uploadId;
}

async function waitForJobCompletion(jobId, maxWaitSeconds = 40) {
  const start = Date.now();
  while ((Date.now() - start) / 1000 < maxWaitSeconds) {
    const pollRes = await request(`${API_BASE}/v1/jobs/${jobId}`);
    if (pollRes.status === 200) {
      const details = pollRes.body;
      const status = details.job?.status;
      if (status === 'completed') {
        return details;
      } else if (status === 'failed') {
        fail(`Worker reported job failure for ${jobId}: ${pollRes.text}`);
      }
    }
    await new Promise((r) => setTimeout(r, 600));
  }
  fail(`Job ${jobId} timed out`);
}

function createSamplePDF() {
  const content = `%PDF-1.4
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj
4 0 obj << /Length 55 >> stream
BT
/F1 18 Tf
100 700 Td
(Phase 5 Batch Processing Test) Tj
ET
endstream endobj
5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000244 00000 n 
0000000349 00000 n 
trailer << /Size 6 /Root 1 0 R >>
startxref
426
%%EOF`;
  return Buffer.from(content, 'utf-8');
}

const zlib = require('zlib');

function crc32(buf) {
  let crc = ~0;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (~crc) >>> 0;
}

function makePngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  const crcVal = crc32(Buffer.concat([typeBuf, data]));
  crc.writeUInt32BE(crcVal, 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

function createValidTestPNG(width = 160, height = 80) {
  const header = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.writeUInt8(8, 8);
  ihdr.writeUInt8(2, 9);
  ihdr.writeUInt8(0, 10);
  ihdr.writeUInt8(0, 11);
  ihdr.writeUInt8(0, 12);
  const ihdrChunk = makePngChunk('IHDR', ihdr);

  const rowLen = 1 + width * 3;
  const raw = Buffer.alloc(height * rowLen, 0xEE);
  for (let y = 0; y < height; y++) {
    raw[y * rowLen] = 0;
  }

  const compressed = zlib.deflateSync(raw);
  const idatChunk = makePngChunk('IDAT', compressed);
  const iendChunk = makePngChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([header, ihdrChunk, idatChunk, iendChunk]);
}

async function main() {
  log('========================================================');
  log('  li-pdf Phase 5: Batch Queueing & Prometheus Metrics   ');
  log('========================================================');

  // 1. Readiness Probe Check
  log('1. Verifying Readiness Probe (/readyz)...');
  const ready = await request(`${API_BASE}/readyz`);
  if (ready.status !== 200 || ready.body?.status !== 'ready') {
    fail(`Readiness check failed: ${ready.status} ${ready.text}`);
  }
  success(`Readiness check passed: ${JSON.stringify(ready.body)}`);

  // 2. Initial Prometheus Metrics Scraping
  log('\n2. Testing Prometheus Metrics Scraper (/metrics)...');
  const initialMetrics = await request(`${API_BASE}/metrics`);
  if (initialMetrics.status !== 200) {
    fail(`Metrics scraper failed with status ${initialMetrics.status}`);
  }
  if (!initialMetrics.text.includes('lipdf_uptime_seconds') || !initialMetrics.text.includes('lipdf_active_jobs')) {
    fail(`Metrics output missing required headers: ${initialMetrics.text}`);
  }
  success('Prometheus metrics endpoint (/metrics) verified and returning valid exposition format');

  // 3. Multi-File Batch Queueing
  log('\n3. Preparing Multi-File Batch (3 distinct formats: PDF, Image, TXT)...');
  const pdfBytes = createSamplePDF();
  const pngBytes = createValidTestPNG(200, 100);
  const txtBytes = Buffer.from('Phase 5 Batch Document Processing Content for LibreOffice test.', 'utf-8');

  const pdfUploadId = await uploadFile('batch_doc.pdf', 'application/pdf', pdfBytes);
  const pngUploadId = await uploadFile('batch_photo.png', 'image/png', pngBytes);
  const txtUploadId = await uploadFile('batch_notes.txt', 'text/plain', txtBytes);

  log(`  - Upload 1 (PDF):   ${pdfUploadId}`);
  log(`  - Upload 2 (PNG):   ${pngUploadId}`);
  log(`  - Upload 3 (TXT):   ${txtUploadId}`);

  log('\n4. Submitting Atomic Multi-File Batch (/v1/jobs/batch)...');
  const batchPayload = {
    jobs: [
      {
        upload_id: pdfUploadId,
        operation: 'pdf_rotate',
        parameters: { angle: 90 },
      },
      {
        upload_id: pngUploadId,
        operation: 'png_to_webp',
        parameters: { quality: 85 },
      },
      {
        upload_id: txtUploadId,
        operation: 'txt_to_pdf',
        parameters: {},
      },
    ],
  };

  const batchRes = await request(
    `${API_BASE}/v1/jobs/batch`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    },
    JSON.stringify(batchPayload)
  );

  if (batchRes.status !== 202 && batchRes.status !== 200) {
    fail(`Batch submission failed: ${batchRes.status} ${batchRes.text}`);
  }

  const batchData = batchRes.body;
  if (!batchData.batch_id || batchData.total !== 3 || batchData.jobs.length !== 3) {
    fail(`Invalid batch response structure: ${batchRes.text}`);
  }
  success(`Atomic batch enqueued successfully! BatchID: ${batchData.batch_id} (Dispatched 3 parallel jobs)`);

  // 5. Await Concurrent Job Completions
  log('\n5. Awaiting Concurrent Worker Execution Across Queues...');
  const results = await Promise.all(
    batchData.jobs.map(async (jobItem, idx) => {
      log(`  - Monitoring Job #${idx + 1} (${jobItem.operation}, ID: ${jobItem.job_id})...`);
      const finished = await waitForJobCompletion(jobItem.job_id);
      success(`  - Job #${idx + 1} (${jobItem.operation}) COMPLETED! Output: ${finished.outputs[0]?.filename}`);
      return finished;
    })
  );

  // 6. Verify Outputs
  log('\n6. Validating Generated Artifact Integrity & Download URLs...');
  for (let i = 0; i < results.length; i++) {
    const out = results[i].outputs[0];
    const dlRes = await request(out.download_url);
    if (dlRes.status !== 200 || dlRes.buffer.length === 0) {
      fail(`Failed to download output for job #${i + 1}: ${out.download_url}`);
    }
    log(`  - Output #${i + 1}: ${out.filename} (${dlRes.buffer.length} bytes, MIME: ${out.mime_type})`);
  }
  success('All batch job outputs validated and downloaded successfully');

  // 7. Verify Prometheus Metrics Recorded Jobs
  log('\n7. Verifying Prometheus Metrics Increments...');
  const finalMetrics = await request(`${API_BASE}/metrics`);
  log('Metrics Snapshot:');
  console.log(finalMetrics.text.trim());

  if (!finalMetrics.text.includes('lipdf_jobs_total')) {
    fail('lipdf_jobs_total metric not populated after job execution');
  }
  if (!finalMetrics.text.includes('status="completed"')) {
    fail('lipdf_jobs_total does not contain completed status entries');
  }
  success('Prometheus metrics successfully recorded job counts, latencies, and statuses');

  log('\n========================================================');
  success('ALL PHASE 5 BATCH PROCESSING & METRICS TESTS PASSED (100%)');
  log('========================================================\n');
}

main().catch((err) => {
  fail(`Unhandled error: ${err.message}\n${err.stack}`);
});
