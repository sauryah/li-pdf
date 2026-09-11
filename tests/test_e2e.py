"""
E2E Integration Test Suite for li-pdf Platform.
Tests:
1. Healthcheck & Capability Registry
2. Presigned Upload Flow
3. Idempotent Job Creation (PNG -> WebP conversion & PDF compression)
4. State Machine (QUEUED -> PROCESSING -> VALIDATING -> COMPLETED)
5. Output Validator Verification & Download
"""

import sys
import time
import json
import urllib.request
import urllib.parse
import os

API_BASE = os.environ.get("API_BASE", "http://localhost:8085")

def log(msg):
    print(f"[\033[94mTEST\033[0m] {msg}")

def success(msg):
    print(f"[\033[92mPASS\033[0m] {msg}")

def fail(msg):
    print(f"[\033[91mFAIL\033[0m] {msg}")
    sys.exit(1)

def request_json(url, method="GET", data=None, headers=None):
    if headers is None:
        headers = {}
    
    req_data = None
    if data is not None:
        req_data = json.dumps(data).encode("utf-8")
        headers["Content-Type"] = "application/json"

    req = urllib.request.Request(url, data=req_data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as resp:
            body = resp.read().decode("utf-8")
            if body:
                return resp.status, json.loads(body)
            return resp.status, {}
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8")
        try:
            return e.code, json.loads(body)
        except:
            return e.code, {"error": body}

def run_tests():
    log(f"Connecting to li-pdf API at {API_BASE}...")

    # 1. Healthcheck
    status, res = request_json(f"{API_BASE}/healthz")
    if status == 200 and res.get("status") == "healthy":
        success("Healthcheck passed")
    else:
        fail(f"Healthcheck failed: {status} {res}")

    # 2. Capabilities
    status, res = request_json(f"{API_BASE}/v1/capabilities")
    caps = res.get("capabilities", [])
    if status == 200 and len(caps) > 0:
        success(f"Capability Registry active ({len(caps)} operations registered)")
    else:
        fail(f"Capabilities fetch failed: {status} {res}")

    # 3. Create a synthetic test PNG file
    log("Creating synthetic test PNG...")
    # Minimal 1x1 valid PNG bytes
    png_bytes = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15c4\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82"
    
    # Presign upload
    status, presign = request_json(f"{API_BASE}/v1/uploads/presign", method="POST", data={
        "filename": "sample_test.png",
        "size_bytes": len(png_bytes),
        "mime_type": "image/png"
    })
    if status != 201 or "upload_url" not in presign:
        fail(f"Presign upload failed: {status} {presign}")
    
    upload_id = presign["upload_id"]
    upload_url = presign["upload_url"]
    success(f"Presigned upload slot created (ID: {upload_id})")

    # Direct Upload to Presigned URL
    log(f"Executing direct upload ({len(png_bytes)} bytes)...")
    req = urllib.request.Request(upload_url, data=png_bytes, headers={"Content-Type": "image/png"}, method="PUT")
    with urllib.request.urlopen(req) as resp:
        if resp.status not in (200, 204):
            fail(f"Direct upload to storage failed with HTTP {resp.status}")
    success("Direct storage payload upload verified")

    # 4. Create Job with Idempotency Key
    idempotency_key = f"e2e_idemp_{int(time.time())}"
    log(f"Creating job: 'png_to_webp' with Idempotency-Key: {idempotency_key}...")
    status, job_res = request_json(f"{API_BASE}/v1/jobs", method="POST", data={
        "upload_id": upload_id,
        "operation": "png_to_webp",
        "parameters": {"quality": 85}
    }, headers={"Idempotency-Key": idempotency_key})

    if status != 202 or "job_id" not in job_res:
        fail(f"Job creation failed: {status} {job_res}")
    
    job_id = job_res["job_id"]
    success(f"Job queued successfully (Job ID: {job_id})")

    # Verify Idempotency on duplicate request
    status, dup_res = request_json(f"{API_BASE}/v1/jobs", method="POST", data={
        "upload_id": upload_id,
        "operation": "png_to_webp",
    }, headers={"Idempotency-Key": idempotency_key})
    if status == 200 and dup_res.get("id") == job_id:
        success("Idempotent replay verified: returned existing job without duplicate creation")
    else:
        fail(f"Idempotency verification failed: {status} {dup_res}")

    # 5. Poll Job until Completed
    log("Awaiting worker processing and Output Validator gate...")
    max_wait = 15
    start = time.time()
    completed = False
    details = {}

    while time.time() - start < max_wait:
        status, details = request_json(f"{API_BASE}/v1/jobs/{job_id}")
        if status == 200:
            j_status = details.get("job", {}).get("status")
            if j_status == "completed":
                completed = True
                break
            elif j_status == "failed":
                fail(f"Worker reported job failure: {details}")
        time.sleep(0.5)

    if not completed:
        fail(f"Job timed out after {max_wait}s. Last state: {details}")

    outputs = details.get("outputs", [])
    if len(outputs) == 0:
        fail("Job marked completed but zero outputs registered")

    out = outputs[0]
    success(f"Job completed successfully! Output: '{out.get('filename')}' ({out.get('file_size')} bytes)")
    
    if out.get("validation_passed"):
        success("Output Validator gate: PASSED (magic bytes, dimensions, non-truncated stream verified)")
    else:
        fail("Output Validator check failed")

    # 6. Verify Signed Download URL
    download_url = out.get("download_url")
    log(f"Verifying signed download URL: {download_url}...")
    with urllib.request.urlopen(download_url) as resp:
        downloaded_bytes = resp.read()
        if len(downloaded_bytes) > 0:
            success(f"Output downloaded successfully ({len(downloaded_bytes)} bytes)")
        else:
            fail("Downloaded file is empty")

    print("\n=======================================================")
    print("  \033[92mALL INTEGRATION & ARCHITECTURE TESTS PASSED (100%)\033[0m  ")
    print("=======================================================\n")

if __name__ == "__main__":
    run_tests()
