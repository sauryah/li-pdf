import { DocumentSpec, ProcessResponse, AdjustRequest, PDFGenerateRequest } from './passport-types';

const API_BASE_URL = process.env.NEXT_PUBLIC_PHOTO_ENGINE_URL || 'http://localhost:8000';

export async function fetchAllSpecs(): Promise<DocumentSpec[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/specs`);
    if (!res.ok) throw new Error('Failed to load document specifications');
    const data = await res.json();
    return data.specs;
  } catch (err) {
    console.warn('Using fallback document specs due to API error:', err);
    return [
      {
        id: 'in_passport',
        country: 'India',
        country_code: 'IN',
        name: 'India Passport',
        category: 'passport',
        width_mm: 35.0,
        height_mm: 45.0,
        dpi: 300,
        face_coverage_min_pct: 0.70,
        face_coverage_max_pct: 0.80,
        crown_to_top_margin_pct: 0.08,
        default_background_color: '#FFFFFF',
        allowed_background_colors: ['#FFFFFF', '#F3F4F6', '#E5E7EB'],
        description: '35 x 45 mm, 70-80% face coverage, white background.'
      },
      {
        id: 'in_visa',
        country: 'India',
        country_code: 'IN',
        name: 'India Visa / OCI',
        category: 'visa',
        width_mm: 51.0,
        height_mm: 51.0,
        dpi: 300,
        face_coverage_min_pct: 0.55,
        face_coverage_max_pct: 0.70,
        crown_to_top_margin_pct: 0.10,
        default_background_color: '#FFFFFF',
        allowed_background_colors: ['#FFFFFF', '#F9FAFB'],
        description: '51 x 51 mm (2x2 inch), square photo with white background.'
      },
      {
        id: 'us_passport_visa',
        country: 'United States',
        country_code: 'US',
        name: 'US Passport / Visa',
        category: 'passport',
        width_mm: 51.0,
        height_mm: 51.0,
        dpi: 300,
        face_coverage_min_pct: 0.50,
        face_coverage_max_pct: 0.69,
        crown_to_top_margin_pct: 0.10,
        default_background_color: '#FFFFFF',
        allowed_background_colors: ['#FFFFFF', '#FAFAFA'],
        description: '2 x 2 inch (51 x 51 mm), head between 50-69%.'
      },
      {
        id: 'uk_passport',
        country: 'United Kingdom',
        country_code: 'GB',
        name: 'UK Passport',
        category: 'passport',
        width_mm: 35.0,
        height_mm: 45.0,
        dpi: 300,
        face_coverage_min_pct: 0.64,
        face_coverage_max_pct: 0.75,
        crown_to_top_margin_pct: 0.08,
        default_background_color: '#E5E7EB',
        allowed_background_colors: ['#E5E7EB', '#F3F4F6', '#FFFFFF'],
        description: '35 x 45 mm, head 29-34 mm, light grey background.'
      },
      {
        id: 'schengen_visa',
        country: 'Schengen Area',
        country_code: 'EU',
        name: 'Schengen Visa',
        category: 'visa',
        width_mm: 35.0,
        height_mm: 45.0,
        dpi: 300,
        face_coverage_min_pct: 0.70,
        face_coverage_max_pct: 0.80,
        crown_to_top_margin_pct: 0.08,
        default_background_color: '#E5E7EB',
        allowed_background_colors: ['#E5E7EB', '#F3F4F6', '#FFFFFF'],
        description: '35 x 45 mm, 70-80% face ratio, light grey background.'
      }
    ];
  }
}

export async function processPhoto(file: File, docId: string, bgColor?: string): Promise<ProcessResponse> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('doc_id', docId);
  if (bgColor) {
    formData.append('bg_color', bgColor);
  }

  const res = await fetch(`${API_BASE_URL}/api/process`, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Failed to process image');
  }

  return res.json();
}

export async function adjustPhoto(params: AdjustRequest): Promise<ProcessResponse> {
  const res = await fetch(`${API_BASE_URL}/api/adjust`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Failed to apply adjustments');
  }

  return res.json();
}

export async function downloadPDF(params: PDFGenerateRequest): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/generate-pdf`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  if (!res.ok) {
    throw new Error('Failed to generate print sheet PDF');
  }

  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${params.doc_id}_${params.paper_size.toLowerCase()}_sheet.pdf`;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}

export async function downloadSheetImage(params: PDFGenerateRequest): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/api/generate-sheet-image`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  if (!res.ok) {
    throw new Error('Failed to generate sheet image');
  }

  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${params.doc_id}_${params.paper_size.toLowerCase()}_sheet.jpg`;
  document.body.appendChild(a);
  a.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}

export function getSinglePhotoDownloadUrl(sessionId: string, format: string = 'jpg'): string {
  return `${API_BASE_URL}/api/download-single/${sessionId}?format=${format}`;
}
