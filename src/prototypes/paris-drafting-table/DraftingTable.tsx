/**
 * Paris Drafting Table - Product Placement Prototype
 *
 * A development interface for testing Nano Banana Pro product placement.
 * Aesthetic: 4pm Paris light, artist's drafting table, matte paper, warm soft tones.
 */

import { useState, useCallback } from 'react'
import './DraftingTable.css'

// API base URL
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'

// Product catalog types
interface Product {
  id: string
  name: string
  brand: 'Prada' | 'Louis Vuitton' | 'Acne Studios'
  imageUrl: string
  description: string
}

interface AestheticImage {
  id: string
  url: string
  description: string
}

interface PlacementResult {
  id: string
  originalImageUrl: string
  resultImageUrl: string
  product: Product
  prompt: string
  timestamp: Date
}

// Pre-generated products (via Nano Banana Pro)
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

// Pre-generated Paris aesthetic images (via Nano Banana Pro)
const PRELOADED_AESTHETICS: AestheticImage[] = [
  { id: 'cafe-table', url: '/prototype-assets/aesthetics/cafe-table.jpg', description: 'Parisian cafe table at 4pm golden hour, warm afternoon light, marble tabletop' },
  { id: 'rain-window', url: '/prototype-assets/aesthetics/rain-window.jpg', description: 'Rain-streaked window in Paris apartment, soft diffused light, old books' },
  { id: 'cobblestone', url: '/prototype-assets/aesthetics/cobblestone.jpg', description: 'Cobblestone street in Le Marais, 4pm sunlight, vintage cafe chairs' },
  { id: 'seine-bank', url: '/prototype-assets/aesthetics/seine-bank.jpg', description: 'Seine riverbank at golden hour, iron bridge silhouette, romantic mood' },
  { id: 'boutique', url: '/prototype-assets/aesthetics/boutique.jpg', description: 'Vintage Parisian boutique interior, art deco mirrors, soft warm lighting' },
  { id: 'tuileries', url: '/prototype-assets/aesthetics/tuileries.jpg', description: 'Tuileries Garden bench in autumn, fallen leaves, late afternoon shadows' },
  { id: 'artist-studio', url: '/prototype-assets/aesthetics/artist-studio.jpg', description: 'Montmartre artist studio, large windows, natural afternoon light' },
  { id: 'bookshop', url: '/prototype-assets/aesthetics/bookshop.jpg', description: 'Left Bank bookshop, leather-bound volumes, dust motes in golden sunlight' },
  { id: 'palais-royal', url: '/prototype-assets/aesthetics/palais-royal.jpg', description: 'Palais Royal gardens at blue hour, classical columns, elegant tranquility' },
  { id: 'rooftop', url: '/prototype-assets/aesthetics/rooftop.jpg', description: 'Parisian rooftop terrace, zinc surfaces, distant Eiffel Tower' },
]

export default function DraftingTable() {
  // State - initialized with pre-generated images
  const [products, setProducts] = useState<Product[]>(PRELOADED_PRODUCTS)
  const [aestheticImages, setAestheticImages] = useState<AestheticImage[]>(PRELOADED_AESTHETICS)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [selectedAesthetic, setSelectedAesthetic] = useState<AestheticImage | null>(null)
  const [placementPrompt, setPlacementPrompt] = useState('')
  const [results, setResults] = useState<PlacementResult[]>([])
  const [isGeneratingProducts, setIsGeneratingProducts] = useState(false)
  const [isGeneratingAesthetics, setIsGeneratingAesthetics] = useState(false)
  const [isPlacing, setIsPlacing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [generationProgress, setGenerationProgress] = useState({ current: 0, total: 0 })

  // Generate product images using Nano Banana Pro
  const generateProductImages = useCallback(async () => {
    setIsGeneratingProducts(true)
    setError(null)
    setGenerationProgress({ current: 0, total: products.length })

    const updatedProducts: Product[] = []

    for (let i = 0; i < products.length; i++) {
      const product = products[i]
      if (!product) continue
      setGenerationProgress({ current: i + 1, total: products.length })

      try {
        const prompt = `Product photography of a luxury ${product.brand} ${product.name}. ${product.description}. Clean white background, high-end fashion photography, soft studio lighting, commercial quality. The product should be the sole focus, no models, no text, no logos visible.`

        const response = await fetch(`${API_BASE}/api/image/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt,
            model: 'gemini-3-pro-image-preview',
          }),
        })

        if (!response.ok) {
          throw new Error(`Generation failed: ${response.statusText}`)
        }

        const data = await response.json()

        if (data.images && data.images.length > 0) {
          const imageUrl = `data:${data.images[0].mime_type};base64,${data.images[0].data}`
          updatedProducts.push({ ...product, imageUrl })
        } else if (product) {
          updatedProducts.push(product)
        }
      } catch (err) {
        console.error(`Failed to generate image for ${product?.name}:`, err)
        if (product) updatedProducts.push(product)
      }
    }

    setProducts(updatedProducts)
    setIsGeneratingProducts(false)
  }, [products])

  // Generate aesthetic base images
  const generateAestheticImages = useCallback(async () => {
    setIsGeneratingAesthetics(true)
    setError(null)
    const prompts = PRELOADED_AESTHETICS.map(a => a.description)
    setGenerationProgress({ current: 0, total: prompts.length })

    const images: AestheticImage[] = []

    for (let i = 0; i < prompts.length; i++) {
      const prompt = prompts[i]
      if (!prompt) continue
      setGenerationProgress({ current: i + 1, total: prompts.length })

      try {
        const response = await fetch(`${API_BASE}/api/image/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: prompt + ' Artistic, moody, film photography aesthetic. Aspect ratio 3:2.',
            model: 'gemini-3-pro-image-preview',
          }),
        })

        if (!response.ok) {
          throw new Error(`Generation failed: ${response.statusText}`)
        }

        const data = await response.json()

        if (data.images && data.images.length > 0) {
          images.push({
            id: `aesthetic-${i}`,
            url: `data:${data.images[0].mime_type};base64,${data.images[0].data}`,
            description: prompt,
          })
        }
      } catch (err) {
        console.error(`Failed to generate aesthetic image ${i}:`, err)
      }
    }

    setAestheticImages(images)
    setIsGeneratingAesthetics(false)
  }, [])

  // Helper to convert image URL to base64
  const urlToBase64 = async (url: string): Promise<{ base64: string; mimeType: string }> => {
    // If already a data URL, extract parts
    if (url.startsWith('data:')) {
      const mimeType = url.split(';')[0]?.split(':')[1] ?? 'image/jpeg'
      const base64 = url.split(',')[1] ?? ''
      return { base64, mimeType }
    }

    // Fetch the image and convert to base64
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

  // Place product into aesthetic image
  const placeProduct = useCallback(async () => {
    if (!selectedProduct || !selectedAesthetic) {
      setError('Please select both a product and an aesthetic image')
      return
    }

    setIsPlacing(true)
    setError(null)

    try {
      // Convert aesthetic image to base64 (handles both data URLs and file paths)
      const { base64: aestheticBase64, mimeType } = await urlToBase64(selectedAesthetic.url)

      // Build the placement prompt
      const fullPrompt = placementPrompt
        ? `Edit this image to naturally place a ${selectedProduct.brand} ${selectedProduct.name} into the scene. ${placementPrompt}. The product should blend seamlessly with the lighting and atmosphere. Maintain the 4pm Paris golden hour aesthetic.`
        : `Edit this image to naturally and subtly place a ${selectedProduct.brand} ${selectedProduct.name} into the scene. The product should appear as if it belongs there, perhaps resting on a surface or subtly visible in the composition. Maintain the original lighting, mood, and film photography aesthetic. The placement should feel organic, not like an advertisement.`

      const response = await fetch(`${API_BASE}/api/image/edit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: fullPrompt,
          image: aestheticBase64,
          mime_type: mimeType,
          model: 'gemini-3-pro-image-preview',
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.detail || `Placement failed: ${response.statusText}`)
      }

      const data = await response.json()

      if (data.images && data.images.length > 0) {
        const resultUrl = `data:${data.images[0].mime_type};base64,${data.images[0].data}`

        setResults(prev => [
          {
            id: `result-${Date.now()}`,
            originalImageUrl: selectedAesthetic.url,
            resultImageUrl: resultUrl,
            product: selectedProduct,
            prompt: fullPrompt,
            timestamp: new Date(),
          },
          ...prev,
        ])
      } else {
        throw new Error('No image returned from API')
      }
    } catch (err) {
      console.error('Product placement failed:', err)
      setError(err instanceof Error ? err.message : 'Product placement failed')
    } finally {
      setIsPlacing(false)
    }
  }, [selectedProduct, selectedAesthetic, placementPrompt])

  return (
    <div className="drafting-table">
      {/* Paper texture overlay */}
      <div className="paper-texture" />

      {/* Header */}
      <header className="drafting-header">
        <h1>Paris Drafting Table</h1>
        <p className="subtitle">Product Placement Prototype · Nano Banana Pro</p>
      </header>

      {/* Error display */}
      {error && (
        <div className="error-banner">
          <span>{error}</span>
          <button onClick={() => setError(null)}>×</button>
        </div>
      )}

      {/* Main workspace */}
      <div className="workspace">
        {/* Left panel: Products */}
        <section className="panel products-panel">
          <div className="panel-header">
            <h2>Products</h2>
            <button
              onClick={generateProductImages}
              disabled={isGeneratingProducts}
              className="generate-btn"
            >
              {isGeneratingProducts
                ? `Generating ${generationProgress.current}/${generationProgress.total}...`
                : 'Generate All'}
            </button>
          </div>

          <div className="product-grid">
            {products.map(product => (
              <div
                key={product.id}
                className={`product-card ${selectedProduct?.id === product.id ? 'selected' : ''}`}
                onClick={() => setSelectedProduct(product)}
              >
                {product.imageUrl ? (
                  <img src={product.imageUrl} alt={product.name} />
                ) : (
                  <div className="placeholder">
                    <span className="brand-tag">{product.brand}</span>
                    <span className="product-name">{product.name}</span>
                  </div>
                )}
                <div className="product-info">
                  <span className="brand">{product.brand}</span>
                  <span className="name">{product.name}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Center panel: Composer */}
        <section className="panel composer-panel">
          <div className="panel-header">
            <h2>Compose</h2>
          </div>

          <div className="composer-content">
            {/* Selection preview */}
            <div className="selection-preview">
              <div className="preview-slot product-slot">
                {selectedProduct?.imageUrl ? (
                  <img src={selectedProduct.imageUrl} alt={selectedProduct.name} />
                ) : selectedProduct ? (
                  <div className="slot-placeholder">
                    <span>{selectedProduct.brand}</span>
                    <span>{selectedProduct.name}</span>
                  </div>
                ) : (
                  <div className="slot-empty">Select a product</div>
                )}
              </div>

              <div className="compose-arrow">→</div>

              <div className="preview-slot aesthetic-slot">
                {selectedAesthetic ? (
                  <img src={selectedAesthetic.url} alt="Aesthetic" />
                ) : (
                  <div className="slot-empty">Select an aesthetic</div>
                )}
              </div>
            </div>

            {/* Prompt input */}
            <div className="prompt-section">
              <label htmlFor="placement-prompt">Placement Instructions (optional)</label>
              <textarea
                id="placement-prompt"
                value={placementPrompt}
                onChange={(e) => setPlacementPrompt(e.target.value)}
                placeholder="e.g., 'Place the bag on the cafe table, partially visible' or 'The scarf draped over the chair back'"
                rows={3}
              />
            </div>

            {/* Generate button */}
            <button
              onClick={placeProduct}
              disabled={!selectedProduct || !selectedAesthetic || isPlacing}
              className="place-btn"
            >
              {isPlacing ? 'Placing Product...' : 'Place Product'}
            </button>
          </div>

          {/* Results */}
          {results.length > 0 && (
            <div className="results-section">
              <h3>Results</h3>
              <div className="results-grid">
                {results.map(result => (
                  <div key={result.id} className="result-card">
                    <div className="result-comparison">
                      <img
                        src={result.originalImageUrl}
                        alt="Original"
                        className="result-original"
                      />
                      <img
                        src={result.resultImageUrl}
                        alt="With product"
                        className="result-final"
                      />
                    </div>
                    <div className="result-info">
                      <span className="result-product">{result.product.brand} {result.product.name}</span>
                      <span className="result-time">{result.timestamp.toLocaleTimeString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Right panel: Aesthetics */}
        <section className="panel aesthetics-panel">
          <div className="panel-header">
            <h2>Aesthetics</h2>
            <button
              onClick={generateAestheticImages}
              disabled={isGeneratingAesthetics}
              className="generate-btn"
            >
              {isGeneratingAesthetics
                ? `Generating ${generationProgress.current}/${generationProgress.total}...`
                : 'Generate All'}
            </button>
          </div>

          <div className="aesthetic-grid">
            {aestheticImages.length === 0 ? (
              <div className="empty-state">
                <p>No aesthetic images yet.</p>
                <p className="hint">Click "Generate All" to create base images.</p>
              </div>
            ) : (
              aestheticImages.map(aesthetic => (
                <div
                  key={aesthetic.id}
                  className={`aesthetic-card ${selectedAesthetic?.id === aesthetic.id ? 'selected' : ''}`}
                  onClick={() => setSelectedAesthetic(aesthetic)}
                >
                  <img src={aesthetic.url} alt={aesthetic.description} />
                  <div className="aesthetic-overlay">
                    <span className="aesthetic-desc">{aesthetic.description.slice(0, 60)}...</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      {/* Footer */}
      <footer className="drafting-footer">
        <span>Product Placement Studio</span>
        <span>4pm Paris Light</span>
      </footer>
    </div>
  )
}
