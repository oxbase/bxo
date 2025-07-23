interface AuthOptions {
  type: 'jwt' | 'bearer' | 'apikey';
  secret?: string;
  header?: string;
  verify?: (token: string, ctx: any) => Promise<any> | any;
  exclude?: string[];
}

export function auth(options: AuthOptions) {
  const {
    type,
    secret,
    header = 'authorization',
    verify,
    exclude = []
  } = options;

  return {
    name: 'auth',
    onRequest: async (ctx: any) => {
      const url = new URL(ctx.request.url);
      const pathname = url.pathname;
      
      // Skip auth for excluded paths
      if (exclude.some(path => {
        if (path.includes('*')) {
          const regex = new RegExp(path.replace(/\*/g, '.*'));
          return regex.test(pathname);
        }
        return pathname === path || pathname.startsWith(path);
      })) {
        return;
      }

      const authHeader = ctx.request.headers.get(header.toLowerCase());
      
      if (!authHeader) {
        throw new Response(JSON.stringify({ error: 'Authorization header required' }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      let token: string;
      
      if (type === 'jwt' || type === 'bearer') {
        if (!authHeader.startsWith('Bearer ')) {
          throw new Response(JSON.stringify({ error: 'Invalid authorization format. Use Bearer <token>' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        token = authHeader.slice(7);
      } else if (type === 'apikey') {
        token = authHeader;
      } else {
        token = authHeader;
      }

      try {
        let user: any;
        
        if (verify) {
          user = await verify(token, ctx);
        } else if (type === 'jwt' && secret) {
          // Simple JWT verification (in production, use a proper JWT library)
          const [headerB64, payloadB64, signature] = token.split('.');
          if (!headerB64 || !payloadB64 || !signature) {
            throw new Error('Invalid JWT format');
          }
          
          const payload = JSON.parse(atob(payloadB64));
          
          // Check expiration
          if (payload.exp && Date.now() >= payload.exp * 1000) {
            throw new Error('Token expired');
          }
          
          user = payload;
        } else {
          user = { token };
        }

        // Attach user to context
        ctx.user = user;
        
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Invalid token';
        throw new Response(JSON.stringify({ error: message }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }
  };
}

// Helper function for creating JWT tokens (simple implementation)
export function createJWT(payload: any, secret: string, expiresIn: number = 3600): string {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  
  const jwtPayload = {
    ...payload,
    iat: now,
    exp: now + expiresIn
  };
  
  const headerB64 = btoa(JSON.stringify(header));
  const payloadB64 = btoa(JSON.stringify(jwtPayload));
  
  // Simple signature (in production, use proper HMAC-SHA256)
  const signature = btoa(`${headerB64}.${payloadB64}.${secret}`);
  
  return `${headerB64}.${payloadB64}.${signature}`;
} 