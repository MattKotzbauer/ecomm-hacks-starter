/**
 * GenerativeGalleryRoute - AI-generated scroll-triggered gallery
 *
 * Features:
 * - Scroll past last cards to trigger new AI generation
 * - WritingPane context influences scene generation
 * - Like products to influence future generations
 * - Session persistence via IndexedDB
 */

import GenerativeGallery from '@/components/GenerativeGallery'

interface GenerativeGalleryRouteProps {
  debugMode?: boolean
}

export function GenerativeGalleryRoute({ debugMode = false }: GenerativeGalleryRouteProps) {
  return <GenerativeGallery debugMode={debugMode} />
}

export default GenerativeGalleryRoute
