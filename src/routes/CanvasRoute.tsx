/**
 * CanvasRoute - handles /{configSlug}/{sessionSlug}
 *
 * Loads the config and session, renders EphemeralCanvas with the saved state.
 */

import { useState, useCallback, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getConfigBySlug } from '@/services/configRegistry'
import { getSessionBySlug, saveSession } from '@/services/sessionRegistry'
import EphemeralCanvas from '@/components/EphemeralCanvas'
import { SessionCostBadge } from '@/components/SessionCostBadge'
import type { CanvasState } from '@/services/persistence'
import type { CanvasConfig } from '@/services/api'

export function CanvasRoute() {
  const { configSlug, sessionSlug } = useParams<{
    configSlug: string
    sessionSlug: string
  }>()
  const navigate = useNavigate()

  const [config, setConfig] = useState<CanvasConfig | null>(null)
  const [initialState, setInitialState] = useState<CanvasState | null>(null)
  const [userComposition, setUserComposition] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sessionId, setSessionId] = useState<string | null>(null)

  // Track current state for auto-save
  const currentStateRef = useRef<CanvasState | null>(null)
  const autoSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Load config and session on mount
  useEffect(() => {
    if (!configSlug || !sessionSlug) {
      navigate('/', { replace: true })
      return
    }

    const loadedConfig = getConfigBySlug(configSlug)
    if (!loadedConfig) {
      setError(`Configuration "${configSlug}" not found`)
      setLoading(false)
      return
    }

    const session = getSessionBySlug(configSlug, sessionSlug)
    if (!session) {
      // Session not found - redirect to create new one
      navigate(`/${configSlug}`, { replace: true })
      return
    }

    // Check if session belongs to a different config (shouldn't happen with slug lookup, but safety check)
    if (session.configSlug !== configSlug) {
      // Redirect to correct URL
      navigate(`/${session.configSlug}/${session.slug}`, { replace: true })
      return
    }

    setConfig(loadedConfig)
    setSessionId(session.id)
    setInitialState(session.state)
    setUserComposition(session.state.userComposition || '')
    setLoading(false)
  }, [configSlug, sessionSlug, navigate])

  // Auto-save handler (debounced)
  const triggerAutoSave = useCallback(() => {
    if (!configSlug || !sessionId || !currentStateRef.current) return

    // Clear existing timeout
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current)
    }

    // Debounce: save 2 seconds after last change
    autoSaveTimeoutRef.current = setTimeout(() => {
      if (currentStateRef.current && configSlug && sessionId) {
        saveSession(configSlug, currentStateRef.current, undefined, sessionId)
      }
    }, 2000)
  }, [configSlug, sessionId])

  // Handle composition changes
  const handleCompositionChange = useCallback(
    (text: string) => {
      setUserComposition(text)
      if (currentStateRef.current) {
        currentStateRef.current = {
          ...currentStateRef.current,
          userComposition: text,
        }
        triggerAutoSave()
      }
    },
    [triggerAutoSave]
  )

  // Handle config changes (for snapshot loading within canvas)
  const handleConfigChange = useCallback(
    (newConfig: CanvasConfig) => {
      // If a different config is loaded, we need to navigate to it
      if (newConfig.slug && newConfig.slug !== configSlug) {
        navigate(`/${newConfig.slug}`)
      } else {
        setConfig(newConfig)
      }
    },
    [configSlug, navigate]
  )

  // Callback to update current state (called from EphemeralCanvas)
  const handleStateChange = useCallback(
    (state: CanvasState) => {
      currentStateRef.current = state
      triggerAutoSave()
    },
    [triggerAutoSave]
  )

  // Cleanup auto-save timeout on unmount
  useEffect(() => {
    return () => {
      // Final save on unmount
      if (currentStateRef.current && configSlug && sessionId) {
        saveSession(configSlug, currentStateRef.current, undefined, sessionId)
      }
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current)
      }
    }
  }, [configSlug, sessionId])

  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
          color: 'white',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              width: 40,
              height: 40,
              border: '3px solid rgba(255,255,255,0.2)',
              borderTopColor: 'white',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 1rem',
            }}
          />
          <p style={{ opacity: 0.8 }}>Loading your space...</p>
        </div>
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    )
  }

  if (error) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
          color: 'white',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <div style={{ textAlign: 'center', maxWidth: 400 }}>
          <h1 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>
            Not Found
          </h1>
          <p style={{ opacity: 0.8, marginBottom: '1.5rem' }}>{error}</p>
          <button
            onClick={() => navigate('/')}
            style={{
              padding: '0.75rem 1.5rem',
              background: 'rgba(99, 102, 241, 0.8)',
              border: 'none',
              borderRadius: '0.5rem',
              color: 'white',
              cursor: 'pointer',
              fontSize: '1rem',
            }}
          >
            Go Home
          </button>
        </div>
      </div>
    )
  }

  if (!config) {
    return null
  }

  return (
    <div className="relative h-screen w-screen">
      <EphemeralCanvas
        config={config}
        userComposition={userComposition}
        onCompositionChange={handleCompositionChange}
        onConfigChange={handleConfigChange}
        initialState={initialState ?? undefined}
        sessionId={sessionId ?? undefined}
        onStateChange={handleStateChange}
      />
      {sessionId && (
        <div
          className="absolute bottom-4 right-4 z-50"
          data-testid="session-cost-badge"
        >
          <SessionCostBadge sessionId={sessionId} />
        </div>
      )}
    </div>
  )
}

export default CanvasRoute
