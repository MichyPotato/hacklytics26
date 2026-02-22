# Hacklytics - Personal Safety App

A comprehensive personal safety application with panic button functionality, real-time location tracking, voice transcription, AI-powered analysis, and a fake call feature for emergency situations.

## Features

### 🚨 Panic Button
- Real-time location tracking with map visualization
- Live voice recording with automatic transcription
- AI-powered threat analysis using Google Gemini
- Automatic 911 alert for critical situations (urgency > 7/10)
- Save and export emergency encounter data

### 📞 Fake Call Feature
- Simulate realistic phone calls for safety
- Multi-language support (12 languages)
- Text-to-speech powered by Eleven Labs
- Customizable preferred language per user account
- Full-screen call interface for authenticity

### 👤 User Profiles
- Secure authentication with JWT
- Save home and work/school locations
- Set preferred language for fake calls
- Persistent user settings

### 🗺️ Location Features
- Interactive map with OpenStreetMap
- Distance calculations between saved locations
- Real-time GPS tracking
- Location context for AI analysis

## Quick Start

### Prerequisites
- Node.js 18+
- Python 3.8+
- npm or yarn

### Installation

1. **Install dependencies:**
```bash
npm install
```

2. **Set up backend environment:**
```bash
cd backend
cp .env.example .env
```

Edit `backend/.env` and add your API keys:
```dotenv
GEMINI_API_KEY=your_gemini_api_key
ELEVENLABS_API_KEY=your_eleven_labs_api_key
JWT_SECRET=your_jwt_secret
```

3. **Install Python dependencies:**
```bash
cd backend
python -m venv venv
# On Windows:
venv\Scripts\activate
# On macOS/Linux:
source venv/bin/activate

pip install -r requirements.txt
```

### Running the App

**Run both frontend and backend:**
```bash
npm run dev:all
```

Or run them separately:

**Frontend only:**
```bash
npm run dev
```
Opens at `http://localhost:5173`

**Backend only:**
```bash
npm run dev:backend
```
Runs at `http://localhost:5000`

## Fake Call Feature

The fake call feature helps users create the appearance of being on an important phone call, which can be useful for:
- Walking alone at night
- Uncomfortable social situations
- Any scenario where appearing occupied provides safety

### How It Works

1. **Set Your Language** (Profile page):
   - Choose from 12 supported languages
   - Language preference is saved to your account

2. **Start a Call** (Fake Call page):
   - Click "Start Call" to begin
   - Realistic call interface appears
   - AI-generated voice conversation plays in your selected language
   - Timer shows call duration

3. **End the Call**:
   - Click "End Call" to stop
   - Returns you to the home screen

### Supported Languages

- English
- Spanish (Español)
- French (Français)
- German (Deutsch)
- Italian (Italiano)
- Portuguese (Português)
- Chinese (中文)
- Japanese (日本語)
- Korean (한국어)
- Arabic (العربية)
- Hindi (हिन्दी)
- Russian (Русский)

## API Keys

### Gemini API (Google AI)
Get your key from: https://makersuite.google.com/app/apikey
- Used for analyzing recorded conversations
- Provides threat assessment and recommended actions

### Eleven Labs API
Get your key from: https://elevenlabs.io/
- Powers text-to-speech for fake calls
- Supports multilingual voice generation
- Free tier available for testing

## Technology Stack

### Frontend
- React 18
- Vite
- React Router
- Leaflet (maps)
- Web Speech API (transcription)

### Backend
- Express.js
- SQLite3
- JWT authentication
- bcrypt for password hashing
- Multer for file uploads

### APIs & Services
- Google Gemini (AI analysis)
- Eleven Labs (text-to-speech)
- OpenStreetMap (geocoding & maps)

## Architecture

### Database Schema

```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  home_location TEXT,
  work_location TEXT,
  preferred_language TEXT DEFAULT 'en',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

### API Endpoints

#### Authentication
- `POST /api/auth/signup` - Create new account
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Get current user

#### Profile
- `PUT /api/profile/locations` - Update saved locations
- `PUT /api/profile/language` - Update preferred language

#### Fake Call
- `POST /api/fake-call/generate` - Generate call audio (requires auth)

#### Analysis (Panic Button)
- `POST /api/analyze-transcript` - Analyze conversation transcript

## Development

### Project Structure
```
hacklytics/
├── src/
│   ├── components/     # React components
│   ├── pages/         # Page components
│   ├── context/       # React context (Auth)
│   └── App.jsx        # Main app component
├── backend/
│   ├── server.js      # Express server
│   ├── db.js          # Database functions
│   ├── python/        # Instagram integration scripts
│   └── conversations/ # Stored conversations
└── package.json
```

### Adding New Languages

To add support for a new language in fake calls:

1. **Update ProfilePage.jsx** - Add option to language selector
2. **Update FakeCallPage.jsx** - Add language name mapping
3. **Update server.js** - Add conversation script for the language

## Security Notes

⚠️ **Important Security Considerations:**
- Never commit `.env` files with real API keys
- Use HTTPS in production
- Keep JWT_SECRET secure and random
- Consider rate limiting for API endpoints
- Instagram integration stores credentials temporarily

## Future Enhancements

- [ ] Real 911 integration (location-based)
- [ ] Emergency contact notifications
- [ ] Video call simulation option
- [ ] More language support
- [ ] Custom conversation scripts
- [ ] Offline mode with cached audio
- [ ] Apple Watch / Android Wear integration
- [ ] Share location with trusted contacts

## Support

For detailed setup instructions, see [SETUP.md](SETUP.md)

For Instagram integration issues:
- GitHub: https://github.com/subzeroid/instagrapi
- Note: May require session management for 2FA accounts

## License

This project was created for Hacklytics hackathon.

