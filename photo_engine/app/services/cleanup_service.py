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


def purge_expired_sessions(session_store: dict, max_age_seconds: int = 900):
    """Purge in-memory sessions that have exceeded the TTL."""
    now = time.time()
    expired_keys = [
        k for k, v in session_store.items()
        if (now - v.get("created_at", 0)) > max_age_seconds
    ]
    for k in expired_keys:
        session_store.pop(k, None)
    return len(expired_keys)

