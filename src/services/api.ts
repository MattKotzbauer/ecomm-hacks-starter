/**
 * Canvas API client for communicating with the backend.
 */

// API base URL - uses Vercel serverless functions in production
const API_BASE = import.meta.env.VITE_API_URL || ''

// --- Custom Error Types ---

export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public isNetworkError: boolean = false
  ) {
    super(message)
    this.name = 'ApiError'
  }

  /** User-friendly error message */
  get userMessage(): string {
    if (this.isNetworkError) {
      return 'Cannot connect to server. Please check your connection.'
    }
    if (this.statusCode === 503) {
      return 'AI service temporarily unavailable. Please try again.'
    }
    if (this.statusCode >= 500) {
      return 'Server error. Please try again later.'
    }
    return this.message
  }
}

/** Helper to handle fetch errors consistently */
async function handleResponse<T>(
  response: Response,
  operation: string
): Promise<T> {
  if (!response.ok) {
    let detail = `${operation} failed`
    try {
      const error = await response.json()
      detail = error.detail || detail
    } catch {
      // Response wasn't JSON
    }
    throw new ApiError(detail, response.status)
  }
  return response.json()
}

/** Helper to handle network errors */
function handleNetworkError(error: unknown, operation: string): never {
  if (error instanceof ApiError) throw error

  const isNetwork =
    error instanceof TypeError &&
    (error.message.includes('Failed to fetch') ||
      error.message.includes('NetworkError') ||
      error.message.includes('Network request failed'))

  if (isNetwork) {
    throw new ApiError('Network error', 0, true)
  }

  throw new ApiError(
    error instanceof Error ? error.message : `${operation} failed`,
    0
  )
}

// --- Types ---

// Gemini model types (mapped from original Claude names)
export type ModelType = 'flash' | 'pro' | 'flash-thinking'

export interface CardField {
  name: string
  type: 'string' | 'string?'
  display: 'primary' | 'secondary' | 'meta'
}

export interface CardSchema {
  fields: CardField[]
}

export interface CardTheme {
  container: string
  primary: string
  secondary: string
  meta: string
  dragging?: string | null
}

export interface CanvasTheme {
  background: string
  accent: string
  // Image background with CSS filter post-processing (optional, overrides background if set)
  backgroundImage?: string | null // URL to background image (e.g., Wikimedia Commons)
  backgroundFilter?: string | null // CSS filter string (e.g., "blur(8px) brightness(0.3)")
  backgroundBlendMode?: string | null // CSS blend mode (e.g., "multiply", "overlay")
  backgroundOverlay?: string | null // CSS color overlay (e.g., "rgba(0,0,0,0.5)")
}

export interface PhysicsConfig {
  cardLifetime: number // seconds
  driftSpeed: number // 0-3 multiplier
  jiggle: number // 0-3 intensity
  bounce: number // 0-1 elasticity
}

export interface ModelsConfig {
  generation: ModelType
  chat: ModelType
  onboarding: ModelType
}

export interface SpawningConfig {
  intervalSeconds: number
  minCards: number
  imageWeight?: number // Probability 0.0-1.0 that a generated card is an image
}

export interface WritingPaneConfig {
  // Content
  title: string
  placeholder: string
  initialContent?: string // Pre-populated template for new sessions
  // Styling (CSS values)
  background?: string // CSS background (e.g., "rgba(0,0,0,0.5)", gradient)
  textColor?: string // Color of written text
  titleColor?: string // Color of the title
  fontFamily?: string // 'serif', 'sans', 'mono', or CSS font-family
}

export interface CanvasConfig {
  name: string
  hintText?: string
  /** URL-safe slug for routing (set by configRegistry) */
  slug?: string

  cardSchema: CardSchema
  cardTheme: CardTheme
  canvasTheme: CanvasTheme

  generationContext: string

  // Diversity directives (4-5 phrases that push generation in different directions)
  directives: string[]

  seedContent: CardData[]

  physics: PhysicsConfig
  models: ModelsConfig
  spawning: SpawningConfig
  writingPane?: WritingPaneConfig
}

export type CardData = Record<string, string | null>

export interface OnboardMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface OnboardResponse {
  type: 'question' | 'config'
  content: string | CanvasConfig
  session_id: string
}

/** Response from /api/generate with cost tracking */
export interface GenerateResult {
  card: CardData
  cost_usd: number | null
  usage: { input_tokens: number; output_tokens: number } | null
}

// --- API Functions ---

/**
 * Generate a new card using the LLM.
 * Model is determined by config.models.generation.
 * @param directive Optional creative direction for this generation (from config.directives)
 * @returns GenerateResult with card, cost_usd, and usage
 */
export async function generateCard(
  config: CanvasConfig,
  userComposition: string,
  existingCards: CardData[],
  directive?: string,
  imageCard?: boolean
): Promise<GenerateResult> {
  try {
    // Strip frontend-only fields before sending to backend
    const { slug: _, ...backendConfig } = config

    const response = await fetch(`${API_BASE}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        config: backendConfig,
        user_composition: userComposition,
        existing_cards: existingCards,
        directive,
        image_card: imageCard,
      }),
    })

    const data = await handleResponse<GenerateResult>(response, 'Generation')
    return data
  } catch (error) {
    throw handleNetworkError(error, 'Generation')
  }
}

/**
 * Chat with the onboarding assistant to create a custom canvas.
 * Session history is managed server-side - just pass the session_id.
 */
export async function onboardChat(
  message: string,
  sessionId?: string
): Promise<OnboardResponse> {
  try {
    const body: { message: string; session_id?: string } = { message }
    if (sessionId) {
      body.session_id = sessionId
    }

    const response = await fetch(`${API_BASE}/api/onboard`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    return handleResponse<OnboardResponse>(response, 'Onboarding')
  } catch (error) {
    throw handleNetworkError(error, 'Onboarding')
  }
}

// --- Style Chat Types ---

export interface PartialCardTheme {
  container?: string
  primary?: string
  secondary?: string
  meta?: string
  dragging?: string | null
}

export interface PartialCanvasTheme {
  background?: string
  accent?: string
  backgroundImage?: string | null
  backgroundFilter?: string | null
  backgroundBlendMode?: string | null
  backgroundOverlay?: string | null
}

export interface PartialPhysics {
  cardLifetime?: number
  driftSpeed?: number
  jiggle?: number
  bounce?: number
}

export interface StyleRequest {
  message: string
  currentCardTheme: CardTheme
  currentCanvasTheme: CanvasTheme
  currentPhysics: PhysicsConfig
  sessionId?: string
}

export interface StyleResponse {
  type: 'update' | 'question'
  card_theme?: PartialCardTheme
  canvas_theme?: PartialCanvasTheme
  physics?: PartialPhysics
  explanation?: string
  session_id: string
}

/**
 * Chat with the style assistant to modify visual themes and physics.
 * Returns partial updates to apply to the config.
 */
export async function styleChat(request: StyleRequest): Promise<StyleResponse> {
  try {
    const response = await fetch(`${API_BASE}/api/style`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: request.message,
        current_card_theme: request.currentCardTheme,
        current_canvas_theme: request.currentCanvasTheme,
        current_physics: request.currentPhysics,
        session_id: request.sessionId,
      }),
    })

    return handleResponse<StyleResponse>(response, 'Style')
  } catch (error) {
    throw handleNetworkError(error, 'Style')
  }
}
