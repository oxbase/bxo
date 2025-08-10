import { z } from 'zod';

// Type utilities for extracting types from Zod schemas
type InferZodType<T> = T extends z.ZodType<infer U> ? U : never;

// Response configuration types
type ResponseSchema = z.ZodSchema<any>;
type StatusResponseSchema = Record<number, ResponseSchema>;
type ResponseConfig = ResponseSchema | StatusResponseSchema;

// Type utility to extract response type from response config
type InferResponseType<T> = T extends ResponseSchema 
  ? InferZodType<T>
  : T extends StatusResponseSchema 
    ? { [K in keyof T]: InferZodType<T[K]> }[keyof T]
    : never;

// Cookie interface
interface Cookie {
  name: string;
  value: string;
  domain?: string;
  path?: string;
  expires?: Date;
  maxAge?: number;
  secure?: boolean;
  httpOnly?: boolean;
  sameSite?: 'Strict' | 'Lax' | 'None';
}

// OpenAPI detail information
interface RouteDetail {
  summary?: string;
  description?: string;
  tags?: string[];
  operationId?: string;
  deprecated?: boolean;
  produces?: string[];
  consumes?: string[];
  [key: string]: any; // Allow additional OpenAPI properties
}

// Configuration interface for route handlers
interface RouteConfig {
  params?: z.ZodSchema<any>;
  query?: z.ZodSchema<any>;
  body?: z.ZodSchema<any>;
  headers?: z.ZodSchema<any>;
  cookies?: z.ZodSchema<any>;
  response?: ResponseConfig;
  detail?: RouteDetail;
}

// Helper type to extract status codes from response config
type StatusCodes<T> = T extends Record<number, any> ? keyof T : never;

// Context type that's fully typed based on the route configuration
export type Context<TConfig extends RouteConfig = {}> = {
  params: TConfig['params'] extends z.ZodSchema<any> ? InferZodType<TConfig['params']> : Record<string, string>;
  query: TConfig['query'] extends z.ZodSchema<any> ? InferZodType<TConfig['query']> : Record<string, string | undefined>;
  body: TConfig['body'] extends z.ZodSchema<any> ? InferZodType<TConfig['body']> : unknown;
  headers: TConfig['headers'] extends z.ZodSchema<any> ? InferZodType<TConfig['headers']> : Record<string, string>;
  cookies: TConfig['cookies'] extends z.ZodSchema<any> ? InferZodType<TConfig['cookies']> : Record<string, string>;
  path: string;
  request: Request;
  set: {
    status?: number;
    headers?: Record<string, string>;
    cookies?: Cookie[];
  };
  status: <T extends number>(
    code: TConfig['response'] extends StatusResponseSchema 
      ? StatusCodes<TConfig['response']> | number
      : T,
    data?: TConfig['response'] extends StatusResponseSchema 
      ? T extends keyof TConfig['response'] 
        ? InferZodType<TConfig['response'][T]>
        : any
      : TConfig['response'] extends ResponseSchema 
        ? InferZodType<TConfig['response']>
        : any
  ) => TConfig['response'] extends StatusResponseSchema 
    ? T extends keyof TConfig['response'] 
      ? InferZodType<TConfig['response'][T]>
      : any
    : TConfig['response'] extends ResponseSchema 
      ? InferZodType<TConfig['response']>
      : any;
  [key: string]: any;
};

// Handler function type with proper response typing
type Handler<TConfig extends RouteConfig = {}, EC = {}> = (ctx: Context<TConfig> & EC) => Promise<InferResponseType<TConfig['response']> | any> | InferResponseType<TConfig['response']> | any;

// Route definition
interface Route {
  method: string;
  path: string;
  handler: Handler<any>;
  config?: RouteConfig;
}

// WebSocket handler interface
interface WebSocketHandler {
  onOpen?: (ws: any) => void;
  onMessage?: (ws: any, message: string | Buffer) => void;
  onClose?: (ws: any, code?: number, reason?: string) => void;
  onError?: (ws: any, error: Error) => void;
}

// WebSocket route definition
interface WSRoute {
  path: string;
  handler: WebSocketHandler;
}

// Lifecycle hooks
interface LifecycleHooks {
  onBeforeStart?: (instance: BXO) => Promise<void> | void;
  onAfterStart?: (instance: BXO) => Promise<void> | void;
  onBeforeStop?: (instance: BXO) => Promise<void> | void;
  onAfterStop?: (instance: BXO) => Promise<void> | void;
  onRequest?: (ctx: Context, instance: BXO) => Promise<void> | void;
  onResponse?: (ctx: Context, response: any, instance: BXO) => Promise<any> | any;
  onError?: (ctx: Context, error: Error, instance: BXO) => Promise<any> | any;
}

export default class BXO {
  private _routes: Route[] = [];
  private _wsRoutes: WSRoute[] = [];
  private plugins: BXO[] = [];
  private hooks: LifecycleHooks = {};
  private server?: any;
  private isRunning: boolean = false;
  private serverPort?: number;
  private serverHostname?: string;

  constructor() { }

  // Lifecycle hook methods
  onBeforeStart(handler: (instance: BXO) => Promise<void> | void): this {
    this.hooks.onBeforeStart = handler;
    return this;
  }

  onAfterStart(handler: (instance: BXO) => Promise<void> | void): this {
    this.hooks.onAfterStart = handler;
    return this;
  }

  onBeforeStop(handler: (instance: BXO) => Promise<void> | void): this {
    this.hooks.onBeforeStop = handler;
    return this;
  }

  onAfterStop(handler: (instance: BXO) => Promise<void> | void): this {
    this.hooks.onAfterStop = handler;
    return this;
  }



  onRequest(handler: (ctx: Context, instance: BXO) => Promise<void> | void): this {
    this.hooks.onRequest = handler;
    return this;
  }

  onResponse(handler: (ctx: Context, response: any, instance: BXO) => Promise<any> | any): this {
    this.hooks.onResponse = handler;
    return this;
  }

  onError(handler: (ctx: Context, error: Error, instance: BXO) => Promise<any> | any): this {
    this.hooks.onError = handler;
    return this;
  }

  // Plugin system - now accepts other BXO instances
  use(bxoInstance: BXO): this {
    this.plugins.push(bxoInstance);
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
    this._routes.push({ method: 'GET', path, handler, config });
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
    this._routes.push({ method: 'POST', path, handler, config });
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
    this._routes.push({ method: 'PUT', path, handler, config });
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
    this._routes.push({ method: 'DELETE', path, handler, config });
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
    this._routes.push({ method: 'PATCH', path, handler, config });
    return this;
  }

  // WebSocket route handler
  ws(path: string, handler: WebSocketHandler): this {
    this._wsRoutes.push({ path, handler });
    return this;
  }

  // Helper methods to get all routes including plugin routes
  private getAllRoutes(): Route[] {
    const allRoutes = [...this._routes];
    for (const plugin of this.plugins) {
      allRoutes.push(...plugin._routes);
    }
    return allRoutes;
  }

  private getAllWSRoutes(): WSRoute[] {
    const allWSRoutes = [...this._wsRoutes];
    for (const plugin of this.plugins) {
      allWSRoutes.push(...plugin._wsRoutes);
    }
    return allWSRoutes;
  }

  // Route matching utility
  private matchRoute(method: string, pathname: string): { route: Route; params: Record<string, string> } | null {
    const allRoutes = this.getAllRoutes();

    for (const route of allRoutes) {
      if (route.method !== method) continue;

      const routeSegments = route.path.split('/').filter(Boolean);
      const pathSegments = pathname.split('/').filter(Boolean);

      const params: Record<string, string> = {};
      let isMatch = true;

      // Handle wildcard at the end (catch-all)
      const hasWildcardAtEnd = routeSegments.length > 0 && routeSegments[routeSegments.length - 1] === '*';

      if (hasWildcardAtEnd) {
        // For catch-all wildcard, path must have at least as many segments as route (minus the wildcard)
        if (pathSegments.length < routeSegments.length - 1) continue;
      } else {
        // For exact matching (with possible single-segment wildcards), lengths must match
        if (routeSegments.length !== pathSegments.length) continue;
      }

      for (let i = 0; i < routeSegments.length; i++) {
        const routeSegment = routeSegments[i];
        const pathSegment = pathSegments[i];

        if (!routeSegment) {
          isMatch = false;
          break;
        }

        // Handle catch-all wildcard at the end
        if (routeSegment === '*' && i === routeSegments.length - 1) {
          // Wildcard at end matches remaining path segments
          const remainingPath = pathSegments.slice(i).join('/');
          params['*'] = remainingPath;
          break;
        }

        if (!pathSegment) {
          isMatch = false;
          break;
        }

        if (routeSegment.startsWith(':')) {
          const paramName = routeSegment.slice(1);
          params[paramName] = decodeURIComponent(pathSegment);
        } else if (routeSegment === '*') {
          // Single segment wildcard
          params['*'] = decodeURIComponent(pathSegment);
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

  // WebSocket route matching utility
  private matchWSRoute(pathname: string): { route: WSRoute; params: Record<string, string> } | null {
    const allWSRoutes = this.getAllWSRoutes();

    for (const route of allWSRoutes) {
      const routeSegments = route.path.split('/').filter(Boolean);
      const pathSegments = pathname.split('/').filter(Boolean);

      const params: Record<string, string> = {};
      let isMatch = true;

      // Handle wildcard at the end (catch-all)
      const hasWildcardAtEnd = routeSegments.length > 0 && routeSegments[routeSegments.length - 1] === '*';

      if (hasWildcardAtEnd) {
        // For catch-all wildcard, path must have at least as many segments as route (minus the wildcard)
        if (pathSegments.length < routeSegments.length - 1) continue;
      } else {
        // For exact matching (with possible single-segment wildcards), lengths must match
        if (routeSegments.length !== pathSegments.length) continue;
      }

      for (let i = 0; i < routeSegments.length; i++) {
        const routeSegment = routeSegments[i];
        const pathSegment = pathSegments[i];

        if (!routeSegment) {
          isMatch = false;
          break;
        }

        // Handle catch-all wildcard at the end
        if (routeSegment === '*' && i === routeSegments.length - 1) {
          // Wildcard at end matches remaining path segments
          const remainingPath = pathSegments.slice(i).join('/');
          params['*'] = remainingPath;
          break;
        }

        if (!pathSegment) {
          isMatch = false;
          break;
        }

        if (routeSegment.startsWith(':')) {
          const paramName = routeSegment.slice(1);
          params[paramName] = decodeURIComponent(pathSegment);
        } else if (routeSegment === '*') {
          // Single segment wildcard
          params['*'] = decodeURIComponent(pathSegment);
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
    searchParams.forEach((value, key) => {
      query[key] = value;
    });
    return query;
  }

  // Parse headers
  private parseHeaders(headers: Headers): Record<string, string> {
    const headerObj: Record<string, string> = {};
    headers.forEach((value, key) => {
      headerObj[key] = value;
    });
    return headerObj;
  }

  // Parse cookies from Cookie header
  private parseCookies(cookieHeader: string | null): Record<string, string> {
    const cookies: Record<string, string> = {};
    
    if (!cookieHeader) return cookies;
    
    const cookiePairs = cookieHeader.split(';');
    for (const pair of cookiePairs) {
      const [name, value] = pair.trim().split('=');
      if (name && value) {
        cookies[decodeURIComponent(name)] = decodeURIComponent(value);
      }
    }
    
    return cookies;
  }

  // Validate data against Zod schema
  private validateData<T>(schema: z.ZodSchema<T> | undefined, data: any): T {
    if (!schema) return data;
    return schema.parse(data);
  }

  // Validate response against response config (supports both simple and status-based schemas)
  private validateResponse(responseConfig: ResponseConfig | undefined, data: any, status: number = 200): any {
    if (!responseConfig) return data;
    
    // If it's a simple schema (not status-based)
    if ('parse' in responseConfig && typeof responseConfig.parse === 'function') {
      return responseConfig.parse(data);
    }
    
    // If it's a status-based schema
    if (typeof responseConfig === 'object' && !('parse' in responseConfig)) {
      const statusSchema = responseConfig[status];
      if (statusSchema) {
        return statusSchema.parse(data);
      }
      
      // If no specific status schema found, try to find a fallback
      // Common fallback statuses: 200, 201, 400, 500
      const fallbackStatuses = [200, 201, 400, 500];
      for (const fallbackStatus of fallbackStatuses) {
        if (responseConfig[fallbackStatus]) {
          return responseConfig[fallbackStatus].parse(data);
        }
      }
      
      // If no schema found for the status, return data as-is
      return data;
    }
    
    return data;
  }

  // Main request handler
  private async handleRequest(request: Request, server?: any): Promise<Response | undefined> {
    const url = new URL(request.url);
    const method = request.method;
    const pathname = url.pathname;

    // Check for WebSocket upgrade
    if (request.headers.get('upgrade') === 'websocket') {
      const wsMatchResult = this.matchWSRoute(pathname);
      if (wsMatchResult && server) {
        const success = server.upgrade(request, {
          data: {
            handler: wsMatchResult.route.handler,
            params: wsMatchResult.params,
            pathname
          }
        });

        if (success) {
          return; // undefined response means upgrade was successful
        }
      }
      return new Response('WebSocket upgrade failed', { status: 400 });
    }

    const matchResult = this.matchRoute(method, pathname);
    if (!matchResult) {
      return new Response('Not Found', { status: 404 });
    }

    const { route, params } = matchResult;
    const query = this.parseQuery(url.searchParams);
    const headers = this.parseHeaders(request.headers);
    const cookies = this.parseCookies(request.headers.get('cookie'));

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
        // Try to parse as JSON if it looks like JSON, otherwise treat as text
        const textBody = await request.text();
        try {
          // Check if the text looks like JSON
          if (textBody.trim().startsWith('{') || textBody.trim().startsWith('[')) {
            body = JSON.parse(textBody);
          } else {
            body = textBody;
          }
        } catch {
          body = textBody;
        }
      }
    }

    // Create context with validation
    let ctx: Context;
    try {
      // Validate each part separately to get better error messages
      const validatedParams = route.config?.params ? this.validateData(route.config.params, params) : params;
      const validatedQuery = route.config?.query ? this.validateData(route.config.query, query) : query;
      const validatedBody = route.config?.body ? this.validateData(route.config.body, body) : body;
      const validatedHeaders = route.config?.headers ? this.validateData(route.config.headers, headers) : headers;
      const validatedCookies = route.config?.cookies ? this.validateData(route.config.cookies, cookies) : cookies;
      
      ctx = {
        params: validatedParams,
        query: validatedQuery,
        body: validatedBody,
        headers: validatedHeaders,
        cookies: validatedCookies,
        path: pathname,
        request,
        set: {},
        status: ((code: number, data?: any) => {
          ctx.set.status = code;
          return data;
        }) as any
      };
    } catch (validationError) {
      // Validation failed - return error response
      
      // Extract detailed validation errors from Zod
      let validationDetails = undefined;
      if (validationError instanceof Error) {
        if ('errors' in validationError && Array.isArray(validationError.errors)) {
          validationDetails = validationError.errors;
        } else if ('issues' in validationError && Array.isArray(validationError.issues)) {
          validationDetails = validationError.issues;
        }
      }
      
      // Create a clean error message
      const errorMessage = validationDetails && validationDetails.length > 0 
        ? `Validation failed for ${validationDetails.length} field(s)`
        : 'Validation failed';
      
      return new Response(JSON.stringify({ 
        error: errorMessage,
        details: validationDetails
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    try {
      // Run global onRequest hook
      if (this.hooks.onRequest) {
        await this.hooks.onRequest(ctx, this);
      }

      // Run BXO instance onRequest hooks
      for (const bxoInstance of this.plugins) {
        if (bxoInstance.hooks.onRequest) {
          await bxoInstance.hooks.onRequest(ctx, this);
        }
      }

      // Execute route handler
      let response = await route.handler(ctx);

      // Run global onResponse hook
      if (this.hooks.onResponse) {
        response = await this.hooks.onResponse(ctx, response, this) || response;
      }

      // Run BXO instance onResponse hooks
      for (const bxoInstance of this.plugins) {
        if (bxoInstance.hooks.onResponse) {
          response = await bxoInstance.hooks.onResponse(ctx, response, this) || response;
        }
      }

      // Validate response against schema if provided
      if (route.config?.response && !(response instanceof Response)) {
        try {
          const status = ctx.set.status || 200;
          response = this.validateResponse(route.config.response, response, status);
        } catch (validationError) {
          // Response validation failed
          
          // Extract detailed validation errors from Zod
          let validationDetails = undefined;
          if (validationError instanceof Error) {
            if ('errors' in validationError && Array.isArray(validationError.errors)) {
              validationDetails = validationError.errors;
            } else if ('issues' in validationError && Array.isArray(validationError.issues)) {
              validationDetails = validationError.issues;
            }
          }
          
          // Create a clean error message
          const errorMessage = validationDetails && validationDetails.length > 0 
            ? `Response validation failed for ${validationDetails.length} field(s)`
            : 'Response validation failed';
          
          return new Response(JSON.stringify({ 
            error: errorMessage,
            details: validationDetails
          }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      }

      // Convert response to Response object
      if (response instanceof Response) {
        return response;
      }

      // Handle File response (like Elysia)
      if (response instanceof File || (typeof Bun !== 'undefined' && response instanceof Bun.file('').constructor)) {
        const file = response as File;
        const responseInit: ResponseInit = {
          status: ctx.set.status || 200,
          headers: {
            'Content-Type': file.type || 'application/octet-stream',
            'Content-Length': file.size.toString(),
            ...ctx.set.headers
          }
        };
        return new Response(file, responseInit);
      }

      // Handle Bun.file() response
      if (typeof response === 'object' && response && 'stream' in response && 'size' in response) {
        const bunFile = response as any;
        const responseInit: ResponseInit = {
          status: ctx.set.status || 200,
          headers: {
            'Content-Type': bunFile.type || 'application/octet-stream',
            'Content-Length': bunFile.size?.toString() || '',
            ...ctx.set.headers,
            ...(bunFile.headers || {}) // Support custom headers from file helper
          }
        };
        return new Response(bunFile, responseInit);
      }

      // Prepare headers with cookies
      let responseHeaders = ctx.set.headers ? { ...ctx.set.headers } : {};
      
      // Handle cookies if any are set
      if (ctx.set.cookies && ctx.set.cookies.length > 0) {
        const cookieHeaders = ctx.set.cookies.map(cookie => {
          let cookieString = `${encodeURIComponent(cookie.name)}=${encodeURIComponent(cookie.value)}`;
          
          if (cookie.domain) cookieString += `; Domain=${cookie.domain}`;
          if (cookie.path) cookieString += `; Path=${cookie.path}`;
          if (cookie.expires) cookieString += `; Expires=${cookie.expires.toUTCString()}`;
          if (cookie.maxAge) cookieString += `; Max-Age=${cookie.maxAge}`;
          if (cookie.secure) cookieString += `; Secure`;
          if (cookie.httpOnly) cookieString += `; HttpOnly`;
          if (cookie.sameSite) cookieString += `; SameSite=${cookie.sameSite}`;
          
          return cookieString;
        });
        
        // Add Set-Cookie headers
        cookieHeaders.forEach((cookieHeader, index) => {
          responseHeaders[index === 0 ? 'Set-Cookie' : `Set-Cookie-${index}`] = cookieHeader;
        });
      }

      const responseInit: ResponseInit = {
        status: ctx.set.status || 200,
        headers: responseHeaders
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
        errorResponse = await this.hooks.onError(ctx, error as Error, this);
      }

      for (const bxoInstance of this.plugins) {
        if (bxoInstance.hooks.onError) {
          errorResponse = await bxoInstance.hooks.onError(ctx, error as Error, this) || errorResponse;
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



  // Server management methods
  async start(port: number = 3000, hostname: string = 'localhost'): Promise<void> {
    if (this.isRunning) {
      console.log('⚠️  Server is already running');
      return;
    }

    try {
      // Before start hook
      if (this.hooks.onBeforeStart) {
        await this.hooks.onBeforeStart(this);
      }

      this.server = Bun.serve({
        port,
        hostname,
        fetch: (request, server) => this.handleRequest(request, server),
        websocket: {
          message: (ws: any, message: any) => {
            const handler = ws.data?.handler;
            if (handler?.onMessage) {
              handler.onMessage(ws, message);
            }
          },
          open: (ws: any) => {
            const handler = ws.data?.handler;
            if (handler?.onOpen) {
              handler.onOpen(ws);
            }
          },
          close: (ws: any, code?: number, reason?: string) => {
            const handler = ws.data?.handler;
            if (handler?.onClose) {
              handler.onClose(ws, code, reason);
            }
          }
        }
      });

      // Verify server was created successfully
      if (!this.server) {
        throw new Error('Failed to create server instance');
      }

      this.isRunning = true;
      this.serverPort = port;
      this.serverHostname = hostname;

      // After start hook
      if (this.hooks.onAfterStart) {
        await this.hooks.onAfterStart(this);
      }

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
        await this.hooks.onBeforeStop(this);
      }

      if (this.server) {
        try {
          // Try to stop the server gracefully
          if (typeof this.server.stop === 'function') {
            this.server.stop();
          } else {
            console.warn('⚠️  Server stop method not available');
          }
        } catch (stopError) {
          console.error('❌ Error calling server.stop():', stopError);
        }
        
        // Clear the server reference
        this.server = undefined;
      }

      // Reset state regardless of server.stop() success
      this.isRunning = false;
      this.serverPort = undefined;
      this.serverHostname = undefined;

      // After stop hook
      if (this.hooks.onAfterStop) {
        await this.hooks.onAfterStop(this);
      }

      console.log('✅ Server stopped successfully');

    } catch (error) {
      console.error('❌ Error stopping server:', error);
      // Even if there's an error, reset the state
      this.isRunning = false;
      this.server = undefined;
      this.serverPort = undefined;
      this.serverHostname = undefined;
      throw error;
    }
  }



  // Backward compatibility
  async listen(port: number = 3000, hostname: string = 'localhost'): Promise<void> {
    return this.start(port, hostname);
  }

  // Server status
  isServerRunning(): boolean {
    return this.isRunning && this.server !== undefined;
  }

  getServerInfo(): { running: boolean } {
    return {
      running: this.isRunning
    };
  }

  // Get server information (alias for getServerInfo)
  get info() {
    // Calculate total routes including plugins
    const totalRoutes = this._routes.length + this.plugins.reduce((total, plugin) => total + plugin._routes.length, 0);
    const totalWsRoutes = this._wsRoutes.length + this.plugins.reduce((total, plugin) => total + plugin._wsRoutes.length, 0);

    return {
      // Server status
      running: this.isRunning,
      server: this.server ? 'Bun' : null,

      // Connection details
      hostname: this.serverHostname,
      port: this.serverPort,
      url: this.isRunning && this.serverHostname && this.serverPort
        ? `http://${this.serverHostname}:${this.serverPort}`
        : null,

      // Application statistics
      totalRoutes,
      totalWsRoutes,
      totalPlugins: this.plugins.length,

      // System information
      runtime: 'Bun',
      version: typeof Bun !== 'undefined' ? Bun.version : 'unknown',
      pid: process.pid,
      uptime: this.isRunning ? process.uptime() : 0
    };
  }

  // Get all routes information
  get routes() {
    // Get routes from main instance
    const mainRoutes = this._routes.map((route: Route) => ({
      method: route.method,
      path: route.path,
      hasConfig: !!route.config,
      config: route.config || null,
      source: 'main' as const
    }));

    // Get routes from all plugins
    const pluginRoutes = this.plugins.flatMap((plugin, pluginIndex) =>
      plugin._routes.map((route: Route) => ({
        method: route.method,
        path: route.path,
        hasConfig: !!route.config,
        config: route.config || null,
        source: 'plugin' as const,
        pluginIndex
      }))
    );

    return [...mainRoutes, ...pluginRoutes];
  }

  // Get all WebSocket routes information
  get wsRoutes() {
    // Get WebSocket routes from main instance
    const mainWsRoutes = this._wsRoutes.map((route: WSRoute) => ({
      path: route.path,
      hasHandlers: {
        onOpen: !!route.handler.onOpen,
        onMessage: !!route.handler.onMessage,
        onClose: !!route.handler.onClose,
        onError: !!route.handler.onError
      },
      source: 'main' as const
    }));

    // Get WebSocket routes from all plugins
    const pluginWsRoutes = this.plugins.flatMap((plugin, pluginIndex) =>
      plugin._wsRoutes.map((route: WSRoute) => ({
        path: route.path,
        hasHandlers: {
          onOpen: !!route.handler.onOpen,
          onMessage: !!route.handler.onMessage,
          onClose: !!route.handler.onClose,
          onError: !!route.handler.onError
        },
        source: 'plugin' as const,
        pluginIndex
      }))
    );

    return [...mainWsRoutes, ...pluginWsRoutes];
  }
}

const error = (error: Error | string, status: number = 500) => {
  return new Response(JSON.stringify({ error: error instanceof Error ? error.message : error }), { status });
}

// File helper function (like Elysia)
const file = (path: string, options?: { type?: string; headers?: Record<string, string> }) => {
  const bunFile = Bun.file(path);

  if (options?.type) {
    // Create a wrapper to override the MIME type
    return {
      ...bunFile,
      type: options.type,
      headers: options.headers
    };
  }

  return bunFile;
}

// Export Zod for convenience
export { z, error, file };

// Export types for external use
export type { RouteConfig, RouteDetail, Handler, WebSocketHandler, WSRoute, Cookie };

// Helper function to create a cookie
export const createCookie = (
  name: string,
  value: string,
  options: Omit<Cookie, 'name' | 'value'> = {}
): Cookie => ({
  name,
  value,
  ...options
});
