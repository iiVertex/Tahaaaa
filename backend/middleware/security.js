import helmet from 'helmet';
import cors from 'cors';
import { rateLimit, ipKeyGenerator } from 'express-rate-limit';

// CORS configuration
const isDev = process.env.NODE_ENV !== 'production';
const allowedOrigins = process.env.CORS_ORIGIN 
  ? process.env.CORS_ORIGIN.split(',').map(origin => origin.trim())
  : ['http://localhost:5173', 'http://localhost:8080', 'http://localhost:8081', 'http://localhost:8082'];

export const corsOptions = {
  origin: function (origin, callback) {
    const allowRegexes = [
      /^http:\/\/localhost:\d+$/,
      /^http:\/\/127\.0\.0\.1:\d+$/,
      /^http:\/\/(10\.\d{1,3}|172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}|192\.168\.\d{1,3})(?:\.\d{1,3})?:\d+$/
    ];
    if (!origin || allowRegexes.some((r) => r.test(origin)) || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.warn(`CORS blocked origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-session-id']
};

// Rate limiting configuration
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: isDev ? 1000 : 100,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req, res) => req.headers['x-session-id'] || ipKeyGenerator(req, res),
  message: {
    success: false,
    message: 'Too many requests from this client, please try again later.'
  }
});

// Helmet configuration for security headers
const helmetConfig = {
  contentSecurityPolicy: isDev ? false : {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: [
        "'self'",
        "https://*.supabase.co",
        "https://djdpuexsizgyzdudklxt.supabase.co",
        "https://api.openai.com",
        "http://localhost:3001",
        "http://localhost:3002"
      ],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"]
    }
  },
  crossOriginEmbedderPolicy: false
};

// Security middleware stack
export const securityMiddleware = [
  helmet(helmetConfig),
  cors(corsOptions),
  limiter
];

// Additional security middleware for specific routes
export const strictRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req, res) => req.headers['x-session-id'] || ipKeyGenerator(req, res),
  message: {
    success: false,
    message: 'Rate limit exceeded for this operation.'
  }
});

// More lenient rate limit for mission completion (users should be able to complete missions)
export const missionCompletionRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 30, // Allow 30 completion attempts per 15 minutes (much more lenient)
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req, res) => {
    // Use user ID if authenticated for per-user limits
    const userId = req.user?.id;
    return userId ? `user:${userId}` : (req.headers['x-session-id'] || ipKeyGenerator(req, res));
  },
  message: {
    success: false,
    message: 'Too many mission completion attempts. Please wait a moment.'
  },
  skip: (req) => {
    // Skip rate limiting in dev mode if flag is set
    return isDev && process.env.SKIP_DAILY_LIMIT === 'true';
  }
});

// Daily token limit for AI endpoints (prevents excessive OpenAI API usage)
// Updated to 12k tokens/credits per user per day (approximately 60 API calls at ~200 tokens per call)
export const dailyTokenLimit = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  limit: parseInt(process.env.DAILY_TOKEN_LIMIT || '60', 10), // Max 60 AI calls per day per user (12k tokens equivalent)
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req, res) => {
    // Use user ID if authenticated, otherwise fallback to IP
    const userId = req.user?.id;
    return userId ? `user:${userId}` : (req.headers['x-session-id'] || ipKeyGenerator(req, res));
  },
  message: {
    success: false,
    message: 'Daily AI token limit exceeded. Please try again tomorrow.'
  },
  skip: (req) => {
    // Skip rate limiting in dev mode for testing
    return isDev && process.env.SKIP_DAILY_LIMIT === 'true';
  }
});

// Input sanitization middleware
export const sanitizeInput = (req, res, next) => {
  // Remove any potential XSS attempts
  const sanitize = (obj) => {
    if (typeof obj === 'string') {
      return obj.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    }
    if (typeof obj === 'object' && obj !== null) {
      for (const key in obj) {
        obj[key] = sanitize(obj[key]);
      }
    }
    return obj;
  };

  if (req.body) {
    req.body = sanitize(req.body);
  }
  if (req.query) {
    req.query = sanitize(req.query);
  }
  if (req.params) {
    req.params = sanitize(req.params);
  }

  next();
};
