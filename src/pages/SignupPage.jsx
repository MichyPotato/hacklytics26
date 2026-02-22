import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function SignupPage() {
  const { signup } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    setIsSubmitting(true)

    const result = await signup({ email, password })
    if (result.success) {
      navigate('/profile', { replace: true })
    } else {
      setError(result.message)
    }

    setIsSubmitting(false)
  }

  return (
    <div className="page-shell">
      <div className="card">
        <h2>Create your account</h2>
        <p className="muted">Save home and work/school locations for faster context.</p>
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
              placeholder="Create a secure password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>
          {error && <div className="form-error">{error}</div>}
          <button type="submit" className="primary" disabled={isSubmitting}>
            {isSubmitting ? 'Creating account...' : 'Sign up'}
          </button>
        </form>
        <div className="form-footer">
          Already have an account? <Link to="/login">Log in</Link>
        </div>
      </div>
    </div>
  )
}
