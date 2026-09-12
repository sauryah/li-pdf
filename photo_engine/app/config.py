import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
TEMP_DIR = BASE_DIR / "temp_storage"
TEMP_DIR.mkdir(parents=True, exist_ok=True)

# Cleanup settings
TEMP_FILE_MAX_AGE_SECONDS = 15 * 60  # 15 minutes
CLEANUP_INTERVAL_SECONDS = 5 * 60    # 5 minutes

# Default processing settings
DEFAULT_DPI = 300
MAX_UPLOAD_SIZE_BYTES = 20 * 1024 * 1024  # 20 MB
ALLOWED_MIME_TYPES = {
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "image/heic",
    "image/heif",
}
