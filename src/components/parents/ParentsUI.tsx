import React, { useState } from 'react';
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
  Card,
  CardContent,
  Grid,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  LinearProgress,
  Badge,
  ListItemAvatar,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  ListItemSecondaryAction,
} from '@mui/material';
import {
  Dashboard,
  People,
  Assessment,
  Message,
  Settings,
  AccountCircle,
  Notifications,
  School,
  CheckCircle,
  Warning,
  Logout,
  ExpandMore,
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { useData } from '../../contexts/DataContext';
import NotificationIcon from '../common/NotificationIcon';

const drawerWidth = 280;

const menuItems = [
  { text: 'Dashboard', icon: <Dashboard />, section: 'dashboard' },
  { text: 'My Children', icon: <People />, section: 'children' },
  { text: 'Reports', icon: <Assessment />, section: 'reports' },
  { text: 'Communication', icon: <Message />, section: 'communication' },
  { text: 'Settings', icon: <Settings />, section: 'settings' },
];

const ParentsUI: React.FC = () => {
  const [currentSection, setCurrentSection] = useState('dashboard');
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [openReportDialog, setOpenReportDialog] = useState(false);
  const [selectedReport, setSelectedReport] = useState<any>(null);
  const [openMessageDialog, setOpenMessageDialog] = useState(false);
  
  const { user, logout } = useAuth();
  const { students, reports, parents, teachers } = useData();

  // Get children for this parent (assuming parent email matches)
  const children = students.filter(student => 
    student.parentEmail === user?.email
  ).map(student => ({
    id: student.id,
    name: `${student.firstName} ${student.lastName}`,
    grade: student.grade,
    teacher: 'Ms. Davis', // This would come from teacher data
    avatar: student.avatar,
    lastReport: student.lastReport,
    progress: 85, // This would be calculated from reports
    status: student.status,
  }));

  // Get reports for this parent's children
  const parentReports = reports.filter(report => 
    children.some(child => child.id === report.studentId)
  ).map(report => {
    const child = children.find(c => c.id === report.studentId);
    const teacher = teachers.find(t => t.id === report.teacherId);
    return {
      id: report.id,
      childName: child?.name || 'Unknown',
      type: report.title,
      date: report.createdAt,
      teacher: teacher?.name || 'Unknown',
      content: report.content,
    };
  });

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

  const handleViewReport = (report: any) => {
    setSelectedReport(report);
    setOpenReportDialog(true);
  };

  const handleContactTeacher = () => {
    setOpenMessageDialog(true);
  };

  const renderSection = () => {
    switch (currentSection) {
      case 'dashboard':
        return <ParentDashboard />;
      case 'children':
        return <ChildrenSection />;
      case 'reports':
        return <ReportsSection />;
      case 'communication':
        return <CommunicationSection />;
      case 'settings':
        return <SettingsSection />;
      default:
        return <ParentDashboard />;
    }
  };

  const ParentDashboard = () => (
    <Box>
      <Typography variant="h4" gutterBottom>
        Parent Dashboard
      </Typography>
      
      <Grid container spacing={3}>
        {/* Children Overview */}
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                My Children
              </Typography>
              <Grid container spacing={2}>
                {children.map((child) => (
                  <Grid item xs={12} sm={6} key={child.id}>
                    <Card variant="outlined">
                      <CardContent>
                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                          <Avatar sx={{ mr: 2, bgcolor: 'primary.main' }}>
                            {child.avatar}
                          </Avatar>
                          <Box>
                            <Typography variant="h6">{child.name}</Typography>
                            <Typography variant="body2" color="text.secondary">
                              {child.grade} • {child.teacher}
                            </Typography>
                          </Box>
                        </Box>
                        
                        <Box sx={{ mb: 2 }}>
                          <Typography variant="body2" gutterBottom>
                            Overall Progress
                          </Typography>
                          <LinearProgress
                            variant="determinate"
                            value={child.progress}
                            sx={{ height: 8, borderRadius: 4 }}
                          />
                          <Typography variant="caption" color="text.secondary">
                            {child.progress}% Complete
                          </Typography>
                        </Box>
                        
                        <Typography variant="body2" color="text.secondary" gutterBottom>
                          Last Report: {child.lastReport}
                        </Typography>
                        
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => setCurrentSection('reports')}
                        >
                          View Reports
                        </Button>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* Quick Actions */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Quick Actions
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Button
                  variant="contained"
                  startIcon={<Assessment />}
                  onClick={() => setCurrentSection('reports')}
                >
                  View All Reports
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<Message />}
                  onClick={handleContactTeacher}
                >
                  Contact Teacher
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<School />}
                >
                  School Calendar
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );

  const ChildrenSection = () => (
    <Box>
      <Typography variant="h4" gutterBottom>
        My Children
      </Typography>
      
      <Grid container spacing={3}>
        {children.map((child) => (
          <Grid item xs={12} md={6} key={child.id}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                  <Avatar sx={{ mr: 2, width: 64, height: 64, bgcolor: 'primary.main' }}>
                    {child.avatar}
                  </Avatar>
                  <Box>
                    <Typography variant="h5">{child.name}</Typography>
                    <Typography variant="body1" color="text.secondary">
                      {child.grade}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Teacher: {child.teacher}
                    </Typography>
                  </Box>
                </Box>
                
                <Box sx={{ mb: 3 }}>
                  <Typography variant="h6" gutterBottom>
                    Academic Progress
                  </Typography>
                  <LinearProgress
                    variant="determinate"
                    value={child.progress}
                    sx={{ height: 12, borderRadius: 6, mb: 1 }}
                  />
                  <Typography variant="body2" color="text.secondary">
                    {child.progress}% of curriculum completed
                  </Typography>
                </Box>
                
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button
                    variant="contained"
                    onClick={() => setCurrentSection('reports')}
                  >
                    View Reports
                  </Button>
                  <Button
                    variant="outlined"
                    onClick={handleContactTeacher}
                  >
                    Contact Teacher
                  </Button>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );

  const ReportsSection = () => (
    <Box>
      <Typography variant="h4" gutterBottom>
        Reports
      </Typography>
      
      <Grid container spacing={3}>
        {parentReports.map((report) => (
          <Grid item xs={12} key={report.id}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Box>
                    <Typography variant="h6">{report.type}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {report.childName} • {report.date} • {report.teacher}
                    </Typography>
                  </Box>
                  <Button
                    variant="contained"
                    onClick={() => handleViewReport(report)}
                  >
                    View Details
                  </Button>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );

  const CommunicationSection = () => (
    <Box>
      <Typography variant="h4" gutterBottom>
        Communication
      </Typography>
      
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Contact Teachers
              </Typography>
              <List>
                {children.map((child) => (
                  <ListItem key={child.id}>
                    <ListItemAvatar>
                      <Avatar sx={{ bgcolor: 'primary.main' }}>
                        <School />
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={child.teacher}
                      secondary={`${child.name} - ${child.grade}`}
                    />
                    <ListItemSecondaryAction>
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<Message />}
                        onClick={handleContactTeacher}
                      >
                        Message
                      </Button>
                    </ListItemSecondaryAction>
                  </ListItem>
                ))}
              </List>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Recent Messages
              </Typography>
              <Typography variant="body2" color="text.secondary">
                No recent messages
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );

  const SettingsSection = () => (
    <Box>
      <Typography variant="h4" gutterBottom>
        Settings
      </Typography>
      <Card>
        <CardContent>
          <Typography variant="body1">
            Parent Settings - Coming Soon
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex' }}>
      {/* App Bar */}
      <AppBar
        position="fixed"
        sx={{
          width: `calc(100% - ${drawerWidth}px)`,
          ml: `${drawerWidth}px`,
          backgroundColor: 'white',
          color: 'text.primary',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        }}
      >
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            {menuItems.find(item => item.section === currentSection)?.text || 'Parent Dashboard'}
          </Typography>
          
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <NotificationIcon />
            
            <IconButton onClick={handleMenuOpen} color="inherit">
              <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.main' }}>
                {user?.firstName?.charAt(0)}
              </Avatar>
            </IconButton>
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
            backgroundColor: '#f8f9fa',
            borderRight: '1px solid #e0e0e0',
          },
        }}
        variant="permanent"
        anchor="left"
      >
        <Toolbar sx={{ height: 64 }} />
        
        <Box sx={{ p: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
            <Avatar sx={{ mr: 2, bgcolor: 'primary.main' }}>
              {user?.firstName?.charAt(0)}
            </Avatar>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                {user?.firstName} {user?.lastName}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Parent
              </Typography>
            </Box>
          </Box>
        </Box>

        <Divider />

        <List sx={{ px: 2 }}>
          {menuItems.map((item) => (
            <ListItem
              key={item.section}
              button
              onClick={() => setCurrentSection(item.section)}
              sx={{
                mb: 1,
                borderRadius: 2,
                backgroundColor: currentSection === item.section ? 'primary.main' : 'transparent',
                color: currentSection === item.section ? 'white' : 'text.primary',
                '&:hover': {
                  backgroundColor: currentSection === item.section ? 'primary.dark' : 'rgba(25, 118, 210, 0.08)',
                },
              }}
            >
              <ListItemIcon
                sx={{
                  color: currentSection === item.section ? 'white' : 'text.secondary',
                }}
              >
                {item.icon}
              </ListItemIcon>
              <ListItemText primary={item.text} />
            </ListItem>
          ))}
        </List>
      </Drawer>

      {/* Main Content */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          bgcolor: 'background.default',
          minHeight: '100vh',
        }}
      >
        <Toolbar />
        <Box sx={{ p: 3 }}>
          {renderSection()}
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
          },
        }}
      >
        <MenuItem onClick={handleMenuClose}>
          <ListItemIcon>
            <AccountCircle fontSize="small" />
          </ListItemIcon>
          Profile
        </MenuItem>
        <MenuItem onClick={handleMenuClose}>
          <ListItemIcon>
            <Settings fontSize="small" />
          </ListItemIcon>
          Settings
        </MenuItem>
        <Divider />
        <MenuItem onClick={handleLogout}>
          <ListItemIcon>
            <Logout fontSize="small" />
          </ListItemIcon>
          Logout
        </MenuItem>
      </Menu>

      {/* Report Detail Dialog */}
      <Dialog open={openReportDialog} onClose={() => setOpenReportDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          {selectedReport?.type} - {selectedReport?.childName}
        </DialogTitle>
        <DialogContent>
          {selectedReport && (
            <Box>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Generated by {selectedReport.teacher} on {selectedReport.date}
              </Typography>
              
              <Accordion defaultExpanded>
                <AccordionSummary expandIcon={<ExpandMore />}>
                  <Typography variant="h6">Academic Progress</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Grid container spacing={2}>
                    {Object.entries(selectedReport.content.academicProgress).map(([subject, score]) => (
                      <Grid item xs={6} key={subject}>
                        <Box>
                          <Typography variant="body2" gutterBottom>
                            {subject.charAt(0).toUpperCase() + subject.slice(1)}
                          </Typography>
                          <Box sx={{ mb: 1 }}>
                            <Box
                              sx={{
                                height: 8,
                                borderRadius: 4,
                                bgcolor: 'grey.200',
                                position: 'relative',
                                overflow: 'hidden'
                              }}
                            >
                              <Box
                                sx={{
                                  height: '100%',
                                  width: `${score as number}%`,
                                  bgcolor: 'primary.main',
                                  transition: 'width 0.3s ease'
                                }}
                              />
                            </Box>
                          </Box>
                          <Typography variant="caption" color="text.secondary">
                            {score as number}%
                          </Typography>
                        </Box>
                      </Grid>
                    ))}
                  </Grid>
                </AccordionDetails>
              </Accordion>
              
              <Accordion>
                <AccordionSummary expandIcon={<ExpandMore />}>
                  <Typography variant="h6">Social Development</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  {Object.entries(selectedReport.content.socialDevelopment).map(([skill, level]) => (
                    <Box key={skill} sx={{ mb: 2 }}>
                      <Typography variant="body2" gutterBottom>
                        {skill.charAt(0).toUpperCase() + skill.slice(1)}: {level as string}
                      </Typography>
                    </Box>
                  ))}
                </AccordionDetails>
              </Accordion>
              
              <Accordion>
                <AccordionSummary expandIcon={<ExpandMore />}>
                  <Typography variant="h6">Areas for Growth</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <List>
                    {selectedReport.content.areasForGrowth.map((area: string, index: number) => (
                      <ListItem key={index}>
                        <ListItemIcon>
                          <Warning color="warning" />
                        </ListItemIcon>
                        <ListItemText primary={area} />
                      </ListItem>
                    ))}
                  </List>
                </AccordionDetails>
              </Accordion>
              
              <Accordion>
                <AccordionSummary expandIcon={<ExpandMore />}>
                  <Typography variant="h6">Recommendations</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <List>
                    {selectedReport.content.recommendations.map((rec: string, index: number) => (
                      <ListItem key={index}>
                        <ListItemIcon>
                          <CheckCircle color="success" />
                        </ListItemIcon>
                        <ListItemText primary={rec} />
                      </ListItem>
                    ))}
                  </List>
                </AccordionDetails>
              </Accordion>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenReportDialog(false)}>Close</Button>
          <Button variant="contained" onClick={handleContactTeacher}>
            Contact Teacher
          </Button>
        </DialogActions>
      </Dialog>

      {/* Message Dialog */}
      <Dialog open={openMessageDialog} onClose={() => setOpenMessageDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Contact Teacher</DialogTitle>
        <DialogContent>
          <Typography variant="body1" gutterBottom>
            Send a message to your child's teacher
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenMessageDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={() => setOpenMessageDialog(false)}>
            Send Message
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ParentsUI; 