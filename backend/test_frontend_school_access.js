const axios = require('axios');
require('dotenv').config();

async function testFrontendSchoolAccess() {
  try {
    console.log('🔍 Testing frontend school data access...');
    
    // The token from the browser localStorage (you can copy this from browser dev tools)
    const token = 'eyJhbGciOiJlUzI1NilsInR5cCl6lkpXVCJ9.eyJpZCI6IjY4YTRINDI4M2M3ZjA1OTQ3YjIxZCIsImVtYWlsljoicnBoMUBnbWFpbC5jb20iLCJyb2xlljoidGVhY2hlciIsInNjaG9vbElkIjoiNjhhNGIwYzA0MjgzYzdmMDU5NDdiMTVlIiwiaWF0IjoxNzM0NzE5NzIxLCJleHAiOjE3MzQ4MDUxMjF9';
    
    console.log('🔐 Using token:', token.substring(0, 50) + '...');
    
    // Test the school API endpoint
    const schoolId = '68a4b0c04283c7f05947b15e';
    const url = `http://localhost:5050/api/schools/${schoolId}`;
    
    console.log('🌐 Making API call to:', url);
    
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
        reportFrequenciesCount: response.data.data?.settings?.reportFrequencies ? Object.keys(response.data.data.settings.reportFrequencies).length : 0
      });
      
      // Check if the data has what's needed for due reports calculation
      const schoolData = response.data.data;
      if (schoolData) {
        console.log('🔍 School data analysis:');
        console.log('  - Has settings:', !!schoolData.settings);
        console.log('  - Has timezone:', !!schoolData.settings?.timezone);
        console.log('  - Has reportFrequencies:', !!schoolData.settings?.reportFrequencies);
        console.log('  - Timezone value:', schoolData.settings?.timezone);
        console.log('  - Report frequencies count:', schoolData.settings?.reportFrequencies ? Object.keys(schoolData.settings.reportFrequencies).length : 0);
        
        if (schoolData.settings?.timezone && schoolData.settings?.reportFrequencies) {
          console.log('✅ School data has all required fields for due reports calculation');
        } else {
          console.log('❌ School data missing required fields');
        }
      }
      
    } catch (error) {
      console.log('❌ API call failed');
      console.log('📊 Error status:', error.response?.status);
      console.log('📊 Error message:', error.response?.data?.message);
      console.log('📊 Error data:', error.response?.data);
      
      if (error.response?.status === 401) {
        console.log('🔐 Authentication issue - token may be invalid or expired');
        console.log('💡 Try getting a fresh token from the browser');
      } else if (error.response?.status === 403) {
        console.log('🚫 Authorization issue - teacher still not authorized');
      } else if (error.response?.status === 404) {
        console.log('🔍 Not found - endpoint or school not found');
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testFrontendSchoolAccess();
