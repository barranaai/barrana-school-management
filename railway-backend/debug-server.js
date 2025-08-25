// Absolute minimal Node.js server for Railway debugging
const http = require('http');
const PORT = process.env.PORT || 3000;

console.log('🔧 Debug server starting...');
console.log('PORT from env:', process.env.PORT);
console.log('Using PORT:', PORT);
console.log('NODE_ENV:', process.env.NODE_ENV);

const server = http.createServer((req, res) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  
  // Handle CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Content-Type', 'application/json');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }
  
  // Route handling
  if (req.url === '/' && req.method === 'GET') {
    const response = {
      message: 'Enhanced Debug Server with Auth',
      status: 'OK',
      timestamp: new Date().toISOString(),
      port: PORT,
      features: ['health-check', 'auth-test']
    };
    res.writeHead(200);
    res.end(JSON.stringify(response, null, 2));
    
  } else if (req.url === '/api/health' && req.method === 'GET') {
    const response = {
      status: 'OK',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      database: 'not connected (debug mode)'
    };
    res.writeHead(200);
    res.end(JSON.stringify(response, null, 2));
    
  } else if (req.url === '/api/auth/test' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        const response = {
          success: true,
          message: 'Auth test endpoint working',
          received: {
            email: data.email || 'not provided',
            password: data.password ? 'provided' : 'not provided'
          },
          timestamp: new Date().toISOString(),
          note: 'This is a test endpoint - database not connected'
        };
        res.writeHead(200);
        res.end(JSON.stringify(response, null, 2));
      } catch (error) {
        const response = {
          success: false,
          message: 'Invalid JSON',
          error: error.message
        };
        res.writeHead(400);
        res.end(JSON.stringify(response, null, 2));
      }
    });
    
  } else if (req.url === '/api/auth/login' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        const response = {
          success: false,
          message: 'Database not connected - please insert user data first',
          debug: {
            email: data.email || 'not provided',
            password: data.password ? 'provided' : 'not provided'
          },
          timestamp: new Date().toISOString(),
          instructions: 'Please add the super admin user to MongoDB first'
        };
        res.writeHead(500);
        res.end(JSON.stringify(response, null, 2));
      } catch (error) {
        const response = {
          success: false,
          message: 'Invalid JSON',
          error: error.message
        };
        res.writeHead(400);
        res.end(JSON.stringify(response, null, 2));
      }
    });
    
  } else {
    // 404 for unknown routes
    const response = {
      success: false,
      message: 'Route not found',
      url: req.url,
      method: req.method,
      availableRoutes: [
        'GET /',
        'GET /api/health', 
        'POST /api/auth/test',
        'POST /api/auth/login'
      ]
    };
    res.writeHead(404);
    res.end(JSON.stringify(response, null, 2));
  }
});

server.on('error', (err) => {
  console.error('Server error:', err);
  process.exit(1);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Raw Node.js server listening on 0.0.0.0:${PORT}`);
  console.log(`Test URL: http://localhost:${PORT}/`);
});

process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection:', reason);
  process.exit(1);
});
