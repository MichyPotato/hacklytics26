import React, { useState } from 'react'

export default function ButtonTab() {
  const [count, setCount] = useState(0)

  return (
    <div style={{ padding: 20, textAlign: 'center' }}>
      <h2>Button Tab</h2>
      <p>Pressed {count} times</p>
      <div style={{ marginTop: 12 }}>
        <button onClick={() => setCount(c => c + 1)}>Press me</button>
      </div>
    </div>
  )
}
