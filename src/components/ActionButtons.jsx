import React, { useState, useEffect } from 'react'
import JSZip from 'jszip'
import { saveAs } from 'file-saver'

export default function ActionButtons({ analysisResult, transcript, recordedAudioURL, location }) {
  const [recommendedActions, setRecommendedActions] = useState([])
  const [isSaving, setIsSaving] = useState(false)
  const [urgencyLevel, setUrgencyLevel] = useState(null)
  const [automaticActionTriggered, setAutomaticActionTriggered] = useState(false)

  // Parse the analysis to extract recommended actions and urgency level from JSON
  useEffect(() => {
    if (!analysisResult) {
      setRecommendedActions([])
      setUrgencyLevel(null)
      return
    }

    try {
      // Try to parse the analysis result as JSON
      const analysisData = typeof analysisResult === 'string' 
        ? JSON.parse(analysisResult) 
        : analysisResult

      // Extract urgency level from overall_tone_urgency.score
      const urgencyScore = analysisData?.overall_tone_urgency?.score
      if (urgencyScore !== undefined && urgencyScore !== null) {
        setUrgencyLevel(urgencyScore)
      }

      // Extract recommended actions from the JSON object based on true values
      const actions = []
      const recommendedActionsObj = analysisData?.recommended_actions || {}
      
      if (recommendedActionsObj['911_immediate_help'] === true) {
        actions.push('911_immediate_help')
      }
      if (recommendedActionsObj['save_encounter'] === true) {
        actions.push('save_encounter')
      }
      if (recommendedActionsObj['alert_emergency_contact'] === true) {
        actions.push('alert_emergency_contact')
      }
      if (recommendedActionsObj['advise_responders'] === true) {
        actions.push('advise_responders')
      }

      setRecommendedActions(actions)
    } catch (error) {
      console.error('Failed to parse analysis JSON:', error)
      setRecommendedActions([])
      setUrgencyLevel(null)
    }
  }, [analysisResult])

  // Auto-trigger 911 and save when urgency > 7 and 911 is recommended
  useEffect(() => {
    if (
      !automaticActionTriggered &&
      urgencyLevel !== null &&
      urgencyLevel > 7 &&
      recommendedActions.includes('911_immediate_help') &&
      analysisResult &&
      transcript
    ) {
      setAutomaticActionTriggered(true)
      // Trigger automatic actions with a small delay
      setTimeout(() => {
        triggerAutomatic911AndSave()
      }, 500)
    }
  }, [urgencyLevel, recommendedActions, analysisResult, transcript, automaticActionTriggered])

  // Check if an action is recommended
  const isRecommended = (actionId) => recommendedActions.includes(actionId)

  // Automatic 911 call and save encounter
  const triggerAutomatic911AndSave = async () => {
    // First, show notification
    alert(
      '🚨 CRITICAL SITUATION DETECTED 🚨\n\n' +
      'Urgency Level: ' + urgencyLevel + '/10\n\n' +
      'AUTOMATIC ACTIONS TRIGGERED:\n' +
      '✓ Initiating emergency call\n' +
      '✓ Saving and sending encounter data\n\n' +
      '📞 DUMMY CALL: Calling 911 with emergency information\n' +
      'Location: Latitude ' + (location?.latitude.toFixed(4) || 'N/A') + ', Longitude ' + (location?.longitude.toFixed(4) || 'N/A') + '\n\n' +
      'In a real scenario, this would immediately connect to emergency services and dispatch responders to your location.'
    )

    // Save and send the encounter data
    await saveAndSendEmergencyData()
  }

  // Save and send emergency data as zip
  const saveAndSendEmergencyData = async () => {
    try {
      const zip = new JSZip()

      // Add analysis as text file
      zip.file('analysis.txt', analysisResult)

      // Add transcript as text file
      zip.file('transcript.txt', transcript)

      // Add location info
      const locationInfo = location 
        ? `Latitude: ${location.latitude}\nLongitude: ${location.longitude}`
        : 'Location not available'
      zip.file('location.txt', locationInfo)

      // Add urgency and timestamp
      const emergencyMetadata = `EMERGENCY INCIDENT REPORT\n\n` +
        `Timestamp: ${new Date().toISOString()}\n` +
        `Urgency Level: ${urgencyLevel}/10\n` +
        `Location: Latitude ${location?.latitude || 'N/A'}, Longitude ${location?.longitude || 'N/A'}\n` +
        `Automatic 911 Call Initiated: YES\n`
      zip.file('emergency_metadata.txt', emergencyMetadata)

      // Add audio file if available
      if (recordedAudioURL) {
        try {
          const audioBlob = await fetch(recordedAudioURL).then(res => res.blob())
          zip.file('recording.webm', audioBlob)
        } catch (e) {
          console.error('Error adding audio file:', e)
        }
      }

      // Generate and download zip
      const zipBlob = await zip.generateAsync({ type: 'blob' })
      saveAs(zipBlob, `EMERGENCY_${Date.now()}.zip`)
      
      alert('✓ Emergency data saved and sent to responders')
    } catch (error) {
      console.error('Error saving emergency data:', error)
      alert('Error saving emergency data: ' + error.message)
    }
  }

  // Handle 911 immediate help - dummy data
  const handle911 = async () => {
    alert('📞 DUMMY CALL: Calling 911 with location coordinates:\nLatitude: ' + 
      (location?.latitude.toFixed(4) || 'N/A') + '\nLongitude: ' + 
      (location?.longitude.toFixed(4) || 'N/A') + '\n\nIn a real scenario, this would connect to emergency services.')
  }

  // Handle save encounter - create zip with analysis, transcript, and audio
  const handleSaveEncounter = async () => {
    if (!analysisResult || !transcript) {
      alert('Please wait for the analysis to complete before saving.')
      return
    }

    setIsSaving(true)
    try {
      const zip = new JSZip()

      // Add analysis as text file
      zip.file('analysis.txt', analysisResult)

      // Add transcript as text file
      zip.file('transcript.txt', transcript)

      // Add location info
      const locationInfo = location 
        ? `Latitude: ${location.latitude}\nLongitude: ${location.longitude}`
        : 'Location not available'
      zip.file('location.txt', locationInfo)

      // Add audio file if available
      if (recordedAudioURL) {
        try {
          const audioBlob = await fetch(recordedAudioURL).then(res => res.blob())
          zip.file('recording.webm', audioBlob)
        } catch (e) {
          console.error('Error adding audio file:', e)
        }
      }

      // Generate and download zip
      const zipBlob = await zip.generateAsync({ type: 'blob' })
      saveAs(zipBlob, `panic_encounter_${Date.now()}.zip`)
      alert('✓ Encounter saved successfully!')
    } catch (error) {
      console.error('Error saving encounter:', error)
      alert('Error saving encounter: ' + error.message)
    } finally {
      setIsSaving(false)
    }
  }

  // Handle alert emergency contact - dummy implementation
  const handleAlertEmergencyContact = async () => {
    const emergencyContact = prompt('Enter emergency contact number (including country code):')
    if (!emergencyContact) return

    alert('📱 DUMMY SMS: Sending alert text to ' + emergencyContact + '\n\nMessage:\n"EMERGENCY: I\'ve activated my panic button. My location is:\nLatitude: ' +
      (location?.latitude.toFixed(4) || 'N/A') + '\nLongitude: ' +
      (location?.longitude.toFixed(4) || 'N/A') + '\n\nAnalysis: ' +
      analysisResult.substring(0, 200) + '..."\n\nIn a real scenario, this would send an SMS.')
  }

  // Handle advise responders - dummy implementation
  const handleAdviseResponders = async () => {
    alert('🚨 DUMMY NOTIFICATION: Sending detailed report to emergency responders\n\n' +
      'Location: Latitude ' + (location?.latitude.toFixed(4) || 'N/A') + 
      ', Longitude ' + (location?.longitude.toFixed(4) || 'N/A') + 
      '\n\nIncident Analysis:\n' + analysisResult.substring(0, 300) + 
      '...\n\nIn a real scenario, this would notify nearby emergency responders.')
  }

  // Button style with border effect for recommended actions
  const getButtonStyle = (actionId) => {
    const isRec = isRecommended(actionId)
    return {
      flex: 1,
      padding: '12px 16px',
      margin: '0 6px',
      borderRadius: 8,
      border: isRec ? '3px solid #ff6b6b' : '2px solid #ddd',
      backgroundColor: isRec ? '#ffe6e6' : '#f8f9fa',
      color: isRec ? '#dc2626' : '#333',
      fontSize: 13,
      fontWeight: isRec ? '700' : '600',
      cursor: 'pointer',
      transition: 'all 0.2s',
      textAlign: 'center',
      boxShadow: isRec ? '0 0 12px rgba(220, 38, 38, 0.3)' : 'none',
    }
  }

  return (
    <div style={{ 
      width: '100%', 
      maxWidth: 600, 
      marginTop: 20, 
      marginBottom: 20 
    }}>
      {/* Automatic Action Alert */}
      {automaticActionTriggered && (
        <div style={{
          marginBottom: 15,
          padding: 15,
          backgroundColor: '#fee2e2',
          borderRadius: 8,
          border: '3px solid #dc2626',
          boxShadow: '0 0 20px rgba(220, 38, 38, 0.4)'
        }}>
          <p style={{
            margin: '0 0 8px 0',
            fontWeight: 'bold',
            color: '#991b1b',
            fontSize: 15
          }}>
            🚨 CRITICAL EMERGENCY PROTOCOL ACTIVATED
          </p>
          <p style={{
            margin: '0 0 5px 0',
            color: '#7f1d1d',
            fontSize: 13
          }}>
            Urgency Level: {urgencyLevel}/10
          </p>
          <p style={{
            margin: '0 0 5px 0',
            color: '#7f1d1d',
            fontSize: 13
          }}>
            ✓ Emergency call initiated
          </p>
          <p style={{
            margin: '0',
            color: '#7f1d1d',
            fontSize: 13
          }}>
            ✓ Incident data transmitted to responders
          </p>
        </div>
      )}

      <p style={{ 
        margin: '0 0 12px 0', 
        fontWeight: 'bold', 
        color: '#333',
        fontSize: 14
      }}>
        Recommended Actions:
      </p>
      <div style={{ 
        display: 'flex', 
        flexDirection: 'row', 
        gap: 0,
        flexWrap: 'wrap',
        justifyContent: 'space-between'
      }}>
        <button
          onClick={handle911}
          style={getButtonStyle('911_immediate_help')}
          onMouseDown={(e) => e.target.style.backgroundColor = isRecommended('911_immediate_help') ? '#ffd9d9' : '#e8e9ea'}
          onMouseUp={(e) => e.target.style.backgroundColor = isRecommended('911_immediate_help') ? '#ffe6e6' : '#f8f9fa'}
        >
          📞 911 Help
        </button>
        <button
          onClick={handleSaveEncounter}
          disabled={isSaving || !analysisResult}
          style={{
            ...getButtonStyle('save_encounter'),
            opacity: isSaving || !analysisResult ? 0.6 : 1,
            cursor: isSaving || !analysisResult ? 'not-allowed' : 'pointer'
          }}
          onMouseDown={(e) => !isSaving && (e.target.style.backgroundColor = isRecommended('save_encounter') ? '#ffd9d9' : '#e8e9ea')}
          onMouseUp={(e) => !isSaving && (e.target.style.backgroundColor = isRecommended('save_encounter') ? '#ffe6e6' : '#f8f9fa')}
        >
          {isSaving ? '⏳ Saving...' : '💾 Save'}
        </button>
        <button
          onClick={handleAlertEmergencyContact}
          style={getButtonStyle('alert_emergency_contact')}
          onMouseDown={(e) => e.target.style.backgroundColor = isRecommended('alert_emergency_contact') ? '#ffd9d9' : '#e8e9ea'}
          onMouseUp={(e) => e.target.style.backgroundColor = isRecommended('alert_emergency_contact') ? '#ffe6e6' : '#f8f9fa'}
        >
          🚨 Alert
        </button>
        <button
          onClick={handleAdviseResponders}
          style={getButtonStyle('advise_responders')}
          onMouseDown={(e) => e.target.style.backgroundColor = isRecommended('advise_responders') ? '#ffd9d9' : '#e8e9ea'}
          onMouseUp={(e) => e.target.style.backgroundColor = isRecommended('advise_responders') ? '#ffe6e6' : '#f8f9fa'}
        >
          🚔 Advise
        </button>
      </div>
    </div>
  )
}
