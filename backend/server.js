import express from 'express';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Import middleware
import cors from 'cors';
import { securityMiddleware, corsOptions } from './middleware/security.js';
import { errorHandler } from './middleware/errorHandler.js';
import { logger } from './utils/logger.js';

// Import routes
import onboardingRoutes, { createOnboardingRouter } from './routes/onboarding.js';
import missionsRoutes, { createMissionsRouter } from './routes/missions.js';
import profileRoutes, { createProfileRouter } from './routes/profile.js';
import aiRoutes, { createAiRouter } from './routes/ai.js';
import healthRoutes from './routes/health.js';
import socialRoutes, { createSocialRouter } from './routes/social.js';
import rewardsRoutes, { createRewardsRouter } from './routes/rewards.js';
import scenariosRoutes, { createScenariosRouter } from './routes/scenarios.js';
import { container } from './di/container.js';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Preflight for all routes (CORS) - must be before other middleware
app.options('*', cors(corsOptions));
// Security middleware
app.use(securityMiddleware);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    sessionId: req.get('x-session-id')
  });
  next();
});

// Health check route (before auth)
app.use('/api/health', healthRoutes);

// API routes (use DI factories if available, else fall back to default routers)
app.use('/api/onboarding', createOnboardingRouter ? createOnboardingRouter(container.services) : onboardingRoutes);
app.use('/api/missions', createMissionsRouter ? createMissionsRouter(container.services) : missionsRoutes);
app.use('/api/profile', createProfileRouter ? createProfileRouter(container.services) : profileRoutes);
app.use('/api/ai', createAiRouter ? createAiRouter(container.services) : aiRoutes);
app.use('/api/social', createSocialRouter ? createSocialRouter(container.services) : socialRoutes);
app.use('/api/rewards', createRewardsRouter ? createRewardsRouter(container.services) : rewardsRoutes);
app.use('/api/scenarios', createScenariosRouter ? createScenariosRouter(container.services) : scenariosRoutes);

// Error handling middleware (must be last)
app.use(errorHandler);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    path: req.originalUrl
  });
});

// Start server
app.listen(PORT, () => {
  logger.info(`QIC Backend Server running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV}`);
  logger.info(`CORS Origin: ${process.env.CORS_ORIGIN}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});

export default app;
