import express from 'express'
import cors from 'cors'
import multer from 'multer'
import { spawn } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const PORT = process.env.PORT || 5000

// Middleware
app.use(cors())
app.use(express.json())
app.use(express.urlencoded({ limit: '50mb', extended: true }))

// Storage for uploaded conversations
const upload = multer({ storage: multer.memoryStorage() })
const conversationsDir = path.join(__dirname, 'conversations')

// Ensure conversations directory exists
if (!fs.existsSync(conversationsDir)) {
  fs.mkdirSync(conversationsDir, { recursive: true })
}

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

app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`)
})
