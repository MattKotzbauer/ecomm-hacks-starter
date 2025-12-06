"""Simple image storage - saves generated images to disk."""

import base64
import uuid
from datetime import datetime
from pathlib import Path

from app.services.logging_config import get_logger

logger = get_logger(__name__)

# Storage directory
DATA_DIR = Path(__file__).parent.parent.parent / "data" / "generated"
DATA_DIR.mkdir(parents=True, exist_ok=True)


def save_generated_image(
    image_base64: str,
    mime_type: str = "image/png",
    prompt: str | None = None
) -> str:
    """Save a base64 image to disk.

    Args:
        image_base64: Base64-encoded image data (no data: prefix)
        mime_type: MIME type to determine extension
        prompt: Optional prompt for logging

    Returns:
        Relative file path from data/generated/
    """
    # Organize by date
    date_dir = DATA_DIR / datetime.now().strftime("%Y-%m-%d")
    date_dir.mkdir(exist_ok=True)

    # Generate filename
    ext = "png" if "png" in mime_type else "jpg" if "jpeg" in mime_type else "webp"
    filename = f"img_{datetime.now().strftime('%H%M%S')}_{uuid.uuid4().hex[:6]}.{ext}"
    filepath = date_dir / filename

    # Decode and save
    image_bytes = base64.b64decode(image_base64)
    filepath.write_bytes(image_bytes)

    # Return relative path
    rel_path = f"{date_dir.name}/{filename}"

    logger.info(
        "image_saved",
        path=rel_path,
        size_bytes=len(image_bytes),
        prompt_preview=prompt[:50] if prompt else None
    )

    return rel_path


def list_saved_images(date: str | None = None) -> list[dict]:
    """List saved images, optionally filtered by date.

    Args:
        date: Date string YYYY-MM-DD, or None for all

    Returns:
        List of {path, date, filename, size_bytes}
    """
    images = []

    if date:
        dirs = [DATA_DIR / date] if (DATA_DIR / date).exists() else []
    else:
        dirs = [d for d in sorted(DATA_DIR.iterdir(), reverse=True) if d.is_dir()]

    for date_dir in dirs:
        if not date_dir.is_dir():
            continue
        for img_path in sorted(date_dir.glob("*.png")) + sorted(date_dir.glob("*.jpg")) + sorted(date_dir.glob("*.webp")):
            images.append({
                "path": f"{date_dir.name}/{img_path.name}",
                "date": date_dir.name,
                "filename": img_path.name,
                "size_bytes": img_path.stat().st_size
            })

    return images


def get_image_path(date: str, filename: str) -> Path | None:
    """Get full path to a saved image.

    Args:
        date: Date string YYYY-MM-DD
        filename: Image filename

    Returns:
        Full Path to image, or None if not found
    """
    filepath = DATA_DIR / date / filename
    if filepath.exists():
        return filepath
    return None
