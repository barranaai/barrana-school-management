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
const getLogFileName = (prefix = 'student-class-ids') => {
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

async function checkStudentClassIds() {
  log('info', 'Starting student classId check');
  
  try {
    log('info', 'Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    log('info', 'Connected to MongoDB successfully');
    
    // Get the school
    const School = require('./models/School');
    const school = await School.findOne({ name: 'Republica of Hunululu' });
    
    if (!school) {
      log('error', 'School not found: Republica of Hunululu');
      return;
    }
    
    log('info', 'School found', {
      schoolId: school._id,
      name: school.name
    });
    
    // Get all classes for this school
    const Class = require('./models/Class');
    const classes = await Class.find({ schoolId: school._id });
    
    log('info', 'All classes found', {
      count: classes.length,
      classes: classes.map(c => ({
        id: c._id,
        name: c.name,
        grade: c.grade,
        studentCount: c.students ? c.students.length : 0
      }))
    });
    
    // Get all students (role: parent) for this school
    const User = require('./models/User');
    const students = await User.find({ 
      schoolId: school._id, 
      role: 'parent' 
    });
    
    log('info', 'All students found with classId details', {
      count: students.length,
      students: students.map(s => ({
        id: s._id,
        name: `${s.firstName} ${s.lastName}`,
        grade: s.studentGrade || s.grade,
        classId: s.classId,
        classIdType: typeof s.classId,
        classIdString: s.classId ? s.classId.toString() : 'null',
        email: s.email,
        createdAt: s.createdAt
      }))
    });
    
    // Check which students have classId and which don't
    const studentsWithClassId = students.filter(s => s.classId);
    const studentsWithoutClassId = students.filter(s => !s.classId);
    
    log('info', 'Students with classId', {
      count: studentsWithClassId.length,
      students: studentsWithClassId.map(s => ({
        id: s._id,
        name: `${s.firstName} ${s.lastName}`,
        classId: s.classId.toString()
      }))
    });
    
    log('info', 'Students without classId', {
      count: studentsWithoutClassId.length,
      students: studentsWithoutClassId.map(s => ({
        id: s._id,
        name: `${s.firstName} ${s.lastName}`
      }))
    });
    
    // Check which class each student is assigned to
    for (const student of students) {
      if (student.classId) {
        const assignedClass = classes.find(c => c._id.toString() === student.classId.toString());
        log('info', `Student ${student.firstName} ${student.lastName} class assignment`, {
          studentId: student._id,
          studentName: `${student.firstName} ${student.lastName}`,
          classId: student.classId.toString(),
          assignedClass: assignedClass ? {
            id: assignedClass._id,
            name: assignedClass.name,
            grade: assignedClass.grade
          } : 'CLASS NOT FOUND'
        });
      } else {
        log('warn', `Student ${student.firstName} ${student.lastName} has no classId`, {
          studentId: student._id,
          studentName: `${student.firstName} ${student.lastName}`
        });
      }
    }
    
    // Check if students are in the class.students array
    for (const classItem of classes) {
      log('info', `Class ${classItem.name} students array`, {
        classId: classItem._id,
        className: classItem.name,
        studentsInArray: classItem.students ? classItem.students.length : 0,
        studentIds: classItem.students ? classItem.students.map(s => s.toString()) : []
      });
      
      if (classItem.students && classItem.students.length > 0) {
        for (const studentId of classItem.students) {
          const student = students.find(s => s._id.toString() === studentId.toString());
          log('info', `Student in ${classItem.name} students array`, {
            classId: classItem._id,
            className: classItem.name,
            studentId: studentId.toString(),
            studentName: student ? `${student.firstName} ${student.lastName}` : 'STUDENT NOT FOUND',
            studentClassId: student ? (student.classId ? student.classId.toString() : 'null') : 'N/A'
          });
        }
      }
    }
    
    // Summary
    log('info', 'Summary', {
      totalStudents: students.length,
      studentsWithClassId: studentsWithClassId.length,
      studentsWithoutClassId: studentsWithoutClassId.length,
      totalClasses: classes.length,
      classesWithStudents: classes.filter(c => c.students && c.students.length > 0).length
    });
    
  } catch (error) {
    log('error', 'Error in checkStudentClassIds', {
      error: error.message,
      stack: error.stack
    });
  } finally {
    log('info', 'Disconnecting from MongoDB');
    await mongoose.disconnect();
    log('info', 'Student classId check completed');
  }
}

checkStudentClassIds();
