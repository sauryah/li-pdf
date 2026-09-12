export interface DocumentSpec {
  id: string;
  country: string;
  country_code: string;
  name: string;
  category: 'passport' | 'visa' | 'id' | 'custom';
  width_mm: number;
  height_mm: number;
  dpi: number;
  face_coverage_min_pct: number;
  face_coverage_max_pct: number;
  crown_to_top_margin_pct: number;
  eye_level_from_bottom_min_pct?: number;
  eye_level_from_bottom_max_pct?: number;
  default_background_color: string;
  allowed_background_colors: string[];
  description: string;
  notes?: string;
  guidelines_url?: string;
  target_width_px?: number;
  target_height_px?: number;
}

export interface ComplianceCheckItem {
  id: string;
  title: string;
  passed: boolean;
  status: 'pass' | 'warn' | 'fail';
  message: string;
  details?: Record<string, any>;
}

export interface ComplianceReport {
  overall_compliant: boolean;
  items: ComplianceCheckItem[];
  face_count: number;
  sharpness_score: number;
  tilt_angle_deg: number;
  head_ratio_pct: number;
  warnings: string[];
}

export interface FaceLandmarksData {
  has_face: boolean;
  face_count: number;
  bounding_box?: number[];
  chin_point?: [number, number];
  crown_point?: [number, number];
  left_eye?: [number, number];
  right_eye?: [number, number];
  nose_tip?: [number, number];
  tilt_angle_deg: number;
}

export interface ProcessResponse {
  session_id: string;
  spec: DocumentSpec;
  original_image_url: string;
  processed_image_url: string;
  preview_data_url: string;
  cutout_data_url?: string;
  dimensions: {
    width_mm: number;
    height_mm: number;
    width_px: number;
    height_px: number;
    dpi: number;
  };
  compliance: ComplianceReport;
  landmarks?: FaceLandmarksData;
}

export interface AdjustRequest {
  session_id: string;
  doc_id: string;
  zoom: number;
  offset_x_pct: number;
  offset_y_pct: number;
  rotate_deg: number;
  background_color: string;
  brightness: number;
  contrast: number;
  feather_radius?: number;
}

export interface PDFGenerateRequest {
  session_id: string;
  doc_id: string;
  paper_size: string;
  include_crop_marks: boolean;
  margin_mm: number;
  spacing_mm: number;
  copies?: number;
  background_color?: string;
}
