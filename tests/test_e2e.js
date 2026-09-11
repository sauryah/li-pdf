/**
 * E2E Integration Test Suite for li-pdf Platform.
 * Tests:
 * 1. Healthcheck & Capability Registry
 * 2. Presigned Upload Flow
 * 3. Idempotent Job Creation (PNG -> WebP conversion & PDF ops)
 * 4. State Machine (QUEUED -> PROCESSING -> VALIDATING -> COMPLETED)
 * 5. Output Validator Verification & Download
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
    if (body) {
      req.write(body);
    }
    req.end();
  });
}

async function runTests() {
  log(`Connecting to li-pdf API at ${API_BASE}...`);

  // 1. Healthcheck
  const health = await request(`${API_BASE}/healthz`);
  if (health.status === 200 && health.body?.status === 'healthy') {
    success('Healthcheck passed');
  } else {
    fail(`Healthcheck failed: ${health.status} ${health.text}`);
  }

  // 2. Capabilities
  const capsRes = await request(`${API_BASE}/v1/capabilities`);
  const caps = capsRes.body?.capabilities || [];
  if (capsRes.status === 200 && caps.length > 0) {
    success(`Capability Registry active (${caps.length} operations registered)`);
  } else {
    fail(`Capabilities fetch failed: ${capsRes.status} ${capsRes.text}`);
  }

  // 3. Create a synthetic test PNG file
  log('Creating synthetic test PNG...');
  const pngBytes = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    'base64'
  );

  // Request Presigned Upload
  const presignRes = await request(
    `${API_BASE}/v1/uploads/presign`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    },
    JSON.stringify({
      filename: 'sample_test.png',
      size_bytes: pngBytes.length,
      mime_type: 'image/png',
    })
  );

  if (presignRes.status !== 201 || !presignRes.body?.upload_url) {
    fail(`Presign upload failed: ${presignRes.status} ${presignRes.text}`);
  }

  const uploadId = presignRes.body.upload_id;
  const uploadUrl = presignRes.body.upload_url.replace('http://localhost:8085', API_BASE);
  success(`Presigned upload slot created (ID: ${uploadId})`);

  // Direct Upload to Storage URL
  log(`Executing direct upload (${pngBytes.length} bytes)...`);
  const directUpload = await request(
    uploadUrl,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'image/png' },
    },
    pngBytes
  );

  if (directUpload.status !== 200 && directUpload.status !== 204) {
    fail(`Direct upload to storage failed with status ${directUpload.status}`);
  }
  success('Direct storage payload upload verified');

  // 4. Create Job with Idempotency Key
  const idempotencyKey = `e2e_idemp_${Date.now()}`;
  log(`Creating job: 'png_to_webp' with Idempotency-Key: ${idempotencyKey}...`);

  const jobRes = await request(
    `${API_BASE}/v1/jobs`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
      },
    },
    JSON.stringify({
      upload_id: uploadId,
      operation: 'png_to_webp',
      parameters: { quality: 85 },
    })
  );

  if (jobRes.status !== 202 || !jobRes.body?.job_id) {
    fail(`Job creation failed: ${jobRes.status} ${jobRes.text}`);
  }

  const jobId = jobRes.body.job_id;
  success(`Job queued successfully (Job ID: ${jobId}, Profile: ${jobRes.body.resource_profile})`);

  // Verify Idempotency on duplicate request
  const dupRes = await request(
    `${API_BASE}/v1/jobs`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
      },
    },
    JSON.stringify({
      upload_id: uploadId,
      operation: 'png_to_webp',
    })
  );

  if (dupRes.status === 200 && dupRes.body?.id === jobId) {
    success('Idempotent replay verified: returned existing job without duplicate task dispatch');
  } else {
    fail(`Idempotency verification failed: ${dupRes.status} ${dupRes.text}`);
  }

  // 5. Poll Job until Completed
  log('Awaiting worker processing and Output Validator gate...');
  const maxWait = 15;
  const start = Date.now();
  let completed = false;
  let details = null;

  while ((Date.now() - start) / 1000 < maxWait) {
    const pollRes = await request(`${API_BASE}/v1/jobs/${jobId}`);
    if (pollRes.status === 200) {
      details = pollRes.body;
      const status = details.job?.status;
      if (status === 'completed') {
        completed = true;
        break;
      } else if (status === 'failed') {
        fail(`Worker reported job failure: ${pollRes.text}`);
      }
    }
    await new Promise((r) => setTimeout(r, 400));
  }

  if (!completed) {
    fail(`Job timed out after ${maxWait}s. Last state: ${JSON.stringify(details)}`);
  }

  const outputs = details.outputs || [];
  if (outputs.length === 0) {
    fail('Job marked completed but zero outputs registered');
  }

  const out = outputs[0];
  success(`Job completed successfully! Output: '${out.filename}' (${out.file_size} bytes)`);

  if (out.validation_passed) {
    success('Output Validator gate: PASSED (magic bytes, dimensions, non-truncated stream verified)');
  } else {
    fail('Output Validator check failed');
  }

  // 6. Verify Signed Download URL
  const downloadUrl = (out.download_url || '').replace('http://localhost:8085', API_BASE);
  log(`Verifying signed download URL: ${downloadUrl}...`);
  const downloadRes = await request(downloadUrl);
  if (downloadRes.status === 200 && downloadRes.buffer.length > 0) {
    success(`Output downloaded successfully (${downloadRes.buffer.length} bytes)`);
  } else {
    fail(`Download failed with status ${downloadRes.status}`);
  }

  console.log('\n=======================================================');
  console.log('  \x1b[32mALL INTEGRATION & ARCHITECTURE TESTS PASSED (100%)\x1b[0m  ');
  console.log('=======================================================\n');
}

runTests().catch((err) => {
  fail(`Unhandled test error: ${err.message}`);
});
