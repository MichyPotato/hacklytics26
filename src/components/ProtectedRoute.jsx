import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function ProtectedRoute({ children }) {
  const { token, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return (
      <div className="page-shell">
        <div className="card">Loading account...</div>
      </div>
    )
  }

  if (!token) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  return children
}
