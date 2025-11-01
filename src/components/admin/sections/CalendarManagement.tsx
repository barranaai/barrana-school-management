import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Chip,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Alert,
  Tabs,
  Tab,
  CircularProgress,
  Divider,
  Checkbox,
  FormControlLabel,
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
  Event as EventIcon,
  Group,
  Visibility,
  Email,
  Sms,
  WhatsApp,
  Close,
  AttachFile,
  CloudUpload,
  InsertDriveFile,
} from '@mui/icons-material';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import listPlugin from '@fullcalendar/list';
import { useAuth } from '../../../contexts/AuthContext';
import { useData } from '../../../contexts/DataContext';
import apiService from '../../../services/apiService';
import { themeColors } from '../../../theme/adminTheme';
import NotificationIcon from '../../common/NotificationIcon';
import RichTextEditor from '../../common/RichTextEditor';

interface CalendarManagementProps {
  schoolBranding?: any;
}

interface Event {
  _id: string;
  title: string;
  description?: string;
  startDate: string;
  endDate: string;
  isMultiDay: boolean;
  reminderTime: string;
  category: string;
  location?: string;
  targetType: 'all' | 'grade' | 'class' | 'group';
  targetGrade?: string;
  targetClass?: any;
  targetGroup?: any;
  attachments?: Array<{
    filename: string;
    originalName: string;
    mimeType: string;
    size: number;
    url: string;
    uploadedAt: string;
  }>;
  reminders: {
    immediate: { sent: boolean; sentAt?: string; recipientCount: number };
    twoDaysBefore: { sent: boolean; sentAt?: string; recipientCount: number };
    oneDayBefore: { sent: boolean; sentAt?: string; recipientCount: number };
  };
  isActive: boolean;
  createdBy: any;
}

interface ParentGroup {
  _id: string;
  name: string;
  description?: string;
  memberCount: number;
  members: any[];
}

const CalendarManagement: React.FC<CalendarManagementProps> = ({ schoolBranding }) => {
  const { user } = useAuth();
  const { school, classes } = useData();
  const [activeTab, setActiveTab] = useState(0);
  const [events, setEvents] = useState<Event[]>([]);
  const [parentGroups, setParentGroups] = useState<ParentGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [openEventDialog, setOpenEventDialog] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [isEditingEvent, setIsEditingEvent] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Helper function to get branding colors
  const getBrandingColors = () => {
    const primaryColor = schoolBranding?.branding?.primaryColor || schoolBranding?.primaryColor || '#667eea';
    const secondaryColor = schoolBranding?.branding?.secondaryColor || schoolBranding?.secondaryColor || '#764ba2';
    return { primaryColor, secondaryColor };
  };

  const { primaryColor, secondaryColor } = getBrandingColors();
  const brandingGradient = `linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%)`;
  const brandingGradientHover = `linear-gradient(135deg, ${primaryColor}dd 0%, ${secondaryColor}dd 100%)`;
  const brandingGradientActive = `linear-gradient(135deg, ${secondaryColor} 0%, ${primaryColor} 100%)`;
  const brandingBgOpacity = (opacity: number) => {
    const hex = primaryColor.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  };

  const [eventForm, setEventForm] = useState({
    title: '',
    description: '',
    startDate: '',
    endDate: '',
    reminderTime: '09:00',
    category: 'other',
    location: '',
    targetType: 'all',
    targetGrade: '',
    targetClass: '',
    targetGroup: '',
    isRecurring: false,
    recurrencePattern: 'none',
    recurrenceInterval: 1,
    recurrenceDays: [] as number[],
    recurrenceEndDate: '',
    recurrenceCount: null as number | null,
  });

  // File upload state
  const [uploadedAttachments, setUploadedAttachments] = useState<any[]>([]);
  const [uploadingFile, setUploadingFile] = useState(false);

  const categories = [
    { value: 'holiday', label: 'Holiday', color: '#ef4444' },
    { value: 'meeting', label: 'Parent-Teacher Meeting', color: '#667eea' },
    { value: 'field_trip', label: 'Field Trip', color: '#10b981' },
    { value: 'sports_day', label: 'Sports Day', color: '#f59e0b' },
    { value: 'exam', label: 'Exam', color: '#dc2626' },
    { value: 'parent_teacher_conference', label: 'Conference', color: '#8b5cf6' },
    { value: 'workshop', label: 'Workshop', color: '#06b6d4' },
    { value: 'ceremony', label: 'Ceremony', color: '#ec4899' },
    { value: 'other', label: 'Other', color: '#6b7280' },
  ];

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [eventsRes, groupsRes] = await Promise.all([
        apiService.request('/events'),
        apiService.request('/parent-groups'),
      ]);

      if (eventsRes.success) {
        setEvents(eventsRes.data);
      }
      if (groupsRes.success) {
        setParentGroups(groupsRes.data);
      }
    } catch (error: any) {
      setError(error.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleEventSubmit = async () => {
    try {
      setError(null);
      
      console.log('Current eventForm state:', eventForm);
      console.log('Event title value:', eventForm.title);
      
      // Prepare event data - remove empty fields to avoid validation errors
      const eventData: any = {
        title: eventForm.title,
        description: eventForm.description,
        startDate: eventForm.startDate,
        endDate: eventForm.endDate || eventForm.startDate, // Default to startDate if no endDate
        reminderTime: eventForm.reminderTime,
        category: eventForm.category,
        location: eventForm.location,
        targetType: eventForm.targetType,
      };

      // Only add target fields if they have values
      if (eventForm.targetType === 'grade' && eventForm.targetGrade) {
        eventData.targetGrade = eventForm.targetGrade;
      }
      if (eventForm.targetType === 'class' && eventForm.targetClass) {
        eventData.targetClass = eventForm.targetClass;
      }
      if (eventForm.targetType === 'group' && eventForm.targetGroup) {
        eventData.targetGroup = eventForm.targetGroup;
      }

      // Add recurring event fields if enabled
      if (eventForm.isRecurring) {
        eventData.isRecurring = true;
        eventData.recurrencePattern = eventForm.recurrencePattern;
        eventData.recurrenceInterval = eventForm.recurrenceInterval;
        eventData.recurrenceDays = eventForm.recurrenceDays;
        if (eventForm.recurrenceEndDate) {
          eventData.recurrenceEndDate = eventForm.recurrenceEndDate;
        }
        if (eventForm.recurrenceCount) {
          eventData.recurrenceCount = eventForm.recurrenceCount;
        }
      }

      // Add attachments
      if (uploadedAttachments.length > 0) {
        eventData.attachments = uploadedAttachments;
      }

      let response;
      if (isEditingEvent && editingEvent) {
        // Update existing event
        console.log('Updating event with data:', eventData);
        response = await apiService.request(`/events/${editingEvent._id}`, 'PUT', eventData);
        console.log('Update event response:', response);
      } else {
        // Create new event
        console.log('Creating event with data:', eventData);
        response = await apiService.request('/events', 'POST', eventData);
        console.log('Create event response:', response);
      }
      
      if (response.success) {
        const action = isEditingEvent ? 'updated' : 'created';
        setSuccess(`Event ${action} successfully! ${isEditingEvent ? 'Update notifications are being sent.' : 'Reminders are being sent.'}`);
        setOpenEventDialog(false);
        setIsEditingEvent(false);
        setEditingEvent(null);
        resetEventForm();
        loadData();
      } else {
        setError(response.error || response.message || `Failed to ${isEditingEvent ? 'update' : 'create'} event`);
      }
    } catch (error: any) {
      console.error(`Error ${isEditingEvent ? 'updating' : 'creating'} event:`, error);
      setError(error.message || `Failed to ${isEditingEvent ? 'update' : 'create'} event`);
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    if (!window.confirm('Are you sure you want to delete this event? This will send cancellation notifications to all recipients.')) return;

    try {
      const response = await apiService.request(`/events/${eventId}`, 'DELETE');
      setSuccess('Event deleted successfully! Cancellation notifications have been sent to all recipients.');
      loadData();
    } catch (error: any) {
      setError(error.message || 'Failed to delete event');
    }
  };

  const handleEditEvent = (event: Event) => {
    setEditingEvent(event);
    setIsEditingEvent(true);
    setOpenEventDialog(true);
    
    // Pre-fill the form with existing event data
    setEventForm({
      title: event.title,
      description: event.description || '',
      startDate: event.startDate.split('T')[0], // Convert to YYYY-MM-DD format
      endDate: event.endDate.split('T')[0],
      reminderTime: event.reminderTime || '09:00',
      category: event.category || 'other',
      location: event.location || '',
      targetType: event.targetType || 'all',
      targetGrade: event.targetGrade || '',
      targetClass: event.targetClass || '',
      targetGroup: event.targetGroup || '',
    });
    
    // Set existing attachments
    if (event.attachments) {
      setUploadedAttachments(event.attachments);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setUploadingFile(true);
    setError(null);

    try {
      const file = files[0];
      
      // Validate file size (50MB)
      if (file.size > 50 * 1024 * 1024) {
        setError('File size must be less than 50MB');
        setUploadingFile(false);
        return;
      }

      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:5050/api'}/events/upload-attachment`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: formData
      });

      const result = await response.json();

      if (result.success) {
        setUploadedAttachments([...uploadedAttachments, result.data]);
        setSuccess('File uploaded successfully');
      } else {
        setError(result.message || 'Failed to upload file');
      }
    } catch (error: any) {
      console.error('Error uploading file:', error);
      setError('Failed to upload file');
    } finally {
      setUploadingFile(false);
      // Reset the file input
      event.target.value = '';
    }
  };

  const handleRemoveAttachment = (index: number) => {
    const newAttachments = [...uploadedAttachments];
    newAttachments.splice(index, 1);
    setUploadedAttachments(newAttachments);
    setSuccess('Attachment removed');
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) return '🖼️';
    if (mimeType.startsWith('video/')) return '🎥';
    if (mimeType.includes('pdf')) return '📄';
    if (mimeType.includes('word') || mimeType.includes('document')) return '📝';
    if (mimeType.includes('sheet') || mimeType.includes('excel')) return '📊';
    return '📎';
  };

  const resetEventForm = () => {
    setEventForm({
      title: '',
      description: '',
      startDate: '',
      endDate: '',
      reminderTime: '09:00',
      category: 'other',
      location: '',
      targetType: 'all',
      targetGrade: '',
      targetClass: '',
      targetGroup: '',
      isRecurring: false,
      recurrencePattern: 'none',
      recurrenceInterval: 1,
      recurrenceDays: [],
      recurrenceEndDate: '',
      recurrenceCount: null,
    });
    setUploadedAttachments([]);
    setSelectedEvent(null);
    setIsEditingEvent(false);
    setEditingEvent(null);
  };

  const getCategoryColor = (category: string) => {
    const cat = categories.find(c => c.value === category);
    return cat?.color || '#6b7280';
  };

  const getCategoryLabel = (category: string) => {
    const cat = categories.find(c => c.value === category);
    return cat?.label || category;
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  // Convert events to FullCalendar format
  const calendarEvents = events.map(event => ({
    id: event._id,
    title: (event as any).isRecurring ? `🔄 ${event.title}` : event.title,
    start: event.startDate,
    end: event.isMultiDay ? event.endDate : event.startDate,
    backgroundColor: getCategoryColor(event.category),
    borderColor: getCategoryColor(event.category),
    extendedProps: {
      description: event.description,
      location: event.location,
      category: event.category,
      targetType: event.targetType,
      isRecurring: (event as any).isRecurring,
      recurrencePattern: (event as any).recurrencePattern,
      reminders: event.reminders,
    }
  }));

  // Handle date click to create new event
  const handleDateClick = (arg: any) => {
    const clickedDate = new Date(arg.date);
    const formattedDate = clickedDate.toISOString().split('T')[0];
    
    setEventForm({
      ...eventForm,
      startDate: formattedDate,
      endDate: formattedDate,
    });
    setOpenEventDialog(true);
  };

  // Handle event click to view details
  const handleEventClick = (clickInfo: any) => {
    const event = events.find(e => e._id === clickInfo.event.id);
    if (event) {
      setSelectedEvent(event);
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

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

      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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
            textShadow: '0 2px 4px rgba(0,0,0,0.1)',
          }}
        >
          📅 Calendar Management
        </Typography>
        <NotificationIcon />
      </Box>
      
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'flex-end' }}>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => {
            resetEventForm();
            setOpenEventDialog(true);
          }}
          sx={{
            background: brandingGradient,
            borderRadius: 3,
            px: 3,
            '&:hover': {
              background: brandingGradientHover,
            },
          }}
        >
          Create Event
        </Button>
      </Box>

      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" onClose={() => setSuccess(null)} sx={{ mb: 2 }}>
          {success}
        </Alert>
      )}

      {/* Calendar View */}
      <Card 
        sx={{ 
          mb: 4, 
          borderRadius: 4,
          boxShadow: '0 10px 40px rgba(0,0,0,0.08)',
          overflow: 'hidden',
        }}
      >
        <Box
          sx={{
            background: brandingGradient,
            color: 'white',
            p: 2,
          }}
        >
          <Typography variant="h6" fontWeight={600}>
            📆 School Calendar
          </Typography>
          <Typography variant="body2" sx={{ opacity: 0.9 }}>
            Click on any date to create an event, or click on an event to view details
          </Typography>
        </Box>
        <CardContent sx={{ p: 3 }}>
          <Box
            sx={{
              '& .fc': {
                fontFamily: "'Inter', sans-serif",
              },
              '& .fc-toolbar-title': {
                fontSize: '1.5rem',
                fontWeight: 700,
                color: primaryColor,
              },
              '& .fc-button': {
                background: secondaryColor,
                border: 'none',
                borderRadius: '8px',
                padding: '8px 16px',
                fontWeight: 600,
                textTransform: 'capitalize',
                color: 'white',
                '&:hover': {
                  background: `${secondaryColor}dd`,
                },
                '&:disabled': {
                  opacity: 0.5,
                },
              },
              '& .fc-button-active': {
                background: `${secondaryColor}cc !important`,
              },
              '& .fc-day-today': {
                backgroundColor: `${brandingBgOpacity(0.1)} !important`,
              },
              '& .fc-daygrid-day:hover': {
                backgroundColor: brandingBgOpacity(0.05),
                cursor: 'pointer',
              },
              '& .fc-event': {
                borderRadius: '6px',
                padding: '4px 8px',
                marginBottom: '2px',
                cursor: 'pointer',
                fontWeight: 500,
                fontSize: '0.875rem',
                border: 'none',
                boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                transition: 'transform 0.2s, box-shadow 0.2s',
                '&:hover': {
                  transform: 'translateY(-2px)',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
                },
              },
              '& .fc-daygrid-day-number': {
                padding: '8px',
                fontWeight: 600,
                color: '#374151',
              },
              '& .fc-col-header-cell': {
                backgroundColor: '#f3f4f6',
                fontWeight: 700,
                padding: '12px 0',
                color: primaryColor,
                textTransform: 'uppercase',
                fontSize: '0.75rem',
                letterSpacing: '0.05em',
              },
              '& .fc-scrollgrid': {
                border: 'none',
              },
              '& .fc-daygrid-day': {
                border: '1px solid #e5e7eb',
              },
            }}
          >
            <FullCalendar
              plugins={[dayGridPlugin, interactionPlugin, listPlugin]}
              initialView="dayGridMonth"
              headerToolbar={{
                left: 'prev,next today',
                center: 'title',
                right: 'dayGridMonth,listWeek'
              }}
              events={calendarEvents}
              dateClick={handleDateClick}
              eventClick={handleEventClick}
              height="auto"
              eventDisplay="block"
              displayEventTime={false}
              dayMaxEvents={3}
              moreLinkText="more"
              firstDay={1} // Start week on Monday
            />
          </Box>
        </CardContent>
      </Card>

      <Divider sx={{ my: 4 }} />

      {/* Events List */}
      <Typography variant="h5" sx={{ mb: 3, fontWeight: 700, color: '#374151' }}>
        📋 All Events
      </Typography>

      <TableContainer component={Paper} sx={{ borderRadius: 3, boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}>
        <Table>
          <TableHead>
            <TableRow sx={{ background: brandingGradient }}>
              <TableCell sx={{ color: 'white', fontWeight: 600 }}>Event</TableCell>
              <TableCell sx={{ color: 'white', fontWeight: 600 }}>Date</TableCell>
              <TableCell sx={{ color: 'white', fontWeight: 600 }}>Category</TableCell>
              <TableCell sx={{ color: 'white', fontWeight: 600 }}>Target</TableCell>
              <TableCell sx={{ color: 'white', fontWeight: 600 }}>Reminders Sent</TableCell>
              <TableCell sx={{ color: 'white', fontWeight: 600 }}>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {events.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center">
                  <Typography variant="body2" color="text.secondary" py={3}>
                    No events created yet. Click on any date in the calendar to create an event.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              events.map((event) => (
                <TableRow key={event._id} hover>
                  <TableCell>
                    <Box>
                      <Typography variant="subtitle2" fontWeight={600}>
                        {event.title}
                      </Typography>
                      {event.location && (
                        <Typography variant="caption" color="text.secondary">
                          📍 {event.location}
                        </Typography>
                      )}
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {formatDate(event.startDate)}
                      {event.isMultiDay && ` - ${formatDate(event.endDate)}`}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={getCategoryLabel(event.category)}
                      size="small"
                      sx={{
                        backgroundColor: getCategoryColor(event.category),
                        color: 'white',
                        fontWeight: 600,
                      }}
                    />
                  </TableCell>
                  <TableCell>
                    <Chip 
                      label={event.targetType.toUpperCase()} 
                      size="small"
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                      <Chip
                        icon={<Email sx={{ fontSize: 14 }} />}
                        label={event.reminders.immediate.recipientCount}
                        size="small"
                        color={event.reminders.immediate.sent ? 'success' : 'default'}
                        sx={{ minWidth: 50 }}
                      />
                      <Chip
                        label={`2d: ${event.reminders.twoDaysBefore.recipientCount}`}
                        size="small"
                        color={event.reminders.twoDaysBefore.sent ? 'success' : 'default'}
                        sx={{ minWidth: 50 }}
                      />
                      <Chip
                        label={`1d: ${event.reminders.oneDayBefore.recipientCount}`}
                        size="small"
                        color={event.reminders.oneDayBefore.sent ? 'success' : 'default'}
                        sx={{ minWidth: 50 }}
                      />
                    </Box>
                  </TableCell>
                  <TableCell>
                    <IconButton
                      size="small"
                      onClick={() => handleDeleteEvent(event._id)}
                      color="error"
                    >
                      <Delete />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Create Event Dialog */}
      <Dialog open={openEventDialog} onClose={() => setOpenEventDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ 
          background: brandingGradient,
          color: 'white',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <Typography variant="h6" fontWeight={600}>
            📅 {isEditingEvent ? 'Edit Event' : 'Create New Event'}
          </Typography>
          <IconButton onClick={() => setOpenEventDialog(false)} sx={{ color: 'white' }}>
            <Close />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ p: 3, pt: '24px !important' }}>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Event Title"
                value={eventForm.title}
                onChange={(e) => {
                  console.log('Event title changed:', e.target.value);
                  setEventForm({ ...eventForm, title: e.target.value });
                }}
                required
                placeholder="e.g., Parent-Teacher Conference"
                error={Boolean(!eventForm.title && eventForm.title !== '')}
                helperText={!eventForm.title && eventForm.title !== '' ? "Event title is required" : ""}
              />
            </Grid>
            <Grid item xs={12}>
              <Typography variant="body2" sx={{ mb: 1, fontWeight: 500, color: 'text.secondary' }}>
                Description
              </Typography>
              <RichTextEditor
                value={eventForm.description}
                onChange={(value) => setEventForm({ ...eventForm, description: value })}
                placeholder="Provide details about the event..."
                minHeight={150}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Start Date"
                type="date"
                value={eventForm.startDate}
                onChange={(e) => setEventForm({ ...eventForm, startDate: e.target.value })}
                InputLabelProps={{ shrink: true }}
                required
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="End Date"
                type="date"
                value={eventForm.endDate}
                onChange={(e) => setEventForm({ ...eventForm, endDate: e.target.value })}
                InputLabelProps={{ shrink: true }}
                required
                error={Boolean(eventForm.startDate && eventForm.endDate && new Date(eventForm.endDate) < new Date(eventForm.startDate))}
                helperText={eventForm.startDate && eventForm.endDate && new Date(eventForm.endDate) < new Date(eventForm.startDate) ? "End date must be after or equal to start date" : ""}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Reminder Time"
                type="time"
                value={eventForm.reminderTime}
                onChange={(e) => setEventForm({ ...eventForm, reminderTime: e.target.value })}
                InputLabelProps={{ shrink: true }}
                helperText="What time should reminders be sent?"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Category</InputLabel>
                <Select
                  value={eventForm.category}
                  label="Category"
                  onChange={(e) => setEventForm({ ...eventForm, category: e.target.value })}
                >
                  {categories.map((cat) => (
                    <MenuItem key={cat.value} value={cat.value}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box
                          sx={{
                            width: 12,
                            height: 12,
                            borderRadius: '50%',
                            backgroundColor: cat.color,
                          }}
                        />
                        {cat.label}
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Location"
                value={eventForm.location}
                onChange={(e) => setEventForm({ ...eventForm, location: e.target.value })}
                placeholder="e.g., School Auditorium"
              />
            </Grid>
            <Grid item xs={12}>
              <FormControl fullWidth>
                <InputLabel>Send To</InputLabel>
                <Select
                  value={eventForm.targetType}
                  label="Send To"
                  onChange={(e) => setEventForm({ ...eventForm, targetType: e.target.value as any })}
                >
                  <MenuItem value="all">All Parents</MenuItem>
                  <MenuItem value="grade">Specific Grade</MenuItem>
                  <MenuItem value="class">Specific Class</MenuItem>
                  <MenuItem value="group">Parent Group</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            {eventForm.targetType === 'grade' && (
              <Grid item xs={12}>
                <FormControl fullWidth>
                  <InputLabel>Select Grade</InputLabel>
                  <Select
                    value={eventForm.targetGrade}
                    label="Select Grade"
                    onChange={(e) => setEventForm({ ...eventForm, targetGrade: e.target.value })}
                  >
                    {school.gradeLevels.map((grade: string) => (
                      <MenuItem key={grade} value={grade}>
                        {grade}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            )}

            {eventForm.targetType === 'class' && (
              <Grid item xs={12}>
                <FormControl fullWidth>
                  <InputLabel>Select Class</InputLabel>
                  <Select
                    value={eventForm.targetClass}
                    label="Select Class"
                    onChange={(e) => setEventForm({ ...eventForm, targetClass: e.target.value })}
                  >
                    {classes.map((cls: any) => (
                      <MenuItem key={cls._id} value={cls._id}>
                        {cls.name} - {cls.grade}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            )}

            {eventForm.targetType === 'group' && (
              <Grid item xs={12}>
                <FormControl fullWidth>
                  <InputLabel>Select Parent Group</InputLabel>
                  <Select
                    value={eventForm.targetGroup}
                    label="Select Parent Group"
                    onChange={(e) => setEventForm({ ...eventForm, targetGroup: e.target.value })}
                  >
                    {parentGroups.map((group) => (
                      <MenuItem key={group._id} value={group._id}>
                        {group.name} ({group.memberCount} members)
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            )}

            {/* Recurring Event Section */}
            <Grid item xs={12}>
              <Divider sx={{ my: 2 }} />
              <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                🔄 Recurring Event Settings
              </Typography>
            </Grid>

            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={eventForm.isRecurring}
                    onChange={(e) => setEventForm({ 
                      ...eventForm, 
                      isRecurring: e.target.checked,
                      recurrencePattern: e.target.checked ? 'weekly' : 'none'
                    })}
                    color="primary"
                  />
                }
                label="Make this a recurring event"
              />
            </Grid>

            {eventForm.isRecurring && (
              <>
                <Grid item xs={12} md={6}>
                  <FormControl fullWidth>
                    <InputLabel>Recurrence Pattern</InputLabel>
                    <Select
                      value={eventForm.recurrencePattern}
                      label="Recurrence Pattern"
                      onChange={(e) => setEventForm({ ...eventForm, recurrencePattern: e.target.value })}
                    >
                      <MenuItem value="daily">Daily</MenuItem>
                      <MenuItem value="weekly">Weekly</MenuItem>
                      <MenuItem value="biweekly">Bi-weekly (Every 2 weeks)</MenuItem>
                      <MenuItem value="monthly">Monthly</MenuItem>
                      <MenuItem value="custom">Custom</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>

                {eventForm.recurrencePattern === 'custom' && (
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="Repeat Every (days)"
                      type="number"
                      value={eventForm.recurrenceInterval}
                      onChange={(e) => setEventForm({ ...eventForm, recurrenceInterval: parseInt(e.target.value) || 1 })}
                      InputProps={{ inputProps: { min: 1, max: 365 } }}
                      helperText="Number of days between occurrences"
                    />
                  </Grid>
                )}

                {eventForm.recurrencePattern === 'weekly' && (
                  <Grid item xs={12}>
                    <Typography variant="body2" gutterBottom>
                      Repeat on:
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                      {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, index) => (
                        <Chip
                          key={day}
                          label={day}
                          onClick={() => {
                            const days = [...eventForm.recurrenceDays];
                            if (days.includes(index)) {
                              setEventForm({ ...eventForm, recurrenceDays: days.filter(d => d !== index) });
                            } else {
                              setEventForm({ ...eventForm, recurrenceDays: [...days, index].sort() });
                            }
                          }}
                          color={eventForm.recurrenceDays.includes(index) ? 'primary' : 'default'}
                          variant={eventForm.recurrenceDays.includes(index) ? 'filled' : 'outlined'}
                        />
                      ))}
                    </Box>
                  </Grid>
                )}

                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="End Date (optional)"
                    type="date"
                    value={eventForm.recurrenceEndDate}
                    onChange={(e) => setEventForm({ ...eventForm, recurrenceEndDate: e.target.value })}
                    InputLabelProps={{ shrink: true }}
                    helperText="Leave empty for ongoing recurrence"
                  />
                </Grid>

                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Maximum Occurrences (optional)"
                    type="number"
                    value={eventForm.recurrenceCount || ''}
                    onChange={(e) => setEventForm({ ...eventForm, recurrenceCount: e.target.value ? parseInt(e.target.value) : null })}
                    InputProps={{ inputProps: { min: 1, max: 100 } }}
                    helperText="Maximum number of times this event repeats"
                  />
                </Grid>

                <Grid item xs={12}>
                  <Box sx={{ 
                    p: 2, 
                    bgcolor: '#f3f4f6', 
                    borderRadius: 2,
                    border: '1px solid #e5e7eb'
                  }}>
                    <Typography variant="body2" color="text.secondary">
                      ℹ️ <strong>Note:</strong> This will create multiple event instances based on your recurrence settings.
                      {eventForm.recurrencePattern === 'weekly' && eventForm.recurrenceDays.length === 0 && (
                        <span style={{ color: '#ef4444' }}> Please select at least one day for weekly recurrence.</span>
                      )}
                    </Typography>
                  </Box>
                </Grid>
              </>
            )}

            {/* Attachments Section */}
            <Grid item xs={12}>
              <Divider sx={{ my: 2 }} />
              <Typography variant="subtitle1" fontWeight={600} gutterBottom>
                📎 Attachments
              </Typography>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Add files to include with event notifications (PDFs, images, videos, documents)
              </Typography>
            </Grid>

            <Grid item xs={12}>
              <Button
                component="label"
                variant="outlined"
                startIcon={uploadingFile ? <CircularProgress size={20} /> : <CloudUpload />}
                disabled={uploadingFile}
                sx={{ mb: 2 }}
              >
                {uploadingFile ? 'Uploading...' : 'Upload File'}
                <input
                  type="file"
                  hidden
                  onChange={handleFileUpload}
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif,.mp4,.mov,.avi"
                />
              </Button>
              <Typography variant="caption" display="block" color="text.secondary">
                Maximum file size: 50MB. Supported: PDF, Word, Excel, Images, Videos
              </Typography>
            </Grid>

            {uploadedAttachments.length > 0 && (
              <Grid item xs={12}>
                <Box sx={{ 
                  border: '1px solid #e5e7eb',
                  borderRadius: 2,
                  p: 2,
                  bgcolor: '#f9fafb'
                }}>
                  <Typography variant="body2" fontWeight={600} gutterBottom>
                    Attached Files ({uploadedAttachments.length})
                  </Typography>
                  {uploadedAttachments.map((attachment, index) => (
                    <Box
                      key={index}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        p: 1.5,
                        mb: 1,
                        bgcolor: 'white',
                        borderRadius: 1,
                        border: '1px solid #e5e7eb',
                        '&:last-child': { mb: 0 }
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1 }}>
                        <Typography variant="h6">{getFileIcon(attachment.mimeType)}</Typography>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography variant="body2" fontWeight={500} noWrap>
                            {attachment.originalName}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {formatFileSize(attachment.size)}
                          </Typography>
                        </Box>
                      </Box>
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => handleRemoveAttachment(index)}
                        title="Remove attachment"
                      >
                        <Delete />
                      </IconButton>
                    </Box>
                  ))}
                  <Box sx={{ mt: 2, p: 1.5, bgcolor: '#ecfdf5', borderRadius: 1, border: '1px solid #10b981' }}>
                    <Typography variant="body2" color="text.secondary">
                      ✉️ These files will be automatically attached to all event notification emails.
                    </Typography>
                  </Box>
                </Box>
              </Grid>
            )}
          </Grid>
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 0 }}>
          <Button onClick={() => setOpenEventDialog(false)} variant="outlined">
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleEventSubmit}
            disabled={!eventForm.title || !eventForm.startDate || !eventForm.endDate || (eventForm.startDate && eventForm.endDate && new Date(eventForm.endDate) < new Date(eventForm.startDate))}
            sx={{
              background: brandingGradient,
              px: 3,
              '&:hover': {
                background: brandingGradientHover,
              },
            }}
          >
            {isEditingEvent ? 'Update Event' : 'Create Event'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Event Details Dialog */}
      <Dialog 
        open={!!selectedEvent} 
        onClose={() => setSelectedEvent(null)} 
        maxWidth="md" 
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 4,
            boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
            overflow: 'hidden',
          }
        }}
      >
        {selectedEvent && (
          <>
            {/* Header with gradient background */}
            <DialogTitle sx={{
              background: `linear-gradient(135deg, ${getCategoryColor(selectedEvent.category)} 0%, ${getCategoryColor(selectedEvent.category)}dd 100%)`,
              color: 'white',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              p: 3,
              position: 'relative',
              '&::after': {
                content: '""',
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                height: '1px',
                background: 'rgba(255,255,255,0.2)',
              }
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Box
                  sx={{
                    width: 48,
                    height: 48,
                    borderRadius: 3,
                    backgroundColor: 'rgba(255,255,255,0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backdropFilter: 'blur(10px)',
                  }}
                >
                  <EventIcon sx={{ fontSize: 24, color: 'white' }} />
                </Box>
                <Box>
                  <Typography variant="h5" fontWeight={700} sx={{ mb: 0.5 }}>
                    {selectedEvent.title}
                  </Typography>
                  <Chip
                    label={getCategoryLabel(selectedEvent.category)}
                    size="small"
                    sx={{
                      backgroundColor: 'rgba(255,255,255,0.2)',
                      color: 'white',
                      fontWeight: 600,
                      backdropFilter: 'blur(10px)',
                    }}
                  />
                </Box>
              </Box>
              <IconButton 
                onClick={() => setSelectedEvent(null)} 
                sx={{ 
                  color: 'white',
                  backgroundColor: 'rgba(255,255,255,0.1)',
                  '&:hover': {
                    backgroundColor: 'rgba(255,255,255,0.2)',
                  }
                }}
              >
                <Close />
              </IconButton>
            </DialogTitle>

            {/* Content */}
            <DialogContent sx={{ p: 0, pt: 0 }}>
              <Box sx={{ p: 3, pt: '24px !important' }}>
                {/* Date and Time Section */}
                <Box sx={{ 
                  display: 'flex', 
                  gap: 3, 
                  mb: 3,
                  p: 2,
                  backgroundColor: '#f8fafc',
                  borderRadius: 3,
                  border: '1px solid #e2e8f0',
                }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <Box
                      sx={{
                        width: 40,
                        height: 40,
                        borderRadius: 2,
                        backgroundColor: primaryColor,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <EventIcon sx={{ fontSize: 20, color: 'white' }} />
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                        Event Date
                      </Typography>
                      <Typography variant="h6" fontWeight={700} color="#1a202c">
                        {formatDate(selectedEvent.startDate)}
                        {selectedEvent.isMultiDay && ` - ${formatDate(selectedEvent.endDate)}`}
                      </Typography>
                    </Box>
                  </Box>

                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <Box
                      sx={{
                        width: 40,
                        height: 40,
                        borderRadius: 2,
                        backgroundColor: '#f59e0b',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Typography sx={{ fontSize: 14, fontWeight: 700, color: 'white' }}>
                        {selectedEvent.reminderTime}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                        Reminder Time
                      </Typography>
                      <Typography variant="body1" fontWeight={600} color="#1a202c">
                        {selectedEvent.reminderTime}
                      </Typography>
                    </Box>
                  </Box>
                </Box>

                {/* Location Section */}
                {selectedEvent.location && (
                  <Box sx={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 2, 
                    mb: 3,
                    p: 2,
                    backgroundColor: '#f0f9ff',
                    borderRadius: 3,
                    border: '1px solid #bae6fd',
                  }}>
                    <Box
                      sx={{
                        width: 40,
                        height: 40,
                        borderRadius: 2,
                        backgroundColor: '#0ea5e9',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Typography sx={{ fontSize: 18 }}>📍</Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                        Location
                      </Typography>
                      <Typography variant="body1" fontWeight={600} color="#1a202c">
                        {selectedEvent.location}
                      </Typography>
                    </Box>
                  </Box>
                )}

                {/* Description Section */}
                {selectedEvent.description && (
                  <Box sx={{ mb: 3 }}>
                    <Typography variant="subtitle2" fontWeight={700} color="#374151" sx={{ mb: 1.5 }}>
                      📝 Description
                    </Typography>
                    <Box sx={{ 
                      p: 2.5, 
                      backgroundColor: '#f9fafb', 
                      borderRadius: 3,
                      border: '1px solid #e5e7eb',
                      '& .ql-editor': {
                        padding: 0,
                        fontSize: '1rem',
                        lineHeight: 1.6,
                        color: '#4b5563',
                      },
                      '& p': {
                        margin: 0,
                        marginBottom: '0.5rem',
                        '&:last-child': {
                          marginBottom: 0,
                        },
                      },
                      '& ul, & ol': {
                        margin: '0.5rem 0',
                        paddingLeft: '1.5rem',
                      },
                      '& h1, & h2, & h3': {
                        margin: '0.5rem 0',
                        fontWeight: 600,
                      },
                      '& a': {
                        color: primaryColor,
                        textDecoration: 'none',
                        '&:hover': {
                          textDecoration: 'underline',
                        },
                      },
                    }}>
                      <Box
                        component="div"
                        dangerouslySetInnerHTML={{ __html: selectedEvent.description }}
                        sx={{
                          fontSize: '1rem',
                          lineHeight: 1.6,
                          color: '#4b5563',
                        }}
                      />
                    </Box>
                  </Box>
                )}

                {/* Reminder Status Section */}
                <Box>
                  <Typography variant="subtitle2" fontWeight={700} color="#374151" sx={{ mb: 2 }}>
                    📬 Reminder Status
                  </Typography>
                  <Box sx={{ 
                    display: 'grid', 
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: 2,
                  }}>
                    {/* Immediate Reminder */}
                    <Box sx={{
                      p: 2.5,
                      borderRadius: 3,
                      border: `2px solid ${selectedEvent.reminders.immediate.sent ? '#10b981' : '#e5e7eb'}`,
                      backgroundColor: selectedEvent.reminders.immediate.sent ? '#f0fdf4' : '#f9fafb',
                      transition: 'all 0.2s',
                    }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
                        <Email sx={{ 
                          fontSize: 20, 
                          color: selectedEvent.reminders.immediate.sent ? '#10b981' : '#6b7280' 
                        }} />
                        <Typography variant="subtitle2" fontWeight={700} color="#374151">
                          Immediate
                        </Typography>
                      </Box>
                      <Typography variant="h6" fontWeight={700} color={selectedEvent.reminders.immediate.sent ? '#10b981' : '#6b7280'}>
                        {selectedEvent.reminders.immediate.recipientCount} sent
                      </Typography>
                      {selectedEvent.reminders.immediate.sentAt && (
                        <Typography variant="caption" color="text.secondary">
                          {new Date(selectedEvent.reminders.immediate.sentAt).toLocaleString()}
                        </Typography>
                      )}
                    </Box>

                    {/* 2 Days Before */}
                    <Box sx={{
                      p: 2.5,
                      borderRadius: 3,
                      border: `2px solid ${selectedEvent.reminders.twoDaysBefore.sent ? '#10b981' : '#e5e7eb'}`,
                      backgroundColor: selectedEvent.reminders.twoDaysBefore.sent ? '#f0fdf4' : '#f9fafb',
                      transition: 'all 0.2s',
                    }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
                        <Sms sx={{ 
                          fontSize: 20, 
                          color: selectedEvent.reminders.twoDaysBefore.sent ? '#10b981' : '#6b7280' 
                        }} />
                        <Typography variant="subtitle2" fontWeight={700} color="#374151">
                          2 Days Before
                        </Typography>
                      </Box>
                      <Typography variant="h6" fontWeight={700} color={selectedEvent.reminders.twoDaysBefore.sent ? '#10b981' : '#6b7280'}>
                        {selectedEvent.reminders.twoDaysBefore.recipientCount} sent
                      </Typography>
                      {selectedEvent.reminders.twoDaysBefore.sentAt && (
                        <Typography variant="caption" color="text.secondary">
                          {new Date(selectedEvent.reminders.twoDaysBefore.sentAt).toLocaleString()}
                        </Typography>
                      )}
                    </Box>

                    {/* 1 Day Before */}
                    <Box sx={{
                      p: 2.5,
                      borderRadius: 3,
                      border: `2px solid ${selectedEvent.reminders.oneDayBefore.sent ? '#10b981' : '#e5e7eb'}`,
                      backgroundColor: selectedEvent.reminders.oneDayBefore.sent ? '#f0fdf4' : '#f9fafb',
                      transition: 'all 0.2s',
                    }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
                        <WhatsApp sx={{ 
                          fontSize: 20, 
                          color: selectedEvent.reminders.oneDayBefore.sent ? '#10b981' : '#6b7280' 
                        }} />
                        <Typography variant="subtitle2" fontWeight={700} color="#374151">
                          1 Day Before
                        </Typography>
                      </Box>
                      <Typography variant="h6" fontWeight={700} color={selectedEvent.reminders.oneDayBefore.sent ? '#10b981' : '#6b7280'}>
                        {selectedEvent.reminders.oneDayBefore.recipientCount} sent
                      </Typography>
                      {selectedEvent.reminders.oneDayBefore.sentAt && (
                        <Typography variant="caption" color="text.secondary">
                          {new Date(selectedEvent.reminders.oneDayBefore.sentAt).toLocaleString()}
                        </Typography>
                      )}
                    </Box>
                  </Box>
                </Box>
              </Box>
            </DialogContent>

            {/* Actions */}
            <DialogActions sx={{ 
              p: 3, 
              pt: 0,
              borderTop: '1px solid #e5e7eb',
              backgroundColor: '#f9fafb',
            }}>
              <Button
                onClick={() => handleDeleteEvent(selectedEvent._id)}
                color="error"
                variant="outlined"
                startIcon={<Delete />}
                sx={{
                  borderRadius: 2,
                  px: 3,
                  py: 1,
                  fontWeight: 600,
                  borderWidth: 2,
                  '&:hover': {
                    borderWidth: 2,
                  }
                }}
              >
                Delete Event
              </Button>
              <Button
                onClick={() => handleEditEvent(selectedEvent)}
                variant="contained"
                startIcon={<Edit />}
                sx={{
                  borderRadius: 2,
                  px: 3,
                  py: 1,
                  fontWeight: 600,
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  '&:hover': {
                    background: 'linear-gradient(135deg, #0d9d6b 0%, #047857 100%)',
                  }
                }}
              >
                Edit Event
              </Button>
              <Button 
                onClick={() => setSelectedEvent(null)} 
                variant="contained"
                sx={{
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  borderRadius: 2,
                  px: 3,
                  py: 1,
                  fontWeight: 600,
                  '&:hover': {
                    background: 'linear-gradient(135deg, #5568d3 0%, #653a8b 100%)',
                  }
                }}
              >
                Close
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Box>
  );
};

export default CalendarManagement;
