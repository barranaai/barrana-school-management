const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Create a rotating log file
const getLogFileName = (prefix = 'debug-frontend-backend-discrepancy') => {
  const date = new Date().toISOString().split('T')[0];
  return `${prefix}-${date}.log`;
};

const logFile = path.join(logsDir, getLogFileName());

const log = (level, message, data = null) => {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    level,
    message,
    data
  };

  const logLine = JSON.stringify(logEntry) + '\n';
  
  try {
    fs.appendFileSync(logFile, logLine);
  } catch (error) {
    console.error('Failed to write to log file:', error);
  }
  
  // Also log to console for immediate visibility
  console.log(`[${timestamp}] ${level.toUpperCase()}: ${message}`, data ? JSON.stringify(data, null, 2) : '');
};

async function debugFrontendBackendDiscrepancy() {
  const schoolId = "68a4b0c04283c7f05947b15e"; // Republica of Hunululu
  
  log('info', `Starting frontend-backend discrepancy debug for school: ${schoolId}`);
  
  try {
    log('info', 'Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    log('info', 'Connected to MongoDB successfully');
    
    // Load models
    const User = require('./models/User');
    const Class = require('./models/Class');
    const School = require('./models/School');
    const Report = require('./models/Report');
    const ReportTemplate = require('./models/ReportTemplate');
    
    // Import date utilities
    const { isReportDue, calculateDueDate } = require('./utils/dateUtils');
    
    // Get school details
    log('info', 'Fetching school details');
    const school = await School.findById(schoolId);
    if (!school) {
      log('error', `School not found with ID: ${schoolId}`);
      return;
    }
    
    log('info', 'School details', {
      schoolId: school._id,
      schoolName: school.name,
      timezone: school.settings?.timezone,
      reportFrequencies: school.settings?.reportFrequencies
    });
    
    // Get all students with proper classId relationships
    log('info', 'Fetching students with classId relationships');
    const students = await User.find({ 
      schoolId: schoolId, 
      role: 'parent' 
    }).populate('classId', 'name grade').populate('assignedTeacher', 'firstName lastName email');
    
    log('info', 'Students found', {
      totalStudents: students.length,
      studentsWithClassId: students.filter(s => s.classId).length,
      studentsWithoutClassId: students.filter(s => !s.classId).length
    });
    
    // Get report templates
    log('info', 'Fetching report templates');
    const templates = await ReportTemplate.find({ schoolId: schoolId });
    log('info', 'Report templates found', {
      totalTemplates: templates.length,
      templates: templates.map(t => ({
        id: t._id,
        name: t.name,
        frequency: t.reportFrequency,
        isActive: t.isActive
      }))
    });
    
    // Get existing reports
    log('info', 'Fetching existing reports');
    const existingReports = await Report.find({ 
      schoolId: schoolId 
    }).sort({ createdAt: -1 });
    
    log('info', 'Existing reports found', {
      totalReports: existingReports.length,
      reportsByStudent: existingReports.reduce((acc, report) => {
        const studentId = report.studentId.toString();
        acc[studentId] = (acc[studentId] || 0) + 1;
        return acc;
      }, {})
    });
    
    // Get current time in school timezone
    const timezone = school.settings?.timezone || 'UTC';
    const now = new Date();
    const nowInSchoolTZ = new Date(now.toLocaleString("en-US", {timeZone: timezone}));
    
    log('info', 'Current time calculation', {
      utcTime: now.toISOString(),
      schoolTimezone: timezone,
      schoolTime: nowInSchoolTZ.toISOString(),
      schoolTimeString: nowInSchoolTZ.toString()
    });
    
    // Test backend calculation (what we expect)
    log('info', '=== BACKEND CALCULATION (EXPECTED) ===');
    
    const backendDueReports = [];
    
    for (const student of students) {
      if (!student.classId) continue;
      
      for (const template of templates) {
        if (!template.isActive) continue;
        
        // Get the last report for this student and template
        const lastReport = await Report.findOne({
          studentId: student._id,
          templateId: template._id
        }).sort({ createdAt: -1 });
        
        const lastReportDate = lastReport ? lastReport.createdAt : null;
        
        // Check if report is due using backend logic
        const isDue = isReportDue(template.reportFrequency, school.settings, lastReportDate, nowInSchoolTZ);
        
        if (isDue) {
          const dueDateResult = calculateDueDate(template.reportFrequency, school.settings, lastReportDate);
          
          backendDueReports.push({
            studentId: student._id,
            studentName: `${student.firstName} ${student.lastName}`,
            templateId: template._id,
            templateName: template.name,
            frequency: template.reportFrequency,
            dueDate: dueDateResult.dueDate,
            dueDateTimezone: dueDateResult.timezone,
            lastReportDate: lastReportDate
          });
        }
      }
    }
    
    log('info', 'Backend calculation results', {
      totalDueReports: backendDueReports.length,
      dueReports: backendDueReports.map(dr => ({
        studentName: dr.studentName,
        templateName: dr.templateName,
        frequency: dr.frequency,
        dueDate: dr.dueDate.toISOString()
      }))
    });
    
    // Test frontend API endpoint
    log('info', '=== TESTING FRONTEND API ENDPOINT ===');
    
    try {
      const axios = require('axios');
      
      // Test the due-status endpoint that frontend likely uses
      const dueStatusUrl = 'http://localhost:5050/api/reports/due-status';
      log('info', `Testing due-status endpoint: ${dueStatusUrl}`);
      
      const dueStatusResponse = await axios.get(dueStatusUrl, {
        headers: {
          'Authorization': `Bearer ${process.env.TEST_TOKEN || 'test-token'}`
        },
        timeout: 10000
      });
      
      log('info', 'Due-status API response', {
        status: dueStatusResponse.status,
        data: dueStatusResponse.data
      });
      
    } catch (error) {
      log('error', 'Due-status API test failed', {
        error: error.message,
        status: error.response?.status,
        data: error.response?.data
      });
    }
    
    // Test the check-due endpoint
    try {
      const axios = require('axios');
      
      const checkDueUrl = 'http://localhost:5050/api/reports/check-due';
      log('info', `Testing check-due endpoint: ${checkDueUrl}`);
      
      const checkDueResponse = await axios.get(checkDueUrl, {
        headers: {
          'Authorization': `Bearer ${process.env.TEST_TOKEN || 'test-token'}`
        },
        timeout: 10000
      });
      
      log('info', 'Check-due API response', {
        status: checkDueResponse.status,
        data: checkDueResponse.data
      });
      
    } catch (error) {
      log('error', 'Check-due API test failed', {
        error: error.message,
        status: error.response?.status,
        data: error.response?.data
      });
    }
    
    // Test the reports endpoint that might be used by frontend
    try {
      const axios = require('axios');
      
      const reportsUrl = 'http://localhost:5050/api/reports';
      log('info', `Testing reports endpoint: ${reportsUrl}`);
      
      const reportsResponse = await axios.get(reportsUrl, {
        headers: {
          'Authorization': `Bearer ${process.env.TEST_TOKEN || 'test-token'}`
        },
        timeout: 10000
      });
      
      log('info', 'Reports API response', {
        status: reportsResponse.status,
        dataLength: reportsResponse.data ? Object.keys(reportsResponse.data).length : 0,
        data: reportsResponse.data
      });
      
    } catch (error) {
      log('error', 'Reports API test failed', {
        error: error.message,
        status: error.response?.status,
        data: error.response?.data
      });
    }
    
    // Check if there are any authentication issues
    log('info', '=== AUTHENTICATION ANALYSIS ===');
    
    // Check if the teacher user exists and has proper permissions
    const teacherUser = await User.findOne({ 
      schoolId: schoolId,
      role: 'teacher'
    });
    
    log('info', 'Teacher user found', {
      teacherExists: !!teacherUser,
      teacherDetails: teacherUser ? {
        id: teacherUser._id,
        name: `${teacherUser.firstName} ${teacherUser.lastName}`,
        email: teacherUser.email,
        role: teacherUser.role,
        schoolId: teacherUser.schoolId
      } : null
    });
    
    // Check if students are assigned to this teacher
    const studentsAssignedToTeacher = students.filter(s => s.assignedTeacher);
    log('info', 'Students assigned to teacher', {
      totalStudents: students.length,
      studentsWithAssignedTeacher: studentsAssignedToTeacher.length,
      studentsWithoutAssignedTeacher: students.length - studentsAssignedToTeacher.length
    });
    
    // Check the routes configuration
    log('info', '=== ROUTES CONFIGURATION CHECK ===');
    
    try {
      const routesPath = path.join(__dirname, 'routes', 'reports.js');
      const routesContent = fs.readFileSync(routesPath, 'utf8');
      
      log('info', 'Reports routes file found', {
        fileExists: true,
        fileSize: routesContent.length,
        hasDueStatusRoute: routesContent.includes('/due-status'),
        hasCheckDueRoute: routesContent.includes('/check-due'),
        hasReportsRoute: routesContent.includes('router.get(\'/\'')
      });
      
    } catch (error) {
      log('error', 'Could not read routes file', {
        error: error.message
      });
    }
    
    // Check if there are any middleware issues
    log('info', '=== MIDDLEWARE ANALYSIS ===');
    
    try {
      const authPath = path.join(__dirname, 'middleware', 'auth.js');
      const authContent = fs.readFileSync(authPath, 'utf8');
      
      log('info', 'Auth middleware file found', {
        fileExists: true,
        fileSize: authContent.length,
        hasProtectFunction: authContent.includes('protect'),
        hasAuthorizeFunction: authContent.includes('authorize')
      });
      
    } catch (error) {
      log('error', 'Could not read auth middleware file', {
        error: error.message
      });
    }
    
    // Final analysis
    log('info', '=== FINAL ANALYSIS ===', {
      backendDueReportsCount: backendDueReports.length,
      expectedDueReports: backendDueReports.length,
      frontendShowsDueReports: 0, // Based on screenshot
      discrepancy: backendDueReports.length - 0,
      possibleCauses: [
        'API authentication issues',
        'Frontend not calling correct endpoint',
        'Frontend calculation logic differs from backend',
        'Caching issues in frontend',
        'API response format mismatch'
      ]
    });
    
    // Recommendations
    log('info', '=== RECOMMENDATIONS ===', {
      immediateActions: [
        'Check frontend API calls in browser developer tools',
        'Verify authentication token is being sent correctly',
        'Check if frontend is using correct API endpoint',
        'Compare frontend calculation logic with backend',
        'Clear browser cache and reload',
        'Check for any frontend state management issues'
      ],
      backendActions: [
        'Verify API endpoints are accessible without authentication for testing',
        'Add more detailed logging to API endpoints',
        'Check if CORS is properly configured',
        'Verify response format matches frontend expectations'
      ]
    });
    
  } catch (error) {
    log('error', 'Error in debugFrontendBackendDiscrepancy', {
      error: error.message,
      stack: error.stack
    });
  } finally {
    log('info', 'Disconnecting from MongoDB');
    await mongoose.disconnect();
    log('info', 'Frontend-backend discrepancy debug completed');
  }
}

debugFrontendBackendDiscrepancy();
