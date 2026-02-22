import express from 'express'
import cors from 'cors'
import multer from 'multer'
import { spawn } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'
import dotenv from 'dotenv'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { initDb, createUser, getUserByEmail, getUserById, updateUserLocations } from './db.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Load environment variables
dotenv.config({ path: path.join(__dirname, '.env') })

const app = express()
const PORT = process.env.PORT || 5000

// Middleware
app.use(cors())
app.use(express.json())
app.use(express.urlencoded({ limit: '50mb', extended: true }))

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret'

initDb().catch((error) => {
  console.error('Failed to initialize database:', error)
  process.exit(1)
})

const sanitizeUser = (user) => ({
  id: user.id,
  email: user.email,
  homeLocation: user.home_location,
  workLocation: user.work_location,
  createdAt: user.created_at,
  updatedAt: user.updated_at
})

const signToken = (user) => jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' })

const getTokenFromHeader = (header = '') => {
  if (!header) return null
  const [scheme, value] = header.split(' ')
  if (scheme !== 'Bearer' || !value) return null
  return value
}

const getUserFromAuthHeader = async (authHeader) => {
  const token = getTokenFromHeader(authHeader)
  if (!token) return null
  try {
    const payload = jwt.verify(token, JWT_SECRET)
    const user = await getUserById(payload.userId)
    return user || null
  } catch (error) {
    return null
  }
}

const requireAuth = async (req, res, next) => {
  const user = await getUserFromAuthHeader(req.headers.authorization)
  if (!user) {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized'
    })
  }
  req.user = user
  return next()
}

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

const haversineKm = (a, b) => {
  const toRad = (deg) => (deg * Math.PI) / 180
  const R = 6371
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

const geocodeLocation = async (value = '') => {
  const trimmed = value.trim()
  if (!trimmed) return null
  const direct = parseLatLng(trimmed)
  if (direct) return direct

  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(trimmed)}`
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'hacklytics-app/1.0',
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
  } catch (error) {
    console.warn('Geocode failed:', error)
    return null
  }
}

const buildSavedLocationContext = async (user) => {
  if (!user) {
    return 'Saved Locations: Not available'
  }

  const home = user.home_location ? user.home_location.trim() : ''
  const work = user.work_location ? user.work_location.trim() : ''
  const homeLabel = home || 'Not set'
  const workLabel = work || 'Not set'
  const homeCoords = home ? await geocodeLocation(home) : null
  const workCoords = work ? await geocodeLocation(work) : null

  let difference = 'Not enough info to compare.'
  if (home && work) {
    difference = home.toLowerCase() === work.toLowerCase()
      ? 'Home and work/school are the same location.'
      : 'Home and work/school are different locations.'
  }

  let distanceLine = 'Distance Difference: Not available.'
  if (homeCoords && workCoords) {
    const km = haversineKm(homeCoords, workCoords)
    const miles = km * 0.621371
    distanceLine = `Distance Difference: ${km.toFixed(2)} km (${miles.toFixed(2)} mi).`
  }

  return `Saved Locations:\nHome Location: ${homeLabel}\nWork/School Location: ${workLabel}\nLocation Difference: ${difference}\n${distanceLine}`
}

// Storage for uploaded conversations
const upload = multer({ storage: multer.memoryStorage() })
const conversationsDir = path.join(__dirname, 'conversations')

// Ensure conversations directory exists
if (!fs.existsSync(conversationsDir)) {
  fs.mkdirSync(conversationsDir, { recursive: true })
}

app.post('/api/auth/signup', async (req, res) => {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      })
    }

    const normalizedEmail = email.trim().toLowerCase()
    const existingUser = await getUserByEmail(normalizedEmail)
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'Account already exists for this email'
      })
    }

    const passwordHash = await bcrypt.hash(password, 10)
    const user = await createUser({
      email: normalizedEmail,
      passwordHash
    })
    const token = signToken(user)

    return res.json({
      success: true,
      token,
      user: sanitizeUser(user)
    })
  } catch (error) {
    console.error('Signup error:', error)
    return res.status(500).json({
      success: false,
      message: 'Failed to create account'
    })
  }
})

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      })
    }

    const normalizedEmail = email.trim().toLowerCase()
    const user = await getUserByEmail(normalizedEmail)
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      })
    }

    const passwordMatches = await bcrypt.compare(password, user.password_hash)
    if (!passwordMatches) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      })
    }

    const token = signToken(user)
    return res.json({
      success: true,
      token,
      user: sanitizeUser(user)
    })
  } catch (error) {
    console.error('Login error:', error)
    return res.status(500).json({
      success: false,
      message: 'Failed to log in'
    })
  }
})

app.get('/api/auth/me', requireAuth, (req, res) => {
  return res.json({
    success: true,
    user: sanitizeUser(req.user)
  })
})

app.put('/api/profile/locations', requireAuth, async (req, res) => {
  try {
    const { homeLocation, workLocation } = req.body
    const user = await updateUserLocations({
      id: req.user.id,
      homeLocation,
      workLocation
    })

    return res.json({
      success: true,
      user: sanitizeUser(user)
    })
  } catch (error) {
    console.error('Location update error:', error)
    return res.status(500).json({
      success: false,
      message: 'Failed to update locations'
    })
  }
})

// Instagram Login API
app.post('/api/instagram/login', (req, res) => {
  const { username, password } = req.body

  if (!username || !password) {
    return res.status(400).json({
      success: false,
      message: 'Username and password are required'
    })
  }

  // Call Python script for Instagram login
  const pythonProcess = spawn('python', [
    path.join(__dirname, 'python/instagram_login.py'),
    username,
    password
  ])

  // Set timeout to prevent hanging on Instagram security checks (60 seconds)
  const timeout = setTimeout(() => {
    pythonProcess.kill()
    res.status(500).json({
      success: false,
      message: 'Instagram login timed out. Instagram may require security verification (2FA, captcha, etc.). Please try again or check your account security.'
    })
  }, 60000)

  let output = ''
  let errorOutput = ''

  pythonProcess.stdout.on('data', (data) => {
    output += data.toString()
  })

  pythonProcess.stderr.on('data', (data) => {
    errorOutput += data.toString()
  })

  pythonProcess.on('close', (code) => {
    clearTimeout(timeout)
    if (code === 0) {
      try {
        const result = JSON.parse(output)
        // Store session info for later use
        req.session = req.session || {}
        req.session.instaUsername = username
        req.session.instaSession = result.session_id

        res.json({
          success: true,
          message: 'Login successful',
          sessionId: result.session_id,
          userId: result.user_id
        })
      } catch (e) {
        res.status(500).json({
          success: false,
          message: 'Failed to parse login response'
        })
      }
    } else {
      res.status(401).json({
        success: false,
        message: 'Instagram login failed: ' + errorOutput
      })
    }
  })
})

// Get conversations list API
app.post('/api/instagram/conversations', (req, res) => {
  const { username, sessionId } = req.body

  if (!username || !sessionId) {
    return res.status(400).json({
      success: false,
      message: 'Username and session ID are required'
    })
  }

  // Call Python script to get conversations
  const pythonProcess = spawn('python', [
    path.join(__dirname, 'python/get_conversations.py'),
    username,
    sessionId
  ])

  let output = ''
  let errorOutput = ''

  pythonProcess.stdout.on('data', (data) => {
    output += data.toString()
  })

  pythonProcess.stderr.on('data', (data) => {
    errorOutput += data.toString()
  })

  pythonProcess.on('close', (code) => {
    if (code === 0) {
      try {
        const conversations = JSON.parse(output)
        res.json({
          success: true,
          conversations: conversations
        })
      } catch (e) {
        res.status(500).json({
          success: false,
          message: 'Failed to parse conversations'
        })
      }
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to fetch conversations: ' + errorOutput
      })
    }
  })
})

// Upload and analyze conversation
app.post('/api/analyze/upload', upload.single('conversation'), (req, res) => {
  const { username, conversationWith, sessionId } = req.body

  if (!username || !conversationWith || !sessionId) {
    return res.status(400).json({
      success: false,
      message: 'Username, conversation partner, and session ID are required'
    })
  }

  // Call Python script to fetch and store conversation
  const pythonProcess = spawn('python', [
    path.join(__dirname, 'python/fetch_conversation.py'),
    username,
    conversationWith,
    sessionId
  ])

  let conversationData = ''
  let errorOutput = ''

  pythonProcess.stdout.on('data', (data) => {
    conversationData += data.toString()
  })

  pythonProcess.stderr.on('data', (data) => {
    errorOutput += data.toString()
  })

  pythonProcess.on('close', (code) => {
    if (code === 0) {
      try {
        const messages = JSON.parse(conversationData)
        
        // Store conversation locally
        const conversationId = `${username}_${conversationWith}_${Date.now()}`
        const conversationPath = path.join(conversationsDir, `${conversationId}.json`)
        
        const conversationObj = {
          id: conversationId,
          username: username,
          conversationWith: conversationWith,
          fetchedAt: new Date().toISOString(),
          messageCount: messages.length,
          messages: messages,
          analysis: null // Placeholder for ML analysis
        }

        fs.writeFileSync(conversationPath, JSON.stringify(conversationObj, null, 2))

        res.json({
          success: true,
          conversationId: conversationId,
          messageCount: messages.length,
          message: 'Conversation uploaded successfully'
        })
      } catch (e) {
        res.status(500).json({
          success: false,
          message: 'Failed to process conversation: ' + e.message
        })
      }
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to fetch conversation from Instagram: ' + errorOutput
      })
    }
  })
})

// Analyze conversation with ML (placeholder)
app.post('/api/analyze/process', (req, res) => {
  const { conversationId } = req.body

  if (!conversationId) {
    return res.status(400).json({
      success: false,
      message: 'Conversation ID is required'
    })
  }

  const conversationPath = path.join(conversationsDir, `${conversationId}.json`)

  // Check if conversation exists
  if (!fs.existsSync(conversationPath)) {
    return res.status(404).json({
      success: false,
      message: 'Conversation not found'
    })
  }

  // Simulate analysis progress
  res.json({
    success: true,
    message: 'Analysis started',
    conversationId: conversationId,
    status: 'processing'
  })

  // Placeholder: ML Analysis will be implemented here
  // For now, we're just simulating the process
  setTimeout(() => {
    try {
      const conversation = JSON.parse(fs.readFileSync(conversationPath, 'utf8'))
      
      // Placeholder analysis result
      conversation.analysis = {
        status: 'completed',
        timestamp: new Date().toISOString(),
        sentiment: 'pending_ml_implementation',
        topics: [],
        summary: 'ML analysis placeholder - to be implemented',
        metrics: {
          totalMessages: conversation.messageCount,
          analyzedAt: new Date().toISOString()
        }
      }

      fs.writeFileSync(conversationPath, JSON.stringify(conversation, null, 2))
    } catch (e) {
      console.error('Error updating conversation:', e)
    }
  }, 3000)
})

// Get analysis results
app.get('/api/analyze/:conversationId', (req, res) => {
  const { conversationId } = req.params
  const conversationPath = path.join(conversationsDir, `${conversationId}.json`)

  if (!fs.existsSync(conversationPath)) {
    return res.status(404).json({
      success: false,
      message: 'Conversation not found'
    })
  }

  try {
    const conversation = JSON.parse(fs.readFileSync(conversationPath, 'utf8'))
    res.json({
      success: true,
      conversation: conversation
    })
  } catch (e) {
    res.status(500).json({
      success: false,
      message: 'Failed to read conversation'
    })
  }
})

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' })
})

// Analyze OCR JSON with Google Gemini (or simulated if no API key)
app.post('/api/analyze/gemini', async (req, res) => {
  const payload = req.body

  if (!payload) {
    return res.status(400).json({ success: false, message: 'JSON payload required' })
  }

  try {
    const conversationId = `ocr_${Date.now()}`
    const conversationPath = path.join(conversationsDir, `${conversationId}.json`)

    const conversationObj = {
      id: conversationId,
      source: 'ocr_upload',
      receivedAt: new Date().toISOString(),
      payload: payload,
      analysis: null
    }

    fs.writeFileSync(conversationPath, JSON.stringify(conversationObj, null, 2))

    // Build prompt for Gemini based on simple messages if available
    // "prompt here" — put your exact instruction for Gemini below
    let prompt = ''
    if (Array.isArray(payload.custom_messages)) {
      prompt = payload.custom_messages.map(m => `${m.user}: ${m.message}`).join('\n')
    } else if (Array.isArray(payload.pages)) {
      // fallback: join OCR text
      prompt = payload.pages.map(p => p.text || '').join('\n')
    } else {
      prompt = JSON.stringify(payload)
    }

    // prompt here

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY || ''
    const GEMINI_MODEL = process.env.GEMINI_MODEL || 'models/gemini-3'

    let score = null
    let rawResponse = null

    if (GEMINI_API_KEY) {
      // Call Google Generative AI REST endpoint
      const apiUrl = `https://generativeai.googleapis.com/v1beta2/${GEMINI_MODEL}:generateText`
      const body = {
        prompt: { text: prompt },
        temperature: 0.0,
        maxOutputTokens: 256
      }

      const r = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${GEMINI_API_KEY}`
        },
        body: JSON.stringify(body)
      })

      rawResponse = await r.json()

      // Try to extract returned text from common response shapes
      let returnedText = ''
      try {
        if (rawResponse?.candidates && rawResponse.candidates.length) {
          returnedText = rawResponse.candidates[0].content?.map(c => c.text || c).join('') || ''
        } else if (rawResponse?.output) {
          returnedText = rawResponse.output
        } else if (rawResponse?.response) {
          returnedText = JSON.stringify(rawResponse.response)
        } else {
          returnedText = JSON.stringify(rawResponse)
        }
      } catch (e) {
        returnedText = JSON.stringify(rawResponse)
      }

      // Try to parse a number between 0 and 1 from returnedText
      const m = returnedText.match(/(?:\b|^)(0(?:\.\d+)?|1(?:\.0+)?)(?:\b|$)/)
      if (m) {
        score = parseFloat(m[1])
      } else {
        // if not found, attempt JSON parse
        try {
          const parsed = JSON.parse(returnedText)
          if (typeof parsed === 'number') score = parsed
          else if (parsed && typeof parsed.score === 'number') score = parsed.score
        } catch (e) {
          // leave score null
        }
      }
    } else {
      // No Gemini key — simulate a score for local testing
      score = Math.random()
      rawResponse = { simulated: true }
    }

    // Clamp score to [0,1]
    if (typeof score === 'number') {
      score = Math.max(0, Math.min(1, score))
    }

    conversationObj.analysis = {
      geminiScore: score,
      geminiRaw: rawResponse,
      analyzedAt: new Date().toISOString()
    }

    fs.writeFileSync(conversationPath, JSON.stringify(conversationObj, null, 2))

    res.json({ success: true, conversationId, score })
  } catch (e) {
    console.error('Gemini analysis error:', e)
    res.status(500).json({ success: false, message: e.message })
  }
})

// Analyze transcript with Gemini
app.post('/api/analyze-transcript', async (req, res) => {
  try {
    const { transcript, location } = req.body
    const authUser = await getUserFromAuthHeader(req.headers.authorization)
    const savedLocationContext = await buildSavedLocationContext(authUser)

    if (!transcript || transcript.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Transcript is required'
      })
    }

    const geminiApiKey = process.env.GEMINI_API_KEY
    
    if (!geminiApiKey) {
      // Return a template if no API key is available
      return res.json({
        success: true,
        analysis: `[ANALYSIS TEMPLATE - GEMINI API NOT CONFIGURED]\n\nTranscript received:\n"${transcript.substring(0, 100)}${transcript.length > 100 ? '...' : ''}"\n\nLocation: ${location ? `${location.latitude.toFixed(4)}°, ${location.longitude.toFixed(4)}°` : 'Not available'}\n${savedLocationContext}\n\nThis would be analyzed for:\n- Tone and sentiment\n- Key keywords and topics\n- Urgency level\n- Recommended actions\n- Context and location relevance`
      })
    }

    // Prepare the prompt for Gemini
    const analysisPrompt = `You are an emergency analysis assistant. Analyze this transcript from a panic button recording:
Analyze the Transcript and Location and return a structured JSON response following the exact format below. 

Only output valid JSON.

Do not include explanations outside the JSON.

Do not include markdown formatting.

Do not add extra fields.
Transcript: "${transcript}"

Current Location: ${location ? `Latitude: ${location.latitude}, Longitude: ${location.longitude}` : 'Not available'}
${savedLocationContext}

Provide a concise analysis about the following, with the specified json format:
1. Overall Tone & Urgency Level (1-10), where 1-6 is low urgency, where a simple save for later or texting emergency contact can suffice and 7-10 is high urgency, contact authorities immediately; like in situations that pose extreme physical or psychological danger. Consider tone, keywords, and context in your assessment.
2. Key Keywords and Topics
3. Detected Emergency Type (if any)
4. Recommended Actions, recommended actions fall under these categories: 911 immediate help, save encounter, alert emergency contact, and advise responders.
5. Summary

{
"overall_tone_urgency": {
"score": 0,
"level": "low | high",
"rationale": ""
},
"key_keywords_topics": [],
"detected_emergency_type": "",
"recommended_actions": {
  "911_immediate_help": false,
  "save_encounter": false,
  "alert_emergency_contact": false,
  "advise_responders": false
},
"summary": ""
}
  
Keep the summary concise and actionable. Return the JSON Object.`

    // Call Gemini API
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: analysisPrompt
                }
              ]
            }
          ]
        })
      }
    )

    const data = await response.json()
    console.log('Gemini response status:', response.status)
    console.log('Gemini response data:', JSON.stringify(data, null, 2))

    if (data.candidates && data.candidates[0] && data.candidates[0].content) {
      const analysisText = data.candidates[0].content.parts[0].text
      return res.json({
        success: true,
        analysis: analysisText
      })
    } else if (data.error) {
      throw new Error(`Gemini API error: ${data.error.message}`)
    } else {
      throw new Error('Invalid response from Gemini API: ' + JSON.stringify(data))
    }
  } catch (error) {
    console.error('Transcript analysis error:', error)
    res.status(500).json({
      success: false,
      message: error.message
    })
  }
})

app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`)
})
