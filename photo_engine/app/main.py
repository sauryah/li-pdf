import uuid
import io
import time
from contextlib import asynccontextmanager
from typing import Optional
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response, JSONResponse, StreamingResponse
from PIL import Image

from .config import (
    TEMP_DIR,
    MAX_UPLOAD_SIZE_BYTES,
    ALLOWED_MIME_TYPES,
    SESSION_TTL_SECONDS,
    CORS_ORIGINS
)
from .specs.document_specs import list_all_specs, get_spec, SPECS_DATABASE
from .specs.models import (
    ProcessResponse,
    AdjustRequest,
    PDFGenerateRequest,
    FaceLandmarksData
)
from .utils.image_io import (
    load_image_from_bytes,
    image_to_base64_data_url,
    hex_to_rgb
)
from .services.face_detector import get_face_detector
from .services.segmenter import get_segmenter
from .services.crop_engine import CropEngine
from .services.image_enhancer import ImageEnhancer
from .services.validator import ComplianceValidator
from .services.pdf_generator import PDFGenerator
from .services.cleanup_service import purge_expired_temp_files, purge_expired_sessions

# In-memory session store (with TTL eviction)
# Stores: session_id -> {
#   'original': PIL.Image,
#   'cutout': PIL.Image (RGBA),
#   'landmarks': FaceLandmarksData,
#   'processed': PIL.Image,
#   'spec_id': str,
#   'created_at': float
# }
SESSION_STORE = {}

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: purge any stale temp files & sessions
    purge_expired_temp_files()
    purge_expired_sessions(SESSION_STORE, SESSION_TTL_SECONDS)
    yield
    # Shutdown: clean up session memory
    SESSION_STORE.clear()

app = FastAPI(
    title="PhotoReady API",
    description="AI-powered Passport & ID Photo Processing API",
    version="1.0.0",
    lifespan=lifespan
)

# Enable CORS for Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS if CORS_ORIGINS else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health_check():
    return {"status": "ok", "service": "PhotoReady API", "version": "1.0.0"}

@app.get("/api/specs")
def get_all_document_specs():
    """Return all available document specifications."""
    return {"specs": list_all_specs()}

@app.get("/api/specs/{doc_id}")
def get_document_spec_by_id(doc_id: str):
    spec = get_spec(doc_id)
    if not spec:
        raise HTTPException(status_code=404, detail=f"Document spec '{doc_id}' not found.")
    return spec

@app.post("/api/process", response_model=ProcessResponse)
async def process_photo(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    doc_id: str = Form("in_passport"),
    bg_color: Optional[str] = Form(None),
):
    """
    Primary processing endpoint:
    1. Validate & load image.
    2. Detect face landmarks & orientation.
    3. Segment portrait (isolate subject).
    4. Apply document-compliant crop.
    5. Apply background color.
    6. Run compliance validation.
    7. Return preview Data URLs & session ID.
    """
    background_tasks.add_task(purge_expired_temp_files)
    background_tasks.add_task(purge_expired_sessions, SESSION_STORE, SESSION_TTL_SECONDS)
    
    spec = get_spec(doc_id)
    if not spec:
        spec = SPECS_DATABASE["in_passport"]

    # Read image contents
    contents = await file.read()
    if len(contents) > MAX_UPLOAD_SIZE_BYTES:
        raise HTTPException(status_code=400, detail="File size exceeds maximum allowed 20 MB.")

    try:
        original_img = load_image_from_bytes(contents)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid image format: {str(e)}")

    # 1. Face & Landmark Detection
    detector = get_face_detector()
    landmarks = detector.detect_landmarks(original_img)

    # 2. Portrait Matting / Segmentation
    segmenter = get_segmenter()
    cutout_rgba = segmenter.segment_portrait(original_img)

    # 3. Crop Engine
    # We crop the cutout (RGBA) so we can place it on any background seamlessly
    cropped_cutout = CropEngine.calculate_and_crop(
        image=cutout_rgba,
        landmarks=landmarks,
        spec=spec,
        auto_straighten=True
    )

    # 4. Background color replacement
    chosen_bg = bg_color or spec.default_background_color
    final_processed = ImageEnhancer.apply_background(cropped_cutout, chosen_bg)

    # 5. Compliance Validation
    compliance_report = ComplianceValidator.validate(
        original_img=original_img,
        cropped_img=final_processed,
        landmarks=landmarks,
        spec=spec
    )

    # Generate Session ID and store in session state
    session_id = str(uuid.uuid4())
    SESSION_STORE[session_id] = {
        "original": original_img,
        "cutout": cutout_rgba,
        "landmarks": landmarks,
        "processed": final_processed,
        "spec_id": spec.id,
        "bg_color": chosen_bg,
        "created_at": time.time()
    }

    # Prepare response previews
    preview_url = image_to_base64_data_url(final_processed, format="JPEG", quality=92)
    original_url = image_to_base64_data_url(original_img, format="JPEG", quality=80)
    cutout_url = image_to_base64_data_url(cropped_cutout, format="PNG")

    return ProcessResponse(
        session_id=session_id,
        spec=spec,
        original_image_url=original_url,
        processed_image_url=preview_url,
        preview_data_url=preview_url,
        cutout_data_url=cutout_url,
        dimensions={
            "width_mm": spec.width_mm,
            "height_mm": spec.height_mm,
            "width_px": spec.target_width_px,
            "height_px": spec.target_height_px,
            "dpi": spec.dpi
        },
        compliance=compliance_report,
        landmarks=landmarks
    )

@app.post("/api/adjust", response_model=ProcessResponse)
async def adjust_photo(req: AdjustRequest):
    """
    Manual adjustments endpoint:
    Applies user-specified zoom, pan offset X/Y, rotation, brightness, contrast,
    and background color in real time.
    """
    session = SESSION_STORE.get(req.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session expired or not found. Please re-upload.")

    spec = get_spec(req.doc_id) or SPECS_DATABASE["in_passport"]
    cutout_rgba: Image.Image = session["cutout"]
    landmarks: FaceLandmarksData = session["landmarks"]
    original_img: Image.Image = session["original"]

    # 1. Re-crop with manual parameters
    cropped_cutout = CropEngine.calculate_and_crop(
        image=cutout_rgba,
        landmarks=landmarks,
        spec=spec,
        zoom=req.zoom,
        offset_x_pct=req.offset_x_pct,
        offset_y_pct=req.offset_y_pct,
        rotate_deg=req.rotate_deg,
        auto_straighten=False
    )

    # 2. Apply background color
    composited = ImageEnhancer.apply_background(cropped_cutout, req.background_color)

    # 3. Apply brightness & contrast
    final_processed = ImageEnhancer.adjust_brightness_contrast(
        composited,
        brightness=req.brightness,
        contrast=req.contrast
    )

    # 4. Re-run compliance validation
    compliance_report = ComplianceValidator.validate(
        original_img=original_img,
        cropped_img=final_processed,
        landmarks=landmarks,
        spec=spec
    )

    # Update session cache
    session["processed"] = final_processed
    session["spec_id"] = spec.id
    session["bg_color"] = req.background_color

    preview_url = image_to_base64_data_url(final_processed, format="JPEG", quality=92)
    cutout_url = image_to_base64_data_url(cropped_cutout, format="PNG")
    original_url = image_to_base64_data_url(original_img, format="JPEG", quality=80)

    return ProcessResponse(
        session_id=req.session_id,
        spec=spec,
        original_image_url=original_url,
        processed_image_url=preview_url,
        preview_data_url=preview_url,
        cutout_data_url=cutout_url,
        dimensions={
            "width_mm": spec.width_mm,
            "height_mm": spec.height_mm,
            "width_px": spec.target_width_px,
            "height_px": spec.target_height_px,
            "dpi": spec.dpi
        },
        compliance=compliance_report,
        landmarks=landmarks
    )

@app.post("/api/generate-pdf")
async def generate_pdf(req: PDFGenerateRequest):
    """
    Generate print-ready millimeter-exact A4 or 4x6 PDF.
    """
    session = SESSION_STORE.get(req.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session expired or not found. Please re-upload.")

    spec = get_spec(req.doc_id) or SPECS_DATABASE["in_passport"]
    photo_img: Image.Image = session["processed"]

    pdf_bytes = PDFGenerator.generate_sheet_pdf(
        photo_img=photo_img,
        spec=spec,
        paper_size_name=req.paper_size,
        include_crop_marks=req.include_crop_marks,
        margin_mm=req.margin_mm,
        spacing_mm=req.spacing_mm,
        copies=req.copies
    )

    filename = f"{spec.id}_{req.paper_size.lower()}_print_sheet.pdf"
    
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"'
        }
    )

@app.post("/api/generate-sheet-image")
async def generate_sheet_image(req: PDFGenerateRequest):
    """
    Generate high-resolution 300 DPI composite JPEG of the print sheet (for photo printers / kiosks).
    """
    session = SESSION_STORE.get(req.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session expired or not found.")

    spec = get_spec(req.doc_id) or SPECS_DATABASE["in_passport"]
    photo_img: Image.Image = session["processed"]

    composite = PDFGenerator.generate_composite_image(
        photo_img=photo_img,
        spec=spec,
        paper_size_name=req.paper_size,
        include_crop_marks=req.include_crop_marks,
        margin_mm=req.margin_mm,
        spacing_mm=req.spacing_mm
    )

    buffer = io.BytesIO()
    composite.save(buffer, format="JPEG", quality=95, dpi=(spec.dpi, spec.dpi))
    buffer.seek(0)

    filename = f"{spec.id}_{req.paper_size.lower()}_sheet.jpg"
    return StreamingResponse(
        buffer,
        media_type="image/jpeg",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"'
        }
    )

@app.get("/api/download-single/{session_id}")
async def download_single_photo(session_id: str, format: str = "jpg"):
    """
    Download single passport photo at exact physical DPI.
    """
    clean_fmt = format.lower().strip()
    if clean_fmt not in ("jpg", "jpeg", "png"):
        raise HTTPException(status_code=400, detail="Invalid format. Allowed formats: jpg, jpeg, png")

    session = SESSION_STORE.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session expired or not found.")

    photo: Image.Image = session["processed"]
    spec_id = session.get("spec_id", "passport")

    buffer = io.BytesIO()
    if clean_fmt == "png":
        photo.save(buffer, format="PNG", dpi=(300, 300))
        mime = "image/png"
        ext = "png"
    else:
        photo.convert("RGB").save(buffer, format="JPEG", quality=98, dpi=(300, 300))
        mime = "image/jpeg"
        ext = "jpg"

    buffer.seek(0)
    filename = f"{spec_id}_photo_300dpi.{ext}"
    return StreamingResponse(
        buffer,
        media_type=mime,
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"'
        }
    )

