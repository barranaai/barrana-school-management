const mongoose = require('mongoose');
const School = require('./models/School');
require('dotenv').config();

async function updateSchoolTimezone() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    const schoolId = '68960451f58dff7d009df46e'; // Test School 10
    const school = await School.findById(schoolId);
    
    if (!school) {
      console.log('❌ School not found');
      await mongoose.disconnect();
      return;
    }
    
    console.log('🏫 School found:', school.name);
    console.log('⏰ Current timezone:', school.settings?.timezone || 'Not set');
    
    // Update the timezone to Pakistan Standard Time
    const updateResult = await School.findByIdAndUpdate(
      schoolId,
      {
        $set: {
          'settings.timezone': 'Asia/Karachi' // Pakistan Standard Time
        }
      },
      { new: true }
    );
    
    if (updateResult) {
      console.log('✅ Timezone updated successfully!');
      console.log('⏰ New timezone:', updateResult.settings?.timezone);
      console.log('📅 Updated settings:', JSON.stringify(updateResult.settings, null, 2));
    } else {
      console.log('❌ Failed to update timezone');
    }
    
    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.disconnect();
  }
}

updateSchoolTimezone();
