const mongoose = require('mongoose');
const Report = require('./backend/models/Report');
const School = require('./backend/models/School');
const User = require('./backend/models/User');
require('dotenv').config();

async function checkTestSchool10Reports() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    // Find test school 10
    const school = await School.findOne({ name: { $regex: /test school 10/i } });
    if (!school) {
      console.log('❌ Test School 10 not found');
      return;
    }
    
    console.log('🏫 Found school:', school.name, '(ID:', school._id, ')');
    
    // Find all students in this school
    const students = await User.find({ 
      schoolId: school._id, 
      role: 'student' 
    }).select('_id firstName lastName');
    
    console.log('👥 Found', students.length, 'students in Test School 10:');
    students.forEach(s => console.log('  -', s.firstName, s.lastName, '(ID:', s._id, ')'));
    
    if (students.length === 0) {
      console.log('❌ No students found in Test School 10');
      return;
    }
    
    // Find all reports for these students
    const studentIds = students.map(s => s._id);
    const reports = await Report.find({ 
      studentId: { $in: studentIds } 
    }).populate('studentId', 'firstName lastName');
    
    console.log('📊 Found', reports.length, 'reports for Test School 10 students:');
    reports.forEach(r => {
      const student = r.studentId;
      console.log('  -', r.title, 'for', student.firstName, student.lastName, '(ID:', r._id, ')');
    });
    
    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');
    
    return { school, students, reports };
    
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.disconnect();
  }
}

async function deleteTestSchool10Reports() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    // Find test school 10
    const school = await School.findOne({ name: { $regex: /test school 10/i } });
    if (!school) {
      console.log('❌ Test School 10 not found');
      return;
    }
    
    console.log('🏫 Found school:', school.name, '(ID:', school._id, ')');
    
    // Find all students in this school
    const students = await User.find({ 
      schoolId: school._id, 
      role: 'student' 
    }).select('_id firstName lastName');
    
    console.log('👥 Found', students.length, 'students in Test School 10');
    
    if (students.length === 0) {
      console.log('❌ No students found in Test School 10');
      return;
    }
    
    // Find all reports for these students
    const studentIds = students.map(s => s._id);
    const reports = await Report.find({ 
      studentId: { $in: studentIds } 
    }).populate('studentId', 'firstName lastName');
    
    console.log('📊 Found', reports.length, 'reports to delete');
    
    if (reports.length === 0) {
      console.log('✅ No reports found to delete');
      return;
    }
    
    // Delete all reports
    const deleteResult = await Report.deleteMany({ 
      studentId: { $in: studentIds } 
    });
    
    console.log('🗑️ Deleted', deleteResult.deletedCount, 'reports');
    
    // Verify deletion
    const remainingReports = await Report.find({ 
      studentId: { $in: studentIds } 
    });
    
    console.log('✅ Verification: Remaining reports for Test School 10 students:', remainingReports.length);
    
    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');
    
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.disconnect();
  }
}

// Check if command line argument is provided
const command = process.argv[2];

if (command === 'delete') {
  console.log('🗑️ Deleting reports for Test School 10...');
  deleteTestSchool10Reports();
} else {
  console.log('🔍 Checking reports for Test School 10...');
  checkTestSchool10Reports();
}
