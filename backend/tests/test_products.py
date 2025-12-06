"""Tests for the products API endpoints."""

import json
import os
import tempfile
from pathlib import Path

import pytest

# Test data
SAMPLE_COLLECTIONS = {
    "collections": [
        {
            "id": "test-brand",
            "name": "test-brand",
            "displayName": "Test Brand",
            "products": [
                {
                    "id": "test-1",
                    "name": "Test Product",
                    "img": "/test/product.jpg",
                    "description": "A test product",
                    "targeting": {
                        "demographics": ["25-34"],
                        "interests": ["Fashion"],
                        "scenes": ["Interior"],
                        "semantic": "test semantic filter"
                    }
                }
            ]
        }
    ]
}


@pytest.mark.anyio
async def test_save_products_creates_file(client, tmp_path, monkeypatch):
    """POST /api/products/save should save products to JSON file."""
    # Arrange: Set up temp file path
    products_file = tmp_path / "products.json"
    monkeypatch.setenv("PRODUCTS_JSON_PATH", str(products_file))

    # Act: Call the save endpoint
    response = await client.post(
        "/api/products/save",
        json=SAMPLE_COLLECTIONS
    )

    # Assert: Check response
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert "saved" in data["message"].lower()

    # Assert: Check file was created with correct content
    assert products_file.exists()
    with open(products_file) as f:
        saved_data = json.load(f)
    assert saved_data == SAMPLE_COLLECTIONS


@pytest.mark.anyio
async def test_save_products_overwrites_existing(client, tmp_path, monkeypatch):
    """POST /api/products/save should overwrite existing products file."""
    # Arrange: Create existing file
    products_file = tmp_path / "products.json"
    old_data = {"collections": [{"id": "old", "name": "old", "displayName": "Old", "products": []}]}
    with open(products_file, "w") as f:
        json.dump(old_data, f)
    monkeypatch.setenv("PRODUCTS_JSON_PATH", str(products_file))

    # Act: Save new data
    response = await client.post(
        "/api/products/save",
        json=SAMPLE_COLLECTIONS
    )

    # Assert: File should have new content
    assert response.status_code == 200
    with open(products_file) as f:
        saved_data = json.load(f)
    assert saved_data == SAMPLE_COLLECTIONS
    assert saved_data != old_data


@pytest.mark.anyio
async def test_save_products_validates_structure(client, tmp_path, monkeypatch):
    """POST /api/products/save should reject invalid data structure."""
    products_file = tmp_path / "products.json"
    monkeypatch.setenv("PRODUCTS_JSON_PATH", str(products_file))

    # Act: Send invalid data (missing collections key)
    response = await client.post(
        "/api/products/save",
        json={"invalid": "data"}
    )

    # Assert: Should return validation error
    assert response.status_code == 422


@pytest.mark.anyio
async def test_save_products_returns_count(client, tmp_path, monkeypatch):
    """POST /api/products/save should return count of saved products."""
    products_file = tmp_path / "products.json"
    monkeypatch.setenv("PRODUCTS_JSON_PATH", str(products_file))

    # Arrange: Data with multiple products
    multi_product_data = {
        "collections": [
            {
                "id": "brand1",
                "name": "brand1",
                "displayName": "Brand 1",
                "products": [
                    {"id": "p1", "name": "P1", "img": "/p1.jpg"},
                    {"id": "p2", "name": "P2", "img": "/p2.jpg"},
                ]
            },
            {
                "id": "brand2",
                "name": "brand2",
                "displayName": "Brand 2",
                "products": [
                    {"id": "p3", "name": "P3", "img": "/p3.jpg"},
                ]
            }
        ]
    }

    # Act
    response = await client.post(
        "/api/products/save",
        json=multi_product_data
    )

    # Assert
    assert response.status_code == 200
    data = response.json()
    assert data["collection_count"] == 2
    assert data["product_count"] == 3
