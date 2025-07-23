// Export all plugins
export { cors } from './cors';
export { logger } from './logger';
export { auth, createJWT } from './auth';
export { rateLimit } from './ratelimit';

// Plugin types for convenience
export interface Plugin {
  name?: string;
  onRequest?: (ctx: any) => Promise<void> | void;
  onResponse?: (ctx: any, response: any) => Promise<any> | any;
  onError?: (ctx: any, error: Error) => Promise<any> | any;
}
