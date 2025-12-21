# HALL Backend

AI assistant backend using Claude API with tool-calling for Gmail, Calendar, Contacts, and Tasks.

## Setup

### 1. Install dependencies
```bash
cd backend
npm install
```

### 2. Get API Keys

**Anthropic:**
- Get key from https://console.anthropic.com

**Google OAuth:**
1. Go to https://console.cloud.google.com
2. Create project → Enable APIs:
   - Gmail API
   - Google Calendar API
   - People API
   - Tasks API
3. Create OAuth 2.0 credentials (Web app)
4. Set redirect URI to `http://localhost:3000/oauth/callback`
5. Run the auth helper to get refresh token:
   ```bash
   node auth-helper.js
   ```

**Twilio:**
- Get SID/Auth from https://console.twilio.com
- Set up WhatsApp sandbox or approved number

### 3. Configure environment
```bash
cp .env.example .env
# Edit .env with your keys
```

### 4. Run
```bash
npm start
# or for dev with auto-reload:
npm run dev
```

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/webhook/whatsapp` | Twilio WhatsApp webhook |
| POST | `/chat` | Dev endpoint for testing |
| GET | `/health` | Health check |

## Testing (without Twilio)

```bash
curl -X POST http://localhost:3000/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "What meetings do I have today?"}'
```

## Deploy

Recommended: Railway, Render, or Fly.io

```bash
# Railway
railway login
railway init
railway up
```

Set environment variables in your hosting dashboard.

## Twilio Webhook Setup

1. Get your deployed URL
2. In Twilio Console → WhatsApp Sandbox
3. Set webhook URL to `https://your-domain.com/webhook/whatsapp`
