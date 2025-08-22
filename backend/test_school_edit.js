const mongoose = require('mongoose');
const School = require('./models/School');
require('dotenv').config();

async function testSchoolEdit() {
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
    
    // Test the update functionality by simulating what the frontend sends
    console.log('\n🔍 Testing school update functionality...');
    
    // Simulate the school data that the frontend sends
    const updateData = {
      name: 'Repub 1',
      schoolType: 'licensed_daycare',
      estimatedStudents: 50,
      gradeLevels: ['Infant', 'Toddler', 'Preschool'],
      contactPerson: {
        name: 'Test Contact',
        email: 'test@repub1.com',
        phone: '123-456-7890',
        role: 'Administrator'
      },
      address: {
        street: '123 Test Street',
        city: 'Test City',
        state: 'Test State',
        zipCode: '12345',
        country: 'Canada'
      },
      subscription: {
        plan: 'basic'
      },
      isActive: true,
      settings: {
        timezone: 'Asia/Karachi' // This should update the timezone
      }
    };
    
    console.log('📋 Update data to be sent:');
    console.log(JSON.stringify(updateData, null, 2));
    
    // Test the update
    const updateResult = await School.findByIdAndUpdate(
      school._id,
      updateData,
      { new: true, runValidators: true }
    );
    
    if (updateResult) {
      console.log('\n✅ School updated successfully!');
      console.log('  New timezone:', updateResult.settings?.timezone);
      console.log('  Updated at:', updateResult.updatedAt);
      
      // Check if the timezone was actually updated
      if (updateResult.settings?.timezone === 'Asia/Karachi') {
        console.log('✅ Timezone was successfully updated to Asia/Karachi');
      } else {
        console.log('❌ Timezone was not updated correctly');
        console.log('  Expected: Asia/Karachi');
        console.log('  Actual:', updateResult.settings?.timezone);
      }
    } else {
      console.log('❌ Failed to update school');
    }
    
    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.disconnect();
  }
}

testSchoolEdit();
