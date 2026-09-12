from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field

class DocumentSpec(BaseModel):
    id: str
    country: str
    country_code: str
    name: str
    category: str  # 'passport', 'visa', 'id', 'custom'
    width_mm: float
    height_mm: float
    dpi: int = 300
    face_coverage_min_pct: float  # e.g., 0.70 (70% of photo height)
    face_coverage_max_pct: float  # e.g., 0.80 (80% of photo height)
    crown_to_top_margin_pct: float = 0.08  # Head margin from top (fraction of photo height)
    eye_level_from_bottom_min_pct: Optional[float] = 0.50
    eye_level_from_bottom_max_pct: Optional[float] = 0.70
    default_background_color: str = "#FFFFFF"
    allowed_background_colors: List[str] = ["#FFFFFF", "#F3F4F6", "#E5E7EB", "#D1D5DB", "#3B82F6", "#1E3A8A"]
    description: str
    notes: Optional[str] = None
    guidelines_url: Optional[str] = None

    @property
    def target_width_px(self) -> int:
        return int(round((self.width_mm / 25.4) * self.dpi))

    @property
    def target_height_px(self) -> int:
        return int(round((self.height_mm / 25.4) * self.dpi))


class ComplianceCheckItem(BaseModel):
    id: str
    title: str
    passed: bool
    status: str  # 'pass', 'warn', 'fail'
    message: str
    details: Optional[Dict[str, Any]] = None


class ComplianceReport(BaseModel):
    overall_compliant: bool
    items: List[ComplianceCheckItem]
    face_count: int
    sharpness_score: float
    tilt_angle_deg: float
    head_ratio_pct: float
    warnings: List[str] = []


class FaceLandmarksData(BaseModel):
    has_face: bool
    face_count: int
    bounding_box: Optional[List[float]] = None  # [x_min, y_min, x_max, y_max] in normalized coords (0-1)
    chin_point: Optional[List[float]] = None     # [x, y]
    crown_point: Optional[List[float]] = None    # [x, y] estimated
    left_eye: Optional[List[float]] = None       # [x, y]
    right_eye: Optional[List[float]] = None      # [x, y]
    nose_tip: Optional[List[float]] = None       # [x, y]
    tilt_angle_deg: float = 0.0


class ProcessResponse(BaseModel):
    session_id: str
    spec: DocumentSpec
    original_image_url: str
    processed_image_url: str
    preview_data_url: str  # Base64 data URL for instant rendering
    cutout_data_url: Optional[str] = None  # Transparent background subject
    dimensions: Dict[str, Any]  # width_mm, height_mm, width_px, height_px, dpi
    compliance: ComplianceReport
    landmarks: Optional[FaceLandmarksData] = None


class AdjustRequest(BaseModel):
    session_id: str
    doc_id: str
    zoom: float = 1.0          # 0.5 to 2.5
    offset_x_pct: float = 0.0  # -0.5 to +0.5 fraction of width
    offset_y_pct: float = 0.0  # -0.5 to +0.5 fraction of height
    rotate_deg: float = 0.0    # -45 to +45 deg
    background_color: str = "#FFFFFF"
    brightness: float = 0.0    # -50 to +50
    contrast: float = 0.0      # -50 to +50
    feather_radius: int = 1    # edge feathering


class PDFGenerateRequest(BaseModel):
    session_id: str
    doc_id: str
    paper_size: str = "A4"     # 'A4' (210x297mm) or '4x6' (101.6x152.4mm)
    include_crop_marks: bool = True
    margin_mm: float = 10.0
    spacing_mm: float = 4.0
    copies: Optional[int] = None # None = fill optimal grid
    background_color: Optional[str] = None
