/**
 * Advertiser Console
 *
 * Three-panel layout for product placement testing with collection management.
 * Features two-phase generation:
 * - Phase 1: Generate scenes + images on "Generate Posts"
 * - Phase 2: Select product + compose + mask on image click
 */

import { useState, useCallback, useRef, useEffect } from 'react'
import './Console.css'
import { saveProducts, type ProductsData } from '../../services/placementApi'

const API_BASE = import.meta.env.VITE_API_URL || ''

// IndexedDB helpers for storing large image data
const DB_NAME = 'console-db'
const DB_VERSION = 1
const STORE_NAME = 'placements'

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' })
      }
    }
  })
}

async function savePlacementsToIDB(placements: ScenePlacement[]): Promise<void> {
  const db = await openDB()
  const tx = db.transaction(STORE_NAME, 'readwrite')
  const store = tx.objectStore(STORE_NAME)

  // Clear existing and save all
  store.clear()
  placements.forEach((p, i) => store.put({ ...p, id: p.sceneId || `placement-${i}` }))

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => { db.close(); resolve() }
    tx.onerror = () => { db.close(); reject(tx.error) }
  })
}

async function loadPlacementsFromIDB(): Promise<ScenePlacement[]> {
  const db = await openDB()
  const tx = db.transaction(STORE_NAME, 'readonly')
  const store = tx.objectStore(STORE_NAME)
  const request = store.getAll()

  return new Promise((resolve, reject) => {
    request.onsuccess = () => { db.close(); resolve(request.result || []) }
    request.onerror = () => { db.close(); reject(request.error) }
  })
}

async function clearPlacementsIDB(): Promise<void> {
  const db = await openDB()
  const tx = db.transaction(STORE_NAME, 'readwrite')
  tx.objectStore(STORE_NAME).clear()

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => { db.close(); resolve() }
    tx.onerror = () => { db.close(); reject(tx.error) }
  })
}

// Types
interface ProductTargeting {
  demographics: string[]
  interests: string[]
  scenes: string[]
  semantic?: string
}

interface Product {
  id: string
  name: string
  img: string
  description?: string
  targeting?: ProductTargeting
}

interface Collection {
  id: string
  name: string
  displayName: string
  products: Product[]
}

// Scene placement from Phase 1
interface ScenePlacement {
  sceneId: string
  description: string
  mood: string
  sceneType: 'continuation' | 'exploration'
  imageData: string  // base64
  mimeType: string
  // Phase 2 results (filled when user clicks)
  selectedProduct?: {
    id: string
    name: string
    brand: string
  }
  placementHint?: string
  rationale?: string
  composedImage?: string  // base64
  maskImage?: string  // base64
}

type ModalPhase = 'idle' | 'selecting' | 'composing' | 'complete' | 'error'

interface Toast {
  id: number
  message: string
}

type GenerationPhase = 'idle' | 'generating-scenes' | 'generating-images' | 'complete' | 'error'

// Products loaded from /data/products.json

const DEFAULT_INTERESTS = ['Fashion', 'Luxury', 'Art', 'Travel', 'Lifestyle', 'Minimalist']
const DEFAULT_SCENES = ['Interior', 'Lifestyle', 'Outdoor', 'Café', 'Boutique', 'Street', 'Gallery', 'Garden']

export default function Console() {
  // Loading state for products
  const [isLoadingProducts, setIsLoadingProducts] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  // Collection state
  const [collections, setCollections] = useState<Collection[]>([])
  const [currentCollectionId, setCurrentCollectionId] = useState('')
  const [dropdownOpen, setDropdownOpen] = useState(false)

  // Product state
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set())

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

  // Image count setting
  const [imageCount, setImageCount] = useState(4)

  // Generation state (Phase 1)
  const [placements, setPlacements] = useState<ScenePlacement[]>([])
  const [generationPhase, setGenerationPhase] = useState<GenerationPhase>('idle')
  const [generationError, setGenerationError] = useState<string | null>(null)
  const [isDeploying, setIsDeploying] = useState(false)

  // Modal state (Phase 2)
  const [modalPlacement, setModalPlacement] = useState<ScenePlacement | null>(null)
  const [modalPhase, setModalPhase] = useState<ModalPhase>('idle')
  const [modalError, setModalError] = useState<string | null>(null)

  // Batch placement generation state
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set())
  // Track which scenes are waiting for image generation
  const [, setGeneratingImageIds] = useState<Set<string>>(new Set())
  // Track image generation progress (0-100)
  const [imageGenProgress, setImageGenProgress] = useState(0)

  // Toast state
  const [toasts, setToasts] = useState<Toast[]>([])
  const toastIdRef = useRef(0)

  // Product hover/edit state
  const [hoveredProductId, setHoveredProductId] = useState<string | null>(null)
  const [editingProductId, setEditingProductId] = useState<string | null>(null)
  const [editingProductName, setEditingProductName] = useState('')

  // Confirmation modal state
  const [confirmModal, setConfirmModal] = useState<{
    open: boolean
    title: string
    message: string
    onConfirm: () => void
  }>({ open: false, title: '', message: '', onConfirm: () => {} })

  // File input refs
  const newCollectionInputRef = useRef<HTMLInputElement>(null)
  const addToCollectionInputRef = useRef<HTMLInputElement>(null)
  const addTileInputRef = useRef<HTMLInputElement>(null)

  // Current collection
  const currentCollection = collections.find(c => c.id === currentCollectionId) || collections[0]

  // Load products from JSON on mount
  useEffect(() => {
    fetch('/data/products.json')
      .then(res => {
        if (!res.ok) throw new Error('Failed to load products')
        return res.json()
      })
      .then((data: { collections: Collection[] }) => {
        setCollections(data.collections)
        const firstCollection = data.collections[0]
        if (firstCollection) {
          setCurrentCollectionId(firstCollection.id)
          // Select all products from first collection by default
          setSelectedProducts(new Set(firstCollection.products.map(p => p.id)))
        }
        setIsLoadingProducts(false)
      })
      .catch(err => {
        console.error('Failed to load products:', err)
        setLoadError('Failed to load product catalog')
        setIsLoadingProducts(false)
      })
  }, [])

  // Load placements from IndexedDB on mount
  useEffect(() => {
    loadPlacementsFromIDB()
      .then((stored) => {
        if (stored.length > 0) {
          setPlacements(stored)
        }
      })
      .catch((e) => console.warn('Failed to load placements from IndexedDB:', e))
  }, [])

  // Save placements to IndexedDB when they change
  useEffect(() => {
    if (placements.length > 0) {
      savePlacementsToIDB(placements)
        .catch((e) => console.warn('Failed to save placements to IndexedDB:', e))
    }
  }, [placements])

  // Show toast
  const showToast = useCallback((message: string) => {
    const id = ++toastIdRef.current
    setToasts(prev => [...prev, { id, message }])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 3000)
  }, [])

  // Clear all placements (including from IndexedDB)
  // Actually perform the clear
  const doClearPlacements = useCallback(async () => {
    setPlacements([])
    await clearPlacementsIDB()
    showToast('Cleared all placements')
    setConfirmModal(prev => ({ ...prev, open: false }))
  }, [showToast])

  // Show confirmation modal before clearing
  const clearPlacements = useCallback(() => {
    setConfirmModal({
      open: true,
      title: 'Clear All Placements',
      message: `This will remove all ${placements.length} placements. This action cannot be undone.`,
      onConfirm: doClearPlacements,
    })
  }, [placements.length, doClearPlacements])

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
          showToast(`Added ${files.length} image${files.length > 1 ? 's' : ''} to ${currentCollection?.displayName || 'collection'}`)
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

  // Start editing a product name
  const startEditingProduct = (product: Product, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingProductId(product.id)
    setEditingProductName(product.name)
  }

  // Save edited product name
  const saveProductEdit = () => {
    if (!editingProductId || !editingProductName.trim()) {
      setEditingProductId(null)
      return
    }
    setCollections(prev => prev.map(c => ({
      ...c,
      products: c.products.map(p =>
        p.id === editingProductId ? { ...p, name: editingProductName.trim() } : p
      )
    })))
    showToast(`Updated product name`)
    setEditingProductId(null)
    setEditingProductName('')
  }

  // Cancel product edit
  const cancelProductEdit = () => {
    setEditingProductId(null)
    setEditingProductName('')
  }

  // Delete a product from collection
  const deleteProduct = (productId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setCollections(prev => prev.map(c => ({
      ...c,
      products: c.products.filter(p => p.id !== productId)
    })))
    setSelectedProducts(prev => {
      const next = new Set(prev)
      next.delete(productId)
      return next
    })
    setHoveredProductId(null)
    showToast('Removed product from collection')
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

  // Build writing context from targeting selections
  const buildWritingContext = useCallback(() => {
    const parts: string[] = []

    parts.push(`Target audience: ${selectedAge} year olds`)

    if (selectedInterests.size > 0) {
      parts.push(`Interests: ${Array.from(selectedInterests).join(', ')}`)
    }

    if (selectedScenes.size > 0) {
      parts.push(`Scene preferences: ${Array.from(selectedScenes).join(', ')}`)
    }

    if (semanticQuery.trim()) {
      parts.push(`Additional context: ${semanticQuery.trim()}`)
    }

    if (currentCollection) {
      parts.push(`Brand: ${currentCollection.displayName}`)
    }

    return parts.join('\n')
  }, [selectedAge, selectedInterests, selectedScenes, semanticQuery, currentCollection])

  // Phase 1: Generate scenes and images (with per-card loading)
  const generate = useCallback(async () => {
    if (selectedProducts.size === 0) {
      alert('Please select at least one product')
      return
    }

    setGenerationError(null)

    try {
      // Step 1: Generate scene descriptions
      setGenerationPhase('generating-scenes')

      const writingContext = buildWritingContext()

      // Split image count: ~60% continuation, ~40% exploration
      const continuationCount = Math.ceil(imageCount * 0.6)
      const explorationCount = imageCount - continuationCount

      const scenesResponse = await fetch(`${API_BASE}/api/placement/scenes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          writing_context: writingContext,
          liked_scenes: [],  // TODO: track liked scenes for continuity
          continuation_count: continuationCount,
          exploration_count: explorationCount,
        }),
      })

      if (!scenesResponse.ok) {
        throw new Error(`Scene generation failed: ${scenesResponse.statusText}`)
      }

      const scenesData = await scenesResponse.json()

      if (!scenesData.scenes || scenesData.scenes.length === 0) {
        throw new Error('No scenes generated')
      }

      // Step 2: Generate images one at a time, only show when complete
      setGenerationPhase('generating-images')
      setImageGenProgress(0)

      const totalImages = scenesData.scenes.length
      let completedCount = 0
      let successCount = 0
      let failCount = 0

      for (const scene of scenesData.scenes) {
        try {
          const imgResponse = await fetch(`${API_BASE}/api/placement/generate-images`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              scenes: [{
                scene_id: scene.id,
                scene_description: scene.description,
                mood: scene.mood,
              }],
            }),
          })

          if (imgResponse.ok) {
            const imgData = await imgResponse.json()
            const img = imgData.images?.[0]
            if (img) {
              // Add completed image directly to placements
              const newPlacement: ScenePlacement = {
                sceneId: scene.id,
                description: scene.description,
                mood: scene.mood,
                sceneType: scene.scene_type || 'exploration',
                imageData: img.image_data,
                mimeType: img.mime_type,
              }
              setPlacements(prev => [...prev, newPlacement])
              successCount++
            } else {
              failCount++
            }
          } else {
            failCount++
          }
        } catch (e) {
          console.error(`Failed to generate image for ${scene.id}:`, e)
          failCount++
        }

        // Update progress after each image (success or fail)
        completedCount++
        setImageGenProgress(Math.round((completedCount / totalImages) * 100))
      }

      setGenerationPhase('complete')
      if (failCount > 0) {
        showToast(`Generated ${successCount} scenes (${failCount} failed)`)
      } else {
        showToast(`Generated ${successCount} new scenes`)
      }

    } catch (err) {
      console.error('Generation failed:', err)
      setGenerationError(err instanceof Error ? err.message : 'Generation failed')
      setGenerationPhase('error')
      setGeneratingImageIds(new Set())
    }
  }, [selectedProducts, buildWritingContext, imageCount, showToast])

  // Phase 2: Select product, compose, and generate mask
  const runPhase2 = useCallback(async (placement: ScenePlacement) => {
    setModalError(null)

    // Get available products for this collection (with targeting)
    const availableProducts = currentCollection?.products
      .filter(p => selectedProducts.has(p.id))
      .map(p => ({
        id: p.id,
        name: p.name,
        brand: currentCollection.displayName,
        description: p.description || `${currentCollection.displayName} ${p.name}`,
        image_url: p.img,
        // Include advertiser targeting preferences
        target_demographics: p.targeting?.demographics || [],
        target_interests: p.targeting?.interests || [],
        scene_preferences: p.targeting?.scenes || [],
        semantic_filter: p.targeting?.semantic,
      })) || []

    if (availableProducts.length === 0) {
      setModalError('No products selected')
      setModalPhase('error')
      return
    }

    try {
      // Step 3: Select product for this scene
      setModalPhase('selecting')

      const selectResponse = await fetch(`${API_BASE}/api/placement/select-products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          images: [{
            scene_id: placement.sceneId,
            image_data: placement.imageData,
            mime_type: placement.mimeType,
          }],
          products: availableProducts,
        }),
      })

      if (!selectResponse.ok) {
        throw new Error(`Product selection failed: ${selectResponse.statusText}`)
      }

      const selectData = await selectResponse.json()
      const selection = selectData.selections?.[0]

      if (!selection) {
        throw new Error('No product selected')
      }

      // Update modal with selection info
      const selectedProd = availableProducts.find(p => p.id === selection.selected_product_id)
      const updatedPlacement: ScenePlacement = {
        ...placement,
        selectedProduct: selectedProd ? {
          id: selectedProd.id,
          name: selectedProd.name,
          brand: selectedProd.brand,
        } : undefined,
        placementHint: selection.placement_hint,
        rationale: selection.rationale,
      }

      setModalPlacement(updatedPlacement)

      // Step 4: Compose product into scene
      setModalPhase('composing')

      // Get product image as base64 if available
      let productBase64 = ''
      let productMimeType = 'image/jpeg'
      if (selectedProd?.image_url) {
        try {
          const { base64, mimeType } = await urlToBase64(selectedProd.image_url)
          productBase64 = base64
          productMimeType = mimeType
        } catch {
          // Use empty if can't load
        }
      }

      const composeResponse = await fetch(`${API_BASE}/api/placement/compose-batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tasks: [{
            scene_id: placement.sceneId,
            scene_image: placement.imageData,
            scene_mime_type: placement.mimeType,
            product: selectedProd,
            product_image: productBase64,
            product_mime_type: productMimeType,
            placement_hint: selection.placement_hint,
          }],
        }),
      })

      if (!composeResponse.ok) {
        throw new Error(`Composition failed: ${composeResponse.statusText}`)
      }

      const composeData = await composeResponse.json()
      const composedImg = composeData.images?.[0]

      if (!composedImg) {
        throw new Error('No composed image created')
      }

      // Step 5: Generate mask
      const maskResponse = await fetch(`${API_BASE}/api/placement/generate-masks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tasks: [{
            scene_id: placement.sceneId,
            composed_image: composedImg.image_data,
            mime_type: composedImg.mime_type,
            product_name: selectedProd?.name || 'product',
          }],
        }),
      })

      if (!maskResponse.ok) {
        throw new Error(`Mask generation failed: ${maskResponse.statusText}`)
      }

      const maskData = await maskResponse.json()
      const mask = maskData.masks?.[0]

      // Final update with all Phase 2 results
      const finalPlacement: ScenePlacement = {
        ...updatedPlacement,
        composedImage: composedImg.image_data,
        maskImage: mask?.mask_data,
      }

      setModalPlacement(finalPlacement)

      // Also update in the main placements array
      setPlacements(prev => prev.map(p =>
        p.sceneId === placement.sceneId ? finalPlacement : p
      ))

      setModalPhase('complete')

    } catch (err) {
      console.error('Phase 2 failed:', err)
      setModalError(err instanceof Error ? err.message : 'Processing failed')
      setModalPhase('error')
    }
  }, [currentCollection, selectedProducts, urlToBase64])

  // Generate placement for a single card (without opening modal)
  const generateSinglePlacement = useCallback(async (placement: ScenePlacement, e?: React.MouseEvent) => {
    e?.stopPropagation() // Don't open modal

    if (placement.composedImage || processingIds.has(placement.sceneId)) return

    setProcessingIds(prev => new Set([...prev, placement.sceneId]))

    const availableProducts = currentCollection?.products
      .filter(p => selectedProducts.has(p.id))
      .map(p => ({
        id: p.id,
        name: p.name,
        brand: currentCollection.displayName,
        description: p.description || `${currentCollection.displayName} ${p.name}`,
        image_url: p.img,
        // Include advertiser targeting preferences
        target_demographics: p.targeting?.demographics || [],
        target_interests: p.targeting?.interests || [],
        scene_preferences: p.targeting?.scenes || [],
        semantic_filter: p.targeting?.semantic,
      })) || []

    if (availableProducts.length === 0) {
      setProcessingIds(prev => { const next = new Set(prev); next.delete(placement.sceneId); return next })
      return
    }

    try {
      // Step 3: Select product
      const selectResponse = await fetch(`${API_BASE}/api/placement/select-products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          images: [{ scene_id: placement.sceneId, image_data: placement.imageData, mime_type: placement.mimeType }],
          products: availableProducts,
        }),
      })

      if (!selectResponse.ok) throw new Error('Selection failed')
      const selectData = await selectResponse.json()
      const selection = selectData.selections?.[0]
      if (!selection) throw new Error('No product selected')

      const selectedProd = availableProducts.find(p => p.id === selection.selected_product_id)

      // Step 4: Compose
      let productBase64 = ''
      let productMimeType = 'image/jpeg'
      if (selectedProd?.image_url) {
        try {
          const { base64, mimeType } = await urlToBase64(selectedProd.image_url)
          productBase64 = base64
          productMimeType = mimeType
        } catch { /* ignore */ }
      }

      const composeResponse = await fetch(`${API_BASE}/api/placement/compose-batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tasks: [{
            scene_id: placement.sceneId,
            scene_image: placement.imageData,
            scene_mime_type: placement.mimeType,
            product: selectedProd,
            product_image: productBase64,
            product_mime_type: productMimeType,
            placement_hint: selection.placement_hint,
          }],
        }),
      })

      if (!composeResponse.ok) throw new Error('Composition failed')
      const composeData = await composeResponse.json()
      const composedImg = composeData.images?.[0]
      if (!composedImg) throw new Error('No composed image')

      // Step 5: Generate mask
      const maskResponse = await fetch(`${API_BASE}/api/placement/generate-masks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tasks: [{
            scene_id: placement.sceneId,
            composed_image: composedImg.image_data,
            mime_type: composedImg.mime_type,
            product_name: selectedProd?.name || 'product',
          }],
        }),
      })

      const maskData = maskResponse.ok ? await maskResponse.json() : { masks: [] }
      const mask = maskData.masks?.[0]

      // Update placements
      setPlacements(prev => prev.map(p =>
        p.sceneId === placement.sceneId ? {
          ...p,
          selectedProduct: selectedProd ? { id: selectedProd.id, name: selectedProd.name, brand: selectedProd.brand } : undefined,
          placementHint: selection.placement_hint,
          rationale: selection.rationale,
          composedImage: composedImg.image_data,
          maskImage: mask?.mask_data,
        } : p
      ))

    } catch (err) {
      console.error('Single placement failed:', err)
    }

    setProcessingIds(prev => { const next = new Set(prev); next.delete(placement.sceneId); return next })
  }, [currentCollection, selectedProducts, urlToBase64, processingIds])

  // Generate placements for all unprocessed images
  const generateAllPlacements = useCallback(async () => {
    const unprocessed = placements.filter(p => !p.composedImage && !processingIds.has(p.sceneId))
    if (unprocessed.length === 0) return

    // Process all in parallel
    await Promise.all(unprocessed.map(p => generateSinglePlacement(p)))
    showToast(`Processed ${unprocessed.length} placements`)
  }, [placements, processingIds, generateSinglePlacement])

  // Deploy campaign - saves product catalog and shows success
  const deploy = async () => {
    if (placements.length === 0) {
      alert('No placements to deploy')
      return
    }

    setIsDeploying(true)

    try {
      // Save product catalog with targeting preferences
      const productsData: ProductsData = {
        collections: collections.map(c => ({
          id: c.id,
          name: c.name,
          displayName: c.displayName,
          products: c.products.map(p => ({
            id: p.id,
            name: p.name,
            img: p.img,
            description: p.description,
            targeting: p.targeting,
          })),
        })),
      }

      const result = await saveProducts(productsData)
      showToast(`Saved ${result.product_count} products`)

      // Simulate deployment delay
      await new Promise(resolve => setTimeout(resolve, 500))
      alert('Campaign deployed successfully!')
    } catch (error) {
      console.error('Deploy failed:', error)
      alert(`Deploy failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsDeploying(false)
    }
  }

  // Open modal - only view, don't auto-generate
  const openModal = (placement: ScenePlacement) => {
    // Don't open modal if currently generating new scenes
    if (isGenerating) return

    setModalPlacement(placement)
    setModalError(null)

    // Just show what we have - user can manually trigger Phase 2 if needed
    if (placement.composedImage) {
      setModalPhase('complete')
    } else {
      setModalPhase('idle')
    }
  }

  // Close modal
  const closeModal = () => {
    setModalPlacement(null)
    setModalPhase('idle')
    setModalError(null)
  }

  // Helper to check if currently generating
  const isGenerating = generationPhase === 'generating-scenes' || generationPhase === 'generating-images'

  const featuredProduct = currentCollection?.products[0]

  // Show loading state while fetching products
  if (isLoadingProducts) {
    return (
      <div className="console-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div style={{ textAlign: 'center', color: 'var(--warm-brown)' }}>
          <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Loading products...</div>
          <div style={{ fontSize: '0.875rem', opacity: 0.7 }}>Fetching product catalog</div>
        </div>
      </div>
    )
  }

  // Show error if products failed to load
  if (loadError) {
    return (
      <div className="console-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div style={{ textAlign: 'center', color: '#c41e3a' }}>
          <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Error</div>
          <div style={{ fontSize: '0.875rem' }}>{loadError}</div>
        </div>
      </div>
    )
  }

  // Guard against empty collections
  if (!currentCollection) {
    return (
      <div className="console-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div style={{ textAlign: 'center', color: 'var(--warm-brown)' }}>
          <div style={{ fontSize: '1.5rem' }}>No products available</div>
        </div>
      </div>
    )
  }

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
              className={`console-product-tile ${selectedProducts.has(product.id) ? 'selected' : ''} ${hoveredProductId === product.id ? 'hovered' : ''}`}
              onClick={() => toggleProduct(product.id)}
              onMouseEnter={() => setHoveredProductId(product.id)}
              onMouseLeave={() => {
                if (editingProductId !== product.id) {
                  setHoveredProductId(null)
                }
              }}
            >
              <img src={product.img} alt={product.name} />
              {/* Hover popup */}
              {hoveredProductId === product.id && (
                <div className="console-product-popup" onClick={(e) => e.stopPropagation()}>
                  {editingProductId === product.id ? (
                    <div className="console-product-popup-edit">
                      <input
                        type="text"
                        value={editingProductName}
                        onChange={(e) => setEditingProductName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') saveProductEdit()
                          if (e.key === 'Escape') cancelProductEdit()
                        }}
                        autoFocus
                        placeholder="Product name"
                      />
                      <div className="console-product-popup-actions">
                        <button onClick={saveProductEdit} className="save">Save</button>
                        <button onClick={cancelProductEdit} className="cancel">Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="console-product-popup-header">
                        <span className="console-product-popup-brand">{currentCollection.displayName}</span>
                        <span className="console-product-popup-name">{product.name}</span>
                      </div>
                      <div className="console-product-popup-actions">
                        <button onClick={(e) => startEditingProduct(product, e)} className="edit">Edit</button>
                        <button onClick={(e) => deleteProduct(product.id, e)} className="delete">Remove</button>
                      </div>
                    </>
                  )}
                </div>
              )}
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
              <button
                key={interest}
                type="button"
                className={`console-pill ${selectedInterests.has(interest) ? 'selected' : ''}`}
                onClick={() => toggleInterest(interest)}
              >
                {interest}
              </button>
            ))}
            <button type="button" className="console-pill add-btn" onClick={() => setShowInterestInput(true)}>
              + Add
            </button>
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
              <button
                key={scene}
                type="button"
                className={`console-scene-chip ${selectedScenes.has(scene) ? 'selected' : ''}`}
                onClick={() => toggleScene(scene)}
              >
                {scene}
              </button>
            ))}
            <button type="button" className="console-scene-chip add-btn" onClick={() => setShowSceneInput(true)}>
              + Add
            </button>
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

        {/* Image count selector */}
        <div className="console-image-count">
          <label>Images: {imageCount}</label>
          <input
            type="range"
            min="1"
            max="9"
            value={imageCount}
            onChange={(e) => setImageCount(Number(e.target.value))}
            className="console-count-slider"
          />
        </div>

        <div className="console-button-group">
          <button
            className={`console-btn console-btn-primary ${isGenerating ? 'generating' : ''}`}
            onClick={generate}
            disabled={isGenerating || selectedProducts.size === 0}
          >
            {isGenerating ? (
              <>
                <span className="console-btn-loading">
                  <span className="console-btn-spinner" />
                  {generationPhase === 'generating-scenes'
                    ? 'Creating scenes... ~20s'
                    : `Generating images... ${imageGenProgress}%`}
                </span>
                <span
                  key={generationPhase}
                  className={`console-btn-progress-bar ${generationPhase === 'generating-scenes' ? 'timed' : ''}`}
                  style={generationPhase === 'generating-scenes'
                    ? { animationDuration: '25s' }
                    : { width: `${imageGenProgress}%`, transition: 'width 0.3s ease-out' }
                  }
                />
              </>
            ) : 'Generate Posts'}
          </button>
          {generationError && (
            <div className="console-error-inline">
              <p className="console-error">{generationError}</p>
              <button
                type="button"
                className="console-error-retry"
                onClick={() => {
                  setGenerationError(null)
                  generate()
                }}
              >
                Retry
              </button>
            </div>
          )}
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
                    key={placement.sceneId || index}
                    className={`console-placement-card ${placement.composedImage ? 'has-result' : ''} ${processingIds.has(placement.sceneId) ? 'processing' : ''}`}
                    onClick={() => openModal(placement)}
                  >
                    <img
                      src={placement.composedImage
                        ? `data:${placement.mimeType};base64,${placement.composedImage}`
                        : `data:${placement.mimeType};base64,${placement.imageData}`
                      }
                      alt={placement.description}
                    />
                    {/* Processing overlay for Phase 2 */}
                    {processingIds.has(placement.sceneId) && (
                      <div className="console-card-processing">
                        <div className="console-spinner" />
                      </div>
                    )}
                    {/* Generate button for unprocessed cards (only if image exists and not during Phase 1) */}
                    {placement.imageData && !placement.composedImage && !processingIds.has(placement.sceneId) && !isGenerating && (
                      <button
                        className="console-card-generate-btn"
                        onClick={(e) => generateSinglePlacement(placement, e)}
                        title="Generate placement"
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M12 5v14M5 12h14" />
                        </svg>
                      </button>
                    )}
                    <div className="console-placement-info">
                      <h3>{placement.mood}</h3>
                      {placement.selectedProduct && (
                        <p className="console-placement-product">
                          {placement.selectedProduct.name}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <div className="console-placements-footer">
                <p>{placements.length} scenes • {placements.filter(p => p.composedImage).length} placed</p>
                <div className="console-footer-buttons">
                  {placements.some(p => !p.composedImage) && (
                    <button
                      className="console-btn-place-all"
                      onClick={generateAllPlacements}
                      disabled={processingIds.size > 0}
                    >
                      {processingIds.size > 0 ? `Processing ${processingIds.size}...` : 'Place All'}
                    </button>
                  )}
                  <button className="console-btn-more" onClick={generate} disabled={isGenerating}>
                    {isGenerating ? 'Generating...' : 'More Scenes'}
                  </button>
                  <button className="console-btn-clear" onClick={clearPlacements}>
                    Clear
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Modal */}
      {modalPlacement && (
        <div className="console-modal" onClick={(e) => {
          if (e.target === e.currentTarget) closeModal()
        }}>
          <div className="console-modal-content">
            <button className="console-modal-close" onClick={closeModal}>×</button>
            <div className="console-modal-body">
              <h2 className="console-modal-title">Placement Preview</h2>

              {/* Scene description */}
              <p className="console-modal-description">{modalPlacement.description}</p>

              {/* Product selection info */}
              {modalPlacement.selectedProduct && (
                <div className="console-selection-info">
                  <div className="console-selection-header">
                    <span className="console-selection-label">AI Selected:</span>
                    <span className="console-selection-product">
                      {modalPlacement.selectedProduct.brand} {modalPlacement.selectedProduct.name}
                    </span>
                  </div>
                  {modalPlacement.placementHint && (
                    <p className="console-selection-placement">
                      <strong>Placement:</strong> {modalPlacement.placementHint}
                    </p>
                  )}
                  {modalPlacement.rationale && (
                    <p className="console-selection-rationale">
                      {modalPlacement.rationale}
                    </p>
                  )}
                </div>
              )}

              <div className="console-comparison-grid">
                <div className="console-comparison-item">
                  <h3>Original Scene</h3>
                  <img
                    src={`data:${modalPlacement.mimeType};base64,${modalPlacement.imageData}`}
                    alt="Original"
                  />
                </div>
                <div className="console-comparison-item">
                  <h3>With Product Placement</h3>
                  {modalPlacement.composedImage ? (
                    <img
                      src={`data:${modalPlacement.mimeType};base64,${modalPlacement.composedImage}`}
                      alt="With Placement"
                    />
                  ) : (modalPhase === 'selecting' || modalPhase === 'composing') ? (
                    <div className="console-generating">
                      <div className="console-spinner" />
                      <div className="console-modal-progress">
                        <div className="console-progress-bar-container">
                          <div className="console-progress-bar timed" style={{ animationDuration: '25s' }} />
                        </div>
                        <p className="console-progress-status">
                          {modalPhase === 'selecting' ? 'Selecting best product... ~5s' : 'Composing into scene... ~20s'}
                        </p>
                      </div>
                    </div>
                  ) : modalPhase === 'error' ? (
                    <div className="console-error-state">
                      <span>⚠️ {modalError || 'Processing failed'}</span>
                      <button onClick={() => runPhase2(modalPlacement)}>Retry</button>
                    </div>
                  ) : (
                    <div className="console-placeholder-action">
                      <p>Click to generate product placement</p>
                      <button className="console-btn console-btn-primary" onClick={() => runPhase2(modalPlacement)}>
                        Generate Placement
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmModal.open && (
        <div className="console-confirm-overlay" onClick={() => setConfirmModal(prev => ({ ...prev, open: false }))}>
          <div className="console-confirm-modal" onClick={(e) => e.stopPropagation()}>
            <h3>{confirmModal.title}</h3>
            <p>{confirmModal.message}</p>
            <div className="console-confirm-actions">
              <button
                type="button"
                className="console-confirm-cancel"
                onClick={() => setConfirmModal(prev => ({ ...prev, open: false }))}
              >
                Cancel
              </button>
              <button
                type="button"
                className="console-confirm-delete"
                onClick={confirmModal.onConfirm}
              >
                Clear All
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
