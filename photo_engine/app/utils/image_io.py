import io
import base64
from typing import Tuple, Union
import numpy as np
from PIL import Image, ImageOps, ExifTags
import cv2

def load_image_from_bytes(data: bytes) -> Image.Image:
    """Load image from raw bytes with proper EXIF orientation handling."""
    img = Image.open(io.BytesIO(data))
    # Fix orientation based on EXIF tag if present
    try:
        img = ImageOps.exif_transpose(img)
    except Exception:
        pass
    return img.convert("RGB")

def pil_to_cv2(pil_img: Image.Image) -> np.ndarray:
    """Convert PIL RGB/RGBA to OpenCV BGR/BGRA numpy array."""
    np_img = np.array(pil_img)
    if len(np_img.shape) == 2: # Grayscale
        return cv2.cvtColor(np_img, cv2.COLOR_GRAY2BGR)
    elif np_img.shape[2] == 4: # RGBA
        return cv2.cvtColor(np_img, cv2.COLOR_RGBA2BGRA)
    elif np_img.shape[2] == 3: # RGB
        return cv2.cvtColor(np_img, cv2.COLOR_RGB2BGR)
    return np_img

def cv2_to_pil(cv_img: np.ndarray) -> Image.Image:
    """Convert OpenCV BGR/BGRA to PIL RGB/RGBA Image."""
    if len(cv_img.shape) == 2:
        return Image.fromarray(cv_img)
    elif cv_img.shape[2] == 4:
        return Image.fromarray(cv2.cvtColor(cv_img, cv2.COLOR_BGRA2RGBA))
    elif cv_img.shape[2] == 3:
        return Image.fromarray(cv2.cvtColor(cv_img, cv2.COLOR_BGR2RGB))
    return Image.fromarray(cv_img)

def image_to_base64_data_url(img: Union[Image.Image, np.ndarray], format: str = "JPEG", quality: int = 95) -> str:
    """Convert PIL Image or numpy array to data URL (e.g. data:image/jpeg;base64,...)."""
    if isinstance(img, np.ndarray):
        img = cv2_to_pil(img)
    
    buffer = io.BytesIO()
    if format.upper() == "PNG" or (img.mode == "RGBA"):
        img.save(buffer, format="PNG", optimize=True)
        mime = "image/png"
    else:
        if img.mode != "RGB":
            img = img.convert("RGB")
        img.save(buffer, format="JPEG", quality=quality, dpi=(300, 300))
        mime = "image/jpeg"
        
    encoded = base64.b64encode(buffer.getvalue()).decode("utf-8")
    return f"data:{mime};base64,{encoded}"

def hex_to_rgb(hex_color: str) -> Tuple[int, int, int]:
    """Convert #RRGGBB or #RGB string to (R, G, B) integer tuple (0-255)."""
    hex_color = hex_color.lstrip("#")
    if len(hex_color) == 3:
        hex_color = "".join([c*2 for c in hex_color])
    if len(hex_color) != 6:
        return (255, 255, 255)
    return tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))

def hex_to_bgr(hex_color: str) -> Tuple[int, int, int]:
    """Convert #RRGGBB to (B, G, R) for OpenCV."""
    r, g, b = hex_to_rgb(hex_color)
    return (b, g, r)
