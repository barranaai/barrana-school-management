import React from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Paper,
  Container,
  Fade,
  Grow,
  Button,
  Alert,
} from '@mui/material';
import {
  Settings,
  AccountCircle,
  Notifications,
  Security,
  Language,
  Palette,
} from '@mui/icons-material';

const TeacherSettings: React.FC = () => {
  return (
    <Container maxWidth="xl">
      {/* Header */}
      <Fade in timeout={800}>
        <Box sx={{ mb: 4 }}>
          <Typography 
            variant="h4" 
            gutterBottom
            sx={{
              fontWeight: 700,
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              textShadow: '0 2px 4px rgba(0,0,0,0.1)',
            }}
          >
            Settings
          </Typography>
          <Typography 
            variant="body1" 
            sx={{ 
              color: 'text.secondary',
              opacity: 0.8,
              fontWeight: 500,
            }}
          >
            Manage your account preferences and settings
          </Typography>
        </Box>
      </Fade>

      {/* Coming Soon */}
      <Grow in timeout={1000}>
        <Paper
          elevation={0}
          sx={{
            background: 'rgba(255,255,255,0.8)',
            borderRadius: 4,
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255,255,255,0.3)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
            p: 4,
            textAlign: 'center',
          }}
        >
          <Settings sx={{ fontSize: 64, color: 'primary.main', mb: 2 }} />
          <Typography variant="h5" gutterBottom sx={{ fontWeight: 600 }}>
            Account Settings
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
            Customize your profile, notifications, and application preferences.
          </Typography>
          <Alert severity="info" sx={{ mb: 3 }}>
            Features coming soon: Profile management, notification settings, security preferences, and theme customization.
          </Alert>
          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
            <Button 
              variant="contained" 
              startIcon={<AccountCircle />}
              sx={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                borderRadius: 3,
                px: 3,
                py: 1.5,
                fontWeight: 600,
              }}
            >
              Edit Profile
            </Button>
            <Button 
              variant="outlined" 
              startIcon={<Notifications />}
              sx={{
                borderRadius: 3,
                px: 3,
                py: 1.5,
                fontWeight: 600,
              }}
            >
              Notifications
            </Button>
          </Box>
        </Paper>
      </Grow>
    </Container>
  );
};

export default TeacherSettings; 