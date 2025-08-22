const mongoose = require('mongoose');
const Report = require('./models/Report');
const User = require('./models/User');
require('dotenv').config();

async function checkReportReferences() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    // Get all reports
    const reports = await Report.find({});
    console.log('📊 Total reports:', reports.length);
    
    // Get unique student IDs from reports
    const studentIds = [...new Set(reports.map(r => r.studentId?.toString()).filter(id => id))];
    console.log('👥 Unique student IDs referenced in reports:', studentIds.length);
    
    // Check which student IDs actually exist
    const existingStudents = await User.find({ _id: { $in: studentIds }, role: 'student' });
    console.log('✅ Existing students referenced in reports:', existingStudents.length);
    
    // Check which student IDs don't exist
    const missingStudentIds = studentIds.filter(id => !existingStudents.some(s => s._id.toString() === id));
    console.log('❌ Missing student IDs referenced in reports:', missingStudentIds.length);
    
    if (missingStudentIds.length > 0) {
      console.log('📋 Missing student IDs:', missingStudentIds.slice(0, 10));
    }
    
    // Get unique teacher IDs from reports
    const teacherIds = [...new Set(reports.map(r => r.teacherId?.toString()).filter(id => id))];
    console.log('👨‍🏫 Unique teacher IDs referenced in reports:', teacherIds.length);
    
    // Check which teacher IDs actually exist
    const existingTeachers = await User.find({ _id: { $in: teacherIds }, role: 'teacher' });
    console.log('✅ Existing teachers referenced in reports:', existingTeachers.length);
    
    // Check which teacher IDs don't exist
    const missingTeacherIds = teacherIds.filter(id => !existingTeachers.some(t => t._id.toString() === id));
    console.log('❌ Missing teacher IDs referenced in reports:', missingTeacherIds.length);
    
    if (missingTeacherIds.length > 0) {
      console.log('📋 Missing teacher IDs:', missingTeacherIds.slice(0, 10));
    }
    
    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.disconnect();
  }
}

checkReportReferences();
