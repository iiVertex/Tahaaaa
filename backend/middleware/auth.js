import jwt from 'jsonwebtoken';
import { logger } from '../utils/logger.js';
import { clerkService } from '../services/clerk.service.js';

// Only initialize Supabase if we have the required environment variables
let supabase = null;
if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY) {
  const { createClient } = await import('@supabase/supabase-js');
  supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
  );
}

// Initialize Clerk client if secret key is available
let clerkClient = null;
if (process.env.CLERK_SECRET_KEY) {
  try {
    const { createClerkClient } = await import('@clerk/backend');
    clerkClient = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
  } catch (error) {
    logger.warn('Failed to initialize Clerk client', { error: error.message });
  }
}

// Mock user for development when Clerk is not available
const mockUser = {
  id: 'mock-user-001',
  email: 'user@qiclife.com',
  username: 'qicuser'
};

// Authentication middleware - supports Clerk and session-based auth
export const authenticateUser = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    const sessionId = req.headers['x-session-id'];
    const isDevelopment = process.env.NODE_ENV === 'development';

    // Priority 1: Session-based auth (fallback for development)
    if (sessionId && (!authHeader || isDevelopment)) {
      req.user = mockUser;
      req.sessionId = sessionId;
      return next();
    }

    // Priority 2: Clerk authentication (if token present and Clerk is configured)
    if (authHeader && authHeader.startsWith('Bearer ') && clerkClient && process.env.CLERK_SECRET_KEY) {
      try {
        const token = authHeader.substring(7);
        
        // Verify Clerk JWT token using @clerk/backend
        const verifiedToken = await clerkClient.verifyToken(token);
        
        if (verifiedToken && verifiedToken.sub) {
          const clerkId = verifiedToken.sub; // Clerk user ID
          
          // Get user details from Clerk
          const clerkUser = await clerkClient.users.getUser(clerkId);
          const clerkData = {
            email: clerkUser.emailAddresses?.[0]?.emailAddress || clerkUser.primaryEmailAddress?.emailAddress || verifiedToken.email,
            username: clerkUser.username || verifiedToken.username,
          };

          // Sync Clerk user to database and get database UUID
          const dbUser = await clerkService.syncClerkUser(clerkId, clerkData);

          if (dbUser && dbUser.id) {
            // Set req.user with database UUID (not Clerk ID)
            req.user = {
              id: dbUser.id, // Database UUID
              clerkId: clerkId, // Keep Clerk ID for reference
              email: dbUser.email,
              username: dbUser.username
            };
            req.sessionId = sessionId || `clerk-${clerkId}`;
            return next();
          } else {
            logger.error('Failed to sync Clerk user to database', { clerkId });
            return res.status(500).json({
              success: false,
              message: 'User sync failed'
            });
          }
        }
      } catch (clerkError) {
        logger.warn('Clerk authentication failed, falling back', { error: clerkError.message });
        // Fall through to session/JWT fallback
      }
    }

    // Priority 3: Legacy JWT token (for backward compatibility)
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret');
        req.user = { id: decoded.userId || 'jwt-user' };
        req.sessionId = sessionId || 'jwt-session';
        return next();
      } catch (jwtError) {
        // JWT verification failed
      }
    }

    // No valid authentication found
    return res.status(401).json({
      success: false,
      message: 'Authorization required. Please sign in.'
    });
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
