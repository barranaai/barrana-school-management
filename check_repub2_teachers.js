const mongoose = require('mongoose');
const User = require('./models/User');
const School = require('./models/School');
require('dotenv').config();

async function checkRepub2Teachers() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    // Find "Repub 2" school
    const school = await School.findOne({ name: 'Repub 2' });
    
    if (!school) {
      console.log('❌ School "Repub 2" not found');
      await mongoose.disconnect();
      return;
    }
    
    console.log('🏫 School "Repub 2" found:');
    console.log('  ID:', school._id);
    console.log('  Name:', school.name);
    console.log('  Created:', school.createdAt);
    
    // Find all teachers for this school
    const teachers = await User.find({ 
      role: 'teacher', 
      schoolId: school._id 
    }).select('-password');
    
    console.log(`\n👨‍🏫 Teachers for "Repub 2" (${teachers.length} found):`);
    
    if (teachers.length === 0) {
      console.log('❌ No teachers found for "Repub 2"');
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
    
    // Also check all teachers to see if any have wrong schoolId
    const allTeachers = await User.find({ role: 'teacher' }).select('-password');
    console.log(`\n🔍 All teachers in system (${allTeachers.length} total):`);
    
    allTeachers.forEach((teacher, index) => {
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

checkRepub2Teachers();
