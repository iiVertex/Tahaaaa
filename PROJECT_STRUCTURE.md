# 🏗️ QIC Life - Comprehensive Project Structure Analysis

## 📊 Project Overview

**QIC Life** is a **gamified insurance application** designed for Qatar Insurance Company (QIC). It transforms traditional insurance engagement into an interactive, game-like experience with missions, rewards, skill progression, AI-powered scenarios, and social features.

---

## 🎯 Project Type & Architecture

### **Architecture Pattern**: Monorepo with Separate Frontend/Backend
- **Frontend**: React SPA (Single Page Application)
- **Backend**: RESTful API (Node.js/Express)
- **Database**: Supabase (PostgreSQL) - Currently using mock data
- **Deployment**: Separated concerns for scalability

### **Technology Stack Summary**

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Frontend** | React 18 + TypeScript + Vite | Modern, fast UI development |
| **UI Framework** | Radix UI + Tailwind CSS + shadcn/ui | Accessible, customizable components |
| **Routing** | React Router v6 | Client-side navigation |
| **API Client** | Axios | HTTP requests with interceptors |
| **Backend** | Node.js + Express | RESTful API server |
| **Security** | Helmet + CORS + Rate Limiting | Production-grade security |
| **Validation** | Joi | Request validation |
| **Logging** | Winston | Structured logging |
| **Database** | Supabase (PostgreSQL) | Cloud-hosted PostgreSQL with Auth |
| **Build Tool** | Vite | Fast development & bundling |
| **Package Manager** | npm | Dependency management |

---

## 📁 Detailed Directory Structure

\`\`\`
qiclife/
│
├── 📱 FRONTEND (React/TypeScript/Vite)
│   │
│   ├── src/                          # Frontend source code
│   │   ├── App.tsx                   # Main app component with routing
│   │   ├── main.tsx                  # App entry point (renders to DOM)
│   │   ├── index.css                 # Global styles (Tailwind + CSS variables)
│   │   │
│   │   ├── pages/                    # Page components (route views)
│   │   │   ├── Health.tsx            # Backend health/status dashboard
│   │   │   ├── Missions.tsx          # Gamified tasks & missions
│   │   │   ├── Profile.tsx           # User profile & stats
│   │   │   ├── Rewards.tsx           # Rewards shop (redeem coins)
│   │   │   ├── Scenarios.tsx         # AI scenario simulations
│   │   │   ├── SkillTree.tsx         # Skills & progression tree
│   │   │   └── Social.tsx            # Friends & leaderboard
│   │   │
│   │   ├── lib/                      # Utilities & business logic
│   │   │   ├── api.ts                # API client (Axios wrapper)
│   │   │   └── session.ts            # Session ID management
│   │   │
│   │   └── components/               # Reusable UI components (currently empty)
│   │
│   ├── public/                       # Static assets
│   ├── index.html                    # HTML entry point
│   ├── vite.config.ts                # Vite configuration
│   ├── tailwind.config.ts            # Tailwind CSS configuration
│   ├── tsconfig.json                 # TypeScript configuration
│   ├── components.json               # shadcn/ui component config
│   ├── .env                          # Frontend environment variables
│   └── package.json                  # Frontend dependencies
│
├── 🖥️ BACKEND (Node.js/Express)
│   │
│   ├── backend/
│   │   ├── server.js                 # Express server entry point
│   │   │
│   │   ├── routes/                   # API endpoint definitions
│   │   │   ├── health.js             # Health check endpoint
│   │   │   ├── missions.js           # Missions CRUD & actions
│   │   │   ├── profile.js            # User profile management
│   │   │   ├── rewards.js            # Rewards shop operations
│   │   │   ├── scenarios.js          # AI scenario simulations
│   │   │   ├── skillTree.js          # Skill progression
│   │   │   ├── social.js             # Friends & leaderboard
│   │   │   ├── ai.js                 # AI-powered features
│   │   │   └── onboarding.js         # User onboarding flow
│   │   │
│   │   ├── services/                 # Business logic layer
│   │   │   ├── ai.service.js         # AI integration (Lovable API)
│   │   │   ├── gamification.service.js  # Game mechanics (XP, levels, etc.)
│   │   │   └── supabase.js           # Supabase client & queries
│   │   │
│   │   ├── middleware/               # Express middleware
│   │   │   ├── security.js           # CORS, Helmet, Rate limiting
│   │   │   ├── auth.js               # Session authentication
│   │   │   ├── validation.js         # Request validation (Joi)
│   │   │   └── errorHandler.js       # Centralized error handling
│   │   │
│   │   ├── utils/                    # Utility functions
│   │   │   ├── logger.js             # Winston logging setup
│   │   │   └── encryption.js         # Data encryption utilities
│   │   │
│   │   ├── logs/                     # Application logs (auto-generated)
│   │   ├── .env                      # Backend environment variables
│   │   └── package.json              # Backend dependencies
│   │
│
├── 🗄️ DATABASE (Supabase Schema)
│   │
│   ├── supabase/
│   │   ├── schema.sql                # Full database schema (production)
│   │   ├── schema-simplified.sql     # Simplified schema (MVP)
│   │   ├── schema-session.sql        # Session-based auth schema
│   │   └── schema-backend-additional.sql  # Additional tables
│   │
│
├── 🛠️ CONFIGURATION & TOOLING
│   │
│   ├── scripts/
│   │   └── test-api.ps1              # PowerShell API testing script
│   │
│   ├── .cursor/                      # Cursor IDE settings
│   ├── .git/                         # Git repository
│   ├── .gitignore                    # Git ignore rules
│   ├── .env                          # Root environment variables
│   ├── env.example                   # Environment template
│   ├── setup-env.js                  # Environment setup script
│   │
│   ├── eslint.config.js              # ESLint configuration
│   ├── tsconfig.app.json             # TypeScript app config
│   ├── tsconfig.node.json            # TypeScript Node config
│   │
│   ├── README.md                     # Project documentation
│   ├── SETUP.md                      # Setup instructions
│   ├── START_HERE.md                 # Quick start guide (CREATED)
│   └── package.json                  # Root package (workspace config)
│
└── 📦 node_modules/                  # Dependencies (frontend & backend)
\`\`\`

---

## 🔑 Core Features & Functionality

### 1️⃣ **Missions System** (Gamification Core)
- **What**: Daily/weekly tasks users complete to earn rewards
- **Features**: Start, complete, track progress, collaborative missions
- **Endpoints**: \`GET /api/missions\`, \`POST /api/missions/start\`, \`POST /api/missions/complete\`
- **Database**: \`missions\`, \`user_missions\` tables
- **UI**: Mission cards with progress, XP rewards, difficulty badges

### 2️⃣ **Rewards Shop**
- **What**: Redeem earned coins for digital/physical rewards
- **Features**: Browse rewards, redeem with coins, track redemptions
- **Endpoints**: \`GET /api/rewards\`, \`POST /api/rewards/redeem\`
- **Database**: \`rewards\`, \`user_rewards\` tables
- **UI**: Card grid with coin costs, redemption buttons

### 3️⃣ **Skill Tree** (Progression System)
- **What**: RPG-style skill unlocking with XP
- **Features**: View skills, unlock with XP, skill dependencies
- **Endpoints**: \`GET /api/skill-tree\`, \`POST /api/skill-tree/unlock\`
- **Database**: \`skill_trees\`, \`user_skills\` tables
- **UI**: Tree visualization with locked/unlocked states

### 4️⃣ **AI Scenarios** (Personalization)
- **What**: AI-generated life insurance scenarios based on user data
- **Features**: Simulate scenarios, get recommendations
- **Endpoints**: \`POST /api/scenarios/simulate\`
- **Database**: \`scenarios\`, \`user_scenarios\` tables
- **UI**: Input form → AI simulation → Results display

### 5️⃣ **Social Features**
- **What**: Friends, leaderboards, social engagement
- **Features**: Add friends, view leaderboard, compare stats
- **Endpoints**: \`GET /api/social/friends\`, \`GET /api/social/leaderboard\`
- **Database**: \`social_connections\`, user stats
- **UI**: Friends list + leaderboard with rankings

### 6️⃣ **Profile Management**
- **What**: User profile, stats, settings
- **Features**: View/update profile, track XP/level/coins
- **Endpoints**: \`GET /api/profile\`, \`PUT /api/profile\`
- **Database**: \`users\`, \`user_stats\` tables
- **UI**: Profile form with stats dashboard

### 7️⃣ **Health Dashboard**
- **What**: Backend system monitoring
- **Features**: API health check, version info
- **Endpoints**: \`GET /api/health\`
- **UI**: Status cards with connection indicators

---

## 🔐 Authentication & Security

### **Current Implementation**: Session-Based Auth
- **No external auth provider** (Clerk/Auth0 mentioned but not used in MVP)
- **Session ID**: Generated client-side, stored in localStorage
- **Header**: \`x-session-id\` sent with every request
- **Security Middleware**:
  - ✅ **CORS**: Restricts origins (\`localhost:8080,8081,5173\`)
  - ✅ **Helmet**: Security headers (CSP, XSS protection)
  - ✅ **Rate Limiting**: 100 requests per 15 minutes per IP
  - ✅ **Input Validation**: Joi schemas on all endpoints
  - ✅ **Error Handling**: Centralized error middleware

### **Security Layers**:
\`\`\`
Request → CORS → Helmet → Rate Limiter → Session Auth → Validation → Handler → Response
\`\`\`

---

## 🗃️ Database Schema (Supabase)

### **Key Tables**:

| Table | Purpose | Key Fields |
|-------|---------|-----------|
| \`users\` | Core user data | email, xp, level, coins, lifescore, streak_days |
| \`missions\` | Available missions | category, difficulty, xp_reward, requirements |
| \`user_missions\` | User progress | user_id, mission_id, status, progress, started_at |
| \`skill_trees\` | Skill definitions | title, description, xp_cost, prerequisites |
| \`user_skills\` | Unlocked skills | user_id, skill_id, unlocked_at |
| \`rewards\` | Reward catalog | category, rarity, coins_cost, stock |
| \`user_rewards\` | Redemptions | user_id, reward_id, redeemed_at |
| \`scenarios\` | AI scenarios | risk_level, recommendations |
| \`social_connections\` | Friend system | user_id, friend_id, status |
| \`collaborative_missions\` | Team missions | participants, requirements |

### **Database Features**:
- ✅ UUID primary keys
- ✅ Foreign key constraints with CASCADE deletes
- ✅ Check constraints for data integrity
- ✅ JSONB fields for flexible data
- ✅ Timestamps (created_at, updated_at)
- ✅ Row Level Security (RLS) policies (in full schema)
- ✅ Indexes for performance

---

## 🎨 Design System & UI

### **Brand Colors**:
- **Primary**: \`#5D44FF\` (Deep Purple-Blue) - QIC brand
- **Accent**: \`#00D77F\` (Lime/Mint Green) - Success, rewards
- **Background**: \`#F5F6FA\` (Soft Grey) - App background
- **Surface**: \`#FFFFFF\` (White) - Cards, panels
- **Text**: \`#2E2E2E\` (Dark Grey) - Body text
- **Muted**: \`#6b7280\` (Grey) - Secondary text
- **Border**: \`#E6E8EE\` (Light Grey) - Subtle borders

### **Component Library**:
- **Radix UI**: 40+ headless components (accordion, dialog, dropdown, etc.)
- **shadcn/ui**: Pre-styled Radix components with Tailwind
- **Tailwind CSS**: Utility-first styling
- **Lucide React**: Icon library (currently NOT used - should be added)

### **Responsive Breakpoints**:
- **Mobile**: < 768px
- **Tablet**: 768px - 1024px
- **Desktop**: > 1024px

---

## 🔄 Data Flow & API Communication

### **Request Flow**:
\`\`\`
Frontend (React)
    ↓
    ├─ lib/api.ts (Axios client)
    │   └─ baseURL: http://localhost:3001/api
    │   └─ headers: { 'x-session-id': sessionId }
    ↓
Backend (Express)
    ├─ Middleware Stack
    │   ├─ Security (CORS, Helmet, Rate Limit)
    │   ├─ Body Parser (JSON, URL-encoded)
    │   ├─ Logger (Winston)
    │   └─ Auth (Session validation)
    ↓
    ├─ Routes (/api/*)
    │   └─ Validation (Joi schemas)
    ↓
    ├─ Services (Business Logic)
    │   ├─ gamification.service.js (XP, levels)
    │   ├─ ai.service.js (Lovable API)
    │   └─ supabase.js (Database queries)
    ↓
Database (Supabase/PostgreSQL)
    └─ Returns data
    ↓
Backend → Frontend (JSON response)
\`\`\`

### **API Endpoints Structure**:
\`\`\`
/api/health          GET    Health check
/api/missions        GET    List missions
/api/missions/start  POST   Start a mission
/api/missions/complete POST Complete a mission
/api/rewards         GET    List rewards
/api/rewards/redeem  POST   Redeem reward
/api/skill-tree      GET    Get skill tree
/api/skill-tree/unlock POST Unlock skill
/api/scenarios/simulate POST Simulate scenario
/api/social/friends  GET    Get friends list
/api/social/leaderboard GET Get leaderboard
/api/profile         GET    Get user profile
/api/profile         PUT    Update profile
/api/onboarding      POST   User onboarding
/api/ai/*            *      AI-powered endpoints
\`\`\`

---

## 🚀 Development Workflow

### **Installation**:
\`\`\`bash
# Install frontend dependencies
npm install

# Install backend dependencies
cd backend
npm install
\`\`\`

### **Running the Application**:

**Option 1: Run Both (Recommended)**
\`\`\`bash
npm run dev:all
\`\`\`
- Frontend: http://localhost:8080
- Backend: http://localhost:3001

**Option 2: Separate Terminals**
\`\`\`bash
# Terminal 1 - Frontend
npm run dev

# Terminal 2 - Backend
npm run backend:dev
\`\`\`

### **Available Scripts**:

| Command | Purpose |
|---------|---------|
| \`npm run dev\` | Start frontend only (Vite) |
| \`npm run dev:all\` | Start frontend + backend (concurrently) |
| \`npm run backend:dev\` | Start backend only (watch mode) |
| \`npm run build\` | Build frontend for production |
| \`npm run lint\` | Run ESLint |
| \`npm run setup:env\` | Setup environment variables |

---

## 📦 Dependencies Breakdown

### **Frontend Dependencies (Key)**:
- **React Ecosystem**: react, react-dom, react-router-dom
- **State Management**: @tanstack/react-query (data fetching)
- **Forms**: react-hook-form, @hookform/resolvers, zod
- **UI Components**: 40+ @radix-ui/* packages
- **Styling**: tailwindcss, clsx, class-variance-authority
- **HTTP**: axios
- **Database**: @supabase/supabase-js
- **Icons**: lucide-react
- **Charts**: recharts
- **Notifications**: sonner

### **Backend Dependencies (Key)**:
- **Server**: express
- **Security**: helmet, cors, express-rate-limit
- **Validation**: joi
- **Auth**: jsonwebtoken
- **Database**: @supabase/supabase-js
- **HTTP Client**: axios
- **Logging**: winston
- **Environment**: dotenv
- **Encryption**: (custom utils/encryption.js)

---

## 🔧 Configuration Files

| File | Purpose |
|------|---------|
| \`vite.config.ts\` | Vite config (port 8080, @ alias) |
| \`tailwind.config.ts\` | Tailwind theme, colors, plugins |
| \`tsconfig.json\` | TypeScript compiler options |
| \`eslint.config.js\` | ESLint rules |
| \`components.json\` | shadcn/ui component config |
| \`.env\` | Environment variables (both root & backend) |

---

## 🐛 Current State & Issues

### **✅ Working**:
- Backend API running on port 3001
- Frontend running on port 8080
- API communication established
- Session-based auth functional
- All endpoints responding
- CORS configured for localhost

### **⚠️ Needs Attention**:
- Components folder is empty (no reusable components)
- Lucide icons installed but not used in UI
- Social feed returns object but typed as array (FIXED)
- No actual Supabase connection (using mock data)
- No real AI integration (placeholder responses)
- No authentication beyond session IDs
- No tests written

### **🚧 MVP Limitations**:
- In-memory data (no persistent database yet)
- Mock friends & leaderboard data
- Basic error handling
- No real-time features
- No mobile app (web only)
- No production deployment setup

---

## 🎯 Architecture Patterns

### **Frontend Patterns**:
- **Component-Based Architecture**: React functional components
- **Client-Side Routing**: React Router
- **Centralized API Client**: Single axios instance with interceptors
- **Session Management**: localStorage-based session IDs
- **Type Safety**: TypeScript throughout

### **Backend Patterns**:
- **Layered Architecture**: Routes → Services → Database
- **Middleware Pipeline**: Security → Auth → Validation → Handler
- **Error Handling**: Centralized error middleware
- **Logging**: Structured logging with Winston
- **Modular Routes**: Each feature has its own route file

### **Database Patterns**:
- **Relational Model**: Normalized tables with foreign keys
- **Soft Deletes**: (not implemented yet)
- **Audit Trails**: created_at, updated_at timestamps
- **Flexible Data**: JSONB for dynamic fields

---

## 📊 Summary Statistics

- **Total Files**: ~100+ (including node_modules)
- **Frontend Pages**: 7 (Health, Missions, Scenarios, Rewards, SkillTree, Social, Profile)
- **Backend Routes**: 9 route files
- **API Endpoints**: ~20+ endpoints
- **Database Tables**: 12+ tables (in full schema)
- **Dependencies**: 70+ frontend, 10+ backend
- **Lines of Code**: ~5,000+ (estimated, excluding dependencies)

---

## 🎓 Key Takeaways

1. **Modern Stack**: Uses latest React, Vite, TypeScript, Tailwind
2. **Monorepo Structure**: Frontend + Backend in same project
3. **Gamification Focus**: Missions, XP, skills, rewards, leaderboards
4. **Session-Based Auth**: Simple, no external providers needed for MVP
5. **Supabase Ready**: Schema defined, but using mock data for now
6. **Production-Grade Security**: CORS, Helmet, Rate Limiting, Validation
7. **Scalable Architecture**: Clear separation of concerns
8. **Developer-Friendly**: Hot reload, TypeScript, ESLint, clear structure

---

**This is a well-structured, modern web application with a clear separation between frontend and backend, following industry best practices for a gamified insurance platform MVP.**
