import numpy as np
import cv2
from PIL import Image, ImageFilter
from typing import Tuple, Optional
from ..utils.image_io import pil_to_cv2, cv2_to_pil

try:
    import mediapipe as mp
    mp_selfie_segmentation = mp.solutions.selfie_segmentation
    SEGMENTATION_AVAILABLE = True
except Exception:
    SEGMENTATION_AVAILABLE = False


class PortraitSegmenter:
    def __init__(self):
        self._segmenter = None
        if SEGMENTATION_AVAILABLE:
            try:
                # model_selection=1 is general model with higher accuracy
                self._segmenter = mp_selfie_segmentation.SelfieSegmentation(model_selection=1)
            except Exception:
                pass

    def segment_portrait(self, image: Image.Image, threshold: float = 0.5, feather_radius: int = 2) -> Image.Image:
        """
        Segment subject from background and return RGBA Image with transparent background.
        """
        img_rgb = np.array(image.convert("RGB"))
        h, w, _ = img_rgb.shape

        mask = None

        if SEGMENTATION_AVAILABLE and self._segmenter is not None:
            try:
                results = self._segmenter.process(img_rgb)
                if results.segmentation_mask is not None:
                    raw_mask = results.segmentation_mask
                    # Create soft alpha matte from float confidence mask (0.0 to 1.0)
                    # Use smoothstep / sigmoid transition around threshold for natural hair edges
                    soft_mask = np.clip((raw_mask - (threshold - 0.2)) / 0.4, 0.0, 1.0)
                    mask = (soft_mask * 255).astype(np.uint8)
            except Exception:
                pass

        # Fallback segmentation using GrabCut if MediaPipe segmentation is not active
        if mask is None:
            mask = np.zeros((h, w), dtype=np.uint8)
            bgd_model = np.zeros((1, 65), np.float64)
            fgd_model = np.zeros((1, 65), np.float64)
            
            # Center region assumption for portrait
            margin_x = int(w * 0.10)
            margin_y = int(h * 0.05)
            rect = (margin_x, margin_y, w - 2 * margin_x, h - margin_y)
            
            img_bgr = cv2.cvtColor(img_rgb, cv2.COLOR_RGB2BGR)
            cv2.grabCut(img_bgr, mask, rect, bgd_model, fgd_model, 4, cv2.GC_INIT_WITH_RECT)
            mask = np.where((mask == cv2.GC_FGD) | (mask == cv2.GC_PR_FGD), 255, 0).astype(np.uint8)

        # Apply subtle Gaussian blur to alpha mask for anti-aliased edge blending
        if feather_radius > 0:
            blur_size = feather_radius * 2 + 1
            mask = cv2.GaussianBlur(mask, (blur_size, blur_size), 0)

        # Build RGBA image
        rgba = np.dstack((img_rgb, mask))
        return Image.fromarray(rgba, mode="RGBA")

    def composite_on_color(self, rgba_image: Image.Image, bg_rgb: Tuple[int, int, int]) -> Image.Image:
        """
        Composite an RGBA cutout onto a solid background color with clean anti-aliased edges.
        """
        if rgba_image.mode != "RGBA":
            return rgba_image.convert("RGB")
        
        # Create solid color background
        bg_canvas = Image.new("RGBA", rgba_image.size, bg_rgb + (255,))
        # Alpha composite
        composite = Image.alpha_composite(bg_canvas, rgba_image)
        return composite.convert("RGB")


segmenter_instance = PortraitSegmenter()

def get_segmenter() -> PortraitSegmenter:
    return segmenter_instance
