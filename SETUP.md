# Hacklytics - Setup Guide

## Overview

This app allows users to:
1. Log into their Instagram account
2. Select a conversation
3. Upload and analyze it with an ML algorithm
4. View results with a progress bar

## Installation & Setup

### Prerequisites
- Node.js 18+ (for frontend and backend)
- Python 3.8+ (for Instagram API integration)
- npm or yarn

### Frontend Setup

1. Install frontend dependencies:
```bash
npm install
```

2. Start the frontend development server:
```bash
npm run dev
```

The frontend will run on `http://localhost:5173` (default Vite port)

### Backend Setup

1. Navigate to the backend directory:
```bash
cd backend
```

2. Install backend dependencies:
```bash
npm install express cors multer
```

3. Create a Python virtual environment (recommended):

**On Windows:**
```bash
python -m venv venv
venv\Scripts\activate
```

**On macOS/Linux:**
```bash
python3 -m venv venv
source venv/bin/activate
```

4. Install Python dependencies:
```bash
pip install -r requirements.txt
```

5. Start the backend server:
```bash
node server.js
```

The backend will run on `http://localhost:5000`

5.1 (Optional) Set up Gemini API key

To enable calling Google Gemini from the backend, place your API key in `backend/.env` or set the environment variable before starting the backend.

Copy the example file and edit it (do not commit real keys):

```powershell
cp backend\.env.example backend\.env
notepad backend\.env
```

Or set the variable directly in PowerShell before running the server:

```powershell
$env:GEMINI_API_KEY = 'YOUR_ACTUAL_TOKEN'
node backend/server.js
```

On macOS/Linux (bash/zsh):

```bash
export GEMINI_API_KEY='YOUR_ACTUAL_TOKEN'
node backend/server.js
```

If `GEMINI_API_KEY` is not set the backend will simulate a score for testing.

5.2 (Optional) Set up Eleven Labs API key for Fake Call feature

To enable the Fake Call feature with text-to-speech, add your Eleven Labs API key to `backend/.env`:

```dotenv
ELEVENLABS_API_KEY=your_eleven_labs_api_key_here
```

Get your API key from: https://elevenlabs.io/

The Fake Call feature allows users to:
- Simulate a phone call in their preferred language
- Use realistic text-to-speech audio (powered by Eleven Labs)
- Create the appearance of being on an important call for safety purposes

Without the API key, the fake call endpoint will return an error. The feature supports 12 languages including English, Spanish, French, German, Italian, Portuguese, Chinese, Japanese, Korean, Arabic, Hindi, and Russian.

### Running Both Frontend and Backend Concurrently

From the root directory, run both servers at once:
```bash
npm run dev:all
```

This requires the `concurrently` package (already in devDependencies).

## Architecture

### Frontend (React Components)

- **ButtonTab.jsx** - Panic Button UI: location, map, and audio recording

Note: The Conversation Analyzer component has been removed. The Panic Button is now the primary frontend feature and the home screen.

### Backend (Express Server)

- **server.js** - Express server with API endpoints:
  - `POST /api/instagram/login` - Authenticate with Instagram
  - `POST /api/instagram/conversations` - Fetch user's conversations
  - (Conversation analysis endpoints removed in this branch)

### Python Scripts (instagrapi Integration)

Located in `backend/python/`:

- **instagram_login.py** - Handles Instagram login using instagrapi
- **get_conversations.py** - Fetches list of conversations
- **fetch_conversation.py** - Fetches messages from a specific conversation

## API Endpoints

### 1. Instagram Login
```
POST /api/instagram/login
Content-Type: application/json

{
  "username": "your_instagram_username",
  "password": "your_instagram_password"
}

Response:
{
  "success": true,
  "message": "Login successful",
  "sessionId": "session_id",
  "userId": 12345
}
```

### 2. Get Conversations
```
POST /api/instagram/conversations
Content-Type: application/json

{
  "username": "your_instagram_username",
  "sessionId": "session_id"
}

Response:
{
  "success": true,
  "conversations": [
    {
      "thread_id": "123",
      "title": "Direct Message",
      "participants": [
        {
          "id": "456",
          "username": "friend_username",
          "full_name": "Friend Name"
        }
      ],
      "last_activity": "2024-02-21T10:30:00",
      "messages_count": 45
    }
  ]
}
```

> Conversation upload and ML analysis endpoints have been removed from this branch. The app now focuses on the Panic Button functionality.

### 5. Get Analysis Results
```
GET /api/analyze/username_friend_1708518600000

Response:
{
  "success": true,
  "conversation": {
    "id": "username_friend_1708518600000",
    "username": "your_instagram_username",
    "conversationWith": "friend_username",
    "fetchedAt": "2024-02-21T10:30:00",
    "messageCount": 45,
    "messages": [...],
    "analysis": {
      "status": "completed",
      "timestamp": "2024-02-21T10:35:00",
      "sentiment": "pending_ml_implementation",
      "topics": [],
      "summary": "ML analysis placeholder - to be implemented",
      "metrics": {
        "totalMessages": 45,
        "analyzedAt": "2024-02-21T10:35:00"
      }
    }
  }
}
```

## ML Algorithm Integration

The backend currently has a **placeholder** for ML analysis at `POST /api/analyze/process`. 

To implement your ML algorithm:

1. Replace the placeholder in `backend/server.js` (around line 190-210)
2. Add your ML processing logic to analyze the conversation data
3. Update the analysis result structure to include:
   - Sentiment analysis
   - Topic extraction
   - Custom metrics
   - Any other analysis results

The conversation data is stored as JSON at `backend/conversations/{conversationId}.json` for easy access.

## Progress Bar

The previous frontend conversation analysis flow (uploads, processing, progress bar) has been removed. The Panic Button UI does not include the analysis flow.

## Conversation Data Format

Conversations are stored as JSON with the following structure:

```json
{
  "id": "username_partner_timestamp",
  "username": "your_username",
  "conversationWith": "partner_username",
  "fetchedAt": "ISO-8601-timestamp",
  "messageCount": 45,
  "messages": [
    {
      "id": "msg_id",
      "from_user": "user_sending_message",
      "to_user": "user_receiving_message",
      "text": "message content",
      "type": "text",
      "timestamp": "ISO-8601-timestamp",
      "liked": false
    }
  ],
  "analysis": {
    "status": "completed",
    "timestamp": "ISO-8601-timestamp",
    "sentiment": "pending_ml_implementation",
    "topics": [],
    "summary": "ML analysis placeholder",
    "metrics": {
      "totalMessages": 45,
      "analyzedAt": "ISO-8601-timestamp"
    }
  }
}
```

## Important Notes

### Security Considerations
- **⚠️ Warning**: This implementation stores Instagram credentials temporarily during API calls
- For production, implement Instagram OAuth 2.0 instead of password-based login
- Use environment variables for sensitive configuration
- Add HTTPS and proper authentication to the backend

### Instagram API & 2FA
- Instagrapi is a reverse-engineered API and may require:
  - An Instagram session file to be created on first login
  - Challenge verification if Instagram detects unusual activity
  - Handling of 2FA if enabled on the account

### Storing Sessions
- The current implementation re-authenticates for each request
- For better performance, implement session persistence using instagrapi's built-in session management

## Troubleshooting

### Backend not starting
- Make sure port 5000 is available
- Check that Node.js and Python are properly installed
- Verify all dependencies are installed (`npm install` in both root and backend directories)

### Instagram login fails
- Check username and password
- May need to disable 2FA temporarily for testing
- Instagram might block login attempts from unusual locations (use VPN if needed)

### CORS errors
- Make sure backend is running on `http://localhost:5000`
- Frontend should be on `http://localhost:5173` (default Vite port)
- The `cors` package is already configured in the backend

### No conversations showing
- Make sure you have conversations in your Instagram DMs
- Check browser console for API errors

## Future Enhancements

- [ ] Implement Instagram OAuth instead of password login
- [ ] Add comprehensive ML analysis module
- [ ] Implement proper session management
- [ ] Add conversation caching
- [ ] Create data export functionality
- [ ] Add visualization of conversation sentiment over time
- [ ] Implement conversation comparison feature
- [ ] Add keyword extraction and NLP analysis

## File Structure

```
hacklytics/
├── src/
│   ├── components/
│   │   ├── ButtonTab.jsx
  │   └── ...
│   ├── App.jsx
│   └── ...
├── backend/
│   ├── server.js
│   ├── conversations/
│   ├── python/
│   │   ├── instagram_login.py
│   │   ├── get_conversations.py
│   │   └── fetch_conversation.py
│   └── requirements.txt
├── package.json
└── README.md
```

## Support

For issues with instagrapi, visit: https://github.com/subzeroid/instagrapi
