// Export all plugins
export { cors } from './cors';
export { rateLimit } from './ratelimit';

// Import BXO for plugin typing
import BXO from '../index';

// Plugin functions now return BXO instances
export type PluginFactory<T = any> = (options?: T) => BXO;
