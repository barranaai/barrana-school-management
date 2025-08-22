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
const getLogFileName = (prefix = 'check-new-student-classid') => {
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

async function checkNewStudentClassId() {
  const studentId = "68a58884d691e0d83e1c5afa";
  
  log('info', `Starting check of new student with ID: ${studentId}`);
  
  try {
    log('info', 'Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    log('info', 'Connected to MongoDB successfully');
    
    // Load models
    const User = require('./models/User');
    const Class = require('./models/Class');
    const School = require('./models/School');
    
    // Check if student exists
    log('info', `Looking up student with ID: ${studentId}`);
    const student = await User.findById(studentId).populate('classId', 'name grade').populate('schoolId', 'name');
    
    if (!student) {
      log('error', `Student not found with ID: ${studentId}`);
      return;
    }
    
    log('info', 'Student found', {
      studentId: student._id,
      firstName: student.firstName,
      lastName: student.lastName,
      fullName: `${student.firstName} ${student.lastName}`,
      role: student.role,
      schoolId: student.schoolId ? student.schoolId._id : null,
      schoolName: student.schoolId ? student.schoolId.name : null,
      createdAt: student.createdAt,
      updatedAt: student.updatedAt
    });
    
    // Check class-related fields
    log('info', 'Checking class-related fields', {
      studentClass: student.studentClass,
      classId: student.classId ? student.classId._id : null,
      className: student.classId ? student.classId.name : null,
      classGrade: student.classId ? student.classId.grade : null,
      hasClassId: !!student.classId,
      hasStudentClass: !!student.studentClass
    });
    
    // Verify class lookup logic
    if (student.studentClass && student.studentClass.trim()) {
      log('info', 'Verifying class lookup logic', {
        studentClass: student.studentClass,
        schoolId: student.schoolId ? student.schoolId._id : null
      });
      
      try {
        const foundClass = await Class.findOne({ 
          schoolId: student.schoolId ? student.schoolId._id : null,
          name: student.studentClass.trim()
        });
        
        if (foundClass) {
          log('info', 'Class lookup verification', {
            foundClass: {
              id: foundClass._id,
              name: foundClass.name,
              grade: foundClass.grade
            },
            studentClassId: student.classId ? student.classId._id : null,
            match: student.classId && student.classId._id.toString() === foundClass._id.toString()
          });
        } else {
          log('warn', 'Class not found during verification', {
            studentClass: student.studentClass,
            schoolId: student.schoolId ? student.schoolId._id : null
          });
        }
      } catch (error) {
        log('error', 'Error during class lookup verification', {
          error: error.message,
          studentClass: student.studentClass
        });
      }
    }
    
    // Check all students in the same school for comparison
    log('info', 'Checking all students in the same school for comparison');
    const allStudents = await User.find({ 
      schoolId: student.schoolId ? student.schoolId._id : null, 
      role: 'parent' 
    }).populate('classId', 'name grade').sort({ createdAt: -1 });
    
    log('info', 'All students in school', {
      totalStudents: allStudents.length,
      students: allStudents.map(s => ({
        id: s._id,
        name: `${s.firstName} ${s.lastName}`,
        studentClass: s.studentClass,
        classId: s.classId ? s.classId._id : null,
        className: s.classId ? s.classId.name : null,
        hasClassId: !!s.classId,
        createdAt: s.createdAt,
        isNewStudent: s._id.toString() === studentId
      }))
    });
    
    // Analyze classId assignment
    const studentsWithClassId = allStudents.filter(s => s.classId);
    const studentsWithoutClassId = allStudents.filter(s => !s.classId);
    
    log('info', 'ClassId assignment analysis', {
      totalStudents: allStudents.length,
      studentsWithClassId: studentsWithClassId.length,
      studentsWithoutClassId: studentsWithoutClassId.length,
      successRate: allStudents.length > 0 ? Math.round((studentsWithClassId.length / allStudents.length) * 100) : 0,
      newStudentHasClassId: !!student.classId
    });
    
    // Check if this student is the most recent
    const mostRecentStudent = allStudents[0];
    log('info', 'Most recent student check', {
      mostRecentStudent: {
        id: mostRecentStudent._id,
        name: `${mostRecentStudent.firstName} ${mostRecentStudent.lastName}`,
        createdAt: mostRecentStudent.createdAt,
        hasClassId: !!mostRecentStudent.classId
      },
      targetStudent: {
        id: student._id,
        name: `${student.firstName} ${student.lastName}`,
        createdAt: student.createdAt,
        hasClassId: !!student.classId
      },
      isMostRecent: mostRecentStudent._id.toString() === studentId
    });
    
    // Final verification
    log('info', '=== FINAL VERIFICATION ===', {
      studentId: studentId,
      studentName: `${student.firstName} ${student.lastName}`,
      studentClass: student.studentClass,
      classId: student.classId ? student.classId._id : null,
      className: student.classId ? student.classId.name : null,
      hasClassId: !!student.classId,
      createdAt: student.createdAt,
      verificationResult: student.classId ? 'PASSED - Student has classId' : 'FAILED - Student missing classId'
    });
    
    // Check for any errors or issues
    if (!student.classId) {
      log('error', 'STUDENT MISSING CLASSID', {
        studentId: student._id,
        studentName: `${student.firstName} ${student.lastName}`,
        studentClass: student.studentClass,
        expectedClassId: student.studentClass ? 'Should have classId for ' + student.studentClass : 'No studentClass to match'
      });
    } else {
      log('info', 'STUDENT HAS CLASSID - SUCCESS', {
        studentId: student._id,
        studentName: `${student.firstName} ${student.lastName}`,
        studentClass: student.studentClass,
        classId: student.classId._id,
        className: student.classId.name
      });
    }
    
  } catch (error) {
    log('error', 'Error in checkNewStudentClassId', {
      error: error.message,
      stack: error.stack,
      studentId: studentId
    });
  } finally {
    log('info', 'Disconnecting from MongoDB');
    await mongoose.disconnect();
    log('info', 'New student classId check completed');
  }
}

checkNewStudentClassId();
