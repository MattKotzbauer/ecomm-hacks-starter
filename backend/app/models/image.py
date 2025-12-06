"""Image generation models for API requests and responses."""

from pydantic import BaseModel, Field


class ImageGenerateRequest(BaseModel):
    """Request for image generation (Nano Banana)."""

    prompt: str = Field(..., description="Text description of the image to generate")
    model: str | None = Field(None, description="Model to use (defaults to gemini-3-pro-image-preview)")


class ImageEditRequest(BaseModel):
    """Request for image editing."""

    prompt: str = Field(..., description="Instructions for how to edit the image")
    image: str = Field(..., description="Base64-encoded image data")
    mime_type: str = Field("image/png", description="MIME type of the image")
    model: str | None = Field(None, description="Model to use")


class GeneratedImage(BaseModel):
    """A single generated image."""

    data: str = Field(..., description="Base64-encoded image data")
    mime_type: str = Field(..., description="MIME type (e.g., image/png)")
    file_path: str | None = Field(None, description="Saved file path (auto-saved to disk)")


class ImageResponse(BaseModel):
    """Response from image generation/editing."""

    text: str | None = Field(None, description="Any accompanying text from the model")
    images: list[GeneratedImage] = Field(default_factory=list, description="Generated images")
    model: str = Field(..., description="Model used")
    usage: dict | None = Field(None, description="Token usage stats")
