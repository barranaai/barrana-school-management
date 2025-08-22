const axios = require('axios');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
require('dotenv').config();

async function testFrontendApiCall() {
  try {
    console.log('🔍 Testing frontend API call simulation...');
    
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    const User = require('./models/User');
    
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
    
    // Generate a valid JWT token for this teacher
    const token = jwt.sign(
      { 
        id: teacher._id,
        email: teacher.email,
        role: teacher.role,
        schoolId: teacher.schoolId
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    console.log('🔐 Generated token:', token.substring(0, 50) + '...');
    
    // Test the exact API call the frontend makes
    const schoolId = teacher.schoolId.toString();
    const url = `http://localhost:5050/api/schools/${schoolId}`;
    
    console.log('🌐 Making API call to:', url);
    console.log('🔑 Using token:', token.substring(0, 50) + '...');
    
    try {
      const response = await axios.get(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });
      
      console.log('✅ API call successful!');
      console.log('📊 Response status:', response.status);
      console.log('📊 Response data:', {
        success: response.data.success,
        schoolName: response.data.data?.name,
        timezone: response.data.data?.settings?.timezone,
        hasReportFrequencies: !!response.data.data?.settings?.reportFrequencies,
        reportFrequencies: response.data.data?.settings?.reportFrequencies
      });
      
      // Check if the school data has the required fields for due reports calculation
      const schoolData = response.data.data;
      if (schoolData) {
        console.log('🔍 School data analysis:');
        console.log('  - Has settings:', !!schoolData.settings);
        console.log('  - Has timezone:', !!schoolData.settings?.timezone);
        console.log('  - Has reportFrequencies:', !!schoolData.settings?.reportFrequencies);
        console.log('  - Timezone value:', schoolData.settings?.timezone);
        console.log('  - Report frequencies count:', schoolData.settings?.reportFrequencies?.length || 0);
        
        if (schoolData.settings?.reportFrequencies) {
          console.log('  - Report frequencies:', schoolData.settings.reportFrequencies.map(f => f.frequency));
        }
      }
      
    } catch (error) {
      console.log('❌ API call failed');
      console.log('📊 Error status:', error.response?.status);
      console.log('📊 Error message:', error.response?.data?.message);
      console.log('📊 Error data:', error.response?.data);
      
      if (error.response?.status === 401) {
        console.log('🔐 Authentication issue - token may be invalid or expired');
      } else if (error.response?.status === 403) {
        console.log('🚫 Authorization issue - teacher still not authorized');
      } else if (error.response?.status === 404) {
        console.log('🔍 Not found - endpoint or school not found');
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

testFrontendApiCall();
