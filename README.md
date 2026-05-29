# Claude-to-Salesforce Customer Service Demo

A demo app showing Claude as a headless connection to Salesforce. Customers chat in a Claude-style interface and records (Cases, Tasks) are created automatically in a real Salesforce org.

## Architecture

```
[Browser - claude.ai-style UI]
    ↕ REST API
[Node.js + Express server on Heroku]
    ↕ Salesforce REST API (OAuth Connected App)
[Salesforce Org - Cases, Tasks, Contacts]
```

## Setup

### 1. Clone and install

```bash
git clone https://github.com/brendansheridan/anthropicprototype.git
cd anthropicprototype
npm install
```

### 2. Configure Salesforce Connected App

1. In Salesforce Setup, create a Connected App with OAuth enabled
2. Set callback URL to `https://login.salesforce.com/services/oauth2/callback`
3. Select scopes: `api`, `refresh_token`
4. Obtain a refresh token via the OAuth web flow

### 3. Set environment variables

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

Required variables:
- `SF_LOGIN_URL` — e.g., `https://login.salesforce.com`
- `SF_CLIENT_ID` — Connected App consumer key
- `SF_CLIENT_SECRET` — Connected App consumer secret
- `SF_REFRESH_TOKEN` — OAuth refresh token
- `SF_INSTANCE_URL` — e.g., `https://yourorg.my.salesforce.com`

### 4. Run locally

```bash
npm start
```

Open http://localhost:3000

## Deploy to Heroku

```bash
heroku create your-app-name
heroku config:set SF_LOGIN_URL=https://login.salesforce.com
heroku config:set SF_CLIENT_ID=your_key
heroku config:set SF_CLIENT_SECRET=your_secret
heroku config:set SF_REFRESH_TOKEN=your_token
heroku config:set SF_INSTANCE_URL=https://yourorg.my.salesforce.com
git push heroku main
```

## Demo Flow

1. Customer says hello → Claude greets and asks how it can help
2. Customer describes an issue → Claude creates a **real Case in Salesforce**
3. Claude confirms case number and asks if anything else is needed
4. If customer requests follow-up → Claude creates a **real Task in Salesforce**
5. Claude wraps up with case reference number

## File Structure

```
├── server.js          # Express server + API routes
├── sf.js              # Salesforce REST API helper
├── conversation.js    # Scripted AI response logic
├── public/
│   ├── index.html     # Claude-style chat UI
│   ├── styles.css     # Dark theme styling
│   └── app.js         # Frontend chat logic
├── package.json       # Dependencies + scripts
├── Procfile           # Heroku process file
├── .env.example       # Template for env vars
└── .gitignore
```
