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
const getLogFileName = (prefix = 'all-students-debug') => {
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

async function checkAllStudents() {
  log('info', 'Starting comprehensive student check');
  
  try {
    log('info', 'Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    log('info', 'Connected to MongoDB successfully');
    
    // Get all schools
    const School = require('./models/School');
    log('info', 'Fetching all schools');
    
    const schools = await School.find({});
    
    log('info', 'All schools found', {
      count: schools.length,
      schools: schools.map(s => ({
        id: s._id,
        name: s.name,
        slug: s.slug
      }))
    });
    
    // Get all students
    const User = require('./models/User');
    log('info', 'Fetching all students');
    
    const allStudents = await User.find({ role: 'student' }).populate('assignedTeacher');
    
    log('info', 'All students found', {
      count: allStudents.length,
      students: allStudents.map(s => ({
        id: s._id,
        name: `${s.firstName} ${s.lastName}`,
        grade: s.studentGrade || s.grade,
        schoolId: s.schoolId,
        teacher: s.assignedTeacher ? `${s.assignedTeacher.firstName} ${s.assignedTeacher.lastName}` : 'None',
        teacherId: s.assignedTeacher ? s.assignedTeacher._id : null
      }))
    });
    
    // Check students by school
    for (const school of schools) {
      log('info', `Checking students for school: ${school.name}`, {
        schoolId: school._id,
        schoolName: school.name
      });
      
      const schoolStudents = allStudents.filter(s => s.schoolId && s.schoolId.toString() === school._id.toString());
      
      log('info', `Students for ${school.name}`, {
        count: schoolStudents.length,
        students: schoolStudents.map(s => ({
          id: s._id,
          name: `${s.firstName} ${s.lastName}`,
          grade: s.studentGrade || s.grade,
          teacher: s.assignedTeacher ? `${s.assignedTeacher.firstName} ${s.assignedTeacher.lastName}` : 'None'
        }))
      });
    }
    
    // Check for students with no schoolId
    const studentsWithoutSchool = allStudents.filter(s => !s.schoolId);
    
    if (studentsWithoutSchool.length > 0) {
      log('warn', 'Students without schoolId found', {
        count: studentsWithoutSchool.length,
        students: studentsWithoutSchool.map(s => ({
          id: s._id,
          name: `${s.firstName} ${s.lastName}`,
          grade: s.studentGrade || s.grade
        }))
      });
    }
    
    // Check for students with invalid schoolId
    const validSchoolIds = schools.map(s => s._id.toString());
    const studentsWithInvalidSchool = allStudents.filter(s => 
      s.schoolId && !validSchoolIds.includes(s.schoolId.toString())
    );
    
    if (studentsWithInvalidSchool.length > 0) {
      log('warn', 'Students with invalid schoolId found', {
        count: studentsWithInvalidSchool.length,
        students: studentsWithInvalidSchool.map(s => ({
          id: s._id,
          name: `${s.firstName} ${s.lastName}`,
          grade: s.studentGrade || s.grade,
          schoolId: s.schoolId
        }))
      });
    }
    
    // Check for Republica of Hunululu specifically
    const hunululuSchool = schools.find(s => s.name === 'Republica of Hunululu');
    
    if (hunululuSchool) {
      log('info', 'Republica of Hunululu school details', {
        schoolId: hunululuSchool._id,
        name: hunululuSchool.name,
        slug: hunululuSchool.slug
      });
      
      const hunululuStudents = allStudents.filter(s => 
        s.schoolId && s.schoolId.toString() === hunululuSchool._id.toString()
      );
      
      log('info', 'Republica of Hunululu students', {
        count: hunululuStudents.length,
        students: hunululuStudents.map(s => ({
          id: s._id,
          name: `${s.firstName} ${s.lastName}`,
          grade: s.studentGrade || s.grade,
          teacher: s.assignedTeacher ? `${s.assignedTeacher.firstName} ${s.assignedTeacher.lastName}` : 'None'
        }))
      });
    } else {
      log('error', 'Republica of Hunululu school not found');
    }
    
    // Check all teachers
    const allTeachers = await User.find({ role: 'teacher' });
    
    log('info', 'All teachers found', {
      count: allTeachers.length,
      teachers: allTeachers.map(t => ({
        id: t._id,
        name: `${t.firstName} ${t.lastName}`,
        schoolId: t.schoolId,
        email: t.email
      }))
    });
    
    // Check teachers by school
    for (const school of schools) {
      const schoolTeachers = allTeachers.filter(t => 
        t.schoolId && t.schoolId.toString() === school._id.toString()
      );
      
      log('info', `Teachers for ${school.name}`, {
        count: schoolTeachers.length,
        teachers: schoolTeachers.map(t => ({
          id: t._id,
          name: `${t.firstName} ${t.lastName}`,
          email: t.email
        }))
      });
    }
    
  } catch (error) {
    log('error', 'Error in checkAllStudents', {
      error: error.message,
      stack: error.stack
    });
  } finally {
    log('info', 'Disconnecting from MongoDB');
    await mongoose.disconnect();
    log('info', 'All students check completed');
  }
}

checkAllStudents();
