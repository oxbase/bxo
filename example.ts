import BXO, { z } from './index';
import { cors, logger, auth, rateLimit, createJWT } from './plugins';

// Create the app instance
const app = new BXO();

// Enable hot reload
app.enableHotReload(['./']); // Watch current directory

// Add plugins
app
  .use(logger({ format: 'simple' }))
  .use(cors({ 
    origin: ['http://localhost:3000', 'https://example.com'],
    credentials: true 
  }))
  .use(rateLimit({ 
    max: 100, 
    window: 60, // 1 minute
    exclude: ['/health'] 
  }))
  .use(auth({ 
    type: 'jwt', 
    secret: 'your-secret-key',
    exclude: ['/', '/login', '/health']
  }));

// Add simplified lifecycle hooks
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
  })
  .onRequest((ctx) => {
    console.log(`📨 Processing ${ctx.request.method} ${ctx.request.url}`);
  })
  .onResponse((ctx, response) => {
    console.log(`📤 Response sent for ${ctx.request.method} ${ctx.request.url}`);
    return response;
  })
  .onError((ctx, error) => {
    console.error(`💥 Error in ${ctx.request.method} ${ctx.request.url}:`, error.message);
    return { error: 'Something went wrong', timestamp: new Date().toISOString() };
  });

// Routes exactly like your example
app
  // Two arguments: path, handler
  .get('/simple', async (ctx) => {
    return { message: 'Hello World' };
  })
  
  // Three arguments: path, handler, config
  .get('/users/:id', async (ctx) => {
    // ctx.params.id is fully typed as string (UUID)
    // ctx.query.include is typed as string | undefined
    return { user: { id: ctx.params.id, include: ctx.query.include } };
  }, {
    params: z.object({ id: z.string().uuid() }),
    query: z.object({ include: z.string().optional() })
  })
  
  .post('/users', async (ctx) => {
    // ctx.body is fully typed with name: string, email: string
    return { created: ctx.body };
  }, {
    body: z.object({
      name: z.string(),
      email: z.string().email()
    })
  })

  // Additional examples
  .get('/health', async (ctx) => {
    return { 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      server: app.getServerInfo()
    };
  })

  .post('/login', async (ctx) => {
    const { username, password } = ctx.body;
    
    // Simple auth check (in production, verify against database)
    if (username === 'admin' && password === 'password') {
      const token = createJWT({ username, role: 'admin' }, 'your-secret-key', 3600);
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

  .get('/protected', async (ctx) => {
    // ctx.user is available here because of auth plugin
    return { message: 'This is protected', user: ctx.user };
  })

  // Server control endpoints
  .post('/restart', async (ctx) => {
    // Restart the server
    setTimeout(() => app.restart(3000), 100);
    return { message: 'Server restart initiated' };
  })

  .get('/status', async (ctx) => {
    return {
      ...app.getServerInfo(),
      uptime: process.uptime(),
      memory: process.memoryUsage()
    };
  })

  .put('/users/:id', async (ctx) => {
    return { 
      updated: ctx.body, 
      id: ctx.params.id,
      version: ctx.headers['if-match']
    };
  }, {
    params: z.object({ id: z.string().uuid() }),
    body: z.object({
      name: z.string().optional(),
      email: z.string().email().optional()
    }),
    headers: z.object({
      'if-match': z.string()
    })
  })

  .delete('/users/:id', async (ctx) => {
    ctx.set.status = 204;
    return null;
  }, {
    params: z.object({ id: z.string().uuid() })
  });

// Start the server (with hot reload enabled)
app.start(3000, 'localhost');

console.log(`
🦊 BXO Framework with Hot Reload

✨ Features Enabled:
- 🔄 Hot reload (edit any .ts/.js file to restart)
- 🎣 Full lifecycle hooks (before/after pattern)
- 🔒 JWT authentication
- 📊 Rate limiting  
- 🌐 CORS support
- 📝 Request logging

🧪 Try these endpoints:
- GET  /simple
- GET  /users/123e4567-e89b-12d3-a456-426614174000?include=profile
- POST /users (with JSON body: {"name": "John", "email": "john@example.com"})
- GET  /health (shows server info)
- POST /login (with JSON body: {"username": "admin", "password": "password"})
- GET  /protected (requires Bearer token from /login)
- GET  /status (server statistics)
- POST /restart (restart server programmatically)

💡 Edit this file and save to see hot reload in action!
`); 