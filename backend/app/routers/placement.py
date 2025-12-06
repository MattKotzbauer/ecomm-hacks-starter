"""Placement generation router - 5-step pipeline for product placement.

Pipeline:
1. POST /scenes - Generate scene descriptions from writing context
2. POST /generate-images - Generate base lifestyle images
3. POST /select-products - Select products for each image
4. POST /compose-batch - Edit products into images
5. POST /generate-masks - Generate segmentation masks
"""

import asyncio
import base64
import re
import time
from typing import Annotated

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request

from app.models.placement import (
    ComposeBatchRequest,
    ComposeBatchResponse,
    ComposedImage,
    CompositionTask,
    GeneratedImage,
    GeneratedMask,
    GenerateImagesRequest,
    GenerateImagesResponse,
    GenerateMasksRequest,
    GenerateMasksResponse,
    LikedScene,
    MaskTask,
    PipelineRequest,
    PipelineResponse,
    PlacementResult,
    ProductSelection,
    ScenesRequest,
    ScenesResponse,
    SceneDescription,
    SelectProductsRequest,
    SelectProductsResponse,
)
from app.services.gemini import GeminiService
from app.services.logging_config import get_logger
from app.services.generation_store import save_generation
from app.services.prompt_loader import load_and_fill_prompt

logger = get_logger(__name__)

router = APIRouter(prefix="/api/placement", tags=["placement"])


# === Helper Functions ===


async def fetch_image_from_url(url: str) -> tuple[bytes, str]:
    """Fetch an image from a URL and return (bytes, mime_type).

    Args:
        url: HTTP(S) URL to fetch

    Returns:
        Tuple of (image_bytes, mime_type)

    Raises:
        ValueError: If fetch fails or content type is not an image
    """
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(url)
            response.raise_for_status()

            content_type = response.headers.get("content-type", "image/jpeg")
            # Extract just the mime type (remove charset, etc.)
            mime_type = content_type.split(";")[0].strip()

            # Validate it's an image
            if not mime_type.startswith("image/"):
                # Try to detect from content
                data = response.content
                if data[:8] == b"\x89PNG\r\n\x1a\n":
                    mime_type = "image/png"
                elif data[:2] == b"\xff\xd8":
                    mime_type = "image/jpeg"
                elif data[:4] == b"RIFF" and data[8:12] == b"WEBP":
                    mime_type = "image/webp"
                else:
                    mime_type = "image/jpeg"  # Default fallback

            return response.content, mime_type

    except httpx.HTTPError as e:
        logger.warning("fetch_image_failed", url=url, error=str(e))
        raise ValueError(f"Failed to fetch image from {url}: {e}")
    except Exception as e:
        logger.warning("fetch_image_failed", url=url, error=str(e))
        raise ValueError(f"Failed to fetch image: {e}")


def get_gemini_service(request: Request) -> GeminiService:
    """Dependency to get Gemini service from app state."""
    service = request.app.state.gemini_service
    if not service:
        raise HTTPException(status_code=503, detail="Gemini service not initialized")
    return service


def build_products_xml(products: list) -> str:
    """Build XML representation of products with advertiser targeting preferences.

    Args:
        products: List of ProductInfo objects

    Returns:
        XML string containing product info and targeting preferences
    """
    product_xmls = []
    for p in products:
        # Build targeting section if any preferences exist
        targeting_lines = []
        if p.target_demographics:
            targeting_lines.append(
                f"    <demographics>{', '.join(p.target_demographics)}</demographics>"
            )
        if p.target_interests:
            targeting_lines.append(
                f"    <interests>{', '.join(p.target_interests)}</interests>"
            )
        if p.scene_preferences:
            targeting_lines.append(
                f"    <scenes>{', '.join(p.scene_preferences)}</scenes>"
            )
        if p.semantic_filter:
            targeting_lines.append(f"    <semantic>{p.semantic_filter}</semantic>")

        # Build product XML
        targeting_section = ""
        if targeting_lines:
            targeting_section = (
                "\n  <targeting>\n" + "\n".join(targeting_lines) + "\n  </targeting>"
            )

        product_xml = (
            f'<product id="{p.id}" brand="{p.brand}">\n'
            f"  <name>{p.name}</name>\n"
            f"  <description>{p.description or 'Luxury product'}</description>"
            f"{targeting_section}\n"
            f"</product>"
        )
        product_xmls.append(product_xml)

    return "\n".join(product_xmls)


# === API 1: Generate Scene Descriptions ===
# Prompt loaded from: prompts/base_placement_scenes.md


def build_liked_scenes_section(liked_scenes: list[LikedScene]) -> str:
    """Build XML section for liked scenes."""
    if not liked_scenes:
        return "<liked_scenes>\n(No liked scenes yet - generate all as exploration)\n</liked_scenes>"

    scenes_xml = []
    for scene in liked_scenes:
        product_line = f"    <product>{scene.product_name}</product>" if scene.product_name else ""
        scenes_xml.append(
            f'  <scene mood="{scene.mood}">\n'
            f"    <description>{scene.description}</description>\n"
            f"{product_line}\n"
            f"  </scene>"
        )

    return f"<liked_scenes>\n{''.join(scenes_xml)}\n</liked_scenes>"


def parse_scenes_xml(text: str) -> list[SceneDescription]:
    """Parse XML response into SceneDescription objects."""
    scenes = []
    # Find all scene blocks with type attribute
    scene_pattern = r'<scene id="(\d+)"(?: type="(continuation|exploration)")?\s*>\s*<description>(.*?)</description>\s*<mood>(.*?)</mood>\s*</scene>'
    matches = re.findall(scene_pattern, text, re.DOTALL)

    for match in matches:
        scene_id, scene_type, description, mood = match
        scenes.append(
            SceneDescription(
                id=f"scene-{scene_id}",
                description=description.strip(),
                mood=mood.strip(),
                scene_type=scene_type.strip() if scene_type else "exploration",
            )
        )

    return scenes


@router.post("/scenes", response_model=ScenesResponse)
async def generate_scenes(
    request: ScenesRequest,
    gemini: Annotated[GeminiService, Depends(get_gemini_service)],
):
    """Generate scene descriptions with continuation/exploration split."""
    start_time = time.time()
    total_count = request.continuation_count + request.exploration_count

    logger.info(
        "base_placement_scenes_started",
        writing_length=len(request.writing_context),
        liked_count=len(request.liked_scenes),
        continuation_count=request.continuation_count,
        exploration_count=request.exploration_count,
    )

    liked_scenes_section = build_liked_scenes_section(request.liked_scenes)

    prompt = load_and_fill_prompt(
        "base_placement_scenes",
        writing_context=request.writing_context,
        liked_scenes_section=liked_scenes_section,
        total_count=total_count,
        continuation_count=request.continuation_count,
        exploration_count=request.exploration_count,
    )

    try:
        result = await gemini.query(prompt)
        scenes = parse_scenes_xml(result.text)

        if not scenes:
            logger.warning("base_placement_scenes_parse_failed", raw_response=result.text[:500])
            raise HTTPException(status_code=500, detail="Failed to parse scene descriptions")

        # SAVE: Log the scene generation
        save_generation(
            endpoint="/api/placement/scenes",
            prompt=prompt,
            response_text=result.text,
            images_base64=None,
            metadata={
                "writing_context_length": len(request.writing_context),
                "liked_scenes_count": len(request.liked_scenes),
                "continuation_count": request.continuation_count,
                "exploration_count": request.exploration_count,
                "scenes_generated": [{"id": s.id, "mood": s.mood, "type": s.scene_type} for s in scenes],
                "usage": result.usage,
            },
        )

        elapsed = time.time() - start_time
        logger.info(
            "base_placement_scenes_completed",
            scene_count=len(scenes),
            elapsed_seconds=round(elapsed, 3),
        )

        return ScenesResponse(scenes=scenes, usage=result.usage)

    except HTTPException:
        raise
    except Exception as e:
        elapsed = time.time() - start_time
        logger.error(
            "base_placement_scenes_failed",
            elapsed_seconds=round(elapsed, 3),
            error_type=type(e).__name__,
            error=str(e),
        )
        raise HTTPException(status_code=503, detail=f"Scene generation error: {str(e)}")


# === API 2: Batch Image Generation ===
# Prompt loaded from: prompts/base_placement_generate_images.md


async def generate_single_image(
    gemini: GeminiService,
    scene_id: str,
    scene_description: str,
    mood: str,
) -> GeneratedImage:
    """Generate a single image from scene description."""
    prompt = load_and_fill_prompt(
        "base_placement_generate_images",
        scene_description=scene_description,
        mood=mood,
    )

    result = await gemini.generate_image(prompt)

    if not result.images:
        raise ValueError(f"No image generated for scene {scene_id}")

    img_data = result.images[0]["data"]
    img_mime = result.images[0]["mime_type"]

    # SAVE: Log the image generation
    save_generation(
        endpoint="/api/placement/generate-images",
        prompt=prompt,
        response_text=result.text,
        images_base64=[{"data": img_data, "mime_type": img_mime}],
        metadata={
            "scene_id": scene_id,
            "mood": mood,
            "usage": result.usage,
        },
    )

    return GeneratedImage(
        scene_id=scene_id,
        image_data=img_data,
        mime_type=img_mime,
    )


@router.post("/generate-images", response_model=GenerateImagesResponse)
async def generate_images(
    request: GenerateImagesRequest,
    gemini: Annotated[GeminiService, Depends(get_gemini_service)],
):
    """Generate images for multiple scenes in parallel."""
    start_time = time.time()
    logger.info("base_placement_generate_images_started", scene_count=len(request.scenes))

    try:
        # Generate all images in parallel
        tasks = [
            generate_single_image(gemini, scene.scene_id, scene.scene_description, scene.mood)
            for scene in request.scenes
        ]
        images = await asyncio.gather(*tasks, return_exceptions=True)

        # Filter out errors
        successful_images = []
        for i, img in enumerate(images):
            if isinstance(img, Exception):
                logger.error(
                    "placement_single_image_failed",
                    scene_id=request.scenes[i].scene_id,
                    error=str(img),
                )
            else:
                successful_images.append(img)

        elapsed = time.time() - start_time
        logger.info(
            "base_placement_generate_images_completed",
            total=len(request.scenes),
            successful=len(successful_images),
            elapsed_seconds=round(elapsed, 3),
        )

        return GenerateImagesResponse(images=successful_images, usage=None)

    except Exception as e:
        elapsed = time.time() - start_time
        logger.error(
            "base_placement_generate_images_failed",
            elapsed_seconds=round(elapsed, 3),
            error_type=type(e).__name__,
            error=str(e),
        )
        raise HTTPException(status_code=503, detail=f"Image generation error: {str(e)}")


# === API 3: Batch Product Selection ===
# Prompt loaded from: prompts/base_placement_select.md


def parse_selection_xml(text: str, scene_id: str) -> ProductSelection:
    """Parse XML response into ProductSelection object."""
    product_id_match = re.search(r"<product_id>(.*?)</product_id>", text, re.DOTALL)
    placement_match = re.search(r"<placement>(.*?)</placement>", text, re.DOTALL)
    rationale_match = re.search(r"<rationale>(.*?)</rationale>", text, re.DOTALL)
    match_score_match = re.search(r"<match_score>(.*?)</match_score>", text, re.DOTALL)

    if not all([product_id_match, placement_match, rationale_match]):
        raise ValueError("Failed to parse product selection XML")

    # Parse match_score, default to 5 if not found or invalid
    match_score = 5
    if match_score_match:
        try:
            match_score = int(match_score_match.group(1).strip())
            match_score = max(1, min(10, match_score))  # Clamp to 1-10
        except ValueError:
            pass

    return ProductSelection(
        scene_id=scene_id,
        selected_product_id=product_id_match.group(1).strip(),
        placement_hint=placement_match.group(1).strip(),
        rationale=rationale_match.group(1).strip(),
        match_score=match_score,
    )


async def select_product_for_image(
    gemini: GeminiService,
    scene_id: str,
    image_data: str,
    mime_type: str,
    products_xml: str,
    writing_context: str = "",
) -> ProductSelection:
    """Select a product for a single image, considering advertiser targeting."""
    prompt = load_and_fill_prompt(
        "base_placement_select",
        products_xml=products_xml,
        writing_context=writing_context or "(No writing context provided)",
    )

    # Use multimedia query to send image + text
    result = await gemini.multimedia_query(
        prompt=prompt,
        files=[{"data": image_data, "mime_type": mime_type}],
    )

    selection = parse_selection_xml(result.text, scene_id)

    # SAVE: Log the product selection (text only, includes scene image in metadata)
    save_generation(
        endpoint="/api/placement/select-products",
        prompt=prompt,
        response_text=result.text,
        images_base64=None,  # Don't re-save the input image
        metadata={
            "scene_id": scene_id,
            "selected_product_id": selection.selected_product_id,
            "placement_hint": selection.placement_hint,
            "rationale": selection.rationale,
            "usage": result.usage,
        },
    )

    return selection


@router.post("/select-products", response_model=SelectProductsResponse)
async def select_products(
    request: SelectProductsRequest,
    gemini: Annotated[GeminiService, Depends(get_gemini_service)],
):
    """Select products for multiple images in parallel."""
    start_time = time.time()
    logger.info(
        "base_placement_select_products_started",
        image_count=len(request.images),
        product_count=len(request.products),
    )

    # Build products XML with targeting preferences
    products_xml = build_products_xml(request.products)

    try:
        tasks = [
            select_product_for_image(
                gemini,
                img.scene_id,
                img.image_data,
                img.mime_type,
                products_xml,
                request.writing_context,
            )
            for img in request.images
        ]
        selections = await asyncio.gather(*tasks, return_exceptions=True)

        successful_selections = []
        for i, sel in enumerate(selections):
            if isinstance(sel, Exception):
                logger.error(
                    "placement_single_selection_failed",
                    scene_id=request.images[i].scene_id,
                    error=str(sel),
                )
            else:
                successful_selections.append(sel)

        elapsed = time.time() - start_time
        logger.info(
            "base_placement_select_products_completed",
            total=len(request.images),
            successful=len(successful_selections),
            elapsed_seconds=round(elapsed, 3),
        )

        return SelectProductsResponse(selections=successful_selections, usage=None)

    except Exception as e:
        elapsed = time.time() - start_time
        logger.error(
            "base_placement_select_products_failed",
            elapsed_seconds=round(elapsed, 3),
            error_type=type(e).__name__,
            error=str(e),
        )
        raise HTTPException(status_code=503, detail=f"Product selection error: {str(e)}")


# === API 4: Batch Image Composition ===
# Prompt loaded from: prompts/base_placement_compose.md


async def compose_single_image(
    gemini: GeminiService,
    task: "CompositionTask",
) -> ComposedImage:
    """Compose a product into a single scene image."""
    from app.models.placement import CompositionTask

    # Build prompt - expects product image as reference
    prompt = load_and_fill_prompt(
        "base_placement_compose",
        product_brand=task.product.brand,
        product_name=task.product.name,
        placement_hint=task.placement_hint,
    )

    # Decode scene image
    scene_bytes = base64.b64decode(task.scene_image)

    # Prepare reference images (product image if available)
    reference_images = None
    if task.product_image:
        product_bytes = base64.b64decode(task.product_image)
        reference_images = [
            {"data": product_bytes, "mime_type": task.product_mime_type}
        ]

    result = await gemini.edit_image(
        prompt=prompt,
        image_data=scene_bytes,
        image_mime_type=task.scene_mime_type,
        reference_images=reference_images,
    )

    if not result.images:
        raise ValueError(f"No composed image for scene {task.scene_id}")

    img_data = result.images[0]["data"]
    img_mime = result.images[0]["mime_type"]

    # SAVE: Log the composed image
    save_generation(
        endpoint="/api/placement/compose-batch",
        prompt=prompt,
        response_text=result.text,
        images_base64=[{"data": img_data, "mime_type": img_mime}],
        metadata={
            "scene_id": task.scene_id,
            "product_id": task.product.id,
            "product_name": task.product.name,
            "product_brand": task.product.brand,
            "placement_hint": task.placement_hint,
            "has_reference_image": bool(task.product_image),
            "usage": result.usage,
        },
    )

    return ComposedImage(
        scene_id=task.scene_id,
        image_data=img_data,
        mime_type=img_mime,
    )


@router.post("/compose-batch", response_model=ComposeBatchResponse)
async def compose_batch(
    request: ComposeBatchRequest,
    gemini: Annotated[GeminiService, Depends(get_gemini_service)],
):
    """Compose products into multiple scene images in parallel."""
    start_time = time.time()
    logger.info("base_placement_compose_batch_started", task_count=len(request.tasks))

    try:
        tasks = [compose_single_image(gemini, task) for task in request.tasks]
        images = await asyncio.gather(*tasks, return_exceptions=True)

        successful_images = []
        for i, img in enumerate(images):
            if isinstance(img, Exception):
                logger.error(
                    "placement_single_compose_failed",
                    scene_id=request.tasks[i].scene_id,
                    error=str(img),
                )
            else:
                successful_images.append(img)

        elapsed = time.time() - start_time
        logger.info(
            "base_placement_compose_batch_completed",
            total=len(request.tasks),
            successful=len(successful_images),
            elapsed_seconds=round(elapsed, 3),
        )

        return ComposeBatchResponse(images=successful_images, usage=None)

    except Exception as e:
        elapsed = time.time() - start_time
        logger.error(
            "base_placement_compose_batch_failed",
            elapsed_seconds=round(elapsed, 3),
            error_type=type(e).__name__,
            error=str(e),
        )
        raise HTTPException(status_code=503, detail=f"Image composition error: {str(e)}")


# === API 5: Batch Mask Generation ===
# Prompt loaded from: prompts/base_placement_masks.md


async def generate_single_mask(
    gemini: GeminiService,
    task: "MaskTask",
) -> GeneratedMask:
    """Generate a segmentation mask for a single image."""
    from app.models.placement import MaskTask

    prompt = load_and_fill_prompt(
        "base_placement_masks",
        product_name=task.product_name,
    )

    # Decode composed image
    image_bytes = base64.b64decode(task.composed_image)

    result = await gemini.edit_image(
        prompt=prompt,
        image_data=image_bytes,
        image_mime_type=task.mime_type,
    )

    if not result.images:
        raise ValueError(f"No mask generated for scene {task.scene_id}")

    mask_data = result.images[0]["data"]
    mask_mime = result.images[0]["mime_type"]

    # SAVE: Log the mask generation
    save_generation(
        endpoint="/api/placement/generate-masks",
        prompt=prompt,
        response_text=result.text,
        images_base64=[{"data": mask_data, "mime_type": mask_mime}],
        metadata={
            "scene_id": task.scene_id,
            "product_name": task.product_name,
            "usage": result.usage,
        },
    )

    return GeneratedMask(
        scene_id=task.scene_id,
        mask_data=mask_data,
        mime_type=mask_mime,
    )


@router.post("/generate-masks", response_model=GenerateMasksResponse)
async def generate_masks(
    request: GenerateMasksRequest,
    gemini: Annotated[GeminiService, Depends(get_gemini_service)],
):
    """Generate segmentation masks for multiple composed images in parallel."""
    start_time = time.time()
    logger.info("placement_generate_masks_started", task_count=len(request.tasks))

    try:
        tasks = [generate_single_mask(gemini, task) for task in request.tasks]
        masks = await asyncio.gather(*tasks, return_exceptions=True)

        successful_masks = []
        for i, mask in enumerate(masks):
            if isinstance(mask, Exception):
                logger.error(
                    "placement_single_mask_failed",
                    scene_id=request.tasks[i].scene_id,
                    error=str(mask),
                )
            else:
                successful_masks.append(mask)

        elapsed = time.time() - start_time
        logger.info(
            "placement_generate_masks_completed",
            total=len(request.tasks),
            successful=len(successful_masks),
            elapsed_seconds=round(elapsed, 3),
        )

        return GenerateMasksResponse(masks=successful_masks, usage=None)

    except Exception as e:
        elapsed = time.time() - start_time
        logger.error(
            "placement_generate_masks_failed",
            elapsed_seconds=round(elapsed, 3),
            error_type=type(e).__name__,
            error=str(e),
        )
        raise HTTPException(status_code=503, detail=f"Mask generation error: {str(e)}")


# === API 6: Unified Pipeline (All 5 Steps in One Call) ===


@router.post("/pipeline", response_model=PipelineResponse)
async def run_pipeline(
    request: PipelineRequest,
    gemini: Annotated[GeminiService, Depends(get_gemini_service)],
):
    """Run the complete 5-step placement pipeline in one call.

    Steps:
    1. Generate scene descriptions from writing_context
    2. Generate base images for each scene (parallel)
    3. Select products for each image (parallel)
    4. Compose products into images (parallel)
    5. Generate masks for hover detection (parallel)

    Args:
        request: PipelineRequest with writing_context, products, and options

    Returns:
        PipelineResponse with all PlacementResult objects and timing stats
    """
    pipeline_start = time.time()
    stats = {"steps": {}}

    logger.info(
        "placement_pipeline_started",
        writing_length=len(request.writing_context),
        product_count=len(request.products),
        scene_count=request.scene_count,
        liked_count=len(request.liked_scenes),
    )

    # Validate inputs
    if not request.writing_context.strip():
        raise HTTPException(status_code=400, detail="writing_context cannot be empty")
    if not request.products:
        raise HTTPException(status_code=400, detail="At least one product is required")
    if request.scene_count < 1 or request.scene_count > 10:
        raise HTTPException(status_code=400, detail="scene_count must be 1-10")

    # Calculate continuation/exploration split
    continuation_count = round(request.scene_count * request.continuation_ratio)
    exploration_count = request.scene_count - continuation_count

    # If no liked scenes, make all exploration
    if not request.liked_scenes:
        continuation_count = 0
        exploration_count = request.scene_count

    try:
        # === Step 1: Generate Scenes ===
        step_start = time.time()
        liked_section = build_liked_scenes_section(request.liked_scenes)
        scenes_prompt = load_and_fill_prompt(
            "base_placement_scenes",
            writing_context=request.writing_context,
            liked_scenes_section=liked_section,
            total_count=request.scene_count,
            continuation_count=continuation_count,
            exploration_count=exploration_count,
        )

        scenes_result = await gemini.query(scenes_prompt)
        scenes = parse_scenes_xml(scenes_result.text)

        if not scenes:
            raise HTTPException(status_code=500, detail="Failed to generate scenes")

        stats["steps"]["1_scenes"] = {
            "elapsed": round(time.time() - step_start, 3),
            "count": len(scenes),
        }
        logger.info("placement_pipeline_step1_done", scene_count=len(scenes))

        # === Step 2: Generate Images (parallel) ===
        step_start = time.time()
        image_tasks = [
            generate_single_image(gemini, s.id, s.description, s.mood)
            for s in scenes
        ]
        image_results = await asyncio.gather(*image_tasks, return_exceptions=True)

        images = [img for img in image_results if not isinstance(img, Exception)]
        if not images:
            raise HTTPException(status_code=500, detail="Failed to generate any images")

        stats["steps"]["2_images"] = {
            "elapsed": round(time.time() - step_start, 3),
            "count": len(images),
        }
        logger.info("placement_pipeline_step2_done", image_count=len(images))

        # === Step 3: Select Products (parallel) ===
        step_start = time.time()
        products_xml = build_products_xml(request.products)

        selection_tasks = [
            select_product_for_image(
                gemini,
                img.scene_id,
                img.image_data,
                img.mime_type,
                products_xml,
                request.writing_context,
            )
            for img in images
        ]
        selection_results = await asyncio.gather(*selection_tasks, return_exceptions=True)

        # Filter out exceptions and "NONE" selections (no good audience match)
        all_selections = [s for s in selection_results if not isinstance(s, Exception)]
        selections = [s for s in all_selections if s.selected_product_id.upper() != "NONE"]
        skipped_count = len(all_selections) - len(selections)

        if skipped_count > 0:
            logger.info(
                "placement_pipeline_skipped_mismatches",
                skipped=skipped_count,
                reason="No matching product for audience",
            )

        if not selections:
            # All products were rejected - return empty but valid response
            logger.info("placement_pipeline_no_matches", reason="No products matched audience")
            return PipelineResponse(
                placements=[],
                stats={
                    "total_elapsed": round(time.time() - pipeline_start, 3),
                    "message": "No products matched the writer's audience",
                },
            )

        stats["steps"]["3_selections"] = {
            "elapsed": round(time.time() - step_start, 3),
            "count": len(selections),
            "skipped_mismatches": skipped_count,
        }
        logger.info("placement_pipeline_step3_done", selection_count=len(selections))

        # === Step 4: Compose Images (parallel) ===
        step_start = time.time()

        # First, fetch all product images in parallel
        product_images_cache: dict[str, tuple[str, str]] = {}  # id -> (base64, mime_type)
        products_with_urls = [p for p in request.products if p.image_url]

        if products_with_urls:
            logger.info("fetching_product_images", count=len(products_with_urls))
            fetch_tasks = [fetch_image_from_url(p.image_url) for p in products_with_urls]
            fetch_results = await asyncio.gather(*fetch_tasks, return_exceptions=True)

            for product, result in zip(products_with_urls, fetch_results):
                if isinstance(result, Exception):
                    logger.warning(
                        "product_image_fetch_failed",
                        product_id=product.id,
                        error=str(result),
                    )
                else:
                    img_bytes, mime_type = result
                    product_images_cache[product.id] = (
                        base64.b64encode(img_bytes).decode("utf-8"),
                        mime_type,
                    )

        compose_tasks_list = []
        for selection in selections:
            scene_img = next(
                (img for img in images if img.scene_id == selection.scene_id), None
            )
            product = next(
                (p for p in request.products if p.id == selection.selected_product_id),
                None,
            )
            if scene_img and product:
                # Get product image from cache if available
                product_image = ""
                product_mime_type = "image/jpeg"
                if product.id in product_images_cache:
                    product_image, product_mime_type = product_images_cache[product.id]

                task = CompositionTask(
                    scene_id=selection.scene_id,
                    scene_image=scene_img.image_data,
                    scene_mime_type=scene_img.mime_type,
                    product=product,
                    product_image=product_image,
                    product_mime_type=product_mime_type,
                    placement_hint=selection.placement_hint,
                )
                compose_tasks_list.append((task, selection))

        compose_coroutines = [
            compose_single_image(gemini, task) for task, _ in compose_tasks_list
        ]
        compose_results = await asyncio.gather(*compose_coroutines, return_exceptions=True)

        composed = []
        for i, result in enumerate(compose_results):
            if not isinstance(result, Exception):
                composed.append((result, compose_tasks_list[i][1]))  # (image, selection)

        if not composed:
            raise HTTPException(status_code=500, detail="Failed to compose any images")

        stats["steps"]["4_compose"] = {
            "elapsed": round(time.time() - step_start, 3),
            "count": len(composed),
        }
        logger.info("placement_pipeline_step4_done", composed_count=len(composed))

        # === Step 5: Generate Masks (parallel) ===
        step_start = time.time()
        mask_tasks_list = []
        for composed_img, selection in composed:
            product = next(
                (p for p in request.products if p.id == selection.selected_product_id),
                None,
            )
            task = MaskTask(
                scene_id=composed_img.scene_id,
                composed_image=composed_img.image_data,
                mime_type=composed_img.mime_type,
                product_name=product.name if product else "product",
            )
            mask_tasks_list.append((task, composed_img, selection))

        mask_coroutines = [
            generate_single_mask(gemini, task) for task, _, _ in mask_tasks_list
        ]
        mask_results = await asyncio.gather(*mask_coroutines, return_exceptions=True)

        stats["steps"]["5_masks"] = {
            "elapsed": round(time.time() - step_start, 3),
            "count": sum(1 for m in mask_results if not isinstance(m, Exception)),
        }
        logger.info(
            "placement_pipeline_step5_done",
            mask_count=stats["steps"]["5_masks"]["count"],
        )

        # === Assemble Final Results ===
        placements = []
        for i, mask_result in enumerate(mask_results):
            if isinstance(mask_result, Exception):
                continue

            task, composed_img, selection = mask_tasks_list[i]
            scene = next((s for s in scenes if s.id == composed_img.scene_id), None)
            scene_img = next(
                (img for img in images if img.scene_id == composed_img.scene_id), None
            )
            product = next(
                (p for p in request.products if p.id == selection.selected_product_id),
                None,
            )

            if scene and scene_img and product:
                placements.append(
                    PlacementResult(
                        scene_id=composed_img.scene_id,
                        scene_description=scene.description,
                        mood=scene.mood,
                        scene_type=scene.scene_type,
                        scene_image=scene_img.image_data,
                        composed_image=composed_img.image_data,
                        mask=mask_result.mask_data,
                        mime_type=composed_img.mime_type,
                        product=product,
                        placement_hint=selection.placement_hint,
                        rationale=selection.rationale,
                    )
                )

        total_elapsed = time.time() - pipeline_start
        stats["total_elapsed"] = round(total_elapsed, 3)
        stats["placements_generated"] = len(placements)

        logger.info(
            "placement_pipeline_completed",
            placements=len(placements),
            total_elapsed=stats["total_elapsed"],
        )

        return PipelineResponse(placements=placements, stats=stats)

    except HTTPException:
        raise
    except Exception as e:
        elapsed = time.time() - pipeline_start
        logger.error(
            "placement_pipeline_failed",
            elapsed_seconds=round(elapsed, 3),
            error_type=type(e).__name__,
            error=str(e),
        )
        raise HTTPException(status_code=503, detail=f"Pipeline error: {str(e)}")
