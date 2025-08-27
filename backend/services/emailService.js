const nodemailer = require('nodemailer');
const { logger } = require('../utils/logger');
const { getSchoolLogo } = require('./logoService');

// Create transporter (you can configure this based on your email provider)
const createTransporter = () => {
  // Check if email credentials are configured
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
    logger.warn('Email credentials not configured. Using mock email service for development.');
    return null;
  }
  
  // For development, you can use Gmail or other providers
  // For production, consider using services like SendGrid, AWS SES, etc.
  
  return nodemailer.createTransport({
    service: 'gmail', // or 'outlook', 'yahoo', etc.
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD, // Use app password for Gmail
    },
  });
};

// Helper function to convert markdown-style formatting to HTML
const formatReportContent = (content) => {
  if (!content) return '';
  
  let formattedContent = content;
  
  // Convert lines starting with ## to sub-headers (medium size, bold)
  formattedContent = formattedContent.replace(/^##\s+(.+)$/gm, '<h4 style="font-size: 1.1em; font-weight: bold; color: #4a5568; margin: 12px 0 8px 0; border-left: 3px solid #764ba2; padding-left: 10px;">$1</h4>');
  
  // Convert lines starting with # to main headers (larger size, bold, with bottom border)
  formattedContent = formattedContent.replace(/^#\s+(.+)$/gm, '<h3 style="font-size: 1.3em; font-weight: bold; color: #2d3748; margin: 18px 0 12px 0; border-bottom: 2px solid #667eea; padding-bottom: 8px;">$1</h3>');
  
  // Convert **text** to <strong>text</strong> for bold formatting
  formattedContent = formattedContent.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  
  // Convert *text* to <em>text</em> for italic formatting (if needed)
  formattedContent = formattedContent.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  
  // Convert line breaks to HTML
  formattedContent = formattedContent.replace(/\n/g, '<br>');
  
  return formattedContent;
};

// Email templates
const createWelcomeEmailTemplate = (data) => {
  const {
    schoolName,
    contactPersonName,
    contactPersonEmail,
    loginCredentials,
    dashboardUrl
  } = data;

  return {
    subject: `Welcome to Barrana.ai - Your School Dashboard is Ready!`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome to Barrana.ai</title>
        <style>
          body { 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
            line-height: 1.6; 
            color: #333; 
            margin: 0; 
            padding: 0; 
            background-color: #f5f5f5;
          }
          .container { 
            max-width: 600px; 
            margin: 0 auto; 
            background-color: #ffffff;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          }
          .header { 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
            color: white; 
            padding: 40px 30px; 
            text-align: center;
            position: relative;
            overflow: hidden;
          }
          .header::before {
            content: '';
            position: absolute;
            top: -50%;
            left: -50%;
            width: 200%;
            height: 200%;
            background: radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%);
            animation: float 6s ease-in-out infinite;
          }
          @keyframes float {
            0%, 100% { transform: translateY(0px) rotate(0deg); }
            50% { transform: translateY(-20px) rotate(180deg); }
          }
          .logo {
            font-size: 2.5em;
            font-weight: bold;
            margin-bottom: 10px;
            position: relative;
            z-index: 1;
          }
          .tagline {
            font-size: 1.1em;
            opacity: 0.9;
            margin-bottom: 20px;
            position: relative;
            z-index: 1;
          }
          .content { 
            padding: 40px 30px; 
            background: #ffffff;
          }
          .welcome-section {
            text-align: center;
            margin-bottom: 30px;
          }
          .welcome-title {
            font-size: 2em;
            color: #2d3748;
            margin-bottom: 15px;
            font-weight: 600;
          }
          .school-name {
            color: #667eea;
            font-weight: bold;
            font-size: 1.3em;
          }
          .credentials-box {
            background: linear-gradient(135deg, #f7fafc 0%, #edf2f7 100%);
            border: 2px solid #e2e8f0;
            border-radius: 12px;
            padding: 25px;
            margin: 25px 0;
            position: relative;
          }
          .credentials-box::before {
            content: '🔐';
            position: absolute;
            top: -15px;
            left: 20px;
            background: white;
            padding: 5px 10px;
            border-radius: 20px;
            font-size: 1.2em;
            border: 2px solid #667eea;
          }
          .credential-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin: 12px 0;
            padding: 10px 0;
            border-bottom: 1px solid #e2e8f0;
          }
          .credential-item:last-child {
            border-bottom: none;
          }
          .credential-label {
            font-weight: 600;
            color: #4a5568;
          }
          .credential-value {
            font-family: 'Courier New', monospace;
            background: #2d3748;
            color: #48bb78;
            padding: 8px 12px;
            border-radius: 6px;
            font-weight: bold;
            font-size: 0.9em;
          }
          .cta-button {
            display: inline-block;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            text-decoration: none;
            padding: 15px 30px;
            border-radius: 25px;
            font-weight: bold;
            font-size: 1.1em;
            margin: 20px 0;
            transition: all 0.3s ease;
            box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
          }
          .cta-button:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 20px rgba(102, 126, 234, 0.6);
          }
          .features-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            margin: 30px 0;
          }
          .feature-item {
            text-align: center;
            padding: 20px;
            background: #f8f9fa;
            border-radius: 10px;
            border-left: 4px solid #667eea;
          }
          .feature-icon {
            font-size: 2em;
            margin-bottom: 10px;
          }
          .feature-title {
            font-weight: bold;
            color: #2d3748;
            margin-bottom: 5px;
          }
          .feature-desc {
            font-size: 0.9em;
            color: #718096;
          }
          .footer { 
            text-align: center; 
            margin-top: 30px; 
            color: #666; 
            font-size: 12px;
            padding: 20px;
            background: #f8f9fa;
            border-top: 1px solid #e2e8f0;
          }
          .highlight { 
            color: #667eea; 
            font-weight: bold; 
          }
          .security-note {
            background: #fff5f5;
            border: 1px solid #fed7d7;
            border-radius: 8px;
            padding: 15px;
            margin: 20px 0;
            color: #c53030;
            font-size: 0.9em;
          }
          .next-steps {
            background: #f0fff4;
            border: 1px solid #9ae6b4;
            border-radius: 8px;
            padding: 20px;
            margin: 25px 0;
          }
          .next-steps h3 {
            color: #22543d;
            margin-top: 0;
            margin-bottom: 15px;
          }
          .next-steps ul {
            margin: 0;
            padding-left: 20px;
          }
          .next-steps li {
            margin: 8px 0;
            color: #2f855a;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">🎓 Barrana.ai</div>
            <div class="tagline">Empowering Education Through AI</div>
          </div>
          
          <div class="content">
            <div class="welcome-section">
              <h1 class="welcome-title">Welcome to Barrana.ai!</h1>
              <p>Dear <span class="highlight">${contactPersonName}</span>,</p>
              <p>Congratulations! Your school <span class="school-name">${schoolName}</span> has been successfully registered with Barrana.ai. We're excited to help you transform your educational experience with our AI-powered school management platform.</p>
            </div>
            
            <div class="credentials-box">
              <h3 style="margin-top: 0; color: #2d3748;">Your Login Credentials</h3>
              <div class="credential-item">
                <span class="credential-label">Email Address:</span>
                <span class="credential-value">${loginCredentials.email}</span>
              </div>
              <div class="credential-item">
                <span class="credential-label">Password:</span>
                <span class="credential-value">${loginCredentials.password}</span>
              </div>
            </div>
            
            <div style="text-align: center;">
              <a href="${dashboardUrl}" class="cta-button">
                🚀 Access Your School Dashboard
              </a>
            </div>
            
            <div class="security-note">
              <strong>🔒 Security Note:</strong> Please change your password after your first login for enhanced security.
            </div>
            
            <div class="features-grid">
              <div class="feature-item">
                <div class="feature-icon">📊</div>
                <div class="feature-title">AI-Powered Reports</div>
                <div class="feature-desc">Generate comprehensive student reports with intelligent insights</div>
              </div>
              <div class="feature-item">
                <div class="feature-icon">👥</div>
                <div class="feature-title">Student Management</div>
                <div class="feature-desc">Efficiently manage student records and progress tracking</div>
              </div>
              <div class="feature-item">
                <div class="feature-icon">📚</div>
                <div class="feature-title">Class Management</div>
                <div class="feature-desc">Organize classes, schedules, and curriculum planning</div>
              </div>
              <div class="feature-item">
                <div class="feature-icon">📱</div>
                <div class="feature-title">Mobile Access</div>
                <div class="feature-desc">Access your dashboard from any device, anywhere</div>
              </div>
            </div>
            
            <div class="next-steps">
              <h3>🎯 Next Steps to Get Started:</h3>
              <ul>
                <li><strong>Login to your dashboard</strong> using the credentials above</li>
                <li><strong>Complete your school profile</strong> with additional details</li>
                <li><strong>Invite teachers</strong> to join your school platform</li>
                <li><strong>Add students</strong> to your school database</li>
                <li><strong>Generate your first AI report</strong> to see the magic in action</li>
              </ul>
            </div>
            
            <p style="text-align: center; margin-top: 30px;">
              <strong>Need Help?</strong> Our support team is here to assist you every step of the way.<br>
              Contact us at <span class="highlight">support@barrana.ai</span>
            </p>
          </div>
          
          <div class="footer">
            <p><strong>Barrana.ai</strong> - Transforming Education Through Artificial Intelligence</p>
            <p>This is an automated welcome message. Please do not reply to this email.</p>
            <p>© 2024 Barrana.ai. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
Welcome to Barrana.ai - Your School Dashboard is Ready!

Dear ${contactPersonName},

Congratulations! Your school ${schoolName} has been successfully registered with Barrana.ai. We're excited to help you transform your educational experience with our AI-powered school management platform.

Your Login Credentials:
- Email Address: ${loginCredentials.email}
- Password: ${loginCredentials.password}

Access Your School Dashboard: ${dashboardUrl}

🔒 Security Note: Please change your password after your first login for enhanced security.

🎯 Next Steps to Get Started:
1. Login to your dashboard using the credentials above
2. Complete your school profile with additional details
3. Invite teachers to join your school platform
4. Add students to your school database
5. Generate your first AI report to see the magic in action

Need Help? Our support team is here to assist you every step of the way.
Contact us at support@barrana.ai

---
Barrana.ai - Transforming Education Through Artificial Intelligence
This is an automated welcome message. Please do not reply to this email.
© 2024 Barrana.ai. All rights reserved.
    `
  };
};

const createReportEmailTemplate = async (data) => {
  const {
    studentName,
    teacherName,
    reportTitle,
    reportContent,
    reportDate,
    schoolName,
    schoolId
  } = data;

  // Format the report content
  const formattedContent = formatReportContent(reportContent);

  // Get school logo if available
  let logoHtml = '';
  if (schoolId) {
    const logoUrl = await getSchoolLogo(schoolId);
    if (logoUrl) {
      // Convert relative URL to absolute URL for email
      const baseUrl = process.env.BASE_URL || 'http://localhost:5050';
      const absoluteLogoUrl = `${baseUrl}${logoUrl}`;
      logoHtml = `
        <div style="text-align: center; margin-bottom: 15px;">
          <img src="${absoluteLogoUrl}" alt="${schoolName || 'School Logo'}" style="max-height: 60px; max-width: 200px; object-fit: contain;">
        </div>
      `;
    }
  }

  return {
    subject: `Student Report: ${studentName} - ${reportTitle}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Student Report</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0; }
          .content { background: #f8f9fa; padding: 20px; border-radius: 0 0 8px 8px; }
          .report-content { background: white; padding: 15px; border-radius: 5px; margin: 15px 0; border-left: 4px solid #667eea; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
          .highlight { color: #667eea; font-weight: bold; }
          .report-content strong { color: #2d3748; font-weight: 700; }
          .report-content em { color: #4a5568; font-style: italic; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            ${logoHtml}
            <h1>📊 Student Report</h1>
            <p><strong>${schoolName || 'Barrana.ai School'}</strong></p>
          </div>
          
          <div class="content">
            <h2>Dear Parent/Guardian,</h2>
            
            <p>We are pleased to share the latest report for your child, <span class="highlight">${studentName}</span>.</p>
            
            <div style="background: #e8f4fd; padding: 15px; border-radius: 5px; margin: 15px 0;">
              <p><strong>Report Details:</strong></p>
              <ul>
                <li><strong>Student:</strong> ${studentName}</li>
                <li><strong>Teacher:</strong> ${teacherName}</li>
                <li><strong>Report Title:</strong> ${reportTitle}</li>
                <li><strong>Date:</strong> ${reportDate}</li>
              </ul>
            </div>
            
            <h3>Report Content:</h3>
            <div class="report-content">
              ${formattedContent}
            </div>
            
            <p>If you have any questions about this report, please don't hesitate to contact your child's teacher or the school administration.</p>
            
            <p>Best regards,<br>
            <strong>${schoolName || 'Barrana.ai School'}</strong></p>
          </div>
          
          <div class="footer">
            <p>This is an automated message from the Barrana.ai School Management System.</p>
            <p>Please do not reply to this email. Contact the school directly for any inquiries.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
Student Report: ${studentName}

Dear Parent/Guardian,

We are pleased to share the latest report for your child, ${studentName}.

Report Details:
- Student: ${studentName}
- Teacher: ${teacherName}
- Report Title: ${reportTitle}
- Date: ${reportDate}

Report Content:
${reportContent.replace(/^#{1,2}\s+/gm, '').replace(/\*\*(.*?)\*\*/g, '$1').replace(/\*([^*]+)\*/g, '$1')}

If you have any questions about this report, please don't hesitate to contact your child's teacher or the school administration.

Best regards,
${schoolName || 'Barrana.ai School'}

---
This is an automated message from the Barrana.ai School Management System.
Please do not reply to this email. Contact the school directly for any inquiries.
    `
  };
};

// Send welcome email to new school
const sendWelcomeEmail = async (emailData) => {
  try {
    const transporter = createTransporter();
    
    if (!transporter) {
      // Mock email service for development when credentials are not configured
      logger.info('Mock email service: Welcome email would be sent in production', {
        to: emailData.contactPersonEmail,
        subject: `Welcome to Barrana.ai - Your School Dashboard is Ready!`,
        schoolName: emailData.schoolName,
        contactPersonName: emailData.contactPersonName
      });
      
      return {
        success: true,
        messageId: `mock-welcome-${Date.now()}`,
        message: 'Welcome email sent successfully (mock service)'
      };
    }

    const { contactPersonEmail, schoolName, contactPersonName, loginCredentials, dashboardUrl } = emailData;

    if (!contactPersonEmail) {
      throw new Error('Contact person email address is required');
    }

    const emailTemplate = createWelcomeEmailTemplate({
      schoolName,
      contactPersonName,
      contactPersonEmail,
      loginCredentials,
      dashboardUrl
    });

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: contactPersonEmail,
      subject: emailTemplate.subject,
      html: emailTemplate.html,
      text: emailTemplate.text
    };

    const result = await transporter.sendMail(mailOptions);
    
    logger.info(`Welcome email sent successfully to ${contactPersonEmail} for school ${schoolName}`);
    
    return {
      success: true,
      messageId: result.messageId,
      message: 'Welcome email sent successfully'
    };

  } catch (error) {
    logger.error('Error sending welcome email:', error);
    throw new Error(`Failed to send welcome email: ${error.message}`);
  }
};

// Send report email to parent
const sendReportEmail = async (emailData) => {
  try {
    const transporter = createTransporter();
    
    if (!transporter) {
      // Mock email service for development when credentials are not configured
      logger.info('Mock email service: Email would be sent in production', {
        to: emailData.parentEmail,
        subject: `Student Report: ${emailData.studentName} - ${emailData.reportTitle}`,
        studentName: emailData.studentName,
        teacherName: emailData.teacherName
      });
      
      return {
        success: true,
        messageId: `mock-${Date.now()}`,
        message: 'Email sent successfully (mock service)'
      };
    }

    const { parentEmail, studentName, teacherName, reportTitle, reportContent, reportDate, schoolName, schoolId } = emailData;

    if (!parentEmail) {
      throw new Error('Parent email address is required');
    }

    const emailTemplate = await createReportEmailTemplate({
      studentName,
      teacherName,
      reportTitle,
      reportContent,
      reportDate,
      schoolName,
      schoolId
    });

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: parentEmail,
      subject: emailTemplate.subject,
      html: emailTemplate.html,
      text: emailTemplate.text
    };

    // Add media attachments if provided
    if (emailData.mediaAttachments && emailData.mediaAttachments.length > 0) {
      mailOptions.attachments = emailData.mediaAttachments.map(media => ({
        filename: media.originalName || media.filename,
        path: media.path || `./uploads/media/${media.filename}`,
        contentType: media.mimeType
      }));
      
      logger.info(`Adding ${emailData.mediaAttachments.length} media attachments to email`);
    }

    const result = await transporter.sendMail(mailOptions);
    
    logger.info(`Email sent successfully to ${parentEmail} for student ${studentName}`);
    
    return {
      success: true,
      messageId: result.messageId,
      message: 'Email sent successfully'
    };

  } catch (error) {
    logger.error('Error sending email:', error);
    throw new Error(`Failed to send email: ${error.message}`);
  }
};

// Test email configuration
const testEmailConfiguration = async () => {
  try {
    const transporter = createTransporter();
    
    if (!transporter) {
      return { success: true, message: 'Mock email service active (no credentials configured)' };
    }

    await transporter.verify();
    return { success: true, message: 'Email configuration is valid' };

  } catch (error) {
    logger.error('Email configuration test failed:', error);
    return { success: false, message: `Email configuration error: ${error.message}` };
  }
};

module.exports = {
  sendReportEmail,
  sendWelcomeEmail,
  testEmailConfiguration
}; 