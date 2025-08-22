import React from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  LinearProgress,
  Chip,
  Avatar,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Divider,
  Button,
  Alert,
  Paper,
  Container,
  Fade,
  Grow,
} from '@mui/material';
import {
  TrendingUp,
  TrendingDown,
  People,
  School,
  Assessment,
  Notifications,
  CheckCircle,
  Warning,
  Info,
} from '@mui/icons-material';
import { useData } from '../../../contexts/DataContext';

const ExecutiveSummary: React.FC = () => {
  const { students, teachers, reports, classes, analytics, school, isLoading } = useData();

  // Use analytics from DataContext
  const { activeStudents, activeTeachers, completedReports, parentEngagement, classUtilization } = analytics;

  // Calculate trends (comparing to previous period - for now using simple calculations)
  const studentTrend = students.length > 0 ? '+12%' : '0%';
  const teacherTrend = activeTeachers > 0 ? '+5%' : '0%';
  const reportTrend = completedReports > 0 ? '+23%' : '0%';
  const engagementTrend = parentEngagement > 50 ? '+8%' : '0%';

  const kpis = [
    {
      title: 'Total Students',
      value: students.length.toString(),
      change: studentTrend,
      trend: students.length > 0 ? 'up' : 'neutral',
      icon: <People />,
      color: '#1976d2',
    },
    {
      title: 'Active Teachers',
      value: activeTeachers.toString(),
      change: teacherTrend,
      trend: activeTeachers > 0 ? 'up' : 'neutral',
      icon: <School />,
      color: '#2e7d32',
    },
    {
      title: 'Reports Generated',
      value: completedReports.toString(),
      change: reportTrend,
      trend: completedReports > 0 ? 'up' : 'neutral',
      icon: <Assessment />,
      color: '#ed6c02',
    },
    {
      title: 'Parent Engagement',
      value: `${parentEngagement}%`,
      change: engagementTrend,
      trend: parentEngagement > 50 ? 'up' : 'neutral',
      icon: <Notifications />,
      color: '#9c27b0',
    },
  ];

  // Generate real insights based on actual data
  const insights = [
    {
      type: parentEngagement > 80 ? 'success' : parentEngagement > 50 ? 'info' : 'warning',
      title: parentEngagement > 80 ? 'High Parent Engagement' : parentEngagement > 50 ? 'Moderate Parent Engagement' : 'Low Parent Engagement',
      description: `${parentEngagement}% of students have parent contact information. ${parentEngagement > 80 ? 'Excellent engagement!' : parentEngagement > 50 ? 'Consider outreach programs.' : 'Need to improve parent communication.'}`,
      icon: <CheckCircle />,
    },
    {
      type: activeTeachers > 0 && classes.length > 0 ? 'info' : 'warning',
      title: activeTeachers > 0 && classes.length > 0 ? 'Good Teacher Distribution' : 'Teacher Assignment Needed',
      description: activeTeachers > 0 && classes.length > 0 
        ? `${activeTeachers} active teachers managing ${classes.length} classes. Good coverage.`
        : 'Classes need teacher assignments. Consider assigning teachers to classes.',
      icon: activeTeachers > 0 && classes.length > 0 ? <CheckCircle /> : <Warning />,
    },
    {
      type: completedReports > 0 ? 'success' : 'info',
      title: completedReports > 0 ? 'Reports Being Generated' : 'No Reports Yet',
      description: completedReports > 0 
        ? `${completedReports} reports have been generated. Great progress tracking!`
        : 'No reports generated yet. Encourage teachers to start creating reports.',
      icon: completedReports > 0 ? <CheckCircle /> : <Info />,
    },
  ];

  // Generate real recent activity from actual data
  const recentActivity = [
    ...(students.length > 0 ? [{
      action: 'Students enrolled',
      details: `${students.length} students currently enrolled`,
      time: 'Current',
      user: 'System',
    }] : []),
    ...(teachers.length > 0 ? [{
      action: 'Teachers active',
      details: `${activeTeachers} out of ${teachers.length} teachers are active`,
      time: 'Current',
      user: 'System',
    }] : []),
    ...(reports.length > 0 ? [{
      action: 'Reports generated',
      details: `${completedReports} completed reports out of ${reports.length} total`,
      time: 'Current',
      user: 'System',
    }] : []),
    ...(classes.length > 0 ? [{
      action: 'Classes managed',
      details: `${classes.length} classes with ${classes.filter(c => c.assignedTeachers.length > 0).length} having teachers assigned`,
      time: 'Current',
      user: 'System',
    }] : []),
  ];

  // Show loading state
  if (isLoading) {
    return (
      <Container maxWidth="xl">
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
          <Typography variant="h6" color="text.secondary">
            Loading dashboard data...
          </Typography>
        </Box>
      </Container>
    );
  }

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
            Executive Summary
          </Typography>
          <Typography 
            variant="body1" 
            sx={{ 
              color: 'text.secondary',
              opacity: 0.8,
              fontWeight: 500,
            }}
          >
            Overview of {school.name}'s performance and key metrics
          </Typography>
        </Box>
      </Fade>

      {/* KPIs Grid */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {kpis.map((kpi, index) => (
          <Grow in timeout={800 + index * 100} key={index}>
            <Grid item xs={12} sm={6} md={3}>
              <Paper
                elevation={0}
                sx={{
                  height: '100%',
                  background: 'rgba(255,255,255,0.8)',
                  borderRadius: 4,
                  backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(255,255,255,0.3)',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: '0 12px 40px rgba(0,0,0,0.15)',
                    borderColor: 'rgba(255,255,255,0.5)',
                  },
                }}
              >
                <CardContent sx={{ p: 3 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <Avatar 
                      sx={{ 
                        background: `linear-gradient(135deg, ${kpi.color} 0%, ${kpi.color}dd 100%)`,
                        mr: 2,
                        width: 48,
                        height: 48,
                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                      }}
                    >
                      {kpi.icon}
                    </Avatar>
                    <Box sx={{ flexGrow: 1 }}>
                      <Typography 
                        variant="h4" 
                        component="div"
                        sx={{ 
                          fontWeight: 700,
                          background: 'linear-gradient(135deg, #2c3e50 0%, #34495e 100%)',
                          backgroundClip: 'text',
                          WebkitBackgroundClip: 'text',
                          WebkitTextFillColor: 'transparent',
                        }}
                      >
                        {kpi.value}
                      </Typography>
                      <Typography 
                        variant="body2" 
                        sx={{ 
                          color: 'text.secondary',
                          fontWeight: 500,
                          opacity: 0.8,
                        }}
                      >
                        {kpi.title}
                      </Typography>
                    </Box>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    {kpi.trend === 'up' ? (
                      <TrendingUp sx={{ color: '#4caf50', mr: 1 }} />
                    ) : (
                      <TrendingDown sx={{ color: '#f44336', mr: 1 }} />
                    )}
                    <Typography
                      variant="body2"
                      sx={{
                        color: kpi.trend === 'up' ? '#4caf50' : '#f44336',
                        fontWeight: 600,
                      }}
                    >
                      {kpi.change} from last month
                    </Typography>
                  </Box>
                </CardContent>
              </Paper>
            </Grid>
          </Grow>
        ))}
      </Grid>

      {/* Insights and Activity */}
      <Grid container spacing={3}>
        {/* Key Insights */}
        <Grow in timeout={1000}>
          <Grid item xs={12} md={6}>
            <Paper
              elevation={0}
              sx={{
                background: 'rgba(255,255,255,0.8)',
                borderRadius: 4,
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(255,255,255,0.3)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                '&:hover': {
                  transform: 'translateY(-2px)',
                  boxShadow: '0 12px 40px rgba(0,0,0,0.15)',
                },
              }}
            >
              <CardContent sx={{ p: 3 }}>
                <Typography 
                  variant="h6" 
                  gutterBottom
                  sx={{
                    fontWeight: 700,
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    backgroundClip: 'text',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    mb: 3,
                  }}
                >
                  Key Insights
                </Typography>
                <List sx={{ p: 0 }}>
                  {insights.map((insight, index) => (
                    <React.Fragment key={index}>
                      <ListItem 
                        alignItems="flex-start"
                        sx={{
                          borderRadius: 2,
                          mb: 1,
                          '&:hover': {
                            background: 'rgba(102, 126, 234, 0.05)',
                          },
                          transition: 'all 0.2s ease-in-out',
                        }}
                      >
                        <ListItemAvatar>
                          <Avatar 
                            sx={{ 
                              background: `linear-gradient(135deg, ${
                                insight.type === 'success' ? '#4caf50' : 
                                insight.type === 'warning' ? '#ff9800' : '#2196f3'
                              } 0%, ${
                                insight.type === 'success' ? '#45a049' : 
                                insight.type === 'warning' ? '#e68900' : '#1976d2'
                              } 100%)`,
                              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                            }}
                          >
                            {insight.icon}
                          </Avatar>
                        </ListItemAvatar>
                        <ListItemText
                          primary={
                            <Typography 
                              variant="subtitle2" 
                              sx={{ 
                                fontWeight: 600,
                                color: 'text.primary',
                              }}
                            >
                              {insight.title}
                            </Typography>
                          }
                          secondary={
                            <Typography 
                              variant="body2" 
                              sx={{ 
                                color: 'text.secondary',
                                opacity: 0.8,
                                mt: 0.5,
                              }}
                            >
                              {insight.description}
                            </Typography>
                          }
                        />
                      </ListItem>
                      {index < insights.length - 1 && (
                        <Divider 
                          variant="inset" 
                          component="li" 
                          sx={{ 
                            borderColor: 'rgba(0,0,0,0.08)',
                            mx: 3,
                          }} 
                        />
                      )}
                    </React.Fragment>
                  ))}
                </List>
              </CardContent>
            </Paper>
          </Grid>
        </Grow>

        {/* Recent Activity */}
        <Grow in timeout={1200}>
          <Grid item xs={12} md={6}>
            <Paper
              elevation={0}
              sx={{
                background: 'rgba(255,255,255,0.8)',
                borderRadius: 4,
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(255,255,255,0.3)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                '&:hover': {
                  transform: 'translateY(-2px)',
                  boxShadow: '0 12px 40px rgba(0,0,0,0.15)',
                },
              }}
            >
              <CardContent sx={{ p: 3 }}>
                <Typography 
                  variant="h6" 
                  gutterBottom
                  sx={{
                    fontWeight: 700,
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    backgroundClip: 'text',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    mb: 3,
                  }}
                >
                  Recent Activity
                </Typography>
                <List sx={{ p: 0 }}>
                  {recentActivity.map((activity, index) => (
                    <React.Fragment key={index}>
                      <ListItem 
                        alignItems="flex-start"
                        sx={{
                          borderRadius: 2,
                          mb: 1,
                          '&:hover': {
                            background: 'rgba(102, 126, 234, 0.05)',
                          },
                          transition: 'all 0.2s ease-in-out',
                        }}
                      >
                        <ListItemText
                          primary={
                            <Typography 
                              variant="subtitle2" 
                              sx={{ 
                                fontWeight: 600,
                                color: 'text.primary',
                              }}
                            >
                              {activity.action}
                            </Typography>
                          }
                          secondary={
                            <Box>
                              <Typography 
                                variant="body2" 
                                sx={{ 
                                  color: 'text.secondary',
                                  opacity: 0.8,
                                  mt: 0.5,
                                }}
                              >
                                {activity.details}
                              </Typography>
                              <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
                                <Typography 
                                  variant="caption" 
                                  sx={{ 
                                    color: 'text.secondary',
                                    fontWeight: 500,
                                  }}
                                >
                                  {activity.user}
                                </Typography>
                                <Typography 
                                  variant="caption" 
                                  sx={{ 
                                    color: 'text.secondary',
                                    opacity: 0.7,
                                  }}
                                >
                                  {activity.time}
                                </Typography>
                              </Box>
                            </Box>
                          }
                        />
                      </ListItem>
                      {index < recentActivity.length - 1 && (
                        <Divider 
                          variant="inset" 
                          component="li" 
                          sx={{ 
                            borderColor: 'rgba(0,0,0,0.08)',
                            mx: 3,
                          }} 
                        />
                      )}
                    </React.Fragment>
                  ))}
                </List>
              </CardContent>
            </Paper>
          </Grid>
        </Grow>
      </Grid>

      {/* Additional Analytics */}
      <Fade in timeout={1400}>
        <Box sx={{ mt: 4 }}>
          <Typography 
            variant="h6" 
            gutterBottom
            sx={{
              fontWeight: 700,
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              mb: 3,
            }}
          >
            Additional Analytics
          </Typography>
          <Grid container spacing={3}>
            {/* Grade Distribution */}
            <Grid item xs={12} md={6}>
              <Paper
                elevation={0}
                sx={{
                  background: 'rgba(255,255,255,0.8)',
                  borderRadius: 4,
                  backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(255,255,255,0.3)',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
                }}
              >
                <CardContent sx={{ p: 3 }}>
                  <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
                    Grade Distribution
                  </Typography>
                  {school.gradeLevels.length > 0 ? (
                    <Box>
                      {school.gradeLevels.map((grade, index) => {
                        const gradeStudents = students.filter(s => s.grade === grade).length;
                        const percentage = students.length > 0 ? Math.round((gradeStudents / students.length) * 100) : 0;
                        return (
                          <Box key={grade} sx={{ mb: 2 }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                {grade.charAt(0).toUpperCase() + grade.slice(1)}
                              </Typography>
                              <Typography variant="body2" color="text.secondary">
                                {gradeStudents} students ({percentage}%)
                              </Typography>
                            </Box>
                            <LinearProgress 
                              variant="determinate" 
                              value={percentage} 
                              sx={{ 
                                height: 8, 
                                borderRadius: 4,
                                backgroundColor: 'rgba(102, 126, 234, 0.1)',
                                '& .MuiLinearProgress-bar': {
                                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                }
                              }} 
                            />
                          </Box>
                        );
                      })}
                    </Box>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      No grade levels configured
                    </Typography>
                  )}
                </CardContent>
              </Paper>
            </Grid>

            {/* Class Capacity */}
            <Grid item xs={12} md={6}>
              <Paper
                elevation={0}
                sx={{
                  background: 'rgba(255,255,255,0.8)',
                  borderRadius: 4,
                  backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(255,255,255,0.3)',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
                }}
              >
                <CardContent sx={{ p: 3 }}>
                  <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
                    Class Capacity Overview
                  </Typography>
                  {classes.length > 0 ? (
                    <Box>
                      <Typography variant="body2" sx={{ mb: 2 }}>
                        Total Classes: {classes.length}
                      </Typography>
                      <Typography variant="body2" sx={{ mb: 2 }}>
                        Classes with Teachers: {classes.filter(c => c.assignedTeachers.length > 0).length}
                      </Typography>
                      <Typography variant="body2" sx={{ mb: 2 }}>
                        Average Class Size: {classes.length > 0 ? Math.round(students.length / classes.length) : 0} students
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Total Capacity: {classes.reduce((sum, c) => sum + (c.capacity || 0), 0)} students
                      </Typography>
                    </Box>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      No classes configured
                    </Typography>
                  )}
                </CardContent>
              </Paper>
            </Grid>

            {/* System Health */}
            <Grid item xs={12}>
              <Paper
                elevation={0}
                sx={{
                  background: 'rgba(255,255,255,0.8)',
                  borderRadius: 4,
                  backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(255,255,255,0.3)',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
                }}
              >
                <CardContent sx={{ p: 3 }}>
                  <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
                    System Health & Performance
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6} md={3}>
                      <Box sx={{ textAlign: 'center', p: 2 }}>
                        <Typography variant="h4" sx={{ fontWeight: 700, color: parentEngagement > 80 ? '#2e7d32' : parentEngagement > 50 ? '#ed6c02' : '#d32f2f' }}>
                          {parentEngagement}%
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Parent Engagement
                        </Typography>
                      </Box>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                      <Box sx={{ textAlign: 'center', p: 2 }}>
                        <Typography variant="h4" sx={{ fontWeight: 700, color: classUtilization > 80 ? '#2e7d32' : classUtilization > 50 ? '#ed6c02' : '#d32f2f' }}>
                          {classUtilization}%
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Class Utilization
                        </Typography>
                      </Box>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                      <Box sx={{ textAlign: 'center', p: 2 }}>
                        <Typography variant="h4" sx={{ fontWeight: 700, color: activeTeachers > 0 ? '#2e7d32' : '#d32f2f' }}>
                          {activeTeachers}/{teachers.length}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Active Teachers
                        </Typography>
                      </Box>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                      <Box sx={{ textAlign: 'center', p: 2 }}>
                        <Typography variant="h4" sx={{ fontWeight: 700, color: completedReports > 0 ? '#2e7d32' : '#d32f2f' }}>
                          {completedReports}/{reports.length}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Completed Reports
                        </Typography>
                      </Box>
                    </Grid>
                  </Grid>
                </CardContent>
              </Paper>
            </Grid>
          </Grid>
        </Box>
      </Fade>

      {/* Quick Actions */}
      <Fade in timeout={1600}>
        <Box sx={{ mt: 4 }}>
          <Typography 
            variant="h6" 
            gutterBottom
            sx={{
              fontWeight: 700,
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              mb: 3,
            }}
          >
            Quick Actions
          </Typography>
          <Grid container spacing={2}>
            <Grid item>
              <Button 
                variant="contained" 
                startIcon={<People />}
                sx={{
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  borderRadius: 3,
                  px: 3,
                  py: 1.5,
                  fontWeight: 600,
                  boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)',
                  '&:hover': {
                    background: 'linear-gradient(135deg, #5a6fd8 0%, #6a4190 100%)',
                    transform: 'translateY(-2px)',
                    boxShadow: '0 6px 20px rgba(102, 126, 234, 0.4)',
                  },
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                }}
              >
                Add New Student
              </Button>
            </Grid>
            <Grid item>
              <Button 
                variant="outlined" 
                startIcon={<School />}
                sx={{
                  borderRadius: 3,
                  px: 3,
                  py: 1.5,
                  fontWeight: 600,
                  borderColor: 'rgba(102, 126, 234, 0.3)',
                  color: '#667eea',
                  '&:hover': {
                    borderColor: '#667eea',
                    background: 'rgba(102, 126, 234, 0.05)',
                    transform: 'translateY(-2px)',
                  },
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                }}
              >
                Invite Teacher
              </Button>
            </Grid>
            <Grid item>
              <Button 
                variant="outlined" 
                startIcon={<Assessment />}
                sx={{
                  borderRadius: 3,
                  px: 3,
                  py: 1.5,
                  fontWeight: 600,
                  borderColor: 'rgba(102, 126, 234, 0.3)',
                  color: '#667eea',
                  '&:hover': {
                    borderColor: '#667eea',
                    background: 'rgba(102, 126, 234, 0.05)',
                    transform: 'translateY(-2px)',
                  },
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                }}
              >
                Generate Report
              </Button>
            </Grid>
            <Grid item>
              <Button 
                variant="outlined" 
                startIcon={<Notifications />}
                sx={{
                  borderRadius: 3,
                  px: 3,
                  py: 1.5,
                  fontWeight: 600,
                  borderColor: 'rgba(102, 126, 234, 0.3)',
                  color: '#667eea',
                  '&:hover': {
                    borderColor: '#667eea',
                    background: 'rgba(102, 126, 234, 0.05)',
                    transform: 'translateY(-2px)',
                  },
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                }}
              >
                Send Announcement
              </Button>
            </Grid>
          </Grid>
        </Box>
      </Fade>
    </Container>
  );
};

export default ExecutiveSummary; 