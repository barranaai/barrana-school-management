import React from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Divider,
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
  Mic,
} from '@mui/icons-material';
import { useData } from '../../../contexts/DataContext';
import { useAuth } from '../../../contexts/AuthContext';
import { themeColors } from '../../../theme/teacherTheme';
import NotificationIcon from '../../common/NotificationIcon';

export interface TeacherOverviewProps {
  schoolBranding?: any;
}

const TeacherOverview: React.FC<TeacherOverviewProps> = ({ schoolBranding }) => {
  // Card background colors array
  const cardColors = themeColors.cardColors;
  
  // Helper function to get a random card color
  const getRandomCardColor = (index?: number) => {
    if (index !== undefined) {
      return cardColors[index % cardColors.length];
    }
    return cardColors[Math.floor(Math.random() * cardColors.length)];
  };

  // Helper function to get a darker version of the card color
  const getDarkerColor = (hex: string): string => {
    // Remove # if present
    hex = hex.replace('#', '');
    
    // Convert to RGB
    let r = parseInt(hex.substring(0, 2), 16);
    let g = parseInt(hex.substring(2, 4), 16);
    let b = parseInt(hex.substring(4, 6), 16);
    
    // Convert RGB to HSL
    r /= 255;
    g /= 255;
    b /= 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0, s = 0, l = (max + min) / 2;
    
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      
      switch (max) {
        case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
        case g: h = ((b - r) / d + 2) / 6; break;
        case b: h = ((r - g) / d + 4) / 6; break;
      }
    }
    
    // Keep same saturation, just reduce lightness for darker version
    l = l * 0.4; // Make it 40% of original lightness (darker)
    
    // Convert back to RGB
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };
    
    let newR, newG, newB;
    if (s === 0) {
      newR = newG = newB = l;
    } else {
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      newR = hue2rgb(p, q, h + 1/3);
      newG = hue2rgb(p, q, h);
      newB = hue2rgb(p, q, h - 1/3);
    }
    
    // Convert to hex
    const toHex = (x: number) => Math.round(x * 255).toString(16).padStart(2, '0');
    return `#${toHex(newR)}${toHex(newG)}${toHex(newB)}`;
  };
  const { classes, getStudentsByTeacherClasses, getReportsByTeacherStudents } = useData();
  const { user } = useAuth();
  
  const [dueReportsCount, setDueReportsCount] = React.useState(0);
  const [, setLoading] = React.useState(true);

  // Get teacher's students using the new helper function
  const teacherStudents = user?.id ? getStudentsByTeacherClasses(user.id) : [];
  const teacherReports = user?.id ? getReportsByTeacherStudents(user.id) : [];
  
  // Fetch due reports count automatically
  React.useEffect(() => {
    const fetchDueReportsCount = async () => {
      try {
        setLoading(true);
        // Get notifications from user which contain due reports
        const response = await fetch('/api/teachers/me/notifications', {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.data?.notifications) {
            // Count unread notifications with type 'report_due'
            const dueCount = data.data.notifications.filter((notif: any) => 
              notif.type === 'report_due' && !notif.read
            ).length;
            setDueReportsCount(dueCount);
          }
        }
      } catch (error) {
        console.error('Error fetching due reports:', error);
      } finally {
        setLoading(false);
      }
    };

    if (user?.id) {
      fetchDueReportsCount();
      // Refresh every 5 minutes
      const interval = setInterval(fetchDueReportsCount, 5 * 60 * 1000);
      return () => clearInterval(interval);
    }
  }, [user?.id]);

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
      title: 'Due Reports',
      value: dueReportsCount.toString(),
      change: dueReportsCount > 0 ? `${dueReportsCount} overdue` : 'All clear',
      trend: dueReportsCount > 0 ? 'down' : 'up',
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
      {/* School Banner */}
      {schoolBranding && (() => {
        // Use school branding colors if available, otherwise use fallback colors
        const primaryColor = schoolBranding.branding?.primaryColor || schoolBranding.primaryColor || '#273890';
        const secondaryColor = schoolBranding.branding?.secondaryColor || schoolBranding.secondaryColor || '#7f0f4a';
        
        return (
          <Card sx={{ 
            mb: 3,
            mt: 2,
            background: `linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%)`,
            borderRadius: '16px !important',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            overflow: 'hidden',
            position: 'relative',
          }}>
            <CardContent sx={{ p: 4 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 3 }}>
                {/* Left Side - School Info */}
                <Box sx={{ flex: 1, minWidth: '300px' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                    <Typography variant="h4" sx={{ 
                      fontWeight: 700, 
                      color: 'white',
                      textShadow: '0 2px 4px rgba(0,0,0,0.2)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                    }}>
                      {schoolBranding.schoolName || schoolBranding.name || 'School Name'}
                    </Typography>
                    {schoolBranding.established && (
                      <Chip 
                        label={`Estd: ${schoolBranding.established}`}
                        sx={{ 
                          bgcolor: 'rgba(255,255,255,0.3)',
                          color: 'white',
                          fontWeight: 600,
                          height: '32px',
                        }}
                      />
                    )}
                  </Box>
                  
                  {/* Contact Information */}
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {schoolBranding.address && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="body2" sx={{ color: 'white', opacity: 0.95, display: 'flex', alignItems: 'center', gap: 1 }}>
                          📍 {typeof schoolBranding.address === 'string' ? schoolBranding.address : [schoolBranding.address?.street, schoolBranding.address?.city, schoolBranding.address?.state, schoolBranding.address?.zipCode, schoolBranding.address?.country].filter(Boolean).join(', ')}
                        </Typography>
                      </Box>
                    )}
                    {schoolBranding.email && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="body2" sx={{ color: 'white', opacity: 0.95, display: 'flex', alignItems: 'center', gap: 1 }}>
                          ✉️ {schoolBranding.email}
                        </Typography>
                      </Box>
                    )}
                    {schoolBranding.phone && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="body2" sx={{ color: 'white', opacity: 0.95, display: 'flex', alignItems: 'center', gap: 1 }}>
                          📞 {schoolBranding.phone}
                        </Typography>
                      </Box>
                    )}
                  </Box>
                </Box>

                {/* Right Side - School Logo */}
                {schoolBranding.logo && (() => {
                  const logoUrl = schoolBranding.logo.startsWith('http://') || schoolBranding.logo.startsWith('https://') 
                    ? schoolBranding.logo 
                    : `${(process.env.REACT_APP_API_URL || 'http://localhost:5050').replace('/api', '')}${schoolBranding.logo.startsWith('/') ? schoolBranding.logo : '/' + schoolBranding.logo}`;
                  return (
                    <Box sx={{ 
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      minWidth: '120px',
                    }}>
                      <Box sx={{
                        bgcolor: 'rgba(255,255,255,0.95)',
                        borderRadius: 3,
                        p: 2,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                        minWidth: '140px',
                        minHeight: '140px',
                        maxWidth: '180px',
                        maxHeight: '180px',
                      }}>
                        <Box
                          component="img"
                          src={logoUrl}
                          alt={schoolBranding.schoolName || schoolBranding.name || 'School Logo'}
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                          sx={{
                            maxWidth: '100%',
                            maxHeight: '100%',
                            objectFit: 'contain',
                          }}
                        />
                      </Box>
                    </Box>
                  );
                })()}
              </Box>
            </CardContent>
          </Card>
        );
      })()}

      {/* Header */}
      <Fade in timeout={800}>
        <Box sx={{ mb: 4, mt: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Typography variant="h4" sx={{ 
            fontWeight: 700, 
            mb: 3, 
            textTransform: 'capitalize',
            background: schoolBranding 
              ? `linear-gradient(135deg, ${schoolBranding.branding?.primaryColor || schoolBranding.primaryColor || '#667eea'} 0%, ${schoolBranding.branding?.secondaryColor || schoolBranding.secondaryColor || '#764ba2'} 100%)`
              : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            backgroundClip: 'text',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            textShadow: '0 2px 4px rgba(0,0,0,0.1)',
          }}>
            Welcome Back, {user?.firstName}!
          </Typography>
          <NotificationIcon />
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
                  background: `linear-gradient(135deg, ${getRandomCardColor(index)} 0%, ${getRandomCardColor(index)}f0 100%)`,
                  borderRadius: 4,
                  border: '1px solid rgba(255, 255, 255, 0.8)',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.04)',
                  transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                  position: 'relative',
                  overflow: 'hidden',
                  '&:hover': {
                    transform: 'translateY(-8px)',
                    boxShadow: '0 20px 48px rgba(0,0,0,0.15), 0 4px 16px rgba(0,0,0,0.08)',
                    border: '1px solid rgba(255, 255, 255, 1)',
                  },
                  // Subtle glass effect
                  backdropFilter: 'blur(10px)',
                  // Shine effect on hover
                  '&::after': {
                    content: '""',
                    position: 'absolute',
                    top: 0,
                    left: '-100%',
                    width: '50%',
                    height: '100%',
                    background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)',
                    transition: 'left 0.5s ease-in-out',
                  },
                  '&:hover::after': {
                    left: '150%',
                  },
                }}
              >
                <CardContent sx={{ p: 4, position: 'relative', zIndex: 1, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '200px' }}>
                  {/* Top Section - Icon and Trend */}
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
                    <Box
                      sx={{
                        width: 56,
                        height: 56,
                        borderRadius: '16px',
                        background: (() => {
                          const cardColor = getRandomCardColor(index);
                          const darkerColor = getDarkerColor(cardColor);
                          return `linear-gradient(135deg, ${darkerColor} 0%, ${darkerColor}dd 100%)`;
                        })(),
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: (() => {
                          const cardColor = getRandomCardColor(index);
                          const darkerColor = getDarkerColor(cardColor);
                          return `0 8px 24px ${darkerColor}40`;
                        })(),
                        transition: 'all 0.3s ease-in-out',
                        '&:hover': {
                          transform: 'scale(1.05) rotate(-5deg)',
                          boxShadow: (() => {
                            const cardColor = getRandomCardColor(index);
                            const darkerColor = getDarkerColor(cardColor);
                            return `0 12px 32px ${darkerColor}60`;
                          })(),
                        },
                      }}
                    >
                      {React.cloneElement(kpi.icon, { 
                        sx: { fontSize: '1.8rem', color: 'white' }
                      })}
                    </Box>
                    
                    {/* Trend Badge - Top Right */}
                    <Chip
                      label={kpi.change}
                      size="small"
                      icon={
                        kpi.trend === 'up' ? <TrendingUp sx={{ fontSize: '0.9rem !important' }} /> : 
                        kpi.trend === 'down' ? <TrendingDown sx={{ fontSize: '0.9rem !important' }} /> : 
                        <TrendingUp sx={{ transform: 'rotate(90deg)', fontSize: '0.9rem !important' }} />
                      }
                      sx={{
                        backgroundColor: 
                          kpi.trend === 'up' ? 'rgba(76, 175, 80, 0.15)' : 
                          kpi.trend === 'down' ? 'rgba(244, 67, 54, 0.15)' : 
                          'rgba(158, 158, 158, 0.15)',
                        color: 
                          kpi.trend === 'up' ? '#2e7d32' : 
                          kpi.trend === 'down' ? '#c62828' : 
                          '#616161',
                        fontWeight: 600,
                        fontSize: '0.75rem',
                        height: '26px',
                        borderRadius: '8px',
                        border: 
                          kpi.trend === 'up' ? '1px solid rgba(76, 175, 80, 0.3)' : 
                          kpi.trend === 'down' ? '1px solid rgba(244, 67, 54, 0.3)' : 
                          '1px solid rgba(158, 158, 158, 0.3)',
                        '& .MuiChip-icon': {
                          color: 
                            kpi.trend === 'up' ? '#2e7d32' : 
                            kpi.trend === 'down' ? '#c62828' : 
                            '#616161',
                          marginLeft: '4px',
                        },
                        '& .MuiChip-label': {
                          paddingLeft: '4px',
                          paddingRight: '8px',
                        },
                      }}
                    />
                  </Box>
                  
                  {/* Bottom Section - Metric and Title */}
                  <Box>
                    <Typography 
                      variant="h2" 
                      component="div"
                      sx={{ 
                        fontWeight: 800,
                        color: '#1A1A1A',
                        mb: 0.5,
                        fontSize: '3rem',
                        lineHeight: 1,
                        letterSpacing: '-0.03em',
                      }}
                    >
                      {kpi.value}
                    </Typography>
                    
                    <Typography 
                      variant="body2" 
                      sx={{ 
                        color: '#6B6B6B',
                        fontWeight: 600,
                        fontSize: '0.875rem',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                      }}
                    >
                      {kpi.title}
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
        {/* Insights */}
        <Grid item xs={12} md={6}>
          <Grow in timeout={1000}>
            <Paper
              elevation={0}
              sx={{
                background: `linear-gradient(135deg, ${getRandomCardColor(2)} 0%, ${getRandomCardColor(2)}f0 100%)`,
                borderRadius: 4,
                border: '1px solid rgba(255, 255, 255, 0.8)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.04)',
                height: '100%',
                transition: 'all 0.3s ease-in-out',
                backdropFilter: 'blur(10px)',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: '0 16px 48px rgba(0,0,0,0.12), 0 4px 16px rgba(0,0,0,0.06)',
                  border: '1px solid rgba(255, 255, 255, 1)',
                },
              }}
            >
              <CardContent sx={{ p: 4 }}>
                <Typography 
                  variant="h5" 
                  gutterBottom
                  sx={{
                    fontWeight: 700,
                    color: '#1A1A1A',
                    mb: 3,
                    fontSize: '1.5rem',
                    letterSpacing: '-0.01em',
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
                          borderRadius: 3,
                          mb: 1.5,
                          bgcolor: themeColors.nested,
                          border: '1px solid rgba(255, 255, 255, 0.6)',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                          '&:hover': {
                            background: 'rgba(102, 126, 234, 0.08)',
                            transform: 'translateX(4px)',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                          },
                          transition: 'all 0.3s ease-in-out',
                          p: 2,
                        }}
                      >
                        <ListItemAvatar>
                          <Box
                            sx={{
                              width: 44,
                              height: 44,
                              borderRadius: '12px',
                              background: (() => {
                                const cardColor = getRandomCardColor(2);
                                const darkerColor = getDarkerColor(cardColor);
                                return `linear-gradient(135deg, ${darkerColor} 0%, ${darkerColor}dd 100%)`;
                              })(),
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              boxShadow: (() => {
                                const cardColor = getRandomCardColor(2);
                                const darkerColor = getDarkerColor(cardColor);
                                return `0 4px 12px ${darkerColor}40`;
                              })(),
                              transition: 'all 0.3s ease-in-out',
                              '&:hover': {
                                transform: 'rotate(5deg) scale(1.1)',
                                boxShadow: (() => {
                                  const cardColor = getRandomCardColor(2);
                                  const darkerColor = getDarkerColor(cardColor);
                                  return `0 6px 16px ${darkerColor}60`;
                                })(),
                              },
                            }}
                          >
                            {React.cloneElement(insight.icon, { 
                              sx: { fontSize: '1.4rem', color: 'white' }
                            })}
                          </Box>
                        </ListItemAvatar>
                        <ListItemText
                          primary={
                            <Typography 
                              variant="subtitle2" 
                              sx={{ 
                                fontWeight: 700,
                                color: '#1A1A1A',
                                fontSize: '0.95rem',
                                mb: 0.5,
                              }}
                            >
                              {insight.title}
                            </Typography>
                          }
                          secondary={
                            <Typography 
                              variant="body2" 
                              sx={{ 
                                color: '#6B6B6B',
                                fontSize: '0.85rem',
                                lineHeight: 1.6,
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
                background: `linear-gradient(135deg, ${getRandomCardColor(3)} 0%, ${getRandomCardColor(3)}f0 100%)`,
                borderRadius: 4,
                border: '1px solid rgba(255, 255, 255, 0.8)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.04)',
                height: '100%',
                transition: 'all 0.3s ease-in-out',
                backdropFilter: 'blur(10px)',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: '0 16px 48px rgba(0,0,0,0.12), 0 4px 16px rgba(0,0,0,0.06)',
                  border: '1px solid rgba(255, 255, 255, 1)',
                },
              }}
            >
              <CardContent sx={{ p: 4 }}>
                <Typography 
                  variant="h5" 
                  gutterBottom
                  sx={{
                    fontWeight: 700,
                    color: '#1A1A1A',
                    mb: 3,
                    fontSize: '1.5rem',
                    letterSpacing: '-0.01em',
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
                          borderRadius: 3,
                          mb: 1.5,
                          bgcolor: themeColors.nested,
                          border: '1px solid rgba(255, 255, 255, 0.6)',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                          '&:hover': {
                            background: 'rgba(102, 126, 234, 0.08)',
                            transform: 'translateX(4px)',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                          },
                          transition: 'all 0.3s ease-in-out',
                          p: 2,
                        }}
                      >
                        <ListItemText
                          primary={
                            <Typography 
                              variant="subtitle2" 
                              sx={{ 
                                fontWeight: 700,
                                color: '#1A1A1A',
                                fontSize: '0.95rem',
                                mb: 0.5,
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
                                  color: '#6B6B6B',
                                  fontSize: '0.85rem',
                                  lineHeight: 1.6,
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