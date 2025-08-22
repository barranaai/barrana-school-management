const mongoose = require('mongoose');
const School = require('./models/School');
require('dotenv').config();

async function checkRepub1Timezone() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    const school = await School.findOne({ name: 'Repub 1' });
    
    if (!school) {
      console.log('❌ School "Repub 1" not found');
      await mongoose.disconnect();
      return;
    }
    
    console.log('🏫 School "Repub 1" found:');
    console.log('  ID:', school._id);
    console.log('  Name:', school.name);
    console.log('  Current timezone:', school.settings?.timezone || 'Not set (defaults to UTC)');
    console.log('  Created:', school.createdAt);
    console.log('  Updated:', school.updatedAt);
    
    if (school.settings) {
      console.log('\n📋 School Settings:');
      console.log('  Timezone:', school.settings.timezone || 'Not set');
      console.log('  Report Frequencies:', school.settings.reportFrequencies ? 'Configured' : 'Not configured');
    } else {
      console.log('\n❌ No settings found for this school');
    }
    
    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
    
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.disconnect();
  }
}

checkRepub1Timezone();
