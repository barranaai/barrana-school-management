const mongoose = require('mongoose');
const School = require('./models/School');
require('dotenv').config();

async function checkAllSchools() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    // Find all schools
    const schools = await School.find({}).sort({ createdAt: -1 });
    
    console.log(`🏫 All schools in database (${schools.length} found):`);
    
    if (schools.length === 0) {
      console.log('❌ No schools found in database');
    } else {
      schools.forEach((school, index) => {
        console.log(`\n  ${index + 1}. ${school.name}`);
        console.log('     ID:', school._id);
        console.log('     Slug:', school.slug);
        console.log('     Type:', school.schoolType);
        console.log('     Created:', school.createdAt);
        console.log('     Active:', school.isActive);
        console.log('     Timezone:', school.settings?.timezone || 'Not set');
      });
    }
    
    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
    
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.disconnect();
  }
}

checkAllSchools();
