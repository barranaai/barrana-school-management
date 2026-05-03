import React, { useState, useEffect } from 'react';
import {
  Box,
  List,
  Typography,
  IconButton,
  ListItem,
  ListItemIcon,
  ListItemText,
  Avatar,
  Paper,
  Container,
  Grow,
  CircularProgress,
  ThemeProvider,
  ListItemButton,
} from '@mui/material';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Dashboard,
  People,
  Message,
  School,
  Logout,
  Assessment,
  Group,
  Event,
  Groups,
  Notifications,
  Settings,
  ReportProblem,
  EventAvailable,
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { apiService } from '../../services/apiService';
import { createAdminTheme } from '../../theme/adminTheme';
import ExecutiveSummary from './sections/ExecutiveSummary';
import StudentManagement from './sections/StudentManagement';
import TeacherManagement from './sections/TeacherManagement';
import ClassManagement from './sections/ClassManagement';
import SchoolConfiguration from './sections/SchoolConfiguration';
import AllReports from './sections/AllReports';
import IncidentManagement from './sections/IncidentManagement';
import MeetingsManagement from './sections/MeetingsManagement';
import CalendarManagement from './sections/CalendarManagement';
import ParentGroupManagement from './sections/ParentGroupManagement';
import NotificationLogs from './sections/NotificationLogs';
import AdminCommunicationCenter from './sections/AdminCommunicationCenter';

const drawerWidth = 250;

const menuItems = [
  { text: 'Executive Summary', icon: <Dashboard />, section: 'dashboard', color: '#667eea' },
  { text: 'Student Management', icon: <People />, section: 'students', color: '#764ba2' },
  { text: 'Teacher Management', icon: <School />, section: 'teachers', color: '#f093fb' },
  { text: 'Class Management', icon: <Group />, section: 'classes', color: '#ff9a9e' },
  { text: 'School Configuration', icon: <Settings />, section: 'reports', color: '#4facfe' },
  { text: 'All Reports', icon: <Assessment />, section: 'all-reports', color: '#4facfe' },
  { text: 'Incidents', icon: <ReportProblem />, section: 'incidents', color: '#f44336' },
  { text: 'Meetings', icon: <EventAvailable />, section: 'meetings', color: '#43e97b' },
  { text: 'Calendar Management', icon: <Event />, section: 'calendar', color: '#43e97b' },
  { text: 'Parent Groups', icon: <Groups />, section: 'parent-groups', color: '#f59e0b' },
  { text: 'Communication', icon: <Message />, section: 'communication', color: '#8b5cf6' },
  { text: 'Notification Logs', icon: <Notifications />, section: 'notification-logs', color: '#667eea' },
];

const AdminDashboard: React.FC = () => {
  // Initialize currentSection based on hash
  const getInitialSection = () => {
    const hash = window.location.hash.replace('#', '');
    if (hash && menuItems.some(item => item.section === hash)) {
      return hash;
    }
    return 'dashboard';
  };
  
  const [currentSection, setCurrentSection] = useState(getInitialSection);
  const [schoolName, setSchoolName] = useState<string>('Barrana.ai');
  const [schoolBranding, setSchoolBranding] = useState<any>(null);
  const [loadingBranding, setLoadingBranding] = useState(true);
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  
  // Create dynamic theme based on school branding
  const dynamicTheme = React.useMemo(() => {
    if (schoolBranding) {
      return createAdminTheme({
        primary: schoolBranding.branding?.primaryColor || schoolBranding.primaryColor || '#007AFF',
        secondary: schoolBranding.branding?.secondaryColor || schoolBranding.secondaryColor || '#5856D6',
      });
    }
    return createAdminTheme();
  }, [schoolBranding]);

  // Handle hash navigation for direct access to sections
  useEffect(() => {
    const timer = setTimeout(() => {
      const hash = window.location.hash.replace('#', '');
      if (hash && menuItems.some(item => item.section === hash)) {
        setCurrentSection(hash);
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [location]);

  // Update hash when section changes
  useEffect(() => {
    window.location.hash = currentSection;
  }, [currentSection]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Fetch school information and branding when component mounts
  useEffect(() => {
    const fetchSchoolInfo = async () => {
      try {
        if (user?.schoolId) {
          const schoolId = typeof user.schoolId === 'string' 
            ? user.schoolId 
            : (user.schoolId as any)?._id;
          
          if (schoolId) {
            const response = await apiService.getSchool(schoolId);
            if (response.success && response.data) {
              setSchoolName(response.data.name);
              setSchoolBranding(response.data);
            }
          }
        }
      } catch (error) {
        console.error('Error fetching school info:', error);
      } finally {
        setLoadingBranding(false);
      }
    };

    fetchSchoolInfo();
  }, [user?.schoolId]);

  const renderSection = () => {
    switch (currentSection) {
      case 'dashboard':
        return <ExecutiveSummary schoolBranding={schoolBranding} />;
      case 'students':
        return <StudentManagement schoolBranding={schoolBranding} />;
      case 'teachers':
        return <TeacherManagement schoolBranding={schoolBranding} />;
      case 'classes':
        return <ClassManagement schoolBranding={schoolBranding} />;
      case 'reports':
        return <SchoolConfiguration schoolBranding={schoolBranding} />;
      case 'all-reports':
        return <AllReports schoolBranding={schoolBranding} />;
      case 'incidents':
        return <IncidentManagement schoolBranding={schoolBranding} />;
      case 'meetings':
        return <MeetingsManagement schoolBranding={schoolBranding} />;
      case 'calendar':
        return <CalendarManagement schoolBranding={schoolBranding} />;
      case 'parent-groups':
        return <ParentGroupManagement schoolBranding={schoolBranding} />;
      case 'communication':
        return <AdminCommunicationCenter schoolBranding={schoolBranding} />;
      case 'notification-logs':
        return <NotificationLogs schoolBranding={schoolBranding} />;
      default:
        return <ExecutiveSummary schoolBranding={schoolBranding} />;
    }
  };

  const currentMenuItem = menuItems.find(item => item.section === currentSection);

  // Show loading screen while fetching branding
  if (loadingBranding) {
    return (
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #17437b 0%, #26aea6 100%)',
      }}>
        <Box sx={{ textAlign: 'center' }}>
          <img src="/kidsible-logo.png" alt="Kidsible" style={{ height: '60px', width: 'auto', marginBottom: '16px', filter: 'brightness(0) invert(1)' }} />
          <CircularProgress size={36} sx={{ color: '#bbca1f', display: 'block', margin: '0 auto' }} />
        </Box>
      </Box>
    );
  }

  return (
    <ThemeProvider theme={dynamicTheme}>
      <Box sx={{ 
        display: 'flex', 
        minHeight: '100vh', 
        bgcolor: '#F8F9FA',
        justifyContent: 'center',
      }}>
        <Box sx={{ 
          display: 'flex', 
          width: '98%', 
          maxWidth: '1800px',
          position: 'relative',
        }}>
          {/* Modern Sidebar */}
          <Box sx={{ position: 'fixed', top: '5vh', left: 'calc((100vw - min(98vw, 1800px)) / 2)', zIndex: 1100 }}>
          <Paper
            elevation={3}
            sx={{
              width: 250,
              height: '90vh',
              bgcolor: 'white',
              borderRadius: 4,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              boxShadow: '0 8px 32px rgba(0,0,0,0.08)',
            }}
          >
            {/* User Profile at Top */}
            <Box sx={{ p: 3, borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Avatar
                  sx={{
                    width: 56,
                    height: 56,
                    mr: 2,
                    bgcolor: dynamicTheme.palette.primary.main,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                    fontSize: '1.5rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                  }}
                >
                  {user?.firstName?.charAt(0)}
                </Avatar>
                <Box>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700, textTransform: 'capitalize' }}>
                    {user?.firstName} {user?.lastName}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    School Administrator
                  </Typography>
                </Box>
              </Box>
            </Box>

            {/* Navigation Menu */}
            <Box sx={{ flex: 1, overflowY: 'auto', py: 2 }}>
              <List sx={{ px: 1 }}>
                {menuItems.map((item, index) => (
                  <Grow in timeout={300 + index * 50} key={item.section}>
                    <ListItem disablePadding sx={{ mb: 0.5 }}>
                      <ListItemButton
                        selected={currentSection === item.section}
                        onClick={() => setCurrentSection(item.section)}
                        sx={{
                          borderRadius: 2,
                          '&.Mui-selected': {
                            bgcolor: dynamicTheme.palette.primary.main,
                            color: 'white',
                            '&:hover': {
                              bgcolor: dynamicTheme.palette.primary.dark,
                            },
                            '& .MuiListItemIcon-root': {
                              color: 'white',
                            },
                          },
                          '&:hover': {
                            bgcolor: currentSection === item.section 
                              ? dynamicTheme.palette.primary.dark 
                              : dynamicTheme.palette.primary.main,
                            color: 'white',
                            '& .MuiListItemIcon-root': {
                              color: 'white',
                            },
                          },
                          transition: 'all 0.2s ease-in-out',
                        }}
                      >
                        <ListItemIcon
                          sx={{
                            color: currentSection === item.section 
                              ? 'white' 
                              : 'text.secondary',
                            minWidth: 40,
                          }}
                        >
                          {item.icon}
                        </ListItemIcon>
                        <ListItemText 
                          primary={item.text}
                          primaryTypographyProps={{
                            fontSize: '0.875rem',
                            fontWeight: currentSection === item.section ? 600 : 500,
                          }}
                        />
                      </ListItemButton>
                    </ListItem>
                  </Grow>
                ))}
              </List>
            </Box>

            {/* School Logo, Kidsible Branding and Logout at Bottom */}
            <Box sx={{ p: 2, borderTop: '1px solid rgba(0,0,0,0.08)' }}>
              {schoolBranding?.logo && (
                <Box sx={{ mb: 2, textAlign: 'center' }}>
                  <img 
                    src={schoolBranding.logo} 
                    alt={schoolName}
                    style={{ 
                      maxWidth: '80%', 
                      height: 'auto',
                      maxHeight: '60px',
                      objectFit: 'contain'
                    }}
                  />
                </Box>
              )}

              {/* Kidsible Platform Branding */}
              <Box sx={{ mb: 1.5, textAlign: 'center', py: 1, borderRadius: 2, bgcolor: 'rgba(23,67,123,0.04)' }}>
                <Typography variant="caption" sx={{ color: '#727272', fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', mb: 0.5 }}>
                  Powered by
                </Typography>
                <img
                  src="/kidsible-logo.png"
                  alt="Kidsible"
                  style={{ height: '28px', width: 'auto', objectFit: 'contain', display: 'block', margin: '0 auto' }}
                />
              </Box>
              
              <ListItem disablePadding>
                <ListItemButton
                  onClick={handleLogout}
                  sx={{
                    borderRadius: 2,
                    '&:hover': {
                      bgcolor: 'rgba(244, 67, 54, 0.1)',
                      color: '#f44336',
                      '& .MuiListItemIcon-root': {
                        color: '#f44336',
                      },
                    },
                    transition: 'all 0.2s ease-in-out',
                  }}
                >
                  <ListItemIcon sx={{ color: 'text.secondary', minWidth: 40 }}>
                    <Logout />
                  </ListItemIcon>
                  <ListItemText 
                    primary="Logout"
                    primaryTypographyProps={{
                      fontSize: '0.875rem',
                      fontWeight: 500,
                    }}
                  />
                </ListItemButton>
              </ListItem>
            </Box>
          </Paper>
        </Box>

          {/* Main Content */}
          <Box
            component="main"
            sx={{
              flexGrow: 1,
              ml: `${drawerWidth + 40}px`,
              minHeight: '100vh',
              width: '100%',
              pt: '5vh',
            }}
          >
            <Box sx={{ py: 3 }}>
              {renderSection()}
            </Box>
          </Box>
        </Box>
      </Box>
    </ThemeProvider>
  );
};

export default AdminDashboard;
