const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const NotificationLog = require('../models/NotificationLog');
const { logger } = require('../utils/logger');

/**
 * @route   GET /api/notification-logs
 * @desc    Get notification logs with advanced filtering
 * @access  Private (School Admin, Super Admin)
 */
router.get('/', protect, authorize('school_admin', 'super_admin'), async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      channel,
      status,
      type,
      dateFrom,
      dateTo,
      recipientEmail,
      recipientPhone,
      recipientName,
      studentId,
      classId,
      gradeLevel,
      eventId,
      reportId,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build query
    const query = {};

    // School filter (school admins can only see their school's logs)
    if (req.user.role === 'school_admin') {
      query.schoolId = req.user.schoolId;
    } else if (req.query.schoolId) {
      query.schoolId = req.query.schoolId;
    }

    // Channel filter
    if (channel) {
      query.channel = channel;
    }

    // Status filter
    if (status) {
      query.status = status;
    }

    // Type filter
    if (type) {
      query.type = type;
    }

    // Date range filter
    if (dateFrom || dateTo) {
      query.createdAt = {};
      if (dateFrom) {
        query.createdAt.$gte = new Date(dateFrom);
      }
      if (dateTo) {
        // Add 23:59:59 to include the entire day
        const endDate = new Date(dateTo);
        endDate.setHours(23, 59, 59, 999);
        query.createdAt.$lte = endDate;
      }
    }

    // Recipient filters
    if (recipientEmail) {
      query.recipientEmail = { $regex: recipientEmail, $options: 'i' };
    }
    if (recipientPhone) {
      query.recipientPhone = { $regex: recipientPhone.replace(/[^0-9+]/g, ''), $options: 'i' };
    }
    if (recipientName) {
      query.recipientName = { $regex: recipientName, $options: 'i' };
    }

    // Context filters
    if (studentId) {
      query.studentId = studentId;
    }
    if (classId) {
      query.classId = classId;
    }
    if (gradeLevel) {
      query.gradeLevel = gradeLevel;
    }
    if (eventId) {
      query.eventId = eventId;
    }
    if (reportId) {
      query.reportId = reportId;
    }

    // Full-text search across multiple fields
    if (search) {
      query.$text = { $search: search };
    }

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Sort
    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    // Execute query
    const [logs, total] = await Promise.all([
      NotificationLog.find(query)
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .select('-providerResponse -metadata.additionalData') // Exclude large fields
        .lean(),
      NotificationLog.countDocuments(query)
    ]);

    res.json({
      success: true,
      data: {
        logs,
        pagination: {
          total,
          page: parseInt(page),
          pages: Math.ceil(total / parseInt(limit)),
          limit: parseInt(limit)
        }
      }
    });
  } catch (error) {
    logger.error('Error fetching notification logs:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/notification-logs/statistics
 * @desc    Get notification statistics
 * @access  Private (School Admin, Super Admin)
 */
router.get('/statistics', protect, authorize('school_admin', 'super_admin'), async (req, res) => {
  try {
    const { dateFrom, dateTo } = req.query;
    
    // Determine school ID
    let schoolId;
    if (req.user.role === 'school_admin') {
      schoolId = req.user.schoolId;
    } else if (req.query.schoolId) {
      schoolId = req.query.schoolId;
    }

    if (!schoolId) {
      return res.status(400).json({
        success: false,
        message: 'School ID is required'
      });
    }

    const dateRange = {};
    if (dateFrom) dateRange.from = dateFrom;
    if (dateTo) dateRange.to = dateTo;

    const stats = await NotificationLog.getStatistics(schoolId, dateRange);
    
    // Get delivery rates by channel
    const [emailRate, smsRate, whatsappRate] = await Promise.all([
      NotificationLog.getDeliveryRate(schoolId, 'email', dateRange),
      NotificationLog.getDeliveryRate(schoolId, 'sms', dateRange),
      NotificationLog.getDeliveryRate(schoolId, 'whatsapp', dateRange)
    ]);

    res.json({
      success: true,
      data: {
        overall: stats,
        deliveryRates: {
          email: emailRate,
          sms: smsRate,
          whatsapp: whatsappRate
        }
      }
    });
  } catch (error) {
    logger.error('Error fetching notification statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/notification-logs/:id
 * @desc    Get single notification log by ID
 * @access  Private (School Admin, Super Admin)
 */
router.get('/:id', protect, authorize('school_admin', 'super_admin'), async (req, res) => {
  try {
    const log = await NotificationLog.findById(req.params.id)
      .populate('recipientId', 'firstName lastName email phoneNumber')
      .populate('studentId', 'firstName lastName studentId')
      .populate('classId', 'name gradeLevel')
      .populate('eventId', 'title startDate endDate location')
      .populate('reportId', 'reportType date');

    if (!log) {
      return res.status(404).json({
        success: false,
        message: 'Notification log not found'
      });
    }

    // Check access
    if (req.user.role === 'school_admin' && log.schoolId.toString() !== req.user.schoolId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    res.json({
      success: true,
      data: log
    });
  } catch (error) {
    logger.error('Error fetching notification log:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/notification-logs/export/csv
 * @desc    Export notification logs as CSV
 * @access  Private (School Admin, Super Admin)
 */
router.get('/export/csv', protect, authorize('school_admin', 'super_admin'), async (req, res) => {
  try {
    const {
      channel,
      status,
      type,
      dateFrom,
      dateTo
    } = req.query;

    // Build query
    const query = {};

    // School filter
    if (req.user.role === 'school_admin') {
      query.schoolId = req.user.schoolId;
    } else if (req.query.schoolId) {
      query.schoolId = req.query.schoolId;
    }

    if (channel) query.channel = channel;
    if (status) query.status = status;
    if (type) query.type = type;

    if (dateFrom || dateTo) {
      query.createdAt = {};
      if (dateFrom) query.createdAt.$gte = new Date(dateFrom);
      if (dateTo) {
        const endDate = new Date(dateTo);
        endDate.setHours(23, 59, 59, 999);
        query.createdAt.$lte = endDate;
      }
    }

    // Fetch logs
    const logs = await NotificationLog.find(query)
      .sort({ createdAt: -1 })
      .limit(10000) // Limit to 10k records for performance
      .lean();

    // Build CSV
    const csvRows = [];
    
    // Header
    csvRows.push([
      'Date',
      'Channel',
      'Type',
      'Status',
      'Recipient Name',
      'Recipient Email',
      'Recipient Phone',
      'Student Name',
      'Class',
      'Event/Report Title',
      'Subject',
      'Message ID',
      'Error Message'
    ].join(','));

    // Data rows
    for (const log of logs) {
      csvRows.push([
        new Date(log.createdAt).toLocaleString(),
        log.channel,
        log.type,
        log.status,
        `"${log.recipientName || ''}"`,
        log.recipientEmail || '',
        log.recipientPhone || '',
        `"${log.studentName || ''}"`,
        `"${log.className || ''}"`,
        `"${log.eventTitle || log.reportTitle || ''}"`,
        `"${log.subject || ''}"`,
        log.providerMessageId || '',
        `"${log.error?.message || ''}"`
      ].join(','));
    }

    const csv = csvRows.join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=notification-logs-${Date.now()}.csv`);
    res.send(csv);
  } catch (error) {
    logger.error('Error exporting notification logs:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

/**
 * @route   DELETE /api/notification-logs/cleanup
 * @desc    Delete old notification logs (older than X days)
 * @access  Private (Super Admin only)
 */
router.delete('/cleanup', protect, authorize('super_admin'), async (req, res) => {
  try {
    const { daysOld = 90 } = req.query;
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - parseInt(daysOld));

    const result = await NotificationLog.deleteMany({
      createdAt: { $lt: cutoffDate }
    });

    logger.info(`Cleaned up ${result.deletedCount} old notification logs (older than ${daysOld} days)`);

    res.json({
      success: true,
      message: `Deleted ${result.deletedCount} notification logs older than ${daysOld} days`,
      deletedCount: result.deletedCount
    });
  } catch (error) {
    logger.error('Error cleaning up notification logs:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
});

module.exports = router;

