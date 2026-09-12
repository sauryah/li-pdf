import io
import math
from typing import Tuple, List, Dict, Any, Optional
from PIL import Image, ImageDraw, ImageFont
import numpy as np

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm, inch
from reportlab.pdfgen import canvas
from reportlab.lib import colors
from reportlab.lib.utils import ImageReader

from ..specs.models import DocumentSpec

# 4x6 inch paper size in points
PHOTO_4X6 = (4 * inch, 6 * inch)  # 288 x 432 pt (101.6 x 152.4 mm)

class PDFGenerator:
    @staticmethod
    def generate_sheet_pdf(
        photo_img: Image.Image,
        spec: DocumentSpec,
        paper_size_name: str = "A4",
        include_crop_marks: bool = True,
        margin_mm: float = 10.0,
        spacing_mm: float = 4.0,
        copies: Optional[int] = None
    ) -> bytes:
        """
        Generate millimeter-exact vector PDF containing multiple passport photos
        laid out with crop marks and calibration instructions.
        """
        buffer = io.BytesIO()
        
        # Determine page size in points (1 pt = 1/72 inch, 1 mm = 72/25.4 pt)
        if paper_size_name.upper() in ["4X6", "4_6", "4R"]:
            page_w_pt, page_h_pt = 4 * inch, 6 * inch
            paper_label = "4 x 6 inch (10 x 15 cm)"
        else: # Default A4
            page_w_pt, page_h_pt = A4
            paper_label = "A4 (210 x 297 mm)"

        # Physical photo dimensions in points
        photo_w_pt = (spec.width_mm / 25.4) * 72.0
        photo_h_pt = (spec.height_mm / 25.4) * 72.0
        
        margin_pt = (margin_mm / 25.4) * 72.0
        spacing_pt = (spacing_mm / 25.4) * 72.0
        
        # Header/Footer reserved height
        header_height_pt = 36.0
        footer_height_pt = 24.0

        # Printable area available for photos
        available_w_pt = page_w_pt - (2 * margin_pt)
        available_h_pt = page_h_pt - (2 * margin_pt) - header_height_pt - footer_height_pt

        # Compute max columns and rows that fit
        cols = max(1, int((available_w_pt + spacing_pt) // (photo_w_pt + spacing_pt)))
        rows = max(1, int((available_h_pt + spacing_pt) // (photo_h_pt + spacing_pt)))
        
        max_possible = cols * rows
        total_photos = min(copies, max_possible) if copies else max_possible

        # Compute total grid dimensions to center on the page
        grid_w_pt = (cols * photo_w_pt) + ((cols - 1) * spacing_pt)
        grid_h_pt = (rows * photo_h_pt) + ((rows - 1) * spacing_pt)
        
        start_x_pt = (page_w_pt - grid_w_pt) / 2.0
        start_y_pt = margin_pt + footer_height_pt + ((available_h_pt - grid_h_pt) / 2.0)

        # Prepare canvas
        c = canvas.Canvas(buffer, pagesize=(page_w_pt, page_h_pt))
        c.setTitle(f"{spec.name} Print Sheet - PhotoReady")
        c.setAuthor("PhotoReady AI Passport Maker")

        # Top Header Banner
        c.setFont("Helvetica-Bold", 10)
        c.setFillColor(colors.HexColor("#1E293B"))
        c.drawCentredString(page_w_pt / 2.0, page_h_pt - margin_pt - 10, f"PHOTOREADY — {spec.name.upper()} PRINT SHEET")
        
        c.setFont("Helvetica", 7.5)
        c.setFillColor(colors.HexColor("#64748B"))
        c.drawCentredString(page_w_pt / 2.0, page_h_pt - margin_pt - 22, 
            f"Paper: {paper_label} | Photo Size: {spec.width_mm} × {spec.height_mm} mm | Resolution: {spec.dpi} DPI | Copies: {total_photos}")

        # Convert PIL image to ReportLab ImageReader
        img_buffer = io.BytesIO()
        photo_rgb = photo_img.convert("RGB")
        photo_rgb.save(img_buffer, format="JPEG", quality=98, dpi=(spec.dpi, spec.dpi))
        img_buffer.seek(0)
        img_reader = ImageReader(img_buffer)

        # Draw grid of photos
        placed = 0
        for r in range(rows):
            for col in range(cols):
                if placed >= total_photos:
                    break
                
                # Coordinate calculation: ReportLab origin (0,0) is bottom-left
                # We place from top row downwards
                x = start_x_pt + col * (photo_w_pt + spacing_pt)
                y = start_y_pt + (rows - 1 - r) * (photo_h_pt + spacing_pt)

                # Draw photo image
                c.drawImage(img_reader, x, y, width=photo_w_pt, height=photo_h_pt)

                # Draw cut marks if requested
                if include_crop_marks:
                    c.setStrokeColor(colors.HexColor("#94A3B8"))
                    c.setLineWidth(0.4)
                    c.setDash([2, 2], 0) # subtle dashed border
                    c.rect(x, y, photo_w_pt, photo_h_pt, stroke=1, fill=0)
                    
                    # Corner tick marks extending outwards
                    tick_len = 3.0
                    c.setDash([], 0)
                    c.setStrokeColor(colors.HexColor("#475569"))
                    c.setLineWidth(0.5)
                    # Top-left
                    c.line(x - tick_len, y + photo_h_pt, x, y + photo_h_pt)
                    c.line(x, y + photo_h_pt + tick_len, x, y + photo_h_pt)
                    # Top-right
                    c.line(x + photo_w_pt, y + photo_h_pt, x + photo_w_pt + tick_len, y + photo_h_pt)
                    c.line(x + photo_w_pt, y + photo_h_pt + tick_len, x + photo_w_pt, y + photo_h_pt)
                    # Bottom-left
                    c.line(x - tick_len, y, x, y)
                    c.line(x, y - tick_len, x, y)
                    # Bottom-right
                    c.line(x + photo_w_pt, y, x + photo_w_pt + tick_len, y)
                    c.line(x + photo_w_pt, y - tick_len, x + photo_w_pt, y)

                placed += 1

        # Bottom Footer Printing Instructions
        c.setFont("Helvetica-Bold", 8)
        c.setFillColor(colors.HexColor("#DC2626"))  # Red highlight for print setting
        c.drawCentredString(page_w_pt / 2.0, margin_pt + 12, "⚠️ CRITICAL PRINT SETTING: Print at 100% / Actual Size. Do NOT select 'Fit to Page' or 'Scale'.")
        
        c.setFont("Helvetica", 7)
        c.setFillColor(colors.HexColor("#94A3B8"))
        c.drawCentredString(page_w_pt / 2.0, margin_pt + 2, "Generated securely with PhotoReady. Ensure high quality glossy/matte photo paper is used.")

        c.showPage()
        c.save()
        
        buffer.seek(0)
        return buffer.getvalue()

    @staticmethod
    def generate_composite_image(
        photo_img: Image.Image,
        spec: DocumentSpec,
        paper_size_name: str = "A4",
        include_crop_marks: bool = True,
        margin_mm: float = 10.0,
        spacing_mm: float = 4.0
    ) -> Image.Image:
        """
        Generate a 300 DPI composite raster image of the print sheet (ideal for photo kiosk JPG prints).
        """
        dpi = spec.dpi
        if paper_size_name.upper() in ["4X6", "4_6", "4R"]:
            sheet_w_px = int(round(4.0 * dpi))  # 1200 px
            sheet_h_px = int(round(6.0 * dpi))  # 1800 px
        else: # A4
            sheet_w_px = int(round((210.0 / 25.4) * dpi)) # 2480 px
            sheet_h_px = int(round((297.0 / 25.4) * dpi)) # 3508 px

        canvas_img = Image.new("RGB", (sheet_w_px, sheet_h_px), (255, 255, 255))
        draw = ImageDraw.Draw(canvas_img)

        photo_w_px = spec.target_width_px
        photo_h_px = spec.target_height_px
        
        margin_px = int(round((margin_mm / 25.4) * dpi))
        spacing_px = int(round((spacing_mm / 25.4) * dpi))
        header_px = int(round((15.0 / 25.4) * dpi))
        footer_px = int(round((12.0 / 25.4) * dpi))

        avail_w = sheet_w_px - (2 * margin_px)
        avail_h = sheet_h_px - (2 * margin_px) - header_px - footer_px

        cols = max(1, (avail_w + spacing_px) // (photo_w_px + spacing_px))
        rows = max(1, (avail_h + spacing_px) // (photo_h_px + spacing_px))

        grid_w = (cols * photo_w_px) + ((cols - 1) * spacing_px)
        grid_h = (rows * photo_h_px) + ((rows - 1) * spacing_px)

        start_x = (sheet_w_px - grid_w) // 2
        start_y = margin_px + header_px + ((avail_h - grid_h) // 2)

        for r in range(rows):
            for c in range(cols):
                x = start_x + c * (photo_w_px + spacing_px)
                y = start_y + r * (photo_h_px + spacing_px)
                canvas_img.paste(photo_img.convert("RGB"), (x, y))

                if include_crop_marks:
                    # Draw cutting border
                    draw.rectangle([x, y, x + photo_w_px, y + photo_h_px], outline=(200, 200, 200), width=1)

        return canvas_img
