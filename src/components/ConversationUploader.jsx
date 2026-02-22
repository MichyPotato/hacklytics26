import React, { useState } from 'react'
import './ConversationUploader.css'
import Tesseract from 'tesseract.js'

export default function ConversationUploader() {
  const [files, setFiles] = useState([])
  const [processing, setProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [resultJson, setResultJson] = useState(null)
  const [error, setError] = useState('')
  const [geminiScore, setGeminiScore] = useState(null)
  const [analyzingGemini, setAnalyzingGemini] = useState(false)
  // Use relative `/api` so Vite dev server can proxy to the backend
  const API_BASE_URL = '/api'

  const normalizeBBox = (item) => {
    if (!item) return null
    if (item.bbox) return item.bbox
    const x0 = item.x0 ?? item.x ?? item.left ?? null
    const y0 = item.y0 ?? item.y ?? item.top ?? null
    const x1 = item.x1 ?? item.x2 ?? item.right ?? null
    const y1 = item.y1 ?? item.y2 ?? item.bottom ?? null
    return x0 == null ? null : { x0, y0, x1, y1 }
  }

  const handleFileChange = (e) => {
    setResultJson(null)
    setError('')
    const list = Array.from(e.target.files || [])
    setFiles(list)
  }

  const processFiles = async () => {
    if (!files || files.length === 0) {
      setError('Please choose one or more screenshot images to analyze')
      return
    }

    setProcessing(true)
    setProgress(0)
    setResultJson(null)
    setError('')

    const out = {
      sourceFiles: files.map(f => f.name),
      pages: [],
      generatedAt: new Date().toISOString()
    }

    for (let i = 0; i < files.length; i++) {
      const file = files[i]

      try {
        const workerProgress = (m) => {
          if (m.status === 'recognizing text') {
            const pct = Math.round(m.progress * 100)
            setProgress(Math.round(((i / files.length) * 100) + pct / files.length))
          }
        }

        const { data } = await Tesseract.recognize(file, 'eng', { logger: workerProgress })

        const page = {
          fileName: file.name,
          text: data?.text ?? '',
          lines: [],
          words: []
        }

        if (Array.isArray(data?.lines)) {
          page.lines = data.lines.map(l => ({ text: l.text, bbox: normalizeBBox(l) }))
        }

        if (Array.isArray(data?.words)) {
          page.words = data.words.map(w => ({ text: w.text, confidence: w.confidence, bbox: normalizeBBox(w) }))
        }

        out.pages.push(page)
      } catch (err) {
        console.error('OCR error for', file.name, err)
        out.pages.push({ fileName: file.name, error: err.message || String(err) })
      }
    }

    // Build a simple flat `user: message` array using left/right heuristic
    try {
      const allLines = []
      out.pages.forEach((p, pageIndex) => {
        ;(p.lines || []).forEach((line) => {
          const bbox = line.bbox || {}
          const y = bbox.y0 ?? bbox.y ?? 0
          const x0 = bbox.x0 ?? bbox.x ?? 0
          const x1 = bbox.x1 ?? bbox.x2 ?? bbox.right ?? x0
          const xCenter = (x0 + x1) / 2
          allLines.push({ page: pageIndex, y, xCenter, text: (line.text || '').trim() })
        })
      })

      allLines.sort((a, b) => (a.page - b.page) || (a.y - b.y))

      const xs = allLines.map(l => l.xCenter).filter(x => !isNaN(x))
      const median = xs.length ? xs.slice().sort((a, b) => a - b)[Math.floor(xs.length / 2)] : null

      const messages = []
      let curSpeaker = null
      let curText = ''

      allLines.forEach((l) => {
        const side = median != null && l.xCenter > median ? 'user' : 'other'
        if (curSpeaker === null) {
          curSpeaker = side
          curText = l.text
        } else if (side === curSpeaker) {
          curText = (curText + ' ' + l.text).trim()
        } else {
          messages.push({ user: curSpeaker, message: curText.trim() })
          curSpeaker = side
          curText = l.text
        }
      })

      if (curText) messages.push({ user: curSpeaker, message: curText.trim() })

      out.custom_messages = messages
    } catch (err) {
      console.error('Error building custom messages:', err)
    }

    setProgress(100)
    setResultJson(out)
    setProcessing(false)
  }

  const downloadJson = () => {
    if (!resultJson) return
    const blob = new Blob([JSON.stringify(resultJson, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `conversation_screenshots_${Date.now()}.json`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  const analyzeWithGemini = async () => {
    if (!resultJson) {
      setError('No JSON to analyze')
      return
    }

    setAnalyzingGemini(true)
    setGeminiScore(null)
    setError('')

    try {
      const resp = await fetch(`${API_BASE_URL}/analyze/gemini`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(resultJson)
      })

      const text = await resp.text()

      // Try parse JSON, otherwise surface raw text (often HTML error pages)
      let data = null
      try {
        data = JSON.parse(text)
      } catch (parseErr) {
        console.error('Non-JSON response from /analyze/gemini:', text)
        setError(`Server returned non-JSON (status ${resp.status}): ${text.slice(0, 1000)}`)
        setAnalyzingGemini(false)
        return
      }

      if (data && data.success) {
        setGeminiScore(typeof data.score === 'number' ? data.score : null)
      } else {
        setError(data.message || 'Gemini analysis failed')
      }
    } catch (e) {
      setError('Request failed: ' + e.message)
    } finally {
      setAnalyzingGemini(false)
    }
  }

  return (
    <div className="uploader-container">
      <h2>Conversation Analyzer (Screenshots → JSON)</h2>

      {error && <div className="error-message">{error}</div>}

      <div className="stage upload-stage">
        <p>Upload one or more screenshots of a conversation. The browser will run OCR and produce a JSON representation of text, lines, and word bounding boxes.</p>

        <input type="file" accept="image/*" multiple onChange={handleFileChange} />

        <div style={{ marginTop: 12 }}>
          <button onClick={processFiles} disabled={processing || files.length === 0} className="upload-button">{processing ? 'Processing...' : 'Process Screenshots'}</button>
          <button onClick={() => { setFiles([]); setResultJson(null); setError('') }} style={{ marginLeft: 8 }}>Clear</button>
        </div>

        <div style={{ marginTop: 12 }}>
          <div className="progress-container">
            <div className="progress-bar-wrapper">
              <div className="progress-bar" style={{ width: `${progress}%` }}></div>
            </div>
            <div className="progress-text">{progress}%</div>
          </div>
        </div>

        {resultJson && (
          <div className="analysis-results" style={{ marginTop: 12 }}>
            <h4>JSON Output</h4>
            <div style={{ marginBottom: 8 }}>
              <button onClick={downloadJson}>Download JSON</button>
                  <button onClick={analyzeWithGemini} disabled={analyzingGemini} style={{ marginLeft: 8 }}>{analyzingGemini ? 'Analyzing...' : 'Analyze with Gemini'}</button>
            </div>
                {geminiScore !== null && (
                  <div style={{ marginTop: 8 }}><strong>Gemini Score:</strong> {typeof geminiScore === 'number' ? geminiScore.toFixed(3) : String(geminiScore)}</div>
                )}
            <details>
              <summary>Show JSON</summary>
              <pre style={{ maxHeight: 400, overflow: 'auto', background: '#f6f8fa', padding: 12 }}>{JSON.stringify(resultJson, null, 2)}</pre>
            </details>
          </div>
        )}
      </div>
    </div>
  )
}
