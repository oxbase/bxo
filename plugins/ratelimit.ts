import BXO from '../index';

interface RateLimitOptions {
  max: number;
  window: number; // in seconds
  keyGenerator?: (ctx: any) => string;
  skipSuccessful?: boolean;
  skipFailed?: boolean;
  exclude?: string[];
  message?: string;
  statusCode?: number;
}

class RateLimitStore {
  private store = new Map<string, { count: number; resetTime: number }>();

  get(key: string): { count: number; resetTime: number } | undefined {
    const entry = this.store.get(key);
    if (entry && Date.now() > entry.resetTime) {
      this.store.delete(key);
      return undefined;
    }
    return entry;
  }

  set(key: string, count: number, resetTime: number): void {
    this.store.set(key, { count, resetTime });
  }

  increment(key: string, window: number): { count: number; resetTime: number } {
    const now = Date.now();
    const entry = this.get(key);
    
    if (!entry) {
      const resetTime = now + (window * 1000);
      this.set(key, 1, resetTime);
      return { count: 1, resetTime };
    }
    
    entry.count++;
    this.set(key, entry.count, entry.resetTime);
    return entry;
  }

  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.resetTime) {
        this.store.delete(key);
      }
    }
  }
}

export function rateLimit(options: RateLimitOptions): BXO {
  const {
    max,
    window,
    keyGenerator = (ctx) => {
      // Default: use IP address
      return ctx.request.headers.get('x-forwarded-for') || 
             ctx.request.headers.get('x-real-ip') || 
             'unknown';
    },
    skipSuccessful = false,
    skipFailed = false,
    exclude = [],
    message = 'Too many requests',
    statusCode = 429
  } = options;

  const store = new RateLimitStore();
  
  // Cleanup expired entries every 5 minutes
  setInterval(() => store.cleanup(), 5 * 60 * 1000);

  const rateLimitInstance = new BXO();

  rateLimitInstance.onRequest(async (ctx: any) => {
    const url = new URL(ctx.request.url);
    const pathname = url.pathname;
    
    // Skip rate limiting for excluded paths
    if (exclude.some(path => {
      if (path.includes('*')) {
        const regex = new RegExp(path.replace(/\*/g, '.*'));
        return regex.test(pathname);
      }
      return pathname === path || pathname.startsWith(path);
    })) {
      return;
    }

    const key = keyGenerator(ctx);
    const entry = store.increment(key, window);
    
    if (entry.count > max) {
      const resetTime = Math.ceil(entry.resetTime / 1000);
      throw new Response(JSON.stringify({ 
        error: message,
        retryAfter: resetTime - Math.floor(Date.now() / 1000)
      }), {
        status: statusCode,
        headers: { 
          'Content-Type': 'application/json',
          'X-RateLimit-Limit': max.toString(),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': resetTime.toString(),
          'Retry-After': (resetTime - Math.floor(Date.now() / 1000)).toString()
        }
      });
    }
    
    // Add rate limit headers
    ctx.set.headers = {
      ...ctx.set.headers,
      'X-RateLimit-Limit': max.toString(),
      'X-RateLimit-Remaining': Math.max(0, max - entry.count).toString(),
      'X-RateLimit-Reset': Math.ceil(entry.resetTime / 1000).toString()
    };
  });

  rateLimitInstance.onResponse(async (ctx: any, response: any) => {
    const status = ctx.set.status || 200;
    const key = keyGenerator(ctx);
    
    // Optionally skip counting successful or failed requests
    if ((skipSuccessful && status < 400) || (skipFailed && status >= 400)) {
      // Decrement the counter since we don't want to count this request
      const entry = store.get(key);
      if (entry && entry.count > 0) {
        store.set(key, entry.count - 1, entry.resetTime);
      }
    }
    
    return response;
  });

  return rateLimitInstance;
} 