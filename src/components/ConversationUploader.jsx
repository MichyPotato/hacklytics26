import React, { useState } from 'react'

export default function ConversationUploader() {
  const [picked, setPicked] = useState(null)

  return (
    <div style={{ padding: 20, textAlign: 'center' }}>
      <h2>Conversation Uploader</h2>
      <p>{picked ? `Selected: ${picked}` : 'No file selected (placeholder)'}</p>
      <div style={{ marginTop: 12 }}>
        <button onClick={() => setPicked('conversation.txt')}>Pick a conversation (placeholder)</button>
      </div>
    </div>
  )
}
