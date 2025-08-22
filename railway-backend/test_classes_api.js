const mongoose = require('mongoose');
const Class = require('./models/Class');
const School = require('./models/School');
require('dotenv').config();

async function testClassesAPI() {
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
    
    // Test the classes API logic - get all classes for this school
    const classes = await Class.find({ 
      schoolId: school._id,
      isActive: true,
      status: 'active'
    });
    
    console.log(`\n📚 Classes for "Republica of Hunululu" (${classes.length} found):`);
    
    if (classes.length === 0) {
      console.log('❌ No active classes found for "Republica of Hunululu"');
    } else {
      classes.forEach((cls, index) => {
        console.log(`\n  ${index + 1}. ${cls.name}`);
        console.log('     ID:', cls._id);
        console.log('     Grade:', cls.grade);
        console.log('     Status:', cls.status);
        console.log('     Active:', cls.isActive);
        console.log('     SchoolId:', cls.schoolId);
        console.log('     Assigned Teachers:', cls.assignedTeachers?.length || 0);
      });
    }
    
    // Also test the exact query that the frontend would use
    console.log('\n🔍 Testing exact frontend query:');
    const frontendClasses = await Class.find({ 
      schoolId: school._id 
    });
    
    console.log(`Frontend would get ${frontendClasses.length} total classes (before filtering):`);
    frontendClasses.forEach((cls, index) => {
      console.log(`  ${index + 1}. ${cls.name} (grade: ${cls.grade}, active: ${cls.isActive}, status: ${cls.status})`);
    });
    
    // Test the filtering logic
    const filteredClasses = frontendClasses.filter(cls => cls.isActive && cls.status === 'active');
    console.log(`\nAfter filtering (isActive && status === 'active'): ${filteredClasses.length} classes`);
    
    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
    
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.disconnect();
  }
}

testClassesAPI();
