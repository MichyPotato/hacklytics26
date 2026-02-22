import React from 'react'
import { BrowserRouter as Router, Routes, Route, NavLink } from 'react-router-dom'
import ButtonTab from './components/ButtonTab'
import './App.css'

export default function App() {
  return (
    <Router>
      <div className="app">
        <header className="app-header">Hacklytics</header>
        <nav className="tab-bar">
          <NavLink to="/" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>Panic Button</NavLink>
        </nav>

        <main className="content">
          <Routes>
            <Route path="/" element={<ButtonTab />} />
          </Routes>
        </main>
      </div>
    </Router>
  )
}
