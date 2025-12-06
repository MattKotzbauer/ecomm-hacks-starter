/**
 * Advertiser Console
 *
 * Three-panel layout for product placement testing with collection management.
 * Features collection dropdown with upload capabilities.
 */

import { useState, useCallback, useRef } from 'react'
import './Console.css'

const API_BASE = import.meta.env.VITE_API_URL || ''

// Types
interface Product {
  id: string
  name: string
  img: string
}

interface Collection {
  id: string
  name: string
  displayName: string
  products: Product[]
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

interface Toast {
  id: number
  message: string
}

// Initial Data
const INITIAL_COLLECTIONS: Collection[] = [
  {
    id: 'prada',
    name: 'prada',
    displayName: 'PRADA',
    products: [
      { id: 'prada-1', name: 'Galleria Bag', img: '/prototype-assets/products/prada-1.jpg' },
      { id: 'prada-2', name: 'Re-Edition', img: '/prototype-assets/products/prada-2.jpg' },
      { id: 'prada-3', name: 'Cleo Shoulder', img: '/prototype-assets/products/prada-3.jpg' },
    ]
  },
  {
    id: 'lv',
    name: 'lv',
    displayName: 'LOUIS VUITTON',
    products: [
      { id: 'lv-1', name: 'Neverfull MM', img: '/prototype-assets/products/lv-1.jpg' },
      { id: 'lv-2', name: 'Keepall 45', img: '/prototype-assets/products/lv-2.jpg' },
      { id: 'lv-3', name: 'Capucines', img: '/prototype-assets/products/lv-3.jpg' },
    ]
  },
  {
    id: 'acne',
    name: 'acne',
    displayName: 'ACNE STUDIOS',
    products: [
      { id: 'acne-1', name: 'Musubi Bag', img: '/prototype-assets/products/acne-1.jpg' },
      { id: 'acne-2', name: 'Wool Scarf', img: '/prototype-assets/products/acne-2.jpg' },
      { id: 'acne-3', name: 'Jensen Boots', img: '/prototype-assets/products/acne-3.jpg' },
    ]
  }
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

export default function Console() {
  // Collection state
  const [collections, setCollections] = useState<Collection[]>(INITIAL_COLLECTIONS)
  const [currentCollectionId, setCurrentCollectionId] = useState('prada')
  const [dropdownOpen, setDropdownOpen] = useState(false)

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

  // Toast state
  const [toasts, setToasts] = useState<Toast[]>([])
  const toastIdRef = useRef(0)

  // File input refs
  const newCollectionInputRef = useRef<HTMLInputElement>(null)
  const addToCollectionInputRef = useRef<HTMLInputElement>(null)
  const addTileInputRef = useRef<HTMLInputElement>(null)

  // Current collection
  const currentCollection = collections.find(c => c.id === currentCollectionId) || collections[0]!

  // Show toast
  const showToast = (message: string) => {
    const id = ++toastIdRef.current
    setToasts(prev => [...prev, { id, message }])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 3000)
  }

  // Switch collection
  const switchCollection = (collectionId: string) => {
    setCurrentCollectionId(collectionId)
    const collection = collections.find(c => c.id === collectionId)
    if (collection) {
      setSelectedProducts(new Set(collection.products.map(p => p.id)))
    }
    setDropdownOpen(false)
  }

  // Handle new collection upload
  const handleNewCollectionUpload = (files: FileList | null) => {
    if (!files || files.length === 0) return

    const newProducts: Product[] = []
    const collectionId = `custom-${Date.now()}`
    let processed = 0

    Array.from(files).forEach((file, index) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        newProducts.push({
          id: `${collectionId}-${index}`,
          name: file.name.replace(/\.[^/.]+$/, ''),
          img: e.target?.result as string
        })
        processed++

        if (processed === files.length) {
          const newCollection: Collection = {
            id: collectionId,
            name: collectionId,
            displayName: `Custom ${collections.filter(c => c.id.startsWith('custom')).length + 1}`,
            products: newProducts
          }
          setCollections(prev => [...prev, newCollection])
          setCurrentCollectionId(collectionId)
          setSelectedProducts(new Set(newProducts.map(p => p.id)))
          showToast(`Created collection with ${files.length} images`)
        }
      }
      reader.readAsDataURL(file)
    })

    // Reset input
    if (newCollectionInputRef.current) {
      newCollectionInputRef.current.value = ''
    }
    setDropdownOpen(false)
  }

  // Handle add to collection upload
  const handleAddToCollectionUpload = (files: FileList | null) => {
    if (!files || files.length === 0) return

    const newProducts: Product[] = []
    let processed = 0

    Array.from(files).forEach((file, index) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        const newProduct: Product = {
          id: `${currentCollectionId}-${Date.now()}-${index}`,
          name: file.name.replace(/\.[^/.]+$/, ''),
          img: e.target?.result as string
        }
        newProducts.push(newProduct)
        processed++

        if (processed === files.length) {
          setCollections(prev => prev.map(c =>
            c.id === currentCollectionId
              ? { ...c, products: [...c.products, ...newProducts] }
              : c
          ))
          setSelectedProducts(prev => new Set([...prev, ...newProducts.map(p => p.id)]))
          showToast(`Added ${files.length} image${files.length > 1 ? 's' : ''} to ${currentCollection.displayName}`)
        }
      }
      reader.readAsDataURL(file)
    })

    // Reset inputs
    if (addToCollectionInputRef.current) addToCollectionInputRef.current.value = ''
    if (addTileInputRef.current) addTileInputRef.current.value = ''
    setDropdownOpen(false)
  }

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
      const selectedProduct = currentCollection.products.find(p => selectedProducts.has(p.id)) ?? currentCollection.products[0]!
      const { base64, mimeType } = await urlToBase64(placement.img)

      const prompt = `Edit this image to naturally include a ${currentCollection.displayName} ${selectedProduct.name}.
        The product should be placed elegantly in the scene, maintaining the original lighting and atmosphere.
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
  }, [currentCollection, selectedProducts, selectedAge, selectedInterests, selectedScenes, semanticQuery])

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

  const featuredProduct = currentCollection.products[0]

  return (
    <div className="console-container">
      {/* Hidden file inputs */}
      <input
        type="file"
        ref={newCollectionInputRef}
        style={{ display: 'none' }}
        accept="image/*"
        multiple
        onChange={(e) => handleNewCollectionUpload(e.target.files)}
      />
      <input
        type="file"
        ref={addToCollectionInputRef}
        style={{ display: 'none' }}
        accept="image/*"
        multiple
        onChange={(e) => handleAddToCollectionUpload(e.target.files)}
      />
      <input
        type="file"
        ref={addTileInputRef}
        style={{ display: 'none' }}
        accept="image/*"
        multiple
        onChange={(e) => handleAddToCollectionUpload(e.target.files)}
      />

      {/* Toast notifications */}
      <div className="console-toast-container">
        {toasts.map(toast => (
          <div key={toast.id} className="console-toast">
            {toast.message}
          </div>
        ))}
      </div>

      {/* LEFT PANEL: Collection */}
      <div className="console-panel-collection">
        <div className="console-collection-header">
          <h2>Collection</h2>
          <div className="console-dropdown">
            <button
              className={`console-dropdown-trigger ${dropdownOpen ? 'open' : ''}`}
              onClick={() => setDropdownOpen(!dropdownOpen)}
            >
              <span>{currentCollection.displayName}</span>
              <span className="console-dropdown-arrow">▼</span>
            </button>
            {dropdownOpen && (
              <div className="console-dropdown-menu">
                {collections.map(collection => (
                  <div
                    key={collection.id}
                    className={`console-dropdown-item ${collection.id === currentCollectionId ? 'active' : ''}`}
                    onClick={() => switchCollection(collection.id)}
                  >
                    {collection.displayName}
                  </div>
                ))}
                <div className="console-dropdown-divider" />
                <div
                  className="console-dropdown-item console-dropdown-upload"
                  onClick={() => newCollectionInputRef.current?.click()}
                >
                  <span className="console-upload-icon">+</span>
                  New Collection...
                </div>
                <div
                  className="console-dropdown-item console-dropdown-upload"
                  onClick={() => addToCollectionInputRef.current?.click()}
                >
                  <span className="console-upload-icon">+</span>
                  Add to {currentCollection.displayName}...
                </div>
              </div>
            )}
          </div>
        </div>

        {featuredProduct && (
          <div className="console-featured-product">
            <img src={featuredProduct.img} alt={`${currentCollection.displayName} ${featuredProduct.name}`} />
            <div className="console-featured-info">
              <div className="console-brand">{currentCollection.displayName}</div>
              <div className="console-name">{featuredProduct.name}</div>
            </div>
          </div>
        )}

        <div className="console-products-grid">
          {currentCollection.products.map(product => (
            <div
              key={product.id}
              className={`console-product-tile ${selectedProducts.has(product.id) ? 'selected' : ''}`}
              onClick={() => toggleProduct(product.id)}
            >
              <img src={product.img} alt={product.name} />
            </div>
          ))}
          {/* Add tile */}
          <div
            className="console-product-tile console-add-tile"
            onClick={() => addTileInputRef.current?.click()}
          >
            <span className="console-add-icon">+</span>
          </div>
        </div>

        <div className="console-selection-count">
          <span>{selectedProducts.size}</span> selected
        </div>
      </div>

      {/* CENTER PANEL: Audience */}
      <div className="console-panel-audience">
        <h2>Audience</h2>

        <div className="console-form-section">
          <label>Demographics</label>
          <div className="console-radio-group">
            {['18-24', '25-34', '35-44', '45+'].map(age => (
              <label key={age} className="console-radio-option">
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

        <div className="console-form-section">
          <label>Interests</label>
          <div className="console-pill-group">
            {interests.map(interest => (
              <div
                key={interest}
                className={`console-pill ${selectedInterests.has(interest) ? 'selected' : ''}`}
                onClick={() => toggleInterest(interest)}
              >
                {interest}
              </div>
            ))}
            <div className="console-pill add-btn" onClick={() => setShowInterestInput(true)}>
              + Add
            </div>
          </div>
          {showInterestInput && (
            <div className="console-add-input-wrapper">
              <input
                type="text"
                className="console-add-input"
                value={newInterest}
                onChange={(e) => setNewInterest(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && addInterest()}
                placeholder="e.g., Vintage, Minimalist..."
                autoFocus
              />
              <button className="console-add-confirm" onClick={addInterest}>Add</button>
            </div>
          )}
        </div>

        <div className="console-form-section">
          <label>Scene Preference</label>
          <div className="console-scene-chips">
            {scenes.map(scene => (
              <div
                key={scene}
                className={`console-scene-chip ${selectedScenes.has(scene) ? 'selected' : ''}`}
                onClick={() => toggleScene(scene)}
              >
                {scene}
              </div>
            ))}
            <div className="console-scene-chip add-btn" onClick={() => setShowSceneInput(true)}>
              + Add
            </div>
          </div>
          {showSceneInput && (
            <div className="console-add-input-wrapper">
              <input
                type="text"
                className="console-add-input"
                value={newScene}
                onChange={(e) => setNewScene(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && addScene()}
                placeholder="e.g., Gallery, Rooftop..."
                autoFocus
              />
              <button className="console-add-confirm" onClick={addScene}>Add</button>
            </div>
          )}
        </div>

        <div className="console-form-section console-semantic-section">
          <label>Semantic Description</label>
          <textarea
            className="console-semantic-input"
            value={semanticQuery}
            onChange={(e) => setSemanticQuery(e.target.value)}
            placeholder="Describe your ideal placement context..."
          />
        </div>

        <div className="console-button-group">
          <button
            className="console-btn console-btn-primary"
            onClick={generate}
            disabled={isGenerating || selectedProducts.size === 0}
          >
            {isGenerating ? 'Generating...' : 'Generate Posts'}
          </button>
          <button
            className="console-btn console-btn-secondary"
            onClick={deploy}
            disabled={isDeploying || placements.length === 0}
          >
            {isDeploying ? 'Deploying...' : 'Deploy Campaign'}
          </button>
        </div>
      </div>

      {/* RIGHT PANEL: Test Placements */}
      <div className="console-panel-placements">
        <h2>Test Placements</h2>
        <div className="console-placements-container">
          {placements.length === 0 ? (
            <div className="console-empty-state">
              <h3>No placements yet</h3>
              <p>Configure your audience and generate posts to see placement suggestions</p>
            </div>
          ) : (
            <>
              <div className="console-placements-grid">
                {placements.map((placement, index) => (
                  <div
                    key={index}
                    className="console-placement-card"
                    onClick={() => openModal(placement)}
                  >
                    <img src={placement.resultUrl || placement.img} alt={placement.location} />
                    <div className="console-placement-info">
                      <div className="console-placement-meta">
                        <h3>{placement.location}</h3>
                        <span className="console-placement-score">{placement.score}%</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="console-placements-footer">
                <p>{placements.length} placements matched</p>
                <button className="console-btn-more" onClick={generate}>
                  Generate More
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Modal */}
      {modalPlacement && (
        <div className="console-modal" onClick={(e) => e.target === e.currentTarget && closeModal()}>
          <div className="console-modal-content">
            <button className="console-modal-close" onClick={closeModal}>×</button>
            <div className="console-modal-body">
              <h2 className="console-modal-title">Placement Preview</h2>
              <div className="console-comparison-grid">
                <div className="console-comparison-item">
                  <h3>Original Scene</h3>
                  <img src={modalPlacement.img} alt="Original" />
                </div>
                <div className="console-comparison-item">
                  <h3>With Product Placement</h3>
                  {modalGenerating ? (
                    <div className="console-generating">
                      <div className="console-spinner" />
                      <span>Generating placement...</span>
                    </div>
                  ) : modalPlacement.resultUrl ? (
                    <img src={modalPlacement.resultUrl} alt="With Placement" />
                  ) : (
                    <div className="console-placeholder">
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
