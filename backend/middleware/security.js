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
