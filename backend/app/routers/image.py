"""Image generation router for Nano Banana endpoints."""

import base64
import time
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import FileResponse

from app.models.image import (
    GeneratedImage,
    ImageEditRequest,
    ImageGenerateRequest,
    ImageResponse,
)
from app.services.gemini import GeminiService
from app.services.generation_store import save_generation, list_generation_logs, get_image_path
from app.services.logging_config import get_logger

logger = get_logger(__name__)

router = APIRouter(prefix="/api/image", tags=["image"])


def get_gemini_service(request: Request) -> GeminiService:
    """Dependency to get Gemini service from app state."""
    service = request.app.state.gemini_service
    if not service:
        raise HTTPException(status_code=503, detail="Gemini service not initialized")
    return service


@router.post("/generate", response_model=ImageResponse)
async def generate_image(
    request: ImageGenerateRequest,
    gemini: Annotated[GeminiService, Depends(get_gemini_service)],
):
    """Generate images using Nano Banana (Gemini 3 Pro Image).

    Send a text prompt and receive generated images.
    Images are returned as base64-encoded data.
    """
    start_time = time.time()
    model_name = request.model or "gemini-3-pro-image-preview"
    logger.info(
        "image_generate_started",
        model=model_name,
        prompt_length=len(request.prompt),
    )

    try:
        result = await gemini.generate_image(
            prompt=request.prompt,
            model=model_name,
        )

        # AUTO-SAVE: Save all generated images and log the generation
        save_result = save_generation(
            endpoint="/api/image/generate",
            prompt=request.prompt,
            response_text=result.text,
            images_base64=[{"data": img["data"], "mime_type": img["mime_type"]} for img in result.images],
            metadata={
                "model": result.model,
                "usage": result.usage,
            },
        )

        # Extract saved paths from the result
        saved_paths = [p["path"] if p else None for p in save_result["image_paths"]]

        elapsed = time.time() - start_time
        logger.info(
            "image_generate_completed",
            model=result.model,
            elapsed_seconds=round(elapsed, 3),
            image_count=len(result.images),
            saved_paths=saved_paths,
            generation_id=save_result["generation_id"],
            usage=result.usage,
        )

        return ImageResponse(
            text=result.text,
            images=[
                GeneratedImage(
                    data=img["data"],
                    mime_type=img["mime_type"],
                    file_path=saved_paths[i] if i < len(saved_paths) else None
                )
                for i, img in enumerate(result.images)
            ],
            model=result.model,
            usage=result.usage,
        )

    except Exception as e:
        elapsed = time.time() - start_time
        logger.error(
            "image_generate_failed",
            model=model_name,
            elapsed_seconds=round(elapsed, 3),
            error_type=type(e).__name__,
            error=str(e),
        )
        raise HTTPException(status_code=503, detail=f"Image generation error: {str(e)}")


@router.post("/edit", response_model=ImageResponse)
async def edit_image(
    request: ImageEditRequest,
    gemini: Annotated[GeminiService, Depends(get_gemini_service)],
):
    """Edit an existing image using Nano Banana.

    Send an image (base64) with editing instructions.
    Returns the edited image as base64-encoded data.
    """
    start_time = time.time()
    model_name = request.model or "gemini-3-pro-image-preview"
    logger.info(
        "image_edit_started",
        model=model_name,
        prompt_length=len(request.prompt),
        mime_type=request.mime_type,
    )

    try:
        # Decode base64 image
        image_data = base64.b64decode(request.image)

        result = await gemini.edit_image(
            prompt=request.prompt,
            image_data=image_data,
            image_mime_type=request.mime_type,
            model=model_name,
        )

        # AUTO-SAVE: Save all edited images and log the generation
        save_result = save_generation(
            endpoint="/api/image/edit",
            prompt=request.prompt,
            response_text=result.text,
            images_base64=[{"data": img["data"], "mime_type": img["mime_type"]} for img in result.images],
            metadata={
                "model": result.model,
                "input_mime_type": request.mime_type,
                "usage": result.usage,
            },
        )

        # Extract saved paths from the result
        saved_paths = [p["path"] if p else None for p in save_result["image_paths"]]

        elapsed = time.time() - start_time
        logger.info(
            "image_edit_completed",
            model=result.model,
            elapsed_seconds=round(elapsed, 3),
            image_count=len(result.images),
            saved_paths=saved_paths,
            generation_id=save_result["generation_id"],
            usage=result.usage,
        )

        return ImageResponse(
            text=result.text,
            images=[
                GeneratedImage(
                    data=img["data"],
                    mime_type=img["mime_type"],
                    file_path=saved_paths[i] if i < len(saved_paths) else None
                )
                for i, img in enumerate(result.images)
            ],
            model=result.model,
            usage=result.usage,
        )

    except Exception as e:
        elapsed = time.time() - start_time
        logger.error(
            "image_edit_failed",
            model=model_name,
            elapsed_seconds=round(elapsed, 3),
            error_type=type(e).__name__,
            error=str(e),
        )
        raise HTTPException(status_code=503, detail=f"Image editing error: {str(e)}")


@router.get("/models")
async def list_image_models():
    """List available image generation models."""
    return {
        "models": [
            {
                "id": "gemini-3-pro-image-preview",
                "alias": "nano-banana-pro",
                "description": "Gemini 3 Pro Image (Nano Banana Pro) - Best quality",
                "default": True,
            },
        ]
    }


@router.get("/saved")
async def list_saved():
    """List all saved generation logs (includes images and text)."""
    logs = list_generation_logs()
    return {"generations": logs, "count": len(logs)}


@router.get("/saved/{date}/{filename}")
async def get_saved_image(date: str, filename: str):
    """Serve a saved image file.

    Args:
        date: Date folder (YYYY-MM-DD)
        filename: Image filename (e.g., img_143022_a1b2c3.png)
    """
    filepath = get_image_path(date, filename)
    if not filepath:
        raise HTTPException(status_code=404, detail="Image not found")

    mime = "image/png" if filepath.suffix == ".png" else "image/jpeg" if filepath.suffix in (".jpg", ".jpeg") else "image/webp"
    return FileResponse(filepath, media_type=mime)
