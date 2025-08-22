const mongoose = require('mongoose');
require('dotenv').config();

async function checkUserPasswords() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB\n');
    
    const User = require('./models/User');
    
    // Check all users
    const allUsers = await User.find({}).select('+password');
    
    console.log('USER PASSWORD STATUS REPORT:');
    console.log('=====================================\n');
    
    let usersWithPasswords = 0;
    let usersWithoutPasswords = 0;
    
    for (const user of allUsers) {
      const hasPassword = !!user.password;
      const passwordLength = user.password ? user.password.length : 0;
      
      console.log(`${user.email || 'NO EMAIL'} (${user.role})`);
      console.log(`   Has Password: ${hasPassword ? '✅ Yes' : '❌ No'}`);
      console.log(`   Password Length: ${passwordLength}`);
      console.log(`   Active: ${user.isActive}`);
      console.log(`   Email Verified: ${user.isEmailVerified}`);
      console.log('   ─────────────────────────────────────');
      
      if (hasPassword) {
        usersWithPasswords++;
      } else {
        usersWithoutPasswords++;
      }
    }
    
    console.log('\nSUMMARY:');
    console.log(`Total users: ${allUsers.length}`);
    console.log(`Users with passwords: ${usersWithPasswords}`);
    console.log(`Users without passwords: ${usersWithoutPasswords}`);
    
    if (usersWithoutPasswords > 0) {
      console.log('\n⚠️ WARNING: Some users do not have passwords set!');
      console.log('This could be the cause of login issues.');
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('\nDatabase connection closed');
  }
}

checkUserPasswords();
