const mongoose = require('mongoose');
const School = require('./models/School');
require('dotenv').config();

async function checkTimezoneIssue() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    // Find the Repub 1 school
    const school = await School.findOne({ name: 'Repub 1' });
    
    if (!school) {
      console.log('❌ School "Repub 1" not found');
      await mongoose.disconnect();
      return;
    }
    
    console.log('🏫 School "Repub 1" found:');
    console.log('  ID:', school._id);
    console.log('  Name:', school.name);
    console.log('  Current timezone:', school.settings?.timezone || 'Not set');
    console.log('  Created:', school.createdAt);
    console.log('  Updated:', school.updatedAt);
    
    // Check the full settings object
    console.log('\n📋 Full settings object:');
    console.log(JSON.stringify(school.settings, null, 2));
    
    // Check if there are any validation errors or issues
    console.log('\n🔍 Settings structure:');
    if (school.settings) {
      console.log('  Settings exists:', !!school.settings);
      console.log('  Timezone field exists:', 'timezone' in school.settings);
      console.log('  Timezone value:', school.settings.timezone);
      console.log('  Settings keys:', Object.keys(school.settings));
    } else {
      console.log('  No settings object found');
    }
    
    // Check the School model schema to understand the structure
    console.log('\n📋 School model structure:');
    const SchoolModel = mongoose.model('School');
    console.log('  Schema paths:', Object.keys(SchoolModel.schema.paths));
    
    // Check if there's a settings path
    if (SchoolModel.schema.paths.settings) {
      console.log('  Settings path exists:', !!SchoolModel.schema.paths.settings);
      console.log('  Settings path type:', SchoolModel.schema.paths.settings.instance);
    }
    
    // Compare with test school 10 which has the correct timezone
    const testSchool = await School.findOne({ name: 'test school 10' });
    if (testSchool) {
      console.log('\n🔍 Comparison with test school 10:');
      console.log('  Test school timezone:', testSchool.settings?.timezone);
      console.log('  Test school settings structure:', Object.keys(testSchool.settings || {}));
    }
    
    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.disconnect();
  }
}

checkTimezoneIssue();
