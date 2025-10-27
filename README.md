# QIC Gamified Insurance App - MVP

A gamified insurance application for QIC featuring missions, rewards, skill trees, and AI-powered scenarios.

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

## ✨ Features (MVP)

- **Health Dashboard**: System status and version info
- **Missions**: Start and complete gamified tasks
- **Scenarios**: AI-powered life scenario simulations  
- **Rewards**: Redeem coins for rewards
- **Skill Tree**: Unlock skills with XP
- **Social**: Friends list and leaderboard
- **Profile**: User profile management

## 🎨 Design

- **QIC Brand Colors**: Purple-blue primary (#5D44FF), green accent (#00D77F)
- **Clean UI**: White backgrounds, dark grey text
- **Responsive**: Works on desktop and mobile

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