import rateLimit from 'express-rate-limit';
import { logger } from '../utils/logger.js';

const isDevelopment = process.env.NODE_ENV !== 'production';
const isRateLimitEnabled = process.env.ENABLE_RATE_LIMIT === 'true';

// Disable rate limiting in development unless explicitly enabled
const createRateLimiter = (config: any) => {
  if (!isRateLimitEnabled && isDevelopment) {
    // Return a no-op middleware in development
    return (req: any, res: any, next: any) => next();
  }
  return rateLimit({
    ...config,
    // Don't add rate limit headers in development
    standardHeaders: isRateLimitEnabled,
    legacyHeaders: false,
    // Skip trust proxy validation warning - we've configured trust proxy: 1 (only first proxy)
    // This is safe because we only trust Vercel's proxy, not all proxies
    validate: {
      trustProxy: false, // Disable trust proxy validation since we've configured it safely
    },
  });
};

// General API rate limiter - very lenient
export const apiLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Limit each IP to 1000 requests per windowMs (very high)
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: isRateLimitEnabled,
  legacyHeaders: false,
    // Skip trust proxy validation warning - we've configured trust proxy: 1 (only first proxy)
    // This is safe because we only trust Vercel's proxy, not all proxies
    validate: {
      trustProxy: false, // Disable trust proxy validation since we've configured it safely
    },  skip: () => !isRateLimitEnabled && isDevelopment,
  handler: (req, res) => {
    if (isRateLimitEnabled || !isDevelopment) {
      logger.warn({ ip: req.ip, path: req.path }, 'Rate limit exceeded');
    }
    res.status(429).json({
      error: 'Too many requests from this IP, please try again later.',
    });
  },
});

// Strict rate limiter for sensitive operations - more lenient
export const strictLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs (increased from 10)
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: isRateLimitEnabled,
  legacyHeaders: false,
    // Skip trust proxy validation warning - we've configured trust proxy: 1 (only first proxy)
    // This is safe because we only trust Vercel's proxy, not all proxies
    validate: {
      trustProxy: false, // Disable trust proxy validation since we've configured it safely
    },  skip: () => !isRateLimitEnabled && isDevelopment,
  handler: (req, res) => {
    if (isRateLimitEnabled || !isDevelopment) {
      logger.warn({ ip: req.ip, path: req.path }, 'Strict rate limit exceeded');
    }
    res.status(429).json({
      error: 'Too many requests from this IP, please try again later.',
    });
  },
});

// File upload rate limiter - more lenient
export const uploadLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 100, // Limit each IP to 100 uploads per hour (increased from 20)
  message: 'Too many file uploads from this IP, please try again later.',
  standardHeaders: isRateLimitEnabled,
  legacyHeaders: false,
    // Skip trust proxy validation warning - we've configured trust proxy: 1 (only first proxy)
    // This is safe because we only trust Vercel's proxy, not all proxies
    validate: {
      trustProxy: false, // Disable trust proxy validation since we've configured it safely
    },  skip: () => !isRateLimitEnabled && isDevelopment,
  handler: (req, res) => {
    if (isRateLimitEnabled || !isDevelopment) {
      logger.warn({ ip: req.ip, path: req.path }, 'Upload rate limit exceeded');
    }
    res.status(429).json({
      error: 'Too many file uploads from this IP, please try again later.',
    });
  },
});

