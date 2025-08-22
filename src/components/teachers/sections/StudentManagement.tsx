import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
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
  Delete,
  Close,
  AutoFixHigh,
  Send,
  PhotoCamera,
} from '@mui/icons-material';
import { useData } from '../../../contexts/DataContext';
import { useAuth } from '../../../contexts/AuthContext';
import { reportTemplateService, type ReportTemplate } from '../../../services/reportTemplateService';
import { reportService, type CreateReportData } from '../../../services/reportService';
import { aiService } from '../../../services/aiService';
import { communicationService } from '../../../services/communicationService';
import { REPORT_FREQUENCIES, type ReportFrequency } from '../../../constants/reportFrequencies';
import { mediaService, type UploadedMedia } from '../../../services/mediaService';
import MediaUpload from '../../common/MediaUpload';
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

const StudentManagement: React.FC = () => {
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
  
  // Media upload state
  const [uploadedMedia, setUploadedMedia] = useState<UploadedMedia[]>([]);
  const [currentReportId, setCurrentReportId] = useState<string>('');
  const [tempReportId, setTempReportId] = useState<string>('');
  
  // Due status tracking
  const [dueStatusData, setDueStatusData] = useState<DueStatusData>({});
  const [isCheckingDueStatus, setIsCheckingDueStatus] = useState(false);
  
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

  // Helper function to get current time in school timezone
  const getCurrentTimeInSchoolTimezone = (): Date => {
    const schoolSettings = school?.settings || {};
    const timezone = schoolSettings.timezone || 'UTC';
    
    // Get current time in school timezone
    const schoolTime = moment().tz(timezone).toDate();
    
    return schoolTime;
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
    
    // Use the passed currentDate directly, don't create a new Date object
    const now = currentDate;
    
    // Get school settings for frequency configuration
    const schoolSettings = school?.settings || {};
    const frequencyConfig = schoolSettings.reportFrequencies?.[frequency];
    
    console.log('🔍 Frontend frequency config', {
      frequency,
      frequencyConfig,
      enabled: frequencyConfig?.enabled
    });
    
    if (frequencyConfig?.enabled) {
      
      // Use school's frequency configuration
      // Create a fresh date object for each frequency to avoid modification issues
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
          // Due on configured day of the week
          const targetDay = frequencyConfig.dueDay - 1; // Convert to 0-6
          const currentDay = now.getDay();
          const daysToAdd = (targetDay - currentDay + 7) % 7;
          
          // Ensure we're working with a fresh date object
          dueDate = new Date(now);
          dueDate.setDate(now.getDate() + daysToAdd);
          const [weeklyHours, weeklyMinutes] = (frequencyConfig.dueTime || '17:00').split(':').map(Number);
          dueDate.setHours(weeklyHours, weeklyMinutes, 0, 0);
          
          // Don't move to next week if due date has passed - keep it as today's due date
          // This allows the report to be marked as overdue for today
          break;
        case 'Bi-Weekly':
          // Rule-based bi-weekly calculation (simplified for frontend)
          const biWeeklyRule = frequencyConfig.rule || 'alternateWeeks';
          const biWeeklyDueDay = frequencyConfig.dueDay || 5;
          
          if (biWeeklyRule === 'alternateWeeks') {
            // Set to the configured day of the week
            const biWeekTargetDay = biWeeklyDueDay - 1;
            const biWeekCurrentDay = now.getDay();
            const biWeekDaysToAdd = (biWeekTargetDay - biWeekCurrentDay + 7) % 7;
            dueDate.setDate(now.getDate() + biWeekDaysToAdd);
            
            // Ensure it's every other week based on start week
            const startWeek = frequencyConfig.startWeek || 1;
            const weekNumber = Math.floor(dueDate.getTime() / (7 * 24 * 60 * 60 * 1000));
            const shouldBeEvenWeek = startWeek === 1; // Week 1 starts with odd weeks
            
            if ((weekNumber % 2 === 0) !== shouldBeEvenWeek) {
              dueDate.setDate(dueDate.getDate() + 7);
            }
          } else if (biWeeklyRule === 'specificWeeks') {
            // Simplified: use alternate weeks as fallback
            const biWeekTargetDay = biWeeklyDueDay - 1;
            const biWeekCurrentDay = now.getDay();
            const biWeekDaysToAdd = (biWeekTargetDay - biWeekCurrentDay + 7) % 7;
            dueDate.setDate(now.getDate() + biWeekDaysToAdd);
            
            const weekNumber = Math.floor(dueDate.getTime() / (7 * 24 * 60 * 60 * 1000));
            if (weekNumber % 2 !== 0) {
              dueDate.setDate(dueDate.getDate() + 7);
            }
          } else if (biWeeklyRule === 'nthWeekOfMonth') {
            // Simplified: use 3rd week of month
            dueDate.setDate(1); // Start of month
            dueDate.setDate(dueDate.getDate() + 14); // 3rd week
            
            const biWeekTargetDay = biWeeklyDueDay - 1;
            const biWeekCurrentDay = dueDate.getDay();
            const biWeekDaysToAdd = (biWeekTargetDay - biWeekCurrentDay + 7) % 7;
            dueDate.setDate(dueDate.getDate() + biWeekDaysToAdd);
          }
          
          const [biWeeklyHours, biWeeklyMinutes] = (frequencyConfig.dueTime || '17:00').split(':').map(Number);
          dueDate.setHours(biWeeklyHours, biWeeklyMinutes, 0, 0);
          break;
        case 'Monthly':
          // Rule-based monthly calculation (simplified for frontend)
          const monthlyRule = frequencyConfig.rule || 'lastWorkingDay';
          if (monthlyRule === 'specificDate') {
            const specificDay = frequencyConfig.specificDay || 28;
            dueDate.setDate(specificDay);
          } else if (monthlyRule === 'lastDay') {
            dueDate.setDate(0); // Last day of current month
          } else if (monthlyRule === 'lastWorkingDay') {
            // Simplified: use last day of month
            dueDate.setDate(0);
          } else if (monthlyRule === 'nthWeekday') {
            // Simplified: use 1st Friday
            const nth = frequencyConfig.nthWeekday?.n || 1;
            const weekday = frequencyConfig.nthWeekday?.weekday || 5;
            dueDate.setDate(1);
            while (dueDate.getDay() !== weekday) {
              dueDate.setDate(dueDate.getDate() + 1);
            }
            if (nth > 1) {
              dueDate.setDate(dueDate.getDate() + (nth - 1) * 7);
            }
          }
          const [monthlyHours, monthlyMinutes] = (frequencyConfig.dueTime || '17:00').split(':').map(Number);
          dueDate.setHours(monthlyHours, monthlyMinutes, 0, 0);
          break;
        case 'Bi-Monthly':
          // Rule-based bi-monthly calculation (simplified for frontend)
          const biMonthlyRule = frequencyConfig.rule || 'lastWorkingDay';
          const startMonth = frequencyConfig.startMonth || 9;
          
          // Ensure we're on the correct bi-monthly period
          const biMonthlyCurrentMonth = dueDate.getMonth() + 1;
          const monthsSinceStart = (biMonthlyCurrentMonth - startMonth + 12) % 12;
          if (monthsSinceStart % 2 !== 0) {
            dueDate.setMonth(dueDate.getMonth() + 1);
          }
          
          if (biMonthlyRule === 'specificDate') {
            const specificDay = frequencyConfig.specificDay || 28;
            dueDate.setDate(specificDay);
          } else if (biMonthlyRule === 'lastDay') {
            dueDate.setDate(0);
          } else if (biMonthlyRule === 'lastWorkingDay') {
            dueDate.setDate(0);
          } else if (biMonthlyRule === 'nthWeekday') {
            const nth = frequencyConfig.nthWeekday?.n || 1;
            const weekday = frequencyConfig.nthWeekday?.weekday || 5;
            dueDate.setDate(1);
            while (dueDate.getDay() !== weekday) {
              dueDate.setDate(dueDate.getDate() + 1);
            }
            if (nth > 1) {
              dueDate.setDate(dueDate.getDate() + (nth - 1) * 7);
            }
          }
          const [biMonthlyHours, biMonthlyMinutes] = (frequencyConfig.dueTime || '17:00').split(':').map(Number);
          dueDate.setHours(biMonthlyHours, biMonthlyMinutes, 0, 0);
          break;
        case 'Quarterly':
          // Find the next enabled quarter based on current date
          const quarters = frequencyConfig.quarters || {};
          const quarterCurrentMonth = now.getMonth() + 1; // Convert to 1-based month
          
          // Find the next quarter that is enabled and hasn't passed yet
          let nextQuarterDate = null;
          
          // Check all quarters in order
          const quarterOrder = ['q1', 'q2', 'q3', 'q4'];
          for (const quarterKey of quarterOrder) {
            const quarter = quarters[quarterKey];
            if (quarter && quarter.enabled) {
              const quarterMonth = quarter.month - 1; // Convert to 0-based month
              const quarterDay = quarter.day;
              
              // Create date for this quarter in current year
              let quarterDate = new Date(now.getFullYear(), quarterMonth, quarterDay);
              
              // If this quarter has passed, try next year
              if (quarterDate < now) {
                quarterDate = new Date(now.getFullYear() + 1, quarterMonth, quarterDay);
              }
              
              // If this is the first valid quarter or it's earlier than our current best
              if (!nextQuarterDate || quarterDate < nextQuarterDate) {
                nextQuarterDate = quarterDate;
              }
            }
          }
          
          if (nextQuarterDate) {
            dueDate = nextQuarterDate;
            const [quarterlyHours, quarterlyMinutes] = (frequencyConfig.dueTime || '17:00').split(':').map(Number);
            dueDate.setHours(quarterlyHours, quarterlyMinutes, 0, 0);
          } else {
            // Fallback: if no quarters are enabled, use current date
            dueDate = now;
          }
          break;
        case 'Annually':
          // Due on configured month and day (format: MMDD, e.g., 615 = June 15th)
          const yearTargetDay = frequencyConfig.dueDay;
          const yearTargetMonth = Math.floor(yearTargetDay / 100) - 1; // Convert to 0-based month index
          const yearTargetDate = yearTargetDay % 100;
          
          dueDate.setMonth(yearTargetMonth);
          dueDate.setDate(yearTargetDate);
          const [annuallyHours, annuallyMinutes] = (frequencyConfig.dueTime || '17:00').split(':').map(Number);
          dueDate.setHours(annuallyHours, annuallyMinutes, 0, 0);
          break;
        default:
          return now;
      }
      
      console.log('🔍 Frontend calculated due date (enabled config)', {
        frequency,
        dueDate: dueDate.toISOString(),
        dueTime: frequencyConfig.dueTime
      });
      
      return dueDate;
    } else {
      // Fallback to default calculation
      let fallbackDueDate: Date;
      
      switch (frequency) {
        case 'Daily':
          fallbackDueDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          break;
        case 'Weekly':
          // Due by end of current week (Sunday)
          fallbackDueDate = new Date(now);
          fallbackDueDate.setDate(now.getDate() + (7 - now.getDay()));
          fallbackDueDate.setHours(23, 59, 59, 999);
          break;
        case 'Bi-Weekly':
          // Due by end of current 2-week period
          fallbackDueDate = new Date(now);
          fallbackDueDate.setDate(now.getDate() + (14 - (now.getDay() + 7)));
          fallbackDueDate.setHours(23, 59, 59, 999);
          break;
        case 'Monthly':
          // Due by end of current month
          fallbackDueDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
          fallbackDueDate.setHours(23, 59, 59, 999);
          break;
        case 'Bi-Monthly':
          // Due by end of current 2-month period
          fallbackDueDate = new Date(now.getFullYear(), Math.floor(now.getMonth() / 2) * 2 + 2, 0);
          fallbackDueDate.setHours(23, 59, 59, 999);
          break;
        case 'Quarterly':
          // Due by end of current quarter
          fallbackDueDate = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3 + 3, 0);
          fallbackDueDate.setHours(23, 59, 59, 999);
          break;
        case 'Annually':
          // Due by end of current year
          fallbackDueDate = new Date(now.getFullYear(), 11, 31);
          fallbackDueDate.setHours(23, 59, 59, 999);
          break;
        default:
          fallbackDueDate = now;
      }
      
      console.log('🔍 Frontend calculated due date (fallback)', {
        frequency,
        fallbackDueDate: fallbackDueDate.toISOString()
      });
      
      return fallbackDueDate;
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
  const dueReports = useMemo(() => {
    // Debug logging removed for cleaner console
    
    // Only calculate if we have students and templates
    if (teacherStudents.length === 0 || reportTemplates.length === 0) {
      return [];
    }
    
    // Only calculate if we have school settings
    if (!school?.settings) {
      return [];
    }
    
    // Only calculate if we have timezone settings
    if (!school?.settings?.timezone) {
      return [];
    }
    
    // Only calculate if we have report frequency settings
    if (!school?.settings?.reportFrequencies) {
      return [];
    }
    
    const due: DueReport[] = [];
    
    // Get current time in school timezone
    const schoolSettings = school?.settings || {};
    const now = getCurrentTimeInSchoolTimezone();
    
    // Calculation started

    teacherStudents.forEach(student => {
      // Find templates for this student's grade (case-insensitive)
      const gradeTemplates = reportTemplates.filter(template => 
        template.grade.toLowerCase() === student.grade.toLowerCase() && template.isActive
      );

      gradeTemplates.forEach(template => {
        // Get ALL reports for this student (not just current teacher's reports)
        const allStudentReports = reports.filter(r => {
          const reportStudentId = typeof r.studentId === 'string' ? r.studentId : (r.studentId && r.studentId._id);
          return reportStudentId === student._id;
        });
        
        // Check if there's a report for the current period based on frequency
        const currentPeriodReport = getReportForCurrentPeriod(allStudentReports, template.reportFrequency, now);
        
        if (currentPeriodReport) {
          // Report exists for current period - check if it's by another teacher
          const currentTeacherId = user?._id;
          const reportTeacherId = typeof currentPeriodReport.teacherId === 'string' 
            ? currentPeriodReport.teacherId 
            : currentPeriodReport.teacherId?._id;
          
          const isReportByAnotherTeacher = reportTeacherId && reportTeacherId !== currentTeacherId;
          
          if (isReportByAnotherTeacher) {
            // Report already generated by another teacher for this period - not due for current teacher
            console.log('🔍 Frontend: Report already generated by another teacher', {
              student: student.name,
              template: template.name,
              reportTeacherId,
              currentTeacherId,
              status: currentPeriodReport.status
            });
            return; // Skip this template for current teacher
          }
          
          // Report exists for current period by current teacher - check status
          if (currentPeriodReport.status === 'sent') {
            // Not due - report is sent
            console.log('🔍 Frontend: Report exists and sent', {
              student: student.name,
              template: template.name,
              status: currentPeriodReport.status
            });
          } else {
            // Report exists but not sent (draft or completed) by current teacher
            // Check if the report is overdue based on the due date
            const dueDate = calculateDueDateForFrequency(template.reportFrequency, now);
            const isOverdue = now.getTime() > dueDate.getTime();
            
            console.log('🔍 Frontend: Report exists but not sent', {
              student: student.name,
              template: template.name,
              status: currentPeriodReport.status,
              dueDate: dueDate.toISOString(),
              now: now.toISOString(),
              isOverdue
            });
            
            if (isOverdue) {
              const daysOverdue = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
              due.push({
                studentId: student._id,
                studentName: student.name,
                templateName: template.name,
                frequency: template.reportFrequency,
                dueDate: dueDate,
                daysOverdue: daysOverdue,
                templateId: template._id,
                reportStatus: currentPeriodReport.status,
                reportId: currentPeriodReport._id
              });
              
              // Debug this calculation
              debugDueCalculations(student._id, template._id, {
                due: true,
                timezone: schoolSettings.timezone,
                frequency: template.reportFrequency,
                dueDate: dueDate.toISOString(),
                now: now.toISOString(),
                daysOverdue
              });
            }
          }
        } else {
          // No report for current period - calculate due date
          const dueDate = calculateDueDateForFrequency(template.reportFrequency, now);
          
          // Use time-based comparison (same as backend) instead of day-based
          const isOverdue = now.getTime() > dueDate.getTime();
          
          console.log('🔍 Frontend: No report for current period', {
            student: student.name,
            template: template.name,
            dueDate: dueDate.toISOString(),
            now: now.toISOString(),
            isOverdue
          });
          
          if (isOverdue) {
            const daysOverdue = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
            due.push({
              studentId: student._id,
              studentName: student.name,
              templateName: template.name,
              frequency: template.reportFrequency,
              dueDate,
              daysOverdue,
              templateId: template._id,
              reportStatus: 'missing',
              reportId: null
            });
            
            // Debug this calculation
            debugDueCalculations(student._id, template._id, {
              due: true,
              timezone: schoolSettings.timezone,
              frequency: template.reportFrequency,
              dueDate: dueDate.toISOString(),
              now: now.toISOString(),
              daysOverdue
            });
          }
        }
      });
    });

    // Sort by most overdue first
    due.sort((a, b) => b.daysOverdue - a.daysOverdue);
    
    // Calculation completed
    
    return due;
  }, [teacherStudents.length, reportTemplates.length, school?.settings, school?.settings?.timezone]);

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
      const trimmedLine = lines[i].trim();
      
      // Skip empty lines
      if (!trimmedLine) continue;
      
      // Check if this is a main heading (ends with colon or is a standalone title)
      const isMainHeading = trimmedLine.endsWith(':') || 
        (trimmedLine.length > 3 && 
         trimmedLine.length < 100 && 
         !trimmedLine.includes('.') && 
         !trimmedLine.toLowerCase().startsWith('write') &&
         !trimmedLine.toLowerCase().includes('details about') &&
         !trimmedLine.match(/^[-•*]\s+/) &&
         !trimmedLine.match(/^\d+\.\s+/));
      
      if (isMainHeading) {
        // Save previous main point if it exists
        if (currentMainPoint && currentMainPoint.main) {
          keyPoints.push(currentMainPoint);
        }
        
        // Start new main point
        const mainPoint = trimmedLine.replace(/[:]\s*$/, '').trim();
        if (mainPoint && 
            mainPoint.length > 2 && 
            !mainPoint.toLowerCase().includes('example')) {
          currentMainPoint = {
            main: mainPoint,
            subPoints: []
          };
        }
      } else {
        // Check if this is a sub-point (bullet, number, or descriptive text)
        const isBulletPoint = trimmedLine.match(/^[-•*]\s+(.+)/);
        const isNumberedPoint = trimmedLine.match(/^\d+\.\s+(.+)/);
        const isDescriptiveText = trimmedLine.length > 10 && 
          trimmedLine.length < 120 && 
          !trimmedLine.toLowerCase().includes('write') &&
          !trimmedLine.toLowerCase().includes('details about') &&
          !trimmedLine.toLowerCase().includes('example');
        
        if (currentMainPoint && (isBulletPoint || isNumberedPoint || isDescriptiveText)) {
          let subPoint = '';
          
          if (isBulletPoint) {
            subPoint = isBulletPoint[1]?.replace(/[:]\s*$/, '').trim() || '';
          } else if (isNumberedPoint) {
            subPoint = isNumberedPoint[1]?.replace(/[:]\s*$/, '').trim() || '';
          } else if (isDescriptiveText) {
            // For descriptive text, try to extract meaningful phrases
            subPoint = trimmedLine.replace(/[:]\s*$/, '').trim();
            // Limit length and clean up
            if (subPoint.length > 80) {
              subPoint = subPoint.substring(0, 80) + '...';
            }
          }
          
          if (subPoint && 
              subPoint.length > 3 && 
              !currentMainPoint.subPoints.includes(subPoint)) {
            currentMainPoint.subPoints.push(subPoint);
          }
        }
      }
    }
    
    // Don't forget the last main point
    if (currentMainPoint && currentMainPoint.main) {
      keyPoints.push(currentMainPoint);
    }
    
    // If we found very few key points, try a simpler flat approach
    if (keyPoints.length < 2) {
      const fallbackPoints = templateContent
        .split(/[:\n]/)
        .map(part => part.trim())
        .filter(part => 
          part.length > 5 && 
          part.length < 50 && 
          !part.toLowerCase().includes('write') &&
          !part.toLowerCase().includes('details') &&
          !part.toLowerCase().includes('example')
        )
        .slice(0, 6)
        .map(point => ({ main: point, subPoints: [] }));
      
      return fallbackPoints;
    }
    
    // Limit to 6 main points max for better UI
    return keyPoints.slice(0, 6);
  };

  // Auto-select template based on student's grade (only due templates)
  const autoSelectTemplateForStudent = (student: any) => {
    console.log('🔍 autoSelectTemplateForStudent called:', { student: student?.name, grade: student?.grade });
    console.log('🔍 Available templates:', reportTemplates.length);
    
    if (!student || !reportTemplates.length) {
      console.log('🔍 No student or templates available');
      return;
    }
    
    // Get templates that are actually due (not just available)
    const dueTemplates = getDueTemplatesForStudent(student);
    console.log('🔍 Due templates for student:', dueTemplates.length);
    
    if (dueTemplates.length > 0) {
      // Set the first due template as selected by default
      const defaultTemplate = dueTemplates[0];
      console.log('🔍 Auto-selecting due template:', defaultTemplate.name);
      setSelectedTemplate(defaultTemplate);
      
      // Extract key points from the template content
      const extractedKeyPoints = extractKeyPointsFromTemplate(defaultTemplate.content || '');
      setKeyPoints(extractedKeyPoints);
      console.log('🔍 Key points extracted:', extractedKeyPoints.length);
      
      toast.success(`Due template "${defaultTemplate.name}" (${defaultTemplate.reportFrequency}) selected for Grade ${student.grade}`);
    } else {
      console.log('🔍 No due templates for grade:', student.grade);
      const availableTemplates = getAvailableTemplatesForStudent(student);
      const existingReports = getExistingReportInfo(student) || [];
      
      if (availableTemplates.length > 0) {
        // There are available templates but none are due yet
        toast.success(`${availableTemplates.length} template(s) available for ${student.grade}, but none are due yet. You can still generate reports manually.`);
      } else if (existingReports.length > 0) {
        const reportDetails = existingReports.map(r => `${r.frequency}`).join(', ');
        toast.success(`All ${reportDetails} reports already exist for ${student.grade}.`);
      } else {
        toast.error(`No active templates found for Grade ${student.grade}.`);
      }
      setSelectedTemplate(null);
      setKeyPoints([]);
    }
  };

  // Voice recording functions
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];

      mediaRecorder.ondataavailable = (event) => {
        chunks.push(event.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        const url = URL.createObjectURL(blob);
        const newRecording = {
          id: Date.now().toString(),
          blob,
          url,
          duration: recordingTime
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

  const openReportDialog = async (student: any) => {
    console.log('🔍 openReportDialog called for student:', student);
    
    if (!student || !student._id) {
      console.error('Cannot open report dialog: student is null or missing _id');
      toast.error('Student information is missing. Please try again.');
      return;
    }
    
    // Check if ALL possible reports exist for current period 
    const existingReports = getExistingReportInfo(student);
    const studentGrade = student.grade || '';
    const availableTemplates = reportTemplates.filter(template => 
      template.grade.toLowerCase() === studentGrade.toLowerCase() && template.isActive
    );
    const dueTemplates = getDueTemplatesForStudent(student);
    
    // Only block if ALL templates have existing reports
    if (existingReports && existingReports.length === availableTemplates.length) {
      const reportDetails = existingReports.map(r => 
        `${r.template} (${r.frequency}) - ${r.status} by ${r.teacher}`
      ).join(', ');
      
      console.log('🚫 Report dialog blocked - all reports exist:', existingReports);
      toast.error(`Cannot generate new report. All reports already exist for current period: ${reportDetails}`);
      return;
    }
    
    // Show different messages based on what's available
    if (dueTemplates.length === 0 && availableTemplates.length > 0) {
      toast.success(`${availableTemplates.length} template(s) available for ${student.grade}, but none are due yet. You can still generate reports manually if needed.`);
    } else if (existingReports && existingReports.length > 0) {
      const reportDetails = existingReports.map(r => `${r.template} (${r.frequency})`).join(', ');
      const dueCount = dueTemplates.length;
      if (dueCount > 0) {
        toast.success(`${dueCount} report(s) due now. Note: Some reports already exist: ${reportDetails}.`);
      } else {
        toast.success(`Some reports already exist: ${reportDetails}. No reports are due yet.`);
      }
    } else if (dueTemplates.length > 0) {
      toast.success(`${dueTemplates.length} report(s) are due now for ${student.name}.`);
    }
    
    console.log('🔍 Setting selected student:', student.name);
    setSelectedStudent(student);
    
    console.log('🔍 Auto-selecting template for student grade:', student.grade);
    autoSelectTemplateForStudent(student);
    
    console.log('🔍 Generating temp report ID and opening dialog');
    // Generate a temporary report ID for media uploads
    const tempId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    setTempReportId(tempId);
    
    console.log('🔍 Opening quick report dialog');
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
      template.grade.toLowerCase() === studentGrade.toLowerCase() && template.isActive
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

  // Get templates that don't have existing reports for current period
  const getAvailableTemplatesForStudent = (student: any) => {
    if (!student || !reportTemplates.length) return [];
    
    const studentGrade = student.grade || '';
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
  const getDueTemplatesForStudent = (student: any) => {
    if (!student || !reportTemplates.length) return [];
    
    const studentGrade = student.grade || '';
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
            template.grade.toLowerCase() === studentGrade.toLowerCase() && template.isActive
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

  return (
    <Container maxWidth="xl">
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
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
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
            <Box sx={{ display: 'flex', gap: 2 }}>
              <Button
                variant="outlined"
                startIcon={<Notifications />}
                onClick={checkDueReportsForNotifications}
                sx={{
                  borderRadius: 2,
                  px: 3,
                  py: 1,
                  borderColor: '#4caf50',
                  color: '#4caf50',
                  '&:hover': {
                    borderColor: '#45a049',
                    backgroundColor: 'rgba(76, 175, 80, 0.05)',
                  }
                }}
              >
                Check Due Reports
              </Button>
              <Button
                variant="outlined"
                startIcon={<AutoFixHigh />}
                onClick={forceRefreshDueReports}
                sx={{
                  borderRadius: 2,
                  px: 3,
                  py: 1,
                  borderColor: '#667eea',
                  color: '#667eea',
                  '&:hover': {
                    borderColor: '#5a6fd8',
                    backgroundColor: 'rgba(102, 126, 234, 0.05)',
                  }
                }}
              >
                Refresh Calculations
              </Button>
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
                background: 'rgba(255,255,255,0.8)',
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
                background: 'rgba(255,255,255,0.8)',
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
                background: 'rgba(255,255,255,0.8)',
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
                background: 'rgba(255,255,255,0.8)',
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
                            label={student.grade} 
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
                            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
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
                            title={(() => {
                              const availableTemplates = getAvailableTemplatesForStudent(student);
                              const dueTemplates = getDueTemplatesForStudent(student);
                              
                              if (availableTemplates.length === 0) {
                                return `All report types for ${student.name} have been completed for the current period. Check "Current Period" indicator or view existing reports.`;
                              }
                              
                              if (dueTemplates.length === 0) {
                                return `${availableTemplates.length} template(s) available for ${student.name}, but none are due yet. You can still generate reports manually.`;
                              }
                              
                              return `${dueTemplates.length} report(s) due now for ${student.name} (${availableTemplates.length} total available)`;
                            })()}
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
                                disabled={getAvailableTemplatesForStudent(student).length === 0} // Disable if no templates available
                            sx={{
                              background: (() => {
                                const availableTemplates = getAvailableTemplatesForStudent(student);
                                const dueTemplates = getDueTemplatesForStudent(student);
                                
                                if (availableTemplates.length === 0) {
                                  return 'linear-gradient(135deg, #cccccc 0%, #999999 100%)';
                                }
                                
                                if (dueTemplates.length === 0) {
                                  return 'linear-gradient(135deg, #ff9800 0%, #f57c00 100%)'; // Orange for not due
                                }
                                
                                return 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'; // Blue for due
                              })(),
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
                              boxShadow: (() => {
                                const availableTemplates = getAvailableTemplatesForStudent(student);
                                const dueTemplates = getDueTemplatesForStudent(student);
                                
                                if (availableTemplates.length === 0) {
                                  return '0 2px 8px rgba(0, 0, 0, 0.1)';
                                }
                                
                                if (dueTemplates.length === 0) {
                                  return '0 2px 8px rgba(255, 152, 0, 0.3)';
                                }
                                
                                return '0 2px 8px rgba(102, 126, 234, 0.3)';
                              })(),
                              '&:hover': {
                                background: (() => {
                                  const availableTemplates = getAvailableTemplatesForStudent(student);
                                  const dueTemplates = getDueTemplatesForStudent(student);
                                  
                                  if (availableTemplates.length === 0) {
                                    return 'linear-gradient(135deg, #cccccc 0%, #999999 100%)';
                                  }
                                  
                                  if (dueTemplates.length === 0) {
                                    return 'linear-gradient(135deg, #f57c00 0%, #ef6c00 100%)';
                                  }
                                  
                                  return 'linear-gradient(135deg, #5a6fd8 0%, #6a4190 100%)';
                                })(),
                                boxShadow: (() => {
                                  const availableTemplates = getAvailableTemplatesForStudent(student);
                                  const dueTemplates = getDueTemplatesForStudent(student);
                                  
                                  if (availableTemplates.length === 0) {
                                    return '0 2px 8px rgba(0, 0, 0, 0.1)';
                                  }
                                  
                                  if (dueTemplates.length === 0) {
                                    return '0 4px 12px rgba(255, 152, 0, 0.4)';
                                  }
                                  
                                  return '0 4px 12px rgba(102, 126, 234, 0.4)';
                                })(),
                                transform: getAvailableTemplatesForStudent(student).length === 0 ? 'none' : 'translateY(-1px)',
                              }
                            }}
                              >
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
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
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
        
        <DialogContent sx={{ p: 4, pt: 6 }}>
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

              {/* Detailed Information */}
              <Grid container spacing={4}>
                <Grid item xs={12} md={6}>
                  <Card
                    sx={{
                      borderRadius: 3,
                      background: 'rgba(255,255,255,0.8)',
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
                          color: '#667eea',
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
                            label={selectedStudent.grade} 
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
                      background: 'rgba(255,255,255,0.8)',
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
                          color: '#667eea',
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
              borderColor: '#667eea',
              color: '#667eea',
              '&:hover': {
                borderColor: '#5a6fd8',
                backgroundColor: 'rgba(102, 126, 234, 0.05)',
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
                : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              boxShadow: selectedStudent && (hasCurrentPeriodReport(selectedStudent) || getStudentDueReports(selectedStudent?._id || '').length === 0)
                ? '0 4px 16px rgba(0,0,0,0.1)'
                : '0 4px 16px rgba(102, 126, 234, 0.3)',
              fontWeight: 600,
              '&:hover': {
                background: selectedStudent && (hasCurrentPeriodReport(selectedStudent) || getStudentDueReports(selectedStudent?._id || '').length === 0)
                  ? 'linear-gradient(135deg, #ccc 0%, #999 100%)'
                  : 'linear-gradient(135deg, #5a6fd8 0%, #6a4190 100%)',
                boxShadow: selectedStudent && (hasCurrentPeriodReport(selectedStudent) || getStudentDueReports(selectedStudent?._id || '').length === 0)
                  ? '0 4px 16px rgba(0,0,0,0.1)'
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

        <DialogContent sx={{ p: 3 }}>
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
                  }
                }}
                label="Report Template"
                sx={{ borderRadius: 2 }}
              >
                {getAvailableTemplatesForStudent(selectedStudent)
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

            {(() => {
              const availableTemplates = getAvailableTemplatesForStudent(selectedStudent);
              const dueTemplates = getDueTemplatesForStudent(selectedStudent);
              const allGradeTemplates = reportTemplates.filter(template => 
                template.isActive && 
                template.grade.toLowerCase() === selectedStudent?.grade?.toLowerCase()
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
            })()}
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
            {selectedTemplate && keyPoints.length > 0 && (
              <Paper sx={{ p: 3, bgcolor: 'primary.50', borderRadius: 2, border: '1px solid', borderColor: 'primary.200' }}>
                <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'primary.main' }}>
                  <Star />
                  Key Points to Observe & Discuss
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Based on the selected template "{selectedTemplate.name}", here are the key areas you should observe and talk about:
                </Typography>
                <Box sx={{ pl: 1 }}>
                  {keyPoints.map((keyPoint, index) => (
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
                  ))}
                </Box>
                <Alert severity="info" sx={{ mt: 2, fontSize: '0.8rem' }}>
                  <Typography variant="caption">
                    💡 <strong>Tip:</strong> Use these points as a checklist while recording your observations. 
                    Try to address each area for a comprehensive report.
                  </Typography>
                </Alert>
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
                            variant="outlined"
                            size="small"
                            startIcon={<PlayArrow />}
                            onClick={() => {
                              if (audioRef.current) {
                                audioRef.current.src = recording.url;
                                audioRef.current.play();
                              }
                            }}
                          >
                            Play
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
              <audio ref={audioRef} style={{ display: 'none' }} />
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
          <Button onClick={handleCloseReportDialog} variant="outlined" size="large">
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
                startIcon={<Send />}
                onClick={sendReportToParents}
                disabled={!teachers.find(t => (t._id === (user?.id || user?._id)) || (t.id === (user?.id || user?._id)))?.canEmailReports}
                size="large"
                sx={{
                  background: teachers.find(t => (t._id === (user?.id || user?._id)) || (t.id === (user?.id || user?._id)))?.canEmailReports
                    ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                    : 'linear-gradient(135deg, #cccccc 0%, #999999 100%)',
                  px: 4,
                  opacity: teachers.find(t => (t._id === (user?.id || user?._id)) || (t.id === (user?.id || user?._id)))?.canEmailReports ? 1 : 0.6,
                }}
              >
                Send to Parents
              </Button>
            </>
          )}
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default StudentManagement; 