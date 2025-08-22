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
  Assessment,
  CheckCircle,
  Warning,
  Info,
  Star,
  CalendarToday,
  School,
  Mic,
} from '@mui/icons-material';
import { useData } from '../../../contexts/DataContext';
import { useAuth } from '../../../contexts/AuthContext';

const TeacherOverview: React.FC = () => {
  const { students, reports, teachers, analytics, school, classes, getStudentsByTeacherClasses, getReportsByTeacherStudents } = useData();
  const { user } = useAuth();

  // Get teacher's students using the new helper function
  const teacherStudents = user?.id ? getStudentsByTeacherClasses(user.id) : [];
  const teacherReports = user?.id ? getReportsByTeacherStudents(user.id) : [];

  const completedReports = teacherReports.filter(r => r.status === 'completed');
  const pendingReports = teacherReports.filter(r => r.status === 'draft');

  // Calculate KPIs with dynamic data
  const totalStudents = teacherStudents.length;
  const totalReports = teacherReports.length;
  const completedReportsCount = completedReports.length;
  const pendingReportsCount = pendingReports.length;
  const reportCompletionRate = totalReports > 0 ? Math.round((completedReportsCount / totalReports) * 100) : 0;
  
  // Calculate reports with voice recordings
  const reportsWithAudio = teacherReports.filter(r => r.voiceRecording?.hasRecording || r.voiceRecording?.recordingUrl).length;
  const audioUsageRate = totalReports > 0 ? Math.round((reportsWithAudio / totalReports) * 100) : 0;

  // Calculate recent trends (comparing with previous period - mock for now)
  const previousPeriodReports = Math.floor(totalReports * 0.7); // Simulate 30% growth
  const previousStudents = Math.floor(totalStudents * 0.9); // Simulate 10% growth
  const reportsTrend = totalReports > previousPeriodReports ? 'up' : totalReports < previousPeriodReports ? 'down' : 'stable';
  const studentsTrend = totalStudents > previousStudents ? 'up' : totalStudents < previousStudents ? 'down' : 'stable';
  
  // Calculate changes
  const reportsChange = totalReports - previousPeriodReports;
  const studentsChange = totalStudents - previousStudents;

  const kpis = [
    {
      title: 'My Students',
      value: totalStudents.toString(),
      change: studentsChange > 0 ? `+${studentsChange}` : studentsChange < 0 ? `${studentsChange}` : '0',
      trend: studentsTrend,
      icon: <People />,
      color: '#1976d2',
    },
    {
      title: 'Reports Generated',
      value: totalReports.toString(),
      change: reportsChange > 0 ? `+${reportsChange}` : reportsChange < 0 ? `${reportsChange}` : '0',
      trend: reportsTrend,
      icon: <Assessment />,
      color: '#2e7d32',
    },
    {
      title: 'Completed Reports',
      value: completedReportsCount.toString(),
      change: completedReportsCount > 0 ? `${Math.round((completedReportsCount / totalReports) * 100)}%` : '0%',
      trend: completedReportsCount > pendingReportsCount ? 'up' : completedReportsCount < pendingReportsCount ? 'down' : 'stable',
      icon: <CheckCircle />,
      color: '#ed6c02',
    },
    {
      title: 'Audio Usage',
      value: `${audioUsageRate}%`,
      change: reportsWithAudio > 0 ? `${reportsWithAudio} reports` : 'None',
      trend: audioUsageRate > 50 ? 'up' : audioUsageRate > 20 ? 'stable' : 'down',
      icon: <Mic />,
      color: '#9c27b0',
    },
  ];

  // Dynamic insights based on real data
  const getInsights = () => {
    const insights = [];

    // Student assignment insight
    if (totalStudents === 0) {
      insights.push({
        type: 'info',
        title: 'No Students Assigned',
        description: 'Contact your school admin to get assigned to classes, or wait for students to be enrolled.',
        icon: <People />,
      });
    } else if (totalStudents < 5) {
      insights.push({
        type: 'info',
        title: 'Small Class Size',
        description: `You have ${totalStudents} students. Perfect for personalized attention and detailed reporting.`,
        icon: <People />,
      });
    } else if (totalStudents > 20) {
      insights.push({
        type: 'warning',
        title: 'Large Class Size',
        description: `You have ${totalStudents} students. Consider using audio recording for efficient report generation.`,
        icon: <People />,
      });
    } else {
      insights.push({
        type: 'success',
        title: 'Optimal Class Size',
        description: `You have ${totalStudents} students. Great balance for quality education and report management.`,
        icon: <People />,
      });
    }

    // Report progress insight
    if (totalReports === 0) {
      insights.push({
        type: 'info',
        title: 'Ready to Start',
        description: 'Begin creating reports for your students. Use voice recording to make the process faster.',
        icon: <Assessment />,
      });
    } else if (reportCompletionRate < 30) {
      insights.push({
        type: 'warning',
        title: 'Reports Need Attention',
        description: `${pendingReportsCount} reports are pending. Complete them to keep parents informed.`,
        icon: <Warning />,
      });
    } else if (reportCompletionRate > 80) {
      insights.push({
        type: 'success',
        title: 'Excellent Progress',
        description: `${reportCompletionRate}% completion rate! Your dedication to student reporting is outstanding.`,
        icon: <CheckCircle />,
      });
    } else {
      insights.push({
        type: 'info',
        title: 'Good Progress',
        description: `${reportCompletionRate}% completion rate. ${pendingReportsCount} reports remaining.`,
        icon: <Assessment />,
      });
    }

    // Audio usage insight
    if (reportsWithAudio === 0 && totalReports > 0) {
      insights.push({
        type: 'info',
        title: 'Try Audio Recording',
        description: 'Voice recording can speed up report creation by 3x. Give it a try!',
        icon: <Mic />,
      });
    } else if (audioUsageRate > 70) {
      insights.push({
        type: 'success',
        title: 'Audio Recording Master',
        description: `${audioUsageRate}% of your reports use audio. You're maximizing efficiency!`,
        icon: <Mic />,
      });
    } else if (audioUsageRate > 30) {
      insights.push({
        type: 'info',
        title: 'Audio Adoption',
        description: `${reportsWithAudio} reports use audio recording. Consider using it more for faster creation.`,
        icon: <Mic />,
      });
    }

    return insights.slice(0, 3); // Limit to 3 insights
  };

  const insights = getInsights();

  // Dynamic recent activity based on real data
  const getRecentActivity = () => {
    const activities = [];

    // Sort reports by creation date to get recent ones
    const sortedReports = [...teacherReports].sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    // Recent reports (last 3)
    const recentReports = sortedReports.slice(0, 3);
    
    recentReports.forEach(report => {
      const createdDate = new Date(report.createdAt);
      const now = new Date();
      const diffTime = Math.abs(now.getTime() - createdDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      let timeAgo;
      if (diffDays === 0) {
        timeAgo = 'Today';
      } else if (diffDays === 1) {
        timeAgo = 'Yesterday';
      } else if (diffDays < 7) {
        timeAgo = `${diffDays} days ago`;
      } else if (diffDays < 30) {
        timeAgo = `${Math.floor(diffDays / 7)} week${Math.floor(diffDays / 7) > 1 ? 's' : ''} ago`;
      } else {
        timeAgo = `${Math.floor(diffDays / 30)} month${Math.floor(diffDays / 30) > 1 ? 's' : ''} ago`;
      }

      // Get student name
      const student = teacherStudents.find(s => s._id === report.studentId || s._id === (report.studentId as any)?._id);
      const studentName = student ? `${student.firstName} ${student.lastName}` : 'Unknown Student';

      activities.push({
        action: report.status === 'completed' ? 'Report completed' : 'Report created',
        details: `${report.status === 'completed' ? 'Finished' : 'Created'} report for ${studentName}${report.voiceRecording?.hasRecording ? ' (with audio)' : ''}`,
        time: timeAgo,
        user: 'You',
      });
    });

    // Class assignments if available
    if (teacherStudents.length > 0) {
      activities.push({
        action: 'Class assignments',
        details: `Currently teaching ${teacherStudents.length} student${teacherStudents.length > 1 ? 's' : ''} across ${classes.filter(c => c.assignedTeachers.some(at => at.teacherId._id === user?.id)).length} class${classes.filter(c => c.assignedTeachers.some(at => at.teacherId._id === user?.id)).length > 1 ? 'es' : ''}`,
        time: 'Active',
        user: 'School Admin',
      });
    }

    // Audio usage milestone
    if (reportsWithAudio >= 5) {
      activities.push({
        action: 'Audio milestone',
        details: `Used voice recording in ${reportsWithAudio} reports - great efficiency!`,
        time: 'Recent',
        user: 'System',
      });
    }

    // Pending reports reminder
    if (pendingReportsCount > 0) {
      activities.push({
        action: 'Pending reports',
        details: `${pendingReportsCount} report${pendingReportsCount > 1 ? 's' : ''} waiting to be completed`,
        time: 'Current',
        user: 'Reminder',
      });
    }

    // Limit to 4 most relevant activities
    return activities.slice(0, 4);
  };

  const recentActivity = getRecentActivity();

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
            Teacher Overview
          </Typography>
          <Typography 
            variant="body1" 
            sx={{ 
              color: 'text.secondary',
              opacity: 0.8,
              fontWeight: 500,
            }}
          >
            Welcome back, {user?.firstName}! Here's your teaching dashboard overview.
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
                        color="text.secondary"
                        sx={{ fontWeight: 500 }}
                      >
                        {kpi.title}
                      </Typography>
                    </Box>
                    <Box sx={{ textAlign: 'right' }}>
                      <Chip
                        label={kpi.change}
                        size="small"
                        icon={
                          kpi.trend === 'up' ? <TrendingUp /> : 
                          kpi.trend === 'down' ? <TrendingDown /> : 
                          <TrendingUp style={{ transform: 'rotate(90deg)' }} />
                        }
                        sx={{
                          backgroundColor: 
                            kpi.trend === 'up' ? 'rgba(76, 175, 80, 0.1)' : 
                            kpi.trend === 'down' ? 'rgba(244, 67, 54, 0.1)' : 
                            'rgba(158, 158, 158, 0.1)',
                          color: 
                            kpi.trend === 'up' ? '#4caf50' : 
                            kpi.trend === 'down' ? '#f44336' : 
                            '#9e9e9e',
                          fontWeight: 600,
                        }}
                      />
                    </Box>
                  </Box>
                </CardContent>
              </Paper>
            </Grid>
          </Grow>
        ))}
      </Grid>

      {/* Insights and Activity */}
      <Grid container spacing={3}>
        {/* Insights */}
        <Grid item xs={12} md={6}>
          <Grow in timeout={1000}>
            <Paper
              elevation={0}
              sx={{
                background: 'rgba(255,255,255,0.8)',
                borderRadius: 4,
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(255,255,255,0.3)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
                height: '100%',
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
                  Insights & Recommendations
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
                              bgcolor: insight.type === 'success' ? '#4caf50' : 
                                     insight.type === 'warning' ? '#ff9800' : '#2196f3',
                              width: 32,
                              height: 32,
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
          </Grow>
        </Grid>

        {/* Recent Activity */}
        <Grid item xs={12} md={6}>
          <Grow in timeout={1200}>
            <Paper
              elevation={0}
              sx={{
                background: 'rgba(255,255,255,0.8)',
                borderRadius: 4,
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(255,255,255,0.3)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
                height: '100%',
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
          </Grow>
        </Grid>
      </Grid>


    </Container>
  );
};

export default TeacherOverview; 