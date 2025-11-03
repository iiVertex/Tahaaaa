# Supabase Edge Functions

## Overview
This project does **NOT** use Supabase Edge Functions. All backend logic is implemented as Node.js/Express services in the `/backend` directory.

## Why No Edge Functions?
The architecture is designed to run all API logic through a centralized Express backend server for:
1. **Simplified Development**: Single codebase for all backend logic
2. **Better Error Handling**: Centralized logging and error tracking
3. **Consistent Authentication**: Unified Clerk/session auth across all endpoints
4. **DI Pattern**: Dependency injection container manages all services
5. **Code Reusability**: Shared services, repositories, and utilities

## Backend Architecture
All API endpoints are implemented as Express routes in `/backend/routes/`:

- `/api/health` → `backend/routes/health.js`
- `/api/missions/*` → `backend/routes/missions.js`
- `/api/rewards/*` → `backend/routes/rewards.js`
- `/api/profile/*` → `backend/routes/profile.js`
- `/api/ai/*` → `backend/routes/ai.js`
- `/api/play/*` → `backend/routes/play.js`
- `/api/ecosystem/*` → `backend/routes/ecosystem.js`
- `/api/scenarios/*` → `backend/routes/scenarios.js`
- `/api/social/*` → `backend/routes/social.js`
- And more...

## Business Logic
Core business logic is in `/backend/services/`:
- `ai.service.js` - OpenAI GPT integration for AI-powered features
- `gamification.service.js` - XP, levels, coins, LifeScore calculations
- `mission.service.js` - Mission generation, starting, completing
- `reward.service.js` - Reward redemption and tracking
- `profile.service.js` - User profile management
- `product.service.js` - Insurance product recommendations
- `play.service.js` - Road-trip roulette logic

## Database Access
Database access is abstracted through `/backend/repositories/`:
- `missions.repo.js` - Mission CRUD operations
- `user-missions.repo.js` - User progress tracking
- `rewards.repo.js` - Reward catalog
- `users.repo.js` - User management
- `analytics.repo.js` - Behavior event tracking
- And more...

## Deployment
For production deployment, the Express backend can be:
1. Deployed to any Node.js hosting (Heroku, Railway, Render, etc.)
2. Containerized with Docker
3. Run behind a load balancer if scaling is needed

## Future Considerations
If you need Edge Functions in the future (for specific Supabase features), create them in `/supabase/functions/`:

```bash
supabase/functions/
  ├── daily-brief-gen/
  │   └── index.ts
  ├── mission-auto-reset/
  │   └── index.ts
  └── real-time-notifications/
      └── index.ts
```

But for MVP, the Express backend handles all API logic efficiently.

