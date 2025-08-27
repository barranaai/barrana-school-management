import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
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
  Grid,
  Tooltip,
  Badge,
  Alert,
  Container,
  Fade,
  Grow,
  CircularProgress,
  InputAdornment,
} from '@mui/material';

import {
  Search,
  PlayArrow,
  Stop,
  Description,
  Person,
  School,
  CalendarToday,
  Mic,
  TextFields,
  SmartToy,
  Download,
  Visibility,
  FilterList,
  Assessment,
  GetApp,
  Email,
  Image,
  VideoLibrary,
  AttachFile,
} from '@mui/icons-material';
import { apiService, Report } from '../../../services/apiService';
import { mediaService } from '../../../services/mediaService';
import { useAuth } from '../../../contexts/AuthContext';
import toast from 'react-hot-toast';

// Extended interface for the component's specific needs
interface ExtendedReport {
  _id: string;
  studentId: {
    _id: string;
    firstName: string;
    lastName: string;
    grade?: string;
    studentGrade?: string;
    studentClass?: string;
    parentEmail?: string;
  };
  teacherId: {
    _id: string;
    firstName: string;
    lastName: string;
  };
  title: string;
  content: string;
  status: 'draft' | 'completed' | 'sent' | 'review' | 'approved' | 'archived';
  createdAt: string;
  updatedAt: string;
  sentAt?: string;
  template?: string;
  voiceRecording?: {
    hasRecording: boolean;
    recordings?: Array<{
      url: string;
      duration: number;
      transcription?: string;
    }>;
    recordingUrl?: string;
    recordingDuration?: number;
    transcription?: string;
    isTranscribed: boolean;
  };
  aiGenerated?: boolean | {
    isAiGenerated: boolean;
    originalTranscription?: string;
    generationModel?: string;
    generationPrompt?: string;
    generatedAt?: string;
  };
  media?: Array<{
    id: string;
    filename: string;
    originalName: string;
    mimeType: string;
    size: number;
    url: string;
    thumbnail?: string;
    uploadedAt: string;
  }>;
}

const AllReports: React.FC = () => {
  const [reports, setReports] = useState<ExtendedReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedReport, setSelectedReport] = useState<ExtendedReport | null>(null);
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [showAudioDialog, setShowAudioDialog] = useState(false);
  const [selectedAudio, setSelectedAudio] = useState<string>('');
  const [selectedReportForAudio, setSelectedReportForAudio] = useState<ExtendedReport | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentAudioIndex, setCurrentAudioIndex] = useState<number>(0);
  const [audioRef, setAudioRef] = useState<HTMLAudioElement | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterClass, setFilterClass] = useState<string>('all');
  const [filterTeacher, setFilterTeacher] = useState<string>('all');
  const [classOptions, setClassOptions] = useState<string[]>([]);
  const [teacherOptions, setTeacherOptions] = useState<string[]>([]);
  const [filterDate, setFilterDate] = useState<string>('');
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingReport, setEditingReport] = useState<ExtendedReport | null>(null);
  const [editContent, setEditContent] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [showMediaDialog, setShowMediaDialog] = useState(false);
  const [selectedReportForMedia, setSelectedReportForMedia] = useState<ExtendedReport | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    loadReports();
    loadClasses();
    loadTeachers();
  }, []);

  const loadReports = async () => {
    try {
      setLoading(true);
      
      // Debug: Log user and schoolId
      console.log('🔍 Debug - User:', user);
      console.log('🔍 Debug - User Role:', user?.role);
      console.log('🔍 Debug - SchoolId:', user?.schoolId);
      console.log('🔍 Debug - SchoolId type:', typeof user?.schoolId);
      
      // Extract schoolId properly
      let schoolId = '';
      if (typeof user?.schoolId === 'string') {
        schoolId = user.schoolId;
      } else if (user?.schoolId && typeof user.schoolId === 'object' && user.schoolId._id) {
        schoolId = user.schoolId._id;
      } else {
        console.error('❌ No valid schoolId found');
        return;
      }
      
      console.log('🔍 Debug - Final schoolId:', schoolId);
      
      // Fetch all reports for the school
      console.log('🔍 Debug - About to call getAllSchoolReports with schoolId:', schoolId);
      console.log('🔍 Debug - User role and permissions:', user?.role);
      
      let response = await apiService.getAllSchoolReports(schoolId);
      console.log('🔍 Debug - API Response:', response);
      console.log('🔍 Debug - Response success:', response?.success);
      console.log('🔍 Debug - Response error:', response?.error);
      
      // If the school-specific endpoint fails (e.g., permission denied for teachers), 
      // fallback to the general reports endpoint with schoolId filter
      if (!response.success && (response.error?.includes('403') || response.error?.includes('denied') || response.error?.includes('Forbidden'))) {
        console.log('🔍 Debug - School endpoint failed, trying general reports endpoint...');
        response = await apiService.getReports(true); // Get all school reports
        console.log('🔍 Debug - Fallback response:', response);
      }
      
      if (response.success) {
        // Convert API reports to ExtendedReport format
        const extendedReports = (response.data || []).map(report => ({
          ...report,
          studentId: typeof report.studentId === 'string' 
            ? { _id: report.studentId, firstName: '', lastName: '', grade: '' }
            : report.studentId,
          teacherId: typeof report.teacherId === 'string'
            ? { _id: report.teacherId, firstName: '', lastName: '' }
            : report.teacherId,
        })) as ExtendedReport[];

        // Fetch media attachments for each report
        const reportsWithMedia = await Promise.all(
          extendedReports.map(async (report) => {
            try {
              const media = await mediaService.getReportMedia(report._id);
              return {
                ...report,
                media: media
              };
            } catch (error) {
              console.error(`Error fetching media for report ${report._id}:`, error);
              return {
                ...report,
                media: []
              };
            }
          })
        );

        setReports(reportsWithMedia);
        console.log('✅ Reports loaded successfully:', reportsWithMedia.length);
      } else {
        console.error('Failed to load reports:', response.message);
      }
    } catch (error) {
      console.error('Error loading reports:', error);
    } finally {
      setLoading(false);
    }
  };

  // Load all classes for the school (for class filter dropdown)
  const loadClasses = async () => {
    try {
      const classesRes = await apiService.getClasses();
      if (classesRes.success && Array.isArray(classesRes.data)) {
        const names = classesRes.data
          .filter((c: any) => c && c.name)
          .map((c: any) => c.name as string);
        const uniqueSorted = Array.from(new Set(names)).sort();
        setClassOptions(uniqueSorted);
      }
    } catch (err) {
      console.error('Failed to load classes for filter:', err);
    }
  };

  // Teacher options derived from reports (ensures only teachers with reports appear; adjust if needed)
  const loadTeachers = async () => {
    try {
      // Extract schoolId similarly to reports
      let schoolId = '';
      if (typeof user?.schoolId === 'string') {
        schoolId = user.schoolId;
      } else if (user?.schoolId && typeof user.schoolId === 'object' && (user.schoolId as any)._id) {
        schoolId = (user.schoolId as any)._id as string;
      }

      const res = await apiService.getTeachers();
      if (res.success && Array.isArray(res.data)) {
        const names = res.data
          .filter((t: any) => {
            if (!t) return false;
            // If super admin, restrict to current school if available
            if (user?.role === 'super_admin' && schoolId) {
              const teacherSchoolId = typeof t.schoolId === 'string' ? t.schoolId : t.schoolId?._id;
              return teacherSchoolId === schoolId;
            }
            return true;
          })
          .map((t: any) => `${t.firstName || ''} ${t.lastName || ''}`.trim())
          .filter((n: string) => n.length > 0);

        const uniqueSorted = Array.from(new Set(names)).sort();
        setTeacherOptions(uniqueSorted);
      }
    } catch (err) {
      console.error('Failed to load teachers for filter:', err);
    }
  };

  const getStudentName = (report: ExtendedReport) => {
    const student = report.studentId;
    if (student.firstName && student.lastName) {
      return `${student.firstName} ${student.lastName}`;
    } else if (student.firstName) {
      return student.firstName;
    } else if (student.lastName) {
      return student.lastName;
    }
    return 'Unknown Student';
  };

  const getTeacherName = (report: ExtendedReport) => {
    const teacher = report.teacherId;
    if (teacher.firstName && teacher.lastName) {
      return `${teacher.firstName} ${teacher.lastName}`;
    } else if (teacher.firstName) {
      return teacher.firstName;
    } else if (teacher.lastName) {
      return teacher.lastName;
    }
    return 'Unknown Teacher';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'success';
      case 'sent': return 'success';
      case 'approved': return 'success';
      case 'draft': return 'warning';
      case 'review': return 'info';
      case 'archived': return 'default';
      default: return 'default';
    }
  };

  const getStatusDisplayName = (status: string) => {
    switch (status) {
      case 'draft': return 'Pending Approval';
      case 'completed': return 'Completed';
      case 'sent': return 'Report Sent';
      case 'approved': return 'Approved';
      case 'review': return 'Under Review';
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

  // Helper function to format report content exactly like in emails
  const formatReportContent = (content: string) => {
    if (!content) return '';
    
    let formattedContent = content;
    
    // Convert lines starting with ## to sub-headers (medium size, bold)
    formattedContent = formattedContent.replace(/^##\s+(.+)$/gm, '<h4 style="font-size: 1.1em; font-weight: bold; color: #4a5568; margin: 12px 0 8px 0; border-left: 3px solid #764ba2; padding-left: 10px;">$1</h4>');
    
    // Convert lines starting with # to main headers (larger size, bold, with bottom border)
    formattedContent = formattedContent.replace(/^#\s+(.+)$/gm, '<h3 style="font-size: 1.3em; font-weight: bold; color: #2d3748; margin: 18px 0 12px 0; border-bottom: 2px solid #667eea; padding-bottom: 8px;">$1</h3>');
    
    // Convert **text** to <strong>text</strong> for bold formatting
    formattedContent = formattedContent.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    
    // Convert *text* to <em>text</em> for italic formatting
    formattedContent = formattedContent.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    
    // Convert line breaks to HTML
    formattedContent = formattedContent.replace(/\n/g, '<br>');
    
    return formattedContent;
  };

  const hasAudioRecording = (report: ExtendedReport) => {
    return !!(
      report.voiceRecording?.hasRecording ||
      report.voiceRecording?.recordingUrl ||
      report.voiceRecording?.recordings?.length
    );
  };

  const hasTranscription = (report: ExtendedReport) => {
    return !!(
      report.voiceRecording?.transcription ||
      (report.aiGenerated && typeof report.aiGenerated === 'object' && report.aiGenerated.originalTranscription)
    );
  };

  const isAiGenerated = (report: ExtendedReport) => {
    return !!(
      report.aiGenerated === true ||
      (report.aiGenerated && typeof report.aiGenerated === 'object' && report.aiGenerated.isAiGenerated)
    );
  };

  const hasMediaAttachments = (report: ExtendedReport) => {
    return !!(report.media && report.media.length > 0);
  };

  const getMediaCount = (report: ExtendedReport) => {
    return report.media ? report.media.length : 0;
  };

  const getMediaTypeIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) {
      return <Image fontSize="small" />;
    } else if (mimeType.startsWith('video/')) {
      return <VideoLibrary fontSize="small" />;
    } else {
      return <AttachFile fontSize="small" />;
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const canEditReport = (report: ExtendedReport) => {
    // Only allow editing if report is not sent to parents
    const canEdit = report.status !== 'sent' && report.status !== 'approved';
    console.log('🔍 Debug - canEditReport:', {
      reportId: report._id,
      status: report.status,
      canEdit,
      userRole: user?.role
    });
    return canEdit;
  };

  const getAudioRecordings = (report: ExtendedReport) => {
    const recordings = [];
    
    if (report.voiceRecording?.recordings?.length) {
      return report.voiceRecording.recordings;
    }
    
    if (report.voiceRecording?.recordingUrl) {
      recordings.push({
        url: report.voiceRecording.recordingUrl,
        duration: report.voiceRecording.recordingDuration || 0,
        transcription: report.voiceRecording.transcription || ''
      });
    }
    
    return recordings;
  };

  const filteredReports = reports.filter(report => {
    const matchesSearch = 
      getStudentName(report).toLowerCase().includes(searchTerm.toLowerCase()) ||
      getTeacherName(report).toLowerCase().includes(searchTerm.toLowerCase()) ||
      report.title.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = filterStatus === 'all' || report.status === filterStatus;
    const matchesClass = filterClass === 'all' || ((report.studentId as any)?.studentClass || '') === filterClass;
    const matchesTeacher = filterTeacher === 'all' || getTeacherName(report) === filterTeacher;
    
    const matchesDate = !filterDate || 
      new Date(report.createdAt).toDateString() === new Date(filterDate).toDateString();
    
    return matchesSearch && matchesStatus && matchesClass && matchesTeacher && matchesDate;
  });

  const handleViewReport = (report: ExtendedReport) => {
    setSelectedReport(report);
    setShowReportDialog(true);
  };

  const handlePlayAudio = (report: ExtendedReport) => {
    const recordings = getAudioRecordings(report);
    if (recordings.length > 0) {
      setSelectedAudio(recordings[0].url);
      setSelectedReportForAudio(report);
      setCurrentAudioIndex(0);
      setShowAudioDialog(true);
      setIsPlaying(false);
    }
  };

  const handleCloseReportDialog = () => {
    setShowReportDialog(false);
    setSelectedReport(null);
  };

  const handleCloseAudioDialog = () => {
    setShowAudioDialog(false);
    setSelectedAudio('');
    setSelectedReportForAudio(null);
    setIsPlaying(false);
    setCurrentAudioIndex(0);
    if (audioRef) {
      audioRef.pause();
      audioRef.currentTime = 0;
    }
  };

  const handlePlayPause = () => {
    if (audioRef) {
      if (isPlaying) {
        audioRef.pause();
      } else {
        audioRef.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleNextAudio = () => {
    // This would cycle through multiple recordings if available
    if (audioRef) {
      audioRef.pause();
      setIsPlaying(false);
    }
  };

  const handlePreviousAudio = () => {
    // This would cycle through multiple recordings if available
    if (audioRef) {
      audioRef.pause();
      setIsPlaying(false);
    }
  };

  const getTranscriptionText = (report: ExtendedReport | null) => {
    if (!report) return 'No report selected';
    
    // Check for transcription in voiceRecording
    if (report.voiceRecording?.transcription) {
      return report.voiceRecording.transcription;
    }
    
    // Check for transcription in AI generated data
    if (report.aiGenerated && typeof report.aiGenerated === 'object' && report.aiGenerated.originalTranscription) {
      return report.aiGenerated.originalTranscription;
    }
    
    // Check for transcription in recordings array
    const recordings = getAudioRecordings(report);
    if (recordings.length > 0 && recordings[currentAudioIndex]?.transcription) {
      return recordings[currentAudioIndex].transcription;
    }
    
    return 'No transcription available for this audio recording.';
  };

  const handleSendEmail = async (report: ExtendedReport) => {
    try {
      const studentName = getStudentName(report);
      
      // Get parent email from student data
      const parentEmail = (report.studentId as any).parentEmail || 'parent@example.com';
      
      if (!parentEmail || parentEmail === 'parent@example.com') {
        toast.error('Parent email not available for this student. Please update student information.');
        return;
      }
      
      // Show loading toast
      const loadingToast = toast.loading(`Sending report email for ${studentName}...`);
      
      // Call the actual API
      const response = await apiService.sendReportEmail(report._id, parentEmail);
      
      // Dismiss loading toast
      toast.dismiss(loadingToast);
      
      if (response.success) {
        toast.success(`Report sent successfully to ${parentEmail} for ${studentName}!`);
        
        // Refresh the reports list to update the status
        await loadReports();
      } else {
        toast.error(response.message || 'Failed to send email. Please try again.');
      }
      
    } catch (error) {
      console.error('Error sending email:', error);
      toast.error('Failed to send email. Please try again.');
    }
  };

  const handleEditReport = (report: ExtendedReport) => {
    setEditingReport(report);
    setEditContent(report.content);
    setShowEditDialog(true);
  };

  const handleCloseEditDialog = () => {
    setShowEditDialog(false);
    setEditingReport(null);
    setEditContent('');
    setIsSaving(false);
  };

  const handleViewMedia = (report: ExtendedReport) => {
    setSelectedReportForMedia(report);
    setShowMediaDialog(true);
  };

  const handleCloseMediaDialog = () => {
    setShowMediaDialog(false);
    setSelectedReportForMedia(null);
  };

  const handleSaveReport = async () => {
    if (!editingReport || !editContent.trim()) {
      toast.error('Please enter report content');
      return;
    }

    try {
      setIsSaving(true);
      
      // Show loading toast
      const loadingToast = toast.loading('Saving report changes...');
      
      console.log('🔍 Debug - Updating report:', {
        reportId: editingReport._id,
        contentLength: editContent.trim().length,
        currentStatus: editingReport.status
      });
      
      // Call API to update report
      const response = await apiService.updateReport(editingReport._id, {
        content: editContent.trim()
        // Note: Not updating status since we're only editing content
      });
      
      console.log('🔍 Debug - Update response:', response);
      
      // Dismiss loading toast
      toast.dismiss(loadingToast);
      
      if (response.success) {
        toast.success('Report updated successfully!');
        
        // Refresh the reports list
        await loadReports();
        
        // Close the edit dialog
        handleCloseEditDialog();
      } else {
        console.error('❌ Update failed:', response);
        
        // More specific error messages
        let errorMessage = 'Failed to update report. Please try again.';
        if (response.error?.includes('403') || response.error?.includes('authorized') || response.error?.includes('permission')) {
          errorMessage = 'You do not have permission to edit this report. Only the report author, school admin, or super admin can edit reports.';
        } else if (response.error?.includes('404') || response.error?.includes('not found')) {
          errorMessage = 'Report not found. It may have been deleted or you may not have access to it.';
        } else if (response.error?.includes('400') || response.error?.includes('validation')) {
          errorMessage = 'Invalid report data. Please check your content and try again.';
        } else if (response.error || response.message) {
          errorMessage = (response.error || response.message) as string;
        }
        
        toast.error(errorMessage);
      }
      
    } catch (error) {
      console.error('❌ Error updating report:', error);
      toast.error('Failed to update report. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <Container maxWidth="xl">
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
          <CircularProgress size={60} sx={{ color: '#667eea' }} />
        </Box>
      </Container>
    );
  }

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
            All School Reports
          </Typography>
          <Typography 
            variant="body1" 
            sx={{ 
              color: 'text.secondary',
              opacity: 0.8,
              fontWeight: 500,
            }}
          >
            View and manage all generated reports across the school
          </Typography>
        </Box>
      </Fade>

      {/* Search and Actions */}
      <Grow in timeout={1000}>
        <Paper
          elevation={0}
          sx={{
            background: 'rgba(255,255,255,0.8)',
            borderRadius: 4,
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255,255,255,0.3)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
            mb: 3,
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            '&:hover': {
              transform: 'translateY(-2px)',
              boxShadow: '0 12px 40px rgba(0,0,0,0.15)',
            },
          }}
        >
          <CardContent sx={{ p: 3 }}>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  placeholder="Search by Student Name or Report Title"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  InputProps={{
                    startAdornment: <Search sx={{ mr: 1, color: 'text.secondary' }} />,
                  }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 3,
                      '&:hover .MuiOutlinedInput-notchedOutline': {
                        borderColor: 'rgba(102, 126, 234, 0.5)',
                      },
                      '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                        borderColor: '#667eea',
                      },
                    },
                  }}
                />
              </Grid>
              {/* Teacher */}
              <Grid item xs={12} md={2}>
                <FormControl fullWidth>
                  <InputLabel>Teacher</InputLabel>
                  <Select
                    value={filterTeacher}
                    onChange={(e) => setFilterTeacher(e.target.value)}
                    label="Teacher"
                    sx={{
                      borderRadius: 3,
                      '& .MuiOutlinedInput-notchedOutline': {
                        borderColor: 'rgba(102, 126, 234, 0.3)',
                      },
                      '&:hover .MuiOutlinedInput-notchedOutline': {
                        borderColor: 'rgba(102, 126, 234, 0.5)',
                      },
                      '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                        borderColor: '#667eea',
                      },
                    }}
                  >
                    <MenuItem value="all">All Teachers</MenuItem>
                    {teacherOptions.map((t) => (
                      <MenuItem key={t} value={t}>{t}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              {/* Class */}
              <Grid item xs={12} md={2}>
                <FormControl fullWidth>
                  <InputLabel>Class</InputLabel>
                  <Select
                    value={filterClass}
                    onChange={(e) => setFilterClass(e.target.value)}
                    label="Class"
                    sx={{
                      borderRadius: 3,
                      '& .MuiOutlinedInput-notchedOutline': {
                        borderColor: 'rgba(102, 126, 234, 0.3)',
                      },
                      '&:hover .MuiOutlinedInput-notchedOutline': {
                        borderColor: 'rgba(102, 126, 234, 0.5)',
                      },
                      '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                        borderColor: '#667eea',
                      },
                    }}
                  >
                    <MenuItem value="all">All Classes</MenuItem>
                    {classOptions.map((cls) => (
                      <MenuItem key={cls} value={cls}>{cls}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              {/* Date */}
              <Grid item xs={12} md={2}>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <TextField
                    fullWidth
                    type="date"
                    label="Filter by Date"
                    value={filterDate}
                    onChange={(e) => setFilterDate(e.target.value)}
                    InputLabelProps={{ shrink: true }}
                    sx={{
                      borderRadius: 3,
                      '& .MuiOutlinedInput-root': {
                        borderRadius: 3,
                        '&:hover .MuiOutlinedInput-notchedOutline': {
                          borderColor: 'rgba(102, 126, 234, 0.5)',
                        },
                        '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                          borderColor: '#667eea',
                        },
                      },
                    }}
                  />
                  {filterDate && (
                    <Button
                      size="small"
                      onClick={() => setFilterDate('')}
                      sx={{
                        minWidth: 'auto',
                        px: 1,
                        borderRadius: 2,
                        color: '#f44336',
                        borderColor: 'rgba(244, 67, 54, 0.3)',
                        '&:hover': {
                          borderColor: '#f44336',
                          background: 'rgba(244, 67, 54, 0.05)',
                        },
                      }}
                    >
                      ×
                    </Button>
                  )}
                </Box>
              </Grid>

              {/* Status */}
              <Grid item xs={12} md={2}>
                <FormControl fullWidth>
                  <InputLabel>Status Filter</InputLabel>
                  <Select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    label="Status Filter"
                    sx={{
                      borderRadius: 3,
                      '& .MuiOutlinedInput-notchedOutline': {
                        borderColor: 'rgba(102, 126, 234, 0.3)',
                      },
                      '&:hover .MuiOutlinedInput-notchedOutline': {
                        borderColor: 'rgba(102, 126, 234, 0.5)',
                      },
                      '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                        borderColor: '#667eea',
                      },
                    }}
                  >
                    <MenuItem value="all">All Status</MenuItem>
                    <MenuItem value="draft">Pending Approval</MenuItem>
                    <MenuItem value="sent">Report Sent</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              
              
            </Grid>
          </CardContent>
        </Paper>
      </Grow>

      {/* Reports Table */}
      <Grow in timeout={1400}>
        <Paper
          elevation={0}
          sx={{
            background: 'rgba(255,255,255,0.8)',
            borderRadius: 4,
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255,255,255,0.3)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            '&:hover': {
              transform: 'translateY(-2px)',
              boxShadow: '0 12px 40px rgba(0,0,0,0.15)',
            },
          }}
        >
          <CardContent sx={{ p: 3 }}>
            <TableContainer component={Paper} sx={{ boxShadow: 'none', borderRadius: 3 }}>
              <Table>
                <TableHead>
                  <TableRow sx={{ background: 'rgba(102, 126, 234, 0.05)' }}>
                    <TableCell sx={{ fontWeight: 600, color: '#667eea' }}>Student</TableCell>
                    <TableCell sx={{ fontWeight: 600, color: '#667eea' }}>Teacher</TableCell>
                    <TableCell sx={{ fontWeight: 600, color: '#667eea' }}>Report Title</TableCell>
                    <TableCell sx={{ fontWeight: 600, color: '#667eea' }}>Date</TableCell>
                    <TableCell sx={{ fontWeight: 600, color: '#667eea' }}>Status</TableCell>
                    <TableCell sx={{ fontWeight: 600, color: '#667eea' }}>Audio</TableCell>
                    <TableCell sx={{ fontWeight: 600, color: '#667eea' }}>Media</TableCell>
                    <TableCell sx={{ fontWeight: 600, color: '#667eea' }}>Transcription</TableCell>
                    <TableCell sx={{ fontWeight: 600, color: '#667eea' }}>Final Report</TableCell>
                    <TableCell sx={{ fontWeight: 600, color: '#667eea' }}>Edit Report</TableCell>
                    <TableCell sx={{ fontWeight: 600, color: '#667eea' }}>Send Report</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredReports.map((report) => (
                    <TableRow 
                      key={report._id} 
                      hover
                      onClick={() => handleViewReport(report)}
                      sx={{
                        cursor: 'pointer',
                        '&:hover': {
                          background: 'rgba(102, 126, 234, 0.05)',
                          transform: 'scale(1.01)',
                        },
                        transition: 'all 0.2s ease-in-out',
                      }}
                    >
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <Avatar 
                            sx={{ 
                              mr: 2, 
                              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                            }}
                          >
                            {getStudentName(report).charAt(0)}
                          </Avatar>
                          <Box>
                            <Typography 
                              variant="subtitle2"
                              sx={{ fontWeight: 600 }}
                            >
                              {getStudentName(report)}
                            </Typography>
                            <Typography 
                              variant="caption" 
                              sx={{ 
                                color: 'text.secondary',
                                opacity: 0.8,
                              }}
                            >
                              Grade {report.studentId.studentGrade || report.studentId.grade || 'Unknown'}
                            </Typography>
                          </Box>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <Avatar 
                            sx={{ 
                              mr: 2, 
                              background: 'linear-gradient(135deg, #764ba2 0%, #f093fb 100%)',
                              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                            }}
                          >
                            {getTeacherName(report).charAt(0)}
                          </Avatar>
                          <Typography 
                            variant="subtitle2"
                            sx={{ fontWeight: 600 }}
                          >
                            {getTeacherName(report)}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Typography 
                          variant="body2" 
                          sx={{ fontWeight: 500 }}
                        >
                          {report.title}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                          <CalendarToday sx={{ fontSize: 16, mr: 1, color: 'text.secondary' }} />
                          <Typography variant="body2">
                            {formatDate(report.createdAt)}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={getStatusDisplayName(report.status)}
                          color={getStatusColor(report.status) as any}
                          size="small"
                          sx={{
                            fontWeight: 600,
                            borderRadius: 2,
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        {hasAudioRecording(report) ? (
                          <Tooltip title="Play Audio">
                            <IconButton
                              size="small"
                              onClick={(e) => {
                                e.stopPropagation();
                                handlePlayAudio(report);
                              }}
                              sx={{
                                color: '#667eea',
                                '&:hover': {
                                  background: 'rgba(102, 126, 234, 0.1)',
                                  transform: 'scale(1.1)',
                                },
                                transition: 'all 0.2s ease-in-out',
                              }}
                            >
                              <PlayArrow />
                            </IconButton>
                          </Tooltip>
                        ) : (
                          <Typography 
                            variant="body2" 
                            sx={{ 
                              color: 'text.secondary',
                              opacity: 0.8,
                            }}
                          >
                            No audio
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        {hasMediaAttachments(report) ? (
                          <Tooltip title={`View ${getMediaCount(report)} media attachment(s)`}>
                            <IconButton
                              size="small"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleViewMedia(report);
                              }}
                              sx={{
                                color: '#9c27b0',
                                '&:hover': {
                                  background: 'rgba(156, 39, 176, 0.1)',
                                  transform: 'scale(1.1)',
                                },
                                transition: 'all 0.2s ease-in-out',
                              }}
                            >
                              <Badge badgeContent={getMediaCount(report)} color="secondary">
                                <AttachFile />
                              </Badge>
                            </IconButton>
                          </Tooltip>
                        ) : (
                          <Typography 
                            variant="body2" 
                            sx={{ 
                              color: 'text.secondary',
                              opacity: 0.8,
                            }}
                          >
                            No media
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        {hasTranscription(report) ? (
                          <Chip
                            icon={<TextFields />}
                            label="Available"
                            size="small"
                            color="success"
                            variant="outlined"
                            sx={{
                              borderRadius: 2,
                              fontWeight: 600,
                            }}
                          />
                        ) : (
                          <Typography 
                            variant="body2" 
                            sx={{ 
                              color: 'text.secondary',
                              opacity: 0.8,
                            }}
                          >
                            No transcription
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        {isAiGenerated(report) ? (
                          <Chip
                            icon={<SmartToy />}
                            label="Final Report"
                            size="small"
                            color="primary"
                            variant="outlined"
                            sx={{
                              borderRadius: 2,
                              fontWeight: 600,
                            }}
                          />
                        ) : (
                          <Typography 
                            variant="body2" 
                            sx={{ 
                              color: 'text.secondary',
                              opacity: 0.8,
                            }}
                          >
                            Manual
                          </Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', gap: 1 }}>
                          {canEditReport(report) && (
                            <Tooltip title="Edit Report">
                              <IconButton
                                size="small"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleEditReport(report);
                                }}
                                sx={{
                                  color: '#ff9800',
                                  '&:hover': {
                                    background: 'rgba(255, 152, 0, 0.1)',
                                    transform: 'scale(1.1)',
                                  },
                                  transition: 'all 0.2s ease-in-out',
                                }}
                              >
                                <TextFields />
                              </IconButton>
                            </Tooltip>
                          )}
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Tooltip title={report.status === 'sent' ? 'Report already sent to parent' : 'Send Report to Parent'}>
                          <IconButton
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSendEmail(report);
                            }}
                            disabled={report.status === 'sent'}
                            sx={{
                              color: report.status === 'sent' ? '#ccc' : '#4caf50',
                              '&:hover': {
                                background: report.status === 'sent' ? 'transparent' : 'rgba(76, 175, 80, 0.1)',
                                transform: report.status === 'sent' ? 'none' : 'scale(1.1)',
                              },
                              '&:disabled': {
                                color: '#ccc',
                                cursor: 'not-allowed',
                              },
                              transition: 'all 0.2s ease-in-out',
                            }}
                          >
                            <Email />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
            
            {filteredReports.length === 0 && (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <Typography 
                  variant="body1" 
                  sx={{ 
                    color: 'text.secondary',
                    opacity: 0.8,
                    fontWeight: 500,
                  }}
                >
                  {searchTerm || filterStatus !== 'all' 
                    ? 'No reports found matching your criteria'
                    : 'No reports have been generated yet.'
                  }
                </Typography>
              </Box>
            )}
          </CardContent>
        </Paper>
      </Grow>

      {/* Report Details Dialog */}
      <Dialog
        open={showReportDialog}
        onClose={handleCloseReportDialog}
        maxWidth="lg"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 4,
            background: 'rgba(255,255,255,0.95)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255,255,255,0.3)',
            boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
          },
        }}
      >
        <DialogTitle
          sx={{
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            borderRadius: '12px 12px 0 0',
            pb: 4,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <Assessment sx={{ mr: 2, fontSize: 28 }} />
              <Typography variant="h5" fontWeight={700}>
                Report Details
              </Typography>
            </Box>
            <Chip
              label={getStatusDisplayName(selectedReport?.status || 'draft')}
              color={getStatusColor(selectedReport?.status || 'draft') as any}
              size="small"
              sx={{
                fontWeight: 600,
                borderRadius: 2,
                background: 'rgba(255,255,255,0.2)',
                color: 'white',
                '& .MuiChip-label': { color: 'white' },
              }}
            />
          </Box>
        </DialogTitle>
        <DialogContent sx={{ p: 4, pt: 6 }}>
          {selectedReport && (
            <Box>
              <Grid container spacing={3}>
                {/* Student Information Card */}
                <Grid item xs={12} md={6}>
                  <Card
                    elevation={0}
                    sx={{
                      background: 'rgba(255,255,255,0.8)',
                      borderRadius: 3,
                      backdropFilter: 'blur(10px)',
                      border: '1px solid rgba(102, 126, 234, 0.1)',
                      boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
                      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                      '&:hover': {
                        transform: 'translateY(-2px)',
                        boxShadow: '0 12px 40px rgba(0,0,0,0.15)',
                      },
                    }}
                  >
                    <CardContent sx={{ p: 3 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                        <Avatar
                          sx={{
                            mr: 2,
                            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                            width: 48,
                            height: 48,
                          }}
                        >
                          {getStudentName(selectedReport).charAt(0)}
                        </Avatar>
                        <Box>
                          <Typography variant="h6" fontWeight={700} sx={{ color: '#667eea' }}>
                            Student Information
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            Student Details
                          </Typography>
                        </Box>
                      </Box>
                      
                      <Box sx={{ space: 2 }}>
                        <Box sx={{ mb: 2 }}>
                          <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600, mb: 0.5 }}>
                            Full Name
                          </Typography>
                          <Typography variant="body1" sx={{ fontWeight: 500 }}>
                            {getStudentName(selectedReport)}
                          </Typography>
                        </Box>
                        
                        <Box sx={{ mb: 2 }}>
                          <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600, mb: 0.5 }}>
                            Grade Level
                          </Typography>
                          <Typography variant="body1" sx={{ fontWeight: 500 }}>
                            {selectedReport.studentId.studentGrade || selectedReport.studentId.grade || 'Unknown'}
                          </Typography>
                        </Box>
                        
                        <Box sx={{ mb: 2 }}>
                          <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600, mb: 0.5 }}>
                            Class
                          </Typography>
                          <Typography variant="body1" sx={{ fontWeight: 500 }}>
                            {selectedReport.studentId.studentClass || 'Unknown'}
                          </Typography>
                        </Box>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>

                {/* Teacher Information Card */}
                <Grid item xs={12} md={6}>
                  <Card
                    elevation={0}
                    sx={{
                      background: 'rgba(255,255,255,0.8)',
                      borderRadius: 3,
                      backdropFilter: 'blur(10px)',
                      border: '1px solid rgba(118, 75, 162, 0.1)',
                      boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
                      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                      '&:hover': {
                        transform: 'translateY(-2px)',
                        boxShadow: '0 12px 40px rgba(0,0,0,0.15)',
                      },
                    }}
                  >
                    <CardContent sx={{ p: 3 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                        <Avatar
                          sx={{
                            mr: 2,
                            background: 'linear-gradient(135deg, #764ba2 0%, #f093fb 100%)',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                            width: 48,
                            height: 48,
                          }}
                        >
                          {getTeacherName(selectedReport).charAt(0)}
                        </Avatar>
                        <Box>
                          <Typography variant="h6" fontWeight={700} sx={{ color: '#764ba2' }}>
                            Teacher Information
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            Report Author
                          </Typography>
                        </Box>
                      </Box>
                      
                      <Box sx={{ space: 2 }}>
                        <Box sx={{ mb: 2 }}>
                          <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600, mb: 0.5 }}>
                            Teacher Name
                          </Typography>
                          <Typography variant="body1" sx={{ fontWeight: 500 }}>
                            {getTeacherName(selectedReport)}
                          </Typography>
                        </Box>
                        
                        <Box sx={{ mb: 2 }}>
                          <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600, mb: 0.5 }}>
                            Report Date
                          </Typography>
                          <Typography variant="body1" sx={{ fontWeight: 500 }}>
                            {formatDate(selectedReport.createdAt)}
                          </Typography>
                        </Box>
                        
                        <Box sx={{ mb: 2 }}>
                          <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600, mb: 0.5 }}>
                            Report Status
                          </Typography>
                          <Chip
                            label={selectedReport.status}
                            color={getStatusColor(selectedReport.status) as any}
                            size="small"
                            sx={{
                              fontWeight: 600,
                              borderRadius: 2,
                            }}
                          />
                        </Box>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>

                {/* Report Content Card */}
                <Grid item xs={12}>
                  <Card
                    elevation={0}
                    sx={{
                      background: 'rgba(255,255,255,0.8)',
                      borderRadius: 3,
                      backdropFilter: 'blur(10px)',
                      border: '1px solid rgba(102, 126, 234, 0.1)',
                      boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
                      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                      '&:hover': {
                        transform: 'translateY(-2px)',
                        boxShadow: '0 12px 40px rgba(0,0,0,0.15)',
                      },
                    }}
                  >
                    <CardContent sx={{ p: 3 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                        <Description sx={{ mr: 2, fontSize: 28, color: '#667eea' }} />
                        <Box>
                          <Typography variant="h6" fontWeight={700} sx={{ color: '#667eea' }}>
                            Report Content (Email Preview)
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            How this report appears in the email sent to parents
                          </Typography>
                        </Box>
                      </Box>
                      
                      <Box
                        sx={{
                          maxHeight: 500,
                          overflow: 'auto',
                          p: 3,
                          background: 'white',
                          borderRadius: 2,
                          border: '4px solid #667eea',
                          borderLeft: '4px solid #667eea',
                          fontFamily: 'Arial, sans-serif',
                          lineHeight: 1.6,
                          color: '#333',
                          '&::-webkit-scrollbar': {
                            width: '8px',
                          },
                          '&::-webkit-scrollbar-track': {
                            background: 'rgba(102, 126, 234, 0.1)',
                            borderRadius: '4px',
                          },
                          '&::-webkit-scrollbar-thumb': {
                            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                            borderRadius: '4px',
                          },
                          '&::-webkit-scrollbar-thumb:hover': {
                            background: 'linear-gradient(135deg, #5a6fd8 0%, #6a4190 100%)',
                          },
                          // Email-like styling
                          '& strong': {
                            color: '#2d3748',
                            fontWeight: 700,
                          },
                          '& em': {
                            color: '#4a5568',
                            fontStyle: 'italic',
                          },
                          '& h3': {
                            fontSize: '1.3em',
                            fontWeight: 'bold',
                            color: '#2d3748',
                            margin: '18px 0 12px 0',
                            borderBottom: '2px solid #667eea',
                            paddingBottom: '8px',
                          },
                          '& h4': {
                            fontSize: '1.1em',
                            fontWeight: 'bold',
                            color: '#4a5568',
                            margin: '12px 0 8px 0',
                            borderLeft: '3px solid #764ba2',
                            paddingLeft: '10px',
                          },
                        }}
                      >
                        <Box
                          dangerouslySetInnerHTML={{
                            __html: formatReportContent(selectedReport.content)
                          }}
                          sx={{
                            '& br': {
                              lineHeight: 1.6,
                            }
                          }}
                        />
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 0 }}>
          <Button
            variant="outlined"
            onClick={handleCloseReportDialog}
            sx={{
              borderRadius: 3,
              px: 4,
              py: 1.5,
              fontWeight: 600,
              borderColor: 'rgba(102, 126, 234, 0.3)',
              color: '#667eea',
              '&:hover': {
                borderColor: '#667eea',
                background: 'rgba(102, 126, 234, 0.05)',
                transform: 'translateY(-2px)',
              },
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            }}
          >
            Close
          </Button>
          <Button
            variant="contained"
            startIcon={<Download />}
            onClick={() => toast.success('Download functionality coming soon!')}
            sx={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              borderRadius: 3,
              px: 4,
              py: 1.5,
              fontWeight: 600,
              boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)',
              '&:hover': {
                background: 'linear-gradient(135deg, #5a6fd8 0%, #6a4190 100%)',
                transform: 'translateY(-2px)',
                boxShadow: '0 6px 20px rgba(102, 126, 234, 0.4)',
              },
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            }}
          >
            Download Report
          </Button>
        </DialogActions>
      </Dialog>

      {/* Audio Player Dialog */}
      <Dialog
        open={showAudioDialog}
        onClose={handleCloseAudioDialog}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 4,
            background: 'rgba(255,255,255,0.95)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255,255,255,0.3)',
            boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
          },
        }}
      >
        <DialogTitle
          sx={{
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            borderRadius: '12px 12px 0 0',
            pb: 2,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Mic sx={{ mr: 2, fontSize: 28 }} />
            <Typography variant="h5" fontWeight={700}>
              Audio Recording Player
            </Typography>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ p: 4, pt: 6 }}>
          <Box sx={{ textAlign: 'center' }}>
            {/* Audio Player */}
            <Card
              elevation={0}
              sx={{
                background: 'rgba(255,255,255,0.8)',
                borderRadius: 3,
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(102, 126, 234, 0.1)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
                p: 3,
                mb: 3,
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 3 }}>
                <Avatar
                  sx={{
                    width: 80,
                    height: 80,
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                    mr: 2,
                  }}
                >
                  <Mic sx={{ fontSize: 40 }} />
                </Avatar>
                <Box>
                  <Typography variant="h6" fontWeight={700} sx={{ color: '#667eea' }}>
                    Audio Recording
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {selectedAudio ? 'Ready to play' : 'No audio available'}
                  </Typography>
                </Box>
              </Box>

              {/* Audio Controls */}
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2, mb: 3 }}>
                <IconButton
                  onClick={handlePreviousAudio}
                  disabled={currentAudioIndex === 0}
                  sx={{
                    color: '#667eea',
                    '&:hover': { background: 'rgba(102, 126, 234, 0.1)' },
                    '&:disabled': { color: 'text.disabled' },
                  }}
                >
                  <PlayArrow sx={{ transform: 'rotate(180deg)' }} />
                </IconButton>
                
                <IconButton
                  onClick={handlePlayPause}
                  disabled={!selectedAudio}
                  sx={{
                    width: 64,
                    height: 64,
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: 'white',
                    '&:hover': {
                      background: 'linear-gradient(135deg, #5a6fd8 0%, #6a4190 100%)',
                      transform: 'scale(1.05)',
                    },
                    '&:disabled': {
                      background: 'rgba(0,0,0,0.12)',
                      color: 'text.disabled',
                    },
                    transition: 'all 0.2s ease-in-out',
                  }}
                >
                  {isPlaying ? <Stop /> : <PlayArrow />}
                </IconButton>
                
                <IconButton
                  onClick={handleNextAudio}
                  disabled={currentAudioIndex === 0}
                  sx={{
                    color: '#667eea',
                    '&:hover': { background: 'rgba(102, 126, 234, 0.1)' },
                    '&:disabled': { color: 'text.disabled' },
                  }}
                >
                  <PlayArrow />
                </IconButton>
              </Box>

              {/* Audio Element */}
              {selectedAudio && (
                <audio
                  ref={(el) => setAudioRef(el)}
                  src={selectedAudio}
                  onEnded={() => setIsPlaying(false)}
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  style={{ width: '100%', marginTop: 16 }}
                  controls
                />
              )}
            </Card>

            {/* Transcription Section */}
            <Card
              elevation={0}
              sx={{
                background: 'rgba(255,255,255,0.8)',
                borderRadius: 3,
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(102, 126, 234, 0.1)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
                p: 3,
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <TextFields sx={{ mr: 1, color: '#667eea' }} />
                <Typography variant="h6" fontWeight={700} sx={{ color: '#667eea' }}>
                  Transcription
                </Typography>
              </Box>
              <Box
                sx={{
                  maxHeight: 200,
                  overflow: 'auto',
                  p: 2,
                  background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
                  borderRadius: 2,
                  border: '1px solid rgba(102, 126, 234, 0.1)',
                }}
              >
                <Typography variant="body2" sx={{ lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                  {getTranscriptionText(selectedReportForAudio)}
                </Typography>
              </Box>
            </Card>
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 0 }}>
          <Button
            variant="outlined"
            onClick={handleCloseAudioDialog}
            sx={{
              borderRadius: 3,
              px: 4,
              py: 1.5,
              fontWeight: 600,
              borderColor: 'rgba(102, 126, 234, 0.3)',
              color: '#667eea',
              '&:hover': {
                borderColor: '#667eea',
                background: 'rgba(102, 126, 234, 0.05)',
                transform: 'translateY(-2px)',
              },
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            }}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Report Dialog */}
      <Dialog
        open={showEditDialog}
        onClose={handleCloseEditDialog}
        maxWidth="lg"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 4,
            background: 'rgba(255,255,255,0.95)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255,255,255,0.3)',
            boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
          },
        }}
      >
        <DialogTitle
          sx={{
            background: 'linear-gradient(135deg, #ff9800 0%, #f57c00 100%)',
            color: 'white',
            borderRadius: '12px 12px 0 0',
            pb: 4,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <TextFields sx={{ mr: 2, fontSize: 28 }} />
              <Typography variant="h5" fontWeight={700}>
                Edit Report
              </Typography>
            </Box>
            {editingReport && (
              <Chip
                label={editingReport.status}
                color={getStatusColor(editingReport.status) as any}
                size="small"
                sx={{
                  fontWeight: 600,
                  borderRadius: 2,
                  background: 'rgba(255,255,255,0.2)',
                  color: 'white',
                  '& .MuiChip-label': { color: 'white' },
                }}
              />
            )}
          </Box>
        </DialogTitle>
        <DialogContent sx={{ p: 4, pt: 6 }}>
          {editingReport && (
            <Box>
              <Grid container spacing={3}>
                {/* Report Information Card */}
                <Grid item xs={12}>
                  <Card
                    elevation={0}
                    sx={{
                      background: 'rgba(255,255,255,0.8)',
                      borderRadius: 3,
                      backdropFilter: 'blur(10px)',
                      border: '1px solid rgba(255, 152, 0, 0.1)',
                      boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
                      mb: 3,
                    }}
                  >
                    <CardContent sx={{ p: 3 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                        <Assessment sx={{ mr: 2, fontSize: 28, color: '#ff9800' }} />
                        <Box>
                          <Typography variant="h6" fontWeight={700} sx={{ color: '#ff9800' }}>
                            Report Information
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            Student: {getStudentName(editingReport)} | Teacher: {getTeacherName(editingReport)}
                          </Typography>
                        </Box>
                      </Box>
                      
                      <Grid container spacing={2}>
                        <Grid item xs={12} md={6}>
                          <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600, mb: 0.5 }}>
                            Student Name
                          </Typography>
                          <Typography variant="body1" sx={{ fontWeight: 500 }}>
                            {getStudentName(editingReport)}
                          </Typography>
                        </Grid>
                        <Grid item xs={12} md={6}>
                          <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600, mb: 0.5 }}>
                            Teacher Name
                          </Typography>
                          <Typography variant="body1" sx={{ fontWeight: 500 }}>
                            {getTeacherName(editingReport)}
                          </Typography>
                        </Grid>
                        <Grid item xs={12} md={6}>
                          <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600, mb: 0.5 }}>
                            Report Date
                          </Typography>
                          <Typography variant="body1" sx={{ fontWeight: 500 }}>
                            {formatDate(editingReport.createdAt)}
                          </Typography>
                        </Grid>
                        <Grid item xs={12} md={6}>
                          <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600, mb: 0.5 }}>
                            Current Status
                          </Typography>
                          <Chip
                            label={getStatusDisplayName(editingReport.status)}
                            color={getStatusColor(editingReport.status) as any}
                            size="small"
                            sx={{
                              fontWeight: 600,
                              borderRadius: 2,
                            }}
                          />
                        </Grid>
                      </Grid>
                    </CardContent>
                  </Card>
                </Grid>

                {/* Report Content Editor */}
                <Grid item xs={12}>
                  <Card
                    elevation={0}
                    sx={{
                      background: 'rgba(255,255,255,0.8)',
                      borderRadius: 3,
                      backdropFilter: 'blur(10px)',
                      border: '1px solid rgba(255, 152, 0, 0.1)',
                      boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
                    }}
                  >
                    <CardContent sx={{ p: 3 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                        <TextFields sx={{ mr: 2, fontSize: 28, color: '#ff9800' }} />
                        <Box>
                          <Typography variant="h6" fontWeight={700} sx={{ color: '#ff9800' }}>
                            Report Content
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            Edit the report content below
                          </Typography>
                        </Box>
                      </Box>
                      
                      <TextField
                        fullWidth
                        multiline
                        rows={12}
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        placeholder="Enter report content..."
                        sx={{
                          '& .MuiOutlinedInput-root': {
                            borderRadius: 2,
                            fontFamily: 'inherit',
                            fontSize: '14px',
                            lineHeight: 1.6,
                            '&:hover .MuiOutlinedInput-notchedOutline': {
                              borderColor: 'rgba(255, 152, 0, 0.5)',
                            },
                            '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                              borderColor: '#ff9800',
                            },
                          },
                        }}
                      />
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 0 }}>
          <Button
            variant="outlined"
            onClick={handleCloseEditDialog}
            disabled={isSaving}
            sx={{
              borderRadius: 3,
              px: 4,
              py: 1.5,
              fontWeight: 600,
              borderColor: 'rgba(255, 152, 0, 0.3)',
              color: '#ff9800',
              '&:hover': {
                borderColor: '#ff9800',
                background: 'rgba(255, 152, 0, 0.05)',
                transform: 'translateY(-2px)',
              },
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSaveReport}
            disabled={isSaving || !editContent.trim()}
            startIcon={isSaving ? <CircularProgress size={20} color="inherit" /> : <TextFields />}
            sx={{
              background: 'linear-gradient(135deg, #ff9800 0%, #f57c00 100%)',
              borderRadius: 3,
              px: 4,
              py: 1.5,
              fontWeight: 600,
              boxShadow: '0 4px 12px rgba(255, 152, 0, 0.3)',
              '&:hover': {
                background: 'linear-gradient(135deg, #f57c00 0%, #ef6c00 100%)',
                transform: 'translateY(-2px)',
                boxShadow: '0 6px 20px rgba(255, 152, 0, 0.4)',
              },
              '&:disabled': {
                background: 'rgba(0,0,0,0.12)',
                color: 'text.disabled',
                transform: 'none',
                boxShadow: 'none',
              },
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            }}
          >
            {isSaving ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Media Attachments Dialog */}
      <Dialog
        open={showMediaDialog}
        onClose={handleCloseMediaDialog}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 4,
            background: 'rgba(255,255,255,0.95)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255,255,255,0.3)',
            boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
          },
        }}
      >
        <DialogTitle
          sx={{
            background: 'linear-gradient(135deg, #9c27b0 0%, #673ab7 100%)',
            color: 'white',
            borderRadius: '12px 12px 0 0',
            pb: 4,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <AttachFile sx={{ mr: 2, fontSize: 28 }} />
              <Typography variant="h5" fontWeight={700}>
                Media Attachments
              </Typography>
            </Box>
            {selectedReportForMedia && (
              <Chip
                label={`${getMediaCount(selectedReportForMedia)} file(s)`}
                size="small"
                sx={{
                  fontWeight: 600,
                  borderRadius: 2,
                  background: 'rgba(255,255,255,0.2)',
                  color: 'white',
                  '& .MuiChip-label': { color: 'white' },
                }}
              />
            )}
          </Box>
        </DialogTitle>
        <DialogContent sx={{ p: 4, pt: 6 }}>
          {selectedReportForMedia && selectedReportForMedia.media && selectedReportForMedia.media.length > 0 ? (
            <Grid container spacing={3}>
              {selectedReportForMedia.media.map((media, index) => (
                <Grid item xs={12} sm={6} md={4} key={media.id}>
                  <Card
                    elevation={0}
                    sx={{
                      background: 'rgba(255,255,255,0.8)',
                      borderRadius: 3,
                      backdropFilter: 'blur(10px)',
                      border: '1px solid rgba(156, 39, 176, 0.1)',
                      boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
                      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                      '&:hover': {
                        transform: 'translateY(-2px)',
                        boxShadow: '0 12px 40px rgba(0,0,0,0.15)',
                      },
                    }}
                  >
                    <CardContent sx={{ p: 2 }}>
                      {/* Media Preview */}
                      <Box sx={{ mb: 2, textAlign: 'center' }}>
                        {media.mimeType.startsWith('image/') ? (
                          <Box
                            component="img"
                            src={media.url}
                            alt={media.originalName}
                            sx={{
                              width: '100%',
                              height: 120,
                              objectFit: 'cover',
                              borderRadius: 2,
                              border: '1px solid rgba(156, 39, 176, 0.2)',
                            }}
                          />
                        ) : media.mimeType.startsWith('video/') ? (
                          <Box
                            sx={{
                              width: '100%',
                              height: 120,
                              borderRadius: 2,
                              border: '1px solid rgba(156, 39, 176, 0.2)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              background: 'linear-gradient(135deg, #f3e5f5 0%, #e1bee7 100%)',
                            }}
                          >
                            <VideoLibrary sx={{ fontSize: 48, color: '#9c27b0' }} />
                          </Box>
                        ) : (
                          <Box
                            sx={{
                              width: '100%',
                              height: 120,
                              borderRadius: 2,
                              border: '1px solid rgba(156, 39, 176, 0.2)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              background: 'linear-gradient(135deg, #f3e5f5 0%, #e1bee7 100%)',
                            }}
                          >
                            <AttachFile sx={{ fontSize: 48, color: '#9c27b0' }} />
                          </Box>
                        )}
                      </Box>

                      {/* Media Info */}
                      <Box>
                        <Typography 
                          variant="body2" 
                          sx={{ 
                            fontWeight: 600, 
                            mb: 0.5,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {media.originalName}
                        </Typography>
                        <Typography 
                          variant="caption" 
                          sx={{ 
                            color: 'text.secondary',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 0.5,
                          }}
                        >
                          {getMediaTypeIcon(media.mimeType)}
                          {formatFileSize(media.size)}
                        </Typography>
                        <Typography 
                          variant="caption" 
                          sx={{ 
                            color: 'text.secondary',
                            display: 'block',
                            mt: 0.5,
                          }}
                        >
                          {new Date(media.uploadedAt).toLocaleDateString()}
                        </Typography>
                      </Box>

                      {/* Action Buttons */}
                      <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<Visibility />}
                          onClick={() => window.open(media.url, '_blank')}
                          sx={{
                            borderRadius: 2,
                            borderColor: 'rgba(156, 39, 176, 0.3)',
                            color: '#9c27b0',
                            fontSize: '0.75rem',
                            '&:hover': {
                              borderColor: '#9c27b0',
                              background: 'rgba(156, 39, 176, 0.05)',
                            },
                          }}
                        >
                          View
                        </Button>
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<Download />}
                          onClick={() => {
                            const link = document.createElement('a');
                            link.href = media.url;
                            link.download = media.originalName;
                            link.click();
                          }}
                          sx={{
                            borderRadius: 2,
                            borderColor: 'rgba(156, 39, 176, 0.3)',
                            color: '#9c27b0',
                            fontSize: '0.75rem',
                            '&:hover': {
                              borderColor: '#9c27b0',
                              background: 'rgba(156, 39, 176, 0.05)',
                            },
                          }}
                        >
                          Download
                        </Button>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          ) : (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <AttachFile sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
              <Typography variant="h6" color="text.secondary" sx={{ mb: 1 }}>
                No Media Attachments
              </Typography>
              <Typography variant="body2" color="text.secondary">
                This report doesn't have any media attachments.
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 0 }}>
          <Button
            variant="outlined"
            onClick={handleCloseMediaDialog}
            sx={{
              borderRadius: 3,
              px: 4,
              py: 1.5,
              fontWeight: 600,
              borderColor: 'rgba(156, 39, 176, 0.3)',
              color: '#9c27b0',
              '&:hover': {
                borderColor: '#9c27b0',
                background: 'rgba(156, 39, 176, 0.05)',
                transform: 'translateY(-2px)',
              },
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            }}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default AllReports; 