import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import mongoose from 'mongoose';
import pinoHttp from 'pino-http';
import * as Sentry from '@sentry/node';
import 'dotenv/config';

import listings from './routes/listings.js';
import purchase from './routes/purchase.js';
import delivery from './routes/delivery.js';
import auth from './routes/auth.js';
import reviews from './routes/reviews.js';
import { logger } from './utils/logger.js';
import { apiLimiter, strictLimiter, uploadLimiter } from './middleware/rateLimiter.js';
import { timeoutHandler } from './middleware/timeout.js';

// Initialize Sentry for error tracking (optional)
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  });
  logger.info('Sentry error tracking initialized');
}

let server: any;

async function start() {
  // Validate required environment variables
  const requiredEnvVars = ['MONGO_URI'];
  const missing = requiredEnvVars.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    logger.error({ missing }, 'Missing required environment variables');
    process.exit(1);
  }

  logger.info('Connecting to MongoDB...');
  try {
    await mongoose.connect(process.env.MONGO_URI!);
    logger.info('✓ Connected to MongoDB');
  } catch (error: any) {
    logger.error({ error: error.message }, 'Failed to connect to MongoDB');
    process.exit(1);
  }

  // Handle MongoDB connection errors
  mongoose.connection.on('error', (err) => {
    logger.error({ error: err.message }, 'MongoDB connection error');
  });

  mongoose.connection.on('disconnected', () => {
    logger.warn('MongoDB disconnected');
  });

  mongoose.connection.on('reconnected', () => {
    logger.info('MongoDB reconnected');
  });
  
  const app = express();

  // Trust proxy for Vercel and reverse proxies (required for rate limiting and IP detection)
  app.set('trust proxy', true);

  // Sentry request handler must be first
  if (process.env.SENTRY_DSN) {
    app.use(Sentry.Handlers.requestHandler());
    app.use(Sentry.Handlers.tracingHandler());
  }

  // Security middleware
  app.use(helmet());
  
  // CORS configuration
  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || ['http://localhost:3000'];
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

  // Request logging - minimal in development
  app.use(pinoHttp({ 
    logger,
    autoLogging: {
      ignore: (req) => req.url === '/health', // Don't log health checks
    },
    customLogLevel: (req, res, err) => {
      if (res.statusCode >= 400 && res.statusCode < 500) {
        return 'warn';
      } else if (res.statusCode >= 500 || err) {
        return 'error';
      }
      return 'info';
    },
    customSuccessMessage: (req, res) => {
      return `${req.method} ${req.url} ${res.statusCode}`;
    },
    customErrorMessage: (req, res, err) => {
      return `${req.method} ${req.url} ${res.statusCode} - ${err.message}`;
    },
    // Don't log request/response bodies
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

  // Request timeout
  app.use(timeoutHandler);

  // Body parsing with size limits
  // Note: File uploads use larger limit in listings route
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Health check endpoint (before rate limiting)
  app.get('/health', (req, res) => {
    const health = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
      },
    };
    res.json(health);
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

  // Sentry error handler must be before other error handlers
  if (process.env.SENTRY_DSN) {
    app.use(Sentry.Handlers.errorHandler());
  }

  // Global error handler
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.error({ 
      error: err.message, 
      stack: err.stack, 
      path: req.path,
      method: req.method 
    }, 'Unhandled error');
    
    res.status(err.status || 500).json({
      error: process.env.NODE_ENV === 'production' 
        ? 'Internal server error' 
        : err.message,
    });
  });

  const port = Number(process.env.PORT || 4000);
  server = app.listen(port, () => {
    logger.info({ port }, '✓ Server running');
  });

  // Graceful shutdown
  const gracefulShutdown = async (signal: string) => {
    logger.info({ signal }, 'Received shutdown signal, closing server...');
    
    server.close(async () => {
      logger.info('HTTP server closed');
      
      try {
        await mongoose.connection.close();
        logger.info('MongoDB connection closed');
        process.exit(0);
      } catch (error: any) {
        logger.error({ error: error.message }, 'Error during shutdown');
        process.exit(1);
      }
    });

    // Force close after 10 seconds
    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}

start().catch((err) => {
  logger.error({ error: err.message, stack: err.stack }, 'Failed to start server');
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error({ reason, promise }, 'Unhandled Rejection');
  if (process.env.SENTRY_DSN) {
    Sentry.captureException(reason);
  }
});

// Handle uncaught exceptions (ignore EPIPE errors)
process.on('uncaughtException', (error: any) => {
  if (error.code === 'EPIPE') {
    // Ignore EPIPE errors (broken pipe) - these are harmless
    return;
  }
  logger.error({ error: error.message, stack: error.stack }, 'Uncaught Exception');
  if (process.env.SENTRY_DSN) {
    Sentry.captureException(error);
  }
  process.exit(1);
});
