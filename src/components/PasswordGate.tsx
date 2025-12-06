/**
 * PasswordGate - Protects routes with a password
 *
 * Two themes available:
 * - "dark": Moody, luxurious dark theme (for consumer page)
 * - "warm": Cream/gold warm theme (for advertiser page)
 */

import { useState, type ReactNode } from 'react'
import './PasswordGate.css'

const STORAGE_KEY = 'pw_authenticated'
const CORRECT_PASSWORD = 'reverie44'

interface PasswordGateProps {
  children: ReactNode
  theme: 'dark' | 'warm'
  title?: string
  subtitle?: string
}

export function PasswordGate({
  children,
  theme,
  title = 'Enter Password',
  subtitle = 'This content is password protected'
}: PasswordGateProps) {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return sessionStorage.getItem(STORAGE_KEY) === 'true'
  })
  const [password, setPassword] = useState('')
  const [error, setError] = useState(false)
  const [isShaking, setIsShaking] = useState(false)
  const [isLoading] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(false)

    if (password === CORRECT_PASSWORD) {
      sessionStorage.setItem(STORAGE_KEY, 'true')
      setIsAuthenticated(true)
    } else {
      setError(true)
      setIsShaking(true)
      setTimeout(() => setIsShaking(false), 500)
      setPassword('')
    }
  }

  if (isAuthenticated) {
    return <>{children}</>
  }

  return (
    <div className={`pw-gate pw-gate--${theme}`}>
      <div className="pw-gate__backdrop" />

      <div className={`pw-gate__card ${isShaking ? 'pw-gate__card--shake' : ''}`}>
        <div className="pw-gate__icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
        </div>

        <h1 className="pw-gate__title">{title}</h1>
        <p className="pw-gate__subtitle">{subtitle}</p>

        <form onSubmit={handleSubmit} className="pw-gate__form">
          <div className="pw-gate__input-wrapper">
            <input
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value)
                setError(false)
              }}
              placeholder="Password"
              className={`pw-gate__input ${error ? 'pw-gate__input--error' : ''}`}
              autoFocus
              disabled={isLoading}
            />
            {error && (
              <span className="pw-gate__error">Incorrect password</span>
            )}
          </div>

          <button type="submit" className="pw-gate__button" disabled={isLoading}>
            {isLoading ? 'Verifying...' : 'Enter'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default PasswordGate
