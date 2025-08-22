const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
require('dotenv').config();

async function testTeacherToken() {
  try {
    console.log('🔍 Testing teacher token and school access...');
    
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    const User = require('./models/User');
    
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
    
    // Generate a valid JWT token for this teacher
    const token = jwt.sign(
      { 
        id: teacher._id,
        email: teacher.email,
        role: teacher.role,
        schoolId: teacher.schoolId
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    console.log('🔐 Generated token:', token.substring(0, 50) + '...');
    
    // Test the token by decoding it
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      console.log('✅ Token is valid');
      console.log('📊 Decoded token:', {
        id: decoded.id,
        email: decoded.email,
        role: decoded.role,
        schoolId: decoded.schoolId
      });
    } catch (error) {
      console.log('❌ Token verification failed:', error.message);
      return;
    }
    
    // Test the authorization logic
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
    
    // Test the middleware logic
    console.log('🔐 Testing middleware logic:');
    const authorizedRoles = ['super_admin', 'school_admin', 'teacher'];
    const isRoleAuthorized = authorizedRoles.includes(userRole);
    console.log('  - Authorized roles:', authorizedRoles);
    console.log('  - User role authorized:', isRoleAuthorized);
    console.log('  - Final access granted:', isRoleAuthorized && hasAccess);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

testTeacherToken();
