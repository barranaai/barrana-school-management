const axios = require('axios');

async function testAPILogin() {
  const API_BASE = 'http://localhost:5050/api';
  
  console.log('🔍 TESTING API LOGIN ENDPOINTS');
  console.log('===============================\n');
  
  // Test cases
  const testCases = [
    {
      name: 'Super Admin',
      email: 'alex.chen@barrana.ai',
      password: 'demo123',
      role: 'super_admin'
    },
    {
      name: 'Teacher - Emily',
      email: 'emily.rodriguez@barranaischool.edu',
      password: 'demo123',
      role: 'teacher'
    },
    {
      name: 'School Admin',
      email: 'sarah.johnson@barranaischool.edu',
      password: 'demo123',
      role: 'school_admin'
    },
    {
      name: 'Wrong Password',
      email: 'emily.rodriguez@barranaischool.edu',
      password: 'wrongpassword',
      role: 'teacher'
    }
  ];
  
  for (const testCase of testCases) {
    console.log(`Testing: ${testCase.name}`);
    console.log(`Email: ${testCase.email}`);
    
    try {
      const response = await axios.post(`${API_BASE}/auth/login`, {
        email: testCase.email,
        password: testCase.password
      });
      
      if (response.data.success) {
        console.log('✅ Login successful');
        console.log(`   User: ${response.data.data.user.firstName} ${response.data.data.user.lastName}`);
        console.log(`   Role: ${response.data.data.user.role}`);
        console.log(`   Token: ${response.data.data.token.substring(0, 30)}...`);
        
        // Test using the token
        const tokenTest = await axios.get(`${API_BASE}/auth/me`, {
          headers: {
            Authorization: `Bearer ${response.data.data.token}`
          }
        });
        
        if (tokenTest.data.success) {
          console.log('✅ Token verification successful');
        } else {
          console.log('❌ Token verification failed');
        }
        
      } else {
        console.log('❌ Login failed:', response.data.message);
      }
      
    } catch (error) {
      if (error.response) {
        console.log('❌ Login failed:', error.response.data.message);
        console.log(`   Status: ${error.response.status}`);
      } else if (error.code === 'ECONNREFUSED') {
        console.log('❌ Connection refused - Backend server not running');
        return;
      } else {
        console.log('❌ Network error:', error.message);
      }
    }
    
    console.log('─────────────────────────────────────\n');
  }
  
  // Test rate limiting
  console.log('🚀 TESTING RATE LIMITING (5 rapid requests)');
  const rapidRequests = [];
  
  for (let i = 0; i < 5; i++) {
    rapidRequests.push(
      axios.post(`${API_BASE}/auth/login`, {
        email: 'emily.rodriguez@barranaischool.edu',
        password: 'demo123'
      }).catch(err => ({
        error: true,
        status: err.response?.status,
        message: err.response?.data?.message
      }))
    );
  }
  
  const rapidResults = await Promise.all(rapidRequests);
  rapidResults.forEach((result, index) => {
    if (result.error) {
      console.log(`Request ${index + 1}: ❌ ${result.status} - ${result.message}`);
    } else {
      console.log(`Request ${index + 1}: ✅ Success`);
    }
  });
  
  console.log('\n✅ API TESTING COMPLETE');
}

testAPILogin().catch(console.error);
