export interface Capability {
  source_mime: string;
  source_ext: string;
  target_mime: string;
  target_ext: string;
  operation: string;
  description: string;
  fidelity_rating: string;
  resource_profile: string;
  supports_batch: boolean;
  supports_page_range: boolean;
}

export interface PresignResponse {
  upload_id: string;
  storage_key: string;
  upload_url: string;
  expires_at: string;
}

export interface JobResponse {
  job_id: string;
  status: string;
  progress_percent: number;
  resource_profile: string;
  events_stream_url: string;
}

export interface OutputItem {
  id: string;
  filename: string;
  file_size: number;
  mime_type: string;
  download_url: string;
  validation_passed: boolean;
}

export interface JobDetailResponse {
  job: {
    id: string;
    operation: string;
    status: string;
    progress_percent: number;
    created_at: string;
    completed_at?: string;
  };
  outputs: OutputItem[];
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8085';

export async function fetchCapabilities(): Promise<Capability[]> {
  try {
    const res = await fetch(`${API_BASE}/v1/capabilities`);
    if (!res.ok) throw new Error('Failed to fetch capabilities');
    const data = await res.json();
    return data.capabilities || [];
  } catch (err) {
    console.error('Capabilities error:', err);
    return [];
  }
}

export async function requestPresignedUpload(
  file: File
): Promise<PresignResponse> {
  const res = await fetch(`${API_BASE}/v1/uploads/presign`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      filename: file.name,
      size_bytes: file.size,
      mime_type: file.type || 'application/octet-stream',
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to request upload slot');
  }

  return res.json();
}

export async function uploadFileToPresigned(
  uploadUrl: string,
  file: File,
  onProgress?: (percent: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', uploadUrl, true);
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');

    if (xhr.upload && onProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const percent = Math.round((e.loaded / e.total) * 100);
          onProgress(percent);
        }
      };
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error(`Upload failed with status ${xhr.status}`));
      }
    };

    xhr.onerror = () => reject(new Error('Network error during file upload'));
    xhr.send(file);
  });
}

export async function createJob(
  uploadId: string,
  operation: string,
  parameters: Record<string, any> = {},
  idempotencyKey?: string
): Promise<JobResponse> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (idempotencyKey) {
    headers['Idempotency-Key'] = idempotencyKey;
  }

  const res = await fetch(`${API_BASE}/v1/jobs`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      upload_id: uploadId,
      operation,
      parameters,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to create job');
  }

  return res.json();
}

export async function fetchJobDetails(jobId: string): Promise<JobDetailResponse> {
  const res = await fetch(`${API_BASE}/v1/jobs/${jobId}`);
  if (!res.ok) throw new Error('Failed to fetch job');
  return res.json();
}

export interface BatchJobItem {
  upload_id: string;
  operation: string;
  parameters?: Record<string, any>;
}

export interface BatchCreateResponse {
  batch_id: string;
  total: number;
  jobs: Array<{
    job_id: string;
    upload_id: string;
    operation: string;
    status: string;
    resource_profile: string;
    events_stream_url: string;
    error?: string;
  }>;
}

export async function createBatchJobs(jobs: BatchJobItem[]): Promise<BatchCreateResponse> {
  const res = await fetch(`${API_BASE}/v1/jobs/batch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jobs }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to submit batch jobs');
  }

  return res.json();
}
