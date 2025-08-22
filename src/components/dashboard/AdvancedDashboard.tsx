import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Chip,
  Avatar,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Divider,
  Button,
  Alert,
  CircularProgress,
  Badge,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  TrendingUp,
  TrendingDown,
  Notifications,
  Refresh,
  Settings,
  Analytics,
  Psychology,
  Timeline,
  People,
  School,
  Assessment,
  Speed,
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import analyticsService, { AnalyticsData, PerformanceMetrics, PredictiveInsights } from '../../services/analyticsService';
import realtimeService, { RealtimeEvent, SystemStatus } from '../../services/realtimeService';
import aiService, { AIInsight } from '../../services/aiService';
import { useData } from '../../contexts/DataContext';

const AdvancedDashboard: React.FC = () => {
  const { user } = useAuth();
  const { students } = useData();
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [performance, setPerformance] = useState<PerformanceMetrics | null>(null);
  const [insights, setInsights] = useState<AIInsight[]>([]);
  const [predictions, setPredictions] = useState<PredictiveInsights | null>(null);
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [realtimeEvents, setRealtimeEvents] = useState<RealtimeEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  useEffect(() => {
    loadDashboardData();
    setupRealtimeUpdates();
    
    // Refresh data every 5 minutes
    const interval = setInterval(() => {
      loadDashboardData();
    }, 300000);

    return () => {
      clearInterval(interval);
      realtimeService.disconnect();
    };
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      
      // Load all dashboard data in parallel
      const [
        analyticsData,
        performanceData,
        insightsData,
        predictionsData,
        statusData
      ] = await Promise.all([
        analyticsService.getDashboardAnalytics(),
        analyticsService.getPerformanceMetrics(),
        aiService.getStudentInsights(students[0]?._id || ''),
        analyticsService.getPredictiveInsights(),
        realtimeService.getSystemStatus()
      ]);

      setAnalytics(analyticsData);
      setPerformance(performanceData);
      setInsights(insightsData);
      setPredictions(predictionsData);
      setSystemStatus(statusData);
      setLastUpdate(new Date());
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const setupRealtimeUpdates = async () => {
    if (user?.id) {
      await realtimeService.connect(user.id);
      
      // Subscribe to real-time events
      realtimeService.subscribe('notification', (event) => {
        setRealtimeEvents(prev => [event, ...prev.slice(0, 4)]);
      });
      
      realtimeService.subscribe('system', (event) => {
        if (event.data.type === 'status_update') {
          setSystemStatus(event.data.status);
        }
      });
    }
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat().format(num);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return 'success';
      case 'offline': return 'error';
      case 'maintenance': return 'warning';
      default: return 'default';
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h4" gutterBottom>
            Advanced Dashboard
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Real-time insights and AI-powered analytics
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <Chip
            icon={<Speed />}
            label={`Last updated: ${lastUpdate.toLocaleTimeString()}`}
            variant="outlined"
            size="small"
          />
          <Button
            startIcon={<Refresh />}
            onClick={loadDashboardData}
            variant="outlined"
            size="small"
          >
            Refresh
          </Button>
        </Box>
      </Box>

      {/* System Status */}
      {systemStatus && (
        <Alert 
          severity={getStatusColor(systemStatus.status) as any}
          sx={{ mb: 3 }}
          action={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="caption">
                {systemStatus.activeUsers} active users
              </Typography>
              <Typography variant="caption">
                Load: {(systemStatus.systemLoad * 100).toFixed(1)}%
              </Typography>
            </Box>
          }
        >
          System Status: {systemStatus.status.toUpperCase()} | Uptime: {Math.floor(systemStatus.uptime / 3600)}h {(systemStatus.uptime % 3600) / 60}m
        </Alert>
      )}

      {/* Real-time Events */}
      {realtimeEvents.length > 0 && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Recent Activity
            </Typography>
            <List dense>
              {realtimeEvents.map((event, index) => (
                <ListItem key={event.id}>
                  <ListItemAvatar>
                    <Avatar sx={{ bgcolor: 'primary.main', width: 32, height: 32 }}>
                      <Notifications fontSize="small" />
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={event.data.title || event.type}
                    secondary={event.data.message || event.data.preview}
                  />
                  <Typography variant="caption" color="text.secondary">
                    {new Date(event.timestamp).toLocaleTimeString()}
                  </Typography>
                </ListItem>
              ))}
            </List>
          </CardContent>
        </Card>
      )}

      {/* Key Metrics */}
      {analytics && (
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <Avatar sx={{ bgcolor: 'primary.main', mr: 2 }}>
                    <People />
                  </Avatar>
                  <Box>
                    <Typography variant="h4">{formatNumber(analytics.students.total)}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Total Students
                    </Typography>
                  </Box>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <TrendingUp sx={{ color: 'success.main', mr: 1 }} />
                  <Typography variant="body2" color="success.main">
                    +{analytics.students.growthRate}% growth
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <Avatar sx={{ bgcolor: 'success.main', mr: 2 }}>
                    <School />
                  </Avatar>
                  <Box>
                    <Typography variant="h4">{analytics.teachers.total}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Active Teachers
                    </Typography>
                  </Box>
                </Box>
                <Typography variant="body2" color="text.secondary">
                  {analytics.teachers.averageReportsPerTeacher.toFixed(1)} avg reports/teacher
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <Avatar sx={{ bgcolor: 'warning.main', mr: 2 }}>
                    <Assessment />
                  </Avatar>
                  <Box>
                    <Typography variant="h4">{formatNumber(analytics.reports.total)}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Reports Generated
                    </Typography>
                  </Box>
                </Box>
                <Typography variant="body2" color="text.secondary">
                  {analytics.reports.aiAccuracy}% AI accuracy
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <Avatar sx={{ bgcolor: 'secondary.main', mr: 2 }}>
                    <Analytics />
                  </Avatar>
                  <Box>
                    <Typography variant="h4">{analytics.engagement.parentLoginRate}%</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Parent Engagement
                    </Typography>
                  </Box>
                </Box>
                <Typography variant="body2" color="text.secondary">
                  {analytics.engagement.averageSessionDuration}min avg session
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* AI Insights and Performance */}
      <Grid container spacing={3}>
        {/* AI Insights */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                <Psychology sx={{ mr: 1, color: 'primary.main' }} />
                <Typography variant="h6">AI Insights</Typography>
              </Box>
              <List>
                {insights.slice(0, 3).map((insight, index) => (
                  <React.Fragment key={index}>
                    <ListItem alignItems="flex-start">
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="subtitle2">
                              {insight.title}
                            </Typography>
                            <Chip
                              label={`${(insight.confidence * 100).toFixed(0)}%`}
                              size="small"
                              color={insight.priority === 'high' ? 'error' : 'default'}
                            />
                          </Box>
                        }
                        secondary={
                          <Typography variant="body2" color="text.secondary">
                            {insight.description}
                          </Typography>
                        }
                      />
                    </ListItem>
                    {index < insights.length - 1 && <Divider variant="inset" component="li" />}
                  </React.Fragment>
                ))}
              </List>
            </CardContent>
          </Card>
        </Grid>

        {/* Performance Metrics */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                <Timeline sx={{ mr: 1, color: 'success.main' }} />
                <Typography variant="h6">Academic Performance</Typography>
              </Box>
              {performance?.academicProgress.map((subject, index) => (
                <Box key={index} sx={{ mb: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2">{subject.subject}</Typography>
                    <Typography variant="body2" fontWeight="bold">
                      {subject.averageScore}%
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    {subject.improvement > 0 ? (
                      <TrendingUp sx={{ color: 'success.main', mr: 1, fontSize: 16 }} />
                    ) : (
                      <TrendingDown sx={{ color: 'error.main', mr: 1, fontSize: 16 }} />
                    )}
                    <Typography variant="caption" color={subject.improvement > 0 ? 'success.main' : 'error.main'}>
                      {subject.improvement > 0 ? '+' : ''}{subject.improvement}% from last month
                    </Typography>
                  </Box>
                </Box>
              ))}
            </CardContent>
          </Card>
        </Grid>

        {/* Predictive Insights */}
        {predictions && (
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Predictive Insights
                </Typography>
                <Grid container spacing={3}>
                  {predictions.atRiskStudents.map((student, index) => (
                    <Grid item xs={12} md={6} key={index}>
                      <Alert severity="warning" sx={{ mb: 2 }}>
                        <Typography variant="subtitle2" gutterBottom>
                          {student.studentName} - Risk Level: {Math.round(student.confidence * 100)}%
                        </Typography>
                        <Typography variant="body2">
                          Risk Factors: {student.riskFactors.join(', ')}
                        </Typography>
                      </Alert>
                    </Grid>
                  ))}
                </Grid>
                
                <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
                  Recommended Actions
                </Typography>
                <Grid container spacing={2}>
                  {predictions.recommendedActions.map((action, index) => (
                    <Grid item xs={12} md={4} key={index}>
                      <Card variant="outlined">
                        <CardContent>
                          <Typography variant="subtitle2" gutterBottom>
                            {action.category}
                          </Typography>
                          <Typography variant="body2" color="text.secondary" gutterBottom>
                            {action.action}
                          </Typography>
                          <Box sx={{ display: 'flex', gap: 1 }}>
                            <Chip
                              label={`Impact: ${action.impact}`}
                              size="small"
                              color={action.impact === 'high' ? 'error' : 'default'}
                            />
                            <Chip
                              label={`Effort: ${action.effort}`}
                              size="small"
                              color={action.effort === 'low' ? 'success' : 'default'}
                            />
                          </Box>
                        </CardContent>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              </CardContent>
            </Card>
          </Grid>
        )}
      </Grid>
    </Box>
  );
};

export default AdvancedDashboard; 