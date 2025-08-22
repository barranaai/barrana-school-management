const mongoose = require('mongoose');
const User = require('./models/User');
const School = require('./models/School');
require('dotenv').config();

async function checkTeacherSchool() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    // Find the teacher
    const teacher = await User.findById('689604bef58dff7d009df4ba').populate('schoolId');
    if (!teacher) {
      console.log('❌ Teacher not found');
      return;
    }
    
    console.log('👨‍🏫 Teacher:', teacher.firstName, teacher.lastName);
    console.log('🏫 School:', teacher.schoolId ? teacher.schoolId.name : 'No school assigned');
    console.log('🏫 School ID:', teacher.schoolId ? teacher.schoolId._id : 'N/A');
    
    if (teacher.schoolId) {
      console.log('📊 School Settings:');
      console.log('  - Report Frequencies:', JSON.stringify(teacher.schoolId.settings?.reportFrequencies, null, 2));
      console.log('  - Due Day Settings:', JSON.stringify(teacher.schoolId.settings?.dueDaySettings, null, 2));
      
      // Check if settings exist
      if (!teacher.schoolId.settings) {
        console.log('⚠️  No school settings found - this might cause due date issues');
      }
      
      if (!teacher.schoolId.settings?.reportFrequencies) {
        console.log('⚠️  No report frequencies configured - this will cause due date issues');
      }
    }
    
    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.disconnect();
  }
}

checkTeacherSchool();
