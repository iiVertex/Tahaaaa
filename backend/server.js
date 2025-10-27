import express from 'express';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Import middleware
import { securityMiddleware } from './middleware/security.js';
import { errorHandler } from './middleware/errorHandler.js';
import { logger } from './utils/logger.js';

// Import routes
import onboardingRoutes from './routes/onboarding.js';
import missionsRoutes from './routes/missions.js';
import profileRoutes from './routes/profile.js';
import aiRoutes from './routes/ai.js';
import healthRoutes from './routes/health.js';
import socialRoutes from './routes/social.js';
import rewardsRoutes from './routes/rewards.js';
import scenariosRoutes from './routes/scenarios.js';
import skillTreeRoutes from './routes/skillTree.js';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

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

// API routes
app.use('/api/onboarding', onboardingRoutes);
app.use('/api/missions', missionsRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/social', socialRoutes);
app.use('/api/rewards', rewardsRoutes);
app.use('/api/scenarios', scenariosRoutes);
app.use('/api/skill-tree', skillTreeRoutes);

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
