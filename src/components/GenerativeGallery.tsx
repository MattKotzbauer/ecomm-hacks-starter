/**
 * GenerativeGallery - Scroll-triggered AI-generated product placement gallery
 *
 * Built on ConsumerGallery's delightful UI with:
 * - Scroll-triggered generation (scrolling past last cards triggers new batch)
 * - WritingPane context feeds into AI generation
 * - Like functionality influences future generations (continuation vs exploration)
 * - Pre-generated defaults on initial load
 * - IndexedDB session persistence
 *
 * Reuses all ConsumerGallery features:
 * - Mask-based hover detection (only product areas trigger popup)
 * - ProductOverlay with Buy Now confirmation
 * - ShoppingBag with checkout flow
 * - Double-click to expand, drag to reposition
 * - Fade zones, scroll indicator, infinite scroll
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import clsx from 'clsx'
import { ShoppingBag } from './ShoppingBag'
import { ProductOverlay } from './ProductOverlay'
import { PaymentScreen } from './PaymentScreen'
import { UserProfile } from './UserProfile'
import type { Product, BagItem, PaymentInfo } from './ConsumerCanvas'
import { WritingPane } from './WritingPane'
import { ResizeDivider } from './ResizeDivider'
import {
  useGenerativePlacements,
  type GeneratedPlacement,
} from '../hooks/useGenerativePlacements'
import './ConsumerGallery.css'
import './GenerativeGallery.css'

// Pre-generated gallery images with products and masks for instant initial render
// These have real product placements and masks for hover interaction
const PREGENERATED_GALLERY = [
  {
    id: 'gallery-0',
    sceneUrl: '/gallery/scene_0.png',
    baseUrl: '/gallery/base_0.jpg',
    maskUrl: '/gallery/mask_0.png',
    product: {
      id: 'product-0',
      name: 'Neverfull MM',
      brand: 'Louis Vuitton',
      price: 2030,
      currency: 'USD',
      imageUrl: '/gallery/product_0.jpg',
    },
  },
  {
    id: 'gallery-1',
    sceneUrl: '/gallery/scene_1.png',
    baseUrl: '/gallery/base_1.jpg',
    maskUrl: '/gallery/mask_1.png',
    product: {
      id: 'product-1',
      name: 'GG Marmont',
      brand: 'Gucci',
      price: 2350,
      currency: 'USD',
      imageUrl: '/gallery/product_1.jpg',
    },
  },
  {
    id: 'gallery-2',
    sceneUrl: '/gallery/scene_2.png',
    baseUrl: '/gallery/base_2.jpg',
    maskUrl: '/gallery/mask_2.png',
    product: {
      id: 'product-2',
      name: 'Classic Flap',
      brand: 'Chanel',
      price: 8200,
      currency: 'USD',
      imageUrl: '/gallery/product_2.jpg',
    },
  },
  {
    id: 'gallery-3',
    sceneUrl: '/gallery/scene_3.png',
    baseUrl: '/gallery/base_3.jpg',
    maskUrl: '/gallery/mask_3.png',
    product: {
      id: 'product-3',
      name: 'Galleria Saffiano',
      brand: 'Prada',
      price: 3200,
      currency: 'USD',
      imageUrl: '/gallery/product_3.jpg',
    },
  },
  {
    id: 'gallery-4',
    sceneUrl: '/gallery/scene_4.png',
    baseUrl: '/gallery/base_4.jpg',
    maskUrl: '/gallery/mask_4.png',
    product: {
      id: 'product-4',
      name: 'Loulou Medium',
      brand: 'Saint Laurent',
      price: 2590,
      currency: 'USD',
      imageUrl: '/gallery/product_4.jpg',
    },
  },
  {
    id: 'gallery-5',
    sceneUrl: '/gallery/scene_5.png',
    baseUrl: '/gallery/base_5.jpg',
    maskUrl: '/gallery/mask_5.png',
    product: {
      id: 'product-5',
      name: 'Triomphe Bag',
      brand: 'Celine',
      price: 2950,
      currency: 'USD',
      imageUrl: '/gallery/product_5.jpg',
    },
  },
  {
    id: 'gallery-6',
    sceneUrl: '/gallery/scene_6.png',
    baseUrl: '/gallery/base_6.jpg',
    maskUrl: '/gallery/mask_6.png',
    product: {
      id: 'product-6',
      name: 'Le Pliage',
      brand: 'Longchamp',
      price: 145,
      currency: 'USD',
      imageUrl: '/gallery/product_6.jpg',
    },
  },
  {
    id: 'gallery-7',
    sceneUrl: '/gallery/scene_7.png',
    baseUrl: '/gallery/base_7.jpg',
    maskUrl: '/gallery/mask_7.png',
    product: {
      id: 'product-7',
      name: 'Puzzle Bag',
      brand: 'Loewe',
      price: 3650,
      currency: 'USD',
      imageUrl: '/gallery/product_7.jpg',
    },
  },
  {
    id: 'gallery-8',
    sceneUrl: '/gallery/scene_8.png',
    baseUrl: '/gallery/base_8.jpg',
    maskUrl: '/gallery/mask_8.png',
    product: {
      id: 'product-8',
      name: 'Dionysus',
      brand: 'Gucci',
      price: 2980,
      currency: 'USD',
      imageUrl: '/gallery/product_8.jpg',
    },
  },
  {
    id: 'gallery-9',
    sceneUrl: '/gallery/scene_9.png',
    baseUrl: '/gallery/base_9.jpg',
    maskUrl: '/gallery/mask_9.png',
    product: {
      id: 'product-9',
      name: 'Peekaboo ISeeU',
      brand: 'Fendi',
      price: 4200,
      currency: 'USD',
      imageUrl: '/gallery/product_9.jpg',
    },
  },
  {
    id: 'gallery-10',
    sceneUrl: '/gallery/scene_10.png',
    baseUrl: '/gallery/base_10.jpg',
    maskUrl: '/gallery/mask_10.png',
    product: {
      id: 'product-10',
      name: 'Speedy Bandouliere',
      brand: 'Louis Vuitton',
      price: 1640,
      currency: 'USD',
      imageUrl: '/gallery/product_10.jpg',
    },
  },
  {
    id: 'gallery-11',
    sceneUrl: '/gallery/scene_11.png',
    baseUrl: '/gallery/base_11.jpg',
    maskUrl: '/gallery/mask_11.png',
    product: {
      id: 'product-11',
      name: 'Lady Dior',
      brand: 'Dior',
      price: 5500,
      currency: 'USD',
      imageUrl: '/gallery/product_11.jpg',
    },
  },
  {
    id: 'gallery-12',
    sceneUrl: '/gallery/scene_12.png',
    baseUrl: '/gallery/base_12.jpg',
    maskUrl: '/gallery/mask_12.png',
    product: {
      id: 'product-12',
      name: 'Cabas Phantom',
      brand: 'Celine',
      price: 2100,
      currency: 'USD',
      imageUrl: '/gallery/product_12.jpg',
    },
  },
]

// Pipeline step timing (estimated) for progress bar
const PIPELINE_STEPS = [
  { name: 'Crafting scenes', duration: 20 },      // ~20s
  { name: 'Generating images', duration: 8 },     // ~8s
  { name: 'Selecting products', duration: 26 },   // ~26s
  { name: 'Composing placement', duration: 13 },  // ~13s
  { name: 'Creating masks', duration: 12 },       // ~12s
]
const TOTAL_DURATION = 79  // ~80s total

interface ImageCard {
  id: string
  // For generated placements (from AI pipeline)
  placement?: GeneratedPlacement
  // For pre-generated gallery items (with mask/product)
  galleryItem?: {
    id: string
    sceneUrl: string
    baseUrl: string
    maskUrl: string
    product: Product
  }
  x: number
  y: number
  vx: number
  vy: number
  opacity: number
  scale: number
  spawnTime: number
  isHovered: boolean
  isExpanded: boolean
  width: number
  height: number
  isLoading?: boolean // Skeleton card
}

interface GenerativeGalleryProps {
  debugMode?: boolean
}

let cardIdCounter = 0

export function GenerativeGallery({
  debugMode = false,
}: GenerativeGalleryProps) {
  // Generation hook - disable auto-loading from IndexedDB to ensure fresh PREGENERATED_GALLERY data
  const {
    placements,
    products,
    productsLoaded,
    isLoading: isLoadingPlacements,
    isGenerating,
    error: generationError,
    writingContext,
    generateBatch,
    toggleLike,
    setWritingContext,
    config,
  } = useGenerativePlacements({ autoLoad: false })

  // Cards state
  const [cards, setCards] = useState<ImageCard[]>([])
  const [scrollOffset, setScrollOffset] = useState(0)
  const [totalHeight, setTotalHeight] = useState(2500)
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null)

  // Track if initial generation has been triggered
  const hasInitialGenerated = useRef(false)
  const isGeneratingRef = useRef(false)
  isGeneratingRef.current = isGenerating

  // Stable ref for generateBatch to avoid dependency issues
  const generateBatchRef = useRef(generateBatch)
  generateBatchRef.current = generateBatch

  // Track if initial cards have been set (prevent re-running)
  const hasInitialCardsRef = useRef(false)

  // Gate state for scroll-triggered generation
  const [isGated, setIsGated] = useState(false)
  const [gateScrollLimit, setGateScrollLimit] = useState<number | null>(null)
  const [generationProgress, setGenerationProgress] = useState(0)
  const [currentStep, setCurrentStep] = useState('')
  const progressIntervalRef = useRef<number | null>(null)

  // Writing pane state
  const [writingPaneWidth, setWritingPaneWidth] = useState(() => {
    const saved = localStorage.getItem('generative-writing-pane-width')
    return saved ? parseFloat(saved) : 33.33
  })

  // Shopping state
  const [bag, setBag] = useState<BagItem[]>([])
  const [showBag, setShowBag] = useState(false)
  const [showPayment, setShowPayment] = useState(false)
  const [showProfile, setShowProfile] = useState(false)
  const [paymentInfo, setPaymentInfo] = useState<PaymentInfo | null>(() => {
    const saved = localStorage.getItem('ephemeral-payment-info')
    return saved ? JSON.parse(saved) : null
  })
  const [purchaseSuccess, setPurchaseSuccess] = useState(false)

  // Product hover state
  const [activeProduct, setActiveProduct] = useState<{
    product: Product
    position: { x: number; y: number }
    productBounds: { left: number; right: number; top: number; bottom: number }
    cardId: string
    sceneImageUrl: string
  } | null>(null)
  const [productHoverCardId, setProductHoverCardId] = useState<string | null>(
    null
  )
  const [productClickLocked, setProductClickLocked] = useState(false)
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingCardRef = useRef<string | null>(null) // Track which card the show timeout is for

  // Removed products state
  const [removedProductCardIds, setRemovedProductCardIds] = useState<
    Set<string>
  >(new Set())

  // Drag state
  const [draggingCardId, setDraggingCardId] = useState<string | null>(null)
  const dragStartRef = useRef<{
    x: number
    y: number
    cardX: number
    cardY: number
  } | null>(null)

  // Resize state
  const [resizingCardId, setResizingCardId] = useState<string | null>(null)
  const resizeStartRef = useRef<{
    x: number
    y: number
    cardWidth: number
    cardHeight: number
  } | null>(null)

  // Refs
  const containerRef = useRef<HTMLDivElement>(null)
  const animationRef = useRef<number>()
  const scrollOffsetRef = useRef(scrollOffset)

  // Mask canvas refs for hover detection
  const maskCanvasRefs = useRef<Map<string, HTMLCanvasElement>>(new Map())
  const maskImageDataRefs = useRef<Map<string, ImageData>>(new Map())
  const highlightDataUrlRefs = useRef<Map<string, string>>(new Map())

  scrollOffsetRef.current = scrollOffset

  // === Card Creation ===

  const createCardFromPlacement = useCallback(
    (placement: GeneratedPlacement, y: number): ImageCard => {
      const widthOptions = [208, 234, 260, 286]
      const width =
        widthOptions[Math.floor(Math.random() * widthOptions.length)]!
      const heightRatio = 0.7 + Math.random() * 0.6
      const height = Math.floor(width * heightRatio)

      const columns = [12, 28, 44, 60, 76, 88]
      let x =
        columns[Math.floor(Math.random() * columns.length)]! +
        (Math.random() - 0.5) * 4
      x = Math.max(8, Math.min(92, x))

      return {
        id: `card-${++cardIdCounter}`,
        placement,
        x,
        y,
        vx: (Math.random() - 0.5) * 0.01,
        vy: (Math.random() - 0.5) * 0.04,
        opacity: 0,
        scale: 1,
        spawnTime: Date.now(),
        isHovered: false,
        isExpanded: false,
        width,
        height,
      }
    },
    []
  )

  const createCardFromGalleryItem = useCallback(
    (item: (typeof PREGENERATED_GALLERY)[0], y: number): ImageCard => {
      const widthOptions = [208, 234, 260, 286]
      const width =
        widthOptions[Math.floor(Math.random() * widthOptions.length)]!
      const heightRatio = 0.7 + Math.random() * 0.6
      const height = Math.floor(width * heightRatio)

      const columns = [12, 28, 44, 60, 76, 88]
      let x =
        columns[Math.floor(Math.random() * columns.length)]! +
        (Math.random() - 0.5) * 4
      x = Math.max(8, Math.min(92, x))

      return {
        id: `card-${++cardIdCounter}`,
        galleryItem: {
          id: item.id,
          sceneUrl: item.sceneUrl,
          baseUrl: item.baseUrl,
          maskUrl: item.maskUrl,
          product: item.product,
        },
        x,
        y,
        vx: (Math.random() - 0.5) * 0.01,
        vy: (Math.random() - 0.5) * 0.04,
        opacity: 0,
        scale: 1,
        spawnTime: Date.now(),
        isHovered: false,
        isExpanded: false,
        width,
        height,
      }
    },
    []
  )

  const createSkeletonCard = useCallback((y: number): ImageCard => {
    const widthOptions = [208, 234, 260, 286]
    const width = widthOptions[Math.floor(Math.random() * widthOptions.length)]!
    const height = Math.floor(width * 0.9)

    const columns = [12, 28, 44, 60, 76, 88]
    let x =
      columns[Math.floor(Math.random() * columns.length)]! +
      (Math.random() - 0.5) * 4
    x = Math.max(8, Math.min(92, x))

    return {
      id: `skeleton-${++cardIdCounter}`,
      x,
      y,
      vx: 0,
      vy: 0,
      opacity: 1,
      scale: 1,
      spawnTime: Date.now(),
      isHovered: false,
      isExpanded: false,
      width,
      height,
      isLoading: true,
    }
  }, [])

  // === Mask Loading ===

  const loadMaskForCard = useCallback(
    (cardId: string, maskSource: string, isBase64: boolean = false) => {
      if (maskImageDataRefs.current.has(cardId)) return

      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => {
        const canvas = document.createElement('canvas')
        canvas.width = img.width
        canvas.height = img.height
        const ctx = canvas.getContext('2d', { willReadFrequently: true })
        if (!ctx) return

        ctx.drawImage(img, 0, 0)
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)

        maskCanvasRefs.current.set(cardId, canvas)
        maskImageDataRefs.current.set(cardId, imageData)

        // Generate highlight overlay
        const highlightCanvas = document.createElement('canvas')
        highlightCanvas.width = img.width
        highlightCanvas.height = img.height
        const highlightCtx = highlightCanvas.getContext('2d')
        if (!highlightCtx) return

        const highlightData = highlightCtx.createImageData(
          img.width,
          img.height
        )

        for (let i = 0; i < imageData.data.length; i += 4) {
          const r = imageData.data[i] ?? 0
          const g = imageData.data[i + 1] ?? 0
          const b = imageData.data[i + 2] ?? 0
          const brightness = (r + g + b) / 3

          if (brightness > 128) {
            highlightData.data[i] = 255
            highlightData.data[i + 1] = 255
            highlightData.data[i + 2] = 255
            highlightData.data[i + 3] = 40
          }
        }

        highlightCtx.putImageData(highlightData, 0, 0)
        highlightDataUrlRefs.current.set(
          cardId,
          highlightCanvas.toDataURL('image/png')
        )
      }

      if (isBase64) {
        img.src = `data:image/png;base64,${maskSource}`
      } else {
        img.src = maskSource
      }
    },
    []
  )

  // === Initialize with defaults ===

  useEffect(() => {
    if (isLoadingPlacements) return

    // Prevent re-running once cards are set
    if (hasInitialCardsRef.current) return
    hasInitialCardsRef.current = true

    // If we have saved placements, use those
    if (placements.length > 0) {
      const newCards: ImageCard[] = []
      placements.forEach((placement, i) => {
        const yBase = 20 + i * 140
        const card = createCardFromPlacement(
          placement,
          yBase + Math.random() * 40
        )
        newCards.push(card)
        loadMaskForCard(card.id, placement.mask, true)
      })
      setCards(newCards)
      setTotalHeight(Math.max(2500, newCards.length * 150))
      return
    }

    // Otherwise, show pre-generated gallery items with products while we generate more
    const initialCards: ImageCard[] = []
    PREGENERATED_GALLERY.forEach((item, i) => {
      const yBase = 20 + i * 180
      const card = createCardFromGalleryItem(item, yBase + Math.random() * 40)
      initialCards.push(card)
      // Load mask for product hover interaction
      loadMaskForCard(card.id, item.maskUrl)
    })
    setCards(initialCards)
  }, [
    isLoadingPlacements,
    placements,
    createCardFromPlacement,
    createCardFromGalleryItem,
    loadMaskForCard,
  ])

  // === Mark ready for scroll-triggered generation once products load ===
  // No auto-trigger - user must scroll to bottom to trigger first generation

  useEffect(() => {
    if (!hasInitialGenerated.current && productsLoaded && products.length > 0) {
      hasInitialGenerated.current = true
      console.log('[InitialGeneration] Products loaded, ready for scroll-triggered generation:', products.length)
      // Don't auto-generate - wait for user to scroll to bottom
    }
  }, [productsLoaded, products.length])

  // === Add new placements as cards ===

  useEffect(() => {
    console.log('[AddPlacements] placements:', placements.length, 'isGenerating:', isGenerating)
    if (placements.length === 0) return

    // Find placements that don't have cards yet
    const existingPlacementIds = new Set(
      cards.filter((c) => c.placement).map((c) => c.placement!.id)
    )

    const newPlacements = placements.filter(
      (p) => !existingPlacementIds.has(p.id)
    )

    console.log('[AddPlacements] newPlacements:', newPlacements.length)
    if (newPlacements.length === 0) return

    console.log('[AddPlacements] Adding', newPlacements.length, 'new cards!')
    // Remove skeleton cards and add real ones
    setCards((prev) => {
      const nonSkeletons = prev.filter((c) => !c.isLoading)
      const lastY =
        nonSkeletons.length > 0
          ? Math.max(...nonSkeletons.map((c) => c.y)) + 180
          : 20

      const newCards: ImageCard[] = []
      newPlacements.forEach((placement, i) => {
        const y = lastY + i * 160 + Math.random() * 40
        const card = createCardFromPlacement(placement, y)
        newCards.push(card)
        loadMaskForCard(card.id, placement.mask, true)
      })

      // Extend total height
      const maxY = Math.max(
        ...[...nonSkeletons, ...newCards].map((c) => c.y + c.height)
      )
      setTotalHeight(Math.max(totalHeight, maxY + 800))

      return [...nonSkeletons, ...newCards]
    })

    // Unlock gate when new cards are added
    console.log('[AddPlacements] Unlocking gate, isGated was:', isGated)
    if (isGated) {
      setIsGated(false)
      setGateScrollLimit(null)
    }
  }, [placements, cards, createCardFromPlacement, loadMaskForCard, totalHeight, isGated, isGenerating])

  // === Scroll-triggered generation with gate ===

  useEffect(() => {
    const checkScrollTrigger = () => {
      const viewportHeight = window.innerHeight
      const visibleBottom = scrollOffset + viewportHeight
      const triggerPoint = totalHeight - viewportHeight

      // Debug logging
      console.log('[ScrollTrigger]', {
        scrollOffset,
        visibleBottom,
        totalHeight,
        triggerPoint,
        isGenerating: isGeneratingRef.current,
        hasInitialGenerated: hasInitialGenerated.current,
        isGated,
        shouldTrigger: visibleBottom > triggerPoint,
      })

      if (isGeneratingRef.current) {
        console.log('[ScrollTrigger] Blocked: isGenerating')
        return
      }
      if (!hasInitialGenerated.current) {
        console.log('[ScrollTrigger] Blocked: hasInitialGenerated is false')
        return
      }
      if (isGated) {
        console.log('[ScrollTrigger] Blocked: isGated')
        return
      }

      // Trigger when within 1 viewport of the bottom
      if (visibleBottom > triggerPoint) {
        console.log('[ScrollTrigger] TRIGGERING GENERATION!')
        // Lock the gate
        setIsGated(true)
        setGateScrollLimit(scrollOffset)

        // Trigger generation - use ref to avoid dependency issues
        generateBatchRef.current()
      }
    }

    checkScrollTrigger()
  }, [scrollOffset, totalHeight, isGated])

  // === Progress bar simulation when gated ===

  useEffect(() => {
    if (isGated && !progressIntervalRef.current) {
      let elapsed = 0
      setGenerationProgress(0)
      setCurrentStep(PIPELINE_STEPS[0]?.name || '')

      progressIntervalRef.current = window.setInterval(() => {
        elapsed += 0.5  // Update every 500ms
        const progress = Math.min((elapsed / TOTAL_DURATION) * 100, 95)  // Cap at 95%
        setGenerationProgress(progress)

        // Update current step name
        let cumulative = 0
        for (const step of PIPELINE_STEPS) {
          cumulative += step.duration
          if (elapsed < cumulative) {
            setCurrentStep(step.name)
            break
          }
        }
      }, 500)
    }

    if (!isGated && progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current)
      progressIntervalRef.current = null
      setGenerationProgress(100)  // Complete
      setTimeout(() => setGenerationProgress(0), 500)  // Reset
    }

    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current)
      }
    }
  }, [isGated])

  // === Animation loop ===

  useEffect(() => {
    const animate = () => {
      const now = Date.now()

      setCards((prev) =>
        prev.map((card) => {
          if (card.isHovered || card.isExpanded || card.isLoading) {
            return { ...card, opacity: card.isLoading ? 1 : 1 }
          }

          let { x, y, vx, vy, opacity } = card
          const age = now - card.spawnTime

          if (age < 800) {
            opacity = age / 800
          } else {
            opacity = 1
          }

          x += vx * 0.1
          y += vy * 0.1
          vx *= 0.999
          vy *= 0.999
          vx += (Math.random() - 0.5) * 0.002
          vy += (Math.random() - 0.5) * 0.005

          if (x < 8) {
            x = 8
            vx = Math.abs(vx) * 0.2
          }
          if (x > 88) {
            x = 88
            vx = -Math.abs(vx) * 0.2
          }

          return { ...card, x, y, vx, vy, opacity }
        })
      )

      animationRef.current = requestAnimationFrame(animate)
    }

    animationRef.current = requestAnimationFrame(animate)
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current)
    }
  }, [])

  // Cleanup hover timeouts on unmount
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current)
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current)
    }
  }, [])

  // === Mask-based hover detection ===

  const isMouseOverProductArea = useCallback(
    (
      cardId: string,
      mouseX: number,
      mouseY: number,
      cardRect: DOMRect
    ): boolean => {
      const imageData = maskImageDataRefs.current.get(cardId)
      const canvas = maskCanvasRefs.current.get(cardId)
      if (!imageData || !canvas) return false

      const cardAspect = cardRect.width / cardRect.height
      const imageAspect = canvas.width / canvas.height

      let visibleWidth: number, visibleHeight: number
      let offsetX = 0,
        offsetY = 0

      if (imageAspect > cardAspect) {
        visibleHeight = canvas.height
        visibleWidth = canvas.height * cardAspect
        offsetX = (canvas.width - visibleWidth) / 2
      } else {
        visibleWidth = canvas.width
        visibleHeight = canvas.width / cardAspect
        offsetY = (canvas.height - visibleHeight) / 2
      }

      const relX = (mouseX - cardRect.left) / cardRect.width
      const relY = (mouseY - cardRect.top) / cardRect.height
      const maskX = Math.floor(offsetX + relX * visibleWidth)
      const maskY = Math.floor(offsetY + relY * visibleHeight)

      if (
        maskX < 0 ||
        maskX >= canvas.width ||
        maskY < 0 ||
        maskY >= canvas.height
      ) {
        return false
      }

      const pixelIndex = (maskY * canvas.width + maskX) * 4
      const r = imageData.data[pixelIndex] ?? 0
      const g = imageData.data[pixelIndex + 1] ?? 0
      const b = imageData.data[pixelIndex + 2] ?? 0
      const brightness = (r + g + b) / 3

      return brightness > 128
    },
    []
  )

  const getProductBounds = useCallback(
    (
      cardId: string,
      cardRect: DOMRect
    ): { left: number; right: number; top: number; bottom: number } | null => {
      const imageData = maskImageDataRefs.current.get(cardId)
      const canvas = maskCanvasRefs.current.get(cardId)
      if (!imageData || !canvas) return null

      const cardAspect = cardRect.width / cardRect.height
      const imageAspect = canvas.width / canvas.height

      let visibleWidth: number, visibleHeight: number
      let offsetX = 0,
        offsetY = 0

      if (imageAspect > cardAspect) {
        visibleHeight = canvas.height
        visibleWidth = canvas.height * cardAspect
        offsetX = (canvas.width - visibleWidth) / 2
      } else {
        visibleWidth = canvas.width
        visibleHeight = canvas.width / cardAspect
        offsetY = (canvas.height - visibleHeight) / 2
      }

      let minX = canvas.width,
        maxX = 0,
        minY = canvas.height,
        maxY = 0

      for (let y = 0; y < canvas.height; y++) {
        for (let x = 0; x < canvas.width; x++) {
          const pixelIndex = (y * canvas.width + x) * 4
          const r = imageData.data[pixelIndex] ?? 0
          const g = imageData.data[pixelIndex + 1] ?? 0
          const b = imageData.data[pixelIndex + 2] ?? 0
          const brightness = (r + g + b) / 3

          if (brightness > 128) {
            if (
              x >= offsetX &&
              x <= offsetX + visibleWidth &&
              y >= offsetY &&
              y <= offsetY + visibleHeight
            ) {
              if (x < minX) minX = x
              if (x > maxX) maxX = x
              if (y < minY) minY = y
              if (y > maxY) maxY = y
            }
          }
        }
      }

      if (minX >= maxX || minY >= maxY) return null

      const screenX = (maskX: number) =>
        cardRect.left + ((maskX - offsetX) / visibleWidth) * cardRect.width
      const screenY = (maskY: number) =>
        cardRect.top + ((maskY - offsetY) / visibleHeight) * cardRect.height

      return {
        left: screenX(minX),
        right: screenX(maxX),
        top: screenY(minY),
        bottom: screenY(maxY),
      }
    },
    []
  )

  // === Event Handlers ===

  const handleWheel = useCallback(
    (e: WheelEvent) => {
      const rect = containerRef.current?.getBoundingClientRect()
      if (!rect) return

      const writingPaneEnd = rect.left + (rect.width * writingPaneWidth) / 100
      if (e.clientX < writingPaneEnd) return

      e.preventDefault()

      let newOffset = scrollOffset + e.deltaY * 0.8

      // Enforce gate limit with soft bounce - allow 1 viewport of additional scrolling
      if (isGated && gateScrollLimit !== null) {
        const maxScroll = gateScrollLimit + window.innerHeight  // Allow ~1 full screen overscroll
        if (newOffset > maxScroll) {
          newOffset = maxScroll
        }
      }

      setScrollOffset(Math.max(0, newOffset))
    },
    [writingPaneWidth, isGated, gateScrollLimit, scrollOffset]
  )

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    container.addEventListener('wheel', handleWheel, { passive: false })
    return () => container.removeEventListener('wheel', handleWheel)
  }, [handleWheel])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && expandedCardId) {
        setExpandedCardId(null)
        setCards((prev) => prev.map((c) => ({ ...c, isExpanded: false })))
        return
      }

      const scrollAmount = 80
      if (e.key === 'ArrowUp' || e.key === 'k') {
        e.preventDefault()
        setScrollOffset((prev) => Math.max(0, prev - scrollAmount))
      } else if (e.key === 'ArrowDown' || e.key === 'j') {
        e.preventDefault()
        setScrollOffset((prev) => prev + scrollAmount)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [expandedCardId])

  const getVisibleY = (absoluteY: number) => absoluteY - scrollOffset

  const getCardMaskStyle = (
    visibleY: number,
    cardHeight: number
  ): React.CSSProperties => {
    const viewportHeight = window.innerHeight
    const fadeZone = viewportHeight * 0.125
    const cardTop = visibleY
    const cardBottom = visibleY + cardHeight
    const inTopFade = cardTop < fadeZone
    const inBottomFade = cardBottom > viewportHeight - fadeZone

    if (!inTopFade && !inBottomFade) return {}

    const stops: string[] = []

    if (inTopFade) {
      const fadeEnd = Math.min(fadeZone - cardTop, cardHeight)
      const fadeEndPercent = (fadeEnd / cardHeight) * 100
      const topT = Math.max(0, cardTop / fadeZone)
      const topOpacity = topT * topT

      if (fadeEndPercent < 100) {
        stops.push(`rgba(0,0,0,${topOpacity}) 0%`)
        stops.push(`rgba(0,0,0,1) ${fadeEndPercent}%`)
      } else {
        const bottomT = Math.max(0, cardBottom / fadeZone)
        const bottomOpacity = bottomT * bottomT
        stops.push(`rgba(0,0,0,${topOpacity}) 0%`)
        stops.push(`rgba(0,0,0,${bottomOpacity}) 100%`)
      }
    }

    if (inBottomFade && !inTopFade) {
      const fadeStart = viewportHeight - fadeZone - cardTop
      const fadeStartPercent = Math.max(0, (fadeStart / cardHeight) * 100)
      const bottomT = Math.max(0, (viewportHeight - cardBottom) / fadeZone)
      const bottomOpacity = bottomT * bottomT

      stops.push(`rgba(0,0,0,1) 0%`)
      stops.push(`rgba(0,0,0,1) ${fadeStartPercent}%`)
      stops.push(`rgba(0,0,0,${bottomOpacity}) 100%`)
    } else if (inBottomFade && inTopFade) {
      const fadeStart = viewportHeight - fadeZone - cardTop
      const fadeStartPercent = Math.max(0, (fadeStart / cardHeight) * 100)
      const bottomT = Math.max(0, (viewportHeight - cardBottom) / fadeZone)
      const bottomOpacity = bottomT * bottomT

      if (stops.length > 0) {
        stops.push(`rgba(0,0,0,1) ${fadeStartPercent}%`)
        stops.push(`rgba(0,0,0,${bottomOpacity}) 100%`)
      }
    }

    if (stops.length === 0) return {}

    return {
      maskImage: `linear-gradient(to bottom, ${stops.join(', ')})`,
      WebkitMaskImage: `linear-gradient(to bottom, ${stops.join(', ')})`,
    }
  }

  const handleCardMouseEnter = useCallback((cardId: string) => {
    setCards((prev) =>
      prev.map((c) => (c.id === cardId ? { ...c, isHovered: true } : c))
    )
  }, [])

  const handleCardMouseLeave = useCallback(
    (cardId: string) => {
      // Cancel any pending show timeout for this card
      if (pendingCardRef.current === cardId) {
        if (hoverTimeoutRef.current) {
          clearTimeout(hoverTimeoutRef.current)
          hoverTimeoutRef.current = null
        }
        pendingCardRef.current = null
      }

      // Clear hover highlight
      setProductHoverCardId(null)

      // Always update card hover state
      setCards((prev) =>
        prev.map((c) => (c.id === cardId ? { ...c, isHovered: false } : c))
      )

      // Only schedule hide if showing this card's overlay and not click-locked
      if (!productClickLocked && activeProduct?.cardId === cardId) {
        // Cancel any existing hide timeout first
        if (hideTimeoutRef.current) {
          clearTimeout(hideTimeoutRef.current)
        }
        hideTimeoutRef.current = setTimeout(() => {
          const overlayHovered = document.querySelector('.product-overlay:hover')
          if (!overlayHovered) {
            setActiveProduct(null)
          }
          hideTimeoutRef.current = null
        }, 200) // Slightly longer delay for card leave
      }
    },
    [productClickLocked, activeProduct]
  )

  const handleCardMouseMove = useCallback(
    (card: ImageCard, e: React.MouseEvent<HTMLDivElement>) => {
      if (card.isLoading) return

      const cardElement = e.currentTarget
      const rect = cardElement.getBoundingClientRect()
      const overProduct = isMouseOverProductArea(
        card.id,
        e.clientX,
        e.clientY,
        rect
      )

      if (overProduct) {
        setProductHoverCardId(card.id)

        // Cancel any pending hide timeout since we're over a product
        if (hideTimeoutRef.current) {
          clearTimeout(hideTimeoutRef.current)
          hideTimeoutRef.current = null
        }

        // Only start a new show timeout if we don't already have one for this card
        // or if there's already an active product for a DIFFERENT card
        const shouldStartTimeout =
          (pendingCardRef.current !== card.id && !activeProduct) ||
          (activeProduct && activeProduct.cardId !== card.id)

        if (shouldStartTimeout) {
          if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current)
          pendingCardRef.current = card.id

          hoverTimeoutRef.current = setTimeout(() => {
            // Verify this timeout is still relevant
            if (pendingCardRef.current !== card.id) return

            const bounds = getProductBounds(card.id, rect)
            if (bounds) {
              const product = card.placement?.product || card.galleryItem?.product
              const sceneUrl = card.placement
                ? `data:${card.placement.mimeType};base64,${card.placement.composedImage}`
                : card.galleryItem?.sceneUrl || ''

              if (product) {
                setActiveProduct({
                  product,
                  position: { x: e.clientX, y: e.clientY },
                  productBounds: bounds,
                  cardId: card.id,
                  sceneImageUrl: sceneUrl,
                })
              }
            }
            pendingCardRef.current = null
          }, 300)
        }
      } else {
        // Not over product area
        setProductHoverCardId(null)

        // Cancel any pending show timeout
        if (hoverTimeoutRef.current) {
          clearTimeout(hoverTimeoutRef.current)
          hoverTimeoutRef.current = null
          pendingCardRef.current = null
        }

        // Only schedule hide if we're showing this card's overlay and not click-locked
        if (!productClickLocked && activeProduct?.cardId === card.id) {
          if (!hideTimeoutRef.current) {
            hideTimeoutRef.current = setTimeout(() => {
              const overlayHovered = document.querySelector(
                '.product-overlay:hover'
              )
              if (!overlayHovered) setActiveProduct(null)
              hideTimeoutRef.current = null
            }, 150)
          }
        }
      }
    },
    [isMouseOverProductArea, productClickLocked, getProductBounds, activeProduct]
  )

  const handleCardClick = useCallback(
    (card: ImageCard, e: React.MouseEvent<HTMLDivElement>) => {
      if (card.isLoading) return

      const cardElement = e.currentTarget
      const rect = cardElement.getBoundingClientRect()
      const overProduct = isMouseOverProductArea(
        card.id,
        e.clientX,
        e.clientY,
        rect
      )

      if (overProduct) {
        e.stopPropagation()
        const bounds = getProductBounds(card.id, rect)
        if (bounds) {
          const product = card.placement?.product || card.galleryItem?.product
          const sceneUrl = card.placement
            ? `data:${card.placement.mimeType};base64,${card.placement.composedImage}`
            : card.galleryItem?.sceneUrl || ''

          if (product) {
            setActiveProduct({
              product,
              position: { x: e.clientX, y: e.clientY },
              productBounds: bounds,
              cardId: card.id,
              sceneImageUrl: sceneUrl,
            })
            setProductClickLocked(true)
            if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current)
          }
        }
      } else if (productClickLocked) {
        setActiveProduct(null)
        setProductClickLocked(false)
        setProductHoverCardId(null)
      }
    },
    [isMouseOverProductArea, getProductBounds, productClickLocked]
  )

  useEffect(() => {
    if (!productClickLocked) return

    const handleClickOutside = (e: MouseEvent) => {
      const overlay = document.querySelector('.product-overlay')
      const target = e.target as Node
      if (!overlay?.contains(target)) {
        setActiveProduct(null)
        setProductClickLocked(false)
        setProductHoverCardId(null)
      }
    }

    const timeoutId = setTimeout(() => {
      window.addEventListener('click', handleClickOutside)
    }, 50)

    return () => {
      clearTimeout(timeoutId)
      window.removeEventListener('click', handleClickOutside)
    }
  }, [productClickLocked])

  const handleCardDoubleClick = useCallback(
    (card: ImageCard) => {
      if (card.isLoading || draggingCardId) return

      if (expandedCardId === card.id) {
        setExpandedCardId(null)
        setCards((prev) =>
          prev.map((c) => (c.id === card.id ? { ...c, isExpanded: false } : c))
        )
      } else {
        setExpandedCardId(card.id)
        setCards((prev) =>
          prev.map((c) => ({ ...c, isExpanded: c.id === card.id }))
        )
      }
    },
    [expandedCardId, draggingCardId]
  )

  // Drag handlers
  const handleDragStart = useCallback(
    (cardId: string, e: React.MouseEvent) => {
      e.preventDefault()
      const card = cards.find((c) => c.id === cardId)
      if (!card || card.isLoading) return

      const cardElement = e.currentTarget as HTMLElement
      const rect = cardElement.getBoundingClientRect()
      if (isMouseOverProductArea(cardId, e.clientX, e.clientY, rect)) return

      setDraggingCardId(cardId)
      dragStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        cardX: card.x,
        cardY: card.y,
      }
    },
    [cards, isMouseOverProductArea]
  )

  const handleDragMove = useCallback(
    (e: MouseEvent) => {
      const dragStart = dragStartRef.current
      if (!dragStart) return

      const containerRect = containerRef.current?.getBoundingClientRect()
      if (!containerRect) return

      const galleryWidth = containerRect.width * (1 - writingPaneWidth / 100)
      const deltaX = e.clientX - dragStart.x
      const deltaY = e.clientY - dragStart.y
      const deltaXPercent = (deltaX / galleryWidth) * 100

      setCards((prev) =>
        prev.map((card) => {
          if (card.id !== draggingCardId) return card

          let newX = dragStart.cardX + deltaXPercent
          let newY = dragStart.cardY + deltaY
          newX = Math.max(12, Math.min(88, newX))

          return { ...card, x: newX, y: newY, vx: 0, vy: 0 }
        })
      )
    },
    [draggingCardId, writingPaneWidth]
  )

  const handleDragEnd = useCallback(() => {
    setDraggingCardId(null)
    dragStartRef.current = null
  }, [])

  useEffect(() => {
    if (draggingCardId) {
      window.addEventListener('mousemove', handleDragMove)
      window.addEventListener('mouseup', handleDragEnd)
      return () => {
        window.removeEventListener('mousemove', handleDragMove)
        window.removeEventListener('mouseup', handleDragEnd)
      }
    }
  }, [draggingCardId, handleDragMove, handleDragEnd])

  // Resize handlers
  const handleResizeStart = useCallback(
    (cardId: string, e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation() // Prevent drag from starting
      const card = cards.find((c) => c.id === cardId)
      if (!card) return

      setResizingCardId(cardId)
      resizeStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        cardWidth: card.width,
        cardHeight: card.height,
      }
    },
    [cards]
  )

  const handleResizeMove = useCallback(
    (e: MouseEvent) => {
      const resizeStart = resizeStartRef.current
      if (!resizeStart || !resizingCardId) return

      const deltaX = e.clientX - resizeStart.x
      const deltaY = e.clientY - resizeStart.y

      // Use the larger delta to maintain aspect ratio
      const delta = Math.max(deltaX, deltaY)

      setCards((prev) =>
        prev.map((card) => {
          if (card.id !== resizingCardId) return card

          const aspectRatio = resizeStart.cardHeight / resizeStart.cardWidth
          let newWidth = Math.max(120, Math.min(400, resizeStart.cardWidth + delta))
          let newHeight = Math.round(newWidth * aspectRatio)

          // Clamp height as well
          newHeight = Math.max(100, Math.min(500, newHeight))

          return {
            ...card,
            width: newWidth,
            height: newHeight,
          }
        })
      )
    },
    [resizingCardId]
  )

  const handleResizeEnd = useCallback(() => {
    setResizingCardId(null)
    resizeStartRef.current = null
  }, [])

  // Add global mouse listeners for resize
  useEffect(() => {
    if (resizingCardId) {
      window.addEventListener('mousemove', handleResizeMove)
      window.addEventListener('mouseup', handleResizeEnd)
      return () => {
        window.removeEventListener('mousemove', handleResizeMove)
        window.removeEventListener('mouseup', handleResizeEnd)
      }
    }
  }, [resizingCardId, handleResizeMove, handleResizeEnd])

  // === Like Handler ===

  const handleLikeCard = useCallback(
    (card: ImageCard, e: React.MouseEvent) => {
      e.stopPropagation()
      if (card.placement) {
        toggleLike(card.placement.id)
      }
    },
    [toggleLike]
  )

  // === Shopping Handlers ===

  // Revert a removed product (put it back in the image)
  const handleRevertProduct = useCallback((cardId: string, productId: string) => {
    // Remove from bag
    setBag((prev) => {
      const item = prev.find((i) => i.product.id === productId)
      if (item && item.quantity > 1) {
        return prev.map((i) =>
          i.product.id === productId ? { ...i, quantity: i.quantity - 1 } : i
        )
      }
      return prev.filter((i) => i.product.id !== productId)
    })

    // Restore product to card
    setRemovedProductCardIds((prev) => {
      const next = new Set(prev)
      next.delete(cardId)
      return next
    })
  }, [])

  const handleAddToBag = useCallback((product: Product, cardId: string) => {
    setBag((prev) => {
      const existing = prev.find((item) => item.product.id === product.id)
      if (existing) {
        return prev.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        )
      }
      return [...prev, { product, quantity: 1, addedAt: new Date() }]
    })
    setRemovedProductCardIds((prev) => new Set(prev).add(cardId))
    setActiveProduct(null)
    setProductClickLocked(false)
  }, [])

  const handleBuyNow = useCallback(() => {
    setActiveProduct(null)
    setProductClickLocked(false)
  }, [])

  const handleRemoveFromBag = useCallback((productId: string) => {
    setBag((prev) => prev.filter((item) => item.product.id !== productId))
  }, [])

  const handleUpdateQuantity = useCallback(
    (productId: string, quantity: number) => {
      if (quantity <= 0) {
        handleRemoveFromBag(productId)
        return
      }
      setBag((prev) =>
        prev.map((item) =>
          item.product.id === productId ? { ...item, quantity } : item
        )
      )
    },
    [handleRemoveFromBag]
  )

  const handleSavePaymentInfo = useCallback((info: PaymentInfo) => {
    setPaymentInfo(info)
    localStorage.setItem('ephemeral-payment-info', JSON.stringify(info))
  }, [])

  const handleCompletePurchase = useCallback(() => {
    setPurchaseSuccess(true)
    setBag([])
    setTimeout(() => {
      setPurchaseSuccess(false)
      setShowPayment(false)
    }, 3000)
  }, [])

  const bagTotal = bag.reduce(
    (sum, item) => sum + item.product.price * item.quantity,
    0
  )
  const bagCount = bag.reduce((sum, item) => sum + item.quantity, 0)

  // Writing pane resize
  const handleWritingPaneResize = useCallback((deltaX: number) => {
    const containerWidth = window.innerWidth
    const deltaPercent = (deltaX / containerWidth) * 100
    setWritingPaneWidth((prev) =>
      Math.max(20, Math.min(45, prev + deltaPercent))
    )
  }, [])

  const handleWritingPaneResizeEnd = useCallback(() => {
    localStorage.setItem(
      'generative-writing-pane-width',
      writingPaneWidth.toString()
    )
  }, [writingPaneWidth])

  // Scroll indicator
  const scrollIndicatorPos =
    totalHeight > 0
      ? scrollOffset / Math.max(1, totalHeight - window.innerHeight)
      : 0

  // Filter visible cards
  const viewportHeight =
    typeof window !== 'undefined' ? window.innerHeight : 800
  const visibleCards = cards.filter((card) => {
    if (card.isExpanded) return true
    const visibleY = getVisibleY(card.y)
    return visibleY > -card.height - 100 && visibleY < viewportHeight + 100
  })

  // Get image URL for a card
  const getCardImageUrl = (card: ImageCard) => {
    if (card.placement) {
      return `data:${card.placement.mimeType};base64,${card.placement.composedImage}`
    }
    return card.galleryItem?.sceneUrl || ''
  }

  const getCardBaseUrl = (card: ImageCard) => {
    if (card.placement) {
      return `data:${card.placement.mimeType};base64,${card.placement.sceneImage}`
    }
    return card.galleryItem?.baseUrl || ''
  }

  return (
    <div className="consumer-gallery generative-gallery" ref={containerRef}>
      {/* Writing Pane */}
      <WritingPane
        value={writingContext}
        onChange={setWritingContext}
        width={writingPaneWidth}
        title="Your Mood"
        placeholder="Describe the vibe you're looking for... (influences AI generation)"
        accentColor="#c9a227"
        background="rgba(30, 28, 26, 0.95)"
        textColor="#e8e4d9"
        titleColor="rgba(255, 255, 255, 0.6)"
      />

      {/* Resize Divider */}
      <ResizeDivider
        onDrag={handleWritingPaneResize}
        onDragEnd={handleWritingPaneResizeEnd}
        onDoubleClick={() => setWritingPaneWidth(33.33)}
      />

      {/* Gallery Container */}
      <div
        className="gallery-container"
        style={{ left: `${writingPaneWidth}%` }}
      >
        <div className="gallery-background" />
        <div className="fade-zone fade-zone-top" />
        <div className="fade-zone fade-zone-bottom" />

        {/* Generation Gate with Progress Bar */}
        {isGated && (
          <div className="generation-gate">
            <div className="gate-progress-bar">
              <div
                className="gate-progress-fill"
                style={{ width: `${generationProgress}%` }}
              />
            </div>
            <div className="gate-status">
              <span className="gate-step">{currentStep}...</span>
              <span className="gate-percent">{Math.round(generationProgress)}%</span>
            </div>
          </div>
        )}

        {generationError && (
          <div className="generation-error">
            <span>{generationError}</span>
            <button onClick={() => generateBatch()}>Retry</button>
          </div>
        )}

        {/* Cards */}
        {visibleCards.map((card) => {
          const visibleY = getVisibleY(card.y)
          const maskStyle = card.isExpanded
            ? {}
            : getCardMaskStyle(visibleY, card.height)

          // Skeleton card
          if (card.isLoading) {
            return (
              <div
                key={card.id}
                className="gallery-card skeleton-card"
                style={{
                  left: `${card.x}%`,
                  top: visibleY,
                  width: card.width,
                  height: card.height,
                }}
              >
                <div className="skeleton-shimmer" />
              </div>
            )
          }

          // Expanded card
          if (card.isExpanded) {
            const isLiked = card.placement?.isLiked ?? false
            return (
              <div
                key={card.id}
                className="expanded-card-overlay"
                onClick={() => handleCardDoubleClick(card)}
              >
                <div
                  className="expanded-card"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleCardClick(card, e)
                  }}
                  onMouseMove={(e) => handleCardMouseMove(card, e)}
                  onMouseLeave={() => handleCardMouseLeave(card.id)}
                >
                  <img
                    src={getCardImageUrl(card)}
                    alt=""
                    className={`expanded-card-image ${removedProductCardIds.has(card.id) ? 'product-removed' : ''}`}
                  />
                  {removedProductCardIds.has(card.id) && (
                    <img
                      src={getCardBaseUrl(card)}
                      alt=""
                      className="expanded-card-image expanded-card-base-revealed"
                    />
                  )}
                  {!removedProductCardIds.has(card.id) &&
                    productHoverCardId === card.id &&
                    highlightDataUrlRefs.current.get(card.id) && (
                      <img
                        src={highlightDataUrlRefs.current.get(card.id)}
                        alt=""
                        className="expanded-highlight-overlay"
                      />
                    )}


                  {/* Show Original Image button - shows when product is removed */}
                  {removedProductCardIds.has(card.id) && (
                    <button
                      className="revert-button"
                      onClick={(e) => {
                        e.stopPropagation()
                        const product = card.placement?.product || card.galleryItem?.product
                        if (product) {
                          handleRevertProduct(card.id, product.id)
                        }
                      }}
                    >
                      Show Original Image
                    </button>
                  )}
                </div>
              </div>
            )
          }

          // Regular card
          const isLiked = card.placement?.isLiked ?? false
          return (
            <div
              key={card.id}
              className={clsx(
                'gallery-card',
                card.isHovered && 'hovered',
                productHoverCardId === card.id && 'over-product',
                draggingCardId === card.id && 'dragging'
              )}
              style={{
                left: `${card.x}%`,
                top: visibleY,
                width: card.width,
                height: card.height,
                opacity: card.opacity,
                transform: `translate(-50%, 0) scale(${draggingCardId === card.id ? 1.05 : card.isHovered ? 1.02 : card.scale})`,
                zIndex: draggingCardId === card.id ? 100 : undefined,
                cursor: draggingCardId === card.id ? 'grabbing' : 'grab',
                ...maskStyle,
              }}
              onMouseEnter={() => handleCardMouseEnter(card.id)}
              onMouseLeave={() => handleCardMouseLeave(card.id)}
              onDoubleClick={() => handleCardDoubleClick(card)}
              onMouseMove={(e) => handleCardMouseMove(card, e)}
              onMouseDown={(e) => handleDragStart(card.id, e)}
              onClick={(e) => handleCardClick(card, e)}
            >
              <img
                src={getCardImageUrl(card)}
                alt=""
                className={`gallery-card-image ${removedProductCardIds.has(card.id) ? 'product-removed' : ''}`}
                loading="lazy"
                draggable={false}
              />
              {removedProductCardIds.has(card.id) && (
                <img
                  src={getCardBaseUrl(card)}
                  alt=""
                  className="gallery-card-image gallery-card-base-revealed"
                  loading="lazy"
                  draggable={false}
                />
              )}
              {!removedProductCardIds.has(card.id) &&
                productHoverCardId === card.id &&
                highlightDataUrlRefs.current.get(card.id) && (
                  <img
                    src={highlightDataUrlRefs.current.get(card.id)}
                    alt=""
                    className="product-highlight-overlay"
                  />
                )}

              {/* Show Original Image button - shows when product is removed */}
              {removedProductCardIds.has(card.id) && (
                <button
                  className="revert-button"
                  onClick={(e) => {
                    e.stopPropagation()
                    const product = card.placement?.product || card.galleryItem?.product
                    if (product) {
                      handleRevertProduct(card.id, product.id)
                    }
                  }}
                >
                  Show Original Image
                </button>
              )}

              {/* Resize handle - bottom right corner */}
              <div
                className={clsx('resize-handle', resizingCardId === card.id && 'resizing')}
                onMouseDown={(e) => handleResizeStart(card.id, e)}
              />
            </div>
          )
        })}

        {/* User Profile Button */}
        <button
          className={clsx('user-button', paymentInfo && 'has-info')}
          onClick={() => setShowProfile(true)}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        </button>

        {/* Shopping Bag Button */}
        <button
          className={clsx('bag-button', bagCount > 0 && 'has-items')}
          onClick={() => setShowBag(true)}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z" />
            <line x1="3" y1="6" x2="21" y2="6" />
            <path d="M16 10a4 4 0 01-8 0" />
          </svg>
          {bagCount > 0 && <span className="bag-badge">{bagCount}</span>}
        </button>

        {/* Scroll Position Indicator */}
        <div className="scroll-indicator">
          <div className="scroll-track">
            <div
              className="scroll-thumb"
              style={{ top: `${scrollIndicatorPos * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Product Overlay */}
      {activeProduct && (
        <ProductOverlay
          product={activeProduct.product}
          position={activeProduct.position}
          productBounds={activeProduct.productBounds}
          sceneImageUrl={activeProduct.sceneImageUrl}
          onAddToBag={() =>
            handleAddToBag(activeProduct.product, activeProduct.cardId)
          }
          onBuyNow={handleBuyNow}
          onClose={() => {
            setActiveProduct(null)
            setProductClickLocked(false)
          }}
        />
      )}

      {/* Shopping Bag Sidebar */}
      {showBag && (
        <ShoppingBag
          items={bag}
          onClose={() => setShowBag(false)}
          onRemove={handleRemoveFromBag}
          onUpdateQuantity={handleUpdateQuantity}
          onCheckout={() => setBag([])}
          total={bagTotal}
        />
      )}

      {/* Payment Screen */}
      {showPayment && (
        <PaymentScreen
          items={bag}
          total={bagTotal}
          savedInfo={paymentInfo}
          onSaveInfo={handleSavePaymentInfo}
          onComplete={handleCompletePurchase}
          onClose={() => setShowPayment(false)}
          success={purchaseSuccess}
        />
      )}

      {/* User Profile Modal */}
      <UserProfile
        savedInfo={paymentInfo}
        onSaveInfo={handleSavePaymentInfo}
        isOpen={showProfile}
        onClose={() => setShowProfile(false)}
      />

      {/* Purchase Success Toast */}
      {purchaseSuccess && !showPayment && (
        <div className="purchase-toast">
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
          <span>Purchase complete</span>
        </div>
      )}

      {/* Debug mode */}
      {debugMode && (
        <div className="debug-badge">
          Debug | Scroll: {Math.round(scrollOffset)} | Cards: {cards.length} |
          Placements: {placements.length} | Generating:{' '}
          {isGenerating ? 'Yes' : 'No'}
        </div>
      )}
    </div>
  )
}

export default GenerativeGallery
