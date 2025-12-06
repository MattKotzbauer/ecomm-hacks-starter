"""Products router for saving/loading product catalog."""

import json
import os
from pathlib import Path

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.services.logging_config import get_logger

logger = get_logger(__name__)

router = APIRouter(prefix="/api/products", tags=["products"])

# Default path for products.json (can be overridden via environment variable)
DEFAULT_PRODUCTS_PATH = Path(__file__).parent.parent.parent.parent / "public" / "data" / "products.json"


def get_products_path() -> Path:
    """Get the path to products.json from environment or default."""
    env_path = os.environ.get("PRODUCTS_JSON_PATH")
    if env_path:
        return Path(env_path)
    return DEFAULT_PRODUCTS_PATH


# --- Models ---


class ProductTargeting(BaseModel):
    """Advertiser targeting preferences for a product."""

    demographics: list[str] = []
    interests: list[str] = []
    scenes: list[str] = []
    semantic: str | None = None


class Product(BaseModel):
    """Product in a collection."""

    id: str
    name: str
    img: str
    description: str | None = None
    targeting: ProductTargeting | None = None


class Collection(BaseModel):
    """Brand collection with products."""

    id: str
    name: str
    displayName: str  # noqa: N815 - matches JSON schema
    products: list[Product]


class ProductsData(BaseModel):
    """Root structure for products.json."""

    collections: list[Collection]


class SaveResponse(BaseModel):
    """Response from save endpoint."""

    success: bool
    message: str
    collection_count: int
    product_count: int


# --- Endpoints ---


@router.post("/save", response_model=SaveResponse)
async def save_products(data: ProductsData) -> SaveResponse:
    """Save products to the JSON file.

    This persists product catalog changes made in the Console UI.
    """
    products_path = get_products_path()

    # Ensure directory exists
    products_path.parent.mkdir(parents=True, exist_ok=True)

    # Count products
    product_count = sum(len(c.products) for c in data.collections)

    try:
        # Write to file with pretty formatting
        with open(products_path, "w") as f:
            json.dump(data.model_dump(), f, indent=2)

        logger.info(
            "products_saved",
            path=str(products_path),
            collections=len(data.collections),
            products=product_count,
        )

        return SaveResponse(
            success=True,
            message=f"Saved {product_count} products to {products_path.name}",
            collection_count=len(data.collections),
            product_count=product_count,
        )
    except Exception as e:
        logger.error("products_save_failed", error=str(e))
        raise HTTPException(status_code=500, detail=f"Failed to save products: {e}")
