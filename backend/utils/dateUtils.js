const moment = require('moment-timezone');
const logger = require('./logger');
const { dueDateCache } = require('./dueDateCache');

/**
 * Utility functions for timezone-aware date calculations and school calendar management
 */

/**
 * Get the current date in school's timezone
 * @param {string} timezone - School timezone (e.g., 'America/New_York')
 * @returns {moment.Moment} Current date in school timezone
 */
const getCurrentDateInTimezone = (timezone = 'UTC') => {
  return moment().tz(timezone);
};

/**
 * Check if a date is a weekend
 * @param {moment.Moment} date - Date to check
 * @param {Object} workingDays - School working days configuration
 * @returns {boolean} True if weekend
 */
const isWeekend = (date, workingDays = {}) => {
  const dayOfWeek = date.day(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  
  if (dayOfWeek === 0) return !workingDays.sunday;
  if (dayOfWeek === 6) return !workingDays.saturday;
  
  return false;
};

/**
 * Check if a date is a holiday
 * @param {moment.Moment} date - Date to check
 * @param {Array} holidays - Array of holiday objects
 * @returns {boolean} True if holiday
 */
const isHoliday = (date, holidays = []) => {
  const dateString = date.format('YYYY-MM-DD');
  
  return holidays.some(holiday => {
    const holidayDate = moment(holiday.date);
    const holidayString = holidayDate.format('YYYY-MM-DD');
    
    if (holiday.isRecurring) {
      // For recurring holidays, check month and day only
      return date.month() === holidayDate.month() && date.date() === holidayDate.date();
    } else {
      // For non-recurring holidays, check exact date
      return dateString === holidayString;
    }
  });
};

/**
 * Get the next working day (skip weekends and holidays)
 * @param {moment.Moment} date - Starting date
 * @param {Object} workingDays - School working days configuration
 * @param {Array} holidays - Array of holiday objects
 * @returns {moment.Moment} Next working day
 */
const getNextWorkingDay = (date, workingDays = {}, holidays = []) => {
  let nextDay = date.clone();
  
  do {
    nextDay.add(1, 'day');
  } while (isWeekend(nextDay, workingDays) || isHoliday(nextDay, holidays));
  
  return nextDay;
};

/**
 * Get the previous working day (skip weekends and holidays)
 * @param {moment.Moment} date - Starting date
 * @param {Object} workingDays - School working days configuration
 * @param {Array} holidays - Array of holiday objects
 * @returns {moment.Moment} Previous working day
 */
const getPreviousWorkingDay = (date, workingDays = {}, holidays = []) => {
  let prevDay = date.clone();
  
  do {
    prevDay.subtract(1, 'day');
  } while (isWeekend(prevDay, workingDays) || isHoliday(prevDay, holidays));
  
  return prevDay;
};

/**
 * Get the start of the current frequency period
 * @param {string} frequency - Report frequency
 * @param {Object} schoolSettings - School settings object
 * @param {Date} currentDate - Current date
 * @returns {Date} Start of the current frequency period
 */
const getStartOfFrequencyPeriod = (frequency, schoolSettings, currentDate) => {
  const timezone = schoolSettings.timezone || 'UTC';
  const now = moment(currentDate).tz(timezone);
  const frequencyConfig = schoolSettings.reportFrequencies?.[frequency];
  
  if (!frequencyConfig) {
    return now.startOf('day').toDate();
  }
  
  // SAFETY: Normalize frequency to handle case variations
  const normalizedFrequency = frequency.charAt(0).toUpperCase() + frequency.slice(1).toLowerCase();
  
  switch (normalizedFrequency) {
    case 'Daily':
      return now.startOf('day').toDate();
      
    case 'Weekly':
      const weeklyStartDay = frequencyConfig.startDay || 1; // Monday = 1
      const currentDayOfWeek = now.day(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
      const daysToSubtract = (currentDayOfWeek - weeklyStartDay + 7) % 7;
      return now.subtract(daysToSubtract, 'days').startOf('day').toDate();
      
    case 'Bi-weekly':
    case 'Bi-Weekly':
    case 'BiWeekly':
    case 'Biweekly':
      const biWeeklyStartDay = frequencyConfig.startDay || 1;
      const biWeeklyStartWeek = frequencyConfig.startWeek || 1;
      const currentWeekOfYear = now.week();
      const weeksToSubtract = ((currentWeekOfYear - biWeeklyStartWeek) % 2 + 2) % 2;
      const adjustedDate = now.subtract(weeksToSubtract * 7, 'days');
      const daysToSubtractBiWeekly = (adjustedDate.day() - biWeeklyStartDay + 7) % 7;
      return adjustedDate.subtract(daysToSubtractBiWeekly, 'days').startOf('day').toDate();
      
    case 'Monthly':
      return now.startOf('month').toDate();
      
    case 'Bi-monthly':
    case 'Bi-Monthly':
    case 'BiMonthly':
    case 'Bimonthly':
      const startMonth = frequencyConfig.startMonth || 9; // September
      const currentMonth = now.month(); // 0-11
      const monthsSinceStart = (currentMonth - startMonth + 12) % 12;
      const monthsToSubtract = monthsSinceStart % 2;
      return now.subtract(monthsToSubtract, 'months').startOf('month').toDate();
      
    case 'Quarterly':
      const quarter = Math.floor(now.month() / 3);
      return now.startOf('quarter').toDate();
      
    case 'Annually':
      return now.startOf('year').toDate();
      
    default:
      return now.startOf('day').toDate();
  }
};

/**
 * Calculate due date for a specific frequency based on school configuration
 * @param {string} frequency - Report frequency
 * @param {Object} schoolSettings - School settings object
 * @param {moment.Moment} baseDate - Base date for calculation (defaults to current date)
 * @returns {moment.Moment} Calculated due date
 */
const calculateDueDate = (frequency, schoolSettings, baseDate = null) => {
  const { logDueDateCalculation, logError } = require('./logger');
  
  // Log function entry with all parameters
  logDueDateCalculation('calculateDueDate-entry', {
    frequency,
    schoolSettings: {
      timezone: schoolSettings.timezone,
      reportFrequencies: schoolSettings.reportFrequencies,
      frequencyConfig: schoolSettings.reportFrequencies?.[frequency],
      calendar: schoolSettings.calendar
    },
    baseDate: baseDate ? baseDate.format() : 'null',
    baseDateType: typeof baseDate,
    baseDateIsValid: baseDate ? baseDate.isValid() : 'null'
  });

  try {
    const timezone = schoolSettings.timezone || 'UTC';
    const currentDate = baseDate || getCurrentDateInTimezone(timezone);
    const frequencyConfig = schoolSettings.reportFrequencies?.[frequency];
    const workingDays = schoolSettings.calendar?.workingDays || {};
    const holidays = schoolSettings.calendar?.holidays || [];
    
    // Log initial parameters
    logDueDateCalculation('calculateDueDate-initial-params', {
      timezone,
      currentDate: currentDate.format(),
      currentDateIsValid: currentDate.isValid(),
      frequencyConfig,
      workingDays,
      holidaysCount: holidays.length
    });
    
    if (!frequencyConfig || !frequencyConfig.enabled) {
      const error = new Error(`Frequency ${frequency} is not enabled for this school`);
      logError('calculateDueDate-frequency-not-enabled', error, {
        frequency,
        frequencyConfig,
        schoolSettings: {
          timezone: schoolSettings.timezone,
          reportFrequencies: schoolSettings.reportFrequencies
        }
      });
      throw error;
    }
  
  let dueDate = currentDate.clone();
  
  // SAFETY: Normalize frequency to handle case variations consistently
  const normalizedFrequency = frequency.charAt(0).toUpperCase() + frequency.slice(1).toLowerCase();
  
  switch (normalizedFrequency) {
    case 'Daily':
      // For daily reports, check if today is a working day
      // Note: workingDays uses 1=Monday, 7=Sunday
      // Moment.js day() uses 0=Sunday, 1=Monday, 6=Saturday
      const dailyWorkingDays = frequencyConfig.workingDays || [1, 2, 3, 4, 5]; // Default to Mon-Fri
      const momentDayOfWeek = dueDate.day(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
      
      // Convert Moment.js day (0-6) to our system (1-7)
      // Moment: 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
      // Ours:   7=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
      const ourDayOfWeek = momentDayOfWeek === 0 ? 7 : momentDayOfWeek;
      const isDailyWorkingDay = dailyWorkingDays.includes(ourDayOfWeek);
      
      if (!isDailyWorkingDay) {
        // If today is not a working day, find the next working day
        let nextWorkingDay = dueDate.clone();
        do {
          nextWorkingDay.add(1, 'day');
          const nextMomentDay = nextWorkingDay.day();
          const nextOurDay = nextMomentDay === 0 ? 7 : nextMomentDay;
          if (dailyWorkingDays.includes(nextOurDay) && 
              !(frequencyConfig.skipHolidays && isHoliday(nextWorkingDay, holidays))) {
            break;
          }
        } while (true);
        dueDate = nextWorkingDay;
      }
      // If it's a working day, the report is due TODAY (regardless of time)
      // The isReportDue function will handle day-based comparison
      break;
      
    case 'Weekly':
      // Set to the configured day of the week
      // Note: dueDay uses 1=Monday, 7=Sunday
      // Moment.js day() uses 0=Sunday, 1=Monday, 6=Saturday
      const weeklyDueDay = frequencyConfig.dueDay || 5; // Default to Friday (5 in our system)
      
      // Convert our day (1-7) to Moment.js day (0-6)
      // Ours:   1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat, 7=Sun
      // Moment: 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat, 0=Sun
      const targetDay = weeklyDueDay === 7 ? 0 : weeklyDueDay;
      
      const currentDay = dueDate.day();
      let daysToAdd = (targetDay - currentDay + 7) % 7;
      
      // If it's the target day today, check if we've passed the due time
      if (daysToAdd === 0) {
        const dueTime = frequencyConfig.dueTime || '17:00';
        const [dueHours, dueMinutes] = dueTime.split(':').map(Number);
        const currentHours = dueDate.hours();
        const currentMinutes = dueDate.minutes();
        
        // If current time is after due time, move to next week
        if (currentHours > dueHours || (currentHours === dueHours && currentMinutes > dueMinutes)) {
          daysToAdd = 7;
        }
      }
      
      dueDate.add(daysToAdd, 'days');
      break;
      
      case 'Bi-weekly':
      case 'Bi-Weekly':
      case 'BiWeekly':
      case 'Biweekly':
      // Rule-based bi-weekly calculation
      dueDate = calculateBiWeeklyDate(dueDate, frequencyConfig, workingDays, holidays);
      break;
      
    case 'Monthly':
      // Rule-based monthly calculation
      dueDate = calculateRuleBasedDate(dueDate, frequencyConfig, workingDays, holidays, 'monthly');
      break;
      
      case 'Bi-monthly':
      case 'Bi-Monthly':
      case 'BiMonthly':
      case 'Bimonthly':
      // Rule-based bi-monthly calculation
      const startMonth = frequencyConfig.startMonth || 9; // Default to September
      dueDate = calculateRuleBasedDate(dueDate, frequencyConfig, workingDays, holidays, 'bi-monthly', startMonth);
      break;
      
    case 'Quarterly':
      // Find the next enabled quarter based on current date
      const quarters = frequencyConfig.quarters || {};
      const currentMonth = dueDate.month() + 1; // Convert to 1-based month
      
      // Find the next quarter that is enabled and hasn't passed yet
      let nextQuarter = null;
      let nextQuarterDate = null;
      
      // Check all quarters in order
      const quarterOrder = ['q1', 'q2', 'q3', 'q4'];
      for (const quarterKey of quarterOrder) {
        const quarter = quarters[quarterKey];
        if (quarter && quarter.enabled) {
          const quarterMonth = quarter.month;
          const quarterDay = quarter.day;
          
          // Create date for this quarter in current year
          let quarterDate = dueDate.clone().month(quarterMonth - 1).date(quarterDay);
          
          // If this quarter has passed, try next year
          if (quarterDate.isBefore(currentDate)) {
            quarterDate.add(1, 'year');
          }
          
          // If this is the first valid quarter or it's earlier than our current best
          if (!nextQuarterDate || quarterDate.isBefore(nextQuarterDate)) {
            nextQuarter = quarterKey;
            nextQuarterDate = quarterDate;
          }
        }
      }
      
      if (nextQuarterDate) {
        dueDate = nextQuarterDate;
      } else {
        // Fallback: if no quarters are enabled, use current date
        throw new Error('No quarterly reports are enabled for this school');
      }
      break;
      
    case 'Annually':
      // Set to the configured month and day (format: MMDD, e.g., 615 = June 15th)
      const yearTargetDay = frequencyConfig.dueDay;
      const yearTargetMonth = Math.floor(yearTargetDay / 100) - 1; // Convert to 0-based month index
      const yearTargetDate = yearTargetDay % 100;
      
      dueDate.month(yearTargetMonth);
      dueDate.date(yearTargetDate);
      
      // Set the due time first
      const annualDueTime = frequencyConfig.dueTime || '17:00';
      const [annualDueHours, annualDueMinutes] = annualDueTime.split(':').map(Number);
      dueDate.hours(annualDueHours).minutes(annualDueMinutes).seconds(0).milliseconds(0);
      
      // If the target date and time has passed this year, move to next year
      if (dueDate.isBefore(currentDate) || dueDate.isSame(currentDate)) {
        dueDate.add(1, 'year');
      }
      break;
      
    default:
      // SAFETY: Provide helpful error message with supported frequencies
      const supportedFrequencies = ['Daily', 'Weekly', 'Bi-Weekly', 'Monthly', 'Bi-Monthly', 'Quarterly', 'Annually'];
      throw new Error(`Unsupported frequency: "${frequency}". Supported frequencies: ${supportedFrequencies.join(', ')}`);
  }
  
  // Set the time (except for Annual reports which set time within the case)
  let hours, minutes;
  if (normalizedFrequency !== 'Annually') {
    [hours, minutes] = frequencyConfig.dueTime.split(':').map(Number);
    dueDate.hours(hours).minutes(minutes).seconds(0).milliseconds(0);
  } else {
    hours = dueDate.hours();
    minutes = dueDate.minutes();
  }
  
  logDueDateCalculation('set-due-time', {
    frequency,
    dueTime: frequencyConfig.dueTime,
    hours,
    minutes,
    dueDate: dueDate.format()
  });
  
    // Skip weekends and holidays if configured (except for annual reports)
    if (normalizedFrequency !== 'Annually') {
      if (frequencyConfig.skipWeekends && isWeekend(dueDate, workingDays)) {
        const originalDate = dueDate.clone();
        dueDate = getNextWorkingDay(dueDate, workingDays, holidays);
        logDueDateCalculation('calculateDueDate-skipped-weekend', {
          frequency,
          originalDate: originalDate.format(),
          newDate: dueDate.format()
        });
      }
      
      if (frequencyConfig.skipHolidays && isHoliday(dueDate, holidays)) {
        const originalDate = dueDate.clone();
        dueDate = getNextWorkingDay(dueDate, workingDays, holidays);
        logDueDateCalculation('calculateDueDate-skipped-holiday', {
          frequency,
          originalDate: originalDate.format(),
          newDate: dueDate.format()
        });
      }
    }
    
    // Log final result
    logDueDateCalculation('calculateDueDate-final-result', {
      frequency,
      timezone,
      dueDate: dueDate.format(),
      dueDateUTC: dueDate.toDate().toISOString(),
      dueDateIsValid: dueDate.isValid()
    });
    
    return {
      dueDate,
      timezone: timezone
    };
  } catch (error) {
    // Log any errors that occur during calculation
    logError('calculateDueDate-calculation', error, {
      frequency,
      schoolSettings: {
        timezone: schoolSettings.timezone,
        reportFrequencies: schoolSettings.reportFrequencies,
        frequencyConfig: schoolSettings.reportFrequencies?.[frequency]
      },
      baseDate: baseDate ? baseDate.format() : 'null'
    });
    
    // Re-throw the error to be handled by the caller
    throw error;
  }
};

/**
 * Check if a report is due for the current period
 * @param {string} frequency - Report frequency
 * @param {Object} schoolSettings - School settings object
 * @param {Date} lastReportDate - Date of the last report
 * @param {Date} currentDate - Current date (optional)
 * @returns {boolean} True if report is due
 */
const isReportDue = (frequency, schoolSettings, lastReportDate, currentDate = null) => {
  const { logDueDateCalculation, logError } = require('./logger');
  
  // Log function entry with all parameters
  logDueDateCalculation('isReportDue-entry', {
    frequency,
    schoolSettings: {
      timezone: schoolSettings.timezone,
      reportFrequencies: schoolSettings.reportFrequencies,
      frequencyConfig: schoolSettings.reportFrequencies?.[frequency]
    },
    lastReportDate: lastReportDate ? moment(lastReportDate).format() : 'null',
    currentDate: currentDate ? moment(currentDate).format() : 'null',
    lastReportDateType: typeof lastReportDate,
    currentDateType: typeof currentDate
  });

  try {
    const timezone = schoolSettings.timezone || 'UTC';
    const now = currentDate ? moment(currentDate).tz(timezone) : getCurrentDateInTimezone(timezone);
    const lastReport = lastReportDate ? moment(lastReportDate).tz(timezone) : null;
    
    // Log processed date parameters
    logDueDateCalculation('isReportDue-processed-dates', {
      timezone,
      now: now.format(),
      lastReport: lastReport ? lastReport.format() : 'null',
      nowIsValid: now.isValid(),
      lastReportIsValid: lastReport ? lastReport.isValid() : 'null'
    });
    
    // Calculate due date
    const dueDateResult = calculateDueDate(frequency, schoolSettings, now);
    const dueDate = dueDateResult.dueDate;
    
    // Log due date calculation result
    logDueDateCalculation('isReportDue-due-date-result', {
      frequency,
      dueDate: dueDate.format(),
      dueDateIsValid: dueDate.isValid(),
      dueDateResult: dueDateResult
    });
    
    // A report is due if:
    // 1. We're on or after the due date (entire day, not just after the time)
    // 2. No report exists, or the last report was before this due date
    const dueDateStartOfDay = dueDate.clone().startOf('day');
    const nowStartOfDay = now.clone().startOf('day');
    const isDue = (nowStartOfDay.isSameOrAfter(dueDateStartOfDay)) && (!lastReport || lastReport.isBefore(dueDate));
    
    // Log final result
    logDueDateCalculation('isReportDue-final-result', {
      frequency,
      timezone,
      now: now.format(),
      dueDate: dueDate.format(),
      lastReport: lastReport ? lastReport.format() : 'null',
      isDue,
      nowAfterDue: now.isAfter(dueDate),
      lastReportBeforeDue: !lastReport || lastReport.isBefore(dueDate)
    });
    
    return isDue;
  } catch (error) {
    // Log any errors that occur during calculation
    logError('isReportDue-calculation', error, {
      frequency,
      schoolSettings: {
        timezone: schoolSettings.timezone,
        reportFrequencies: schoolSettings.reportFrequencies,
        frequencyConfig: schoolSettings.reportFrequencies?.[frequency]
      },
      lastReportDate: lastReportDate ? moment(lastReportDate).format() : 'null',
      currentDate: currentDate ? moment(currentDate).format() : 'null'
    });
    
    // Re-throw the error to be handled by the caller
    throw error;
  }
};

/**
 * Get the next due date for a frequency
 * @param {string} frequency - Report frequency
 * @param {Object} schoolSettings - School settings object
 * @param {Date} baseDate - Base date for calculation
 * @returns {moment.Moment} Next due date
 */
const getNextDueDate = (frequency, schoolSettings, baseDate = null) => {
  const result = calculateDueDate(frequency, schoolSettings, baseDate);
  return result.dueDate;
};

/**
 * Format date in school's timezone and format
 * @param {Date} date - Date to format
 * @param {Object} schoolSettings - School settings object
 * @returns {string} Formatted date string
 */
const formatDateInSchoolTimezone = (date, schoolSettings) => {
  const timezone = schoolSettings.timezone || 'UTC';
  const dateFormat = schoolSettings.dateFormat || 'MM/DD/YYYY';
  
  return moment(date).tz(timezone).format(dateFormat);
};

/**
 * Calculate rule-based date for monthly/bi-monthly reports
 * @param {moment.Moment} baseDate - Base date for calculation
 * @param {Object} frequencyConfig - Frequency configuration
 * @param {Object} workingDays - Working days configuration
 * @param {Array} holidays - Holidays array
 * @param {string} type - 'monthly' or 'bi-monthly'
 * @param {number} startMonth - Start month for bi-monthly (1-based)
 * @returns {moment.Moment} Calculated due date
 */
const calculateRuleBasedDate = (baseDate, frequencyConfig, workingDays, holidays, type, startMonth = null) => {
  const rule = frequencyConfig.rule || 'lastWorkingDay';
  const currentDate = baseDate.clone();
  
  let targetDate;
  
  switch (rule) {
    case 'specificDate':
      const specificDay = frequencyConfig.specificDay || 28;
      targetDate = currentDate.clone().date(specificDay);
      
      // If day exceeds month length, use last day of month
      if (targetDate.month() !== currentDate.month()) {
        targetDate = currentDate.clone().endOf('month');
      }
      break;
      
    case 'lastDay':
      targetDate = currentDate.clone().endOf('month');
      break;
      
    case 'lastWorkingDay':
      targetDate = currentDate.clone().endOf('month');
      // Find the last working day of the month
      while (isWeekend(targetDate, workingDays) || isHoliday(targetDate, holidays)) {
        targetDate.subtract(1, 'day');
      }
      break;
      
    case 'nthWeekday':
      const nth = frequencyConfig.nthWeekday?.n || 1;
      const weekday = frequencyConfig.nthWeekday?.weekday || 5; // Friday (in our system: 1=Mon, 7=Sun)
      
      // Convert our day format (1=Mon, 7=Sun) to Moment.js format (0=Sun, 1=Mon)
      const momentWeekday = weekday === 7 ? 0 : weekday;
      
      if (nth === -1) {
        // Last occurrence of the weekday
        targetDate = currentDate.clone().endOf('month');
        while (targetDate.day() !== momentWeekday) {
          targetDate.subtract(1, 'day');
        }
      } else {
        // Nth occurrence of the weekday
        targetDate = currentDate.clone().startOf('month');
        let count = 0;
        while (count < nth) {
          if (targetDate.day() === momentWeekday) {
            count++;
          }
          if (count < nth) {
            targetDate.add(1, 'day');
          }
        }
      }
      break;
      
    default:
      targetDate = currentDate.clone().endOf('month');
  }
  
  // Apply weekend policy if needed
  const weekendPolicy = frequencyConfig.weekendPolicy || 'nextWorkingDay';
  if (weekendPolicy !== 'none' && (isWeekend(targetDate, workingDays) || isHoliday(targetDate, holidays))) {
    switch (weekendPolicy) {
      case 'nextWorkingDay':
        targetDate = getNextWorkingDay(targetDate, workingDays, holidays);
        break;
      case 'previousWorkingDay':
        targetDate = getPreviousWorkingDay(targetDate, workingDays, holidays);
        break;
      case 'nearestWorkingDay':
        const nextWorking = getNextWorkingDay(targetDate, workingDays, holidays);
        const prevWorking = getPreviousWorkingDay(targetDate, workingDays, holidays);
        const nextDiff = Math.abs(nextWorking.diff(targetDate, 'days'));
        const prevDiff = Math.abs(prevWorking.diff(targetDate, 'days'));
        targetDate = nextDiff <= prevDiff ? nextWorking : prevWorking;
        break;
    }
  }
  
  // For bi-monthly, ensure we're on the correct months
  if (type === 'bi-monthly' && startMonth) {
    const currentMonth = targetDate.month() + 1; // Convert to 1-based
    const monthsSinceStart = (currentMonth - startMonth + 12) % 12;
    
    if (monthsSinceStart % 2 !== 0) {
      // Move to next bi-monthly period
      targetDate.add(1, 'month');
      return calculateRuleBasedDate(targetDate, frequencyConfig, workingDays, holidays, type, startMonth);
    }
  }
  
  // If the target date has passed, move to next period
  if (targetDate.isBefore(currentDate)) {
    if (type === 'monthly') {
      targetDate.add(1, 'month');
    } else if (type === 'bi-monthly') {
      targetDate.add(2, 'months');
    }
    return calculateRuleBasedDate(targetDate, frequencyConfig, workingDays, holidays, type, startMonth);
  }
  
  return targetDate;
};

/**
 * Calculate bi-weekly date based on rules
 * @param {moment.Moment} baseDate - Base date for calculation
 * @param {Object} frequencyConfig - Frequency configuration
 * @param {Object} workingDays - Working days configuration
 * @param {Array} holidays - Holidays array
 * @returns {moment.Moment} Calculated due date
 */
const calculateBiWeeklyDate = (baseDate, frequencyConfig, workingDays, holidays) => {
  const rule = frequencyConfig.rule || 'alternateWeeks';
  const dueDay = frequencyConfig.dueDay || 5; // Friday (in our system: 1=Mon, 7=Sun)
  const currentDate = baseDate.clone();
  
  // Helper function to convert our day format (1=Mon, 7=Sun) to Moment.js format (0=Sun, 1=Mon)
  const convertToMomentDay = (ourDay) => ourDay === 7 ? 0 : ourDay;
  
  let targetDate;
  
  switch (rule) {
    case 'alternateWeeks':
      // Set to the configured day of the week
      const targetDay = convertToMomentDay(dueDay);
      const currentDay = currentDate.day();
      const daysToAdd = (targetDay - currentDay + 7) % 7;
      targetDate = currentDate.clone().add(daysToAdd, 'days');
      
      // Ensure it's every other week based on start week
      const startWeek = frequencyConfig.startWeek || 1;
      const weekNumber = targetDate.week();
      const shouldBeEvenWeek = startWeek === 1; // Week 1 starts with odd weeks
      
      if ((weekNumber % 2 === 0) !== shouldBeEvenWeek) {
        targetDate.add(7, 'days');
      }
      break;
      
    case 'specificWeeks':
      // Set to the configured day of the week
      const specificTargetDay = convertToMomentDay(dueDay);
      const specificCurrentDay = currentDate.day();
      const specificDaysToAdd = (specificTargetDay - specificCurrentDay + 7) % 7;
      targetDate = currentDate.clone().add(specificDaysToAdd, 'days');
      
      // Find the next specific week
      const specificWeeks = frequencyConfig.specificWeeks || [1, 3];
      const currentWeekOfMonth = Math.ceil(targetDate.date() / 7);
      
      // If current week is not in specific weeks, find the next one
      if (!specificWeeks.includes(currentWeekOfMonth)) {
        // Find the next specific week
        let nextWeek = null;
        for (const week of specificWeeks) {
          if (week > currentWeekOfMonth) {
            nextWeek = week;
            break;
          }
        }
        
        if (nextWeek) {
          // Move to the next specific week
          const daysToNextWeek = (nextWeek - currentWeekOfMonth) * 7;
          targetDate.add(daysToNextWeek, 'days');
        } else {
          // Move to next month, first specific week
          targetDate.add(1, 'month').startOf('month');
          const firstSpecificWeek = Math.min(...specificWeeks);
          targetDate.add((firstSpecificWeek - 1) * 7, 'days');
          
          // Set to the correct day of week
          const dayOfWeek = convertToMomentDay(dueDay);
          const currentDayOfWeek = targetDate.day();
          const daysToAddWeek = (dayOfWeek - currentDayOfWeek + 7) % 7;
          targetDate.add(daysToAddWeek, 'days');
        }
      }
      break;
      
    case 'nthWeekOfMonth':
      // Set to the Nth occurrence of the specified week
      const nth = frequencyConfig.nthWeekOfMonth?.n || 1;
      const weekOfMonth = frequencyConfig.nthWeekOfMonth?.week || 3;
      
      // Start from the beginning of the month
      targetDate = currentDate.clone().startOf('month');
      
      // Move to the specified week of the month
      targetDate.add((weekOfMonth - 1) * 7, 'days');
      
      // Set to the correct day of week
      const nthDayOfWeek = convertToMomentDay(dueDay);
      const nthCurrentDayOfWeek = targetDate.day();
      const nthDaysToAdd = (nthDayOfWeek - nthCurrentDayOfWeek + 7) % 7;
      targetDate.add(nthDaysToAdd, 'days');
      
      // If this is not the Nth occurrence, move to the next month
      if (nth > 1) {
        targetDate.add(1, 'month');
        return calculateBiWeeklyDate(targetDate, frequencyConfig, workingDays, holidays);
      }
      break;
      
    default:
      // Fallback to alternate weeks
      const fallbackTargetDay = convertToMomentDay(dueDay);
      const fallbackCurrentDay = currentDate.day();
      const fallbackDaysToAdd = (fallbackTargetDay - fallbackCurrentDay + 7) % 7;
      targetDate = currentDate.clone().add(fallbackDaysToAdd, 'days');
      
      const fallbackWeekNumber = targetDate.week();
      if (fallbackWeekNumber % 2 !== 0) {
        targetDate.add(7, 'days');
      }
  }
  
  // Apply weekend policy if needed
  const weekendPolicy = frequencyConfig.weekendPolicy || 'nextWorkingDay';
  if (weekendPolicy !== 'none' && (isWeekend(targetDate, workingDays) || isHoliday(targetDate, holidays))) {
    switch (weekendPolicy) {
      case 'nextWorkingDay':
        targetDate = getNextWorkingDay(targetDate, workingDays, holidays);
        break;
      case 'previousWorkingDay':
        targetDate = getPreviousWorkingDay(targetDate, workingDays, holidays);
        break;
      case 'nearestWorkingDay':
        const nextWorking = getNextWorkingDay(targetDate, workingDays, holidays);
        const prevWorking = getPreviousWorkingDay(targetDate, workingDays, holidays);
        const nextDiff = Math.abs(nextWorking.diff(targetDate, 'days'));
        const prevDiff = Math.abs(prevWorking.diff(targetDate, 'days'));
        targetDate = nextDiff <= prevDiff ? nextWorking : prevWorking;
        break;
    }
  }
  
  // If the target date has passed, move to next period
  if (targetDate.isBefore(currentDate)) {
    if (rule === 'alternateWeeks') {
      targetDate.add(14, 'days');
    } else if (rule === 'specificWeeks') {
      // Move to next month
      targetDate.add(1, 'month').startOf('month');
      const specificWeeks = frequencyConfig.specificWeeks || [1, 3];
      const firstSpecificWeek = Math.min(...specificWeeks);
      targetDate.add((firstSpecificWeek - 1) * 7, 'days');
      
      const dayOfWeek = convertToMomentDay(dueDay);
      const currentDayOfWeek = targetDate.day();
      const daysToAddPeriod = (dayOfWeek - currentDayOfWeek + 7) % 7;
      targetDate.add(daysToAddPeriod, 'days');
    } else if (rule === 'nthWeekOfMonth') {
      targetDate.add(1, 'month');
      return calculateBiWeeklyDate(targetDate, frequencyConfig, workingDays, holidays);
    }
  }
  
  return targetDate;
};

/**
 * Get available timezones
 * @returns {Array} Array of timezone objects
 */
const getAvailableTimezones = () => {
  return moment.tz.names().map(name => ({
    value: name,
    label: name.replace(/_/g, ' '),
    offset: moment.tz(name).format('Z')
  }));
};

module.exports = {
  getCurrentDateInTimezone,
  isWeekend,
  isHoliday,
  getNextWorkingDay,
  getPreviousWorkingDay,
  calculateDueDate,
  isReportDue,
  getNextDueDate,
  formatDateInSchoolTimezone,
  getAvailableTimezones,
  getStartOfFrequencyPeriod
};
