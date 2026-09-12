import numpy as np
import cv2
from PIL import Image, ImageEnhance
from typing import Tuple
from ..utils.image_io import hex_to_rgb

class ImageEnhancer:
    @staticmethod
    def adjust_brightness_contrast(img: Image.Image, brightness: float = 0.0, contrast: float = 0.0) -> Image.Image:
        """
        Adjust brightness and contrast safely without distorting identity.
        brightness: -50.0 to 50.0 -> maps to factor 0.5 to 1.5
        contrast: -50.0 to 50.0   -> maps to factor 0.5 to 1.5
        """
        result = img.copy()
        
        if abs(brightness) > 0.1:
            b_factor = 1.0 + (brightness / 100.0)
            enhancer = ImageEnhance.Brightness(result)
            result = enhancer.enhance(b_factor)
            
        if abs(contrast) > 0.1:
            c_factor = 1.0 + (contrast / 100.0)
            enhancer = ImageEnhance.Contrast(result)
            result = enhancer.enhance(c_factor)
            
        return result

    @staticmethod
    def auto_white_balance(img: Image.Image) -> Image.Image:
        """
        Subtle white balance adjustment using simple gray-world / percentile correction.
        Preserves natural skin tones.
        """
        np_img = np.array(img.convert("RGB"))
        # Check current mean per channel
        r_mean = np.mean(np_img[:, :, 0])
        g_mean = np.mean(np_img[:, :, 1])
        b_mean = np.mean(np_img[:, :, 2])
        
        avg_mean = (r_mean + g_mean + b_mean) / 3.0
        
        # Don't overcorrect; blend 50%
        r_scale = 1.0 + 0.3 * ((avg_mean / max(r_mean, 1.0)) - 1.0)
        g_scale = 1.0 + 0.3 * ((avg_mean / max(g_mean, 1.0)) - 1.0)
        b_scale = 1.0 + 0.3 * ((avg_mean / max(b_mean, 1.0)) - 1.0)
        
        r = np.clip(np_img[:, :, 0] * r_scale, 0, 255).astype(np.uint8)
        g = np.clip(np_img[:, :, 1] * g_scale, 0, 255).astype(np.uint8)
        b = np.clip(np_img[:, :, 2] * b_scale, 0, 255).astype(np.uint8)
        
        return Image.fromarray(np.dstack((r, g, b)))

    @staticmethod
    def apply_background(rgba_img: Image.Image, hex_color: str = "#FFFFFF") -> Image.Image:
        """
        Blend RGBA subject over a solid background color.
        """
        if rgba_img.mode != "RGBA":
            return rgba_img.convert("RGB")
            
        rgb = hex_to_rgb(hex_color)
        bg = Image.new("RGBA", rgba_img.size, rgb + (255,))
        composite = Image.alpha_composite(bg, rgba_img)
        return composite.convert("RGB")
