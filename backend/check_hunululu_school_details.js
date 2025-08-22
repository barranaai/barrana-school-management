const mongoose = require('mongoose');
const School = require('./models/School');
require('dotenv').config();

async function checkHunululuSchoolDetails() {
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
    
    console.log('🏫 School "Republica of Hunululu" Details:');
    console.log('  ID:', school._id);
    console.log('  Name:', school.name);
    console.log('  Type:', school.schoolType);
    console.log('  Grade Levels:', school.gradeLevels);
    console.log('  Grade Levels Length:', school.gradeLevels?.length);
    console.log('  Settings:', school.settings);
    console.log('  Created:', school.createdAt);
    console.log('  Updated:', school.updatedAt);
    
    if (school.gradeLevels && school.gradeLevels.length > 0) {
      console.log('\n📋 Available Grade Levels:');
      school.gradeLevels.forEach((grade, index) => {
        console.log(`  ${index + 1}. ${grade}`);
      });
    } else {
      console.log('\n❌ No grade levels configured for this school');
    }
    
    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
    
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.disconnect();
  }
}

checkHunululuSchoolDetails();
