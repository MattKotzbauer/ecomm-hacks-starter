/**
 * Hook for the 5-step placement generation pipeline.
 *
 * Features:
 * - Tracks liked scenes (double-click = positive signal)
 * - Keeps last 5 liked scenes for context
 * - Generates 3 continuation + 2 exploration scenes per batch
 * - Runs full pipeline: scenes → images → products → compose → masks
 */

import { useState, useCallback, useRef } from 'react'
import {
  generateScenes,
  generateImages,
  selectProducts,
  composeBatch,
  generateMasks,
  urlToBase64,
  type LikedScene,
  type SceneDescription,
  type ProductInfo,
  type PlacementResult,
} from '../../services/placementApi'

export type GenerationPhase =
  | 'idle'
  | 'generating-scenes'
  | 'generating-images'
  | 'selecting-products'
  | 'composing'
  | 'generating-masks'
  | 'complete'
  | 'error'

export interface UsePlacementGenerationOptions {
  maxLikedScenes?: number  // Default 5
  continuationCount?: number  // Default 3
  explorationCount?: number  // Default 2
}

export interface UsePlacementGenerationReturn {
  // State
  placements: PlacementResult[]
  likedScenes: LikedScene[]
  phase: GenerationPhase
  error: string | null
  isGenerating: boolean

  // Actions
  generateBatch: (writingContext: string, products: ProductInfo[]) => Promise<void>
  likeScene: (placement: PlacementResult) => void
  clearPlacements: () => void
  clearLikedScenes: () => void
}

export function usePlacementGeneration(
  options: UsePlacementGenerationOptions = {}
): UsePlacementGenerationReturn {
  const {
    maxLikedScenes = 5,
    continuationCount = 3,
    explorationCount = 2,
  } = options

  // State
  const [placements, setPlacements] = useState<PlacementResult[]>([])
  const [likedScenes, setLikedScenes] = useState<LikedScene[]>([])
  const [phase, setPhase] = useState<GenerationPhase>('idle')
  const [error, setError] = useState<string | null>(null)

  // Ref to prevent concurrent generations
  const isGeneratingRef = useRef(false)

  /**
   * Add a scene to liked list (triggered by double-click).
   * Keeps only the last maxLikedScenes.
   */
  const likeScene = useCallback((placement: PlacementResult) => {
    setLikedScenes(prev => {
      const newLiked: LikedScene = {
        description: placement.scene_description,
        mood: placement.mood,
        product_name: placement.product.name,
      }

      // Avoid duplicates
      const filtered = prev.filter(
        s => s.description !== newLiked.description
      )

      // Keep last N
      const updated = [...filtered, newLiked].slice(-maxLikedScenes)
      return updated
    })
  }, [maxLikedScenes])

  /**
   * Run the full 5-step generation pipeline.
   */
  const generateBatch = useCallback(async (
    writingContext: string,
    products: ProductInfo[]
  ) => {
    if (isGeneratingRef.current) return
    if (!writingContext.trim()) {
      setError('Please enter some text in the writing pane')
      return
    }
    if (products.length === 0) {
      setError('Please select at least one product')
      return
    }

    isGeneratingRef.current = true
    setError(null)

    try {
      // Step 1: Generate scene descriptions
      setPhase('generating-scenes')
      const scenesResponse = await generateScenes({
        writing_context: writingContext,
        liked_scenes: likedScenes,
        continuation_count: continuationCount,
        exploration_count: explorationCount,
      })

      if (scenesResponse.scenes.length === 0) {
        throw new Error('No scenes generated')
      }

      // Step 2: Generate images from scenes
      setPhase('generating-images')
      const imagesResponse = await generateImages({
        scenes: scenesResponse.scenes.map(scene => ({
          scene_id: scene.id,
          scene_description: scene.description,
          mood: scene.mood,
        })),
      })

      if (imagesResponse.images.length === 0) {
        throw new Error('No images generated')
      }

      // Step 3: Select products for each image
      setPhase('selecting-products')
      const selectResponse = await selectProducts({
        images: imagesResponse.images.map(img => ({
          scene_id: img.scene_id,
          image_data: img.image_data,
          mime_type: img.mime_type,
        })),
        products,
      })

      if (selectResponse.selections.length === 0) {
        throw new Error('No product selections made')
      }

      // Step 4: Compose products into images
      setPhase('composing')
      const composeTasks = await Promise.all(
        selectResponse.selections.map(async selection => {
          const sceneImg = imagesResponse.images.find(
            i => i.scene_id === selection.scene_id
          )
          const product = products.find(
            p => p.id === selection.selected_product_id
          )

          if (!sceneImg || !product) return null

          // Get product image as base64
          let productBase64 = ''
          let productMimeType = 'image/jpeg'
          if (product.image_url) {
            try {
              const { base64, mimeType } = await urlToBase64(product.image_url)
              productBase64 = base64
              productMimeType = mimeType
            } catch {
              // Use empty if can't load
            }
          }

          return {
            scene_id: selection.scene_id,
            scene_image: sceneImg.image_data,
            scene_mime_type: sceneImg.mime_type,
            product,
            product_image: productBase64,
            product_mime_type: productMimeType,
            placement_hint: selection.placement_hint,
          }
        })
      )

      const validComposeTasks = composeTasks.filter(Boolean) as NonNullable<typeof composeTasks[0]>[]

      const composeResponse = await composeBatch({ tasks: validComposeTasks })

      if (composeResponse.images.length === 0) {
        throw new Error('No composed images created')
      }

      // Step 5: Generate masks
      setPhase('generating-masks')
      const maskTasks = composeResponse.images.map(img => {
        const selection = selectResponse.selections.find(
          s => s.scene_id === img.scene_id
        )
        const product = products.find(
          p => p.id === selection?.selected_product_id
        )

        return {
          scene_id: img.scene_id,
          composed_image: img.image_data,
          mime_type: img.mime_type,
          product_name: product?.name || 'product',
        }
      })

      const masksResponse = await generateMasks({ tasks: maskTasks })

      // Combine results
      const newPlacements: PlacementResult[] = composeResponse.images.map(composed => {
        const scene = scenesResponse.scenes.find(s => s.id === composed.scene_id)
        const sceneImg = imagesResponse.images.find(i => i.scene_id === composed.scene_id)
        const selection = selectResponse.selections.find(s => s.scene_id === composed.scene_id)
        const mask = masksResponse.masks.find(m => m.scene_id === composed.scene_id)
        const product = products.find(p => p.id === selection?.selected_product_id)

        return {
          scene_id: composed.scene_id,
          scene_description: scene?.description || '',
          mood: scene?.mood || '',
          scene_type: scene?.scene_type || 'exploration',
          scene_image: sceneImg?.image_data || '',
          composed_image: composed.image_data,
          mask: mask?.mask_data || '',
          mime_type: composed.mime_type,
          product: product || { id: '', name: '', brand: '' },
          placement_hint: selection?.placement_hint || '',
        }
      })

      // Append to existing placements (infinite scroll)
      setPlacements(prev => [...prev, ...newPlacements])
      setPhase('complete')

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed')
      setPhase('error')
    } finally {
      isGeneratingRef.current = false
    }
  }, [likedScenes, continuationCount, explorationCount])

  const clearPlacements = useCallback(() => {
    setPlacements([])
    setPhase('idle')
    setError(null)
  }, [])

  const clearLikedScenes = useCallback(() => {
    setLikedScenes([])
  }, [])

  return {
    placements,
    likedScenes,
    phase,
    error,
    isGenerating: phase !== 'idle' && phase !== 'complete' && phase !== 'error',
    generateBatch,
    likeScene,
    clearPlacements,
    clearLikedScenes,
  }
}
