import React, { useState } from 'react'
import HomeScreen from './components/HomeScreen'
import ConversationUploader from './components/ConversationUploader'
import ButtonTab from './components/ButtonTab'
import './App.css'

export default function App() {
  const [tab, setTab] = useState('home')

  return (
    <div className="app">
      <header className="app-header">Hacklytics</header>
      <nav className="tab-bar">
        <button onClick={() => setTab('home')} className={tab === 'home' ? 'active' : ''}>Home</button>
        <button onClick={() => setTab('uploader')} className={tab === 'uploader' ? 'active' : ''}>Conversation Uploader</button>
        <button onClick={() => setTab('button')} className={tab === 'button' ? 'active' : ''}>Button</button>
      </nav>

      <main className="content">
        {tab === 'home' && <HomeScreen />}
        {tab === 'uploader' && <ConversationUploader />}
        {tab === 'button' && <ButtonTab />}
      </main>
    </div>
  )
}
