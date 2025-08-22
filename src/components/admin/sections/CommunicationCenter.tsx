import React, { useState } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  Alert,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Divider,
  Badge,
} from '@mui/material';
import {
  Email,
  Send,
  Visibility,
  VisibilityOff,
  CheckCircle,
  Error,
  Schedule,
  Person,
  School,
  Notifications,
  Settings,
  Add,
  Edit,
  Delete,
} from '@mui/icons-material';

const CommunicationCenter: React.FC = () => {
  const [openEmailDialog, setOpenEmailDialog] = useState(false);
  const [openNotificationDialog, setOpenNotificationDialog] = useState(false);
  const [selectedRecipient, setSelectedRecipient] = useState('all');

  // Mock data
  const deliveryLog = [
    {
      id: 1,
      recipient: 'sarah.johnson@email.com',
      subject: 'Progress Report for Emma Johnson',
      status: 'sent',
      timestamp: '2024-07-30 14:30:22',
      opened: true,
      openedAt: '2024-07-30 15:45:12',
      clicked: false,
    },
    {
      id: 2,
      recipient: 'mike.chen@email.com',
      subject: 'Progress Report for Liam Chen',
      status: 'sent',
      timestamp: '2024-07-30 14:25:15',
      opened: false,
      openedAt: null,
      clicked: false,
    },
    {
      id: 3,
      recipient: 'emily.davis@email.com',
      subject: 'Progress Report for Noah Davis',
      status: 'bounced',
      timestamp: '2024-07-30 14:20:08',
      opened: false,
      openedAt: null,
      clicked: false,
    },
    {
      id: 4,
      recipient: 'david.brown@email.com',
      subject: 'Progress Report for Ava Brown',
      status: 'sent',
      timestamp: '2024-07-30 14:15:33',
      opened: true,
      openedAt: '2024-07-30 16:20:45',
      clicked: true,
    },
  ];

  const emailStats = {
    totalSent: 1247,
    totalOpened: 1189,
    totalClicked: 456,
    openRate: 95.3,
    clickRate: 36.6,
    bounceRate: 2.1,
  };

  const notificationSettings = {
    lowReportActivity: true,
    highBounceRate: true,
    systemAlerts: true,
    weeklyReports: false,
    monthlyAnalytics: true,
  };

  const recipientGroups = [
    { id: 'all', name: 'All Parents', count: 1247 },
    { id: 'grade1', name: 'Grade 1 Parents', count: 156 },
    { id: 'grade2', name: 'Grade 2 Parents', count: 142 },
    { id: 'grade3', name: 'Grade 3 Parents', count: 138 },
    { id: 'grade4', name: 'Grade 4 Parents', count: 145 },
  ];

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'sent':
        return <CheckCircle color="success" />;
      case 'bounced':
        return <Error color="error" />;
      case 'pending':
        return <Schedule color="warning" />;
      default:
        return <Schedule color="action" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'sent':
        return 'success';
      case 'bounced':
        return 'error';
      case 'pending':
        return 'warning';
      default:
        return 'default';
    }
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Communication & Alerts Center
      </Typography>

      <Alert severity="info" sx={{ mb: 3 }}>
        <Typography variant="body1">
          Manage report delivery, send custom emails, and configure system notifications.
        </Typography>
      </Alert>

      {/* Email Statistics */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={2}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h4" color="primary">
                {emailStats.totalSent.toLocaleString()}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Total Sent
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={2}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h4" color="success.main">
                {emailStats.openRate}%
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Open Rate
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={2}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h4" color="info.main">
                {emailStats.clickRate}%
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Click Rate
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={2}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h4" color="error">
                {emailStats.bounceRate}%
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Bounce Rate
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">Quick Actions</Typography>
                <Badge badgeContent={3} color="error">
                  <Notifications />
                </Badge>
              </Box>
              <Button
                variant="contained"
                startIcon={<Send />}
                onClick={() => setOpenEmailDialog(true)}
                fullWidth
                sx={{ mb: 1 }}
              >
                Send Custom Email
              </Button>
              <Button
                variant="outlined"
                startIcon={<Settings />}
                onClick={() => setOpenNotificationDialog(true)}
                fullWidth
              >
                Notification Settings
              </Button>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Report Delivery Log */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
                <Email sx={{ mr: 1 }} />
                Report Delivery Log
              </Typography>

              <TableContainer component={Paper}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Recipient</TableCell>
                      <TableCell>Subject</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Sent</TableCell>
                      <TableCell>Opened</TableCell>
                      <TableCell>Clicked</TableCell>
                      <TableCell>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {deliveryLog.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <Avatar sx={{ mr: 2, width: 32, height: 32 }}>
                              <Person />
                            </Avatar>
                            <Typography variant="body2">{log.recipient}</Typography>
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" fontWeight="bold">
                            {log.subject}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            {getStatusIcon(log.status)}
                            <Chip
                              label={log.status}
                              color={getStatusColor(log.status) as any}
                              size="small"
                            />
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" color="text.secondary">
                            {log.timestamp}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            {log.opened ? (
                              <>
                                <Visibility color="success" />
                                <Typography variant="body2" color="text.secondary">
                                  {log.openedAt}
                                </Typography>
                              </>
                            ) : (
                              <>
                                <VisibilityOff color="action" />
                                <Typography variant="body2" color="text.secondary">
                                  Not opened
                                </Typography>
                              </>
                            )}
                          </Box>
                        </TableCell>
                        <TableCell>
                          {log.clicked ? (
                            <Chip label="Clicked" color="success" size="small" />
                          ) : (
                            <Chip label="Not clicked" color="default" size="small" />
                          )}
                        </TableCell>
                        <TableCell>
                          <IconButton size="small" color="primary">
                            <Edit />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Custom Email Sender */}
      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
                <Send sx={{ mr: 1 }} />
                Custom Email Sender
              </Typography>

              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <FormControl fullWidth>
                    <InputLabel>Recipient Group</InputLabel>
                    <Select
                      value={selectedRecipient}
                      label="Recipient Group"
                      onChange={(e) => setSelectedRecipient(e.target.value)}
                    >
                      {recipientGroups.map((group) => (
                        <MenuItem key={group.id} value={group.id}>
                          {group.name} ({group.count} recipients)
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12}>
                  <TextField fullWidth label="Subject Line" />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Email Content"
                    multiline
                    rows={6}
                    placeholder="Enter your email content here..."
                  />
                </Grid>
                <Grid item xs={12}>
                  <Button variant="contained" startIcon={<Send />} fullWidth>
                    Send Email
                  </Button>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
                <Notifications sx={{ mr: 1 }} />
                Notification Settings
              </Typography>

              <List>
                {Object.entries(notificationSettings).map(([key, value]) => (
                  <ListItem key={key}>
                    <ListItemText
                      primary={key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                      secondary={`Get notified when ${key.replace(/([A-Z])/g, ' $1').toLowerCase()}`}
                    />
                    <Switch checked={value} />
                  </ListItem>
                ))}
              </List>

              <Button
                variant="outlined"
                startIcon={<Settings />}
                onClick={() => setOpenNotificationDialog(true)}
                fullWidth
                sx={{ mt: 2 }}
              >
                Advanced Settings
              </Button>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Custom Email Dialog */}
      <Dialog open={openEmailDialog} onClose={() => setOpenEmailDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>Send Custom Email</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Recipient Group</InputLabel>
                <Select label="Recipient Group">
                  {recipientGroups.map((group) => (
                    <MenuItem key={group.id} value={group.id}>
                      {group.name} ({group.count} recipients)
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField fullWidth label="Subject Line" />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Email Content"
                multiline
                rows={8}
                placeholder="Enter your email content here..."
              />
            </Grid>
            <Grid item xs={12}>
              <FormControlLabel
                control={<Switch />}
                label="Track email opens and clicks"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenEmailDialog(false)}>Cancel</Button>
          <Button variant="contained" startIcon={<Send />} onClick={() => setOpenEmailDialog(false)}>
            Send Email
          </Button>
        </DialogActions>
      </Dialog>

      {/* Notification Settings Dialog */}
      <Dialog open={openNotificationDialog} onClose={() => setOpenNotificationDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>Notification Settings</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom>Email Notifications</Typography>
              <FormControlLabel
                control={<Switch defaultChecked />}
                label="Low report generation activity alerts"
              />
            </Grid>
            <Grid item xs={12}>
              <FormControlLabel
                control={<Switch defaultChecked />}
                label="High bounce rate notifications"
              />
            </Grid>
            <Grid item xs={12}>
              <FormControlLabel
                control={<Switch defaultChecked />}
                label="System maintenance alerts"
              />
            </Grid>
            <Grid item xs={12}>
              <FormControlLabel
                control={<Switch />}
                label="Weekly summary reports"
              />
            </Grid>
            <Grid item xs={12}>
              <FormControlLabel
                control={<Switch defaultChecked />}
                label="Monthly analytics reports"
              />
            </Grid>
            <Divider sx={{ my: 2 }} />
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom>Alert Thresholds</Typography>
              <TextField
                fullWidth
                label="Low Activity Threshold (reports per day)"
                type="number"
                defaultValue={5}
                sx={{ mb: 2 }}
              />
              <TextField
                fullWidth
                label="High Bounce Rate Threshold (%)"
                type="number"
                defaultValue={10}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenNotificationDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={() => setOpenNotificationDialog(false)}>
            Save Settings
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default CommunicationCenter; 