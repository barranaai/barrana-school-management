const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { protect, authorize } = require('../middleware/auth');
const { requireActiveOrganization } = require('../middleware/lifecycleAuthorization');
const User = require('../models/User');
const Report = require('../models/Report');
const { logger } = require('../utils/logger');
const firebaseService = require('../services/firebaseService');
const { canAccessReport, sameId, scopeSchoolId } = require('../middleware/resourceAuthorization');

const approvalNotificationStatuses = new Set(['draft', 'review']);
const fullName = user => [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim();

// @desc    Send report approval notification to school admins
// @route   POST /api/communication/report-approval-notification
// @access  Private (Teachers, School Admins, explicitly scoped Super Admins)
router.post('/report-approval-notification', protect, authorize('teacher', 'school_admin', 'super_admin'), requireActiveOrganization, async (req, res) => {
  try {
    const reportId = req.body.reportId || req.body.reportData?.reportId;
    const schoolId = scopeSchoolId(req.user, req.query.schoolId || req.body.schoolId);

    if (!schoolId) {
      return res.status(400).json({
        success: false,
        message: 'Organization context is required'
      });
    }
    if (!reportId) {
      return res.status(400).json({ success: false, message: 'Report ID is required' });
    }
    if (!mongoose.Types.ObjectId.isValid(reportId)) {
      return res.status(404).json({ success: false, message: 'Report not found' });
    }

    const report = await Report.findOne({ _id: reportId, schoolId })
      .populate('studentId', 'firstName lastName schoolId role')
      .populate('teacherId', 'firstName lastName schoolId role')
      .populate('templateId', 'name');
    if (!report || !canAccessReport(req.user, report)) {
      return res.status(404).json({ success: false, message: 'Report not found' });
    }
    if (!approvalNotificationStatuses.has(report.status)) {
      return res.status(409).json({ success: false, message: 'Report is not awaiting approval' });
    }
    if (!report.studentId || !report.teacherId ||
      report.studentId.role !== 'student' ||
      !sameId(report.studentId.schoolId, schoolId) ||
      !sameId(report.teacherId.schoolId, schoolId)) {
      return res.status(409).json({ success: false, message: 'Report approval context is incomplete' });
    }

    const reportData = {
      reportId: String(report._id),
      studentName: fullName(report.studentId),
      teacherName: fullName(report.teacherId),
      reportTitle: report.title || report.templateId?.name || 'Report',
      createdAt: report.createdAt
    };

    // Find all school admins for the given school
    const schoolAdmins = await User.find({
      schoolId,
      role: 'school_admin',
      isActive: true
    }).select('_id firstName lastName email');

    if (schoolAdmins.length === 0) {
      logger.warn('No active school administrators found for notification');
      return res.json({
        success: true,
        data: {
          success: true,
          sentCount: 0,
          failedCount: 0
        },
        message: 'No school admins found to notify'
      });
    }

    // Create notification data
    const notificationData = {
      type: 'report',
      title: 'New Report Pending Approval',
      message: `${reportData.teacherName} has submitted a report for ${reportData.studentName} that requires your approval.`,
      data: {
        reportId: reportData.reportId,
        studentName: reportData.studentName,
        teacherName: reportData.teacherName,
        reportTitle: reportData.reportTitle,
        createdAt: reportData.createdAt,
        action: 'approve_report'
      },
      isRead: false,
      createdAt: new Date().toISOString()
    };

    // For now, we'll store notifications in the user's notification field
    // In a production system, you might want a separate Notification model
    let sentCount = 0;
    let failedCount = 0;

    for (const admin of schoolAdmins) {
      try {
        // Add notification to admin's notifications array
        await User.findByIdAndUpdate(admin._id, {
          $push: {
            notifications: {
              ...notificationData,
              id: new Date().getTime().toString(), // Simple ID generation
              userId: admin._id
            }
          }
        });
        
        // Send FCM push notification if Firebase is initialized
        if (firebaseService.isFirebaseInitialized()) {
          const fcmNotification = {
            title: notificationData.title,
            message: notificationData.message,
            type: notificationData.type
          };
          
          const fcmData = {
            reportId: reportData.reportId,
            studentName: reportData.studentName,
            action: 'approve_report'
          };
          
          await firebaseService.sendNotificationToUser(admin, fcmNotification, fcmData);
        }
        
        sentCount++;
        logger.info('Report approval notification accepted');
      } catch (error) {
        failedCount++;
        logger.error('Report approval notification failed', error);
      }
    }

    res.json({
      success: true,
      data: {
        success: true,
        sentCount,
        failedCount
      },
      message: `Notifications sent to ${sentCount} school admin(s)`
    });

  } catch (error) {
    logger.error('Error sending report approval notification:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while sending notification'
    });
  }
});

// @desc    Get notifications for a user
// @route   GET /api/communication/notifications
// @access  Private
router.get('/notifications', protect, async (req, res) => {
  try {
    const { unreadOnly = false } = req.query;
    
    const user = await User.findById(req.user._id).select('notifications');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    let notifications = user.notifications || [];
    
    if (unreadOnly === 'true') {
      notifications = notifications.filter(notification => !notification.isRead);
    }

    // Sort by creation date (newest first)
    notifications.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json({
      success: true,
      data: notifications
    });

  } catch (error) {
    logger.error('Error fetching notifications:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching notifications'
    });
  }
});

// @desc    Mark notification as read
// @route   PATCH /api/communication/notifications/:notificationId/read
// @access  Private
router.patch('/notifications/:notificationId/read', protect, async (req, res) => {
  try {
    const { notificationId } = req.params;
    
    const result = await User.updateOne(
      { 
        _id: req.user._id,
        'notifications.id': notificationId 
      },
      { 
        $set: { 
          'notifications.$.isRead': true,
          'notifications.$.readAt': new Date().toISOString()
        } 
      }
    );

    if (result.modifiedCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    res.json({
      success: true,
      message: 'Notification marked as read'
    });

  } catch (error) {
    logger.error('Error marking notification as read:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while marking notification as read'
    });
  }
});

// @desc    Register FCM token for push notifications
// @route   POST /api/communication/fcm/register
// @access  Private
router.post('/fcm/register', protect, async (req, res) => {
  try {
    const { token, device = 'web', deviceInfo = {} } = req.body;

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

    logger.info('Push token registered', {
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
      message: 'Server error while registering FCM token'
    });
  }
});

// @desc    Unregister FCM token
// @route   DELETE /api/communication/fcm/unregister
// @access  Private
router.delete('/fcm/unregister', protect, async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'FCM token is required'
      });
    }

    await User.findByIdAndUpdate(req.user._id, {
      $pull: { fcmTokens: { token } }
    });

    logger.info('Push token unregistered');

    res.json({
      success: true,
      message: 'FCM token unregistered successfully'
    });

  } catch (error) {
    logger.error('Error unregistering FCM token:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while unregistering FCM token'
    });
  }
});

// @desc    Test push notification
// @route   POST /api/communication/fcm/test
// @access  Private
router.post('/fcm/test', protect, async (req, res) => {
  try {
    if (!firebaseService.isFirebaseInitialized()) {
      return res.status(503).json({
        success: false,
        message: 'Firebase is not initialized. Push notifications are disabled.'
      });
    }

    const user = await User.findById(req.user._id);
    
    if (!user.fcmTokens || user.fcmTokens.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No FCM tokens registered for this user'
      });
    }

    const notification = {
      title: '🎉 Test Notification',
      message: 'If you see this, push notifications are working perfectly!',
      type: 'test'
    };

    const data = {
      testId: Date.now().toString(),
      sender: 'system'
    };

    const result = await firebaseService.sendNotificationToUser(user, notification, data);

    res.json({
      success: true,
      message: 'Test notification sent',
      result
    });

  } catch (error) {
    logger.error('Error sending test notification:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while sending test notification'
    });
  }
});

module.exports = router;
