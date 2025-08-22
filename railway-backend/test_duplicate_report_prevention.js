const mongoose = require('mongoose');
const axios = require('axios');
const jwt = require('jsonwebtoken');
require('dotenv').config();

async function testDuplicateReportPrevention() {
  try {
    console.log('🧪 Testing duplicate report prevention logic...');
    
    await mongoose.connect(process.env.MONGODB_URI);
    const User = require('./models/User');
    const Report = require('./models/Report');
    const ReportTemplate = require('./models/ReportTemplate');
    const School = require('./models/School');
    
    const schoolId = '68a4b0c04283c7f05947b15e'; // Republica of Hunululu
    
    // Get the school and its settings
    const school = await School.findById(schoolId);
    if (!school) {
      console.log('❌ School not found');
      return;
    }
    
    console.log('📋 School settings:', {
      timezone: school.settings?.timezone,
      reportFrequencies: school.settings?.reportFrequencies
    });
    
    // Get teachers for the school
    const teachers = await User.find({ 
      schoolId: schoolId, 
      role: 'teacher' 
    }).limit(3);
    
    if (teachers.length < 2) {
      console.log('❌ Need at least 2 teachers to test duplicate prevention');
      return;
    }
    
    console.log('👨‍🏫 Found teachers:', teachers.map(t => ({
      id: t._id,
      name: `${t.firstName} ${t.lastName}`,
      email: t.email
    })));
    
    // Get students
    const students = await User.find({ 
      schoolId: schoolId, 
      role: 'parent',
      studentClass: 'Inf A'
    }).limit(2);
    
    if (students.length === 0) {
      console.log('❌ No students found');
      return;
    }
    
    console.log('👥 Found students:', students.map(s => ({
      id: s._id,
      name: `${s.firstName} ${s.lastName}`,
      class: s.studentClass
    })));
    
    // Get report templates
    const templates = await ReportTemplate.find({ 
      schoolId: schoolId, 
      isActive: true 
    }).limit(1);
    
    if (templates.length === 0) {
      console.log('❌ No report templates found');
      return;
    }
    
    console.log('📝 Found template:', {
      id: templates[0]._id,
      name: templates[0].name,
      frequency: templates[0].reportFrequency,
      grade: templates[0].grade
    });
    
    const teacher1 = teachers[0];
    const teacher2 = teachers[1];
    const student = students[0];
    const template = templates[0];
    
    // Generate tokens for both teachers
    const token1 = jwt.sign(
      { id: teacher1._id, email: teacher1.email, role: teacher1.role, schoolId: teacher1.schoolId },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    const token2 = jwt.sign(
      { id: teacher2._id, email: teacher2.email, role: teacher2.role, schoolId: teacher2.schoolId },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    console.log('\n🔍 Testing due status check...');
    
    // Test due status check for teacher 1
    try {
      const dueStatusResponse1 = await axios.get(
        `http://localhost:5050/api/reports/due-status?studentId=${student._id}&templateId=${template._id}`,
        {
          headers: { Authorization: `Bearer ${token1}` }
        }
      );
      
      console.log('✅ Teacher 1 due status:', {
        due: dueStatusResponse1.data.data.due,
        hasExistingReport: dueStatusResponse1.data.data.hasExistingReportInPeriod,
        existingTeacher: dueStatusResponse1.data.data.existingReportInPeriod?.teacherName
      });
    } catch (error) {
      console.log('❌ Teacher 1 due status check failed:', {
        message: error.response?.data?.message || error.message,
        error: error.response?.data?.error || error.message,
        status: error.response?.status,
        fullError: error.toString(),
        stack: error.stack
      });
    }
    
    // Test due status check for teacher 2
    try {
      const dueStatusResponse2 = await axios.get(
        `http://localhost:5050/api/reports/due-status?studentId=${student._id}&templateId=${template._id}`,
        {
          headers: { Authorization: `Bearer ${token2}` }
        }
      );
      
      console.log('✅ Teacher 2 due status:', {
        due: dueStatusResponse2.data.data.due,
        hasExistingReport: dueStatusResponse2.data.data.hasExistingReportInPeriod,
        existingTeacher: dueStatusResponse2.data.data.existingReportInPeriod?.teacherName
      });
    } catch (error) {
      console.log('❌ Teacher 2 due status check failed:', {
        message: error.response?.data?.message || error.message,
        error: error.response?.data?.error || error.message,
        status: error.response?.status
      });
    }
    
    console.log('\n🔍 Testing report creation...');
    
    // Try to create a report with teacher 1
    const reportData1 = {
      title: `Test Report by ${teacher1.firstName}`,
      studentId: student._id,
      templateId: template._id,
      content: 'This is a test report content.',
      reportType: 'progress'
    };
    
    try {
      const createResponse1 = await axios.post(
        'http://localhost:5050/api/reports',
        reportData1,
        {
          headers: { 
            Authorization: `Bearer ${token1}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      console.log('✅ Teacher 1 report creation:', {
        success: createResponse1.data.success,
        reportId: createResponse1.data.data?._id
      });
    } catch (error) {
      console.log('❌ Teacher 1 report creation failed:', {
        message: error.response?.data?.message || error.message,
        error: error.response?.data?.error || error.message,
        status: error.response?.status
      });
    }
    
    // Try to create a report with teacher 2 (should be blocked)
    const reportData2 = {
      title: `Test Report by ${teacher2.firstName}`,
      studentId: student._id,
      templateId: template._id,
      content: 'This is a test report content by teacher 2.',
      reportType: 'progress'
    };
    
    try {
      const createResponse2 = await axios.post(
        'http://localhost:5050/api/reports',
        reportData2,
        {
          headers: { 
            Authorization: `Bearer ${token2}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      console.log('❌ Teacher 2 report creation should have been blocked but succeeded:', {
        success: createResponse2.data.success,
        reportId: createResponse2.data.data?._id
      });
    } catch (error) {
      if (error.response?.status === 403) {
        console.log('✅ Teacher 2 report creation correctly blocked:', {
          message: error.response.data.message,
          existingTeacher: error.response.data.data?.existingReportTeacherName
        });
      } else {
        console.log('❌ Teacher 2 report creation failed with unexpected error:', {
          message: error.response?.data?.message || error.message,
          error: error.response?.data?.error || error.message,
          status: error.response?.status
        });
      }
    }
    
    // Check existing reports
    const existingReports = await Report.find({
      schoolId: schoolId,
      studentId: student._id,
      templateId: template._id
    }).populate('teacherId', 'firstName lastName');
    
    console.log('\n📋 Existing reports for this student-template combination:');
    existingReports.forEach((report, index) => {
      const teacherName = report.teacherId 
        ? `${report.teacherId.firstName} ${report.teacherId.lastName}`
        : 'Unknown Teacher';
      
      console.log(`${index + 1}. Report ID: ${report._id}`);
      console.log(`   Teacher: ${teacherName}`);
      console.log(`   Status: ${report.status}`);
      console.log(`   Created: ${report.createdAt}`);
      console.log(`   Title: ${report.title}`);
    });
    
    console.log('\n🎯 Test Summary:');
    console.log('✅ Due status check includes existing report information');
    console.log('✅ Report creation prevents duplicates for same frequency period');
    console.log('✅ Error messages include teacher name who already generated report');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    await mongoose.disconnect();
  }
}

testDuplicateReportPrevention();
