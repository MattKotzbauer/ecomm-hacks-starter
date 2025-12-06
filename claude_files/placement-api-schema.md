# Placement API Schema

Base URL: `http://localhost:8000/api/placement`

## Overview

The placement pipeline generates AI-powered product placements in lifestyle imagery. There are two ways to use it:

1. **Unified Pipeline** (`/pipeline`) - Single call that runs all 5 steps
2. **Individual Steps** - Call each step separately for more control

**Batch Size**: All endpoints accept **1-10 items** per batch. The limit is enforced on the unified pipeline; individual endpoints are unbounded but practical limits apply due to API rate limits.

---

## Unified Pipeline (Recommended)

### `POST /api/placement/pipeline`

Runs all 5 steps in one call. This is the easiest way to generate placements.

#### Request

```typescript
interface PipelineRequest {
  writing_context: string;           // Creative brief / writing pane text
  products: ProductInfo[];           // Products to place (1+ required)
  liked_scenes?: LikedScene[];       // User preferences from previous generations
  scene_count?: number;              // Total scenes to generate (1-10, default: 3)
  continuation_ratio?: number;       // Fraction matching preferences (0.0-1.0, default: 0.6)
}

interface ProductInfo {
  id: string;                        // Unique product ID
  name: string;                      // Product name (e.g., "Galleria Bag")
  brand: string;                     // Brand name (e.g., "PRADA")
  description?: string;              // Optional description
  image_url?: string;                // Optional product image URL
}

interface LikedScene {
  description: string;               // Scene description user liked
  mood: string;                      // Mood of the scene
  product_name?: string;             // Product that was in the scene
}
```

#### Response

```typescript
interface PipelineResponse {
  placements: PlacementResult[];     // Generated placements
  stats: {                           // Timing statistics
    total_elapsed: number;           // Total time in seconds
    placements_generated: number;
    steps: {
      "1_scenes": { elapsed: number; count: number };
      "2_images": { elapsed: number; count: number };
      "3_selections": { elapsed: number; count: number };
      "4_compose": { elapsed: number; count: number };
      "5_masks": { elapsed: number; count: number };
    }
  }
}

interface PlacementResult {
  scene_id: string;                  // Unique scene identifier
  scene_description: string;         // What the scene depicts
  mood: string;                      // Mood (e.g., "warm", "intimate")
  scene_type: "continuation" | "exploration";  // Matches preferences or new direction
  scene_image: string;               // Base64 - original generated scene
  composed_image: string;            // Base64 - scene with product placed
  mask: string;                      // Base64 - white=product, black=background
  mime_type: string;                 // "image/png" or "image/jpeg"
  product: ProductInfo;              // The product that was placed
  placement_hint: string;            // Where product was placed
  rationale: string;                 // Why this product/placement was chosen
}
```

#### Example

```bash
curl -X POST http://localhost:8000/api/placement/pipeline \
  -H "Content-Type: application/json" \
  -d '{
    "writing_context": "A cozy afternoon in a Parisian café...",
    "products": [
      {"id": "watch-1", "name": "Tank Française", "brand": "CARTIER"},
      {"id": "bag-1", "name": "Galleria Bag", "brand": "PRADA"}
    ],
    "scene_count": 3,
    "continuation_ratio": 0.6
  }'
```

---

## Individual Step APIs

### Step 1: `POST /api/placement/scenes`

Generate scene descriptions from writing context.

#### Request

```typescript
interface ScenesRequest {
  writing_context: string;           // Creative brief text
  liked_scenes?: LikedScene[];       // Previous liked scenes (max 5 recommended)
  continuation_count?: number;       // Scenes matching preferences (default: 3)
  exploration_count?: number;        // New direction scenes (default: 2)
}
```

#### Response

```typescript
interface ScenesResponse {
  scenes: SceneDescription[];
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
}

interface SceneDescription {
  id: string;                        // "scene-1", "scene-2", etc.
  description: string;               // Detailed scene for image generation
  mood: string;                      // e.g., "intimate", "dramatic", "airy"
  scene_type: "continuation" | "exploration";
}
```

---

### Step 2: `POST /api/placement/generate-images`

Generate images from scene descriptions. **Runs in parallel**.

#### Request

```typescript
interface GenerateImagesRequest {
  scenes: ImageGenRequest[];         // Array of scenes (no hard limit)
}

interface ImageGenRequest {
  scene_id: string;                  // Must match scene.id from Step 1
  scene_description: string;         // The description text
  mood: string;                      // The mood
}
```

#### Response

```typescript
interface GenerateImagesResponse {
  images: GeneratedImage[];          // Successfully generated images
  usage?: object;
}

interface GeneratedImage {
  scene_id: string;
  image_data: string;                // Base64 encoded
  mime_type: string;                 // "image/png" or "image/jpeg"
}
```

---

### Step 3: `POST /api/placement/select-products`

Select best product for each image using vision model. **Runs in parallel**.

#### Request

```typescript
interface SelectProductsRequest {
  images: ImageForSelection[];       // Images to analyze
  products: ProductInfo[];           // Available products to choose from
}

interface ImageForSelection {
  scene_id: string;
  image_data: string;                // Base64 encoded
  mime_type: string;
}
```

#### Response

```typescript
interface SelectProductsResponse {
  selections: ProductSelection[];
  usage?: object;
}

interface ProductSelection {
  scene_id: string;
  selected_product_id: string;       // ID of chosen product
  placement_hint: string;            // Where to place (e.g., "on the table")
  rationale: string;                 // Why this product fits
}
```

---

### Step 4: `POST /api/placement/compose-batch`

Compose products into scene images. **Runs in parallel**.

#### Request

```typescript
interface ComposeBatchRequest {
  tasks: CompositionTask[];
}

interface CompositionTask {
  scene_id: string;
  scene_image: string;               // Base64 - the scene image
  scene_mime_type: string;
  product: ProductInfo;              // Product to place
  product_image: string;             // Base64 - product image (optional, can be empty)
  product_mime_type: string;
  placement_hint: string;            // Where to place product
}
```

#### Response

```typescript
interface ComposeBatchResponse {
  images: ComposedImage[];
  usage?: object;
}

interface ComposedImage {
  scene_id: string;
  image_data: string;                // Base64 - scene with product
  mime_type: string;
}
```

---

### Step 5: `POST /api/placement/generate-masks`

Generate segmentation masks for hover detection. **Runs in parallel**.

#### Request

```typescript
interface GenerateMasksRequest {
  tasks: MaskTask[];
}

interface MaskTask {
  scene_id: string;
  composed_image: string;            // Base64 - the composed image
  mime_type: string;
  product_name: string;              // What product to mask
}
```

#### Response

```typescript
interface GenerateMasksResponse {
  masks: GeneratedMask[];
  usage?: object;
}

interface GeneratedMask {
  scene_id: string;
  mask_data: string;                 // Base64 - white=product, black=background
  mime_type: string;
}
```

---

## Error Handling

| Status Code | Meaning |
|-------------|---------|
| `400` | Bad request (validation error) |
| `500` | Internal error (parsing failed) |
| `503` | Service unavailable (Gemini API error) |

All errors return:

```json
{
  "detail": "Error message explaining what went wrong"
}
```

---

## Rate Limits & Performance

- **Parallel Processing**: Steps 2-5 process all items in parallel using `asyncio.gather()`
- **Practical Limit**: ~5-10 images per batch recommended for reasonable latency
- **Timing**: Full pipeline typically takes 30-90 seconds for 3 placements
- **Image Size**: Generated images are ~1-2MB base64 each

---

## TypeScript Client

A complete TypeScript client is available at:
`src/services/placementApi.ts`

```typescript
import {
  generateScenes,
  generateImages,
  selectProducts,
  composeBatch,
  generateMasks,
} from '../services/placementApi';

// Or use the hook for React:
import { usePlacementGeneration } from './usePlacementGeneration';
```
