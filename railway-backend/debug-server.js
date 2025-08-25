// Absolute minimal Node.js server for Railway debugging
const http = require('http');
const PORT = process.env.PORT || 3000;

console.log('🔧 Debug server starting...');
console.log('PORT from env:', process.env.PORT);
console.log('Using PORT:', PORT);
console.log('NODE_ENV:', process.env.NODE_ENV);

const server = http.createServer((req, res) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  
  res.writeHead(200, { 
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*'
  });
  
  const response = {
    message: 'Raw Node.js server working',
    status: 'OK',
    timestamp: new Date().toISOString(),
    port: PORT,
    url: req.url,
    method: req.method
  };
  
  res.end(JSON.stringify(response, null, 2));
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
