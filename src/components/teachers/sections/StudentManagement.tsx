import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Avatar,
  Chip,
  Button,
  TextField,
  InputAdornment,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Container,
  Fade,
  Grow,
  Alert,
  Badge,
  Tooltip,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  CircularProgress,
  Slide,
  Stack,
  FormGroup,
  FormControlLabel,
  Checkbox,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import {
  Search,
  People,
  Assessment,
  Visibility,
  CheckCircle,
  Person,
  Email,
  Star,
  Notifications,
  Warning,
  Schedule,
  Assignment,
  Mic,
  Stop,
  PlayArrow,
  Pause,
  Delete,
  Close,
  AutoFixHigh,
  Send,
  PhotoCamera,
  Refresh,
} from '@mui/icons-material';
import { useData } from '../../../contexts/DataContext';
import { useAuth } from '../../../contexts/AuthContext';
import apiService from '../../../services/apiService';
import { reportTemplateService, type ReportTemplate } from '../../../services/reportTemplateService';
import { reportService, type CreateReportData } from '../../../services/reportService';
import { aiService } from '../../../services/aiService';
import { communicationService } from '../../../services/communicationService';
import { type ReportFrequency } from '../../../constants/reportFrequencies';
import { type UploadedMedia } from '../../../services/mediaService';
import MediaUpload from '../../common/MediaUpload';
import MedicalInfoDisplay from '../../common/MedicalInfoDisplay';
import { formatGradeForDisplay, areGradesEqual } from '../../../utils/gradeDisplayUtils';
import NotificationIcon from '../../common/NotificationIcon';
import { themeColors } from '../../../theme/teacherTheme';
import toast from 'react-hot-toast';
import moment from 'moment-timezone';

interface DueReport {
  studentId: string;
  studentName: string;
  templateName: string;
  frequency: ReportFrequency;
  dueDate: Date;
  daysOverdue: number;
  templateId: string;
  reportStatus?: 'draft' | 'completed' | 'sent' | 'missing';
  reportId?: string | null;
}

interface DueStatusData {
  [key: string]: {
    [templateId: string]: {
      due: boolean;
      nextDueDate: string | null;
      lastReportDate: string | null;
      timezone: string;
      frequency: string;
      hasExistingReportInPeriod?: boolean;
      existingReportInPeriod?: {
        reportId: string;
        teacherName: string | null;
        createdAt: string;
        status: string;
      } | null;
    };
  };
}

const Transition = React.forwardRef(function Transition(
  props: any,
  ref: React.Ref<unknown>,
) {
  return <Slide direction="up" ref={ref} {...props} />;
});

export interface StudentManagementProps {
  schoolBranding?: any;
}

const StudentManagement: React.FC<StudentManagementProps> = ({ schoolBranding }) => {
  // Card background colors array
  const cardColors = themeColors.cardColors;
  
  // Helper function to get a random card color
  const getRandomCardColor = (index?: number) => {
    if (index !== undefined) {
      return cardColors[index % cardColors.length];
    }
    return cardColors[Math.floor(Math.random() * cardColors.length)];
  };
  const { reports, getStudentsByTeacherClasses, getReportsByTeacherStudents, addReport, teachers, school } = useData();
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [openStudentDialog, setOpenStudentDialog] = useState(false);
  const [reportTemplates, setReportTemplates] = useState<ReportTemplate[]>([]);

  const [showNotifications, setShowNotifications] = useState(false);
  
  // Report Generation Dialog State
  const [showQuickReportDialog, setShowQuickReportDialog] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<ReportTemplate | null>(null);
  const [reportContent, setReportContent] = useState('');
  const [keyPoints, setKeyPoints] = useState<Array<{
    main: string;
    subPoints: string[];
  }>>([]);
  
  // Voice recording state - Multiple recordings support
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [recordings, setRecordings] = useState<Array<{
    id: string;
    blob: Blob;
    url: string;
    duration: number;
    transcription?: string;
  }>>([]);
  const [transcription, setTranscription] = useState('');
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [playingRecordingId, setPlayingRecordingId] = useState<string | null>(null);
  
  // Media upload state
  const [uploadedMedia, setUploadedMedia] = useState<UploadedMedia[]>([]);
  const [currentReportId, setCurrentReportId] = useState<string>('');
  const [tempReportId, setTempReportId] = useState<string>('');
  
  // Due status tracking
  const [dueStatusData, setDueStatusData] = useState<DueStatusData>({});
  const [, setIsCheckingDueStatus] = useState(false);
  const [checking, setChecking] = useState(false);
  // Due reports from centralized backend calculator (single source of truth)
  const [dueReportsFromBackend, setDueReportsFromBackend] = useState<Array<{
    studentId: string;
    studentName: string;
    studentGrade: string;
    studentClass: string;
    templateId: string;
    templateName: string;
    frequency: string;
    dueDate: Date;
    daysOverdue: number;
    reportStatus: string;
    reportId: string | null;
  }>>([]);
  
  // Refs for media recording
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Get teacher's students using the new helper function
  const teacherStudents = user?.id ? getStudentsByTeacherClasses(user.id) : [];
  const teacherReports = user?.id ? getReportsByTeacherStudents(user.id) : [];
  const completedReports = teacherReports.filter(r => r.status === 'completed');

  // Debug: Get classes data to understand the relationship
  const { classes } = useData();
  const teacherClasses = user?.id ? classes.filter(cls => 
    cls.assignedTeachers.some(assignment => 
      assignment.teacherId && (
        assignment.teacherId._id === user.id || 
        assignment.teacherId._id.toString() === user.id
      )
    )
  ) : [];

  // Load report templates
  useEffect(() => {
    const loadReportTemplates = async () => {
      try {
        const response = await reportTemplateService.getReportTemplates();
        
        if (response.success && response.data) {
          setReportTemplates(response.data);
        }
      } catch (error) {
        console.error('❌ Error loading report templates:', error);
      }
    };

    loadReportTemplates();
  }, [user?.id]); // Add user.id as dependency to ensure it runs when user is loaded

  // Fetch due reports from centralized backend calculator (single source of truth)
  useEffect(() => {
    const fetchDueReports = async () => {
      try {
        console.log('📊 Fetching due reports from centralized backend calculator...');
        const response = await apiService.getDueReports();
        
        if (response.success && response.data) {
          console.log('✅ Due reports fetched:', response.data);
          setDueReportsFromBackend(response.data.dueReports);
        } else {
          console.error('❌ Failed to fetch due reports:', response.error);
        }
      } catch (error) {
        console.error('❌ Error fetching due reports:', error);
      }
    };

    if (user?.id) {
      fetchDueReports();
      // Refresh every 2 minutes
      const interval = setInterval(fetchDueReports, 120000);
      return () => clearInterval(interval);
    }
  }, [user?.id]);

  // Helper function to get current time in school timezone
  const getCurrentTimeInSchoolTimezone = (): Date => {
    const schoolSettings = school?.settings || {};
    const timezone = schoolSettings.timezone || 'UTC';
    
    // IMPORTANT: Keep as moment object to preserve timezone info
    // Converting to Date too early causes timezone issues
    const schoolTime = moment().tz(timezone);
    
    // Return a Date that represents the current time
    // We'll need to be careful with this in calculations
    return schoolTime.toDate();
  };

  // Helper function to format date in school timezone
  const formatDateInSchoolTimezone = (date: Date): string => {
    const schoolSettings = school?.settings || {};
    const timezone = schoolSettings.timezone || 'UTC';
    
    return date.toLocaleDateString("en-US", {timeZone: timezone});
  };

  // Helper function to check if a report is for the current period based on frequency
  const getReportForCurrentPeriod = (reports: any[], frequency: ReportFrequency, currentDate: Date) => {
    const now = new Date(currentDate);
    
    return reports.find(report => {
      const reportDate = new Date(report.createdAt);
      
      switch (frequency) {
        case 'Daily':
          // Check if report is from today
          return reportDate.toDateString() === now.toDateString();
        case 'Weekly':
          // Check if report is from this week (Monday to Sunday)
          const weekStart = new Date(now);
          weekStart.setDate(now.getDate() - now.getDay() + 1); // Monday
          weekStart.setHours(0, 0, 0, 0);
          const weekEnd = new Date(weekStart);
          weekEnd.setDate(weekStart.getDate() + 6); // Sunday
          weekEnd.setHours(23, 59, 59, 999);
          return reportDate >= weekStart && reportDate <= weekEnd;
        case 'Bi-Weekly':
          // Check if report is from current 2-week period
          const biWeekStart = new Date(now);
          biWeekStart.setDate(now.getDate() - now.getDay() + 1);
          biWeekStart.setHours(0, 0, 0, 0);
          const biWeekEnd = new Date(biWeekStart);
          biWeekEnd.setDate(biWeekStart.getDate() + 13);
          biWeekEnd.setHours(23, 59, 59, 999);
          return reportDate >= biWeekStart && reportDate <= biWeekEnd;
        case 'Monthly':
          // Check if report is from current month
          return reportDate.getMonth() === now.getMonth() && 
                 reportDate.getFullYear() === now.getFullYear();
        case 'Bi-Monthly':
          // Check if report is from current 2-month period
          const biMonthStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 2) * 2, 1);
          const biMonthEnd = new Date(biMonthStart);
          biMonthEnd.setMonth(biMonthStart.getMonth() + 2);
          biMonthEnd.setDate(0); // Last day of the second month
          biMonthEnd.setHours(23, 59, 59, 999);
          return reportDate >= biMonthStart && reportDate <= biMonthEnd;
        case 'Quarterly':
          // Check if report is from current quarter
          const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
          const quarterEnd = new Date(quarterStart);
          quarterEnd.setMonth(quarterStart.getMonth() + 3);
          quarterEnd.setDate(0);
          quarterEnd.setHours(23, 59, 59, 999);
          return reportDate >= quarterStart && reportDate <= quarterEnd;
        case 'Annually':
          // Check if report is from current year
          return reportDate.getFullYear() === now.getFullYear();
        default:
          return false;
      }
    });
  };

  // Helper function to calculate due date for current period based on school settings
  const calculateDueDateForFrequency = (frequency: ReportFrequency, currentDate: Date): Date => {
    console.log('🔍 Frontend calculateDueDateForFrequency called', {
      frequency,
      currentDate: currentDate.toISOString(),
      schoolSettings: school?.settings
    });
    
    // Get school settings for frequency configuration
    const schoolSettings = school?.settings || {};
    const timezone = schoolSettings.timezone || 'UTC';
    const frequencyConfig = schoolSettings.reportFrequencies?.[frequency];
    
    // CRITICAL FIX: Work with moment-timezone objects to preserve timezone!
    // Date objects lose timezone info and use device's local timezone
    const now = moment(currentDate).tz(timezone);
    
    console.log('🔍 Frontend frequency config', {
      frequency,
      frequencyConfig,
      enabled: frequencyConfig?.enabled,
      timezone,
      nowInSchoolTZ: now.format('YYYY-MM-DD HH:mm:ss z')
    });
    
    if (frequencyConfig?.enabled) {
      
      // Use school's frequency configuration
      // Work with moment objects to preserve timezone
      let dueDate = now.clone();
      
      switch (frequency) {
        case 'Daily':
          // Check if today is a working day (use moment's .isoWeekday() which respects timezone)
          const workingDays = frequencyConfig.workingDays || [1, 2, 3, 4, 5]; // Default to Mon-Fri
          const currentDayOfWeek = now.isoWeekday(); // 1 = Monday, 2 = Tuesday, ..., 7 = Sunday (ISO format to match backend)
          const isWorkingDay = workingDays.includes(currentDayOfWeek);
          
          if (!isWorkingDay) {
            // Find the next working day (using moment to preserve timezone)
            let nextWorkingDay = dueDate.clone();
            do {
              nextWorkingDay.add(1, 'day');
            } while (!workingDays.includes(nextWorkingDay.isoWeekday()));
            dueDate = nextWorkingDay;
          }
          // If it's a working day, dueDate is already set to today
          
          // Set the configured time (using moment methods)
          const [dailyHours, dailyMinutes] = (frequencyConfig.dueTime || '17:00').split(':').map(Number);
          dueDate.hour(dailyHours).minute(dailyMinutes).second(0).millisecond(0);
          break;
        case 'Weekly':
          // Due on configured day of the week (use moment methods to preserve timezone)
          const targetDay = frequencyConfig.dueDay; // 0=Sunday, 1=Monday, ..., 6=Saturday
          const currentDay = now.day(); // Use moment's .day() which respects timezone
          let daysToAdd = (targetDay - currentDay + 7) % 7;
          
          // If it's the target day today, check if we've passed the due time
          if (daysToAdd === 0) {
            const dueTime = frequencyConfig.dueTime || '17:00';
            const [dueHours, dueMinutes] = dueTime.split(':').map(Number);
            const currentHours = now.hour(); // Use moment's .hour() which respects timezone
            const currentMinutes = now.minute();
            
            // If current time is after due time, move to next week
            if (currentHours > dueHours || (currentHours === dueHours && currentMinutes > dueMinutes)) {
              daysToAdd = 7;
            }
          }
          
          // Use moment to add days (preserves timezone)
          dueDate = now.clone().add(daysToAdd, 'days');
          const [weeklyHours, weeklyMinutes] = (frequencyConfig.dueTime || '17:00').split(':').map(Number);
          dueDate.hour(weeklyHours).minute(weeklyMinutes).second(0).millisecond(0);
          break;
        case 'Bi-Weekly':
          // Rule-based bi-weekly calculation (using moment methods)
          const biWeeklyRule = frequencyConfig.rule || 'alternateWeeks';
          const biWeeklyDueDay = frequencyConfig.dueDay || 5;
          
          if (biWeeklyRule === 'alternateWeeks') {
            // Set to the configured day of the week
            const biWeekTargetDay = biWeeklyDueDay - 1;
            const biWeekCurrentDay = now.day();
            const biWeekDaysToAdd = (biWeekTargetDay - biWeekCurrentDay + 7) % 7;
            dueDate.add(biWeekDaysToAdd, 'days');
            
            // Ensure it's every other week based on start week
            const startWeek = frequencyConfig.startWeek || 1;
            const weekNumber = dueDate.week();
            const shouldBeEvenWeek = startWeek === 1;
            
            if ((weekNumber % 2 === 0) !== shouldBeEvenWeek) {
              dueDate.add(7, 'days');
            }
          } else if (biWeeklyRule === 'specificWeeks') {
            // Simplified: use alternate weeks as fallback
            const biWeekTargetDay = biWeeklyDueDay - 1;
            const biWeekCurrentDay = now.day();
            const biWeekDaysToAdd = (biWeekTargetDay - biWeekCurrentDay + 7) % 7;
            dueDate.add(biWeekDaysToAdd, 'days');
            
            const weekNumber = dueDate.week();
            if (weekNumber % 2 !== 0) {
              dueDate.add(7, 'days');
            }
          } else if (biWeeklyRule === 'nthWeekOfMonth') {
            // Simplified: use 3rd week of month
            dueDate.date(1).add(14, 'days'); // Start of month + 2 weeks
            
            const biWeekTargetDay = biWeeklyDueDay - 1;
            const biWeekCurrentDay = dueDate.day();
            const biWeekDaysToAdd = (biWeekTargetDay - biWeekCurrentDay + 7) % 7;
            dueDate.add(biWeekDaysToAdd, 'days');
          }
          
          const [biWeeklyHours, biWeeklyMinutes] = (frequencyConfig.dueTime || '17:00').split(':').map(Number);
          dueDate.hour(biWeeklyHours).minute(biWeeklyMinutes).second(0).millisecond(0);
          break;
        case 'Monthly':
          // Rule-based monthly calculation (using moment methods)
          const monthlyRule = frequencyConfig.rule || 'lastWorkingDay';
          if (monthlyRule === 'specificDate') {
            const specificDay = frequencyConfig.specificDay || 28;
            dueDate.date(specificDay);
          } else if (monthlyRule === 'lastDay') {
            dueDate.endOf('month');
          } else if (monthlyRule === 'lastWorkingDay') {
            // Simplified: use last day of month
            dueDate.endOf('month');
          } else if (monthlyRule === 'nthWeekday') {
            // Simplified: use 1st Friday
            const nth = frequencyConfig.nthWeekday?.n || 1;
            const weekday = frequencyConfig.nthWeekday?.weekday || 5;
            dueDate.date(1);
            while (dueDate.day() !== weekday) {
              dueDate.add(1, 'day');
            }
            if (nth > 1) {
              dueDate.add((nth - 1) * 7, 'days');
            }
          }
          const [monthlyHours, monthlyMinutes] = (frequencyConfig.dueTime || '17:00').split(':').map(Number);
          dueDate.hour(monthlyHours).minute(monthlyMinutes).second(0).millisecond(0);
          break;
        case 'Bi-Monthly':
          // Rule-based bi-monthly calculation (using moment methods)
          const biMonthlyRule = frequencyConfig.rule || 'lastWorkingDay';
          const startMonth = frequencyConfig.startMonth || 9;
          
          // Ensure we're on the correct bi-monthly period
          const biMonthlyCurrentMonth = dueDate.month() + 1;
          const monthsSinceStart = (biMonthlyCurrentMonth - startMonth + 12) % 12;
          if (monthsSinceStart % 2 !== 0) {
            dueDate.add(1, 'month');
          }
          
          if (biMonthlyRule === 'specificDate') {
            const specificDay = frequencyConfig.specificDay || 28;
            dueDate.date(specificDay);
          } else if (biMonthlyRule === 'lastDay') {
            dueDate.endOf('month');
          } else if (biMonthlyRule === 'lastWorkingDay') {
            dueDate.endOf('month');
          } else if (biMonthlyRule === 'nthWeekday') {
            const nth = frequencyConfig.nthWeekday?.n || 1;
            const weekday = frequencyConfig.nthWeekday?.weekday || 5;
            dueDate.date(1);
            while (dueDate.day() !== weekday) {
              dueDate.add(1, 'day');
            }
            if (nth > 1) {
              dueDate.add((nth - 1) * 7, 'days');
            }
          }
          const [biMonthlyHours, biMonthlyMinutes] = (frequencyConfig.dueTime || '17:00').split(':').map(Number);
          dueDate.hour(biMonthlyHours).minute(biMonthlyMinutes).second(0).millisecond(0);
          break;
        case 'Quarterly':
          // Find the next enabled quarter based on current date (using moment methods)
          const quarters = frequencyConfig.quarters || {};
          const quarterCurrentMonth = now.month() + 1; // Convert to 1-based month
          
          // Find the next quarter that is enabled and hasn't passed yet
          let nextQuarterMoment = null;
          
          // Check all quarters in order
          const quarterOrder = ['q1', 'q2', 'q3', 'q4'];
          for (const quarterKey of quarterOrder) {
            const quarter = quarters[quarterKey];
            if (quarter && quarter.enabled) {
              const quarterMonth = quarter.month - 1; // Convert to 0-based month
              const quarterDay = quarter.day;
              
              // Create date for this quarter in current year
              let quarterMoment = now.clone().month(quarterMonth).date(quarterDay);
              
              // If this quarter has passed, try next year
              if (quarterMoment.isBefore(now)) {
                quarterMoment.add(1, 'year');
              }
              
              // If this is the first valid quarter or it's earlier than our current best
              if (!nextQuarterMoment || quarterMoment.isBefore(nextQuarterMoment)) {
                nextQuarterMoment = quarterMoment;
              }
            }
          }
          
          if (nextQuarterMoment) {
            dueDate = nextQuarterMoment;
            const [quarterlyHours, quarterlyMinutes] = (frequencyConfig.dueTime || '17:00').split(':').map(Number);
            dueDate.hour(quarterlyHours).minute(quarterlyMinutes).second(0).millisecond(0);
          }
          // If no quarters enabled, dueDate remains as now.clone()
          break;
        case 'Annually':
          // Due on configured month and day (format: MMDD, e.g., 615 = June 15th, using moment methods)
          const yearTargetDay = frequencyConfig.dueDay;
          const yearTargetMonth = Math.floor(yearTargetDay / 100) - 1; // Convert to 0-based month index
          const yearTargetDate = yearTargetDay % 100;
          
          dueDate.month(yearTargetMonth).date(yearTargetDate);
          const [annuallyHours, annuallyMinutes] = (frequencyConfig.dueTime || '17:00').split(':').map(Number);
          dueDate.hour(annuallyHours).minute(annuallyMinutes).second(0).millisecond(0);
          break;
        default:
          return now.toDate(); // Convert moment back to Date
      }
      
      console.log('🔍 Frontend calculated due date (enabled config)', {
        frequency,
        dueDate: dueDate.toISOString(), // moment has .toISOString()
        dueTime: frequencyConfig.dueTime,
        timezone
      });
      
      return dueDate.toDate(); // Convert moment back to Date for compatibility
    } else {
      // Fallback to default calculation (also use moment to preserve timezone)
      let fallbackDueDate = now.clone();
      
      switch (frequency) {
        case 'Daily':
          fallbackDueDate.startOf('day');
          break;
        case 'Weekly':
          // Due by end of current week (Sunday)
          fallbackDueDate.endOf('week');
          break;
        case 'Bi-Weekly':
          // Due by end of current 2-week period
          fallbackDueDate.add(14 - now.day(), 'days').endOf('day');
          break;
        case 'Monthly':
          // Due by end of current month
          fallbackDueDate.endOf('month');
          break;
        case 'Bi-Monthly':
          // Due by end of current 2-month period
          fallbackDueDate.add(2, 'months').endOf('month');
          break;
        case 'Quarterly':
          // Due by end of current quarter
          fallbackDueDate.endOf('quarter');
          break;
        case 'Annually':
          // Due by end of current year
          fallbackDueDate.endOf('year');
          break;
        default:
          // Return current time
          break;
      }
      
      console.log('🔍 Frontend calculated due date (fallback)', {
        frequency,
        fallbackDueDate: fallbackDueDate.toISOString(),
        timezone
      });
      
      return fallbackDueDate.toDate(); // Convert back to Date
    }
  };

  const addDaysBasedOnFrequency = (date: Date, frequency: ReportFrequency): Date => {
    const newDate = new Date(date);
    switch (frequency) {
      case 'Daily':
        newDate.setDate(newDate.getDate() + 1);
        break;
      case 'Weekly':
        newDate.setDate(newDate.getDate() + 7);
        break;
      case 'Bi-Weekly':
        newDate.setDate(newDate.getDate() + 14);
        break;
      case 'Bi-Monthly':
        newDate.setMonth(newDate.getMonth() + 2);
        break;
      case 'Monthly':
        newDate.setMonth(newDate.getMonth() + 1);
        break;
      case 'Quarterly':
        newDate.setMonth(newDate.getMonth() + 3);
        break;
      case 'Annually':
        newDate.setFullYear(newDate.getFullYear() + 1);
        break;
      default:
        newDate.setMonth(newDate.getMonth() + 1);
    }
    return newDate;
  };

  const getFrequencyInDays = (frequency: ReportFrequency): number => {
    switch (frequency) {
      case 'Daily': return 1;
      case 'Weekly': return 7;
      case 'Bi-Weekly': return 14;
      case 'Bi-Monthly': return 60;
      case 'Monthly': return 30;
      case 'Quarterly': return 90;
      case 'Annually': return 365;
      default: return 30;
    }
  };

  const getDueStatusColor = (daysOverdue: number) => {
    if (daysOverdue > 7) return 'error';
    if (daysOverdue > 0) return 'warning';
    return 'info';
  };

  const getDueStatusText = (daysOverdue: number) => {
    if (daysOverdue > 7) return `${daysOverdue} days overdue`;
    if (daysOverdue > 0) return `${daysOverdue} days overdue`;
    return 'Due soon';
  };

  // Debug function to compare frontend and backend calculations (disabled for production)
  const debugDueCalculations = async (studentId: string, templateId: string, frontendResult: any) => {
    // Disabled to reduce console noise - uncomment for debugging due date calculations
    return null;
    
    /* 
    try {
      const debugService = await import('../../../services/debugService');
      const comparison = await debugService.default.compareDueCalculations(
        studentId,
        templateId,
        school?.settings || {},
        frontendResult.frequency
      );
      
      console.log('🔍 Frontend vs Backend comparison:', comparison);
      
      // Log any differences found
      if (comparison.differences.length > 0) {
        console.warn('⚠️ Calculation differences found:', comparison.differences);
      }
      
      return comparison;
    } catch (error) {
      console.error('Error debugging due calculations:', error);
      return null;
    }
    */
  };

  // Calculate due reports based on templates and frequencies
  // SIMPLIFIED: Use backend calculator as single source of truth
  // All complex logic moved to backend/services/dueReportsCalculator.js
  const dueReports = useMemo<DueReport[]>(() => {
    console.log('🎯 Using due reports from centralized backend:', dueReportsFromBackend.length);

    // Convert backend format to frontend format. The backend guarantees
    // `frequency` is one of the canonical ReportFrequency values, so the
    // cast here is safe and keeps the rest of the code strictly typed.
    return dueReportsFromBackend.map((report) => ({
      studentId: report.studentId,
      studentName: report.studentName,
      templateName: report.templateName,
      frequency: report.frequency as ReportFrequency,
      dueDate: new Date(report.dueDate),
      daysOverdue: report.daysOverdue,
      templateId: report.templateId,
      reportStatus: report.reportStatus as DueReport['reportStatus'],
      reportId: report.reportId,
    }));
    // We intentionally key the memo off `dueReportsFromBackend.length` — the
    // backend is the single source of truth, and depending on the full array
    // would recompute on every reference change without behavioural benefit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    dueReportsFromBackend.length // Use backend as single source of truth
  ]);

  const filteredStudents = teacherStudents.filter(student =>
    student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    student.grade.toLowerCase().includes(searchTerm.toLowerCase()) ||
    student.studentClass?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleStudentClick = (student: any) => {
    setSelectedStudent(student);
    setOpenStudentDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenStudentDialog(false);
    setSelectedStudent(null);
  };

  const getStudentReports = (studentId: string) => {
    // Use the teacher's reports and filter by student ID
    const teacherReports = getReportsByTeacherStudents(user?.id || '');
    return teacherReports.filter(r => {
      const reportStudentId = typeof r.studentId === 'string' ? r.studentId : r.studentId._id;
      return reportStudentId === studentId;
    });
  };

  const getStudentStatus = (student: any) => {
    const studentReports = getStudentReports(student._id);
    const completedReports = studentReports.filter(r => r.status === 'completed');
    const studentDueReports = getStudentDueReports(student._id);
    
    // First check if there are due reports
    if (studentDueReports.length > 0) {
      return { status: 'Due', color: 'error' };
    }
    
    // Then check completed reports
    if (completedReports.length === 0) return { status: 'No Reports', color: 'default' };
    if (completedReports.length < 3) return { status: 'In Progress', color: 'warning' };
    return { status: 'Active', color: 'success' };
  };

  const getStudentDueReports = (studentId: string) => {
    return dueReports.filter(dr => dr.studentId === studentId);
  };

  // Extract key points from template content with hierarchical structure
  const extractKeyPointsFromTemplate = (templateContent: string): Array<{
    main: string;
    subPoints: string[];
  }> => {
    if (!templateContent) return [];
    
    const keyPoints: Array<{ main: string; subPoints: string[] }> = [];
    const lines = templateContent.split('\n');
    let currentMainPoint: { main: string; subPoints: string[] } | null = null;
    
    for (let i = 0; i < lines.length; i++) {
      const originalLine = lines[i].trim();
      
      // Skip empty lines
      if (!originalLine) continue;
      
      // Check if this line starts with "Heading:" or "Subheading:"
      const isHeading = /^Heading:\s*/i.test(originalLine);
      const isSubheading = /^Subheading:\s*/i.test(originalLine);
      
      // Only process lines that are explicitly marked as Heading or Subheading
      if (!isHeading && !isSubheading) continue;
      
      // Remove the prefix and get the actual content
      const content = originalLine
        .replace(/^Heading:\s*/i, '')
        .replace(/^Subheading:\s*/i, '')
        .trim();
      
      // Skip if content is empty after removing prefix
      if (!content) continue;
      
      if (isHeading) {
        // Save previous main point if it exists
        if (currentMainPoint && currentMainPoint.main) {
          keyPoints.push(currentMainPoint);
        }
        
        // Start new main point
        currentMainPoint = {
          main: content,
          subPoints: []
        };
      } else if (isSubheading && currentMainPoint) {
        // Add as sub-point to current main point
        if (!currentMainPoint.subPoints.includes(content)) {
          currentMainPoint.subPoints.push(content);
        }
      }
    }
    
    // Don't forget the last main point
    if (currentMainPoint && currentMainPoint.main) {
      keyPoints.push(currentMainPoint);
    }
    
    return keyPoints;
  };

  // Auto-select template based on student's grade (only due templates)
  const autoSelectTemplateForStudent = async (student: any) => {
    console.log('🔍 autoSelectTemplateForStudent called:', { student: student?.name, grade: student?.grade });
    console.log('🔍 Available templates:', reportTemplates.length);
    
    if (!student || !reportTemplates.length) {
      console.log('🔍 No student or templates available');
      return;
    }
    
    try {
      // Get templates that are actually due (not just available) - uses cross-teacher filtering
      const dueTemplates = await getDueTemplatesForStudent(student);
      console.log('🔍 Due templates for student (cross-teacher filtered):', dueTemplates.length);
      
      if (dueTemplates.length > 0) {
        // Don't auto-select template - let user choose manually for proper key points extraction
        console.log('🔍 Due templates available:', dueTemplates.map(t => t.name));
        setSelectedTemplate(null);
        setKeyPoints([]);
        toast.success(`${dueTemplates.length} due template(s) available for Grade ${formatGradeForDisplay(student.grade)}. Please select one to continue.`);
      } else {
        console.log('🔍 No due templates for grade:', student.grade);
        const availableTemplates = await getAvailableTemplatesForStudent(student);
        const existingReports = getExistingReportInfo(student) || [];
        
        if (availableTemplates.length > 0) {
          toast.success(`${availableTemplates.length} template(s) available for ${formatGradeForDisplay(student.grade)}, but none are due yet. You can still generate reports manually.`);
        } else if (existingReports.length > 0) {
          const reportDetails = existingReports.map(r => `${r.frequency}`).join(', ');
          toast.success(`All ${reportDetails} reports already exist for ${formatGradeForDisplay(student.grade)}. Another teacher may have generated the reports for this period.`);
        } else {
          toast.error(`No active templates found for Grade ${formatGradeForDisplay(student.grade)}.`);
        }
        setSelectedTemplate(null);
        setKeyPoints([]);
      }
    } catch (error) {
      console.error('🔍 Error in autoSelectTemplateForStudent:', error);
      // Fallback to local template selection (also no auto-selection)
      const localDueTemplates = getLocalDueTemplatesForStudent(student);
      if (localDueTemplates.length > 0) {
        console.log('🔍 Local due templates available:', localDueTemplates.map(t => t.name));
        setSelectedTemplate(null);
        setKeyPoints([]);
        toast.success(`${localDueTemplates.length} template(s) available. Please select one to continue.`);
      } else {
        setSelectedTemplate(null);
        setKeyPoints([]);
        toast.error('No templates available for this grade.');
      }
    }
  };

  // Voice recording functions
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      let startTime = Date.now();

      mediaRecorder.ondataavailable = (event) => {
        chunks.push(event.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        const url = URL.createObjectURL(blob);
        const duration = Math.floor((Date.now() - startTime) / 1000); // Calculate actual duration
        const newRecording = {
          id: Date.now().toString(),
          blob,
          url,
          duration
        };
        setRecordings(prev => [...prev, newRecording]);
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
      toast.error('Error accessing microphone. Please check permissions.');
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

  const transcribeAudio = async () => {
    console.log('🔍 Transcribe Audio Debug:');
    console.log('🔍 Recordings count:', recordings.length);
    console.log('🔍 Selected student:', selectedStudent);
    
    // Validate prerequisites
    if (recordings.length === 0) {
      toast.error('No recordings found. Please record some audio first.');
      return;
    }
    
    if (!selectedStudent) {
      toast.error('No student selected. Please select a student first.');
      return;
    }
    
    if (!aiService.isConfigured()) {
      toast.error('AI service not configured. Please check your OpenAI API key.');
      return;
    }
    
    setIsTranscribing(true);
    toast.loading('Transcribing all recordings...');
    
    try {
      // Transcribe all recordings and combine the results
      const transcriptions = [];
      let successCount = 0;
      
      for (let i = 0; i < recordings.length; i++) {
        const recording = recordings[i];
        console.log(`🔍 Transcribing recording ${i + 1}/${recordings.length}`);
        
        try {
          const response = await aiService.transcribeAudio({
            audioBlob: recording.blob,
            language: 'en',
            studentName: `${selectedStudent.firstName} ${selectedStudent.lastName}`
          });

          if (response.success && response.data && response.data.trim()) {
            transcriptions.push(response.data);
            successCount++;
            
            // Update the recording with its transcription
            setRecordings(prev => prev.map(r => 
              r.id === recording.id 
                ? { ...r, transcription: response.data }
                : r
            ));
            
            console.log(`✅ Recording ${i + 1} transcribed successfully:`, response.data.substring(0, 100) + '...');
          } else {
            console.warn(`⚠️ Recording ${i + 1} transcription failed or empty:`, response);
            transcriptions.push(`[Recording ${i + 1}: Transcription failed or empty]`);
          }
        } catch (recordingError) {
          console.error(`❌ Error transcribing recording ${i + 1}:`, recordingError);
          transcriptions.push(`[Recording ${i + 1}: Error during transcription]`);
        }
      }

      // Combine all transcriptions
      const combinedTranscription = transcriptions.join('\n\n--- Next Recording ---\n\n');
      console.log('🔍 Transcribe Debug:');
      console.log('🔍 Individual transcriptions:', transcriptions);
      console.log('🔍 Combined transcription:', combinedTranscription);
      console.log('🔍 Success count:', successCount, 'out of', recordings.length);
      
      setTranscription(combinedTranscription);
      
      if (successCount === recordings.length) {
        toast.success(`All ${recordings.length} recordings transcribed successfully!`);
      } else if (successCount > 0) {
        toast.success(`${successCount} out of ${recordings.length} recordings transcribed successfully. Some failed.`);
      } else {
        toast.error('All transcriptions failed. Please check your audio quality and try again.');
      }
    } catch (error) {
      console.error('Transcription error:', error);
      toast.error('Transcription failed. Please try again.');
    } finally {
      setIsTranscribing(false);
    }
  };

  const generateReportFromTranscription = async () => {
    console.log('🔍 Generate Report Debug:');
    console.log('🔍 Global transcription:', transcription);
    console.log('🔍 Recordings with transcription:', recordings.filter(r => r.transcription?.trim()));
    console.log('🔍 Selected student:', selectedStudent);
    console.log('🔍 Selected template:', selectedTemplate);
    
    // Check if we have the required components
    if (!selectedStudent) {
      toast.error('Please select a student first');
      return;
    }
    
    if (!selectedTemplate) {
      toast.error('Please select a template first');
      return;
    }
    
    // Check if we have transcription (either from recordings or manual input)
    const hasTranscription = transcription.trim() || recordings.some(r => r.transcription?.trim());
    
    if (!hasTranscription) {
      toast.error('Please add observations first. You can either record audio and transcribe it, or type your observations manually.');
      return;
    }
    
    setIsGeneratingReport(true);
    toast.loading('Generating report with AI...');
    
    try {
      // Use global transcription if available, otherwise combine from recordings
      const transcriptionToUse = transcription.trim() || 
        recordings
          .filter(r => r.transcription?.trim())
          .map(r => r.transcription)
          .join('\n\n--- Next Recording ---\n\n');
      
      const response = await aiService.generateReport({
        transcription: transcriptionToUse,
        studentName: `${selectedStudent.firstName} ${selectedStudent.lastName}`,
        grade: selectedStudent.grade,
        template: selectedTemplate.name,
        templateId: selectedTemplate._id // Pass the template ID for dynamic prompts
      });

      if (response.success && response.data) {
        setReportContent(response.data);
        toast.success('Report generated successfully!');
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

  // Upload audio files to server
  const uploadAudioFiles = async (recordings: any[], studentName: string) => {
    const uploadedRecordings: Array<{
      url: string;
      duration: number;
      transcription: string;
    }> = [];
    
    for (const recording of recordings) {
      try {
        const formData = new FormData();
        formData.append('audio', recording.blob, `recording_${Date.now()}.webm`);
        formData.append('studentName', studentName);
        
        const response = await fetch('/api/ai/upload-audio', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          },
          body: formData
        });
        
        if (!response.ok) {
          throw new Error(`Upload failed: ${response.status}`);
        }
        
        const result = await response.json();
        
        if (result.success && result.data) {
          uploadedRecordings.push({
            url: result.data.url, // Server URL instead of blob URL
            duration: recording.duration,
            transcription: recording.transcription || ''
          });
          console.log('✅ Audio uploaded successfully:', result.data.url);
        } else {
          throw new Error(result.message || 'Upload failed');
        }
      } catch (error) {
        console.error('❌ Error uploading audio file:', error);
        throw new Error(`Failed to upload audio file: ${error}`);
      }
    }
    
    return uploadedRecordings;
  };

  const saveReportAsDraft = async () => {
    console.log('Save Report Draft function called!');
    console.log('Selected student:', selectedStudent);
    console.log('Selected template:', selectedTemplate);
    
    if (!selectedStudent || !selectedTemplate) {
      toast.error('Please select a student and template first');
      return;
    }

    if (!reportContent.trim() && recordings.length === 0) {
      toast.error('Please add some content (voice recording or text) before saving');
      return;
    }

    setIsSavingDraft(true);
    toast.loading('Saving report draft...');
    
    try {
      console.log('🔍 DEBUG: Save Draft called');
      console.log('🔍 Token exists:', !!localStorage.getItem('token'));
      console.log('🔍 Token value:', localStorage.getItem('token')?.substring(0, 20) + '...');
      console.log('Saving draft for student:', selectedStudent);
      console.log('Selected template:', selectedTemplate);
      console.log('Report content length:', reportContent.length);
      console.log('Recordings count:', recordings.length);
      console.log('Transcription:', transcription);

      // Ensure we have the correct student ID format
      const studentId = selectedStudent._id || selectedStudent.id;
      const templateId = selectedTemplate._id;
      
      if (!studentId) {
        throw new Error('Student ID is missing');
      }
      
      if (!templateId) {
        throw new Error('Template ID is missing');
      }

      // Upload audio files if there are recordings
      let uploadedRecordings: Array<{
        url: string;
        duration: number;
        transcription: string;
      }> = [];
      if (recordings.length > 0) {
        console.log('🎤 Uploading audio files...');
        const studentName = `${selectedStudent.firstName || selectedStudent.name} ${selectedStudent.lastName || ''}`;
        uploadedRecordings = await uploadAudioFiles(recordings, studentName);
        console.log('✅ Audio files uploaded:', uploadedRecordings.length);
      }

      const reportData: CreateReportData = {
        title: `${selectedTemplate.name} - ${selectedStudent.firstName || selectedStudent.name} ${selectedStudent.lastName || ''} (Draft)`,
        studentId: studentId,
        templateId: templateId,
        content: reportContent || 'Draft report - content to be completed',
        customFieldValues: {},
        reportType: 'progress',
        reportPeriod: {
          startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          endDate: new Date()
        },
        voiceRecording: recordings.length > 0 ? {
          hasRecording: true,
          recordings: uploadedRecordings.length > 0 ? uploadedRecordings : recordings.map(recording => ({
            url: recording.url,
            duration: recording.duration,
            transcription: recording.transcription || ''
          })),
          recordingUrl: uploadedRecordings.length > 0 ? uploadedRecordings[0].url : recordings[0].url, // Use server URL if available
          recordingDuration: recordings.reduce((total, r) => total + r.duration, 0),
          transcription: transcription,
          isTranscribed: !!transcription
        } : { hasRecording: false, isTranscribed: false },
        aiGenerated: transcription ? {
          isAiGenerated: true,
          originalTranscription: transcription,
          generationModel: 'barrana-ai-v1'
        } : { isAiGenerated: false }
      };

      // Ensure all required fields are present for attachments
      const processedAttachments = uploadedMedia.map(media => ({
        filename: media.filename,
        originalName: media.originalName,
        mimeType: media.mimeType,
        size: media.size,
        url: media.url,
        uploadedAt: media.uploadedAt || new Date().toISOString(),
        isTemporary: media.isTemporary || false
      }));

      // Add attachments to report data
      const reportDataWithAttachments = {
        ...reportData,
        attachments: processedAttachments
      };

      console.log('🔍 DEBUG - uploadedMedia before report creation:', uploadedMedia);
      console.log('🔍 DEBUG - uploadedMedia length:', uploadedMedia.length);
      console.log('🔍 DEBUG - uploadedMedia details:', uploadedMedia.map(m => ({
        id: m.id,
        originalName: m.originalName,
        url: m.url,
        isTemporary: m.isTemporary
      })));
      console.log('🔍 DEBUG - processed attachments:', processedAttachments);
      console.log('🔍 DEBUG - processed attachments length:', processedAttachments.length);

      console.log('🎤 DEBUG - Recordings state before sending:', recordings);
      console.log('🎤 DEBUG - Recordings length:', recordings.length);
      console.log('🎤 DEBUG - Individual recordings:', recordings.map((r, i) => ({ 
        index: i, 
        id: r.id, 
        duration: r.duration, 
        hasUrl: !!r.url, 
        hasBlob: !!r.blob 
      })));
      console.log('Report data being sent:', reportDataWithAttachments);
      console.log('Voice recording in report data:', reportDataWithAttachments.voiceRecording);
      console.log('Recordings array in report data:', reportDataWithAttachments.voiceRecording?.recordings);

      const createResponse = await reportService.createReport(reportDataWithAttachments);
      
      console.log('Create response:', createResponse);
      console.log('Voice recording in response:', createResponse.data?.voiceRecording);
      console.log('Recordings array in response:', createResponse.data?.voiceRecording?.recordings);
      
      if (createResponse.success) {
        toast.success('Report sent for approval successfully!');
        
        // Send notification to school admins
        try {
          const schoolId = user?.schoolId || (user?.schoolId as any)?._id;
          if (schoolId && createResponse.data) {
            const teacherName = `${user?.firstName || ''} ${user?.lastName || ''}`.trim();
            const studentName = `${selectedStudent.firstName || selectedStudent.name} ${selectedStudent.lastName || ''}`.trim();
            
            await communicationService.sendReportApprovalNotification(schoolId, {
              reportId: createResponse.data._id,
              studentName: studentName,
              teacherName: teacherName,
              reportTitle: createResponse.data.title,
              createdAt: createResponse.data.createdAt
            });
            
            console.log('✅ Notification sent to school admins for report approval');
          }
        } catch (notificationError) {
          console.error('❌ Error sending notification to school admins:', notificationError);
          // Don't fail the entire operation if notification fails
        }
        
        // Add the new report to the context
        if (createResponse.data) {
          // Set the current report ID for media uploads
          setCurrentReportId(createResponse.data._id);
          
          // Convert the report to match DataContext.Report interface
          const convertedReport = {
            _id: createResponse.data._id,
            studentId: typeof createResponse.data.studentId === 'string' 
              ? createResponse.data.studentId 
              : createResponse.data.studentId._id,
            teacherId: typeof createResponse.data.teacherId === 'string' 
              ? createResponse.data.teacherId 
              : createResponse.data.teacherId._id,
            schoolId: createResponse.data.schoolId,
            title: createResponse.data.title,
            content: createResponse.data.content,
            status: createResponse.data.status as 'draft' | 'completed' | 'sent',
            createdAt: createResponse.data.createdAt,
            updatedAt: createResponse.data.updatedAt,
            template: createResponse.data.templateId?.name,
            voiceRecording: createResponse.data.voiceRecording, // Include the full voiceRecording object
            voiceRecordingUrl: createResponse.data.voiceRecording?.recordingUrl,
            aiGenerated: createResponse.data.aiGenerated?.isAiGenerated
          };
          
          console.log('🔍 Converted report for DataContext:', convertedReport);
          console.log('🔍 Voice recording in converted report:', convertedReport.voiceRecording);
          console.log('🔍 Recordings array in converted report:', convertedReport.voiceRecording?.recordings);
          
          addReport(convertedReport);
        }
        // Don't close the dialog, let teacher continue working
      } else {
        throw new Error(createResponse.message || createResponse.error || 'Failed to save report draft');
      }
    } catch (error) {
      console.error('Error saving report draft:', error);
      
      // Handle specific error cases
      let errorMessage = 'Failed to save report draft. Please try again.';
      
      if (error instanceof Error) {
        if (error.message.includes('already been generated')) {
          errorMessage = 'A report of this frequency has already been generated for this student in the current period.';
        } else if (error.message.includes('not due yet')) {
          errorMessage = 'This report is not due yet based on school frequency settings.';
        } else {
          errorMessage = error.message;
        }
      }
      
      toast.error(errorMessage);
    } finally {
      setIsSavingDraft(false);
    }
  };

  const sendReportToParents = async () => {
    if (!selectedStudent || !selectedTemplate || !reportContent.trim()) {
      toast.error('Please complete the report first');
      return;
    }

    setIsSending(true);
    toast.loading('Sending report to parents...');
    
    try {
      // Upload audio files if there are recordings
      let uploadedRecordings: Array<{
        url: string;
        duration: number;
        transcription: string;
      }> = [];
      if (recordings.length > 0) {
        console.log('🎤 Uploading audio files for final report...');
        const studentName = `${selectedStudent.firstName || selectedStudent.name} ${selectedStudent.lastName || ''}`;
        uploadedRecordings = await uploadAudioFiles(recordings, studentName);
        console.log('✅ Audio files uploaded for final report:', uploadedRecordings.length);
      }

      // Ensure all required fields are present for attachments
      const processedAttachments = uploadedMedia.map(media => ({
        filename: media.filename,
        originalName: media.originalName,
        mimeType: media.mimeType,
        size: media.size,
        url: media.url,
        uploadedAt: media.uploadedAt || new Date().toISOString(),
        isTemporary: media.isTemporary || false
      }));

      const reportData: CreateReportData = {
        title: `${selectedTemplate.name} - ${selectedStudent.firstName} ${selectedStudent.lastName}`,
        studentId: selectedStudent._id || selectedStudent.id,
        templateId: selectedTemplate._id,
        content: reportContent,
        customFieldValues: {},
        reportType: 'progress',
        reportPeriod: {
          startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          endDate: new Date()
        },
        voiceRecording: recordings.length > 0 ? {
          hasRecording: true,
          recordings: uploadedRecordings.length > 0 ? uploadedRecordings : recordings.map(recording => ({
            url: recording.url,
            duration: recording.duration,
            transcription: recording.transcription || ''
          })),
          recordingUrl: uploadedRecordings.length > 0 ? uploadedRecordings[0].url : recordings[0].url, // Use server URL if available
          recordingDuration: recordings.reduce((total, r) => total + r.duration, 0),
          transcription: transcription,
          isTranscribed: !!transcription
        } : { hasRecording: false, isTranscribed: false },
        aiGenerated: transcription ? {
          isAiGenerated: true,
          originalTranscription: transcription,
          generationModel: 'barrana-ai-v1'
        } : { isAiGenerated: false }
      };

      // Add attachments to report data
      const reportDataWithAttachments = {
        ...reportData, // Spread the original reportData
        attachments: processedAttachments // Add the processed attachments
      };

      console.log('🔍 DEBUG - uploadedMedia before report creation:', uploadedMedia);
      console.log('🔍 DEBUG - uploadedMedia length:', uploadedMedia.length);
      console.log('🔍 DEBUG - uploadedMedia details:', uploadedMedia.map(m => ({
        id: m.id,
        originalName: m.originalName,
        url: m.url,
        isTemporary: m.isTemporary
      })));
      console.log('🔍 DEBUG - processed attachments:', processedAttachments);
      console.log('🔍 DEBUG - processed attachments length:', processedAttachments.length);
      
      console.log('🎤 DEBUG - Recordings state before sending:', recordings);
      console.log('🎤 DEBUG - Recordings length:', recordings.length);
      console.log('🎤 DEBUG - Individual recordings:', recordings.map((r, i) => ({
        index: i,
        id: r.id,
        duration: r.duration,
        hasUrl: !!r.url,
        hasBlob: !!r.blob
      })));
      console.log('Report data being sent:', reportDataWithAttachments);
      console.log('Voice recording in report data:', reportDataWithAttachments.voiceRecording);
      console.log('Recordings array in report data:', reportDataWithAttachments.voiceRecording?.recordings);
      
      const createResponse = await reportService.createReport(reportDataWithAttachments);
      
      if (createResponse.success && createResponse.data) {
        await reportService.approveReport(createResponse.data._id, 'Auto-approved by teacher');
        const sendResponse = await reportService.sendReportToParents(
          createResponse.data._id, 
          [selectedStudent.parentEmail || 'parent@example.com']
        );
        
        if (sendResponse.success) {
          toast.success('Report sent to parents successfully!');
          // Add the new report to the context
          if (createResponse.data) {
            // Convert the report to match DataContext.Report interface
            const convertedReport = {
              _id: createResponse.data._id,
              studentId: typeof createResponse.data.studentId === 'string' 
                ? createResponse.data.studentId 
                : createResponse.data.studentId._id,
              teacherId: typeof createResponse.data.teacherId === 'string' 
                ? createResponse.data.teacherId 
                : createResponse.data.teacherId._id,
              schoolId: createResponse.data.schoolId,
              title: createResponse.data.title,
              content: createResponse.data.content,
              status: createResponse.data.status as 'draft' | 'completed' | 'sent',
              createdAt: createResponse.data.createdAt,
              updatedAt: createResponse.data.updatedAt,
              template: createResponse.data.templateId?.name,
              voiceRecording: createResponse.data.voiceRecording, // Include the full voiceRecording object
              voiceRecordingUrl: createResponse.data.voiceRecording?.recordingUrl,
              aiGenerated: createResponse.data.aiGenerated?.isAiGenerated
            };
            addReport(convertedReport);
          }
          handleCloseReportDialog();
        } else {
          throw new Error(sendResponse.message || 'Failed to send report');
        }
      } else {
        throw new Error(createResponse.message || 'Failed to create report');
      }
    } catch (error) {
      console.error('Error sending report:', error);
      toast.error('Failed to send report. Please try again.');
    } finally {
      setIsSending(false);
    }
  };

  const handleCloseReportDialog = () => {
    setShowQuickReportDialog(false);
    setSelectedStudent(null);
    setSelectedTemplate(null);
    setReportContent('');
    setRecordings([]);
    setTranscription('');
    setKeyPoints([]);
    setRecordingTime(0);
    setIsRecording(false);
    setUploadedMedia([]);
    setCurrentReportId('');
    setTempReportId('');
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
  };

  // Media upload handlers
  const handleMediaUploaded = (media: UploadedMedia[]) => {
    console.log('🎯 Media uploaded successfully:', media);
    console.log('🔍 Media details:', media.map(m => ({
      id: m.id,
      url: m.url,
      originalName: m.originalName,
      hasUrl: !!m.url,
      urlType: typeof m.url,
      keys: Object.keys(m),
      isTemporary: m.isTemporary
    })));
    
    // Validate media objects before adding
    const validMedia = media.filter(m => {
      if (!m.url) {
        console.error('❌ Media item missing URL:', m);
        toast.error(`Failed to upload ${m.originalName}: Missing URL`);
        return false;
      }
      if (!m.originalName) {
        console.error('❌ Media item missing originalName:', m);
        toast.error('Failed to upload file: Missing filename');
        return false;
      }
      return true;
    });
    
    if (validMedia.length !== media.length) {
      toast.error(`${media.length - validMedia.length} file(s) failed to upload properly`);
    }
    
    setUploadedMedia(prev => {
      const newMedia = [...prev, ...validMedia];
      console.log('🔍 Updated uploadedMedia in StudentManagement:', newMedia.map(m => ({ 
        id: m.id, 
        url: m.url, 
        hasUrl: !!m.url,
        originalName: m.originalName,
        isTemporary: m.isTemporary
      })));
      
      if (validMedia.length > 0) {
        toast.success(`${validMedia.length} file(s) uploaded successfully!`);
      }
      
      return newMedia;
    });
  };

  const handleMediaDeleted = (mediaId: string) => {
    console.log('Media deleted:', mediaId);
    const deletedMedia = uploadedMedia.find(m => m.id === mediaId);
    
    setUploadedMedia(prev => prev.filter(m => m.id !== mediaId));
    
    if (deletedMedia) {
      toast.success(`${deletedMedia.originalName} removed successfully`);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Check due status for a student and template
  const checkDueStatus = async (studentId: string | null | undefined, templateId: string | null | undefined) => {
    if (!studentId || !templateId) {
      console.error('Cannot check due status: studentId or templateId is null');
      return { due: false, nextDueDate: null, lastReportDate: null, timezone: 'UTC', frequency: 'Unknown' };
    }
    
    try {
      const dueStatus = await reportService.checkDueStatus(studentId, templateId);
      setDueStatusData(prev => ({
        ...prev,
        [studentId]: {
          ...prev[studentId],
          [templateId]: dueStatus
        }
      }));
      return dueStatus;
    } catch (error) {
      console.error('Error checking due status:', error);
      // If we can't check due status, assume it's due (fail open)
      return { due: true, nextDueDate: null, lastReportDate: null, timezone: 'UTC', frequency: 'Unknown' };
    }
  };

  // Check if any template is due for a student
  const isAnyTemplateDue = (studentId: string | null | undefined) => {
    if (!studentId) return false;
    const studentDueData = dueStatusData[studentId];
    if (!studentDueData) return false;
    return Object.values(studentDueData).some(status => status.due);
  };

  // SIMPLIFIED: Use centralized backend calculator to check if report can be generated
  const openReportDialog = async (student: any) => {
    console.log('🔍 openReportDialog called for student:', student);
    
    if (!student || !student._id) {
      console.error('Cannot open report dialog: student is null or missing _id');
      toast.error('Student information is missing. Please try again.');
      return;
    }
    
    // Get templates for this student's grade
    const studentGrade = student.grade || '';
    const gradeTemplates = reportTemplates.filter(template => 
      areGradesEqual(template.grade, studentGrade) && template.isActive
    );
    
    if (gradeTemplates.length === 0) {
      toast.error(`No active templates found for grade: ${formatGradeForDisplay(student.grade)}`);
      return;
    }
    
    // Check each template with centralized backend
    let canGenerateAny = false;
    let blockReasons: string[] = [];
    
    for (const template of gradeTemplates) {
      try {
        const result = await apiService.canGenerateReport(student._id, template._id);
        if (result.success && result.data?.canGenerate) {
          canGenerateAny = true;
          break; // At least one template is available
        } else if (result.data?.reason) {
          blockReasons.push(result.data.reason);
        }
      } catch (error) {
        console.error(`Error checking if can generate for template ${template.name}:`, error);
      }
    }
    
    if (!canGenerateAny) {
      console.log('🚫 Report dialog blocked - cannot generate any templates');
      const reason = blockReasons.length > 0 
        ? blockReasons[0] 
        : 'Cannot generate report at this time. Please check if reports have already been generated.';
      toast.error(reason);
      return;
    }
    
    console.log('✅ Can generate report - opening dialog');
    setSelectedStudent(student);
    
    await autoSelectTemplateForStudent(student);
    
    // Generate a temporary report ID for media uploads
    const tempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    setTempReportId(tempId);
    
    setShowQuickReportDialog(true);
  };

  // Get information about existing reports for current period
  const getExistingReportInfo = (student: any) => {
    if (!student || !reportTemplates.length) return null;
    
    // Get ALL reports for this student (not just current teacher's reports)
    const allStudentReports = reports.filter(r => {
      const reportStudentId = typeof r.studentId === 'string' ? r.studentId : (r.studentId && r.studentId._id);
      return reportStudentId === student._id;
    });
    
    const studentGrade = student.grade || '';
    const gradeTemplates = reportTemplates.filter(template => 
      areGradesEqual(template.grade, studentGrade) && template.isActive
    );
    
    // Find existing reports for current period
    const existingReports = [];
    for (const template of gradeTemplates) {
      const currentPeriodReport = getReportForCurrentPeriod(allStudentReports, template.reportFrequency, new Date());
      if (currentPeriodReport) {
        const teacherName = currentPeriodReport.teacherId?.firstName && currentPeriodReport.teacherId?.lastName 
          ? `${currentPeriodReport.teacherId.firstName} ${currentPeriodReport.teacherId.lastName}`
          : 'Unknown Teacher';
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

  // Check if student has a report for current period (any status) - checks ALL reports, not just current teacher's
  const hasCurrentPeriodReport = (student: any) => {
    const existingReports = getExistingReportInfo(student);
    return existingReports !== null && existingReports.length > 0;
  };

  // Get templates that don't have existing reports for current period (cross-teacher check)
  const getAvailableTemplatesForStudent = async (student: any) => {
    if (!student) return [];
    
    try {
      const response = await apiService.getAvailableTemplatesForStudent(student._id);
      if (response.success && response.data) {
        // Return only templates that are available (not already generated by any teacher)
        return response.data.availableTemplates
          .filter(template => template.isAvailable)
          .map(template => ({
            _id: template._id,
            name: template.name,
            reportFrequency: template.reportFrequency,
            grade: template.grade,
            isActive: true,
            schoolId: '',
            content: '',
            createdBy: '',
            lastModified: new Date(),
            createdAt: new Date(),
            updatedAt: new Date()
          } as any));
      } else {
        console.error('Failed to get available templates:', response.error);
        // Fallback to local filtering if API fails
        return getLocalAvailableTemplatesForStudent(student);
      }
    } catch (error) {
      console.error('Error getting available templates:', error);
      // Fallback to local filtering if API fails
      return getLocalAvailableTemplatesForStudent(student);
    }
  };

  // Fallback local filtering method (original logic)
  const getLocalAvailableTemplatesForStudent = (student: any) => {
    if (!student || !reportTemplates.length) return [];
    
    const studentGrade = student.grade || '';
    const gradeTemplates = reportTemplates.filter(template => 
      areGradesEqual(template.grade, studentGrade) && template.isActive
    );
    
    // Get existing reports for current period (check ALL teachers' reports)
    // Business Rule: Only ONE report per student per period, regardless of teacher
    const allStudentReports = reports.filter(r => {
      const reportStudentId = typeof r.studentId === 'string' ? r.studentId : (r.studentId && r.studentId._id);
      return reportStudentId === student._id;
    });
    
    const existingReports = [];
    for (const template of gradeTemplates) {
      const currentPeriodReport = getReportForCurrentPeriod(allStudentReports, template.reportFrequency, new Date());
      if (currentPeriodReport) {
        existingReports.push(template.reportFrequency);
      }
    }
    
    // Filter out templates that already have reports from ANY teacher
    return gradeTemplates.filter(template => 
      !existingReports.includes(template.reportFrequency)
    );
  };

  // Get templates that are actually due (not just available) for current period
  const getDueTemplatesForStudent = async (student: any) => {
    if (!student) return [];
    
    try {
      const response = await apiService.getAvailableTemplatesForStudent(student._id);
      if (response.success && response.data) {
        // Get available templates from the cross-teacher check
        const availableTemplates = response.data.availableTemplates
          .filter(template => template.isAvailable)
          .map(template => ({
            _id: template._id,
            name: template.name,
            reportFrequency: template.reportFrequency,
            grade: template.grade,
            isActive: true,
            schoolId: '',
            content: '',
            createdBy: '',
            lastModified: new Date(),
            createdAt: new Date(),
            updatedAt: new Date()
          } as any));

        // From the available templates, find which ones are actually due
        const studentDueReports = getStudentDueReports(student._id);
        const dueTemplateIds = studentDueReports.map(dr => dr.templateId);
        
        return availableTemplates.filter(template => 
          dueTemplateIds.includes(template._id)
        );
      } else {
        console.error('Failed to get available templates for due check:', response.error);
        // Fallback to local filtering if API fails
        return getLocalDueTemplatesForStudent(student);
      }
    } catch (error) {
      console.error('Error getting due templates:', error);
      // Fallback to local filtering if API fails
      return getLocalDueTemplatesForStudent(student);
    }
  };

  // Fallback local due templates method (original logic)
  const getLocalDueTemplatesForStudent = (student: any) => {
    if (!student || !reportTemplates.length) return [];
    
    const studentGrade = student.grade || '';
    const gradeTemplates = reportTemplates.filter(template => 
      areGradesEqual(template.grade, studentGrade) && template.isActive
    );
    
    // Get existing reports for current period (check ALL teachers' reports)
    // Business Rule: Only ONE report per student per period, regardless of teacher
    const allStudentReports = reports.filter(r => {
      const reportStudentId = typeof r.studentId === 'string' ? r.studentId : (r.studentId && r.studentId._id);
      return reportStudentId === student._id;
    });
    
    const existingReports = [];
    for (const template of gradeTemplates) {
      const currentPeriodReport = getReportForCurrentPeriod(allStudentReports, template.reportFrequency, new Date());
      if (currentPeriodReport) {
        existingReports.push(template.reportFrequency);
      }
    }
    
    // Filter out templates that already have reports from ANY teacher
    const availableTemplates = gradeTemplates.filter(template => 
      !existingReports.includes(template.reportFrequency)
    );

    // From the available templates, find which ones are actually due
    const studentDueReports = getStudentDueReports(student._id);
    const dueTemplateIds = studentDueReports.map(dr => dr.templateId);
    
    return availableTemplates.filter(template => 
      dueTemplateIds.includes(template._id)
    );
  };

  // Check if a specific template is due for a student
  const isTemplateDueForStudent = (student: any, template: any): boolean => {
    if (!student || !template) return false;
    
    const studentDueReports = getStudentDueReports(student._id);
    return studentDueReports.some(dr => dr.templateId === template._id);
  };

  // Pre-check due status for all students when component loads
  useEffect(() => {
    const preCheckDueStatus = async () => {
      if (teacherStudents.length === 0 || reportTemplates.length === 0) {
        return;
      }

      setIsCheckingDueStatus(true);
      try {
        const dueChecks = [];
        
        for (const student of teacherStudents) {
          if (!student || !student._id) {
            console.warn('Skipping student with null _id:', student);
            continue;
          }
          
          const studentGrade = student.grade || '';
          const applicableTemplates = reportTemplates.filter(template => 
            areGradesEqual(template.grade, studentGrade) && template.isActive
          );
          
          for (const template of applicableTemplates) {
            if (!template || !template._id) {
              console.warn('Skipping template with null _id:', template);
              continue;
            }
            
            dueChecks.push(
              checkDueStatus(student._id, template._id)
            );
          }
        }
        
        await Promise.all(dueChecks);
      } catch (error) {
        console.error('Error pre-checking due status:', error);
      } finally {
        setIsCheckingDueStatus(false);
      }
    };

    preCheckDueStatus();
    // We intentionally only re-run when the count of students or templates
    // changes; depending on the full arrays would cause excessive re-runs as
    // their references update on every refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teacherStudents.length, reportTemplates.length]); // Only run when students or templates change

  // Check due reports and create notifications
  const checkDueReportsForNotifications = async () => {
    try {
      const result = await reportService.checkDueReports();
      if (result.created > 0) {
        toast.success(`${result.created} notification(s) created for due reports`);
      } else {
        toast.success('No new due reports found');
      }
    } catch (error) {
      console.error('Error checking due reports:', error);
      toast.error('Failed to check due reports');
    }
  };

  // Force refresh due reports calculation
  const forceRefreshDueReports = () => {
    console.log('🔍 Force refreshing due reports calculation');
    // This will trigger the useMemo to recalculate
    setSearchTerm(prev => prev); // Force a re-render
  };

  // Manual check for due reports
  // Refresh due reports from centralized backend calculator
  const handleCheckDueReports = async () => {
    try {
      setChecking(true);
      toast.loading('Checking for due reports...', { id: 'checking-due-reports' });

      const response = await apiService.getDueReports();

      if (response.success) {
        const dueReports = response.data?.dueReports ?? [];
        const count = response.data?.count ?? dueReports.length;
        setDueReportsFromBackend(Array.isArray(dueReports) ? dueReports : []);

        if (count > 0) {
          toast.success(`Found ${count} due report(s)!`, { id: 'checking-due-reports' });
        } else {
          toast.success('No due reports at this time!', { id: 'checking-due-reports' });
        }
      } else {
        const message = response.error || response.message || 'Failed to check due reports';
        toast.error(message, { id: 'checking-due-reports' });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error checking due reports';
      console.error('❌ Error checking due reports:', error);
      toast.error(message, { id: 'checking-due-reports' });
    } finally {
      setChecking(false);
    }
  };

  return (
    <Container maxWidth="xl">
      {/* School Banner */}
      {schoolBranding && (() => {
        const primaryColor = schoolBranding.branding?.primaryColor || schoolBranding.primaryColor || '#273890';
        const secondaryColor = schoolBranding.branding?.secondaryColor || schoolBranding.secondaryColor || '#7f0f4a';
        
        return (
          <Card sx={{ 
            mb: 3,
            mt: 2,
            background: `linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%)`,
            borderRadius: '16px !important',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            overflow: 'hidden',
            position: 'relative',
          }}>
            <CardContent sx={{ p: 4 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 3 }}>
                <Box sx={{ flex: 1, minWidth: '300px' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                    <Typography variant="h4" sx={{ 
                      fontWeight: 700, 
                      color: 'white',
                      textShadow: '0 2px 4px rgba(0,0,0,0.2)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                    }}>
                      {schoolBranding.schoolName || schoolBranding.name || 'School Name'}
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
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {schoolBranding.address && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="body2" sx={{ color: 'white', opacity: 0.95, display: 'flex', alignItems: 'center', gap: 1 }}>
                          📍 {typeof schoolBranding.address === 'string' ? schoolBranding.address : [schoolBranding.address?.street, schoolBranding.address?.city, schoolBranding.address?.state, schoolBranding.address?.zipCode, schoolBranding.address?.country].filter(Boolean).join(', ')}
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
                          alt={schoolBranding.schoolName || schoolBranding.name || 'School Logo'}
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                          sx={{
                            maxWidth: '100%',
                            maxHeight: '100%',
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

      {/* Header */}
      <Fade in timeout={800}>
        <Box sx={{ mb: 4 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
            <Box>
              <Typography 
                variant="h4" 
                gutterBottom
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
                My Students
              </Typography>
              <Typography 
                variant="body1" 
                sx={{ 
                  color: 'text.secondary',
                  opacity: 0.8,
                  fontWeight: 500,
                }}
              >
                Manage and track your assigned students
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
              <Button
                variant="outlined"
                startIcon={checking ? <CircularProgress size={16} /> : <Refresh />}
                onClick={handleCheckDueReports}
                disabled={checking}
                sx={{
                  borderRadius: 2,
                  textTransform: 'none',
                  fontWeight: 600,
                  borderColor: schoolBranding?.branding?.primaryColor || '#667eea',
                  color: schoolBranding?.branding?.primaryColor || '#667eea',
                  '&:hover': {
                    borderColor: schoolBranding?.branding?.primaryColor || '#667eea',
                    bgcolor: `${schoolBranding?.branding?.primaryColor || '#667eea'}10`,
                  },
                }}
              >
                {checking ? 'Checking...' : 'Check Due Reports'}
              </Button>
              <NotificationIcon />
            </Box>
          </Box>
        </Box>
      </Fade>



      {/* Due Reports Notifications */}
      {dueReports.length > 0 && (
        <Grow in timeout={600}>
          <Alert 
            severity="warning" 
            sx={{ mb: 3 }}
            action={
              <Button 
                color="inherit" 
                size="small"
                onClick={() => setShowNotifications(!showNotifications)}
              >
                {showNotifications ? 'Hide' : 'View'} Details
              </Button>
            }
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Notifications />
              <Typography variant="body1" sx={{ fontWeight: 600 }}>
                {dueReports.length} report{dueReports.length > 1 ? 's' : ''} due for your students
              </Typography>
            </Box>
          </Alert>
        </Grow>
      )}

      {/* Due Reports Details */}
      {showNotifications && dueReports.length > 0 && (
        <Grow in timeout={700}>
          <Card sx={{ mb: 3, borderRadius: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Schedule />
                Due Reports
              </Typography>
              <List>
                {dueReports.map((dueReport: DueReport, index: number) => (
                  <React.Fragment key={`${dueReport.studentId}-${dueReport.templateId}`}>
                    <ListItem>
                      <ListItemIcon>
                        <Avatar sx={{ bgcolor: getDueStatusColor(dueReport.daysOverdue) }}>
                          <Assignment />
                        </Avatar>
                      </ListItemIcon>
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="body1" sx={{ fontWeight: 600 }}>
                              {dueReport.studentName}
                            </Typography>
                            <Chip 
                              label={dueReport.templateName} 
                              size="small" 
                              color="primary" 
                              variant="outlined"
                            />
                          </Box>
                        }
                        secondary={
                          <Box>
                            <Typography variant="body2" color="text.secondary">
                              {dueReport.frequency} Report • Due: {formatDateInSchoolTimezone(dueReport.dueDate)}
                            </Typography>
                            <Typography 
                              variant="body2" 
                              color={getDueStatusColor(dueReport.daysOverdue)}
                              sx={{ fontWeight: 600 }}
                            >
                              {getDueStatusText(dueReport.daysOverdue)}
                            </Typography>
                          </Box>
                        }
                      />
                      <Button 
                        variant="contained" 
                        size="small"
                        startIcon={<Assessment />}
                        sx={{ 
                          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                          '&:hover': {
                            background: 'linear-gradient(135deg, #5a6fd8 0%, #6a4190 100%)',
                          }
                        }}
                      >
                        Generate Report
                      </Button>
                    </ListItem>
                    {index < dueReports.length - 1 && <Divider />}
                  </React.Fragment>
                ))}
              </List>
            </CardContent>
          </Card>
        </Grow>
      )}

      {/* Stats Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grow in timeout={800}>
          <Grid item xs={12} sm={6} md={3}>
            <Paper
              elevation={0}
              sx={{
                background: getRandomCardColor(0),
                borderRadius: 4,
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(255,255,255,0.3)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: '0 12px 40px rgba(0,0,0,0.15)',
                },
              }}
            >
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <Avatar 
                    sx={{ 
                      background: 'linear-gradient(135deg, #1976d2 0%, #1565c0 100%)',
                      mr: 2,
                      width: 48,
                      height: 48,
                    }}
                  >
                    <People />
                  </Avatar>
                  <Box>
                    <Typography variant="h4" sx={{ fontWeight: 700 }}>
                      {teacherStudents.length}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Total Students
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Paper>
          </Grid>
        </Grow>

        <Grow in timeout={900}>
          <Grid item xs={12} sm={6} md={3}>
            <Paper
              elevation={0}
              sx={{
                background: getRandomCardColor(1),
                borderRadius: 4,
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(255,255,255,0.3)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: '0 12px 40px rgba(0,0,0,0.15)',
                },
              }}
            >
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <Avatar 
                    sx={{ 
                      background: 'linear-gradient(135deg, #2e7d32 0%, #1b5e20 100%)',
                      mr: 2,
                      width: 48,
                      height: 48,
                    }}
                  >
                    <Assessment />
                  </Avatar>
                  <Box>
                    <Typography variant="h4" sx={{ fontWeight: 700 }}>
                      {teacherReports.length}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Reports Generated
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Paper>
          </Grid>
        </Grow>

        <Grow in timeout={1000}>
          <Grid item xs={12} sm={6} md={3}>
            <Paper
              elevation={0}
              sx={{
                background: getRandomCardColor(2),
                borderRadius: 4,
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(255,255,255,0.3)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: '0 12px 40px rgba(0,0,0,0.15)',
                },
              }}
            >
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <Avatar 
                    sx={{ 
                      background: 'linear-gradient(135deg, #ed6c02 0%, #e65100 100%)',
                      mr: 2,
                      width: 48,
                      height: 48,
                    }}
                  >
                    <CheckCircle />
                  </Avatar>
                  <Box>
                    <Typography variant="h4" sx={{ fontWeight: 700 }}>
                      {completedReports.length}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Completed Reports
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Paper>
          </Grid>
        </Grow>

        <Grow in timeout={1100}>
          <Grid item xs={12} sm={6} md={3}>
            <Paper
              elevation={0}
              sx={{
                background: getRandomCardColor(3),
                borderRadius: 4,
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(255,255,255,0.3)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: '0 12px 40px rgba(0,0,0,0.15)',
                },
              }}
            >
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <Badge badgeContent={dueReports.length} color="error">
                    <Avatar 
                      sx={{ 
                        background: 'linear-gradient(135deg, #9c27b0 0%, #7b1fa2 100%)',
                        mr: 2,
                        width: 48,
                        height: 48,
                      }}
                    >
                      <Warning />
                    </Avatar>
                  </Badge>
                  <Box>
                    <Typography variant="h4" sx={{ fontWeight: 700 }}>
                      {dueReports.length}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Due Reports
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Paper>
          </Grid>
        </Grow>
      </Grid>

      {/* Search and Filters */}
      <Box sx={{ mb: 3 }}>
        <TextField
          fullWidth
          placeholder="Search students by name, grade, or class..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search />
              </InputAdornment>
            ),
          }}
          sx={{
            '& .MuiOutlinedInput-root': {
              borderRadius: 3,
              backgroundColor: 'rgba(255,255,255,0.8)',
              backdropFilter: 'blur(10px)',
            },
          }}
        />
      </Box>

      {/* Students Table */}
      <Grow in timeout={1200}>
        <Paper
          elevation={0}
          sx={{
            background: 'rgba(255,255,255,0.8)',
            borderRadius: 4,
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255,255,255,0.3)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
            overflow: 'hidden',
          }}
        >
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow sx={{ backgroundColor: 'rgba(102, 126, 234, 0.05)' }}>
                  <TableCell sx={{ fontWeight: 600 }}>Student</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Grade</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Class</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Reports</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Due Reports</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredStudents.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                      <Box sx={{ textAlign: 'center' }}>
                        <People sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
                        <Typography variant="h6" color="text.secondary" gutterBottom>
                          {teacherStudents.length === 0 ? 'No students assigned yet' : 'No students found'}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {teacherStudents.length === 0 
                            ? 'Students will be assigned to you by the school admin.'
                            : 'Try adjusting your search criteria.'
                          }
                        </Typography>
                      </Box>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredStudents.map((student) => {
                    const studentReports = getStudentReports(student._id);
                    const studentStatus = getStudentStatus(student);
                    const studentDueReports = getStudentDueReports(student._id);
                    
                    return (
                      <TableRow 
                        key={student._id}
                        hover
                        sx={{ 
                          cursor: 'pointer',
                          '&:hover': {
                            backgroundColor: 'rgba(102, 126, 234, 0.05)',
                          },
                        }}
                        onClick={() => handleStudentClick(student)}
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
                              {student.name.split(' ').map(n => n[0]).join('').toUpperCase()}
                            </Avatar>
                            <Box>
                              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                                {student.name}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {student.parentEmail || 'No parent email'}
                              </Typography>
                            </Box>
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Chip 
                            label={formatGradeForDisplay(student.grade)} 
                            size="small"
                            sx={{ 
                              backgroundColor: 'rgba(102, 126, 234, 0.1)',
                              color: '#667eea',
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            {student.studentClass || 'Not assigned'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip 
                            label={studentStatus.status}
                            size="small"
                            color={studentStatus.color as any}
                          />
                        </TableCell>
                        <TableCell>
                          <Tooltip 
                            title={
                              studentReports.length > 0 
                                ? `Reports: ${studentReports.filter(r => r.status === 'completed' || r.status === 'sent').length} completed, ${studentReports.filter(r => r.status === 'draft').length} draft`
                                : 'No reports generated yet'
                            }
                          >
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                {studentReports.length} Total
                              </Typography>
                              {studentReports.length > 0 && (
                                <Box sx={{ display: 'flex', gap: 1 }}>
                                  <Chip
                                    label={`${studentReports.filter(r => r.status === 'completed' || r.status === 'sent').length} Completed`}
                                    size="small"
                                    color="success"
                                    variant="outlined"
                                    sx={{ fontSize: '0.7rem', height: 20 }}
                                  />
                                  <Chip
                                    label={`${studentReports.filter(r => r.status === 'draft').length} Draft`}
                                    size="small"
                                    color="warning"
                                    variant="outlined"
                                    sx={{ fontSize: '0.7rem', height: 20 }}
                                  />
                                </Box>
                              )}
                              {/* Show indicator if report exists for current period */}
                              {hasCurrentPeriodReport(student) && (
                                <Box sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
                                  <Chip
                                    label="Current Period"
                                    size="small"
                                    color="info"
                                    icon={<CheckCircle sx={{ fontSize: 12 }} />}
                                    sx={{ 
                                      fontSize: '0.7rem', 
                                      height: 20,
                                      backgroundColor: 'rgba(25, 118, 210, 0.1)',
                                      color: '#1976d2',
                                      border: '1px solid rgba(25, 118, 210, 0.3)'
                                    }}
                                  />
                                </Box>
                              )}
                            </Box>
                          </Tooltip>
                        </TableCell>
                        <TableCell>
                          {studentDueReports.length > 0 ? (
                            <Tooltip 
                              title={
                                <Box>
                                  <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                                    Due Reports for {student.name}:
                                  </Typography>
                                  {studentDueReports.map((dr, index) => (
                                    <Box key={dr.templateId} sx={{ mb: 0.5 }}>
                                      <Typography variant="body2" component="div">
                                        <strong>{dr.templateName}</strong> ({dr.frequency})
                                        {dr.reportStatus === 'draft' && (
                                          <span style={{ color: '#ff9800' }}> - Draft available ({dr.daysOverdue} days old)</span>
                                        )}
                                        {dr.reportStatus === 'completed' && (
                                          <span style={{ color: '#2196f3' }}> - Ready to send ({dr.daysOverdue} days old)</span>
                                        )}
                                        {dr.reportStatus === 'missing' && (
                                          <span style={{ color: '#f44336' }}> - {dr.daysOverdue} days overdue</span>
                                        )}
                                      </Typography>
                                    </Box>
                                  ))}
                                </Box>
                              }
                            >
                              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                                <Typography variant="body2" sx={{ fontWeight: 600, color: 'error.main' }}>
                                  {studentDueReports.length} Due
                                </Typography>
                                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', maxWidth: 200 }}>
                                  {studentDueReports.map((dueReport: DueReport, index: number) => {
                                    let chipColor: 'error' | 'warning' | 'info' = 'error';
                                    let chipLabel: string = dueReport.frequency;
                                    let chipIcon = null;
                                    let chipVariant: 'filled' | 'outlined' = 'filled';
                                    
                                    if (dueReport.reportStatus === 'draft') {
                                      chipColor = 'warning';
                                      chipLabel = `${dueReport.frequency} (Draft)`;
                                      chipVariant = 'outlined';
                                    } else if (dueReport.reportStatus === 'completed') {
                                      chipColor = 'info';
                                      chipLabel = `${dueReport.frequency} (Ready)`;
                                      chipVariant = 'outlined';
                                    } else {
                                      chipColor = 'error';
                                      chipLabel = `${dueReport.frequency} (${dueReport.daysOverdue}d)`;
                                      chipVariant = 'filled';
                                    }
                                    
                                    return (
                                      <Chip
                                        key={dueReport.templateId}
                                        label={chipLabel}
                                        size="small"
                                        color={chipColor}
                                        variant={chipVariant}
                                        sx={{ 
                                          fontSize: '0.65rem', 
                                          height: 18,
                                          fontWeight: 600,
                                          '& .MuiChip-label': {
                                            px: 0.75
                                          },
                                          // Add pulsing animation for overdue reports
                                          ...(dueReport.reportStatus === 'missing' && dueReport.daysOverdue > 3 && {
                                            animation: 'pulse 2s infinite',
                                            '@keyframes pulse': {
                                              '0%': { opacity: 1 },
                                              '50%': { opacity: 0.7 },
                                              '100%': { opacity: 1 },
                                            },
                                          })
                                        }}
                                      />
                                    );
                                  })}
                                </Box>
                              </Box>
                            </Tooltip>
                          ) : (
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                              <Chip
                                label="Up to date"
                                size="small"
                                color="success"
                                variant="outlined"
                                sx={{ 
                                  fontWeight: 600,
                                  fontSize: '0.7rem'
                                }}
                              />
                              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.6rem' }}>
                                No reports due
                              </Typography>
                            </Box>
                          )}
                        </TableCell>
                        <TableCell>
                          <Tooltip 
                            title={`Generate report for ${student.name}. Template availability will be checked when you click.`}
                            arrow
                          >
                            <span> {/* Span wrapper needed for disabled button tooltip */}
                              <Button
                                variant="contained"
                                size="small"
                                startIcon={<Assessment />}
                                onClick={(e) => {
                                  e.stopPropagation(); // Prevent row click
                                  console.log('🔘 Generate Report button clicked for student:', student.name);
                                  openReportDialog(student);
                                }}
                                disabled={false} // Template availability will be checked when dialog opens
                            sx={{
                              background: schoolBranding 
                                ? `linear-gradient(135deg, ${schoolBranding.branding?.primaryColor || schoolBranding.primaryColor || '#667eea'} 0%, ${schoolBranding.branding?.secondaryColor || schoolBranding.secondaryColor || '#764ba2'} 100%)`
                                : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                              borderRadius: 2,
                              px: 2,
                              py: 0.5,
                              fontSize: '0.75rem',
                              fontWeight: 600,
                              textTransform: 'none',
                              minWidth: 140,
                              whiteSpace: 'nowrap',
                              justifyContent: 'center',
                              '& .MuiButton-startIcon': { 
                                minWidth: 24,
                                width: 24,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              },
                              boxShadow: schoolBranding 
                                ? `0 2px 8px ${schoolBranding.branding?.primaryColor || schoolBranding.primaryColor || '#667eea'}50`
                                : '0 2px 8px rgba(102, 126, 234, 0.3)',
                              '&:hover': {
                                background: schoolBranding 
                                  ? `linear-gradient(135deg, ${schoolBranding.branding?.primaryColor || schoolBranding.primaryColor || '#5a6fd8'} 0%, ${schoolBranding.branding?.secondaryColor || schoolBranding.secondaryColor || '#6a4190'} 100%)`
                                  : 'linear-gradient(135deg, #5a6fd8 0%, #6a4190 100%)',
                                boxShadow: schoolBranding 
                                  ? `0 4px 12px ${schoolBranding.branding?.primaryColor || schoolBranding.primaryColor || '#667eea'}60`
                                  : '0 4px 12px rgba(102, 126, 234, 0.4)',
                                transform: 'translateY(-1px)',
                              }
                            }}
                              >
                                Generate Report
                              </Button>
                            </span>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      </Grow>

      {/* Enhanced Student Details Dialog */}
      <Dialog 
        open={openStudentDialog} 
        onClose={handleCloseDialog}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            background: 'linear-gradient(135deg, #ffffff 0%, #f8f9ff 100%)',
            boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
            border: '1px solid rgba(255,255,255,0.2)',
          }
        }}
      >
        <DialogTitle
          sx={{
            background: schoolBranding 
              ? `linear-gradient(135deg, ${schoolBranding.branding?.primaryColor || schoolBranding.primaryColor || '#667eea'} 0%, ${schoolBranding.branding?.secondaryColor || schoolBranding.secondaryColor || '#764ba2'} 100%)`
              : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            borderRadius: '12px 12px 0 0',
            p: 3,
            position: 'relative',
            overflow: 'hidden',
            '&::before': {
              content: '""',
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'url("data:image/svg+xml,%3Csvg width="100" height="100" xmlns="http://www.w3.org/2000/svg"%3E%3Cdefs%3E%3Cpattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse"%3E%3Cpath d="M 10 0 L 0 0 0 10" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="0.5"/%3E%3C/pattern%3E%3C/defs%3E%3Crect width="100" height="100" fill="url(%23grid)"/%3E%3C/svg%3E")',
              opacity: 0.3,
            }
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Avatar 
              sx={{ 
                width: 56, 
                height: 56,
                background: 'rgba(255,255,255,0.2)',
                border: '2px solid rgba(255,255,255,0.3)',
                fontSize: '1.5rem',
                fontWeight: 600,
              }}
            >
              {selectedStudent?.name?.split(' ').map((n: string) => n[0]).join('').toUpperCase()}
            </Avatar>
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>
                {selectedStudent?.name}
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.9, fontWeight: 500 }}>
                Student Profile
              </Typography>
            </Box>
          </Box>
        </DialogTitle>
        
        <DialogContent sx={{ p: 3, pt: '24px !important' }}>
          {selectedStudent && (
            <Box>
              {/* Due Reports Section */}
              {getStudentDueReports(selectedStudent._id).length > 0 && (
                <Alert severity="warning" sx={{ mb: 3 }}>
                  <Typography variant="body1" sx={{ fontWeight: 600, mb: 1 }}>
                    Due Reports for {selectedStudent.name}
                  </Typography>
                  <List dense>
                    {getStudentDueReports(selectedStudent._id).map((dueReport: DueReport) => (
                      <ListItem 
                        key={dueReport.templateId}
                        sx={{ 
                          display: 'flex', 
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          px: 0
                        }}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                          <ListItemIcon sx={{ minWidth: 40 }}>
                            <Warning color="warning" />
                          </ListItemIcon>
                          <ListItemText
                            primary={dueReport.templateName}
                            secondary={`${dueReport.frequency} report due on ${formatDateInSchoolTimezone(dueReport.dueDate)}`}
                            sx={{ flex: 1 }}
                          />
                        </Box>
                        <Chip 
                          label={`${dueReport.daysOverdue} days overdue`}
                          size="small"
                          color="error"
                          variant="outlined"
                          sx={{ 
                            fontWeight: 600,
                            ml: 2,
                            flexShrink: 0
                          }}
                        />
                      </ListItem>
                    ))}
                  </List>
                </Alert>
              )}

              {/* Medical Safety Alert + Information */}
              <Box sx={{ mt: 3 }}>
                <MedicalInfoDisplay
                  value={(selectedStudent as any).medicalInfo}
                  emergencyContact={(selectedStudent as any).emergencyContact}
                  showSafetyAlert={true}
                />
              </Box>

              {/* Detailed Information */}
              <Grid container spacing={4} sx={{ mt: 3 }}>
                <Grid item xs={12} md={6}>
                  <Card
                    sx={{
                      borderRadius: 3,
                      background: 'rgba(255, 255, 255, 0.95)',
                      backdropFilter: 'blur(10px)',
                      border: '1px solid rgba(255,255,255,0.3)',
                      boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
                    }}
                  >
                    <CardContent sx={{ p: 3 }}>
                      <Typography 
                        variant="h6" 
                        gutterBottom 
                        sx={{ 
                          fontWeight: 700,
                          color: schoolBranding 
                            ? (schoolBranding.branding?.primaryColor || schoolBranding.primaryColor || '#667eea')
                            : '#667eea',
                          mb: 3,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1
                        }}
                      >
                        <Person sx={{ fontSize: 24 }} />
                        Personal Information
                      </Typography>
                      
                      <Box sx={{ space: 2 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 1.5, borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
                          <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.secondary' }}>
                            Full Name
                          </Typography>
                          <Typography variant="body1" sx={{ fontWeight: 500 }}>
                            {selectedStudent.name}
                          </Typography>
                        </Box>
                        
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 1.5, borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
                          <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.secondary' }}>
                            Grade Level
                          </Typography>
                          <Chip 
                            label={formatGradeForDisplay(selectedStudent.grade)} 
                            size="small"
                            sx={{ 
                              backgroundColor: 'rgba(102, 126, 234, 0.1)',
                              color: '#667eea',
                              fontWeight: 600,
                            }}
                          />
                        </Box>
                        
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 1.5, borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
                          <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.secondary' }}>
                            Class
                          </Typography>
                          <Typography variant="body1" sx={{ fontWeight: 500 }}>
                            {selectedStudent.studentClass || 'Not assigned'}
                          </Typography>
                        </Box>
                        
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 1.5 }}>
                          <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.secondary' }}>
                            Student ID
                          </Typography>
                          <Typography variant="body1" sx={{ fontWeight: 500, fontFamily: 'monospace' }}>
                            {selectedStudent._id}
                          </Typography>
                        </Box>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
                
                <Grid item xs={12} md={6}>
                  <Card
                    sx={{
                      borderRadius: 3,
                      background: 'rgba(255, 255, 255, 0.95)',
                      backdropFilter: 'blur(10px)',
                      border: '1px solid rgba(255,255,255,0.3)',
                      boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
                    }}
                  >
                    <CardContent sx={{ p: 3 }}>
                      <Typography 
                        variant="h6" 
                        gutterBottom 
                        sx={{ 
                          fontWeight: 700,
                          color: schoolBranding 
                            ? (schoolBranding.branding?.primaryColor || schoolBranding.primaryColor || '#667eea')
                            : '#667eea',
                          mb: 3,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1
                        }}
                      >
                        <Email sx={{ fontSize: 24 }} />
                        Contact Information
                      </Typography>
                      
                      <Box sx={{ space: 2 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 1.5, borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
                          <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.secondary' }}>
                            Parent Email
                          </Typography>
                          <Typography variant="body1" sx={{ fontWeight: 500 }}>
                            {selectedStudent.parentEmail || 'Not provided'}
                          </Typography>
                        </Box>
                        
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 1.5, borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
                          <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.secondary' }}>
                            Parent Phone
                          </Typography>
                          <Typography variant="body1" sx={{ fontWeight: 500 }}>
                            {selectedStudent.parentPhone || 'Not provided'}
                          </Typography>
                        </Box>
                        
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 1.5, borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
                          <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.secondary' }}>
                            Last Report
                          </Typography>
                          <Typography variant="body1" sx={{ fontWeight: 500 }}>
                            {selectedStudent.lastReport || 'Never'}
                          </Typography>
                        </Box>
                        
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 1.5 }}>
                          <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.secondary' }}>
                            Status
                          </Typography>
                          <Chip 
                            label={selectedStudent.status || 'Active'} 
                            size="small"
                            color={selectedStudent.status === 'active' ? 'success' : 'warning'}
                            sx={{ fontWeight: 600 }}
                          />
                        </Box>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            </Box>
          )}
        </DialogContent>
        
        <DialogActions sx={{ p: 3, pt: 0, gap: 2 }}>
          <Button 
            onClick={handleCloseDialog}
            variant="outlined"
            sx={{
              borderRadius: 2,
              px: 3,
              py: 1.5,
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
          
          {/* Show View Reports button if student has reports */}
          {getStudentReports(selectedStudent?._id).length > 0 && (
            <Button 
              variant="outlined"
              startIcon={<Visibility />}
              onClick={() => {
                // TODO: Open reports history view
                console.log('View reports for student:', selectedStudent?.name);
              }}
              sx={{
                borderRadius: 2,
                px: 3,
                py: 1.5,
                borderColor: '#4caf50',
                color: '#4caf50',
                '&:hover': {
                  borderColor: '#45a049',
                  backgroundColor: 'rgba(76, 175, 80, 0.05)',
                }
              }}
            >
              View Reports ({getStudentReports(selectedStudent?._id).length})
            </Button>
          )}
          
          {/* Primary action button - Generate Report */}
          <Button 
            variant="contained" 
            startIcon={<Assessment />}
            onClick={() => {
              if (selectedStudent) {
                openReportDialog(selectedStudent);
              }
            }}
            disabled={
              selectedStudent ? 
                hasCurrentPeriodReport(selectedStudent) || 
                getStudentDueReports(selectedStudent?._id || '').length === 0
              : false
            }
            sx={{
              borderRadius: 2,
              px: 4,
              py: 1.5,
              minWidth: 220,
              whiteSpace: 'nowrap',
              justifyContent: 'center',
              '& .MuiButton-startIcon': { 
                minWidth: 28,
                width: 28,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              },
              background: selectedStudent && (hasCurrentPeriodReport(selectedStudent) || getStudentDueReports(selectedStudent?._id || '').length === 0)
                ? 'linear-gradient(135deg, #ccc 0%, #999 100%)'
                : schoolBranding 
                  ? `linear-gradient(135deg, ${schoolBranding.branding?.primaryColor || schoolBranding.primaryColor || '#667eea'} 0%, ${schoolBranding.branding?.secondaryColor || schoolBranding.secondaryColor || '#764ba2'} 100%)`
                  : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              boxShadow: selectedStudent && (hasCurrentPeriodReport(selectedStudent) || getStudentDueReports(selectedStudent?._id || '').length === 0)
                ? '0 4px 16px rgba(0,0,0,0.1)'
                : schoolBranding 
                  ? `0 4px 16px ${schoolBranding.branding?.primaryColor || schoolBranding.primaryColor || '#667eea'}50`
                  : '0 4px 16px rgba(102, 126, 234, 0.3)',
              fontWeight: 600,
              '&:hover': {
                background: selectedStudent && (hasCurrentPeriodReport(selectedStudent) || getStudentDueReports(selectedStudent?._id || '').length === 0)
                  ? 'linear-gradient(135deg, #ccc 0%, #999 100%)'
                  : schoolBranding 
                    ? `linear-gradient(135deg, ${schoolBranding.branding?.primaryColor || schoolBranding.primaryColor || '#5a6fd8'} 0%, ${schoolBranding.branding?.secondaryColor || schoolBranding.secondaryColor || '#6a4190'} 100%)`
                    : 'linear-gradient(135deg, #5a6fd8 0%, #6a4190 100%)',
                boxShadow: selectedStudent && (hasCurrentPeriodReport(selectedStudent) || getStudentDueReports(selectedStudent?._id || '').length === 0)
                  ? '0 4px 16px rgba(0,0,0,0.1)'
                  : schoolBranding 
                    ? `0 6px 20px ${schoolBranding.branding?.primaryColor || schoolBranding.primaryColor || '#667eea'}60`
                    : '0 6px 20px rgba(102, 126, 234, 0.4)',
                transform: hasCurrentPeriodReport(selectedStudent) || getStudentDueReports(selectedStudent?._id || '').length === 0 ? 'none' : 'translateY(-1px)',
              }
            }}
          >
            {selectedStudent && hasCurrentPeriodReport(selectedStudent)
              ? (() => {
                  const existingReports = getExistingReportInfo(selectedStudent);
                  if (existingReports && existingReports.length > 0) {
                    const firstReport = existingReports[0];
                    return `Report Exists (${firstReport.teacher})`;
                  }
                  return 'Report Exists';
                })()
              : selectedStudent && getStudentDueReports(selectedStudent?._id || '').length === 0
                ? 'No Reports Due'
                : getStudentDueReports(selectedStudent?._id || '').length > 0 
                  ? `Generate Report (${getStudentDueReports(selectedStudent?._id || '').length} due)`
                  : 'Generate Report'
            }
          </Button>
        </DialogActions>
      </Dialog>

      {/* Quick Report Generation Dialog */}
      <Dialog
        open={showQuickReportDialog}
        onClose={handleCloseReportDialog}
        maxWidth="md"
        fullWidth
        TransitionComponent={Transition}
        PaperProps={{
          sx: {
            borderRadius: 3,
            background: 'linear-gradient(135deg, #ffffff 0%, #f8f9ff 100%)',
          }
        }}
      >
        <DialogTitle
          sx={{
            background: schoolBranding 
              ? `linear-gradient(135deg, ${schoolBranding.branding?.primaryColor || schoolBranding.primaryColor || '#667eea'} 0%, ${schoolBranding.branding?.secondaryColor || schoolBranding.secondaryColor || '#764ba2'} 100%)`
              : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
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
              {selectedStudent?.firstName?.[0]}{selectedStudent?.lastName?.[0]}
            </Avatar>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                Generate Report for {selectedStudent?.firstName} {selectedStudent?.lastName}
              </Typography>
              <Typography variant="body2" sx={{ opacity: 0.9 }}>
                Grade {selectedStudent?.grade} • {selectedTemplate?.name || 'No template found'}
              </Typography>
            </Box>
          </Box>
          <IconButton onClick={handleCloseReportDialog} sx={{ color: 'white' }}>
            <Close />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ p: 3, pt: '24px !important' }}>
          {!aiService.isConfigured() && (
            <Alert severity="warning" sx={{ mb: 3 }}>
              OpenAI API key not configured. Set it using: aiService.setApiKey('your-key')
            </Alert>
          )}

          {/* Template Selection */}
          <Paper sx={{ p: 3, mb: 3, bgcolor: 'grey.50', borderRadius: 2, border: '1px solid', borderColor: 'grey.200' }}>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'primary.main' }}>
              <Assessment />
              Select Report Template
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Choose the appropriate report template for this student. Different templates have different frequencies and focus areas.
            </Typography>
            
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel id="template-select-label">Report Template</InputLabel>
              <Select
                labelId="template-select-label"
                value={selectedTemplate?._id || ''}
                onChange={(e) => {
                  const templateId = e.target.value;
                  const template = reportTemplates.find(t => t._id === templateId);
                  if (template) {
                    const isDue = isTemplateDueForStudent(selectedStudent, template);
                    if (!isDue) {
                      toast.error(`${template.name} (${template.reportFrequency}) is not due yet. Only due reports can be generated.`);
                      return;
                    }
                    setSelectedTemplate(template);
                    // Extract key points from the selected template
                    const extractedKeyPoints = extractKeyPointsFromTemplate(template.content || '');
                    setKeyPoints(extractedKeyPoints);
                    console.log('🔍 Template selected:', template.name, 'Key points extracted:', extractedKeyPoints);
                    console.log('🔍 Template content:', template.content);
                  }
                }}
                label="Report Template"
                sx={{ borderRadius: 2 }}
              >
                {reportTemplates
                  .filter(template => areGradesEqual(template.grade, selectedStudent?.grade) && template.isActive)
                  .map((template) => {
                    const isDue = isTemplateDueForStudent(selectedStudent, template);
                    return (
                      <MenuItem 
                        key={template._id} 
                        value={template._id}
                        disabled={!isDue}
                        sx={{
                          opacity: isDue ? 1 : 0.5,
                          '&.Mui-disabled': {
                            opacity: 0.5,
                          }
                        }}
                      >
                        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', width: '100%' }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                            <Typography 
                              variant="body1" 
                              sx={{ 
                                fontWeight: 600,
                                color: isDue ? 'text.primary' : 'text.disabled'
                              }}
                            >
                              {template.name}
                            </Typography>
                            {isDue ? (
                              <Chip 
                                label="DUE" 
                                size="small" 
                                color="error" 
                                variant="filled"
                                sx={{ 
                                  fontSize: '0.6rem', 
                                  height: 20,
                                  fontWeight: 600,
                                  ml: 1
                                }}
                              />
                            ) : (
                              <Chip 
                                label="NOT DUE" 
                                size="small" 
                                color="default" 
                                variant="outlined"
                                sx={{ 
                                  fontSize: '0.6rem', 
                                  height: 20,
                                  fontWeight: 600,
                                  ml: 1,
                                  opacity: 0.7
                                }}
                              />
                            )}
                          </Box>
                          <Typography 
                            variant="body2" 
                            sx={{ 
                              color: isDue ? 'text.secondary' : 'text.disabled'
                            }}
                          >
                            {template.reportFrequency} • {template.grade}
                            {!isDue && ' • Will be due later'}
                          </Typography>
                        </Box>
                      </MenuItem>
                    );
                  })}
              </Select>
            </FormControl>

            {selectedTemplate && (
              <Alert severity="success" sx={{ borderRadius: 2 }}>
                <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
                  Selected: {selectedTemplate.name}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Frequency: {selectedTemplate.reportFrequency} • Grade: {selectedTemplate.grade}
                </Typography>
              </Alert>
            )}

            {/* Template availability info - disabled to prevent async calls in render
            {(() => {
              const availableTemplates = getAvailableTemplatesForStudent(selectedStudent);
              const dueTemplates = getDueTemplatesForStudent(selectedStudent);
              const allGradeTemplates = reportTemplates.filter(template => 
                template.isActive && 
                areGradesEqual(template.grade, selectedStudent?.grade)
              );
              
              if (allGradeTemplates.length === 0) {
                return (
                  <Alert severity="warning" sx={{ borderRadius: 2 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
                      No Templates Available
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      No active templates found for Grade {selectedStudent?.grade}. Please contact your school admin to set up report templates.
                    </Typography>
                  </Alert>
                );
              }
              
              if (availableTemplates.length === 0) {
                const existingReports = getExistingReportInfo(selectedStudent) || [];
                const existingReportDetails = existingReports.map(r => `${r.template} (${r.frequency})`).join(', ');
                return (
                  <Alert severity="info" sx={{ borderRadius: 2 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
                      All Reports Already Generated
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      All available report types for Grade {selectedStudent?.grade} have already been generated for the current period: {existingReportDetails}
                    </Typography>
                  </Alert>
                );
              }
              
              if (dueTemplates.length === 0 && availableTemplates.length > 0) {
                return (
                  <Alert severity="warning" sx={{ borderRadius: 2 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
                      No Reports Due Yet
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {availableTemplates.length} template(s) are available for Grade {selectedStudent?.grade}, but none are due yet. 
                      Reports can only be generated when they are due according to the school's frequency settings.
                    </Typography>
                  </Alert>
                );
              }
              
              if (dueTemplates.length > 0) {
                const dueTemplateNames = dueTemplates.map(t => `${t.name} (${t.reportFrequency})`).join(', ');
                const notDueCount = availableTemplates.length - dueTemplates.length;
                return (
                  <Alert severity="success" sx={{ borderRadius: 2 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
                      {dueTemplates.length} Report(s) Due Now
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Due: {dueTemplateNames}
                      {notDueCount > 0 && ` • ${notDueCount} other template(s) not due yet`}
                    </Typography>
                  </Alert>
                );
              }
              
              return null;
            })()
            */}
            
            {selectedTemplate ? (
              <Alert severity="success" sx={{ borderRadius: 2 }}>
                <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
                  Template Selected: {selectedTemplate.name}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Frequency: {selectedTemplate.reportFrequency} for Grade {selectedStudent?.grade}
                </Typography>
              </Alert>
            ) : (
              <Alert severity="info" sx={{ borderRadius: 2 }}>
                <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
                  Template Information
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Template availability checked when dialog opened. Cross-teacher filtering ensures no duplicate reports.
                </Typography>
              </Alert>
            )}
          </Paper>

          {/* Instructions */}
          <Alert severity="info" sx={{ mb: 3 }}>
            <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
              How to generate a report:
            </Typography>
            <Typography variant="body2" component="div">
              1. <strong>Select Template:</strong> Choose from due reports above (templates not due yet are disabled)
              <br />
              2. <strong>Review Key Points:</strong> Check the key areas below that you should observe and talk about
              <br />
              3. <strong>Voice Recording:</strong> Record your observations using the microphone
              <br />
              4. <strong>Generate:</strong> Click "Generate Report with AI" to create an intelligent report
              <br />
              <br />
              <strong>Note:</strong> Only reports that are due according to your school's frequency settings can be generated. 
              This ensures proper scheduling and prevents duplicate reports.
            </Typography>
          </Alert>

          <Stack spacing={3}>
            {/* Key Points Section */}
            {selectedTemplate ? (
              <Paper sx={{ p: 3, bgcolor: 'primary.50', borderRadius: 2, border: '1px solid', borderColor: 'primary.200' }}>
                <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'primary.main' }}>
                  <Star />
                  Key Points to Observe & Discuss
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Based on the selected template "{selectedTemplate.name}", here are the key areas you should observe and talk about:
                </Typography>
                <Box sx={{ pl: 1 }}>
                  {keyPoints.length > 0 ? keyPoints.map((keyPoint, index) => (
                    <Box key={index} sx={{ mb: 2 }}>
                      {/* Main heading */}
                      <FormControlLabel
                        control={
                          <Checkbox 
                            size="small"
                            sx={{ 
                              color: 'primary.main',
                              '&.Mui-checked': {
                                color: 'primary.main',
                              }
                            }}
                          />
                        }
                        label={
                          <Typography variant="body2" sx={{ fontWeight: 600, color: 'primary.dark' }}>
                            {keyPoint.main}
                          </Typography>
                        }
                        sx={{ 
                          mb: keyPoint.subPoints.length > 0 ? 1 : 0.5,
                          '& .MuiFormControlLabel-label': {
                            fontSize: '0.875rem'
                          }
                        }}
                      />
                      
                      {/* Sub-points */}
                      {keyPoint.subPoints.length > 0 && (
                        <Box sx={{ ml: 4, pl: 1, borderLeft: '2px solid', borderColor: 'primary.light' }}>
                          <FormGroup>
                            {keyPoint.subPoints.map((subPoint, subIndex) => (
                              <FormControlLabel
                                key={subIndex}
                                control={
                                  <Checkbox 
                                    size="small"
                                    sx={{ 
                                      color: 'primary.light',
                                      '&.Mui-checked': {
                                        color: 'primary.main',
                                      }
                                    }}
                                  />
                                }
                                label={
                                  <Typography variant="body2" sx={{ fontWeight: 400, color: 'text.secondary' }}>
                                    {subPoint}
                                  </Typography>
                                }
                                sx={{ 
                                  mb: 0.25,
                                  '& .MuiFormControlLabel-label': {
                                    fontSize: '0.8rem'
                                  }
                                }}
                              />
                            ))}
                          </FormGroup>
                        </Box>
                      )}
                    </Box>
                  )) : (
                    <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic', py: 2 }}>
                      No specific key points found in this template. Use your professional judgment to observe and report on the student's development.
                    </Typography>
                  )}
                </Box>
                <Alert severity="info" sx={{ mt: 2, fontSize: '0.8rem' }}>
                  <Typography variant="caption">
                    💡 <strong>Tip:</strong> Use these points as a checklist while recording your observations. 
                    Try to address each area for a comprehensive report.
                  </Typography>
                </Alert>
              </Paper>
            ) : (
              <Paper sx={{ p: 3, bgcolor: 'grey.100', borderRadius: 2, border: '1px dashed', borderColor: 'grey.300' }}>
                <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'text.secondary' }}>
                  <Star />
                  Key Points to Observe & Discuss
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                  Please select a report template above to see the key areas you should observe and discuss.
                </Typography>
              </Paper>
            )}
            {/* Voice Recording Section */}
            {selectedTemplate && (
              <Paper sx={{ p: 3, bgcolor: 'grey.50', borderRadius: 2 }}>
                <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Mic />
                  Voice Recording
                </Typography>
              
              <Box sx={{ textAlign: 'center', mb: 2 }}>
                {!isRecording && (
                  <Button
                    variant="contained"
                    startIcon={<Mic />}
                    onClick={startRecording}
                    size="large"
                    sx={{
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      borderRadius: 3,
                      px: 4,
                      py: 2,
                    }}
                  >
                    Start Recording
                  </Button>
                )}
                
                {isRecording && (
                  <Box>
                    <Typography variant="h5" color="error" sx={{ mb: 2 }}>
                      Recording: {formatTime(recordingTime)}
                    </Typography>
                    <Button
                      variant="contained"
                      color="error"
                      startIcon={<Stop />}
                      onClick={stopRecording}
                      size="large"
                    >
                      Stop Recording
                    </Button>
                  </Box>
                )}

                {recordings.length > 0 && (
                  <Box>
                    <Typography variant="h6" gutterBottom>
                      Recordings ({recordings.length})
                    </Typography>
                    {recordings.map((recording, index) => (
                      <Box key={recording.id} sx={{ mb: 2, p: 2, border: '1px solid #e0e0e0', borderRadius: 2 }}>
                        <Typography variant="body2" sx={{ mb: 1 }}>
                          Recording {index + 1}: {formatTime(recording.duration)}
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
                          <Button
                            variant={playingRecordingId === recording.id ? "contained" : "outlined"}
                            size="small"
                            startIcon={playingRecordingId === recording.id ? <Pause /> : <PlayArrow />}
                            color={playingRecordingId === recording.id ? "primary" : "inherit"}
                            onClick={() => {
                              if (audioRef.current) {
                                if (playingRecordingId === recording.id) {
                                  // Pause if currently playing this recording
                                  audioRef.current.pause();
                                  setPlayingRecordingId(null);
                                } else {
                                  // Play this recording
                                  // Convert URL if it's a server path (not a blob URL)
                                  let audioUrl = recording.url;
                                  if (audioUrl && !audioUrl.startsWith('blob:') && !audioUrl.startsWith('http://') && !audioUrl.startsWith('https://')) {
                                    // It's a relative server path, convert to absolute URL
                                    const baseUrl = (process.env.REACT_APP_API_URL || 'http://localhost:5050').replace('/api', '');
                                    audioUrl = audioUrl.startsWith('/') ? `${baseUrl}${audioUrl}` : `${baseUrl}/${audioUrl}`;
                                  }
                                  audioRef.current.src = audioUrl;
                                  audioRef.current.play();
                                  setPlayingRecordingId(recording.id);
                                }
                              }
                            }}
                          >
                            {playingRecordingId === recording.id ? 'Pause' : 'Play'}
                          </Button>
                          <Button
                            variant="outlined"
                            color="error"
                            size="small"
                            startIcon={<Delete />}
                            onClick={() => {
                              setRecordings(prev => prev.filter(r => r.id !== recording.id));
                              if (recordings.length === 1) {
                                setTranscription('');
                              }
                              if (playingRecordingId === recording.id) {
                                setPlayingRecordingId(null);
                                if (audioRef.current) {
                                  audioRef.current.pause();
                                }
                              }
                            }}
                          >
                            Delete
                          </Button>
                        </Box>
                      </Box>
                    ))}
                    <Button
                      variant="contained"
                      startIcon={<AutoFixHigh />}
                      onClick={transcribeAudio}
                      disabled={isTranscribing || !aiService.isConfigured()}
                      sx={{
                        background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
                        mt: 2,
                      }}
                    >
                      {isTranscribing ? <CircularProgress size={20} /> : 'Transcribe All'}
                    </Button>
                  </Box>
                )}
              </Box>
              <audio 
                ref={audioRef} 
                style={{ display: 'none' }}
                onEnded={() => setPlayingRecordingId(null)}
                onPause={() => setPlayingRecordingId(null)}
              />
            </Paper>
            )}



            {/* Transcription Results Section */}
            {selectedTemplate && (
              <Paper sx={{ p: 3, bgcolor: 'blue.50', borderRadius: 2 }}>
                <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <AutoFixHigh />
                  Observations & Transcription
                </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {recordings.length > 0 
                  ? `Combined transcription from ${recordings.length} recording(s) - you can edit below`
                  : 'Type your observations about the student here or use voice recording above'
                }
              </Typography>
              <TextField
                fullWidth
                multiline
                rows={4}
                value={transcription}
                onChange={(e) => setTranscription(e.target.value)}
                placeholder="Type your observations about the student here... (e.g., 'Emma showed excellent participation in math today. She helped classmates with addition problems and demonstrated strong problem-solving skills.')"
                variant="outlined"
                sx={{ mb: 2 }}
              />
              <Box sx={{ display: 'flex', gap: 2 }}>
                <Button
                  variant="contained"
                  startIcon={<Assessment />}
                  onClick={generateReportFromTranscription}
                  disabled={isGeneratingReport || !transcription.trim()}
                  sx={{
                    background: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
                    color: 'black',
                    fontWeight: 600,
                  }}
                >
                  {isGeneratingReport ? <CircularProgress size={20} /> : 'Generate Report with AI'}
                </Button>
                {transcription.trim() && (
                  <Button
                    variant="outlined"
                    onClick={() => setTranscription('')}
                    sx={{ borderColor: '#f44336', color: '#f44336' }}
                  >
                    Clear
                  </Button>
                )}
              </Box>
            </Paper>
            )}

            {/* Report Content Section */}
            {selectedTemplate && (
              <Paper sx={{ p: 3, borderRadius: 2 }}>
                <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Assessment />
                  Report Content
                </Typography>
              <TextField
                fullWidth
                multiline
                rows={8}
                value={reportContent}
                onChange={(e) => setReportContent(e.target.value)}
                placeholder="AI-generated report will appear here, or you can type manually..."
                variant="outlined"
              />
            </Paper>
            )}

            {/* Media Upload Section */}
            {selectedTemplate && (
              <Paper sx={{ p: 3, bgcolor: 'green.50', borderRadius: 2, border: '1px solid', borderColor: 'green.200' }}>
                <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'green.700' }}>
                  <PhotoCamera />
                  Add Photos & Videos
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Upload photos and videos to enhance your report. You can add student work samples, classroom activities, or any relevant media.
                </Typography>
                <MediaUpload
                  reportId={currentReportId || tempReportId}
                  onMediaUploaded={handleMediaUploaded}
                  onMediaDeleted={handleMediaDeleted}
                  maxFiles={10}
                  acceptedTypes={['image', 'video']}
                  disabled={isSavingDraft || isSending}
                />
                
                {/* Media Upload Status */}
                {uploadedMedia.length > 0 && (
                  <Box sx={{ mt: 2, p: 2, bgcolor: 'success.50', borderRadius: 1, border: '1px solid', borderColor: 'success.200' }}>
                    <Typography variant="body2" sx={{ fontWeight: 600, color: 'success.700', mb: 1 }}>
                      📎 {uploadedMedia.length} file(s) ready to attach
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {uploadedMedia.map(m => m.originalName).join(', ')}
                    </Typography>
                  </Box>
                )}
                {!currentReportId && (
                  <Alert severity="info" sx={{ mt: 2 }}>
                    <Typography variant="body2">
                      💡 <strong>Tip:</strong> Media uploads are available immediately. They will be saved when you submit the report.
                    </Typography>
                  </Alert>
                )}
              </Paper>
            )}
          </Stack>
        </DialogContent>

        <DialogActions sx={{ p: 3, gap: 2 }}>
          <Button 
            onClick={handleCloseReportDialog} 
            variant="outlined" 
            size="large"
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
          {selectedTemplate && (
            <>
              <Button
                variant="outlined"
                startIcon={<CheckCircle />}
                onClick={saveReportAsDraft}
                disabled={(!reportContent.trim() && recordings.length === 0) || isSavingDraft}
                size="large"
                sx={{
                  borderColor: '#4caf50',
                  color: '#4caf50',
                  '&:hover': {
                    borderColor: '#45a049',
                    backgroundColor: 'rgba(76, 175, 80, 0.05)',
                  }
                }}
              >
                {isSavingDraft ? <CircularProgress size={20} /> : 'Send For Approval'}
              </Button>
              <Button
                variant="contained"
                startIcon={isSending ? null : <Send />}
                onClick={sendReportToParents}
                disabled={!teachers.find(t => (t._id === (user?.id || user?._id)) || (t.id === (user?.id || user?._id)))?.canEmailReports || isSending}
                size="large"
                sx={{
                  background: teachers.find(t => (t._id === (user?.id || user?._id)) || (t.id === (user?.id || user?._id)))?.canEmailReports
                    ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                    : 'linear-gradient(135deg, #cccccc 0%, #999999 100%)',
                  px: 4,
                  opacity: teachers.find(t => (t._id === (user?.id || user?._id)) || (t.id === (user?.id || user?._id)))?.canEmailReports ? 1 : 0.6,
                }}
              >
                {isSending ? <CircularProgress size={20} sx={{ color: 'white' }} /> : 'Send to Parents'}
              </Button>
            </>
          )}
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default StudentManagement; 