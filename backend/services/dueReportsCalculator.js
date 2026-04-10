/**
 * DUE REPORTS CALCULATOR SERVICE
 * 
 * SINGLE SOURCE OF TRUTH for due reports calculation
 * Used by: Frontend, Backend API, Notifications, Mobile Apps
 * 
 * Business Rules:
 * 1. ONE report per student per template per period (regardless of teacher)
 * 2. Report is DUE if: due date passed AND no report exists for current period
 * 3. Report is NOT DUE if: report exists (by any teacher) OR due date not reached
 * 4. Always use school timezone for calculations
 * 5. Multiple teachers can view, but only one can generate per period
 */

const moment = require('moment-timezone');
const Report = require('../models/Report');
const ReportTemplate = require('../models/ReportTemplate');
const User = require('../models/User');
const School = require('../models/School');
const { logger } = require('../utils/logger');
const { gradesMatch } = require('../utils/gradeUtils');
const { calculateDueDate: dateUtilsCalculateDueDate } = require('../utils/dateUtils');

/**
 * Get start of current period based on frequency
 */
function getStartOfPeriod(frequency, settings, now) {
  const timezone = settings.timezone || 'UTC';
  const nowInTimezone = moment(now).tz(timezone);
  
  // Normalize so "Bi-Weekly" and "biweekly" both match (template.reportFrequency is "Bi-Weekly")
  const freqKey = frequency.toLowerCase().replace(/-/g, '');

  switch (freqKey) {
    case 'daily':
      return nowInTimezone.clone().startOf('day').toDate();
    
    case 'weekly':
      const weekStartDay = settings.reportFrequencies?.Weekly?.dayOfWeek || settings.reportFrequencies?.weekly?.dayOfWeek || 1; // Default Monday
      return nowInTimezone.clone().isoWeekday(weekStartDay).startOf('day').toDate();
    
    case 'biweekly':
      const biweeklyConfig = settings.reportFrequencies?.['Bi-Weekly'] || settings.reportFrequencies?.biweekly || {};
      const biweeklyStartDay = biweeklyConfig.dayOfWeek || 1;
      const biweeklyInterval = biweeklyConfig.interval || 14;
      let biweeklyStart = nowInTimezone.clone().isoWeekday(biweeklyStartDay).startOf('day');
      
      // If we're before the start day this week, go back one week
      if (nowInTimezone.isBefore(biweeklyStart)) {
        biweeklyStart.subtract(1, 'week');
      }
      
      // Calculate which biweekly period we're in
      const weeksSinceEpoch = biweeklyStart.diff(moment.tz('2000-01-01', timezone), 'weeks');
      const periodsBack = weeksSinceEpoch % (biweeklyInterval / 7);
      biweeklyStart.subtract(periodsBack, 'weeks');
      
      return biweeklyStart.toDate();
    
    case 'monthly':
      const monthlyConfig = settings.reportFrequencies?.Monthly || settings.reportFrequencies?.monthly || {};
      const monthlyDay = monthlyConfig.specificDay || monthlyConfig.dayOfMonth || 1;
      let monthlyStart = nowInTimezone.clone().date(monthlyDay).startOf('day');
      
      // If we're before the day this month, go back one month
      if (nowInTimezone.isBefore(monthlyStart)) {
        monthlyStart.subtract(1, 'month');
      }
      
      return monthlyStart.toDate();
    
    case 'bimonthly': {
      const bimonthlyConfig = settings.reportFrequencies?.['Bi-Monthly'] || settings.reportFrequencies?.biMonthly || settings.reportFrequencies?.bimonthly || {};
      const startMonth = bimonthlyConfig.startMonth || 9; // Default September (1-based)
      const currentMonth = nowInTimezone.month() + 1; // 1-based
      const monthsSinceStart = (currentMonth - startMonth + 12) % 12;
      const monthsToSubtract = monthsSinceStart % 2;
      const bimonthlyStart = nowInTimezone.clone().subtract(monthsToSubtract, 'months').startOf('month');
      return bimonthlyStart.toDate();
    }
    
    case 'quarterly':
      const quarterlyConfig = settings.reportFrequencies?.Quarterly || settings.reportFrequencies?.quarterly || {};
      const quarterlyStartMonth = quarterlyConfig.startMonth || 1;
      const quarterlyDay = quarterlyConfig.dayOfMonth || 1;
      let quarterlyStart = nowInTimezone.clone()
        .month((Math.floor((nowInTimezone.month() - quarterlyStartMonth + 1) / 3) * 3) + quarterlyStartMonth - 1)
        .date(quarterlyDay)
        .startOf('day');
      
      // If we're before this quarter's start, go back one quarter
      if (nowInTimezone.isBefore(quarterlyStart)) {
        quarterlyStart.subtract(3, 'months');
      }
      
      return quarterlyStart.toDate();
    
    case 'annually':
      const annualConfig = settings.reportFrequencies?.Annually || settings.reportFrequencies?.annually || {};
      const dueDayMMDD = annualConfig.dueDay || 101; // Default Jan 1 (1*100+1)
      const annualMonth = (annualConfig.month != null ? annualConfig.month : Math.floor(dueDayMMDD / 100)) || 1;
      const annualDay = (annualConfig.dayOfMonth != null ? annualConfig.dayOfMonth : (annualConfig.day != null ? annualConfig.day : (dueDayMMDD % 100))) || 1;
      let annualStart = nowInTimezone.clone().month(annualMonth - 1).date(annualDay).startOf('day');
      
      // If we're before this year's date, go back one year
      if (nowInTimezone.isBefore(annualStart)) {
        annualStart.subtract(1, 'year');
      }
      
      return annualStart.toDate();
    
    default:
      return nowInTimezone.clone().startOf('day').toDate();
  }
}

/**
 * Check if a report exists for the current period
 * Returns the report if found, null otherwise
 */
async function getReportForCurrentPeriod(studentId, templateId, schoolId, frequency, settings, now) {
  try {
    const periodStart = getStartOfPeriod(frequency, settings, now);
    
    const report = await Report.findOne({
      schoolId,
      studentId,
      templateId,
      createdAt: { $gte: periodStart },
      // Don't filter by teacher - check ALL teachers' reports
    })
    .populate('teacherId', 'firstName lastName')
    .sort({ createdAt: -1 })
    .lean();
    
    return report;
  } catch (error) {
    logger.error('Error getting report for current period:', error);
    return null;
  }
}

/**
 * MAIN FUNCTION: Calculate due reports for a teacher
 * 
 * @param {String} teacherId - Teacher's user ID
 * @param {Object} options - Optional filters
 * @returns {Array} Array of due report objects
 */
async function calculateDueReportsForTeacher(teacherId, options = {}) {
  try {
    logger.info(`📊 Calculating due reports for teacher: ${teacherId}`);
    
    // Get teacher
    const teacher = await User.findById(teacherId).select('schoolId firstName lastName');
    if (!teacher) {
      throw new Error('Teacher not found');
    }
    const schoolId = teacher.schoolId && teacher.schoolId.toString ? teacher.schoolId.toString() : teacher.schoolId;
    if (!schoolId) {
      logger.info('Teacher has no school assigned');
      return [];
    }

    // Get school and settings
    const school = await School.findById(schoolId).select('settings name');
    if (!school) {
      throw new Error('School not found for this teacher');
    }
    const settings = school.settings && typeof school.settings === 'object' ? school.settings : {};
    if (!settings || Object.keys(settings).length === 0) {
      logger.info('School has no settings; using defaults for due report calculation');
    }

    const timezone = settings.timezone || 'UTC';
    const now = moment().tz(timezone); // Keep as moment object for calculateDueDate
    
    // Get teacher's assigned students
    const Class = require('../models/Class');
    const teacherClasses = await Class.find({
      'assignedTeachers.teacherId': teacherId,
      isActive: true
    }).select('name');
    
    if (teacherClasses.length === 0) {
      logger.info('No classes assigned to teacher');
      return [];
    }
    
    const students = await User.find({
      role: 'student',
      studentClass: { $in: teacherClasses.map(c => c.name) },
      schoolId: teacher.schoolId,
      isActive: true
    }).select('_id firstName lastName studentGrade studentClass').lean();
    
    if (students.length === 0) {
      logger.info('No students found for teacher');
      return [];
    }
    
    // Get active templates for this school
    const templates = await ReportTemplate.find({
      schoolId: teacher.schoolId,
      isActive: true
    }).select('_id name reportFrequency grade').lean();
    
    if (templates.length === 0) {
      logger.info('No active templates found');
      return [];
    }
    
    const dueReports = [];
    
    // Check each student x template combination
    for (const student of students) {
      // Find templates matching student's grade
      const gradeTemplates = templates.filter(t => 
        gradesMatch(t.grade, student.studentGrade)
      );
      
      logger.info(`📋 Student: ${student.firstName} ${student.lastName} | Grade: ${student.studentGrade} | Matching templates: ${gradeTemplates.length}`);
      
      for (const template of gradeTemplates) {
        try {
          logger.info(`🔍 Checking template: ${template.name} (${template.reportFrequency}) for student: ${student.firstName} ${student.lastName}`);
          
          // SAFETY CHECK: Validate template has required fields
          if (!template.reportFrequency) {
            logger.error(`⚠️ Template ${template.name} missing reportFrequency - skipping`);
            continue;
          }
          
          // SAFETY CHECK: Normalize frequency to handle case variations
          const normalizedFrequency = template.reportFrequency.trim();
          
          // Calculate due date for this frequency
          let dueDateResult;
          try {
            dueDateResult = dateUtilsCalculateDueDate(normalizedFrequency, settings, now);
          } catch (calcError) {
            logger.error(`❌ Failed to calculate due date for ${normalizedFrequency}:`, calcError);
            logger.error(`Template: ${template.name}, Student: ${student.firstName} ${student.lastName}`);
            continue; // Skip this template but continue processing others
          }
          
          // SAFETY CHECK: Validate dueDateResult
          if (!dueDateResult || !dueDateResult.dueDate) {
            logger.error(`⚠️ Invalid dueDateResult for template ${template.name} - skipping`);
            continue;
          }
          
          logger.info(`🔍 dueDateResult type: ${typeof dueDateResult}`);
          logger.info(`🔍 dueDateResult keys: ${Object.keys(dueDateResult || {}).join(', ')}`);
          logger.info(`🔍 dueDateResult.dueDate type: ${typeof dueDateResult?.dueDate}`);
          logger.info(`🔍 dueDateResult.timezone: ${dueDateResult?.timezone}`);
          
          const dueDateMoment = dueDateResult.dueDate; // Already a moment object
          logger.info(`🔍 dueDateMoment: ${dueDateMoment ? dueDateMoment.format('YYYY-MM-DD HH:mm') : 'undefined'}`);
          
          // SAFETY CHECK: Validate dueDateMoment is valid
          if (!dueDateMoment || !dueDateMoment.isValid || !dueDateMoment.isValid()) {
            logger.error(`⚠️ Invalid dueDateMoment for template ${template.name} - skipping`);
            continue;
          }
          
          // now is already a moment object in the correct timezone
          const nowMoment = now.clone();
          
          logger.info(`📅 Due: ${dueDateMoment ? dueDateMoment.format('YYYY-MM-DD HH:mm') : 'undefined'} | Now: ${nowMoment.format('YYYY-MM-DD HH:mm')}`);
          
          // Check if due date has passed
          const isDue = nowMoment.isAfter(dueDateMoment);
          
          logger.info(`❓ Is Due: ${isDue}`);
          
          if (!isDue) {
            // Not due yet - skip
            logger.info(`⏩ Skipping - not due yet`);
            continue;
          }
          
          // Check if report exists for current period (from ANY teacher)
          const existingReport = await getReportForCurrentPeriod(
            student._id,
            template._id,
            teacher.schoolId,
            template.reportFrequency,
            settings,
            now
          );
          
          logger.info(`📊 Existing report: ${existingReport ? `Found (status: ${existingReport.status})` : 'None'}`);
          
          if (existingReport) {
            // A report exists for this period (by any teacher, any status except archived).
            // Once a report has been generated it is no longer "due".
            if (existingReport.status !== 'archived') {
              logger.info(`✅ Report already exists (status: ${existingReport.status}) for ${student.firstName} ${student.lastName} - ${template.name} - not due`);
              continue;
            }
            // Archived reports are treated as if they don't exist — fall through to push as due.
          }

          // No report exists for current period (or existing is archived) - DUE
          const daysOverdue = Math.floor(nowMoment.diff(dueDateMoment, 'days', true));

          dueReports.push({
            studentId: student._id.toString(),
            studentName: `${student.firstName} ${student.lastName}`,
            studentGrade: student.studentGrade,
            studentClass: student.studentClass,
            templateId: template._id.toString(),
            templateName: template.name,
            frequency: template.reportFrequency,
            dueDate: dueDateMoment.toDate(),
            daysOverdue: Math.max(0, daysOverdue),
            reportStatus: 'missing',
            reportId: null,
            createdBy: null,
            teacherName: `${teacher.firstName} ${teacher.lastName}`,
            timezone: timezone,
            calculatedAt: new Date()
          });
        } catch (error) {
          logger.error(`Error processing student ${student._id} template ${template._id}:`, error);
        }
      }
    }
    
    // Sort by most overdue first
    dueReports.sort((a, b) => b.daysOverdue - a.daysOverdue);
    
    logger.info(`✅ Calculated ${dueReports.length} due reports for teacher ${teacherId}`);
    
    return dueReports;
    
  } catch (error) {
    logger.error('Error calculating due reports:', error);
    throw error;
  }
}

/**
 * Calculate due reports for ALL teachers (used by notification system)
 * 
 * @returns {Object} Map of teacherId -> Array of due reports
 */
async function calculateDueReportsForAllTeachers() {
  try {
    logger.info('📊 Calculating due reports for ALL teachers');
    
    const teachers = await User.find({
      role: 'teacher',
      isActive: true
    }).select('_id').lean();
    
    const allDueReports = {};
    
    for (const teacher of teachers) {
      const dueReports = await calculateDueReportsForTeacher(teacher._id.toString());
      if (dueReports.length > 0) {
        allDueReports[teacher._id.toString()] = dueReports;
      }
    }
    
    logger.info(`✅ Calculated due reports for ${Object.keys(allDueReports).length} teachers with pending reports`);
    
    return allDueReports;
    
  } catch (error) {
    logger.error('Error calculating due reports for all teachers:', error);
    throw error;
  }
}

/**
 * Check if a specific report can be generated
 * Returns: { canGenerate: boolean, reason: string, existingReport: object }
 */
async function canGenerateReport(teacherId, studentId, templateId) {
  try {
    const teacher = await User.findById(teacherId).select('schoolId');
    if (!teacher) {
      return { canGenerate: false, reason: 'Teacher not found' };
    }
    
    const school = await School.findById(teacher.schoolId).select('settings');
    if (!school) {
      return { canGenerate: false, reason: 'School not found' };
    }
    
    const template = await ReportTemplate.findById(templateId).select('reportFrequency isActive');
    if (!template) {
      return { canGenerate: false, reason: 'Template not found' };
    }
    
    if (!template.isActive) {
      return { canGenerate: false, reason: 'Template is not active' };
    }
    
    const settings = school.settings;
    const timezone = settings.timezone || 'UTC';
    const now = moment().tz(timezone); // Keep as moment object
    
    // Check if report exists for current period (from ANY teacher)
    const existingReport = await getReportForCurrentPeriod(
      studentId,
      templateId,
      teacher.schoolId,
      template.reportFrequency,
      settings,
      now
    );
    
    if (existingReport) {
      const reportTeacherId = existingReport.teacherId?._id?.toString() || existingReport.teacherId?.toString();
      const currentTeacherId = teacherId.toString();
      
      if (reportTeacherId !== currentTeacherId) {
        // Report exists by another teacher
        return {
          canGenerate: false,
          reason: `Report for this period has already been generated by ${existingReport.teacherId?.firstName} ${existingReport.teacherId?.lastName}`,
          existingReport: existingReport
        };
      }
      
      // Report exists by current teacher
      if (existingReport.status === 'sent') {
        return {
          canGenerate: false,
          reason: 'You have already sent a report for this period',
          existingReport: existingReport
        };
      }
      
      // Draft or completed - can edit
      return {
        canGenerate: true,
        reason: 'You can continue editing your existing draft',
        existingReport: existingReport
      };
    }
    
    // No report exists - can generate
    return {
      canGenerate: true,
      reason: 'No report exists for this period',
      existingReport: null
    };
    
  } catch (error) {
    logger.error('Error checking if report can be generated:', error);
    return { canGenerate: false, reason: 'Error checking report status' };
  }
}

module.exports = {
  calculateDueReportsForTeacher,
  calculateDueReportsForAllTeachers,
  canGenerateReport,
  getReportForCurrentPeriod,
  getStartOfPeriod
};

