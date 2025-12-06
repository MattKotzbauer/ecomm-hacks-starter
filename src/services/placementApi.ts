/**
 * Placement API client for the 5-step generation pipeline.
 *
 * Pipeline:
 * 1. Generate scene descriptions from writing context
 * 2. Generate base images from scenes
 * 3. Select products for each image
 * 4. Compose products into images
 * 5. Generate masks for product regions
 */

const API_BASE = import.meta.env.VITE_API_URL || ''

// --- Error Handling ---

export class PlacementApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public isNetworkError: boolean = false
  ) {
    super(message)
    this.name = 'PlacementApiError'
  }
}

async function handleResponse<T>(response: Response, operation: string): Promise<T> {
  if (!response.ok) {
    let detail = `${operation} failed`
    try {
      const error = await response.json()
      detail = error.detail || detail
    } catch {
      // Response wasn't JSON
    }
    throw new PlacementApiError(detail, response.status)
  }
  return response.json()
}

function handleNetworkError(error: unknown, operation: string): never {
  if (error instanceof PlacementApiError) throw error

  const isNetwork =
    error instanceof TypeError &&
    (error.message.includes('Failed to fetch') ||
      error.message.includes('NetworkError'))

  if (isNetwork) {
    throw new PlacementApiError('Network error', 0, true)
  }

  throw new PlacementApiError(
    error instanceof Error ? error.message : `${operation} failed`,
    0
  )
}

// --- Types ---

// Shared
export interface ProductInfo {
  id: string
  name: string
  brand: string
  price?: number
  description?: string
  image_url?: string
  // Advertiser targeting preferences
  target_demographics?: string[]  // e.g. ["18-24", "25-34", "35-44", "45+"]
  target_interests?: string[]     // e.g. ["Fashion", "Luxury", "Art", "Travel"]
  scene_preferences?: string[]    // e.g. ["Interior", "Café", "Boutique"]
  semantic_filter?: string        // e.g. "warm lighting, sophisticated settings"
}

// API 1: Scene Generation
export interface LikedScene {
  description: string
  mood: string
  product_name?: string
}

export interface ScenesRequest {
  writing_context: string
  liked_scenes?: LikedScene[]
  continuation_count?: number  // default 3
  exploration_count?: number   // default 2
}

export interface SceneDescription {
  id: string
  description: string
  mood: string
  scene_type: 'continuation' | 'exploration'
}

export interface ScenesResponse {
  scenes: SceneDescription[]
  usage?: Record<string, number>
}

// API 2: Image Generation
export interface ImageGenRequest {
  scene_id: string
  scene_description: string
  mood: string
}

export interface GenerateImagesRequest {
  scenes: ImageGenRequest[]
}

export interface GeneratedImage {
  scene_id: string
  image_data: string  // base64
  mime_type: string
}

export interface GenerateImagesResponse {
  images: GeneratedImage[]
  usage?: Record<string, number>
}

// API 3: Product Selection
export interface ImageForSelection {
  scene_id: string
  image_data: string  // base64
  mime_type: string
}

export interface SelectProductsRequest {
  images: ImageForSelection[]
  products: ProductInfo[]
  writing_context?: string  // Writer's context for audience matching
}

export interface ProductSelection {
  scene_id: string
  selected_product_id: string  // "NONE" if no good match
  placement_hint: string
  rationale: string
  match_score: number  // 1-10 confidence score for audience match
}

export interface SelectProductsResponse {
  selections: ProductSelection[]
  usage?: Record<string, number>
}

// API 4: Image Composition
export interface CompositionTask {
  scene_id: string
  scene_image: string  // base64
  scene_mime_type: string
  product: ProductInfo
  product_image: string  // base64
  product_mime_type: string
  placement_hint: string
}

export interface ComposeBatchRequest {
  tasks: CompositionTask[]
}

export interface ComposedImage {
  scene_id: string
  image_data: string  // base64
  mime_type: string
}

export interface ComposeBatchResponse {
  images: ComposedImage[]
  usage?: Record<string, number>
}

// API 5: Mask Generation
export interface MaskTask {
  scene_id: string
  composed_image: string  // base64
  mime_type: string
  product_name: string
}

export interface GenerateMasksRequest {
  tasks: MaskTask[]
}

export interface GeneratedMask {
  scene_id: string
  mask_data: string  // base64 (white = product)
  mime_type: string
}

export interface GenerateMasksResponse {
  masks: GeneratedMask[]
  usage?: Record<string, number>
}

// Combined result for frontend
export interface PlacementResult {
  scene_id: string
  scene_description: string
  mood: string
  scene_type: 'continuation' | 'exploration'
  scene_image: string  // base64
  composed_image: string  // base64
  mask: string  // base64
  mime_type: string
  product: ProductInfo
  placement_hint: string
  rationale?: string
}

// --- API Functions ---

/**
 * Step 1: Generate scene descriptions from writing context.
 * Splits into continuation (matching preferences) and exploration (new directions).
 */
export async function generateScenes(request: ScenesRequest): Promise<ScenesResponse> {
  try {
    const response = await fetch(`${API_BASE}/api/placement/scenes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        writing_context: request.writing_context,
        liked_scenes: request.liked_scenes || [],
        continuation_count: request.continuation_count ?? 3,
        exploration_count: request.exploration_count ?? 2,
      }),
    })
    return handleResponse<ScenesResponse>(response, 'Scene generation')
  } catch (error) {
    throw handleNetworkError(error, 'Scene generation')
  }
}

/**
 * Step 2: Generate images from scene descriptions (parallel).
 */
export async function generateImages(request: GenerateImagesRequest): Promise<GenerateImagesResponse> {
  try {
    const response = await fetch(`${API_BASE}/api/placement/generate-images`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    })
    return handleResponse<GenerateImagesResponse>(response, 'Image generation')
  } catch (error) {
    throw handleNetworkError(error, 'Image generation')
  }
}

/**
 * Step 3: Select products for each generated image.
 */
export async function selectProducts(request: SelectProductsRequest): Promise<SelectProductsResponse> {
  try {
    const response = await fetch(`${API_BASE}/api/placement/select-products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    })
    return handleResponse<SelectProductsResponse>(response, 'Product selection')
  } catch (error) {
    throw handleNetworkError(error, 'Product selection')
  }
}

/**
 * Step 4: Compose products into scene images.
 */
export async function composeBatch(request: ComposeBatchRequest): Promise<ComposeBatchResponse> {
  try {
    const response = await fetch(`${API_BASE}/api/placement/compose-batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    })
    return handleResponse<ComposeBatchResponse>(response, 'Image composition')
  } catch (error) {
    throw handleNetworkError(error, 'Image composition')
  }
}

/**
 * Step 5: Generate segmentation masks for product regions.
 */
export async function generateMasks(request: GenerateMasksRequest): Promise<GenerateMasksResponse> {
  try {
    const response = await fetch(`${API_BASE}/api/placement/generate-masks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    })
    return handleResponse<GenerateMasksResponse>(response, 'Mask generation')
  } catch (error) {
    throw handleNetworkError(error, 'Mask generation')
  }
}

/**
 * Convert URL to base64 for API calls.
 */
export async function urlToBase64(url: string): Promise<{ base64: string; mimeType: string }> {
  const response = await fetch(url)
  const blob = await response.blob()
  const mimeType = blob.type || 'image/jpeg'

  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      const dataUrl = reader.result as string
      const base64 = dataUrl.split(',')[1] ?? ''
      resolve({ base64, mimeType })
    }
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}


// === Unified Pipeline (All 5 Steps) ===

export interface PipelineRequest {
  writing_context: string
  products: ProductInfo[]
  liked_scenes?: LikedScene[]
  scene_count?: number           // 1-10, default 3
  continuation_ratio?: number    // 0.0-1.0, default 0.6
}

export interface PipelineStats {
  total_elapsed: number
  placements_generated: number
  message?: string  // e.g. "No products matched the writer's audience"
  steps?: {
    '1_scenes': { elapsed: number; count: number }
    '2_images': { elapsed: number; count: number }
    '3_selections': { elapsed: number; count: number; skipped_mismatches?: number }
    '4_compose': { elapsed: number; count: number }
    '5_masks': { elapsed: number; count: number }
  }
}

export interface PipelineResponse {
  placements: PlacementResult[]
  stats: PipelineStats | null
}

/**
 * Run the complete 5-step pipeline in one call.
 * This is the simplest way to generate placements.
 *
 * @param request - PipelineRequest with writing context and products
 * @returns All placement results with timing stats
 */
export async function runPipeline(request: PipelineRequest): Promise<PipelineResponse> {
  try {
    const response = await fetch(`${API_BASE}/api/placement/pipeline`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        writing_context: request.writing_context,
        products: request.products,
        liked_scenes: request.liked_scenes ?? [],
        scene_count: request.scene_count ?? 3,
        continuation_ratio: request.continuation_ratio ?? 0.6,
      }),
    })
    return handleResponse<PipelineResponse>(response, 'Pipeline')
  } catch (error) {
    throw handleNetworkError(error, 'Pipeline')
  }
}


// === Products Save API ===

export interface ProductTargetingData {
  demographics: string[]
  interests: string[]
  scenes: string[]
  semantic?: string
}

export interface ProductData {
  id: string
  name: string
  img: string
  description?: string
  targeting?: ProductTargetingData
}

export interface CollectionData {
  id: string
  name: string
  displayName: string
  products: ProductData[]
}

export interface ProductsData {
  collections: CollectionData[]
}

export interface SaveProductsResponse {
  success: boolean
  message: string
  collection_count: number
  product_count: number
}

/**
 * Save products to the server (persists changes to products.json).
 */
export async function saveProducts(data: ProductsData): Promise<SaveProductsResponse> {
  try {
    const response = await fetch(`${API_BASE}/api/products/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    return handleResponse<SaveProductsResponse>(response, 'Save products')
  } catch (error) {
    throw handleNetworkError(error, 'Save products')
  }
}
