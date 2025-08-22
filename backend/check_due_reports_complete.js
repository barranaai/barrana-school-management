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
const getLogFileName = (prefix = 'check-due-reports-complete') => {
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

async function checkDueReportsComplete() {
  const schoolId = "68a4b0c04283c7f05947b15e"; // Republica of Hunululu
  
  log('info', `Starting comprehensive due reports check for school: ${schoolId}`);
  
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
    
    // Import date utilities
    const { isReportDue, calculateDueDate } = require('./utils/dateUtils');
    
    // Get school details
    log('info', 'Fetching school details');
    const school = await School.findById(schoolId);
    if (!school) {
      log('error', `School not found with ID: ${schoolId}`);
      return;
    }
    
    log('info', 'School details', {
      schoolId: school._id,
      schoolName: school.name,
      schoolType: school.schoolType,
      timezone: school.settings?.timezone,
      reportFrequencies: school.settings?.reportFrequencies
    });
    
    // Get all classes in the school
    log('info', 'Fetching classes in school');
    const classes = await Class.find({ schoolId: schoolId });
    log('info', 'Classes found', {
      totalClasses: classes.length,
      classes: classes.map(c => ({
        id: c._id,
        name: c.name,
        grade: c.grade,
        assignedTeachers: c.assignedTeachers?.length || 0
      }))
    });
    
    // Get all students with proper classId relationships
    log('info', 'Fetching students with classId relationships');
    const students = await User.find({ 
      schoolId: schoolId, 
      role: 'parent' 
    }).populate('classId', 'name grade').populate('assignedTeacher', 'firstName lastName email');
    
    log('info', 'Students found', {
      totalStudents: students.length,
      studentsWithClassId: students.filter(s => s.classId).length,
      studentsWithoutClassId: students.filter(s => !s.classId).length
    });
    
    // Get report templates
    log('info', 'Fetching report templates');
    const templates = await ReportTemplate.find({ schoolId: schoolId });
    log('info', 'Report templates found', {
      totalTemplates: templates.length,
      templates: templates.map(t => ({
        id: t._id,
        name: t.name,
        frequency: t.reportFrequency,
        isActive: t.isActive
      }))
    });
    
    // Get existing reports
    log('info', 'Fetching existing reports');
    const existingReports = await Report.find({ 
      schoolId: schoolId 
    }).sort({ createdAt: -1 });
    
    log('info', 'Existing reports found', {
      totalReports: existingReports.length,
      reportsByStudent: existingReports.reduce((acc, report) => {
        const studentId = report.studentId.toString();
        acc[studentId] = (acc[studentId] || 0) + 1;
        return acc;
      }, {})
    });
    
    // Get current time in school timezone
    const timezone = school.settings?.timezone || 'UTC';
    const now = new Date();
    const nowInSchoolTZ = new Date(now.toLocaleString("en-US", {timeZone: timezone}));
    
    log('info', 'Current time calculation', {
      utcTime: now.toISOString(),
      schoolTimezone: timezone,
      schoolTime: nowInSchoolTZ.toISOString(),
      schoolTimeString: nowInSchoolTZ.toString()
    });
    
    // Check due reports for each student
    log('info', '=== STARTING DUE REPORTS CALCULATION ===');
    
    const dueReportsSummary = {
      totalStudents: students.length,
      studentsWithDueReports: 0,
      totalDueReports: 0,
      dueReportsByTemplate: {},
      dueReportsByStudent: {},
      errors: []
    };
    
    for (const student of students) {
      log('info', `Processing student: ${student.firstName} ${student.lastName}`, {
        studentId: student._id,
        studentClass: student.studentClass,
        classId: student.classId ? student.classId._id : null,
        className: student.classId ? student.classId.name : null,
        assignedTeacher: student.assignedTeacher ? `${student.assignedTeacher.firstName} ${student.assignedTeacher.lastName}` : null
      });
      
      if (!student.classId) {
        log('warn', `Student ${student.firstName} ${student.lastName} has no classId - skipping due reports calculation`);
        continue;
      }
      
      const studentDueReports = [];
      
      for (const template of templates) {
        if (!template.isActive) {
          log('info', `Template ${template.name} is not active - skipping`);
          continue;
        }
        
        log('info', `Checking template: ${template.name}`, {
          templateId: template._id,
          frequency: template.reportFrequency
        });
        
        try {
          // Get the last report for this student and template
          const lastReport = await Report.findOne({
            studentId: student._id,
            templateId: template._id
          }).sort({ createdAt: -1 });
          
          const lastReportDate = lastReport ? lastReport.createdAt : null;
          
          log('info', `Last report for template ${template.name}`, {
            lastReportId: lastReport ? lastReport._id : null,
            lastReportDate: lastReportDate ? lastReportDate.toISOString() : null,
            daysSinceLastReport: lastReportDate ? Math.floor((now - lastReportDate) / (1000 * 60 * 60 * 24)) : null
          });
          
          // Check if report is due
          const isDue = isReportDue(template.reportFrequency, school.settings, lastReportDate, nowInSchoolTZ);
          
          log('info', `Due status for template ${template.name}`, {
            isDue: isDue,
            frequency: template.reportFrequency,
            schoolSettings: school.settings?.reportFrequencies
          });
          
          if (isDue) {
            // Calculate next due date
            const dueDateResult = calculateDueDate(template.reportFrequency, school.settings, lastReportDate);
            const dueDate = dueDateResult.dueDate;
            const dueDateTimezone = dueDateResult.timezone;
            
            log('info', `Report is due for template ${template.name}`, {
              dueDate: dueDate.toISOString(),
              dueDateTimezone: dueDateTimezone,
              dueDateLocal: dueDate.toString()
            });
            
            studentDueReports.push({
              templateId: template._id,
              templateName: template.name,
              frequency: template.reportFrequency,
              dueDate: dueDate,
              dueDateTimezone: dueDateTimezone,
              lastReportDate: lastReportDate
            });
            
            // Update summary
            dueReportsSummary.totalDueReports++;
            dueReportsSummary.dueReportsByTemplate[template.name] = (dueReportsSummary.dueReportsByTemplate[template.name] || 0) + 1;
          }
          
        } catch (error) {
          log('error', `Error checking due status for template ${template.name}`, {
            error: error.message,
            stack: error.stack,
            studentId: student._id,
            templateId: template._id
          });
          dueReportsSummary.errors.push({
            studentId: student._id,
            templateId: template._id,
            error: error.message
          });
        }
      }
      
      if (studentDueReports.length > 0) {
        dueReportsSummary.studentsWithDueReports++;
        dueReportsSummary.dueReportsByStudent[`${student.firstName} ${student.lastName}`] = studentDueReports.length;
        
        log('info', `Student ${student.firstName} ${student.lastName} has due reports`, {
          dueReportsCount: studentDueReports.length,
          dueReports: studentDueReports.map(dr => ({
            template: dr.templateName,
            frequency: dr.frequency,
            dueDate: dr.dueDate.toISOString()
          }))
        });
      } else {
        log('info', `Student ${student.firstName} ${student.lastName} has no due reports`);
      }
    }
    
    // Final summary
    log('info', '=== FINAL DUE REPORTS SUMMARY ===', dueReportsSummary);
    
    // Test API endpoint
    log('info', '=== TESTING API ENDPOINT ===');
    try {
      const axios = require('axios');
      const apiUrl = 'http://localhost:5050/api/reports/due-status';
      
      log('info', `Testing API endpoint: ${apiUrl}`);
      
      const response = await axios.get(apiUrl, {
        headers: {
          'Authorization': `Bearer ${process.env.TEST_TOKEN || 'test-token'}`
        },
        timeout: 10000
      });
      
      log('info', 'API response received', {
        status: response.status,
        dataLength: response.data ? Object.keys(response.data).length : 0,
        data: response.data
      });
      
    } catch (error) {
      log('error', 'API endpoint test failed', {
        error: error.message,
        status: error.response?.status,
        data: error.response?.data
      });
    }
    
    // Recommendations
    log('info', '=== RECOMMENDATIONS ===', {
      totalStudents: students.length,
      studentsWithDueReports: dueReportsSummary.studentsWithDueReports,
      totalDueReports: dueReportsSummary.totalDueReports,
      successRate: students.length > 0 ? Math.round((dueReportsSummary.studentsWithDueReports / students.length) * 100) : 0,
      errors: dueReportsSummary.errors.length
    });
    
    if (dueReportsSummary.errors.length > 0) {
      log('warn', 'Errors found during due reports calculation', {
        errorCount: dueReportsSummary.errors.length,
        errors: dueReportsSummary.errors
      });
    }
    
  } catch (error) {
    log('error', 'Error in checkDueReportsComplete', {
      error: error.message,
      stack: error.stack
    });
  } finally {
    log('info', 'Disconnecting from MongoDB');
    await mongoose.disconnect();
    log('info', 'Due reports complete check finished');
  }
}

checkDueReportsComplete();
