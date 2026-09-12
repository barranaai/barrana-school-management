const express = require('express');
const { protect, authorize } = require('../middleware/auth');
const User = require('../models/User');
const Report = require('../models/Report');
const { canExposeProgressReport, finalizedParentContent } = require('../utils/reportPublication');
const Event = require('../models/Event');
const School = require('../models/School');
const Class = require('../models/Class');
const { logger } = require('../utils/logger');
const fs = require('fs').promises;
const { readReportPdf } = require('../services/reportPdf');

const router = express.Router();
const parentReportView = report => {
  if (report.progressId) {
    if (!canExposeProgressReport(report)) return null;
    const child = report.studentId;
    return {
      _id: report._id,
      studentId: child && child._id ? { _id: child._id, firstName: child.firstName, lastName: child.lastName, studentId: child.studentId } : child,
      status: report.status,
      ...finalizedParentContent(report),
      pdfUrl: report.pdfArtifact ? `/api/parents/me/reports/${report._id}/pdf` : null,
      sentAt: report.parentCommunication?.sentAt || null
    };
  }
  const snap = report.finalizedSnapshot;
  return {
    _id: report._id,
    studentId: report.studentId,
    title: snap?.reportMetadata?.title || report.title,
    reportPeriod: snap?.reportMetadata?.reportPeriod || report.reportPeriod,
    reportType: snap?.reportMetadata?.reportType || report.reportType,
    status: report.status,
    content: snap?.parentVisibleContent || report.content,
    customFieldValues: snap?.customFieldValues || report.customFieldValues,
    attachments: snap?.attachments || (report.attachments || []),
    pdfUrl: report.pdfArtifact ? `/api/parents/me/reports/${report._id}/pdf` : null,
    sentAt: report.parentCommunication?.sentAt || null
  };
};

// @desc    Get parent's children
// @route   GET /api/parents/me/children
// @access  Private (Parent only)
router.get('/me/children', protect, authorize('parent'), async (req, res) => {
  try {
    // Find all students where this parent is the parent
    const children = await User.find({
      role: 'student',
      schoolId: req.user.schoolId,
      parentEmail: req.user.email
    })
      .populate('classId', 'name grade')
      .select('firstName lastName studentId email phone classId photo parentEmail parentPhone medicalInfo emergencyContact studentGrade dateOfBirth')
      .lean();

    // Get teacher info for each child
    const childrenWithTeachers = await Promise.all(children.map(async (child) => {
      if (child.classId) {
        logger.info(`Looking for teacher for class: ${child.classId._id} (${child.classId.name})`);
        
        // Get the class with assigned teachers populated
        const classData = await Class.findById(child.classId._id)
          .populate('assignedTeachers.teacherId', 'firstName lastName email')
          .lean();
        
        if (classData && classData.assignedTeachers && classData.assignedTeachers.length > 0) {
          // Find the primary teacher
          const primaryTeacher = classData.assignedTeachers.find(
            assignment => assignment.role === 'primary'
          );
          
          // If no primary teacher, get the first teacher
          const teacherAssignment = primaryTeacher || classData.assignedTeachers[0];
          const teacher = teacherAssignment.teacherId;
          
          logger.info(`Teacher found: ${teacher ? `${teacher.firstName} ${teacher.lastName} (${teacherAssignment.role})` : 'None'}`);

          return {
            ...child,
            teacher: teacher ? {
              name: `${teacher.firstName} ${teacher.lastName}`,
              email: teacher.email
            } : null
          };
        } else {
          logger.info(`No teachers assigned to class: ${child.classId.name}`);
        }
      }
      return child;
    }));

    // Disable caching for this endpoint
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
    res.json({
      success: true,
      data: childrenWithTeachers
    });
  } catch (error) {
    logger.error('Error fetching parent children:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching children',
      error: error.message
    });
  }
});

// @desc    Get all reports for parent's children
// @route   GET /api/parents/me/reports
// @access  Private (Parent only)
router.get('/me/reports', protect, authorize('parent'), async (req, res) => {
  try {
    // Find all students for this parent
    const children = await User.find({
      role: 'student',
      schoolId: req.user.schoolId,
      parentEmail: req.user.email
    }).select('_id');

    const studentIds = children.map(child => child._id);

    // Get all reports for these students
    const reports = await Report.find({
      schoolId: req.user.schoolId,
      studentId: { $in: studentIds },
      status: 'sent' // Only show sent reports
    })
      .populate({
        path: 'studentId',
        select: 'firstName lastName studentId classId',
        populate: {
          path: 'classId',
          select: 'name grade'
        }
      })
      .populate('teacherId', 'firstName lastName')
      .populate('templateId', 'name type')
      .sort({ date: -1 })
      .lean();

    // Add PDF URL if exists
    const reportsWithPdf = reports.map(report => {
      return parentReportView(report);
    }).filter(Boolean);

    logger.info(`Returning ${reportsWithPdf.length} reports to parent ${req.user.email}`);

    // Disable caching
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    res.json({
      success: true,
      data: reportsWithPdf
    });
  } catch (error) {
    logger.error('Error fetching parent reports:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching reports',
      error: error.message
    });
  }
});

// @desc    Get single report by ID
// @route   GET /api/parents/me/reports/:id
// @access  Private (Parent only)
router.get('/me/reports/:id', protect, authorize('parent'), async (req, res) => {
  try {
    const report = await Report.findOne({ _id: req.params.id, schoolId: req.user.schoolId })
      .populate('studentId', 'firstName lastName studentId parentEmail')
      .populate('teacherId', 'firstName lastName email')
      .populate('templateId', 'name type')
      .lean();

    if (!report || (report.progressId && !canExposeProgressReport(report))) {
      return res.status(404).json({
        success: false,
        message: 'Report not found'
      });
    }

    // Verify parent has access to this report
    if (report.studentId.parentEmail !== req.user.email) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view this report'
      });
    }

    res.json({
      success: true,
      data: parentReportView(report)
    });
  } catch (error) {
    logger.error('Error fetching report:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching report',
      error: error.message
    });
  }
});

// @desc    Download report PDF
// @route   GET /api/parents/me/reports/:id/pdf
// @access  Private (Parent only)
router.get('/me/reports/:id/pdf', protect, authorize('parent'), async (req, res) => {
  try {
    logger.info(`Parent ${req.user.email} requesting PDF for report ${req.params.id}`);
    
    const report = await Report.findOne({ _id: req.params.id, schoolId: req.user.schoolId })
      .populate('studentId', 'parentEmail firstName lastName')
      .lean();

    if (!report || (report.progressId && !canExposeProgressReport(report))) {
      logger.warn(`Report ${req.params.id} not found`);
      return res.status(404).json({
        success: false,
        message: 'Report not found'
      });
    }


    // Verify parent has access
    if (report.studentId.parentEmail !== req.user.email) {
      logger.warn(`Parent ${req.user.email} not authorized for report ${req.params.id}`);
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view this report'
      });
    }
    if (!['approved', 'sent'].includes(report.status)) return res.status(404).json({ success: false, message: 'Report not available' });

    let bytes;
    try { bytes = await readReportPdf(report); }
    catch (_) { return res.status(404).json({ success: false, code: 'PDF_UNAVAILABLE', message: 'PDF unavailable; authorized regeneration is required' }); }
    const date = report.finalizedSnapshot?.finalizedAt || report.reportPeriod?.endDate || report.createdAt;
    const stamp = new Date(date).toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="Report_' + stamp + '.pdf"');
    res.setHeader('Cache-Control', 'private, no-store');
    // Send the exact verified bytes; no second file open or filesystem path exposure.
    res.end(bytes);

  } catch (error) {
    logger.error('Error downloading report PDF:', error);
    res.status(500).json({
      success: false,
      message: 'Error downloading PDF',
      error: error.message
    });
  }
});

// @desc    Get events for parent
// @route   GET /api/parents/me/events
// @access  Private (Parent only)
router.get('/me/events', protect, authorize('parent'), async (req, res) => {
  try {
    // Find parent's children
    const children = await User.find({
      role: 'student',
      schoolId: req.user.schoolId,
      parentEmail: req.user.email
    }).select('classId').lean();

    if (!children.length) {
      return res.json({
        success: true,
        data: []
      });
    }

    const classIds = [...new Set(children.map(child => child.classId).filter(Boolean))];

    // Get student grades
    const classes = await require('../models/Class').find({ _id: { $in: classIds } }).select('grade').lean();
    const grades = [...new Set(classes.map(c => c.grade))];

    // Find events that target:
    // 1. All parents (targetAudience.allParents)
    // 2. Specific grades that include parent's children's grades
    // 3. Specific classes that include parent's children's classes
    logger.info(`Fetching events for school: ${req.user.schoolId}, grades: ${grades}, classIds: ${classIds}`);
    
    // Query based on actual Event model structure
    const events = await Event.find({
      schoolId: req.user.schoolId,
      isActive: true,
      isCancelled: false,
      $or: [
        { targetType: 'all' },
        { targetType: 'grade', targetGrade: { $in: grades } },
        { targetType: 'class', targetClass: { $in: classIds } }
        // TODO: Add parent groups support when needed
      ]
    })
      .sort({ startDate: 1 })
      .lean();

    logger.info(`Found ${events.length} events for parent`);

    // Disable caching
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    res.json({
      success: true,
      data: events
    });
  } catch (error) {
    logger.error('Error fetching parent events:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching events',
      error: error.message
    });
  }
});

// @desc    Register FCM token for push notifications
// @route   POST /api/parents/me/fcm-token
// @access  Private (Parent only)
router.post('/me/fcm-token', protect, authorize('parent'), async (req, res) => {
  try {
    // Support both old format (fcmToken, deviceType, deviceId) and new format (token, device, deviceInfo)
    const token = req.body.token || req.body.fcmToken;
    const device = req.body.device || req.body.deviceType || 'web';
    const deviceInfo = req.body.deviceInfo || {};

    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'FCM token is required'
      });
    }

    // Check if token already exists for this user
    const existingToken = await User.findOne({
      _id: req.user._id,
      'fcmTokens.token': token
    });

    if (existingToken) {
      // Update lastUsed timestamp
      await User.updateOne(
        { _id: req.user._id, 'fcmTokens.token': token },
        { $set: { 'fcmTokens.$.lastUsed': new Date() } }
      );

      return res.json({
        success: true,
        message: 'FCM token already registered, timestamp updated'
      });
    }

    // Add new token
    await User.findByIdAndUpdate(req.user._id, {
      $push: {
        fcmTokens: {
          token,
          device,
          deviceInfo: {
            userAgent: deviceInfo.userAgent || req.get('User-Agent'),
            platform: deviceInfo.platform || device,
            appVersion: deviceInfo.appVersion || '1.0.0'
          },
          createdAt: new Date(),
          lastUsed: new Date()
        }
      }
    });

    logger.info(`FCM token registered for parent ${req.user._id}`, {
      device,
      platform: deviceInfo.platform
    });

    res.json({
      success: true,
      message: 'FCM token registered successfully'
    });
  } catch (error) {
    logger.error('Error registering FCM token:', error);
    res.status(500).json({
      success: false,
      message: 'Error registering FCM token',
      error: error.message
    });
  }
});

// @desc    Get parent notifications
// @route   GET /api/parents/me/notifications
// @access  Private (Parent only)
router.get('/me/notifications', protect, authorize('parent'), async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('notifications');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Sort notifications by most recent first
    const notifications = (user.notifications || []).sort((a, b) => 
      new Date(b.createdAt) - new Date(a.createdAt)
    );

    // Limit to recent 50 notifications
    const recentNotifications = notifications.slice(0, 50);

    res.json({
      success: true,
      data: recentNotifications,
      unreadCount: recentNotifications.filter(n => !n.isRead).length
    });
  } catch (error) {
    logger.error('Error fetching parent notifications:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching notifications',
      error: error.message
    });
  }
});

// @desc    Mark notification as read
// @route   PATCH /api/parents/me/notifications/:notificationId/read
// @access  Private (Parent only)
router.patch('/me/notifications/:notificationId/read', protect, authorize('parent'), async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const notification = user.notifications.id(req.params.notificationId);
    
    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    notification.isRead = true;
    notification.readAt = new Date();
    await user.save();

    res.json({
      success: true,
      message: 'Notification marked as read'
    });
  } catch (error) {
    logger.error('Error marking notification as read:', error);
    res.status(500).json({
      success: false,
      message: 'Error marking notification as read',
      error: error.message
    });
  }
});

// @desc    Mark all notifications as read
// @route   PATCH /api/parents/me/notifications/mark-all-read
// @access  Private (Parent only)
router.patch('/me/notifications/mark-all-read', protect, authorize('parent'), async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Mark all unread notifications as read
    const now = new Date();
    user.notifications.forEach(notification => {
      if (!notification.isRead) {
        notification.isRead = true;
        notification.readAt = now;
      }
    });

    await user.save();

    res.json({
      success: true,
      message: 'All notifications marked as read'
    });
  } catch (error) {
    logger.error('Error marking all notifications as read:', error);
    res.status(500).json({
      success: false,
      message: 'Error marking all notifications as read',
      error: error.message
    });
  }
});

// @desc    Get school branding
// @route   GET /api/parents/me/school-branding
// @access  Private (Parent only)
router.get('/me/school-branding', protect, authorize('parent'), async (req, res) => {
  try {
    const school = await School.findById(req.user.schoolId)
      .select('name logo branding updatedAt')
      .lean();

    if (!school) {
      return res.status(404).json({
        success: false,
        message: 'School not found'
      });
    }

    // Use logo from branding if root logo is null
    const logoPath = school.logo || school.branding?.logo || null;
    
    res.json({
      success: true,
      data: {
        schoolId: school._id,
        schoolName: school.name,
        updatedAt: school.updatedAt,
        logo: logoPath,
        branding: {
          ...(school.branding || {}),
          primaryColor: school.branding?.primaryColor || '#667eea',
          secondaryColor: school.branding?.secondaryColor || '#764ba2',
          logo: logoPath || school.branding?.logo,
        }
      }
    });
  } catch (error) {
    logger.error('Error fetching school branding:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching school branding',
      error: error.message
    });
  }
});

module.exports = router;

