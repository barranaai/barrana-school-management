const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

console.log('🚀 Starting ultra-minimal server for debugging...');
console.log('  PORT:', process.env.PORT);
console.log('  NODE_ENV:', process.env.NODE_ENV);
console.log('  Final PORT:', PORT);

// Basic middleware
app.use(express.json());

// Test endpoints only
app.get('/', (req, res) => {
  res.status(200).json({
    message: 'Ultra-Minimal Barrana AI Server',
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
  });
});

app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV,
  });
});

// Basic auth test without database
app.post('/api/auth/test-login', (req, res) => {
  const { email, password } = req.body;
  res.status(200).json({
    success: true,
    message: 'Auth endpoint accessible',
    received: { email: email ? 'provided' : 'missing', password: password ? 'provided' : 'missing' },
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    path: req.originalUrl,
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    success: false,
    message: 'Internal Server Error',
    error: err.message
  });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Ultra-Minimal Server running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV}`);
  console.log(`🔗 Health Check: http://localhost:${PORT}/api/health`);
  console.log(`🌐 Server listening on 0.0.0.0:${PORT}`);
});

module.exports = app;
