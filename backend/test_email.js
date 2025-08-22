require('dotenv').config();
const { sendReportEmail, testEmailConfiguration } = require('./services/emailService');

async function testEmail() {
  console.log('🧪 Testing Email Configuration...');
  
  // Test email configuration
  const configTest = await testEmailConfiguration();
  console.log('Configuration Test:', configTest);
  
  if (!configTest.success) {
    console.log('❌ Email configuration failed. Please check your EMAIL_USER and EMAIL_PASSWORD environment variables.');
    console.log('For Gmail, you need to:');
    console.log('1. Enable 2-factor authentication');
    console.log('2. Generate an App Password');
    console.log('3. Use the App Password in EMAIL_PASSWORD');
    return;
  }
  
  console.log('✅ Email configuration is valid!');
  
  // Test sending an email
  console.log('\n📧 Testing Email Sending...');
  
  try {
    const emailData = {
      parentEmail: 'test@example.com', // Change this to a real email for testing
      studentName: 'John Doe',
      teacherName: 'Jane Smith',
      reportTitle: 'Progress Report - Q1 2024',
      reportContent: `This is a test report content with **bold formatting** and multiple heading levels.

# Academic Performance
The student has shown **excellent progress** in all subjects, particularly in:

## Mathematics
- Outstanding performance in problem-solving
- **Strong analytical skills** demonstrated consistently

## Science
- **Remarkable improvement** in experimental skills
- Excellent understanding of scientific concepts

## Language Arts
- *Good reading comprehension* and writing skills
- **Creative expression** in written assignments

# Social Development
The student demonstrates **strong leadership** qualities and works well with peers.

## Communication Skills
- **Effective verbal communication** with teachers and peers
- Active participation in group discussions

## Teamwork
- **Collaborative approach** to group projects
- Helps other students when needed

# Areas for Growth
While performing well overall, the student could benefit from **additional practice** in time management.

## Time Management
- Could improve **organization skills**
- Needs better **planning for long-term projects**

# Additional Notes
This section demonstrates the **hierarchy of headings**:
- # Main Headers (larger, with bottom border)
- ## Sub Headers (medium, with left border)`,
      reportDate: 'January 15, 2024',
      schoolName: 'Barrana.ai Test School',
      schoolId: '689258fea3636b8af5e8f765' // Add a test school ID
    };
    
    const result = await sendReportEmail(emailData);
    console.log('✅ Email sent successfully!');
    console.log('Message ID:', result.messageId);
    
  } catch (error) {
    console.log('❌ Email sending failed:', error.message);
  }
}

testEmail().catch(console.error); 