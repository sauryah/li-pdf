/**
 * Phase 2 Comprehensive Test Suite for li-pdf Platform.
 * Tests:
 * 1. PDF -> High-DPI JPG & PNG Page Rendering (Poppler engine)
 * 2. PDF Rotation (90 degrees clockwise)
 * 3. PDF AES-256 Encryption / Password Protection
 * 4. PDF Decryption / Password Removal
 * 5. Image High-Quality Resizing (BiLinear/Lanczos)
 */

const http = require('http');

const API_BASE = process.env.API_BASE || 'http://localhost:8085';

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
    const parsed = new URL(url);
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
        resolve({ status: res.statusCode, headers: res.headers, body: json, text, buffer });
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
      filename,
      size_bytes: bytes.length,
      mime_type: mimeType,
    })
  );

  if (presignRes.status !== 201 || !presignRes.body?.upload_url) {
    fail(`Upload slot allocation failed for ${filename}: ${presignRes.text}`);
  }

  const uploadId = presignRes.body.upload_id;
  await request(presignRes.body.upload_url, { method: 'PUT', headers: { 'Content-Type': mimeType } }, bytes);
  return uploadId;
}

async function runJobAndWait(uploadId, operation, parameters = {}) {
  const jobRes = await request(
    `${API_BASE}/v1/jobs`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    },
    JSON.stringify({
      upload_id: uploadId,
      operation,
      parameters,
    })
  );

  if (jobRes.status !== 202 || !jobRes.body?.job_id) {
    fail(`Job creation failed for ${operation}: ${jobRes.text}`);
  }

  const jobId = jobRes.body.job_id;
  const maxWait = 15;
  const start = Date.now();

  while ((Date.now() - start) / 1000 < maxWait) {
    const res = await request(`${API_BASE}/v1/jobs/${jobId}`);
    if (res.body?.job?.status === 'completed') {
      return res.body;
    } else if (res.body?.job?.status === 'failed') {
      fail(`Job ${operation} failed: ${res.text}`);
    }
    await new Promise((r) => setTimeout(r, 300));
  }

  fail(`Job ${operation} timed out after ${maxWait}s`);
}

async function runPhase2Tests() {
  log('Starting Phase 2 Advanced Suite verification...');

  // 1. Valid PNG Buffer
  const pngBytes = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    'base64'
  );

  // Convert PNG -> PDF first to obtain a valid test PDF
  const pngUploadId = await uploadFile('input.png', 'image/png', pngBytes);
  const pdfJob = await runJobAndWait(pngUploadId, 'png_to_pdf');
  const pdfOutput = pdfJob.outputs[0];
  const pdfDownload = await request(pdfOutput.download_url);
  const pdfBytes = pdfDownload.buffer;
  success(`Generated base test PDF document (${pdfBytes.length} bytes)`);

  // 2. Test PDF -> High-DPI JPG
  log('Testing PDF -> JPG page rendering (Poppler engine)...');
  const pdfUploadId1 = await uploadFile('test_doc.pdf', 'application/pdf', pdfBytes);
  const pdfToJpgJob = await runJobAndWait(pdfUploadId1, 'pdf_to_jpg', { dpi: 150 });
  const jpgOut = pdfToJpgJob.outputs[0];
  success(`PDF -> JPG succeeded! Rendered: '${jpgOut.filename}' (${jpgOut.file_size} bytes)`);

  // Download the rendered JPG
  const renderedJpgDownload = await request(jpgOut.download_url);
  const renderedJpgBytes = renderedJpgDownload.buffer;

  // 3. Test PDF -> Lossless PNG
  log('Testing PDF -> PNG page rendering...');
  const pdfUploadId2 = await uploadFile('test_doc.pdf', 'application/pdf', pdfBytes);
  const pdfToPngJob = await runJobAndWait(pdfUploadId2, 'pdf_to_png', { dpi: 150 });
  const pngOut = pdfToPngJob.outputs[0];
  success(`PDF -> PNG succeeded! Rendered: '${pngOut.filename}' (${pngOut.file_size} bytes)`);

  // 4. Test PDF Rotation (+90 degrees)
  log('Testing PDF Rotation (+90 degrees)...');
  const pdfUploadId3 = await uploadFile('test_doc.pdf', 'application/pdf', pdfBytes);
  const rotateJob = await runJobAndWait(pdfUploadId3, 'pdf_rotate', { angle: 90 });
  const rotateOut = rotateJob.outputs[0];
  success(`PDF Rotate succeeded! Generated: '${rotateOut.filename}' (${rotateOut.file_size} bytes)`);

  // 5. Test PDF AES-256 Encryption
  log('Testing PDF AES-256 Password Encryption...');
  const pdfUploadId4 = await uploadFile('test_doc.pdf', 'application/pdf', pdfBytes);
  const encryptJob = await runJobAndWait(pdfUploadId4, 'pdf_encrypt', { user_password: 'secretPassword123' });
  const encryptOut = encryptJob.outputs[0];
  success(`PDF Encryption succeeded! Generated protected file: '${encryptOut.filename}' (${encryptOut.file_size} bytes)`);

  // 6. Test PDF Decryption
  log('Testing PDF Decryption with password...');
  const encDownload = await request(encryptOut.download_url);
  const encUploadId = await uploadFile('encrypted.pdf', 'application/pdf', encDownload.buffer);
  const decryptJob = await runJobAndWait(encUploadId, 'pdf_decrypt', { password: 'secretPassword123' });
  const decryptOut = decryptJob.outputs[0];
  success(`PDF Decryption succeeded! Unlocked file: '${decryptOut.filename}' (${decryptOut.file_size} bytes)`);

  // 7. Test Image Resizing on the rendered JPG
  log('Testing Image Resizing to 400x300 px...');
  const imgUploadId = await uploadFile('photo.jpg', 'image/jpeg', renderedJpgBytes);
  const resizeJob = await runJobAndWait(imgUploadId, 'image_resize', { width: 400, height: 300 });
  const resizeOut = resizeJob.outputs[0];
  success(`Image Resize succeeded! Generated: '${resizeOut.filename}' (${resizeOut.file_size} bytes)`);

  console.log('\n=======================================================');
  console.log('  \x1b[32mALL PHASE 2 ADVANCED OPERATIONS PASSED (100%)\x1b[0m  ');
  console.log('=======================================================\n');
}

runPhase2Tests().catch((err) => {
  fail(`Unhandled Phase 2 test error: ${err.message}`);
});
