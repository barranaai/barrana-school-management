const mongoose = require('mongoose');
require('dotenv').config();

mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    console.log('Connected to MongoDB');
    
    const User = require('./backend/models/User');
    
    // Find the super admin user
    const superAdmin = await User.findOne({ 
      role: 'super_admin'
    }).select('+password');
    
    if (superAdmin) {
      console.log('\n=== SUPER ADMIN USER FOUND ===');
      console.log('Email:', superAdmin.email);
      console.log('First Name:', superAdmin.firstName);
      console.log('Last Name:', superAdmin.lastName);
      console.log('Role:', superAdmin.role);
      console.log('Is Active:', superAdmin.isActive);
      console.log('Is Email Verified:', superAdmin.isEmailVerified);
      console.log('Created At:', superAdmin.createdAt);
      console.log('Password Hash:', superAdmin.password ? 'Present' : 'Missing');
      
      // Test password verification
      const bcrypt = require('bcryptjs');
      const testPassword = 'demo123';
      const isPasswordValid = await bcrypt.compare(testPassword, superAdmin.password);
      console.log('\n=== PASSWORD VERIFICATION ===');
      console.log('Test Password:', testPassword);
      console.log('Password Valid:', isPasswordValid);
      
      if (isPasswordValid) {
        console.log('\n✅ Password verification successful!');
        console.log('\n=== SUPER ADMIN LOGIN DETAILS ===');
        console.log('Email:', superAdmin.email);
        console.log('Password:', testPassword);
      } else {
        console.log('\n❌ Password verification failed!');
        console.log('The password "demo123" is not correct for this user.');
      }
      
    } else {
      console.log('\n❌ Super admin user not found!');
      console.log('\n🔍 Searching for any users with super_admin role...');
      
      const allUsers = await User.find({ role: 'super_admin' });
      if (allUsers.length > 0) {
        console.log(`Found ${allUsers.length} super admin users:`);
        allUsers.forEach(user => {
          console.log('- Email:', user.email, '| Name:', `${user.firstName} ${user.lastName}`);
        });
      } else {
        console.log('No super admin users found in the database.');
      }
    }
    
    mongoose.connection.close();
  })
  .catch(err => {
    console.error('Error:', err);
    mongoose.connection.close();
  });
