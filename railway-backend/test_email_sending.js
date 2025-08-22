const mongoose = require('mongoose');
const Report = require('./models/Report');
const User = require('./models/User');
const School = require('./models/School');
const { sendReportEmail } = require('./services/emailService');
require('dotenv').config();

async function testEmailSending() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    // Find a report to test with
    const report = await Report.findOne()
      .populate('studentId', 'firstName lastName grade studentClass class parentEmail studentGrade')
      .populate('teacherId', 'firstName lastName')
      .populate('schoolId', 'name');
    
    if (!report) {
      console.log('❌ No reports found in database');
      return;
    }
    
    console.log('📋 Found report:', {
      id: report._id,
      title: report.title,
      student: report.studentId ? `${report.studentId.firstName} ${report.studentId.lastName}` : 'No student',
      teacher: report.teacherId ? `${report.teacherId.firstName} ${report.teacherId.lastName}` : 'No teacher',
      school: report.schoolId ? report.schoolId.name : 'No school'
    });
    
    // Test email data
    const emailData = {
      parentEmail: 'test@example.com',
      studentName: report.studentId ? `${report.studentId.firstName} ${report.studentId.lastName}` : 'Test Student',
      teacherName: report.teacherId ? `${report.teacherId.firstName} ${report.teacherId.lastName}` : 'Test Teacher',
      reportTitle: report.title || 'Test Report',
      reportContent: report.content || 'This is a test report content.',
      reportDate: new Date(report.createdAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }),
      schoolName: report.schoolId ? report.schoolId.name : 'Test School',
      schoolId: report.schoolId ? report.schoolId._id.toString() : null
    };
    
    console.log('📧 Testing email with data:', emailData);
    
    // Test the email sending
    const result = await sendReportEmail(emailData);
    
    console.log('✅ Email sending result:', result);
    
    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error testing email:', error);
    await mongoose.disconnect();
  }
}

testEmailSending();
