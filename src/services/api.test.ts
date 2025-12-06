/**
 * Tests for the Canvas API client.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { generateCard, onboardChat, ApiError, type CanvasConfig } from './api'

// API_BASE in dev mode is http://localhost:8000
const API_BASE = 'http://localhost:8000'

describe('Canvas API Client', () => {
  const mockFetch = vi.fn()

  beforeEach(() => {
    globalThis.fetch = mockFetch
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  const sampleConfig: CanvasConfig = {
    name: 'TestCanvas',
    hintText: 'Test hint',
    cardSchema: {
      fields: [
        { name: 'text', type: 'string', display: 'primary' },
        { name: 'source', type: 'string?', display: 'meta' },
      ],
    },
    cardTheme: {
      container: 'bg-black/30 rounded-xl',
      primary: 'text-lg text-white',
      secondary: 'text-base text-white/60',
      meta: 'text-sm text-white/45',
      dragging: 'opacity-80 scale-105',
    },
    canvasTheme: {
      background: '#000',
      accent: '#fff',
    },
    generationContext: 'Generate test content.',
    directives: [
      'Explore something unexpected',
      'Go deeper into themes',
      'Introduce contrast',
      'Focus on detail',
      'Draw from different contexts',
    ],
    seedContent: [],
    physics: {
      cardLifetime: 35,
      driftSpeed: 0.4,
      jiggle: 0.6,
      bounce: 0.4,
    },
    models: {
      generation: 'flash',
      chat: 'flash',
      onboarding: 'pro',
    },
    spawning: {
      intervalSeconds: 8,
      minCards: 2,
    },
  }

  describe('generateCard', () => {
    it('should POST to /api/generate with correct payload', async () => {
      const mockCard = { text: 'Generated content', source: 'AI' }
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ card: mockCard, cost_usd: 0.001, usage: null }),
      })

      const result = await generateCard(sampleConfig, 'user thinking', [])

      expect(mockFetch).toHaveBeenCalledWith(`${API_BASE}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          config: sampleConfig,
          user_composition: 'user thinking',
          existing_cards: [],
        }),
      })
      expect(result.card).toEqual(mockCard)
    })

    it('should include existing cards in request', async () => {
      const existingCards = [{ text: 'Existing card', source: 'test' }]
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          card: { text: 'New card', source: 'AI' },
          cost_usd: 0.001,
          usage: null,
        }),
      })

      await generateCard(sampleConfig, '', existingCards)

      const call = mockFetch.mock.calls[0]!
      const body = JSON.parse(call[1].body as string)
      expect(body.existing_cards).toEqual(existingCards)
    })

    it('should throw on API error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 503,
        json: async () => ({ detail: 'LLM error' }),
      })

      await expect(generateCard(sampleConfig, '', [])).rejects.toThrow(
        'LLM error'
      )
    })
  })

  describe('onboardChat', () => {
    it('should POST to /api/onboard with message only (no session_id for first call)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          type: 'question',
          content: 'What kind of creative space would you like?',
          session_id: 'abc-123',
        }),
      })

      const result = await onboardChat('Poetry')

      expect(mockFetch).toHaveBeenCalledWith(`${API_BASE}/api/onboard`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'Poetry',
        }),
      })
      expect(result.type).toBe('question')
      expect(result.content).toBe('What kind of creative space would you like?')
      expect(result.session_id).toBe('abc-123')
    })

    it('should include session_id in subsequent requests', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          type: 'question',
          content: 'What mood or theme interests you?',
          session_id: 'abc-123',
        }),
      })

      const result = await onboardChat('I love haikus', 'abc-123')

      expect(mockFetch).toHaveBeenCalledWith(`${API_BASE}/api/onboard`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'I love haikus',
          session_id: 'abc-123',
        }),
      })
      expect(result.session_id).toBe('abc-123')
    })

    it('should return config when onboarding complete', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          type: 'config',
          content: sampleConfig,
          session_id: 'abc-123',
        }),
      })

      const result = await onboardChat('I want meditative poems')

      expect(result.type).toBe('config')
      expect(result.content).toEqual(sampleConfig)
    })

    it('should throw on API error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 503,
        json: async () => ({ detail: 'LLM error' }),
      })

      await expect(onboardChat('test')).rejects.toThrow('LLM error')
    })
  })

  describe('ApiError', () => {
    describe('constructor', () => {
      it('should create error with message and statusCode', () => {
        const error = new ApiError('Test error', 500)

        expect(error.message).toBe('Test error')
        expect(error.statusCode).toBe(500)
        expect(error.isNetworkError).toBe(false)
        expect(error.name).toBe('ApiError')
      })

      it('should create network error when isNetworkError is true', () => {
        const error = new ApiError('Network error', 0, true)

        expect(error.isNetworkError).toBe(true)
        expect(error.statusCode).toBe(0)
      })
    })

    describe('userMessage getter', () => {
      it('should return network error message for network errors', () => {
        const error = new ApiError('Network error', 0, true)

        expect(error.userMessage).toBe(
          'Cannot connect to server. Please check your connection.'
        )
      })

      it('should return service unavailable message for 503 errors', () => {
        const error = new ApiError('Service unavailable', 503)

        expect(error.userMessage).toBe(
          'AI service temporarily unavailable. Please try again.'
        )
      })

      it('should return server error message for 5xx errors', () => {
        const error = new ApiError('Internal server error', 500)

        expect(error.userMessage).toBe('Server error. Please try again later.')
      })

      it('should return server error message for 502 errors', () => {
        const error = new ApiError('Bad gateway', 502)

        expect(error.userMessage).toBe('Server error. Please try again later.')
      })

      it('should return original message for client errors (4xx)', () => {
        const error = new ApiError('Not found', 404)

        expect(error.userMessage).toBe('Not found')
      })

      it('should return original message for other status codes', () => {
        const error = new ApiError('Custom error message', 400)

        expect(error.userMessage).toBe('Custom error message')
      })
    })

    describe('instanceof checks', () => {
      it('should be instanceof Error', () => {
        const error = new ApiError('Test', 500)

        expect(error instanceof Error).toBe(true)
      })

      it('should be instanceof ApiError', () => {
        const error = new ApiError('Test', 500)

        expect(error instanceof ApiError).toBe(true)
      })
    })
  })

  describe('generateCard cost tracking', () => {
    it('should return cost_usd from response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          card: { text: 'Content' },
          cost_usd: 0.0012,
          usage: { input_tokens: 100, output_tokens: 50 },
        }),
      })

      const result = await generateCard(sampleConfig, '', [])

      expect(result.cost_usd).toBe(0.0012)
    })

    it('should return usage from response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          card: { text: 'Content' },
          cost_usd: 0.0012,
          usage: { input_tokens: 100, output_tokens: 50 },
        }),
      })

      const result = await generateCard(sampleConfig, '', [])

      expect(result.usage).toEqual({ input_tokens: 100, output_tokens: 50 })
    })

    it('should handle null cost gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          card: { text: 'Content' },
          cost_usd: null,
          usage: null,
        }),
      })

      const result = await generateCard(sampleConfig, '', [])

      expect(result.cost_usd).toBeNull()
      expect(result.usage).toBeNull()
    })
  })

  describe('Network Error Handling', () => {
    it('should throw ApiError with isNetworkError for fetch failures', async () => {
      mockFetch.mockRejectedValueOnce(new TypeError('Failed to fetch'))

      try {
        await generateCard(sampleConfig, '', [])
        expect.fail('Should have thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError)
        expect((error as ApiError).isNetworkError).toBe(true)
      }
    })

    it('should throw ApiError with isNetworkError for NetworkError', async () => {
      mockFetch.mockRejectedValueOnce(
        new TypeError('NetworkError when attempting to fetch')
      )

      try {
        await generateCard(sampleConfig, '', [])
        expect.fail('Should have thrown')
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError)
        expect((error as ApiError).isNetworkError).toBe(true)
      }
    })

    it('should preserve ApiError when already thrown', async () => {
      const originalError = new ApiError('Custom API error', 400)
      mockFetch.mockRejectedValueOnce(originalError)

      try {
        await onboardChat('test')
        expect.fail('Should have thrown')
      } catch (error) {
        expect(error).toBe(originalError)
      }
    })
  })
})
