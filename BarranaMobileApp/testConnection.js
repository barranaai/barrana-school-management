const axios = require('axios');

const API_BASE_URL = 'http://localhost:5050/api';

async function testConnection() {
  console.log('🧪 Testing Mobile App Connection to Backend...\n');

  try {
    // Test 1: Health check
    console.log('1. Testing health endpoint...');
    const healthResponse = await axios.get(`${API_BASE_URL}/health`);
    console.log('✅ Health check passed:', healthResponse.data.status);
    console.log('   Server uptime:', Math.round(healthResponse.data.uptime / 60), 'minutes');
    console.log('   Environment:', healthResponse.data.environment);
    console.log('');

    // Test 2: Teacher login
    console.log('2. Testing teacher authentication...');
    const teacherLoginResponse = await axios.post(`${API_BASE_URL}/auth/login`, {
      email: 'teacher@demo.com',
      password: 'demo12345'
    });
    
    if (teacherLoginResponse.data.success) {
      console.log('✅ Teacher login successful');
      console.log('   User:', teacherLoginResponse.data.data.user.firstName, teacherLoginResponse.data.data.user.lastName);
      console.log('   Role:', teacherLoginResponse.data.data.user.role);
      console.log('   Token received:', teacherLoginResponse.data.data.token ? 'Yes' : 'No');
    } else {
      console.log('❌ Teacher login failed');
    }
    console.log('');

    // Test 3: Parent login
    console.log('3. Testing parent authentication...');
    const parentLoginResponse = await axios.post(`${API_BASE_URL}/auth/login`, {
      email: 'parent@demo.com',
      password: 'demo12345'
    });
    
    if (parentLoginResponse.data.success) {
      console.log('✅ Parent login successful');
      console.log('   User:', parentLoginResponse.data.data.user.firstName, parentLoginResponse.data.data.user.lastName);
      console.log('   Role:', parentLoginResponse.data.data.user.role);
      console.log('   Token received:', parentLoginResponse.data.data.token ? 'Yes' : 'No');
    } else {
      console.log('❌ Parent login failed');
    }
    console.log('');

    // Test 4: Get current user with token
    console.log('4. Testing authenticated endpoint...');
    const token = teacherLoginResponse.data.data.token;
    const userResponse = await axios.get(`${API_BASE_URL}/auth/me`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (userResponse.data.success) {
      console.log('✅ Authenticated endpoint working');
      console.log('   Current user:', userResponse.data.data.user.firstName, userResponse.data.data.user.lastName);
    } else {
      console.log('❌ Authenticated endpoint failed');
    }
    console.log('');

    console.log('🎉 All tests passed! The mobile app should be able to connect to the backend successfully.');
    console.log('\n📱 You can now run the mobile app with:');
    console.log('   npm start');
    console.log('\n🔑 Test credentials:');
    console.log('   Teacher: teacher@demo.com / demo12345');
    console.log('   Parent: parent@demo.com / demo12345');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response) {
      console.error('   Response status:', error.response.status);
      console.error('   Response data:', error.response.data);
    }
  }
}

testConnection(); 