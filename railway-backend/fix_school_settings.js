const mongoose = require('mongoose');
const School = require('./models/School');
require('dotenv').config();

async function fixSchoolSettings() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    // Find test school 10
    const school = await School.findOne({ name: { $regex: /test school 10/i } });
    if (!school) {
      console.log('❌ Test School 10 not found');
      return;
    }
    
    console.log('🏫 Found school:', school.name, '(ID:', school._id, ')');
    console.log('📊 Current Annually dueDay:', school.settings?.reportFrequencies?.Annually?.dueDay);
    
    // Fix the Annually dueDay setting
    // 615 should be June 15th, but the format should be MMDD
    // Let's set it to June 15th (615) or change it to a more reasonable date like December 15th (1215)
    
    const updatedSettings = {
      ...school.settings,
      reportFrequencies: {
        ...school.settings.reportFrequencies,
        Annually: {
          ...school.settings.reportFrequencies.Annually,
          dueDay: 1215, // December 15th (MMDD format)
          dueTime: "17:00",
          skipWeekends: false,
          skipHolidays: false
        }
      }
    };
    
    // Update the school settings
    const updatedSchool = await School.findByIdAndUpdate(
      school._id,
      { settings: updatedSettings },
      { new: true }
    );
    
    console.log('✅ Updated school settings');
    console.log('📊 New Annually dueDay:', updatedSchool.settings?.reportFrequencies?.Annually?.dueDay);
    
    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');
    
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.disconnect();
  }
}

fixSchoolSettings();
