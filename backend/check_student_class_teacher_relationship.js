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
const getLogFileName = (prefix = 'student-class-teacher-relationship') => {
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

async function checkStudentClassTeacherRelationship() {
  log('info', 'Starting student-class-teacher relationship check for Republica of Hunululu');
  
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
    
    // Get all classes for this school
    const Class = require('./models/Class');
    const User = require('./models/User'); // Require User model for populate
    log('info', 'Fetching classes for school');
    
    const classes = await Class.find({ schoolId: school._id }).populate('assignedTeachers.teacherId');
    
    log('info', 'Classes found', {
      count: classes.length,
      classes: classes.map(c => ({
        id: c._id,
        name: c.name,
        grade: c.grade,
        teachers: c.assignedTeachers ? c.assignedTeachers.map(t => ({
          teacherId: t.teacherId._id,
          teacherName: `${t.teacherId.firstName} ${t.teacherId.lastName}`,
          role: t.role
        })) : [],
        studentCount: c.students ? c.students.length : 0
      }))
    });
    
    // Get all students for this school
    log('info', 'Fetching students for school');
    
    const students = await User.find({ 
      schoolId: school._id, 
      role: 'student' 
    });
    
    log('info', 'Students found', {
      count: students.length,
      students: students.map(s => ({
        id: s._id,
        name: `${s.firstName} ${s.lastName}`,
        grade: s.studentGrade || s.grade,
        classId: s.classId,
        assignedTeacher: s.assignedTeacher
      }))
    });
    
    // Get all teachers for this school
    const teachers = await User.find({ 
      schoolId: school._id, 
      role: 'teacher' 
    });
    
    log('info', 'Teachers found', {
      count: teachers.length,
      teachers: teachers.map(t => ({
        id: t._id,
        name: `${t.firstName} ${t.lastName}`,
        email: t.email
      }))
    });
    
    // Check student-class relationships
    log('info', 'Checking student-class relationships');
    
    for (const student of students) {
      log('info', `Student: ${student.firstName} ${student.lastName}`, {
        studentId: student._id,
        grade: student.studentGrade || student.grade,
        classId: student.classId,
        assignedTeacher: student.assignedTeacher
      });
      
             if (student.classId) {
         const studentClass = classes.find(c => c._id.toString() === student.classId.toString());
         if (studentClass) {
           log('info', `Student is in class: ${studentClass.name}`, {
             classId: studentClass._id,
             className: studentClass.name,
             classGrade: studentClass.grade,
             classTeachers: studentClass.assignedTeachers ? studentClass.assignedTeachers.map(t => ({
               teacherName: `${t.teacherId.firstName} ${t.teacherId.lastName}`,
               role: t.role
             })) : []
           });
        } else {
          log('warn', `Student has classId but class not found`, {
            studentId: student._id,
            classId: student.classId
          });
        }
      } else {
        log('warn', `Student has no classId assigned`, {
          studentId: student._id,
          studentName: `${student.firstName} ${student.lastName}`
        });
      }
    }
    
    // Check class-student relationships
    log('info', 'Checking class-student relationships');
    
    for (const classItem of classes) {
             log('info', `Class: ${classItem.name}`, {
         classId: classItem._id,
         className: classItem.name,
         classGrade: classItem.grade,
         classTeachers: classItem.assignedTeachers ? classItem.assignedTeachers.map(t => ({
           teacherName: `${t.teacherId.firstName} ${t.teacherId.lastName}`,
           role: t.role
         })) : [],
         studentsInClass: classItem.students ? classItem.students.length : 0
       });
      
      if (classItem.students && classItem.students.length > 0) {
        log('info', `Students in class ${classItem.name}:`, {
          students: classItem.students.map(s => ({
            studentId: s,
            studentName: students.find(st => st._id.toString() === s.toString()) ? 
              `${students.find(st => st._id.toString() === s.toString()).firstName} ${students.find(st => st._id.toString() === s.toString()).lastName}` : 'Unknown'
          }))
        });
      } else {
        log('warn', `Class ${classItem.name} has no students assigned`);
      }
    }
    
    // Check teacher-class relationships
    log('info', 'Checking teacher-class relationships');
    
         for (const teacher of teachers) {
       const teacherClasses = classes.filter(c => 
         c.assignedTeachers && c.assignedTeachers.some(t => t.teacherId._id.toString() === teacher._id.toString())
       );
      
      log('info', `Teacher: ${teacher.firstName} ${teacher.lastName}`, {
        teacherId: teacher._id,
        teacherName: `${teacher.firstName} ${teacher.lastName}`,
        email: teacher.email,
        classesAssigned: teacherClasses.length,
        classes: teacherClasses.map(c => ({
          classId: c._id,
          className: c.name,
          classGrade: c.grade,
          studentCount: c.students ? c.students.length : 0
        }))
      });
    }
    
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
    
    // Check due reports for each student-template combination
    const { calculateDueDate, isReportDue } = require('./utils/dateUtils');
    const moment = require('moment-timezone');
    const Report = require('./models/Report');
    
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
      totalClasses: classes.length,
      totalTeachers: teachers.length,
      totalTemplates: templates.length,
      totalChecks,
      dueReportsCount,
      timezone
    });
    
  } catch (error) {
    log('error', 'Error in checkStudentClassTeacherRelationship', {
      error: error.message,
      stack: error.stack
    });
  } finally {
    log('info', 'Disconnecting from MongoDB');
    await mongoose.disconnect();
    log('info', 'Student-class-teacher relationship check completed');
  }
}

checkStudentClassTeacherRelationship();
