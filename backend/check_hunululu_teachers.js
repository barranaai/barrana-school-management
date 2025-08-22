const mongoose = require('mongoose');
const User = require('./models/User');
const School = require('./models/School');
require('dotenv').config();

async function checkHunululuTeachers() {
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
    console.log('  Created:', school.createdAt);
    
    // Find all teachers for this school
    const teachers = await User.find({ 
      role: 'teacher', 
      schoolId: school._id 
    }).select('-password');
    
    console.log(`\n👨‍🏫 Teachers for "Republica of Hunululu" (${teachers.length} found):`);
    
    if (teachers.length === 0) {
      console.log('❌ No teachers found for "Republica of Hunululu"');
    } else {
      teachers.forEach((teacher, index) => {
        console.log(`\n  ${index + 1}. ${teacher.firstName} ${teacher.lastName}`);
        console.log('     Email:', teacher.email);
        console.log('     Phone:', teacher.phone);
        console.log('     Grade:', teacher.grade);
        console.log('     SchoolId:', teacher.schoolId);
        console.log('     Created:', teacher.createdAt);
        console.log('     Active:', teacher.isActive);
      });
    }
    
    // Check recent teachers (created in last hour) to see if any failed
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentTeachers = await User.find({ 
      role: 'teacher',
      createdAt: { $gte: oneHourAgo }
    }).select('-password');
    
    console.log(`\n🔍 Recent teachers (last hour) (${recentTeachers.length} found):`);
    recentTeachers.forEach((teacher, index) => {
      console.log(`\n  ${index + 1}. ${teacher.firstName} ${teacher.lastName}`);
      console.log('     Email:', teacher.email);
      console.log('     SchoolId:', teacher.schoolId);
      console.log('     Created:', teacher.createdAt);
    });
    
    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
    
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.disconnect();
  }
}

checkHunululuTeachers();
