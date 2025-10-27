import jwt from 'jsonwebtoken';
import { logger } from '../utils/logger.js';

// Only initialize Supabase if we have the required environment variables
let supabase = null;
if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY) {
  const { createClient } = await import('@supabase/supabase-js');
  supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );
}

// Mock user for development when Clerk is not available
const mockUser = {
  id: 'mock-user-001',
  email: 'user@qiclife.com',
  username: 'qicuser'
};

// Authentication middleware
export const authenticateUser = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const sessionId = req.headers['x-session-id'];

    // Allow session-only path (primary for MVP)
    if (sessionId && (!authHeader || process.env.NODE_ENV === 'development')) {
      req.user = mockUser;
      req.sessionId = sessionId;
      return next();
    }

    // Extract token from Authorization header
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Authorization token required'
      });
    }

    const token = authHeader.substring(7);

    // Verify JWT token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (jwtError) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token'
      });
    }

    // JWT path: do not require DB user
    req.user = { id: decoded.userId || 'jwt-user' };

    // Attach session to request
    req.sessionId = sessionId || 'jwt-session';

    next();
  } catch (error) {
    logger.error('Authentication error:', error);
    res.status(500).json({
      success: false,
      message: 'Authentication failed'
    });
  }
};

// Optional authentication middleware (doesn't fail if no auth)
export const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const sessionId = req.headers['x-session-id'];

    if (!authHeader) {
      req.user = null;
      req.sessionId = sessionId;
      return next();
    }

    // Try to authenticate, but don't fail if it doesn't work
    await authenticateUser(req, res, next);
  } catch (error) {
    req.user = null;
    req.sessionId = req.headers['x-session-id'];
    next();
  }
};

// Admin role check
export const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Admin access required'
    });
  }
  next();
};

// Session validation
export const validateSession = async (req, res, next) => {
  const sessionId = req.headers['x-session-id'];
  
  if (!sessionId) {
    return res.status(400).json({
      success: false,
      message: 'Session ID required'
    });
  }

  // MVP: accept any session id and attach mock session
  req.session = { session_id: sessionId };
  next();
};
