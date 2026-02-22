import React, { useEffect, useState, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5000'

export default function FakeCallPage() {
  const { user, token } = useAuth()
  const navigate = useNavigate()
  const [isCallActive, setIsCallActive] = useState(false)
  const [callDuration, setCallDuration] = useState(0)
  const [audioPlaying, setAudioPlaying] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [userTranscript, setUserTranscript] = useState('')
  const [conversationHistory, setConversationHistory] = useState([])
  const audioRef = useRef(null)
  const intervalRef = useRef(null)
  const recognitionRef = useRef(null)
  const mediaRecorderRef = useRef(null)
  const audioChunksRef = useRef([])
  const streamRef = useRef(null)

  useEffect(() => {
    if (isCallActive) {
      intervalRef.current = setInterval(() => {
        setCallDuration((prev) => prev + 1)
      }, 1000)
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [isCallActive])

  // Setup speech recognition
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
      recognitionRef.current = new SpeechRecognition()
      recognitionRef.current.continuous = false
      recognitionRef.current.interimResults = false
      recognitionRef.current.lang = getRecognitionLanguage(user?.preferredLanguage || 'en')

      recognitionRef.current.onresult = (event) => {
        const transcript = event.results[0][0].transcript
        console.log('User said:', transcript)
        setUserTranscript(transcript)
        handleUserSpeech(transcript)
      }

      recognitionRef.current.onerror = (event) => {
        console.error('Speech recognition error:', event.error)
        setIsListening(false)
      }

      recognitionRef.current.onend = () => {
        setIsListening(false)
      }
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop()
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
      }
    }
  }, [user?.preferredLanguage])

  const getRecognitionLanguage = (langCode) => {
    const langMap = {
      en: 'en-US',
      es: 'es-ES',
      fr: 'fr-FR',
      de: 'de-DE',
      it: 'it-IT',
      pt: 'pt-PT',
      zh: 'zh-CN',
      ja: 'ja-JP',
      ko: 'ko-KR',
      ar: 'ar-SA',
      hi: 'hi-IN',
      ru: 'ru-RU'
    }
    return langMap[langCode] || 'en-US'
  }

  const startListening = () => {
    if (recognitionRef.current && !isListening) {
      try {
        setUserTranscript('')
        setIsListening(true)
        recognitionRef.current.start()
      } catch (error) {
        console.error('Error starting speech recognition:', error)
        setIsListening(false)
      }
    }
  }

  const handleUserSpeech = async (transcript) => {
    if (!transcript || isGenerating) return

    setIsGenerating(true)
    setIsListening(false)

    try {
      const language = user?.preferredLanguage || 'en'
      const response = await fetch(`${API_BASE}/api/fake-call/respond`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          language,
          userMessage: transcript,
          conversationHistory
        })
      })

      if (!response.ok) {
        throw new Error('Failed to generate response')
      }

      const contentType = response.headers.get('content-type')
      if (!contentType || !contentType.includes('audio')) {
        throw new Error('Invalid response format')
      }

      const audioBlob = await response.blob()
      const audioUrl = URL.createObjectURL(audioBlob)

      // Add to conversation history
      setConversationHistory(prev => [
        ...prev,
        { role: 'user', content: transcript },
        { role: 'assistant', content: 'AI response' }
      ])

      if (audioRef.current) {
        audioRef.current.src = audioUrl
        audioRef.current.play()
        setAudioPlaying(true)
      }
    } catch (error) {
      console.error('Error generating response:', error)
      // Continue listening even if there's an error
      setTimeout(() => startListening(), 1000)
    } finally {
      setIsGenerating(false)
    }
  }

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  const startCall = async () => {
    setIsCallActive(true)
    setCallDuration(0)
    setIsGenerating(true)
    setConversationHistory([]) // Reset conversation

    try {
      const language = user?.preferredLanguage || 'en'
      const response = await fetch(`${API_BASE}/api/fake-call/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ language })
      })

      if (!response.ok) {
        // Try to parse error message from JSON response
        const contentType = response.headers.get('content-type')
        if (contentType && contentType.includes('application/json')) {
          const errorData = await response.json()
          throw new Error(errorData.message || 'Failed to generate call audio')
        }
        throw new Error(`Server error: ${response.status} ${response.statusText}`)
      }

      // Check if response is audio
      const contentType = response.headers.get('content-type')
      if (!contentType || !contentType.includes('audio')) {
        throw new Error('Invalid response format from server')
      }

      const audioBlob = await response.blob()
      const audioUrl = URL.createObjectURL(audioBlob)
      
      // Add initial greeting to conversation history
      setConversationHistory([{ role: 'assistant', content: 'Initial greeting' }])
      
      if (audioRef.current) {
        audioRef.current.src = audioUrl
        audioRef.current.play()
        setAudioPlaying(true)
      }
    } catch (error) {
      console.error('Error generating call:', error)
      const errorMessage = error.message || 'Failed to generate fake call. Please try again.'
      
      // Show helpful error message
      if (errorMessage.includes('API key not configured')) {
        alert('⚠️ Eleven Labs API Key Missing\n\nThe fake call feature requires an Eleven Labs API key.\n\nPlease add ELEVENLABS_API_KEY to backend/.env file.\n\nGet your key from: https://elevenlabs.io/')
      } else if (errorMessage.includes('Unauthorized')) {
        alert('Please log in to use the fake call feature.')
      } else {
        alert(`Failed to generate fake call:\n${errorMessage}`)
      }
      
      endCall()
    } finally {
      setIsGenerating(false)
    }
  }

  const endCall = () => {
    setIsCallActive(false)
    setCallDuration(0)
    setAudioPlaying(false)
    setIsListening(false)
    setUserTranscript('')
    setConversationHistory([])
    
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop()
      } catch (e) {
        // Ignore errors when stopping
      }
    }
    
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
    }
    
    navigate('/')
  }

  const handleAudioEnd = () => {
    setAudioPlaying(false)
    
    // After AI finishes speaking, start listening for user input
    if (isCallActive && !isGenerating) {
      setTimeout(() => {
        startListening()
      }, 500) // Small delay before starting to listen
    }
  }

  return (
    <div className="fake-call-page">
      <div className="call-screen">
        <div className="call-header">
          <div className="call-status">
            {isCallActive ? 'Call in Progress' : 'Ready to Start'}
          </div>
          <div className="caller-info">
            <div className="caller-avatar">📞</div>
            <div className="caller-name">Emergency Contact</div>
            <div className="caller-number">+1 (555) 123-4567</div>
          </div>
        </div>

        <div className="call-body">
          {isCallActive && (
            <>
              <div className="call-timer">{formatDuration(callDuration)}</div>
              {isGenerating && (
                <div className="call-status-message">Generating response...</div>
              )}
              {audioPlaying && (
                <div className="call-status-message">
                  <div className="audio-wave">🔊</div>
                  <div>Speaking...</div>
                </div>
              )}
              {isListening && (
                <div className="call-status-message listening">
                  <div className="listening-icon">🎤</div>
                  <div>Listening...</div>
                </div>
              )}
              {userTranscript && !isListening && !isGenerating && (
                <div className="user-transcript">
                  <strong>You:</strong> {userTranscript}
                </div>
              )}
            </>
          )}
          {!isCallActive && (
            <div className="call-instructions">
              <p>Start an interactive fake call where you can actually speak and get responses.</p>
              <p>The AI will listen to you and respond naturally in your preferred language: <strong>{getLanguageName(user?.preferredLanguage || 'en')}</strong></p>
              {!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) && (
                <p style={{color: '#e74c3c', marginTop: '10px'}}>⚠️ Speech recognition not supported in this browser. Use Chrome for the best experience.</p>
              )}
            </div>
          )}
        </div>

        <div className="call-actions">
          {!isCallActive ? (
            <button className="call-button start" onClick={startCall}>
              <span className="call-icon">📞</span>
              <span>Start Call</span>
            </button>
          ) : (
            <button className="call-button end" onClick={endCall}>
              <span className="call-icon">📵</span>
              <span>End Call</span>
            </button>
          )}
        </div>

        <audio
          ref={audioRef}
          onEnded={handleAudioEnd}
          style={{ display: 'none' }}
        />
      </div>

      <style jsx>{`
        .fake-call-page {
          min-height: 100vh;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }

        .call-screen {
          background: white;
          border-radius: 30px;
          max-width: 400px;
          width: 100%;
          padding: 40px 30px;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        }

        .call-header {
          text-align: center;
          margin-bottom: 40px;
        }

        .call-status {
          font-size: 14px;
          color: #666;
          margin-bottom: 30px;
          text-transform: uppercase;
          letter-spacing: 1px;
        }

        .caller-avatar {
          font-size: 80px;
          margin-bottom: 20px;
        }

        .caller-name {
          font-size: 28px;
          font-weight: 600;
          color: #333;
          margin-bottom: 8px;
        }

        .caller-number {
          font-size: 16px;
          color: #888;
        }

        .call-body {
          text-align: center;
          margin: 40px 0;
          min-height: 120px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
        }

        .call-timer {
          font-size: 48px;
          font-weight: 300;
          color: #333;
          margin-bottom: 20px;
        }

        .call-status-message {
          font-size: 16px;
          color: #666;
          margin-top: 10px;
        }

        .audio-wave {
          font-size: 24px;
          animation: pulse 1.5s ease-in-out infinite;
        }

        .listening-icon {
          font-size: 24px;
          animation: pulse 1.5s ease-in-out infinite;
        }

        .call-status-message.listening {
          color: #3498db;
          font-weight: 500;
        }

        .user-transcript {
          margin-top: 15px;
          padding: 12px 20px;
          background: #e3f2fd;
          border-radius: 12px;
          font-size: 14px;
          color: #1976d2;
          max-width: 300px;
        }

        .user-transcript strong {
          font-weight: 600;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.1); }
        }

        .call-instructions {
          padding: 20px;
          background: #f5f5f5;
          border-radius: 15px;
          font-size: 14px;
          line-height: 1.6;
          color: #666;
        }

        .call-instructions p {
          margin: 10px 0;
        }

        .call-instructions strong {
          color: #333;
        }

        .call-actions {
          display: flex;
          justify-content: center;
          margin-top: 40px;
        }

        .call-button {
          border: none;
          border-radius: 50px;
          padding: 20px 40px;
          font-size: 18px;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 12px;
          transition: all 0.3s ease;
        }

        .call-button.start {
          background: #4ade80;
          color: white;
        }

        .call-button.start:hover {
          background: #22c55e;
          transform: scale(1.05);
        }

        .call-button.end {
          background: #ef4444;
          color: white;
        }

        .call-button.end:hover {
          background: #dc2626;
          transform: scale(1.05);
        }

        .call-icon {
          font-size: 24px;
        }
      `}</style>
    </div>
  )
}

function getLanguageName(code) {
  const languages = {
    en: 'English',
    es: 'Spanish',
    fr: 'French',
    de: 'German',
    it: 'Italian',
    pt: 'Portuguese',
    zh: 'Chinese',
    ja: 'Japanese',
    ko: 'Korean',
    ar: 'Arabic',
    hi: 'Hindi',
    ru: 'Russian'
  }
  return languages[code] || 'English'
}
