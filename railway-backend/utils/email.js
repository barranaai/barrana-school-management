const nodemailer = require('nodemailer');
const { logger } = require('./logger');

// Create transporter
const createTransporter = () => {
  return nodemailer.createTransporter({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: process.env.SMTP_PORT === '465', // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
};

// Email templates
const emailTemplates = {
  emailVerification: (data) => ({
    subject: 'Verify Your Email - Barrana.ai',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #1976d2 0%, #dc004e 100%); padding: 20px; text-align: center;">
          <h1 style="color: white; margin: 0;">Barrana.ai</h1>
        </div>
        <div style="padding: 30px; background: #f9f9f9;">
          <h2 style="color: #333;">Hello ${data.name}!</h2>
          <p style="color: #666; line-height: 1.6;">
            Thank you for registering with Barrana.ai. To complete your registration, please verify your email address by clicking the button below:
          </p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${data.verificationUrl}" 
               style="background: #1976d2; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
              Verify Email Address
            </a>
          </div>
          <p style="color: #666; font-size: 14px;">
            If the button doesn't work, you can copy and paste this link into your browser:
          </p>
          <p style="color: #1976d2; font-size: 14px; word-break: break-all;">
            ${data.verificationUrl}
          </p>
          <p style="color: #666; font-size: 14px;">
            This link will expire in 24 hours. If you didn't create an account with Barrana.ai, you can safely ignore this email.
          </p>
        </div>
        <div style="background: #333; color: white; padding: 20px; text-align: center; font-size: 12px;">
          <p>© 2024 Barrana.ai. All rights reserved.</p>
        </div>
      </div>
    `
  }),

  passwordReset: (data) => ({
    subject: 'Password Reset - Barrana.ai',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #1976d2 0%, #dc004e 100%); padding: 20px; text-align: center;">
          <h1 style="color: white; margin: 0;">Barrana.ai</h1>
        </div>
        <div style="padding: 30px; background: #f9f9f9;">
          <h2 style="color: #333;">Hello ${data.name}!</h2>
          <p style="color: #666; line-height: 1.6;">
            You requested a password reset for your Barrana.ai account. Click the button below to reset your password:
          </p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${data.resetUrl}" 
               style="background: #dc004e; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
              Reset Password
            </a>
          </div>
          <p style="color: #666; font-size: 14px;">
            If the button doesn't work, you can copy and paste this link into your browser:
          </p>
          <p style="color: #1976d2; font-size: 14px; word-break: break-all;">
            ${data.resetUrl}
          </p>
          <p style="color: #666; font-size: 14px;">
            This link will expire in 10 minutes. If you didn't request a password reset, you can safely ignore this email.
          </p>
        </div>
        <div style="background: #333; color: white; padding: 20px; text-align: center; font-size: 12px;">
          <p>© 2024 Barrana.ai. All rights reserved.</p>
        </div>
      </div>
    `
  }),

  welcomeSchool: (data) => ({
    subject: 'Welcome to Barrana.ai - Your School is Ready!',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #1976d2 0%, #dc004e 100%); padding: 20px; text-align: center;">
          <h1 style="color: white; margin: 0;">Barrana.ai</h1>
        </div>
        <div style="padding: 30px; background: #f9f9f9;">
          <h2 style="color: #333;">Welcome to Barrana.ai, ${data.schoolName}!</h2>
          <p style="color: #666; line-height: 1.6;">
            Your school has been successfully set up on our AI-powered reporting platform. Here are your login credentials:
          </p>
          <div style="background: white; padding: 20px; border-radius: 5px; margin: 20px 0;">
            <p style="margin: 10px 0;"><strong>Login URL:</strong> ${data.loginUrl}</p>
            <p style="margin: 10px 0;"><strong>Email:</strong> ${data.email}</p>
            <p style="margin: 10px 0;"><strong>Password:</strong> ${data.password}</p>
          </div>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${data.loginUrl}" 
               style="background: #1976d2; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
              Login to Your Dashboard
            </a>
          </div>
          <p style="color: #666; font-size: 14px;">
            For security reasons, we recommend changing your password after your first login.
          </p>
        </div>
        <div style="background: #333; color: white; padding: 20px; text-align: center; font-size: 12px;">
          <p>© 2024 Barrana.ai. All rights reserved.</p>
        </div>
      </div>
    `
  }),

  reportGenerated: (data) => ({
    subject: `New Report Available - ${data.studentName}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #1976d2 0%, #dc004e 100%); padding: 20px; text-align: center;">
          <h1 style="color: white; margin: 0;">Barrana.ai</h1>
        </div>
        <div style="padding: 30px; background: #f9f9f9;">
          <h2 style="color: #333;">New Report Available</h2>
          <p style="color: #666; line-height: 1.6;">
            A new report has been generated for <strong>${data.studentName}</strong> by ${data.teacherName}.
          </p>
          <div style="background: white; padding: 20px; border-radius: 5px; margin: 20px 0;">
            <p style="margin: 10px 0;"><strong>Report Type:</strong> ${data.reportType}</p>
            <p style="margin: 10px 0;"><strong>Generated:</strong> ${data.generatedDate}</p>
            <p style="margin: 10px 0;"><strong>Teacher:</strong> ${data.teacherName}</p>
          </div>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${data.reportUrl}" 
               style="background: #1976d2; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
              View Report
            </a>
          </div>
        </div>
        <div style="background: #333; color: white; padding: 20px; text-align: center; font-size: 12px;">
          <p>© 2024 Barrana.ai. All rights reserved.</p>
        </div>
      </div>
    `
  }),

  subscriptionExpiring: (data) => ({
    subject: 'Subscription Expiring Soon - Barrana.ai',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #1976d2 0%, #dc004e 100%); padding: 20px; text-align: center;">
          <h1 style="color: white; margin: 0;">Barrana.ai</h1>
        </div>
        <div style="padding: 30px; background: #f9f9f9;">
          <h2 style="color: #333;">Subscription Expiring Soon</h2>
          <p style="color: #666; line-height: 1.6;">
            Your Barrana.ai subscription for <strong>${data.schoolName}</strong> will expire on ${data.expiryDate}.
          </p>
          <div style="background: white; padding: 20px; border-radius: 5px; margin: 20px 0;">
            <p style="margin: 10px 0;"><strong>Current Plan:</strong> ${data.currentPlan}</p>
            <p style="margin: 10px 0;"><strong>Expiry Date:</strong> ${data.expiryDate}</p>
            <p style="margin: 10px 0;"><strong>Days Remaining:</strong> ${data.daysRemaining}</p>
          </div>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${data.billingUrl}" 
               style="background: #1976d2; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
              Renew Subscription
            </a>
          </div>
          <p style="color: #666; font-size: 14px;">
            To avoid service interruption, please renew your subscription before the expiry date.
          </p>
        </div>
        <div style="background: #333; color: white; padding: 20px; text-align: center; font-size: 12px;">
          <p>© 2024 Barrana.ai. All rights reserved.</p>
        </div>
      </div>
    `
  })
};

// Send email function
const sendEmail = async ({ email, subject, html, text, template, data }) => {
  try {
    const transporter = createTransporter();

    let emailContent = {};

    if (template && data) {
      emailContent = emailTemplates[template](data);
    } else {
      emailContent = {
        subject: subject,
        html: html,
        text: text
      };
    }

    const mailOptions = {
      from: `"Barrana.ai" <${process.env.SMTP_USER}>`,
      to: email,
      subject: emailContent.subject,
      html: emailContent.html,
      text: emailContent.text || emailContent.html.replace(/<[^>]*>/g, '')
    };

    const info = await transporter.sendMail(mailOptions);
    
    logger.info(`Email sent successfully to ${email}: ${info.messageId}`);
    
    return {
      success: true,
      messageId: info.messageId
    };

  } catch (error) {
    logger.error('Email sending failed:', error);
    throw new Error(`Failed to send email: ${error.message}`);
  }
};

// Send bulk emails
const sendBulkEmail = async (emails, options) => {
  const results = [];
  
  for (const email of emails) {
    try {
      const result = await sendEmail({ ...options, email });
      results.push({ email, success: true, ...result });
    } catch (error) {
      results.push({ email, success: false, error: error.message });
    }
  }
  
  return results;
};

// Verify email configuration
const verifyEmailConfig = async () => {
  try {
    const transporter = createTransporter();
    await transporter.verify();
    logger.info('Email configuration verified successfully');
    return true;
  } catch (error) {
    logger.error('Email configuration verification failed:', error);
    return false;
  }
};

module.exports = {
  sendEmail,
  sendBulkEmail,
  verifyEmailConfig,
  emailTemplates
}; 