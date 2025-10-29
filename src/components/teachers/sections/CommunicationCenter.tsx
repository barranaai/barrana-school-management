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
  Message,
  Email,
  Notifications,
  Send,
  Chat,
  Forum,
} from '@mui/icons-material';
import NotificationIcon from '../../common/NotificationIcon';

export interface CommunicationCenterProps {
  schoolBranding?: any;
}

const CommunicationCenter: React.FC<CommunicationCenterProps> = ({ schoolBranding }) => {
  return (
    <Container maxWidth="xl">
      {/* Header */}
      <Fade in timeout={800}>
        <Box sx={{ mb: 4 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
            <Box>
              <Typography 
                variant="h4" 
                gutterBottom
                sx={{
                  fontWeight: 700,
                  background: schoolBranding 
                    ? `linear-gradient(135deg, ${schoolBranding.branding?.primaryColor || schoolBranding.primaryColor || '#667eea'} 0%, ${schoolBranding.branding?.secondaryColor || schoolBranding.secondaryColor || '#764ba2'} 100%)`
                    : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  backgroundClip: 'text',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  textShadow: '0 2px 4px rgba(0,0,0,0.1)',
                }}
              >
                Communication Center
              </Typography>
              <Typography 
                variant="body1" 
                sx={{ 
                  color: 'text.secondary',
                  opacity: 0.8,
                  fontWeight: 500,
                }}
              >
                Communicate with parents and school administrators
              </Typography>
            </Box>
            <NotificationIcon />
          </Box>
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
          <Message sx={{ fontSize: 64, color: 'primary.main', mb: 2 }} />
          <Typography variant="h5" gutterBottom sx={{ fontWeight: 600 }}>
            Communication Hub
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
            Send messages, notifications, and updates to parents and administrators.
          </Typography>
          <Alert severity="info" sx={{ mb: 3 }}>
            Features coming soon: Direct messaging, email notifications, report sharing, and parent communication tools.
          </Alert>
          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
            <Button 
              variant="contained" 
              startIcon={<Message />}
              sx={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                borderRadius: 3,
                px: 3,
                py: 1.5,
                fontWeight: 600,
              }}
            >
              Send Message
            </Button>
            <Button 
              variant="outlined" 
              startIcon={<Email />}
              sx={{
                borderRadius: 3,
                px: 3,
                py: 1.5,
                fontWeight: 600,
              }}
            >
              Email Parents
            </Button>
          </Box>
        </Paper>
      </Grow>
    </Container>
  );
};

export default CommunicationCenter; 