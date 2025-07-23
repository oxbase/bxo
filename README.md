# 🦊 BXO - A Type-Safe Web Framework for Bun

BXO is a fast, lightweight, and fully type-safe web framework built specifically for Bun runtime. Inspired by Elysia, it provides excellent developer experience with automatic type inference, Zod validation, and a powerful plugin system.

## ✨ Features

- 🚀 **Built for Bun** - Leverages Bun's native HTTP server for maximum performance
- 🔒 **Type-Safe** - Full TypeScript support with automatic type inference
- 📋 **Zod Validation** - Built-in request/response validation using Zod schemas
- 🔌 **Plugin System** - Extensible architecture with lifecycle hooks
- 🎣 **Lifecycle Hooks** - Complete control over server and request/response lifecycle
- 🔄 **Hot Reload** - Automatic server restart on file changes during development
- 🎮 **Server Management** - Programmatic start, stop, and restart capabilities
- 📊 **Status Monitoring** - Built-in server status and runtime statistics
- 📦 **Zero Dependencies** - Only depends on Zod for validation
- ⚡ **Fast** - Minimal overhead with efficient routing

## 🚀 Quick Start

### Installation

```bash
bun add zod
```

### Basic Usage

```typescript
import BXO, { z } from './index';

const app = new BXO()
  .get('/', async (ctx) => {
    return { message: 'Hello, BXO!' };
  })
  .start(3000);
```

## 📚 Documentation

### HTTP Handlers

BXO supports all standard HTTP methods with fluent chaining:

```typescript
const app = new BXO()
  // Simple handler
  .get('/simple', async (ctx) => {
    return { message: 'Hello World' };
  })
  
  // With validation
  .post('/users', async (ctx) => {
    // ctx.body is fully typed
    return { created: ctx.body };
  }, {
    body: z.object({
      name: z.string(),
      email: z.string().email()
    })
  })
  
  // Path parameters
  .get('/users/:id', async (ctx) => {
    // ctx.params.id is typed as UUID string
    return { user: { id: ctx.params.id } };
  }, {
    params: z.object({ 
      id: z.string().uuid() 
    }),
    query: z.object({ 
      include: z.string().optional() 
    })
  })
  
  // All HTTP methods supported
  .put('/users/:id', handler)
  .delete('/users/:id', handler)
  .patch('/users/:id', handler);
```

### Context Object

The context object (`ctx`) provides access to request data and response configuration:

```typescript
interface Context<TConfig> {
  params: InferredParamsType;    // Path parameters
  query: InferredQueryType;      // Query string parameters  
  body: InferredBodyType;        // Request body
  headers: InferredHeadersType;  // Request headers
  request: Request;              // Original Request object
  set: {                         // Response configuration
    status?: number;
    headers?: Record<string, string>;
  };
  user?: any;                    // Added by auth plugin
  [key: string]: any;            // Extended by plugins
}
```

### Validation Configuration

Each route can specify validation schemas for different parts of the request:

```typescript
const config = {
  params: z.object({ id: z.string().uuid() }),
  query: z.object({ 
    page: z.coerce.number().default(1),
    limit: z.coerce.number().max(100).default(10)
  }),
  body: z.object({
    name: z.string().min(1),
    email: z.string().email()
  }),
  headers: z.object({
    'content-type': z.literal('application/json')
  })
};

app.post('/api/users/:id', async (ctx) => {
  // All properties are fully typed based on schemas
  const { id } = ctx.params;           // string (UUID)
  const { page, limit } = ctx.query;   // number, number
  const { name, email } = ctx.body;    // string, string
}, config);
```

## 🔌 Plugin System

BXO has a powerful plugin system with lifecycle hooks. Plugins are separate modules imported from `./plugins`.

### Available Plugins

#### CORS Plugin

```typescript
import { cors } from './plugins';

app.use(cors({
  origin: ['http://localhost:3000', 'https://example.com'],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  maxAge: 86400
}));
```

#### Logger Plugin

```typescript
import { logger } from './plugins';

app.use(logger({
  format: 'simple',        // 'simple' | 'detailed' | 'json'
  includeBody: false,      // Log request/response bodies
  includeHeaders: false    // Log headers
}));
```

#### Authentication Plugin

```typescript
import { auth, createJWT } from './plugins';

app.use(auth({
  type: 'jwt',                    // 'jwt' | 'bearer' | 'apikey'
  secret: 'your-secret-key',
  exclude: ['/login', '/health'], // Skip auth for these paths
  verify: async (token, ctx) => {
    // Custom token verification
    return { user: 'data' };
  }
}));

// Create JWT tokens
const token = createJWT(
  { userId: 123, role: 'admin' }, 
  'secret', 
  3600 // expires in 1 hour
);
```

#### Rate Limiting Plugin

```typescript
import { rateLimit } from './plugins';

app.use(rateLimit({
  max: 100,                    // Max requests
  window: 60,                  // Time window in seconds
  exclude: ['/health'],        // Skip rate limiting for these paths
  keyGenerator: (ctx) => {     // Custom key generation
    return ctx.request.headers.get('x-api-key') || 'default';
  },
  message: 'Too many requests',
  statusCode: 429
}));
```

### Creating Custom Plugins

```typescript
const customPlugin = {
  name: 'custom',
  onRequest: async (ctx) => {
    console.log('Before request processing');
    ctx.startTime = Date.now();
  },
  onResponse: async (ctx, response) => {
    console.log(`Request took ${Date.now() - ctx.startTime}ms`);
    return response;
  },
  onError: async (ctx, error) => {
    console.error('Request failed:', error.message);
    return { error: 'Custom error response' };
  }
};

app.use(customPlugin);
```

## 🎣 Lifecycle Hooks

BXO provides comprehensive lifecycle hooks with a consistent before/after pattern for both server and request lifecycle:

### Server Lifecycle Hooks

```typescript
app
  .onBeforeStart(() => {
    console.log('🔧 Preparing to start server...');
  })
  .onAfterStart(() => {
    console.log('✅ Server fully started and ready!');
  })
  .onBeforeStop(() => {
    console.log('🔧 Preparing to stop server...');
  })
  .onAfterStop(() => {
    console.log('✅ Server fully stopped!');
  })
  .onBeforeRestart(() => {
    console.log('🔧 Preparing to restart server...');
  })
  .onAfterRestart(() => {
    console.log('✅ Server restart completed!');
  });
```

### Request Lifecycle Hooks

```typescript
app
  .onRequest((ctx) => {
    console.log(`📨 ${ctx.request.method} ${ctx.request.url}`);
  })
  .onResponse((ctx, response) => {
    console.log(`📤 Response sent`);
    return response; // Can modify response
  })
  .onError((ctx, error) => {
    console.error(`💥 Error:`, error.message);
    return { error: 'Something went wrong' }; // Can provide custom error response
  });
```

## 🔄 Hot Reload & Server Management

BXO includes built-in hot reload and comprehensive server management capabilities:

### Hot Reload

```typescript
const app = new BXO();

// Enable hot reload - server will restart when files change
app.enableHotReload(['./']); // Watch current directory

// Hot reload will automatically restart the server when:
// - Any .ts or .js file changes in watched directories
// - Server lifecycle hooks are properly executed during restart
```

### Server Management

```typescript
const app = new BXO();

// Start server
await app.start(3000, 'localhost');

// Check if server is running
if (app.isServerRunning()) {
  console.log('Server is running!');
}

// Get server information
const info = app.getServerInfo();
console.log(info); // { running: true, hotReload: true, watchedFiles: ['./'] }

// Restart server programmatically
await app.restart(3000, 'localhost');

// Stop server gracefully
await app.stop();

// Backward compatibility - listen() still works
await app.listen(3000); // Same as app.start(3000)
```

### Development vs Production

```typescript
const app = new BXO();

if (process.env.NODE_ENV === 'development') {
  // Enable hot reload in development
  app.enableHotReload(['./src', './routes']);
}

// Add server management endpoints for development
if (process.env.NODE_ENV === 'development') {
  app.post('/dev/restart', async (ctx) => {
    setTimeout(() => app.restart(3000), 100);
    return { message: 'Server restart initiated' };
  });
  
  app.get('/dev/status', async (ctx) => {
    return {
      ...app.getServerInfo(),
      uptime: process.uptime(),
      memory: process.memoryUsage()
    };
  });
}
```

## 🌟 Complete Example

```typescript
import BXO, { z } from './index';
import { cors, logger, auth, rateLimit, createJWT } from './plugins';

const app = new BXO();

// Enable hot reload for development
app.enableHotReload(['./']);

// Add plugins
app
  .use(logger({ format: 'simple' }))
  .use(cors({ 
    origin: ['http://localhost:3000'],
    credentials: true 
  }))
  .use(rateLimit({ 
    max: 100, 
    window: 60,
    exclude: ['/health'] 
  }))
  .use(auth({ 
    type: 'jwt', 
    secret: 'your-secret-key',
    exclude: ['/', '/login', '/health']
  }));

// Comprehensive lifecycle hooks
app
  .onBeforeStart(() => console.log('🔧 Preparing server startup...'))
  .onAfterStart(() => console.log('✅ Server ready!'))
  .onBeforeRestart(() => console.log('🔄 Restarting server...'))
  .onAfterRestart(() => console.log('✅ Server restarted!'))
  .onError((ctx, error) => ({ 
    error: 'Internal server error',
    timestamp: new Date().toISOString()
  }));

// Routes
app
  .get('/health', async () => ({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    server: app.getServerInfo()
  }))
  
  .post('/login', async (ctx) => {
    const { username, password } = ctx.body;
    
    if (username === 'admin' && password === 'password') {
      const token = createJWT(
        { username, role: 'admin' }, 
        'your-secret-key'
      );
      return { token, user: { username, role: 'admin' } };
    }
    
    ctx.set.status = 401;
    return { error: 'Invalid credentials' };
  }, {
    body: z.object({
      username: z.string(),
      password: z.string()
    })
  })
  
  .get('/users/:id', async (ctx) => {
    return { 
      user: { 
        id: ctx.params.id,
        include: ctx.query.include 
      } 
    };
  }, {
    params: z.object({ id: z.string().uuid() }),
    query: z.object({ include: z.string().optional() })
  })
  
  .post('/users', async (ctx) => {
    return { created: ctx.body };
  }, {
    body: z.object({
      name: z.string(),
      email: z.string().email()
    })
  })
  
  .get('/protected', async (ctx) => {
    // ctx.user available from auth plugin
    return { 
      message: 'Protected resource', 
      user: ctx.user 
    };
  })
  
  // Server management endpoints
  .post('/restart', async (ctx) => {
    setTimeout(() => app.restart(3000), 100);
    return { message: 'Server restart initiated' };
  })
  
  .get('/status', async (ctx) => {
    return {
      ...app.getServerInfo(),
      uptime: process.uptime(),
      memory: process.memoryUsage()
    };
  });

// Start server with hot reload
app.start(3000);
```

## 🧪 Testing Endpoints

With the example server running, test these endpoints:

```bash
# Health check
curl http://localhost:3000/health

# Login to get token
curl -X POST http://localhost:3000/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "password"}'

# Create user
curl -X POST http://localhost:3000/users \
  -H "Content-Type: application/json" \
  -d '{"name": "John Doe", "email": "john@example.com"}'

# Get user with validation
curl "http://localhost:3000/users/123e4567-e89b-12d3-a456-426614174000?include=profile"

# Access protected route (use token from login)
curl http://localhost:3000/protected \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Check server status
curl http://localhost:3000/status

# Restart server programmatically
curl -X POST http://localhost:3000/restart
```

## 📖 API Reference

### BXO Class Methods

#### HTTP Methods
- `get(path, handler, config?)` - Handle GET requests
- `post(path, handler, config?)` - Handle POST requests  
- `put(path, handler, config?)` - Handle PUT requests
- `delete(path, handler, config?)` - Handle DELETE requests
- `patch(path, handler, config?)` - Handle PATCH requests

#### Plugins & Hooks
- `use(plugin)` - Add a plugin
- `onBeforeStart(handler)` - Before server start hook
- `onAfterStart(handler)` - After server start hook
- `onBeforeStop(handler)` - Before server stop hook
- `onAfterStop(handler)` - After server stop hook
- `onBeforeRestart(handler)` - Before server restart hook
- `onAfterRestart(handler)` - After server restart hook
- `onRequest(handler)` - Global request hook
- `onResponse(handler)` - Global response hook
- `onError(handler)` - Global error hook

#### Server Management
- `start(port?, hostname?)` - Start the server
- `stop()` - Stop the server gracefully
- `restart(port?, hostname?)` - Restart the server
- `listen(port?, hostname?)` - Start the server (backward compatibility)
- `isServerRunning()` - Check if server is running
- `getServerInfo()` - Get server status information

#### Hot Reload
- `enableHotReload(watchPaths?)` - Enable hot reload with file watching

### Route Configuration

```typescript
interface RouteConfig {
  params?: z.ZodSchema<any>;   // Path parameter validation
  query?: z.ZodSchema<any>;    // Query string validation  
  body?: z.ZodSchema<any>;     // Request body validation
  headers?: z.ZodSchema<any>;  // Header validation
}
```

### Plugin Interface

```typescript
interface Plugin {
  name?: string;
  onRequest?: (ctx: Context) => Promise<void> | void;
  onResponse?: (ctx: Context, response: any) => Promise<any> | any;
  onError?: (ctx: Context, error: Error) => Promise<any> | any;
}
```

## 🛠️ Development

### Running the Example

```bash
# Run with hot reload enabled
bun run example.ts

# The server will automatically restart when you edit any .ts/.js files!
```

### Project Structure

```
bxo/
├── index.ts              # Main BXO framework
├── plugins/
│   ├── index.ts          # Plugin exports
│   ├── cors.ts           # CORS plugin
│   ├── logger.ts         # Logger plugin
│   ├── auth.ts           # Authentication plugin
│   └── ratelimit.ts      # Rate limiting plugin
├── example.ts            # Usage example
├── package.json
└── README.md
```

## 🤝 Contributing

BXO is designed to be simple and extensible. Contributions are welcome!

## 📄 License

MIT License - feel free to use BXO in your projects!

---

Built with ❤️ for the Bun ecosystem
