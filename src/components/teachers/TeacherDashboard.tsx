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

// import CommunicationCenter from './sections/CommunicationCenter';
// import TeacherAnalytics from './sections/TeacherAnalytics';
// import TeacherSettings from './sections/TeacherSettings';

const drawerWidth = 300;

const menuItems = [
  { text: 'Teacher Overview', icon: <Dashboard />, section: 'overview', color: '#667eea' },
  { text: 'My Students', icon: <People />, section: 'students', color: '#764ba2' },
  { text: 'My Reports', icon: <Description />, section: 'reports-listing', color: '#4facfe' },
  // { text: 'Communication', icon: <Message />, section: 'communication', color: '#4facfe' },
  // { text: 'Analytics', icon: <TrendingUp />, section: 'analytics', color: '#43e97b' },
  // { text: 'Settings', icon: <Settings />, section: 'settings', color: '#fa709a' },
];

const TeacherDashboard: React.FC = () => {
  const [currentSection, setCurrentSection] = useState('overview');
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [schoolName, setSchoolName] = useState<string>('Barrana.ai');
  const { user, logout } = useAuth();
  const { students, reports, teachers, analytics, school } = useData();

  // Handle hash navigation for direct access to sections
  useEffect(() => {
    const hash = window.location.hash.replace('#', '');
    if (hash && menuItems.some(item => item.section === hash)) {
      setCurrentSection(hash);
    }
  }, []);

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

  // Fetch school information when component mounts
  useEffect(() => {
    const fetchSchoolInfo = async () => {
      console.log('🔍 User data:', user);
      console.log('🔍 School data from context:', school);
      console.log('🔍 User schoolId:', user?.schoolId);
      console.log('🔍 User schoolId type:', typeof user?.schoolId);
      
      // Check if schoolId is an object with school information
      if (user?.schoolId && typeof user.schoolId === 'object' && (user.schoolId as any).name) {
        console.log('✅ Using school name from user.schoolId object:', (user.schoolId as any).name);
        setSchoolName((user.schoolId as any).name);
        return;
      }
      
      // First try to get school from context if available
      if (school && school.name) {
        console.log('✅ Using school from context:', school.name);
        setSchoolName(school.name);
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
            setSchoolName((response.data.schoolId as any).name);
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
              setSchoolName(response.data.name);
            }
          }
        } catch (error) {
          console.error('❌ Error fetching school info:', error);
        }
      }
    };

    fetchSchoolInfo();
  }, [user, school]);

  const renderSection = () => {
    switch (currentSection) {
      case 'overview':
        return <TeacherOverview />;
      case 'students':
        return <StudentManagement />;
      case 'reports-listing':
        return <ReportsListing />;
      // case 'communication':
      //   return <CommunicationCenter />;
      // case 'analytics':
      //   return <TeacherAnalytics />;
      // case 'settings':
      //   return <TeacherSettings />;
      default:
        return <TeacherOverview />;
    }
  };

  return (
    <Box sx={{ display: 'flex' }}>
      {/* Sidebar */}
      <Drawer
        variant="permanent"
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: drawerWidth,
            boxSizing: 'border-box',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            border: 'none',
          },
        }}
      >
        {/* School Logo and Info */}
        <Box sx={{ p: 3, textAlign: 'center' }}>
          {/* School Logo */}
          <Box sx={{ mb: 2 }}>
            <Avatar 
              sx={{ 
                width: 60, 
                height: 60, 
                mx: 'auto',
                bgcolor: 'rgba(255,255,255,0.2)',
                fontSize: '1.5rem',
                fontWeight: 700,
                mb: 1
              }}
            >
              {schoolName && schoolName.length > 0 ? schoolName.charAt(0).toUpperCase() : 'S'}
            </Avatar>
          </Box>
          
          {/* School Name */}
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
            {schoolName || (user?.schoolId && typeof user.schoolId === 'object' ? (user.schoolId as any).name : 'School Name Loading...')}
          </Typography>
          
          {/* Teacher Name */}
          <Typography variant="body2" sx={{ opacity: 0.9, fontWeight: 500 }}>
            {user?.firstName} {user?.lastName}
          </Typography>
          
          <Typography variant="caption" sx={{ opacity: 0.7 }}>
            Teacher
          </Typography>
        </Box>

        <Divider sx={{ borderColor: 'rgba(255,255,255,0.2)' }} />

        {/* Navigation Menu */}
        <List sx={{ mt: 2 }}>
          {menuItems.map((item, index) => (
            <ListItem
              key={item.section}
              disablePadding
              sx={{ mb: 1 }}
            >
              <ListItemButton
                onClick={() => setCurrentSection(item.section)}
                sx={{
                  mx: 2,
                  borderRadius: 2,
                  backgroundColor: currentSection === item.section 
                    ? 'rgba(255,255,255,0.2)' 
                    : 'transparent',
                  '&:hover': {
                    backgroundColor: 'rgba(255,255,255,0.1)',
                  },
                  transition: 'all 0.3s ease',
                }}
              >
                <ListItemIcon sx={{ color: 'white', minWidth: 40 }}>
                  {item.icon}
                </ListItemIcon>
                <ListItemText 
                  primary={item.text} 
                  sx={{ 
                    '& .MuiTypography-root': { 
                      fontWeight: currentSection === item.section ? 600 : 400 
                    } 
                  }} 
                />
              </ListItemButton>
            </ListItem>
          ))}
        </List>

        <Divider sx={{ borderColor: 'rgba(255,255,255,0.2)', mt: 'auto' }} />

        {/* User Profile */}
        <Box sx={{ p: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <Avatar 
              sx={{ 
                mr: 2, 
                bgcolor: 'rgba(255,255,255,0.2)',
                width: 40,
                height: 40
              }}
            >
              {user?.firstName?.[0]}{user?.lastName?.[0]}
            </Avatar>
            <Box sx={{ flexGrow: 1 }}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {user?.firstName} {user?.lastName}
              </Typography>
              <Typography variant="caption" sx={{ opacity: 0.8 }}>
                Teacher
              </Typography>
            </Box>
            <IconButton
              onClick={handleMenuOpen}
              sx={{ color: 'white' }}
            >
              <AccountCircle />
            </IconButton>
          </Box>
        </Box>
      </Drawer>

      {/* Main Content */}
      <Box sx={{ flexGrow: 1 }}>
        {/* Top Bar */}
        <AppBar 
          position="static" 
          elevation={0}
          sx={{ 
            backgroundColor: 'rgba(255,255,255,0.9)',
            backdropFilter: 'blur(10px)',
            borderBottom: '1px solid rgba(0,0,0,0.1)',
          }}
        >
          <Toolbar>
            <Typography 
              variant="h6" 
              sx={{ 
                flexGrow: 1, 
                color: 'text.primary',
                fontWeight: 600 
              }}
            >
              {menuItems.find(item => item.section === currentSection)?.text}
            </Typography>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <LanguageSelector />
              
              <NotificationIcon />

              <Chip 
                label={schoolName}
                size="small"
                sx={{ 
                  backgroundColor: 'rgba(102, 126, 234, 0.1)',
                  color: '#667eea',
                  fontWeight: 500
                }}
              />
            </Box>
          </Toolbar>
        </AppBar>

        {/* Content Area */}
        <Box sx={{ p: 3, backgroundColor: '#f8fafc', minHeight: 'calc(100vh - 64px)' }}>
          <Fade in timeout={300}>
            <Container maxWidth="xl">
              {renderSection()}
            </Container>
          </Fade>
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
        <MenuItem onClick={handleMenuClose}>
          <AccountCircle sx={{ mr: 2 }} />
          Profile
        </MenuItem>
        {/* <MenuItem onClick={handleMenuClose}>
          <Settings sx={{ mr: 2 }} />
          Settings
        </MenuItem> */}
        <Divider />
        <MenuItem onClick={handleLogout}>
          <Logout sx={{ mr: 2 }} />
          Logout
        </MenuItem>
      </Menu>
    </Box>
  );
};

export default TeacherDashboard; 