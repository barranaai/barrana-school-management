// Test script to simulate email sending from StudentManagement form
const axios = require('axios');

const API_BASE_URL = 'http://191.101.233.56/api';

async function testFormEmailProcess() {
  console.log('🧪 TESTING FORM EMAIL PROCESS');
  console.log('=' .repeat(50));
  console.log('📧 Simulating email send from StudentManagement form');
  console.log('🌐 Server: http://191.101.233.56');
  console.log('');
  
  try {
    // Step 1: Login as school admin to get authentication token
    console.log('1. 🔐 Authenticating as school admin...');
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
    console.log('👤 User:', loginResponse.data.data?.user?.firstName || 'Unknown', loginResponse.data.data?.user?.lastName || '');
    console.log('🏫 School:', loginResponse.data.data?.user?.schoolId?.name || 'Unknown');
    
    // Step 2: Get teachers to check canEmailReports permission
    console.log('\n2. 👨‍🏫 Checking teacher permissions...');
    const teachersResponse = await axios.get(`${API_BASE_URL}/teachers`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (!teachersResponse.data.success) {
      throw new Error('Failed to fetch teachers: ' + (teachersResponse.data.message || 'Unknown error'));
    }
    
    const teachers = teachersResponse.data.data;
    const currentTeacher = teachers.find(t => t.email === 'faranarshad.sj@gmail.com');
    
    if (currentTeacher) {
      console.log('✅ Teacher found:', currentTeacher.firstName, currentTeacher.lastName);
      console.log('📧 canEmailReports:', currentTeacher.canEmailReports);
      
      if (!currentTeacher.canEmailReports) {
        console.log('⚠️  Teacher does not have email permissions - this would disable the "Send to Parents" button');
      }
    } else {
      console.log('⚠️  Current user not found in teachers list');
    }
    
    // Step 3: Get all reports to find one to test with
    console.log('\n3. 📊 Fetching reports...');
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
    
    // Find a report that hasn't been sent yet (status !== 'sent')
    let testReport = reports.find(report => report.status !== 'sent');
    if (!testReport) {
      testReport = reports[0]; // Use first report if all are sent
      console.log('⚠️  All reports are already sent, using first report for testing');
    }
    
    console.log(`📋 Selected Report: ${testReport.title}`);
    console.log(`👨‍🎓 Student: ${testReport.studentId?.firstName || 'Unknown'} ${testReport.studentId?.lastName || ''}`);
    console.log(`👨‍🏫 Teacher: ${testReport.teacherId?.firstName || 'Unknown'} ${testReport.teacherId?.lastName || ''}`);
    console.log(`📅 Created: ${new Date(testReport.createdAt).toLocaleString()}`);
    console.log(`📊 Status: ${testReport.status}`);
    
    // Step 4: Check if report has parent email
    console.log('\n4. 📧 Checking parent email...');
    const studentResponse = await axios.get(`${API_BASE_URL}/students/${testReport.studentId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    let parentEmail = 'faranarshad.sj@gmail.com'; // Default test email
    
    if (studentResponse.data.success) {
      const student = studentResponse.data.data;
      parentEmail = student.parentEmail || 'faranarshad.sj@gmail.com';
      console.log('✅ Student found:', student.firstName, student.lastName);
      console.log('📧 Parent email:', parentEmail);
    } else {
      console.log('⚠️  Could not fetch student details, using default email');
    }
    
    // Step 5: Test the exact email sending process from the form
    console.log('\n5. 📨 Testing email sending process (simulating form submission)...');
    
    // First, check if the report needs to be approved
    if (testReport.status === 'draft' || testReport.status === 'completed') {
      console.log('🔄 Report needs approval first...');
      const approveResponse = await axios.put(`${API_BASE_URL}/reports/${testReport._id}/approve`, {
        approvalNote: 'Auto-approved for testing'
      }, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (approveResponse.data.success) {
        console.log('✅ Report approved successfully');
      } else {
        console.log('⚠️  Report approval failed:', approveResponse.data.message);
      }
    }
    
    // Now send the email (this is what the "Send to Parents" button does)
    console.log('📤 Sending email to parents...');
    const emailResponse = await axios.post(`${API_BASE_URL}/reports/${testReport._id}/send-email`, {
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
      console.log(`   📰 Report: ${testReport.title}`);
      console.log(`   👨‍🎓 Student: ${testReport.studentId?.firstName || 'Unknown'} ${testReport.studentId?.lastName || ''}`);
      console.log(`   👨‍🏫 Teacher: ${testReport.teacherId?.firstName || 'Unknown'} ${testReport.teacherId?.lastName || ''}`);
      console.log(`   📧 Recipient: ${parentEmail}`);
      console.log(`   📎 Media Attachments: ${testReport.attachments?.length || 0}`);
      
      // Step 6: Check if report status was updated
      console.log('\n6. 🔄 Checking if report status was updated...');
      try {
        const updatedReportResponse = await axios.get(`${API_BASE_URL}/reports/${testReport._id}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (updatedReportResponse.data.success) {
          const updatedReport = updatedReportResponse.data.data;
          console.log(`📊 Updated report status: ${updatedReport.status}`);
          if (updatedReport.sentAt) {
            console.log(`📅 Sent at: ${new Date(updatedReport.sentAt).toLocaleString()}`);
          }
        }
      } catch (statusError) {
        console.log('⚠️  Could not check report status (this is normal for some endpoints)');
      }
      
      console.log('\n🎉 FORM EMAIL TEST COMPLETED SUCCESSFULLY!');
      console.log('📧 Please check your email for the test report');
      console.log('🔧 This simulates the exact process from the StudentManagement form');
      
    } else {
      console.log('❌ Email failed to send');
      console.log('Error:', emailResponse.data.error || 'Unknown error');
      
      // Additional debugging
      console.log('\n🔍 DEBUGGING INFORMATION:');
      console.log('Response status:', emailResponse.status);
      console.log('Response data:', JSON.stringify(emailResponse.data, null, 2));
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
testFormEmailProcess();
