import timeout from 'express-timeout-handler';
import { logger } from '../utils/logger.js';

// Vercel Hobby: 10s max, Pro: 60s max
// Local development: 120s for file uploads
const isVercel = !!process.env.VERCEL;
const DEFAULT_TIMEOUT = isVercel ? 10000 : 120000;

export const timeoutHandler = timeout.handler({
  timeout: DEFAULT_TIMEOUT,
  onTimeout: (req, res) => {
    logger.warn({ path: req.path, method: req.method }, 'Request timeout');
    res.status(504).json({
      error: 'Request timeout. Please try again.',
    });
  },
  disable: ['write', 'setHeaders', 'send', 'json', 'end'],
});
