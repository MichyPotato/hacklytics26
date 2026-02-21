import React, { useState } from 'react'
import './ConversationUploader.css'

export default function ConversationUploader() {
  const [stage, setStage] = useState('login') // 'login' | 'select' | 'upload' | 'analyzing'
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [sessionId, setSessionId] = useState(null)
  const [conversations, setConversations] = useState([])
  const [selectedConversation, setSelectedConversation] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [progress, setProgress] = useState(0)
  const [analysisComplete, setAnalysisComplete] = useState(false)
  const [analysisResult, setAnalysisResult] = useState(null)
  const [conversationId, setConversationId] = useState(null)

  const API_BASE_URL = 'http://localhost:5000/api'

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const response = await fetch(`${API_BASE_URL}/instagram/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      })

      const data = await response.json()

      if (data.success) {
        setSessionId(data.sessionId)
        // Fetch conversations after successful login
        await fetchConversations(username, data.sessionId)
        setStage('select')
      } else {
        setError(data.message || 'Login failed')
      }
    } catch (err) {
      setError('Connection error: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const fetchConversations = async (user, session) => {
    try {
      const response = await fetch(`${API_BASE_URL}/instagram/conversations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: user, sessionId: session })
      })

      const data = await response.json()

      if (data.success) {
        setConversations(data.conversations || [])
      } else {
        setError('Failed to fetch conversations: ' + data.message)
      }
    } catch (err) {
      setError('Error fetching conversations: ' + err.message)
    }
  }

  const handleSelectConversation = async (conversation) => {
    setSelectedConversation(conversation)
    setStage('upload')
  }

  const handleUploadConversation = async () => {
    if (!selectedConversation) {
      setError('Please select a conversation')
      return
    }

    setLoading(true)
    setError('')
    setProgress(0)

    try {
      // Get the username from the selected conversation
      const partnerUsername = selectedConversation.participants[0]?.username

      if (!partnerUsername) {
        setError('Could not determine conversation partner')
        setLoading(false)
        return
      }

      const response = await fetch(`${API_BASE_URL}/analyze/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username,
          conversationWith: partnerUsername,
          sessionId: sessionId
        })
      })

      const data = await response.json()

      if (data.success) {
        setConversationId(data.conversationId)
        setStage('analyzing')
        setProgress(30)

        // Start analysis
        await analyzeConversation(data.conversationId)
      } else {
        setError(data.message || 'Upload failed')
      }
    } catch (err) {
      setError('Upload error: ' + err.message)
    } finally {
      setLoading(false)
    }
  }

  const analyzeConversation = async (convId) => {
    try {
      setProgress(50)

      // Call analysis endpoint
      const response = await fetch(`${API_BASE_URL}/analyze/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId: convId })
      })

      const data = await response.json()

      if (data.success) {
        setProgress(70)

        // Poll for results
        let attempts = 0
        const maxAttempts = 10
        const pollInterval = setInterval(async () => {
          attempts++

          try {
            const resultResponse = await fetch(`${API_BASE_URL}/analyze/${convId}`)
            const resultData = await resultResponse.json()

            if (resultData.success && resultData.conversation.analysis) {
              setProgress(100)
              setAnalysisResult(resultData.conversation)
              setAnalysisComplete(true)
              clearInterval(pollInterval)
            } else if (attempts >= maxAttempts) {
              clearInterval(pollInterval)
              setProgress(100)
              setAnalysisResult(resultData.conversation)
              setAnalysisComplete(true)
            }
          } catch (err) {
            console.error('Error polling results:', err)
            if (attempts >= maxAttempts) {
              clearInterval(pollInterval)
            }
          }
        }, 1000)
      } else {
        setError(data.message || 'Analysis failed')
      }
    } catch (err) {
      setError('Analysis error: ' + err.message)
    }
  }

  const handleReset = () => {
    setStage('login')
    setUsername('')
    setPassword('')
    setSessionId(null)
    setConversations([])
    setSelectedConversation(null)
    setProgress(0)
    setAnalysisComplete(false)
    setAnalysisResult(null)
    setError('')
  }

  return (
    <div className="uploader-container">
      <h2>Conversation Analyzer</h2>

      {error && <div className="error-message">{error}</div>}

      {/* Login Stage */}
      {stage === 'login' && (
        <div className="stage login-stage">
          <h3>Instagram Login</h3>
          <p>Log in to your Instagram account to access your conversations</p>
          <form onSubmit={handleLogin}>
            <input
              type="text"
              placeholder="Instagram Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              disabled={loading}
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
            />
            <button type="submit" disabled={loading}>
              {loading ? 'Logging in...' : 'Login to Instagram'}
            </button>
          </form>
          <p className="info">Your credentials are only used to fetch conversations and are not stored.</p>
        </div>
      )}

      {/* Select Conversation Stage */}
      {stage === 'select' && (
        <div className="stage select-stage">
          <h3>Select Conversation</h3>
          <p>Choose a conversation to analyze</p>
          <div className="conversations-list">
            {conversations.length > 0 ? (
              conversations.map((conv, idx) => (
                <div
                  key={idx}
                  className={`conversation-item ${selectedConversation === conv ? 'selected' : ''}`}
                  onClick={() => handleSelectConversation(conv)}
                >
                  <div className="conversation-title">{conv.title || conv.participants.map(p => p.username).join(', ')}</div>
                  <div className="conversation-info">
                    {conv.participants.length > 0 && <span>{conv.participants[0].username}</span>}
                    <span className="message-count">{conv.messages_count || 0} messages</span>
                  </div>
                </div>
              ))
            ) : (
              <p>No conversations found</p>
            )}
          </div>
          <button onClick={handleReset} className="back-button">Back to Login</button>
        </div>
      )}

      {/* Upload Stage */}
      {stage === 'upload' && (
        <div className="stage upload-stage">
          <h3>Upload Conversation</h3>
          {selectedConversation && (
            <div className="selected-info">
              <p>
                Conversation with: <strong>{selectedConversation.participants[0]?.username}</strong>
              </p>
              <p>Messages: {selectedConversation.messages_count}</p>
            </div>
          )}
          <button onClick={handleUploadConversation} disabled={loading} className="upload-button">
            {loading ? 'Uploading...' : 'Upload & Analyze'}
          </button>
          <button onClick={() => setStage('select')} className="back-button">
            Back to Selection
          </button>
        </div>
      )}

      {/* Analyzing Stage */}
      {stage === 'analyzing' && (
        <div className="stage analyzing-stage">
          <h3>Analyzing Conversation</h3>
          <p>Processing your conversation with our ML algorithm...</p>

          <div className="progress-container">
            <div className="progress-bar-wrapper">
              <div className="progress-bar" style={{ width: `${progress}%` }}></div>
            </div>
            <div className="progress-text">{progress}%</div>
          </div>

          {analysisComplete && analysisResult && (
            <div className="analysis-results">
              <h4>Analysis Complete</h4>
              <div className="results-details">
                <p><strong>Conversation ID:</strong> {analysisResult.id}</p>
                <p><strong>With:</strong> {analysisResult.conversationWith}</p>
                <p><strong>Message Count:</strong> {analysisResult.messageCount}</p>
                <p><strong>Analyzed At:</strong> {new Date(analysisResult.fetchedAt).toLocaleString()}</p>

                {analysisResult.analysis && (
                  <div className="analysis-data">
                    <h5>Analysis Results (Placeholder)</h5>
                    <p><strong>Status:</strong> {analysisResult.analysis.status}</p>
                    <p><strong>Sentiment:</strong> {analysisResult.analysis.sentiment}</p>
                    <p><strong>Summary:</strong> {analysisResult.analysis.summary}</p>
                    <details>
                      <summary>View Raw Data</summary>
                      <pre>{JSON.stringify(analysisResult.messages, null, 2)}</pre>
                    </details>
                  </div>
                )}
              </div>

              <button onClick={handleReset} className="new-analysis-button">
                Analyze Another Conversation
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
