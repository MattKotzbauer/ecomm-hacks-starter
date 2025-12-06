/**
 * ConsumerRoute - Demo consumer interface using ConsumerGallery
 *
 * Features:
 * - Image-only scrollable gallery
 * - Luxury brand product placements
 * - Hover to pause, double-click to expand
 * - Infinite scroll with fade zones
 */

import ConsumerGallery from '@/components/ConsumerGallery'
import PasswordGate from '@/components/PasswordGate'

interface ConsumerRouteProps {
  debugMode?: boolean
}

export function ConsumerRoute({ debugMode = false }: ConsumerRouteProps) {
  return (
    <PasswordGate
      theme="dark"
      title="Consumer Preview"
      subtitle="Enter password to view the demo"
    >
      <ConsumerGallery debugMode={debugMode} />
    </PasswordGate>
  )
}

export default ConsumerRoute
