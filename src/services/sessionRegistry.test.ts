/**
 * Tests for session registry with cost tracking.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  saveSession,
  getSession,
  addSessionCost,
  getSessionCost,
} from './sessionRegistry'
import type { CanvasState } from './persistence'

// Mock localStorage
const mockStorage: Record<string, string> = {}
const localStorageMock = {
  getItem: vi.fn((key: string) => mockStorage[key] ?? null),
  setItem: vi.fn((key: string, value: string) => {
    mockStorage[key] = value
  }),
  removeItem: vi.fn((key: string) => {
    delete mockStorage[key]
  }),
  clear: vi.fn(() => {
    Object.keys(mockStorage).forEach((key) => delete mockStorage[key])
  }),
}
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock })

describe('Session Cost Tracking', () => {
  const mockState: CanvasState = {
    cards: [],
    savedCards: [],
    userComposition: '',
  }

  beforeEach(() => {
    localStorageMock.clear()
    vi.clearAllMocks()
  })

  describe('addSessionCost', () => {
    it('should add cost to a session', () => {
      const session = saveSession('test-config', mockState, 'Test Session')

      addSessionCost(session.id, 0.0012)

      const updated = getSession(session.id)
      expect(updated?.totalCostUsd).toBe(0.0012)
    })

    it('should accumulate costs across multiple calls', () => {
      const session = saveSession('test-config', mockState, 'Test Session')

      addSessionCost(session.id, 0.001)
      addSessionCost(session.id, 0.002)
      addSessionCost(session.id, 0.0005)

      const updated = getSession(session.id)
      expect(updated?.totalCostUsd).toBeCloseTo(0.0035, 6)
    })

    it('should increment generation count', () => {
      const session = saveSession('test-config', mockState, 'Test Session')

      addSessionCost(session.id, 0.001)
      addSessionCost(session.id, 0.002)

      const updated = getSession(session.id)
      expect(updated?.generationCount).toBe(2)
    })

    it('should handle non-existent session gracefully', () => {
      // Should not throw
      expect(() => addSessionCost('non-existent-id', 0.001)).not.toThrow()
    })

    it('should handle null cost (no-op)', () => {
      const session = saveSession('test-config', mockState, 'Test Session')

      addSessionCost(session.id, null)

      const updated = getSession(session.id)
      expect(updated?.totalCostUsd).toBe(0)
      expect(updated?.generationCount).toBe(0)
    })
  })

  describe('getSessionCost', () => {
    it('should return cost summary for session', () => {
      const session = saveSession('test-config', mockState, 'Test Session')
      addSessionCost(session.id, 0.001)
      addSessionCost(session.id, 0.002)

      const cost = getSessionCost(session.id)

      expect(cost).toEqual({
        totalCostUsd: expect.closeTo(0.003, 6),
        generationCount: 2,
      })
    })

    it('should return zero values for new session', () => {
      const session = saveSession('test-config', mockState, 'Test Session')

      const cost = getSessionCost(session.id)

      expect(cost).toEqual({
        totalCostUsd: 0,
        generationCount: 0,
      })
    })

    it('should return null for non-existent session', () => {
      const cost = getSessionCost('non-existent-id')

      expect(cost).toBeNull()
    })
  })

  describe('SessionSnapshot cost fields', () => {
    it('should initialize totalCostUsd to 0 for new sessions', () => {
      const session = saveSession('test-config', mockState, 'Test Session')

      expect(session.totalCostUsd).toBe(0)
    })

    it('should initialize generationCount to 0 for new sessions', () => {
      const session = saveSession('test-config', mockState, 'Test Session')

      expect(session.generationCount).toBe(0)
    })

    it('should preserve cost when updating session state', () => {
      const session = saveSession('test-config', mockState, 'Test Session')
      addSessionCost(session.id, 0.005)

      // Update session with new state
      const newState: CanvasState = {
        ...mockState,
        userComposition: 'Updated content',
      }
      saveSession('test-config', newState, undefined, session.id)

      const updated = getSession(session.id)
      expect(updated?.totalCostUsd).toBe(0.005)
      expect(updated?.generationCount).toBe(1)
    })
  })
})
