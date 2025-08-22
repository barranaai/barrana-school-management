// Test script to trigger frontend due report calculation
const axios = require('axios');

async function testFrontendDueReports() {
  try {
    console.log('🧪 Testing Frontend Due Reports via API');
    
    // First, get the auth token (you'll need to login first)
    const loginResponse = await axios.post('http://localhost:5050/api/auth/login', {
      email: 'rph1@example.com', // Replace with actual teacher email
      password: 'password123'     // Replace with actual password
    });
    
    const token = loginResponse.data.token;
    console.log('✅ Logged in successfully');
    
    // Test the due status endpoint for a specific student and template
    const studentId = '68a4c8eb10d4f62e24396546'; // First student
    const templateId = '68a4ca1810d4f62e243966b8'; // Infant Daily template
    
    const dueStatusResponse = await axios.get(`http://localhost:5050/api/reports/due-status?studentId=${studentId}&templateId=${templateId}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log('Due status response:', dueStatusResponse.data);
    
    // Test the debug endpoint
    const debugResponse = await axios.post('http://localhost:5050/api/reports/debug-due-calculations', {
      studentId: studentId,
      templateId: templateId,
      frontendCalculations: {
        due: true,
        timezone: 'Asia/Karachi',
        frequency: 'Daily',
        dueDate: new Date().toISOString(),
        now: new Date().toISOString(),
        daysOverdue: 1
      }
    }, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log('Debug response:', debugResponse.data);
    
  } catch (error) {
    console.error('❌ Error:', error.response?.data || error.message);
  }
}

testFrontendDueReports();
