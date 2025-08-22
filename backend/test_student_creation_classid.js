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
const getLogFileName = (prefix = 'test-student-creation-classid') => {
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

async function testStudentCreationClassId() {
  log('info', 'Starting test of student creation process to verify classId setting');
  
  try {
    log('info', 'Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    log('info', 'Connected to MongoDB successfully');
    
    // Load models
    const User = require('./models/User');
    const Class = require('./models/Class');
    const School = require('./models/School');
    
    // Get the school
    log('info', 'Searching for school: Republica of Hunululu');
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
    log('info', 'Fetching all classes for the school');
    const classes = await Class.find({ schoolId: school._id });
    
    log('info', 'Classes found', {
      count: classes.length,
      classes: classes.map(c => ({
        id: c._id,
        name: c.name,
        grade: c.grade
      }))
    });
    
    // Test 1: Simulate the student creation logic from routes/students.js
    log('info', '=== TEST 1: Simulating student creation logic ===');
    
    const testStudentData = {
      firstName: 'Test',
      lastName: 'Student',
      studentGrade: 'Infant',
      parentName: 'Test Parent',
      parentEmail: 'testparent@test.com',
      studentClass: 'Inf A', // This should trigger classId lookup
      schoolId: school._id
    };
    
    log('info', 'Test student data', testStudentData);
    
    // Simulate the class lookup logic from routes/students.js
    let classId = null;
    if (testStudentData.studentClass && testStudentData.studentClass.trim()) {
      try {
        log('info', 'Looking up class by name', {
          schoolId: testStudentData.schoolId,
          className: testStudentData.studentClass.trim()
        });
        
        const foundClass = await Class.findOne({ 
          schoolId: testStudentData.schoolId,
          name: testStudentData.studentClass.trim()
        });
        
        if (foundClass) {
          classId = foundClass._id;
          log('info', 'Class found successfully', {
            className: testStudentData.studentClass,
            classId: classId,
            classObjectId: foundClass._id
          });
        } else {
          log('warn', 'Class not found', {
            className: testStudentData.studentClass,
            availableClasses: classes.map(c => c.name)
          });
        }
      } catch (error) {
        log('error', 'Error finding class', {
          error: error.message,
          className: testStudentData.studentClass
        });
      }
    }
    
    log('info', 'Class lookup result', {
      studentClass: testStudentData.studentClass,
      classId: classId,
      classIdType: typeof classId
    });
    
    // Test 2: Check existing students and their classId status
    log('info', '=== TEST 2: Checking existing students classId status ===');
    
    const existingStudents = await User.find({ 
      schoolId: school._id, 
      role: 'parent' 
    }).populate('classId', 'name grade');
    
    log('info', 'Existing students found', {
      count: existingStudents.length,
      students: existingStudents.map(s => ({
        id: s._id,
        name: `${s.firstName} ${s.lastName}`,
        studentClass: s.studentClass,
        classId: s.classId ? s.classId._id : null,
        className: s.classId ? s.classId.name : null,
        hasClassId: !!s.classId,
        createdAt: s.createdAt
      }))
    });
    
    // Analyze classId assignment
    const studentsWithClassId = existingStudents.filter(s => s.classId);
    const studentsWithoutClassId = existingStudents.filter(s => !s.classId);
    
    log('info', 'ClassId assignment analysis', {
      totalStudents: existingStudents.length,
      studentsWithClassId: studentsWithClassId.length,
      studentsWithoutClassId: studentsWithoutClassId.length,
      successRate: existingStudents.length > 0 ? Math.round((studentsWithClassId.length / existingStudents.length) * 100) : 0
    });
    
    // Test 3: Check if students without classId have matching classes
    log('info', '=== TEST 3: Checking students without classId ===');
    
    for (const student of studentsWithoutClassId) {
      log('info', `Checking student: ${student.firstName} ${student.lastName}`, {
        studentId: student._id,
        studentClass: student.studentClass,
        grade: student.studentGrade || student.grade
      });
      
      if (student.studentClass && student.studentClass.trim()) {
        const matchingClass = classes.find(c => 
          c.name.toLowerCase() === student.studentClass.toLowerCase()
        );
        
        if (matchingClass) {
          log('info', 'Found matching class for student without classId', {
            student: `${student.firstName} ${student.lastName}`,
            studentClass: student.studentClass,
            matchingClass: {
              id: matchingClass._id,
              name: matchingClass.name,
              grade: matchingClass.grade
            }
          });
        } else {
          log('warn', 'No matching class found for student', {
            student: `${student.firstName} ${student.lastName}`,
            studentClass: student.studentClass,
            availableClasses: classes.map(c => c.name)
          });
        }
      } else {
        log('warn', 'Student has no studentClass', {
          student: `${student.firstName} ${student.lastName}`
        });
      }
    }
    
    // Test 4: Verify the User model schema
    log('info', '=== TEST 4: Verifying User model schema ===');
    
    const userSchema = User.schema;
    const classIdField = userSchema.path('classId');
    const studentClassField = userSchema.path('studentClass');
    
    log('info', 'User model schema verification', {
      hasClassIdField: !!classIdField,
      classIdFieldType: classIdField ? classIdField.instance : 'N/A',
      classIdFieldRef: classIdField ? classIdField.options.ref : 'N/A',
      hasStudentClassField: !!studentClassField,
      studentClassFieldType: studentClassField ? studentClassField.instance : 'N/A'
    });
    
    // Test 5: Test creating a new student with the actual creation logic
    log('info', '=== TEST 5: Testing actual student creation ===');
    
    // Create a test student using the same logic as routes/students.js
    const testStudent = {
      firstName: 'Verification',
      lastName: 'Test',
      role: 'parent',
      schoolId: school._id,
      studentGrade: 'Infant',
      parentName: 'Verification Parent',
      parentEmail: 'verification@test.com',
      studentClass: 'Inf A',
      classId: classId, // This should be set by the lookup logic
      enrollmentDate: new Date(),
      isActive: true,
      avatar: 'VT'
    };
    
    log('info', 'About to create test student', {
      studentData: testStudent,
      classId: testStudent.classId,
      classIdType: typeof testStudent.classId
    });
    
    try {
      const createdStudent = await User.create(testStudent);
      
      log('info', 'Test student created successfully', {
        studentId: createdStudent._id,
        firstName: createdStudent.firstName,
        lastName: createdStudent.lastName,
        studentClass: createdStudent.studentClass,
        classId: createdStudent.classId,
        hasClassId: !!createdStudent.classId
      });
      
      // Verify the created student
      const verifiedStudent = await User.findById(createdStudent._id).populate('classId', 'name grade');
      
      log('info', 'Verified created student', {
        studentId: verifiedStudent._id,
        firstName: verifiedStudent.firstName,
        lastName: verifiedStudent.lastName,
        studentClass: verifiedStudent.studentClass,
        classId: verifiedStudent.classId ? verifiedStudent.classId._id : null,
        className: verifiedStudent.classId ? verifiedStudent.classId.name : null,
        hasClassId: !!verifiedStudent.classId
      });
      
      // Clean up - delete the test student
      await User.findByIdAndDelete(createdStudent._id);
      log('info', 'Test student cleaned up');
      
    } catch (error) {
      log('error', 'Error creating test student', {
        error: error.message,
        stack: error.stack
      });
    }
    
    // Final summary
    log('info', '=== FINAL SUMMARY ===', {
      schoolName: school.name,
      totalClasses: classes.length,
      totalStudents: existingStudents.length,
      studentsWithClassId: studentsWithClassId.length,
      studentsWithoutClassId: studentsWithoutClassId.length,
      classIdSuccessRate: existingStudents.length > 0 ? Math.round((studentsWithClassId.length / existingStudents.length) * 100) : 0,
      classLookupTest: classId ? 'PASSED' : 'FAILED',
      schemaVerification: classIdField ? 'PASSED' : 'FAILED'
    });
    
  } catch (error) {
    log('error', 'Error in testStudentCreationClassId', {
      error: error.message,
      stack: error.stack
    });
  } finally {
    log('info', 'Disconnecting from MongoDB');
    await mongoose.disconnect();
    log('info', 'Student creation classId test completed');
  }
}

testStudentCreationClassId();
