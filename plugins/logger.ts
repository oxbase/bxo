interface LoggerOptions {
  format?: 'simple' | 'detailed' | 'json';
  includeBody?: boolean;
  includeHeaders?: boolean;
}

export function logger(options: LoggerOptions = {}) {
  const {
    format = 'simple',
    includeBody = false,
    includeHeaders = false
  } = options;

  return {
    name: 'logger',
    onRequest: async (ctx: any) => {
      ctx._startTime = Date.now();
      
      if (format === 'json') {
        const logData: any = {
          timestamp: new Date().toISOString(),
          method: ctx.request.method,
          url: ctx.request.url,
          type: 'request'
        };
        
        if (includeHeaders) {
          logData.headers = Object.fromEntries(ctx.request.headers.entries());
        }
        
        if (includeBody && ctx.body) {
          logData.body = ctx.body;
        }
        
        console.log(JSON.stringify(logData));
      } else if (format === 'detailed') {
        console.log(`→ ${ctx.request.method} ${ctx.request.url}`);
        if (includeHeaders) {
          console.log('  Headers:', Object.fromEntries(ctx.request.headers.entries()));
        }
        if (includeBody && ctx.body) {
          console.log('  Body:', ctx.body);
        }
      } else {
        console.log(`→ ${ctx.request.method} ${ctx.request.url}`);
      }
    },
    onResponse: async (ctx: any, response: any) => {
      const duration = Date.now() - (ctx._startTime || 0);
      const status = ctx.set.status || 200;
      
      if (format === 'json') {
        const logData: any = {
          timestamp: new Date().toISOString(),
          method: ctx.request.method,
          url: ctx.request.url,
          status,
          duration: `${duration}ms`,
          type: 'response'
        };
        
        if (includeHeaders && ctx.set.headers) {
          logData.responseHeaders = ctx.set.headers;
        }
        
        if (includeBody && response) {
          logData.response = response;
        }
        
        console.log(JSON.stringify(logData));
      } else if (format === 'detailed') {
        console.log(`← ${ctx.request.method} ${ctx.request.url} ${status} ${duration}ms`);
        if (includeHeaders && ctx.set.headers) {
          console.log('  Response Headers:', ctx.set.headers);
        }
        if (includeBody && response) {
          console.log('  Response:', response);
        }
      } else {
        const statusColor = status >= 400 ? '\x1b[31m' : status >= 300 ? '\x1b[33m' : '\x1b[32m';
        const resetColor = '\x1b[0m';
        console.log(`← ${ctx.request.method} ${ctx.request.url} ${statusColor}${status}${resetColor} ${duration}ms`);
      }
      
      return response;
    },
    onError: async (ctx: any, error: Error) => {
      const duration = Date.now() - (ctx._startTime || 0);
      
      if (format === 'json') {
        console.log(JSON.stringify({
          timestamp: new Date().toISOString(),
          method: ctx.request.method,
          url: ctx.request.url,
          error: error.message,
          duration: `${duration}ms`,
          type: 'error'
        }));
      } else {
        console.log(`✗ ${ctx.request.method} ${ctx.request.url} \x1b[31mERROR\x1b[0m ${duration}ms: ${error.message}`);
      }
    }
  };
} 