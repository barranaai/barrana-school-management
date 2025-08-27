// Comprehensive test for email functionality with media attachments
const axios = require('axios');

const API_BASE_URL = 'http://191.101.233.56/api';

async function testEmailFunctionality() {
  console.log('🧪 TESTING EMAIL FUNCTIONALITY WITH MEDIA ATTACHMENTS');
  console.log('=' .repeat(60));
  
  try {
    // Step 1: Login as admin to get authentication token
    console.log('\n1. 🔐 Authenticating as admin...');
    const loginResponse = await axios.post(`${API_BASE_URL}/auth/login`, {
      email: 'faranarshad.sj@gmail.com',
      password: 'Password123'
    });
    
    if (!loginResponse.data.success) {
      throw new Error('Failed to login');
    }
    
    const token = loginResponse.data.token;
    console.log('✅ Authentication successful');
    
    // Step 2: Get all reports to find one with media attachments
    console.log('\n2. 📊 Fetching reports to find one with media attachments...');
    const reportsResponse = await axios.get(`${API_BASE_URL}/reports?includeCrossTeacher=true`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (!reportsResponse.data.success) {
      throw new Error('Failed to fetch reports');
    }
    
    const reports = reportsResponse.data.data;
    console.log(`📈 Found ${reports.length} reports`);
    
    // Find a report with attachments
    let reportWithMedia = null;
    for (const report of reports) {
      try {
        const mediaResponse = await axios.get(`${API_BASE_URL}/reports/${report._id}/media`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (mediaResponse.data.success && mediaResponse.data.data.length > 0) {
          reportWithMedia = {
            ...report,
            media: mediaResponse.data.data
          };
          break;
        }
      } catch (error) {
        // Continue searching if this report doesn't have media
      }
    }
    
    if (!reportWithMedia) {
      console.log('⚠️  No reports with media attachments found. Testing with a report without media...');
      reportWithMedia = reports[0];
      reportWithMedia.media = [];
    } else {
      console.log(`📎 Found report with ${reportWithMedia.media.length} media attachment(s)`);
      reportWithMedia.media.forEach((media, idx) => {
        console.log(`   ${idx + 1}. ${media.originalName} (${media.mimeType}, ${media.size} bytes)`);
      });
    }
    
    // Step 3: Get student information to find parent email
    console.log('\n3. 👨‍👩‍👧‍👦 Checking student parent email...');
    const studentResponse = await axios.get(`${API_BASE_URL}/students/${reportWithMedia.studentId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    let parentEmail = 'test@example.com'; // Fallback email for testing
    if (studentResponse.data.success && studentResponse.data.data.parentEmail) {
      parentEmail = studentResponse.data.data.parentEmail;
      console.log(`📧 Parent email found: ${parentEmail}`);
    } else {
      console.log(`⚠️  No parent email found, using test email: ${parentEmail}`);
    }
    
    // Step 4: Test the email sending functionality
    console.log('\n4. 📨 Testing email send functionality...');
    const emailResponse = await axios.post(`${API_BASE_URL}/reports/${reportWithMedia._id}/send-email`, {
      parentEmail: parentEmail
    }, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    console.log('\n📊 EMAIL SEND RESULT:');
    console.log('─'.repeat(40));
    console.log('Success:', emailResponse.data.success);
    console.log('Message:', emailResponse.data.message);
    
    if (emailResponse.data.success) {
      console.log('✅ Email sent successfully!');
      
      // Log details about what was sent
      console.log('\n📋 EMAIL DETAILS:');
      console.log(`   📰 Report: ${reportWithMedia.title}`);
      console.log(`   👨‍🎓 Student: ${reportWithMedia.studentId?.firstName || 'Unknown'} ${reportWithMedia.studentId?.lastName || ''}`);
      console.log(`   👨‍🏫 Teacher: ${reportWithMedia.teacherId?.firstName || 'Unknown'} ${reportWithMedia.teacherId?.lastName || ''}`);
      console.log(`   📧 Recipient: ${parentEmail}`);
      console.log(`   📎 Media Attachments: ${reportWithMedia.media?.length || 0}`);
      
      if (reportWithMedia.media && reportWithMedia.media.length > 0) {
        console.log('\n📎 ATTACHED FILES:');
        reportWithMedia.media.forEach((media, idx) => {
          console.log(`   ${idx + 1}. ${media.originalName}`);
          console.log(`      Type: ${media.mimeType}`);
          console.log(`      Size: ${Math.round(media.size / 1024)} KB`);
        });
      }
      
    } else {
      console.log('❌ Email failed to send');
      console.log('Error:', emailResponse.data.error || 'Unknown error');
    }
    
    // Step 5: Check report status update
    console.log('\n5. 🔄 Checking if report status was updated...');
    const updatedReportResponse = await axios.get(`${API_BASE_URL}/reports/${reportWithMedia._id}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (updatedReportResponse.data.success) {
      const updatedReport = updatedReportResponse.data.data;
      console.log(`📊 Updated report status: ${updatedReport.status}`);
      if (updatedReport.sentAt) {
        console.log(`📅 Sent at: ${new Date(updatedReport.sentAt).toLocaleString()}`);
      }
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
testEmailFunctionality();
