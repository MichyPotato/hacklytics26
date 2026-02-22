import React, { useState, useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import ActionButtons from './ActionButtons'
import { useAuth } from '../context/AuthContext'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5000'
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search?format=json&limit=1&q='

const parseLatLng = (value = '') => {
  const cleaned = value.replace(/[()]/g, '').trim()
  const parts = cleaned.split(/[\s,]+/).filter(Boolean)
  if (parts.length < 2) return null
  const lat = Number(parts[0])
  const lng = Number(parts[1])
  if (Number.isNaN(lat) || Number.isNaN(lng)) return null
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null
  return { lat, lng }
}

const geocodeLocation = async (value = '') => {
  const trimmed = value.trim()
  if (!trimmed) return null
  const direct = parseLatLng(trimmed)
  if (direct) return direct

  const response = await fetch(`${NOMINATIM_URL}${encodeURIComponent(trimmed)}`, {
    headers: {
      'Accept-Language': 'en'
    }
  })
  const results = await response.json()
  if (!Array.isArray(results) || results.length === 0) return null
  const candidate = results[0]
  const lat = Number(candidate.lat)
  const lng = Number(candidate.lon)
  if (Number.isNaN(lat) || Number.isNaN(lng)) return null
  return { lat, lng }
}

export default function ButtonTab() {
  const { token, user } = useAuth()
  const [location, setLocation] = useState(null)
  const [locationError, setLocationError] = useState(null)
  const [isRecording, setIsRecording] = useState(false)
  const [recordedAudioURL, setRecordedAudioURL] = useState(null)
  const [transcript, setTranscript] = useState('')
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [analysisResult, setAnalysisResult] = useState(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const mediaRecorderRef = useRef(null)
  const audioContextRef = useRef(null)
  const streamRef = useRef(null)
  const mapRef = useRef(null)
  const mapContainerRef = useRef(null)
  const recognitionRef = useRef(null)
  const transcriptRef = useRef('')

  // Request user location on component mount
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords
          setLocation({ latitude, longitude })
        },
        (error) => {
          setLocationError(error.message)
          console.error('Location error:', error)
        }
      )
    } else {
      setLocationError('Geolocation is not supported by this browser.')
    }
  }, [])

  // Initialize map when location is available
  useEffect(() => {
    if (!location || !mapContainerRef.current) return

    // Remove existing map if it exists
    if (mapRef.current) {
      mapRef.current.remove()
    }

    // Create map centered at user location
    const map = L.map(mapContainerRef.current).setView(
      [location.latitude, location.longitude],
      15
    )

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map)

    // Add marker for user location
    L.circleMarker([location.latitude, location.longitude], {
      radius: 9,
      color: '#2563eb',
      fillColor: '#60a5fa',
      fillOpacity: 0.9,
      weight: 2
    })
      .addTo(map)
      .bindPopup('Your Location')
      .openPopup()

    let isActive = true

    const addSavedMarkers = async () => {
      if (!token || !user || !isActive) return

      try {
        const homeCoords = user.homeLocation ? await geocodeLocation(user.homeLocation) : null
        const workCoords = user.workLocation ? await geocodeLocation(user.workLocation) : null

        if (!isActive) return

        if (homeCoords) {
          L.marker([homeCoords.lat, homeCoords.lng])
            .addTo(map)
            .bindPopup('Home Location')
        }

        if (workCoords) {
          L.marker([workCoords.lat, workCoords.lng])
            .addTo(map)
            .bindPopup('Work/School Location')
        }
      } catch (error) {
        console.error('Failed to geocode saved locations:', error)
      }
    }

    addSavedMarkers()

    mapRef.current = map

    // Cleanup function
    return () => {
      isActive = false
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
    }
  }, [location, token, user])

  // Handle panic button press - start/stop recording and transcription
  const handlePanicPress = async () => {
    if (!isRecording) {
      // Start recording and transcription
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        streamRef.current = stream

        const mediaRecorder = new MediaRecorder(stream)
        mediaRecorderRef.current = mediaRecorder
        const chunks = []

        mediaRecorder.ondataavailable = (e) => {
          chunks.push(e.data)
        }

        mediaRecorder.onstop = async () => {
          console.log('Recording stopped')
          const blob = new Blob(chunks, { type: 'audio/webm' })
          const url = URL.createObjectURL(blob)
          setRecordedAudioURL(url)
          stream.getTracks().forEach(track => track.stop())
          
          // Give speech recognition time to finish
          setTimeout(() => {
            console.log('Current transcript state:', transcriptRef.current)
            // Send transcript to backend for Gemini analysis
            if (transcriptRef.current && transcriptRef.current.trim()) {
              console.log('Calling analyzeTranscript with:', transcriptRef.current)
              analyzeTranscript(transcriptRef.current)
            } else {
              console.log('Transcript is empty, not analyzing')
            }
          }, 500)
        }

        mediaRecorder.start()
        setIsRecording(true)
        setTranscript('')
        transcriptRef.current = ''
        setAnalysisResult(null)
        
        // Start transcription
        startTranscription()
      } catch (error) {
        console.error('Error accessing microphone:', error)
        alert('Could not access microphone. Please check permissions.')
      }
    } else {
      // Stop recording and transcription
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.stop()
        setIsRecording(false)
      }
      if (recognitionRef.current) {
        recognitionRef.current.stop()
        setIsTranscribing(false)
      }
    }
  }

  // Initialize and start Web Speech API transcription
  const startTranscription = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    
    if (!SpeechRecognition) {
      console.error('Speech Recognition API not supported in this browser')
      alert('Speech Recognition not supported. Please use Chrome or Edge.')
      return
    }

    const recognition = new SpeechRecognition()
    recognitionRef.current = recognition

    recognition.continuous = true
    recognition.interimResults = true
    recognition.language = 'en-US'

    let fullTranscript = ''

    recognition.onstart = () => {
      setIsTranscribing(true)
    }

    recognition.onresult = (event) => {
      let interimTranscript = ''
      
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript
        
        if (event.results[i].isFinal) {
          fullTranscript += transcript + ' '
        } else {
          interimTranscript += transcript
        }
      }

      const currentTranscript = fullTranscript + interimTranscript
      setTranscript(currentTranscript)
      transcriptRef.current = currentTranscript
    }

    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error)
    }

    recognition.onend = () => {
      setIsTranscribing(false)
      // Update the final transcript
      fullTranscript = fullTranscript.trim()
      setTranscript(fullTranscript)
      transcriptRef.current = fullTranscript
    }

    recognition.start()
  }

  // Send transcript to backend for Gemini analysis
  const analyzeTranscript = async (text) => {
    if (!text.trim()) return

    setIsAnalyzing(true)
    try {
      console.log('Sending transcript to backend:', text)
      const response = await fetch(`${API_BASE}/api/analyze-transcript`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          transcript: text,
          location: location,
        }),
      })

      console.log('Response status:', response.status)
      const data = await response.json()
      console.log('Response data:', data)
      
      if (data.success) {
        console.log('Analysis successful, setting result')
        setAnalysisResult(data.analysis)
      } else {
        console.error('Analysis failed:', data.message)
        alert('Analysis failed: ' + data.message)
      }
    } catch (error) {
      console.error('Error analyzing transcript:', error)
      alert('Error analyzing transcript: ' + error.message)
    } finally {
      setIsAnalyzing(false)
    }
  }

  return (
    <div style={{ padding: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', overflow: 'auto' }}>
      <h2>Panic Button</h2>

      {/* Location Display */}
      <div style={{ marginBottom: 20, textAlign: 'center', maxWidth: 400 }}>
        {locationError ? (
          <p style={{ color: '#d32f2f' }}>
            Location Error: {locationError}
          </p>
        ) : location ? (
          <div>
            <p style={{ margin: 0, color: '#666' }}>
              <strong>Your Location:</strong>
            </p>
            <p style={{ margin: '5px 0', fontSize: 14 }}>
              Latitude: {location.latitude.toFixed(4)}°
            </p>
            <p style={{ margin: '5px 0', fontSize: 14 }}>
              Longitude: {location.longitude.toFixed(4)}°
            </p>
          </div>
        ) : (
          <p>Requesting location...</p>
        )}
      </div>

      {/* Panic Button */}
      <button
        onClick={handlePanicPress}
        style={{
          width: 120,
          height: 120,
          minWidth: 120,
          minHeight: 120,
          maxWidth: 120,
          maxHeight: 120,
          borderRadius: '50%',
          border: 'none',
          backgroundColor: isRecording ? '#ff6b6b' : '#dc2626',
          color: 'white',
          fontSize: 18,
          fontWeight: 'bold',
          cursor: 'pointer',
          boxShadow: '0 4px 12px rgba(220, 38, 38, 0.4)',
          transition: 'all 0.2s',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          marginBottom: 20,
        }}
        onMouseDown={(e) => {
          e.currentTarget.style.transform = 'scale(0.95)'
        }}
        onMouseUp={(e) => {
          e.currentTarget.style.transform = 'scale(1)'
        }}
      >
        {isRecording ? '● RECORDING' : 'PANIC'}
      </button>

      {/* Action Buttons - Display below panic button when analysis is complete */}
      {analysisResult && (
        <ActionButtons 
          analysisResult={analysisResult} 
          transcript={transcript}
          recordedAudioURL={recordedAudioURL}
          location={location}
        />
      )}

      {/* Recording Status */}
      {isRecording && (
        <p style={{ color: '#dc2626', fontWeight: 'bold', marginBottom: 20 }}>
          Recording in progress...
        </p>
      )}

      {/* Live Transcript Display */}
      {isRecording && (
        <div style={{ 
          marginBottom: 20, 
          width: '100%', 
          maxWidth: 600, 
          padding: 15, 
          backgroundColor: '#f8f9fa', 
          borderRadius: 8, 
          border: '2px solid #0066cc',
          maxHeight: 200,
          overflowY: 'auto'
        }}>
          <p style={{ margin: '0 0 10px 0', fontWeight: 'bold', color: '#0066cc' }}>
            {isTranscribing ? '🎙️ Live Transcript' : '💬 Transcript'}
          </p>
          <p style={{ 
            margin: 0, 
            fontSize: 14, 
            color: '#333', 
            minHeight: 40,
            whiteSpace: 'pre-wrap',
            wordWrap: 'break-word'
          }}>
            {transcript || '(waiting for speech...)'}
          </p>
        </div>
      )}

      {/* Recorded Audio Playback */}
      {recordedAudioURL && (
        <div style={{ marginBottom: 20 }}>
          <p style={{ marginBottom: 10 }}>Recorded Audio:</p>
          <audio controls src={recordedAudioURL} style={{ width: 300 }} />
        </div>
      )}

      {/* Analysis Result */}
      {isAnalyzing && (
        <div style={{ 
          marginBottom: 20, 
          width: '100%', 
          maxWidth: 600, 
          padding: 15, 
          backgroundColor: '#e3f2fd', 
          borderRadius: 8, 
          border: '2px solid #1976d2',
          textAlign: 'center'
        }}>
          <p style={{ margin: '0', color: '#1976d2', fontWeight: 'bold' }}>
            🔍 Analyzing transcript with Gemini...
          </p>
        </div>
      )}

      {analysisResult && (
        <div style={{ 
          marginBottom: 20, 
          width: '100%', 
          maxWidth: 600, 
          padding: 15, 
          backgroundColor: '#f0f9ff', 
          borderRadius: 8, 
          border: '2px solid #059669',
        }}>
          <p style={{ margin: '0 0 10px 0', fontWeight: 'bold', color: '#059669' }}>
            ✓ Gemini Analysis
          </p>
          <div style={{ 
            fontSize: 14, 
            color: '#333', 
            whiteSpace: 'pre-wrap',
            wordWrap: 'break-word',
            backgroundColor: '#ffffff',
            padding: 10,
            borderRadius: 4,
            maxHeight: 300,
            overflowY: 'auto'
          }}>
            {analysisResult}
          </div>
        </div>
      )}

      {/* Map */}
      {location && (
        <div style={{ width: '100%', maxWidth: 600, marginTop: 20 }}>
          <h3>Your Location Map</h3>
          <div
            ref={mapContainerRef}
            style={{
              width: '100%',
              height: 400,
              borderRadius: 8,
              border: '1px solid #ddd',
            }}
          />
        </div>
      )}
    </div>
  )
}
