import React, { useState, useRef, useEffect } from 'react';
import {
  Box,
  Drawer,
  AppBar,
  Toolbar,
  List,
  Typography,
  Divider,
  IconButton,
  ListItem,
  ListItemIcon,
  ListItemText,
  Avatar,
  Menu,
  MenuItem,
  Card,
  CardContent,
  Grid,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  LinearProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Badge,
  ListItemAvatar,
  Chip,
  Alert,
  TextField,
  CircularProgress,
  ListItemButton,
} from '@mui/material';
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
  Mic,
  Stop,
  PlayArrow,
  Pause,
  Person,
  CloudUpload,
  RecordVoiceOver,
  Save,
  Visibility,
  Send,
  AutoFixHigh,
  Edit,
} from '@mui/icons-material';
import { useAuth } from '../../contexts/AuthContext';
import { useData } from '../../contexts/DataContext';
import toast from 'react-hot-toast';
import { aiService } from '../../services/aiService';

const drawerWidth = 280;

const menuItems = [
  { text: 'Dashboard', icon: <Dashboard />, section: 'dashboard' },
  { text: 'Voice Recording', icon: <RecordVoiceOver />, section: 'recording' },
  { text: 'My Students', icon: <People />, section: 'students' },
  { text: 'Reports', icon: <Assessment />, section: 'reports' },
  { text: 'Settings', icon: <Settings />, section: 'settings' },
];

const TeachersUI: React.FC = () => {
  const [currentSection, setCurrentSection] = useState('dashboard');
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [openReportDialog, setOpenReportDialog] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [openStudentDialog, setOpenStudentDialog] = useState(false);
  const [recordingBlob, setRecordingBlob] = useState<Blob | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string>('');
  const [transcription, setTranscription] = useState<string>('');
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [generatedReport, setGeneratedReport] = useState<string>('');
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [reportStatus, setReportStatus] = useState<'draft' | 'review' | 'completed'>('draft');
  
  const { user, logout } = useAuth();
  const { students, reports, teachers } = useData();
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Get students for this teacher (assuming teacher email matches)
  const teacherStudents = students.filter(student => 
    student.teacherId === user?.id
  ).map(student => ({
    id: student.id,
    name: `${student.firstName} ${student.lastName}`,
    grade: student.grade,
    lastReport: student.lastReport,
    status: student.status,
    avatar: student.avatar,
  }));

  // Get reports for this teacher's students
  const teacherReports = reports.filter(report => 
    teacherStudents.some(student => student.id === report.studentId)
  ).map(report => {
    const student = teacherStudents.find(s => s.id === report.studentId);
    return {
      id: report.id,
      studentName: student?.name || 'Unknown',
      date: report.createdAt,
      status: report.status,
      type: report.title,
    };
  });

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    logout();
    handleMenuClose();
  };

  const startRecording = async () => {
    if (!selectedStudent) {
      alert('Please select a student first');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];

      mediaRecorder.ondataavailable = (event) => {
        chunks.push(event.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        setRecordingBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (error) {
      console.error('Error accessing microphone:', error);
      alert('Error accessing microphone. Please check permissions.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
  };

  const playRecording = () => {
    if (audioRef.current) {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const pauseRecording = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  };

  const saveRecording = () => {
    if (recordingBlob && selectedStudent) {
      // In a real app, this would upload to the server
      const formData = new FormData();
      formData.append('audio', recordingBlob, `${selectedStudent.name}_recording.webm`);
      formData.append('studentId', selectedStudent.id);
      formData.append('teacherId', user?.id || '');
      
      // Simulate upload
      console.log('Saving recording for:', selectedStudent.name);
      toast.success(`Recording saved for ${selectedStudent.name}!`);
      
      // Reset recording state
      setRecordingBlob(null);
      setAudioUrl('');
      setRecordingTime(0);
    }
  };

  // AI Transcription function
  const transcribeAudio = async () => {
    if (!recordingBlob || !selectedStudent) return;
    
    setIsTranscribing(true);
    toast.loading('Transcribing audio...');
    
    try {
      const response = await aiService.transcribeAudio({
        audioBlob: recordingBlob,
        language: 'en',
        studentName: selectedStudent.name
      });

      if (response.success && response.data) {
        setTranscription(response.data);
        toast.success('Audio transcribed successfully!');
      } else {
        throw new Error(response.error || 'Transcription failed');
      }
    } catch (error) {
      console.error('Transcription error:', error);
      toast.error('Transcription failed. Please try again.');
    } finally {
      setIsTranscribing(false);
    }
  };

  // AI Report Generation function
  const generateReport = async () => {
    if (!transcription || !selectedStudent) return;
    
    setIsGeneratingReport(true);
    toast.loading('Generating AI report...');
    
    try {
      const response = await aiService.generateReport({
        transcription,
        studentName: selectedStudent.name,
        grade: selectedStudent.grade,
        template: 'standard'
      });

      if (response.success && response.data) {
        setGeneratedReport(response.data);
        setReportStatus('review');
        toast.success('AI report generated successfully!');
      } else {
        throw new Error(response.error || 'Report generation failed');
      }
    } catch (error) {
      console.error('Report generation error:', error);
      toast.error('Report generation failed. Please try again.');
    } finally {
      setIsGeneratingReport(false);
    }
  };

  // Send report to parent
  const sendReport = () => {
    if (!generatedReport || !selectedStudent) return;
    
    toast.loading('Sending report to parent...');
    
    // Simulate sending delay
    setTimeout(() => {
      toast.success(`Report sent to ${selectedStudent.name}'s parent successfully!`);
      setReportStatus('completed');
      
      // Add report to data context
      // In a real app, this would be saved to the database
    }, 2000);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const renderSection = () => {
    switch (currentSection) {
      case 'dashboard':
        return <TeacherDashboard />;
      case 'recording':
        return <VoiceRecordingSection />;
      case 'students':
        return <StudentsSection />;
      case 'reports':
        return <ReportsSection />;
      case 'settings':
        return <SettingsSection />;
      default:
        return <TeacherDashboard />;
    }
  };

  const TeacherDashboard = () => (
    <Box>
      <Typography variant="h4" gutterBottom>
        Teacher Dashboard
      </Typography>
      
      <Grid container spacing={3}>
        {/* Quick Stats */}
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h4" color="primary">
                {teacherStudents.length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Total Students
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h4" color="success.main">
                {teacherReports.filter(r => r.status === 'completed').length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Reports Completed
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h4" color="warning.main">
                {teacherReports.filter(r => r.status === 'draft').length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Draft Reports
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent sx={{ textAlign: 'center' }}>
              <Typography variant="h4" color="info.main">
                {teacherStudents.filter(s => s.status === 'active').length}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Active Students
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Recent Activity */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Recent Reports
              </Typography>
              <List>
                {teacherReports.slice(0, 3).map((report) => (
                  <ListItem key={report.id}>
                    <ListItemAvatar>
                      <Avatar sx={{ bgcolor: 'primary.main' }}>
                        <Assessment />
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={report.studentName}
                      secondary={`${report.type} - ${report.date}`}
                    />
                    <Chip
                      label={report.status}
                      color={report.status === 'completed' ? 'success' : 'warning'}
                      size="small"
                    />
                  </ListItem>
                ))}
              </List>
            </CardContent>
          </Card>
        </Grid>

        {/* Quick Actions */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Quick Actions
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Button
                  variant="contained"
                  startIcon={<RecordVoiceOver />}
                  onClick={() => setCurrentSection('recording')}
                  fullWidth
                >
                  Start Voice Recording
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<People />}
                  onClick={() => setCurrentSection('students')}
                  fullWidth
                >
                  View My Students
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<Assessment />}
                  onClick={() => setCurrentSection('reports')}
                  fullWidth
                >
                  Manage Reports
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );

  const VoiceRecordingSection = () => (
    <Box>
      <Typography variant="h4" gutterBottom>
        Voice Recording & AI Report Generation
      </Typography>
      
      {/* Student Selection */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Select Student for Recording
          </Typography>
          
          {selectedStudent ? (
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <Avatar sx={{ mr: 2, bgcolor: 'primary.main' }}>
                {selectedStudent.avatar}
              </Avatar>
              <Box sx={{ flexGrow: 1 }}>
                <Typography variant="h6">{selectedStudent.name}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {selectedStudent.grade}
                </Typography>
              </Box>
              <Button
                variant="outlined"
                size="small"
                onClick={() => setSelectedStudent(null)}
              >
                Change Student
              </Button>
            </Box>
          ) : (
            <Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Choose a student to record voice notes for their AI-generated report
              </Typography>
              <Button
                variant="contained"
                startIcon={<Person />}
                onClick={() => setOpenStudentDialog(true)}
              >
                Select Student
              </Button>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Recording Interface */}
      {selectedStudent && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Recording Interface - {selectedStudent.name}
            </Typography>
            
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Box sx={{ mb: 3 }}>
                <IconButton
                  size="large"
                  sx={{
                    width: 80,
                    height: 80,
                    bgcolor: isRecording ? 'error.main' : 'primary.main',
                    color: 'white',
                    '&:hover': {
                      bgcolor: isRecording ? 'error.dark' : 'primary.dark',
                    },
                  }}
                  onClick={isRecording ? stopRecording : startRecording}
                  disabled={!selectedStudent}
                >
                  {isRecording ? <Stop /> : <Mic />}
                </IconButton>
              </Box>
              
              <Typography variant="h4" gutterBottom>
                {formatTime(recordingTime)}
              </Typography>
              
              <Typography variant="body2" color="text.secondary" gutterBottom>
                {isRecording ? 'Recording in progress...' : 'Click to start recording'}
              </Typography>
              
              {isRecording && (
                <Box sx={{ mt: 2 }}>
                  <LinearProgress />
                  <Typography variant="caption" color="text.secondary">
                    Recording voice notes for {selectedStudent.name}
                  </Typography>
                </Box>
              )}
            </Box>

            {/* Playback Controls */}
            {recordingBlob && (
              <Box sx={{ mt: 3, textAlign: 'center' }}>
                <Typography variant="h6" gutterBottom>
                  Recording Preview
                </Typography>
                <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, mb: 2 }}>
                  <Button
                    variant="outlined"
                    startIcon={<PlayArrow />}
                    onClick={playRecording}
                    disabled={isPlaying}
                  >
                    Play
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={<Pause />}
                    onClick={pauseRecording}
                    disabled={!isPlaying}
                  >
                    Pause
                  </Button>
                </Box>
                <audio ref={audioRef} controls style={{ width: '100%' }} />
                
                {/* AI Processing Buttons */}
                <Box sx={{ mt: 3, display: 'flex', justifyContent: 'center', gap: 2 }}>
                  <Button
                    variant="contained"
                    startIcon={<AutoFixHigh />}
                    onClick={transcribeAudio}
                    disabled={isTranscribing}
                    color="secondary"
                  >
                    {isTranscribing ? (
                      <>
                        <CircularProgress size={20} sx={{ mr: 1 }} />
                        Transcribing...
                      </>
                    ) : (
                      'Transcribe Audio'
                    )}
                  </Button>
                  
                  <Button
                    variant="contained"
                    startIcon={<Save />}
                    onClick={saveRecording}
                  >
                    Save Recording
                  </Button>
                </Box>
              </Box>
            )}
          </CardContent>
        </Card>
      )}

      {/* Transcription Display */}
      {transcription && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              AI Transcription
            </Typography>
            <TextField
              fullWidth
              multiline
              rows={4}
              value={transcription}
              onChange={(e) => setTranscription(e.target.value)}
              variant="outlined"
              sx={{ mb: 2 }}
            />
            <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2 }}>
              <Button
                variant="contained"
                startIcon={<AutoFixHigh />}
                onClick={generateReport}
                disabled={isGeneratingReport}
                color="success"
              >
                {isGeneratingReport ? (
                  <>
                    <CircularProgress size={20} sx={{ mr: 1 }} />
                    Generating Report...
                  </>
                ) : (
                  'Generate AI Report'
                )}
              </Button>
            </Box>
          </CardContent>
        </Card>
      )}

      {/* Generated Report Display */}
      {generatedReport && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6">
                AI Generated Report
              </Typography>
              <Chip 
                label={reportStatus} 
                color={reportStatus === 'completed' ? 'success' : reportStatus === 'review' ? 'warning' : 'default'}
              />
            </Box>
            <TextField
              fullWidth
              multiline
              rows={12}
              value={generatedReport}
              onChange={(e) => setGeneratedReport(e.target.value)}
              variant="outlined"
              sx={{ mb: 2 }}
            />
            <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2 }}>
              <Button
                variant="contained"
                startIcon={<Send />}
                onClick={() => {}} // Disabled functionality
                disabled={true}
                color="primary"
                sx={{ opacity: 0.6 }}
              >
                Send to Parent (Disabled)
              </Button>
              <Button
                variant="outlined"
                onClick={() => {
                  setGeneratedReport('');
                  setTranscription('');
                  setReportStatus('draft');
                }}
              >
                Start Over
              </Button>
            </Box>
          </CardContent>
        </Card>
      )}
    </Box>
  );

  const StudentsSection = () => (
    <Box>
      <Typography variant="h4" gutterBottom>
        My Students
      </Typography>
      
      <Grid container spacing={3}>
        {teacherStudents.map((student) => (
          <Grid item xs={12} md={4} key={student.id}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <Avatar sx={{ mr: 2, bgcolor: 'primary.main' }}>
                    {student.avatar}
                  </Avatar>
                  <Box>
                    <Typography variant="h6">{student.name}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {student.grade}
                    </Typography>
                  </Box>
                </Box>
                
                <Box sx={{ mb: 2 }}>
                  <Chip
                    label={student.status}
                    color={student.status === 'active' ? 'success' : 'warning'}
                    size="small"
                  />
                </Box>
                
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Last Report: {student.lastReport}
                </Typography>
                
                <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
                  <Button
                    size="small"
                    variant="contained"
                    startIcon={<RecordVoiceOver />}
                    onClick={() => {
                      setSelectedStudent(student);
                      setCurrentSection('recording');
                    }}
                  >
                    Record
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<Visibility />}
                    onClick={() => setOpenReportDialog(true)}
                  >
                    View Reports
                  </Button>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );

  const ReportsSection = () => (
    <Box>
      <Typography variant="h4" gutterBottom>
        Reports
      </Typography>
      
      <Card>
        <CardContent>
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Student</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Date</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {teacherReports.map((report) => (
                  <TableRow key={report.id}>
                    <TableCell>{report.studentName}</TableCell>
                    <TableCell>{report.type}</TableCell>
                    <TableCell>{report.date}</TableCell>
                    <TableCell>
                      <Chip
                        label={report.status}
                        color={report.status === 'completed' ? 'success' : 'warning'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <IconButton size="small" color="primary">
                          <Visibility />
                        </IconButton>
                        <IconButton size="small" color="primary">
                          <Edit />
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
    </Box>
  );

  const SettingsSection = () => (
    <Box>
      <Typography variant="h4" gutterBottom>
        Settings
      </Typography>
      
      <Card>
        <CardContent>
          <Typography variant="body1">
            Teacher settings and preferences will be configured here.
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex' }}>
      {/* App Bar */}
      <AppBar
        position="fixed"
        sx={{
          width: `calc(100% - ${drawerWidth}px)`,
          ml: `${drawerWidth}px`,
        }}
      >
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Barrana.ai - Teacher Portal
          </Typography>
          
          <IconButton color="inherit">
            <Badge badgeContent={4} color="error">
              <Notifications />
            </Badge>
          </IconButton>
          
          <IconButton
            color="inherit"
            onClick={handleMenuOpen}
          >
            <AccountCircle />
          </IconButton>
          
          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={handleMenuClose}
          >
            <MenuItem onClick={handleMenuClose}>
              <AccountCircle sx={{ mr: 1 }} />
              Profile
            </MenuItem>
            <Divider />
            <MenuItem onClick={handleLogout}>
              <Logout sx={{ mr: 1 }} />
              Logout
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      {/* Sidebar */}
      <Drawer
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: drawerWidth,
            boxSizing: 'border-box',
          },
        }}
        variant="permanent"
        anchor="left"
      >
        <Toolbar />
        <Box sx={{ overflow: 'auto' }}>
          <List>
            {menuItems.map((item) => (
              <ListItem
                key={item.text}
                disablePadding
                button
                selected={currentSection === item.section}
                onClick={() => setCurrentSection(item.section)}
              >
                <ListItemButton>
                  <ListItemIcon>{item.icon}</ListItemIcon>
                  <ListItemText primary={item.text} />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        </Box>
      </Drawer>

      {/* Main Content */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          bgcolor: 'background.default',
          p: 3,
        }}
      >
        <Toolbar />
        {renderSection()}
      </Box>

      {/* Student Selection Dialog */}
      <Dialog open={openStudentDialog} onClose={() => setOpenStudentDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Select Student for Recording</DialogTitle>
        <DialogContent>
          <List>
            {teacherStudents.map((student) => (
              <ListItem
                key={student.id}
                button
                onClick={() => {
                  setSelectedStudent(student);
                  setOpenStudentDialog(false);
                }}
              >
                <ListItemAvatar>
                  <Avatar sx={{ bgcolor: 'primary.main' }}>
                    {student.avatar}
                  </Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary={student.name}
                  secondary={student.grade}
                />
              </ListItem>
            ))}
          </List>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenStudentDialog(false)}>Cancel</Button>
        </DialogActions>
      </Dialog>

      {/* Report Dialog */}
      <Dialog open={openReportDialog} onClose={() => setOpenReportDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>Student Reports</DialogTitle>
        <DialogContent>
          <Typography variant="body1">
            Report management interface will be implemented here.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenReportDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default TeachersUI; 