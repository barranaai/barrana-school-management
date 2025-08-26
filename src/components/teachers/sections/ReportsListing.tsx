import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Button,
  Avatar,
  Tooltip,
  Alert,
  CircularProgress,
  Fade,
  Grow,
  Card,
  CardContent,
  Grid,
  TextField,
  InputAdornment,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  Badge,
} from '@mui/material';
import {
  Assessment,
  People,
  Schedule,
  Mic,
  AutoFixHigh,
  Description,
  PlayArrow,
  Send,
  Edit,
  Visibility,
  Search,
  FilterList,
  CheckCircle,
  Warning,
  Info,
  Pending,
  Archive,
  Refresh,
  CloudDownload,
  AudioFile,
  TextFields,
  Article,
  Close,
  Save,
  Image,
  VideoFile,
  PictureAsPdf,
  InsertDriveFile,
} from '@mui/icons-material';
import { useData, type Report } from '../../../contexts/DataContext';
import { useAuth } from '../../../contexts/AuthContext';
import { reportService } from '../../../services/reportService';
import { mediaService } from '../../../services/mediaService';
import toast from 'react-hot-toast';

interface ReportsListingProps {}

const ReportsListing: React.FC<ReportsListingProps> = () => {
  const { user } = useAuth();
  const { reports: contextReports, students, getReportsByTeacherStudents } = useData();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [openReportDialog, setOpenReportDialog] = useState(false);
  const [openAudioDialog, setOpenAudioDialog] = useState(false);
  const [openTranscriptionDialog, setOpenTranscriptionDialog] = useState(false);
  const [openAIGeneratedDialog, setOpenAIGeneratedDialog] = useState(false);
  const [openMediaDialog, setOpenMediaDialog] = useState(false);
  const [selectedAudioReport, setSelectedAudioReport] = useState<Report | null>(null);
  const [selectedTranscriptionReport, setSelectedTranscriptionReport] = useState<Report | null>(null);
  const [selectedAIReport, setSelectedAIReport] = useState<Report | null>(null);
  const [selectedMediaReport, setSelectedMediaReport] = useState<Report | null>(null);
  const [editedContent, setEditedContent] = useState<string>('');
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [originalContent, setOriginalContent] = useState<string>('');

  // Debug: Log context reports
  console.log('🔍 Context reports:', contextReports);
  console.log('🔍 User ID:', user?.id);
  console.log('🔍 Students data:', students);
  console.log('🔍 Students count:', students.length);
  console.log('🔍 Sample student data:', students[0]);

  // Load reports for the teacher
  useEffect(() => {
    const loadReports = async () => {
      try {
        setLoading(true);
        console.log('🔍 Loading reports for teacher:', user?.id);
        
        // Always try to get complete data from API first
        const response = await reportService.getReports({
          teacherId: user?.id,
          limit: 100,
          page: 1
        });

        console.log('📊 API response:', response);

        if (response.success && response.data) {
          console.log('✅ Reports loaded from API:', response.data.length);
          console.log('🔍 First report studentId:', response.data[0]?.studentId);
          console.log('🔍 First report full data:', response.data[0]);
          // Convert API response to match our DataContext Report interface
          const convertedReports = response.data.map((report: any) => ({
            ...report,
            teacherId: typeof report.teacherId === 'object' ? report.teacherId._id : report.teacherId,
            studentId: report.studentId, // Keep as is since we handle union types
            aiGenerated: report.aiGenerated // Keep as is since we handle union types
          }));

          // Fetch media attachments for each report
          const reportsWithMedia = await Promise.all(
            convertedReports.map(async (report) => {
              try {
                const media = await mediaService.getReportMedia(report._id);
                return {
                  ...report,
                  attachments: media // Map media to attachments for compatibility
                };
              } catch (error) {
                console.error(`Error fetching media for report ${report._id}:`, error);
                return {
                  ...report,
                  attachments: []
                };
              }
            })
          );

          setReports(reportsWithMedia);
        } else {
          console.log('❌ No reports found from API, using context reports as fallback...');
          
          // Fallback to context reports if API fails
          const teacherReports = contextReports.filter(report => 
            report.teacherId === user?.id || report.teacherId === user?.id?.toString()
          );
          
          console.log('📊 Fallback context reports:', teacherReports.length);
          
          // Fetch media attachments for context reports too
          const reportsWithMedia = await Promise.all(
            teacherReports.map(async (report) => {
              try {
                const media = await mediaService.getReportMedia(report._id);
                return {
                  ...report,
                  attachments: media // Map media to attachments for compatibility
                };
              } catch (error) {
                console.error(`Error fetching media for report ${report._id}:`, error);
                return {
                  ...report,
                  attachments: []
                };
              }
            })
          );
          
          setReports(reportsWithMedia as any);
        }
      } catch (error) {
        console.error('❌ Error loading reports from API, using context reports as fallback:', error);
        
        // Fallback to context reports if API fails
        const teacherReports = contextReports.filter(report => 
          report.teacherId === user?.id || report.teacherId === user?.id?.toString()
        );
        
        console.log('📊 Error fallback context reports:', teacherReports.length);
        
        // Fetch media attachments for error fallback reports too
        const reportsWithMedia = await Promise.all(
          teacherReports.map(async (report) => {
            try {
              const media = await mediaService.getReportMedia(report._id);
              return {
                ...report,
                attachments: media // Map media to attachments for compatibility
              };
            } catch (error) {
              console.error(`Error fetching media for report ${report._id}:`, error);
              return {
                ...report,
                attachments: []
              };
            }
          })
        );
        
        setReports(reportsWithMedia as any);
      } finally {
        setLoading(false);
      }
    };

    if (user?.id) {
      loadReports();
    }
  }, [user?.id]); // Remove contextReports from dependency to avoid unnecessary re-renders

  // Debug: Log when students data changes
  useEffect(() => {
    console.log('🔍 Students data updated:', students.length, 'students');
    if (students.length > 0) {
      console.log('🔍 First student sample:', {
        _id: students[0]._id,
        name: students[0].name,
        grade: students[0].grade,
        studentClass: students[0].studentClass,
        class: students[0].class
      });
    }
  }, [students]);

  // Update reports when new ones are added to context (for real-time updates)
  useEffect(() => {
    if (contextReports.length > 0) {
      const teacherReports = contextReports.filter(report => 
        report.teacherId === user?.id || report.teacherId === user?.id?.toString()
      );
      
      // Merge with existing reports, avoiding duplicates
      setReports(prevReports => {
        const existingIds = new Set(prevReports.map(r => r._id));
        const newReports = teacherReports.filter(r => !existingIds.has(r._id));
        
        if (newReports.length > 0) {
          console.log('🔄 Adding new reports from context:', newReports.length);
          // Note: New reports from context won't have media loaded initially
          // They will get media loaded on the next full refresh
          return [...newReports, ...prevReports] as any;
        }
        
        return prevReports;
      });
    }
  }, [contextReports.length, user?.id]); // Only when the length changes, not the entire array

  // Filter reports based on search and status
  const filteredReports = reports.filter(report => {
    // Handle both DataContext reports (studentId as string) and API reports (studentId as object)
    let studentName = '';
    if (typeof report.studentId === 'string') {
      studentName = report.studentId;
    } else if (report.studentId && typeof report.studentId === 'object') {
      studentName = `${report.studentId.firstName} ${report.studentId.lastName}`;
    }
    
    const matchesSearch = 
      (studentName && studentName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      report.title?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || report.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'warning';
      case 'review': return 'warning';
      case 'approved': return 'success';
      case 'sent': return 'success';
      case 'archived': return 'secondary';
      default: return 'default';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'draft': return <Pending />;
      case 'review': return <Pending />;
      case 'approved': return <CheckCircle />;
      case 'sent': return <Send />;
      case 'archived': return <Archive />;
      default: return <Info />;
    }
  };

  const getStatusDisplayName = (status: string) => {
    switch (status) {
      case 'draft': return 'Sent For Approval';
      case 'review': return 'Under Review';
      case 'approved': return 'Approved';
      case 'sent': return 'Sent';
      case 'archived': return 'Archived';
      default: return status;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleViewReport = (report: Report) => {
    setSelectedReport(report);
    setOpenReportDialog(true);
  };

  const handleSendReport = async (reportId: string) => {
    try {
      const response = await reportService.sendReportToParents(reportId, ['parent@example.com']);
      if (response.success) {
        toast.success('Report sent to parents successfully!');
        // Refresh reports
        window.location.reload();
      } else {
        toast.error('Failed to send report');
      }
    } catch (error) {
      console.error('Error sending report:', error);
      toast.error('Error sending report');
    }
  };

  const handleCloseDialog = () => {
    setOpenReportDialog(false);
    setSelectedReport(null);
  };

  const handleAudioClick = (report: Report) => {
    console.log('🔍 Audio Click - Report:', report);
    console.log('🔍 Voice Recording:', report.voiceRecording);
    console.log('🔍 Has Recording:', report.voiceRecording?.hasRecording);
    console.log('🔍 Recording URL:', report.voiceRecording?.recordingUrl);
    console.log('🔍 Recordings Array:', report.voiceRecording?.recordings);
    console.log('🔍 Recordings Array Length:', report.voiceRecording?.recordings?.length);
    console.log('🔍 Transcription:', report.voiceRecording?.transcription);
    setSelectedAudioReport(report);
    setOpenAudioDialog(true);
  };

  const handleCloseAudioDialog = () => {
    setOpenAudioDialog(false);
    setSelectedAudioReport(null);
  };

  const handleTranscriptionClick = (report: Report) => {
    console.log('🔍 Transcription Click - Report:', report);
    console.log('🔍 Combined Transcription:', report.voiceRecording?.transcription);
    setSelectedTranscriptionReport(report);
    setOpenTranscriptionDialog(true);
  };

  const handleCloseTranscriptionDialog = () => {
    setOpenTranscriptionDialog(false);
    setSelectedTranscriptionReport(null);
  };

  const handleAIGeneratedClick = (report: Report) => {
    console.log('🔍 AI Generated Click - Report:', report);
    console.log('🔍 AI Generated Content:', report.content);
    setSelectedAIReport(report);
    setEditedContent(report.content);
    setOriginalContent(report.content);
    setIsEditing(false);
    setOpenAIGeneratedDialog(true);
  };

  const handleCloseAIGeneratedDialog = () => {
    setOpenAIGeneratedDialog(false);
    setSelectedAIReport(null);
    setEditedContent('');
    setOriginalContent('');
    setIsEditing(false);
  };

  const handleMediaClick = (report: Report) => {
    console.log('🔍 Media Click - Report:', report);
    console.log('🔍 Attachments:', report.attachments);
    setSelectedMediaReport(report);
    setOpenMediaDialog(true);
  };

  const handleCloseMediaDialog = () => {
    setOpenMediaDialog(false);
    setSelectedMediaReport(null);
  };

  const getMediaIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) return <Image />;
    if (mimeType.startsWith('video/')) return <VideoFile />;
    if (mimeType === 'application/pdf') return <PictureAsPdf />;
    return <InsertDriveFile />;
  };

  const getMediaColor = (mimeType: string) => {
    if (mimeType.startsWith('image/')) return 'success';
    if (mimeType.startsWith('video/')) return 'warning';
    if (mimeType === 'application/pdf') return 'error';
    return 'default';
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const hasMediaAttachments = (report: Report) => {
    return report.attachments && report.attachments.length > 0;
  };

  const handleEditContent = () => {
    setIsEditing(true);
  };

  const handleSaveContent = async () => {
    if (!selectedAIReport) return;
    
    // Validate that content is not empty
    if (!editedContent.trim()) {
      toast.error('Report content cannot be empty');
      return;
    }
    
    setIsSaving(true);
    try {
      console.log('💾 Saving edited report content:', {
        reportId: selectedAIReport._id,
        originalContent: selectedAIReport.content,
        newContent: editedContent
      });

      // Call the API to update the report content
      const response = await reportService.updateReport({
        id: selectedAIReport._id,
        content: editedContent
      });

      if (response.success) {
        toast.success('Report content updated successfully!');
        setIsEditing(false);
        
        // Update the local state with the new content
        const updatedReport = {
          ...selectedAIReport,
          content: editedContent
        };
        setSelectedAIReport(updatedReport);
        
        // Update the reports list to reflect the changes
        setReports(prevReports => 
          prevReports.map(report => 
            report._id === selectedAIReport._id 
              ? updatedReport 
              : report
          )
        );
        
        console.log('✅ Report content saved successfully');
      } else {
        throw new Error(response.message || 'Failed to save report content');
      }
    } catch (error) {
      console.error('❌ Error saving report content:', error);
      toast.error('Failed to save report content. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setEditedContent(originalContent);
    setIsEditing(false);
  };

  const getStudentName = (report: Report) => {
    if (report.studentId && typeof report.studentId === 'object') {
      return `${report.studentId.firstName} ${report.studentId.lastName}`;
    }
    // For DataContext reports, studentId might be a string
    return report.studentId || 'Unknown Student';
  };

  const getStudentGrade = (report: Report) => {
    // Handle populated student object from API
    if (report.studentId && typeof report.studentId === 'object') {
      // If populated object has grade, use it
      if (report.studentId.grade) {
        return report.studentId.grade;
      }
      
      // Otherwise, find student in students array using the _id
      const student = students.find(s => s._id === (report.studentId as any)._id);
      if (student) {
        return student.grade || 'N/A';
      }
    }
    
    // Handle string studentId - find student in students array
    if (typeof report.studentId === 'string') {
      const student = students.find(s => s._id === report.studentId);
      if (student) {
        return student.grade || 'N/A';
      }
    }
    
    return 'N/A';
  };

  const getStudentClass = (report: Report) => {
    // Handle populated student object from API
    if (report.studentId && typeof report.studentId === 'object') {
      // If populated object has class data, use it
      const studentClass = (report.studentId as any).studentClass || (report.studentId as any).class;
      if (studentClass) {
        return studentClass;
      }
      
      // Otherwise, find student in students array using the _id
      const student = students.find(s => s._id === (report.studentId as any)._id);
      if (student) {
        return student.studentClass || student.class || 'N/A';
      }
    }
    
    // Handle string studentId - find student in students array
    if (typeof report.studentId === 'string') {
      const student = students.find(s => s._id === report.studentId);
      if (student) {
        return student.studentClass || student.class || 'N/A';
      }
    }
    
    return 'N/A';
  };

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
            My Reports
          </Typography>
          <Typography 
            variant="body1" 
            sx={{ 
              color: 'text.secondary',
              opacity: 0.8,
              fontWeight: 500,
            }}
          >
            View and manage all your generated reports and approvals
          </Typography>
        </Box>
      </Fade>



      {/* Stats Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grow in timeout={800}>
          <Grid item xs={12} sm={6} md={2.4}>
            <Card sx={{ borderRadius: 3, boxShadow: '0 8px 32px rgba(0,0,0,0.1)' }}>
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <Avatar sx={{ bgcolor: 'primary.main', mr: 2 }}>
                    <Assessment />
                  </Avatar>
                  <Box>
                    <Typography variant="h4" sx={{ fontWeight: 700 }}>
                      {reports.length}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Total Reports
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grow>

        <Grow in timeout={900}>
          <Grid item xs={12} sm={6} md={2.4}>
            <Card sx={{ borderRadius: 3, boxShadow: '0 8px 32px rgba(0,0,0,0.1)' }}>
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <Avatar sx={{ bgcolor: 'warning.main', mr: 2 }}>
                    <Pending />
                  </Avatar>
                  <Box>
                    <Typography variant="h4" sx={{ fontWeight: 700 }}>
                      {reports.filter(r => r.status === 'draft').length}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Sent For Approval
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grow>

        <Grow in timeout={1000}>
          <Grid item xs={12} sm={6} md={2.4}>
            <Card sx={{ borderRadius: 3, boxShadow: '0 8px 32px rgba(0,0,0,0.1)' }}>
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <Avatar sx={{ bgcolor: 'success.main', mr: 2 }}>
                    <Send />
                  </Avatar>
                  <Box>
                    <Typography variant="h4" sx={{ fontWeight: 700 }}>
                      {reports.filter(r => r.status === 'sent').length}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Sent Reports
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grow>

        <Grow in timeout={1100}>
          <Grid item xs={12} sm={6} md={2.4}>
            <Card sx={{ borderRadius: 3, boxShadow: '0 8px 32px rgba(0,0,0,0.1)' }}>
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <Avatar sx={{ bgcolor: 'info.main', mr: 2 }}>
                    <Mic />
                  </Avatar>
                  <Box>
                    <Typography variant="h4" sx={{ fontWeight: 700 }}>
                      {reports.filter(r => r.voiceRecording?.hasRecording).length}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      With Audio
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grow>

        <Grow in timeout={1200}>
          <Grid item xs={12} sm={6} md={2.4}>
            <Card sx={{ borderRadius: 3, boxShadow: '0 8px 32px rgba(0,0,0,0.1)' }}>
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <Avatar sx={{ bgcolor: 'secondary.main', mr: 2 }}>
                    <Image />
                  </Avatar>
                  <Box>
                    <Typography variant="h4" sx={{ fontWeight: 700 }}>
                      {reports.filter(r => hasMediaAttachments(r)).length}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      With Media
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grow>
      </Grid>

      {/* Search and Filters */}
      <Box sx={{ mb: 3, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        <TextField
          placeholder="Search by student name or report title..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search />
              </InputAdornment>
            ),
          }}
          sx={{ minWidth: 300, flexGrow: 1 }}
        />
        
        <TextField
          select
          label="Status Filter"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          sx={{ minWidth: 150 }}
        >
          <option value="all">All Status</option>
          <option value="draft">Sent For Approval</option>
          <option value="review">Review</option>
          <option value="approved">Approved</option>
          <option value="sent">Sent</option>
          <option value="archived">Archived</option>
        </TextField>

        <Button
          variant="outlined"
          startIcon={<Refresh />}
          onClick={() => window.location.reload()}
        >
          Refresh
        </Button>
      </Box>

      {/* Reports Table */}
      <Grow in timeout={1200}>
        <Paper sx={{ borderRadius: 4, overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.1)' }}>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
              <CircularProgress />
            </Box>
          ) : filteredReports.length === 0 ? (
            <Box sx={{ textAlign: 'center', p: 4 }}>
              <Assessment sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
              <Typography variant="h6" color="text.secondary" gutterBottom>
                {reports.length === 0 ? 'No reports found' : 'No reports match your search'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {reports.length === 0 
                  ? 'Start generating reports for your students to see them here.'
                  : 'Try adjusting your search criteria or status filter.'
                }
              </Typography>
            </Box>
          ) : (
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow sx={{ backgroundColor: 'rgba(102, 126, 234, 0.05)' }}>
                    <TableCell sx={{ fontWeight: 600 }}>Student</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Report Date</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Audio</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Transcription</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Media</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Generated Report</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredReports.map((report) => (
                    <TableRow 
                      key={report._id}
                      hover
                      sx={{ 
                        '&:hover': {
                          backgroundColor: 'rgba(102, 126, 234, 0.05)',
                        },
                      }}
                    >
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <Avatar 
                            sx={{ 
                              mr: 2,
                              bgcolor: 'primary.main',
                              width: 40,
                              height: 40,
                            }}
                          >
                            {getStudentName(report).split(' ').map(n => n[0]).join('').toUpperCase()}
                          </Avatar>
                          <Box>
                            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                              {getStudentName(report)}
                            </Typography>
                            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                              <Chip
                                label={`Grade ${getStudentGrade(report)}`}
                                size="small"
                                variant="outlined"
                                sx={{
                                  fontSize: '0.7rem',
                                  height: 20,
                                  backgroundColor: 'rgba(102, 126, 234, 0.1)',
                                  borderColor: 'rgba(102, 126, 234, 0.3)',
                                  color: '#667eea',
                                  fontWeight: 500,
                                }}
                              />
                              <Chip
                                label={`Class ${getStudentClass(report)}`}
                                size="small"
                                variant="outlined"
                                sx={{
                                  fontSize: '0.7rem',
                                  height: 20,
                                  backgroundColor: 'rgba(76, 175, 80, 0.1)',
                                  borderColor: 'rgba(76, 175, 80, 0.3)',
                                  color: '#4caf50',
                                  fontWeight: 500,
                                }}
                              />
                            </Box>
                          </Box>
                        </Box>
                      </TableCell>
                      
                      <TableCell>
                        <Typography variant="body2">
                          {formatDate(report.createdAt)}
                        </Typography>
                      </TableCell>
                      
                      <TableCell>
                        {report.voiceRecording?.hasRecording ? (
                          <Tooltip title="Click to listen to all audio recordings">
                            <Chip
                              icon={<AudioFile />}
                              label={report.voiceRecording.recordingDuration && report.voiceRecording.recordingDuration > 60 ? "Multiple Audio" : "Audio"}
                              size="small"
                              color="success"
                              variant="outlined"
                              onClick={() => handleAudioClick(report)}
                              sx={{ 
                                cursor: 'pointer',
                                '&:hover': {
                                  backgroundColor: 'rgba(76, 175, 80, 0.1)',
                                  transform: 'scale(1.05)',
                                },
                                transition: 'all 0.2s ease'
                              }}
                            />
                          </Tooltip>
                        ) : (
                          <Typography variant="body2" color="text.secondary">
                            No audio
                          </Typography>
                        )}
                      </TableCell>
                      
                      <TableCell>
                        {report.voiceRecording?.transcription ? (
                          <Tooltip title="Click to view combined transcription from all recordings">
                            <Chip
                              icon={<TextFields />}
                              label={report.voiceRecording.transcription.includes('--- Next Recording ---') ? "Combined" : "Transcribed"}
                              size="small"
                              color="info"
                              variant="outlined"
                              onClick={() => handleTranscriptionClick(report)}
                              sx={{ 
                                cursor: 'pointer',
                                '&:hover': {
                                  backgroundColor: 'rgba(33, 150, 243, 0.1)',
                                  transform: 'scale(1.05)',
                                },
                                transition: 'all 0.2s ease'
                              }}
                            />
                          </Tooltip>
                        ) : (
                          <Typography variant="body2" color="text.secondary">
                            No transcription
                          </Typography>
                        )}
                      </TableCell>
                      
                      <TableCell>
                        {hasMediaAttachments(report) ? (
                          <Tooltip title={`Click to view ${report.attachments?.length} media attachment${(report.attachments?.length || 0) > 1 ? 's' : ''}`}>
                            <Chip
                              icon={<Image />}
                              label={`${report.attachments?.length} Media`}
                              size="small"
                              color="secondary"
                              variant="outlined"
                              onClick={() => handleMediaClick(report)}
                              sx={{ 
                                cursor: 'pointer',
                                '&:hover': {
                                  backgroundColor: 'rgba(156, 39, 176, 0.1)',
                                  transform: 'scale(1.05)',
                                },
                                transition: 'all 0.2s ease'
                              }}
                            />
                          </Tooltip>
                        ) : (
                          <Typography variant="body2" color="text.secondary">
                            No media
                          </Typography>
                        )}
                      </TableCell>
                      
                      <TableCell>
                        {(typeof report.aiGenerated === 'boolean' ? report.aiGenerated : report.aiGenerated?.isAiGenerated) ? (
                          <Tooltip title="Click to view and edit generated report">
                            <Chip
                              icon={<AutoFixHigh />}
                              label="Generated Report"
                              size="small"
                              color="primary"
                              variant="outlined"
                              onClick={() => handleAIGeneratedClick(report)}
                              sx={{ 
                                cursor: 'pointer',
                                '&:hover': {
                                  backgroundColor: 'rgba(156, 39, 176, 0.1)',
                                  transform: 'scale(1.05)',
                                },
                                transition: 'all 0.2s ease'
                              }}
                            />
                          </Tooltip>
                        ) : (
                          <Typography variant="body2" color="text.secondary">
                            Manual
                          </Typography>
                        )}
                      </TableCell>
                      
                      <TableCell>
                        <Chip
                          icon={getStatusIcon(report.status)}
                          label={getStatusDisplayName(report.status)}
                          size="small"
                          color={getStatusColor(report.status) as any}
                          sx={{ fontWeight: 600 }}
                        />
                      </TableCell>
                      
                      <TableCell>
                        <Box sx={{ display: 'flex', gap: 1 }}>
                          <Tooltip title="View Report">
                            <IconButton
                              size="small"
                              onClick={() => handleViewReport(report)}
                              sx={{ color: 'primary.main' }}
                            >
                              <Visibility />
                            </IconButton>
                          </Tooltip>
                          
                          {report.status === 'draft' && (
                            <Tooltip title="Send to Parents (Disabled)">
                              <IconButton
                                size="small"
                                onClick={() => {}} // Disabled functionality
                                disabled={true}
                                sx={{ color: 'grey.400', opacity: 0.6 }}
                              >
                                <Send />
                              </IconButton>
                            </Tooltip>
                          )}
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Paper>
      </Grow>

      {/* Report Details Dialog */}
      <Dialog
        open={openReportDialog}
        onClose={handleCloseDialog}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            background: 'linear-gradient(135deg, #ffffff 0%, #f8f9ff 100%)',
          }
        }}
      >
        <DialogTitle
          sx={{
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            p: 3,
          }}
        >
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            Report Details: {selectedReport?.title}
          </Typography>
        </DialogTitle>
        
        <DialogContent sx={{ p: 3 }}>
          {selectedReport && (
            <Box>
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <Card sx={{ p: 2, mb: 2 }}>
                    <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <People />
                      Student Information
                    </Typography>
                    <List dense>
                      <ListItem>
                        <ListItemText
                          primary="Student Name"
                          secondary={getStudentName(selectedReport)}
                        />
                      </ListItem>
                      <ListItem>
                        <ListItemText
                          primary="Grade"
                          secondary={getStudentGrade(selectedReport)}
                        />
                      </ListItem>
                      <ListItem>
                        <ListItemText
                          primary="Report Date"
                          secondary={formatDate(selectedReport.createdAt)}
                        />
                      </ListItem>
                      <ListItem>
                        <ListItemText
                          primary="Status"
                          secondary={
                            <Chip
                              icon={getStatusIcon(selectedReport.status)}
                              label={getStatusDisplayName(selectedReport.status)}
                              size="small"
                              color={getStatusColor(selectedReport.status) as any}
                            />
                          }
                        />
                      </ListItem>
                    </List>
                  </Card>
                </Grid>
                
                <Grid item xs={12} md={6}>
                  <Card sx={{ p: 2, mb: 2 }}>
                    <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Assessment />
                      Report Features
                    </Typography>
                    <List dense>
                      <ListItem>
                        <ListItemIcon>
                          {selectedReport.voiceRecording?.hasRecording ? (
                            <AudioFile color="success" />
                          ) : (
                            <AudioFile color="disabled" />
                          )}
                        </ListItemIcon>
                        <ListItemText
                          primary="Audio Recording"
                          secondary={selectedReport.voiceRecording?.hasRecording ? 'Available' : 'Not available'}
                        />
                      </ListItem>
                      <ListItem>
                        <ListItemIcon>
                          {selectedReport.voiceRecording?.transcription ? (
                            <TextFields color="info" />
                          ) : (
                            <TextFields color="disabled" />
                          )}
                        </ListItemIcon>
                        <ListItemText
                          primary="Transcription"
                          secondary={selectedReport.voiceRecording?.transcription ? 'Available' : 'Not available'}
                        />
                      </ListItem>
                      <ListItem>
                        <ListItemIcon>
                          {(typeof selectedReport.aiGenerated === 'boolean' ? selectedReport.aiGenerated : selectedReport.aiGenerated?.isAiGenerated) ? (
                            <AutoFixHigh color="primary" />
                          ) : (
                            <AutoFixHigh color="disabled" />
                          )}
                        </ListItemIcon>
                        <ListItemText
                          primary="Generated Report"
                          secondary={(typeof selectedReport.aiGenerated === 'boolean' ? selectedReport.aiGenerated : selectedReport.aiGenerated?.isAiGenerated) ? 'Yes' : 'No'}
                        />
                      </ListItem>
                      <ListItem>
                        <ListItemIcon>
                          {hasMediaAttachments(selectedReport) ? (
                            <Image color="secondary" />
                          ) : (
                            <Image color="disabled" />
                          )}
                        </ListItemIcon>
                        <ListItemText
                          primary="Media Attachments"
                          secondary={hasMediaAttachments(selectedReport) ? `${selectedReport.attachments?.length} file${(selectedReport.attachments?.length || 0) > 1 ? 's' : ''}` : 'No attachments'}
                        />
                      </ListItem>
                    </List>
                  </Card>
                </Grid>
              </Grid>
              
              <Card sx={{ p: 2 }}>
                <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Article />
                  Report Content
                </Typography>
                <Box sx={{ 
                  p: 2, 
                  bgcolor: 'grey.50', 
                  borderRadius: 2,
                  maxHeight: 300,
                  overflow: 'auto'
                }}>
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                    {selectedReport.content}
                  </Typography>
                </Box>
              </Card>
            </Box>
          )}
        </DialogContent>
        
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={handleCloseDialog} variant="outlined">
            Close
          </Button>
          {selectedReport?.status === 'draft' && (
            <Button
              variant="contained"
              startIcon={<Send />}
              onClick={() => {}} // Disabled functionality
              disabled={true}
              sx={{
                background: 'linear-gradient(135deg, #cccccc 0%, #999999 100%)',
                opacity: 0.6,
              }}
            >
              Send to Parents (Disabled)
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* Audio Player Dialog */}
      <Dialog
        open={openAudioDialog}
        onClose={handleCloseAudioDialog}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            background: 'linear-gradient(135deg, #ffffff 0%, #f8f9ff 100%)',
          }
        }}
      >
        <DialogTitle
          sx={{
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            p: 3,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Avatar 
              sx={{ 
                bgcolor: 'rgba(255,255,255,0.2)',
                width: 48,
                height: 48,
              }}
            >
              <AudioFile />
            </Avatar>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                Audio Recordings
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.9 }}>
                {selectedAudioReport && getStudentName(selectedAudioReport)}
              </Typography>
            </Box>
          </Box>
          <IconButton onClick={handleCloseAudioDialog} sx={{ color: 'white' }}>
            <Close />
          </IconButton>
        </DialogTitle>
        
        <DialogContent sx={{ p: 3 }}>
          {selectedAudioReport && (
            <Box sx={{ mt: 2 }}>
              
              {((selectedAudioReport.voiceRecording?.recordings?.length ?? 0) > 0 || selectedAudioReport.voiceRecording?.recordingUrl) ? (
                <Box>
                  <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
                    <AudioFile />
                    Audio Recordings
                    <Chip 
                      label={`${selectedAudioReport.voiceRecording?.recordings?.length || 1} recording${(selectedAudioReport.voiceRecording?.recordings?.length || 1) > 1 ? 's' : ''}`}
                      size="small"
                      color="primary"
                      variant="outlined"
                    />
                  </Typography>
                  
                  {/* Multiple Recordings Display */}
                  <Box sx={{ mb: 3 }}>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      This report contains {selectedAudioReport.voiceRecording?.recordings?.length || 1} audio recording{(selectedAudioReport.voiceRecording?.recordings?.length || 1) > 1 ? 's' : ''}. Click play to listen to each recording.
                    </Typography>
                    
                    {/* Display all recordings from the recordings array */}
                    {selectedAudioReport.voiceRecording?.recordings?.map((recording, index) => {
                      console.log(`🔍 Audio Recording #${index + 1} Original URL:`, recording.url);
                      const isBlob = recording.url.startsWith('blob:');
                      const audioSrc = isBlob 
                        ? '' // Empty src for blob URLs to show error state
                        : recording.url.startsWith('http') 
                          ? recording.url 
                          : recording.url.startsWith('/') ? recording.url : '/' + recording.url;
                      
                      console.log(`🔍 Audio Recording #${index + 1} Constructed audioSrc:`, audioSrc);
                      console.log(`🔍 Audio Recording #${index + 1} isBlob:`, isBlob);
                      
                      return (
                        <Card key={index} sx={{ p: 3, mb: 2, bgcolor: isBlob ? 'error.50' : 'grey.50' }}>
                          <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600 }}>
                            Audio Recording #{index + 1}
                          </Typography>
                          <Box sx={{ textAlign: 'center' }}>
                            {isBlob ? (
                              <Box sx={{ p: 3, bgcolor: 'warning.50', borderRadius: 1, mb: 2 }}>
                                <AudioFile sx={{ fontSize: 48, color: 'warning.main', mb: 1 }} />
                                <Typography variant="body2" color="warning.main" sx={{ fontWeight: 600 }}>
                                  Audio Not Available
                                </Typography>
                                <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block' }}>
                                  This recording was created with an older version and cannot be played. 
                                  New recordings will work properly.
                                </Typography>
                                <Alert severity="info" sx={{ mt: 2, fontSize: '0.75rem' }}>
                                  💡 <strong>Tip:</strong> Create new reports using the "Generate Report" button for working audio playback.
                                </Alert>
                              </Box>
                            ) : (
                              <audio 
                                controls 
                                style={{ width: '100%', marginBottom: 2 }}
                                preload="metadata"
                                onError={(e) => {
                                  console.error(`❌ Audio playback error for recording #${index + 1}:`, e);
                                  console.error(`❌ Audio src:`, audioSrc);
                                }}
                                onCanPlay={() => {
                                  console.log(`✅ Audio can play for recording #${index + 1}:`, audioSrc);
                                }}
                                onLoadedMetadata={() => {
                                  console.log(`📊 Audio metadata loaded for recording #${index + 1}:`, audioSrc);
                                }}
                              >
                                <source src={audioSrc} type="audio/webm" />
                                <source src={audioSrc} type="audio/ogg" />
                                <source src={audioSrc} type="audio/mpeg" />
                                Your browser does not support the audio element.
                              </audio>
                            )}
                            <Typography variant="body2" color="text.secondary">
                              Duration: {recording.duration ? 
                                `${Math.floor(recording.duration / 60)}:${(recording.duration % 60).toString().padStart(2, '0')}` : 
                                'Unknown'
                              }
                            </Typography>
                          </Box>
                        
                          {/* Individual recording transcription */}
                          {recording.transcription && (
                            <Box sx={{ mt: 2, p: 2, bgcolor: 'blue.50', borderRadius: 1 }}>
                              <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>
                                Transcription #{index + 1}
                              </Typography>
                              <Typography variant="body2" sx={{ 
                                whiteSpace: 'pre-wrap',
                                fontSize: '0.875rem',
                                color: 'text.secondary'
                              }}>
                                {recording.transcription}
                              </Typography>
                            </Box>
                          )}
                        </Card>
                      );
                    })}
                    
                    {/* Fallback for old format with single recordingUrl */}
                    {!selectedAudioReport.voiceRecording?.recordings?.length && selectedAudioReport.voiceRecording?.recordingUrl && (
                      (() => {
                        const isBlob = selectedAudioReport.voiceRecording?.recordingUrl?.startsWith('blob:') || false;
                        const audioSrc = isBlob 
                          ? '' 
                          : selectedAudioReport.voiceRecording?.recordingUrl?.startsWith('http') 
                            ? selectedAudioReport.voiceRecording?.recordingUrl 
                            : selectedAudioReport.voiceRecording?.recordingUrl?.startsWith('/') 
                              ? selectedAudioReport.voiceRecording?.recordingUrl 
                              : '/' + (selectedAudioReport.voiceRecording?.recordingUrl || '');
                        
                        return (
                          <Card sx={{ p: 3, mb: 2, bgcolor: isBlob ? 'error.50' : 'grey.50' }}>
                            <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600 }}>
                              Audio Recording
                            </Typography>
                            <Box sx={{ textAlign: 'center' }}>
                              {isBlob ? (
                                <Box sx={{ p: 3, bgcolor: 'warning.50', borderRadius: 1, mb: 2 }}>
                                  <AudioFile sx={{ fontSize: 48, color: 'warning.main', mb: 1 }} />
                                  <Typography variant="body2" color="warning.main" sx={{ fontWeight: 600 }}>
                                    Audio Not Available
                                  </Typography>
                                  <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block' }}>
                                    This recording was created with an older version and cannot be played. 
                                    New recordings will work properly.
                                  </Typography>
                                  <Alert severity="info" sx={{ mt: 2, fontSize: '0.75rem' }}>
                                    💡 <strong>Tip:</strong> Create new reports using the "Generate Report" button for working audio playback.
                                  </Alert>
                                </Box>
                              ) : (
                                <audio 
                                  controls 
                                  style={{ width: '100%', marginBottom: 2 }}
                                  preload="metadata"
                                  onError={(e) => {
                                    console.error(`❌ Audio playback error for fallback recording:`, e);
                                    console.error(`❌ Audio src:`, audioSrc);
                                  }}
                                  onCanPlay={() => {
                                    console.log(`✅ Audio can play for fallback recording:`, audioSrc);
                                  }}
                                  onLoadedMetadata={() => {
                                    console.log(`📊 Audio metadata loaded for fallback recording:`, audioSrc);
                                  }}
                                >
                                  <source src={audioSrc} type="audio/webm" />
                                  <source src={audioSrc} type="audio/ogg" />
                                  <source src={audioSrc} type="audio/mpeg" />
                                  Your browser does not support the audio element.
                                </audio>
                              )}
                              <Typography variant="body2" color="text.secondary">
                                Duration: {selectedAudioReport.voiceRecording?.recordingDuration ? 
                                  `${Math.floor(selectedAudioReport.voiceRecording.recordingDuration / 60)}:${(selectedAudioReport.voiceRecording.recordingDuration % 60).toString().padStart(2, '0')}` : 
                                  'Unknown'
                                }
                              </Typography>
                            </Box>
                          </Card>
                        );
                      })()
                    )}
                     
                    {/* Combined Transcription (for backward compatibility) */}
                    {selectedAudioReport.voiceRecording?.transcription && !selectedAudioReport.voiceRecording?.recordings?.length && (
                      <Card sx={{ p: 3, mb: 2, bgcolor: 'blue.50' }}>
                        <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600 }}>
                          Combined Transcription
                        </Typography>
                        <Typography variant="body2" sx={{ 
                          whiteSpace: 'pre-wrap',
                          fontSize: '0.875rem',
                          color: 'text.secondary'
                        }}>
                          {selectedAudioReport.voiceRecording.transcription}
                        </Typography>
                      </Card>
                    )}
                  </Box>
                </Box>
              ) : (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <AudioFile sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                  <Typography variant="h6" color="text.secondary" gutterBottom>
                    Audio Not Available
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    The audio recording URL is not available for this report.
                  </Typography>
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
        
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={handleCloseAudioDialog} variant="outlined">
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* Transcription Dialog */}
      <Dialog
        open={openTranscriptionDialog}
        onClose={handleCloseTranscriptionDialog}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            background: 'linear-gradient(135deg, #ffffff 0%, #f8f9ff 100%)',
          }
        }}
      >
        <DialogTitle
          sx={{
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            p: 3,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Avatar 
              sx={{ 
                bgcolor: 'rgba(255,255,255,0.2)',
                width: 48,
                height: 48,
              }}
            >
              <TextFields />
            </Avatar>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                Combined Transcription
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.9 }}>
                {selectedTranscriptionReport && getStudentName(selectedTranscriptionReport)}
              </Typography>
            </Box>
          </Box>
          <IconButton onClick={handleCloseTranscriptionDialog} sx={{ color: 'white' }}>
            <Close />
          </IconButton>
        </DialogTitle>
        
        <DialogContent sx={{ p: 3 }}>
          {selectedTranscriptionReport && (
            <Box sx={{ mt: 2 }}>
              {selectedTranscriptionReport.voiceRecording?.transcription ? (
                <Box>
                  <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
                    <TextFields />
                    Combined Transcription
                    <Chip 
                      label={`${selectedTranscriptionReport.voiceRecording?.recordings?.length || 1} recording${(selectedTranscriptionReport.voiceRecording?.recordings?.length || 1) > 1 ? 's' : ''}`}
                      size="small"
                      color="primary"
                      variant="outlined"
                    />
                  </Typography>
                  
                  <Card sx={{ p: 3, bgcolor: 'blue.50', borderRadius: 2 }}>
                    <Typography variant="body1" sx={{ 
                      whiteSpace: 'pre-wrap',
                      fontSize: '1rem',
                      lineHeight: 1.6,
                      color: 'text.primary'
                    }}>
                      {selectedTranscriptionReport.voiceRecording.transcription}
                    </Typography>
                  </Card>
                </Box>
              ) : (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <TextFields sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                  <Typography variant="h6" color="text.secondary" gutterBottom>
                    No Transcription Available
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    This report doesn't have any transcription data.
                  </Typography>
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
        
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={handleCloseTranscriptionDialog} variant="outlined">
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* AI Generated Report Dialog */}
      <Dialog
        open={openAIGeneratedDialog}
        onClose={handleCloseAIGeneratedDialog}
        maxWidth="lg"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            background: 'linear-gradient(135deg, #ffffff 0%, #f8f9ff 100%)',
          }
        }}
      >
        <DialogTitle
          sx={{
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            p: 3,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Avatar 
              sx={{ 
                bgcolor: 'rgba(255,255,255,0.2)',
                width: 48,
                height: 48,
              }}
            >
              <AutoFixHigh />
            </Avatar>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                Generated Report
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.9 }}>
                {selectedAIReport && getStudentName(selectedAIReport)}
              </Typography>
            </Box>
          </Box>
          <IconButton onClick={handleCloseAIGeneratedDialog} sx={{ color: 'white' }}>
            <Close />
          </IconButton>
        </DialogTitle>
        
        <DialogContent sx={{ p: 3 }}>
          {selectedAIReport && (
            <Box sx={{ mt: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <AutoFixHigh />
                  Report Content
                  <Chip 
                    label={selectedAIReport.status}
                    size="small"
                    color={selectedAIReport.status === 'draft' ? 'primary' : 'secondary'}
                    variant={selectedAIReport.status === 'draft' ? 'outlined' : 'filled'}
                  />
                </Typography>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  {!isEditing ? (
                    selectedAIReport.status === 'draft' ? (
                      <Button
                        variant="outlined"
                        startIcon={<Edit />}
                        onClick={handleEditContent}
                        sx={{ color: 'primary.main' }}
                      >
                        Edit
                      </Button>
                    ) : (
                      <Chip 
                        label={`Status: ${getStatusDisplayName(selectedAIReport.status)}`}
                        color="secondary"
                        size="small"
                        sx={{ 
                          backgroundColor: 'rgba(156, 39, 176, 0.1)',
                          color: 'text.secondary'
                        }}
                      />
                    )
                  ) : (
                    <>
                      <Button
                        variant="contained"
                        startIcon={<Save />}
                        onClick={handleSaveContent}
                        disabled={isSaving}
                        sx={{
                          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        }}
                      >
                        {isSaving ? 'Saving...' : 'Save'}
                      </Button>
                      <Button
                        variant="outlined"
                        onClick={handleCancelEdit}
                        disabled={isSaving}
                      >
                        Cancel
                      </Button>
                    </>
                  )}
                </Box>
                {isEditing && editedContent !== originalContent && (
                  <Chip 
                    label="Unsaved changes" 
                    color="warning" 
                    size="small" 
                    sx={{ ml: 1 }}
                  />
                )}
              </Box>
              
              <Card sx={{ p: 3, bgcolor: 'purple.50', borderRadius: 2 }}>
                {isEditing ? (
                  <TextField
                    multiline
                    rows={15}
                    fullWidth
                    value={editedContent}
                    onChange={(e) => setEditedContent(e.target.value)}
                    variant="outlined"
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        backgroundColor: 'white',
                        borderRadius: 1,
                      }
                    }}
                  />
                ) : (
                  <Typography variant="body1" sx={{ 
                    whiteSpace: 'pre-wrap',
                    fontSize: '1rem',
                    lineHeight: 1.6,
                    color: 'text.primary'
                  }}>
                    {selectedAIReport.content}
                  </Typography>
                )}
              </Card>
              
              {selectedAIReport.status !== 'draft' && (
                <Box sx={{ mt: 2, p: 2, bgcolor: 'orange.50', borderRadius: 2, border: '1px solid #ff9800' }}>
                  <Typography variant="body2" color="warning.main" sx={{ fontWeight: 600 }}>
                    ⚠️ This report cannot be edited because it's not in draft status.
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Only reports with "Sent For Approval" status can be edited. Current status: {getStatusDisplayName(selectedAIReport.status)}
                  </Typography>
                </Box>
              )}
              
              <Box sx={{ mt: 3, p: 2, bgcolor: 'grey.50', borderRadius: 2 }}>
                <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600, color: 'text.secondary' }}>
                  Report Generation Details:
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  • Generated from: {(typeof selectedAIReport.aiGenerated === 'object' ? selectedAIReport.aiGenerated?.originalTranscription : null) || 'Audio recordings'}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  • Model: {(typeof selectedAIReport.aiGenerated === 'object' ? selectedAIReport.aiGenerated?.generationModel : null) || 'barrana-ai-v1'}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  • Status: {isEditing ? 'Editing' : 'Viewing'}
                </Typography>
              </Box>
            </Box>
          )}
        </DialogContent>
        
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={handleCloseAIGeneratedDialog} variant="outlined">
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* Media Attachments Dialog */}
      <Dialog
        open={openMediaDialog}
        onClose={handleCloseMediaDialog}
        maxWidth="lg"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            background: 'linear-gradient(135deg, #ffffff 0%, #f8f9ff 100%)',
          }
        }}
      >
        <DialogTitle
          sx={{
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            p: 3,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Avatar 
              sx={{ 
                bgcolor: 'rgba(255,255,255,0.2)',
                width: 48,
                height: 48,
              }}
            >
              <Image />
            </Avatar>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                Media Attachments
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.9 }}>
                {selectedMediaReport && getStudentName(selectedMediaReport)}
              </Typography>
            </Box>
          </Box>
          <IconButton onClick={handleCloseMediaDialog} sx={{ color: 'white' }}>
            <Close />
          </IconButton>
        </DialogTitle>
        
        <DialogContent sx={{ p: 3 }}>
          {selectedMediaReport && (
            <Box sx={{ mt: 2 }}>
              {hasMediaAttachments(selectedMediaReport) ? (
                <Box>
                  <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
                    <Image />
                    Media Attachments
                    <Chip 
                      label={`${selectedMediaReport.attachments?.length} file${(selectedMediaReport.attachments?.length || 0) > 1 ? 's' : ''}`}
                      size="small"
                      color="primary"
                      variant="outlined"
                    />
                  </Typography>
                  
                  <Grid container spacing={2}>
                    {selectedMediaReport.attachments?.map((attachment, index) => {
                      const isImage = attachment.mimeType.startsWith('image/');
                      const isVideo = attachment.mimeType.startsWith('video/');
                      const isPdf = attachment.mimeType === 'application/pdf';
                      const fileUrl = attachment.url.startsWith('http') 
                        ? attachment.url 
                        : attachment.url.startsWith('/') 
                          ? attachment.url 
                          : '/' + attachment.url;
                      
                      return (
                        <Grid item xs={12} sm={6} md={4} key={index}>
                          <Card sx={{ 
                            p: 2, 
                            height: '100%',
                            display: 'flex',
                            flexDirection: 'column',
                            '&:hover': {
                              boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
                              transform: 'translateY(-2px)',
                            },
                            transition: 'all 0.3s ease'
                          }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                              <Avatar 
                                sx={{ 
                                  bgcolor: `${getMediaColor(attachment.mimeType)}.main`,
                                  mr: 1,
                                  width: 32,
                                  height: 32
                                }}
                              >
                                {getMediaIcon(attachment.mimeType)}
                              </Avatar>
                              <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                                <Typography variant="subtitle2" sx={{ 
                                  fontWeight: 600,
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap'
                                }}>
                                  {attachment.originalName}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {formatFileSize(attachment.size)}
                                </Typography>
                              </Box>
                            </Box>
                            
                            {isImage && (
                              <Box sx={{ 
                                flexGrow: 1,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                mb: 2
                              }}>
                                <img 
                                  src={fileUrl} 
                                  alt={attachment.originalName}
                                  style={{ 
                                    maxWidth: '100%', 
                                    maxHeight: 200, 
                                    objectFit: 'contain',
                                    borderRadius: 4
                                  }}
                                  onError={(e) => {
                                    console.error('❌ Image load error:', fileUrl);
                                    (e.target as HTMLImageElement).style.display = 'none';
                                  }}
                                />
                              </Box>
                            )}
                            
                            {isVideo && (
                              <Box sx={{ 
                                flexGrow: 1,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                mb: 2
                              }}>
                                <video 
                                  controls
                                  style={{ 
                                    maxWidth: '100%', 
                                    maxHeight: 200,
                                    borderRadius: 4
                                  }}
                                  onError={(e) => {
                                    console.error('❌ Video load error:', fileUrl);
                                  }}
                                >
                                  <source src={fileUrl} type={attachment.mimeType} />
                                  Your browser does not support the video tag.
                                </video>
                              </Box>
                            )}
                            
                            {isPdf && (
                              <Box sx={{ 
                                flexGrow: 1,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                mb: 2,
                                p: 2,
                                bgcolor: 'grey.100',
                                borderRadius: 1
                              }}>
                                <PictureAsPdf sx={{ fontSize: 64, color: 'error.main' }} />
                              </Box>
                            )}
                            
                            {!isImage && !isVideo && !isPdf && (
                              <Box sx={{ 
                                flexGrow: 1,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                mb: 2,
                                p: 2,
                                bgcolor: 'grey.100',
                                borderRadius: 1
                              }}>
                                <InsertDriveFile sx={{ fontSize: 64, color: 'text.secondary' }} />
                              </Box>
                            )}
                            
                            <Box sx={{ display: 'flex', gap: 1 }}>
                              <Button
                                variant="outlined"
                                size="small"
                                startIcon={<Visibility />}
                                onClick={() => window.open(fileUrl, '_blank')}
                                sx={{ flexGrow: 1 }}
                              >
                                View
                              </Button>
                              <Button
                                variant="outlined"
                                size="small"
                                startIcon={<CloudDownload />}
                                onClick={() => {
                                  const link = document.createElement('a');
                                  link.href = fileUrl;
                                  link.download = attachment.originalName;
                                  link.click();
                                }}
                              >
                                Download
                              </Button>
                            </Box>
                          </Card>
                        </Grid>
                      );
                    })}
                  </Grid>
                </Box>
              ) : (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <Image sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                  <Typography variant="h6" color="text.secondary" gutterBottom>
                    No Media Attachments
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    This report doesn't have any media attachments.
                  </Typography>
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
        
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={handleCloseMediaDialog} variant="outlined">
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default ReportsListing; 