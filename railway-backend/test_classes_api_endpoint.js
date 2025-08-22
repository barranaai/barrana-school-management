const mongoose = require('mongoose');
const Class = require('./models/Class');
const School = require('./models/School');
const User = require('./models/User');
require('dotenv').config();

async function testClassesAPIEndpoint() {
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
    
    // Find the school admin user
    const schoolAdmin = await User.findOne({ 
      email: 'luicejustin54@gmail.com',
      role: 'school_admin'
    });
    
    if (!schoolAdmin) {
      console.log('❌ School admin user not found');
      await mongoose.disconnect();
      return;
    }
    
    console.log('\n👨‍💼 School Admin found:');
    console.log('  Name:', schoolAdmin.firstName, schoolAdmin.lastName);
    console.log('  Email:', schoolAdmin.email);
    console.log('  Role:', schoolAdmin.role);
    console.log('  SchoolId:', schoolAdmin.schoolId);
    console.log('  SchoolId type:', typeof schoolAdmin.schoolId);
    console.log('  SchoolId matches school?', schoolAdmin.schoolId.toString() === school._id.toString());
    
    // Test the exact query that the API endpoint would use
    console.log('\n🔍 Testing API endpoint query logic:');
    
    // Simulate the API endpoint logic
    let query = { isActive: true };
    
    // If school admin, only show classes from their school
    if (schoolAdmin.role === 'school_admin') {
      query.schoolId = schoolAdmin.schoolId;
      console.log('  Adding schoolId filter:', schoolAdmin.schoolId);
    }
    
    console.log('  Final query:', JSON.stringify(query, null, 2));
    
    const classes = await Class.find(query)
      .populate('assignedTeachers.teacherId', 'firstName lastName email avatar')
      .populate('createdBy', 'firstName lastName')
      .sort({ createdAt: -1 });
    
    console.log(`\n📚 Classes returned by API endpoint logic (${classes.length} found):`);
    
    if (classes.length === 0) {
      console.log('❌ No classes found with the API endpoint logic');
      
      // Let's check what classes exist for this school
      const allClassesForSchool = await Class.find({ schoolId: school._id });
      console.log(`\n🔍 All classes for this school (${allClassesForSchool.length} found):`);
      allClassesForSchool.forEach((cls, index) => {
        console.log(`  ${index + 1}. ${cls.name} (grade: ${cls.grade}, active: ${cls.isActive}, status: ${cls.status})`);
      });
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
    
    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
    
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.disconnect();
  }
}

testClassesAPIEndpoint();
