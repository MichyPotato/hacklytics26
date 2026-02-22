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
import { initDb, createUser, getUserByEmail, getUserById, updateUserLocations, updateUserLanguage } from './db.js'

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
  preferredLanguage: user.preferred_language || 'en',
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

app.put('/api/profile/language', requireAuth, async (req, res) => {
  try {
    const { preferredLanguage } = req.body
    const user = await updateUserLanguage({
      id: req.user.id,
      preferredLanguage
    })

    return res.json({
      success: true,
      user: sanitizeUser(user)
    })
  } catch (error) {
    console.error('Language update error:', error)
    return res.status(500).json({
      success: false,
      message: 'Failed to update language'
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

// Fake call generation with Eleven Labs
app.post('/api/fake-call/generate', requireAuth, async (req, res) => {
  try {
    const { language } = req.body
    const elevenLabsApiKey = process.env.ELEVENLABS_API_KEY

    if (!elevenLabsApiKey) {
      console.error('ELEVENLABS_API_KEY not configured in environment')
      return res.status(500).json({
        success: false,
        message: 'Eleven Labs API key not configured'
      })
    }

    console.log(`Generating fake call audio for language: ${language}`)

    // Generate conversation script based on language - more interactive and two-way
    const conversationScripts = {
      en: "Hello? Oh hey! Yeah, I'm on my way right now............... Oh really? That's actually pretty funny! ............... Yeah, I remember when that happened last time. So the traffic isn't too bad, I should be there in about 15 minutes............... Wait, what did you say? ............... Oh, the meeting is still at 3 PM? Perfect, that works for me............... By the way, did you end up finishing that project we talked about? ............... That's great! I knew you could do it............... Okay, I'm getting close now. I'll see you in a few minutes. Thanks for calling!",
      es: "¿Hola? ¡Ah, hola! Sí, estoy en camino ahora mismo............... ¿De verdad? ¡Eso es bastante gracioso! ............... Sí, recuerdo cuando eso pasó la última vez. El tráfico no está tan mal, debería llegar en unos 15 minutos............... Espera, ¿qué dijiste? ............... Ah, ¿la reunión sigue siendo a las 3 PM? Perfecto, eso me funciona............... Por cierto, ¿terminaste ese proyecto del que hablamos? ............... ¡Qué bien! Sabía que podías hacerlo............... Bueno, ya estoy cerca. Te veo en unos minutos. ¡Gracias por llamar!",
      fr: "Allô? Ah salut! Oui, je suis en route maintenant............... Ah vraiment? C'est plutôt drôle! ............... Oui, je me souviens quand c'est arrivé la dernière fois. Le trafic n'est pas trop mal, je devrais être là dans environ 15 minutes............... Attends, qu'est-ce que tu as dit? ............... Ah, la réunion est toujours à 15 heures? Parfait, ça me convient............... Au fait, as-tu fini ce projet dont nous avons parlé? ............... C'est super! Je savais que tu pouvais le faire............... Bon, je suis presque arrivé. Je te vois dans quelques minutes. Merci d'avoir appelé!",
      de: "Hallo? Oh hey! Ja, ich bin gerade unterwegs............... Oh wirklich? Das ist ja lustig! ............... Ja, ich erinnere mich, als das das letzte Mal passiert ist. Der Verkehr ist nicht so schlimm, ich sollte in etwa 15 Minuten da sein............... Warte, was hast du gesagt? ............... Ah, das Meeting ist immer noch um 15 Uhr? Perfect, das passt mir............... Übrigens, hast du das Projekt fertig, über das wir gesprochen haben? ............... Das ist toll! Ich wusste, dass du das schaffst............... Okay, ich bin gleich da. Bis in ein paar Minuten. Danke für den Anruf!",
      it: "Pronto? Oh ciao! Sì, sono in viaggio adesso............... Oh davvero? È piuttosto divertente! ............... Sì, ricordo quando è successo l'ultima volta. Il traffico non è male, dovrei arrivare tra circa 15 minuti............... Aspetta, cosa hai detto? ............... Ah, la riunione è ancora alle 15? Perfetto, mi va bene............... A proposito, hai finito quel progetto di cui abbiamo parlato? ............... È fantastico! Sapevo che potevi farcela............... Okay, sto arrivando. Ci vediamo tra pochi minuti. Grazie per la chiamata!",
      pt: "Alô? Ah oi! Sim, estou a caminho agora............... Ah é mesmo? Isso é bem engraçado! ............... Sim, eu lembro quando isso aconteceu da última vez. O trânsito não está tão ruim, devo chegar em cerca de 15 minutos............... Espera, o que você disse? ............... Ah, a reunião ainda é às 15h? Perfeito, funciona para mim............... Aliás, você terminou aquele projeto que conversamos? ............... Que ótimo! Eu sabia que você conseguiria............... Ok, já estou chegando. Te vejo em alguns minutos. Obrigado por ligar!",
      zh: "喂？哦，嘿！是的，我现在在路上............... 哦，真的吗？那真有趣！............... 是的，我记得上次发生那件事。交通不太糟糕，我大约15分钟后就到............... 等等，你说什么？............... 哦，会议还是下午3点？完美，这对我来说没问题............... 顺便问一下，你完成我们谈到的那个项目了吗？............... 太棒了！我就知道你能做到............... 好的，我快到了。几分钟后见。谢谢你打电话来！",
      ja: "もしもし？あ、やあ！うん、今向かってるよ............... 本当？それは面白いね！............... うん、前回それが起こった時のこと覚えてるよ。交通はそんなに悪くないから、15分くらいで着くはず............... ちょっと待って、何て言った？............... ああ、会議はまだ午後3時？完璧、それで大丈夫だよ............... そういえば、話してたプロジェクト終わった？............... すごいね！できると思ってたよ............... オーケー、もうすぐ着くよ。数分で会おう。電話ありがとう！",
      ko: "여보세요? 아, 안녕! 응, 지금 가고 있어............... 오 정말? 그거 꽤 웃기네! ............... 응, 지난번에 그런 일이 있었던 거 기억해. 교통은 나쁘지 않아서 15분 정도면 도착할 거야............... 잠깐, 뭐라고 했어? ............... 아, 회의가 여전히 오후 3시야? 완벽해, 나한테 괜찮아............... 그런데, 우리가 얘기했던 그 프로젝트 끝냈어? ............... 잘했어! 할 수 있을 줄 알았어............... 좋아, 거의 다 왔어. 몇 분 후에 봐. 전화해줘서 고마워!",
      ar: "مرحبا؟ أوه مرحبا! نعم، أنا في الطريق الآن............... حقا؟ هذا مضحك جدا! ............... نعم، أتذكر عندما حدث ذلك في المرة الأخيرة. حركة المرور ليست سيئة للغاية، يجب أن أصل في حوالي 15 دقيقة............... انتظر، ماذا قلت؟ ............... آه، الاجتماع لا يزال في الساعة 3 مساء؟ مثالي، هذا يناسبني............... بالمناسبة، هل أنهيت ذلك المشروع الذي تحدثنا عنه؟ ............... هذا رائع! كنت أعلم أنك تستطيع فعلها............... حسنا، أنا قريب الآن. سأراك في بضع دقائق. شكرا للاتصال!",
      hi: "हैलो? अरे हाय! हां, मैं अभी रास्ते में हूं............... ओह सच में? वह वास्तव में काफी मजेदार है! ............... हां, मुझे याद है जब पिछली बार ऐसा हुआ था। ट्रैफिक इतना बुरा नहीं है, मुझे लगभग 15 मिनट में पहुंचना चाहिए............... रुको, तुमने क्या कहा? ............... ओह, मीटिंग अभी भी दोपहर 3 बजे है? बढ़िया, यह मेरे लिए काम करता है............... वैसे, क्या तुमने वह प्रोजेक्ट खत्म कर लिया जिसके बारे में हमने बात की थी? ............... बहुत बढ़िया! मुझे पता था तुम यह कर सकते हो............... ठीक है, मैं करीब आ रहा हूं। कुछ मिनटों में मिलते हैं। कॉल करने के लिए धन्यवाद!",
      ru: "Алло? О, привет! Да, я сейчас в пути............... О, правда? Это довольно забавно! ............... Да, я помню, когда это случилось в прошлый раз. Пробки не такие сильные, я должен быть там примерно через 15 минут............... Подожди, что ты сказал? ............... А, встреча все еще в 3 часа дня? Отлично, мне подходит............... Кстати, ты закончил тот проект, о котором мы говорили? ............... Замечательно! Я знал, что ты справишься............... Хорошо, я уже близко. Увидимся через несколько минут. Спасибо за звонок!"
    }

    const script = conversationScripts[language] || conversationScripts.en

    // Voice IDs for Eleven Labs (you can customize these)
    const voiceId = '21m00Tcm4TlvDq8ikWAM' // Rachel voice (default)

    // Call Eleven Labs API
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': elevenLabsApiKey
        },
        body: JSON.stringify({
          text: script,
          model_id: 'eleven_multilingual_v2',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75
          }
        })
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Eleven Labs API error:', response.status, errorText)
      return res.status(response.status).json({
        success: false,
        message: `Eleven Labs API error: ${response.statusText}. Check your API key and quota.`
      })
    }

    console.log('Successfully generated audio from Eleven Labs')

    const audioBuffer = await response.arrayBuffer()
    
    res.set({
      'Content-Type': 'audio/mpeg',
      'Content-Length': audioBuffer.byteLength
    })
    
    res.send(Buffer.from(audioBuffer))
  } catch (error) {
    console.error('Fake call generation error:', error.message, error)
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to generate fake call'
    })
  }
})

// Interactive fake call - respond to user input
app.post('/api/fake-call/respond', requireAuth, async (req, res) => {
  try {
    const { language, userMessage, conversationHistory } = req.body
    const elevenLabsApiKey = process.env.ELEVENLABS_API_KEY
    const geminiApiKey = process.env.GEMINI_API_KEY

    if (!elevenLabsApiKey) {
      console.error('ELEVENLABS_API_KEY not configured in environment')
      return res.status(500).json({
        success: false,
        message: 'Eleven Labs API key not configured'
      })
    }

    if (!geminiApiKey) {
      console.error('GEMINI_API_KEY not configured in environment')
      return res.status(500).json({
        success: false,
        message: 'Gemini API key not configured'
      })
    }

    console.log(`Generating response to user message: "${userMessage}" in language: ${language}`)

    // Language-specific prompts for the AI to stay in character
    const languageNames = {
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

    const languageName = languageNames[language] || 'English'

    // Build conversation context
    let conversationContext = ''
    if (conversationHistory && conversationHistory.length > 0) {
      conversationContext = conversationHistory
        .slice(-6) // Last 3 exchanges
        .map(msg => `${msg.role === 'user' ? 'User' : 'You'}: ${msg.content}`)
        .join('\n')
    }

    // Generate contextual response using Gemini
    const prompt = `You are on a phone call with someone. You're playing the role of a friend who called them to chat about meeting up later. 

Respond naturally and conversationally in ${languageName} to what they just said: "${userMessage}"

${conversationContext ? `Previous conversation:\n${conversationContext}\n` : ''}

Important guidelines:
- Keep your response brief (1-3 sentences), like a natural phone conversation
- Sound friendly and casual
- Stay in character as someone discussing meeting up or plans
- React naturally to what they said
- If they ask a question, answer it appropriately
- If they seem like they want to end the call, be understanding and wrap up politely
- Respond ONLY in ${languageName}, no other language

Your response (in ${languageName}):`

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${geminiApiKey}`,
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
                  text: prompt
                }
              ]
            }
          ]
        })
      }
    )

    const geminiData = await geminiResponse.json()
    
    if (!geminiData.candidates || !geminiData.candidates[0] || !geminiData.candidates[0].content) {
      throw new Error('Invalid response from Gemini API')
    }

    const aiResponse = geminiData.candidates[0].content.parts[0].text.trim()
    console.log(`AI generated response: "${aiResponse}"`)

    // Convert response to speech using Eleven Labs
    const voiceId = '21m00Tcm4TlvDq8ikWAM' // Rachel voice

    const ttsResponse = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: 'POST',
        headers: {
          'Accept': 'audio/mpeg',
          'Content-Type': 'application/json',
          'xi-api-key': elevenLabsApiKey
        },
        body: JSON.stringify({
          text: aiResponse,
          model_id: 'eleven_multilingual_v2',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75
          }
        })
      }
    )

    if (!ttsResponse.ok) {
      const errorText = await ttsResponse.text()
      console.error('Eleven Labs API error:', ttsResponse.status, errorText)
      return res.status(ttsResponse.status).json({
        success: false,
        message: `Eleven Labs API error: ${ttsResponse.statusText}`
      })
    }

    console.log('Successfully generated interactive response audio')
    const audioBuffer = await ttsResponse.arrayBuffer()
    
    res.set({
      'Content-Type': 'audio/mpeg',
      'Content-Length': audioBuffer.byteLength
    })
    
    res.send(Buffer.from(audioBuffer))
  } catch (error) {
    console.error('Interactive call response error:', error.message, error)
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to generate response'
    })
  }
})

app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`)
})
