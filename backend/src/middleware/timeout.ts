import timeout from 'express-timeout-handler';
import { logger } from '../utils/logger.js';

// Vercel has 10s timeout on Hobby plan, 60s on Pro
// Set to 8 seconds to be safe (leaves buffer for Vercel overhead)
// Check for Vercel environment (VERCEL env var is automatically set by Vercel)
const TIMEOUT_MS = process.env.VERCEL || process.env.NODE_ENV === 'production' ? 8000 : 30000;

export const timeoutHandler = timeout.handler({
  timeout: TIMEOUT_MS,
  onTimeout: (req, res) => {
    logger.warn({ path: req.path, method: req.method }, 'Request timeout');
    res.status(504).json({
      error: 'Request timeout. Please try again.',
    });
  },
  disable: ['write', 'setHeaders', 'send', 'json', 'end'],
});


