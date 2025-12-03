// Vercel serverless function entry point
import type { VercelRequest, VercelResponse } from '@vercel/node';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import mongoose from 'mongoose';
import pinoHttp from 'pino-http';
import * as Sentry from '@sentry/node';
import 'dotenv/config';

import listings from '../src/routes/listings.js';
import purchase from '../src/routes/purchase.js';
import delivery from '../src/routes/delivery.js';
import auth from '../src/routes/auth.js';
import reviews from '../src/routes/reviews.js';
import { logger } from '../src/utils/logger.js';
import { apiLimiter, strictLimiter } from '../src/middleware/rateLimiter.js';
import { timeoutHandler } from '../src/middleware/timeout.js';

// Initialize Sentry
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'production',
    tracesSampleRate: 0.1,
  });
}

// Create Express app
const app = express();

// Trust proxy for Vercel (required for rate limiting and IP detection)
app.set('trust proxy', true);

// Initialize MongoDB connection (reuse connection if exists)
let isConnected = false;

async function connectDB() {
  if (isConnected && mongoose.connection.readyState === 1) {
    return;
  }

  try {
    await mongoose.connect(process.env.MONGO_URI!);
    isConnected = true;
    logger.info('✓ Connected to MongoDB');
  } catch (error: any) {
    logger.error({ error: error.message }, 'Failed to connect to MongoDB');
    throw error;
  }
}

// Middleware setup
if (process.env.SENTRY_DSN) {
  app.use(Sentry.Handlers.requestHandler());
  app.use(Sentry.Handlers.tracingHandler());
}

app.use(helmet());

const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || [];
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman, etc.) in development
    if (!origin && process.env.NODE_ENV !== 'production') {
      return callback(null, true);
    }
    // Allow if origin is in allowed list or if no origin (server-to-server)
    if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      logger.warn({ origin, allowedOrigins }, 'CORS blocked origin');
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));

app.use(pinoHttp({ 
  logger,
  autoLogging: {
    ignore: (req) => req.url === '/health',
  },
  serializers: {
    req: (req) => ({
      method: req.method,
      url: req.url,
      ip: req.ip,
    }),
    res: (res) => ({
      statusCode: res.statusCode,
    }),
  },
}));

app.use(timeoutHandler);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
  });
});

// Rate limiting
app.use('/api', apiLimiter);
app.use('/auth', strictLimiter);

// Routes
app.use('/api/listings', listings);
app.use('/api/purchase', purchase);
app.use('/api/delivery', delivery);
app.use('/auth', auth);
app.use('/api/reviews', reviews);

// Error handlers
if (process.env.SENTRY_DSN) {
  app.use(Sentry.Handlers.errorHandler());
}

app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error({ 
    error: err.message, 
    path: req.path,
    method: req.method 
  }, 'Unhandled error');
  
  res.status(err.status || 500).json({
    error: 'Internal server error',
  });
});

// Vercel serverless function handler
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Connect to MongoDB on first request
  await connectDB();
  
  // Use Vercel's built-in Express support
  return new Promise((resolve) => {
    app(req as any, res as any, () => {
      resolve(undefined);
    });
  });
}

