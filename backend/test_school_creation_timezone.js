const mongoose = require('mongoose');
const School = require('./models/School');
require('dotenv').config();

async function testSchoolCreationTimezone() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    // Test data for school creation
    const testSchoolData = {
      name: 'Test School Timezone',
      slug: 'test-school-timezone-' + Date.now(),
      schoolType: 'licensed_daycare',
      estimatedStudents: 50,
      gradeLevels: ['infant', 'toddler', 'preschool'],
      address: {
        street: '123 Test Street',
        city: 'Test City',
        state: 'Test State',
        zipCode: '12345',
        country: 'Canada'
      },
      contactPerson: {
        name: 'Test Contact',
        email: 'test@timezone.com',
        phone: '123-456-7890',
        role: 'Administrator'
      },
      subscription: {
        plan: 'basic'
      },
      settings: {
        timezone: 'Asia/Karachi'
      },
      isActive: true
    };
    
    console.log('📋 Test school data:');
    console.log(JSON.stringify(testSchoolData, null, 2));
    
    // Create the school
    const school = new School(testSchoolData);
    await school.save();
    
    console.log('\n✅ School created successfully!');
    console.log('  ID:', school._id);
    console.log('  Name:', school.name);
    console.log('  Timezone:', school.settings?.timezone || 'Not set');
    console.log('  Created:', school.createdAt);
    
    // Verify the timezone was saved
    if (school.settings?.timezone === 'Asia/Karachi') {
      console.log('✅ Timezone was successfully saved as Asia/Karachi');
    } else {
      console.log('❌ Timezone was not saved correctly');
      console.log('  Expected: Asia/Karachi');
      console.log('  Actual:', school.settings?.timezone);
    }
    
    // Clean up - delete the test school
    await School.findByIdAndDelete(school._id);
    console.log('\n🧹 Test school deleted for cleanup');
    
    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');
    
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.disconnect();
  }
}

testSchoolCreationTimezone();
