interface CORSOptions {
  origin?: string | string[] | boolean;
  methods?: string[];
  allowedHeaders?: string[];
  credentials?: boolean;
  maxAge?: number;
}

export function cors(options: CORSOptions = {}) {
  const {
    origin = '*',
    methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders = ['Content-Type', 'Authorization'],
    credentials = false,
    maxAge = 86400
  } = options;

  return {
    name: 'cors',
    onRequest: async (ctx: any) => {
      // Handle preflight OPTIONS request
      if (ctx.request.method === 'OPTIONS') {
        const headers: Record<string, string> = {};

        // Handle origin
        if (typeof origin === 'boolean') {
          if (origin) {
            headers['Access-Control-Allow-Origin'] = ctx.request.headers.get('origin') || '*';
          }
        } else if (typeof origin === 'string') {
          headers['Access-Control-Allow-Origin'] = origin;
        } else if (Array.isArray(origin)) {
          const requestOrigin = ctx.request.headers.get('origin');
          if (requestOrigin && origin.includes(requestOrigin)) {
            headers['Access-Control-Allow-Origin'] = requestOrigin;
          }
        }

        headers['Access-Control-Allow-Methods'] = methods.join(', ');
        headers['Access-Control-Allow-Headers'] = allowedHeaders.join(', ');
        
        if (credentials) {
          headers['Access-Control-Allow-Credentials'] = 'true';
        }
        
        headers['Access-Control-Max-Age'] = maxAge.toString();

        ctx.set.status = 204;
        ctx.set.headers = { ...ctx.set.headers, ...headers };
        
        throw new Response(null, { status: 204, headers });
      }
    },
    onResponse: async (ctx: any, response: any) => {
      const headers: Record<string, string> = {};

      // Handle origin for actual requests
      if (typeof origin === 'boolean') {
        if (origin) {
          headers['Access-Control-Allow-Origin'] = ctx.request.headers.get('origin') || '*';
        }
      } else if (typeof origin === 'string') {
        headers['Access-Control-Allow-Origin'] = origin;
      } else if (Array.isArray(origin)) {
        const requestOrigin = ctx.request.headers.get('origin');
        if (requestOrigin && origin.includes(requestOrigin)) {
          headers['Access-Control-Allow-Origin'] = requestOrigin;
        }
      }

      if (credentials) {
        headers['Access-Control-Allow-Credentials'] = 'true';
      }

      ctx.set.headers = { ...ctx.set.headers, ...headers };
      return response;
    }
  };
} 