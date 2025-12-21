# HALL - AI Communication Hub

Your AI-powered assistant for Email, WhatsApp, SMS, Calendar, Tasks, and Contacts.

## Project Structure

```
HALL/
├── frontend/          # Static web app (Vercel/Netlify)
│   ├── login.html
│   └── dashboard.html
├── backend/           # Node.js API (Railway/Render)
│   ├── server.js
│   ├── claude.js
│   ├── tools/
│   └── ...
└── README.md
```

## Quick Start

### 1. Clone & Push to GitHub

```bash
# Create new repo on GitHub, then:
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/hall.git
git push -u origin main
```

### 2. Deploy Frontend (Vercel)

1. Go to [vercel.com](https://vercel.com)
2. Import your GitHub repo
3. Set **Root Directory** to `frontend`
4. Deploy

Or use Netlify:
1. Go to [netlify.com](https://netlify.com)
2. Import repo → Set publish directory to `frontend`

### 3. Deploy Backend (Railway)

1. Go to [railway.app](https://railway.app)
2. New Project → Deploy from GitHub
3. Select repo → Set **Root Directory** to `backend`
4. Add environment variables (see below)
5. Deploy

### 4. Environment Variables (Backend)

```
ANTHROPIC_API_KEY=sk-ant-...
TWILIO_SID=AC...
TWILIO_AUTH=...
TWILIO_WHATSAPP_NUMBER=+19302057070
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=https://your-backend.railway.app/oauth/callback
GOOGLE_REFRESH_TOKEN=...
```

### 5. Get Google Refresh Token

```bash
cd backend
npm install
node auth-helper.js
```

### 6. Connect Twilio Webhook

In Twilio Console → WhatsApp Sandbox:
- Set webhook to `https://your-backend.railway.app/webhook/whatsapp`

## Local Development

```bash
# Frontend
cd frontend
npx serve .

# Backend
cd backend
npm install
cp .env.example .env
# Edit .env with your keys
npm run dev
```

## Tech Stack

- **Frontend**: HTML, CSS (no framework)
- **Backend**: Node.js, Express
- **AI**: Claude API (Anthropic)
- **Integrations**: Gmail, Google Calendar, Google Contacts, Google Tasks, Twilio

## License

MIT
