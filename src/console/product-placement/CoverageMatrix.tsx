/**
 * Coverage Matrix
 *
 * Full cross-product view of products × aesthetics.
 * - Generated cells show the result clearly
 * - Ungenerated cells are faded with the aesthetic as background
 * - Click any cell to generate or view details
 */

import { useState, useEffect, useCallback } from 'react'
import {
  placementCache,
  CachedPlacement,
  hashPrompt,
  getCacheKey,
} from '../services/placementCache'
import './CoverageMatrix.css'

const API_BASE = import.meta.env.VITE_API_URL || ''

interface Product {
  id: string
  name: string
  brand: string
  imageUrl: string
}

interface Aesthetic {
  id: string
  url: string
  description: string
}

interface CoverageMatrixProps {
  products: Product[]
  aesthetics: Aesthetic[]
  currentPrompt: string
  onCacheUpdate?: () => void
}

interface CellState {
  product: Product
  aesthetic: Aesthetic
  cacheKey: string
  cached: CachedPlacement | null
  isGenerating: boolean
}

export function CoverageMatrix({
  products,
  aesthetics,
  currentPrompt,
  onCacheUpdate,
}: CoverageMatrixProps) {
  const [cacheMap, setCacheMap] = useState<Map<string, CachedPlacement>>(new Map())
  const [generatingCells, setGeneratingCells] = useState<Set<string>>(new Set())
  const [selectedCell, setSelectedCell] = useState<CellState | null>(null)
  const [stats, setStats] = useState({ total: 0, cached: 0 })

  const promptHash = hashPrompt(currentPrompt || 'default')

  // Load cache on mount and when prompt changes
  useEffect(() => {
    loadCache()
  }, [currentPrompt])

  const loadCache = async () => {
    const map = await placementCache.getAllAsMap()
    setCacheMap(map)

    // Calculate stats
    const total = products.length * aesthetics.length
    let cached = 0
    for (const product of products) {
      for (const aesthetic of aesthetics) {
        const key = getCacheKey(product.id, aesthetic.id, promptHash)
        if (map.has(key)) cached++
      }
    }
    setStats({ total, cached })
  }

  // URL to base64 helper
  const urlToBase64 = async (url: string): Promise<{ base64: string; mimeType: string }> => {
    if (url.startsWith('data:')) {
      const mimeType = url.split(';')[0]?.split(':')[1] ?? 'image/jpeg'
      const base64 = url.split(',')[1] ?? ''
      return { base64, mimeType }
    }

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

  // Generate single cell
  const generateCell = useCallback(async (product: Product, aesthetic: Aesthetic) => {
    const cacheKey = getCacheKey(product.id, aesthetic.id, promptHash)

    // Check if already cached
    if (cacheMap.has(cacheKey)) {
      return
    }

    setGeneratingCells(prev => new Set(prev).add(cacheKey))

    try {
      const { base64, mimeType } = await urlToBase64(aesthetic.url)

      const prompt = currentPrompt
        ? `Edit this image to include a ${product.brand} ${product.name}. ${currentPrompt}`
        : `Edit this image to naturally place a ${product.brand} ${product.name} into the scene. The product should blend seamlessly with the lighting and atmosphere.`

      const response = await fetch(`${API_BASE}/api/image/edit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          image: base64,
          mime_type: mimeType,
          model: 'gemini-3-pro-image-preview',
        }),
      })

      if (!response.ok) throw new Error('API error')

      const data = await response.json()

      if (data.images?.[0]) {
        const resultImageUrl = `data:${data.images[0].mime_type};base64,${data.images[0].data}`

        const placement: CachedPlacement = {
          id: crypto.randomUUID(),
          cacheKey,
          productId: product.id,
          productBrand: product.brand,
          productName: product.name,
          aestheticId: aesthetic.id,
          aestheticDescription: aesthetic.description,
          prompt,
          promptHash,
          resultImageUrl,
          createdAt: Date.now(),
          model: 'gemini-3-pro-image-preview',
        }

        await placementCache.save(placement)
        await loadCache()
        onCacheUpdate?.()
      }
    } catch (err) {
      console.error('Generation failed:', err)
    } finally {
      setGeneratingCells(prev => {
        const next = new Set(prev)
        next.delete(cacheKey)
        return next
      })
    }
  }, [cacheMap, currentPrompt, promptHash, onCacheUpdate])

  // Generate all missing
  const generateAllMissing = async () => {
    for (const product of products) {
      for (const aesthetic of aesthetics) {
        const cacheKey = getCacheKey(product.id, aesthetic.id, promptHash)
        if (!cacheMap.has(cacheKey)) {
          await generateCell(product, aesthetic)
        }
      }
    }
  }

  // Clear cache
  const clearCache = async () => {
    if (confirm('Clear all cached placements?')) {
      await placementCache.clearAll()
      await loadCache()
      onCacheUpdate?.()
    }
  }

  // Handle cell click
  const handleCellClick = (product: Product, aesthetic: Aesthetic) => {
    const cacheKey = getCacheKey(product.id, aesthetic.id, promptHash)
    const cached = cacheMap.get(cacheKey) || null
    const isGenerating = generatingCells.has(cacheKey)

    if (!cached && !isGenerating) {
      // Generate if not cached
      generateCell(product, aesthetic)
    } else {
      // Show detail
      setSelectedCell({ product, aesthetic, cacheKey, cached, isGenerating })
    }
  }

  return (
    <div className="coverage-matrix">
      {/* Header */}
      <div className="cm-header">
        <div className="cm-title">
          <h2>Coverage Matrix</h2>
          <span className="cm-stats">
            {stats.cached} / {stats.total} generated
            ({Math.round((stats.cached / stats.total) * 100) || 0}%)
          </span>
        </div>
        <div className="cm-actions">
          <button
            onClick={generateAllMissing}
            disabled={stats.cached === stats.total || generatingCells.size > 0}
            className="cm-generate-all"
          >
            {generatingCells.size > 0
              ? `Generating (${generatingCells.size})...`
              : `Generate ${stats.total - stats.cached} Missing`}
          </button>
          <button onClick={clearCache} className="cm-clear">
            Clear Cache
          </button>
        </div>
      </div>

      {/* Matrix Grid */}
      <div className="cm-grid-container">
        <div
          className="cm-grid"
          style={{
            gridTemplateColumns: `120px repeat(${aesthetics.length}, 1fr)`,
            gridTemplateRows: `auto repeat(${products.length}, 1fr)`,
          }}
        >
          {/* Corner cell */}
          <div className="cm-corner">
            <span className="cm-corner-label">Products ↓ Aesthetics →</span>
          </div>

          {/* Aesthetic headers */}
          {aesthetics.map(aesthetic => (
            <div key={aesthetic.id} className="cm-header-cell cm-aesthetic-header">
              <img src={aesthetic.url} alt={aesthetic.description} />
              <span className="cm-header-label">{aesthetic.description}</span>
            </div>
          ))}

          {/* Product rows */}
          {products.map(product => (
            <>
              {/* Product row header */}
              <div key={`header-${product.id}`} className="cm-header-cell cm-product-header">
                <img src={product.imageUrl} alt={product.name} />
                <div className="cm-product-info">
                  <span className="cm-brand">{product.brand}</span>
                  <span className="cm-name">{product.name}</span>
                </div>
              </div>

              {/* Cells for this product */}
              {aesthetics.map(aesthetic => {
                const cacheKey = getCacheKey(product.id, aesthetic.id, promptHash)
                const cached = cacheMap.get(cacheKey)
                const isGenerating = generatingCells.has(cacheKey)

                return (
                  <div
                    key={cacheKey}
                    className={`cm-cell ${cached ? 'cached' : 'not-cached'} ${isGenerating ? 'generating' : ''}`}
                    onClick={() => handleCellClick(product, aesthetic)}
                  >
                    {cached ? (
                      <img
                        src={cached.resultImageUrl}
                        alt={`${product.name} in ${aesthetic.description}`}
                        className="cm-result-image"
                      />
                    ) : (
                      <div className="cm-placeholder">
                        <img
                          src={aesthetic.url}
                          alt={aesthetic.description}
                          className="cm-faded-bg"
                        />
                        {isGenerating ? (
                          <div className="cm-generating">
                            <div className="cm-spinner" />
                          </div>
                        ) : (
                          <div className="cm-click-hint">
                            <span>+</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </>
          ))}
        </div>
      </div>

      {/* Detail Modal */}
      {selectedCell && selectedCell.cached && (
        <div className="cm-modal-overlay" onClick={() => setSelectedCell(null)}>
          <div className="cm-modal" onClick={e => e.stopPropagation()}>
            <button className="cm-modal-close" onClick={() => setSelectedCell(null)}>×</button>
            <div className="cm-modal-content">
              <div className="cm-modal-images">
                <div className="cm-modal-image">
                  <span className="cm-modal-label">Original</span>
                  <img src={selectedCell.aesthetic.url} alt="Original" />
                </div>
                <div className="cm-modal-image">
                  <span className="cm-modal-label">With Product</span>
                  <img src={selectedCell.cached.resultImageUrl} alt="Result" />
                </div>
              </div>
              <div className="cm-modal-info">
                <h3>{selectedCell.product.brand} {selectedCell.product.name}</h3>
                <p>{selectedCell.aesthetic.description}</p>
                <p className="cm-modal-prompt">{selectedCell.cached.prompt}</p>
                <span className="cm-modal-date">
                  Generated {new Date(selectedCell.cached.createdAt).toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
