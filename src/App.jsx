import React from 'react'
import { BrowserRouter as Router, Routes, Route, NavLink } from 'react-router-dom'
import ButtonTab from './components/ButtonTab'
import ProtectedRoute from './components/ProtectedRoute'
import { useAuth } from './context/AuthContext'
import LoginPage from './pages/LoginPage'
import SignupPage from './pages/SignupPage'
import ProfilePage from './pages/ProfilePage'
import './App.css'

export default function App() {
  const { token, user, logout } = useAuth()

  return (
    <Router>
      <div className="app">
        <header className="app-header">
          <div className="brand">Hacklytics</div>
          <div className="header-meta">
            {user?.email && <span className="pill">{user.email}</span>}
            {token && (
              <button className="nav-link ghost" onClick={logout} type="button">
                Log out
              </button>
            )}
          </div>
        </header>
        <nav className="tab-bar">
          <NavLink to="/" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>Panic Button</NavLink>
          {token ? (
            <NavLink to="/profile" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>Profile</NavLink>
          ) : (
            <>
              <NavLink to="/login" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>Log in</NavLink>
              <NavLink to="/signup" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>Sign up</NavLink>
            </>
          )}
        </nav>

        <main className="content">
          <Routes>
            <Route path="/" element={<ButtonTab />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <ProfilePage />
                </ProtectedRoute>
              }
            />
          </Routes>
        </main>
      </div>
    </Router>
  )
}
