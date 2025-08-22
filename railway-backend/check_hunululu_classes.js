const mongoose = require('mongoose');
const Class = require('./models/Class');
const School = require('./models/School');
require('dotenv').config();

async function checkHunululuClasses() {
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
    
    // Find all classes for this school
    const classes = await Class.find({ 
      schoolId: school._id 
    });
    
    console.log(`\n📚 Classes for "Republica of Hunululu" (${classes.length} found):`);
    
    if (classes.length === 0) {
      console.log('❌ No classes found for "Republica of Hunululu"');
      console.log('\n💡 You need to create classes first before adding students.');
    } else {
      classes.forEach((cls, index) => {
        console.log(`\n  ${index + 1}. ${cls.name}`);
        console.log('     ID:', cls._id);
        console.log('     Grade:', cls.grade);
        console.log('     Status:', cls.status);
        console.log('     Active:', cls.isActive);
        console.log('     Capacity:', cls.capacity);
        console.log('     Assigned Teachers:', cls.assignedTeachers?.length || 0);
        console.log('     Created:', cls.createdAt);
      });
    }
    
    // Also check all classes in the system
    const allClasses = await Class.find({});
    console.log(`\n🔍 All classes in system (${allClasses.length} total):`);
    
    allClasses.forEach((cls, index) => {
      console.log(`\n  ${index + 1}. ${cls.name}`);
      console.log('     SchoolId:', cls.schoolId);
      console.log('     Grade:', cls.grade);
      console.log('     Status:', cls.status);
      console.log('     Active:', cls.isActive);
    });
    
    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
    
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.disconnect();
  }
}

checkHunululuClasses();
