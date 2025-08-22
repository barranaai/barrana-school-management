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
  ListItemSecondaryAction,
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
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Tabs,
  Tab,
  LinearProgress,
} from '@mui/material';
import {
  Settings,
  Security,
  Api,
  People,
  History,
  Add,
  Edit,
  Delete,
  Visibility,
  VisibilityOff,
  ExpandMore,
  Key,
  Cloud,
  Storage,
  Speed,
  CheckCircle,
  Warning,
  Error,
  Refresh,
  Save,
} from '@mui/icons-material';

const SystemSettings: React.FC = () => {
  const [openApiDialog, setOpenApiDialog] = useState(false);
  const [openRoleDialog, setOpenRoleDialog] = useState(false);
  const [openUserDialog, setOpenUserDialog] = useState(false);
  const [activeTab, setActiveTab] = useState(0);

  // Mock data
  const apiKeys = [
    {
      id: 1,
      name: 'OpenAI API Key',
      key: 'sk-...abc123',
      status: 'active',
      lastUsed: '2024-07-30 14:30',
      usage: '85%',
      type: 'AI Services',
    },
    {
      id: 2,
      name: 'Google Cloud Speech API',
      key: 'AIza...xyz789',
      status: 'active',
      lastUsed: '2024-07-30 14:25',
      usage: '92%',
      type: 'Speech Recognition',
    },
    {
      id: 3,
      name: 'Email Service API',
      key: 'SG...def456',
      status: 'inactive',
      lastUsed: '2024-07-29 16:45',
      usage: '0%',
      type: 'Email Services',
    },
  ];

  const userRoles = [
    {
      id: 1,
      name: 'Super Admin',
      description: 'Full system access and control',
      permissions: ['Full Access', 'User Management', 'System Settings', 'Analytics'],
      users: 2,
    },
    {
      id: 2,
      name: 'School Admin',
      description: 'School-level administration and management',
      permissions: ['Student Management', 'Teacher Management', 'Reports', 'Analytics'],
      users: 5,
    },
    {
      id: 3,
      name: 'Teacher',
      description: 'Classroom management and report generation',
      permissions: ['Student Reports', 'Voice Recording', 'Report History'],
      users: 28,
    },
    {
      id: 4,
      name: 'Parent',
      description: 'View student reports and communicate with teachers',
      permissions: ['View Reports', 'Communication'],
      users: 1247,
    },
  ];

  const auditLog = [
    {
      id: 1,
      action: 'User Login',
      user: 'admin@school.com',
      details: 'Successful login from 192.168.1.100',
      timestamp: '2024-07-30 14:30:22',
      status: 'success',
    },
    {
      id: 2,
      action: 'Student Added',
      user: 'sarah.johnson@school.com',
      details: 'Added student: Emma Johnson (Grade 1)',
      timestamp: '2024-07-30 14:25:15',
      status: 'success',
    },
    {
      id: 3,
      action: 'Report Generated',
      user: 'michael.chen@school.com',
      details: 'Generated progress report for Liam Chen',
      timestamp: '2024-07-30 14:20:08',
      status: 'success',
    },
    {
      id: 4,
      action: 'API Key Updated',
      user: 'admin@school.com',
      details: 'Updated OpenAI API key configuration',
      timestamp: '2024-07-30 14:15:33',
      status: 'warning',
    },
    {
      id: 5,
      action: 'Failed Login Attempt',
      user: 'unknown@email.com',
      details: 'Failed login attempt from 203.0.113.45',
      timestamp: '2024-07-30 14:10:22',
      status: 'error',
    },
  ];

  const systemHealth = {
    apiPerformance: 99.9,
    databasePerformance: 99.8,
    aiServiceUptime: 99.7,
    emailService: 99.5,
    storageUsage: 67.3,
    memoryUsage: 45.2,
  };

  const securitySettings = {
    twoFactorAuth: true,
    passwordPolicy: 'Strong',
    sessionTimeout: 30,
    ipWhitelist: false,
    auditLogging: true,
    dataEncryption: true,
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle color="success" />;
      case 'warning':
        return <Warning color="warning" />;
      case 'error':
        return <Error color="error" />;
      default:
        return <CheckCircle color="action" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'success';
      case 'warning':
        return 'warning';
      case 'error':
        return 'error';
      default:
        return 'default';
    }
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        System Settings & Integrations
      </Typography>

      <Alert severity="info" sx={{ mb: 3 }}>
        <Typography variant="body1">
          Configure system integrations, manage user roles and permissions, and monitor system health.
        </Typography>
      </Alert>

      <Tabs value={activeTab} onChange={(e, newValue) => setActiveTab(newValue)} sx={{ mb: 3 }}>
        <Tab label="API Configuration" icon={<Api />} />
        <Tab label="User Roles & Permissions" icon={<People />} />
        <Tab label="Security Settings" icon={<Security />} />
        <Tab label="System Health" icon={<Speed />} />
        <Tab label="Audit Log" icon={<History />} />
      </Tabs>

      {/* API Configuration Tab */}
      {activeTab === 0 && (
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                  <Typography variant="h5" sx={{ display: 'flex', alignItems: 'center' }}>
                    <Api sx={{ mr: 1 }} />
                    API Keys & Integrations
                  </Typography>
                  <Button
                    variant="contained"
                    startIcon={<Add />}
                    onClick={() => setOpenApiDialog(true)}
                  >
                    Add API Key
                  </Button>
                </Box>

                <TableContainer component={Paper}>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>API Name</TableCell>
                        <TableCell>Type</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell>Last Used</TableCell>
                        <TableCell>Usage</TableCell>
                        <TableCell>Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {apiKeys.map((api) => (
                        <TableRow key={api.id}>
                          <TableCell>
                            <Typography variant="body1" fontWeight="bold">
                              {api.name}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              {api.key}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Chip label={api.type} color="primary" size="small" />
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={api.status}
                              color={api.status === 'active' ? 'success' : 'default'}
                              size="small"
                            />
                          </TableCell>
                          <TableCell>{api.lastUsed}</TableCell>
                          <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Typography variant="body2">{api.usage}</Typography>
                              <LinearProgress
                                variant="determinate"
                                value={parseInt(api.usage)}
                                sx={{ width: 60, height: 6, borderRadius: 3 }}
                              />
                            </Box>
                          </TableCell>
                          <TableCell>
                            <Box sx={{ display: 'flex', gap: 1 }}>
                              <IconButton size="small" color="primary">
                                <Edit />
                              </IconButton>
                              <IconButton size="small" color="error">
                                <Delete />
                              </IconButton>
                            </Box>
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
      )}

      {/* User Roles & Permissions Tab */}
      {activeTab === 1 && (
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                  <Typography variant="h5" sx={{ display: 'flex', alignItems: 'center' }}>
                    <People sx={{ mr: 1 }} />
                    User Roles & Permissions
                  </Typography>
                  <Button
                    variant="contained"
                    startIcon={<Add />}
                    onClick={() => setOpenRoleDialog(true)}
                  >
                    Add Role
                  </Button>
                </Box>

                <Grid container spacing={3}>
                  {userRoles.map((role) => (
                    <Grid item xs={12} md={6} key={role.id}>
                      <Card variant="outlined">
                        <CardContent>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                            <Typography variant="h6">{role.name}</Typography>
                            <Chip label={`${role.users} users`} size="small" />
                          </Box>
                          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                            {role.description}
                          </Typography>
                          <Box sx={{ mb: 2 }}>
                            {role.permissions.map((permission, index) => (
                              <Chip
                                key={index}
                                label={permission}
                                size="small"
                                variant="outlined"
                                sx={{ mr: 0.5, mb: 0.5 }}
                              />
                            ))}
                          </Box>
                          <Box sx={{ display: 'flex', gap: 1 }}>
                            <Button size="small" variant="outlined">
                              Edit
                            </Button>
                            <Button size="small" variant="outlined">
                              View Users
                            </Button>
                          </Box>
                        </CardContent>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Security Settings Tab */}
      {activeTab === 2 && (
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
                  <Security sx={{ mr: 1 }} />
                  Security Configuration
                </Typography>

                <List>
                  {Object.entries(securitySettings).map(([key, value]) => (
                    <ListItem key={key}>
                      <ListItemText
                        primary={key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                        secondary={`Configure ${key.replace(/([A-Z])/g, ' $1').toLowerCase()} settings`}
                      />
                      {typeof value === 'boolean' ? (
                        <Switch checked={value} />
                      ) : (
                        <Chip label={value} color="primary" size="small" />
                      )}
                    </ListItem>
                  ))}
                </List>

                <Button
                  variant="contained"
                  startIcon={<Save />}
                  fullWidth
                  sx={{ mt: 2 }}
                >
                  Save Security Settings
                </Button>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
                  <Cloud sx={{ mr: 1 }} />
                  Data & Privacy
                </Typography>

                <List>
                  <ListItem>
                    <ListItemText
                      primary="Data Retention Policy"
                      secondary="Configure how long to keep user data"
                    />
                    <Button size="small" variant="outlined">
                      Configure
                    </Button>
                  </ListItem>
                  <ListItem>
                    <ListItemText
                      primary="Backup Schedule"
                      secondary="Automated backup configuration"
                    />
                    <Button size="small" variant="outlined">
                      Configure
                    </Button>
                  </ListItem>
                  <ListItem>
                    <ListItemText
                      primary="GDPR Compliance"
                      secondary="Data protection and privacy settings"
                    />
                    <Chip label="Compliant" color="success" size="small" />
                  </ListItem>
                </List>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* System Health Tab */}
      {activeTab === 3 && (
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
                  <Speed sx={{ mr: 1 }} />
                  System Performance
                </Typography>

                <List>
                  {Object.entries(systemHealth).slice(0, 4).map(([key, value]) => (
                    <ListItem key={key}>
                      <ListItemText
                        primary={key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                        secondary={`${value}% performance`}
                      />
                      <LinearProgress
                        variant="determinate"
                        value={value}
                        sx={{ width: 100, height: 8, borderRadius: 4 }}
                      />
                    </ListItem>
                  ))}
                </List>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
                  <Storage sx={{ mr: 1 }} />
                  Resource Usage
                </Typography>

                <List>
                  {Object.entries(systemHealth).slice(4).map(([key, value]) => (
                    <ListItem key={key}>
                      <ListItemText
                        primary={key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                        secondary={`${value}% used`}
                      />
                      <LinearProgress
                        variant="determinate"
                        value={value}
                        sx={{ width: 100, height: 8, borderRadius: 4 }}
                      />
                    </ListItem>
                  ))}
                </List>

                <Button
                  variant="outlined"
                  startIcon={<Refresh />}
                  fullWidth
                  sx={{ mt: 2 }}
                >
                  Refresh Metrics
                </Button>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Audit Log Tab */}
      {activeTab === 4 && (
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Card>
              <CardContent>
                <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
                  <History sx={{ mr: 1 }} />
                  Audit Log
                </Typography>

                <TableContainer component={Paper}>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Action</TableCell>
                        <TableCell>User</TableCell>
                        <TableCell>Details</TableCell>
                        <TableCell>Timestamp</TableCell>
                        <TableCell>Status</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {auditLog.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell>
                            <Typography variant="body1" fontWeight="bold">
                              {log.action}
                            </Typography>
                          </TableCell>
                          <TableCell>{log.user}</TableCell>
                          <TableCell>
                            <Typography variant="body2" color="text.secondary">
                              {log.details}
                            </Typography>
                          </TableCell>
                          <TableCell>{log.timestamp}</TableCell>
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
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Add API Key Dialog */}
      <Dialog open={openApiDialog} onClose={() => setOpenApiDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>Add API Key</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField fullWidth label="API Name" />
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>API Type</InputLabel>
                <Select label="API Type">
                  <MenuItem value="ai">AI Services</MenuItem>
                  <MenuItem value="speech">Speech Recognition</MenuItem>
                  <MenuItem value="email">Email Services</MenuItem>
                  <MenuItem value="storage">Storage Services</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField fullWidth label="API Key" type="password" />
            </Grid>
            <Grid item xs={12}>
              <FormControlLabel
                control={<Switch defaultChecked />}
                label="Enable API key immediately"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenApiDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={() => setOpenApiDialog(false)}>
            Add API Key
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add Role Dialog */}
      <Dialog open={openRoleDialog} onClose={() => setOpenRoleDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>Add User Role</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField fullWidth label="Role Name" />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Description"
                multiline
                rows={3}
                placeholder="Describe the role and its responsibilities..."
              />
            </Grid>
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom>Permissions</Typography>
              <Grid container spacing={1}>
                {['Full Access', 'User Management', 'Student Management', 'Teacher Management', 'Reports', 'Analytics', 'System Settings'].map((permission) => (
                  <Grid item xs={12} md={6} key={permission}>
                    <FormControlLabel
                      control={<Switch />}
                      label={permission}
                    />
                  </Grid>
                ))}
              </Grid>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenRoleDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={() => setOpenRoleDialog(false)}>
            Add Role
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default SystemSettings; 