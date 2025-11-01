# QIC Life - Track 1 Hackathon: AI + Gamification

A gamified insurance application for QIC featuring AI-powered personalization, missions, rewards, and scenario simulations aligned with Track 1 hackathon brief.

## ⚠️ IMPORTANT: Backend Must Be Running

**The frontend requires the backend server to be running.** If you see "Backend server unavailable" errors, start the backend first.

### Quick Start (One Command)
```bash
npm run dev:fresh
```
This will:
1. Kill any processes on ports 3001 and 8080
2. Start both backend and frontend servers

### Manual Start
```bash
# Option A: Run both together (recommended)
npm run dev:both

# Option B: Run separately
# Terminal 1: Start Backend
cd backend
npm run dev

# Terminal 2: Start Frontend  
npm run dev
```

## 🚀 Quick Start (MVP)

### Prerequisites
- Node.js 18+ 
- npm

### 1. Clone and Install
```bash
git clone <repository-url>
cd qiclife
npm install
cd backend && npm install
```

### 2. Environment Setup
```bash
# Copy environment template (optional - MVP works with defaults)
cp env.example .env
```

### 3. Run the Application
```bash
# Recommended: One command to start everything
npm run dev:fresh

# Alternative: Start both together
npm run dev:both
```

### 4. Open Application
- Frontend: http://localhost:8080
- Backend API: http://localhost:3001

**Note:** The app will show a banner if the backend is not running. Use offline fallbacks are available in development mode, but full functionality requires the backend.

### 🧪 Testing

**Testing Standards: Always test actual user workflows, not just API endpoints.**

**⚠️ Note:** Most tests require the backend to be running. Start it with `npm run dev:both` first.

```bash
# Mission workflow testing (comprehensive)
npm run test:missions

# End-to-end workflow testing (recommended)
npm run test:e2e

# User interaction testing
npm run test:interactions

# Run all workflow tests
npm run test:workflows

# Run all tests including mission tests
npm run test:all
```

**Mission Workflow Tests** (`npm run test:missions`) validates:
- Profile completion check
- AI mission generation
- Mission start with 3-step plan
- Step retrieval
- Mission completion with correct coin rewards
- Exclusive offers filtering

These tests validate complete user journeys (e.g., "User simulates scenario on Showcase page") rather than just checking if endpoints return 200. This catches real bugs like null reference errors, missing error handling, and data flow issues.

See `TESTING_STANDARDS.md` for the complete testing approach.

### 🔧 Troubleshooting

**Port already in use errors:**
```bash
# Kill processes on ports 3001 and 8080, then restart
npm run kill-ports
npm run dev:both

# Or use the combined command
npm run dev:fresh
```

**Connection refused errors:**
- Ensure both frontend and backend are running
- Check that backend is on port 3001: `http://localhost:3001/api/health`
- Check browser console for proxy errors
- Verify `vite.config.ts` proxy points to `http://localhost:3001`

**Frontend/Backend out of sync:**
- Kill both: `npm run kill-ports`
- Restart: `npm run dev:both`
- Clear browser cache if issues persist

## ✨ Features (Track 1 Aligned)

- **AI LifeScore Engine**: Dynamic 0-100 metric aggregating behavior data for perks
- **AI Personalized Missions**: Adaptive daily/weekly challenges driving product discovery
- **Scenario Simulation**: What-if AI projections for decision modeling
- **Rewards Hub**: Coins-to-offers conversion with Temu-like shopping experience
- **Leaderboards & Social Proof**: Optional competitive scores and shared missions
- **Onboarding Quiz**: Personalization mechanism feeding into AI recommendations
- **Health Dashboard**: System monitoring and status

## 🎯 Track 1 Hackathon Focus

**Core Concept**: AI Life Companion that learns from user behavior to create engagement loop:
**Behavior → AI Insight → Mission → Reward → Improved LifeScore → Cross-sell Opportunity**

**Key Features**:
- **LifeScore Engine**: Aggregates behavior data for perks (0-100 scale)
- **Personalized Missions**: AI-created adaptive challenges for safe driving, policy reviews
- **Scenario Simulation**: What-if projections for life decisions
- **Rewards Hub**: Temu-like shopping with coins, discounts, partner offers
- **Social Features**: Optional leaderboards and collaborative missions

## 🔧 Technical Stack

### Frontend
- React 18 + TypeScript
- Vite (build tool)
- Axios (API client)
- React Router (navigation)

### Backend  
- Node.js + Express
- Session-based authentication
- Mock database (in-memory)
- Winston logging

## 📁 Project Structure

```
qiclife/
├── src/                    # Frontend React app
│   ├── pages/             # Page components
│   ├── lib/               # API client & utilities
│   └── main.tsx           # App entry point
├── backend/               # Backend Express server
│   ├── routes/            # API endpoints
│   ├── services/          # Business logic
│   └── middleware/        # Auth, validation, etc.
├── scripts/               # Utility scripts
└── env.example           # Environment template
```

## 🧪 Testing

Run API tests:
```bash
powershell -File .\scripts\test-api.ps1
```

## 🔒 Security

- Session-based authentication (no external auth required)
- CORS configured for localhost
- Input validation on all endpoints
- No sensitive data in MVP

## 📝 Environment Variables

See `env.example` for all available options. MVP works with defaults - no external services required.

## 🚀 Deployment

### Frontend (Vercel - Recommended)

1. **Build the frontend:**
   ```bash
   npm run build
   ```

2. **Set environment variables in Vercel:**
   - `VITE_API_BASE_URL`: Your backend URL (e.g., `https://api.yourdomain.com`)
   - Other env vars as needed from `env.example`

3. **Deploy:**
   - Connect your GitHub repo to Vercel
   - Vercel will auto-detect Vite and build
   - Or use Vercel CLI: `vercel --prod`

### Backend (Render, Railway, or similar)

1. **Set environment variables:**
   - `NODE_ENV=production`
   - `PORT=3001` (or use platform default)
   - `CORS_ORIGIN`: Your frontend URL (e.g., `https://app.yourdomain.com`)
   - Supabase/OpenAI keys as needed

2. **Deploy:**
   - Connect your repo to Render/Railway
   - Set build command: `npm install`
   - Set start command: `npm start` (or `node server.js`)
   - Ensure port binding works with platform

### Full Stack Deployment

**Option A: Separate domains**
- Frontend: `https://app.yourdomain.com` (Vercel)
- Backend: `https://api.yourdomain.com` (Render)
- Set `VITE_API_BASE_URL=https://api.yourdomain.com` in frontend

**Option B: Monorepo on single platform**
- Use platforms that support monorepos (Railway, Render)
- Deploy both frontend and backend
- Configure build/start commands accordingly

### Local Production Build

```bash
# Frontend
npm run build
npm run preview  # Test production build locally

# Backend
cd backend
npm install
NODE_ENV=production npm start
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

Private - QIC Internal Use Only