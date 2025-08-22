import React, { useState } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  LinearProgress,
  Chip,
  Button,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  Alert,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import {
  TrendingUp,
  TrendingDown,
  Analytics,
  Insights,
  School,
  People,
  Assessment,
  CheckCircle,
  Warning,
  Info,
  Lightbulb,
  Timeline,
  Compare,
  Psychology,
} from '@mui/icons-material';

const AdvancedAnalytics: React.FC = () => {
  const [selectedTimeframe, setSelectedTimeframe] = useState('month');

  // Mock data for analytics
  const predictiveInsights = [
    {
      type: 'growth',
      title: 'Growth Hotspots',
      description: 'Problem Solving skills showing significant positive growth in Grade 4',
      percentage: '+15%',
      trend: 'up',
      icon: <TrendingUp />,
      color: '#2e7d32',
    },
    {
      type: 'intervention',
      title: 'Areas for Targeted Intervention',
      description: 'Self-regulation consistently identified as an area for development in Year 1',
      percentage: '-8%',
      trend: 'down',
      icon: <Warning />,
      color: '#ed6c02',
    },
    {
      type: 'engagement',
      title: 'Parent Engagement Trend',
      description: 'Parent engagement rates expected to reach 97% by next quarter',
      percentage: '+3%',
      trend: 'up',
      icon: <People />,
      color: '#1976d2',
    },
  ];

  const aiRecommendations = [
    {
      category: 'Curriculum Enhancement',
      recommendation: 'Consider a school-wide initiative on emotional literacy for early years',
      impact: 'High',
      effort: 'Medium',
      priority: 'High',
    },
    {
      category: 'Teacher Development',
      recommendation: 'Review numeracy curriculum for Grade 2 based on consistent growth areas',
      impact: 'Medium',
      effort: 'Low',
      priority: 'Medium',
    },
    {
      category: 'Communication Strategy',
      recommendation: 'Implement weekly progress summaries for parents of struggling students',
      impact: 'High',
      effort: 'Low',
      priority: 'High',
    },
  ];

  const trendAnalysis = {
    reportGeneration: {
      current: 3456,
      projected: 3800,
      trend: '+10%',
      confidence: 92,
    },
    parentEngagement: {
      current: 94,
      projected: 97,
      trend: '+3%',
      confidence: 88,
    },
    teacherEfficiency: {
      current: 78,
      projected: 82,
      trend: '+4%',
      confidence: 85,
    },
  };

  const crossGradeComparison = [
    { grade: 'Grade 1', literacy: 85, numeracy: 78, social: 92, physical: 88 },
    { grade: 'Grade 2', literacy: 88, numeracy: 82, social: 89, physical: 85 },
    { grade: 'Grade 3', literacy: 92, numeracy: 87, social: 86, physical: 83 },
    { grade: 'Grade 4', literacy: 89, numeracy: 91, social: 84, physical: 80 },
  ];

  const roiProjections = {
    timeSaved: 120,
    costSavings: 24000,
    efficiencyGain: 35,
    studentCount: 1247,
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" gutterBottom>
          Advanced Analytics & Predictive Insights
        </Typography>
        <Box>
          <Chip
            label="Live Data"
            color="success"
            size="small"
            icon={<Analytics />}
            sx={{ mr: 1 }}
          />
          <Chip
            label="AI-Powered"
            color="primary"
            size="small"
            icon={<Psychology />}
          />
        </Box>
      </Box>

      {/* AI-Generated Executive Summary */}
      <Alert severity="info" sx={{ mb: 3 }}>
        <Typography variant="body1">
          <strong>AI Analysis Summary:</strong> Analysis indicates a strong focus on collaborative learning this term, 
          with positive impacts on peer interaction. Attention span, however, shows slight decline in younger grades, 
          suggesting a need for adjusted activity pacing. Overall school performance is trending positively with 94% 
          parent engagement rate.
        </Typography>
      </Alert>

      {/* Predictive Insights */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12}>
          <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
            <Insights sx={{ mr: 1 }} />
            Predictive Insights
          </Typography>
        </Grid>
        {predictiveInsights.map((insight, index) => (
          <Grid item xs={12} md={4} key={index}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <Box
                    sx={{
                      p: 1,
                      borderRadius: 1,
                      bgcolor: insight.color,
                      color: 'white',
                      mr: 2,
                    }}
                  >
                    {insight.icon}
                  </Box>
                  <Box>
                    <Typography variant="h6">{insight.title}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {insight.percentage} from last period
                    </Typography>
                  </Box>
                </Box>
                <Typography variant="body2">{insight.description}</Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Trend Analysis with Projections */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12}>
          <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
            <Timeline sx={{ mr: 1 }} />
            Trend Analysis & Projections
          </Typography>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Report Generation</Typography>
              <Typography variant="h4" color="primary" gutterBottom>
                {trendAnalysis.reportGeneration.current.toLocaleString()}
              </Typography>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Projected: {trendAnalysis.reportGeneration.projected.toLocaleString()} ({trendAnalysis.reportGeneration.trend})
              </Typography>
              <LinearProgress
                variant="determinate"
                value={trendAnalysis.reportGeneration.confidence}
                sx={{ height: 8, borderRadius: 4 }}
              />
              <Typography variant="caption" color="text.secondary">
                Confidence: {trendAnalysis.reportGeneration.confidence}%
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Parent Engagement</Typography>
              <Typography variant="h4" color="primary" gutterBottom>
                {trendAnalysis.parentEngagement.current}%
              </Typography>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Projected: {trendAnalysis.parentEngagement.projected}% ({trendAnalysis.parentEngagement.trend})
              </Typography>
              <LinearProgress
                variant="determinate"
                value={trendAnalysis.parentEngagement.confidence}
                sx={{ height: 8, borderRadius: 4 }}
              />
              <Typography variant="caption" color="text.secondary">
                Confidence: {trendAnalysis.parentEngagement.confidence}%
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Teacher Efficiency</Typography>
              <Typography variant="h4" color="primary" gutterBottom>
                {trendAnalysis.teacherEfficiency.current}%
              </Typography>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Projected: {trendAnalysis.teacherEfficiency.projected}% ({trendAnalysis.teacherEfficiency.trend})
              </Typography>
              <LinearProgress
                variant="determinate"
                value={trendAnalysis.teacherEfficiency.confidence}
                sx={{ height: 8, borderRadius: 4 }}
              />
              <Typography variant="caption" color="text.secondary">
                Confidence: {trendAnalysis.teacherEfficiency.confidence}%
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Cross-Grade Comparison */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12}>
          <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
            <Compare sx={{ mr: 1 }} />
            Cross-Grade Performance Comparison
          </Typography>
        </Grid>
        <Grid item xs={12}>
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Grade</TableCell>
                  <TableCell align="center">Literacy</TableCell>
                  <TableCell align="center">Numeracy</TableCell>
                  <TableCell align="center">Social Skills</TableCell>
                  <TableCell align="center">Physical Development</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {crossGradeComparison.map((row) => (
                  <TableRow key={row.grade}>
                    <TableCell component="th" scope="row">
                      {row.grade}
                    </TableCell>
                    <TableCell align="center">
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Typography variant="body2" sx={{ mr: 1 }}>
                          {row.literacy}%
                        </Typography>
                        <LinearProgress
                          variant="determinate"
                          value={row.literacy}
                          sx={{ width: 60, height: 6, borderRadius: 3 }}
                        />
                      </Box>
                    </TableCell>
                    <TableCell align="center">
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Typography variant="body2" sx={{ mr: 1 }}>
                          {row.numeracy}%
                        </Typography>
                        <LinearProgress
                          variant="determinate"
                          value={row.numeracy}
                          sx={{ width: 60, height: 6, borderRadius: 3 }}
                        />
                      </Box>
                    </TableCell>
                    <TableCell align="center">
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Typography variant="body2" sx={{ mr: 1 }}>
                          {row.social}%
                        </Typography>
                        <LinearProgress
                          variant="determinate"
                          value={row.social}
                          sx={{ width: 60, height: 6, borderRadius: 3 }}
                        />
                      </Box>
                    </TableCell>
                    <TableCell align="center">
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Typography variant="body2" sx={{ mr: 1 }}>
                          {row.physical}%
                        </Typography>
                        <LinearProgress
                          variant="determinate"
                          value={row.physical}
                          sx={{ width: 60, height: 6, borderRadius: 3 }}
                        />
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Grid>
      </Grid>

      {/* AI-Driven Recommendations */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12}>
          <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
            <Lightbulb sx={{ mr: 1 }} />
            AI-Driven Recommendations
          </Typography>
        </Grid>
        {aiRecommendations.map((rec, index) => (
          <Grid item xs={12} md={4} key={index}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                  <Typography variant="h6">{rec.category}</Typography>
                  <Chip
                    label={rec.priority}
                    color={rec.priority === 'High' ? 'error' : rec.priority === 'Medium' ? 'warning' : 'default'}
                    size="small"
                  />
                </Box>
                <Typography variant="body2" sx={{ mb: 2 }}>
                  {rec.recommendation}
                </Typography>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Chip
                    label={`Impact: ${rec.impact}`}
                    size="small"
                    variant="outlined"
                  />
                  <Chip
                    label={`Effort: ${rec.effort}`}
                    size="small"
                    variant="outlined"
                  />
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* ROI Projections */}
      <Card sx={{ mb: 4 }}>
        <CardContent>
          <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
            <Analytics sx={{ mr: 1 }} />
            ROI Projections
          </Typography>
          <Typography variant="body1" sx={{ mb: 3 }}>
            Based on your {roiProjections.studentCount} students, our system is projected to save your teachers 
            approximately {roiProjections.timeSaved} hours per term, equivalent to ${roiProjections.costSavings.toLocaleString()} 
            in administrative costs.
          </Typography>
          <Grid container spacing={3}>
            <Grid item xs={12} md={3}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h4" color="primary">
                  {roiProjections.timeSaved}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Hours Saved/Term
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={12} md={3}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h4" color="primary">
                  ${roiProjections.costSavings.toLocaleString()}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Cost Savings/Year
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={12} md={3}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h4" color="primary">
                  {roiProjections.efficiencyGain}%
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Efficiency Gain
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={12} md={3}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h4" color="primary">
                  {roiProjections.studentCount}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Students Managed
                </Typography>
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>
    </Box>
  );
};

export default AdvancedAnalytics; 