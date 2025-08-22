const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Create a rotating log file
const getLogFileName = (prefix = 'due-reports-debug') => {
  const date = new Date().toISOString().split('T')[0];
  return `${prefix}-${date}.log`;
};

const logFile = path.join(logsDir, getLogFileName());

const log = (level, message, data = null) => {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    level,
    message,
    data
  };

  const logLine = JSON.stringify(logEntry) + '\n';
  
  try {
    fs.appendFileSync(logFile, logLine);
  } catch (error) {
    console.error('Failed to write to log file:', error);
  }
  
  // Also log to console for immediate visibility
  console.log(`[${timestamp}] ${level.toUpperCase()}: ${message}`, data ? JSON.stringify(data, null, 2) : '');
};

async function checkDueReports() {
  log('info', 'Starting due reports check for Republica of Hunululu');
  
  try {
    log('info', 'Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    log('info', 'Connected to MongoDB successfully');
    
    // Get the school
    const School = require('./models/School');
    log('info', 'Searching for school: Republica of Hunululu');
    
    const school = await School.findOne({ name: 'Republica of Hunululu' });
    
    if (!school) {
      log('error', 'School not found: Republica of Hunululu');
      return;
    }
    
    log('info', 'School found', {
      schoolId: school._id,
      name: school.name,
      timezone: school.settings?.timezone || 'UTC'
    });
    
    log('info', 'School settings', school.settings);
    
    // Get all students for this school
    const User = require('./models/User');
    log('info', 'Fetching students for school');
    
    const students = await User.find({ 
      schoolId: school._id, 
      role: 'student' 
    }).populate('assignedTeacher');
    
    log('info', 'Students found', {
      count: students.length,
      students: students.map(s => ({
        id: s._id,
        name: `${s.firstName} ${s.lastName}`,
        grade: s.studentGrade || s.grade,
        teacher: s.assignedTeacher ? `${s.assignedTeacher.firstName} ${s.assignedTeacher.lastName}` : 'None'
      }))
    });
    
    // Get report templates
    const ReportTemplate = require('./models/ReportTemplate');
    log('info', 'Fetching report templates');
    
    const templates = await ReportTemplate.find({ schoolId: school._id });
    
    log('info', 'Templates found', {
      count: templates.length,
      templates: templates.map(t => ({
        id: t._id,
        name: t.name,
        grade: t.grade,
        frequency: t.reportFrequency,
        isActive: t.isActive
      }))
    });
    
    // Get existing reports
    const Report = require('./models/Report');
    log('info', 'Fetching existing reports');
    
    const reports = await Report.find({ schoolId: school._id });
    
    log('info', 'Reports found', {
      count: reports.length,
      reports: reports.map(r => ({
        id: r._id,
        studentId: r.studentId,
        templateId: r.templateId,
        createdAt: r.createdAt,
        status: r.status
      }))
    });
    
    // Check due status for each student-template combination
    const { calculateDueDate, isReportDue } = require('./utils/dateUtils');
    const moment = require('moment-timezone');
    
    const timezone = school.settings?.timezone || 'UTC';
    const now = moment().tz(timezone);
    
    log('info', 'Current time calculation', {
      timezone,
      now: now.format(),
      nowISO: now.toISOString(),
      nowLocal: now.local().format()
    });
    
    let dueReportsCount = 0;
    let totalChecks = 0;
    
    for (const student of students) {
      log('info', `Processing student: ${student.firstName} ${student.lastName}`, {
        studentId: student._id,
        grade: student.studentGrade || student.grade,
        teacher: student.assignedTeacher ? `${student.assignedTeacher.firstName} ${student.assignedTeacher.lastName}` : 'None'
      });
      
      for (const template of templates) {
        if (!template.isActive) {
          log('debug', `Skipping inactive template: ${template.name}`);
          continue;
        }
        
        const studentGrade = (student.studentGrade || student.grade || '').toLowerCase();
        const templateGrade = template.grade.toLowerCase();
        
        log('debug', 'Grade comparison', {
          studentGrade,
          templateGrade,
          matches: studentGrade === templateGrade
        });
        
        if (studentGrade === templateGrade) {
          totalChecks++;
          log('info', `Checking template: ${template.name}`, {
            templateId: template._id,
            frequency: template.reportFrequency,
            grade: template.grade
          });
          
          // Get last report for this student-template combination
          const lastReport = await Report.findOne({
            schoolId: school._id,
            studentId: student._id,
            templateId: template._id
          }).sort({ createdAt: -1 });
          
          const lastReportDate = lastReport ? moment(lastReport.createdAt).tz(timezone) : null;
          
          log('info', 'Last report info', {
            hasLastReport: !!lastReport,
            lastReportDate: lastReportDate ? lastReportDate.format() : null,
            lastReportId: lastReport ? lastReport._id : null
          });
          
          // Check if report is due
          log('info', 'Calling isReportDue', {
            frequency: template.reportFrequency,
            settings: school.settings,
            lastReportDate: lastReportDate ? lastReportDate.format() : null,
            now: now.format()
          });
          
          const due = isReportDue(template.reportFrequency, school.settings, lastReportDate, now);
          
          log('info', 'Due status result', {
            isDue: due,
            frequency: template.reportFrequency
          });
          
          if (due) {
            dueReportsCount++;
            
            // Calculate next due date
            log('info', 'Calculating next due date');
            const nextDueResult = calculateDueDate(template.reportFrequency, school.settings, now);
            const nextDue = nextDueResult.dueDate;
            
            log('info', 'Next due date calculation', {
              nextDue: nextDue ? nextDue.format() : null,
              timezone: nextDueResult.timezone
            });
            
            log('warn', 'DUE REPORT FOUND', {
              student: `${student.firstName} ${student.lastName}`,
              template: template.name,
              frequency: template.reportFrequency,
              lastReportDate: lastReportDate ? lastReportDate.format() : 'None',
              nextDueDate: nextDue ? nextDue.format() : 'None',
              timezone
            });
          }
        }
      }
    }
    
    log('info', 'Summary', {
      totalStudents: students.length,
      totalTemplates: templates.length,
      totalChecks,
      dueReportsCount,
      timezone
    });
    
  } catch (error) {
    log('error', 'Error in checkDueReports', {
      error: error.message,
      stack: error.stack
    });
  } finally {
    log('info', 'Disconnecting from MongoDB');
    await mongoose.disconnect();
    log('info', 'Due reports check completed');
  }
}

checkDueReports();
