import { tooManyRequests } from '../utils/ApiError.js';

const buckets = new Map();

/**
 * Minimal fixed-window limiter. Good enough for a single instance; swap for
 * Redis if you run more than one API node.
 */
export const rateLimit = ({ windowMs = 60_000, max = 20, keyPrefix = 'rl' } = {}) => {
  return (req, res, next) => {
    const identifier = `${keyPrefix}:${req.ip}`;
    const now = Date.now();
    const bucket = buckets.get(identifier);

    if (!bucket || bucket.resetAt <= now) {
      buckets.set(identifier, { count: 1, resetAt: now + windowMs });
      res.setHeader('X-RateLimit-Remaining', String(max - 1));
      return next();
    }

    bucket.count += 1;
    if (bucket.count > max) {
      const retryAfter = Math.ceil((bucket.resetAt - now) / 1000);
      res.setHeader('Retry-After', String(retryAfter));
      return next(tooManyRequests(`Too many attempts. Try again in ${retryAfter}s.`));
    }

    res.setHeader('X-RateLimit-Remaining', String(max - bucket.count));
    return next();
  };
};

export const resetRateLimits = () => buckets.clear();
