/**
 * Product Placement Console
 *
 * Advertiser console for testing product placement with Nano Banana Pro.
 * Features:
 * - Multi-select products and aesthetics (matrix generation)
 * - Custom image upload
 * - Editable placement presets
 * - Batch processing
 */

import { useState, useCallback, useRef, useEffect } from 'react'
import './ProductPlacement.css'
import { CoverageMatrix } from './CoverageMatrix'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'
const STORAGE_KEY = 'product-placement-presets'

// Types
interface Product {
  id: string
  name: string
  brand: string
  imageUrl: string
  description: string
  isCustom?: boolean
}

interface AestheticImage {
  id: string
  url: string
  description: string
  isCustom?: boolean
}

interface PlacementPreset {
  id: string
  label: string
  prompt: string
  isDefault?: boolean
}

interface MatrixCell {
  id: string
  product: Product
  aesthetic: AestheticImage
  status: 'pending' | 'generating' | 'complete' | 'error'
  resultUrl?: string
  prompt: string
}

// Default presets
const DEFAULT_PRESETS: PlacementPreset[] = [
  { id: 'on-table', label: 'On table', prompt: 'Place the product naturally on a surface or table visible in the scene. It should look like it belongs there.', isDefault: true },
  { id: 'foreground', label: 'In foreground', prompt: 'Position the product prominently in the foreground of the image, as if someone just set it down.', isDefault: true },
  { id: 'subtle', label: 'Subtle background', prompt: 'Place the product subtly in the background, partially visible or obscured. It should be discoverable but not obvious.', isDefault: true },
  { id: 'in-use', label: 'Being used', prompt: 'Show the product being actively used or worn by someone in the scene, or positioned as if just used.', isDefault: true },
  { id: 'editorial', label: 'Editorial', prompt: 'Place in an artistic, editorial fashion photography style. The product should feel curated and intentional.', isDefault: true },
  { id: 'minimal', label: 'Minimal', prompt: 'Minimal, clean placement that complements rather than dominates the scene. Less is more.', isDefault: true },
]

// Pre-generated products
const PRELOADED_PRODUCTS: Product[] = [
  { id: 'prada-1', name: 'Saffiano Leather Bag', brand: 'Prada', imageUrl: '/prototype-assets/products/prada-1.jpg', description: 'Classic black saffiano leather handbag' },
  { id: 'prada-2', name: 'Re-Nylon Backpack', brand: 'Prada', imageUrl: '/prototype-assets/products/prada-2.jpg', description: 'Regenerated nylon backpack' },
  { id: 'prada-3', name: 'Triangle Logo Sunglasses', brand: 'Prada', imageUrl: '/prototype-assets/products/prada-3.jpg', description: 'Acetate sunglasses with iconic triangle' },
  { id: 'lv-1', name: 'Neverfull MM', brand: 'Louis Vuitton', imageUrl: '/prototype-assets/products/lv-1.jpg', description: 'Monogram canvas tote bag' },
  { id: 'lv-2', name: 'Keepall 45', brand: 'Louis Vuitton', imageUrl: '/prototype-assets/products/lv-2.jpg', description: 'Iconic travel duffle' },
  { id: 'lv-3', name: 'Capucines Mini', brand: 'Louis Vuitton', imageUrl: '/prototype-assets/products/lv-3.jpg', description: 'Refined leather handbag' },
  { id: 'acne-1', name: 'Musubi Bag', brand: 'Acne Studios', imageUrl: '/prototype-assets/products/acne-1.jpg', description: 'Knotted leather shoulder bag' },
  { id: 'acne-2', name: 'Oversized Wool Scarf', brand: 'Acne Studios', imageUrl: '/prototype-assets/products/acne-2.jpg', description: 'Chunky knit wool scarf' },
  { id: 'acne-3', name: 'Jensen Boots', brand: 'Acne Studios', imageUrl: '/prototype-assets/products/acne-3.jpg', description: 'Pointed toe ankle boots' },
]

// Pre-generated aesthetics
const PRELOADED_AESTHETICS: AestheticImage[] = [
  { id: 'cafe-table', url: '/prototype-assets/aesthetics/cafe-table.jpg', description: 'Cafe table at golden hour' },
  { id: 'rain-window', url: '/prototype-assets/aesthetics/rain-window.jpg', description: 'Rain-streaked Paris window' },
  { id: 'cobblestone', url: '/prototype-assets/aesthetics/cobblestone.jpg', description: 'Le Marais cobblestone street' },
  { id: 'seine-bank', url: '/prototype-assets/aesthetics/seine-bank.jpg', description: 'Seine riverbank at sunset' },
  { id: 'boutique', url: '/prototype-assets/aesthetics/boutique.jpg', description: 'Vintage boutique interior' },
  { id: 'tuileries', url: '/prototype-assets/aesthetics/tuileries.jpg', description: 'Tuileries autumn bench' },
  { id: 'artist-studio', url: '/prototype-assets/aesthetics/artist-studio.jpg', description: 'Montmartre artist studio' },
  { id: 'bookshop', url: '/prototype-assets/aesthetics/bookshop.jpg', description: 'Left Bank bookshop' },
  { id: 'palais-royal', url: '/prototype-assets/aesthetics/palais-royal.jpg', description: 'Palais Royal at blue hour' },
  { id: 'rooftop', url: '/prototype-assets/aesthetics/rooftop.jpg', description: 'Parisian rooftop terrace' },
]

export default function ProductPlacement() {
  // Assets state
  const [products, setProducts] = useState<Product[]>(PRELOADED_PRODUCTS)
  const [aesthetics, setAesthetics] = useState<AestheticImage[]>(PRELOADED_AESTHETICS)
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set())
  const [selectedAesthetics, setSelectedAesthetics] = useState<Set<string>>(new Set())

  // Preset state
  const [presets, setPresets] = useState<PlacementPreset[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved ? JSON.parse(saved) : DEFAULT_PRESETS
  })
  const [editingPreset, setEditingPreset] = useState<string | null>(null)
  const [editLabel, setEditLabel] = useState('')
  const [editPrompt, setEditPrompt] = useState('')

  // Generation state
  const [customPrompt, setCustomPrompt] = useState('')
  const [matrix, setMatrix] = useState<MatrixCell[]>([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'select' | 'matrix' | 'coverage'>('select')
  const [_cacheVersion, setCacheVersion] = useState(0)

  const productInputRef = useRef<HTMLInputElement>(null)
  const aestheticInputRef = useRef<HTMLInputElement>(null)

  // Save presets to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(presets))
  }, [presets])

  // Selection handlers
  const toggleProduct = (id: string) => {
    setSelectedProducts(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAesthetic = (id: string) => {
    setSelectedAesthetics(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // Preset handlers
  const applyPreset = (preset: PlacementPreset) => {
    setCustomPrompt(preset.prompt)
  }

  const startEditPreset = (preset: PlacementPreset) => {
    setEditingPreset(preset.id)
    setEditLabel(preset.label)
    setEditPrompt(preset.prompt)
  }

  const savePreset = () => {
    if (!editingPreset) return
    setPresets(prev => prev.map(p =>
      p.id === editingPreset
        ? { ...p, label: editLabel, prompt: editPrompt }
        : p
    ))
    setEditingPreset(null)
  }

  const cancelEdit = () => {
    setEditingPreset(null)
    setEditLabel('')
    setEditPrompt('')
  }

  const addNewPreset = () => {
    const newPreset: PlacementPreset = {
      id: `custom-${Date.now()}`,
      label: 'New Preset',
      prompt: 'Enter your placement instructions here...',
    }
    setPresets(prev => [...prev, newPreset])
    startEditPreset(newPreset)
  }

  const deletePreset = (id: string) => {
    setPresets(prev => prev.filter(p => p.id !== id))
    if (editingPreset === id) cancelEdit()
  }

  const resetPresets = () => {
    setPresets(DEFAULT_PRESETS)
    cancelEdit()
  }

  // Image upload handler
  const handleImageUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    type: 'product' | 'aesthetic'
  ) => {
    const files = e.target.files
    if (!files) return

    for (const file of Array.from(files)) {
      const reader = new FileReader()
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string
        const id = `custom-${Date.now()}-${Math.random().toString(36).slice(2)}`

        if (type === 'product') {
          const name = file.name.replace(/\.[^/.]+$/, '')
          setProducts(prev => [...prev, {
            id,
            name,
            brand: 'Custom',
            imageUrl: dataUrl,
            description: `Custom: ${name}`,
            isCustom: true,
          }])
        } else {
          setAesthetics(prev => [...prev, {
            id,
            url: dataUrl,
            description: `Custom: ${file.name}`,
            isCustom: true,
          }])
        }
      }
      reader.readAsDataURL(file)
    }
    e.target.value = ''
  }

  // URL to base64
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

  // Generate matrix
  const generateMatrix = useCallback(async () => {
    const selectedProductList = products.filter(p => selectedProducts.has(p.id))
    const selectedAestheticList = aesthetics.filter(a => selectedAesthetics.has(a.id))

    if (selectedProductList.length === 0 || selectedAestheticList.length === 0) {
      setError('Select at least one product and one aesthetic')
      return
    }

    const basePrompt = customPrompt ||
      'Place the product naturally in the scene, maintaining the original lighting and atmosphere.'

    const cells: MatrixCell[] = []
    for (const product of selectedProductList) {
      for (const aesthetic of selectedAestheticList) {
        cells.push({
          id: `${product.id}-${aesthetic.id}`,
          product,
          aesthetic,
          status: 'pending',
          prompt: `Edit this image to include a ${product.brand} ${product.name}. ${basePrompt}`,
        })
      }
    }

    setMatrix(cells)
    setViewMode('matrix')
    setIsGenerating(true)
    setError(null)

    for (const cell of cells) {
      setMatrix(prev => prev.map(c =>
        c.id === cell.id ? { ...c, status: 'generating' } : c
      ))

      try {
        const { base64, mimeType } = await urlToBase64(cell.aesthetic.url)

        const response = await fetch(`${API_BASE}/api/image/edit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: cell.prompt,
            image: base64,
            mime_type: mimeType,
            model: 'gemini-3-pro-image-preview',
          }),
        })

        if (!response.ok) throw new Error(`API error: ${response.statusText}`)

        const data = await response.json()

        if (data.images?.[0]) {
          const resultUrl = `data:${data.images[0].mime_type};base64,${data.images[0].data}`
          setMatrix(prev => prev.map(c =>
            c.id === cell.id ? { ...c, status: 'complete', resultUrl } : c
          ))
        } else {
          throw new Error('No image returned')
        }
      } catch (err) {
        console.error(`Failed: ${cell.id}`, err)
        setMatrix(prev => prev.map(c =>
          c.id === cell.id ? { ...c, status: 'error' } : c
        ))
      }
    }

    setIsGenerating(false)
  }, [products, aesthetics, selectedProducts, selectedAesthetics, customPrompt])

  const selectedProductCount = selectedProducts.size
  const selectedAestheticCount = selectedAesthetics.size
  const totalCombinations = selectedProductCount * selectedAestheticCount

  return (
    <div className="pp-console">
      <div className="pp-texture" />

      {/* Header */}
      <header className="pp-header">
        <div className="pp-header-left">
          <h1>Product Placement</h1>
          <span className="pp-subtitle">Console · Nano Banana Pro</span>
        </div>
        <div className="pp-header-right">
          <div className="pp-view-toggle">
            <button
              className={viewMode === 'select' ? 'active' : ''}
              onClick={() => setViewMode('select')}
            >
              Select
            </button>
            <button
              className={viewMode === 'coverage' ? 'active' : ''}
              onClick={() => setViewMode('coverage')}
            >
              Coverage Matrix
            </button>
            <button
              className={viewMode === 'matrix' ? 'active' : ''}
              onClick={() => setViewMode('matrix')}
              disabled={matrix.length === 0}
            >
              Results ({matrix.filter(c => c.status === 'complete').length}/{matrix.length})
            </button>
          </div>
        </div>
      </header>

      {error && (
        <div className="pp-error">
          <span>{error}</span>
          <button onClick={() => setError(null)}>×</button>
        </div>
      )}

      {viewMode === 'coverage' ? (
        <CoverageMatrix
          products={products.map(p => ({
            id: p.id,
            name: p.name,
            brand: p.brand,
            imageUrl: p.imageUrl,
          }))}
          aesthetics={aesthetics.map(a => ({
            id: a.id,
            url: a.url,
            description: a.description,
          }))}
          currentPrompt={customPrompt}
          onCacheUpdate={() => setCacheVersion(v => v + 1)}
        />
      ) : viewMode === 'select' ? (
        <div className="pp-workspace">
          {/* Products */}
          <section className="pp-panel pp-products">
            <div className="pp-panel-header">
              <h2>Products</h2>
              <div className="pp-panel-actions">
                <span className="pp-count">{selectedProductCount}</span>
                <button onClick={() => setSelectedProducts(new Set(products.map(p => p.id)))}>All</button>
                <button onClick={() => setSelectedProducts(new Set())}>None</button>
                <button className="pp-upload" onClick={() => productInputRef.current?.click()}>+ Upload</button>
                <input
                  ref={productInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  hidden
                  onChange={(e) => handleImageUpload(e, 'product')}
                />
              </div>
            </div>
            <div className="pp-grid pp-products-grid">
              {products.map(product => (
                <div
                  key={product.id}
                  className={`pp-card ${selectedProducts.has(product.id) ? 'selected' : ''}`}
                  onClick={() => toggleProduct(product.id)}
                >
                  <div className="pp-checkbox">{selectedProducts.has(product.id) ? '✓' : ''}</div>
                  <img src={product.imageUrl} alt={product.name} />
                  <div className="pp-card-label">
                    <span className="pp-brand">{product.brand}</span>
                    <span className="pp-name">{product.name}</span>
                  </div>
                  {product.isCustom && <span className="pp-custom-badge">Custom</span>}
                </div>
              ))}
            </div>
          </section>

          {/* Aesthetics */}
          <section className="pp-panel pp-aesthetics">
            <div className="pp-panel-header">
              <h2>Aesthetics</h2>
              <div className="pp-panel-actions">
                <span className="pp-count">{selectedAestheticCount}</span>
                <button onClick={() => setSelectedAesthetics(new Set(aesthetics.map(a => a.id)))}>All</button>
                <button onClick={() => setSelectedAesthetics(new Set())}>None</button>
                <button className="pp-upload" onClick={() => aestheticInputRef.current?.click()}>+ Upload</button>
                <input
                  ref={aestheticInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  hidden
                  onChange={(e) => handleImageUpload(e, 'aesthetic')}
                />
              </div>
            </div>
            <div className="pp-grid pp-aesthetics-grid">
              {aesthetics.map(aesthetic => (
                <div
                  key={aesthetic.id}
                  className={`pp-card pp-aesthetic-card ${selectedAesthetics.has(aesthetic.id) ? 'selected' : ''}`}
                  onClick={() => toggleAesthetic(aesthetic.id)}
                >
                  <div className="pp-checkbox">{selectedAesthetics.has(aesthetic.id) ? '✓' : ''}</div>
                  <img src={aesthetic.url} alt={aesthetic.description} />
                  <div className="pp-card-label">
                    <span className="pp-name">{aesthetic.description}</span>
                  </div>
                  {aesthetic.isCustom && <span className="pp-custom-badge">Custom</span>}
                </div>
              ))}
            </div>
          </section>

          {/* Control Panel */}
          <section className="pp-controls">
            {/* Presets */}
            <div className="pp-presets-section">
              <div className="pp-presets-header">
                <h3>Placement Presets</h3>
                <div className="pp-presets-actions">
                  <button onClick={addNewPreset} className="pp-add-preset">+ New</button>
                  <button onClick={resetPresets} className="pp-reset-presets">Reset</button>
                </div>
              </div>

              <div className="pp-presets-list">
                {presets.map(preset => (
                  <div key={preset.id} className="pp-preset-item">
                    {editingPreset === preset.id ? (
                      <div className="pp-preset-edit">
                        <input
                          type="text"
                          value={editLabel}
                          onChange={(e) => setEditLabel(e.target.value)}
                          placeholder="Label"
                          className="pp-preset-label-input"
                        />
                        <textarea
                          value={editPrompt}
                          onChange={(e) => setEditPrompt(e.target.value)}
                          placeholder="Placement instructions..."
                          rows={3}
                          className="pp-preset-prompt-input"
                        />
                        <div className="pp-preset-edit-actions">
                          <button onClick={savePreset} className="pp-save">Save</button>
                          <button onClick={cancelEdit} className="pp-cancel">Cancel</button>
                          {!preset.isDefault && (
                            <button onClick={() => deletePreset(preset.id)} className="pp-delete">Delete</button>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="pp-preset-view">
                        <button
                          className="pp-preset-apply"
                          onClick={() => applyPreset(preset)}
                          title={preset.prompt}
                        >
                          {preset.label}
                        </button>
                        <button
                          className="pp-preset-edit-btn"
                          onClick={() => startEditPreset(preset)}
                          title="Edit preset"
                        >
                          ✎
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Custom Prompt */}
            <div className="pp-prompt-section">
              <label>Custom Instructions</label>
              <textarea
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder="How should products be placed? Click a preset above or write your own instructions..."
                rows={3}
              />
            </div>

            {/* Generate */}
            <div className="pp-generate-section">
              <div className="pp-summary">
                {selectedProductCount} products × {selectedAestheticCount} aesthetics = <strong>{totalCombinations}</strong>
              </div>
              <button
                onClick={generateMatrix}
                disabled={totalCombinations === 0 || isGenerating}
                className="pp-generate-btn"
              >
                {isGenerating ? 'Generating...' : `Generate ${totalCombinations} Images`}
              </button>
            </div>
          </section>
        </div>
      ) : (
        <div className="pp-matrix-view">
          <div className="pp-matrix-header">
            <button onClick={() => setViewMode('select')} className="pp-back-btn">
              ← Back
            </button>
            <span className="pp-matrix-stats">
              {matrix.filter(c => c.status === 'complete').length} / {matrix.length} complete
              {isGenerating && ' (generating...)'}
            </span>
          </div>

          <div className="pp-matrix-grid" style={{
            gridTemplateColumns: `repeat(${Math.min(selectedAestheticCount || 1, 5)}, 1fr)`
          }}>
            {matrix.map(cell => (
              <div key={cell.id} className={`pp-matrix-cell ${cell.status}`}>
                <div className="pp-cell-image">
                  <img
                    src={cell.status === 'complete' && cell.resultUrl ? cell.resultUrl : cell.aesthetic.url}
                    alt={`${cell.product.name} in ${cell.aesthetic.description}`}
                  />
                  {cell.status === 'generating' && (
                    <div className="pp-loading"><div className="pp-spinner" /></div>
                  )}
                  {cell.status === 'error' && <div className="pp-error-overlay">Error</div>}
                </div>
                <div className="pp-cell-info">
                  <span className="pp-cell-product">{cell.product.brand} {cell.product.name}</span>
                  <span className="pp-cell-aesthetic">{cell.aesthetic.description}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <footer className="pp-footer">
        <span>Nano Banana Pro · Gemini 3 Pro Image</span>
        <span>Product Placement Console</span>
      </footer>
    </div>
  )
}
