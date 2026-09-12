import pytest
import io
import numpy as np
from PIL import Image, ImageDraw
from fastapi.testclient import TestClient

from app.main import app
from app.specs.document_specs import list_all_specs, get_spec
from app.services.crop_engine import CropEngine
from app.services.pdf_generator import PDFGenerator
from app.services.validator import ComplianceValidator
from app.specs.models import FaceLandmarksData

client = TestClient(app)

def create_synthetic_portrait(width=800, height=1000) -> Image.Image:
    """Create synthetic test portrait with a simple face shape."""
    img = Image.new("RGB", (width, height), (220, 220, 220))
    draw = ImageDraw.Draw(img)
    # Head circle
    draw.ellipse([250, 200, 550, 600], fill=(240, 200, 170), outline=(100, 100, 100))
    # Eyes
    draw.ellipse([320, 340, 360, 370], fill=(50, 50, 50))
    draw.ellipse([440, 340, 480, 370], fill=(50, 50, 50))
    # Nose
    draw.polygon([(400, 380), (385, 440), (415, 440)], fill=(210, 170, 140))
    # Mouth
    draw.rectangle([360, 480, 440, 500], fill=(180, 80, 80))
    # Shoulders
    draw.polygon([(100, 1000), (250, 650), (550, 650), (700, 1000)], fill=(40, 70, 120))
    return img

def test_document_specs():
    specs = list_all_specs()
    assert len(specs) >= 5
    in_passport = get_spec("in_passport")
    assert in_passport is not None
    assert in_passport.width_mm == 35.0
    assert in_passport.height_mm == 45.0
    assert in_passport.target_width_px == 413
    assert in_passport.target_height_px == 531

def test_crop_engine():
    img = create_synthetic_portrait()
    spec = get_spec("in_passport")
    
    landmarks = FaceLandmarksData(
        has_face=True,
        face_count=1,
        bounding_box=[0.31, 0.20, 0.69, 0.60],
        chin_point=[0.5, 0.60],
        crown_point=[0.5, 0.20],
        left_eye=[0.42, 0.35],
        right_eye=[0.58, 0.35],
        tilt_angle_deg=0.0
    )
    
    cropped = CropEngine.calculate_and_crop(img, landmarks, spec)
    assert cropped.size == (spec.target_width_px, spec.target_height_px)
    assert cropped.size == (413, 531)

def test_pdf_generation():
    img = create_synthetic_portrait(413, 531)
    spec = get_spec("in_passport")
    
    pdf_bytes = PDFGenerator.generate_sheet_pdf(
        photo_img=img,
        spec=spec,
        paper_size_name="A4",
        include_crop_marks=True
    )
    assert len(pdf_bytes) > 1000
    assert pdf_bytes.startswith(b"%PDF-")

def test_api_health():
    res = client.get("/api/health")
    assert res.status_code == 200
    assert res.json()["status"] == "ok"

def test_api_specs():
    res = client.get("/api/specs")
    assert res.status_code == 200
    assert "specs" in res.json()
    assert len(res.json()["specs"]) > 0

def test_api_process_and_adjust():
    img = create_synthetic_portrait()
    buf = io.BytesIO()
    img.save(buf, format="JPEG")
    buf.seek(0)
    
    res = client.post(
        "/api/process",
        files={"file": ("test_portrait.jpg", buf, "image/jpeg")},
        data={"doc_id": "in_passport"}
    )
    assert res.status_code == 200
    data = res.json()
    assert "session_id" in data
    assert "preview_data_url" in data
    assert data["dimensions"]["width_px"] == 413
    assert data["dimensions"]["height_px"] == 531
    
    session_id = data["session_id"]
    
    # Test manual adjustments
    adj_res = client.post(
        "/api/adjust",
        json={
            "session_id": session_id,
            "doc_id": "in_passport",
            "zoom": 1.1,
            "offset_x_pct": 0.02,
            "offset_y_pct": -0.01,
            "rotate_deg": 2.0,
            "background_color": "#FFFFFF",
            "brightness": 5.0,
            "contrast": 10.0
        }
    )
    assert adj_res.status_code == 200
    adj_data = adj_res.json()
    assert adj_data["session_id"] == session_id
    
    # Test PDF generation endpoint
    pdf_res = client.post(
        "/api/generate-pdf",
        json={
            "session_id": session_id,
            "doc_id": "in_passport",
            "paper_size": "A4",
            "include_crop_marks": True
        }
    )
    assert pdf_res.status_code == 200
    assert pdf_res.headers["content-type"] == "application/pdf"
    assert len(pdf_res.content) > 1000

    # Test Single Download Endpoint
    single_res = client.get(f"/api/download-single/{session_id}?format=jpg")
    assert single_res.status_code == 200
    assert single_res.headers["content-type"] == "image/jpeg"
    assert len(single_res.content) > 500

    # Test Invalid Format
    inv_res = client.get(f"/api/download-single/{session_id}?format=invalid_fmt")
    assert inv_res.status_code == 400

def test_session_purge():
    from app.services.cleanup_service import purge_expired_sessions
    import time
    fake_store = {
        "s1": {"created_at": time.time() - 1000},
        "s2": {"created_at": time.time()}
    }
    purged = purge_expired_sessions(fake_store, max_age_seconds=500)
    assert purged == 1
    assert "s1" not in fake_store
    assert "s2" in fake_store

