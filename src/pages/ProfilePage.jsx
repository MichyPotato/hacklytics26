import React, { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'

export default function ProfilePage() {
  const { user, updateLocations } = useAuth()
  const [homeLocation, setHomeLocation] = useState('')
  const [workLocation, setWorkLocation] = useState('')
  const [status, setStatus] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (user) {
      setHomeLocation(user.homeLocation || '')
      setWorkLocation(user.workLocation || '')
    }
  }, [user])

  const handleSubmit = async (event) => {
    event.preventDefault()
    setStatus('')
    setIsSaving(true)

    const result = await updateLocations({ homeLocation, workLocation })
    if (result.success) {
      setStatus('Locations updated.')
    } else {
      setStatus(result.message || 'Could not update locations.')
    }

    setIsSaving(false)
  }

  return (
    <div className="page-shell">
      <div className="card">
        <div className="card-header">
          <div>
            <h2>Your profile</h2>
            <p className="muted">Update locations used in Gemini context.</p>
          </div>
          <div className="pill light">{user?.email}</div>
        </div>
        <form onSubmit={handleSubmit} className="form-stack">
          <label className="form-field">
            Home location
            <input
              type="text"
              placeholder="123 Maple St, Atlanta, GA"
              value={homeLocation}
              onChange={(event) => setHomeLocation(event.target.value)}
            />
          </label>
          <label className="form-field">
            Work or school location
            <input
              type="text"
              placeholder="Campus address or office"
              value={workLocation}
              onChange={(event) => setWorkLocation(event.target.value)}
            />
          </label>
          {status && <div className="form-status">{status}</div>}
          <button type="submit" className="primary" disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save locations'}
          </button>
        </form>
      </div>
    </div>
  )
}
