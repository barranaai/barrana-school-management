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
const getLogFileName = (prefix = 'update-students-classid') => {
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

async function updateExistingStudentsClassId() {
  log('info', 'Starting update of existing students to populate classId field');
  
  try {
    log('info', 'Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    log('info', 'Connected to MongoDB successfully');
    
    // Load models
    const User = require('./models/User');
    const Class = require('./models/Class');
    const School = require('./models/School');
    
    // Get all schools
    const schools = await School.find({});
    log('info', 'Found schools', {
      count: schools.length,
      schools: schools.map(s => ({ id: s._id, name: s.name }))
    });
    
    let totalStudentsProcessed = 0;
    let totalStudentsUpdated = 0;
    let totalStudentsWithClassId = 0;
    let totalStudentsWithoutClassId = 0;
    
    for (const school of schools) {
      log('info', `Processing school: ${school.name}`, {
        schoolId: school._id,
        schoolName: school.name
      });
      
      // Get all students for this school
      const students = await User.find({ 
        schoolId: school._id, 
        role: 'parent' 
      });
      
      log('info', `Found students for school ${school.name}`, {
        count: students.length
      });
      
      // Get all classes for this school
      const classes = await Class.find({ schoolId: school._id });
      
      log('info', `Found classes for school ${school.name}`, {
        count: classes.length,
        classes: classes.map(c => ({ id: c._id, name: c.name, grade: c.grade }))
      });
      
      // Process each student
      for (const student of students) {
        totalStudentsProcessed++;
        
        log('info', `Processing student: ${student.firstName} ${student.lastName}`, {
          studentId: student._id,
          studentName: `${student.firstName} ${student.lastName}`,
          currentStudentClass: student.studentClass,
          currentClassId: student.classId
        });
        
        // Skip if student already has classId
        if (student.classId) {
          totalStudentsWithClassId++;
          log('info', `Student already has classId, skipping`, {
            studentId: student._id,
            classId: student.classId
          });
          continue;
        }
        
        // If student has studentClass, try to find matching class
        if (student.studentClass && student.studentClass.trim()) {
          const matchingClass = classes.find(c => 
            c.name.toLowerCase() === student.studentClass.toLowerCase()
          );
          
          if (matchingClass) {
            // Update student with classId
            await User.findByIdAndUpdate(student._id, {
              classId: matchingClass._id
            });
            
            totalStudentsUpdated++;
            log('info', `Updated student with classId`, {
              studentId: student._id,
              studentName: `${student.firstName} ${student.lastName}`,
              studentClass: student.studentClass,
              classId: matchingClass._id,
              className: matchingClass.name
            });
          } else {
            totalStudentsWithoutClassId++;
            log('warn', `No matching class found for student`, {
              studentId: student._id,
              studentName: `${student.firstName} ${student.lastName}`,
              studentClass: student.studentClass,
              availableClasses: classes.map(c => c.name)
            });
          }
        } else {
          totalStudentsWithoutClassId++;
          log('warn', `Student has no studentClass`, {
            studentId: student._id,
            studentName: `${student.firstName} ${student.lastName}`
          });
        }
      }
    }
    
    // Final summary
    log('info', 'Update completed - Final Summary', {
      totalStudentsProcessed,
      totalStudentsUpdated,
      totalStudentsWithClassId,
      totalStudentsWithoutClassId,
      successRate: totalStudentsProcessed > 0 ? Math.round((totalStudentsUpdated / totalStudentsProcessed) * 100) : 0
    });
    
    // Verify the updates
    log('info', 'Verifying updates...');
    const allStudents = await User.find({ role: 'parent' }).populate('classId', 'name grade');
    
    const studentsWithClassId = allStudents.filter(s => s.classId);
    const studentsWithoutClassId = allStudents.filter(s => !s.classId);
    
    log('info', 'Verification results', {
      totalStudents: allStudents.length,
      studentsWithClassId: studentsWithClassId.length,
      studentsWithoutClassId: studentsWithoutClassId.length,
      studentsWithClassIdDetails: studentsWithClassId.map(s => ({
        id: s._id,
        name: `${s.firstName} ${s.lastName}`,
        classId: s.classId ? s.classId._id : null,
        className: s.classId ? s.classId.name : null,
        studentClass: s.studentClass
      }))
    });
    
  } catch (error) {
    log('error', 'Error in updateExistingStudentsClassId', {
      error: error.message,
      stack: error.stack
    });
  } finally {
    log('info', 'Disconnecting from MongoDB');
    await mongoose.disconnect();
    log('info', 'Update existing students classId completed');
  }
}

updateExistingStudentsClassId();
