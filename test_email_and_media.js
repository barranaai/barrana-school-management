// Test script to check email functionality and media attachments in AllReports
const fs = require('fs');

console.log('=== Testing Email and Media Functionality in AllReports.tsx ===\n');

// Read AllReports.tsx and analyze the email functionality
const allReportsContent = fs.readFileSync('./src/components/admin/sections/AllReports.tsx', 'utf8');

// Check email functionality implementation
console.log('1. 📧 EMAIL FUNCTIONALITY ANALYSIS');
console.log('================================\n');

const lines = allReportsContent.split('\n');

// Find the handleSendEmail function
const emailFunctionStart = lines.findIndex(line => line.includes('handleSendEmail'));
const emailFunctionEnd = lines.findIndex((line, idx) => idx > emailFunctionStart && line.includes('}') && !line.includes('{'));

console.log('📍 handleSendEmail Function Location:', `Lines ${emailFunctionStart + 1} - ${emailFunctionEnd + 1}`);

// Extract the email function
const emailFunction = lines.slice(emailFunctionStart, emailFunctionEnd + 10).join('\n');
console.log('\n📋 handleSendEmail Function:');
console.log('─'.repeat(50));
console.log(emailFunction);

// Check media attachment functionality
console.log('\n\n2. 🎭 MEDIA ATTACHMENT ANALYSIS');
console.log('==============================\n');

// Check if media attachments are being loaded
const mediaLoadingCheck = lines.filter(line => 
  line.includes('getReportMedia') || 
  line.includes('media') ||
  line.includes('attachment')
);

console.log('📍 Media-related Code Lines:');
mediaLoadingCheck.forEach((line, idx) => {
  const lineNumber = lines.indexOf(line) + 1;
  console.log(`${lineNumber}: ${line.trim()}`);
});

// Check if email function includes media
const includesMediaInEmail = emailFunction.includes('media') || emailFunction.includes('attachment');
console.log(`\n📊 Email function includes media: ${includesMediaInEmail}`);

// Check backend email service
console.log('\n\n3. 🏗️ BACKEND EMAIL SERVICE ANALYSIS');
console.log('====================================\n');

if (fs.existsSync('./backend/services/emailService.js')) {
  const emailServiceContent = fs.readFileSync('./backend/services/emailService.js', 'utf8');
  
  // Check if email service handles attachments
  const hasAttachments = emailServiceContent.includes('attachment') || emailServiceContent.includes('mailOptions');
  console.log(`📊 Backend email service handles attachments: ${hasAttachments}`);
  
  // Find sendReportEmail function
  const sendReportStart = emailServiceContent.indexOf('sendReportEmail');
  const sendReportSection = emailServiceContent.substring(sendReportStart, sendReportStart + 1000);
  
  console.log('\n📋 Backend sendReportEmail snippet:');
  console.log('─'.repeat(50));
  console.log(sendReportSection.split('\n').slice(0, 20).join('\n'));
} else {
  console.log('❌ Backend email service file not found');
}

// Check backend reports route for email endpoint
console.log('\n\n4. 🛤️ BACKEND EMAIL ROUTE ANALYSIS');
console.log('==================================\n');

if (fs.existsSync('./backend/routes/reports.js')) {
  const reportsRouteContent = fs.readFileSync('./backend/routes/reports.js', 'utf8');
  
  // Find the send-email route
  const emailRouteStart = reportsRouteContent.indexOf('send-email');
  if (emailRouteStart !== -1) {
    const emailRouteSection = reportsRouteContent.substring(emailRouteStart - 200, emailRouteStart + 800);
    
    console.log('📋 Backend send-email route:');
    console.log('─'.repeat(50));
    console.log(emailRouteSection);
    
    // Check if the route includes media attachments
    const routeHasMedia = emailRouteSection.includes('attachment') || emailRouteSection.includes('media');
    console.log(`\n📊 Backend route includes media: ${routeHasMedia}`);
  } else {
    console.log('❌ send-email route not found in backend');
  }
} else {
  console.log('❌ Backend reports route file not found');
}

console.log('\n\n5. 🔍 ISSUES IDENTIFIED');
console.log('======================\n');

const issues = [];

// Check if frontend passes media to email function
if (!emailFunction.includes('media') && !emailFunction.includes('attachment')) {
  issues.push('❌ Frontend handleSendEmail does not pass media attachments to backend');
}

// Check if backend email service supports attachments
if (fs.existsSync('./backend/services/emailService.js')) {
  const emailServiceContent = fs.readFileSync('./backend/services/emailService.js', 'utf8');
  if (!emailServiceContent.includes('attachment')) {
    issues.push('❌ Backend email service does not support media attachments');
  }
}

if (issues.length === 0) {
  console.log('✅ No major issues identified with current implementation');
} else {
  issues.forEach(issue => console.log(issue));
}

console.log('\n\n6. 📋 RECOMMENDATIONS');
console.log('=====================\n');

console.log('1. 🔧 Frontend: Modify handleSendEmail to include media attachments from report.media');
console.log('2. 🔧 Backend: Update email service to support media attachments in mail options');
console.log('3. 🔧 Backend: Modify send-email route to pass media attachments to email service');
console.log('4. 🧪 Testing: Create comprehensive test to verify email with attachments works');
