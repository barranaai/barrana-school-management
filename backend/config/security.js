const LOCAL = ['http://localhost:3000', 'http://127.0.0.1:3000'];

const parseAllowedOrigins = (value, env = process.env.NODE_ENV) => {
  const configured = String(value || '').split(',').map(v => v.trim()).filter(Boolean);
  return configured.length ? configured : (['development', 'test'].includes(env) ? LOCAL : []);
};

const createCorsOptions = (env = process.env) => {
  const allowed = parseAllowedOrigins(env.CORS_ALLOWED_ORIGINS, env.NODE_ENV);
  return {
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    origin(origin, callback) {
      if (!origin || allowed.includes(origin)) return callback(null, true);
      const error = new Error('Origin is not allowed by CORS');
      error.statusCode = 403;
      return callback(error);
    }
  };
};

const contentSecurityPolicy = {
  defaultSrc: ["'self'"], baseUri: ["'self'"], objectSrc: ["'none'"],
  frameAncestors: ["'none'"], formAction: ["'self'"], scriptSrc: ["'self'"],
  styleSrc: ["'self'", "'unsafe-inline'"], imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
  fontSrc: ["'self'", 'data:', 'https:'], mediaSrc: ["'self'", 'blob:', 'https:'],
  connectSrc: ["'self'", 'http://localhost:3000', 'http://localhost:5050', 'ws://localhost:3000', 'ws://localhost:5050', 'https:', 'wss:']
};

module.exports = { parseAllowedOrigins, createCorsOptions, contentSecurityPolicy };
