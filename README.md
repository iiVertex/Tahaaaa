# QIC Life - Track 1 Hackathon: AI + Gamification

A gamified insurance application for QIC featuring AI-powered personalization, missions, rewards, and scenario simulations aligned with Track 1 hackathon brief.

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
# Terminal 1: Start Backend
cd backend
npm run dev

# Terminal 2: Start Frontend  
npm run dev
```

### 4. Open Application
- Frontend: http://localhost:8080
- Backend API: http://localhost:3001

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

1. Build frontend: `npm run build`
2. Start backend: `cd backend && npm start`
3. Serve frontend: `npm run preview`

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

Private - QIC Internal Use Only