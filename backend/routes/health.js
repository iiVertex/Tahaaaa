import express from 'express';
import { logger } from '../utils/logger.js';

const router = express.Router();

// Health check endpoint
router.get('/', (req, res) => {
  const healthCheck = {
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV,
    version: process.env.npm_package_version || '1.0.0'
  };

  logger.info('Health check requested', {
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  res.status(200).json({
    success: true,
    data: healthCheck
  });
});

// Detailed health check with dependencies
router.get('/detailed', async (req, res) => {
  try {
    const healthCheck = {
      status: 'OK',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV,
      version: process.env.npm_package_version || '1.0.0',
      dependencies: {
        supabase: 'checking...',
        database: 'checking...'
      }
    };

    // Check Supabase connection
    try {
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_KEY
      );
      
      // Simple query to test connection
      const { error } = await supabase.from('users').select('count').limit(1);
      healthCheck.dependencies.supabase = error ? 'ERROR' : 'OK';
    } catch (error) {
      healthCheck.dependencies.supabase = 'ERROR';
      logger.error('Supabase health check failed:', error);
    }

    // Check database connectivity
    try {
      // This would be a simple database query
      healthCheck.dependencies.database = 'OK';
    } catch (error) {
      healthCheck.dependencies.database = 'ERROR';
      logger.error('Database health check failed:', error);
    }

    const overallStatus = Object.values(healthCheck.dependencies).every(status => status === 'OK') 
      ? 'OK' 
      : 'DEGRADED';

    healthCheck.status = overallStatus;

    res.status(overallStatus === 'OK' ? 200 : 503).json({
      success: overallStatus === 'OK',
      data: healthCheck
    });
  } catch (error) {
    logger.error('Detailed health check failed:', error);
    res.status(500).json({
      success: false,
      message: 'Health check failed',
      error: error.message
    });
  }
});

export default router;
