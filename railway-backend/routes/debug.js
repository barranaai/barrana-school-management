const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const { calculateDueDate, isReportDue, getStartOfFrequencyPeriod } = require('../utils/dateUtils');
const { getCurrentDateInTimezone } = require('../utils/dateUtils');
const School = require('../models/School');
const ReportTemplate = require('../models/ReportTemplate');
const Report = require('../models/Report');
const User = require('../models/User');
const loggerUtils = require('../utils/logger');
const logger = loggerUtils.logger;
const moment = require('moment-timezone');

// @desc    Debug due date calculations - compare frontend vs backend
// @route   POST /api/debug/due-calculations
// @access  Private (teacher, school_admin, super_admin)
router.post('/due-calculations', protect, authorize('teacher', 'school_admin', 'super_admin'), async (req, res) => {
  try {
    const { studentId, templateId, frontendCalculations } = req.body;
    
    // Validate required parameters
    if (!studentId || !templateId) {
      return res.status(400).json({
        success: false,
        message: 'studentId and templateId are required'
      });
    }
    
    // Get school and template data
    const school = await School.findById(req.user.schoolId).select('settings name');
    const template = await ReportTemplate.findById(templateId).select('reportFrequency grade name');
    const student = await User.findById(studentId).select('firstName lastName studentGrade');
    
    if (!school || !template || !student) {
      return res.status(404).json({
        success: false,
        message: 'School, template, or student not found'
      });
    }
    
    const settings = school.settings || {};
    const frequency = template.reportFrequency;
    const timezone = settings.timezone || 'UTC';
    const now = getCurrentDateInTimezone(timezone);
    
    // Get last report for this student/template
    const lastReport = await Report.findOne({
      schoolId: req.user.schoolId,
      studentId,
      templateId
    }).sort({ createdAt: -1 }).populate('teacherId', 'firstName lastName');
    
    const lastReportDate = lastReport ? lastReport.createdAt : null;
    
    // Backend calculations
    let backendCalculations = {
      timestamp: now.toISOString(),
      timezone,
      frequency,
      error: null
    };
    
    try {
      const due = isReportDue(frequency, settings, lastReportDate, now.toDate());
      const nextDueResult = calculateDueDate(frequency, settings, now);
      const nextDue = nextDueResult.dueDate;
      const periodStart = getStartOfFrequencyPeriod(frequency, settings, now.toDate());
      
      backendCalculations = {
        ...backendCalculations,
        due,
        nextDueDate: nextDue ? nextDue.toISOString() : null,
        lastReportDate: lastReportDate ? moment(lastReportDate).tz(timezone).toISOString() : null,
        periodStart: moment(periodStart).tz(timezone).toISOString(),
        calculationSuccess: true,
        frequencyConfig: settings.reportFrequencies?.[frequency],
        workingDays: settings.calendar?.workingDays,
        holidaysCount: settings.calendar?.holidays?.length || 0
      };
    } catch (calcError) {
      backendCalculations.error = calcError.message;
      backendCalculations.calculationSuccess = false;
    }
    
    // Compare with frontend calculations
    const comparison = {
      student: {
        id: studentId,
        name: `${student.firstName} ${student.lastName}`,
        grade: student.studentGrade
      },
      template: {
        id: templateId,
        name: template.name,
        frequency: template.reportFrequency,
        grade: template.grade
      },
      school: {
        id: school._id,
        name: school.name,
        timezone: settings.timezone
      },
      lastReport: lastReport ? {
        id: lastReport._id,
        createdAt: lastReportDate.toISOString(),
        status: lastReport.status,
        teacherName: lastReport.teacherId ? 
          `${lastReport.teacherId.firstName} ${lastReport.teacherId.lastName}` : 'Unknown'
      } : null,
      backend: backendCalculations,
      frontend: frontendCalculations || null,
      differences: []
    };
    
    // Identify differences if frontend calculations provided
    if (frontendCalculations) {
      if (backendCalculations.due !== frontendCalculations.due) {
        comparison.differences.push({
          field: 'due',
          backend: backendCalculations.due,
          frontend: frontendCalculations.due,
          severity: 'high'
        });
      }
      
      if (backendCalculations.nextDueDate !== frontendCalculations.dueDate) {
        comparison.differences.push({
          field: 'dueDate',
          backend: backendCalculations.nextDueDate,
          frontend: frontendCalculations.dueDate,
          severity: 'high'
        });
      }
      
      if (backendCalculations.timezone !== frontendCalculations.timezone) {
        comparison.differences.push({
          field: 'timezone',
          backend: backendCalculations.timezone,
          frontend: frontendCalculations.timezone,
          severity: 'medium'
        });
      }
      
      if (backendCalculations.frequency !== frontendCalculations.frequency) {
        comparison.differences.push({
          field: 'frequency',
          backend: backendCalculations.frequency,
          frontend: frontendCalculations.frequency,
          severity: 'high'
        });
      }
    }
    
    // Log the comparison for debugging
    logger.info('🔍 Due calculation comparison', {
      service: 'debug',
      studentId,
      templateId,
      frequency,
      backend: backendCalculations,
      frontend: frontendCalculations,
      differences: comparison.differences,
      user: req.user._id
    });
    
    res.json({
      success: true,
      data: comparison
    });
    
  } catch (error) {
    logger.error('Error in due calculations debug endpoint', {
      service: 'debug',
      error: error.message,
      stack: error.stack,
      user: req.user._id
    });
    
    res.status(500).json({
      success: false,
      message: 'Error comparing due calculations',
      error: error.message
    });
  }
});

// @desc    Debug school settings and frequency configurations
// @route   GET /api/debug/school-settings
// @access  Private (school_admin, super_admin)
router.get('/school-settings', protect, authorize('school_admin', 'super_admin'), async (req, res) => {
  try {
    const school = await School.findById(req.user.schoolId).select('settings name');
    
    if (!school) {
      return res.status(404).json({
        success: false,
        message: 'School not found'
      });
    }
    
    const settings = school.settings || {};
    const timezone = settings.timezone || 'UTC';
    const now = getCurrentDateInTimezone(timezone);
    
    // Analyze frequency configurations
    const frequencyAnalysis = {};
    const frequencies = ['Daily', 'Weekly', 'Bi-Weekly', 'Monthly', 'Bi-Monthly', 'Quarterly', 'Annually'];
    
    for (const frequency of frequencies) {
      const config = settings.reportFrequencies?.[frequency];
      
      if (config) {
        let analysis = {
          enabled: config.enabled || false,
          configuration: config,
          calculationStatus: 'not-attempted'
        };
        
        if (config.enabled) {
          try {
            const dueResult = calculateDueDate(frequency, settings, now);
            analysis.calculationStatus = 'success';
            analysis.nextDueDate = dueResult.dueDate.toISOString();
            analysis.calculationMethod = 'backend-dateUtils';
          } catch (calcError) {
            analysis.calculationStatus = 'error';
            analysis.error = calcError.message;
          }
        }
        
        frequencyAnalysis[frequency] = analysis;
      } else {
        frequencyAnalysis[frequency] = {
          enabled: false,
          configuration: null,
          calculationStatus: 'no-config'
        };
      }
    }
    
    // Get templates and their frequencies
    const templates = await ReportTemplate.find({ 
      schoolId: req.user.schoolId,
      isActive: true 
    }).select('name reportFrequency grade');
    
    const templatesByFrequency = {};
    templates.forEach(template => {
      if (!templatesByFrequency[template.reportFrequency]) {
        templatesByFrequency[template.reportFrequency] = [];
      }
      templatesByFrequency[template.reportFrequency].push({
        id: template._id,
        name: template.name,
        grade: template.grade
      });
    });
    
    res.json({
      success: true,
      data: {
        school: {
          id: school._id,
          name: school.name,
          timezone: settings.timezone
        },
        currentTime: {
          utc: moment().utc().toISOString(),
          schoolTimezone: now.toISOString(),
          timezone: timezone
        },
        frequencyAnalysis,
        templatesByFrequency,
        settings: {
          calendar: settings.calendar,
          reportFrequencies: settings.reportFrequencies
        }
      }
    });
    
  } catch (error) {
    logger.error('Error in school settings debug endpoint', {
      service: 'debug',
      error: error.message,
      user: req.user._id
    });
    
    res.status(500).json({
      success: false,
      message: 'Error analyzing school settings',
      error: error.message
    });
  }
});

// @desc    Debug student-teacher assignments and report access
// @route   GET /api/debug/student-assignments/:studentId
// @access  Private (teacher, school_admin, super_admin)
router.get('/student-assignments/:studentId', protect, authorize('teacher', 'school_admin', 'super_admin'), async (req, res) => {
  try {
    const { studentId } = req.params;
    
    // Get student information
    const student = await User.findById(studentId).select('firstName lastName studentGrade studentClass schoolId role');
    
    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found'
      });
    }
    
    // Get all classes for this school
    const Class = require('../models/Class');
    const classes = await Class.find({ 
      schoolId: req.user.schoolId,
      isActive: true 
    }).populate('assignedTeachers.teacherId', 'firstName lastName email');
    
    // Find classes this student is in
    const studentClasses = classes.filter(cls => 
      cls.name === student.studentClass || 
      cls.students?.includes(studentId)
    );
    
    // Get all teachers assigned to student's classes
    const assignedTeachers = [];
    studentClasses.forEach(cls => {
      cls.assignedTeachers.forEach(assignment => {
        if (assignment.teacherId) {
          assignedTeachers.push({
            teacherId: assignment.teacherId._id,
            teacherName: `${assignment.teacherId.firstName} ${assignment.teacherId.lastName}`,
            teacherEmail: assignment.teacherId.email,
            className: cls.name,
            classId: cls._id,
            role: assignment.role || 'teacher'
          });
        }
      });
    });
    
    // Get all reports for this student
    const reports = await Report.find({ 
      studentId,
      schoolId: req.user.schoolId 
    }).populate('teacherId', 'firstName lastName')
      .populate('templateId', 'name reportFrequency grade')
      .sort({ createdAt: -1 });
    
    // Get applicable templates for this student's grade
    const templates = await ReportTemplate.find({
      schoolId: req.user.schoolId,
      isActive: true,
      $or: [
        { grade: student.studentGrade },
        { grade: { $exists: false } },
        { grade: null }
      ]
    }).select('name reportFrequency grade');
    
    res.json({
      success: true,
      data: {
        student: {
          id: student._id,
          name: `${student.firstName} ${student.lastName}`,
          grade: student.studentGrade,
          class: student.studentClass,
          schoolId: student.schoolId,
          role: student.role
        },
        currentUser: {
          id: req.user._id,
          role: req.user.role,
          canAccessStudent: req.user.role !== 'teacher' || assignedTeachers.some(t => t.teacherId.toString() === req.user._id.toString())
        },
        studentClasses: studentClasses.map(cls => ({
          id: cls._id,
          name: cls.name,
          grade: cls.grade,
          assignedTeachers: cls.assignedTeachers.length
        })),
        assignedTeachers,
        applicableTemplates: templates.map(template => ({
          id: template._id,
          name: template.name,
          frequency: template.reportFrequency,
          grade: template.grade
        })),
        reportsHistory: reports.map(report => ({
          id: report._id,
          title: report.title,
          status: report.status,
          createdAt: report.createdAt,
          teacherName: report.teacherId ? 
            `${report.teacherId.firstName} ${report.teacherId.lastName}` : 'Unknown',
          templateName: report.templateId?.name || 'Unknown Template',
          frequency: report.templateId?.reportFrequency || 'Unknown'
        }))
      }
    });
    
  } catch (error) {
    logger.error('Error in student assignments debug endpoint', {
      service: 'debug',
      error: error.message,
      studentId: req.params.studentId,
      user: req.user._id
    });
    
    res.status(500).json({
      success: false,
      message: 'Error analyzing student assignments',
      error: error.message
    });
  }
});

// @desc    Test due calculations for all active templates
// @route   POST /api/debug/test-all-calculations
// @access  Private (school_admin, super_admin)
router.post('/test-all-calculations', protect, authorize('school_admin', 'super_admin'), async (req, res) => {
  try {
    const school = await School.findById(req.user.schoolId).select('settings name');
    
    if (!school) {
      return res.status(404).json({
        success: false,
        message: 'School not found'
      });
    }
    
    const settings = school.settings || {};
    const timezone = settings.timezone || 'UTC';
    const now = getCurrentDateInTimezone(timezone);
    
    // Get all active templates
    const templates = await ReportTemplate.find({ 
      schoolId: req.user.schoolId,
      isActive: true 
    }).select('name reportFrequency grade');
    
    const results = [];
    
    for (const template of templates) {
      const frequency = template.reportFrequency;
      const frequencyConfig = settings.reportFrequencies?.[frequency];
      
      let result = {
        templateId: template._id,
        templateName: template.name,
        frequency,
        grade: template.grade,
        enabled: frequencyConfig?.enabled || false,
        calculationStatus: 'not-attempted'
      };
      
      if (frequencyConfig?.enabled) {
        try {
          const dueResult = calculateDueDate(frequency, settings, now);
          const periodStart = getStartOfFrequencyPeriod(frequency, settings, now.toDate());
          
          result = {
            ...result,
            calculationStatus: 'success',
            nextDueDate: dueResult.dueDate.toISOString(),
            periodStart: moment(periodStart).tz(timezone).toISOString(),
            configuration: frequencyConfig
          };
        } catch (calcError) {
          result = {
            ...result,
            calculationStatus: 'error',
            error: calcError.message,
            configuration: frequencyConfig
          };
        }
      } else {
        result.calculationStatus = 'disabled';
      }
      
      results.push(result);
    }
    
    // Summary statistics
    const summary = {
      totalTemplates: templates.length,
      enabledTemplates: results.filter(r => r.enabled).length,
      successfulCalculations: results.filter(r => r.calculationStatus === 'success').length,
      failedCalculations: results.filter(r => r.calculationStatus === 'error').length,
      disabledTemplates: results.filter(r => r.calculationStatus === 'disabled').length
    };
    
    res.json({
      success: true,
      data: {
        summary,
        results,
        timestamp: now.toISOString(),
        timezone,
        school: {
          id: school._id,
          name: school.name
        }
      }
    });
    
  } catch (error) {
    logger.error('Error in test all calculations debug endpoint', {
      service: 'debug',
      error: error.message,
      user: req.user._id
    });
    
    res.status(500).json({
      success: false,
      message: 'Error testing all calculations',
      error: error.message
    });
  }
});

module.exports = router;
