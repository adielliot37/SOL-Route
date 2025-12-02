import validator from 'validator';
import { logger } from './logger.js';

export interface UrlValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validate preview URL for security
 */
export function validatePreviewUrl(url: string): UrlValidationResult {
  if (!url || typeof url !== 'string') {
    return { valid: false, error: 'URL is required' };
  }

  // Check length
  if (url.length > 2048) {
    return { valid: false, error: 'URL is too long (max 2048 characters)' };
  }

  // Must be a valid URL
  if (!validator.isURL(url, { 
    protocols: ['http', 'https'],
    require_protocol: true,
    require_valid_protocol: true,
    disallow_auth: false,
  })) {
    return { valid: false, error: 'Invalid URL format. Must be http:// or https://' };
  }

  // Check for dangerous protocols
  const lowerUrl = url.toLowerCase();
  if (lowerUrl.startsWith('javascript:') || 
      lowerUrl.startsWith('data:') || 
      lowerUrl.startsWith('file:') ||
      lowerUrl.startsWith('vbscript:')) {
    logger.warn({ url }, 'Blocked dangerous URL protocol');
    return { valid: false, error: 'URL protocol not allowed' };
  }

  // Check for localhost/internal IPs (optional - can be allowed for dev)
  if (process.env.NODE_ENV === 'production') {
    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname.toLowerCase();
      
      if (hostname === 'localhost' || 
          hostname === '127.0.0.1' || 
          hostname.startsWith('192.168.') ||
          hostname.startsWith('10.') ||
          hostname.startsWith('172.')) {
        logger.warn({ url }, 'Blocked internal IP in production');
        return { valid: false, error: 'Internal IPs not allowed in production' };
      }
    } catch (e) {
      return { valid: false, error: 'Invalid URL format' };
    }
  }

  return { valid: true };
}

