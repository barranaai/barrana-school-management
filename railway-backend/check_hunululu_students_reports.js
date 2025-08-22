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
const getLogFileName = (prefix = 'hunululu-students-reports') => {
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

async function checkHunululuStudentsReports() {
  log('info', 'Starting comprehensive check of Republica of Hunululu students and their reports');
  
  try {
    log('info', 'Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    log('info', 'Connected to MongoDB successfully');
    
    // Load models
    const User = require('./models/User');
    const Class = require('./models/Class');
    const School = require('./models/School');
    const Report = require('./models/Report');
    const ReportTemplate = require('./models/ReportTemplate');
    
    // Get the school
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
    
    // Get all classes for this school
    log('info', 'Fetching all classes for the school');
    const classes = await Class.find({ schoolId: school._id }).populate('assignedTeachers.teacherId');
    
    log('info', 'Classes found', {
      count: classes.length,
      classes: classes.map(c => ({
        id: c._id,
        name: c.name,
        grade: c.grade,
        teacherCount: c.assignedTeachers ? c.assignedTeachers.length : 0,
        studentCount: c.students ? c.students.length : 0,
        teachers: c.assignedTeachers ? c.assignedTeachers.map(t => ({
          teacherId: t.teacherId._id,
          teacherName: `${t.teacherId.firstName} ${t.teacherId.lastName}`,
          role: t.role
        })) : []
      }))
    });
    
    // Get all students for this school
    log('info', 'Fetching all students for the school');
    const students = await User.find({ 
      schoolId: school._id, 
      role: 'parent' 
    }).populate('classId', 'name grade').populate('assignedTeacher', 'firstName lastName email');
    
    log('info', 'Students found', {
      count: students.length,
      students: students.map(s => ({
        id: s._id,
        name: `${s.firstName} ${s.lastName}`,
        grade: s.studentGrade || s.grade,
        classId: s.classId ? s.classId._id : null,
        className: s.classId ? s.classId.name : null,
        studentClass: s.studentClass,
        assignedTeacher: s.assignedTeacher ? {
          id: s.assignedTeacher._id,
          name: `${s.assignedTeacher.firstName} ${s.assignedTeacher.lastName}`,
          email: s.assignedTeacher.email
        } : null,
        email: s.email,
        parentEmail: s.parentEmail,
        createdAt: s.createdAt
      }))
    });
    
    // Get all report templates for this school
    log('info', 'Fetching all report templates for the school');
    const templates = await ReportTemplate.find({ schoolId: school._id });
    
    log('info', 'Report templates found', {
      count: templates.length,
      templates: templates.map(t => ({
        id: t._id,
        name: t.name,
        grade: t.grade,
        frequency: t.reportFrequency,
        isActive: t.isActive,
        createdAt: t.createdAt
      }))
    });
    
    // Get all existing reports for these students
    log('info', 'Fetching all existing reports for the students');
    const studentIds = students.map(s => s._id);
    const existingReports = await Report.find({
      schoolId: school._id,
      studentId: { $in: studentIds }
    }).populate('studentId', 'firstName lastName').populate('templateId', 'name frequency');
    
    log('info', 'Existing reports found', {
      count: existingReports.length,
      reports: existingReports.map(r => ({
        id: r._id,
        studentId: r.studentId._id,
        studentName: `${r.studentId.firstName} ${r.studentId.lastName}`,
        templateId: r.templateId._id,
        templateName: r.templateId.name,
        frequency: r.templateId.frequency,
        status: r.status,
        createdAt: r.createdAt,
        dueDate: r.dueDate,
        dueDateTimezone: r.dueDateTimezone
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
    let dueReportsByStudent = {};
    let dueReportsByTemplate = {};
    
    log('info', 'Starting due report calculations for each student');
    
    for (const student of students) {
      log('info', `Processing student: ${student.firstName} ${student.lastName}`, {
        studentId: student._id,
        studentName: `${student.firstName} ${student.lastName}`,
        grade: student.studentGrade || student.grade,
        classId: student.classId ? student.classId._id : null,
        className: student.classId ? student.classId.name : null,
        assignedTeacher: student.assignedTeacher ? student.assignedTeacher._id : null
      });
      
      dueReportsByStudent[student._id] = [];
      
      for (const template of templates) {
        if (!template.isActive) {
          log('debug', `Skipping inactive template: ${template.name} for student ${student.firstName} ${student.lastName}`);
          continue;
        }
        
        const studentGrade = (student.studentGrade || student.grade || '').toLowerCase();
        const templateGrade = template.grade.toLowerCase();
        
        log('debug', 'Grade comparison', {
          student: `${student.firstName} ${student.lastName}`,
          studentGrade,
          templateGrade,
          matches: studentGrade === templateGrade
        });
        
        if (studentGrade === templateGrade) {
          totalChecks++;
          log('info', `Checking template: ${template.name} for student ${student.firstName} ${student.lastName}`, {
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
            student: `${student.firstName} ${student.lastName}`,
            template: template.name,
            hasLastReport: !!lastReport,
            lastReportDate: lastReportDate ? lastReportDate.format() : null,
            lastReportId: lastReport ? lastReport._id : null,
            lastReportStatus: lastReport ? lastReport.status : null
          });
          
          // Check if report is due
          log('info', 'Calling isReportDue', {
            student: `${student.firstName} ${student.lastName}`,
            template: template.name,
            frequency: template.reportFrequency,
            settings: school.settings,
            lastReportDate: lastReportDate ? lastReportDate.format() : null,
            now: now.format()
          });
          
          const due = isReportDue(template.reportFrequency, school.settings, lastReportDate, now);
          
          log('info', 'Due status result', {
            student: `${student.firstName} ${student.lastName}`,
            template: template.name,
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
              student: `${student.firstName} ${student.lastName}`,
              template: template.name,
              nextDue: nextDue ? nextDue.format() : null,
              timezone: nextDueResult.timezone
            });
            
            const dueReportInfo = {
              studentId: student._id,
              studentName: `${student.firstName} ${student.lastName}`,
              templateId: template._id,
              templateName: template.name,
              frequency: template.reportFrequency,
              lastReportDate: lastReportDate ? lastReportDate.format() : 'None',
              nextDueDate: nextDue ? nextDue.format() : 'None',
              timezone,
              classId: student.classId ? student.classId._id : null,
              className: student.classId ? student.classId.name : null,
              assignedTeacher: student.assignedTeacher ? student.assignedTeacher._id : null
            };
            
            dueReportsByStudent[student._id].push(dueReportInfo);
            
            if (!dueReportsByTemplate[template._id]) {
              dueReportsByTemplate[template._id] = [];
            }
            dueReportsByTemplate[template._id].push(dueReportInfo);
            
            log('warn', 'DUE REPORT FOUND', dueReportInfo);
          }
        }
      }
    }
    
    // Summary by student
    log('info', 'Due reports summary by student', {
      students: Object.keys(dueReportsByStudent).map(studentId => {
        const student = students.find(s => s._id.toString() === studentId);
        return {
          studentId,
          studentName: student ? `${student.firstName} ${student.lastName}` : 'Unknown',
          dueReportsCount: dueReportsByStudent[studentId].length,
          dueReports: dueReportsByStudent[studentId].map(r => ({
            template: r.templateName,
            frequency: r.frequency
          }))
        };
      })
    });
    
    // Summary by template
    log('info', 'Due reports summary by template', {
      templates: Object.keys(dueReportsByTemplate).map(templateId => {
        const template = templates.find(t => t._id.toString() === templateId);
        return {
          templateId,
          templateName: template ? template.name : 'Unknown',
          frequency: template ? template.frequency : 'Unknown',
          dueReportsCount: dueReportsByTemplate[templateId].length,
          students: dueReportsByTemplate[templateId].map(r => r.studentName)
        };
      })
    });
    
    // Final summary
    log('info', 'Final Summary for Republica of Hunululu', {
      schoolName: school.name,
      totalStudents: students.length,
      totalTemplates: templates.length,
      totalChecks,
      totalDueReports,
      timezone,
      currentTime: now.format(),
      dueReportsFound: totalDueReports > 0,
      studentsWithDueReports: Object.keys(dueReportsByStudent).filter(sid => dueReportsByStudent[sid].length > 0).length,
      templatesWithDueReports: Object.keys(dueReportsByTemplate).filter(tid => dueReportsByTemplate[tid].length > 0).length
    });
    
    // Additional analysis
    log('info', 'Additional Analysis', {
      schoolSettings: {
        timezone: school.settings?.timezone,
        reportFrequencies: school.settings?.reportFrequencies,
        workingDays: school.settings?.calendar?.workingDays
      },
      classDistribution: classes.map(c => ({
        name: c.name,
        grade: c.grade,
        teacherCount: c.assignedTeachers ? c.assignedTeachers.length : 0,
        studentCount: students.filter(s => s.classId && s.classId._id.toString() === c._id.toString()).length
      })),
      templateDistribution: templates.map(t => ({
        name: t.name,
        frequency: t.reportFrequency,
        grade: t.grade,
        isActive: t.isActive,
        matchingStudents: students.filter(s => 
          (s.studentGrade || s.grade || '').toLowerCase() === t.grade.toLowerCase()
        ).length
      })),
      reportStatusDistribution: existingReports.reduce((acc, r) => {
        acc[r.status] = (acc[r.status] || 0) + 1;
        return acc;
      }, {})
    });
    
  } catch (error) {
    log('error', 'Error in checkHunululuStudentsReports', {
      error: error.message,
      stack: error.stack
    });
  } finally {
    log('info', 'Disconnecting from MongoDB');
    await mongoose.disconnect();
    log('info', 'Hunululu students reports check completed');
  }
}

checkHunululuStudentsReports();
