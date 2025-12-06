/**
 * Placement Cache Service
 *
 * IndexedDB-based cache for generated product placements.
 * Allows inspection of what's been generated vs not.
 */

const DB_NAME = 'product-placement-cache'
const DB_VERSION = 1
const STORE_NAME = 'placements'

export interface CachedPlacement {
  id: string                      // UUID
  cacheKey: string                // productId-aestheticId-promptHash

  // References
  productId: string
  productBrand: string
  productName: string
  aestheticId: string
  aestheticDescription: string

  // Prompt
  prompt: string
  promptHash: string

  // Result image as base64 data URL (simpler than blobs for display)
  resultImageUrl: string

  // Metadata
  createdAt: number               // timestamp
  model: string

  // User annotations
  favorite?: boolean
  rating?: number
  notes?: string
}

// Simple hash function for prompts
export function hashPrompt(prompt: string): string {
  let hash = 0
  for (let i = 0; i < prompt.length; i++) {
    const char = prompt.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36)
}

// Generate cache key
export function getCacheKey(productId: string, aestheticId: string, promptHash: string): string {
  return `${productId}::${aestheticId}::${promptHash}`
}

class PlacementCacheService {
  private db: IDBDatabase | null = null
  private dbPromise: Promise<IDBDatabase> | null = null

  // Initialize database
  private async getDB(): Promise<IDBDatabase> {
    if (this.db) return this.db

    if (this.dbPromise) return this.dbPromise

    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION)

      request.onerror = () => reject(request.error)

      request.onsuccess = () => {
        this.db = request.result
        resolve(this.db)
      }

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result

        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' })
          store.createIndex('cacheKey', 'cacheKey', { unique: true })
          store.createIndex('productId', 'productId', { unique: false })
          store.createIndex('aestheticId', 'aestheticId', { unique: false })
          store.createIndex('createdAt', 'createdAt', { unique: false })
        }
      }
    })

    return this.dbPromise
  }

  // Save a placement
  async save(placement: CachedPlacement): Promise<void> {
    const db = await this.getDB()

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)

      const request = store.put(placement)
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  // Get by cache key
  async getByCacheKey(cacheKey: string): Promise<CachedPlacement | null> {
    const db = await this.getDB()

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const store = tx.objectStore(STORE_NAME)
      const index = store.index('cacheKey')

      const request = index.get(cacheKey)
      request.onsuccess = () => resolve(request.result || null)
      request.onerror = () => reject(request.error)
    })
  }

  // Check if cached (quick lookup)
  async has(productId: string, aestheticId: string, promptHash: string): Promise<boolean> {
    const cacheKey = getCacheKey(productId, aestheticId, promptHash)
    const result = await this.getByCacheKey(cacheKey)
    return result !== null
  }

  // Get cached result
  async get(productId: string, aestheticId: string, promptHash: string): Promise<CachedPlacement | null> {
    const cacheKey = getCacheKey(productId, aestheticId, promptHash)
    return this.getByCacheKey(cacheKey)
  }

  // Get all placements
  async getAll(): Promise<CachedPlacement[]> {
    const db = await this.getDB()

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const store = tx.objectStore(STORE_NAME)

      const request = store.getAll()
      request.onsuccess = () => resolve(request.result || [])
      request.onerror = () => reject(request.error)
    })
  }

  // Get all placements as a map by cacheKey for quick lookup
  async getAllAsMap(): Promise<Map<string, CachedPlacement>> {
    const all = await this.getAll()
    const map = new Map<string, CachedPlacement>()
    for (const p of all) {
      map.set(p.cacheKey, p)
    }
    return map
  }

  // Delete a placement
  async delete(id: string): Promise<void> {
    const db = await this.getDB()

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)

      const request = store.delete(id)
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  // Clear all
  async clearAll(): Promise<void> {
    const db = await this.getDB()

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)

      const request = store.clear()
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  // Get count
  async count(): Promise<number> {
    const db = await this.getDB()

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const store = tx.objectStore(STORE_NAME)

      const request = store.count()
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  }

  // Get storage estimate
  async getStorageEstimate(): Promise<{ used: number; quota: number } | null> {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      const estimate = await navigator.storage.estimate()
      return {
        used: estimate.usage || 0,
        quota: estimate.quota || 0,
      }
    }
    return null
  }
}

// Singleton instance
export const placementCache = new PlacementCacheService()
