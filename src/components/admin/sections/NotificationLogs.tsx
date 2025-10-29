import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  MenuItem,
  Grid,
  Button,
  Chip,
  IconButton,
  Tooltip,
  Card,
  CardContent,
  Alert,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  InputAdornment,
  Divider,
  Stack
} from '@mui/material';
import {
  Search as SearchIcon,
  FilterList as FilterIcon,
  Download as DownloadIcon,
  Refresh as RefreshIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Email as EmailIcon,
  Sms as SmsIcon,
  WhatsApp as WhatsAppIcon,
  Notifications as NotificationsIcon,
  Visibility as VisibilityIcon,
  CalendarToday as CalendarIcon,
  Assignment as AssignmentIcon,
  Clear as ClearIcon,
  TrendingUp as TrendingUpIcon
} from '@mui/icons-material';
import { apiService } from '../../../services/apiService';
import { format } from 'date-fns';
import { themeColors } from '../../../theme/adminTheme';
import NotificationIcon from '../../common/NotificationIcon';

interface NotificationLogsProps {
  schoolBranding?: any;
}

interface NotificationLog {
  _id: string;
  channel: 'email' | 'sms' | 'whatsapp' | 'push';
  type: 'report' | 'event' | 'reminder' | 'welcome' | 'system';
  status: 'sent' | 'failed' | 'pending' | 'delivered';
  recipientName: string;
  recipientEmail?: string;
  recipientPhone?: string;
  studentName?: string;
  className?: string;
  eventTitle?: string;
  reportTitle?: string;
  subject?: string;
  messagePreview?: string;
  sentAt?: string;
  error?: {
    message: string;
  };
  isFallback?: boolean;
  createdAt: string;
}

interface Statistics {
  totalNotifications: number;
  sentCount: number;
  failedCount: number;
  emailCount: number;
  smsCount: number;
  whatsappCount: number;
  totalCost: number;
}

const NotificationLogs: React.FC<NotificationLogsProps> = ({ schoolBranding }) => {
  const [logs, setLogs] = useState<NotificationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [total, setTotal] = useState(0);
  const [statistics, setStatistics] = useState<Statistics | null>(null);
  const [selectedLog, setSelectedLog] = useState<NotificationLog | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  // Filters
  const [filters, setFilters] = useState({
    channel: '',
    status: '',
    type: '',
    dateFrom: '',
    dateTo: '',
    search: ''
  });

  // Fetch logs
  const fetchLogs = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        page: (page + 1).toString(),
        limit: rowsPerPage.toString(),
        ...(filters.channel && { channel: filters.channel }),
        ...(filters.status && { status: filters.status }),
        ...(filters.type && { type: filters.type }),
        ...(filters.dateFrom && { dateFrom: filters.dateFrom }),
        ...(filters.dateTo && { dateTo: filters.dateTo }),
        ...(filters.search && { search: filters.search })
      });

      const response = await apiService.makeRequest<any>(`/notification-logs?${params.toString()}`);

      if (response.success && response.data) {
        setLogs(response.data.logs);
        setTotal(response.data.pagination.total);
      } else {
        throw new Error(response.error || 'Failed to fetch logs');
      }
    } catch (err: any) {
      console.error('Error fetching logs:', err);
      setError(err.response?.data?.message || 'Failed to fetch notification logs');
    } finally {
      setLoading(false);
    }
  };

  // Fetch statistics
  const fetchStatistics = async () => {
    try {
      const params = new URLSearchParams({
        ...(filters.dateFrom && { dateFrom: filters.dateFrom }),
        ...(filters.dateTo && { dateTo: filters.dateTo })
      });

      const response = await apiService.makeRequest<any>(`/notification-logs/statistics?${params.toString()}`);

      if (response.success && response.data) {
        setStatistics(response.data.overall);
      }
    } catch (err) {
      console.error('Error fetching statistics:', err);
    }
  };

  useEffect(() => {
    fetchLogs();
    fetchStatistics();
  }, [page, rowsPerPage]);

  const handleFilterChange = (field: string, value: any) => {
    setFilters({ ...filters, [field]: value });
    setPage(0); // Reset to first page
  };

  const handleSearch = () => {
    fetchLogs();
    fetchStatistics();
  };

  const handleClearFilters = () => {
    setFilters({
      channel: '',
      status: '',
      type: '',
      dateFrom: '',
      dateTo: '',
      search: ''
    });
    setPage(0);
  };

  const handleExport = async () => {
    try {
      const params = new URLSearchParams({
        ...(filters.channel && { channel: filters.channel }),
        ...(filters.status && { status: filters.status }),
        ...(filters.type && { type: filters.type }),
        ...(filters.dateFrom && { dateFrom: filters.dateFrom }),
        ...(filters.dateTo && { dateTo: filters.dateTo })
      });

      window.open(`${process.env.REACT_APP_API_URL}/notification-logs/export/csv?${params.toString()}`, '_blank');
    } catch (err) {
      console.error('Error exporting logs:', err);
    }
  };

  const handleViewDetails = (log: NotificationLog) => {
    setSelectedLog(log);
    setDetailsOpen(true);
  };

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case 'email':
        return <EmailIcon sx={{ color: '#1976d2' }} />;
      case 'sms':
        return <SmsIcon sx={{ color: '#ff9800' }} />;
      case 'whatsapp':
        return <WhatsAppIcon sx={{ color: '#25D366' }} />;
      case 'push':
        return <NotificationsIcon sx={{ color: '#9c27b0' }} />;
      default:
        return <NotificationsIcon />;
    }
  };

  const getStatusChip = (status: string) => {
    const statusConfig: any = {
      sent: { color: 'success', icon: <CheckCircleIcon fontSize="small" /> },
      delivered: { color: 'success', icon: <CheckCircleIcon fontSize="small" /> },
      failed: { color: 'error', icon: <ErrorIcon fontSize="small" /> },
      pending: { color: 'warning', icon: <CircularProgress size={12} /> }
    };

    const config = statusConfig[status] || { color: 'default', icon: null };

    return (
      <Chip
        label={status.toUpperCase()}
        color={config.color as any}
        size="small"
        icon={config.icon}
        sx={{ fontWeight: 600, minWidth: 90 }}
      />
    );
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'report':
        return <AssignmentIcon fontSize="small" />;
      case 'event':
        return <CalendarIcon fontSize="small" />;
      default:
        return <NotificationsIcon fontSize="small" />;
    }
  };

  const getRandomCardColor = (index: number) => {
    return themeColors.cardColors[index % themeColors.cardColors.length];
  };

  return (
    <Box>
      {schoolBranding && (
        <Paper
          elevation={0}
          sx={{
            background: `linear-gradient(135deg, ${schoolBranding.branding?.primaryColor || schoolBranding.primaryColor || '#273890'} 0%, ${schoolBranding.branding?.secondaryColor || schoolBranding.secondaryColor || '#7f0f4a'} 100%)`,
            borderRadius: 4,
            p: 3,
            mb: 4,
            mt: 0,
            color: 'white',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={9}>
              <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
                {schoolBranding.name || 'School Name'}
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center' }}>
                {schoolBranding.established && (
                  <Typography variant="body2" sx={{ opacity: 0.95 }}>
                    📅 Est. {schoolBranding.established}
                  </Typography>
                )}
                {schoolBranding.address && (
                  <Typography variant="body2" sx={{ opacity: 0.95 }}>
                    📍 {typeof schoolBranding.address === 'string' 
                      ? schoolBranding.address 
                      : `${schoolBranding.address.street}, ${schoolBranding.address.city}, ${schoolBranding.address.state}`}
                  </Typography>
                )}
                {schoolBranding.email && (
                  <Typography variant="body2" sx={{ opacity: 0.95 }}>
                    ✉️ {schoolBranding.email}
                  </Typography>
                )}
                {schoolBranding.phone && (
                  <Typography variant="body2" sx={{ opacity: 0.95 }}>
                    📞 {schoolBranding.phone}
                  </Typography>
                )}
              </Box>
            </Grid>
            <Grid item xs={12} md={3}>
              {(schoolBranding.logo || schoolBranding.branding?.logo) && (() => {
                const logoPath = schoolBranding.logo || schoolBranding.branding?.logo || '';
                const logoUrl = logoPath.startsWith('http://') || logoPath.startsWith('https://') 
                  ? logoPath 
                  : `${(process.env.REACT_APP_API_URL || 'http://localhost:5050').replace('/api', '')}${logoPath.startsWith('/') ? logoPath : '/' + logoPath}`;
                return (
                  <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <Box sx={{
                      bgcolor: 'rgba(255,255,255,0.95)',
                      borderRadius: 3,
                      p: 2,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      <img 
                        src={logoUrl} 
                        alt={schoolBranding.name}
                        style={{ 
                          maxWidth: '120px',
                          maxHeight: '120px',
                          objectFit: 'contain'
                        }}
                      />
                    </Box>
                  </Box>
                );
              })()}
            </Grid>
          </Grid>
        </Paper>
      )}

      {/* Header */}
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Box>
          <Typography
            variant="h4"
            sx={{
              fontWeight: 700,
              background: schoolBranding 
                ? `linear-gradient(135deg, ${schoolBranding.branding?.primaryColor || schoolBranding.primaryColor || '#667eea'} 0%, ${schoolBranding.branding?.secondaryColor || schoolBranding.secondaryColor || '#764ba2'} 100%)`
                : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              mb: 1
            }}
          >
            📋 Notification Logs & Audit Trail
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Track every email, SMS, and WhatsApp notification sent by the system
          </Typography>
        </Box>
        <NotificationIcon />
      </Box>

      {/* Statistics Cards */}
      {statistics && (
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white' }}>
              <CardContent>
                <Typography variant="h6" sx={{ opacity: 0.9, mb: 1 }}>
                  Total Sent
                </Typography>
                <Typography variant="h3" sx={{ fontWeight: 700 }}>
                  {statistics.totalNotifications}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ background: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)', color: 'white' }}>
              <CardContent>
                <Typography variant="h6" sx={{ opacity: 0.9, mb: 1 }}>
                  Successful
                </Typography>
                <Typography variant="h3" sx={{ fontWeight: 700 }}>
                  {statistics.sentCount}
                </Typography>
                <Typography variant="body2" sx={{ opacity: 0.8 }}>
                  {((statistics.sentCount / statistics.totalNotifications) * 100 || 0).toFixed(1)}% success rate
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', color: 'white' }}>
              <CardContent>
                <Typography variant="h6" sx={{ opacity: 0.9, mb: 1 }}>
                  Failed
                </Typography>
                <Typography variant="h3" sx={{ fontWeight: 700 }}>
                  {statistics.failedCount}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ background: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)', color: 'white' }}>
              <CardContent>
                <Typography variant="h6" sx={{ opacity: 0.9, mb: 1 }}>
                  By Channel
                </Typography>
                <Stack spacing={0.5} sx={{ mt: 1 }}>
                  <Typography variant="body2">📧 Email: {statistics.emailCount}</Typography>
                  <Typography variant="body2">💬 WhatsApp: {statistics.whatsappCount}</Typography>
                  <Typography variant="body2">📱 SMS: {statistics.smsCount}</Typography>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Filters */}
      <Paper
        sx={{
          p: 3,
          mb: 3,
          background: 'rgba(255,255,255,0.9)',
          backdropFilter: 'blur(10px)',
          borderRadius: 3
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <FilterIcon sx={{ mr: 1, color: '#667eea' }} />
          <Typography variant="h6">Filters</Typography>
        </Box>

        <Grid container spacing={2}>
          <Grid item xs={12} sm={6} md={2}>
            <TextField
              select
              fullWidth
              size="small"
              label="Channel"
              value={filters.channel}
              onChange={(e) => handleFilterChange('channel', e.target.value)}
            >
              <MenuItem value="">All</MenuItem>
              <MenuItem value="email">Email</MenuItem>
              <MenuItem value="whatsapp">WhatsApp</MenuItem>
              <MenuItem value="sms">SMS</MenuItem>
              <MenuItem value="push">Push</MenuItem>
            </TextField>
          </Grid>

          <Grid item xs={12} sm={6} md={2}>
            <TextField
              select
              fullWidth
              size="small"
              label="Status"
              value={filters.status}
              onChange={(e) => handleFilterChange('status', e.target.value)}
            >
              <MenuItem value="">All</MenuItem>
              <MenuItem value="sent">Sent</MenuItem>
              <MenuItem value="delivered">Delivered</MenuItem>
              <MenuItem value="failed">Failed</MenuItem>
              <MenuItem value="pending">Pending</MenuItem>
            </TextField>
          </Grid>

          <Grid item xs={12} sm={6} md={2}>
            <TextField
              select
              fullWidth
              size="small"
              label="Type"
              value={filters.type}
              onChange={(e) => handleFilterChange('type', e.target.value)}
            >
              <MenuItem value="">All</MenuItem>
              <MenuItem value="report">Report</MenuItem>
              <MenuItem value="event">Event</MenuItem>
              <MenuItem value="reminder">Reminder</MenuItem>
              <MenuItem value="system">System</MenuItem>
            </TextField>
          </Grid>

          <Grid item xs={12} sm={6} md={2}>
            <TextField
              type="date"
              fullWidth
              size="small"
              label="From Date"
              value={filters.dateFrom}
              onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>

          <Grid item xs={12} sm={6} md={2}>
            <TextField
              type="date"
              fullWidth
              size="small"
              label="To Date"
              value={filters.dateTo}
              onChange={(e) => handleFilterChange('dateTo', e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>

          <Grid item xs={12} sm={6} md={2}>
            <TextField
              fullWidth
              size="small"
              label="Search"
              placeholder="Name, email, phone..."
              value={filters.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                )
              }}
            />
          </Grid>
        </Grid>

        <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
          <Button
            variant="contained"
            onClick={handleSearch}
            sx={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              borderRadius: 2
            }}
          >
            Apply Filters
          </Button>
          <Button
            variant="outlined"
            onClick={handleClearFilters}
            startIcon={<ClearIcon />}
          >
            Clear
          </Button>
          <Button
            variant="outlined"
            onClick={fetchLogs}
            startIcon={<RefreshIcon />}
          >
            Refresh
          </Button>
          <Button
            variant="outlined"
            onClick={handleExport}
            startIcon={<DownloadIcon />}
            sx={{ ml: 'auto' }}
          >
            Export CSV
          </Button>
        </Box>
      </Paper>

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Logs Table */}
      <Paper
        sx={{
          borderRadius: 3,
          overflow: 'hidden',
          boxShadow: '0 8px 32px rgba(0,0,0,0.1)'
        }}
      >
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow sx={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
                <TableCell sx={{ color: 'white', fontWeight: 700 }}>Date & Time</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 700 }}>Channel</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 700 }}>Type</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 700 }}>Recipient</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 700 }}>Subject/Event</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 700 }}>Status</TableCell>
                <TableCell sx={{ color: 'white', fontWeight: 700 }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 8 }}>
                    <CircularProgress />
                    <Typography variant="body2" sx={{ mt: 2 }}>
                      Loading logs...
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 8 }}>
                    <NotificationsIcon sx={{ fontSize: 64, color: '#ccc', mb: 2 }} />
                    <Typography variant="h6" color="text.secondary">
                      No logs found
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Try adjusting your filters
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                logs.map((log) => (
                  <TableRow
                    key={log._id}
                    hover
                    sx={{
                      '&:hover': {
                        background: 'rgba(102, 126, 234, 0.05)'
                      }
                    }}
                  >
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {format(new Date(log.createdAt), 'MMM dd, yyyy')}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {format(new Date(log.createdAt), 'hh:mm a')}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        icon={getChannelIcon(log.channel)}
                        label={log.channel.toUpperCase()}
                        size="small"
                        variant="outlined"
                      />
                      {log.isFallback && (
                        <Tooltip title="Fallback notification">
                          <Chip
                            label="FALLBACK"
                            size="small"
                            color="warning"
                            sx={{ ml: 0.5, fontSize: '0.65rem' }}
                          />
                        </Tooltip>
                      )}
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        {getTypeIcon(log.type)}
                        <Typography variant="body2">{log.type}</Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {log.recipientName}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {log.recipientEmail || log.recipientPhone}
                      </Typography>
                      {log.studentName && (
                        <Typography variant="caption" display="block" color="text.secondary">
                          Student: {log.studentName}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {log.eventTitle || log.reportTitle || log.subject || '-'}
                      </Typography>
                      {log.className && (
                        <Typography variant="caption" color="text.secondary">
                          Class: {log.className}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>{getStatusChip(log.status)}</TableCell>
                    <TableCell>
                      <Tooltip title="View Details">
                        <IconButton
                          size="small"
                          onClick={() => handleViewDetails(log)}
                          sx={{
                            color: '#667eea',
                            '&:hover': {
                              background: 'rgba(102, 126, 234, 0.1)'
                            }
                          }}
                        >
                          <VisibilityIcon />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>

        <TablePagination
          component="div"
          count={total}
          page={page}
          onPageChange={(e, newPage) => setPage(newPage)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(e) => {
            setRowsPerPage(parseInt(e.target.value, 10));
            setPage(0);
          }}
          rowsPerPageOptions={[10, 25, 50, 100]}
        />
      </Paper>

      {/* Details Dialog */}
      <Dialog
        open={detailsOpen}
        onClose={() => setDetailsOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {selectedLog && getChannelIcon(selectedLog.channel)}
            Notification Details
          </Box>
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          {selectedLog && (
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <Typography variant="caption" color="text.secondary">
                  Channel
                </Typography>
                <Typography variant="body1" sx={{ fontWeight: 600 }}>
                  {selectedLog.channel.toUpperCase()}
                </Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="caption" color="text.secondary">
                  Status
                </Typography>
                <Box sx={{ mt: 0.5 }}>{getStatusChip(selectedLog.status)}</Box>
              </Grid>
              <Grid item xs={12}>
                <Divider sx={{ my: 1 }} />
              </Grid>
              <Grid item xs={6}>
                <Typography variant="caption" color="text.secondary">
                  Recipient Name
                </Typography>
                <Typography variant="body1">{selectedLog.recipientName}</Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="caption" color="text.secondary">
                  Contact
                </Typography>
                <Typography variant="body1">
                  {selectedLog.recipientEmail || selectedLog.recipientPhone}
                </Typography>
              </Grid>
              {selectedLog.studentName && (
                <>
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary">
                      Student
                    </Typography>
                    <Typography variant="body1">{selectedLog.studentName}</Typography>
                  </Grid>
                  <Grid item xs={6}>
                    <Typography variant="caption" color="text.secondary">
                      Class
                    </Typography>
                    <Typography variant="body1">{selectedLog.className || '-'}</Typography>
                  </Grid>
                </>
              )}
              <Grid item xs={12}>
                <Divider sx={{ my: 1 }} />
              </Grid>
              <Grid item xs={12}>
                <Typography variant="caption" color="text.secondary">
                  Subject
                </Typography>
                <Typography variant="body1">{selectedLog.subject || '-'}</Typography>
              </Grid>
              {selectedLog.messagePreview && (
                <Grid item xs={12}>
                  <Typography variant="caption" color="text.secondary">
                    Message Preview
                  </Typography>
                  <Typography variant="body2" sx={{ mt: 0.5, fontStyle: 'italic' }}>
                    {selectedLog.messagePreview}
                  </Typography>
                </Grid>
              )}
              <Grid item xs={6}>
                <Typography variant="caption" color="text.secondary">
                  Sent At
                </Typography>
                <Typography variant="body1">
                  {selectedLog.sentAt
                    ? format(new Date(selectedLog.sentAt), 'MMM dd, yyyy hh:mm a')
                    : '-'}
                </Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="caption" color="text.secondary">
                  Created At
                </Typography>
                <Typography variant="body1">
                  {format(new Date(selectedLog.createdAt), 'MMM dd, yyyy hh:mm a')}
                </Typography>
              </Grid>
              {selectedLog.error && (
                <Grid item xs={12}>
                  <Alert severity="error" sx={{ mt: 1 }}>
                    <Typography variant="caption" sx={{ fontWeight: 600 }}>
                      Error Message:
                    </Typography>
                    <Typography variant="body2">{selectedLog.error.message}</Typography>
                  </Alert>
                </Grid>
              )}
              {selectedLog.isFallback && (
                <Grid item xs={12}>
                  <Alert severity="info" sx={{ mt: 1 }}>
                    This notification was sent as a fallback when the primary channel failed.
                  </Alert>
                </Grid>
              )}
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailsOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default NotificationLogs;

