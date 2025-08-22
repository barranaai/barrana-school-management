const mongoose = require('mongoose');
const School = require('./models/School');
require('dotenv').config();

async function checkWeeklySettings() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    const schoolId = '68960451f58dff7d009df46e'; // Test School 10
    const school = await School.findById(schoolId).select('settings');
    
    console.log('🏫 School:', school.name);
    console.log('⚙️  School settings:', JSON.stringify(school.settings, null, 2));
    
    const weeklyConfig = school.settings?.reportFrequencies?.Weekly;
    console.log('📅 Weekly config:', weeklyConfig);
    
    if (weeklyConfig) {
      console.log('📅 Weekly due day:', weeklyConfig.dueDay);
      console.log('📅 Weekly due time:', weeklyConfig.dueTime);
      console.log('📅 Weekly enabled:', weeklyConfig.enabled);
    }
    
    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.disconnect();
  }
}

checkWeeklySettings();
