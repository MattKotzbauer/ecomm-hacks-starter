"""Pydantic models for the placement generation pipeline.

5-step pipeline:
1. Generate scene descriptions from writing context
2. Generate images from scene descriptions
3. Select products for each image
4. Compose products into images
5. Generate masks for product regions
"""

from pydantic import BaseModel


# === Shared Models ===

class ProductInfo(BaseModel):
    """Product information for selection and composition."""

    id: str
    name: str
    brand: str
    description: str | None = None
    image_url: str | None = None
    # Advertiser targeting preferences
    target_demographics: list[str] = []  # e.g. ["18-24", "25-34", "35-44", "45+"]
    target_interests: list[str] = []  # e.g. ["Fashion", "Luxury", "Art", "Travel"]
    scene_preferences: list[str] = []  # e.g. ["Interior", "Café", "Boutique"]
    semantic_filter: str | None = None  # e.g. "warm lighting, sophisticated settings"


# === API 1: Scene Generation ===

class LikedScene(BaseModel):
    """A scene the user liked (double-clicked)."""

    description: str
    mood: str
    product_name: str | None = None


class ScenesRequest(BaseModel):
    """Request for scene description generation."""

    writing_context: str
    liked_scenes: list[LikedScene] = []  # Last 5 liked scenes
    continuation_count: int = 3  # Scenes matching preferences
    exploration_count: int = 2  # Scenes exploring new directions


class SceneDescription(BaseModel):
    """A single scene description."""

    id: str
    description: str
    mood: str
    scene_type: str = "exploration"  # "continuation" or "exploration"


class ScenesResponse(BaseModel):
    """Response with generated scene descriptions."""

    scenes: list[SceneDescription]
    usage: dict | None = None


# === API 2: Image Generation ===

class ImageGenRequest(BaseModel):
    """Single scene for image generation."""

    scene_id: str
    scene_description: str
    mood: str


class GenerateImagesRequest(BaseModel):
    """Batch request for image generation."""

    scenes: list[ImageGenRequest]


class GeneratedImage(BaseModel):
    """A single generated image."""

    scene_id: str
    image_data: str  # Base64
    mime_type: str


class GenerateImagesResponse(BaseModel):
    """Response with generated images."""

    images: list[GeneratedImage]
    usage: dict | None = None


# === API 3: Product Selection ===

class ImageForSelection(BaseModel):
    """Image data for product selection."""

    scene_id: str
    image_data: str  # Base64
    mime_type: str


class SelectProductsRequest(BaseModel):
    """Batch request for product selection."""

    images: list[ImageForSelection]
    products: list[ProductInfo]
    writing_context: str = ""  # Writer's context for audience matching


class ProductSelection(BaseModel):
    """Product selection result for one image."""

    scene_id: str
    selected_product_id: str  # "NONE" if no good match
    placement_hint: str
    rationale: str
    match_score: int = 5  # 1-10 confidence score for audience match


class SelectProductsResponse(BaseModel):
    """Response with product selections."""

    selections: list[ProductSelection]
    usage: dict | None = None


# === API 4: Image Composition ===

class CompositionTask(BaseModel):
    """Single composition task."""

    scene_id: str
    scene_image: str  # Base64
    scene_mime_type: str
    product: ProductInfo
    product_image: str  # Base64
    product_mime_type: str
    placement_hint: str


class ComposeBatchRequest(BaseModel):
    """Batch request for image composition."""

    tasks: list[CompositionTask]


class ComposedImage(BaseModel):
    """A single composed image."""

    scene_id: str
    image_data: str  # Base64
    mime_type: str


class ComposeBatchResponse(BaseModel):
    """Response with composed images."""

    images: list[ComposedImage]
    usage: dict | None = None


# === API 5: Mask Generation ===

class MaskTask(BaseModel):
    """Single mask generation task."""

    scene_id: str
    composed_image: str  # Base64
    mime_type: str
    product_name: str


class GenerateMasksRequest(BaseModel):
    """Batch request for mask generation."""

    tasks: list[MaskTask]


class GeneratedMask(BaseModel):
    """A single generated mask."""

    scene_id: str
    mask_data: str  # Base64 (white = product)
    mime_type: str


class GenerateMasksResponse(BaseModel):
    """Response with generated masks."""

    masks: list[GeneratedMask]
    usage: dict | None = None


# === Combined Result (for frontend convenience) ===

class PlacementResult(BaseModel):
    """Complete placement result combining all pipeline outputs."""

    scene_id: str
    scene_description: str
    mood: str
    scene_type: str = "exploration"  # "continuation" or "exploration"
    scene_image: str  # Base64 - original generated scene
    composed_image: str  # Base64 - scene with product
    mask: str  # Base64 - product region mask
    mime_type: str
    product: ProductInfo
    placement_hint: str
    rationale: str = ""


# === Unified Pipeline (All 5 Steps in One) ===


class PipelineRequest(BaseModel):
    """Unified request for the full 5-step pipeline.

    This runs all steps sequentially:
    1. Generate scene descriptions from writing_context
    2. Generate base images for each scene
    3. Select products for each image
    4. Compose products into images
    5. Generate masks for hover detection
    """

    writing_context: str
    products: list[ProductInfo]
    liked_scenes: list[LikedScene] = []
    scene_count: int = 3  # Total scenes to generate (continuation + exploration)
    continuation_ratio: float = 0.6  # Fraction of scenes that match preferences (0.0-1.0)


class PipelineResponse(BaseModel):
    """Unified response with all placement results."""

    placements: list[PlacementResult]
    stats: dict | None = None  # Timing and usage stats
