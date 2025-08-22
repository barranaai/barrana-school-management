const mongoose = require('mongoose');
require('dotenv').config();

async function checkAllTeachers() {
  try {
    console.log('🔍 Checking all teachers...');
    
    await mongoose.connect(process.env.MONGODB_URI);
    const User = require('./models/User');
    
    // Find all teachers
    const teachers = await User.find({ role: 'teacher' });
    
    console.log(`👨‍🏫 Found ${teachers.length} teachers:`);
    
    teachers.forEach((teacher, index) => {
      console.log(`\n${index + 1}. Teacher:`, {
        id: teacher._id,
        name: `${teacher.firstName} ${teacher.lastName}`,
        email: teacher.email,
        role: teacher.role,
        schoolId: teacher.schoolId,
        hasPassword: !!teacher.password,
        passwordLength: teacher.password ? teacher.password.length : 0,
        createdAt: teacher.createdAt
      });
    });
    
    // Check if any teacher has a password
    const teachersWithPassword = teachers.filter(t => t.password);
    console.log(`\n📊 Summary: ${teachersWithPassword.length} out of ${teachers.length} teachers have passwords`);
    
    if (teachersWithPassword.length === 0) {
      console.log('⚠️  No teachers have passwords! This is why authentication is failing.');
      console.log('💡 You need to set passwords for teachers or use a different authentication method.');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
  }
}

checkAllTeachers();
