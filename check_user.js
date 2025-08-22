const mongoose = require('mongoose');
require('dotenv').config();

mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    console.log('Connected to MongoDB');
    
    const User = require('./models/User');
    
    // Find the school admin user by email
    const schoolAdmin = await User.findOne({ 
      email: 'barrana1@gmail.com'
    }).select('+password');
    
    if (schoolAdmin) {
      console.log('\n=== SCHOOL ADMIN USER FOUND ===');
      console.log('Email:', schoolAdmin.email);
      console.log('First Name:', schoolAdmin.firstName);
      console.log('Last Name:', schoolAdmin.lastName);
      console.log('Role:', schoolAdmin.role);
      console.log('School ID:', schoolAdmin.schoolId);
      console.log('Is Active:', schoolAdmin.isActive);
      console.log('Is Email Verified:', schoolAdmin.isEmailVerified);
      console.log('Created At:', schoolAdmin.createdAt);
      console.log('Password Hash:', schoolAdmin.password ? 'Present' : 'Missing');
      
      // Test password verification
      const bcrypt = require('bcryptjs');
      const testPassword = 'NewSchool123';
      const isPasswordValid = await bcrypt.compare(testPassword, schoolAdmin.password);
      console.log('\n=== PASSWORD VERIFICATION ===');
      console.log('Test Password:', testPassword);
      console.log('Password Valid:', isPasswordValid);
      
      if (!isPasswordValid) {
        console.log('\n❌ Password verification failed!');
        console.log('\n🔧 Updating the password...');
        
        // Update the password
        const newHash = await bcrypt.hash(testPassword, 12);
        schoolAdmin.password = newHash;
        await schoolAdmin.save();
        console.log('✅ Password updated successfully!');
        console.log('\n=== UPDATED LOGIN DETAILS ===');
        console.log('Email:', schoolAdmin.email);
        console.log('Password:', testPassword);
      } else {
        console.log('\n✅ Password verification successful!');
        console.log('\n=== LOGIN DETAILS ===');
        console.log('Email:', schoolAdmin.email);
        console.log('Password:', testPassword);
      }
      
    } else {
      console.log('\n❌ School admin user not found!');
      console.log('\n🔍 Searching for any user with this email...');
      
      const anyUser = await User.findOne({ email: 'barrana1@gmail.com' });
      if (anyUser) {
        console.log('Found user with different role:');
        console.log('Email:', anyUser.email);
        console.log('Role:', anyUser.role);
        console.log('School ID:', anyUser.schoolId);
      } else {
        console.log('No user found with this email at all.');
      }
    }
    
    mongoose.connection.close();
  })
  .catch(err => {
    console.error('Error:', err);
    mongoose.connection.close();
  }); 