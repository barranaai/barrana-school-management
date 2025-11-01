import { useBranding } from '../contexts/BrandingContext';
import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
  ActivityIndicator,
  TextInput,
  Modal,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Picker } from '@react-native-picker/picker';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import moment from 'moment-timezone';
import apiService, { User } from '../apiService';
import MediaUpload from '../components/MediaUpload';

interface StudentsScreenProps {
  user: User;
  onBack: () => void;
}

interface Student {
  _id: string;
  id?: string;
  firstName: string;
  lastName: string;
  name: string;
  grade?: string;
  studentGrade?: string;
  studentClass?: string;
  class?: string;
  status?: 'active' | 'pending' | 'inactive';
  lastReport?: string;
  parentEmail?: string;
  parentPhone?: string;
  parentName?: string;
  avatar?: string;
  teacherId?: string;
  parentId?: string;
  schoolId: string;
  enrollmentDate?: string;
  dateOfBirth?: string;
  address?: string;
  emergencyContact?: string;
  medicalInfo?: string;
  academicLevel?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface DueReport {
  studentId: string;
  studentName: string;
  templateName: string;
  frequency: string;
  dueDate: string;
  daysOverdue: number;
  templateId: string;
  reportStatus?: 'draft' | 'completed' | 'sent' | 'missing';
  reportId?: string | null;
}

interface StudentReport {
  _id: string;
  studentId: string;
  teacherId: string;
  schoolId: string;
  title: string;
  content: string;
  status: 'draft' | 'completed' | 'sent' | 'review' | 'approved' | 'archived';
  createdAt: string;
  updatedAt: string;
  sentAt?: string;
  template?: string;
  voiceRecordingUrl?: string;
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
  reviewedBy?: string[];
  tags?: string[];
  academicPeriod?: string;
  subjects?: string[];
  skills?: {
    [key: string]: {
      score: number;
      level: string;
      comments: string;
    };
  };
  type?: string;
}

interface ReportTemplate {
  _id: string;
  name: string;
  grade: string;
  isActive: boolean;
  reportFrequency: string;
  createdAt: string;
}

interface VoiceRecording {
  id: string;
  uri: string;
  duration: number;
  transcription?: string;
}

interface CreateReportData {
  title: string;
  studentId: string;
  templateId: string;
  content: string;
  customFieldValues: {};
  reportType: string;
  reportPeriod: {
    startDate: Date;
    endDate: Date;
  };
  voiceRecording: {
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
  aiGenerated: {
    isAiGenerated: boolean;
    originalTranscription?: string;
    generationModel?: string;
  };
  attachments?: Array<{
    filename: string;
    originalName: string;
    mimeType: string;
    size: number;
    url: string;
    uploadedAt: string;
    isTemporary: boolean;
  }>;
}

const StudentsScreen: React.FC<StudentsScreenProps> = ({ user, onBack }) => {
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [students, setStudents] = useState<Student[]>([]);
  const [reports, setReports] = useState<StudentReport[]>([]);
  const [dueReports, setDueReports] = useState<DueReport[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Report Generation State
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<ReportTemplate | null>(null);
  const [reportTemplates, setReportTemplates] = useState<ReportTemplate[]>([]);
  const [reportContent, setReportContent] = useState('');
  
  // Voice Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [recordings, setRecordings] = useState<VoiceRecording[]>([]);
  const [transcription, setTranscription] = useState('');
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [isSending, setIsSending] = useState(false);
  
  // Audio recording refs
  const recordingRef = useRef<Audio.Recording | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Media upload state
  const [uploadedMedia, setUploadedMedia] = useState<any[]>([]);
  const [currentReportId, setCurrentReportId] = useState<string>('');
  const [tempReportId, setTempReportId] = useState<string>('');
  
  // School data state
  const [schoolData, setSchoolData] = useState<any>(null);
  const [teacherData, setTeacherData] = useState<any>(null);
  
  // Audio playback state
  const [currentSound, setCurrentSound] = useState<Audio.Sound | null>(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [playingRecordingId, setPlayingRecordingId] = useState<string | null>(null);
  
  // Debug state
  const [debugLogs, setDebugLogs] = useState<string[]>([]);
  const [showDebugPanel, setShowDebugPanel] = useState(false);
  
  // Debug helper function
  const addDebugLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = `[${timestamp}] ${message}`;
    setDebugLogs(prev => [logEntry, ...prev].slice(0, 100)); // Keep last 100 logs
    console.log(logEntry); // Also log to console
  };

  // Load teacher data when component mounts
  React.useEffect(() => {
    const initializeData = async () => {
      try {
        await Promise.all([
          loadStudents(),
          loadReportTemplates(), 
          loadSchoolData(),
          loadTeacherData()
        ]);
      } catch (error) {
        addDebugLog(`❌ Error in initial data loading: ${error}`);
      }
    };
    
    initializeData();
  }, []);

  // Recalculate due reports when templates are loaded
  React.useEffect(() => {
    if (reportTemplates.length > 0 && students.length > 0 && reports.length > 0) {
      addDebugLog('📱 Templates loaded, recalculating due reports with backend API...');
      const calculateAsync = async () => {
        try {
          await calculateDueReports(students, reports);
        } catch (error) {
          addDebugLog(`📱 Error calculating due reports: ${error}`);
        }
      };
      calculateAsync();
    }
  }, [reportTemplates.length, students.length, reports.length]);

  const loadStudents = async () => {
    setLoading(true);
    try {
      // Get students assigned to this teacher through their classes
      const studentsData = await apiService.getTeacherStudents(user.id);
      addDebugLog(`📱 Students data received: ${studentsData?.length || 0} students`);
      addDebugLog(`📱 First student sample: ${studentsData?.[0] ? `${studentsData[0].firstName} ${studentsData[0].lastName} (Grade: ${studentsData[0].studentGrade || studentsData[0].grade})` : 'None'}`);
      
      // Validate and clean students data
      const validStudents = studentsData?.filter(student => 
        student && typeof student === 'object' && student._id
      ) || [];
      
      addDebugLog(`📱 Valid students count: ${validStudents.length}`);
      setStudents(validStudents);
      
      // Get ALL reports for proper cross-teacher due calculation (like web app)
      const reportsData = await apiService.getReports(true); // Include cross-teacher reports
      addDebugLog(`📱 Reports data received (including cross-teacher): ${reportsData?.length || 0} reports`);
      setReports(reportsData || []);
      
      // Calculate due reports will be called after templates are loaded
      // We'll call it in the useEffect that depends on templates
    } catch (error) {
      console.error('Error loading students:', error);
      Alert.alert('Error', 'Failed to load students');
    } finally {
      setLoading(false);
    }
  };

  const loadReportTemplates = async () => {
    try {
      addDebugLog('📋 Loading report templates...');
      const templatesData = await apiService.getReportTemplates();
      addDebugLog(`📋 Templates received: ${templatesData?.length || 0} templates`);
      if (templatesData?.length > 0) {
        const templatesByGrade = templatesData.reduce((acc: any, template: any) => {
          acc[template.grade] = (acc[template.grade] || 0) + 1;
          return acc;
        }, {});
        addDebugLog(`📋 Templates by grade: ${JSON.stringify(templatesByGrade)}`);
      }
      setReportTemplates(templatesData || []);
    } catch (error) {
      addDebugLog(`❌ Error loading report templates: ${error}`);
    }
  };

  const loadSchoolData = async () => {
    try {
      addDebugLog('🏫 Loading school data...');
      const schoolId = typeof user.schoolId === 'string' ? user.schoolId : user.schoolId?._id;
      if (schoolId) {
        const schoolData = await apiService.getSchool(schoolId);
        addDebugLog(`🏫 School data received: ${schoolData ? 'Success' : 'Failed'}`);
        if (schoolData?.settings?.reportFrequencies) {
          const frequencies = Object.keys(schoolData.settings.reportFrequencies);
          addDebugLog(`🏫 School frequencies: ${frequencies.join(', ')}`);
        }
        setSchoolData(schoolData);
      } else {
        addDebugLog('🏫 No school ID found');
      }
    } catch (error) {
      addDebugLog(`❌ Error loading school data: ${error}`);
    }
  };

  const loadTeacherData = async () => {
    try {
      addDebugLog('👨‍🏫 Loading teacher permissions...');
      const response = await apiService.getCurrentTeacher(user.id);
      if (response.success && response.data) {
        addDebugLog(`👨‍🏫 Teacher data loaded: canEmailReports=${response.data.canEmailReports}`);
        setTeacherData(response.data);
      } else {
        addDebugLog(`👨‍🏫 Failed to load teacher data: ${response.error}`);
      }
    } catch (error) {
      addDebugLog(`👨‍🏫 Error loading teacher data: ${error}`);
    }
  };

  // Voice Recording Functions
  const setupAudio = async () => {
    try {
      await Audio.requestPermissionsAsync();
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
    } catch (error) {
      console.error('Error setting up audio:', error);
      Alert.alert('Error', 'Failed to setup audio permissions');
    }
  };

  const startRecording = async () => {
    try {
      await setupAudio();
      
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      
      recordingRef.current = recording;
      setIsRecording(true);
      setRecordingTime(0);
      
      // Start timer
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
      
      console.log('📱 Recording started');
    } catch (error) {
      console.error('Error starting recording:', error);
      Alert.alert('Error', 'Failed to start recording');
    }
  };

  const stopRecording = async () => {
    try {
      if (!recordingRef.current) return;
      
      setIsRecording(false);
      
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      
      if (uri) {
        const newRecording: VoiceRecording = {
          id: Date.now().toString(),
          uri,
          duration: recordingTime,
        };
        
        setRecordings(prev => [...prev, newRecording]);
        console.log('📱 Recording saved:', newRecording);
      }
      
      recordingRef.current = null;
    } catch (error) {
      console.error('Error stopping recording:', error);
      Alert.alert('Error', 'Failed to stop recording');
    }
  };

  // AI Transcription and Report Generation
  const transcribeAudio = async () => {
    if (recordings.length === 0 || !selectedStudent) return;
    
    setIsTranscribing(true);
    
    try {
      console.log('📱 Starting transcription for', recordings.length, 'recordings');
      const transcriptions = [];
      
      for (const recording of recordings) {
        try {
          console.log('📱 Processing recording:', recording.id, 'URI:', recording.uri);
          
          // For mobile, we need to handle the file differently
          // Create a proper file object for the API
          const formData = new FormData();
          
          // For React Native, we need to create a file object
          const fileUri = recording.uri;
          const fileName = `recording_${recording.id}.m4a`;
          
          // Create file object for React Native
          const file = {
            uri: fileUri,
            type: 'audio/m4a',
            name: fileName,
          } as any;
          
          // Use the backend's expected format
          formData.append('audio', file);
          formData.append('studentName', getStudentFullName(selectedStudent));
          formData.append('language', 'en');
          
          console.log('📱 Sending transcription request for recording:', recording.id);
          
          let transcriptionResponse;
          try {
            transcriptionResponse = await apiService.transcribeAudioFile(formData);
          } catch (apiError) {
            console.error('📱 API call failed:', apiError);
            const errorMessage = apiError instanceof Error ? apiError.message : 'Unknown API error';
            throw new Error(`API call failed: ${errorMessage}`);
          }

          if (transcriptionResponse.success && transcriptionResponse.data) {
            console.log('📱 Transcription successful for recording:', recording.id);
            transcriptions.push(transcriptionResponse.data);
            // Update the recording with its transcription
            setRecordings(prev => prev.map(r => 
              r.id === recording.id 
                ? { ...r, transcription: transcriptionResponse.data }
                : r
            ));
          } else {
            console.error('📱 Transcription failed for recording:', recording.id, transcriptionResponse.error);
            throw new Error(transcriptionResponse.error || 'Transcription failed for this recording');
          }
        } catch (recordingError) {
          console.error('📱 Error processing recording:', recording.id, recordingError);
          throw new Error(`Failed to process recording ${recording.id}: ${recordingError}`);
        }
      }

      // Combine all transcriptions
      const combinedTranscription = transcriptions.join('\n\n--- Next Recording ---\n\n');
      setTranscription(combinedTranscription);
      Alert.alert('Success', `All recordings transcribed successfully! Generated ${transcriptions.length} transcription(s).`);
    } catch (error) {
      console.error('📱 Transcription error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      if (errorMessage.includes('API key not configured') || errorMessage.includes('Transcription service not configured')) {
        Alert.alert(
          'Transcription Service Unavailable', 
          'The transcription service is not properly configured. Please contact your administrator.'
        );
      } else if (errorMessage.includes('No audio file provided')) {
        Alert.alert(
          'No Audio File', 
          'Please record some audio before attempting to transcribe.'
        );
      } else if (errorMessage.includes('timeout')) {
        Alert.alert(
          'Transcription Timeout', 
          'The audio file is too long or the service is taking too long to respond. Please try with a shorter recording.'
        );
      } else {
        Alert.alert('Transcription Error', `Failed to transcribe audio: ${errorMessage}`);
      }
    } finally {
      setIsTranscribing(false);
    }
  };

  // Audio playback functions
  const playRecording = async (recording: VoiceRecording) => {
    try {
      // Stop any currently playing audio
      if (currentSound) {
        await currentSound.unloadAsync();
        setCurrentSound(null);
        setIsPlayingAudio(false);
        setPlayingRecordingId(null);
      }

      console.log('🎵 Playing recording:', recording.id);
      addDebugLog(`🎵 Playing recording: ${recording.id}`);
      
      if (!recording.uri) {
        throw new Error('Recording URI is empty or null');
      }
      
      const { sound } = await Audio.Sound.createAsync(
        { uri: recording.uri },
        { shouldPlay: true }
      );
      
      setCurrentSound(sound);
      setIsPlayingAudio(true);
      setPlayingRecordingId(recording.id);
      
      console.log('✅ Audio playback started successfully');
      addDebugLog('✅ Audio playback started successfully');
      
      // Handle when audio finishes playing
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          console.log('🎵 Audio playback finished');
          addDebugLog('🎵 Audio playback finished');
          setIsPlayingAudio(false);
          setPlayingRecordingId(null);
          setCurrentSound(null);
        }
      });
    } catch (error) {
      console.error('❌ Error playing audio:', error);
      addDebugLog(`❌ Error playing audio: ${error}`);
      Alert.alert('Playback Error', `Failed to play recording: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const stopAudioPlayback = async () => {
    try {
      if (currentSound) {
        await currentSound.unloadAsync();
        setCurrentSound(null);
        setIsPlayingAudio(false);
        setPlayingRecordingId(null);
        console.log('🎵 Audio playback stopped');
        addDebugLog('🎵 Audio playback stopped');
      }
    } catch (error) {
      console.error('❌ Error stopping audio:', error);
      addDebugLog(`❌ Error stopping audio: ${error}`);
    }
  };

  // Cleanup audio on component unmount
  React.useEffect(() => {
    return () => {
      if (currentSound) {
        currentSound.unloadAsync();
      }
    };
  }, [currentSound]);

  const generateReportFromTranscription = async () => {
    if (!selectedStudent || !selectedTemplate || !transcription.trim()) {
      Alert.alert('Error', 'Please transcribe audio first');
      return;
    }
    
    setIsGeneratingReport(true);
    addDebugLog('🤖 Starting AI report generation...');
    
    try {
      addDebugLog(`📱 Student: ${getStudentFullName(selectedStudent)}`);
      addDebugLog(`📱 Template: ${selectedTemplate.name} (ID: ${selectedTemplate._id})`);
      addDebugLog(`📱 Transcription length: ${transcription.length} characters`);
      addDebugLog(`📱 Grade: ${selectedStudent.studentGrade || selectedStudent.grade || 'N/A'}`);
      
      const response = await apiService.generateReport({
        transcription,
        studentName: getStudentFullName(selectedStudent),
        grade: selectedStudent.studentGrade || selectedStudent.grade || '',
        template: selectedTemplate.name,
        templateId: selectedTemplate._id // Add templateId for dynamic keyword generation
      });

      addDebugLog(`📱 AI Report generation response: ${JSON.stringify(response)}`);

      if (response.success && response.data) {
        // The response.data should now be a formatted string, not JSON
        setReportContent(response.data);
        addDebugLog(`✅ Report generated successfully! Content length: ${response.data.length} characters`);
        Alert.alert('Success', 'Report generated successfully! You can now review and edit the content.');
      } else {
        addDebugLog(`❌ Report generation failed: ${response.error || 'Unknown error'}`);
        throw new Error(response.error || 'Report generation failed');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      addDebugLog(`💥 Report generation error: ${errorMessage}`);
      addDebugLog(`💥 Error details: ${JSON.stringify(error)}`);
      Alert.alert('Report Generation Failed', `${errorMessage}. Please check debug logs for details.`);
    } finally {
      setIsGeneratingReport(false);
      addDebugLog('🏁 Report generation process completed');
    }
  };

  // Template auto-selection (prioritizes due templates)
  const autoSelectTemplateForStudent = (student: Student) => {
    console.log('📱 autoSelectTemplateForStudent called for:', getStudentFullName(student));
    
    if (!student || !reportTemplates.length) {
      console.log('📱 No student or templates available');
      return;
    }
    
    // Get templates that are actually due (not just available)
    const dueTemplates = getDueTemplatesForStudent(student);
    console.log('📱 Due templates for student:', dueTemplates.length);
    
    if (dueTemplates.length > 0) {
      // Set the first due template as selected by default
      const defaultTemplate = dueTemplates[0];
      console.log('📱 Auto-selecting due template:', defaultTemplate.name);
      setSelectedTemplate(defaultTemplate);
      
      Alert.alert(
        'Template Selected', 
        `Due template "${defaultTemplate.name}" (${defaultTemplate.reportFrequency}) selected for Grade ${student.studentGrade || student.grade}`
      );
    } else {
      console.log('📱 No due templates for grade:', student.studentGrade || student.grade);
      const availableTemplates = getAvailableTemplatesForStudent(student);
      const existingReports = getExistingReportInfo(student) || [];
      
      if (availableTemplates.length > 0) {
        // There are available templates but none are due yet
        Alert.alert(
          'No Due Reports', 
          `${availableTemplates.length} template(s) available for Grade ${student.studentGrade || student.grade}, but none are due yet. You can still generate reports manually if needed.`
        );
      } else if (existingReports.length > 0) {
        const reportDetails = existingReports.map(r => `${r.frequency}`).join(', ');
        Alert.alert(
          'Reports Complete', 
          `All ${reportDetails} reports already exist for Grade ${student.studentGrade || student.grade}.`
        );
      } else {
        Alert.alert('No Templates', `No active templates found for Grade ${student.studentGrade || student.grade}.`);
      }
      setSelectedTemplate(null);
    }
  };

  // Helper function to check if a report is for the current period based on frequency
  const getReportForCurrentPeriod = (reports: StudentReport[], frequency: string, currentDate: Date) => {
    const now = new Date(currentDate);
    
    // Get school settings for timezone-aware calculations
    const schoolSettings = schoolData?.settings || {};
    const timezone = schoolSettings.timezone || 'UTC';
    
    return reports.find(report => {
      const reportDate = new Date(report.createdAt);
      
      // Convert dates to school timezone for proper comparison
      const reportDateInTZ = convertToSchoolTimezone(reportDate, timezone);
      const nowInTZ = convertToSchoolTimezone(now, timezone);
      
      switch (frequency) {
        case 'Daily':
          // Check if report is from today in school timezone
          // For daily reports, we need to check if today is a working day
          const workingDays = schoolData?.settings?.reportFrequencies?.Daily?.workingDays || [1, 2, 3, 4, 5]; // Default to Mon-Fri
          // Convert JavaScript day (0=Sunday) to ISO weekday (1=Monday, 7=Sunday)
          const jsDay = nowInTZ.getDay();
          const currentDayOfWeek = jsDay === 0 ? 7 : jsDay; // Convert 0 (Sunday) to 7
          const isWorkingDay = workingDays.includes(currentDayOfWeek);
          
          if (isWorkingDay) {
            return reportDateInTZ.toDateString() === nowInTZ.toDateString();
          } else {
            // If today is not a working day, check if there's a report from the last working day
            let lastWorkingDay = new Date(nowInTZ);
            do {
              lastWorkingDay.setDate(lastWorkingDay.getDate() - 1);
              const lastJsDay = lastWorkingDay.getDay();
              const lastIsoDay = lastJsDay === 0 ? 7 : lastJsDay;
              if (workingDays.includes(lastIsoDay)) break;
            } while (true);
            return reportDateInTZ.toDateString() === lastWorkingDay.toDateString();
          }
        case 'Weekly':
          // Check if report is from this week (Monday to Sunday) in school timezone
          const weekStart = new Date(nowInTZ);
          weekStart.setDate(nowInTZ.getDate() - nowInTZ.getDay() + 1); // Monday
          weekStart.setHours(0, 0, 0, 0);
          const weekEnd = new Date(weekStart);
          weekEnd.setDate(weekStart.getDate() + 6); // Sunday
          weekEnd.setHours(23, 59, 59, 999);
          return reportDateInTZ >= weekStart && reportDateInTZ <= weekEnd;
        case 'Bi-Weekly':
          // Check if report is from current 2-week period in school timezone
          const biWeekStart = new Date(nowInTZ);
          biWeekStart.setDate(nowInTZ.getDate() - nowInTZ.getDay() + 1);
          biWeekStart.setHours(0, 0, 0, 0);
          const biWeekEnd = new Date(biWeekStart);
          biWeekEnd.setDate(biWeekStart.getDate() + 13);
          biWeekEnd.setHours(23, 59, 59, 999);
          return reportDateInTZ >= biWeekStart && reportDateInTZ <= biWeekEnd;
        case 'Monthly':
          // Check if report is from current month in school timezone
          return reportDateInTZ.getMonth() === nowInTZ.getMonth() && 
                 reportDateInTZ.getFullYear() === nowInTZ.getFullYear();
        case 'Bi-Monthly':
          // Check if report is from current 2-month period in school timezone
          const biMonthStart = new Date(nowInTZ.getFullYear(), Math.floor(nowInTZ.getMonth() / 2) * 2, 1);
          const biMonthEnd = new Date(biMonthStart);
          biMonthEnd.setMonth(biMonthStart.getMonth() + 2);
          biMonthEnd.setDate(0); // Last day of the second month
          biMonthEnd.setHours(23, 59, 59, 999);
          return reportDateInTZ >= biMonthStart && reportDateInTZ <= biMonthEnd;
        case 'Quarterly':
          // Check if report is from current quarter in school timezone
          const quarterStart = new Date(nowInTZ.getFullYear(), Math.floor(nowInTZ.getMonth() / 3) * 3, 1);
          const quarterEnd = new Date(quarterStart);
          quarterEnd.setMonth(quarterStart.getMonth() + 3);
          quarterEnd.setDate(0);
          quarterEnd.setHours(23, 59, 59, 999);
          return reportDateInTZ >= quarterStart && reportDateInTZ <= quarterEnd;
        case 'Annually':
          // Check if report is from current year in school timezone
          return reportDateInTZ.getFullYear() === nowInTZ.getFullYear();
        default:
          return false;
      }
    });
  };

  // Helper functions for mobile due date calculation (simplified versions of backend logic)
  const isWeekend = (date: Date, workingDays: any): boolean => {
    const dayOfWeek = date.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    // Convert to ISO weekday format (1=Monday, 7=Sunday) to match backend
    const isoWeekday = dayOfWeek === 0 ? 7 : dayOfWeek;
    
    // Check if workingDays is an array (ISO format) or object (boolean properties)
    if (Array.isArray(workingDays)) {
      return !workingDays.includes(isoWeekday);
    }
    
    // Handle object format
    if (dayOfWeek === 0) return !workingDays.sunday;
    if (dayOfWeek === 6) return !workingDays.saturday;
    
    return false;
  };

  const isHoliday = (date: Date, holidays: any[]): boolean => {
    const dateString = date.toISOString().split('T')[0]; // YYYY-MM-DD
    
    return holidays.some((holiday: any) => {
      const holidayDate = new Date(holiday.date);
      const holidayString = holidayDate.toISOString().split('T')[0];
      
      if (holiday.isRecurring) {
        // For recurring holidays, check month and day only
        return date.getMonth() === holidayDate.getMonth() && date.getDate() === holidayDate.getDate();
      } else {
        // For non-recurring holidays, check exact date
        return dateString === holidayString;
      }
    });
  };

  const getNextWorkingDay = (date: Date, workingDays: any, holidays: any[]): Date => {
    let nextDay = new Date(date);
    
    do {
      nextDay.setDate(nextDay.getDate() + 1);
    } while (isWeekend(nextDay, workingDays) || isHoliday(nextDay, holidays));
    
    return nextDay;
  };

  const hasTimePassedToday = (now: Date, dueTime: string): boolean => {
    const [dueHours, dueMinutes] = (dueTime || '17:00').split(':').map(Number);
    const currentHours = now.getHours();
    const currentMinutes = now.getMinutes();
    
    return currentHours > dueHours || (currentHours === dueHours && currentMinutes > dueMinutes);
  };

  const calculateMonthlyDueDate = (baseDate: Date, rule: string, frequencyConfig: any, workingDays: any): Date => {
    let targetDate: Date;
    
    switch (rule) {
      case 'specificDate':
        const specificDay = frequencyConfig.specificDay || 28;
        targetDate = new Date(baseDate.getFullYear(), baseDate.getMonth(), specificDay);
        
        // If day exceeds month length, use last day of month
        if (targetDate.getMonth() !== baseDate.getMonth()) {
          targetDate = new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 0);
        }
        break;
        
      case 'lastDay':
        targetDate = new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 0);
        break;
        
      case 'lastWorkingDay':
      default:
        targetDate = new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 0);
        // Find the last working day of the month (simplified)
        while (isWeekend(targetDate, workingDays)) {
          targetDate.setDate(targetDate.getDate() - 1);
        }
        break;
    }
    
    return targetDate;
  };

  // Fallback function for when school data is not available
  const getFallbackDueDate = (frequency: string, currentDate: Date): Date => {
    const now = new Date(currentDate);
    let dueDate = new Date(now);
    
    switch (frequency) {
      case 'Daily':
        // Due today at 5 PM
        dueDate.setHours(17, 0, 0, 0);
        break;
      case 'Weekly':
        // Due at end of current week (Sunday)
        const daysUntilSunday = (7 - now.getDay()) % 7;
        dueDate.setDate(now.getDate() + daysUntilSunday);
        dueDate.setHours(17, 0, 0, 0);
        break;
      case 'Bi-Weekly':
        // Due in 14 days
        dueDate.setDate(now.getDate() + 14);
        dueDate.setHours(17, 0, 0, 0);
        break;
      case 'Monthly':
        // Due at end of current month
        dueDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        dueDate.setHours(17, 0, 0, 0);
        break;
      case 'Bi-Monthly':
        // Due in 2 months
        dueDate = new Date(now.getFullYear(), now.getMonth() + 2, 0);
        dueDate.setHours(17, 0, 0, 0);
        break;
      case 'Quarterly':
        // Due at end of current quarter
        const currentQuarter = Math.floor(now.getMonth() / 3);
        dueDate = new Date(now.getFullYear(), (currentQuarter + 1) * 3, 0);
        dueDate.setHours(17, 0, 0, 0);
        break;
      case 'Annually':
        // Due at end of current year
        dueDate = new Date(now.getFullYear(), 11, 31);
        dueDate.setHours(17, 0, 0, 0);
        break;
      default:
        // Default to 30 days
        dueDate.setDate(now.getDate() + 30);
        dueDate.setHours(17, 0, 0, 0);
        break;
    }
    
    return dueDate;
  };

  // Helper function to calculate due date for current period
  // FIXED: Use moment-timezone to preserve timezone info (see TIMEZONE_BUG_FIX.md)
  const calculateDueDateForFrequency = (frequency: string, currentDate: Date): Date => {
    try {
      // Get school settings for frequency configuration (same as backend logic)
      const schoolSettings = schoolData?.settings || {};
      const frequencyConfig = schoolSettings.reportFrequencies?.[frequency];
      const workingDays = schoolSettings.calendar?.workingDays || {};
      const holidays = schoolSettings.calendar?.holidays || [];
      const timezone = schoolSettings.timezone || 'UTC';
      
      // Add null checks for safety
      if (!schoolData || !schoolSettings) {
        console.log('📱 No school data available, using fallback calculation');
        return getFallbackDueDate(frequency, new Date(currentDate));
      }
    
      // IMPORTANT: Use moment-timezone to preserve timezone info
      const now = moment(currentDate).tz(timezone);
    
      console.log('📱 Mobile calculateDueDateForFrequency', {
        frequency,
        currentDate: now.toISOString(),
        frequencyConfig,
        enabled: frequencyConfig?.enabled,
        workingDays,
        holidaysCount: holidays.length,
        timezone
      });
    
    if (frequencyConfig?.enabled) {
      // Use school's frequency configuration (match backend logic exactly)
      let dueDate = now.clone();
      
      switch (frequency) {
        case 'Daily':
          // Check if today is a working day (match backend logic, using moment methods)
          const dailyWorkingDays = frequencyConfig.workingDays || [1, 2, 3, 4, 5]; // Default to Mon-Fri
          const currentDayOfWeek = now.isoWeekday(); // Use isoWeekday (1=Monday, 7=Sunday) to match backend
          const isDailyWorkingDay = dailyWorkingDays.includes(currentDayOfWeek);
          
          if (!isDailyWorkingDay) {
            // If today is not a working day, find the next working day (using moment to preserve timezone)
            let nextWorkingDay = dueDate.clone();
            do {
              nextWorkingDay.add(1, 'day');
            } while (!dailyWorkingDays.includes(nextWorkingDay.isoWeekday()) || 
                     (frequencyConfig.skipHolidays && isHoliday(nextWorkingDay.toDate(), holidays)));
            dueDate = nextWorkingDay;
          }
          // If it's a working day, the report is due TODAY
          
          // Set the configured time
          const [dailyHours, dailyMinutes] = (frequencyConfig.dueTime || '17:00').split(':').map(Number);
          dueDate.hours(dailyHours).minutes(dailyMinutes).seconds(0).milliseconds(0);
          break;
          
        case 'Weekly':
          // Due on configured day of the week (match backend logic exactly, using moment methods)
          const targetDay = frequencyConfig.dueDay; // Backend uses 0=Sunday, 1=Monday, ..., 6=Saturday
          const currentDay = now.day(); // moment: .day() returns 0-6
          let daysToAdd = (targetDay - currentDay + 7) % 7;
          
          // If it's the target day today, check if we've passed the due time (like backend)
          if (daysToAdd === 0) {
            const dueTime = frequencyConfig.dueTime || '17:00';
            const [dueHours, dueMinutes] = dueTime.split(':').map(Number);
            const currentHours = now.hours(); // moment: .hours()
            const currentMinutes = now.minutes(); // moment: .minutes()
            
            // If current time is after due time, move to next week (match backend logic)
            if (currentHours > dueHours || (currentHours === dueHours && currentMinutes > dueMinutes)) {
              daysToAdd = 7;
            }
          }
          
          dueDate.add(daysToAdd, 'days'); // moment: .add(days, 'days')
          
          // Set the configured time
          const [weeklyHours, weeklyMinutes] = (frequencyConfig.dueTime || '17:00').split(':').map(Number);
          dueDate.hours(weeklyHours).minutes(weeklyMinutes).seconds(0).milliseconds(0);
          break;
          
        case 'Bi-Weekly':
          // Rule-based bi-weekly calculation (simplified for mobile, using moment methods)
          const biWeeklyRule = frequencyConfig.rule || 'alternateWeeks';
          const biWeeklyDueDay = frequencyConfig.dueDay || 5; // Friday
          
          if (biWeeklyRule === 'alternateWeeks') {
            const startOfYear = moment(now).startOf('year');
            const currentWeek = Math.floor(now.diff(startOfYear, 'days') / 7);
            const startWeek = frequencyConfig.startWeek || 1;
            const isTargetWeek = (currentWeek - startWeek) % 2 === 0;
            
            // Set to the configured day of the week
            const targetDayBiWeekly = biWeeklyDueDay; // Already 0-6
            const currentDayBiWeekly = now.day();
            let daysToAddBiWeekly = (targetDayBiWeekly - currentDayBiWeekly + 7) % 7;
            
            // Check if time has passed (simplified without helper)
            const hasTimePassed = daysToAddBiWeekly === 0 && now.hours() * 60 + now.minutes() > 
              (frequencyConfig.dueTime ? parseInt(frequencyConfig.dueTime.split(':')[0]) * 60 + parseInt(frequencyConfig.dueTime.split(':')[1]) : 17 * 60);
            
            if (!isTargetWeek || hasTimePassed) {
              daysToAddBiWeekly += 7; // Move to next occurrence
            }
            
            dueDate.add(daysToAddBiWeekly, 'days');
          } else {
            // Fallback for other bi-weekly rules - use next occurrence of due day
            const targetDayFallback = biWeeklyDueDay;
            const currentDayFallback = now.day();
            const daysToAddFallback = (targetDayFallback - currentDayFallback + 7) % 7;
            dueDate.add(daysToAddFallback || 14, 'days'); // If 0, add 2 weeks
          }
          
          // Set the configured time
          const [biWeeklyHours, biWeeklyMinutes] = (frequencyConfig.dueTime || '17:00').split(':').map(Number);
          dueDate.hours(biWeeklyHours).minutes(biWeeklyMinutes).seconds(0).milliseconds(0);
          break;
          
        case 'Monthly':
          // Rule-based monthly calculation (simplified for mobile, using moment methods)
          const monthlyRule = frequencyConfig.rule || 'lastWorkingDay';
          
          switch (monthlyRule) {
            case 'specificDate':
              const specificDay = frequencyConfig.specificDay || 28;
              dueDate = moment.tz([now.year(), now.month(), specificDay], timezone);
              
              // If day exceeds month length, use last day of month
              if (dueDate.month() !== now.month()) {
                dueDate = moment.tz([now.year(), now.month() + 1, 0], timezone);
              }
              
              // If date has passed, move to next month
              if (dueDate.isSameOrBefore(now)) {
                dueDate = moment.tz([now.year(), now.month() + 1, specificDay], timezone);
                if (dueDate.month() !== (now.month() + 1) % 12) {
                  dueDate = moment.tz([now.year(), now.month() + 2, 0], timezone);
                }
              }
              break;
              
            case 'lastDay':
              dueDate = moment.tz([now.year(), now.month() + 1, 0], timezone);
              if (dueDate.isSameOrBefore(now)) {
                dueDate = moment.tz([now.year(), now.month() + 2, 0], timezone);
              }
              break;
              
            case 'lastWorkingDay':
            default:
              dueDate = moment.tz([now.year(), now.month() + 1, 0], timezone);
              // Find the last working day of the month (simplified, using Date helpers)
              let tempDate = dueDate.toDate();
              while (isWeekend(tempDate, workingDays)) {
                tempDate.setDate(tempDate.getDate() - 1);
              }
              dueDate = moment.tz(tempDate, timezone);
              
              if (dueDate.isSameOrBefore(now)) {
                dueDate = moment.tz([now.year(), now.month() + 2, 0], timezone);
                tempDate = dueDate.toDate();
                while (isWeekend(tempDate, workingDays)) {
                  tempDate.setDate(tempDate.getDate() - 1);
                }
                dueDate = moment.tz(tempDate, timezone);
              }
              break;
          }
          
          // Set the configured time
          const [monthlyHours, monthlyMinutes] = (frequencyConfig.dueTime || '17:00').split(':').map(Number);
          dueDate.hours(monthlyHours).minutes(monthlyMinutes).seconds(0).milliseconds(0);
          break;
          
        case 'Bi-Monthly':
          // Bi-monthly calculation (simplified for mobile, using helpers with Date conversion)
          const biMonthlyRule = frequencyConfig.rule || 'lastWorkingDay';
          const startMonth = frequencyConfig.startMonth || 9; // September
          const currentMonth = now.month(); // 0-11
          const monthsSinceStart = (currentMonth - (startMonth - 1) + 12) % 12;
          const isTargetMonth = monthsSinceStart % 2 === 0;
          
          if (isTargetMonth) {
            // Use current month (convert to Date for helper, then back to moment)
            const tempDueDate = calculateMonthlyDueDate(now.toDate(), biMonthlyRule, frequencyConfig, workingDays);
            dueDate = moment.tz(tempDueDate, timezone);
          } else {
            // Move to next bi-monthly period
            const nextBiMonthlyMonth = now.month() + (2 - (monthsSinceStart % 2));
            const nextBiMonthlyDate = moment.tz([now.year(), nextBiMonthlyMonth, 1], timezone);
            const tempDueDate = calculateMonthlyDueDate(nextBiMonthlyDate.toDate(), biMonthlyRule, frequencyConfig, workingDays);
            dueDate = moment.tz(tempDueDate, timezone);
          }
          
          // Set the configured time
          const [biMonthlyHours, biMonthlyMinutes] = (frequencyConfig.dueTime || '17:00').split(':').map(Number);
          dueDate.hours(biMonthlyHours).minutes(biMonthlyMinutes).seconds(0).milliseconds(0);
          break;
          
        case 'Quarterly':
          // Quarterly calculation based on enabled quarters (using moment methods)
          const quarters = frequencyConfig.quarters || {
            q1: { enabled: true, month: 10, day: 30 }, // October 30
            q2: { enabled: true, month: 1, day: 15 },  // January 15
            q3: { enabled: true, month: 3, day: 30 },  // March 30
            q4: { enabled: true, month: 6, day: 10 }   // June 10
          };
          
          const currentQuarterMonth = now.month() + 1; // 1-based month
          let nextQuarterMoment = null;
          
          // Find the next enabled quarter
          const quarterOrder = ['q1', 'q2', 'q3', 'q4'];
          for (const quarterKey of quarterOrder) {
            const quarter = quarters[quarterKey];
            if (quarter && quarter.enabled) {
              const quarterMonth = quarter.month;
              const quarterDay = quarter.day;
              
              // Create date for this quarter in current year
              let quarterMoment = moment.tz([now.year(), quarterMonth - 1, quarterDay], timezone);
              
              // If this quarter has passed, try next year
              if (quarterMoment.isSameOrBefore(now)) {
                quarterMoment = moment.tz([now.year() + 1, quarterMonth - 1, quarterDay], timezone);
              }
              
              // If this is the first valid quarter or it's earlier than our current best
              if (!nextQuarterMoment || quarterMoment.isBefore(nextQuarterMoment)) {
                nextQuarterMoment = quarterMoment;
              }
            }
          }
          
          dueDate = nextQuarterMoment || moment.tz([now.year() + 1, 5, 10], timezone); // Fallback: June 10 next year
          dueDate.hours(17).minutes(0).seconds(0).milliseconds(0);
          break;
          
        case 'Annually':
          // Set to the configured month and day (format: MMDD, e.g., 615 = June 15th, using moment methods)
          const yearTargetDay = frequencyConfig.dueDay || 615;
          const yearTargetMonth = Math.floor(yearTargetDay / 100) - 1; // Convert to 0-based month index
          const yearTargetDate = yearTargetDay % 100;
          
          dueDate = moment.tz([now.year(), yearTargetMonth, yearTargetDate], timezone);
          
          // If the target date has passed this year, move to next year
          if (dueDate.isSameOrBefore(now)) {
            dueDate = moment.tz([now.year() + 1, yearTargetMonth, yearTargetDate], timezone);
          }
          
          // Set the configured time
          const [annuallyHours, annuallyMinutes] = (frequencyConfig.dueTime || '17:00').split(':').map(Number);
          dueDate.hours(annuallyHours).minutes(annuallyMinutes).seconds(0).milliseconds(0);
          break;
          
        default:
          // For unknown frequencies, use current date with configured time
          dueDate = now.clone();
          const [defaultHours, defaultMinutes] = (frequencyConfig.dueTime || '17:00').split(':').map(Number);
          dueDate.hours(defaultHours).minutes(defaultMinutes).seconds(0).milliseconds(0);
      }
      
      // Apply weekend/holiday adjustments if configured (convert to Date for helpers)
      let finalDueDate = dueDate.toDate();
      if (frequencyConfig.skipWeekends && isWeekend(finalDueDate, workingDays)) {
        finalDueDate = getNextWorkingDay(finalDueDate, workingDays, holidays);
        dueDate = moment.tz(finalDueDate, timezone);
      }
      
      if (frequencyConfig.skipHolidays && isHoliday(finalDueDate, holidays)) {
        finalDueDate = getNextWorkingDay(finalDueDate, workingDays, holidays);
        dueDate = moment.tz(finalDueDate, timezone);
      }
      
      // Convert moment back to Date for compatibility
      return dueDate.toDate();
    }
    
    // Fallback logic if frequency config is not enabled or missing (maintain backward compatibility)
    console.log('📱 Mobile: Using fallback logic for', frequency);
    // Convert moment to Date for fallback calculations
    const fallbackDate = now.toDate();
    
    switch (frequency) {
      case 'Daily':
        return new Date(fallbackDate.getFullYear(), fallbackDate.getMonth(), fallbackDate.getDate(), 17, 0, 0, 0);
      case 'Weekly':
        // Due by end of current week (Sunday) - fallback only
        const weekEnd = new Date(fallbackDate);
        weekEnd.setDate(fallbackDate.getDate() + (7 - fallbackDate.getDay()));
        weekEnd.setHours(23, 59, 59, 999);
        return weekEnd;
      case 'Bi-Weekly':
        // Due by end of current 2-week period
        const biWeekEnd = new Date(fallbackDate);
        biWeekEnd.setDate(fallbackDate.getDate() + (14 - (fallbackDate.getDay() + 7)));
        biWeekEnd.setHours(23, 59, 59, 999);
        return biWeekEnd;
      case 'Monthly':
        // Due by end of current month
        const monthEnd = new Date(fallbackDate.getFullYear(), fallbackDate.getMonth() + 1, 0);
        monthEnd.setHours(23, 59, 59, 999);
        return monthEnd;
      case 'Bi-Monthly':
        // Due by end of current 2-month period
        const biMonthEnd = new Date(fallbackDate.getFullYear(), Math.floor(fallbackDate.getMonth() / 2) * 2 + 2, 0);
        biMonthEnd.setHours(23, 59, 59, 999);
        return biMonthEnd;
      case 'Quarterly':
        // Due by end of current quarter
        const quarterEnd = new Date(fallbackDate.getFullYear(), Math.floor(fallbackDate.getMonth() / 3) * 3 + 3, 0);
        quarterEnd.setHours(23, 59, 59, 999);
        return quarterEnd;
      case 'Annually':
        // Due by end of current year
        const yearEnd = new Date(fallbackDate.getFullYear(), 11, 31);
        yearEnd.setHours(23, 59, 59, 999);
        return yearEnd;
      default:
        return fallbackDate;
    }
    } catch (error) {
      console.error('📱 Error in calculateDueDateForFrequency:', error);
      // Return fallback calculation on error
      return getFallbackDueDate(frequency, currentDate);
    }
  };

  const calculateDueReports = async (studentsData: Student[], reportsData: StudentReport[]) => {
    try {
      const dueReportsArray: DueReport[] = [];
      
      // Safety checks
      if (!studentsData || !Array.isArray(studentsData)) {
        console.log('📱 No valid students data for due reports calculation');
        return [];
      }
      
      if (!reportTemplates || !Array.isArray(reportTemplates)) {
        console.log('📱 No report templates available for due reports calculation');
        return [];
      }
      
      addDebugLog('📱 Starting backend API due status calculations...');
      addDebugLog(`📱 Students count: ${studentsData.length}`);
      addDebugLog(`📱 Templates count: ${reportTemplates.length}`);
      addDebugLog(`📱 Current user: ${user?.firstName} ${user?.lastName} (ID: ${user?.id})`);
      addDebugLog(`📱 School data available: ${schoolData ? 'Yes' : 'No'}`);
      
      // Use backend API to check due status for each student-template combination
      for (const student of studentsData) {
        const studentGrade = student.studentGrade || student.grade || '';
        const gradeTemplates = reportTemplates.filter(template => 
          template.grade.toLowerCase() === studentGrade.toLowerCase() && template.isActive
        );
        
        addDebugLog(`📱 Student ${getStudentFullName(student)} (${studentGrade}): ${gradeTemplates.length} matching templates`);
        
        for (const template of gradeTemplates) {
          try {
            addDebugLog(`📱 Checking due status for ${getStudentFullName(student)} - ${template.name} (${template.reportFrequency})`);
            // Use backend API for accurate due status calculation
            const dueStatusResponse = await apiService.checkDueStatus(student._id, template._id);
            addDebugLog(`📱 Due status response for ${getStudentFullName(student)} - ${template.name}: ${JSON.stringify(dueStatusResponse)}`);
            
            if (dueStatusResponse.success && dueStatusResponse.data) {
              const { due, hasExistingReportInPeriod, existingReportInPeriod, nextDueDate } = dueStatusResponse.data;
              
              addDebugLog(`📱 ${getStudentFullName(student)} - ${template.name}: due=${due}, hasExisting=${hasExistingReportInPeriod}, nextDue=${nextDueDate}`);
              
              // Check if report was generated by another teacher
              if (hasExistingReportInPeriod && existingReportInPeriod) {
                const currentTeacherId = user?.id;
                const reportTeacherId = existingReportInPeriod.teacherName;
                const currentTeacherName = `${user?.firstName || ''} ${user?.lastName || ''}`.trim();
                
                addDebugLog(`📱 ${getStudentFullName(student)} - ${template.name}: Existing report by ${reportTeacherId}, current teacher: ${currentTeacherName}`);
                
                if (reportTeacherId && reportTeacherId !== currentTeacherName) {
                  addDebugLog(`📱 ${getStudentFullName(student)} - ${template.name}: Report exists by another teacher (${reportTeacherId})`);
                  continue; // Skip - not due for current teacher
                }
              }
              
              if (due) {
                // Calculate days overdue
                const dueDate = nextDueDate ? new Date(nextDueDate) : new Date();
                const now = new Date();
                const daysOverdue = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
                
                // Determine report status
                let reportStatus: 'draft' | 'completed' | 'sent' | 'missing' = 'missing';
                if (hasExistingReportInPeriod && existingReportInPeriod) {
                  if (existingReportInPeriod.status === 'draft') {
                    reportStatus = 'draft';
                  } else if (existingReportInPeriod.status === 'completed' || existingReportInPeriod.status === 'review') {
                    reportStatus = 'completed';
                  } else if (existingReportInPeriod.status === 'sent' || existingReportInPeriod.status === 'approved') {
                    continue; // Skip sent/approved reports
                  }
                }
                
                dueReportsArray.push({
                  studentId: student._id,
                  studentName: getStudentFullName(student),
                  templateName: template.name,
                  frequency: template.reportFrequency,
                  dueDate: dueDate.toISOString(),
                  daysOverdue: Math.max(0, daysOverdue),
                  templateId: template._id,
                  reportStatus: reportStatus,
                  reportId: existingReportInPeriod?.reportId || null
                });
                
                addDebugLog(`⚠️ ${getStudentFullName(student)} - ${template.name}: Due (${Math.max(0, daysOverdue)} days overdue) - Status: ${reportStatus}`);
              } else {
                addDebugLog(`✅ ${getStudentFullName(student)} - ${template.name}: Not due yet`);
              }
            } else {
              addDebugLog(`❌ ${getStudentFullName(student)} - ${template.name}: API call failed: ${JSON.stringify(dueStatusResponse)}`);
            }
          } catch (error) {
            addDebugLog(`📱 Error checking due status for ${getStudentFullName(student)} - ${template.name}: ${error}`);
            addDebugLog(`📱 Error details: ${JSON.stringify(error)}`);
            // Continue with next template on error
          }
        }
      }
    
      // Sort by most overdue first
      dueReportsArray.sort((a, b) => b.daysOverdue - a.daysOverdue);
      setDueReports(dueReportsArray);
      addDebugLog(`📱 Final due reports count: ${dueReportsArray.length}`);
      
      if (dueReportsArray.length > 0) {
        addDebugLog(`📱 Due reports details: ${dueReportsArray.map(d => `${d.studentName} - ${d.templateName} (${d.frequency})`).join(', ')}`);
      } else {
        addDebugLog(`📱 No due reports found - all students are up to date!`);
      }
      
      return dueReportsArray;
    } catch (error) {
      addDebugLog(`📱 Error calculating due reports: ${error}`);
      setDueReports([]);
      return [];
    }
  };

  const getStudentReports = (studentId: string) => {
    return reports.filter(r => r.studentId === studentId);
  };

  const getStudentStatus = (student: Student) => {
    const studentReports = getStudentReports(student._id);
    const completedReports = studentReports.filter(r => r.status === 'completed');
    
    if (completedReports.length === 0) return null;
    if (completedReports.length < 3) return { status: 'In Progress', color: '#ff9800' };
    return { status: 'Active', color: '#4caf50' };
  };

  const getStudentDueReports = (studentId: string) => {
    return dueReports.filter(dr => dr.studentId === studentId);
  };

  const getStudentFullName = (student: Student) => {
    if (student.firstName && student.lastName) {
      return `${student.firstName} ${student.lastName}`;
    } else if (student.firstName) {
      return student.firstName;
    } else if (student.lastName) {
      return student.lastName;
    } else if (student.name) {
      return student.name;
    }
    return 'Unknown Student';
  };

  // Helper function to get current time in school timezone
  // FIXED: Use moment-timezone to preserve timezone info (see TIMEZONE_BUG_FIX.md)
  const getCurrentTimeInSchoolTimezone = (): Date => {
    const schoolSettings = schoolData?.settings || {};
    const timezone = schoolSettings.timezone || 'UTC';
    
    // IMPORTANT: Keep as moment object to preserve timezone info
    // Converting to Date too early causes timezone issues
    const schoolTime = moment().tz(timezone);
    
    // Return a Date - we'll handle timezone properly in calculations
    return schoolTime.toDate();
  };

  // Helper function to format date in school timezone
  const formatDateInSchoolTimezone = (date: Date): string => {
    const schoolSettings = schoolData?.settings || {};
    const timezone = schoolSettings.timezone || 'UTC';
    
    return date.toLocaleDateString("en-US", {timeZone: timezone});
  };

  // Helper function to convert date to school timezone
  // FIXED: Use moment-timezone to preserve timezone info (see TIMEZONE_BUG_FIX.md)
  const convertToSchoolTimezone = (date: Date, timezone: string): Date => {
    return moment(date).tz(timezone).toDate();
  };

  // Get templates that don't have existing reports for current period
  const getAvailableTemplatesForStudent = (student: Student) => {
    if (!student || !reportTemplates.length) return [];
    
    const studentGrade = student.studentGrade || student.grade || '';
    const gradeTemplates = reportTemplates.filter(template => 
      template.grade.toLowerCase() === studentGrade.toLowerCase() && template.isActive
    );
    
    // Get existing reports for current period
    const existingReports = getExistingReportInfo(student) || [];
    const existingFrequencies = existingReports.map(r => r.frequency);
    
    // Filter out templates that already have reports
    return gradeTemplates.filter(template => 
      !existingFrequencies.includes(template.reportFrequency)
    );
  };

  // Get templates that are actually due (not just available) for current period
  const getDueTemplatesForStudent = (student: Student) => {
    if (!student || !reportTemplates.length) return [];
    
    // From the due reports calculated by backend API, find which templates are due for this student
    const studentDueReports = getStudentDueReports(student._id);
    const dueTemplateIds = studentDueReports.map(dr => dr.templateId);
    
    return reportTemplates.filter(template => 
      dueTemplateIds.includes(template._id)
    );
  };

  // Check if a specific template is due for a student
  const isTemplateDueForStudent = (student: Student, template: ReportTemplate): boolean => {
    if (!student || !template) return false;
    
    const studentDueReports = getStudentDueReports(student._id);
    return studentDueReports.some(dr => dr.templateId === template._id);
  };

  // Get information about existing reports for current period
  const getExistingReportInfo = (student: Student) => {
    if (!student || !reportTemplates.length) return null;
    
    // Get ALL reports for this student (not just current teacher's reports)
    const allStudentReports = reports.filter(r => r.studentId === student._id);
    
    const studentGrade = student.studentGrade || student.grade || '';
    const gradeTemplates = reportTemplates.filter(template => 
      template.grade.toLowerCase() === studentGrade.toLowerCase() && template.isActive
    );
    
    // Find existing reports for current period
    const existingReports = [];
    for (const template of gradeTemplates) {
      const currentPeriodReport = getReportForCurrentPeriod(allStudentReports, template.reportFrequency, new Date());
      if (currentPeriodReport) {
        // Get teacher name (simplified for mobile)
        const teacherName = 'Teacher'; // Could be enhanced to get actual teacher name
        existingReports.push({
          template: template.name,
          frequency: template.reportFrequency,
          teacher: teacherName,
          status: currentPeriodReport.status,
          createdAt: currentPeriodReport.createdAt
        });
      }
    }
    
    return existingReports.length > 0 ? existingReports : null;
  };

  const filteredStudents = students.filter(student =>
    student && 
    (getStudentFullName(student).toLowerCase().includes(searchTerm.toLowerCase()) ||
    (student.grade?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (student.studentClass?.toLowerCase() || '').includes(searchTerm.toLowerCase()))
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadStudents();
    setRefreshing(false);
  };

  // Media upload handlers
  const handleMediaUploaded = (media: any[]) => {
    setUploadedMedia(prev => [...prev, ...media]);
  };

  const handleMediaDeleted = (mediaId: string) => {
    setUploadedMedia(prev => prev.filter(m => m.id !== mediaId));
  };

  // Report Management Functions
  const saveReportAsDraft = async () => {
    if (!selectedStudent || !selectedTemplate) {
      Alert.alert('Error', 'Please select a student and template first');
      return;
    }

    if (!reportContent.trim() && recordings.length === 0) {
      Alert.alert('Error', 'Please add some content (voice recording or text) before saving');
      return;
    }

    setIsSavingDraft(true);
    
    try {
      console.log('📱 Saving report draft...');
      
      const studentId = selectedStudent._id || selectedStudent.id;
      const templateId = selectedTemplate._id;
      
      if (!studentId) {
        throw new Error('Student ID is missing');
      }
      
      if (!templateId) {
        throw new Error('Template ID is missing');
      }

      // Upload audio files first if there are recordings
      let uploadedRecordings = [];
      if (recordings.length > 0) {
        console.log('📱 Uploading audio files...');
        
        for (const recording of recordings) {
          try {
            const formData = new FormData();
            
            // Create file object for React Native
            const file = {
              uri: recording.uri,
              type: 'audio/m4a',
              name: `recording_${Date.now()}.m4a`,
            } as any;
            
            formData.append('audio', file);
            formData.append('studentName', getStudentFullName(selectedStudent));
            
            const uploadResponse = await apiService.uploadAudioFile(formData);
            
            if (uploadResponse.success && uploadResponse.data) {
              uploadedRecordings.push({
                url: uploadResponse.data.url, // This will be the server URL
                duration: recording.duration,
                transcription: recording.transcription || ''
              });
              console.log('📱 Audio uploaded successfully:', uploadResponse.data.url);
            } else {
              throw new Error(uploadResponse.error || 'Failed to upload audio file');
            }
          } catch (uploadError) {
            console.error('📱 Error uploading audio file:', uploadError);
            throw new Error(`Failed to upload audio file: ${uploadError}`);
          }
        }
      }

      const reportData: CreateReportData = {
        title: `${selectedTemplate.name} - ${getStudentFullName(selectedStudent)} (Draft)`,
        studentId: studentId,
        templateId: templateId,
        content: reportContent || 'Draft report - content to be completed',
        customFieldValues: {},
        reportType: 'progress',
        reportPeriod: {
          startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          endDate: new Date()
        },
        voiceRecording: uploadedRecordings.length > 0 ? {
          hasRecording: true,
          recordings: uploadedRecordings,
          recordingUrl: uploadedRecordings[0].url,
          recordingDuration: uploadedRecordings.reduce((total, r) => total + r.duration, 0),
          transcription: transcription,
          isTranscribed: !!transcription
        } : { hasRecording: false, isTranscribed: false },
        aiGenerated: transcription ? {
          isAiGenerated: true,
          originalTranscription: transcription,
          generationModel: 'barrana-ai-v1'
        } : { isAiGenerated: false },
        // Include uploaded media attachments
        attachments: uploadedMedia.map(media => ({
          filename: media.filename,
          originalName: media.originalName,
          mimeType: media.mimeType,
          size: media.size,
          url: media.url,
          uploadedAt: media.uploadedAt || new Date().toISOString(),
          isTemporary: media.isTemporary || false
        }))
      };

      const createResponse = await apiService.createReport(reportData);
      
      if (createResponse.success) {
        // Set the current report ID for media uploads
        setCurrentReportId(createResponse.data._id);
        Alert.alert('Success', 'Report draft saved successfully!');
        // Don't close the dialog, let teacher continue working
      } else {
        throw new Error(createResponse.message || createResponse.error || 'Failed to save report draft');
      }
    } catch (error) {
      console.error('Error saving report draft:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to save report draft. Please try again.';
      Alert.alert('Error', errorMessage);
    } finally {
      setIsSavingDraft(false);
    }
  };

  const sendReportToParents = async () => {
    if (!selectedStudent || !selectedTemplate || !reportContent.trim()) {
      Alert.alert('Error', 'Please complete the report first');
      return;
    }

    setIsSending(true);
    
    try {
      console.log('📱 Sending report to parents...');
      
      // Upload audio files first if there are recordings
      let uploadedRecordings = [];
      if (recordings.length > 0) {
        console.log('📱 Uploading audio files for final report...');
        
        for (const recording of recordings) {
          try {
            const formData = new FormData();
            
            // Create file object for React Native
            const file = {
              uri: recording.uri,
              type: 'audio/m4a',
              name: `recording_${Date.now()}.m4a`,
            } as any;
            
            formData.append('audio', file);
            formData.append('studentName', getStudentFullName(selectedStudent));
            
            const uploadResponse = await apiService.uploadAudioFile(formData);
            
            if (uploadResponse.success && uploadResponse.data) {
              uploadedRecordings.push({
                url: uploadResponse.data.url, // This will be the server URL
                duration: recording.duration,
                transcription: recording.transcription || ''
              });
              console.log('📱 Audio uploaded successfully:', uploadResponse.data.url);
            } else {
              throw new Error(uploadResponse.error || 'Failed to upload audio file');
            }
          } catch (uploadError) {
            console.error('📱 Error uploading audio file:', uploadError);
            throw new Error(`Failed to upload audio file: ${uploadError}`);
          }
        }
      }
      
      const reportData: CreateReportData = {
        title: `${selectedTemplate.name} - ${getStudentFullName(selectedStudent)}`,
        studentId: selectedStudent._id || selectedStudent.id || '',
        templateId: selectedTemplate?._id || '',
        content: reportContent,
        customFieldValues: {},
        reportType: 'progress',
        reportPeriod: {
          startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          endDate: new Date()
        },
        voiceRecording: uploadedRecordings.length > 0 ? {
          hasRecording: true,
          recordings: uploadedRecordings,
          recordingUrl: uploadedRecordings[0].url,
          recordingDuration: uploadedRecordings.reduce((total, r) => total + r.duration, 0),
          transcription: transcription,
          isTranscribed: !!transcription
        } : { hasRecording: false, isTranscribed: false },
        aiGenerated: transcription ? {
          isAiGenerated: true,
          originalTranscription: transcription,
          generationModel: 'barrana-ai-v1'
        } : { isAiGenerated: false },
        // Include uploaded media attachments
        attachments: uploadedMedia.map(media => ({
          filename: media.filename,
          originalName: media.originalName,
          mimeType: media.mimeType,
          size: media.size,
          url: media.url,
          uploadedAt: media.uploadedAt || new Date().toISOString(),
          isTemporary: media.isTemporary || false
        }))
      };

      const createResponse = await apiService.createReport(reportData);
      
      if (createResponse.success && createResponse.data) {
        await apiService.approveReport(createResponse.data._id, 'Auto-approved by teacher');
        const sendResponse = await apiService.sendReportToParents(
          createResponse.data._id, 
          [selectedStudent.parentEmail || 'parent@example.com']
        );
        
        if (sendResponse.success) {
          Alert.alert('Success', 'Report sent to parents successfully!');
          handleCloseReportDialog();
        } else {
          throw new Error(sendResponse.message || 'Failed to send report');
        }
      } else {
        throw new Error(createResponse.message || 'Failed to create report');
      }
    } catch (error) {
      console.error('Error sending report:', error);
      Alert.alert('Error', 'Failed to send report. Please try again.');
    } finally {
      setIsSending(false);
    }
  };

  const handleCloseReportDialog = () => {
    setShowReportDialog(false);
    setSelectedStudent(null);
    setSelectedTemplate(null);
    setReportContent('');
    setRecordings([]);
    setTranscription('');
    setRecordingTime(0);
    setIsRecording(false);
    setUploadedMedia([]);
    setCurrentReportId('');
    setTempReportId('');
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const formatLastReportDate = (dateString: string) => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    return `${Math.floor(diffDays / 365)} years ago`;
  };

  // Check if student has a report for current period (any status)
  const hasCurrentPeriodReport = (student: Student) => {
    if (!student || !reportTemplates.length) return false;
    
    const studentReports = reports.filter(r => r.studentId === student._id);
    const studentGrade = student.studentGrade || student.grade || '';
    const gradeTemplates = reportTemplates.filter(template => 
      template.grade.toLowerCase() === studentGrade.toLowerCase() && template.isActive
    );
    
    // Check if any template has a report for current period (any status)
    return gradeTemplates.some(template => {
      const currentPeriodReport = getReportForCurrentPeriod(studentReports, template.reportFrequency, new Date());
      return !!currentPeriodReport; // Return true if any report exists for current period
    });
  };

  const handleGenerateReport = (student: Student) => {
    console.log('📱 Generate Report button clicked for student:', getStudentFullName(student));
    
    // Check if ALL possible reports exist for current period 
    const existingReports = getExistingReportInfo(student);
    const studentGrade = student.studentGrade || student.grade || '';
    const availableTemplates = reportTemplates.filter(template => 
      template.grade.toLowerCase() === studentGrade.toLowerCase() && template.isActive
    );
    const dueTemplates = getDueTemplatesForStudent(student);
    
    // Only block if ALL templates have existing reports
    if (existingReports && existingReports.length === availableTemplates.length) {
      const reportDetails = existingReports.map(r => 
        `${r.template} (${r.frequency}) - ${r.status}`
      ).join(', ');
      
      Alert.alert(
        'All Reports Complete',
        `Cannot generate new report. All reports already exist for current period: ${reportDetails}`
      );
      return;
    }
    
    // Show different messages based on what's available
    let message = '';
    if (dueTemplates.length === 0 && availableTemplates.length > 0) {
      message = `${availableTemplates.length} template(s) available for Grade ${studentGrade}, but none are due yet. You can still generate reports manually if needed.`;
    } else if (existingReports && existingReports.length > 0) {
      const reportDetails = existingReports.map(r => `${r.template} (${r.frequency})`).join(', ');
      const dueCount = dueTemplates.length;
      if (dueCount > 0) {
        message = `${dueCount} report(s) due now. Note: Some reports already exist: ${reportDetails}.`;
      } else {
        message = `Some reports already exist: ${reportDetails}. No reports are due yet.`;
      }
    } else if (dueTemplates.length > 0) {
      message = `${dueTemplates.length} report(s) are due now for ${getStudentFullName(student)}.`;
    }
    
    if (message) {
      console.log('📱 Report generation message:', message);
    }
    
    setSelectedStudent(student);
    autoSelectTemplateForStudent(student);
    // Generate a temporary report ID for media uploads
    const tempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    setTempReportId(tempId);
    setShowReportDialog(true);
  };

  useEffect(() => {
    const initializeData = async () => {
      try {
        await Promise.all([
          loadStudents(),
          loadReportTemplates(),
          loadSchoolData()
        ]);
      } catch (error) {
        console.error('📱 Error initializing student screen data:', error);
        Alert.alert('Error', 'Failed to load application data. Please try again.');
      }
    };
    
    initializeData();
  }, []);

  // Recalculate due reports when templates are loaded
  useEffect(() => {
    if (reportTemplates.length > 0 && students.length > 0 && reports.length > 0) {
      addDebugLog('📱 Templates loaded, recalculating due reports with backend API...');
      const calculateAsync = async () => {
        try {
          await calculateDueReports(students, reports);
        } catch (error) {
          addDebugLog(`📱 Error calculating due reports: ${error}`);
        }
      };
      calculateAsync();
    }
  }, [reportTemplates.length, students.length, reports.length]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#667eea" />
        <Text style={styles.loadingText}>Loading students...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Students</Text>
        <TouchableOpacity 
          onPress={() => setShowDebugPanel(true)} 
          style={styles.debugButton}
        >
          <Ionicons name="bug" size={24} color="#667eea" />
          {debugLogs.length > 0 && (
            <View style={styles.debugBadge}>
              <Text style={styles.debugBadgeText}>{debugLogs.length}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView 
        style={styles.scrollView}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh}
            colors={[useBranding().branding?.branding?.primaryColor || '#667eea']}
            tintColor={useBranding().branding?.branding?.primaryColor || '#667eea'}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Search Field */}
        <View style={styles.searchContainer}>
          <View style={styles.searchInputContainer}>
            <Ionicons name="search" size={20} color="#999" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search students by name..."
              placeholderTextColor="#999"
              value={searchTerm}
              onChangeText={setSearchTerm}
            />
            {searchTerm.length > 0 && (
              <TouchableOpacity 
                style={styles.clearButton}
                onPress={() => setSearchTerm('')}
              >
                <Ionicons name="close-circle" size={20} color="#999" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Students Count */}
        <View style={styles.countSection}>
          <Text style={styles.countText}>
            {filteredStudents.length} {filteredStudents.length === 1 ? 'Student' : 'Students'}
          </Text>
        </View>

        {/* Students List */}
        <View style={styles.studentsSection}>
          {filteredStudents.map((student) => {
            const studentReports = getStudentReports(student._id);
            const studentStatus = getStudentStatus(student);
            const studentDueReports = getStudentDueReports(student._id);
            
            return (
              <TouchableOpacity key={student._id} style={styles.studentCard}>
                <View style={styles.cardHeader}>
                  <View style={styles.studentAvatar}>
                    <Text style={styles.avatarText}>
                      {getStudentFullName(student).split(' ').map(n => n[0]).join('').toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.studentInfo}>
                    <Text style={styles.studentName}>
                      {getStudentFullName(student)}
                    </Text>
                    {student.parentName && (
                      <Text style={styles.parentName}>
                        {student.parentName}
                      </Text>
                    )}
                  </View>
                  <View style={styles.statusContainer}>
                    {studentStatus && (
                      <View style={[
                        styles.statusBadge, 
                        { backgroundColor: studentStatus.color }
                      ]}>
                        <Text style={styles.statusText}>{studentStatus.status}</Text>
                      </View>
                    )}
                    {/* Enhanced Due Reports Display - matching web app */}
                    {studentDueReports.length > 0 ? (
                      <View style={styles.dueReportsContainer}>
                        <Text style={styles.dueReportsLabel}>
                          {studentDueReports.length} Due Report{studentDueReports.length > 1 ? 's' : ''}
                        </Text>
                        <View style={styles.dueChipsWrapper}>
                          {studentDueReports.map((dueReport, index) => {
                            let chipColor = '#f44336'; // Default red for missing
                            let iconName = 'warning';
                            let chipLabel = dueReport.frequency;
                            let chipBorderStyle = {};
                            
                            if (dueReport.reportStatus === 'draft') {
                              chipColor = '#ff9800'; // Orange for draft
                              iconName = 'create';
                              chipLabel = `${dueReport.frequency} (Draft)`;
                              chipBorderStyle = { borderWidth: 1, borderColor: '#ff9800', backgroundColor: '#fff3e0' };
                            } else if (dueReport.reportStatus === 'completed') {
                              chipColor = '#2196f3'; // Blue for completed
                              iconName = 'checkmark-circle';
                              chipLabel = `${dueReport.frequency} (Ready)`;
                              chipBorderStyle = { borderWidth: 1, borderColor: '#2196f3', backgroundColor: '#e3f2fd' };
                            } else {
                              chipColor = '#f44336'; // Red for missing
                              iconName = 'warning';
                              chipLabel = `${dueReport.frequency} (${dueReport.daysOverdue}d)`;
                              chipBorderStyle = { backgroundColor: chipColor };
                            }
                            
                            return (
                              <View key={dueReport.templateId} style={[styles.enhancedDueChip, chipBorderStyle]}>
                                <Ionicons 
                                  name={iconName as any} 
                                  size={10} 
                                  color={dueReport.reportStatus === 'draft' || dueReport.reportStatus === 'completed' ? chipColor : 'white'} 
                                />
                                <Text style={[
                                  styles.enhancedDueChipText,
                                  { color: dueReport.reportStatus === 'draft' || dueReport.reportStatus === 'completed' ? chipColor : 'white' }
                                ]}>
                                  {chipLabel}
                                </Text>
                              </View>
                            );
                          })}
                        </View>
                      </View>
                    ) : (
                      <View style={styles.upToDateContainer}>
                        <View style={styles.upToDateChip}>
                          <Ionicons name="checkmark-circle" size={10} color="#4caf50" />
                          <Text style={styles.upToDateText}>Up to date</Text>
                        </View>
                        <Text style={styles.noReportsDueText}>No reports due</Text>
                      </View>
                    )}
                  </View>
                </View>
                
                <View style={styles.cardBody}>
                  <View style={styles.chipsContainer}>
                    <View style={styles.chip}>
                      <Ionicons name="school" size={12} color="#667eea" />
                      <Text style={styles.chipText}>
                        Grade {student.studentGrade || student.grade || 'Unknown'}
                      </Text>
                    </View>
                    <View style={styles.chip}>
                      <Ionicons name="people" size={12} color="#667eea" />
                      <Text style={styles.chipText}>
                        {student.studentClass || 'Not assigned'}
                      </Text>
                    </View>
                  </View>
                  
                  {/* Last Report Date */}
                  {studentReports.length > 0 && (
                    <View style={styles.lastReportContainer}>
                      <Ionicons name="calendar" size={12} color="#999" />
                      <Text style={styles.lastReportText}>
                        Last report: {formatLastReportDate(studentReports.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]?.createdAt)}
                      </Text>
                    </View>
                  )}
                </View>
                
                <View style={styles.cardActions}>
                  {/* Enhanced Generate Report Button - matching web app */}
                  <TouchableOpacity 
                    style={[
                      styles.enhancedGenerateButton,
                      (() => {
                        const availableTemplates = getAvailableTemplatesForStudent(student);
                        const dueTemplates = getDueTemplatesForStudent(student);
                        const hasCurrentReport = hasCurrentPeriodReport(student);
                        
                        if (availableTemplates.length === 0 || hasCurrentReport) {
                          return styles.generateButtonComplete; // Gray for completed
                        }
                        
                        if (dueTemplates.length === 0) {
                          return styles.generateButtonManual; // Orange for manual
                        }
                        
                        return styles.generateButtonDue; // Gradient purple for due
                      })()
                    ]}
                    onPress={() => handleGenerateReport(student)}
                    disabled={getAvailableTemplatesForStudent(student).length === 0 || hasCurrentPeriodReport(student)}
                  >
                    <View style={styles.buttonIconContainer}>
                      <Ionicons 
                        name={(() => {
                          const availableTemplates = getAvailableTemplatesForStudent(student);
                          const dueTemplates = getDueTemplatesForStudent(student);
                          const hasCurrentReport = hasCurrentPeriodReport(student);
                          
                          if (availableTemplates.length === 0 || hasCurrentReport) {
                            return "checkmark-circle";
                          }
                          
                          if (dueTemplates.length === 0) {
                            return "create";
                          }
                          
                          return "analytics";
                        })()} 
                        size={18} 
                        color="white" 
                      />
                    </View>
                    <View style={styles.buttonTextContainer}>
                      <Text style={styles.enhancedGenerateButtonText}>
                        {(() => {
                          const availableTemplates = getAvailableTemplatesForStudent(student);
                          const dueTemplates = getDueTemplatesForStudent(student);
                          const hasCurrentReport = hasCurrentPeriodReport(student);
                          const existingReports = getExistingReportInfo(student);
                          
                          if (hasCurrentReport && existingReports && existingReports.length > 0) {
                            const firstReport = existingReports[0];
                            return `Report Exists (${firstReport.teacher.split(' ')[0]})`;
                          }
                          
                          if (availableTemplates.length === 0) {
                            return 'All Reports Complete';
                          }
                          
                          if (dueTemplates.length === 0) {
                            return 'Generate Report (Manual)';
                          }
                          
                          return `Generate Report (${dueTemplates.length} Due)`;
                        })()}
                      </Text>
                      <Text style={styles.buttonSubtext}>
                        {(() => {
                          const availableTemplates = getAvailableTemplatesForStudent(student);
                          const dueTemplates = getDueTemplatesForStudent(student);
                          const hasCurrentReport = hasCurrentPeriodReport(student);
                          
                          if (hasCurrentReport) {
                            return 'Current period covered';
                          }
                          
                          if (availableTemplates.length === 0) {
                            return 'Period requirements met';
                          }
                          
                          if (dueTemplates.length === 0) {
                            return `${availableTemplates.length} available templates`;
                          }
                          
                          return 'Reports need attention';
                        })()}
                      </Text>
                    </View>
                  </TouchableOpacity>
                  
                  {/* View Details Button */}
                  <TouchableOpacity style={styles.enhancedViewDetailsButton}>
                    <Ionicons name="chevron-forward" size={20} color="#667eea" />
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {filteredStudents.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={64} color="#ccc" />
            <Text style={styles.emptyStateTitle}>
              {students.length === 0 ? 'No Students Assigned' : 'No Students Found'}
            </Text>
            <Text style={styles.emptyStateText}>
              {students.length === 0 
                ? 'Students will be assigned to you by the school admin.'
                : 'Try adjusting your search criteria.'
              }
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Report Generation Modal */}
      <Modal
        visible={showReportDialog}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={handleCloseReportDialog}
      >
        <KeyboardAvoidingView 
          style={styles.modalContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          {/* Modal Header */}
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={handleCloseReportDialog} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Generate Report</Text>
            <View style={styles.headerRight} />
          </View>

          {selectedStudent && (
            <ScrollView style={styles.modalScrollView} showsVerticalScrollIndicator={false}>
              {/* Student Info */}
              <View style={styles.studentInfoSection}>
                <View style={styles.studentAvatar}>
                  <Text style={styles.avatarText}>
                    {getStudentFullName(selectedStudent).split(' ').map(n => n[0]).join('').toUpperCase()}
                  </Text>
                </View>
                <View style={styles.studentInfoText}>
                  <Text style={styles.modalStudentName}>
                    {getStudentFullName(selectedStudent)}
                  </Text>
                  <Text style={styles.modalStudentDetails}>
                    Grade {selectedStudent.studentGrade || selectedStudent.grade} • {selectedTemplate?.name || 'No template found'}
                  </Text>
                </View>
              </View>

              {/* Template Selection */}
              <View style={styles.sectionContainer}>
                <Text style={styles.sectionTitle}>
                  📋 Select Report Template
                </Text>
                <Text style={styles.sectionDescription}>
                  Choose the appropriate report template for this student. Different templates have different frequencies and focus areas.
                </Text>
                
                <View style={styles.templateSelector}>
                  <Picker
                    selectedValue={selectedTemplate?._id || ''}
                    onValueChange={(itemValue: string) => {
                      const template = reportTemplates.find(t => t._id === itemValue);
                      if (template) {
                        const isDue = isTemplateDueForStudent(selectedStudent, template);
                        if (!isDue) {
                          Alert.alert(
                            'Report Not Due', 
                            `${template.name} (${template.reportFrequency}) is not due yet. Only due reports can be generated according to your school's frequency settings.`,
                            [
                              { text: 'Cancel', style: 'cancel' },
                              { 
                                text: 'Generate Anyway', 
                                style: 'destructive',
                                onPress: () => {
                                  setSelectedTemplate(template);
                                  console.log('📱 Template selected (manual override):', template.name);
                                }
                              }
                            ]
                          );
                          return;
                        }
                        setSelectedTemplate(template);
                        console.log('📱 Due template selected:', template.name);
                      }
                    }}
                    style={styles.picker}
                  >
                    <Picker.Item label="Select a template..." value="" />
                    {getAvailableTemplatesForStudent(selectedStudent)
                      .map((template) => {
                        const isDue = isTemplateDueForStudent(selectedStudent, template);
                        const label = `${template.name} (${template.reportFrequency})${isDue ? ' - DUE' : ' - NOT DUE'}`;
                        return (
                          <Picker.Item 
                            key={template._id} 
                            label={label} 
                            value={template._id}
                            // Note: React Native Picker doesn't support enabled/disabled per item
                            // So we handle this in the onValueChange callback above
                          />
                        );
                      })}
                  </Picker>
                </View>

                {selectedTemplate && (
                  <View style={[
                    styles.selectedTemplateInfo,
                    isTemplateDueForStudent(selectedStudent, selectedTemplate) 
                      ? styles.selectedTemplateDue 
                      : styles.selectedTemplateNotDue
                  ]}>
                    <Text style={styles.selectedTemplateTitle}>
                      Selected: {selectedTemplate.name} {isTemplateDueForStudent(selectedStudent, selectedTemplate) ? '✅ DUE' : '⚠️ NOT DUE'}
                    </Text>
                    <Text style={styles.selectedTemplateDetails}>
                      Frequency: {selectedTemplate.reportFrequency} • Grade: {selectedTemplate.grade}
                      {!isTemplateDueForStudent(selectedStudent, selectedTemplate) && ' • Generated manually'}
                    </Text>
                  </View>
                )}

                {(() => {
                  const availableTemplates = getAvailableTemplatesForStudent(selectedStudent);
                  const dueTemplates = getDueTemplatesForStudent(selectedStudent);
                  const allGradeTemplates = reportTemplates.filter(template => 
                    template.isActive && 
                    template.grade.toLowerCase() === (selectedStudent.studentGrade || selectedStudent.grade)?.toLowerCase()
                  );
                  
                  if (allGradeTemplates.length === 0) {
                    return (
                      <View style={styles.noTemplatesWarning}>
                        <Text style={styles.warningText}>
                          No active templates found for Grade {selectedStudent.studentGrade || selectedStudent.grade}. 
                          Please contact your school admin to create templates for this grade level.
                        </Text>
                      </View>
                    );
                  }
                  
                  if (availableTemplates.length === 0) {
                    const existingReports = getExistingReportInfo(selectedStudent) || [];
                    const existingReportDetails = existingReports.map(r => `${r.template} (${r.frequency})`).join(', ');
                    return (
                      <View style={styles.infoMessage}>
                        <Text style={styles.infoText}>
                          All available report types for Grade {selectedStudent.studentGrade || selectedStudent.grade} have already been generated for the current period: {existingReportDetails}
                        </Text>
                      </View>
                    );
                  }
                  
                  if (dueTemplates.length === 0 && availableTemplates.length > 0) {
                    return (
                      <View style={styles.noTemplatesWarning}>
                        <Text style={styles.warningText}>
                          {availableTemplates.length} template(s) are available for Grade {selectedStudent.studentGrade || selectedStudent.grade}, but none are due yet. 
                          Reports should only be generated when they are due according to the school's frequency settings.
                        </Text>
                      </View>
                    );
                  }
                  
                  if (dueTemplates.length > 0) {
                    const dueTemplateNames = dueTemplates.map(t => `${t.name} (${t.reportFrequency})`).join(', ');
                    const notDueCount = availableTemplates.length - dueTemplates.length;
                    return (
                      <View style={styles.successMessage}>
                        <Text style={styles.successText}>
                          {dueTemplates.length} Report(s) Due Now: {dueTemplateNames}
                          {notDueCount > 0 && ` • ${notDueCount} other template(s) not due yet`}
                        </Text>
                      </View>
                    );
                  }
                  
                  return null;
                })()}
              </View>

              {/* Voice Recording Section */}
              {selectedTemplate && (
                <View style={styles.sectionContainer}>
                  <Text style={styles.sectionTitle}>
                    <Ionicons name="mic" size={20} color="#667eea" /> Voice Recording
                  </Text>
                
                <View style={styles.recordingControls}>
                  {!isRecording ? (
                    <TouchableOpacity
                      style={styles.recordButton}
                      onPress={startRecording}
                    >
                      <Ionicons name="mic" size={24} color="white" />
                      <Text style={styles.recordButtonText}>Start Recording</Text>
                    </TouchableOpacity>
                  ) : (
                    <View style={styles.recordingActive}>
                      <Text style={styles.recordingTime}>
                        Recording: {formatTime(recordingTime)}
                      </Text>
                      <TouchableOpacity
                        style={styles.stopButton}
                        onPress={stopRecording}
                      >
                        <Ionicons name="stop" size={24} color="white" />
                        <Text style={styles.stopButtonText}>Stop Recording</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>

                {/* Recordings List */}
                {recordings.length > 0 && (
                  <View style={styles.recordingsList}>
                    <Text style={styles.recordingsTitle}>
                      Recordings ({recordings.length})
                    </Text>
                    {recordings.map((recording, index) => (
                      <View key={recording.id} style={styles.recordingItem}>
                        <View style={styles.recordingInfo}>
                          <Text style={styles.recordingText}>
                            Recording {index + 1}: {formatTime(recording.duration)}
                          </Text>
                          {playingRecordingId === recording.id && isPlayingAudio && (
                            <Text style={styles.playingIndicator}>🎵 Playing...</Text>
                          )}
                        </View>
                        <View style={styles.recordingActions}>
                          <TouchableOpacity
                            style={styles.playButton}
                            onPress={() => {
                              if (playingRecordingId === recording.id && isPlayingAudio) {
                                stopAudioPlayback();
                              } else {
                                playRecording(recording);
                              }
                            }}
                          >
                            <Ionicons 
                              name={playingRecordingId === recording.id && isPlayingAudio ? "stop" : "play"} 
                              size={16} 
                              color="#667eea" 
                            />
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.deleteRecordingButton}
                            onPress={() => {
                              // Stop playback if this recording is playing
                              if (playingRecordingId === recording.id) {
                                stopAudioPlayback();
                              }
                              setRecordings(prev => prev.filter(r => r.id !== recording.id));
                              if (recordings.length === 1) {
                                setTranscription('');
                              }
                            }}
                          >
                            <Ionicons name="trash" size={16} color="#f44336" />
                          </TouchableOpacity>
                        </View>
                      </View>
                    ))}
                    
                    <TouchableOpacity
                      style={[styles.transcribeButton, isTranscribing && styles.buttonDisabled]}
                      onPress={transcribeAudio}
                      disabled={isTranscribing}
                    >
                      <Ionicons name="text" size={16} color="white" />
                      <Text style={styles.transcribeButtonText}>
                        {isTranscribing ? 'Transcribing...' : 'Transcribe All'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
              )}

              {/* Transcription Section */}
              {selectedTemplate && transcription && (
                <View style={styles.sectionContainer}>
                  <Text style={styles.sectionTitle}>
                    <Ionicons name="text" size={20} color="#667eea" /> Transcription
                  </Text>
                  <TextInput
                    style={styles.transcriptionInput}
                    multiline
                    numberOfLines={4}
                    value={transcription}
                    onChangeText={setTranscription}
                    placeholder="Transcription will appear here..."
                    placeholderTextColor="#999"
                  />
                  <TouchableOpacity
                    style={[styles.generateButton, isGeneratingReport && styles.buttonDisabled]}
                    onPress={generateReportFromTranscription}
                    disabled={isGeneratingReport}
                  >
                    <Ionicons name="flash" size={16} color="white" />
                    <Text style={styles.generateButtonText}>
                      {isGeneratingReport ? 'Generating...' : 'Generate Report with AI'}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Report Content Section */}
              {selectedTemplate && (
                <View style={styles.sectionContainer}>
                  <Text style={styles.sectionTitle}>
                    <Ionicons name="document-text" size={20} color="#667eea" /> Report Content
                  </Text>
                <TextInput
                  style={styles.reportContentInput}
                  multiline
                  numberOfLines={8}
                  value={reportContent}
                  onChangeText={setReportContent}
                  placeholder="AI-generated report will appear here, or you can type manually..."
                  placeholderTextColor="#999"
                />
              </View>
              )}

              {/* Media Upload Section */}
              {selectedTemplate && (
                <View style={styles.sectionContainer}>
                  <Text style={styles.sectionTitle}>
                    📷 Add Photos & Videos
                  </Text>
                  <Text style={styles.sectionDescription}>
                    Upload photos and videos to enhance your report. You can add student work samples, classroom activities, or any relevant media.
                  </Text>
                  <MediaUpload
                    reportId={currentReportId || tempReportId || 'temp_upload'}
                    onMediaUploaded={handleMediaUploaded}
                    onMediaDeleted={handleMediaDeleted}
                    maxFiles={10}
                    disabled={false}
                  />
                  <View style={styles.mediaTip}>
                    <Text style={styles.tipText}>
                      💡 {currentReportId 
                        ? 'Media will be attached to this report.' 
                        : 'Media will be uploaded temporarily. Save as draft to keep them with the report.'}
                    </Text>
                  </View>
                </View>
              )}

              {/* Action Buttons */}
              {selectedTemplate && (
                <View style={styles.actionButtons}>
                  <TouchableOpacity
                    style={[styles.draftButton, ((!reportContent.trim() && recordings.length === 0) || isSavingDraft) && styles.buttonDisabled]}
                    onPress={saveReportAsDraft}
                    disabled={(!reportContent.trim() && recordings.length === 0) || isSavingDraft}
                  >
                    <Ionicons name="checkmark-circle" size={16} color="white" />
                    <Text style={styles.draftButtonText}>
                      {isSavingDraft ? 'Sending...' : 'Send For Approval'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.sendButton, 
                      (!teacherData?.canEmailReports || !reportContent.trim() || isSending) && styles.buttonDisabled
                    ]}
                    onPress={teacherData?.canEmailReports ? sendReportToParents : () => {}}
                    disabled={!teacherData?.canEmailReports || !reportContent.trim() || isSending}
                  >
                    <Ionicons name="send" size={16} color="white" />
                    <Text style={styles.sendButtonText}>
                      {teacherData?.canEmailReports 
                        ? (isSending ? 'Sending...' : 'Send to Parents')
                        : 'Send to Parents (No Permission)'}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </ScrollView>
          )}
        </KeyboardAvoidingView>
      </Modal>

      {/* Debug Panel Modal */}
      <Modal
        visible={showDebugPanel}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowDebugPanel(false)}
      >
        <View style={styles.debugModalContainer}>
          {/* Debug Modal Header */}
          <View style={styles.debugModalHeader}>
            <TouchableOpacity onPress={() => setShowDebugPanel(false)} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
            <Text style={styles.debugModalTitle}>Debug Logs</Text>
            <TouchableOpacity onPress={() => setDebugLogs([])} style={styles.clearLogsButton}>
              <Ionicons name="trash" size={20} color="#f44336" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.debugLogsContainer} showsVerticalScrollIndicator={true}>
            {debugLogs.length === 0 ? (
              <View style={styles.noLogsContainer}>
                <Ionicons name="information-circle" size={48} color="#ccc" />
                <Text style={styles.noLogsText}>No debug logs yet</Text>
                <Text style={styles.noLogsSubtext}>Navigate to "My Students" to see debug information</Text>
              </View>
            ) : (
              debugLogs.map((log, index) => (
                <View key={index} style={[
                  styles.debugLogItem,
                  log.includes('❌') ? styles.debugLogError :
                  log.includes('⚠️') ? styles.debugLogWarning :
                  log.includes('✅') ? styles.debugLogSuccess : styles.debugLogInfo
                ]}>
                  <Text style={styles.debugLogText}>{log}</Text>
                </View>
              ))
            )}
          </ScrollView>

          {/* Debug Actions */}
          <View style={styles.debugActions}>
            <TouchableOpacity 
              style={styles.debugActionButton}
              onPress={async () => {
                try {
                  const debugText = debugLogs.join('\n');
                  await Clipboard.setStringAsync(debugText);
                  Alert.alert(
                    'Success', 
                    `Copied ${debugLogs.length} debug logs to clipboard!`,
                    [{ text: 'OK' }]
                  );
                } catch (error) {
                  Alert.alert(
                    'Error', 
                    'Failed to copy logs to clipboard',
                    [{ text: 'OK' }]
                  );
                  console.error('Copy error:', error);
                }
              }}
            >
              <Ionicons name="copy" size={16} color="white" />
              <Text style={styles.debugActionText}>Copy Logs</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.debugActionButton, styles.refreshButton]}
              onPress={() => {
                setShowDebugPanel(false);
                // Refresh data to generate new logs
                const refreshData = async () => {
                  addDebugLog('🔄 Manual refresh triggered');
                  await loadStudents();
                  await loadReportTemplates();
                  await loadSchoolData();
                };
                refreshData();
              }}
            >
              <Ionicons name="refresh" size={16} color="white" />
              <Text style={styles.debugActionText}>Refresh Data</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 15,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    padding: 5,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  headerRight: {
    width: 34,
  },
  scrollView: {
    flex: 1,
  },
  searchContainer: {
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    paddingVertical: 4,
  },
  clearButton: {
    padding: 4,
  },
  countSection: {
    padding: 20,
    paddingBottom: 10,
  },
  countText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  studentsSection: {
    padding: 20,
    paddingTop: 0,
  },
  studentCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardBody: {
    marginBottom: 12,
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 'auto',
  },
  studentAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#667eea',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  avatarText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  studentInfo: {
    flex: 1,
  },
  studentName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  studentDetails: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  chipsContainer: {
    flexDirection: 'row',
    marginBottom: 2,
    gap: 6,
  },
  chip: {
    backgroundColor: '#e3f2fd',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e8ecff',
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
  },
  chipText: {
    fontSize: 11,
    color: '#1976d2',
    fontWeight: '600',
    marginLeft: 4,
  },
  parentEmail: {
    fontSize: 12,
    color: '#999',
    marginBottom: 2,
  },
  parentName: {
    fontSize: 12,
    color: '#999',
    marginBottom: 2,
  },
  generateReportButton: {
    backgroundColor: '#667eea',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    marginRight: 8,
  },
  generateReportButtonDisabled: {
    backgroundColor: '#ccc',
    opacity: 0.7,
  },
  generateReportButtonManual: {
    backgroundColor: '#ff9800', // Orange for manual/not due
  },
  generateReportButtonDue: {
    backgroundColor: '#667eea', // Blue for due reports
  },
  generateReportText: {
    color: 'white',
    fontSize: 11,
    fontWeight: '600',
    marginLeft: 4,
  },
  reportsCount: {
    fontSize: 12,
    color: '#667eea',
    fontWeight: '500',
  },
  reportsInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  viewDetailsButton: {
    padding: 8,
  },
  studentActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 8,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
    color: 'white',
    textTransform: 'capitalize',
  },
  dueReportsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dueBadge: {
    backgroundColor: '#f44336',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginRight: 4,
    flexDirection: 'row',
    alignItems: 'center',
  },
  dueBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: 'white',
    marginLeft: 2,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  // Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 15,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  closeButton: {
    padding: 5,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  modalScrollView: {
    flex: 1,
    padding: 20,
  },
  studentInfoSection: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  studentInfoText: {
    flex: 1,
    marginLeft: 15,
  },
  modalStudentName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginBottom: 4,
  },
  modalStudentDetails: {
    fontSize: 14,
    color: '#666',
  },
  sectionContainer: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
    lineHeight: 18,
  },
  recordingControls: {
    alignItems: 'center',
    marginBottom: 16,
  },
  recordButton: {
    backgroundColor: '#667eea',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
  },
  recordButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  recordingActive: {
    alignItems: 'center',
  },
  recordingTime: {
    fontSize: 18,
    fontWeight: '700',
    color: '#f44336',
    marginBottom: 12,
  },
  stopButton: {
    backgroundColor: '#f44336',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
  },
  stopButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  recordingsList: {
    marginTop: 16,
  },
  recordingsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  recordingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    backgroundColor: '#f8f9ff',
    borderRadius: 8,
    marginBottom: 8,
  },
  recordingInfo: {
    flex: 1,
    marginRight: 12,
  },
  recordingText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  playingIndicator: {
    fontSize: 12,
    color: '#667eea',
    fontStyle: 'italic',
    marginTop: 2,
  },
  recordingActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  playButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(102, 126, 234, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteRecordingButton: {
    padding: 4,
  },
  transcribeButton: {
    backgroundColor: '#4caf50',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  transcribeButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  transcriptionInput: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#333',
    minHeight: 100,
    textAlignVertical: 'top',
    marginBottom: 12,
  },
  generateButton: {
    backgroundColor: '#ff9800',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
  },
  generateButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  reportContentInput: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#333',
    minHeight: 300,
    textAlignVertical: 'top',
    fontFamily: 'monospace',
    lineHeight: 20,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
    marginBottom: 40,
  },
  draftButton: {
    flex: 1,
    backgroundColor: '#4caf50',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 8,
  },
  draftButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  sendButton: {
    flex: 1,
    backgroundColor: '#667eea',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 8,
  },
  sendButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  // New dynamic card styles
  reportStatsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    marginBottom: 8,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9ff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e8ecff',
  },
  statText: {
    fontSize: 11,
    color: '#667eea',
    fontWeight: '600',
    marginLeft: 4,
  },
  lastReportContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 4,
  },
  lastReportText: {
    fontSize: 11,
    color: '#999',
    marginLeft: 4,
  },
  parentContactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  parentContactText: {
    fontSize: 11,
    color: '#999',
    marginLeft: 4,
  },
  templateSelector: {
    marginBottom: 16,
  },
  picker: {
    backgroundColor: '#f8f9ff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  selectedTemplateInfo: {
    backgroundColor: '#e8f5e8',
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#4caf50',
  },
  selectedTemplateDue: {
    backgroundColor: '#e8f5e8',
    borderLeftColor: '#4caf50',
  },
  selectedTemplateNotDue: {
    backgroundColor: '#fff3cd',
    borderLeftColor: '#ff9800',
  },
  selectedTemplateTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2e7d32',
    marginBottom: 4,
  },
  selectedTemplateDetails: {
    fontSize: 12,
    color: '#666',
  },
  noTemplatesWarning: {
    backgroundColor: '#fff3cd',
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#ffc107',
  },
  warningText: {
    fontSize: 12,
    color: '#856404',
    lineHeight: 16,
  },
  mediaTip: {
    backgroundColor: '#e3f2fd',
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#2196f3',
    marginTop: 12,
  },
  tipText: {
    fontSize: 12,
    color: '#1976d2',
    lineHeight: 16,
  },
  // New message container styles
  infoMessage: {
    backgroundColor: '#e3f2fd',
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#2196f3',
    marginTop: 8,
  },
  infoText: {
    fontSize: 12,
    color: '#1976d2',
    lineHeight: 16,
  },
  successMessage: {
    backgroundColor: '#e8f5e8',
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#4caf50',
    marginTop: 8,
  },
  successText: {
    fontSize: 12,
    color: '#2e7d32',
    lineHeight: 16,
    fontWeight: '600',
  },
  
  // Enhanced Due Reports Chips Styles (matching web app)
  dueReportsLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#f44336',
    marginBottom: 4,
  },
  dueChipsWrapper: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    maxWidth: 200,
  },
  enhancedDueChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 12,
    minWidth: 40,
  },
  enhancedDueChipText: {
    fontSize: 10,
    fontWeight: '600',
    marginLeft: 3,
  },
  upToDateContainer: {
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  upToDateChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e8f5e8',
    borderWidth: 1,
    borderColor: '#4caf50',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 12,
    marginBottom: 2,
  },
  upToDateText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#4caf50',
    marginLeft: 3,
  },
  noReportsDueText: {
    fontSize: 9,
    color: '#999',
  },
  
  // Enhanced Generate Button Styles (matching web app)
  enhancedGenerateButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  generateButtonComplete: {
    backgroundColor: '#cccccc',
  },
  generateButtonManual: {
    backgroundColor: '#ff9800',
  },
  generateButtonDue: {
    backgroundColor: '#667eea', // Web app uses gradient, mobile uses solid color
  },
  buttonIconContainer: {
    minWidth: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonTextContainer: {
    flex: 1,
    marginLeft: 8,
  },
  enhancedGenerateButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'white',
    lineHeight: 14,
  },
  buttonSubtext: {
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 1,
  },
  enhancedViewDetailsButton: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(102, 126, 234, 0.1)',
  },
  
  // Debug Panel Styles
  debugButton: {
    padding: 5,
    position: 'relative',
  },
  debugBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: '#f44336',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  debugBadgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  debugModalContainer: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  debugModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 15,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  debugModalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  clearLogsButton: {
    padding: 5,
  },
  debugLogsContainer: {
    flex: 1,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  noLogsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  noLogsText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  noLogsSubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  debugLogItem: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  debugLogInfo: {
    borderLeftColor: '#2196f3',
  },
  debugLogSuccess: {
    borderLeftColor: '#4caf50',
  },
  debugLogWarning: {
    borderLeftColor: '#ff9800',
  },
  debugLogError: {
    borderLeftColor: '#f44336',
  },
  debugLogText: {
    fontSize: 12,
    color: '#333',
    fontFamily: 'monospace',
    lineHeight: 16,
  },
  debugActions: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    gap: 10,
  },
  debugActionButton: {
    flex: 1,
    backgroundColor: '#667eea',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
  },
  refreshButton: {
    backgroundColor: '#4caf50',
  },
  debugActionText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
});

export default StudentsScreen; 