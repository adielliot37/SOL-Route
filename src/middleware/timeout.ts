import timeout from 'express-timeout-handler';
import { logger } from '../utils/logger.js';

export const timeoutHandler = timeout.handler({
  timeout: 30000, // 30 seconds default
  onTimeout: (req, res) => {
    logger.warn({ path: req.path, method: req.method }, 'Request timeout');
    res.status(504).json({
      error: 'Request timeout. Please try again.',
    });
  },
  disable: ['write', 'setHeaders', 'send', 'json', 'end'],
});


