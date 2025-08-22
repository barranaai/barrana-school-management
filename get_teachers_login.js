const mongoose = require('mongoose');
require('dotenv').config();

async function getTeachersLogin() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
    
    const User = require('./models/User');
    const School = require('./models/School');
    
    // First, find Barrana AI School
    const barranaSchool = await School.findOne({ name: 'Barrana AI School' });
    
    if (!barranaSchool) {
      console.log('❌ Barrana AI School not found');
      return;
    }
    
    console.log('🏫 Found Barrana AI School:', barranaSchool.name);
    console.log('   School ID:', barranaSchool._id);
    
    // Find all teachers for this school
    const teachers = await User.find({ 
      role: 'teacher',
      schoolId: barranaSchool._id 
    }).select('firstName lastName email role grade specialization isActive');
    
    if (teachers.length === 0) {
      console.log('❌ No teachers found for Barrana AI School');
      return;
    }
    
    console.log('\n==========================================');
    console.log('📚 BARRANA AI SCHOOL - TEACHER LOGIN DETAILS');
    console.log('==========================================\n');
    
    teachers.forEach((teacher, index) => {
      console.log(`${index + 1}. ${teacher.firstName} ${teacher.lastName}`);
      console.log(`   Email: ${teacher.email}`);
      console.log(`   Password: demo123`);
      console.log(`   Role: ${teacher.role}`);
      console.log(`   Grade: ${teacher.grade || 'Not specified'}`);
      console.log(`   Specialization: ${teacher.specialization || 'Not specified'}`);
      console.log(`   Status: ${teacher.isActive ? 'Active' : 'Inactive'}`);
      console.log('   ─────────────────────────────────────');
    });
    
    console.log(`\n✅ Total Teachers Found: ${teachers.length}`);
    console.log('\n📋 SUMMARY FOR EASY COPY:');
    console.log('==========================================');
    
    teachers.forEach((teacher, index) => {
      console.log(`${index + 1}. ${teacher.email} / demo123 (${teacher.firstName} ${teacher.lastName})`);
    });
    
    console.log('\n💡 Note: All teacher accounts use the password "demo123"');
    console.log('💡 Make sure to select "Teacher" role in the login dropdown');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Database connection closed');
  }
}

getTeachersLogin();
