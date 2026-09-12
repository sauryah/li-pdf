import math
from typing import Tuple, Optional
from PIL import Image, ImageOps
import numpy as np
from ..specs.models import DocumentSpec, FaceLandmarksData

class CropEngine:
    @staticmethod
    def calculate_and_crop(
        image: Image.Image,
        landmarks: FaceLandmarksData,
        spec: DocumentSpec,
        zoom: float = 1.0,
        offset_x_pct: float = 0.0,
        offset_y_pct: float = 0.0,
        rotate_deg: float = 0.0,
        auto_straighten: bool = True
    ) -> Image.Image:
        """
        Calculate precision document crop according to official specification requirements
        and optional manual user adjustments.
        """
        src_img = image.copy()
        src_w, src_h = src_img.size

        # Apply rotation if specified or auto-straighten tilt
        effective_rotation = rotate_deg
        if effective_rotation == 0.0 and auto_straighten and landmarks.has_face:
            # Auto-straighten if tilt is moderate (-15 to 15 deg)
            if abs(landmarks.tilt_angle_deg) > 0.8 and abs(landmarks.tilt_angle_deg) < 20.0:
                effective_rotation = -landmarks.tilt_angle_deg

        if abs(effective_rotation) > 0.01:
            # Rotate with transparent/expanded background or clamp
            src_img = src_img.rotate(effective_rotation, resample=Image.Resampling.BICUBIC, expand=False)

        target_w = spec.target_width_px
        target_h = spec.target_height_px

        # Default fallback if no face detected: centered crop
        if not landmarks.has_face or landmarks.chin_point is None or landmarks.crown_point is None:
            # Aspect ratio crop centered
            target_aspect = target_w / target_h
            src_aspect = src_w / src_h
            
            if src_aspect > target_aspect:
                crop_h = src_h / zoom
                crop_w = crop_h * target_aspect
            else:
                crop_w = src_w / zoom
                crop_h = crop_w / target_aspect
                
            center_x = src_w / 2.0 + (offset_x_pct * src_w)
            center_y = src_h / 2.0 + (offset_y_pct * src_h)
            
            left = center_x - crop_w / 2.0
            top = center_y - crop_h / 2.0
            right = left + crop_w
            bottom = top + crop_h
            
            cropped = src_img.crop((left, top, right, bottom))
            return cropped.resize((target_w, target_h), Image.Resampling.LANCZOS)

        # We have face landmarks
        chin_y_px = landmarks.chin_point[1] * src_h
        crown_y_px = landmarks.crown_point[1] * src_h
        head_x_px = ((landmarks.crown_point[0] + landmarks.chin_point[0]) / 2.0) * src_w

        head_h_src_px = max(chin_y_px - crown_y_px, 50.0)

        # Target head height in output pixels: midpoint of official min and max
        target_face_ratio = (spec.face_coverage_min_pct + spec.face_coverage_max_pct) / 2.0
        target_head_h_px = target_h * target_face_ratio

        # Base scale to achieve exact compliant head size
        base_scale = target_head_h_px / head_h_src_px
        scale = base_scale * zoom

        # Crown position from top of target photo
        target_crown_y_px = target_h * spec.crown_to_top_margin_pct

        # Dimensions of crop rectangle in source coordinate space
        crop_w = target_w / scale
        crop_h = target_h / scale

        # Source coordinates for the crop rectangle
        left = head_x_px - (crop_w / 2.0) + (offset_x_pct * crop_w)
        top = crown_y_px - (target_crown_y_px / scale) + (offset_y_pct * crop_h)
        right = left + crop_w
        bottom = top + crop_h

        # If crop exceeds bounds, pad image with replicate/edge or solid background
        pad_left = max(0, int(-left))
        pad_top = max(0, int(-top))
        pad_right = max(0, int(right - src_w))
        pad_bottom = max(0, int(bottom - src_h))

        if pad_left > 0 or pad_top > 0 or pad_right > 0 or pad_bottom > 0:
            # Pad source image
            padded_img = ImageOps.expand(src_img, border=(pad_left, pad_top, pad_right, pad_bottom), fill=0)
            crop_left = left + pad_left
            crop_top = top + pad_top
            crop_right = right + pad_left
            crop_bottom = bottom + pad_top
            cropped = padded_img.crop((crop_left, crop_top, crop_right, crop_bottom))
        else:
            cropped = src_img.crop((left, top, right, bottom))

        # Final resize to exact physical target dimensions at specified DPI
        return cropped.resize((target_w, target_h), Image.Resampling.LANCZOS)
