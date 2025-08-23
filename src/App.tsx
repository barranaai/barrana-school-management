import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Box, Typography, Button } from '@mui/material';

// Temporary simple components for debugging
const SimpleLogin = () => (
  <Box sx={{ p: 4, textAlign: 'center' }}>
    <Typography variant="h3" gutterBottom>
      🎓 Barrana AI School Management
    </Typography>
    <Typography variant="h6" color="text.secondary" gutterBottom>
      Welcome to the AI-powered educational platform
    </Typography>
    <Box sx={{ mt: 4 }}>
      <Button variant="contained" size="large">
        Login (Coming Soon)
      </Button>
    </Box>
    <Box sx={{ mt: 2 }}>
      <Typography variant="body2" color="text.secondary">
        Frontend: ✅ Connected | Backend: ✅ Railway | Database: ✅ MongoDB
      </Typography>
    </Box>
  </Box>
);

function App() {
  console.log('🚀 App component loaded successfully!');
  console.log('Environment:', process.env.NODE_ENV);
  console.log('API URL:', process.env.REACT_APP_API_URL);
  
  return (
    <div className="App">
      <Routes>
        <Route path="/login" element={<SimpleLogin />} />
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="*" element={<SimpleLogin />} />
      </Routes>
    </div>
  );
}

export default App; 