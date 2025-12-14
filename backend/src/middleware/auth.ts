import type { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'

type JwtPayload = {
  sub: string
  verified: boolean
  iat?: number
  exp?: number
}

declare global {
  namespace Express {
    interface Request {
      user?: {
        wallet: string
      }
    }
  }
}

function parseCookies(req: Request): Record<string, string> {
  const header = req.headers.cookie
  if (!header) return {}
  const out: Record<string, string> = {}
  for (const part of header.split(';')) {
    const idx = part.indexOf('=')
    if (idx > -1) {
      const k = part.slice(0, idx).trim()
      const v = decodeURIComponent(part.slice(idx + 1))
      out[k] = v
    }
  }
  return out
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const cookies = parseCookies(req)
    const token = cookies['auth_token']
    if (!token) {
      return res.status(401).json({ error: 'Authentication required' })
    }
    const secret = process.env.JWT_SECRET
    if (!secret) {
      return res.status(500).json({ error: 'Server configuration missing' })
    }
    const payload = jwt.verify(token, secret) as JwtPayload
    if (!payload?.sub || !payload.verified) {
      return res.status(401).json({ error: 'Invalid token' })
    }
    req.user = { wallet: payload.sub }
    return next()
  } catch (e: any) {
    return res.status(401).json({ error: 'Invalid or expired token' })
  }
}

export function optionalAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const cookies = parseCookies(req)
    const token = cookies['auth_token']
    const secret = process.env.JWT_SECRET
    if (token && secret) {
      const payload = jwt.verify(token, secret) as JwtPayload
      if (payload?.sub && payload.verified) {
        req.user = { wallet: payload.sub }
      }
    }
  } catch {}
  return next()
}

export function clearAuthCookie(res: Response) {
  const isProd = process.env.NODE_ENV === 'production'
  res.clearCookie('auth_token', {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    path: '/',
  })
}

