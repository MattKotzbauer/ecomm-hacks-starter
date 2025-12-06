/**
 * Parisian Atelier - Advertiser Console
 *
 * Elegant three-panel layout for product placement testing.
 * Features warm cream/bronze aesthetic with Cormorant Garamond typography.
 */

import { useState, useCallback } from 'react'
import './ParisianAtelier.css'

const API_BASE = import.meta.env.VITE_API_URL || ''

// Types
interface Product {
  id: string
  name: string
  img: string
}

interface Aesthetic {
  id: string
  name: string
  score: number
  img: string
}

interface Placement {
  img: string
  location: string
  score: number
  resultUrl?: string
}

// Data
const PRODUCTS: Product[] = [
  { id: 'prada-1', name: 'Galleria Bag', img: '/prototype-assets/products/prada-1.jpg' },
  { id: 'prada-2', name: 'Re-Edition', img: '/prototype-assets/products/prada-2.jpg' },
  { id: 'prada-3', name: 'Cleo Shoulder', img: '/prototype-assets/products/prada-3.jpg' },
]

const AESTHETICS: Aesthetic[] = [
  { id: 'cafe', name: 'Café Table', score: 94, img: '/prototype-assets/aesthetics/cafe-table.jpg' },
  { id: 'boutique', name: 'Boutique', score: 91, img: '/prototype-assets/aesthetics/boutique.jpg' },
  { id: 'rooftop', name: 'Rooftop', score: 88, img: '/prototype-assets/aesthetics/rooftop.jpg' },
  { id: 'seine', name: 'Seine Bank', score: 85, img: '/prototype-assets/aesthetics/seine-bank.jpg' },
  { id: 'tuileries', name: 'Tuileries', score: 82, img: '/prototype-assets/aesthetics/tuileries.jpg' },
  { id: 'palais', name: 'Palais Royal', score: 79, img: '/prototype-assets/aesthetics/palais-royal.jpg' },
  { id: 'artist', name: 'Artist Studio', score: 76, img: '/prototype-assets/aesthetics/artist-studio.jpg' },
  { id: 'bookshop', name: 'Bookshop', score: 73, img: '/prototype-assets/aesthetics/bookshop.jpg' },
  { id: 'cobblestone', name: 'Cobblestone', score: 70, img: '/prototype-assets/aesthetics/cobblestone.jpg' },
  { id: 'rain', name: 'Rain Window', score: 67, img: '/prototype-assets/aesthetics/rain-window.jpg' },
]

const DEFAULT_INTERESTS = ['Fashion', 'Luxury', 'Art', 'Travel', 'Lifestyle', 'Minimalist']
const DEFAULT_SCENES = ['Interior', 'Lifestyle', 'Outdoor', 'Café', 'Boutique', 'Street', 'Gallery', 'Garden']

export default function ParisianAtelier() {
  // Product state
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set(['prada-1', 'prada-2', 'prada-3']))

  // Targeting state
  const [selectedAge, setSelectedAge] = useState('25-34')
  const [interests, setInterests] = useState<string[]>(DEFAULT_INTERESTS)
  const [selectedInterests, setSelectedInterests] = useState<Set<string>>(new Set(['Fashion', 'Luxury']))
  const [scenes, setScenes] = useState<string[]>(DEFAULT_SCENES)
  const [selectedScenes, setSelectedScenes] = useState<Set<string>>(new Set(['Interior', 'Café', 'Boutique']))
  const [semanticQuery, setSemanticQuery] = useState('')

  // Add input state
  const [showInterestInput, setShowInterestInput] = useState(false)
  const [newInterest, setNewInterest] = useState('')
  const [showSceneInput, setShowSceneInput] = useState(false)
  const [newScene, setNewScene] = useState('')

  // Generation state
  const [placements, setPlacements] = useState<Placement[]>([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [isDeploying, setIsDeploying] = useState(false)

  // Modal state
  const [modalPlacement, setModalPlacement] = useState<Placement | null>(null)
  const [modalGenerating, setModalGenerating] = useState(false)

  // Toggle handlers
  const toggleProduct = (id: string) => {
    setSelectedProducts(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleInterest = (interest: string) => {
    setSelectedInterests(prev => {
      const next = new Set(prev)
      if (next.has(interest)) next.delete(interest)
      else next.add(interest)
      return next
    })
  }

  const toggleScene = (scene: string) => {
    setSelectedScenes(prev => {
      const next = new Set(prev)
      if (next.has(scene)) next.delete(scene)
      else next.add(scene)
      return next
    })
  }

  // Add handlers
  const addInterest = () => {
    if (newInterest.trim() && !interests.includes(newInterest.trim())) {
      const value = newInterest.trim()
      setInterests(prev => [...prev, value])
      setSelectedInterests(prev => new Set([...prev, value]))
    }
    setNewInterest('')
    setShowInterestInput(false)
  }

  const addScene = () => {
    if (newScene.trim() && !scenes.includes(newScene.trim())) {
      const value = newScene.trim()
      setScenes(prev => [...prev, value])
      setSelectedScenes(prev => new Set([...prev, value]))
    }
    setNewScene('')
    setShowSceneInput(false)
  }

  // URL to base64
  const urlToBase64 = async (url: string): Promise<{ base64: string; mimeType: string }> => {
    const response = await fetch(url)
    const blob = await response.blob()
    const mimeType: string = blob.type || 'image/jpeg'

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

  // Generate placements
  const generate = useCallback(async () => {
    if (selectedProducts.size === 0) {
      alert('Please select at least one product')
      return
    }

    setIsGenerating(true)

    // Simulate generating placements - using aesthetics as sample scenes
    await new Promise(resolve => setTimeout(resolve, 1500))

    const newPlacements = AESTHETICS.map(a => ({
      img: a.img,
      location: a.name,
      score: a.score,
    }))

    setPlacements(newPlacements)
    setIsGenerating(false)
  }, [selectedProducts])

  // Generate product placement for modal
  const generatePlacement = useCallback(async (placement: Placement) => {
    setModalGenerating(true)

    try {
      const selectedProduct = PRODUCTS.find(p => selectedProducts.has(p.id)) ?? PRODUCTS[0]!
      const { base64, mimeType } = await urlToBase64(placement.img)

      const prompt = `Edit this image to naturally include a PRADA ${selectedProduct.name} handbag.
        The bag should be placed elegantly in the scene, maintaining the original lighting and atmosphere.
        Target audience: ${selectedAge} year olds interested in ${Array.from(selectedInterests).join(', ')}.
        Scene style: ${Array.from(selectedScenes).join(', ')}.
        ${semanticQuery ? `Additional context: ${semanticQuery}` : ''}`

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

      if (!response.ok) throw new Error(`API error: ${response.statusText}`)

      const data = await response.json()

      if (data.images?.[0]) {
        const resultUrl = `data:${data.images[0].mime_type};base64,${data.images[0].data}`
        setModalPlacement(prev => prev ? { ...prev, resultUrl } : null)
        // Also update in placements array
        setPlacements(prev => prev.map(p =>
          p.location === placement.location ? { ...p, resultUrl } : p
        ))
      }
    } catch (err) {
      console.error('Failed to generate placement:', err)
      alert('Failed to generate placement. Please try again.')
    }

    setModalGenerating(false)
  }, [selectedProducts, selectedAge, selectedInterests, selectedScenes, semanticQuery])

  // Deploy campaign
  const deploy = async () => {
    if (placements.length === 0) {
      alert('No placements to deploy')
      return
    }

    setIsDeploying(true)
    await new Promise(resolve => setTimeout(resolve, 1500))
    alert('Campaign deployed successfully!')
    setIsDeploying(false)
  }

  // Open modal
  const openModal = (placement: Placement) => {
    setModalPlacement(placement)
    if (!placement.resultUrl) {
      generatePlacement(placement)
    }
  }

  // Close modal
  const closeModal = () => {
    setModalPlacement(null)
  }

  const featuredProduct = PRODUCTS[0]!

  return (
    <div className="pa-container">
      {/* LEFT PANEL: Collection */}
      <div className="pa-panel-collection">
        <h2>Collection</h2>

        <div className="pa-featured-product">
          <img src={featuredProduct.img} alt={`PRADA ${featuredProduct.name}`} />
          <div className="pa-featured-info">
            <div className="pa-brand">PRADA</div>
            <div className="pa-name">{featuredProduct.name}</div>
          </div>
        </div>

        <div className="pa-products-grid">
          {PRODUCTS.map(product => (
            <div
              key={product.id}
              className={`pa-product-tile ${selectedProducts.has(product.id) ? 'selected' : ''}`}
              onClick={() => toggleProduct(product.id)}
            >
              <img src={product.img} alt={product.name} />
            </div>
          ))}
        </div>

        <div className="pa-selection-count">
          <span>{selectedProducts.size}</span> selected
        </div>
      </div>

      {/* CENTER PANEL: Audience */}
      <div className="pa-panel-audience">
        <h2>Audience</h2>

        <div className="pa-form-section">
          <label>Demographics</label>
          <div className="pa-radio-group">
            {['18-24', '25-34', '35-44', '45+'].map(age => (
              <label key={age} className="pa-radio-option">
                <input
                  type="radio"
                  name="age"
                  value={age}
                  checked={selectedAge === age}
                  onChange={() => setSelectedAge(age)}
                />
                <span>{age}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="pa-form-section">
          <label>Interests</label>
          <div className="pa-pill-group">
            {interests.map(interest => (
              <div
                key={interest}
                className={`pa-pill ${selectedInterests.has(interest) ? 'selected' : ''}`}
                onClick={() => toggleInterest(interest)}
              >
                {interest}
              </div>
            ))}
            <div className="pa-pill add-btn" onClick={() => setShowInterestInput(true)}>
              + Add
            </div>
          </div>
          {showInterestInput && (
            <div className="pa-add-input-wrapper">
              <input
                type="text"
                className="pa-add-input"
                value={newInterest}
                onChange={(e) => setNewInterest(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && addInterest()}
                placeholder="e.g., Vintage, Minimalist..."
                autoFocus
              />
              <button className="pa-add-confirm" onClick={addInterest}>Add</button>
            </div>
          )}
        </div>

        <div className="pa-form-section">
          <label>Scene Preference</label>
          <div className="pa-scene-chips">
            {scenes.map(scene => (
              <div
                key={scene}
                className={`pa-scene-chip ${selectedScenes.has(scene) ? 'selected' : ''}`}
                onClick={() => toggleScene(scene)}
              >
                {scene}
              </div>
            ))}
            <div className="pa-scene-chip add-btn" onClick={() => setShowSceneInput(true)}>
              + Add
            </div>
          </div>
          {showSceneInput && (
            <div className="pa-add-input-wrapper">
              <input
                type="text"
                className="pa-add-input"
                value={newScene}
                onChange={(e) => setNewScene(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && addScene()}
                placeholder="e.g., Gallery, Rooftop..."
                autoFocus
              />
              <button className="pa-add-confirm" onClick={addScene}>Add</button>
            </div>
          )}
        </div>

        <div className="pa-form-section pa-semantic-section">
          <label>Semantic Description</label>
          <textarea
            className="pa-semantic-input"
            value={semanticQuery}
            onChange={(e) => setSemanticQuery(e.target.value)}
            placeholder="Describe your ideal placement context..."
          />
        </div>

        <div className="pa-button-group">
          <button
            className="pa-btn pa-btn-primary"
            onClick={generate}
            disabled={isGenerating || selectedProducts.size === 0}
          >
            {isGenerating ? 'Generating...' : 'Generate Posts'}
          </button>
          <button
            className="pa-btn pa-btn-secondary"
            onClick={deploy}
            disabled={isDeploying || placements.length === 0}
          >
            {isDeploying ? 'Deploying...' : 'Deploy Campaign'}
          </button>
        </div>
      </div>

      {/* RIGHT PANEL: Test Placements */}
      <div className="pa-panel-placements">
        <h2>Test Placements</h2>
        <div className="pa-placements-container">
          {placements.length === 0 ? (
            <div className="pa-empty-state">
              <h3>No placements yet</h3>
              <p>Configure your audience and generate posts to see placement suggestions</p>
            </div>
          ) : (
            <>
              <div className="pa-placements-grid">
                {placements.map((placement, index) => (
                  <div
                    key={index}
                    className="pa-placement-card"
                    onClick={() => openModal(placement)}
                  >
                    <img src={placement.resultUrl || placement.img} alt={placement.location} />
                    <div className="pa-placement-info">
                      <div className="pa-placement-meta">
                        <h3>{placement.location}</h3>
                        <span className="pa-placement-score">{placement.score}%</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="pa-placements-footer">
                <p>{placements.length} placements matched</p>
                <button className="pa-btn-more" onClick={generate}>
                  Generate More
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Modal */}
      {modalPlacement && (
        <div className="pa-modal" onClick={(e) => e.target === e.currentTarget && closeModal()}>
          <div className="pa-modal-content">
            <button className="pa-modal-close" onClick={closeModal}>×</button>
            <div className="pa-modal-body">
              <h2 className="pa-modal-title">Placement Preview</h2>
              <div className="pa-comparison-grid">
                <div className="pa-comparison-item">
                  <h3>Original Scene</h3>
                  <img src={modalPlacement.img} alt="Original" />
                </div>
                <div className="pa-comparison-item">
                  <h3>With Product Placement</h3>
                  {modalGenerating ? (
                    <div className="pa-generating">
                      <div className="pa-spinner" />
                      <span>Generating placement...</span>
                    </div>
                  ) : modalPlacement.resultUrl ? (
                    <img src={modalPlacement.resultUrl} alt="With Placement" />
                  ) : (
                    <div className="pa-placeholder">
                      Click to generate
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
