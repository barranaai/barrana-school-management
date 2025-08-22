const axios = require('axios');
const mongoose = require('mongoose');
require('dotenv').config();

async function testSchoolApiAccess() {
  try {
    console.log('🔍 Testing school API access for teachers...');
    
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
      schoolId: teacher.schoolId
    });
    
    // Generate a test token (this would normally come from login)
    // For testing, we'll use a simple approach
    const testToken = 'test-token-for-teacher';
    
    console.log('🌐 Testing school API endpoint...');
    
    try {
      const response = await axios.get(`http://localhost:5050/api/schools/${teacher.schoolId}`, {
        headers: {
          'Authorization': `Bearer ${testToken}`,
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
        hasReportFrequencies: !!response.data.data?.settings?.reportFrequencies
      });
      
    } catch (error) {
      console.log('❌ API call failed');
      console.log('📊 Error status:', error.response?.status);
      console.log('📊 Error message:', error.response?.data?.message);
      
      if (error.response?.status === 401) {
        console.log('🔐 Authentication issue - token may be invalid');
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

testSchoolApiAccess();
