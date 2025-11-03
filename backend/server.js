import express from 'express';
import { config as loadEnv } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Import middleware
import cors from 'cors';
import { securityMiddleware, corsOptions } from './middleware/security.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { logger } from './utils/logger.js';

// Import routes
import onboardingRoutes, { createOnboardingRouter } from './routes/onboarding.js';
import missionsRoutes, { createMissionsRouter } from './routes/missions.js';
import profileRoutes, { createProfileRouter } from './routes/profile.js';
import aiRoutes, { createAiRouter } from './routes/ai.js';
import healthRoutes from './routes/health.js';
import socialRoutes, { createSocialRouter } from './routes/social.js';
import rewardsRoutes, { createRewardsRouter, createBundlesRouter } from './routes/rewards.js';
import scenariosRoutes, { createScenariosRouter } from './routes/scenarios.js';
import personalizationRoutes, { createPersonalizationRouter } from './routes/personalization.js';
import analyticsRoutes from './routes/analytics.js';
import quotesRoutes from './routes/quotes.js';
import referralsRoutes from './routes/referrals.js';
import retentionRoutes from './routes/retention.js';
import multiproductRoutes from './routes/multiproduct.js';
import ecosystemRoutes from './routes/ecosystem.js';
import { container } from './di/container.js';
import offersRoutes from './routes/offers.js';
import productsRoutes from './routes/products.js';
import achievementsRoutes from './routes/achievements.js';
import playRoutes, { createPlayRouter } from './routes/play.js';

// Load environment variables
loadEnv();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
let PORT = Number(process.env.PORT || 3001);

// Security middleware
securityMiddleware.forEach((middleware) => app.use(middleware));

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
app.use('/api/bundles', createBundlesRouter ? createBundlesRouter(container.services) : express.Router());
app.use('/api/scenarios', createScenariosRouter ? createScenariosRouter(container.services) : scenariosRoutes);
app.use('/api/personalization', createPersonalizationRouter ? createPersonalizationRouter(container.services) : personalizationRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/quotes', quotesRoutes);
app.use('/api/referrals', referralsRoutes);
app.use('/api/retention', retentionRoutes);
app.use('/api/multiproduct', multiproductRoutes);
app.use('/api/ecosystem', ecosystemRoutes);
app.use('/api/offers', offersRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/achievements', achievementsRoutes);
app.use('/api/play', createPlayRouter ? createPlayRouter(container.services) : playRoutes);

// 404 handler
app.use(notFoundHandler);

// Error handling middleware (must be last)
app.use(errorHandler);

// Deterministic server start: bind once to PORT; if in use, exit (avoids port hopping)
function startDeterministic(port) {
  const server = app.listen(port, () => {
    PORT = port;
    logger.info(`QIC Backend Server running on port ${PORT}`);
    logger.info(`Environment: ${process.env.NODE_ENV}`);
    logger.info(`CORS Origin: ${process.env.CORS_ORIGIN}`);
  });
  server.on('error', (err) => {
    if (err?.code === 'EADDRINUSE') {
      logger.error(`Port ${port} in use. Set PORT to a free port or stop the other process.`);
      process.exit(1);
    } else {
      logger.error('Failed to start server', { error: err?.message, code: err?.code });
      process.exit(1);
    }
  });
}

startDeterministic(PORT);

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
