/**
 * Paris Drafting Table V2 - Multi-Select Matrix Prototype
 *
 * Enhanced version with:
 * - Multi-select products and aesthetics
 * - Matrix generation (products × aesthetics)
 * - Custom image upload
 * - Placement presets
 * - Batch processing
 */

import { useState, useCallback, useRef } from 'react'
import './DraftingTableV2.css'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'

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

interface MatrixCell {
  id: string
  product: Product
  aesthetic: AestheticImage
  status: 'pending' | 'generating' | 'complete' | 'error'
  resultUrl?: string
  prompt: string
}

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

// Placement presets
const PLACEMENT_PRESETS = [
  { label: 'On table', prompt: 'Place naturally on a surface or table in the scene' },
  { label: 'In foreground', prompt: 'Position prominently in the foreground' },
  { label: 'Subtle background', prompt: 'Subtly visible in the background, partially obscured' },
  { label: 'Being used', prompt: 'Show the product being actively used or worn' },
  { label: 'Artistic', prompt: 'Place in an artistic, editorial fashion photography style' },
  { label: 'Minimal', prompt: 'Minimal, clean placement that doesnt distract from the scene' },
]

export default function DraftingTableV2() {
  // State
  const [products, setProducts] = useState<Product[]>(PRELOADED_PRODUCTS)
  const [aesthetics, setAesthetics] = useState<AestheticImage[]>(PRELOADED_AESTHETICS)
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set())
  const [selectedAesthetics, setSelectedAesthetics] = useState<Set<string>>(new Set())
  const [placementPrompt, setPlacementPrompt] = useState('')
  const [matrix, setMatrix] = useState<MatrixCell[]>([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'select' | 'matrix'>('select')

  const productInputRef = useRef<HTMLInputElement>(null)
  const aestheticInputRef = useRef<HTMLInputElement>(null)

  // Toggle product selection
  const toggleProduct = (id: string) => {
    setSelectedProducts(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // Toggle aesthetic selection
  const toggleAesthetic = (id: string) => {
    setSelectedAesthetics(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // Select all products
  const selectAllProducts = () => {
    setSelectedProducts(new Set(products.map(p => p.id)))
  }

  // Select all aesthetics
  const selectAllAesthetics = () => {
    setSelectedAesthetics(new Set(aesthetics.map(a => a.id)))
  }

  // Clear selections
  const clearSelections = () => {
    setSelectedProducts(new Set())
    setSelectedAesthetics(new Set())
  }

  // Handle custom image upload
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
            description: `Custom uploaded: ${name}`,
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

    // Reset input
    e.target.value = ''
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

  // Generate matrix
  const generateMatrix = useCallback(async () => {
    const selectedProductList = products.filter(p => selectedProducts.has(p.id))
    const selectedAestheticList = aesthetics.filter(a => selectedAesthetics.has(a.id))

    if (selectedProductList.length === 0 || selectedAestheticList.length === 0) {
      setError('Please select at least one product and one aesthetic')
      return
    }

    // Create matrix cells
    const cells: MatrixCell[] = []
    for (const product of selectedProductList) {
      for (const aesthetic of selectedAestheticList) {
        cells.push({
          id: `${product.id}-${aesthetic.id}`,
          product,
          aesthetic,
          status: 'pending',
          prompt: placementPrompt ||
            `Naturally place a ${product.brand} ${product.name} into this scene. Blend seamlessly with lighting and atmosphere.`,
        })
      }
    }

    setMatrix(cells)
    setViewMode('matrix')
    setIsGenerating(true)
    setError(null)

    // Process cells sequentially (to avoid rate limits)
    for (let i = 0; i < cells.length; i++) {
      const cell = cells[i]
      if (!cell) continue

      // Update status to generating
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

        if (!response.ok) {
          throw new Error(`API error: ${response.statusText}`)
        }

        const data = await response.json()

        if (data.images && data.images.length > 0) {
          const resultUrl = `data:${data.images[0].mime_type};base64,${data.images[0].data}`
          setMatrix(prev => prev.map(c =>
            c.id === cell.id ? { ...c, status: 'complete', resultUrl } : c
          ))
        } else {
          throw new Error('No image returned')
        }
      } catch (err) {
        console.error(`Failed to generate ${cell.id}:`, err)
        setMatrix(prev => prev.map(c =>
          c.id === cell.id ? { ...c, status: 'error' } : c
        ))
      }
    }

    setIsGenerating(false)
  }, [products, aesthetics, selectedProducts, selectedAesthetics, placementPrompt])

  // Apply preset
  const applyPreset = (prompt: string) => {
    setPlacementPrompt(prompt)
  }

  // Get selected counts
  const selectedProductCount = selectedProducts.size
  const selectedAestheticCount = selectedAesthetics.size
  const totalCombinations = selectedProductCount * selectedAestheticCount

  return (
    <div className="drafting-table-v2">
      <div className="paper-texture" />

      <header className="header-v2">
        <div className="header-left">
          <h1>Paris Drafting Table</h1>
          <p className="subtitle">Matrix Prototype · Products × Aesthetics</p>
        </div>
        <div className="header-right">
          <div className="view-toggle">
            <button
              className={viewMode === 'select' ? 'active' : ''}
              onClick={() => setViewMode('select')}
            >
              Select
            </button>
            <button
              className={viewMode === 'matrix' ? 'active' : ''}
              onClick={() => setViewMode('matrix')}
              disabled={matrix.length === 0}
            >
              Matrix ({matrix.length})
            </button>
          </div>
        </div>
      </header>

      {error && (
        <div className="error-banner">
          <span>{error}</span>
          <button onClick={() => setError(null)}>×</button>
        </div>
      )}

      {viewMode === 'select' ? (
        <div className="selection-view">
          {/* Products Panel */}
          <section className="panel-v2">
            <div className="panel-header-v2">
              <h2>Products</h2>
              <div className="panel-actions">
                <span className="count">{selectedProductCount} selected</span>
                <button onClick={selectAllProducts} className="action-btn">All</button>
                <button onClick={() => setSelectedProducts(new Set())} className="action-btn">None</button>
                <button onClick={() => productInputRef.current?.click()} className="upload-btn">
                  + Upload
                </button>
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
            <div className="grid-v2 products-grid">
              {products.map(product => (
                <div
                  key={product.id}
                  className={`card-v2 ${selectedProducts.has(product.id) ? 'selected' : ''}`}
                  onClick={() => toggleProduct(product.id)}
                >
                  <div className="checkbox">{selectedProducts.has(product.id) ? '✓' : ''}</div>
                  <img src={product.imageUrl} alt={product.name} />
                  <div className="card-label">
                    <span className="brand">{product.brand}</span>
                    <span className="name">{product.name}</span>
                  </div>
                  {product.isCustom && <span className="custom-badge">Custom</span>}
                </div>
              ))}
            </div>
          </section>

          {/* Aesthetics Panel */}
          <section className="panel-v2">
            <div className="panel-header-v2">
              <h2>Aesthetics</h2>
              <div className="panel-actions">
                <span className="count">{selectedAestheticCount} selected</span>
                <button onClick={selectAllAesthetics} className="action-btn">All</button>
                <button onClick={() => setSelectedAesthetics(new Set())} className="action-btn">None</button>
                <button onClick={() => aestheticInputRef.current?.click()} className="upload-btn">
                  + Upload
                </button>
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
            <div className="grid-v2 aesthetics-grid">
              {aesthetics.map(aesthetic => (
                <div
                  key={aesthetic.id}
                  className={`card-v2 aesthetic-card-v2 ${selectedAesthetics.has(aesthetic.id) ? 'selected' : ''}`}
                  onClick={() => toggleAesthetic(aesthetic.id)}
                >
                  <div className="checkbox">{selectedAesthetics.has(aesthetic.id) ? '✓' : ''}</div>
                  <img src={aesthetic.url} alt={aesthetic.description} />
                  <div className="card-label">
                    <span className="name">{aesthetic.description}</span>
                  </div>
                  {aesthetic.isCustom && <span className="custom-badge">Custom</span>}
                </div>
              ))}
            </div>
          </section>

          {/* Control Panel */}
          <section className="control-panel">
            <div className="prompt-area">
              <label>Placement Instructions</label>
              <textarea
                value={placementPrompt}
                onChange={(e) => setPlacementPrompt(e.target.value)}
                placeholder="How should products be placed? Leave blank for automatic placement."
                rows={2}
              />
              <div className="presets">
                {PLACEMENT_PRESETS.map(preset => (
                  <button
                    key={preset.label}
                    onClick={() => applyPreset(preset.prompt)}
                    className="preset-btn"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="generation-area">
              <div className="summary">
                <span className="combo-count">
                  {selectedProductCount} products × {selectedAestheticCount} aesthetics
                  = <strong>{totalCombinations}</strong> combinations
                </span>
              </div>
              <button
                onClick={generateMatrix}
                disabled={totalCombinations === 0 || isGenerating}
                className="generate-matrix-btn"
              >
                {isGenerating ? 'Generating...' : `Generate ${totalCombinations} Images`}
              </button>
              <button onClick={clearSelections} className="clear-btn">
                Clear All
              </button>
            </div>
          </section>
        </div>
      ) : (
        <div className="matrix-view">
          <div className="matrix-header">
            <button onClick={() => setViewMode('select')} className="back-btn">
              ← Back to Selection
            </button>
            <span className="matrix-stats">
              {matrix.filter(c => c.status === 'complete').length} / {matrix.length} complete
            </span>
          </div>

          <div className="matrix-grid" style={{
            gridTemplateColumns: `repeat(${Math.min(selectedAestheticCount || 1, 5)}, 1fr)`
          }}>
            {matrix.map(cell => (
              <div key={cell.id} className={`matrix-cell ${cell.status}`}>
                <div className="cell-images">
                  <img
                    src={cell.status === 'complete' && cell.resultUrl ? cell.resultUrl : cell.aesthetic.url}
                    alt={`${cell.product.name} in ${cell.aesthetic.description}`}
                    className="result-image"
                  />
                  {cell.status === 'generating' && (
                    <div className="loading-overlay">
                      <div className="spinner" />
                    </div>
                  )}
                  {cell.status === 'error' && (
                    <div className="error-overlay">Error</div>
                  )}
                </div>
                <div className="cell-info">
                  <span className="product-name">{cell.product.brand} {cell.product.name}</span>
                  <span className="aesthetic-name">{cell.aesthetic.description}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <footer className="footer-v2">
        <span>Nano Banana Pro · Matrix Generation</span>
        <span>4pm Paris Light</span>
      </footer>
    </div>
  )
}
