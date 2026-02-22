import React, { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setIsSubmitting(true)

    const result = await login({ email, password })
    if (result.success) {
      const redirectTo = location.state?.from?.pathname || '/profile'
      navigate(redirectTo, { replace: true })
    } else {
      setError(result.message)
    }

    setIsSubmitting(false)
  }

  return (
    <div className="page-shell">
      <div className="card">
        <h2>Welcome back</h2>
        <p className="muted">Log in to save and update your locations.</p>
        <form onSubmit={handleSubmit} className="form-stack">
          <label className="form-field">
            Email
            <input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>
          <label className="form-field">
            Password
            <input
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>
          {error && <div className="form-error">{error}</div>}
          <button type="submit" className="primary" disabled={isSubmitting}>
            {isSubmitting ? 'Logging in...' : 'Log in'}
          </button>
        </form>
        <div className="form-footer">
          New here? <Link to="/signup">Create an account</Link>
        </div>
      </div>
    </div>
  )
}
