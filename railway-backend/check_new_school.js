const mongoose = require('mongoose');
const School = require('./models/School');
require('dotenv').config();

async function checkNewSchool() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    // Find the new school
    const school = await School.findOne({ name: 'Repub 1' });
    
    if (school) {
      console.log('✅ School "Repub 1" found!');
      console.log('📋 School details:');
      console.log('  ID:', school._id);
      console.log('  Name:', school.name);
      console.log('  Email:', school.email || 'Not set');
      console.log('  Admin Email:', school.admin?.email || 'Not set');
      console.log('  Timezone:', school.settings?.timezone || 'Not set');
      console.log('  Created:', school.createdAt);
      console.log('  Updated:', school.updatedAt);
      
      // Check if it has default settings
      if (school.settings) {
        console.log('\n⚙️ School Settings:');
        console.log('  Timezone:', school.settings.timezone);
        console.log('  Language:', school.settings.language);
        console.log('  Date Format:', school.settings.dateFormat);
        console.log('  Report Frequencies:', Object.keys(school.settings.reportFrequencies || {}));
      }
    } else {
      console.log('❌ School "Repub 1" not found');
      
      // List all schools to see what's available
      console.log('\n📋 All schools:');
      const allSchools = await School.find({}).select('name email createdAt');
      allSchools.forEach((s, index) => {
        console.log(`${index + 1}. ${s.name} - Created: ${s.createdAt.toISOString().split('T')[0]}`);
      });
    }
    
    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.disconnect();
  }
}

checkNewSchool();
