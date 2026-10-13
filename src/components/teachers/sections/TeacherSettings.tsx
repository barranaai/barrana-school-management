import React from 'react';
import { Box, Container, Fade, Typography } from '@mui/material';
import NotificationIcon from '../../common/NotificationIcon';
import AccountSettings from '../../common/AccountSettings';

export interface TeacherSettingsProps {
  schoolBranding?: any;
}

const TeacherSettings: React.FC<TeacherSettingsProps> = ({ schoolBranding }) => (
  <Container maxWidth="xl">
    <Fade in timeout={500}>
      <Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
          <Box>
            <Typography
              variant="h4"
              sx={{
                fontWeight: 700,
                color: schoolBranding?.branding?.primaryColor || schoolBranding?.primaryColor || 'primary.main',
              }}
            >
              Settings
            </Typography>
            <Typography color="text.secondary">Manage your profile, notifications and account security.</Typography>
          </Box>
          <NotificationIcon />
        </Box>
        <AccountSettings />
      </Box>
    </Fade>
  </Container>
);

export default TeacherSettings;
