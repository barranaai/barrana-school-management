const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
require('dotenv').config();

async function testSchoolDataLoading() {
  try {
    console.log('🔍 Testing school data loading...');
    
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    const User = require('./models/User');
    const School = require('./models/School');
    
    // Find the teacher user
    const teacher = await User.findOne({ 
      role: 'teacher',
      email: 'rph1@gmail.com'
    });
    
    if (!teacher) {
      console.log('❌ Teacher not found');
      return;
    }
    
    console.log('👨‍🏫 Teacher found:', {
      id: teacher._id,
      name: `${teacher.firstName} ${teacher.lastName}`,
      email: teacher.email,
      role: teacher.role,
      schoolId: teacher.schoolId
    });
    
    // Get school data directly from database
    const school = await School.findById(teacher.schoolId);
    
    if (!school) {
      console.log('❌ School not found');
      return;
    }
    
    console.log('🏫 School data loaded:', {
      id: school._id,
      name: school.name,
      hasSettings: !!school.settings,
      timezone: school.settings?.timezone,
      hasReportFrequencies: !!school.settings?.reportFrequencies,
      reportFrequenciesCount: school.settings?.reportFrequencies ? Object.keys(school.settings.reportFrequencies).length : 0
    });
    
    // Check if the data has what's needed for due reports calculation
    if (school.settings?.timezone && school.settings?.reportFrequencies) {
      console.log('✅ School data has all required fields for due reports calculation');
      console.log('📊 Timezone:', school.settings.timezone);
      console.log('📊 Report frequencies:', Object.keys(school.settings.reportFrequencies));
    } else {
      console.log('❌ School data missing required fields');
      console.log('  - Timezone:', school.settings?.timezone || 'MISSING');
      console.log('  - Report frequencies:', school.settings?.reportFrequencies ? 'PRESENT' : 'MISSING');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

testSchoolDataLoading();
