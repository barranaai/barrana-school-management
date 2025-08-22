const mongoose = require('mongoose');
require('dotenv').config();

async function testTeacherSchoolAccess() {
  try {
    console.log('🔍 Testing teacher school access...');
    
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    const User = require('./models/User');
    const School = require('./models/School');
    
    // Find the teacher user
    const teacher = await User.findOne({ 
      role: 'teacher',
      email: 'rph1@gmail.com'
    });
    
    if (!teacher) {
      console.log('❌ Teacher not found');
      return;
    }
    
    console.log('👨‍🏫 Teacher found:', {
      id: teacher._id,
      name: `${teacher.firstName} ${teacher.lastName}`,
      email: teacher.email,
      role: teacher.role,
      schoolId: teacher.schoolId
    });
    
    // Test direct database access to school
    const school = await School.findById(teacher.schoolId);
    
    if (!school) {
      console.log('❌ School not found');
      return;
    }
    
    console.log('🏫 School found:', {
      id: school._id,
      name: school.name,
      timezone: school.settings?.timezone,
      hasReportFrequencies: !!school.settings?.reportFrequencies
    });
    
    console.log('✅ Teacher can access school data directly');
    
    // Test API access (simulate the authorization logic)
    const schoolId = teacher.schoolId.toString();
    const userRole = teacher.role;
    const userSchoolId = teacher.schoolId.toString();
    
    console.log('🔐 Testing authorization logic:');
    console.log('  - User role:', userRole);
    console.log('  - User schoolId:', userSchoolId);
    console.log('  - Requested schoolId:', schoolId);
    console.log('  - Role check:', userRole === 'teacher');
    console.log('  - School match:', userSchoolId === schoolId);
    
    const hasAccess = (userRole === 'teacher' && userSchoolId === schoolId);
    console.log('  - Has access:', hasAccess);
    
    if (hasAccess) {
      console.log('✅ Authorization logic allows access');
    } else {
      console.log('❌ Authorization logic denies access');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

testTeacherSchoolAccess();
