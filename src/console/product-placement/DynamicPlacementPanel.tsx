/**
 * DynamicPlacementPanel - Infinite scroll gallery with AI-generated placements.
 *
 * Features:
 * - Double-click to "like" a placement (saves to context for future generations)
 * - Shows generation phase progress
 * - Mask-based hover detection for product areas
 * - Scroll-triggered batch generation
 */

import { useRef, useEffect, useCallback, useState } from 'react'
import {
  usePlacementGeneration,
  type GenerationPhase,
} from './usePlacementGeneration'
import type { ProductInfo, PlacementResult } from '../../services/placementApi'
import './DynamicPlacementPanel.css'

interface DynamicPlacementPanelProps {
  writingContext: string
  products: ProductInfo[]
  onPlacementClick?: (placement: PlacementResult) => void
}

const PHASE_LABELS: Record<GenerationPhase, string> = {
  idle: '',
  'generating-scenes': 'Creating scenes...',
  'generating-images': 'Generating images...',
  'selecting-products': 'Selecting products...',
  composing: 'Composing...',
  'generating-masks': 'Creating masks...',
  complete: '',
  error: 'Generation failed',
}

export default function DynamicPlacementPanel({
  writingContext,
  products,
  onPlacementClick,
}: DynamicPlacementPanelProps) {
  const {
    placements,
    likedScenes,
    phase,
    error,
    isGenerating,
    generateBatch,
    likeScene,
    clearPlacements,
  } = usePlacementGeneration()

  const containerRef = useRef<HTMLDivElement>(null)
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  // Scroll-triggered generation
  const handleScroll = useCallback(() => {
    if (!containerRef.current || isGenerating) return

    const { scrollTop, scrollHeight, clientHeight } = containerRef.current
    const scrollPercentage = (scrollTop + clientHeight) / scrollHeight

    // Trigger generation when 80% scrolled
    if (scrollPercentage > 0.8 && placements.length > 0) {
      generateBatch(writingContext, products)
    }
  }, [isGenerating, placements.length, generateBatch, writingContext, products])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    container.addEventListener('scroll', handleScroll)
    return () => container.removeEventListener('scroll', handleScroll)
  }, [handleScroll])

  // Handle double-click to like
  const handleDoubleClick = useCallback((placement: PlacementResult) => {
    likeScene(placement)
  }, [likeScene])

  // Handle single click
  const handleClick = useCallback((placement: PlacementResult) => {
    onPlacementClick?.(placement)
  }, [onPlacementClick])

  // Initial generation button
  const handleGenerateClick = useCallback(() => {
    if (!isGenerating) {
      generateBatch(writingContext, products)
    }
  }, [isGenerating, generateBatch, writingContext, products])

  return (
    <div className="dynamic-panel">
      <div className="dynamic-panel-header">
        <h2>Dynamic Placements</h2>
        {likedScenes.length > 0 && (
          <span className="liked-count">{likedScenes.length} liked</span>
        )}
      </div>

      {/* Phase indicator */}
      {isGenerating && (
        <div className="dynamic-phase-indicator">
          <div className="dynamic-spinner" />
          <span>{PHASE_LABELS[phase]}</span>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="dynamic-error">
          {error}
        </div>
      )}

      {/* Main content area */}
      <div
        ref={containerRef}
        className="dynamic-panel-content"
      >
        {placements.length === 0 && !isGenerating ? (
          <div className="dynamic-empty-state">
            <h3>No placements yet</h3>
            <p>Enter text in the writing pane and click Generate to create AI-powered product placements.</p>
            <button
              className="dynamic-generate-btn"
              onClick={handleGenerateClick}
              disabled={!writingContext.trim() || products.length === 0}
            >
              Generate Placements
            </button>
          </div>
        ) : (
          <div className="dynamic-grid">
            {placements.map((placement) => (
              <PlacementCard
                key={placement.scene_id}
                placement={placement}
                isHovered={hoveredId === placement.scene_id}
                isLiked={likedScenes.some(
                  s => s.description === placement.scene_description
                )}
                onMouseEnter={() => setHoveredId(placement.scene_id)}
                onMouseLeave={() => setHoveredId(null)}
                onClick={() => handleClick(placement)}
                onDoubleClick={() => handleDoubleClick(placement)}
              />
            ))}
          </div>
        )}

        {/* Loading indicator at bottom for infinite scroll */}
        {isGenerating && placements.length > 0 && (
          <div className="dynamic-loading-more">
            <div className="dynamic-spinner" />
            <span>Loading more...</span>
          </div>
        )}
      </div>

      {/* Footer with actions */}
      {placements.length > 0 && (
        <div className="dynamic-panel-footer">
          <span className="dynamic-count">{placements.length} placements</span>
          <button
            className="dynamic-generate-btn secondary"
            onClick={handleGenerateClick}
            disabled={isGenerating}
          >
            {isGenerating ? 'Generating...' : 'Generate More'}
          </button>
        </div>
      )}
    </div>
  )
}

// Individual placement card component
interface PlacementCardProps {
  placement: PlacementResult
  isHovered: boolean
  isLiked: boolean
  onMouseEnter: () => void
  onMouseLeave: () => void
  onClick: () => void
  onDoubleClick: () => void
}

function PlacementCard({
  placement,
  isHovered,
  isLiked,
  onMouseEnter,
  onMouseLeave,
  onClick,
  onDoubleClick,
}: PlacementCardProps) {
  const [showMask, setShowMask] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const maskImageDataRef = useRef<ImageData | null>(null)

  // Load mask image for hover detection
  useEffect(() => {
    if (!placement.mask) return

    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.width
      canvas.height = img.height
      const ctx = canvas.getContext('2d', { willReadFrequently: true })
      if (ctx) {
        ctx.drawImage(img, 0, 0)
        maskImageDataRef.current = ctx.getImageData(0, 0, canvas.width, canvas.height)
      }
    }
    img.src = `data:${placement.mime_type};base64,${placement.mask}`
  }, [placement.mask, placement.mime_type])

  // Check if mouse is over product using mask
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!maskImageDataRef.current) return

    const rect = e.currentTarget.getBoundingClientRect()
    const x = Math.floor(((e.clientX - rect.left) / rect.width) * maskImageDataRef.current.width)
    const y = Math.floor(((e.clientY - rect.top) / rect.height) * maskImageDataRef.current.height)

    const idx = (y * maskImageDataRef.current.width + x) * 4
    const brightness = (
      maskImageDataRef.current.data[idx]! +
      maskImageDataRef.current.data[idx + 1]! +
      maskImageDataRef.current.data[idx + 2]!
    ) / 3

    setShowMask(brightness > 128)
  }, [])

  const imageUrl = `data:${placement.mime_type};base64,${placement.composed_image}`

  return (
    <div
      className={`dynamic-card ${isHovered ? 'hovered' : ''} ${isLiked ? 'liked' : ''}`}
      onMouseEnter={onMouseEnter}
      onMouseLeave={() => {
        onMouseLeave()
        setShowMask(false)
      }}
      onMouseMove={handleMouseMove}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
    >
      <img
        src={imageUrl}
        alt={placement.scene_description}
        className="dynamic-card-image"
      />

      {/* Product highlight overlay */}
      {showMask && placement.mask && (
        <div
          className="dynamic-card-highlight"
          style={{
            maskImage: `url(data:${placement.mime_type};base64,${placement.mask})`,
            WebkitMaskImage: `url(data:${placement.mime_type};base64,${placement.mask})`,
          }}
        />
      )}

      {/* Scene type badge */}
      <div className={`dynamic-card-badge ${placement.scene_type}`}>
        {placement.scene_type === 'continuation' ? 'Similar' : 'New'}
      </div>

      {/* Liked heart indicator */}
      {isLiked && (
        <div className="dynamic-card-liked">
          <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
          </svg>
        </div>
      )}

      {/* Info overlay */}
      <div className="dynamic-card-info">
        <span className="dynamic-card-product">{placement.product.brand} {placement.product.name}</span>
        <span className="dynamic-card-mood">{placement.mood}</span>
      </div>

      {/* Double-click hint */}
      <div className="dynamic-card-hint">
        Double-click to like
      </div>
    </div>
  )
}
