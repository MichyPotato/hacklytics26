import React from 'react'
import { BrowserRouter as Router, Routes, Route, NavLink } from 'react-router-dom'
import HomeScreen from './components/HomeScreen'
import ConversationUploader from './components/ConversationUploader'
import ButtonTab from './components/ButtonTab'
import './App.css'

export default function App() {
  return (
    <Router>
      <div className="app">
        <header className="app-header">Hacklytics</header>
        <nav className="tab-bar">
          <NavLink to="/" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>Home</NavLink>
          <NavLink to="/convo" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>Conversation Uploader</NavLink>
          <NavLink to="/panic" className={({ isActive }) => isActive ? 'nav-link active' : 'nav-link'}>Panic Button</NavLink>
        </nav>

        <main className="content">
          <Routes>
            <Route path="/" element={<HomeScreen />} />
            <Route path="/convo" element={<ConversationUploader />} />
            <Route path="/panic" element={<ButtonTab />} />
          </Routes>
        </main>
      </div>
    </Router>
  )
}
