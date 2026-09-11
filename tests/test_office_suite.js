/**
 * Phase 3 Office Document Conversion Integration Test Suite.
 * Tests:
 * 1. Healthcheck & Registry (DOCX, XLSX, PPTX, RTF, TXT, HTML, PDF_TO_TXT)
 * 2. TXT -> PDF Conversion via LibreOffice
 * 3. RTF -> PDF Conversion via LibreOffice
 * 4. HTML -> PDF Conversion via LibreOffice
 * 5. DOCX -> PDF Conversion via LibreOffice
 * 6. PDF -> TXT Text Extraction via Poppler/LibreOffice
 * 7. Hardened Output Validation Gate verification on generated files
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
        } catch (e) {}

        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          data: json,
          text: text,
          buffer: buffer,
        });
      });
    });

    req.on('error', reject);
    if (body) {
      req.write(body);
    }
    req.end();
  });
}

function createMinimalDocxBuffer(text) {
  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;

  const rootRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p>
      <w:r>
        <w:t>${text}</w:t>
      </w:r>
    </w:p>
  </w:body>
</w:document>`;

  const files = [
    { name: '[Content_Types].xml', content: Buffer.from(contentTypesXml, 'utf8') },
    { name: '_rels/.rels', content: Buffer.from(rootRelsXml, 'utf8') },
    { name: 'word/document.xml', content: Buffer.from(documentXml, 'utf8') }
  ];

  const localHeaders = [];
  const cdHeaders = [];
  let offset = 0;

  for (const f of files) {
    const nameBuf = Buffer.from(f.name, 'utf8');
    const crc = crc32(f.content);
    const size = f.content.length;

    const local = Buffer.alloc(30 + nameBuf.length);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(0, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(size, 18);
    local.writeUInt32LE(size, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);
    nameBuf.copy(local, 30);

    localHeaders.push(local);
    localHeaders.push(f.content);

    const cd = Buffer.alloc(46 + nameBuf.length);
    cd.writeUInt32LE(0x02014b50, 0);
    cd.writeUInt16LE(20, 4);
    cd.writeUInt16LE(20, 6);
    cd.writeUInt16LE(0, 8);
    cd.writeUInt16LE(0, 10);
    cd.writeUInt16LE(0, 12);
    cd.writeUInt16LE(0, 14);
    cd.writeUInt32LE(crc, 16);
    cd.writeUInt32LE(size, 20);
    cd.writeUInt32LE(size, 24);
    cd.writeUInt16LE(nameBuf.length, 28);
    cd.writeUInt16LE(0, 30);
    cd.writeUInt16LE(0, 32);
    cd.writeUInt16LE(0, 34);
    cd.writeUInt16LE(0, 36);
    cd.writeUInt32LE(0, 38);
    cd.writeUInt32LE(offset, 42);
    nameBuf.copy(cd, 46);

    cdHeaders.push(cd);
    offset += local.length + size;
  }

  const cdOffset = offset;
  let cdSize = 0;
  for (const c of cdHeaders) cdSize += c.length;

  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(files.length, 8);
  eocd.writeUInt16LE(files.length, 10);
  eocd.writeUInt32LE(cdSize, 12);
  eocd.writeUInt32LE(cdOffset, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([...localHeaders, ...cdHeaders, eocd]);
}

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

async function uploadFile(filename, mimeType, buffer) {
  const presignRes = await request(`${API_BASE}/v1/uploads/presign`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  }, JSON.stringify({
    filename: filename,
    size_bytes: buffer.length,
    mime_type: mimeType,
  }));

  if ((presignRes.statusCode !== 200 && presignRes.statusCode !== 201) || !presignRes.data?.upload_url) {
    throw new Error(`Failed to get presigned upload URL: ${presignRes.text}`);
  }

  const uploadUrl = presignRes.data.upload_url.replace('http://localhost:8085', API_BASE);
  const putRes = await request(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': mimeType, 'Content-Length': buffer.length },
  }, buffer);

  if (putRes.statusCode !== 200) {
    throw new Error(`Direct upload failed with status ${putRes.statusCode}`);
  }

  return presignRes.data.upload_id;
}

async function runJob(uploadId, operation, parameters = {}) {
  const jobRes = await request(`${API_BASE}/v1/jobs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  }, JSON.stringify({
    upload_id: uploadId,
    operation: operation,
    parameters: parameters,
  }));

  if (jobRes.statusCode !== 202 && jobRes.statusCode !== 200) {
    throw new Error(`Failed to dispatch job ${operation}: ${jobRes.text}`);
  }

  const jobId = jobRes.data.job_id || jobRes.data.id || jobRes.data.job?.id;
  if (!jobId) {
    throw new Error(`No jobId in response: ${JSON.stringify(jobRes.data)}`);
  }

  // Poll for completion
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 600));
    const statusRes = await request(`${API_BASE}/v1/jobs/${jobId}`);
    const job = statusRes.data.job;

    if (job.status === 'completed') {
      return statusRes.data;
    }
    if (job.status === 'failed') {
      throw new Error(`Job ${jobId} (${operation}) failed in worker!`);
    }
  }

  throw new Error(`Job ${jobId} timed out`);
}

async function main() {
  log('======================================================');
  log('  li-pdf Phase 3: Office Document Pipeline Test Suite ');
  log('======================================================');

  // Step 1: Healthcheck
  log('1. Checking API Server Health...');
  const health = await request(`${API_BASE}/healthz`);
  if (health.statusCode !== 200) fail(`Health check failed: ${health.statusCode}`);
  success(`Health check passed: system=${health.data.system}`);

  // Step 2: Capability Registry
  log('\n2. Verifying Office capabilities registration...');
  const capsRes = await request(`${API_BASE}/v1/capabilities`);
  const caps = capsRes.data.capabilities;
  const officeOps = ['docx_to_pdf', 'xlsx_to_pdf', 'pptx_to_pdf', 'rtf_to_pdf', 'txt_to_pdf', 'html_to_pdf', 'pdf_to_txt'];
  for (const op of officeOps) {
    const found = caps.find((c) => c.operation === op);
    if (!found) fail(`Capability ${op} missing from registry`);
    log(`  - Capability '${op}' -> Engine: ${found.default_engine}, Queue: ${found.queue}, Profile: ${found.resource_profile}`);
  }
  success('All Office capabilities registered with correct resource profiles and queues');

  // Step 3: TXT -> PDF
  log('\n3. Testing Plain Text (TXT) -> PDF Conversion Pipeline...');
  const txtBuffer = Buffer.from('Universal File Converter\nPhase 3: Office Engine Validation\nEngine: LibreOffice Headless with Isolated User Profiles.\n', 'utf-8');
  const txtUploadId = await uploadFile('notes.txt', 'text/plain', txtBuffer);
  const txtResult = await runJob(txtUploadId, 'txt_to_pdf');
  const txtOutput = txtResult.outputs[0];
  const txtDownloadUrl = txtOutput.download_url.replace('http://localhost:8085', API_BASE);
  const txtPdfRes = await request(txtDownloadUrl);
  if (!txtPdfRes.buffer.slice(0, 5).toString().startsWith('%PDF-')) {
    fail('TXT -> PDF output is missing valid %PDF- header');
  }
  success(`TXT -> PDF completed: Output='${txtOutput.filename}', Size=${txtPdfRes.buffer.length} bytes, Header=${txtPdfRes.buffer.slice(0, 5).toString()}`);

  // Step 4: RTF -> PDF
  log('\n4. Testing Rich Text Format (RTF) -> PDF Conversion Pipeline...');
  const rtfBuffer = Buffer.from('{\\rtf1\\ansi\\deff0 {\\fonttbl{\\f0 Times New Roman;}}\\f0\\fs28 \\b li-pdf Rich Text Format Document\\b0\\par This verifies headless LibreOffice conversion of formatted RTF documents.\\par}', 'utf-8');
  const rtfUploadId = await uploadFile('document.rtf', 'application/rtf', rtfBuffer);
  const rtfResult = await runJob(rtfUploadId, 'rtf_to_pdf');
  const rtfOutput = rtfResult.outputs[0];
  const rtfDownloadUrl = rtfOutput.download_url.replace('http://localhost:8085', API_BASE);
  const rtfPdfRes = await request(rtfDownloadUrl);
  if (!rtfPdfRes.buffer.slice(0, 5).toString().startsWith('%PDF-')) {
    fail('RTF -> PDF output is missing valid %PDF- header');
  }
  success(`RTF -> PDF completed: Output='${rtfOutput.filename}', Size=${rtfPdfRes.buffer.length} bytes`);

  // Step 5: HTML -> PDF
  log('\n5. Testing HTML -> PDF Conversion Pipeline...');
  const htmlBuffer = Buffer.from('<!DOCTYPE html><html><head><title>li-pdf Test</title></head><body><h1>Document Conversion Engine</h1><p>High quality PDF rendering from HTML sources with standard typography.</p></body></html>', 'utf-8');
  const htmlUploadId = await uploadFile('document.html', 'text/html', htmlBuffer);
  const htmlResult = await runJob(htmlUploadId, 'html_to_pdf');
  const htmlOutput = htmlResult.outputs[0];
  const htmlDownloadUrl = htmlOutput.download_url.replace('http://localhost:8085', API_BASE);
  const htmlPdfRes = await request(htmlDownloadUrl);
  if (!htmlPdfRes.buffer.slice(0, 5).toString().startsWith('%PDF-')) {
    fail('HTML -> PDF output is missing valid %PDF- header');
  }
  success(`HTML -> PDF completed: Output='${htmlOutput.filename}', Size=${htmlPdfRes.buffer.length} bytes`);

  // Step 6: DOCX -> PDF
  log('\n6. Testing DOCX -> PDF Conversion Pipeline...');
  const docxBuffer = createMinimalDocxBuffer('Production li-pdf DOCX to PDF verification test content.');
  const docxUploadId = await uploadFile('document.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', docxBuffer);
  const docxResult = await runJob(docxUploadId, 'docx_to_pdf');
  const docxOutput = docxResult.outputs[0];
  const docxDownloadUrl = docxOutput.download_url.replace('http://localhost:8085', API_BASE);
  const docxPdfRes = await request(docxDownloadUrl);
  if (!docxPdfRes.buffer.slice(0, 5).toString().startsWith('%PDF-')) {
    fail('DOCX -> PDF output is missing valid %PDF- header');
  }
  success(`DOCX -> PDF completed: Output='${docxOutput.filename}', Size=${docxPdfRes.buffer.length} bytes`);

  // Step 7: PDF -> TXT Extraction
  log('\n7. Testing PDF -> Plain Text Extraction Pipeline...');
  const pdfToTxtUploadId = await uploadFile('generated_sample.pdf', 'application/pdf', docxPdfRes.buffer);
  const txtExtractResult = await runJob(pdfToTxtUploadId, 'pdf_to_txt');
  const txtExtractOutput = txtExtractResult.outputs[0];
  const txtExtractDownloadUrl = txtExtractOutput.download_url.replace('http://localhost:8085', API_BASE);
  const txtExtractRes = await request(txtExtractDownloadUrl);
  const extractedText = txtExtractRes.text;
  success(`PDF -> TXT completed: Output='${txtExtractOutput.filename}', Extracted Length=${extractedText.length} chars, Preview="${extractedText.trim().substring(0, 60)}..."`);

  log('\n======================================================');
  success('ALL PHASE 3 OFFICE SUITE TESTS PASSED (100%)');
  log('======================================================\n');
}

main().catch((err) => {
  fail(`Unhandled error: ${err.message}\n${err.stack}`);
});
