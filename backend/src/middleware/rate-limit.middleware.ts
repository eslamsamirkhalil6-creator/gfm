import { Request, Response, NextFunction } from 'express';

interface RateBucket {
  count: number;
  resetAt: number;
}

const ipBurstBuckets = new Map<string, RateBucket>();
const ipFailureBuckets = new Map<string, RateBucket>();
const accountFailureBuckets = new Map<string, RateBucket>();

export interface LoginRateLimiterOptions {
  burstWindowMs?: number;
  maxBurstPerIp?: number;
  failureWindowMs?: number;
  maxFailuresPerIp?: number;
  maxFailuresPerAccount?: number;
}

const DEFAULT_OPTIONS: Required<LoginRateLimiterOptions> = {
  burstWindowMs: 60 * 1000, // 1 minute
  maxBurstPerIp: 150, // Allows legitimate concurrent sessions from same NAT/proxy while blocking flood DoS
  failureWindowMs: 15 * 60 * 1000, // 15 minutes
  maxFailuresPerIp: 25,
  maxFailuresPerAccount: 5,
};

function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'] as string | undefined;
  if (forwarded) return forwarded.split(',')[0].trim();
  return req.socket?.remoteAddress || req.ip || '127.0.0.1';
}

function getBucket(map: Map<string, RateBucket>, key: string, windowMs: number, now: number): RateBucket {
  const existing = map.get(key);
  if (!existing || existing.resetAt <= now) {
    const fresh: RateBucket = { count: 0, resetAt: now + windowMs };
    map.set(key, fresh);
    return fresh;
  }
  return existing;
}

export function resetLoginRateLimiter(): void {
  ipBurstBuckets.clear();
  ipFailureBuckets.clear();
  accountFailureBuckets.clear();
}

export function recordLoginFailure(req: Request, username?: string, opts?: LoginRateLimiterOptions): void {
  const cfg = { ...DEFAULT_OPTIONS, ...opts };
  const now = Date.now();
  const ip = getClientIp(req);

  const ipFail = getBucket(ipFailureBuckets, ip, cfg.failureWindowMs, now);
  ipFail.count += 1;

  const cleanUser = String(username || '').trim().toLowerCase();
  if (cleanUser) {
    const acctKey = `${ip}:${cleanUser}`;
    const acctFail = getBucket(accountFailureBuckets, acctKey, cfg.failureWindowMs, now);
    acctFail.count += 1;
  }
}

export function clearLoginFailuresForAccount(req: Request, username?: string): void {
  const ip = getClientIp(req);
  const cleanUser = String(username || '').trim().toLowerCase();
  if (cleanUser) {
    accountFailureBuckets.delete(`${ip}:${cleanUser}`);
  }
}

/**
 * Login brute-force and flood protection middleware for POST /api/auth/login.
 * Enforces both per-IP burst limits and failed-attempt lockouts per (IP, username) and per IP.
 */
export function createLoginRateLimiter(opts?: LoginRateLimiterOptions) {
  const cfg = { ...DEFAULT_OPTIONS, ...opts };

  return (req: Request, res: Response, next: NextFunction): void => {
    const now = Date.now();
    const ip = getClientIp(req);
    const cleanUser = String(req.body?.username || '').trim().toLowerCase();

    // 1. Per-IP burst limit
    const burst = getBucket(ipBurstBuckets, ip, cfg.burstWindowMs, now);
    burst.count += 1;
    res.setHeader('X-RateLimit-Limit', String(cfg.maxBurstPerIp));
    res.setHeader('X-RateLimit-Remaining', String(Math.max(0, cfg.maxBurstPerIp - burst.count)));

    if (burst.count > cfg.maxBurstPerIp) {
      const retryAfterSec = Math.max(1, Math.ceil((burst.resetAt - now) / 1000));
      res.setHeader('Retry-After', String(retryAfterSec));
      res.status(429).json({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: `Too many authentication requests. Please retry in ${retryAfterSec} second(s).`,
        },
      });
      return;
    }

    // 2. Per-(IP, username) failed-attempt limit
    if (cleanUser) {
      const acctKey = `${ip}:${cleanUser}`;
      const acctFail = accountFailureBuckets.get(acctKey);
      if (acctFail && acctFail.resetAt > now && acctFail.count >= cfg.maxFailuresPerAccount) {
        const retryAfterSec = Math.max(1, Math.ceil((acctFail.resetAt - now) / 1000));
        res.setHeader('Retry-After', String(retryAfterSec));
        res.status(429).json({
          success: false,
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: `Too many failed login attempts for user "${cleanUser}". Try again in ${retryAfterSec} second(s).`,
          },
        });
        return;
      }
    }

    // 3. Per-IP failed-attempt credential stuffing limit
    const ipFail = ipFailureBuckets.get(ip);
    if (ipFail && ipFail.resetAt > now && ipFail.count >= cfg.maxFailuresPerIp) {
      const retryAfterSec = Math.max(1, Math.ceil((ipFail.resetAt - now) / 1000));
      res.setHeader('Retry-After', String(retryAfterSec));
      res.status(429).json({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: `Too many failed login attempts from this address. Try again in ${retryAfterSec} second(s).`,
        },
      });
      return;
    }

    next();
  };
}
