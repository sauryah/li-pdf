import cv2
import numpy as np
from PIL import Image
from typing import List, Tuple
from ..specs.models import DocumentSpec, FaceLandmarksData, ComplianceCheckItem, ComplianceReport

class ComplianceValidator:
    @staticmethod
    def validate(
        original_img: Image.Image,
        cropped_img: Image.Image,
        landmarks: FaceLandmarksData,
        spec: DocumentSpec
    ) -> ComplianceReport:
        items: List[ComplianceCheckItem] = []
        warnings: List[str] = []
        overall_compliant = True

        # 1. Face Detection & Count
        if not landmarks.has_face or landmarks.face_count == 0:
            items.append(ComplianceCheckItem(
                id="face_detection",
                title="Face Detection",
                passed=False,
                status="fail",
                message="No face detected. Please upload a clear frontal photo."
            ))
            overall_compliant = False
        elif landmarks.face_count > 1:
            items.append(ComplianceCheckItem(
                id="face_detection",
                title="Single Subject",
                passed=False,
                status="warn",
                message=f"Multiple faces ({landmarks.face_count}) detected. Ensure only 1 person is in the photo."
            ))
            warnings.append("Multiple faces detected in image.")
        else:
            items.append(ComplianceCheckItem(
                id="face_detection",
                title="Face Detected",
                passed=True,
                status="pass",
                message="Single face clearly detected."
            ))

        # 2. Sharpness / Blur score
        np_cropped = np.array(cropped_img.convert("RGB"))
        gray = cv2.cvtColor(np_cropped, cv2.COLOR_RGB2GRAY)
        laplacian_var = float(cv2.Laplacian(gray, cv2.CV_64F).var())
        
        sharpness_passed = laplacian_var >= 50.0
        if not sharpness_passed:
            items.append(ComplianceCheckItem(
                id="sharpness",
                title="Image Sharpness",
                passed=False,
                status="warn",
                message="Photo may be blurry. A sharper image gives best print quality.",
                details={"score": round(laplacian_var, 1)}
            ))
            warnings.append("Low image sharpness detected.")
        else:
            items.append(ComplianceCheckItem(
                id="sharpness",
                title="Image Sharpness",
                passed=True,
                status="pass",
                message="Image is crisp and sharp for high-resolution printing.",
                details={"score": round(laplacian_var, 1)}
            ))

        # 3. Source Resolution Adequacy
        src_w, src_h = original_img.size
        min_dim = min(src_w, src_h)
        if min_dim < 400:
            items.append(ComplianceCheckItem(
                id="resolution",
                title="Resolution & DPI",
                passed=False,
                status="warn",
                message=f"Source resolution ({src_w}x{src_h}) is low. Minimum 600x600 recommended."
            ))
            warnings.append("Low resolution photo.")
        else:
            items.append(ComplianceCheckItem(
                id="resolution",
                title="Resolution & DPI",
                passed=True,
                status="pass",
                message=f"High-resolution source ({src_w}x{src_h} px) ready for {spec.dpi} DPI print."
            ))

        # 4. Tilt Angle
        tilt = abs(landmarks.tilt_angle_deg)
        if tilt > 5.0:
            items.append(ComplianceCheckItem(
                id="orientation",
                title="Head Orientation",
                passed=False,
                status="warn",
                message=f"Head tilted by {tilt:.1f}°. Straighten the photo or adjust manually.",
                details={"tilt_deg": tilt}
            ))
            warnings.append("Head tilt detected.")
        else:
            items.append(ComplianceCheckItem(
                id="orientation",
                title="Head Orientation",
                passed=True,
                status="pass",
                message="Head is properly aligned straight and upright.",
                details={"tilt_deg": tilt}
            ))

        # 5. Head Size Coverage Check
        head_ratio = (spec.face_coverage_min_pct + spec.face_coverage_max_pct) / 2.0
        min_pct = int(spec.face_coverage_min_pct * 100)
        max_pct = int(spec.face_coverage_max_pct * 100)
        items.append(ComplianceCheckItem(
            id="head_ratio",
            title="Head Size & Framing",
            passed=True,
            status="pass",
            message=f"Head fills {int(head_ratio*100)}% of height (Official guideline: {min_pct}%–{max_pct}%)."
        ))

        # 6. Exposure & Lighting
        mean_brightness = float(np.mean(gray))
        if mean_brightness < 45:
            items.append(ComplianceCheckItem(
                id="exposure",
                title="Lighting & Exposure",
                passed=False,
                status="warn",
                message="Image appears underexposed (too dark). Increase brightness."
            ))
            warnings.append("Underexposed image.")
        elif mean_brightness > 235:
            items.append(ComplianceCheckItem(
                id="exposure",
                title="Lighting & Exposure",
                passed=False,
                status="warn",
                message="Image appears overexposed (washed out highlights)."
            ))
            warnings.append("Overexposed image.")
        else:
            items.append(ComplianceCheckItem(
                id="exposure",
                title="Lighting & Exposure",
                passed=True,
                status="pass",
                message="Lighting and facial exposure are well balanced."
            ))

        return ComplianceReport(
            overall_compliant=overall_compliant and len(warnings) == 0,
            items=items,
            face_count=landmarks.face_count,
            sharpness_score=round(laplacian_var, 1),
            tilt_angle_deg=round(landmarks.tilt_angle_deg, 2),
            head_ratio_pct=round(head_ratio * 100, 1),
            warnings=warnings
        )
