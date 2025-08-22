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
const getLogFileName = (prefix = 'check-all-students-classid') => {
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

async function checkAllStudentsClassId() {
  const schoolId = "68a4b0c04283c7f05947b15e"; // Republica of Hunululu
  
  log('info', `Starting comprehensive check of all students in school: ${schoolId}`);
  
  try {
    log('info', 'Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    log('info', 'Connected to MongoDB successfully');
    
    // Load models
    const User = require('./models/User');
    const Class = require('./models/Class');
    const School = require('./models/School');
    
    // Get school details
    const school = await School.findById(schoolId);
    if (!school) {
      log('error', `School not found with ID: ${schoolId}`);
      return;
    }
    
    log('info', 'School found', {
      schoolId: school._id,
      schoolName: school.name,
      schoolType: school.schoolType
    });
    
    // Get all students in the school
    log('info', 'Fetching all students in the school');
    const allStudents = await User.find({ 
      schoolId: schoolId, 
      role: 'parent' 
    }).populate('classId', 'name grade').sort({ createdAt: -1 });
    
    log('info', 'All students retrieved', {
      totalStudents: allStudents.length
    });
    
    // Analyze classId assignment
    const studentsWithClassId = allStudents.filter(s => s.classId);
    const studentsWithoutClassId = allStudents.filter(s => !s.classId);
    
    log('info', '=== CLASSID ASSIGNMENT ANALYSIS ===', {
      totalStudents: allStudents.length,
      studentsWithClassId: studentsWithClassId.length,
      studentsWithoutClassId: studentsWithoutClassId.length,
      successRate: allStudents.length > 0 ? Math.round((studentsWithClassId.length / allStudents.length) * 100) : 0
    });
    
    // Detailed breakdown by class
    const classBreakdown = {};
    allStudents.forEach(student => {
      const className = student.studentClass || 'No Class';
      if (!classBreakdown[className]) {
        classBreakdown[className] = {
          total: 0,
          withClassId: 0,
          withoutClassId: 0
        };
      }
      classBreakdown[className].total++;
      if (student.classId) {
        classBreakdown[className].withClassId++;
      } else {
        classBreakdown[className].withoutClassId++;
      }
    });
    
    log('info', 'Class breakdown', classBreakdown);
    
    // List students with classId
    log('info', '=== STUDENTS WITH CLASSID ===', {
      count: studentsWithClassId.length,
      students: studentsWithClassId.map(s => ({
        id: s._id,
        name: `${s.firstName} ${s.lastName}`,
        studentClass: s.studentClass,
        classId: s.classId ? s.classId._id : null,
        className: s.classId ? s.classId.name : null,
        createdAt: s.createdAt
      }))
    });
    
    // List students without classId
    log('info', '=== STUDENTS WITHOUT CLASSID ===', {
      count: studentsWithoutClassId.length,
      students: studentsWithoutClassId.map(s => ({
        id: s._id,
        name: `${s.firstName} ${s.lastName}`,
        studentClass: s.studentClass,
        createdAt: s.createdAt
      }))
    });
    
    // Check if classes exist for students without classId
    log('info', 'Checking if classes exist for students without classId');
    const classes = await Class.find({ schoolId: schoolId });
    log('info', 'Available classes in school', {
      totalClasses: classes.length,
      classes: classes.map(c => ({
        id: c._id,
        name: c.name,
        grade: c.grade
      }))
    });
    
    // Check which students could potentially get classId
    const studentsThatCouldGetClassId = studentsWithoutClassId.filter(student => {
      if (!student.studentClass) return false;
      return classes.some(c => c.name.toLowerCase() === student.studentClass.toLowerCase());
    });
    
    log('info', 'Students that could get classId', {
      count: studentsThatCouldGetClassId.length,
      students: studentsThatCouldGetClassId.map(s => ({
        id: s._id,
        name: `${s.firstName} ${s.lastName}`,
        studentClass: s.studentClass,
        createdAt: s.createdAt
      }))
    });
    
    // Final summary
    log('info', '=== FINAL SUMMARY ===', {
      schoolName: school.name,
      totalStudents: allStudents.length,
      studentsWithClassId: studentsWithClassId.length,
      studentsWithoutClassId: studentsWithoutClassId.length,
      studentsThatCouldGetClassId: studentsThatCouldGetClassId.length,
      overallSuccessRate: allStudents.length > 0 ? Math.round((studentsWithClassId.length / allStudents.length) * 100) : 0,
      potentialImprovement: studentsThatCouldGetClassId.length
    });
    
    // Recommendations
    if (studentsThatCouldGetClassId.length > 0) {
      log('info', 'RECOMMENDATIONS', {
        action: 'Run migration script to update existing students',
        affectedStudents: studentsThatCouldGetClassId.length,
        message: 'These students have studentClass values that match existing classes and could be updated'
      });
    }
    
  } catch (error) {
    log('error', 'Error in checkAllStudentsClassId', {
      error: error.message,
      stack: error.stack
    });
  } finally {
    log('info', 'Disconnecting from MongoDB');
    await mongoose.disconnect();
    log('info', 'All students classId check completed');
  }
}

checkAllStudentsClassId();
