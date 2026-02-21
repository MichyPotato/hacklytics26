import React, { useState, useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

export default function ButtonTab() {
  const [location, setLocation] = useState(null)
  const [locationError, setLocationError] = useState(null)
  const [isRecording, setIsRecording] = useState(false)
  const [recordedAudioURL, setRecordedAudioURL] = useState(null)
  const mediaRecorderRef = useRef(null)
  const audioContextRef = useRef(null)
  const streamRef = useRef(null)
  const mapRef = useRef(null)
  const mapContainerRef = useRef(null)

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
    L.marker([location.latitude, location.longitude])
      .addTo(map)
      .bindPopup('Your Location')
      .openPopup()

    mapRef.current = map

    // Cleanup function
    return () => {
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
    }
  }, [location])

  // Handle panic button press - start/stop recording
  const handlePanicPress = async () => {
    if (!isRecording) {
      // Start recording
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        streamRef.current = stream

        const mediaRecorder = new MediaRecorder(stream)
        mediaRecorderRef.current = mediaRecorder
        const chunks = []

        mediaRecorder.ondataavailable = (e) => {
          chunks.push(e.data)
        }

        mediaRecorder.onstop = () => {
          const blob = new Blob(chunks, { type: 'audio/webm' })
          const url = URL.createObjectURL(blob)
          setRecordedAudioURL(url)
          stream.getTracks().forEach(track => track.stop())
        }

        mediaRecorder.start()
        setIsRecording(true)
      } catch (error) {
        console.error('Error accessing microphone:', error)
        alert('Could not access microphone. Please check permissions.')
      }
    } else {
      // Stop recording
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.stop()
        setIsRecording(false)
      }
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

      {/* Recording Status */}
      {isRecording && (
        <p style={{ color: '#dc2626', fontWeight: 'bold', marginBottom: 20 }}>
          Recording in progress...
        </p>
      )}

      {/* Recorded Audio Playback */}
      {recordedAudioURL && (
        <div style={{ marginBottom: 20 }}>
          <p style={{ marginBottom: 10 }}>Recorded Audio:</p>
          <audio controls src={recordedAudioURL} style={{ width: 300 }} />
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
