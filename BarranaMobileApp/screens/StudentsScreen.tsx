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
  Picker,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
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

  const loadStudents = async () => {
    setLoading(true);
    try {
      // Get students assigned to this teacher through their classes
      const studentsData = await apiService.getTeacherStudents(user.id);
      console.log('📱 Students data received:', studentsData);
      console.log('📱 Students data length:', studentsData?.length);
      console.log('📱 First student sample:', studentsData?.[0]);
      
      // Validate and clean students data
      const validStudents = studentsData?.filter(student => 
        student && typeof student === 'object' && student._id
      ) || [];
      
      console.log('📱 Valid students count:', validStudents.length);
      setStudents(validStudents);
      
      // Get reports for these students
      const reportsData = await apiService.getTeacherReports(user.id);
      console.log('📱 Reports data received:', reportsData);
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
      console.log('📋 Loading report templates...');
      const templatesData = await apiService.getReportTemplates();
      console.log('📋 Templates received:', templatesData);
      setReportTemplates(templatesData || []);
    } catch (error) {
      console.error('Error loading report templates:', error);
    }
  };

  const loadSchoolData = async () => {
    try {
      console.log('🏫 Loading school data...');
      const schoolId = typeof user.schoolId === 'string' ? user.schoolId : user.schoolId?._id;
      if (schoolId) {
        const schoolData = await apiService.getSchool(schoolId);
        console.log('🏫 School data received:', schoolData);
        setSchoolData(schoolData);
      }
    } catch (error) {
      console.error('Error loading school data:', error);
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

  const generateReportFromTranscription = async () => {
    if (!selectedStudent || !selectedTemplate || !transcription.trim()) {
      Alert.alert('Error', 'Please transcribe audio first');
      return;
    }
    
    setIsGeneratingReport(true);
    
    try {
      console.log('📱 Generating report with AI...');
      console.log('📱 Student:', getStudentFullName(selectedStudent));
      console.log('📱 Template:', selectedTemplate.name);
      console.log('📱 Transcription length:', transcription.length);
      
      const response = await apiService.generateReport({
        transcription,
        studentName: getStudentFullName(selectedStudent),
        grade: selectedStudent.studentGrade || selectedStudent.grade || '',
        template: selectedTemplate.name,
        templateId: selectedTemplate._id // Add templateId for dynamic keyword generation
      });

      console.log('📱 AI Report generation response:', response);

      if (response.success && response.data) {
        // The response.data should now be a formatted string, not JSON
        setReportContent(response.data);
        Alert.alert('Success', 'Report generated successfully! You can now review and edit the content.');
      } else {
        throw new Error(response.error || 'Report generation failed');
      }
    } catch (error) {
      console.error('📱 Report generation error:', error);
      Alert.alert('Error', `Report generation failed: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.`);
    } finally {
      setIsGeneratingReport(false);
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
          const currentDayOfWeek = nowInTZ.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
          const isWorkingDay = workingDays.includes(currentDayOfWeek);
          
          if (isWorkingDay) {
            return reportDateInTZ.toDateString() === nowInTZ.toDateString();
          } else {
            // If today is not a working day, check if there's a report from the last working day
            let lastWorkingDay = new Date(nowInTZ);
            do {
              lastWorkingDay.setDate(lastWorkingDay.getDate() - 1);
            } while (!workingDays.includes(lastWorkingDay.getDay()));
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

  // Helper function to calculate due date for current period
  const calculateDueDateForFrequency = (frequency: string, currentDate: Date): Date => {
    const now = new Date(currentDate);
    
    // Get school settings for frequency configuration (same as frontend logic)
    const schoolSettings = schoolData?.settings || {};
    const frequencyConfig = schoolSettings.reportFrequencies?.[frequency];
    
    console.log('📱 Mobile calculateDueDateForFrequency', {
      frequency,
      currentDate: currentDate.toISOString(),
      frequencyConfig,
      enabled: frequencyConfig?.enabled
    });
    
    if (frequencyConfig?.enabled) {
      // Use school's frequency configuration (match frontend/backend logic)
      let dueDate = new Date(now);
      
      switch (frequency) {
        case 'Daily':
          // Check if today is a working day
          const workingDays = frequencyConfig.workingDays || [1, 2, 3, 4, 5]; // Default to Mon-Fri
          const currentDayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
          const isWorkingDay = workingDays.includes(currentDayOfWeek);
          
          if (!isWorkingDay) {
            // Find the next working day
            let nextWorkingDay = new Date(now);
            do {
              nextWorkingDay.setDate(nextWorkingDay.getDate() + 1);
            } while (!workingDays.includes(nextWorkingDay.getDay()));
            dueDate = nextWorkingDay;
          } else {
            dueDate = new Date(now);
          }
          
          // Set the configured time
          const [dailyHours, dailyMinutes] = (frequencyConfig.dueTime || '17:00').split(':').map(Number);
          dueDate.setHours(dailyHours, dailyMinutes, 0, 0);
          dueDate.setMilliseconds(0);
          break;
        case 'Weekly':
          // Due on configured day of the week (match frontend/backend logic exactly)
          const targetDay = frequencyConfig.dueDay; // Backend uses 0=Sunday, 1=Monday, ..., 6=Saturday
          const currentDay = now.getDay();
          let daysToAdd = (targetDay - currentDay + 7) % 7;
          
          // If it's the target day today, check if we've passed the due time (like backend)
          if (daysToAdd === 0) {
            const dueTime = frequencyConfig.dueTime || '17:00';
            const [dueHours, dueMinutes] = dueTime.split(':').map(Number);
            const currentHours = now.getHours();
            const currentMinutes = now.getMinutes();
            
            // If current time is after due time, move to next week (match backend logic)
            if (currentHours > dueHours || (currentHours === dueHours && currentMinutes > dueMinutes)) {
              daysToAdd = 7;
            }
          }
          
          // Ensure we're working with a fresh date object
          dueDate = new Date(now);
          dueDate.setDate(now.getDate() + daysToAdd);
          const [weeklyHours, weeklyMinutes] = (frequencyConfig.dueTime || '17:00').split(':').map(Number);
          dueDate.setHours(weeklyHours, weeklyMinutes, 0, 0);
          return dueDate;
        default:
          // For other frequencies, use school time if configured
          const [hours, minutes] = (frequencyConfig.dueTime || '17:00').split(':').map(Number);
          dueDate.setHours(hours, minutes, 0, 0);
          return dueDate;
      }
    }
    
    // Fallback logic if frequency config is not enabled or missing (maintain backward compatibility)
    console.log('📱 Mobile: Using fallback logic for', frequency);
    switch (frequency) {
      case 'Daily':
        return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 17, 0, 0, 0);
      case 'Weekly':
        // Due by end of current week (Sunday) - fallback only
        const weekEnd = new Date(now);
        weekEnd.setDate(now.getDate() + (7 - now.getDay()));
        weekEnd.setHours(23, 59, 59, 999);
        return weekEnd;
      case 'Bi-Weekly':
        // Due by end of current 2-week period
        const biWeekEnd = new Date(now);
        biWeekEnd.setDate(now.getDate() + (14 - (now.getDay() + 7)));
        biWeekEnd.setHours(23, 59, 59, 999);
        return biWeekEnd;
      case 'Monthly':
        // Due by end of current month
        const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        monthEnd.setHours(23, 59, 59, 999);
        return monthEnd;
      case 'Bi-Monthly':
        // Due by end of current 2-month period
        const biMonthEnd = new Date(now.getFullYear(), Math.floor(now.getMonth() / 2) * 2 + 2, 0);
        biMonthEnd.setHours(23, 59, 59, 999);
        return biMonthEnd;
      case 'Quarterly':
        // Due by end of current quarter
        const quarterEnd = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3 + 3, 0);
        quarterEnd.setHours(23, 59, 59, 999);
        return quarterEnd;
      case 'Annually':
        // Due by end of current year
        const yearEnd = new Date(now.getFullYear(), 11, 31);
        yearEnd.setHours(23, 59, 59, 999);
        return yearEnd;
      default:
        return now;
    }
  };

  const calculateDueReports = (studentsData: Student[], reportsData: StudentReport[]) => {
    const due: DueReport[] = [];
    
    // Get current time in school timezone
    const schoolSettings = schoolData?.settings || {};
    const timezone = schoolSettings.timezone || 'UTC';
    const now = new Date(new Date().toLocaleString("en-US", {timeZone: timezone}));
    
    console.log('📱 Calculating due reports for mobile...');
    console.log('📱 Students count:', studentsData.length);
    console.log('📱 Reports count:', reportsData.length);
    console.log('📱 Templates count:', reportTemplates.length);
    
    studentsData.forEach(student => {
      const studentReports = reportsData.filter(r => r.studentId === student._id);
      console.log(`📱 Student ${getStudentFullName(student)}: ${studentReports.length} reports`);
      
      // Find templates for this student's grade
      const studentGrade = student.studentGrade || student.grade || '';
      const gradeTemplates = reportTemplates.filter(template => 
        template.grade.toLowerCase() === studentGrade.toLowerCase() && template.isActive
      );
      
      console.log(`📱 Student ${getStudentFullName(student)} (${studentGrade}): ${gradeTemplates.length} matching templates`);
      
      gradeTemplates.forEach(template => {
        // Check if there's a report for the current period based on frequency
        const currentPeriodReport = getReportForCurrentPeriod(studentReports, template.reportFrequency, now);
        
        if (currentPeriodReport) {
          // Report exists for current period - check if it's by another teacher
          const currentTeacherId = user?._id;
          const reportTeacherId = currentPeriodReport.teacherId;
          
          const isReportByAnotherTeacher = reportTeacherId && reportTeacherId !== currentTeacherId;
          
          if (isReportByAnotherTeacher) {
            // Report already generated by another teacher for this period - not due for current teacher
            console.log(`📱 ${getStudentFullName(student)} - ${template.name}: Report already generated by another teacher (${reportTeacherId})`);
            return; // Skip this template for current teacher
          }
          
          // Report exists for current period by current teacher - check status
          if (currentPeriodReport.status === 'sent' || currentPeriodReport.status === 'approved') {
            console.log(`✅ ${getStudentFullName(student)} - ${template.name}: Report sent for current period`);
            // Not due - report is sent
          } else {
            // Report exists but not sent (draft, completed, review, archived)
            // For any frequency, if report exists for the current period and was created today, don't show as due
            const reportDate = new Date(currentPeriodReport.createdAt);
            const today = new Date();
            const isReportFromToday = reportDate.toDateString() === today.toDateString();
            
            if (isReportFromToday) {
              console.log(`✅ ${getStudentFullName(student)} - ${template.name}: ${template.reportFrequency} report exists for current period (created today)`);
              // Don't add to due reports - report exists for current period
              return;
            }
            
            const daysSinceCreation = Math.floor((now.getTime() - new Date(currentPeriodReport.createdAt).getTime()) / (1000 * 60 * 60 * 24));
            
            // Map the status to our due report status
            let reportStatus: 'draft' | 'completed' | 'sent' | 'missing';
            if (currentPeriodReport.status === 'draft') {
              reportStatus = 'draft';
            } else if (currentPeriodReport.status === 'completed' || currentPeriodReport.status === 'review') {
              reportStatus = 'completed';
            } else {
              reportStatus = 'draft'; // Default for other statuses
            }
            
            // Add draft reports even if created today, but only add other status reports if they're older than 0 days
            if (currentPeriodReport.status === 'draft' || daysSinceCreation > 0) {
              due.push({
                studentId: student._id,
                studentName: getStudentFullName(student),
                templateName: template.name,
                frequency: template.reportFrequency,
                dueDate: new Date(currentPeriodReport.createdAt).toISOString(),
                daysOverdue: daysSinceCreation,
                templateId: template._id,
                reportStatus: reportStatus,
                reportId: currentPeriodReport._id
              });
              console.log(`⚠️ ${getStudentFullName(student)} - ${template.name}: Report exists but not sent (${currentPeriodReport.status}) - ${daysSinceCreation} days old`);
            } else {
              console.log(`📝 ${getStudentFullName(student)} - ${template.name}: Report created today, not overdue yet`);
            }
          }
        } else {
          // No report for current period - calculate due date
          const dueDate = calculateDueDateForFrequency(template.reportFrequency, now);
          const daysOverdue = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
          
          if (daysOverdue >= 0) {
            due.push({
              studentId: student._id,
              studentName: getStudentFullName(student),
              templateName: template.name,
              frequency: template.reportFrequency,
              dueDate: dueDate.toISOString(),
              daysOverdue,
              templateId: template._id,
              reportStatus: 'missing',
              reportId: null
            });
            console.log(`❌ ${getStudentFullName(student)} - ${template.name}: No report for current period (${daysOverdue} days overdue)`);
          } else {
            console.log(`⏰ ${getStudentFullName(student)} - ${template.name}: Not due yet (${Math.abs(daysOverdue)} days until due)`);
          }
        }
      });
    });
    
    // Sort by most overdue first
    due.sort((a, b) => b.daysOverdue - a.daysOverdue);
    setDueReports(due);
    console.log(`📱 Final due reports count: ${due.length}`);
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
  const getCurrentTimeInSchoolTimezone = (): Date => {
    const schoolSettings = schoolData?.settings || {};
    const timezone = schoolSettings.timezone || 'UTC';
    
    // Get current time in school timezone
    const now = new Date();
    const schoolTime = new Date(now.toLocaleString("en-US", {timeZone: timezone}));
    return schoolTime;
  };

  // Helper function to format date in school timezone
  const formatDateInSchoolTimezone = (date: Date): string => {
    const schoolSettings = schoolData?.settings || {};
    const timezone = schoolSettings.timezone || 'UTC';
    
    return date.toLocaleDateString("en-US", {timeZone: timezone});
  };

  // Helper function to convert date to school timezone
  const convertToSchoolTimezone = (date: Date, timezone: string): Date => {
    return new Date(date.toLocaleString("en-US", {timeZone: timezone}));
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
    
    const studentGrade = student.studentGrade || student.grade || '';
    const gradeTemplates = reportTemplates.filter(template => 
      template.grade.toLowerCase() === studentGrade.toLowerCase() && template.isActive
    );
    
    // Get existing reports for current period
    const existingReports = getExistingReportInfo(student) || [];
    const existingFrequencies = existingReports.map(r => r.frequency);
    
    // Filter out templates that already have reports
    const availableTemplates = gradeTemplates.filter(template => 
      !existingFrequencies.includes(template.reportFrequency)
    );

    // From the available templates, find which ones are actually due
    const studentDueReports = getStudentDueReports(student._id);
    const dueTemplateIds = studentDueReports.map(dr => dr.templateId);
    
    return availableTemplates.filter(template => 
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
          uploadedAt: media.uploadedAt
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
          uploadedAt: media.uploadedAt
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
    loadStudents();
    loadReportTemplates();
    loadSchoolData();
  }, []);

  // Recalculate due reports when templates are loaded
  useEffect(() => {
    if (reportTemplates.length > 0 && students.length > 0 && reports.length > 0 && schoolData) {
      console.log('📱 Templates and school data loaded, recalculating due reports...');
      calculateDueReports(students, reports);
    }
  }, [reportTemplates.length, students.length, reports.length, schoolData]);

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
        <View style={styles.headerRight} />
      </View>

      <ScrollView 
        style={styles.scrollView}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh}
            colors={['#667eea']}
            tintColor="#667eea"
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
                    {studentDueReports.length > 0 && (
                      <View style={styles.dueReportsContainer}>
                        {studentDueReports.slice(0, 2).map((dueReport, index) => {
                          let badgeColor = '#f44336'; // Default red for missing
                          let iconName = 'warning';
                          
                          if (dueReport.reportStatus === 'draft') {
                            badgeColor = '#ff9800'; // Orange for draft
                            iconName = 'create';
                          } else if (dueReport.reportStatus === 'completed') {
                            badgeColor = '#2196f3'; // Blue for completed
                            iconName = 'checkmark-circle';
                          }
                          
                          return (
                            <View key={dueReport.templateId} style={[styles.dueBadge, { backgroundColor: badgeColor }]}>
                              <Ionicons name={iconName as any} size={10} color="white" />
                              <Text style={styles.dueBadgeText}>
                                {dueReport.reportStatus === 'draft' ? 'Draft' : 
                                 dueReport.reportStatus === 'completed' ? 'Ready' : 
                                 dueReport.daysOverdue > 0 ? `${dueReport.daysOverdue}d` : 'Due'}
                              </Text>
                            </View>
                          );
                        })}
                        {studentDueReports.length > 2 && (
                          <View style={[styles.dueBadge, { backgroundColor: '#f44336' }]}>
                            <Text style={styles.dueBadgeText}>+{studentDueReports.length - 2}</Text>
                          </View>
                        )}
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
                  <TouchableOpacity 
                    style={[
                      styles.generateReportButton,
                      (() => {
                        const availableTemplates = getAvailableTemplatesForStudent(student);
                        const dueTemplates = getDueTemplatesForStudent(student);
                        
                        if (availableTemplates.length === 0) {
                          return styles.generateReportButtonDisabled;
                        }
                        
                        if (dueTemplates.length === 0) {
                          return styles.generateReportButtonManual; // Orange for manual generation
                        }
                        
                        return styles.generateReportButtonDue; // Blue/purple for due reports
                      })()
                    ]}
                    onPress={() => handleGenerateReport(student)}
                    disabled={getAvailableTemplatesForStudent(student).length === 0}
                  >
                    <Ionicons 
                      name={(() => {
                        const availableTemplates = getAvailableTemplatesForStudent(student);
                        const dueTemplates = getDueTemplatesForStudent(student);
                        
                        if (availableTemplates.length === 0) {
                          return "checkmark-circle";
                        }
                        
                        if (dueTemplates.length === 0) {
                          return "create";
                        }
                        
                        return "add-circle";
                      })()} 
                      size={16} 
                      color="white" 
                    />
                    <Text style={styles.generateReportText}>
                      {(() => {
                        const availableTemplates = getAvailableTemplatesForStudent(student);
                        const dueTemplates = getDueTemplatesForStudent(student);
                        
                        if (availableTemplates.length === 0) {
                          return 'All Reports Complete';
                        }
                        
                        if (dueTemplates.length === 0) {
                          return 'Generate Report (Manual)';
                        }
                        
                        return `Generate Report (${dueTemplates.length} Due)`;
                      })()}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.viewDetailsButton}>
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
                    onValueChange={(itemValue) => {
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
                        <Text style={styles.recordingInfo}>
                          Recording {index + 1}: {formatTime(recording.duration)}
                        </Text>
                        <TouchableOpacity
                          style={styles.deleteRecordingButton}
                          onPress={() => {
                            setRecordings(prev => prev.filter(r => r.id !== recording.id));
                            if (recordings.length === 1) {
                              setTranscription('');
                            }
                          }}
                        >
                          <Ionicons name="trash" size={16} color="#f44336" />
                        </TouchableOpacity>
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
                    reportId={currentReportId || tempReportId}
                    onMediaUploaded={handleMediaUploaded}
                    onMediaDeleted={handleMediaDeleted}
                    maxFiles={10}
                    disabled={false}
                  />
                  {!currentReportId && (
                    <View style={styles.mediaTip}>
                      <Text style={styles.tipText}>
                        💡 Save your report as a draft first to enable media uploads.
                      </Text>
                    </View>
                  )}
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
                    style={[styles.sendButton, styles.buttonDisabled]}
                    onPress={() => {}} // Disabled functionality
                    disabled={true}
                  >
                    <Ionicons name="send" size={16} color="white" />
                    <Text style={styles.sendButtonText}>
                      Send to Parents (Disabled)
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </ScrollView>
          )}
        </KeyboardAvoidingView>
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
    backgroundColor: '#f8f9ff',
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
    color: '#667eea',
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
    fontSize: 14,
    color: '#333',
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
});

export default StudentsScreen; 