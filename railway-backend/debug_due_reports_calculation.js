const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const getLogFileName = (prefix = 'debug-due-reports-calculation') => {
  const date = new Date().toISOString().split('T')[0];
  return `${prefix}-${date}.log`;
};

const logFile = path.join(logsDir, getLogFileName());

const log = (level, message, data = null) => {
  const timestamp = new Date().toISOString();
  const logEntry = { timestamp, level, message, data };
  const logLine = JSON.stringify(logEntry) + '\n';
  try { fs.appendFileSync(logFile, logLine); } catch (error) { console.error('Failed to write to log file:', error); }
  console.log(`[${timestamp}] ${level.toUpperCase()}: ${message}`, data ? JSON.stringify(data, null, 2) : '');
};

async function debugDueReportsCalculation() {
  const schoolId = "68a4b0c04283c7f05947b15e"; // Republica of Hunululu
  log('info', `Starting comprehensive due reports calculation debug for school: ${schoolId}`);
  
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const User = require('./models/User');
    const Class = require('./models/Class');
    const School = require('./models/School');
    const Report = require('./models/Report');
    const ReportTemplate = require('./models/ReportTemplate');
    const { isReportDue, calculateDueDate } = require('./utils/dateUtils');

    // 1. Get school data
    const school = await School.findById(schoolId);
    log('info', 'School details', { 
      schoolId: school._id, 
      schoolName: school.name, 
      timezone: school.settings?.timezone, 
      reportFrequencies: school.settings?.reportFrequencies 
    });

    // 2. Get students
    const students = await User.find({ schoolId: schoolId, role: 'parent' }).populate('classId', 'name grade').populate('assignedTeacher', 'firstName lastName email');
    log('info', 'Students found', { 
      totalStudents: students.length, 
      studentsWithClassId: students.filter(s => s.classId).length,
      students: students.map(s => ({
        id: s._id,
        name: `${s.firstName} ${s.lastName}`,
        grade: s.grade,
        studentClass: s.studentClass,
        classId: s.classId ? s.classId._id : null,
        hasClassId: !!s.classId
      }))
    });

    // 3. Get report templates
    const templates = await ReportTemplate.find({ schoolId: schoolId, isActive: true });
    log('info', 'Report templates found', { 
      totalTemplates: templates.length,
      templates: templates.map(t => ({
        id: t._id,
        name: t.name,
        grade: t.grade,
        frequency: t.reportFrequency,
        isActive: t.isActive
      }))
    });

    // 4. Get existing reports
    const existingReports = await Report.find({ schoolId: schoolId }).sort({ createdAt: -1 });
    log('info', 'Existing reports found', { 
      totalReports: existingReports.length,
      reportsByStatus: {
        draft: existingReports.filter(r => r.status === 'draft').length,
        completed: existingReports.filter(r => r.status === 'completed').length,
        sent: existingReports.filter(r => r.status === 'sent').length
      }
    });

    // 5. Calculate current time in school timezone
    const timezone = school.settings?.timezone || 'UTC';
    const now = new Date();
    const nowInSchoolTZ = new Date(now.toLocaleString("en-US", {timeZone: timezone}));
    log('info', 'Current time calculation', { 
      utcTime: now.toISOString(), 
      schoolTimezone: timezone, 
      schoolTime: nowInSchoolTZ.toISOString() 
    });

    // 6. Calculate due reports for each student
    log('info', '=== CALCULATING DUE REPORTS ===');
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
        grade: student.grade,
        studentClass: student.studentClass,
        classId: student.classId ? student.classId._id : null
      });

      if (!student.classId) {
        log('warn', `Student ${student.firstName} ${student.lastName} has no classId, skipping`);
        continue;
      }

      const studentDueReports = [];
      
      // Find templates for this student's grade
      const gradeTemplates = templates.filter(template => 
        template.grade.toLowerCase() === student.grade.toLowerCase()
      );
      
      log('info', `Found ${gradeTemplates.length} templates for grade ${student.grade}`, {
        templates: gradeTemplates.map(t => ({ name: t.name, frequency: t.reportFrequency }))
      });

      for (const template of gradeTemplates) {
        log('info', `Checking template: ${template.name} (${template.reportFrequency})`);
        
        // Get last report for this student and template
        const lastReport = await Report.findOne({ 
          studentId: student._id, 
          templateId: template._id 
        }).sort({ createdAt: -1 });
        
        const lastReportDate = lastReport ? lastReport.createdAt : null;
        
        log('info', `Last report for ${template.name}`, {
          hasLastReport: !!lastReport,
          lastReportDate: lastReportDate ? lastReportDate.toISOString() : null,
          lastReportStatus: lastReport ? lastReport.status : null
        });

        // Check if report is due
        const isDue = isReportDue(template.reportFrequency, school.settings, lastReportDate, nowInSchoolTZ);
        
        log('info', `Due check for ${template.name}`, {
          isDue,
          frequency: template.reportFrequency,
          lastReportDate: lastReportDate ? lastReportDate.toISOString() : null,
          currentTime: nowInSchoolTZ.toISOString()
        });

        if (isDue) {
          const dueDateResult = calculateDueDate(template.reportFrequency, school.settings, lastReportDate);
          studentDueReports.push({ 
            templateName: template.name, 
            frequency: template.reportFrequency, 
            dueDate: dueDateResult.dueDate,
            templateId: template._id
          });
          dueReportsSummary.totalDueReports++;
          dueReportsSummary.dueReportsByTemplate[template.name] = (dueReportsSummary.dueReportsByTemplate[template.name] || 0) + 1;
          
          log('info', `✅ ${template.name} is DUE for ${student.firstName} ${student.lastName}`, {
            dueDate: dueDateResult.dueDate.toISOString(),
            timezone: dueDateResult.timezone
          });
        } else {
          log('info', `⏰ ${template.name} is NOT DUE for ${student.firstName} ${student.lastName}`);
        }
      }
      
      if (studentDueReports.length > 0) {
        dueReportsSummary.studentsWithDueReports++;
        dueReportsSummary.dueReportsByStudent[`${student.firstName} ${student.lastName}`] = studentDueReports.length;
        log('info', `📊 Student ${student.firstName} ${student.lastName} has ${studentDueReports.length} due reports`, {
          dueReports: studentDueReports.map(dr => ({ 
            template: dr.templateName, 
            frequency: dr.frequency,
            dueDate: dr.dueDate.toISOString() 
          }))
        });
      } else {
        log('info', `📊 Student ${student.firstName} ${student.lastName} has NO due reports`);
      }
    }

    log('info', '=== FINAL DUE REPORTS SUMMARY ===', dueReportsSummary);

    // 7. Test the frontend calculation logic
    log('info', '=== TESTING FRONTEND LOGIC ===');
    
    // Simulate frontend conditions
    const frontendConditions = {
      hasStudents: students.length > 0,
      hasTemplates: templates.length > 0,
      hasSchoolSettings: !!school.settings,
      hasTimezone: !!school.settings?.timezone,
      hasReportFrequencies: !!school.settings?.reportFrequencies
    };
    
    log('info', 'Frontend calculation conditions', frontendConditions);
    
    if (!frontendConditions.hasStudents || !frontendConditions.hasTemplates) {
      log('error', 'Frontend would skip calculation - missing students or templates');
    } else if (!frontendConditions.hasSchoolSettings) {
      log('error', 'Frontend would skip calculation - no school settings');
    } else if (!frontendConditions.hasTimezone) {
      log('error', 'Frontend would skip calculation - no timezone in school settings');
    } else if (!frontendConditions.hasReportFrequencies) {
      log('error', 'Frontend would skip calculation - no report frequencies in school settings');
    } else {
      log('info', '✅ Frontend should be able to calculate due reports');
    }

    log('info', '=== RECOMMENDATIONS ===', {
      totalStudents: students.length,
      studentsWithDueReports: dueReportsSummary.studentsWithDueReports,
      totalDueReports: dueReportsSummary.totalDueReports,
      frontendConditions: frontendConditions,
      expectedResult: dueReportsSummary.totalDueReports > 0 ? `${dueReportsSummary.totalDueReports} due reports should be shown` : 'No due reports expected'
    });

  } catch (error) {
    log('error', 'Error in debugDueReportsCalculation', { error: error.message, stack: error.stack });
  } finally {
    await mongoose.disconnect();
    log('info', 'Due reports calculation debug completed');
  }
}

debugDueReportsCalculation();
