import time
import os
from pathlib import Path
from ..config import TEMP_DIR, TEMP_FILE_MAX_AGE_SECONDS

def purge_expired_temp_files():
    """Remove temporary files older than TEMP_FILE_MAX_AGE_SECONDS."""
    now = time.time()
    if not TEMP_DIR.exists():
        return
    for item in TEMP_DIR.iterdir():
        if item.is_file():
            try:
                mtime = item.stat().st_mtime
                if now - mtime > TEMP_FILE_MAX_AGE_SECONDS:
                    item.unlink(missing_ok=True)
            except Exception:
                pass
