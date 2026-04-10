import React, { useState, useEffect } from 'react';
import {
  Box,
  Drawer,
  AppBar,
  Toolbar,
  List,
  Typography,
  Divider,
  IconButton,
  ListItem,
  ListItemIcon,
  ListItemText,
  Avatar,
  Menu,
  MenuItem,
  Badge,
  Chip,
  Paper,
  Container,
  Fade,
  Grow,
  Grid,
  Card,
  CardContent,
  LinearProgress,
  Button,
  Alert,
  ListItemAvatar,
  ListItemButton,
  ThemeProvider,
  CircularProgress,
} from '@mui/material';
import {
  Dashboard,
  People,
  // Message,
  // Settings,
  AccountCircle,
  Notifications,
  School,
  Logout,
  // TrendingUp,
  TrendingDown,
  CalendarToday,
  Star,
  Refresh,
  Description,
  ExpandMore,
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { useData } from '../../contexts/DataContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { apiService } from '../../services/apiService';
import LanguageSelector from '../common/LanguageSelector';
import NotificationIcon from '../common/NotificationIcon';
import TeacherOverview from './sections/TeacherOverview';
import StudentManagement from './sections/StudentManagement';
import ReportsListing from './sections/ReportsListing';
import { createTeacherTheme } from '../../theme/teacherTheme';

// import CommunicationCenter from './sections/CommunicationCenter';
// import TeacherAnalytics from './sections/TeacherAnalytics';
// import TeacherSettings from './sections/TeacherSettings';

const drawerWidth = 250;

const menuItems = [
  { text: 'Teacher Overview', icon: <Dashboard />, section: 'overview', color: '#667eea' },
  { text: 'My Students', icon: <People />, section: 'students', color: '#764ba2' },
  { text: 'My Reports', icon: <Description />, section: 'reports-listing', color: '#4facfe' },
  // { text: 'Communication', icon: <Message />, section: 'communication', color: '#4facfe' },
  // { text: 'Analytics', icon: <TrendingUp />, section: 'analytics', color: '#43e97b' },
  // { text: 'Settings', icon: <Settings />, section: 'settings', color: '#fa709a' },
];

const TeacherDashboard: React.FC = () => {
  // Initialize currentSection from URL hash if available
  const getInitialSection = () => {
    const hash = window.location.hash.replace('#', '');
    if (hash && menuItems.some(item => item.section === hash)) {
      return hash;
    }
    return 'overview';
  };

  const [currentSection, setCurrentSection] = useState(getInitialSection);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [schoolName, setSchoolName] = useState<string>('Barrana.ai');
  const [schoolBranding, setSchoolBranding] = useState<any>(null);
  const [loadingBranding, setLoadingBranding] = useState(true);
  const { user, logout } = useAuth();
  const { students, reports, teachers, analytics, school } = useData();

  // Create dynamic theme based on school branding
  const dynamicTheme = schoolBranding 
    ? createTeacherTheme({ 
        primary: schoolBranding.branding?.primaryColor || schoolBranding.primaryColor || '#007AFF',
        secondary: schoolBranding.branding?.secondaryColor || schoolBranding.secondaryColor || '#5856D6'
      })
    : createTeacherTheme();

  // Set initial hash if not present
  useEffect(() => {
    if (!window.location.hash) {
      window.location.hash = 'overview';
    }
  }, []);

  // Update URL hash when section changes (skip on initial mount)
  useEffect(() => {
    const hash = window.location.hash.replace('#', '');
    if (hash !== currentSection) {
      window.location.hash = currentSection;
    }
  }, [currentSection]);

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    logout();
    handleMenuClose();
  };

  // Fetch school information and branding when component mounts
  useEffect(() => {
    const fetchSchoolInfo = async () => {
      try {
        console.log('🔍 User data:', user);
        console.log('🔍 School data from context:', school);
        console.log('🔍 User schoolId:', user?.schoolId);
        console.log('🔍 User schoolId type:', typeof user?.schoolId);
        
        // Fetch school branding - try teachers endpoint first, fallback to parents endpoint structure
        try {
          let brandingResponse = await fetch('/api/teachers/me/school-branding', {
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
          });
          
          // If teachers endpoint doesn't exist, try to get from school data
          if (!brandingResponse.ok) {
            const schoolId = typeof user?.schoolId === 'string' 
              ? user.schoolId 
              : (user?.schoolId as any)?._id;
            
            if (schoolId) {
              const schoolResponse = await apiService.getSchool(schoolId);
              if (schoolResponse.success && schoolResponse.data) {
                const school = schoolResponse.data as any;
                const brandingData = {
                  schoolName: school.name,
                  primaryColor: school.branding?.primaryColor || '#667eea',
                  secondaryColor: school.branding?.secondaryColor || '#764ba2',
                  logo: school.logo || school.branding?.logo
                };
                setSchoolBranding(brandingData);
                if (school.name) {
                  setSchoolName(school.name);
                }
              }
            }
          } else {
            const brandingData = await brandingResponse.json();
            if (brandingData.success) {
              console.log('School branding data:', brandingData.data);
              setSchoolBranding(brandingData.data);
              if (brandingData.data.schoolName) {
                setSchoolName(brandingData.data.schoolName);
              }
            }
          }
        } catch (error) {
          console.error('Error fetching school branding:', error);
        }
        
        // Check if schoolId is an object with school information
        if (user?.schoolId && typeof user.schoolId === 'object' && (user.schoolId as any).name) {
          console.log('✅ Using school name from user.schoolId object:', (user.schoolId as any).name);
          if (!schoolName || schoolName === 'Barrana.ai') {
            setSchoolName((user.schoolId as any).name);
          }
          return;
        }
        
        // First try to get school from context if available
        if (school && school.name) {
          console.log('✅ Using school from context:', school.name);
          if (!schoolName || schoolName === 'Barrana.ai') {
            setSchoolName(school.name);
          }
          return;
        }
        
        // Try to get current user with populated school data
        if (user?._id) {
          try {
            console.log('🔍 Fetching current user with populated school data...');
            const response = await apiService.getCurrentUser();
            console.log('🔍 Current user API response:', response);
            
            if (response.success && response.data?.schoolId && typeof response.data.schoolId === 'object' && (response.data.schoolId as any).name) {
              console.log('✅ Setting school name from current user API:', (response.data.schoolId as any).name);
              if (!schoolName || schoolName === 'Barrana.ai') {
                setSchoolName((response.data.schoolId as any).name);
              }
              return;
            }
          } catch (error) {
            console.error('❌ Error fetching current user:', error);
          }
        }
        
        // Fallback to fetching by user's schoolId
        if (user?.schoolId) {
          try {
            const schoolId = typeof user.schoolId === 'string' 
              ? user.schoolId 
              : (user.schoolId as any)?._id;
            
            console.log('🔍 Fetching school with ID:', schoolId);
            
            if (schoolId) {
              const response = await apiService.getSchool(schoolId);
              console.log('🔍 School API response:', response);
              
              if (response.success && response.data) {
                console.log('✅ Setting school name from API:', response.data.name);
                if (!schoolName || schoolName === 'Barrana.ai') {
                  setSchoolName(response.data.name);
                }
              }
            }
          } catch (error) {
            console.error('❌ Error fetching school info:', error);
          }
        }
      } finally {
        // Always set loading to false, regardless of which path was taken
        setLoadingBranding(false);
      }
    };

    if (user) {
      fetchSchoolInfo();
    } else {
      setLoadingBranding(false);
    }
  }, [user, school]);

  const renderSection = () => {
    switch (currentSection) {
      case 'overview':
        return <TeacherOverview schoolBranding={schoolBranding} />;
      case 'students':
        return <StudentManagement schoolBranding={schoolBranding} />;
      case 'reports-listing':
        return <ReportsListing schoolBranding={schoolBranding} />;
      // case 'communication':
      //   return <CommunicationCenter schoolBranding={schoolBranding} />;
      // case 'analytics':
      //   return <TeacherAnalytics schoolBranding={schoolBranding} />;
      // case 'settings':
      //   return <TeacherSettings schoolBranding={schoolBranding} />;
      default:
        return <TeacherOverview schoolBranding={schoolBranding} />;
    }
  };

  // Show loading screen while fetching school branding
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
        justifyContent: 'center',
        bgcolor: '#F8F9FA', 
        minHeight: '100vh' 
      }}>
        {/* Main Container - 95% width */}
        <Box sx={{ 
          width: '95%',
          maxWidth: '1400px',
          display: 'flex',
          bgcolor: '#F8F9FA',
        }}>
          {/* Sidebar */}
          <Box
            sx={{
              width: drawerWidth,
              flexShrink: 0,
              backgroundColor: '#FFFFFF',
              borderRight: 'none',
              boxShadow: '2px 0 8px rgba(0,0,0,0.08)',
              display: 'flex',
              flexDirection: 'column',
              borderRadius: 2,
              m: 2,
              mb: 0,
              height: '90vh',
              position: 'sticky',
              top: '5vh',
              alignSelf: 'flex-start',
            }}
          >
            <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'auto' }}>
              {/* User Profile Section at Top */}
              <Box sx={{ pt: 3, px: 2, pb: 2 }}>
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 3 }}>
                  <Avatar sx={{ mb: 1.5, bgcolor: 'primary.main', width: 64, height: 64, fontSize: '1.5rem', fontWeight: 700 }}>
                    {user?.firstName?.charAt(0).toUpperCase()}
                  </Avatar>
                  <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1rem', textAlign: 'center', textTransform: 'capitalize' }}>
                    {user?.firstName} {user?.lastName}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem', mt: 0.5, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    Teacher
                    <ExpandMore sx={{ fontSize: '0.875rem' }} />
                  </Typography>
                </Box>
              </Box>

              <Divider sx={{ mx: 2 }} />

              {/* Navigation Menu */}
              <List sx={{ px: 1.5, pt: 2 }}>
                {menuItems.map((item) => (
                  <ListItem
                    key={item.section}
                    onClick={() => setCurrentSection(item.section)}
                    sx={{
                      mb: 0.5,
                      borderRadius: 2,
                      py: 1,
                      px: 1.5,
                      cursor: 'pointer',
                      transition: 'all 0.2s ease-in-out',
                      backgroundColor: currentSection === item.section ? dynamicTheme.palette.primary.main : 'transparent',
                      color: currentSection === item.section ? 'white' : 'text.primary',
                      '&:hover': {
                        backgroundColor: currentSection === item.section ? dynamicTheme.palette.primary.dark : dynamicTheme.palette.primary.main,
                        color: 'white',
                        '& .MuiListItemIcon-root': {
                          color: 'white',
                        },
                        '& .MuiListItemText-primary': {
                          color: 'white',
                        },
                      },
                    }}
                  >
                    <ListItemIcon
                      sx={{
                        minWidth: 40,
                        color: currentSection === item.section ? 'white' : 'text.secondary',
                        transition: 'color 0.2s',
                      }}
                    >
                      {item.icon}
                    </ListItemIcon>
                    <ListItemText 
                      primary={item.text} 
                      primaryTypographyProps={{
                        fontWeight: currentSection === item.section ? 600 : 400,
                        fontSize: '0.875rem',
                        color: currentSection === item.section ? 'white' : 'text.primary',
                        sx: { transition: 'color 0.2s' },
                      }}
                    />
                  </ListItem>
                ))}
              </List>

              {/* Kidsible Platform Branding + Logout at Bottom */}
              <Box sx={{ mt: 'auto', pb: 2, px: 2 }}>
                {/* Powered by Kidsible */}
                <Box sx={{ mb: 1.5, textAlign: 'center', py: 1, borderRadius: 2, bgcolor: 'rgba(23,67,123,0.04)' }}>
                  <Typography variant="caption" sx={{ color: '#727272', fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', mb: 0.5 }}>
                    Powered by
                  </Typography>
                  <img
                    src="/kidsible-logo.png"
                    alt="Kidsible"
                    style={{ height: '26px', width: 'auto', objectFit: 'contain', display: 'block', margin: '0 auto' }}
                  />
                </Box>
                <Divider sx={{ mb: 2 }} />
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                  <ListItem
                    onClick={handleLogout}
                    sx={{
                      borderRadius: 2,
                      py: 0.75,
                      px: 1.5,
                      cursor: 'pointer',
                      transition: 'all 0.2s ease-in-out',
                      color: 'text.primary',
                      '&:hover': {
                        backgroundColor: dynamicTheme.palette.primary.main,
                        color: 'white',
                        '& .MuiListItemIcon-root': {
                          color: 'white',
                        },
                        '& .MuiSvgIcon-root': {
                          color: 'white',
                        },
                        '& .MuiListItemText-primary': {
                          color: 'white',
                        },
                      },
                    }}
                  >
                    <ListItemIcon sx={{ minWidth: 40, color: 'inherit' }}>
                      <Logout fontSize="small" sx={{ color: 'inherit', transition: 'color 0.2s' }} />
                    </ListItemIcon>
                    <ListItemText 
                      primary="Logout" 
                      primaryTypographyProps={{
                        fontSize: '0.875rem',
                        color: 'inherit',
                        sx: { transition: 'color 0.2s' },
                      }}
                    />
                  </ListItem>
                </Box>
              </Box>
            </Box>
          </Box>

          {/* Main Content */}
          <Box
            component="main"
            sx={{
              flexGrow: 1,
              bgcolor: '#F8F9FA',
              display: 'flex',
              flexDirection: 'column',
              mt: 2,
            }}
          >
            {/* Content Area */}
            <Box sx={{ flexGrow: 1, pt: 3, px: 3, pb: 3, position: 'relative' }}>
              {renderSection()}
            </Box>
          </Box>
        </Box>
      </Box>

      {/* User Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
        PaperProps={{
          sx: {
            mt: 1,
            minWidth: 200,
            borderRadius: 2,
            boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
          }
        }}
      >
        <MenuItem 
          onClick={handleMenuClose}
          sx={{
            '&:hover': {
              backgroundColor: 'rgba(102, 126, 234, 0.08)',
            },
          }}
        >
          <AccountCircle sx={{ mr: 2 }} />
          Profile
        </MenuItem>
        <Divider />
        <MenuItem 
          onClick={handleLogout}
          sx={{
            '&:hover': {
              backgroundColor: 'rgba(244, 67, 54, 0.08)',
              color: '#f44336',
              '& .MuiSvgIcon-root': {
                color: '#f44336',
              },
            },
          }}
        >
          <Logout sx={{ mr: 2 }} />
          Logout
        </MenuItem>
      </Menu>
    </ThemeProvider>
  );
};

export default TeacherDashboard; 