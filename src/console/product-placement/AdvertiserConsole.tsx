/**
 * Advertiser Console - Campaign Setup & Testing
 *
 * Single view for advertisers to:
 * A) Select products to advertise
 * B) Define target demographics
 * C) Set image match criteria (semantic filters)
 * D) Configure placement prompts
 * E) Set budget
 * F) Test placements on sample posts
 */

import { useState, useCallback } from 'react'
import './AdvertiserConsole.css'

const API_BASE = import.meta.env.VITE_API_URL || ''

interface Product {
  id: string
  name: string
  brand: string
  price: string
  imageUrl: string
}

interface SamplePost {
  id: string
  imageUrl: string
  matchScore: number
  description: string
}

// Sample products
const PRODUCTS: Product[] = [
  { id: 'lamp', name: 'Desk Lamp', brand: 'Modern Home', price: '$89', imageUrl: 'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=200' },
  { id: 'vase', name: 'Ceramic Vase', brand: 'Artisan', price: '$45', imageUrl: 'https://images.unsplash.com/photo-1578500494198-246f612d3b3d?w=200' },
  { id: 'blanket', name: 'Wool Blanket', brand: 'Nordic', price: '$120', imageUrl: 'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=200' },
  { id: 'book', name: 'Coffee Table Book', brand: 'Curator', price: '$32', imageUrl: 'https://images.unsplash.com/photo-1544947950-fa07a98d237f?w=200' },
  { id: 'clock', name: 'Wall Clock', brand: 'Minimal', price: '$65', imageUrl: 'https://images.unsplash.com/photo-1563861826100-9cb868fdbe1c?w=200' },
  { id: 'candle', name: 'Scented Candle', brand: 'Essence', price: '$28', imageUrl: 'https://images.unsplash.com/photo-1602874801006-e04291d9d6d3?w=200' },
]

// Sample posts that could match
const SAMPLE_POSTS: SamplePost[] = [
  { id: '1', imageUrl: 'https://images.unsplash.com/photo-1616046229478-9901c5536a45?w=600', matchScore: 94, description: 'Scandinavian living room' },
  { id: '2', imageUrl: 'https://images.unsplash.com/photo-1618220179428-22790b461013?w=600', matchScore: 89, description: 'Modern interior' },
  { id: '3', imageUrl: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=600', matchScore: 87, description: 'Cozy reading nook' },
  { id: '4', imageUrl: 'https://images.unsplash.com/photo-1615876234886-fd9a39fda97f?w=600', matchScore: 82, description: 'Warm bedroom' },
  { id: '5', imageUrl: 'https://images.unsplash.com/photo-1595526114035-0d45ed16cfbf?w=600', matchScore: 78, description: 'Minimalist space' },
  { id: '6', imageUrl: 'https://images.unsplash.com/photo-1616594039964-ae9021a400a0?w=600', matchScore: 75, description: 'Designer apartment' },
]

const PROMPT_PRESETS = {
  subtle: 'Place the product subtly in the background, partially visible. It should be discoverable but not obvious.',
  prominent: 'Position the product prominently in the foreground as a key visual element.',
  editorial: 'Place in an artistic, editorial style. The product should feel curated and intentional.',
  'in-use': 'Show the product being used or interacted with naturally in the scene.',
}

export function AdvertiserConsole() {
  // Product selection
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set(['lamp', 'vase']))

  // Demographics
  const [ageRanges, setAgeRanges] = useState<Set<string>>(new Set(['18-24', '25-34']))
  const [interests, setInterests] = useState<Set<string>>(new Set(['Fashion', 'Home']))

  // Image match criteria
  const [sceneTypes, setSceneTypes] = useState<Set<string>>(new Set(['Interior', 'Lifestyle']))
  const [aesthetics, setAesthetics] = useState<Set<string>>(new Set(['Minimal', 'Modern']))
  const [semanticFilter, setSemanticFilter] = useState('')

  // Placement
  const [placementPrompt, setPlacementPrompt] = useState(
    'Place the product naturally on a surface visible in the image. Match the lighting and shadows.'
  )

  // Budget
  const [budget, setBudget] = useState(500)

  // Preview modal
  const [previewPost, setPreviewPost] = useState<SamplePost | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedImage, setGeneratedImage] = useState<string | null>(null)

  // Toggle helpers
  const toggleSet = (set: Set<string>, setFn: (s: Set<string>) => void, value: string) => {
    const next = new Set(set)
    if (next.has(value)) next.delete(value)
    else next.add(value)
    setFn(next)
  }

  // Estimates
  const estimatedImpressions = Math.round(budget * 25 * (1 + (ageRanges.size + interests.size) * 0.1))
  const costPerPlacement = (budget / estimatedImpressions).toFixed(2)

  // URL to base64
  const urlToBase64 = async (url: string): Promise<{ base64: string; mimeType: string }> => {
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

  // Test placement
  const testPlacement = useCallback(async (post: SamplePost) => {
    setPreviewPost(post)
    setGeneratedImage(null)
    setIsGenerating(true)

    try {
      const productId = Array.from(selectedProducts)[0] || 'lamp'
      const product = PRODUCTS.find(p => p.id === productId)!

      const { base64, mimeType } = await urlToBase64(post.imageUrl)

      const prompt = `Edit this image to include a ${product.brand} ${product.name}. ${placementPrompt}`

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
        const resultUrl = `data:${data.images[0].mime_type};base64,${data.images[0].data}`
        setGeneratedImage(resultUrl)
      }
    } catch (err) {
      console.error('Generation failed:', err)
    } finally {
      setIsGenerating(false)
    }
  }, [selectedProducts, placementPrompt])

  // Deploy campaign
  const deployCampaign = () => {
    if (selectedProducts.size === 0) {
      alert('Please select at least one product')
      return
    }
    alert(`Campaign Deployed!\n\nBudget: $${budget}/day\nProducts: ${selectedProducts.size}\nEst. Impressions: ${estimatedImpressions.toLocaleString()}\n\nYour products will now appear in matching user posts.`)
  }

  return (
    <div className="ac-container">
      {/* Header */}
      <header className="ac-header">
        <div>
          <h1>Campaign Setup</h1>
          <span className="ac-subtitle">Configure, test, and deploy</span>
        </div>
      </header>

      <div className="ac-layout">
        {/* Left: Configuration */}
        <div className="ac-config">
          {/* A) Products */}
          <section className="ac-section">
            <h3 className="ac-section-title">A) Products to Advertise</h3>
            <div className="ac-products-grid">
              {PRODUCTS.map(product => (
                <div
                  key={product.id}
                  className={`ac-product ${selectedProducts.has(product.id) ? 'selected' : ''}`}
                  onClick={() => toggleSet(selectedProducts, setSelectedProducts, product.id)}
                >
                  <img src={product.imageUrl} alt={product.name} />
                  <div className="ac-product-check">{selectedProducts.has(product.id) ? '✓' : ''}</div>
                  <div className="ac-product-info">
                    <span className="ac-product-brand">{product.brand}</span>
                    <span className="ac-product-name">{product.name}</span>
                  </div>
                </div>
              ))}
            </div>
            <button className="ac-btn-secondary ac-full-width">+ Upload Product Catalog</button>
          </section>

          {/* B) Demographics */}
          <section className="ac-section">
            <h3 className="ac-section-title">B) Target Demographics</h3>
            <div className="ac-subsection">
              <label>Age Range</label>
              <div className="ac-tags">
                {['18-24', '25-34', '35-44', '45+'].map(age => (
                  <button
                    key={age}
                    className={`ac-tag ${ageRanges.has(age) ? 'active' : ''}`}
                    onClick={() => toggleSet(ageRanges, setAgeRanges, age)}
                  >
                    {age}
                  </button>
                ))}
              </div>
            </div>
            <div className="ac-subsection">
              <label>Interests</label>
              <div className="ac-tags">
                {['Fashion', 'Home', 'Tech', 'Wellness', 'Travel'].map(interest => (
                  <button
                    key={interest}
                    className={`ac-tag ${interests.has(interest) ? 'active' : ''}`}
                    onClick={() => toggleSet(interests, setInterests, interest)}
                  >
                    {interest}
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* C) Image Match Criteria */}
          <section className="ac-section">
            <h3 className="ac-section-title">C) Image Match Criteria</h3>
            <p className="ac-hint">What type of user posts should your products appear in?</p>
            <div className="ac-subsection">
              <label>Scene Types</label>
              <div className="ac-tags">
                {['Interior', 'Lifestyle', 'Outdoor', 'Portrait', 'Food'].map(scene => (
                  <button
                    key={scene}
                    className={`ac-tag ${sceneTypes.has(scene) ? 'active' : ''}`}
                    onClick={() => toggleSet(sceneTypes, setSceneTypes, scene)}
                  >
                    {scene}
                  </button>
                ))}
              </div>
            </div>
            <div className="ac-subsection">
              <label>Aesthetic Vibes</label>
              <div className="ac-tags">
                {['Minimal', 'Cozy', 'Modern', 'Vintage', 'Luxury', 'Earthy'].map(vibe => (
                  <button
                    key={vibe}
                    className={`ac-tag ${aesthetics.has(vibe) ? 'active' : ''}`}
                    onClick={() => toggleSet(aesthetics, setAesthetics, vibe)}
                  >
                    {vibe}
                  </button>
                ))}
              </div>
            </div>
            <div className="ac-subsection">
              <label>Custom Semantic Filter</label>
              <textarea
                value={semanticFilter}
                onChange={e => setSemanticFilter(e.target.value)}
                placeholder="e.g. 'images with visible table surfaces, warm lighting, no faces'"
                rows={2}
              />
            </div>
          </section>

          {/* D) Placement Prompt */}
          <section className="ac-section">
            <h3 className="ac-section-title">D) Placement Instructions</h3>
            <p className="ac-hint">How should products be placed in matched images?</p>
            <textarea
              value={placementPrompt}
              onChange={e => setPlacementPrompt(e.target.value)}
              rows={3}
            />
            <div className="ac-tags" style={{ marginTop: '0.5rem' }}>
              {Object.entries(PROMPT_PRESETS).map(([key, prompt]) => (
                <button
                  key={key}
                  className="ac-tag small"
                  onClick={() => setPlacementPrompt(prompt)}
                >
                  {key.charAt(0).toUpperCase() + key.slice(1).replace('-', ' ')}
                </button>
              ))}
            </div>
          </section>

          {/* E) Budget */}
          <section className="ac-section">
            <h3 className="ac-section-title">E) Budget</h3>
            <div className="ac-budget-display">
              <span className="ac-budget-value">${budget}</span>
              <span className="ac-budget-label">per day</span>
            </div>
            <input
              type="range"
              min={50}
              max={5000}
              step={50}
              value={budget}
              onChange={e => setBudget(Number(e.target.value))}
              className="ac-slider"
            />
            <div className="ac-slider-labels">
              <span>$50</span>
              <span>$5,000</span>
            </div>
            <div className="ac-estimates">
              <div className="ac-estimate-row">
                <span>Est. Daily Impressions</span>
                <span>{estimatedImpressions.toLocaleString()}</span>
              </div>
              <div className="ac-estimate-row">
                <span>Est. Cost per Placement</span>
                <span>${costPerPlacement}</span>
              </div>
            </div>
          </section>

          {/* Deploy Button */}
          <button className="ac-deploy-btn" onClick={deployCampaign}>
            Deploy Campaign
          </button>
        </div>

        {/* Right: Test Area */}
        <div className="ac-test-area">
          <div className="ac-test-header">
            <div>
              <h2>Test Placements</h2>
              <p className="ac-hint">Preview how products appear in matched posts</p>
            </div>
          </div>

          <div className="ac-test-grid">
            {SAMPLE_POSTS.map(post => (
              <div
                key={post.id}
                className="ac-test-card"
                onClick={() => testPlacement(post)}
              >
                <img src={post.imageUrl} alt={post.description} />
                <div className="ac-match-badge">{post.matchScore}% match</div>
                <div className="ac-test-overlay">
                  <span>Click to test</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Preview Modal */}
      {previewPost && (
        <div className="ac-modal-overlay" onClick={() => setPreviewPost(null)}>
          <div className="ac-modal" onClick={e => e.stopPropagation()}>
            <button className="ac-modal-close" onClick={() => setPreviewPost(null)}>×</button>
            <div className="ac-modal-content">
              <div className="ac-modal-images">
                <div className="ac-modal-image">
                  <span className="ac-modal-label">Original Post</span>
                  <img src={previewPost.imageUrl} alt="Original" />
                </div>
                <div className="ac-modal-image">
                  <span className="ac-modal-label">With Product Placement</span>
                  {isGenerating ? (
                    <div className="ac-generating">
                      <div className="ac-spinner" />
                      <span>Generating placement...</span>
                    </div>
                  ) : generatedImage ? (
                    <>
                      <img src={generatedImage} alt="Result" />
                      <div className="ac-sponsored-badge">SPONSORED</div>
                    </>
                  ) : (
                    <div className="ac-placeholder">
                      Click "Generate" to preview
                    </div>
                  )}
                </div>
              </div>
              <div className="ac-modal-footer">
                <div className="ac-modal-info">
                  <span>Product: </span>
                  <strong>{PRODUCTS.find(p => selectedProducts.has(p.id))?.name || 'None selected'}</strong>
                </div>
                <div className="ac-modal-actions">
                  <button className="ac-btn-secondary" onClick={() => testPlacement(previewPost)}>
                    🔄 Regenerate
                  </button>
                  <button className="ac-btn-primary" onClick={() => setPreviewPost(null)}>
                    ✓ Approve
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
