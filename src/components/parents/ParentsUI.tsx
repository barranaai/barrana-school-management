import React, { useState } from 'react';
import {
  Box,
  List,
  Typography,
  Divider,
  IconButton,
  ListItem,
  ListItemIcon,
  ListItemText,
  Avatar,
  Card,
  CardContent,
  Grid,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Badge,
  ListItemAvatar,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  ListItemSecondaryAction,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem, // MenuItem for Select dropdowns
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  ThemeProvider,
} from '@mui/material';
import parentTheme, { themeColors, createParentTheme } from '../../theme/parentTheme';
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
  ChevronLeft,
  ChevronRight,
  FilterList,
  Clear,
  CalendarToday,
  Description,
  AttachFile,
  Image,
  VideoLibrary,
  Close,
  ArrowBack,
  ArrowForward,
  AccessTime,
  LocationOn,
  Event,
  Description as DescriptionIcon,
  Download,
  FilePresent,
  Image as ImageIcon,
  VideoLibrary as VideoIcon,
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { useData } from '../../contexts/DataContext';
import NotificationIcon from '../common/NotificationIcon';
import notificationService from '../../services/notificationService';
import CommunicationPage from './CommunicationPage';

const drawerWidth = 250;

const menuItems = [
  { text: 'Dashboard', icon: <Dashboard />, section: 'dashboard' },
  { text: 'My Children', icon: <People />, section: 'children' },
  { text: 'Reports', icon: <Assessment />, section: 'reports' },
  { text: 'Communication', icon: <Message />, section: 'communication' },
  { text: 'Settings', icon: <Settings />, section: 'settings' },
];

const ParentsUI: React.FC = () => {
  const [currentSection, setCurrentSection] = useState('dashboard');
  const [openReportDialog, setOpenReportDialog] = useState(false);
  const [selectedReport, setSelectedReport] = useState<any>(null);
  const [openMessageDialog, setOpenMessageDialog] = useState(false);
  const [children, setChildren] = useState<any[]>([]);
  const [parentReports, setParentReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [schoolBranding, setSchoolBranding] = useState<any>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedChildFilter, setSelectedChildFilter] = useState<string | null>(null);
  const [reportTypeFilter, setReportTypeFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('all');
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxMedia, setLightboxMedia] = useState<any[]>([]);
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  
  const { user, logout } = useAuth();
  const { students, reports, parents, teachers } = useData();

  // Fetch parent's children and reports from API
  React.useEffect(() => {
    const fetchParentData = async () => {
      try {
        setLoading(true);
        
        // Fetch children
        const childrenResponse = await fetch('/api/parents/me/children', {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });
        const childrenData = await childrenResponse.json();
        
        if (childrenData.success) {
          // Store the full child data for use in the UI
          setChildren(childrenData.data);
        }
        
        // Fetch reports
        const reportsResponse = await fetch('/api/parents/me/reports', {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });
        const reportsData = await reportsResponse.json();
        
        if (reportsData.success) {
          console.log('📊 Reports data received:', reportsData.data);
          if (reportsData.data.length > 0) {
            console.log('📄 First report structure:', reportsData.data[0]);
            console.log('📄 Student ID:', reportsData.data[0].studentId);
            console.log('📄 Teacher ID:', reportsData.data[0].teacherId);
            console.log('📄 Template ID:', reportsData.data[0].templateId);
            console.log('📄 PDF URL:', reportsData.data[0].pdfUrl);
            console.log('📄 PDF Path:', reportsData.data[0].pdfPath);
          }
          // Keep the original report structure to access all nested properties
          setParentReports(reportsData.data);
        }
        
        // Fetch school branding
        const brandingResponse = await fetch('/api/parents/me/school-branding', {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });
        const brandingData = await brandingResponse.json();
        
        if (brandingData.success) {
          console.log('School branding data:', JSON.stringify(brandingData.data, null, 2));
          console.log('Logo value:', brandingData.data.logo);
          console.log('School name:', brandingData.data.schoolName);
          setSchoolBranding(brandingData.data);
        }

        // Fetch events
        const eventsResponse = await fetch('/api/parents/me/events', {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });
        const eventsData = await eventsResponse.json();
        
        console.log('Events API response:', eventsData);
        
        if (eventsData.success) {
          console.log('Events data:', eventsData.data);
          setEvents(eventsData.data || []);
        }

        // Fetch notifications
        const notificationsResponse = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:5050'}/parents/me/notifications`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        });
        const notificationsData = await notificationsResponse.json();
        
        if (notificationsData.success) {
          console.log('Notifications data:', notificationsData.data);
          setNotifications(notificationsData.data || []);
          setUnreadCount(notificationsData.unreadCount || 0);
        }
        
      } catch (error) {
        console.error('Error fetching parent data:', error);
      } finally {
        setLoading(false);
      }
    };

    if (user?.role === 'parent') {
      fetchParentData();
    }
  }, [user]);

  // Initialize push notifications for parents
  React.useEffect(() => {
    const initNotifications = async () => {
      if (user?.role === 'parent') {
        try {
          // Set up notification handler first
          const onNotificationReceived = (payload: any) => {
            console.log('🔔 Push notification received:', payload);
            
            // Handle notification click based on type
            if (payload.data?.type === 'report_generated' || payload.data?.type === 'report_sent') {
              // Navigate to reports page for report notifications
              setCurrentSection('reports');
              
              if (payload.data?.reportId) {
                console.log('Report notification clicked, reportId:', payload.data.reportId);
              }
              
              // Refresh reports and notifications data
              const refreshData = async () => {
                try {
                  // Refresh reports
                  const reportsResponse = await fetch('/api/parents/me/reports', {
                    headers: {
                      'Authorization': `Bearer ${localStorage.getItem('token')}`
                    }
                  });
                  if (reportsResponse.ok) {
                    const reportsData = await reportsResponse.json();
                    setParentReports(reportsData.data || []);
                  }
                  
                  // Refresh notifications
                  const notificationsResponse = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:5050'}/parents/me/notifications`, {
                    headers: {
                      'Authorization': `Bearer ${localStorage.getItem('token')}`
                    }
                  });
                  if (notificationsResponse.ok) {
                    const notificationsData = await notificationsResponse.json();
                    setNotifications(notificationsData.data || []);
                    setUnreadCount(notificationsData.unreadCount || 0);
                  }
                } catch (error) {
                  console.error('Error refreshing data:', error);
                }
              };
              
              refreshData();
            } else if (payload.data?.type === 'event_created' || payload.data?.type === 'event_updated') {
              // Navigate to dashboard (which shows calendar) for event notifications
              setCurrentSection('dashboard');
              
              if (payload.data?.eventId) {
                console.log('Event notification clicked, eventId:', payload.data.eventId);
              }
              
              // Refresh events and notifications data
              const refreshData = async () => {
                try {
                  // Refresh events
                  const eventsResponse = await fetch('/api/parents/me/events', {
                    headers: {
                      'Authorization': `Bearer ${localStorage.getItem('token')}`
                    }
                  });
                  if (eventsResponse.ok) {
                    const eventsData = await eventsResponse.json();
                    setEvents(eventsData.data || []);
                  }
                  
                  // Refresh notifications
                  const notificationsResponse = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:5050'}/parents/me/notifications`, {
                    headers: {
                      'Authorization': `Bearer ${localStorage.getItem('token')}`
                    }
                  });
                  if (notificationsResponse.ok) {
                    const notificationsData = await notificationsResponse.json();
                    setNotifications(notificationsData.data || []);
                    setUnreadCount(notificationsData.unreadCount || 0);
                  }
                } catch (error) {
                  console.error('Error refreshing data:', error);
                }
              };
              
              refreshData();
            }
          };
          
          // Use the notification service but override the registration endpoint for parents
          const success = await notificationService.initializePushNotifications(onNotificationReceived);
          
          if (success) {
            console.log('✅ Push notifications initialized successfully for parent');
          } else {
            console.warn('⚠️ Push notifications initialization failed or not supported');
          }
        } catch (error) {
          console.error('❌ Error initializing push notifications:', error);
        }
      }
    };

    initNotifications();
  }, [user]);

  const handleLogout = () => {
    logout();
  };

  const handleViewReport = (report: any) => {
    setSelectedReport(report);
    setOpenReportDialog(true);
  };

  const handleOpenPdf = async (pdfUrl: string) => {
    try {
      console.log('Fetching PDF:', pdfUrl);
      
      // Fetch the PDF with authentication
      const response = await fetch(pdfUrl, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch PDF: ${response.status}`);
      }

      // Convert to blob and open in new tab
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      window.open(blobUrl, '_blank');
      
      // Clean up blob URL after a delay
      setTimeout(() => URL.revokeObjectURL(blobUrl), 100);
    } catch (error) {
      console.error('Error opening PDF:', error);
      alert('Failed to open PDF. Please try again.');
    }
  };

  const handleOpenLightbox = (attachments: any[], startIndex: number = 0) => {
    // Convert media URLs to full paths
    const mediaWithUrls = attachments.map((att: any) => ({
      ...att,
      fullUrl: getMediaUrl(att.url)
    }));
    setLightboxMedia(mediaWithUrls);
    setCurrentMediaIndex(startIndex);
    setLightboxOpen(true);
  };

  const handleCloseLightbox = () => {
    setLightboxOpen(false);
    setLightboxMedia([]);
    setCurrentMediaIndex(0);
  };

  const handleNextMedia = () => {
    setCurrentMediaIndex((prev) => (prev + 1) % lightboxMedia.length);
  };

  const handlePrevMedia = () => {
    setCurrentMediaIndex((prev) => (prev - 1 + lightboxMedia.length) % lightboxMedia.length);
  };

  const getMediaUrl = (url: string | undefined): string => {
    if (!url) return '';
    
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    
    // Convert relative URL to full server URL
    let baseUrl = process.env.REACT_APP_API_URL || 'http://localhost:5050';
    if (baseUrl.endsWith('/api')) {
      baseUrl = baseUrl.replace('/api', '');
    }
    
    const serverUrl = url.startsWith('/') ? url : '/' + url;
    return `${baseUrl}${serverUrl}`;
  };

  // Keyboard navigation for lightbox
  React.useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (!lightboxOpen) return;
      
      if (event.key === 'ArrowLeft') {
        handlePrevMedia();
      } else if (event.key === 'ArrowRight') {
        handleNextMedia();
      } else if (event.key === 'Escape') {
        handleCloseLightbox();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [lightboxOpen, lightboxMedia.length]);

  const handleContactTeacher = () => {
    setOpenMessageDialog(true);
  };

  // Calendar helper functions
  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();
    
    return { daysInMonth, startingDayOfWeek, firstDay, lastDay };
  };

  const getEventsForDate = (date: Date) => {
    const dayEvents = events.filter(event => {
      // Use startDate field from the Event model
      const eventDate = new Date(event.startDate || event.date);
      return eventDate.getDate() === date.getDate() &&
             eventDate.getMonth() === date.getMonth() &&
             eventDate.getFullYear() === date.getFullYear();
    });
    
    if (dayEvents.length > 0) {
      console.log(`Events for ${date.toDateString()}:`, dayEvents);
    }
    
    return dayEvents;
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentMonth(prevMonth => {
      const newMonth = new Date(prevMonth);
      if (direction === 'prev') {
        newMonth.setMonth(newMonth.getMonth() - 1);
      } else {
        newMonth.setMonth(newMonth.getMonth() + 1);
      }
      return newMonth;
    });
  };

  const renderSection = () => {
    switch (currentSection) {
      case 'dashboard':
        return <ParentDashboard 
          setLightboxOpen={setLightboxOpen}
          setLightboxMedia={setLightboxMedia}
          setCurrentMediaIndex={setCurrentMediaIndex}
        />;
      case 'children':
        return <ChildrenSection />;
      case 'reports':
        return <ReportsSection />;
      case 'communication':
        return <CommunicationSection />;
      case 'settings':
        return <SettingsSection />;
      default:
        return <ParentDashboard 
          setLightboxOpen={setLightboxOpen}
          setLightboxMedia={setLightboxMedia}
          setCurrentMediaIndex={setCurrentMediaIndex}
        />;
    }
  };

  const ParentDashboard = ({
    setLightboxOpen,
    setLightboxMedia,
    setCurrentMediaIndex
  }: {
    setLightboxOpen: (open: boolean) => void;
    setLightboxMedia: (media: any[]) => void;
    setCurrentMediaIndex: (index: number) => void;
  }) => {
    const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
    const [selectedEvent, setSelectedEvent] = useState<any>(null);
    const [openEventDialog, setOpenEventDialog] = useState(false);

    // Category colors matching admin section
    const getCategoryColor = (category?: string) => {
      const categories: { [key: string]: string } = {
        'holiday': '#ef4444',
        'meeting': '#667eea',
        'field_trip': '#10b981',
        'sports_day': '#f59e0b',
        'exam': '#dc2626',
        'parent_teacher_conference': '#8b5cf6',
        'workshop': '#06b6d4',
        'ceremony': '#ec4899',
        'other': '#6b7280',
      };
      return categories[category || 'other'] || '#6b7280';
    };

    // Filter events based on selected date
    const getFilteredEvents = () => {
      if (!selectedDate) {
        return events;
      }
      return events.filter(event => {
        const eventDate = new Date(event.startDate || event.date);
        return eventDate.getDate() === selectedDate.getDate() &&
               eventDate.getMonth() === selectedDate.getMonth() &&
               eventDate.getFullYear() === selectedDate.getFullYear();
      });
    };

    const filteredEvents = getFilteredEvents();

    // Handle date click
    const handleDateClick = (date: Date) => {
      const dayEvents = getEventsForDate(date);
      if (dayEvents.length > 0) {
        // Toggle selection: if same date clicked, deselect
        if (selectedDate && selectedDate.toDateString() === date.toDateString()) {
          setSelectedDate(null);
        } else {
          setSelectedDate(date);
        }
      }
    };

    return (
    <Box>
      <Typography variant="h4" sx={{ fontWeight: 700, mb: 3, textTransform: 'capitalize' }}>
        Welcome Back, {user?.firstName}!
      </Typography>
      
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
          <CircularProgress size={60} />
        </Box>
      ) : (
      <Box>
        {/* School Banner */}
        {schoolBranding && (() => {
          // Use school branding colors if available, otherwise use fallback colors
          const primaryColor = schoolBranding.branding?.primaryColor || '#273890';
          const secondaryColor = schoolBranding.branding?.secondaryColor || '#7f0f4a';
          
          return (
            <Card sx={{ 
              mb: 3,
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
                      {schoolBranding.schoolName || 'School Name'}
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
                          📍 {schoolBranding.address}
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
                          alt={schoolBranding.schoolName}
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                          sx={{
                            maxWidth: '100%',
                            maxHeight: '100%',
                            width: 'auto',
                            height: 'auto',
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
      
      <Grid container spacing={3}>
          {/* My Children Section */}
          <Grid item xs={12} lg={8}>
          <Card sx={{ 
            bgcolor: getRandomCardColor(0),
            mb: 3
          }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Typography variant="h5" sx={{ fontWeight: 600 }}>
                My Children
              </Typography>
                <Button 
                  variant="contained" 
                  sx={{ 
                    bgcolor: 'primary.main',
                    '&:hover': { bgcolor: 'primary.dark' } 
                  }}
                  onClick={() => {
                    setSelectedChildFilter(null);
                    setCurrentSection('children');
                  }}
                >
                  View All
                </Button>
              </Box>
              {children.length === 0 ? (
                <Typography variant="body2" sx={{ opacity: 0.9 }}>
                  No children found. Please contact your school administrator.
                </Typography>
              ) : (
              <Grid container spacing={2}>
                  {children.slice(0, 4).map((child) => {
                    const childAvatar = (child.firstName?.charAt(0) || '').toUpperCase() + (child.lastName?.charAt(0) || '').toUpperCase();
                    return (
                      <Grid item xs={12} sm={6} md={4} lg={3} key={child._id}>
                        <Card sx={{ bgcolor: 'rgba(255,255,255,0.95)', height: '100%' }}>
                          <CardContent sx={{ p: 2 }}>
                            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                              <Avatar sx={{ bgcolor: 'primary.main', width: 56, height: 56, mb: 1.5, fontSize: '1.5rem', fontWeight: 700 }}>
                                {childAvatar}
                          </Avatar>
                              <Typography variant="h6" sx={{ textTransform: 'capitalize', fontSize: '0.95rem', fontWeight: 600, mb: 0.5 }}>
                                {child.firstName} {child.lastName}
                              </Typography>
                              <Typography variant="body2" color="text.secondary" sx={{ textTransform: 'capitalize', fontSize: '0.8rem', mb: 1 }}>
                                {child.classId?.name || 'Not assigned'}
                              </Typography>
                              <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'capitalize', fontSize: '0.75rem' }}>
                                Teacher: {child.teacher?.name || 'Not assigned'}
                              </Typography>
                            </Box>
                          </CardContent>
                        </Card>
                      </Grid>
                    );
                  })}
                </Grid>
              )}
            </CardContent>
          </Card>

          {/* Latest Reports Section */}
          <Card sx={{ mb: 3, bgcolor: getRandomCardColor(1) }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                <Typography variant="h5" sx={{ fontWeight: 600 }}>
                  Latest Reports
                </Typography>
                <Button 
                  variant="outlined" 
                  onClick={() => {
                    setSelectedChildFilter(null);
                    setCurrentSection('reports');
                  }}
                >
                  View All
                </Button>
              </Box>
              {parentReports.length === 0 ? (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <Typography variant="body1" color="text.secondary">
                    No reports available yet
                  </Typography>
                </Box>
              ) : (
                          <Box>
                  {parentReports.slice(0, 3).map((report) => (
                    <Card 
                      key={report._id} 
                      variant="outlined" 
                      sx={{ 
                        mb: 2,
                        bgcolor: 'rgba(255,255,255,0.95)',
                        transition: 'all 0.3s ease',
                        '&:hover': { 
                          boxShadow: 3,
                          transform: 'translateY(-2px)'
                        }
                      }}
                    >
                      <CardContent sx={{ p: 2 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography variant="h6" sx={{ fontSize: '1rem', fontWeight: 700, mb: 0.5 }}>
                              {report.templateId?.name || 'Progress Report'}
                            </Typography>
                            <Typography variant="subtitle1" sx={{ fontSize: '0.9rem', fontWeight: 600, mb: 1, textTransform: 'capitalize', color: 'text.primary' }}>
                              {report.studentId?.firstName} {report.studentId?.lastName}
                            </Typography>
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
                              <Typography variant="body2" color="text.secondary" sx={{ textTransform: 'capitalize', fontSize: '0.85rem' }}>
                                <strong>Class:</strong> {report.studentId?.classId?.name || 'N/A'}
                              </Typography>
                              <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.85rem' }}>
                                <strong>Report Date:</strong> {(() => {
                                  const dateToShow = report.parentCommunication?.sentAt || 
                                                    report.reportPeriod?.endDate || 
                                                    report.createdAt;
                                  return dateToShow 
                                    ? new Date(dateToShow).toLocaleDateString('en-US', { 
                                        year: 'numeric', 
                                        month: 'long', 
                                        day: 'numeric' 
                                      })
                                    : 'N/A';
                                })()}
                              </Typography>
                              <Typography variant="body2" color="text.secondary" sx={{ textTransform: 'capitalize', fontSize: '0.85rem' }}>
                                <strong>Generated by:</strong> {report.teacherId?.firstName ? `${report.teacherId.firstName} ${report.teacherId.lastName}` : 'N/A'}
                              </Typography>
                            </Box>
                          </Box>
                          <Box sx={{ flexShrink: 0 }}>
                            <Button 
                              size="small" 
                              variant="contained"
                              onClick={() => {
                                if (report.pdfUrl) {
                                  handleOpenPdf(report.pdfUrl);
                                } else {
                                  console.log('No PDF URL available, opening dialog');
                                  handleViewReport(report);
                                }
                              }}
                              sx={{
                                bgcolor: 'primary.main',
                                whiteSpace: 'nowrap',
                                '&:hover': {
                                  bgcolor: 'primary.dark',
                                }
                              }}
                            >
                              View Report
                            </Button>
                          </Box>
                        </Box>
                      </CardContent>
                    </Card>
                  ))}
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Right Sidebar */}
        <Grid item xs={12} lg={4}>
          {/* Notifications Section */}
          <Card sx={{ mb: 3, bgcolor: getRandomCardColor(2) }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  Notifications
                          </Typography>
                {unreadCount > 0 && (
                  <Badge badgeContent={unreadCount} color="error">
                    <Notifications />
                  </Badge>
                )}
              </Box>
              <Box sx={{ maxHeight: 400, overflowY: 'auto' }}>
                {loading ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                    <CircularProgress size={24} />
                  </Box>
                ) : notifications.length > 0 ? (
                  notifications.slice(0, 10).map((notification) => {
                    // Determine notification color and icon based on type
                    let bgcolor = 'grey.100';
                    let labelColor = 'default';
                    let labelText = notification.title;
                    
                    if (notification.type === 'report') {
                      bgcolor = notification.isRead ? 'grey.100' : themeColors.highlights.mint;
                      labelColor = 'success';
                    } else if (notification.type === 'system') {
                      // Check if it's an event notification
                      if (notification.data?.eventId) {
                        bgcolor = notification.isRead ? 'grey.100' : themeColors.highlights.blue;
                        labelColor = 'info';
                      } else {
                        bgcolor = notification.isRead ? 'grey.100' : themeColors.highlights.purple;
                        labelColor = 'primary';
                      }
                    } else if (notification.type === 'message') {
                      bgcolor = notification.isRead ? 'grey.100' : themeColors.highlights.yellow;
                      labelColor = 'warning';
                    }

                    return (
                      <Box 
                        key={notification.id || notification._id}
                        sx={{ 
                          p: 2, 
                          mb: 1, 
                          borderRadius: 1, 
                          bgcolor: bgcolor,
                          opacity: notification.isRead ? 0.7 : 1,
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          '&:hover': {
                            transform: 'translateX(4px)',
                            boxShadow: 1
                          }
                        }}
                        onClick={async () => {
                          // Mark as read
                          if (!notification.isRead) {
                            try {
                              await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:5050'}/parents/me/notifications/${notification.id || notification._id}/read`, {
                                method: 'PATCH',
                                headers: {
                                  'Authorization': `Bearer ${localStorage.getItem('token')}`
                                }
                              });
                              
                              // Update local state
                              setNotifications(prev => prev.map(n => 
                                n.id === notification.id ? { ...n, isRead: true } : n
                              ));
                              setUnreadCount(prev => Math.max(0, prev - 1));
                            } catch (error) {
                              console.error('Error marking notification as read:', error);
                            }
                          }
                          
                          // Navigate based on notification type
                          if (notification.type === 'report' && notification.data?.reportId) {
                            setCurrentSection('reports');
                          } else if (notification.data?.eventId) {
                            setCurrentSection('dashboard');
                          }
                        }}
                      >
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', mb: 0.5 }}>
                          <Chip 
                            label={labelText}
                            size="small" 
                            color={labelColor as any}
                            sx={{ fontWeight: 600, fontSize: '0.7rem' }}
                          />
                          {!notification.isRead && (
                            <Box sx={{ 
                              width: 8, 
                              height: 8, 
                              borderRadius: '50%', 
                              bgcolor: 'error.main' 
                            }} />
                          )}
                        </Box>
                        <Typography variant="body2" sx={{ fontWeight: notification.isRead ? 400 : 600, mb: 0.5 }}>
                          {notification.message}
                        </Typography>
                        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                          {new Date(notification.createdAt).toLocaleString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit'
                          })}
                          </Typography>
                        </Box>
                    );
                  })
                ) : (
                  <Box sx={{ 
                    p: 3, 
                    textAlign: 'center',
                    color: 'text.secondary'
                  }}>
                    <Notifications sx={{ fontSize: 48, mb: 1, opacity: 0.3 }} />
                    <Typography variant="body2">
                      No notifications yet
                        </Typography>
                  </Box>
                )}
              </Box>
              {notifications.length > 10 && (
                        <Button
                  fullWidth 
                          variant="outlined"
                  sx={{ mt: 2 }}
                          onClick={() => setCurrentSection('reports')}
                        >
                  View All ({notifications.length})
                        </Button>
              )}
                      </CardContent>
                    </Card>

          {/* School Calendar Section */}
          <Card sx={{ 
            bgcolor: getRandomCardColor(3),
            boxShadow: '0 8px 16px rgba(0,0,0,0.1)'
          }}>
            <CardContent>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
                School Calendar
              </Typography>
              
              {/* Month Navigation */}
              <Box sx={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between', 
                mb: 3,
                bgcolor: 'white',
                p: 1.5,
                borderRadius: 2,
                boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
              }}>
                <IconButton 
                  size="small" 
                  onClick={() => navigateMonth('prev')}
                  sx={{ 
                    bgcolor: 'primary.main',
                    color: 'white',
                    '&:hover': { bgcolor: 'primary.dark' }
                  }}
                >
                  <ChevronLeft />
                </IconButton>
                <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1rem', color: 'text.primary' }}>
                  {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </Typography>
                <IconButton 
                  size="small" 
                  onClick={() => navigateMonth('next')}
                  sx={{ 
                    bgcolor: 'primary.main',
                    color: 'white',
                    '&:hover': { bgcolor: 'primary.dark' }
                  }}
                >
                  <ChevronRight />
                </IconButton>
              </Box>

              {/* Calendar Grid */}
              <Box sx={{ 
                bgcolor: 'white', 
                p: 2, 
                borderRadius: 2,
                boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
              }}>
                {/* Day headers */}
                <Grid container spacing={1} sx={{ mb: 1 }}>
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                    <Grid item xs key={day}>
                      <Box sx={{ 
                        textAlign: 'center', 
                        py: 1,
                        fontWeight: 700,
                        fontSize: '0.75rem',
                        color: 'primary.main',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px'
                      }}>
                        {day}
                      </Box>
                  </Grid>
                ))}
              </Grid>

                {/* Calendar days */}
                <Grid container spacing={0.5}>
                  {(() => {
                    const { daysInMonth, startingDayOfWeek } = getDaysInMonth(currentMonth);
                    const days = [];
                    
                    // Empty cells for days before month starts
                    for (let i = 0; i < startingDayOfWeek; i++) {
                      days.push(
                        <Grid item xs key={`empty-${i}`}>
                          <Box sx={{ aspectRatio: '1', minHeight: 45 }} />
        </Grid>
                      );
                    }
                    
                    // Days of the month
                    for (let day = 1; day <= daysInMonth; day++) {
                      const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
                      const dayEvents = getEventsForDate(date);
                      const isToday = new Date().toDateString() === date.toDateString();
                      const isSelected = selectedDate && selectedDate.toDateString() === date.toDateString();
                      
                      days.push(
                        <Grid item xs key={day}>
                          <Box
                            onClick={() => handleDateClick(date)}
                            sx={{
                              width: '100%',
                              aspectRatio: '1',
                              minHeight: 45,
                              border: '2px solid',
                              borderColor: isSelected 
                                ? 'primary.main' 
                                : isToday 
                                  ? 'primary.main' 
                                  : dayEvents.length > 0 
                                    ? 'success.main' 
                                    : '#e0e0e0',
                              borderRadius: 2,
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              justifyContent: 'center',
                              background: isSelected
                                ? 'rgba(102, 126, 234, 0.15)'
                                : dayEvents.length > 0 
                                ? themeColors.highlights.purple
                                : isToday 
                                  ? themeColors.highlights.blue
                                  : 'white',
                              position: 'relative',
                              cursor: dayEvents.length > 0 ? 'pointer' : 'default',
                              transition: 'all 0.3s ease',
                              overflow: 'hidden',
                              boxShadow: isSelected 
                                ? '0 4px 16px rgba(102, 126, 234, 0.5)' 
                                : isToday 
                                  ? '0 4px 12px rgba(102, 126, 234, 0.4)' 
                                  : dayEvents.length > 0 
                                    ? '0 4px 12px rgba(118, 75, 162, 0.3)' 
                                    : 'none',
                              '&:hover': dayEvents.length > 0 ? {
                                transform: 'scale(1.05)',
                                boxShadow: isSelected 
                                  ? '0 6px 24px rgba(102, 126, 234, 0.6)' 
                                  : '0 6px 20px rgba(118, 75, 162, 0.5)',
                                zIndex: 1
                              } : {}
                            }}
                          >
                            <Typography 
                              variant="caption" 
                              sx={{ 
                                fontWeight: isToday || dayEvents.length > 0 ? 700 : 500,
                                fontSize: '0.85rem',
                                color: dayEvents.length > 0 ? 'text.primary' : 'text.primary'
                              }}
                            >
                              {day}
              </Typography>
                            {dayEvents.length > 0 && (
                              <Box
                                sx={{
                                  position: 'absolute',
                                  bottom: 4,
                                  display: 'flex',
                                  gap: 0.5,
                                  justifyContent: 'center',
                                  flexWrap: 'wrap',
                                  maxWidth: '100%'
                                }}
                              >
                                {dayEvents.map((event, i) => (
                                  <Box
                                    key={i}
                                    sx={{
                                      width: 6,
                                      height: 6,
                                      borderRadius: '50%',
                                      bgcolor: getCategoryColor(event.category),
                                      boxShadow: '0 1px 2px rgba(0,0,0,0.3)'
                                    }}
                                  />
                                ))}
                              </Box>
                            )}
                          </Box>
                        </Grid>
                      );
                    }
                    
                    return days;
                  })()}
                </Grid>
              </Box>

              {/* Upcoming events */}
              {events.length > 0 && (
                <Box sx={{ mt: 3 }}>
                  <Box sx={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'space-between',
                    mb: 2
                  }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box sx={{ 
                      width: 4, 
                      height: 20, 
                      bgcolor: 'primary.main',
                      borderRadius: 1
                    }} />
                    <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                        {selectedDate 
                          ? `Events on ${selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
                          : 'Upcoming Events'}
                    </Typography>
                  </Box>
                    {selectedDate && (
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => setSelectedDate(null)}
                        sx={{ 
                          minWidth: 'auto',
                          px: 1.5,
                          py: 0.5,
                          fontSize: '0.75rem',
                          textTransform: 'none'
                        }}
                      >
                        Show All
                      </Button>
                    )}
                  </Box>
                  {selectedDate && filteredEvents.length === 0 ? (
                    <Box sx={{ 
                      p: 3, 
                      textAlign: 'center',
                      color: 'text.secondary'
                    }}>
                      <Typography variant="body2">
                        No events on this date
                      </Typography>
                    </Box>
                  ) : (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                    {filteredEvents.slice(0, selectedDate ? 10 : 3).map((event) => (
                      <Card 
                        key={event._id}
                        onClick={() => {
                          setSelectedEvent(event);
                          setOpenEventDialog(true);
                        }}
                        sx={{ 
                          bgcolor: 'rgba(255,255,255,0.95)',
                          cursor: 'pointer',
                          transition: 'all 0.3s ease',
                          '&:hover': {
                            transform: 'translateY(-2px)',
                            boxShadow: '0 8px 16px rgba(0,0,0,0.15)'
                          }
                        }}
                      >
                        <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                            <Box sx={{ 
                              bgcolor: getCategoryColor(event.category),
                              borderRadius: 2,
                              p: 1,
                              minWidth: 48,
                              textAlign: 'center',
                              color: 'white'
                            }}>
                              <Typography variant="h6" sx={{ fontSize: '1.2rem', fontWeight: 700, lineHeight: 1, color: 'white' }}>
                                {new Date(event.startDate || event.date).getDate()}
                              </Typography>
                              <Typography variant="caption" sx={{ fontSize: '0.65rem', textTransform: 'uppercase', color: 'white' }}>
                                {new Date(event.startDate || event.date).toLocaleDateString('en-US', { month: 'short' })}
                              </Typography>
                            </Box>
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                              <Typography 
                                variant="body2" 
                                sx={{ 
                                  fontWeight: 600, 
                                  fontSize: '0.85rem', 
                                  mb: 0.5,
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  display: '-webkit-box',
                                  WebkitLineClamp: 2,
                                  WebkitBoxOrient: 'vertical',
                                  wordBreak: 'break-word'
                                }}
                              >
                                {event.title}
                              </Typography>
                              {(() => {
                                const description = event.description || event.details || event.location || '';
                                const maxLength = 80;
                                const truncated = description.length > maxLength 
                                  ? description.substring(0, maxLength).trim() + '...' 
                                  : description;
                                return truncated ? (
                                  <Typography 
                                    variant="caption" 
                                    sx={{ 
                                      fontSize: '0.7rem', 
                                      opacity: 0.8,
                                      lineHeight: 1.4,
                                      display: 'block'
                                    }}
                                  >
                                    {truncated}
                                  </Typography>
                                ) : null;
                              })()}
                            </Box>
                          </Box>
                        </CardContent>
                      </Card>
                    ))}
                  </Box>
                  )}
                  {(!selectedDate && events.length > 3) || (selectedDate && filteredEvents.length > 10) ? (
                <Button
                      fullWidth 
                  variant="outlined"
                      sx={{ 
                        mt: 2,
                        borderColor: 'primary.main',
                        color: 'primary.main',
                        '&:hover': {
                          bgcolor: 'primary.main',
                          color: 'white'
                        }
                      }}
                    >
                      View All Events ({selectedDate ? filteredEvents.length : events.length})
                </Button>
                  ) : null}
              </Box>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
      </Box>
      )}

      {/* Event Details Dialog */}
      <Dialog
        open={openEventDialog}
        onClose={() => setOpenEventDialog(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            overflow: 'hidden'
          }
        }}
      >
        {selectedEvent && (
          <>
            <Box
              sx={{
                background: `linear-gradient(135deg, ${getCategoryColor(selectedEvent.category)} 0%, ${getCategoryColor(selectedEvent.category)}dd 100%)`,
                color: 'white',
                p: 3,
                position: 'relative'
              }}
            >
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                <Chip
                  label={selectedEvent.category || 'Event'}
                  sx={{
                    bgcolor: 'rgba(255,255,255,0.3)',
                    color: 'white',
                    fontWeight: 600,
                    textTransform: 'capitalize'
                  }}
                />
                <IconButton
                  onClick={() => setOpenEventDialog(false)}
                  sx={{ color: 'white', '&:hover': { bgcolor: 'rgba(255,255,255,0.1)' } }}
                >
                  <Close />
                </IconButton>
    </Box>
              <Typography variant="h4" sx={{ fontWeight: 700, mb: 2 }}>
                {selectedEvent.title}
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Event sx={{ fontSize: 20 }} />
                  <Typography variant="body2">
                    {new Date(selectedEvent.startDate || selectedEvent.date).toLocaleDateString('en-US', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </Typography>
                </Box>
                {selectedEvent.startDate && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <AccessTime sx={{ fontSize: 20 }} />
                    <Typography variant="body2">
                      {new Date(selectedEvent.startDate).toLocaleTimeString('en-US', {
                        hour: 'numeric',
                        minute: '2-digit'
                      })}
                      {selectedEvent.endDate && ` - ${new Date(selectedEvent.endDate).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`}
                    </Typography>
                  </Box>
                )}
                {selectedEvent.location && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <LocationOn sx={{ fontSize: 20 }} />
                    <Typography variant="body2">{selectedEvent.location}</Typography>
                  </Box>
                )}
              </Box>
            </Box>
            <DialogContent sx={{ p: 3, pt: '24px !important' }}>
              {selectedEvent.description && (
                <Box sx={{ mb: 3 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                    <DescriptionIcon sx={{ color: 'primary.main' }} />
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                      Description
                    </Typography>
                  </Box>
                  <Typography variant="body1" sx={{ color: 'text.secondary', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>
                    {selectedEvent.description}
                  </Typography>
                </Box>
              )}
              {selectedEvent.attachments && selectedEvent.attachments.length > 0 && (
                <Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    <AttachFile sx={{ color: 'primary.main' }} />
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                      Attachments ({selectedEvent.attachments.length})
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                    {selectedEvent.attachments.map((attachment: any, index: number) => {
                      // Check both mimetype (camelCase and lowercase) and file extension
                      const filename = attachment.filename || '';
                      const fileExt = filename.split('.').pop()?.toLowerCase() || '';
                      const mimetype = attachment.mimeType || attachment.mimetype || '';
                      
                      const isImage = mimetype.toLowerCase().startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(fileExt);
                      const isVideo = mimetype.toLowerCase().startsWith('video/') || ['mp4', 'webm', 'ogg', 'avi', 'mov'].includes(fileExt);
                      const isPDF = mimetype.toLowerCase().includes('pdf') || fileExt === 'pdf';
                      
                      // Construct full URL - check multiple possible fields and add base URL if needed
                      let attachmentUrl = attachment.url || attachment.path || attachment.fullUrl;
                      if (attachmentUrl) {
                        // If it's already an absolute URL, use as is
                        if (attachmentUrl.startsWith('http://') || attachmentUrl.startsWith('https://')) {
                          // Keep as is
                        } else {
                          // Get base URL and construct full path
                          let baseUrl = process.env.REACT_APP_API_URL || 'http://localhost:5050/api';
                          if (baseUrl.endsWith('/api')) {
                            baseUrl = baseUrl.replace('/api', '');
                          }
                          // Ensure URL starts with /
                          if (!attachmentUrl.startsWith('/')) {
                            attachmentUrl = '/' + attachmentUrl;
                          }
                          attachmentUrl = `${baseUrl}${attachmentUrl}`;
                        }
                      }

                      const handleAttachmentClick = () => {
                        if (!attachmentUrl) return;

                        if (isImage || isVideo) {
                          // Use existing lightbox for images and videos
                          const mediaArray = selectedEvent.attachments
                            .filter((att: any) => {
                              const url = att.url || att.path || att.fullUrl;
                              if (!url) return false;
                              
                              const filename = att.filename || '';
                              const fileExt = filename.split('.').pop()?.toLowerCase() || '';
                              const mime = (att.mimeType || att.mimetype || '').toLowerCase();
                              
                              return mime.startsWith('image/') || mime.startsWith('video/') ||
                                     ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(fileExt) ||
                                     ['mp4', 'webm', 'ogg', 'avi', 'mov'].includes(fileExt);
                            })
                            .map((att: any) => {
                              let fullUrl = att.url || att.path || att.fullUrl;
                              if (fullUrl && !fullUrl.startsWith('http')) {
                                let baseUrl = process.env.REACT_APP_API_URL || 'http://localhost:5050/api';
                                if (baseUrl.endsWith('/api')) {
                                  baseUrl = baseUrl.replace('/api', '');
                                }
                                if (!fullUrl.startsWith('/')) {
                                  fullUrl = '/' + fullUrl;
                                }
                                fullUrl = `${baseUrl}${fullUrl}`;
                              }
                              
                              return {
                                fullUrl: fullUrl,
                                originalName: att.filename,
                                mimeType: att.mimeType || att.mimetype
                              };
                            });
                          
                          const currentIndex = mediaArray.findIndex((m: any) => 
                            m.fullUrl === attachmentUrl
                          );
                          
                          setLightboxMedia(mediaArray);
                          setCurrentMediaIndex(currentIndex >= 0 ? currentIndex : 0);
                          setLightboxOpen(true);
                        } else if (isPDF) {
                          // Open PDF in new window
                          window.open(attachmentUrl, '_blank');
                        } else {
                          // Download other file types
                          window.open(attachmentUrl, '_blank');
                        }
                      };

                      return (
                        <Card
                          key={attachment._id || attachment.filename || index}
                          onClick={handleAttachmentClick}
                          sx={{
                            p: 2,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 2,
                            border: '1px solid',
                            borderColor: 'divider',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            '&:hover': {
                              bgcolor: 'action.hover',
                              borderColor: 'primary.main',
                              transform: 'translateY(-2px)',
                              boxShadow: 2
                            }
                          }}
                        >
                          {isImage && attachmentUrl ? (
                            <Box
                              component="img"
                              src={attachmentUrl}
                              alt={attachment.filename}
                              onError={(e: any) => {
                                // Fallback to icon if image fails to load
                                e.target.style.display = 'none';
                                if (!e.target.nextElementSibling) {
                                  const fallback = document.createElement('div');
                                  fallback.style.cssText = 'width: 80px; height: 80px; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.05); border-radius: 4px; border: 1px solid #e0e0e0;';
                                  const icon = document.createElement('div');
                                  icon.style.cssText = 'font-size: 32px;';
                                  icon.textContent = '🖼️';
                                  fallback.appendChild(icon);
                                  e.target.parentNode?.appendChild(fallback);
                                }
                              }}
                              sx={{
                                width: 80,
                                height: 80,
                                objectFit: 'cover',
                                borderRadius: 1,
                                border: '1px solid',
                                borderColor: 'divider',
                                flexShrink: 0,
                                bgcolor: 'grey.100'
                              }}
                            />
                          ) : isVideo && attachmentUrl ? (
                            <Box
                              sx={{
                                width: 80,
                                height: 80,
                                borderRadius: 1,
                                overflow: 'hidden',
                                position: 'relative',
                                bgcolor: 'black',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                border: '1px solid',
                                borderColor: 'divider'
                              }}
                            >
                              <video
                                src={attachmentUrl}
                                style={{
                                  width: '100%',
                                  height: '100%',
                                  objectFit: 'cover',
                                  pointerEvents: 'none'
                                }}
                              />
                              <Box
                                sx={{
                                  position: 'absolute',
                                  top: '50%',
                                  left: '50%',
                                  transform: 'translate(-50%, -50%)',
                                  width: 40,
                                  height: 40,
                                  borderRadius: '50%',
                                  bgcolor: 'rgba(0,0,0,0.7)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  border: '2px solid white',
                                  pointerEvents: 'none'
                                }}
                              >
                                <ArrowForward sx={{ color: 'white', ml: 0.5 }} />
                              </Box>
                            </Box>
                          ) : (
                            <Box
                              sx={{
                                width: 80,
                                height: 80,
                                borderRadius: 1,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                bgcolor: `${getCategoryColor(selectedEvent.category)}15`,
                                color: getCategoryColor(selectedEvent.category)
                              }}
                            >
                              {isPDF ? (
                                <Description sx={{ fontSize: 40 }} />
                              ) : isVideo ? (
                                <VideoIcon sx={{ fontSize: 40 }} />
                              ) : isImage ? (
                                <ImageIcon sx={{ fontSize: 40 }} />
                              ) : (
                                <FilePresent sx={{ fontSize: 40 }} />
                              )}
                            </Box>
                          )}
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography variant="body2" sx={{ fontWeight: 500, mb: 0.5 }}>
                              {attachment.filename}
                            </Typography>
                            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                              {attachment.size
                                ? `${(attachment.size / 1024).toFixed(1)} KB`
                                : 'Unknown size'}
                              {isImage && ' • Click to view'}
                              {isVideo && ' • Click to play'}
                              {isPDF && ' • Click to open'}
                            </Typography>
                          </Box>
                          <IconButton
                            onClick={(e) => {
                              e.stopPropagation();
                              if (attachmentUrl) {
                                window.open(attachmentUrl, '_blank');
                              }
                            }}
                            sx={{ color: 'primary.main' }}
                          >
                            <Download />
                          </IconButton>
                        </Card>
                      );
                    })}
                  </Box>
                </Box>
              )}
            </DialogContent>
            <DialogActions sx={{ p: 2, pt: 0 }}>
              <Button onClick={() => setOpenEventDialog(false)} variant="contained" fullWidth>
                Close
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Box>
    );
  };

  const ChildrenSection = () => (
    <Box>
      <Typography variant="h4" gutterBottom>
        My Children
      </Typography>
      
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
          <CircularProgress size={60} />
        </Box>
      ) : children.length === 0 ? (
            <Card>
              <CardContent>
                    <Typography variant="body1" color="text.secondary">
              No children found. Please contact your school administrator.
                    </Typography>
          </CardContent>
        </Card>
      ) : (
      <Grid container spacing={3}>
        {children.map((child) => {
          const childAvatar = (child.firstName?.charAt(0) || '').toUpperCase() + (child.lastName?.charAt(0) || '').toUpperCase();
          const childReports = parentReports.filter(r => r.studentId?._id === child._id);
          const latestReport = childReports.length > 0 ? childReports[0] : null;
          
          return (
            <Grid item xs={12} md={6} key={child._id}>
              <Card sx={{ 
                transition: 'all 0.3s ease',
                '&:hover': { 
                  boxShadow: 4,
                  transform: 'translateY(-4px)'
                }
              }}>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 3 }}>
                    <Avatar sx={{ mr: 2, width: 64, height: 64, bgcolor: 'primary.main', fontSize: '1.5rem', fontWeight: 700 }}>
                      {childAvatar}
                    </Avatar>
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="h5" sx={{ textTransform: 'capitalize', fontWeight: 700, mb: 0.5 }}>
                        {child.firstName} {child.lastName}
                      </Typography>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                    <Typography variant="body2" color="text.secondary">
                          <strong>Student ID:</strong> {child.studentId || 'N/A'}
                    </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ textTransform: 'capitalize' }}>
                          <strong>Class:</strong> {child.classId?.name || 'Not assigned'} {child.classId?.grade ? `(Grade: ${child.classId.grade})` : ''}
                  </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ textTransform: 'capitalize' }}>
                          <strong>Teacher:</strong> {child.teacher?.name || 'Not assigned'}
                        </Typography>
                        {child.email && (
                  <Typography variant="body2" color="text.secondary">
                            <strong>Email:</strong> {child.email}
                  </Typography>
                        )}
                        {child.phone && (
                          <Typography variant="body2" color="text.secondary">
                            <strong>Phone:</strong> {child.phone}
                          </Typography>
                        )}
                        <Typography variant="body2" color="text.secondary">
                          <strong>Total Reports:</strong> {childReports.length}
                        </Typography>
                        {latestReport && (
                          <Typography variant="body2" color="text.secondary">
                            <strong>Latest Report:</strong> {(() => {
                              const dateToShow = latestReport.parentCommunication?.sentAt || 
                                                latestReport.reportPeriod?.endDate || 
                                                latestReport.createdAt;
                              return dateToShow 
                                ? new Date(dateToShow).toLocaleDateString('en-US', {
                                    month: 'short',
                                    day: 'numeric',
                                    year: 'numeric'
                                  })
                                : 'N/A';
                            })()}
                          </Typography>
                        )}
                      </Box>
                    </Box>
                </Box>
                
                  <Box sx={{ display: 'flex', gap: 1.5, mt: 2 }}>
                  <Button
                    variant="contained"
                      fullWidth
                      onClick={() => {
                        setSelectedChildFilter(child._id);
                        setCurrentSection('reports');
                        // Scroll to top after section change
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      sx={{
                        bgcolor: 'primary.main',
                        '&:hover': {
                          bgcolor: 'primary.dark',
                        }
                      }}
                    >
                      View Reports ({childReports.length})
                  </Button>
                  <Button
                    variant="outlined"
                      fullWidth
                      onClick={() => {
                        if (child.teacher?.email) {
                          // Open email client with pre-filled teacher email
                          window.location.href = `mailto:${child.teacher.email}?subject=Regarding ${child.firstName} ${child.lastName}`;
                        } else {
                          alert('Teacher email not available. Please contact the school administration.');
                        }
                      }}
                      disabled={!child.teacher?.email}
                      sx={{
                        borderColor: 'primary.main',
                        '&:hover': {
                          borderColor: 'primary.dark',
                          bgcolor: 'primary.50'
                        }
                      }}
                  >
                    Contact Teacher
                  </Button>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          );
        })}
      </Grid>
      )}
    </Box>
  );

  const ReportsSection = () => {
    // Apply all filters
    let filteredReports = [...parentReports];
    
    // Filter by child
    if (selectedChildFilter) {
      filteredReports = filteredReports.filter(report => report.studentId?._id === selectedChildFilter);
    }
    
    // Filter by report type
    if (reportTypeFilter !== 'all') {
      filteredReports = filteredReports.filter(report => report.templateId?._id === reportTypeFilter);
    }
    
    // Filter by date
    if (dateFilter !== 'all') {
      const now = new Date();
      filteredReports = filteredReports.filter(report => {
        const dateToCompare = report.parentCommunication?.sentAt || 
                             report.reportPeriod?.endDate || 
                             report.createdAt;
        if (!dateToCompare) return false;
        const reportDate = new Date(dateToCompare);
        const diffTime = now.getTime() - reportDate.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        switch (dateFilter) {
          case 'week':
            return diffDays <= 7;
          case 'month':
            return diffDays <= 30;
          case 'quarter':
            return diffDays <= 90;
          default:
            return true;
        }
      });
    }
    
    // Get unique report types for filter
    const reportTypes = Array.from(new Set(parentReports.map(r => r.templateId?._id)))
      .filter(Boolean)
      .map(id => {
        const report = parentReports.find(r => r.templateId?._id === id);
        return {
          id: id,
          name: report?.templateId?.name || 'Unknown'
        };
      });
    
    const selectedChild = selectedChildFilter
      ? children.find(child => child._id === selectedChildFilter)
      : null;
    
    const hasActiveFilters = selectedChildFilter || reportTypeFilter !== 'all' || dateFilter !== 'all';
    
    const clearAllFilters = () => {
      setSelectedChildFilter(null);
      setReportTypeFilter('all');
      setDateFilter('all');
    };
    
    return (
    <Box>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
          <Typography variant="h4" sx={{ fontWeight: 700 }}>
        Reports
      </Typography>
          {hasActiveFilters && (
            <Button
              variant="outlined"
              startIcon={<Clear />}
              onClick={clearAllFilters}
              size="small"
            >
              Clear All Filters
            </Button>
          )}
        </Box>
        
        {/* Filters Section */}
        <Card sx={{ mb: 3 }}>
              <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
              <FilterList color="primary" />
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                Filters
                    </Typography>
                  </Box>
            
            <Grid container spacing={2}>
              {/* Child Filter */}
              <Grid item xs={12} sm={6} md={4}>
                <FormControl fullWidth size="small">
                  <InputLabel>Filter by Child</InputLabel>
                  <Select
                    value={selectedChildFilter || 'all'}
                    label="Filter by Child"
                    onChange={(e) => setSelectedChildFilter(e.target.value === 'all' ? null : e.target.value)}
                  >
                    <MenuItem value="all">All Children</MenuItem>
                    {children.map((child) => (
                      <MenuItem key={child._id} value={child._id}>
                        {child.firstName} {child.lastName}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
          </Grid>
              
              {/* Report Type Filter */}
              <Grid item xs={12} sm={6} md={4}>
                <FormControl fullWidth size="small">
                  <InputLabel>Filter by Type</InputLabel>
                  <Select
                    value={reportTypeFilter}
                    label="Filter by Type"
                    onChange={(e) => setReportTypeFilter(e.target.value)}
                  >
                    <MenuItem value="all">All Report Types</MenuItem>
                    {reportTypes.map((type) => (
                      <MenuItem key={type.id} value={type.id}>
                        {type.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
      </Grid>
              
              {/* Date Filter */}
              <Grid item xs={12} sm={6} md={4}>
                <FormControl fullWidth size="small">
                  <InputLabel>Filter by Date</InputLabel>
                  <Select
                    value={dateFilter}
                    label="Filter by Date"
                    onChange={(e) => setDateFilter(e.target.value)}
                  >
                    <MenuItem value="all">All Time</MenuItem>
                    <MenuItem value="week">Last 7 Days</MenuItem>
                    <MenuItem value="month">Last 30 Days</MenuItem>
                    <MenuItem value="quarter">Last 3 Months</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
            
            {/* Active Filters Display */}
            {hasActiveFilters && (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 2 }}>
                <Typography variant="body2" color="text.secondary" sx={{ mr: 1, lineHeight: '32px' }}>
                  Active filters:
                </Typography>
                {selectedChildFilter && selectedChild && (
                  <Chip
                    label={`Child: ${selectedChild.firstName} ${selectedChild.lastName}`}
                    onDelete={() => setSelectedChildFilter(null)}
                    size="small"
                    color="primary"
                  />
                )}
                {reportTypeFilter !== 'all' && (
                  <Chip
                    label={`Type: ${reportTypes.find(t => t.id === reportTypeFilter)?.name}`}
                    onDelete={() => setReportTypeFilter('all')}
                    size="small"
                    color="primary"
                  />
                )}
                {dateFilter !== 'all' && (
                  <Chip
                    label={`Date: ${dateFilter === 'week' ? 'Last 7 Days' : dateFilter === 'month' ? 'Last 30 Days' : 'Last 3 Months'}`}
                    onDelete={() => setDateFilter('all')}
                    size="small"
                    color="primary"
                  />
                )}
    </Box>
            )}
          </CardContent>
        </Card>
        
        {/* Results Summary */}
        <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="body1" color="text.secondary">
            Showing <strong>{filteredReports.length}</strong> of <strong>{parentReports.length}</strong> reports
      </Typography>
        </Box>
        
        {/* Reports List */}
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
            <CircularProgress size={60} />
          </Box>
        ) : filteredReports.length === 0 ? (
          <Card>
            <CardContent>
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <Description sx={{ fontSize: 60, color: 'text.secondary', mb: 2 }} />
                <Typography variant="h6" color="text.secondary" gutterBottom>
                  No reports found
              </Typography>
                <Typography variant="body2" color="text.secondary">
                  {hasActiveFilters 
                    ? 'Try adjusting your filters to see more results.' 
                    : 'No reports are available yet.'}
                </Typography>
                {hasActiveFilters && (
                      <Button
                        variant="outlined"
                    startIcon={<Clear />}
                    onClick={clearAllFilters}
                    sx={{ mt: 2 }}
                      >
                    Clear Filters
                      </Button>
                )}
              </Box>
            </CardContent>
          </Card>
        ) : (
          <TableContainer component={Paper} sx={{ boxShadow: 2 }}>
            <Table>
              <TableHead>
                <TableRow sx={{ bgcolor: 'primary.main' }}>
                  <TableCell sx={{ color: 'white', fontWeight: 700 }}>Student</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 700 }}>Report Type</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 700 }}>Class</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 700 }}>Teacher</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 700 }}>Attachments</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 700 }}>Date</TableCell>
                  <TableCell sx={{ color: 'white', fontWeight: 700 }} align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredReports.map((report, index) => (
                  <TableRow
                    key={report._id}
                    sx={{
                      '&:nth-of-type(odd)': { bgcolor: 'action.hover' },
                      '&:hover': { bgcolor: 'action.selected' },
                      cursor: 'pointer'
                    }}
                  >
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <Avatar sx={{ bgcolor: 'primary.main', width: 40, height: 40 }}>
                          {(report.studentId?.firstName?.charAt(0) || '').toUpperCase()}
                        </Avatar>
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 600, textTransform: 'capitalize' }}>
                            {report.studentId?.firstName} {report.studentId?.lastName}
              </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {report.studentId?.studentId || 'N/A'}
                          </Typography>
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={report.templateId?.name || 'Progress Report'}
                        size="small"
                        color="primary"
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell sx={{ textTransform: 'capitalize' }}>
                      {report.studentId?.classId?.name || 'N/A'}
                    </TableCell>
                    <TableCell sx={{ textTransform: 'capitalize' }}>
                      {report.teacherId?.firstName ? `${report.teacherId.firstName} ${report.teacherId.lastName}` : 'N/A'}
                    </TableCell>
                    <TableCell>
                      {report.attachments && report.attachments.length > 0 ? (
                        <Box 
                          sx={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: 1,
                            cursor: 'pointer',
                            '&:hover': {
                              opacity: 0.7
                            }
                          }}
                          onClick={() => handleOpenLightbox(report.attachments, 0)}
                        >
                          <Chip
                            icon={<AttachFile sx={{ fontSize: 16 }} />}
                            label={report.attachments.length}
                            size="small"
                            color="success"
                            variant="outlined"
                          />
                          <Box sx={{ display: 'flex', gap: 0.5 }}>
                            {report.attachments.some((att: any) => att.mimeType?.startsWith('image/')) && (
                              <Image sx={{ fontSize: 18, color: 'primary.main' }} />
                            )}
                            {report.attachments.some((att: any) => att.mimeType?.startsWith('video/')) && (
                              <VideoLibrary sx={{ fontSize: 18, color: 'secondary.main' }} />
                            )}
                          </Box>
                        </Box>
                      ) : (
              <Typography variant="body2" color="text.secondary">
                          None
              </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <CalendarToday sx={{ fontSize: 16, color: 'text.secondary' }} />
                        <Typography variant="body2">
                          {(() => {
                            const dateToShow = report.parentCommunication?.sentAt || 
                                              report.reportPeriod?.endDate || 
                                              report.createdAt;
                            return dateToShow 
                              ? new Date(dateToShow).toLocaleDateString('en-US', { 
                                  year: 'numeric', 
                                  month: 'short', 
                                  day: 'numeric' 
                                })
                              : 'N/A';
                          })()}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell align="right">
                      <Button
                        variant="contained"
                        size="small"
                        onClick={() => {
                          if (report.pdfUrl) {
                            handleOpenPdf(report.pdfUrl);
                          } else {
                            handleViewReport(report);
                          }
                        }}
                        sx={{
                          bgcolor: 'primary.main',
                          '&:hover': {
                            bgcolor: 'primary.dark',
                          }
                        }}
                      >
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
    </Box>
  );
  };

  const CommunicationSection = () => <CommunicationPage />;

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

  // Create theme with school branding colors (primary and secondary)
  const primaryColor = schoolBranding?.branding?.primaryColor || '#007AFF';
  const secondaryColor = schoolBranding?.branding?.secondaryColor;
  const dynamicTheme = createParentTheme(primaryColor, secondaryColor);

  // Card background colors array
  const cardColors = ['#e6f5f5', '#fff1c5', '#fcd1d1', '#d2f0e1', '#d2d2f0'];
  
  // Helper function to get a random card color
  const getRandomCardColor = (index?: number) => {
    if (index !== undefined) {
      return cardColors[index % cardColors.length];
    }
    return cardColors[Math.floor(Math.random() * cardColors.length)];
  };

  return (
    <ThemeProvider theme={dynamicTheme}>
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'center',
        bgcolor: 'background.default', 
        minHeight: '100vh' 
      }}>
        {/* Main Container - 95% width */}
        <Box sx={{ 
          width: '95%',
          maxWidth: '1400px',
          display: 'flex',
          bgcolor: 'background.default',
        }}>
      {/* Sidebar */}
          <Box
        sx={{
          width: drawerWidth,
          flexShrink: 0,
              backgroundColor: '#FFFFFF',
              borderRight: 'none',
              boxShadow: '2px 0 8px rgba(0,0,0,0.08)',
              display: 'flex',
              flexDirection: 'column',
              borderRadius: 2,
              m: 2,
              mb: 0,
              height: '90vh',
              position: 'sticky',
              top: '5vh',
              alignSelf: 'flex-start',
            }}
          >
          <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'auto' }}>
            {/* User Profile Section at Top */}
            <Box sx={{ pt: 3, px: 2, pb: 2 }}>
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 3 }}>
                <Avatar sx={{ mb: 1.5, bgcolor: 'primary.main', width: 64, height: 64, fontSize: '1.5rem', fontWeight: 700 }}>
                  {user?.firstName?.charAt(0).toUpperCase()}
            </Avatar>
                <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1rem', textAlign: 'center', textTransform: 'capitalize' }}>
                {user?.firstName} {user?.lastName}
              </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem', mt: 0.5, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                Parent
                  <ExpandMore sx={{ fontSize: '0.875rem' }} />
              </Typography>
          </Box>
        </Box>

            <Divider sx={{ mx: 2 }} />

            {/* Navigation Menu */}
            <List sx={{ px: 1.5, pt: 2 }}>
          {menuItems.map((item) => (
            <ListItem
              key={item.section}
                onClick={() => {
                  // Clear child filter when navigating to reports from menu
                  if (item.section === 'reports') {
                    setSelectedChildFilter(null);
                  }
                  setCurrentSection(item.section);
                }}
              sx={{
                  mb: 0.5,
                borderRadius: 2,
                  py: 1,
                  px: 1.5,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease-in-out',
                backgroundColor: currentSection === item.section ? dynamicTheme.palette.primary.main : 'transparent',
                color: currentSection === item.section ? 'white' : 'text.primary',
                '&:hover': {
                    backgroundColor: currentSection === item.section ? dynamicTheme.palette.primary.dark : dynamicTheme.palette.primary.main,
                    color: currentSection === item.section ? 'white' : 'white',
                    '& .MuiListItemIcon-root': {
                      color: 'white',
                    },
                    '& .MuiListItemText-primary': {
                      color: 'white',
                    },
                },
              }}
            >
              <ListItemIcon
                sx={{
                    minWidth: 40,
                  color: currentSection === item.section ? 'white' : 'text.secondary',
                  transition: 'color 0.2s',
                }}
              >
                {item.icon}
              </ListItemIcon>
                <ListItemText 
                  primary={item.text} 
                  primaryTypographyProps={{
                    fontWeight: currentSection === item.section ? 600 : 400,
                    fontSize: '0.875rem',
                    color: currentSection === item.section ? 'white' : 'text.primary',
                    sx: { transition: 'color 0.2s' },
                  }}
                />
            </ListItem>
          ))}
        </List>

            {/* Logout at Bottom */}
            <Box sx={{ mt: 'auto', pb: 2, px: 2 }}>
              <Divider sx={{ mb: 2 }} />
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                <ListItem
                  onClick={handleLogout}
                  sx={{
                    borderRadius: 2,
                    py: 0.75,
                    px: 1.5,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease-in-out',
                    color: 'text.primary',
                    '&:hover': {
                      backgroundColor: dynamicTheme.palette.primary.main,
                      color: 'white',
                      '& .MuiListItemIcon-root': {
                        color: 'white',
                      },
                      '& .MuiSvgIcon-root': {
                        color: 'white',
                      },
                      '& .MuiListItemText-primary': {
                        color: 'white',
                      },
                    },
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 40, color: 'inherit' }}>
                    <Logout fontSize="small" sx={{ color: 'inherit', transition: 'color 0.2s' }} />
          </ListItemIcon>
                  <ListItemText 
                    primary="Logout" 
                    primaryTypographyProps={{
                      fontSize: '0.875rem',
                      color: 'inherit',
                      sx: { transition: 'color 0.2s' },
                    }}
                  />
                </ListItem>
              </Box>
            </Box>
          </Box>
          </Box>

          {/* Main Content */}
          <Box
            component="main"
            sx={{
              flexGrow: 1,
              bgcolor: 'background.default',
              display: 'flex',
              flexDirection: 'column',
              mt: 2,
            }}
          >
            {/* Content Area */}
            <Box sx={{ flexGrow: 1, pt: 3, px: 3, pb: 3, position: 'relative' }}>
              {/* Notifications Icon - Top Right */}
              <Box sx={{ 
                position: 'absolute',
                top: 24,
                right: 24,
                zIndex: 1
              }}>
                <NotificationIcon />
              </Box>
              {renderSection()}
            </Box>
          </Box>
        </Box>
      </Box>

      {/* Report Detail Dialog */}
      <Dialog open={openReportDialog} onClose={() => setOpenReportDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ textTransform: 'capitalize' }}>
          {selectedReport?.templateId?.name || 'Report'} - {selectedReport?.studentId?.firstName} {selectedReport?.studentId?.lastName}
        </DialogTitle>
        <DialogContent>
          {selectedReport && (
            <Box>
              <Typography variant="body2" color="text.secondary" gutterBottom sx={{ textTransform: 'capitalize' }}>
                Generated by {selectedReport.teacherId?.firstName} {selectedReport.teacherId?.lastName} on {(() => {
                  const dateToShow = selectedReport.parentCommunication?.sentAt || 
                                    selectedReport.reportPeriod?.endDate || 
                                    selectedReport.createdAt;
                  return dateToShow 
                    ? new Date(dateToShow).toLocaleDateString('en-US', { 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric' 
                      })
                    : 'N/A';
                })()}
              </Typography>
              
              {selectedReport.pdfUrl ? (
                <Box sx={{ mt: 3, textAlign: 'center' }}>
                  <Typography variant="body1" sx={{ mb: 2 }}>
                    This report is available as a PDF document.
                          </Typography>
                  <Button
                    variant="contained"
                    size="large"
                    onClick={() => handleOpenPdf(selectedReport.pdfUrl)}
                              sx={{
                      bgcolor: 'primary.main',
                      '&:hover': {
                        bgcolor: 'primary.dark',
                      }
                    }}
                  >
                    Download/View PDF
                  </Button>
                </Box>
              ) : selectedReport.content ? (
                <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.50', borderRadius: 2 }}>
                  <Typography 
                    variant="body2" 
                    component="pre" 
                                sx={{
                      whiteSpace: 'pre-wrap', 
                      fontFamily: 'inherit',
                      lineHeight: 1.6
                    }}
                  >
                    {selectedReport.content}
                          </Typography>
                        </Box>
              ) : (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                  No report content available.
                      </Typography>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={() => setOpenReportDialog(false)}
            sx={{
              borderColor: '#d32f2f',
              color: '#d32f2f',
              '&:hover': {
                borderColor: '#b71c1c',
                backgroundColor: 'rgba(211, 47, 47, 0.05)',
                color: '#b71c1c',
              },
              '&:active': {
                borderColor: '#c62828',
                backgroundColor: 'rgba(198, 40, 40, 0.1)',
                color: '#c62828',
              }
            }}
          >
            Close
          </Button>
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
          <Button 
            onClick={() => setOpenMessageDialog(false)}
            sx={{
              borderColor: '#d32f2f',
              color: '#d32f2f',
              '&:hover': {
                borderColor: '#b71c1c',
                backgroundColor: 'rgba(211, 47, 47, 0.05)',
                color: '#b71c1c',
              },
              '&:active': {
                borderColor: '#c62828',
                backgroundColor: 'rgba(198, 40, 40, 0.1)',
                color: '#c62828',
              }
            }}
          >
            Cancel
          </Button>
          <Button variant="contained" onClick={() => setOpenMessageDialog(false)}>
            Send Message
          </Button>
        </DialogActions>
      </Dialog>

      {/* Media Lightbox */}
      <Dialog
        open={lightboxOpen}
        onClose={handleCloseLightbox}
        maxWidth="lg"
        fullWidth
        PaperProps={{
          sx: {
            bgcolor: 'rgba(0, 0, 0, 0.95)',
            boxShadow: 24,
            maxHeight: '90vh',
          }
        }}
      >
        <DialogTitle sx={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          color: 'white',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
        }}>
          <Typography variant="h6" sx={{ color: 'white' }}>
            Media Attachment {currentMediaIndex + 1} of {lightboxMedia.length}
          </Typography>
          <IconButton 
            onClick={handleCloseLightbox}
            sx={{ 
              color: 'white',
              '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.1)' }
            }}
          >
            <Close />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ 
          p: 3,
          pt: 3,
          display: 'flex', 
          flexDirection: 'column',
          alignItems: 'center', 
          justifyContent: 'center',
          position: 'relative',
          minHeight: '60vh'
        }}>
          {lightboxMedia.length > 0 && lightboxMedia[currentMediaIndex] && (
            <>
              {/* Media Display */}
              <Box sx={{ 
                width: '100%', 
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative'
              }}>
                {lightboxMedia[currentMediaIndex].mimeType?.startsWith('image/') ? (
                  <img
                    src={lightboxMedia[currentMediaIndex].fullUrl}
                    alt={lightboxMedia[currentMediaIndex].originalName || 'Media'}
                    style={{
                      maxWidth: '100%',
                      maxHeight: '70vh',
                      objectFit: 'contain',
                      borderRadius: '8px'
                    }}
                  />
                ) : lightboxMedia[currentMediaIndex].mimeType?.startsWith('video/') ? (
                  <video
                    src={lightboxMedia[currentMediaIndex].fullUrl}
                    controls
                    style={{
                      maxWidth: '100%',
                      maxHeight: '70vh',
                      borderRadius: '8px'
                    }}
                  />
                ) : (
                  <Box sx={{ 
                    display: 'flex', 
                    flexDirection: 'column', 
                    alignItems: 'center',
                    gap: 2,
                    color: 'white'
                  }}>
                    <AttachFile sx={{ fontSize: 64 }} />
                    <Typography variant="h6">
                      {lightboxMedia[currentMediaIndex].originalName || 'Unknown file'}
                    </Typography>
                    <Button
                      variant="contained"
                      href={lightboxMedia[currentMediaIndex].fullUrl}
                      target="_blank"
                      sx={{
                        bgcolor: 'primary.main',
                        '&:hover': {
                          bgcolor: 'primary.dark',
                        }
                      }}
                    >
                      Download File
                    </Button>
    </Box>
                )}
              </Box>

              {/* Navigation Arrows */}
              {lightboxMedia.length > 1 && (
                <>
                  <IconButton
                    onClick={handlePrevMedia}
                    sx={{
                      position: 'absolute',
                      left: 16,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      bgcolor: 'rgba(255, 255, 255, 0.2)',
                      color: 'white',
                      '&:hover': {
                        bgcolor: 'rgba(255, 255, 255, 0.3)',
                      },
                      width: 56,
                      height: 56
                    }}
                  >
                    <ArrowBack sx={{ fontSize: 32 }} />
                  </IconButton>
                  <IconButton
                    onClick={handleNextMedia}
                    sx={{
                      position: 'absolute',
                      right: 16,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      bgcolor: 'rgba(255, 255, 255, 0.2)',
                      color: 'white',
                      '&:hover': {
                        bgcolor: 'rgba(255, 255, 255, 0.3)',
                      },
                      width: 56,
                      height: 56
                    }}
                  >
                    <ArrowForward sx={{ fontSize: 32 }} />
                  </IconButton>
                </>
              )}

              {/* Thumbnail Navigation */}
              {lightboxMedia.length > 1 && (
                <Box sx={{ 
                  display: 'flex', 
                  gap: 1, 
                  mt: 3,
                  flexWrap: 'wrap',
                  justifyContent: 'center',
                  maxWidth: '100%',
                  overflowX: 'auto'
                }}>
                  {lightboxMedia.map((media, index) => (
                    <Box
                      key={index}
                      onClick={() => setCurrentMediaIndex(index)}
                      sx={{
                        width: 60,
                        height: 60,
                        cursor: 'pointer',
                        border: index === currentMediaIndex 
                          ? '3px solid #667eea' 
                          : '2px solid rgba(255, 255, 255, 0.3)',
                        borderRadius: 1,
                        overflow: 'hidden',
                        opacity: index === currentMediaIndex ? 1 : 0.6,
                        transition: 'all 0.2s',
                        '&:hover': {
                          opacity: 1,
                          transform: 'scale(1.1)'
                        },
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        bgcolor: 'rgba(255, 255, 255, 0.1)'
                      }}
                    >
                      {media.mimeType?.startsWith('image/') ? (
                        <img
                          src={media.fullUrl}
                          alt={`Thumbnail ${index + 1}`}
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover'
                          }}
                        />
                      ) : media.mimeType?.startsWith('video/') ? (
                        <VideoLibrary sx={{ color: 'white', fontSize: 32 }} />
                      ) : (
                        <AttachFile sx={{ color: 'white', fontSize: 24 }} />
                      )}
                    </Box>
                  ))}
                </Box>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </ThemeProvider>
  );
};

export default ParentsUI; 