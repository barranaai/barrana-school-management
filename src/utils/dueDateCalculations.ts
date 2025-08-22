/**
 * Shared Due Date Calculation Utilities
 * This module provides consistent due date calculations for both frontend and backend
 */

import moment from 'moment-timezone';
import { ReportFrequency } from '../constants/reportFrequencies';
import { calculationLogger } from './calculationLogger';
import { dueDateCache } from './dueDateCache';

export interface SchoolSettings {
  timezone?: string;
  reportFrequencies?: {
    [frequency: string]: FrequencyConfig;
  };
  calendar?: {
    workingDays?: {
      monday: boolean;
      tuesday: boolean;
      wednesday: boolean;
      thursday: boolean;
      friday: boolean;
      saturday: boolean;
      sunday: boolean;
    };
    holidays?: Array<{
      name: string;
      date: Date | string;
      isRecurring: boolean;
      description?: string;
    }>;
    schoolYear?: {
      startMonth: number;
      startDay: number;
      endMonth: number;
      endDay: number;
    };
  };
}

export interface FrequencyConfig {
  enabled: boolean;
  dueDay?: number;
  dueTime?: string;
  skipWeekends?: boolean;
  skipHolidays?: boolean;
  rule?: string;
  workingDays?: number[];
  startWeek?: number;
  startMonth?: number;
  specificDay?: number;
  nthWeekday?: {
    n: number;
    weekday: number;
  };
  quarters?: {
    [key: string]: {
      enabled: boolean;
      month: number;
      day: number;
    };
  };
}

export interface DueDateResult {
  dueDate: moment.Moment;
  timezone: string;
  frequency: ReportFrequency;
  calculationMethod: string;
  isEnabled: boolean;
}

export interface DueStatusResult {
  due: boolean;
  dueDate: moment.Moment | null;
  nextDueDate: moment.Moment | null;
  lastReportDate: moment.Moment | null;
  timezone: string;
  frequency: ReportFrequency;
  hasExistingReportInPeriod?: boolean;
  existingReportInPeriod?: {
    reportId: string;
    teacherName: string | null;
    createdAt: string;
    status: string;
  } | null;
}

/**
 * Get current date in school timezone
 */
export const getCurrentTimeInSchoolTimezone = (timezone: string = 'UTC'): moment.Moment => {
  return moment().tz(timezone);
};

/**
 * Convert working days object to array format
 */
export const convertWorkingDaysToArray = (workingDays: any): number[] => {
  if (Array.isArray(workingDays)) {
    return workingDays;
  }
  
  const days = [];
  const dayMap = {
    monday: 1, tuesday: 2, wednesday: 3, thursday: 4,
    friday: 5, saturday: 6, sunday: 0
  };
  
  for (const [day, enabled] of Object.entries(workingDays || {})) {
    if (enabled && dayMap[day as keyof typeof dayMap] !== undefined) {
      days.push(dayMap[day as keyof typeof dayMap]);
    }
  }
  
  return days.length > 0 ? days : [1, 2, 3, 4, 5]; // Default to Mon-Fri
};

/**
 * Check if a date is a holiday
 */
export const isHoliday = (date: moment.Moment, holidays: any[]): boolean => {
  return holidays.some(holiday => {
    const holidayDate = moment(holiday.date);
    if (holiday.isRecurring) {
      // For recurring holidays, compare month and day only
      return date.month() === holidayDate.month() && date.date() === holidayDate.date();
    } else {
      // For non-recurring holidays, exact date match
      return date.isSame(holidayDate, 'day');
    }
  });
};

/**
 * Check if a date is a weekend based on working days
 */
export const isWeekend = (date: moment.Moment, workingDays: number[]): boolean => {
  return !workingDays.includes(date.day());
};

/**
 * Get next working day
 */
export const getNextWorkingDay = (
  date: moment.Moment, 
  workingDays: number[], 
  holidays: any[]
): moment.Moment => {
  let nextDay = date.clone();
  do {
    nextDay.add(1, 'day');
  } while (isWeekend(nextDay, workingDays) || isHoliday(nextDay, holidays));
  
  return nextDay;
};

/**
 * Calculate due date for a specific frequency (with caching)
 */
export const calculateDueDate = (
  frequency: ReportFrequency,
  schoolSettings: SchoolSettings,
  baseDate?: moment.Moment,
  schoolId?: string,
  studentId?: string,
  templateId?: string
): DueDateResult => {
  const startTime = performance.now();
  
  // Try to get from cache first
  if (schoolId) {
    const cachedResult = dueDateCache.get(frequency, schoolSettings, schoolId, studentId, templateId, baseDate);
    if (cachedResult) {
      calculationLogger.logCalculationPhase('cache-hit', studentId || 'system', templateId || 'system', frequency, {
        executionTime: performance.now() - startTime,
        fromCache: true
      });
      return cachedResult;
    }
  }
  
  const calculationId = calculationLogger.logCalculationPhase(
    'start',
    studentId || 'system',
    templateId || 'system',
    frequency,
    {
      timezone: schoolSettings.timezone,
      hasFrequencyConfig: !!schoolSettings.reportFrequencies?.[frequency],
      baseDate: baseDate?.toISOString(),
      cacheAvailable: !!schoolId
    }
  );
  
  const timezone = schoolSettings.timezone || 'UTC';
  const currentDate = baseDate || getCurrentTimeInSchoolTimezone(timezone);
  const frequencyConfig = schoolSettings.reportFrequencies?.[frequency];

  try {
    
    calculationLogger.logFrequencyConfigValidation(
      frequency,
      schoolId || 'current-school',
      frequencyConfig,
      !!(frequencyConfig && frequencyConfig.enabled),
      frequencyConfig?.enabled ? [] : ['Frequency not enabled or not configured']
    );
    
    if (!frequencyConfig || !frequencyConfig.enabled) {
      const error = new Error(`Frequency ${frequency} is not enabled for this school`);
      calculationLogger.logCalculationError('validation', studentId || 'system', templateId || 'system', frequency, error, {
        frequencyConfig,
        calculationId
      });
      throw error;
    }
  
  const workingDays = convertWorkingDaysToArray(schoolSettings.calendar?.workingDays);
  const holidays = schoolSettings.calendar?.holidays || [];
  
  let dueDate = currentDate.clone();
  let calculationMethod = 'default';
  
  switch (frequency) {
    case 'Daily':
      calculationMethod = 'working-days';
      const currentDayOfWeek = dueDate.day();
      const isWorkingDay = workingDays.includes(currentDayOfWeek);
      
      if (!isWorkingDay) {
        dueDate = getNextWorkingDay(dueDate, workingDays, holidays);
      }
      
      // Set configured time
      const [dailyHours, dailyMinutes] = (frequencyConfig.dueTime || '17:00').split(':').map(Number);
      dueDate.hour(dailyHours).minute(dailyMinutes).second(0).millisecond(0);
      break;
      
    case 'Weekly':
      calculationMethod = 'weekly-target-day';
      const targetDay = (frequencyConfig.dueDay || 5) - 1; // Convert to moment day (0-6)
      const currentDay = dueDate.day();
      const daysToAdd = (targetDay - currentDay + 7) % 7;
      
      dueDate.add(daysToAdd, 'days');
      
      // If calculated date is in the past, move to next week
      if (dueDate.isSameOrBefore(currentDate)) {
        dueDate.add(7, 'days');
      }
      
      const [weeklyHours, weeklyMinutes] = (frequencyConfig.dueTime || '17:00').split(':').map(Number);
      dueDate.hour(weeklyHours).minute(weeklyMinutes).second(0).millisecond(0);
      break;
      
    case 'Bi-Weekly':
      calculationMethod = 'bi-weekly-rule';
      dueDate = calculateBiWeeklyDate(dueDate, frequencyConfig, workingDays, holidays);
      break;
      
    case 'Monthly':
      calculationMethod = 'monthly-rule';
      dueDate = calculateMonthlyDate(dueDate, frequencyConfig, workingDays, holidays);
      break;
      
    case 'Bi-Monthly':
      calculationMethod = 'bi-monthly-rule';
      dueDate = calculateBiMonthlyDate(dueDate, frequencyConfig, workingDays, holidays);
      break;
      
    case 'Quarterly':
      calculationMethod = 'quarterly-periods';
      dueDate = calculateQuarterlyDate(dueDate, frequencyConfig);
      break;
      
    case 'Annually':
      calculationMethod = 'annual-date';
      const yearTargetDay = frequencyConfig.dueDay || 1231; // Default to Dec 31
      const yearTargetMonth = Math.floor(yearTargetDay / 100) - 1; // Convert to 0-based month
      const yearTargetDate = yearTargetDay % 100;
      
      dueDate.month(yearTargetMonth).date(yearTargetDate);
      
      // If the date has passed this year, set for next year
      if (dueDate.isBefore(currentDate)) {
        dueDate.add(1, 'year');
      }
      
      const [annualHours, annualMinutes] = (frequencyConfig.dueTime || '17:00').split(':').map(Number);
      dueDate.hour(annualHours).minute(annualMinutes).second(0).millisecond(0);
      break;
      
    default:
      throw new Error(`Unsupported frequency: ${frequency}`);
  }
  
    const result = {
      dueDate,
      timezone,
      frequency,
      calculationMethod,
      isEnabled: frequencyConfig.enabled
    };
    
    const executionTime = performance.now() - startTime;
    calculationLogger.logCalculationResult(studentId || 'system', templateId || 'system', frequency, result, executionTime);
    
    // Cache the result if schoolId is provided
    if (schoolId) {
      dueDateCache.set(frequency, schoolSettings, schoolId, result, studentId, templateId, baseDate);
    }
    
    return result;
  } catch (error) {
    const executionTime = performance.now() - startTime;
    calculationLogger.logCalculationError('execution', studentId || 'system', templateId || 'system', frequency, error as Error, {
      calculationId,
      executionTime,
      timezone: schoolSettings.timezone,
      frequencyConfig
    });
    throw error;
  }
};

/**
 * Calculate bi-weekly due date
 */
const calculateBiWeeklyDate = (
  baseDate: moment.Moment,
  frequencyConfig: FrequencyConfig,
  workingDays: number[],
  holidays: any[]
): moment.Moment => {
  const rule = frequencyConfig.rule || 'alternateWeeks';
  const dueDay = frequencyConfig.dueDay || 5; // Default to Friday
  const [hours, minutes] = (frequencyConfig.dueTime || '17:00').split(':').map(Number);
  
  let dueDate = baseDate.clone();
  
  switch (rule) {
    case 'alternateWeeks':
      // Set to the configured day of the week
      const targetDay = dueDay - 1;
      const currentDay = dueDate.day();
      const daysToAdd = (targetDay - currentDay + 7) % 7;
      dueDate.add(daysToAdd, 'days');
      
      // Check if this should be an "off" week (simplified logic)
      const weekNumber = Math.floor(dueDate.diff(moment().startOf('year'), 'weeks'));
      if (weekNumber % 2 !== (frequencyConfig.startWeek || 1) % 2) {
        dueDate.add(7, 'days');
      }
      break;
      
    default:
      // Fallback to every 14 days
      dueDate.add(14, 'days');
      break;
  }
  
  dueDate.hour(hours).minute(minutes).second(0).millisecond(0);
  return dueDate;
};

/**
 * Calculate monthly due date
 */
const calculateMonthlyDate = (
  baseDate: moment.Moment,
  frequencyConfig: FrequencyConfig,
  workingDays: number[],
  holidays: any[]
): moment.Moment => {
  const rule = frequencyConfig.rule || 'lastWorkingDay';
  const [hours, minutes] = (frequencyConfig.dueTime || '17:00').split(':').map(Number);
  
  let dueDate = baseDate.clone();
  
  switch (rule) {
    case 'specificDate':
      const specificDay = frequencyConfig.specificDay || 28;
      dueDate.date(specificDay);
      
      // If day exceeds month length, use last day of month
      if (dueDate.month() !== baseDate.month()) {
        dueDate = baseDate.clone().endOf('month');
      }
      break;
      
    case 'lastDay':
      dueDate.endOf('month');
      break;
      
    case 'lastWorkingDay':
      dueDate.endOf('month');
      // Find the last working day of the month
      while (isWeekend(dueDate, workingDays) || isHoliday(dueDate, holidays)) {
        dueDate.subtract(1, 'day');
      }
      break;
      
    case 'nthWeekday':
      const nth = frequencyConfig.nthWeekday?.n || 1;
      const weekday = frequencyConfig.nthWeekday?.weekday || 5; // Default to Friday
      
      dueDate.startOf('month');
      
      // Find the first occurrence of the weekday
      while (dueDate.day() !== weekday) {
        dueDate.add(1, 'day');
      }
      
      // Add weeks to get to nth occurrence
      if (nth > 1) {
        dueDate.add((nth - 1) * 7, 'days');
      }
      break;
      
    default:
      dueDate.endOf('month');
      break;
  }
  
  dueDate.hour(hours).minute(minutes).second(0).millisecond(0);
  return dueDate;
};

/**
 * Calculate bi-monthly due date
 */
const calculateBiMonthlyDate = (
  baseDate: moment.Moment,
  frequencyConfig: FrequencyConfig,
  workingDays: number[],
  holidays: any[]
): moment.Moment => {
  const startMonth = frequencyConfig.startMonth || 9; // Default to September
  const currentMonth = baseDate.month() + 1; // Convert to 1-based
  
  // Calculate which bi-monthly period we're in
  const monthsSinceStart = (currentMonth - startMonth + 12) % 12;
  const isEvenPeriod = Math.floor(monthsSinceStart / 2) % 2 === 0;
  
  let targetMonth = currentMonth;
  if (monthsSinceStart % 2 !== 0) {
    // We're in the second month of a bi-monthly period, move to next period
    targetMonth = currentMonth + 1;
  }
  
  let dueDate = baseDate.clone().month(targetMonth - 1); // Convert back to 0-based
  
  // Apply the same rules as monthly
  return calculateMonthlyDate(dueDate, frequencyConfig, workingDays, holidays);
};

/**
 * Calculate quarterly due date
 */
const calculateQuarterlyDate = (
  baseDate: moment.Moment,
  frequencyConfig: FrequencyConfig
): moment.Moment => {
  const quarters = frequencyConfig.quarters || {};
  const [hours, minutes] = (frequencyConfig.dueTime || '17:00').split(':').map(Number);
  
  // Find the next enabled quarter
  const quarterOrder = ['q1', 'q2', 'q3', 'q4'];
  let nextQuarterDate: moment.Moment | null = null;
  
  for (const quarterKey of quarterOrder) {
    const quarter = quarters[quarterKey];
    if (quarter && quarter.enabled) {
      const quarterMonth = quarter.month - 1; // Convert to 0-based month
      const quarterDay = quarter.day;
      
      // Create date for this quarter in current year
      let quarterDate = baseDate.clone().month(quarterMonth).date(quarterDay);
      
      // If this quarter has passed, try next year
      if (quarterDate.isBefore(baseDate)) {
        quarterDate.add(1, 'year');
      }
      
      // If this is the first valid quarter or it's earlier than our current best
      if (!nextQuarterDate || quarterDate.isBefore(nextQuarterDate)) {
        nextQuarterDate = quarterDate;
      }
    }
  }
  
  if (!nextQuarterDate) {
    throw new Error('No enabled quarters found for quarterly frequency');
  }
  
  nextQuarterDate.hour(hours).minute(minutes).second(0).millisecond(0);
  return nextQuarterDate;
};

/**
 * Get start of frequency period
 */
export const getStartOfFrequencyPeriod = (
  frequency: ReportFrequency,
  schoolSettings: SchoolSettings,
  currentDate: moment.Moment
): moment.Moment => {
  const timezone = schoolSettings.timezone || 'UTC';
  const date = currentDate.clone().tz(timezone);
  
  switch (frequency) {
    case 'Daily':
      return date.startOf('day');
      
    case 'Weekly':
      // Start of week (Monday)
      return date.startOf('isoWeek');
      
    case 'Bi-Weekly':
      // Simplified: start of current 2-week period
      const weekNumber = date.isoWeek();
      const biWeekStart = weekNumber % 2 === 1 ? weekNumber : weekNumber - 1;
      return date.isoWeek(biWeekStart).startOf('isoWeek');
      
    case 'Monthly':
      return date.startOf('month');
      
    case 'Bi-Monthly':
      // Start of current 2-month period
      const month = date.month();
      const biMonthStart = Math.floor(month / 2) * 2;
      return date.month(biMonthStart).startOf('month');
      
    case 'Quarterly':
      // Start of current quarter
      const quarter = Math.floor(date.month() / 3);
      return date.month(quarter * 3).startOf('month');
      
    case 'Annually':
      return date.startOf('year');
      
    default:
      return date.startOf('day');
  }
};

/**
 * Check if a report is due
 */
export const isReportDue = (
  frequency: ReportFrequency,
  schoolSettings: SchoolSettings,
  lastReportDate: Date | string | null,
  currentDate?: moment.Moment
): boolean => {
  try {
    const timezone = schoolSettings.timezone || 'UTC';
    const now = currentDate || getCurrentTimeInSchoolTimezone(timezone);
    const lastReport = lastReportDate ? moment(lastReportDate).tz(timezone) : null;
    
    // Calculate due date
    const dueDateResult = calculateDueDate(frequency, schoolSettings, now);
    const dueDate = dueDateResult.dueDate;
    
    // Report is due if:
    // 1. Current time is after the due date AND
    // 2. No last report exists OR last report was before the due date
    const isDue = now.isAfter(dueDate) && (!lastReport || lastReport.isBefore(dueDate));
    
    return isDue;
  } catch (error) {
    console.error('Error calculating due status:', error);
    return false;
  }
};

/**
 * Debug function to compare calculations
 */
export const debugCalculations = (
  frequency: ReportFrequency,
  schoolSettings: SchoolSettings,
  studentId: string,
  templateId: string
) => {
  const timezone = schoolSettings.timezone || 'UTC';
  const now = getCurrentTimeInSchoolTimezone(timezone);
  
  try {
    const dueDateResult = calculateDueDate(frequency, schoolSettings, now);
    const periodStart = getStartOfFrequencyPeriod(frequency, schoolSettings, now);
    
    return {
      timestamp: now.toISOString(),
      timezone,
      frequency,
      studentId,
      templateId,
      dueDate: dueDateResult.dueDate.toISOString(),
      periodStart: periodStart.toISOString(),
      calculationMethod: dueDateResult.calculationMethod,
      isEnabled: dueDateResult.isEnabled,
      settings: {
        frequencyConfig: schoolSettings.reportFrequencies?.[frequency],
        workingDays: convertWorkingDaysToArray(schoolSettings.calendar?.workingDays),
        holidaysCount: schoolSettings.calendar?.holidays?.length || 0
      }
    };
  } catch (error) {
    return {
      timestamp: now.toISOString(),
      timezone,
      frequency,
      studentId,
      templateId,
      error: error instanceof Error ? error.message : 'Unknown error',
      settings: {
        frequencyConfig: schoolSettings.reportFrequencies?.[frequency],
        workingDays: convertWorkingDaysToArray(schoolSettings.calendar?.workingDays),
        holidaysCount: schoolSettings.calendar?.holidays?.length || 0
      }
    };
  }
};
