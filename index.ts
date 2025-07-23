import { z } from 'zod';

// Type utilities for extracting types from Zod schemas
type InferZodType<T> = T extends z.ZodType<infer U> ? U : never;

// Configuration interface for route handlers
interface RouteConfig {
  params?: z.ZodSchema<any>;
  query?: z.ZodSchema<any>;
  body?: z.ZodSchema<any>;
  headers?: z.ZodSchema<any>;
}

// Context type that's fully typed based on the route configuration
export type Context<TConfig extends RouteConfig = {}> = {
  params: TConfig['params'] extends z.ZodSchema<any> ? InferZodType<TConfig['params']> : Record<string, string>;
  query: TConfig['query'] extends z.ZodSchema<any> ? InferZodType<TConfig['query']> : Record<string, string | undefined>;
  body: TConfig['body'] extends z.ZodSchema<any> ? InferZodType<TConfig['body']> : unknown;
  headers: TConfig['headers'] extends z.ZodSchema<any> ? InferZodType<TConfig['headers']> : Record<string, string>;
  request: Request;
  set: {
    status?: number;
    headers?: Record<string, string>;
  };
  // Extended properties that can be added by plugins
  user?: any;
  [key: string]: any;
};

// Handler function type
type Handler<TConfig extends RouteConfig = {}> = (ctx: Context<TConfig>) => Promise<any> | any;

// Plugin interface (also exported from plugins/index.ts)
interface Plugin {
  name?: string;
  onRequest?: (ctx: Context) => Promise<void> | void;
  onResponse?: (ctx: Context, response: any) => Promise<any> | any;
  onError?: (ctx: Context, error: Error) => Promise<any> | any;
}



// Route definition
interface Route {
  method: string;
  path: string;
  handler: Handler<any>;
  config?: RouteConfig;
}

// Lifecycle hooks
interface LifecycleHooks {
  onBeforeStart?: () => Promise<void> | void;
  onAfterStart?: () => Promise<void> | void;
  onBeforeStop?: () => Promise<void> | void;
  onAfterStop?: () => Promise<void> | void;
  onBeforeRestart?: () => Promise<void> | void;
  onAfterRestart?: () => Promise<void> | void;
  onRequest?: (ctx: Context) => Promise<void> | void;
  onResponse?: (ctx: Context, response: any) => Promise<any> | any;
  onError?: (ctx: Context, error: Error) => Promise<any> | any;
}

export default class BXO {
  private routes: Route[] = [];
  private plugins: Plugin[] = [];
  private hooks: LifecycleHooks = {};
  private server?: any;
  private isRunning: boolean = false;
  private hotReloadEnabled: boolean = false;
  private watchedFiles: Set<string> = new Set();

  constructor() {}

  // Lifecycle hook methods
  onBeforeStart(handler: () => Promise<void> | void): this {
    this.hooks.onBeforeStart = handler;
    return this;
  }

  onAfterStart(handler: () => Promise<void> | void): this {
    this.hooks.onAfterStart = handler;
    return this;
  }

  onBeforeStop(handler: () => Promise<void> | void): this {
    this.hooks.onBeforeStop = handler;
    return this;
  }

  onAfterStop(handler: () => Promise<void> | void): this {
    this.hooks.onAfterStop = handler;
    return this;
  }

  onBeforeRestart(handler: () => Promise<void> | void): this {
    this.hooks.onBeforeRestart = handler;
    return this;
  }

  onAfterRestart(handler: () => Promise<void> | void): this {
    this.hooks.onAfterRestart = handler;
    return this;
  }

  onRequest(handler: (ctx: Context) => Promise<void> | void): this {
    this.hooks.onRequest = handler;
    return this;
  }

  onResponse(handler: (ctx: Context, response: any) => Promise<any> | any): this {
    this.hooks.onResponse = handler;
    return this;
  }

  onError(handler: (ctx: Context, error: Error) => Promise<any> | any): this {
    this.hooks.onError = handler;
    return this;
  }

  // Plugin system
  use(plugin: Plugin): this {
    this.plugins.push(plugin);
    return this;
  }

  // HTTP method handlers with overloads for type safety
  get<TConfig extends RouteConfig = {}>(
    path: string,
    handler: Handler<TConfig>
  ): this;
  get<TConfig extends RouteConfig = {}>(
    path: string,
    handler: Handler<TConfig>,
    config: TConfig
  ): this;
  get<TConfig extends RouteConfig = {}>(
    path: string,
    handler: Handler<TConfig>,
    config?: TConfig
  ): this {
    this.routes.push({ method: 'GET', path, handler, config });
    return this;
  }

  post<TConfig extends RouteConfig = {}>(
    path: string,
    handler: Handler<TConfig>
  ): this;
  post<TConfig extends RouteConfig = {}>(
    path: string,
    handler: Handler<TConfig>,
    config: TConfig
  ): this;
  post<TConfig extends RouteConfig = {}>(
    path: string,
    handler: Handler<TConfig>,
    config?: TConfig
  ): this {
    this.routes.push({ method: 'POST', path, handler, config });
    return this;
  }

  put<TConfig extends RouteConfig = {}>(
    path: string,
    handler: Handler<TConfig>
  ): this;
  put<TConfig extends RouteConfig = {}>(
    path: string,
    handler: Handler<TConfig>,
    config: TConfig
  ): this;
  put<TConfig extends RouteConfig = {}>(
    path: string,
    handler: Handler<TConfig>,
    config?: TConfig
  ): this {
    this.routes.push({ method: 'PUT', path, handler, config });
    return this;
  }

  delete<TConfig extends RouteConfig = {}>(
    path: string,
    handler: Handler<TConfig>
  ): this;
  delete<TConfig extends RouteConfig = {}>(
    path: string,
    handler: Handler<TConfig>,
    config: TConfig
  ): this;
  delete<TConfig extends RouteConfig = {}>(
    path: string,
    handler: Handler<TConfig>,
    config?: TConfig
  ): this {
    this.routes.push({ method: 'DELETE', path, handler, config });
    return this;
  }

  patch<TConfig extends RouteConfig = {}>(
    path: string,
    handler: Handler<TConfig>
  ): this;
  patch<TConfig extends RouteConfig = {}>(
    path: string,
    handler: Handler<TConfig>,
    config: TConfig
  ): this;
  patch<TConfig extends RouteConfig = {}>(
    path: string,
    handler: Handler<TConfig>,
    config?: TConfig
  ): this {
    this.routes.push({ method: 'PATCH', path, handler, config });
    return this;
  }

  // Route matching utility
  private matchRoute(method: string, pathname: string): { route: Route; params: Record<string, string> } | null {
    for (const route of this.routes) {
      if (route.method !== method) continue;

      const routeSegments = route.path.split('/').filter(Boolean);
      const pathSegments = pathname.split('/').filter(Boolean);

      if (routeSegments.length !== pathSegments.length) continue;

      const params: Record<string, string> = {};
      let isMatch = true;

      for (let i = 0; i < routeSegments.length; i++) {
        const routeSegment = routeSegments[i];
        const pathSegment = pathSegments[i];

        if (!routeSegment || !pathSegment) {
          isMatch = false;
          break;
        }

        if (routeSegment.startsWith(':')) {
          const paramName = routeSegment.slice(1);
          params[paramName] = decodeURIComponent(pathSegment);
        } else if (routeSegment !== pathSegment) {
          isMatch = false;
          break;
        }
      }

      if (isMatch) {
        return { route, params };
      }
    }

    return null;
  }

  // Parse query string
  private parseQuery(searchParams: URLSearchParams): Record<string, string | undefined> {
    const query: Record<string, string | undefined> = {};
    for (const [key, value] of searchParams.entries()) {
      query[key] = value;
    }
    return query;
  }

  // Parse headers
  private parseHeaders(headers: Headers): Record<string, string> {
    const headerObj: Record<string, string> = {};
    for (const [key, value] of headers.entries()) {
      headerObj[key] = value;
    }
    return headerObj;
  }

  // Validate data against Zod schema
  private validateData<T>(schema: z.ZodSchema<T> | undefined, data: any): T {
    if (!schema) return data;
    return schema.parse(data);
  }

  // Main request handler
  private async handleRequest(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const method = request.method;
    const pathname = url.pathname;

    const matchResult = this.matchRoute(method, pathname);
    if (!matchResult) {
      return new Response('Not Found', { status: 404 });
    }

    const { route, params } = matchResult;
    const query = this.parseQuery(url.searchParams);
    const headers = this.parseHeaders(request.headers);

    let body: any;
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      const contentType = request.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        try {
          body = await request.json();
        } catch {
          body = {};
        }
      } else if (contentType?.includes('application/x-www-form-urlencoded')) {
        const formData = await request.formData();
        body = Object.fromEntries(formData.entries());
      } else {
        body = await request.text();
      }
    }

    // Create context
    const ctx: Context = {
      params: route.config?.params ? this.validateData(route.config.params, params) : params,
      query: route.config?.query ? this.validateData(route.config.query, query) : query,
      body: route.config?.body ? this.validateData(route.config.body, body) : body,
      headers: route.config?.headers ? this.validateData(route.config.headers, headers) : headers,
      request,
      set: {}
    };

    try {
      // Run global onRequest hook
      if (this.hooks.onRequest) {
        await this.hooks.onRequest(ctx);
      }

      // Run plugin onRequest hooks
      for (const plugin of this.plugins) {
        if (plugin.onRequest) {
          await plugin.onRequest(ctx);
        }
      }

      // Execute route handler
      let response = await route.handler(ctx);

      // Run global onResponse hook
      if (this.hooks.onResponse) {
        response = await this.hooks.onResponse(ctx, response) || response;
      }

      // Run plugin onResponse hooks
      for (const plugin of this.plugins) {
        if (plugin.onResponse) {
          response = await plugin.onResponse(ctx, response) || response;
        }
      }

      // Convert response to Response object
      if (response instanceof Response) {
        return response;
      }

      const responseInit: ResponseInit = {
        status: ctx.set.status || 200,
        headers: ctx.set.headers || {}
      };

      if (typeof response === 'string') {
        return new Response(response, responseInit);
      }

      return new Response(JSON.stringify(response), {
        ...responseInit,
        headers: {
          'Content-Type': 'application/json',
          ...responseInit.headers
        }
      });

    } catch (error) {
      // Run error hooks
      let errorResponse: any;

      if (this.hooks.onError) {
        errorResponse = await this.hooks.onError(ctx, error as Error);
      }

      for (const plugin of this.plugins) {
        if (plugin.onError) {
          errorResponse = await plugin.onError(ctx, error as Error) || errorResponse;
        }
      }

      if (errorResponse) {
        if (errorResponse instanceof Response) {
          return errorResponse;
        }
        return new Response(JSON.stringify(errorResponse), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // Default error response
      const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
      return new Response(JSON.stringify({ error: errorMessage }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  // Hot reload functionality
  enableHotReload(watchPaths: string[] = ['./']): this {
    this.hotReloadEnabled = true;
    watchPaths.forEach(path => this.watchedFiles.add(path));
    return this;
  }

  private async setupFileWatcher(port: number, hostname: string): Promise<void> {
    if (!this.hotReloadEnabled) return;

    const fs = require('fs');
    
    for (const watchPath of this.watchedFiles) {
      try {
        fs.watch(watchPath, { recursive: true }, async (eventType: string, filename: string) => {
          if (filename && (filename.endsWith('.ts') || filename.endsWith('.js'))) {
            console.log(`🔄 File changed: ${filename}, restarting server...`);
            await this.restart(port, hostname);
          }
        });
        console.log(`👀 Watching ${watchPath} for changes...`);
      } catch (error) {
        console.warn(`⚠️  Could not watch ${watchPath}:`, error);
      }
    }
  }

  // Server management methods
  async start(port: number = 3000, hostname: string = 'localhost'): Promise<void> {
    if (this.isRunning) {
      console.log('⚠️  Server is already running');
      return;
    }

    try {
      // Before start hook
      if (this.hooks.onBeforeStart) {
        await this.hooks.onBeforeStart();
      }

      this.server = Bun.serve({
        port,
        hostname,
        fetch: (request) => this.handleRequest(request),
      });

      this.isRunning = true;

      console.log(`🦊 BXO server running at http://${hostname}:${port}`);

      // After start hook
      if (this.hooks.onAfterStart) {
        await this.hooks.onAfterStart();
      }

      // Setup hot reload
      await this.setupFileWatcher(port, hostname);

      // Handle graceful shutdown
      const shutdownHandler = async () => {
        await this.stop();
        process.exit(0);
      };

      process.on('SIGINT', shutdownHandler);
      process.on('SIGTERM', shutdownHandler);

    } catch (error) {
      console.error('❌ Failed to start server:', error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      console.log('⚠️  Server is not running');
      return;
    }

    try {
      // Before stop hook
      if (this.hooks.onBeforeStop) {
        await this.hooks.onBeforeStop();
      }

      if (this.server) {
        this.server.stop();
        this.server = null;
      }

      this.isRunning = false;

      console.log('🛑 BXO server stopped');

      // After stop hook
      if (this.hooks.onAfterStop) {
        await this.hooks.onAfterStop();
      }

    } catch (error) {
      console.error('❌ Error stopping server:', error);
      throw error;
    }
  }

  async restart(port: number = 3000, hostname: string = 'localhost'): Promise<void> {
    try {
      // Before restart hook
      if (this.hooks.onBeforeRestart) {
        await this.hooks.onBeforeRestart();
      }

      console.log('🔄 Restarting BXO server...');
      
      await this.stop();
      
      // Small delay to ensure cleanup
      await new Promise(resolve => setTimeout(resolve, 100));
      
      await this.start(port, hostname);

      // After restart hook
      if (this.hooks.onAfterRestart) {
        await this.hooks.onAfterRestart();
      }
      
    } catch (error) {
      console.error('❌ Error restarting server:', error);
      throw error;
    }
  }

  // Backward compatibility
  async listen(port: number = 3000, hostname: string = 'localhost'): Promise<void> {
    return this.start(port, hostname);
  }

  // Server status
  isServerRunning(): boolean {
    return this.isRunning;
  }

  getServerInfo(): { running: boolean; hotReload: boolean; watchedFiles: string[] } {
    return {
      running: this.isRunning,
      hotReload: this.hotReloadEnabled,
      watchedFiles: Array.from(this.watchedFiles)
    };
  }
}

// Export Zod for convenience
export { z };

export type { Plugin } from './plugins';

// Export types for external use
export type { RouteConfig };
