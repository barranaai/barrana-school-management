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
} from '@mui/material';
import {
  Dashboard,
  People,
  Message,
  Settings,
  AccountCircle,
  Notifications,
  School,
  Logout,
  Assessment,
  Analytics,
  Business,
  NotificationsActive,
  AdminPanelSettings,
  Group,
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { apiService } from '../../services/apiService';
import LanguageSelector from '../common/LanguageSelector';
import NotificationIcon from '../common/NotificationIcon';
import ExecutiveSummary from './sections/ExecutiveSummary';
import StudentManagement from './sections/StudentManagement';
import TeacherManagement from './sections/TeacherManagement';
import ClassManagement from './sections/ClassManagement';
import ReportConfiguration from './sections/ReportConfiguration';
import AllReports from './sections/AllReports';


const drawerWidth = 300;

const menuItems = [
  { text: 'Executive Summary', icon: <Dashboard />, section: 'dashboard', color: '#667eea' },
  { text: 'Student Management', icon: <People />, section: 'students', color: '#764ba2' },
  { text: 'Teacher Management', icon: <School />, section: 'teachers', color: '#f093fb' },
  { text: 'Class Management', icon: <Group />, section: 'classes', color: '#ff9a9e' },
  { text: 'Report Configuration', icon: <Assessment />, section: 'reports', color: '#4facfe' },
  { text: 'All Reports', icon: <Assessment />, section: 'all-reports', color: '#4facfe' },
];

const AdminDashboard: React.FC = () => {
  const [currentSection, setCurrentSection] = useState('dashboard');
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [schoolName, setSchoolName] = useState<string>('Barrana.ai');
  const { user, logout } = useAuth();

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
      if (user?.schoolId) {
        try {
          // Extract schoolId - it can be either a string or an object
          const schoolId = typeof user.schoolId === 'string' 
            ? user.schoolId 
            : (user.schoolId as any)?._id;
          
          if (schoolId) {
            const response = await apiService.getSchool(schoolId);
            if (response.success && response.data) {
              setSchoolName(response.data.name);
            }
          }
        } catch (error) {
          console.error('Error fetching school info:', error);
          // Keep default name if fetch fails
        }
      }
    };

    fetchSchoolInfo();
  }, [user?.schoolId]);

  const renderSection = () => {
    switch (currentSection) {
      case 'dashboard':
        return <ExecutiveSummary />;
      case 'students':
        return <StudentManagement />;
      case 'teachers':
        return <TeacherManagement />;
      case 'classes':
        return <ClassManagement />;
      case 'reports':
        return <ReportConfiguration />;
      case 'all-reports':
        return <AllReports />;

      default:
        return <ExecutiveSummary />;
    }
  };

  const currentMenuItem = menuItems.find(item => item.section === currentSection);

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: '#f8fafc' }}>
      {/* App Bar */}
      <AppBar
        position="fixed"
        sx={{
          width: `calc(100% - ${drawerWidth}px)`,
          ml: `${drawerWidth}px`,
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
          boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
          backdropFilter: 'blur(10px)',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
        }}
        elevation={0}
      >
        <Toolbar sx={{ minHeight: 70 }}>
          <Box sx={{ flexGrow: 1 }}>
            <Typography 
              variant="h5" 
              component="div" 
              sx={{ 
                fontWeight: 700,
                background: 'linear-gradient(45deg, #fff 30%, #f0f0f0 90%)',
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                textShadow: '0 2px 4px rgba(0,0,0,0.1)',
              }}
            >
              {currentMenuItem?.text || 'Admin Dashboard'}
            </Typography>
            <Typography variant="caption" sx={{ opacity: 0.8, mt: 0.5 }}>
              Welcome back, {user?.firstName}!
            </Typography>
          </Box>
          
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            {/* Notifications */}
            <Paper
              elevation={0}
              sx={{
                background: 'rgba(255,255,255,0.1)',
                borderRadius: 2,
                p: 0.5,
              }}
            >
              <NotificationIcon variant="active" />
            </Paper>
            
            {/* User Menu */}
            <Paper
              elevation={0}
              sx={{
                background: 'rgba(255,255,255,0.1)',
                borderRadius: 2,
                p: 0.5,
              }}
            >
              <IconButton 
                onClick={handleMenuOpen} 
                color="inherit"
                sx={{ 
                  '&:hover': { 
                    background: 'rgba(255,255,255,0.2)',
                    transform: 'scale(1.05)',
                  },
                  transition: 'all 0.2s ease-in-out',
                }}
              >
                <Avatar 
                  sx={{ 
                    width: 36, 
                    height: 36, 
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    border: '2px solid rgba(255,255,255,0.3)',
                    fontWeight: 600,
                    fontSize: '1rem',
                  }}
                >
                  {user?.firstName?.charAt(0)}
                </Avatar>
              </IconButton>
            </Paper>

            {/* Language Selector */}
            <Paper
              elevation={0}
              sx={{
                background: 'rgba(255,255,255,0.1)',
                borderRadius: 2,
                p: 0.5,
              }}
            >
              <LanguageSelector />
            </Paper>
          </Box>
        </Toolbar>
      </AppBar>

      {/* Sidebar */}
      <Drawer
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: drawerWidth,
            boxSizing: 'border-box',
            background: 'linear-gradient(180deg, #667eea 0%, #764ba2 100%)',
            borderRight: 'none',
            boxShadow: '4px 0 20px rgba(0,0,0,0.1)',
          },
        }}
        variant="permanent"
        anchor="left"
      >
        <Toolbar sx={{ height: 70 }} />
        
        <Box sx={{ p: 3 }}>
          <Grow in timeout={800}>
            <Paper
              elevation={0}
              sx={{
                background: 'rgba(255,255,255,0.1)',
                borderRadius: 3,
                p: 2.5,
                mb: 3,
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(255,255,255,0.2)',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <Box
                  sx={{
                    background: 'rgba(255,255,255,0.2)',
                    borderRadius: 2,
                    p: 1,
                    mr: 2,
                  }}
                >
                  <Business sx={{ fontSize: 28, color: 'white' }} />
                </Box>
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 700, color: 'white' }}>
                    {schoolName}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.8)' }}>
                    School Management
                  </Typography>
                </Box>
              </Box>
              
              <Chip
                icon={<AdminPanelSettings />}
                label={`${user?.firstName} ${user?.lastName}`}
                variant="filled"
                size="small"
                sx={{ 
                  background: 'rgba(255,255,255,0.2)',
                  color: 'white',
                  fontWeight: 600,
                  '& .MuiChip-icon': { color: 'white' },
                }}
              />
            </Paper>
          </Grow>
        </Box>

        <Divider sx={{ borderColor: 'rgba(255,255,255,0.2)', mx: 3 }} />

        <List sx={{ px: 2, pt: 2 }}>
          {menuItems.map((item, index) => (
            <Grow in timeout={800 + index * 100} key={item.section}>
              <ListItem
                button
                onClick={() => setCurrentSection(item.section)}
                sx={{
                  mb: 1,
                  borderRadius: 3,
                  background: currentSection === item.section 
                    ? 'rgba(255,255,255,0.2)' 
                    : 'transparent',
                  color: currentSection === item.section ? 'white' : 'rgba(255,255,255,0.8)',
                  border: currentSection === item.section 
                    ? '1px solid rgba(255,255,255,0.3)' 
                    : '1px solid transparent',
                  backdropFilter: currentSection === item.section ? 'blur(10px)' : 'none',
                  '&:hover': {
                    background: currentSection === item.section 
                      ? 'rgba(255,255,255,0.25)' 
                      : 'rgba(255,255,255,0.1)',
                    transform: 'translateX(4px)',
                    borderColor: 'rgba(255,255,255,0.4)',
                  },
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                }}
              >
                <ListItemIcon
                  sx={{
                    color: currentSection === item.section ? 'white' : 'rgba(255,255,255,0.7)',
                    minWidth: 40,
                  }}
                >
                  {item.icon}
                </ListItemIcon>
                <ListItemText 
                  primary={item.text} 
                  sx={{ 
                    '& .MuiTypography-root': { 
                      fontWeight: currentSection === item.section ? 600 : 500,
                      fontSize: '0.95rem',
                    } 
                  }}
                />
              </ListItem>
            </Grow>
          ))}
        </List>
      </Drawer>

      {/* Main Content */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
          minHeight: '100vh',
        }}
      >
        <Toolbar sx={{ height: 70 }} />
        <Container maxWidth="xl" sx={{ py: 4 }}>
          <Fade in timeout={500}>
            <Paper
              elevation={0}
              sx={{
                background: 'rgba(255,255,255,0.8)',
                borderRadius: 4,
                p: 4,
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(255,255,255,0.3)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
                minHeight: 'calc(100vh - 140px)',
              }}
            >
              {renderSection()}
            </Paper>
          </Fade>
        </Container>
      </Box>

      {/* User Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
        PaperProps={{
          sx: {
            mt: 1,
            minWidth: 220,
            background: 'rgba(255,255,255,0.95)',
            backdropFilter: 'blur(10px)',
            borderRadius: 3,
            border: '1px solid rgba(255,255,255,0.3)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
          },
        }}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        <MenuItem 
          onClick={handleMenuClose}
          sx={{
            borderRadius: 2,
            mx: 1,
            my: 0.5,
            '&:hover': { background: 'rgba(102, 126, 234, 0.1)' },
          }}
        >
          <ListItemIcon>
            <AccountCircle fontSize="small" sx={{ color: '#667eea' }} />
          </ListItemIcon>
          <Typography sx={{ fontWeight: 500 }}>Profile</Typography>
        </MenuItem>
        <MenuItem 
          onClick={handleMenuClose}
          sx={{
            borderRadius: 2,
            mx: 1,
            my: 0.5,
            '&:hover': { background: 'rgba(102, 126, 234, 0.1)' },
          }}
        >
          <ListItemIcon>
            <Settings fontSize="small" sx={{ color: '#667eea' }} />
          </ListItemIcon>
          <Typography sx={{ fontWeight: 500 }}>Settings</Typography>
        </MenuItem>
        <Divider sx={{ my: 1 }} />
        <MenuItem 
          onClick={handleLogout}
          sx={{
            borderRadius: 2,
            mx: 1,
            my: 0.5,
            '&:hover': { background: 'rgba(244, 67, 54, 0.1)' },
          }}
        >
          <ListItemIcon>
            <Logout fontSize="small" sx={{ color: '#f44336' }} />
          </ListItemIcon>
          <Typography sx={{ fontWeight: 500, color: '#f44336' }}>Logout</Typography>
        </MenuItem>
      </Menu>
    </Box>
  );
};

export default AdminDashboard; 