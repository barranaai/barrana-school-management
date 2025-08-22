const mongoose = require('mongoose');
const Report = require('./models/Report');
const User = require('./models/User');
const School = require('./models/School');
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
    
    console.log('🏫 Test School 10:', school.name, '(ID:', school._id, ')');
    
    // Find teachers in this school
    const teachers = await User.find({ schoolId: school._id, role: 'teacher' });
    console.log('👨‍🏫 Teachers in Test School 10:', teachers.length);
    
    // Find reports for these teachers
    const teacherIds = teachers.map(t => t._id);
    const reports = await Report.find({ teacherId: { $in: teacherIds } });
    console.log('📋 Reports for Test School 10 teachers:', reports.length);
    
    if (reports.length > 0) {
      console.log('📋 Sample reports:');
      reports.slice(0, 10).forEach(r => {
        console.log('  -', r.title, '(Status:', r.status, ', Created:', r.createdAt.toISOString().split('T')[0], ')');
      });
    }
    
    // Also check total reports in database
    const totalReports = await Report.countDocuments();
    console.log('📊 Total reports in entire database:', totalReports);
    
    // Check if there are any reports that might be associated with Test School 10 through other means
    const allReports = await Report.find({}).populate('teacherId', 'firstName lastName schoolId').populate('schoolId', 'name');
    const testSchool10Reports = allReports.filter(r => {
      const teacherSchoolId = r.teacherId?.schoolId;
      const reportSchoolId = r.schoolId?._id;
      return (teacherSchoolId && teacherSchoolId.toString() === school._id.toString()) || 
             (reportSchoolId && reportSchoolId.toString() === school._id.toString());
    });
    
    console.log('🔍 Reports associated with Test School 10 (any method):', testSchool10Reports.length);
    
    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.disconnect();
  }
}

checkTestSchool10Reports();
