/**
 * ConsumerGallery - Image-only scrollable gallery with mask-based product hover
 *
 * Features:
 * - Images only (no text cards) - AI-generated scenes with products placed
 * - Mask-based hover detection (only hover on product area triggers popup)
 * - Subtle vertical drift, minimal horizontal movement
 * - Hover pauses card, full opacity, prevents fade
 * - Double-click expands image to right 2/3 of screen
 * - Mouse wheel scrolls through images (writing pane stays fixed)
 * - Fade zones at top/bottom 1/8 of screen
 * - Scroll position indicator on right
 * - Infinite scroll spawning new images
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
import './ConsumerGallery.css'

// Gallery item from manifest
interface GalleryItem {
  id: string
  sceneUrl: string
  baseUrl: string  // Original scene without product
  maskUrl: string
  productImageUrl: string
  product: Product
}

// Load manifest data - 13 gallery items
const GALLERY_ITEMS: GalleryItem[] = [
  {
    id: "gallery-0",
    sceneUrl: "/gallery/scene_0.png",
    baseUrl: "/gallery/base_0.jpg",
    maskUrl: "/gallery/mask_0.png",
    productImageUrl: "/gallery/product_0.jpg",
    product: {
      id: "product-0",
      name: "Neverfull MM",
      brand: "Louis Vuitton",
      price: 2030,
      currency: "USD",
      imageUrl: "/gallery/product_0.jpg",
    }
  },
  {
    id: "gallery-1",
    sceneUrl: "/gallery/scene_1.png",
    baseUrl: "/gallery/base_1.jpg",
    maskUrl: "/gallery/mask_1.png",
    productImageUrl: "/gallery/product_1.jpg",
    product: {
      id: "product-1",
      name: "GG Marmont",
      brand: "Gucci",
      price: 2350,
      currency: "USD",
      imageUrl: "/gallery/product_1.jpg",
    }
  },
  {
    id: "gallery-3",
    sceneUrl: "/gallery/scene_3.png",
    baseUrl: "/gallery/base_3.jpg",
    maskUrl: "/gallery/mask_3.png",
    productImageUrl: "/gallery/product_3.jpg",
    product: {
      id: "product-3",
      name: "Galleria Saffiano",
      brand: "Prada",
      price: 3200,
      currency: "USD",
      imageUrl: "/gallery/product_3.jpg",
    }
  },
  {
    id: "gallery-4",
    sceneUrl: "/gallery/scene_4.png",
    baseUrl: "/gallery/base_4.jpg",
    maskUrl: "/gallery/mask_4.png",
    productImageUrl: "/gallery/product_4.jpg",
    product: {
      id: "product-4",
      name: "Loulou Medium",
      brand: "Saint Laurent",
      price: 2590,
      currency: "USD",
      imageUrl: "/gallery/product_4.jpg",
    }
  },
  {
    id: "gallery-5",
    sceneUrl: "/gallery/scene_5.png",
    baseUrl: "/gallery/base_5.jpg",
    maskUrl: "/gallery/mask_5.png",
    productImageUrl: "/gallery/product_5.jpg",
    product: {
      id: "product-5",
      name: "Triomphe Bag",
      brand: "Celine",
      price: 2950,
      currency: "USD",
      imageUrl: "/gallery/product_5.jpg",
    }
  },
  {
    id: "gallery-6",
    sceneUrl: "/gallery/scene_6.png",
    baseUrl: "/gallery/base_6.jpg",
    maskUrl: "/gallery/mask_6.png",
    productImageUrl: "/gallery/product_6.jpg",
    product: {
      id: "product-6",
      name: "Le Pliage",
      brand: "Longchamp",
      price: 145,
      currency: "USD",
      imageUrl: "/gallery/product_6.jpg",
    }
  },
  {
    id: "gallery-7",
    sceneUrl: "/gallery/scene_7.png",
    baseUrl: "/gallery/base_7.jpg",
    maskUrl: "/gallery/mask_7.png",
    productImageUrl: "/gallery/product_7.jpg",
    product: {
      id: "product-7",
      name: "Puzzle Bag",
      brand: "Loewe",
      price: 3650,
      currency: "USD",
      imageUrl: "/gallery/product_7.jpg",
    }
  },
  {
    id: "gallery-8",
    sceneUrl: "/gallery/scene_8.png",
    baseUrl: "/gallery/base_8.jpg",
    maskUrl: "/gallery/mask_8.png",
    productImageUrl: "/gallery/product_8.jpg",
    product: {
      id: "product-8",
      name: "Dionysus",
      brand: "Gucci",
      price: 2980,
      currency: "USD",
      imageUrl: "/gallery/product_8.jpg",
    }
  },
  {
    id: "gallery-9",
    sceneUrl: "/gallery/scene_9.png",
    baseUrl: "/gallery/base_9.jpg",
    maskUrl: "/gallery/mask_9.png",
    productImageUrl: "/gallery/product_9.jpg",
    product: {
      id: "product-9",
      name: "Peekaboo ISeeU",
      brand: "Fendi",
      price: 4200,
      currency: "USD",
      imageUrl: "/gallery/product_9.jpg",
    }
  },
  {
    id: "gallery-10",
    sceneUrl: "/gallery/scene_10.png",
    baseUrl: "/gallery/base_10.jpg",
    maskUrl: "/gallery/mask_10.png",
    productImageUrl: "/gallery/product_10.jpg",
    product: {
      id: "product-10",
      name: "Speedy Bandouliere",
      brand: "Louis Vuitton",
      price: 1640,
      currency: "USD",
      imageUrl: "/gallery/product_10.jpg",
    }
  },
  {
    id: "gallery-11",
    sceneUrl: "/gallery/scene_11.png",
    baseUrl: "/gallery/base_11.jpg",
    maskUrl: "/gallery/mask_11.png",
    productImageUrl: "/gallery/product_11.jpg",
    product: {
      id: "product-11",
      name: "Lady Dior",
      brand: "Dior",
      price: 5500,
      currency: "USD",
      imageUrl: "/gallery/product_11.jpg",
    }
  },
  {
    id: "gallery-12",
    sceneUrl: "/gallery/scene_12.png",
    baseUrl: "/gallery/base_12.jpg",
    maskUrl: "/gallery/mask_12.png",
    productImageUrl: "/gallery/product_12.jpg",
    product: {
      id: "product-12",
      name: "Cabas Phantom",
      brand: "Celine",
      price: 2100,
      currency: "USD",
      imageUrl: "/gallery/product_12.jpg",
    }
  },
]

interface ImageCard {
  id: string
  galleryItem: GalleryItem
  x: number
  y: number // Absolute Y position in scroll space
  vx: number
  vy: number
  opacity: number
  scale: number
  spawnTime: number
  isHovered: boolean
  isExpanded: boolean
  width: number
  height: number
}

interface ConsumerGalleryProps {
  debugMode?: boolean
}

let cardIdCounter = 0

export function ConsumerGallery({ debugMode = false }: ConsumerGalleryProps) {
  // Cards state
  const [cards, setCards] = useState<ImageCard[]>([])
  const [scrollOffset, setScrollOffset] = useState(0)
  const [totalHeight, setTotalHeight] = useState(2500)
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null)

  // Writing pane state
  const [writingPaneWidth, setWritingPaneWidth] = useState(() => {
    const saved = localStorage.getItem('consumer-writing-pane-width')
    return saved ? parseFloat(saved) : 33.33
  })
  const [userComposition, setUserComposition] = useState('')

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
  const [productHoverCardId, setProductHoverCardId] = useState<string | null>(null)
  const [productClickLocked, setProductClickLocked] = useState(false) // When true, popup stays until click elsewhere
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Removed products state (cards where product has been added to bag)
  const [removedProductCardIds, setRemovedProductCardIds] = useState<Set<string>>(new Set())

  // Drag state
  const [draggingCardId, setDraggingCardId] = useState<string | null>(null)
  const dragStartRef = useRef<{ x: number; y: number; cardX: number; cardY: number } | null>(null)

  // Resize state
  const [resizingCardId, setResizingCardId] = useState<string | null>(null)
  const resizeStartRef = useRef<{ x: number; y: number; cardWidth: number; cardHeight: number } | null>(null)

  // Refs
  const containerRef = useRef<HTMLDivElement>(null)
  const animationRef = useRef<number>()
  const scrollOffsetRef = useRef(scrollOffset)
  const usedGalleryIds = useRef<Set<string>>(new Set())

  // Mask canvas refs for hover detection
  const maskCanvasRefs = useRef<Map<string, HTMLCanvasElement>>(new Map())
  const maskImageDataRefs = useRef<Map<string, ImageData>>(new Map())

  // Highlight canvas refs for product outline overlay
  const highlightDataUrlRefs = useRef<Map<string, string>>(new Map())

  scrollOffsetRef.current = scrollOffset

  // Check if a new card would overlap with existing cards
  const wouldOverlap = useCallback((newX: number, newY: number, newHeight: number, existingCards: ImageCard[]): boolean => {
    const padding = 15 // Tighter padding for Pinterest-like density
    for (const card of existingCards) {
      const horizontalDistance = Math.abs(card.x - newX)
      if (horizontalDistance < 16) { // Tighter horizontal check
        const verticalDistance = Math.abs(card.y - newY)
        const combinedHeight = (card.height + newHeight) / 2 + padding
        if (verticalDistance < combinedHeight) {
          return true
        }
      }
    }
    return false
  }, [])

  // Create a new card with non-overlapping placement
  const createCard = useCallback((y?: number, existingCards?: ImageCard[]): ImageCard | null => {
    // Find unused gallery item
    const available = GALLERY_ITEMS.filter(item => !usedGalleryIds.current.has(item.id))
    if (available.length === 0) {
      // All used, reset
      usedGalleryIds.current.clear()
    }

    const items = available.length > 0 ? available : GALLERY_ITEMS
    const galleryItem = items[Math.floor(Math.random() * items.length)]!
    usedGalleryIds.current.add(galleryItem.id)

    // Card sizes - 30% larger than original Pinterest-style
    const widthOptions = [208, 234, 260, 286]
    const width = widthOptions[Math.floor(Math.random() * widthOptions.length)]!
    // Height variety for masonry effect
    const heightRatio = 0.7 + Math.random() * 0.6 // 0.7 to 1.3 (mix of portrait/landscape)
    const height = Math.floor(width * heightRatio)

    // Find a non-overlapping position using columns
    let x: number
    let cardY = y ?? scrollOffsetRef.current + Math.random() * window.innerHeight
    let attempts = 0
    const maxAttempts = 30

    // Pinterest-style: 5 columns, tightly packed
    const columns = [12, 28, 44, 60, 76, 88] // 6 column positions for denser packing

    do {
      const columnIndex = Math.floor(Math.random() * columns.length)
      x = columns[columnIndex]! + (Math.random() - 0.5) * 4 // Less random offset for tighter grid

      // Clamp to ensure cards don't get cut off at edges
      const minX = 8 // Hard left boundary
      const maxX = 92 // Hard right boundary
      x = Math.max(minX, Math.min(maxX, x))

      if (attempts > maxAttempts / 2 && existingCards) {
        cardY += 60 + Math.random() * 30 // Tighter vertical stacking
      }
      attempts++
    } while (existingCards && wouldOverlap(x, cardY, height, existingCards) && attempts < maxAttempts)

    return {
      id: `card-${++cardIdCounter}`,
      galleryItem,
      x,
      y: cardY,
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
  }, [wouldOverlap])

  // Load mask image data for a card and generate highlight overlay
  const loadMaskForCard = useCallback((cardId: string, maskUrl: string) => {
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

      // Generate highlight overlay - subtle white tint only on product area
      const highlightCanvas = document.createElement('canvas')
      highlightCanvas.width = img.width
      highlightCanvas.height = img.height
      const highlightCtx = highlightCanvas.getContext('2d')
      if (!highlightCtx) return

      const highlightData = highlightCtx.createImageData(img.width, img.height)

      // Create semi-transparent white overlay on product (mask white) areas
      for (let i = 0; i < imageData.data.length; i += 4) {
        const r = imageData.data[i] ?? 0
        const g = imageData.data[i + 1] ?? 0
        const b = imageData.data[i + 2] ?? 0
        const brightness = (r + g + b) / 3

        if (brightness > 128) {
          // Product area - subtle white tint (alpha = 40 for subtle effect)
          highlightData.data[i] = 255     // R
          highlightData.data[i + 1] = 255 // G
          highlightData.data[i + 2] = 255 // B
          highlightData.data[i + 3] = 40  // A - subtle
        }
        // else: stays fully transparent (0, 0, 0, 0)
      }

      highlightCtx.putImageData(highlightData, 0, 0)
      highlightDataUrlRefs.current.set(cardId, highlightCanvas.toDataURL('image/png'))
    }
    img.src = maskUrl
  }, [])

  // Check if mouse is over product area using mask
  // Accounts for object-fit: cover cropping
  const isMouseOverProductArea = useCallback((cardId: string, mouseX: number, mouseY: number, cardRect: DOMRect): boolean => {
    const imageData = maskImageDataRefs.current.get(cardId)
    const canvas = maskCanvasRefs.current.get(cardId)
    if (!imageData || !canvas) return false

    // Calculate how object-fit: cover affects the image display
    const cardAspect = cardRect.width / cardRect.height
    const imageAspect = canvas.width / canvas.height

    let visibleWidth: number, visibleHeight: number
    let offsetX = 0, offsetY = 0

    if (imageAspect > cardAspect) {
      // Image is wider than card - sides are cropped
      visibleHeight = canvas.height
      visibleWidth = canvas.height * cardAspect
      offsetX = (canvas.width - visibleWidth) / 2
    } else {
      // Image is taller than card - top/bottom are cropped
      visibleWidth = canvas.width
      visibleHeight = canvas.width / cardAspect
      offsetY = (canvas.height - visibleHeight) / 2
    }

    // Map mouse position to mask coordinates (accounting for crop)
    const relX = (mouseX - cardRect.left) / cardRect.width
    const relY = (mouseY - cardRect.top) / cardRect.height
    const maskX = Math.floor(offsetX + relX * visibleWidth)
    const maskY = Math.floor(offsetY + relY * visibleHeight)

    // Bounds check
    if (maskX < 0 || maskX >= canvas.width || maskY < 0 || maskY >= canvas.height) {
      return false
    }

    // Get pixel brightness
    const pixelIndex = (maskY * canvas.width + maskX) * 4
    const r = imageData.data[pixelIndex] ?? 0
    const g = imageData.data[pixelIndex + 1] ?? 0
    const b = imageData.data[pixelIndex + 2] ?? 0
    const brightness = (r + g + b) / 3

    return brightness > 128 // White = product area
  }, [])

  // Calculate product bounding box from mask (in screen coordinates)
  // Accounts for object-fit: cover cropping
  const getProductBounds = useCallback((cardId: string, cardRect: DOMRect): { left: number; right: number; top: number; bottom: number } | null => {
    const imageData = maskImageDataRefs.current.get(cardId)
    const canvas = maskCanvasRefs.current.get(cardId)
    if (!imageData || !canvas) return null

    // Calculate how object-fit: cover affects the image display
    const cardAspect = cardRect.width / cardRect.height
    const imageAspect = canvas.width / canvas.height

    let visibleWidth: number, visibleHeight: number
    let offsetX = 0, offsetY = 0

    if (imageAspect > cardAspect) {
      // Image is wider than card - sides are cropped
      visibleHeight = canvas.height
      visibleWidth = canvas.height * cardAspect
      offsetX = (canvas.width - visibleWidth) / 2
    } else {
      // Image is taller than card - top/bottom are cropped
      visibleWidth = canvas.width
      visibleHeight = canvas.width / cardAspect
      offsetY = (canvas.height - visibleHeight) / 2
    }

    let minX = canvas.width
    let maxX = 0
    let minY = canvas.height
    let maxY = 0

    // Find bounding box of white pixels in mask (only within visible area)
    for (let y = 0; y < canvas.height; y++) {
      for (let x = 0; x < canvas.width; x++) {
        const pixelIndex = (y * canvas.width + x) * 4
        const r = imageData.data[pixelIndex] ?? 0
        const g = imageData.data[pixelIndex + 1] ?? 0
        const b = imageData.data[pixelIndex + 2] ?? 0
        const brightness = (r + g + b) / 3

        if (brightness > 128) {
          // Check if this pixel is within the visible cropped area
          if (x >= offsetX && x <= offsetX + visibleWidth &&
              y >= offsetY && y <= offsetY + visibleHeight) {
            if (x < minX) minX = x
            if (x > maxX) maxX = x
            if (y < minY) minY = y
            if (y > maxY) maxY = y
          }
        }
      }
    }

    if (minX >= maxX || minY >= maxY) return null

    // Convert mask coordinates to screen coordinates (accounting for crop)
    const screenX = (maskX: number) => cardRect.left + ((maskX - offsetX) / visibleWidth) * cardRect.width
    const screenY = (maskY: number) => cardRect.top + ((maskY - offsetY) / visibleHeight) * cardRect.height

    return {
      left: screenX(minX),
      right: screenX(maxX),
      top: screenY(minY),
      bottom: screenY(maxY),
    }
  }, [])

  // Initialize with cards (Pinterest-like high density)
  useEffect(() => {
    const initialCards: ImageCard[] = []
    for (let i = 0; i < 20; i++) { // More initial cards
      const yBase = 20 + i * 140 // Much tighter vertical spacing
      const card = createCard(yBase + Math.random() * 40, initialCards)
      if (card) {
        initialCards.push(card)
        // Load mask for hover detection
        loadMaskForCard(card.id, card.galleryItem.maskUrl)
      }
    }
    setCards(initialCards)
  }, [createCard, loadMaskForCard])

  // Animation loop
  useEffect(() => {
    const animate = () => {
      const now = Date.now()

      setCards(prev => {
        return prev.map(card => {
          // Skip physics if hovered or expanded
          if (card.isHovered || card.isExpanded) {
            return { ...card, opacity: 1 }
          }

          let { x, y, vx, vy, opacity } = card
          const age = now - card.spawnTime

          // Fade in
          if (age < 800) {
            opacity = age / 800
          } else {
            opacity = 1
          }

          // Apply velocity (very subtle drift)
          x += vx * 0.1
          y += vy * 0.1

          // Damping
          vx *= 0.999
          vy *= 0.999

          // Add tiny jiggle (mostly vertical)
          vx += (Math.random() - 0.5) * 0.002
          vy += (Math.random() - 0.5) * 0.005

          // Horizontal bounds
          if (x < 8) { x = 8; vx = Math.abs(vx) * 0.2 }
          if (x > 88) { x = 88; vx = -Math.abs(vx) * 0.2 }

          return { ...card, x, y, vx, vy, opacity }
        })
      })

      animationRef.current = requestAnimationFrame(animate)
    }

    animationRef.current = requestAnimationFrame(animate)
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current)
    }
  }, [])

  // Infinite scroll - spawn new cards as user scrolls down
  useEffect(() => {
    const checkSpawn = () => {
      const viewportHeight = window.innerHeight
      const visibleBottom = scrollOffset + viewportHeight

      if (visibleBottom > totalHeight - viewportHeight) {
        setCards(prev => {
          const newCards: ImageCard[] = [...prev]
          for (let i = 0; i < 10; i++) { // Spawn more cards at once for density
            const yBase = totalHeight + i * 140 // Tighter spacing
            const card = createCard(yBase + Math.random() * 40, newCards)
            if (card) {
              newCards.push(card)
              loadMaskForCard(card.id, card.galleryItem.maskUrl)
            }
          }
          return newCards
        })
        setTotalHeight(prev => prev + 1600)
      }
    }
    checkSpawn()
  }, [scrollOffset, totalHeight, createCard, loadMaskForCard])

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape to close expanded view
      if (e.key === 'Escape' && expandedCardId) {
        setExpandedCardId(null)
        setCards(prev => prev.map(c => ({ ...c, isExpanded: false })))
        return
      }

      // Arrow keys and j/k for scrolling
      const scrollAmount = 80
      if (e.key === 'ArrowUp' || e.key === 'k') {
        e.preventDefault()
        setScrollOffset(prev => Math.max(0, prev - scrollAmount))
      } else if (e.key === 'ArrowDown' || e.key === 'j') {
        e.preventDefault()
        setScrollOffset(prev => prev + scrollAmount)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [expandedCardId])

  // Handle scroll
  const handleWheel = useCallback((e: WheelEvent) => {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return

    const writingPaneEnd = rect.left + (rect.width * writingPaneWidth / 100)
    if (e.clientX < writingPaneEnd) return

    e.preventDefault()
    setScrollOffset(prev => Math.max(0, prev + e.deltaY * 0.8))
  }, [writingPaneWidth])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    container.addEventListener('wheel', handleWheel, { passive: false })
    return () => container.removeEventListener('wheel', handleWheel)
  }, [handleWheel])

  // Calculate visible Y position
  const getVisibleY = (absoluteY: number) => absoluteY - scrollOffset

  // Calculate CSS mask for non-uniform opacity within a card (quadratic fade)
  const getCardMaskStyle = (visibleY: number, cardHeight: number): React.CSSProperties => {
    const viewportHeight = window.innerHeight
    const fadeZone = viewportHeight * 0.125

    const cardTop = visibleY
    const cardBottom = visibleY + cardHeight

    // Check if card overlaps with fade zones
    const inTopFade = cardTop < fadeZone
    const inBottomFade = cardBottom > viewportHeight - fadeZone

    if (!inTopFade && !inBottomFade) {
      return {} // No mask needed
    }

    // Build gradient stops for mask
    const stops: string[] = []

    if (inTopFade) {
      // How much of card is in top fade zone
      const fadeEnd = Math.min(fadeZone - cardTop, cardHeight)
      const fadeEndPercent = (fadeEnd / cardHeight) * 100

      // Opacity at card top (quadratic)
      const topT = Math.max(0, cardTop / fadeZone)
      const topOpacity = topT * topT

      // Opacity at fade zone boundary
      if (fadeEndPercent < 100) {
        stops.push(`rgba(0,0,0,${topOpacity}) 0%`)
        stops.push(`rgba(0,0,0,1) ${fadeEndPercent}%`)
      } else {
        // Entire card in top fade zone
        const bottomT = Math.max(0, cardBottom / fadeZone)
        const bottomOpacity = bottomT * bottomT
        stops.push(`rgba(0,0,0,${topOpacity}) 0%`)
        stops.push(`rgba(0,0,0,${bottomOpacity}) 100%`)
      }
    }

    if (inBottomFade && !inTopFade) {
      // How much of card is above bottom fade zone
      const fadeStart = viewportHeight - fadeZone - cardTop
      const fadeStartPercent = Math.max(0, (fadeStart / cardHeight) * 100)

      // Opacity at card bottom (quadratic)
      const bottomT = Math.max(0, (viewportHeight - cardBottom) / fadeZone)
      const bottomOpacity = bottomT * bottomT

      stops.push(`rgba(0,0,0,1) 0%`)
      stops.push(`rgba(0,0,0,1) ${fadeStartPercent}%`)
      stops.push(`rgba(0,0,0,${bottomOpacity}) 100%`)
    } else if (inBottomFade && inTopFade) {
      // Card spans both fade zones - already handled top, add bottom
      const fadeStart = viewportHeight - fadeZone - cardTop
      const fadeStartPercent = Math.max(0, (fadeStart / cardHeight) * 100)
      const bottomT = Math.max(0, (viewportHeight - cardBottom) / fadeZone)
      const bottomOpacity = bottomT * bottomT

      // Merge with existing stops
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

  // Handle hover
  const handleCardMouseEnter = useCallback((cardId: string) => {
    setCards(prev => prev.map(c => c.id === cardId ? { ...c, isHovered: true } : c))
  }, [])

  const handleCardMouseLeave = useCallback((cardId: string) => {
    setTimeout(() => {
      const overlayHovered = document.querySelector('.product-overlay:hover')
      if (!overlayHovered && !productClickLocked) {
        setActiveProduct(null)
        setProductHoverCardId(null)
        setCards(prev => prev.map(c => c.id === cardId ? { ...c, isHovered: false } : c))
      } else if (!productClickLocked) {
        setCards(prev => prev.map(c => c.id === cardId ? { ...c, isHovered: false } : c))
      }
    }, 150)
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current)
    }
  }, [productClickLocked])

  // Handle mouse move over card for mask detection
  const handleCardMouseMove = useCallback((card: ImageCard, e: React.MouseEvent<HTMLDivElement>) => {
    const cardElement = e.currentTarget
    const rect = cardElement.getBoundingClientRect()

    const overProduct = isMouseOverProductArea(card.id, e.clientX, e.clientY, rect)

    // Update product hover state for visual feedback
    if (overProduct) {
      setProductHoverCardId(card.id)
    } else {
      setProductHoverCardId(null)
    }

    if (overProduct) {
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current)

      hoverTimeoutRef.current = setTimeout(() => {
        const bounds = getProductBounds(card.id, rect)
        if (bounds) {
          setActiveProduct({
            product: card.galleryItem.product,
            position: { x: e.clientX, y: e.clientY },
            productBounds: bounds,
            cardId: card.id,
            sceneImageUrl: card.galleryItem.sceneUrl,
          })
        }
      }, 300) // 300ms delay before showing product card
    } else {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current)
      }
      // Only clear if not hovering on overlay and not click-locked
      if (!productClickLocked) {
        setTimeout(() => {
          const overlayHovered = document.querySelector('.product-overlay:hover')
          if (!overlayHovered) {
            setActiveProduct(null)
          }
        }, 100)
      }
    }
  }, [isMouseOverProductArea, productClickLocked, getProductBounds])

  // Handle click on product area - shows popup that stays until click elsewhere
  const handleCardClick = useCallback((card: ImageCard, e: React.MouseEvent<HTMLDivElement>) => {
    const cardElement = e.currentTarget
    const rect = cardElement.getBoundingClientRect()

    const overProduct = isMouseOverProductArea(card.id, e.clientX, e.clientY, rect)

    if (overProduct) {
      // Prevent triggering drag or double-click
      e.stopPropagation()

      const bounds = getProductBounds(card.id, rect)
      if (bounds) {
        // Show popup and lock it
        setActiveProduct({
          product: card.galleryItem.product,
          position: { x: e.clientX, y: e.clientY },
          productBounds: bounds,
          cardId: card.id,
          sceneImageUrl: card.galleryItem.sceneUrl,
        })
        setProductClickLocked(true)

        // Clear any pending hover timeout
        if (hoverTimeoutRef.current) {
          clearTimeout(hoverTimeoutRef.current)
        }
      }
    } else if (productClickLocked) {
      // Clicked elsewhere on the card (not on product) - dismiss popup
      setActiveProduct(null)
      setProductClickLocked(false)
      setProductHoverCardId(null)
    }
  }, [isMouseOverProductArea, getProductBounds, productClickLocked])

  // Handle click elsewhere to dismiss click-locked popup
  useEffect(() => {
    if (!productClickLocked) return

    const handleClickOutside = (e: MouseEvent) => {
      const overlay = document.querySelector('.product-overlay')
      const target = e.target as Node

      // If clicking outside the overlay, dismiss it
      if (!overlay?.contains(target)) {
        setActiveProduct(null)
        setProductClickLocked(false)
        setProductHoverCardId(null)
      }
    }

    // Add listener with a small delay to avoid immediate dismissal
    const timeoutId = setTimeout(() => {
      window.addEventListener('click', handleClickOutside)
    }, 50)

    return () => {
      clearTimeout(timeoutId)
      window.removeEventListener('click', handleClickOutside)
    }
  }, [productClickLocked])

  // Handle double click to expand
  const handleCardDoubleClick = useCallback((cardId: string) => {
    if (draggingCardId) return // Don't expand while dragging
    if (expandedCardId === cardId) {
      setExpandedCardId(null)
      setCards(prev => prev.map(c => c.id === cardId ? { ...c, isExpanded: false } : c))
    } else {
      setExpandedCardId(cardId)
      setCards(prev => prev.map(c => ({
        ...c,
        isExpanded: c.id === cardId,
      })))
    }
  }, [expandedCardId, draggingCardId])

  // Drag handlers
  const handleDragStart = useCallback((cardId: string, e: React.MouseEvent) => {
    e.preventDefault()
    const card = cards.find(c => c.id === cardId)
    if (!card) return

    // Don't start drag if clicking on product area
    const cardElement = e.currentTarget as HTMLElement
    const rect = cardElement.getBoundingClientRect()
    if (isMouseOverProductArea(cardId, e.clientX, e.clientY, rect)) {
      return // Don't start dragging when clicking on product
    }

    setDraggingCardId(cardId)
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      cardX: card.x,
      cardY: card.y,
    }
  }, [cards, isMouseOverProductArea])

  const handleDragMove = useCallback((e: MouseEvent) => {
    const dragStart = dragStartRef.current
    if (!dragStart) return

    const containerRect = containerRef.current?.getBoundingClientRect()
    if (!containerRect) return

    const galleryWidth = containerRect.width * (1 - writingPaneWidth / 100)
    const deltaX = e.clientX - dragStart.x
    const deltaY = e.clientY - dragStart.y

    // Convert pixel delta to percentage (relative to gallery area)
    const deltaXPercent = (deltaX / galleryWidth) * 100

    setCards(prev => prev.map(card => {
      if (card.id !== draggingCardId) return card

      let newX = dragStart.cardX + deltaXPercent
      let newY = dragStart.cardY + deltaY

      // Clamp to hard boundaries
      newX = Math.max(12, Math.min(88, newX))

      return {
        ...card,
        x: newX,
        y: newY,
        vx: 0,
        vy: 0,
      }
    }))
  }, [draggingCardId, writingPaneWidth])

  const handleDragEnd = useCallback(() => {
    setDraggingCardId(null)
    dragStartRef.current = null
  }, [])

  // Add global mouse listeners for drag
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
  const handleResizeStart = useCallback((cardId: string, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation() // Prevent drag from starting
    const card = cards.find(c => c.id === cardId)
    if (!card) return

    setResizingCardId(cardId)
    resizeStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      cardWidth: card.width,
      cardHeight: card.height,
    }
  }, [cards])

  const handleResizeMove = useCallback((e: MouseEvent) => {
    const resizeStart = resizeStartRef.current
    if (!resizeStart || !resizingCardId) return

    const deltaX = e.clientX - resizeStart.x
    const deltaY = e.clientY - resizeStart.y

    // Use the larger delta to maintain aspect ratio
    const delta = Math.max(deltaX, deltaY)

    setCards(prev => prev.map(card => {
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
    }))
  }, [resizingCardId])

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

  // Shopping handlers
  const handleAddToBag = useCallback((product: Product, cardId: string) => {
    // Add to bag immediately
    setBag(prev => {
      const existing = prev.find(item => item.product.id === product.id)
      if (existing) {
        return prev.map(item =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        )
      }
      return [...prev, { product, quantity: 1, addedAt: new Date() }]
    })

    // Mark this card as having its product removed (triggers fade animation via CSS)
    setRemovedProductCardIds(prev => new Set(prev).add(cardId))

    // Close the popup
    setActiveProduct(null)
    setProductClickLocked(false)
  }, [])

  // Revert a removed product (put it back in the image)
  const handleRevertProduct = useCallback((cardId: string, productId: string) => {
    // Remove from bag
    setBag(prev => {
      const item = prev.find(i => i.product.id === productId)
      if (item && item.quantity > 1) {
        return prev.map(i =>
          i.product.id === productId
            ? { ...i, quantity: i.quantity - 1 }
            : i
        )
      }
      return prev.filter(i => i.product.id !== productId)
    })

    // Restore product to card
    setRemovedProductCardIds(prev => {
      const next = new Set(prev)
      next.delete(cardId)
      return next
    })
  }, [])

  const handleBuyNow = useCallback(() => {
    // Buy Now confirmation handled in ProductOverlay
    // Just close the popup when confirmation is dismissed
    setActiveProduct(null)
    setProductClickLocked(false)
  }, [])

  const handleRemoveFromBag = useCallback((productId: string) => {
    setBag(prev => prev.filter(item => item.product.id !== productId))
  }, [])

  const handleUpdateQuantity = useCallback((productId: string, quantity: number) => {
    if (quantity <= 0) {
      handleRemoveFromBag(productId)
      return
    }
    setBag(prev =>
      prev.map(item =>
        item.product.id === productId ? { ...item, quantity } : item
      )
    )
  }, [handleRemoveFromBag])

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

  const bagTotal = bag.reduce((sum, item) => sum + item.product.price * item.quantity, 0)
  const bagCount = bag.reduce((sum, item) => sum + item.quantity, 0)

  // Writing pane resize
  const handleWritingPaneResize = useCallback((deltaX: number) => {
    const containerWidth = window.innerWidth
    const deltaPercent = (deltaX / containerWidth) * 100
    setWritingPaneWidth(prev => Math.max(20, Math.min(45, prev + deltaPercent)))
  }, [])

  const handleWritingPaneResizeEnd = useCallback(() => {
    localStorage.setItem('consumer-writing-pane-width', writingPaneWidth.toString())
  }, [writingPaneWidth])

  // Scroll indicator position
  const scrollIndicatorPos = totalHeight > 0 ? scrollOffset / Math.max(1, totalHeight - window.innerHeight) : 0

  // Filter visible cards
  const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 800
  const visibleCards = cards.filter(card => {
    if (card.isExpanded) return true
    const visibleY = getVisibleY(card.y)
    return visibleY > -card.height - 100 && visibleY < viewportHeight + 100
  })

  return (
    <div className="consumer-gallery" ref={containerRef}>
      {/* Writing Pane */}
      <WritingPane
        value={userComposition}
        onChange={setUserComposition}
        width={writingPaneWidth}
        title="Reverie"
        placeholder="Describe the vibe you're looking for..."
        accentColor="#c9a227"
        background="rgba(30, 28, 26, 0.95)"
        textColor="#e8e4d9"
        titleColor="#c9a227"
      />

      {/* Resize Divider */}
      <ResizeDivider
        onDrag={handleWritingPaneResize}
        onDragEnd={handleWritingPaneResizeEnd}
        onDoubleClick={() => setWritingPaneWidth(33.33)}
      />

      {/* Image Gallery Area */}
      <div className="gallery-container" style={{ left: `${writingPaneWidth}%` }}>
        {/* Background gradient */}
        <div className="gallery-background" />

        {/* Top fade zone */}
        <div className="fade-zone fade-zone-top" />

        {/* Bottom fade zone */}
        <div className="fade-zone fade-zone-bottom" />

        {/* Cards */}
        {visibleCards.map(card => {
          const visibleY = getVisibleY(card.y)
          const maskStyle = card.isExpanded ? {} : getCardMaskStyle(visibleY, card.height)

          if (card.isExpanded) {
            return (
              <div
                key={card.id}
                className="expanded-card-overlay"
                onClick={() => handleCardDoubleClick(card.id)}
              >
                <div
                  className="expanded-card"
                  onClick={e => {
                    e.stopPropagation()
                    handleCardClick(card, e)
                  }}
                  onMouseMove={e => handleCardMouseMove(card, e)}
                  onMouseLeave={() => handleCardMouseLeave(card.id)}
                >
                  {/* Scene image with product */}
                  <img
                    src={card.galleryItem.sceneUrl}
                    alt=""
                    className={`expanded-card-image ${removedProductCardIds.has(card.id) ? 'product-removed' : ''}`}
                  />
                  {/* Base layer: shown when product is removed (crossfade) */}
                  {removedProductCardIds.has(card.id) && (
                    <img
                      src={card.galleryItem.baseUrl}
                      alt=""
                      className="expanded-card-image expanded-card-base-revealed"
                    />
                  )}
                  {/* Product highlight overlay for expanded view */}
                  {!removedProductCardIds.has(card.id) && productHoverCardId === card.id && highlightDataUrlRefs.current.get(card.id) && (
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
                        handleRevertProduct(card.id, card.galleryItem.product.id)
                      }}
                    >
                      Show Original Image
                    </button>
                  )}
                </div>
              </div>
            )
          }

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
              onDoubleClick={() => handleCardDoubleClick(card.id)}
              onMouseMove={e => handleCardMouseMove(card, e)}
              onMouseDown={e => handleDragStart(card.id, e)}
              onClick={e => handleCardClick(card, e)}
            >
              {/* Scene image with product */}
              <img
                src={card.galleryItem.sceneUrl}
                alt=""
                className={`gallery-card-image ${removedProductCardIds.has(card.id) ? 'product-removed' : ''}`}
                loading="lazy"
                draggable={false}
              />
              {/* Base layer: shown when product is removed (crossfade) */}
              {removedProductCardIds.has(card.id) && (
                <img
                  src={card.galleryItem.baseUrl}
                  alt=""
                  className="gallery-card-image gallery-card-base-revealed"
                  loading="lazy"
                  draggable={false}
                />
              )}
              {/* Product highlight overlay - only visible when hovering over product area */}
              {!removedProductCardIds.has(card.id) && productHoverCardId === card.id && highlightDataUrlRefs.current.get(card.id) && (
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
                    handleRevertProduct(card.id, card.galleryItem.product.id)
                  }}
                >
                  Show Original Image
                </button>
              )}
              {/* Resize handle - bottom right corner */}
              <div
                className={clsx('resize-handle', resizingCardId === card.id && 'resizing')}
                onMouseDown={e => handleResizeStart(card.id, e)}
              />
            </div>
          )
        })}

        {/* User Profile Button */}
        <button
          className={clsx('user-button', paymentInfo && 'has-info')}
          onClick={() => setShowProfile(true)}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        </button>

        {/* Shopping Bag Button */}
        <button
          className={clsx('bag-button', bagCount > 0 && 'has-items')}
          onClick={() => setShowBag(true)}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
          onAddToBag={() => handleAddToBag(activeProduct.product, activeProduct.cardId)}
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
          onCheckout={() => {
            // Clear the bag - checkout handled internally by ShoppingBag
            setBag([])
          }}
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

      {/* 1-Click Purchase Success Toast */}
      {purchaseSuccess && !showPayment && (
        <div className="purchase-toast">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
          <span>Purchase complete</span>
        </div>
      )}

      {/* Debug mode indicator */}
      {debugMode && (
        <div className="debug-badge">
          Debug | Scroll: {Math.round(scrollOffset)} | Cards: {cards.length} | Over Product: {productHoverCardId ? 'Yes' : 'No'}
        </div>
      )}
    </div>
  )
}

export default ConsumerGallery
