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
const getLogFileName = (prefix = 'fix-student-class') => {
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

async function fixStudentClassAssignment() {
  log('info', 'Starting student class assignment fix');
  
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
    
    // Get the Inf A class
    const Class = require('./models/Class');
    const infAClass = await Class.findOne({ 
      schoolId: school._id, 
      name: 'Inf A' 
    });
    
    if (!infAClass) {
      log('error', 'Class Inf A not found');
      return;
    }
    
    log('info', 'Inf A class found', {
      classId: infAClass._id,
      className: infAClass.name,
      classGrade: infAClass.grade
    });
    
    // Get all students (role: parent) for this school
    const User = require('./models/User');
    const students = await User.find({ 
      schoolId: school._id, 
      role: 'parent' 
    });
    
    log('info', 'Students found', {
      count: students.length,
      students: students.map(s => ({
        id: s._id,
        name: `${s.firstName} ${s.lastName}`,
        grade: s.studentGrade || s.grade,
        classId: s.classId
      }))
    });
    
    // Update students to assign them to Inf A class
    const studentIds = students.map(s => s._id);
    const updateResult = await User.updateMany(
      { 
        schoolId: school._id, 
        role: 'parent',
        _id: { $in: studentIds }
      },
      { 
        $set: { classId: infAClass._id }
      }
    );
    
    log('info', 'Student class assignment update result', {
      matchedCount: updateResult.matchedCount,
      modifiedCount: updateResult.modifiedCount,
      acknowledged: updateResult.acknowledged
    });
    
    // Update the class to include these students in the students array
    const classUpdateResult = await Class.updateOne(
      { _id: infAClass._id },
      { 
        $addToSet: { students: { $each: studentIds } }
      }
    );
    
    log('info', 'Class students array update result', {
      matchedCount: classUpdateResult.matchedCount,
      modifiedCount: classUpdateResult.modifiedCount,
      acknowledged: classUpdateResult.acknowledged
    });
    
    // Verify the changes
    const updatedStudents = await User.find({ 
      schoolId: school._id, 
      role: 'parent' 
    });
    
    log('info', 'Updated students verification', {
      count: updatedStudents.length,
      students: updatedStudents.map(s => ({
        id: s._id,
        name: `${s.firstName} ${s.lastName}`,
        grade: s.studentGrade || s.grade,
        classId: s.classId,
        classIdString: s.classId ? s.classId.toString() : 'null'
      }))
    });
    
    const updatedClass = await Class.findById(infAClass._id);
    
    log('info', 'Updated class verification', {
      classId: updatedClass._id,
      className: updatedClass.name,
      studentsInArray: updatedClass.students ? updatedClass.students.length : 0,
      studentIds: updatedClass.students ? updatedClass.students.map(s => s.toString()) : []
    });
    
    // Check how many students now have the correct classId
    const studentsWithCorrectClassId = updatedStudents.filter(s => 
      s.classId && s.classId.toString() === infAClass._id.toString()
    );
    
    log('info', 'Final verification', {
      totalStudents: updatedStudents.length,
      studentsWithCorrectClassId: studentsWithCorrectClassId.length,
      studentsInClassArray: updatedClass.students ? updatedClass.students.length : 0,
      fixSuccessful: studentsWithCorrectClassId.length === updatedStudents.length
    });
    
    if (studentsWithCorrectClassId.length === updatedStudents.length) {
      log('info', '✅ SUCCESS: All students have been assigned to Inf A class');
    } else {
      log('error', '❌ ERROR: Not all students were assigned to Inf A class');
    }
    
  } catch (error) {
    log('error', 'Error in fixStudentClassAssignment', {
      error: error.message,
      stack: error.stack
    });
  } finally {
    log('info', 'Disconnecting from MongoDB');
    await mongoose.disconnect();
    log('info', 'Student class assignment fix completed');
  }
}

fixStudentClassAssignment();
