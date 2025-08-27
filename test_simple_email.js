// Simple email test to check if the email service is working
const axios = require('axios');

const API_BASE_URL = 'http://191.101.233.56/api';

async function testSimpleEmail() {
  console.log('🧪 SIMPLE EMAIL TEST');
  console.log('=' .repeat(50));
  console.log('📧 Testing basic email functionality');
  console.log('🌐 Server: http://191.101.233.56');
  console.log('');
  
  try {
    // Step 1: Login as school admin
    console.log('1. 🔐 Authenticating...');
    const loginResponse = await axios.post(`${API_BASE_URL}/auth/login`, {
      email: 'faranarshad.sj@gmail.com',
      password: 'TestSchool123'
    });
    
    if (!loginResponse.data.success) {
      throw new Error('Failed to login: ' + (loginResponse.data.message || 'Unknown error'));
    }
    
    const token = loginResponse.data.data?.token || loginResponse.data.token || loginResponse.data.accessToken;
    if (!token) {
      throw new Error('No token found in login response');
    }
    
    console.log('✅ Authentication successful');
    
    // Step 2: Get reports
    console.log('\n2. 📊 Fetching reports...');
    const reportsResponse = await axios.get(`${API_BASE_URL}/reports?includeCrossTeacher=true`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (!reportsResponse.data.success) {
      throw new Error('Failed to fetch reports: ' + (reportsResponse.data.message || 'Unknown error'));
    }
    
    const reports = reportsResponse.data.data;
    console.log(`📈 Found ${reports.length} reports`);
    
    if (reports.length === 0) {
      throw new Error('No reports found to test with');
    }
    
    // Use the first report
    const testReport = reports[0];
    console.log(`📋 Using Report: ${testReport.title}`);
    console.log(`📊 Status: ${testReport.status}`);
    
    // Step 3: Test email sending
    console.log('\n3. 📨 Testing email sending...');
    const emailResponse = await axios.post(`${API_BASE_URL}/reports/${testReport._id}/send-email`, {
      parentEmail: 'faranarshad.sj@gmail.com'
    }, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    console.log('\n📊 EMAIL SEND RESULT:');
    console.log('─'.repeat(40));
    console.log('Success:', emailResponse.data.success);
    console.log('Message:', emailResponse.data.message);
    
    if (emailResponse.data.success) {
      console.log('✅ Email sent successfully!');
      console.log('📧 Please check faranarshad.sj@gmail.com for the email');
    } else {
      console.log('❌ Email failed to send');
      console.log('Error:', emailResponse.data.error || 'Unknown error');
      console.log('Full response:', JSON.stringify(emailResponse.data, null, 2));
    }
    
  } catch (error) {
    console.error('\n❌ TEST FAILED:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

// Run the test
testSimpleEmail();
