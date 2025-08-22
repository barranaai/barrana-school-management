const mongoose = require('mongoose');
const User = require('./models/User');
const School = require('./models/School');
require('dotenv').config();

async function checkHunululuAdmin() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    // Find "Republica of Hunululu" school
    const school = await School.findOne({ name: 'Republica of Hunululu' });
    
    if (!school) {
      console.log('❌ School "Republica of Hunululu" not found');
      await mongoose.disconnect();
      return;
    }
    
    console.log('🏫 School "Republica of Hunululu" found:');
    console.log('  ID:', school._id);
    console.log('  Name:', school.name);
    
    // Find school admin for this school
    const schoolAdmin = await User.findOne({ 
      role: 'school_admin', 
      schoolId: school._id 
    }).select('-password');
    
    console.log(`\n👨‍💼 School Admin for "Republica of Hunululu":`);
    
    if (!schoolAdmin) {
      console.log('❌ No school admin found for "Republica of Hunululu"');
      
      // Check if there are any school admins at all
      const allSchoolAdmins = await User.find({ role: 'school_admin' }).select('-password');
      console.log(`\n🔍 All school admins in system (${allSchoolAdmins.length} total):`);
      allSchoolAdmins.forEach((admin, index) => {
        console.log(`\n  ${index + 1}. ${admin.firstName} ${admin.lastName}`);
        console.log('     Email:', admin.email);
        console.log('     SchoolId:', admin.schoolId);
        console.log('     Created:', admin.createdAt);
      });
    } else {
      console.log('✅ School admin found:');
      console.log('  Name:', schoolAdmin.firstName, schoolAdmin.lastName);
      console.log('  Email:', schoolAdmin.email);
      console.log('  SchoolId:', schoolAdmin.schoolId);
      console.log('  Created:', schoolAdmin.createdAt);
      console.log('  Active:', schoolAdmin.isActive);
    }
    
    // Also check recent users (created in last hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentUsers = await User.find({ 
      createdAt: { $gte: oneHourAgo }
    }).select('-password');
    
    console.log(`\n🔍 Recent users (last hour) (${recentUsers.length} found):`);
    recentUsers.forEach((user, index) => {
      console.log(`\n  ${index + 1}. ${user.firstName} ${user.lastName}`);
      console.log('     Email:', user.email);
      console.log('     Role:', user.role);
      console.log('     SchoolId:', user.schoolId);
      console.log('     Created:', user.createdAt);
    });
    
    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
    
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.disconnect();
  }
}

checkHunululuAdmin();
