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
const getLogFileName = (prefix = 'inf-a-due-reports') => {
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

async function checkInfADueReports() {
  log('info', 'Starting comprehensive due reports check for Inf A class students');
  
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
      timezone: school.settings?.timezone || 'UTC',
      settings: school.settings
    });
    
    // Get the Inf A class
    const User = require('./models/User'); // Load User model first
    const Class = require('./models/Class');
    log('info', 'Searching for class: Inf A');
    
    const infAClass = await Class.findOne({ 
      schoolId: school._id, 
      name: 'Inf A' 
    }).populate('assignedTeachers.teacherId');
    
    if (!infAClass) {
      log('error', 'Class Inf A not found');
      return;
    }
    
    log('info', 'Inf A class found', {
      classId: infAClass._id,
      className: infAClass.name,
      classGrade: infAClass.grade,
      teachers: infAClass.assignedTeachers ? infAClass.assignedTeachers.map(t => ({
        teacherId: t.teacherId._id,
        teacherName: `${t.teacherId.firstName} ${t.teacherId.lastName}`,
        role: t.role
      })) : [],
      studentsInClass: infAClass.students ? infAClass.students.length : 0
    });
    
    // Get all students for this school (role: parent)
    log('info', 'Fetching all students (role: parent) for school');
    
    const allStudents = await User.find({ 
      schoolId: school._id, 
      role: 'parent' 
    });
    
    log('info', 'All students found', {
      count: allStudents.length,
      students: allStudents.map(s => ({
        id: s._id,
        name: `${s.firstName} ${s.lastName}`,
        grade: s.studentGrade || s.grade,
        classId: s.classId,
        email: s.email,
        createdAt: s.createdAt
      }))
    });
    
    // Filter students who are in Inf A class
    const infAStudents = allStudents.filter(student => 
      student.classId && student.classId.toString() === infAClass._id.toString()
    );
    
    log('info', 'Students in Inf A class', {
      count: infAStudents.length,
      students: infAStudents.map(s => ({
        id: s._id,
        name: `${s.firstName} ${s.lastName}`,
        grade: s.studentGrade || s.grade,
        email: s.email
      }))
    });
    
    // Get report templates for this school
    const ReportTemplate = require('./models/ReportTemplate');
    log('info', 'Fetching report templates for school');
    
    const templates = await ReportTemplate.find({ schoolId: school._id });
    
    log('info', 'Report templates found', {
      count: templates.length,
      templates: templates.map(t => ({
        id: t._id,
        name: t.name,
        grade: t.grade,
        frequency: t.reportFrequency,
        isActive: t.isActive
      }))
    });
    
    // Get existing reports for these students
    const Report = require('./models/Report');
    log('info', 'Fetching existing reports for Inf A students');
    
    const studentIds = infAStudents.map(s => s._id);
    const existingReports = await Report.find({
      schoolId: school._id,
      studentId: { $in: studentIds }
    });
    
    log('info', 'Existing reports found', {
      count: existingReports.length,
      reports: existingReports.map(r => ({
        id: r._id,
        studentId: r.studentId,
        templateId: r.templateId,
        createdAt: r.createdAt,
        status: r.status
      }))
    });
    
    // Import date calculation utilities
    const { calculateDueDate, isReportDue } = require('./utils/dateUtils');
    const moment = require('moment-timezone');
    
    const timezone = school.settings?.timezone || 'UTC';
    const now = moment().tz(timezone);
    
    log('info', 'Current time calculation', {
      timezone,
      now: now.format(),
      nowISO: now.toISOString(),
      nowLocal: now.local().format(),
      dayOfWeek: now.format('dddd'),
      dayNumber: now.day()
    });
    
    // Check due reports for each student
    let totalDueReports = 0;
    let totalChecks = 0;
    
    for (const student of infAStudents) {
      log('info', `Processing student: ${student.firstName} ${student.lastName}`, {
        studentId: student._id,
        grade: student.studentGrade || student.grade,
        classId: student.classId
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
            totalDueReports++;
            
            // Calculate next due date
            log('info', 'Calculating next due date');
            const nextDueResult = calculateDueDate(template.reportFrequency, school.settings, now);
            const nextDue = nextDueResult.dueDate;
            
            log('info', 'Next due date calculation', {
              nextDue: nextDue ? nextDue.format() : null,
              timezone: nextDueResult.timezone
            });
            
            log('warn', 'DUE REPORT FOUND FOR INF A STUDENT', {
              student: `${student.firstName} ${student.lastName}`,
              template: template.name,
              frequency: template.reportFrequency,
              lastReportDate: lastReportDate ? lastReportDate.format() : 'None',
              nextDueDate: nextDue ? nextDue.format() : 'None',
              timezone,
              class: 'Inf A'
            });
          }
        }
      }
    }
    
    // Summary
    log('info', 'Final Summary for Inf A Class', {
      schoolName: school.name,
      className: infAClass.name,
      totalStudents: infAStudents.length,
      totalTemplates: templates.length,
      totalChecks,
      totalDueReports,
      timezone,
      currentTime: now.format(),
      dueReportsFound: totalDueReports > 0
    });
    
    // Additional analysis
    log('info', 'Additional Analysis', {
      schoolSettings: {
        timezone: school.settings?.timezone,
        reportFrequencies: school.settings?.reportFrequencies,
        workingDays: school.settings?.calendar?.workingDays
      },
      classDetails: {
        name: infAClass.name,
        grade: infAClass.grade,
        teacherCount: infAClass.assignedTeachers ? infAClass.assignedTeachers.length : 0,
        studentCount: infAStudents.length
      },
      templateDetails: templates.map(t => ({
        name: t.name,
        frequency: t.reportFrequency,
        grade: t.grade,
        isActive: t.isActive
      }))
    });
    
  } catch (error) {
    log('error', 'Error in checkInfADueReports', {
      error: error.message,
      stack: error.stack
    });
  } finally {
    log('info', 'Disconnecting from MongoDB');
    await mongoose.disconnect();
    log('info', 'Inf A due reports check completed');
  }
}

checkInfADueReports();
