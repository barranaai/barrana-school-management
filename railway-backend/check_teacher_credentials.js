const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function checkTeacherCredentials() {
  try {
    console.log('🔍 Checking teacher credentials...');
    
    await mongoose.connect(process.env.MONGODB_URI);
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
      hasPassword: !!teacher.password,
      passwordLength: teacher.password ? teacher.password.length : 0
    });
    
    // Test different password combinations
    const testPasswords = ['rph1', 'rph1@gmail.com', 'password', '123456', 'test'];
    
    for (const testPassword of testPasswords) {
      try {
        const isMatch = await bcrypt.compare(testPassword, teacher.password);
        console.log(`🔐 Testing password "${testPassword}": ${isMatch ? '✅ MATCH' : '❌ NO MATCH'}`);
        if (isMatch) {
          console.log('🎉 Found correct password!');
          break;
        }
      } catch (error) {
        console.log(`🔐 Testing password "${testPassword}": ERROR - ${error.message}`);
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
  }
}

checkTeacherCredentials();
