const nodemailer = require('nodemailer');
const path = require('path');
const fs = require('fs');
const { logger } = require('../utils/logger');
const { getSchoolLogo } = require('./logoService');
const notificationLogger = require('./notificationLogger');

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
    schoolId,
    schoolBranding
  } = data;

  // Extract branding colors with fallbacks
  const primaryColor = schoolBranding?.primaryColor || '#667eea';
  const secondaryColor = schoolBranding?.secondaryColor || '#dc004e';

  // Format the report content
  const formattedContent = formatReportContent(reportContent);

  // Get school logo if available - will be attached as CID
  let logoHtml = '';
  let logoAttachment = null;
  
  if (schoolId) {
    const logoUrl = await getSchoolLogo(schoolId);
    if (logoUrl) {
      try {
        const fs = require('fs');
        const path = require('path');
        const logoPath = path.join(__dirname, '..', logoUrl);
        
        if (fs.existsSync(logoPath)) {
          // Use CID (Content-ID) reference for logo
          logoHtml = `
            <div style="text-align: center; margin-bottom: 15px;">
              <img src="cid:school-logo" alt="${schoolName || 'School Logo'}" style="max-height: 60px; max-width: 200px; object-fit: contain;">
            </div>
          `;
          
          // Prepare logo as CID attachment
          const logoExt = path.extname(logoPath).toLowerCase();
          const mimeType = logoExt === '.png' ? 'image/png' : logoExt === '.jpg' || logoExt === '.jpeg' ? 'image/jpeg' : 'image/png';
          
          logoAttachment = {
            filename: `school-logo${logoExt}`,
            path: logoPath,
            cid: 'school-logo',
            contentType: mimeType
          };
        }
      } catch (error) {
        logger.warn('Error loading logo for email:', error.message);
      }
    }
  }

  return {
    subject: `${schoolName || 'School'}: ${reportTitle} - ${studentName}`,
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Student Report</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.8; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%); color: white; padding: 25px; border-radius: 8px 8px 0 0; text-align: center; }
          .content { background: #f8f9fa; padding: 30px 25px; border-radius: 0 0 8px 8px; }
          .footer { text-align: center; margin-top: 20px; padding-top: 20px; border-top: 1px solid #dee2e6; color: #666; font-size: 12px; }
          .highlight { color: ${primaryColor}; font-weight: bold; }
          .info-box { background: #e8f4fd; padding: 18px; border-radius: 8px; margin: 20px 0; border-left: 4px solid ${primaryColor}; }
          .attachment-notice { background: #d4edda; border: 1px solid #c3e6cb; color: #155724; padding: 15px; border-radius: 8px; margin: 20px 0; text-align: center; font-weight: 600; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            ${logoHtml}
            <h1 style="margin: 10px 0 5px 0; font-size: 28px;">📊 Student Report</h1>
            <p style="margin: 0; font-size: 16px;"><strong>${schoolName || 'Barrana.ai School'}</strong></p>
          </div>
          
          <div class="content">
            <h2 style="color: #2d3748; margin-bottom: 15px;">Dear Parent/Guardian,</h2>
            
            <p style="font-size: 15px; margin-bottom: 15px;">We are pleased to share the latest report for your child, <span class="highlight">${studentName}</span>.</p>
            
            <div class="info-box">
              <p style="margin: 0 0 10px 0;"><strong>Report Details:</strong></p>
              <ul style="margin: 0; padding-left: 20px;">
                <li style="margin-bottom: 5px;"><strong>Student:</strong> ${studentName}</li>
                <li style="margin-bottom: 5px;"><strong>Teacher:</strong> ${teacherName}</li>
                <li style="margin-bottom: 5px;"><strong>Report Title:</strong> ${reportTitle}</li>
                <li style="margin-bottom: 0;"><strong>Date:</strong> ${reportDate}</li>
              </ul>
            </div>
            
            <div class="attachment-notice">
              📎 The complete report is attached as a PDF document.
            </div>
            
            <p style="font-size: 14px; line-height: 1.7;">The attached PDF contains detailed information about your child's progress, activities, and observations. Please review it at your convenience.</p>
            
            <p style="font-size: 14px; line-height: 1.7;">If you have any questions or would like to discuss this report further, please don't hesitate to contact ${teacherName} or the school administration.</p>
            
            <p style="margin-top: 25px; font-size: 15px;">Best regards,<br>
            <strong>${teacherName}</strong><br>
            <span style="color: #666;">${schoolName || 'Barrana.ai School'}</span></p>
          </div>
          
          <div class="footer">
            <p style="margin: 5px 0;">This is an automated message from the Barrana.ai School Management System.</p>
            <p style="margin: 5px 0;">Please do not reply to this email. Contact the school directly for any inquiries.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
${schoolName || 'School'}: ${reportTitle} - ${studentName}

Dear Parent/Guardian,

We are pleased to share the latest report for your child, ${studentName}.

Report Details:
- Student: ${studentName}
- Teacher: ${teacherName}
- Report Title: ${reportTitle}
- Date: ${reportDate}

The complete report is attached as a PDF document.

The attached PDF contains detailed information about your child's progress, activities, and observations. Please review it at your convenience.

If you have any questions or would like to discuss this report further, please don't hesitate to contact ${teacherName} or the school administration.

Best regards,
${teacherName}
${schoolName || 'Barrana.ai School'}

---
This is an automated message from the Barrana.ai School Management System.
Please do not reply to this email. Contact the school directly for any inquiries.
    `,
    logoAttachment
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
  let pdfPath = null;
  
  try {
    const transporter = createTransporter();
    
    if (!transporter) {
      // Mock email service for development when credentials are not configured
      logger.info('Mock email service: Email would be sent in production', {
        to: emailData.parentEmail,
        subject: `Student Report: ${emailData.studentName} - ${emailData.reportTitle}`,
        studentName: emailData.studentName,
        teacherName: emailData.teacherName,
        attachmentsCount: emailData.attachments?.length || 0
      });
      
      return {
        success: true,
        messageId: `mock-${Date.now()}`,
        message: 'Email sent successfully (mock service)'
      };
    }

    const { parentEmail, studentName, teacherName, reportTitle, reportContent, reportDate, schoolName, schoolId, attachments, reportId, schoolLogo } = emailData;

    // Get school branding data
    let schoolBranding = null;
    if (schoolId) {
      try {
        const School = require('../models/School');
        const school = await School.findById(schoolId).select('branding');
        if (school && school.branding) {
          schoolBranding = school.branding;
        }
      } catch (error) {
        logger.warn('Error fetching school branding, using defaults:', error.message);
      }
    }

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
      schoolId,
      schoolBranding
    });

    // Generate PDF for the report
    const pdfService = require('./pdfService');
    let pdfInfo = null;
    
    try {
      logger.info(`[EMAIL-PDF] Step 1: Starting PDF generation for report: "${reportTitle}", student: "${studentName}"`);
      logger.info(`[EMAIL-PDF] schoolLogo provided: ${schoolLogo || 'none'}`);
      logger.info(`[EMAIL-PDF] reportContent length: ${reportContent ? reportContent.length : 0} chars`);
      
      pdfInfo = await pdfService.generateReportPDF({
        studentName,
        teacherName,
        reportTitle,
        reportContent,
        reportDate,
        schoolName,
        schoolLogo,
        reportId,
        schoolBranding
      });
      pdfPath = pdfInfo.path;
      
      logger.info(`[EMAIL-PDF] Step 2: PDF generated successfully`);
      logger.info(`[EMAIL-PDF]   filename: ${pdfInfo.filename}`);
      logger.info(`[EMAIL-PDF]   path: ${pdfPath}`);
      logger.info(`[EMAIL-PDF]   size: ${pdfInfo.size} bytes`);
      logger.info(`[EMAIL-PDF]   file exists check: ${fs.existsSync(pdfPath)}`);
    } catch (pdfError) {
      logger.error(`[EMAIL-PDF] FAILED to generate PDF: ${pdfError.message}`, { stack: pdfError.stack });
      // Continue sending email without PDF if generation fails
    }

    // Process attachments - convert URLs to file paths
    const emailAttachments = [];
    
    // Add logo as CID attachment (inline, not shown as attachment)
    if (emailTemplate.logoAttachment) {
      emailAttachments.push(emailTemplate.logoAttachment);
      logger.info('[EMAIL-PDF] Step 3a: School logo added as inline CID attachment');
    }
    
    // Add PDF as attachment
    if (pdfInfo && pdfPath) {
      const pdfExists = fs.existsSync(pdfPath);
      logger.info(`[EMAIL-PDF] Step 3b: pdfInfo exists=${!!pdfInfo}, pdfPath=${pdfPath}, file exists=${pdfExists}`);
      if (pdfExists) {
        emailAttachments.push({
          filename: pdfInfo.filename,
          path: pdfPath,
          contentType: 'application/pdf',
          contentDisposition: 'attachment'
        });
        logger.info(`[EMAIL-PDF] Step 3c: PDF added to attachments list - ${pdfInfo.filename}`);
      } else {
        logger.error(`[EMAIL-PDF] PDF file not found on disk at: ${pdfPath}`);
      }
    } else {
      logger.warn(`[EMAIL-PDF] Step 3b: No PDF to attach - pdfInfo=${!!pdfInfo}, pdfPath=${pdfPath}`);
    }
    
    // Add media attachments
    if (attachments && Array.isArray(attachments) && attachments.length > 0) {
      for (const att of attachments) {
        try {
          // Convert relative URL to absolute file path
          const filePath = path.join(__dirname, '..', att.url);
          
          // Check if file exists
          if (fs.existsSync(filePath)) {
            emailAttachments.push({
              filename: att.originalName || att.filename,
              path: filePath,
              contentType: att.mimeType
            });
            logger.info(`Media attachment added to email: ${att.originalName || att.filename}`);
          } else {
            logger.warn(`Attachment file not found: ${filePath}`);
          }
        } catch (error) {
          logger.error(`Error processing attachment: ${att.filename}`, error);
        }
      }
    }

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: parentEmail,
      subject: emailTemplate.subject,
      html: emailTemplate.html,
      text: emailTemplate.text,
      attachments: emailAttachments
    };

    logger.info(`[EMAIL-PDF] Step 4: Preparing to send email to ${parentEmail}`);
    logger.info(`[EMAIL-PDF]   Total attachments: ${emailAttachments.length}`);
    emailAttachments.forEach((att, i) => {
      logger.info(`[EMAIL-PDF]   Attachment[${i}]: filename=${att.filename}, contentType=${att.contentType}, cid=${att.cid || 'none'}`);
    });
    logger.info(`Sending email with ${emailAttachments.length} attachment(s) to ${parentEmail}`);

    const result = await transporter.sendMail(mailOptions);
    
    logger.info(`Email sent successfully to ${parentEmail} for student ${studentName}`, {
      attachmentsCount: emailAttachments.length,
      pdfIncluded: !!pdfInfo,
      messageId: result.messageId
    });
    
    // Log to notification system
    await notificationLogger.logEmail({
      schoolId: emailData.schoolId,
      type: 'report',
      recipientId: emailData.parentId,
      recipientName: emailData.parentName || 'Parent',
      recipientEmail: parentEmail,
      studentId: emailData.studentId,
      studentName: studentName,
      classId: emailData.classId,
      className: emailData.className,
      gradeLevel: emailData.gradeLevel,
      reportId: emailData.reportId,
      reportTitle: reportTitle,
      subject: `Student Report: ${studentName} - ${reportTitle}`,
      messagePreview: emailData.summary || 'Daily report for student',
      status: 'sent',
      sentAt: new Date(),
      providerMessageId: result.messageId,
      hasAttachments: emailAttachments.length > 0,
      attachments: emailAttachments.map(att => ({
        filename: att.filename,
        type: att.contentType
      }))
    });
    
    // Keep PDF for parent access (don't delete)
    if (pdfPath && fs.existsSync(pdfPath)) {
      logger.info(`PDF saved for parent access: ${pdfPath}`);
    }
    
    // Send WhatsApp notification if enabled
    let whatsappResult = null;
    try {
      const whatsappService = require('./whatsappService');
      
      // Check if parent has WhatsApp enabled and phone number
      if (emailData.parentPhoneNumber && emailData.whatsappEnabled) {
        whatsappService.initialize();
        
        if (whatsappService.isAvailable()) {
          whatsappResult = await whatsappService.sendReportNotification({
            student: {
              firstName: studentName.split(' ')[0],
              lastName: studentName.split(' ').slice(1).join(' ')
            },
            parent: {
              email: parentEmail,
              phoneNumber: emailData.parentPhoneNumber
            },
            report: {
              date: reportDate,
              reportType: reportTitle
            },
            schoolName,
            school: emailData.school
          });
          
          if (whatsappResult.success) {
            logger.info(`WhatsApp notification sent to parent: ${emailData.parentPhoneNumber}`);
          } else {
            logger.warn(`WhatsApp notification failed: ${whatsappResult.error}`);
            
            // SMS Fallback: Try SMS if WhatsApp fails and SMS is enabled
            if (emailData.smsEnabled) {
              logger.info(`Trying SMS fallback for ${emailData.parentPhoneNumber}...`);
              try {
                const smsService = require('./smsService');
                smsService.initialize();
                
                const smsResult = await smsService.sendReportNotification({
                  student: {
                    firstName: studentName.split(' ')[0],
                    lastName: studentName.split(' ').slice(1).join(' ')
                  },
                  parent: {
                    email: parentEmail,
                    phoneNumber: emailData.parentPhoneNumber
                  },
                  report: {
                    date: reportDate,
                    reportType: reportTitle
                  },
                  schoolName,
                  school: emailData.school
                });
                
                if (smsResult.success) {
                  logger.info(`✅ SMS fallback successful for ${emailData.parentPhoneNumber}`);
                } else {
                  logger.warn(`SMS fallback also failed: ${smsResult.error}`);
                }
              } catch (smsError) {
                logger.error('SMS fallback error (non-fatal):', smsError);
              }
            }
          }
        }
      }
    } catch (whatsappError) {
      logger.error('WhatsApp notification error (non-fatal):', whatsappError);
      // Don't throw error - WhatsApp is optional
    }
    
    return {
      success: true,
      messageId: result.messageId,
      message: 'Email sent successfully',
      attachmentsIncluded: emailAttachments.length,
      pdfGenerated: !!pdfInfo,
      pdfPath: pdfPath, // Return the PDF path to save in database
      whatsappSent: whatsappResult?.success || false
    };

  } catch (error) {
    logger.error('Error sending email:', error);
    
    // Clean up PDF on error
    if (pdfPath && fs.existsSync(pdfPath)) {
      try {
        fs.unlinkSync(pdfPath);
        logger.info(`Cleaned up PDF after error: ${pdfPath}`);
      } catch (cleanupError) {
        logger.error('Error cleaning up PDF:', cleanupError);
      }
    }
    
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

// Send welcome email to newly created teacher with login credentials
const sendTeacherWelcomeEmail = async ({ teacherEmail, teacherName, temporaryPassword, schoolName, schoolEmail, loginUrl, schoolId, schoolBranding }) => {
  const transporter = createTransporter();
  
  // If transporter is not configured, log and skip
  if (!transporter) {
    logger.info('Email service not configured - skipping teacher welcome email');
    return { success: false, message: 'Email service not configured' };
  }

  try {
    // Extract branding colors with fallbacks
    const primaryColor = schoolBranding?.primaryColor || '#667eea';
    const secondaryColor = schoolBranding?.secondaryColor || '#764ba2';
    
    // Get school logo if available
    let logoHtml = '';
    let logoAttachment = null;
    
    if (schoolId) {
      const logoUrl = await getSchoolLogo(schoolId);
      if (logoUrl) {
        const logoPath = path.join(__dirname, '..', logoUrl);
        if (fs.existsSync(logoPath)) {
          logoAttachment = {
            filename: 'school-logo.png',
            path: logoPath,
            cid: 'schoolLogo'
          };
          logoHtml = `<img src="cid:schoolLogo" alt="${schoolName} Logo" style="max-height: 60px; max-width: 200px; margin-bottom: 15px; object-fit: contain;">`;
        }
      }
    }
    
    const mailOptions = {
      from: `"${schoolName}" <${process.env.EMAIL_USER}>`,
      to: teacherEmail,
      subject: `${schoolName}: Welcome to Your Teacher Account`,
      attachments: logoAttachment ? [logoAttachment] : [],
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Welcome to ${schoolName}</title>
        </head>
        <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f5f5f5;">
          <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
            
            <!-- Header -->
            <div style="background: linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%); color: white; padding: 40px 30px; text-align: center;">
              ${logoHtml}
              <h1 style="margin: 0; font-size: 28px; font-weight: 700; letter-spacing: -0.5px;">
                Welcome to ${schoolName}!
              </h1>
              <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.95;">
                Your teacher account has been created
              </p>
            </div>
            
            <!-- Content -->
            <div style="padding: 40px 30px;">
              <p style="font-size: 16px; margin: 0 0 20px 0;">
                Dear <strong>${teacherName}</strong>,
              </p>
              
              <p style="font-size: 15px; margin: 0 0 25px 0; line-height: 1.7;">
                Welcome to our school! Your teacher account has been created on our school management system. 
                You can now access your dashboard to manage students, create reports, and communicate with parents.
              </p>
              
              <!-- Login Credentials Box -->
              <div style="background: linear-gradient(135deg, #f7fafc 0%, #edf2f7 100%); border-left: 4px solid ${primaryColor}; border-radius: 8px; padding: 25px; margin: 30px 0;">
                <h3 style="margin: 0 0 20px 0; color: #2d3748; font-size: 18px; font-weight: 700;">
                  🔐 Your Login Credentials
                </h3>
                
                <div style="margin-bottom: 15px;">
                  <p style="margin: 0 0 5px 0; color: #718096; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">
                    Login Email:
                  </p>
                  <p style="margin: 0; font-size: 16px; font-weight: 600; color: #2d3748; font-family: 'Courier New', monospace; background: white; padding: 10px 15px; border-radius: 4px; border: 1px solid #e2e8f0;">
                    ${teacherEmail}
                  </p>
                </div>
                
                <div style="margin-bottom: 15px;">
                  <p style="margin: 0 0 5px 0; color: #718096; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">
                    Temporary Password:
                  </p>
                  <p style="margin: 0; font-size: 18px; font-weight: 700; color: ${primaryColor}; font-family: 'Courier New', monospace; background: white; padding: 12px 15px; border-radius: 4px; border: 2px solid ${primaryColor}; letter-spacing: 2px;">
                    ${temporaryPassword}
                  </p>
                </div>
                
                <div style="background: #fff3cd; border-left: 3px solid #ffc107; padding: 12px 15px; border-radius: 4px; margin-top: 20px;">
                  <p style="margin: 0; font-size: 13px; color: #856404; line-height: 1.5;">
                    ⚠️ <strong>Important:</strong> Please change this password after your first login for security purposes.
                  </p>
                </div>
              </div>
              
              <!-- Login Button -->
              <div style="text-align: center; margin: 35px 0;">
                <a href="${loginUrl}/login" 
                   style="display: inline-block; background: linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%); color: white; text-decoration: none; padding: 14px 40px; border-radius: 8px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4); transition: all 0.3s ease;">
                  Login to Dashboard
                </a>
              </div>
              
              <!-- Getting Started -->
              <div style="background: #f7fafc; border-radius: 8px; padding: 25px; margin: 30px 0;">
                <h3 style="margin: 0 0 15px 0; color: #2d3748; font-size: 16px; font-weight: 700;">
                  🚀 Getting Started
                </h3>
                <ul style="margin: 0; padding-left: 20px; color: #4a5568; font-size: 14px; line-height: 1.8;">
                  <li>Login with your credentials above</li>
                  <li>Complete your teacher profile</li>
                  <li>View your assigned students and classes</li>
                  <li>Start creating student reports</li>
                  <li>Communicate with parents through the messaging system</li>
                </ul>
              </div>
              
              <!-- Support -->
              <div style="margin-top: 30px; padding-top: 25px; border-top: 1px solid #e2e8f0;">
                <p style="font-size: 14px; color: #718096; margin: 0 0 10px 0;">
                  If you have any questions or need assistance, please contact:
                </p>
                <p style="font-size: 14px; margin: 0;">
                  📧 <a href="mailto:${schoolEmail}" style="color: ${primaryColor}; text-decoration: none; font-weight: 600;">${schoolEmail}</a>
                </p>
              </div>
            </div>
            
            <!-- Footer -->
            <div style="background: #f7fafc; padding: 25px 30px; text-align: center; border-top: 1px solid #e2e8f0;">
              <p style="margin: 0 0 10px 0; font-size: 14px; color: #718096;">
                <strong>${schoolName}</strong>
              </p>
              <p style="margin: 0; font-size: 12px; color: #a0aec0;">
                Powered by <strong style="color: ${primaryColor};">Barrana.ai</strong> - School Management System
              </p>
            </div>
          </div>
        </body>
        </html>
      `
    };

    const info = await transporter.sendMail(mailOptions);
    
    logger.info('Teacher welcome email sent successfully', {
      to: teacherEmail,
      messageId: info.messageId,
      schoolName: schoolName
    });

    return { success: true, messageId: info.messageId };
  } catch (error) {
    logger.error('Error sending teacher welcome email:', error);
    throw error;
  }
};

module.exports = {
  sendReportEmail,
  sendWelcomeEmail,
  testEmailConfiguration,
  sendTeacherWelcomeEmail
}; 