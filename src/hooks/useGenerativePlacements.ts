/**
 * useGenerativePlacements - Hook for scroll-triggered AI placement generation
 *
 * Features:
 * - Calls /api/placement/pipeline for batch generation
 * - Tracks liked placements for continuation context
 * - Configurable batch size (default 4-6 random)
 * - IndexedDB persistence for session restore
 * - Pre-generated defaults as fallback
 */

import { useState, useCallback, useEffect, useRef } from 'react'
import {
  runPipeline,
  type ProductInfo,
  type PlacementResult,
  type LikedScene,
} from '../services/placementApi'
import type { Product } from '../components/ConsumerCanvas'

// === Configuration ===

export interface GenerationConfig {
  /** Minimum batch size */
  minBatchSize: number
  /** Maximum batch size */
  maxBatchSize: number
  /** Ratio of continuation vs exploration (0.0-1.0) */
  continuationRatio: number
  /** Default writing context when none provided */
  defaultContext: string
}

const DEFAULT_CONFIG: GenerationConfig = {
  minBatchSize: 4,
  maxBatchSize: 6,
  continuationRatio: 0.6,
  defaultContext: 'Luxury lifestyle, sophisticated aesthetics, aspirational moments',
}

// === Types ===

export interface GeneratedPlacement {
  id: string
  sceneId: string
  description: string
  mood: string
  sceneType: 'continuation' | 'exploration'

  // Images (base64)
  sceneImage: string      // Original scene without product
  composedImage: string   // Scene with product placed
  mask: string            // Product segmentation mask
  mimeType: string

  // Product info
  product: Product
  placementHint: string
  rationale: string

  // UI state
  isLiked: boolean
}

interface ProductsJson {
  collections: Array<{
    id: string
    name: string
    displayName: string
    products: Array<{
      id: string
      name: string
      img: string
      price?: number
      description?: string
      targeting?: {
        demographics?: string[]
        interests?: string[]
        scenes?: string[]
        semantic?: string
      }
    }>
  }>
}

// === IndexedDB Helpers ===

const DB_NAME = 'generative-gallery-db'
const DB_VERSION = 1
const STORES = {
  placements: 'placements',
  liked: 'liked',
  context: 'context',
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains(STORES.placements)) {
        db.createObjectStore(STORES.placements, { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains(STORES.liked)) {
        db.createObjectStore(STORES.liked, { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains(STORES.context)) {
        db.createObjectStore(STORES.context, { keyPath: 'key' })
      }
    }
  })
}

async function savePlacementsToIDB(placements: GeneratedPlacement[]): Promise<void> {
  const db = await openDB()
  const tx = db.transaction(STORES.placements, 'readwrite')
  const store = tx.objectStore(STORES.placements)

  store.clear()
  placements.forEach((p) => store.put(p))

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => { db.close(); resolve() }
    tx.onerror = () => { db.close(); reject(tx.error) }
  })
}

async function loadPlacementsFromIDB(): Promise<GeneratedPlacement[]> {
  try {
    const db = await openDB()
    const tx = db.transaction(STORES.placements, 'readonly')
    const store = tx.objectStore(STORES.placements)
    const request = store.getAll()

    return new Promise((resolve, reject) => {
      request.onsuccess = () => { db.close(); resolve(request.result || []) }
      request.onerror = () => { db.close(); reject(request.error) }
    })
  } catch {
    return []
  }
}

async function saveContextToIDB(context: string): Promise<void> {
  const db = await openDB()
  const tx = db.transaction(STORES.context, 'readwrite')
  tx.objectStore(STORES.context).put({ key: 'writingContext', value: context })

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => { db.close(); resolve() }
    tx.onerror = () => { db.close(); reject(tx.error) }
  })
}

async function loadContextFromIDB(): Promise<string | null> {
  try {
    const db = await openDB()
    const tx = db.transaction(STORES.context, 'readonly')
    const request = tx.objectStore(STORES.context).get('writingContext')

    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        db.close()
        resolve(request.result?.value ?? null)
      }
      request.onerror = () => { db.close(); reject(request.error) }
    })
  } catch {
    return null
  }
}

async function clearAllIDB(): Promise<void> {
  const db = await openDB()
  const tx = db.transaction([STORES.placements, STORES.liked, STORES.context], 'readwrite')
  tx.objectStore(STORES.placements).clear()
  tx.objectStore(STORES.liked).clear()
  tx.objectStore(STORES.context).clear()

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => { db.close(); resolve() }
    tx.onerror = () => { db.close(); reject(tx.error) }
  })
}

// === Hook ===

export interface UseGenerativePlacementsOptions {
  config?: Partial<GenerationConfig>
  autoLoad?: boolean
}

export function useGenerativePlacements(options: UseGenerativePlacementsOptions = {}) {
  const config = { ...DEFAULT_CONFIG, ...options.config }
  const autoLoad = options.autoLoad ?? true

  // State
  const [placements, setPlacements] = useState<GeneratedPlacement[]>([])
  const [products, setProducts] = useState<ProductInfo[]>([])
  const [productsLoaded, setProductsLoaded] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [writingContext, setWritingContextState] = useState(config.defaultContext)

  // Track if initial load has happened
  const hasLoadedRef = useRef(false)
  const placementIdCounter = useRef(0)

  // Load products from JSON
  useEffect(() => {
    fetch('/data/products.json')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load products')
        return res.json() as Promise<ProductsJson>
      })
      .then((data) => {
        // Flatten all products from all collections into ProductInfo format
        const allProducts: ProductInfo[] = []
        for (const collection of data.collections) {
          for (const product of collection.products) {
            allProducts.push({
              id: product.id,
              name: product.name,
              brand: collection.displayName,
              price: product.price,
              description: product.description,
              image_url: product.img,
              target_demographics: product.targeting?.demographics,
              target_interests: product.targeting?.interests,
              scene_preferences: product.targeting?.scenes,
              semantic_filter: product.targeting?.semantic,
            })
          }
        }
        setProducts(allProducts)
        setProductsLoaded(true)
      })
      .catch((err) => {
        console.error('Failed to load products:', err)
        setError('Failed to load product catalog')
        setProductsLoaded(true) // Still mark as loaded to unblock UI
      })
  }, [])

  // Track IDB load completion separately
  const [idbLoaded, setIdbLoaded] = useState(false)

  // Load saved placements from IndexedDB on mount
  useEffect(() => {
    if (hasLoadedRef.current) return
    hasLoadedRef.current = true

    // If autoLoad is disabled, skip IDB loading and mark as ready
    if (!autoLoad) {
      setIdbLoaded(true)
      return
    }

    Promise.all([loadPlacementsFromIDB(), loadContextFromIDB()])
      .then(([savedPlacements, savedContext]) => {
        if (savedPlacements.length > 0) {
          setPlacements(savedPlacements)
          // Update counter to avoid ID collisions
          const maxId = savedPlacements.reduce((max, p) => {
            const num = parseInt(p.id.replace('gen-', ''), 10)
            return isNaN(num) ? max : Math.max(max, num)
          }, 0)
          placementIdCounter.current = maxId
        }
        if (savedContext) {
          setWritingContextState(savedContext)
        }
        setIdbLoaded(true)
      })
      .catch(() => {
        setIdbLoaded(true)
      })
  }, [autoLoad])

  // Only mark as fully loaded when both products and IDB are ready
  useEffect(() => {
    if (productsLoaded && idbLoaded) {
      setIsLoading(false)
    }
  }, [productsLoaded, idbLoaded])

  // Save placements to IndexedDB when they change
  useEffect(() => {
    if (placements.length > 0 && hasLoadedRef.current) {
      savePlacementsToIDB(placements).catch((e) =>
        console.warn('Failed to save placements:', e)
      )
    }
  }, [placements])

  // Update writing context (also saves to IDB)
  const setWritingContext = useCallback((context: string) => {
    setWritingContextState(context)
    saveContextToIDB(context).catch((e) =>
      console.warn('Failed to save context:', e)
    )
  }, [])

  // Convert API PlacementResult to our GeneratedPlacement
  const toGeneratedPlacement = useCallback(
    (result: PlacementResult): GeneratedPlacement => {
      const id = `gen-${++placementIdCounter.current}`
      // Look up price from loaded products catalog
      const catalogProduct = products.find(p => p.id === result.product.id)
      const price = catalogProduct?.price ?? result.product.price ?? 0
      return {
        id,
        sceneId: result.scene_id,
        description: result.scene_description,
        mood: result.mood,
        sceneType: result.scene_type as 'continuation' | 'exploration',
        sceneImage: result.scene_image,
        composedImage: result.composed_image,
        mask: result.mask,
        mimeType: result.mime_type,
        product: {
          id: result.product.id,
          name: result.product.name,
          brand: result.product.brand,
          price,
          currency: 'USD',
          imageUrl: result.product.image_url || '',
          description: result.product.description,
        },
        placementHint: result.placement_hint,
        rationale: result.rationale || '',
        isLiked: false,
      }
    },
    [products]
  )

  // Generate a batch of placements
  const generateBatch = useCallback(
    async (customContext?: string): Promise<GeneratedPlacement[]> => {
      if (products.length === 0) {
        setError('No products available')
        return []
      }

      setIsGenerating(true)
      setError(null)

      try {
        // Random batch size between min and max
        const batchSize =
          config.minBatchSize +
          Math.floor(Math.random() * (config.maxBatchSize - config.minBatchSize + 1))

        // Build liked scenes from liked placements
        const likedScenes: LikedScene[] = placements
          .filter((p) => p.isLiked)
          .slice(-5) // Last 5 liked
          .map((p) => ({
            description: p.description,
            mood: p.mood,
            product_name: p.product.name,
          }))

        const response = await runPipeline({
          writing_context: customContext || writingContext || config.defaultContext,
          products,
          liked_scenes: likedScenes,
          scene_count: batchSize,
          continuation_ratio: likedScenes.length > 0 ? config.continuationRatio : 0,
        })

        const newPlacements = response.placements.map(toGeneratedPlacement)

        setPlacements((prev) => [...prev, ...newPlacements])

        return newPlacements
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Generation failed'
        setError(message)
        console.error('Generation failed:', err)
        return []
      } finally {
        setIsGenerating(false)
      }
    },
    [products, placements, writingContext, config, toGeneratedPlacement]
  )

  // Toggle like status on a placement
  const toggleLike = useCallback((placementId: string) => {
    setPlacements((prev) =>
      prev.map((p) =>
        p.id === placementId ? { ...p, isLiked: !p.isLiked } : p
      )
    )
  }, [])

  // Remove a placement
  const removePlacement = useCallback((placementId: string) => {
    setPlacements((prev) => prev.filter((p) => p.id !== placementId))
  }, [])

  // Clear all placements and reset
  const clearAll = useCallback(async () => {
    setPlacements([])
    setError(null)
    placementIdCounter.current = 0
    await clearAllIDB()
  }, [])

  // Get liked placements
  const likedPlacements = placements.filter((p) => p.isLiked)

  return {
    // State
    placements,
    products,
    productsLoaded,
    likedPlacements,
    isLoading,
    isGenerating,
    error,
    writingContext,

    // Actions
    generateBatch,
    toggleLike,
    removePlacement,
    clearAll,
    setWritingContext,

    // Config
    config,
  }
}
