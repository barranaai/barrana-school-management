const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Event = require('../models/Event');
const ParentGroup = require('../models/ParentGroup');
const EventReminder = require('../models/EventReminder');
const User = require('../models/User');
const { eligibleGuardians } = require('../services/guardianAccessService');

async function guardianRecipients(students, schoolId) {
  const guardians = (await Promise.all(students.map(student => eligibleGuardians(student._id, 'communication')))).flat();
  const scoped = guardians.filter(parent => parent.role === 'parent' && parent.isActive !== false && String(parent.schoolId) === String(schoolId));
  return [...new Map(scoped.map(parent => [String(parent._id), parent])).values()];
}
const Class = require('../models/Class');
const { protect, authorize } = require('../middleware/auth');
const { requireActiveOrganization } = require('../middleware/lifecycleAuthorization');
const { scopeSchoolId } = require('../middleware/resourceAuthorization');
const { logger } = require('../utils/logger');
const { sendEventReminder } = require('../services/notificationService');
const notificationService = require('../services/notificationService');
const recurringEventService = require('../services/recurringEventService');
const firebaseService = require('../services/firebaseService');

const EVENT_UPDATE_FIELDS = [
  'title', 'description', 'startDate', 'endDate', 'reminderTime', 'category', 'location',
  'targetType', 'targetGrade', 'targetClass', 'targetGroup', 'attachments', 'isRecurring',
  'recurrencePattern', 'recurrenceInterval', 'recurrenceDays', 'recurrenceEndDate', 'recurrenceCount'
];

const requestedSchoolId = req => scopeSchoolId(req.user, req.body?.schoolId || req.query?.schoolId);

async function validateEventTarget(event, schoolId) {
  if (event.targetType === 'class') {
    if (!event.targetClass || !await Class.findOne({ _id: event.targetClass, schoolId, isActive: true, status: 'active' })) {
      return 'Target class was not found in this organization';
    }
  }
  if (event.targetType === 'group') {
    if (!event.targetGroup || !await ParentGroup.findOne({ _id: event.targetGroup, schoolId, isActive: true })) {
      return 'Target group was not found in this organization';
    }
  }
  return null;
}

// Configure multer for event attachments
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = 'uploads/event-attachments';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `event-${uniqueSuffix}${ext}`);
  }
});

// File filter for allowed types
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|pdf|mp4|mov|avi|doc|docx|xls|xlsx/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);
  
  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error('Only images, PDFs, videos, and documents are allowed'));
  }
};

const upload = multer({
  storage: storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
  fileFilter: fileFilter
});

// @desc    Upload event attachment
// @route   POST /api/events/upload-attachment
// @access  Private (school_admin, super_admin)
router.post('/upload-attachment', protect, authorize('school_admin', 'super_admin'), requireActiveOrganization, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    const fileInfo = {
      filename: req.file.filename,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
      url: `/uploads/event-attachments/${req.file.filename}`
    };

    logger.info(`Event attachment uploaded: ${req.file.originalname} (${req.file.size} bytes)`);

    res.json({
      success: true,
      message: 'File uploaded successfully',
      data: fileInfo
    });

  } catch (error) {
    logger.error('Error uploading event attachment:', error);
    res.status(500).json({
      success: false,
      message: 'Error uploading file',
      error: error.message
    });
  }
});

// @desc    Get all events for a school
// @route   GET /api/events
// @access  Private (school_admin, teacher)
router.get('/', protect, authorize('school_admin', 'teacher', 'super_admin'), async (req, res) => {
  try {
    const query = { schoolId: req.user.schoolId, isActive: true };

    // Add date filters if provided
    if (req.query.startDate && req.query.endDate) {
      query.startDate = { $gte: new Date(req.query.startDate), $lte: new Date(req.query.endDate) };
    }

    // Add category filter
    if (req.query.category) {
      query.category = req.query.category;
    }

    const events = await Event.find(query)
      .populate('createdBy', 'firstName lastName email')
      .populate('targetClass', 'name grade')
      .populate('targetGroup', 'name')
      .sort({ startDate: 1 });

    res.json({
      success: true,
      data: events,
      count: events.length
    });
  } catch (error) {
    logger.error('Error fetching events:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching events',
      error: error.message
    });
  }
});

// @desc    Get single event
// @route   GET /api/events/:id
// @access  Private
router.get('/:id', protect, async (req, res) => {
  try {
    const schoolId = requestedSchoolId(req);
    if (!schoolId) return res.status(400).json({ success: false, message: 'Organization context is required' });
    const event = await Event.findOne({ _id: req.params.id, schoolId })
      .populate('createdBy', 'firstName lastName email')
      .populate('targetClass', 'name grade')
      .populate('targetGroup', 'name');

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    res.json({
      success: true,
      data: event
    });
  } catch (error) {
    logger.error('Error fetching event:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching event',
      error: error.message
    });
  }
});

// @desc    Create new event
// @route   POST /api/events
// @access  Private (school_admin)
router.post('/', protect, authorize('school_admin', 'super_admin'), requireActiveOrganization, async (req, res) => {
  try {
    const schoolId = requestedSchoolId(req);
    if (!schoolId) return res.status(400).json({ success: false, message: 'Organization context is required' });
    const {
      title,
      description,
      startDate,
      endDate,
      reminderTime,
      category,
      location,
      targetType,
      targetGrade,
      targetClass,
      targetGroup,
      isRecurring,
      recurrencePattern,
      recurrenceInterval,
      recurrenceDays,
      recurrenceEndDate,
      recurrenceCount,
      attachments
    } = req.body;

    // Validate dates
    if (new Date(startDate) > new Date(endDate)) {
      return res.status(400).json({
        success: false,
        message: 'End date must be after start date'
      });
    }

    // Check if multi-day event
    const isMultiDay = new Date(startDate).toDateString() !== new Date(endDate).toDateString();

    const eventData = {
      title,
      description,
      startDate,
      endDate,
      isMultiDay,
      reminderTime: reminderTime || '09:00',
      category: category || 'other',
      location,
      targetType,
      targetGrade,
      targetClass,
      targetGroup,
      schoolId,
      createdBy: req.user._id,
      attachments: attachments || [],
      isRecurring: isRecurring || false,
      recurrencePattern: recurrencePattern || 'none',
      recurrenceInterval: recurrenceInterval || 1,
      recurrenceDays: recurrenceDays || [],
      recurrenceEndDate: recurrenceEndDate || null,
      recurrenceCount: recurrenceCount || null
    };

    const targetError = await validateEventTarget(eventData, schoolId);
    if (targetError) return res.status(400).json({ success: false, message: targetError });

    // Resolve recipients before persisting so a lookup failure cannot be reported as successful delivery.
    const recipients = await getEventRecipients(eventData);

    // Create event
    const event = await Event.create(eventData);

    logger.info(`Event created: ${event._id} by user ${req.user._id}`);

    // If it's a recurring event, generate instances
    let recurringInstancesCount = 0;
    if (isRecurring && recurrencePattern !== 'none') {
      try {
        const instances = await recurringEventService.createRecurringInstances(event);
        recurringInstancesCount = instances.length;
        logger.info(`Created ${recurringInstancesCount} recurring instances for event ${event._id}`);
      } catch (error) {
        logger.error('Error creating recurring instances:', error);
        // Don't fail the main event creation if recurring instances fail
      }
    }

    logger.info(`Found ${recipients.length} recipients for event ${event._id}`);

    // Send immediate reminders and push notifications
    if (recipients.length > 0) {
      // Send reminders and notifications asynchronously
      setImmediate(async () => {
        try {
          // Send email reminders
          const reminderPromises = recipients.map(recipient => 
            sendEventReminder(event, recipient, 'immediate')
          );
          
          const results = await Promise.allSettled(reminderPromises);
          const successCount = results.filter(r => r.status === 'fulfilled').length;
          
          // Update event reminder status
          event.reminders.immediate.sent = true;
          event.reminders.immediate.sentAt = new Date();
          event.reminders.immediate.recipientCount = successCount;
          await event.save();

          logger.info(`Sent ${successCount}/${recipients.length} immediate reminders for event ${event._id}`);
          
          // Send push notifications to parents
          try {
            // Get parent emails from recipients
            const parentEmails = recipients.map(r => r.email).filter(Boolean);
            
            if (parentEmails.length > 0) {
              // Fetch parent users with FCM tokens
              const parentUsers = await User.find({
                role: 'parent',
                email: { $in: parentEmails },
                schoolId: event.schoolId,
                'fcmTokens.0': { $exists: true } // Only parents with FCM tokens
              }).select('firstName lastName email fcmTokens');
              
              if (parentUsers.length > 0) {
                // Format event date
                const eventDate = new Date(event.startDate).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric'
                });
                
                // Get target description
                let targetDesc = 'All parents';
                if (event.targetType === 'grade') {
                  targetDesc = `Grade ${event.targetGrade}`;
                } else if (event.targetType === 'class') {
                  const classInfo = await Class.findById(event.targetClass).select('name');
                  targetDesc = classInfo ? classInfo.name : 'Your class';
                } else if (event.targetType === 'group') {
                  targetDesc = 'Your group';
                }
                
                // Create in-app notifications and send push notifications to each parent
                const notificationPromises = parentUsers.map(async (parent) => {
                  try {
                    // Create in-app notification
                    parent.notifications.push({
                      id: `event_${event._id}_${Date.now()}_${Math.random()}`,
                      type: 'system',
                      title: 'New Event',
                      message: `${event.title} - ${eventDate}${event.location ? ` at ${event.location}` : ''}`,
                      data: {
                        eventId: event._id.toString(),
                        eventTitle: event.title,
                        eventDate: event.startDate.toISOString(),
                        eventLocation: event.location || '',
                        eventCategory: event.category,
                        targetType: event.targetType,
                        targetDescription: targetDesc
                      },
                      isRead: false,
                      createdAt: new Date()
                    });
                    await parent.save();
                    
                    // Send push notification if tokens available
                    if (parent.fcmTokens && parent.fcmTokens.length > 0) {
                      return await firebaseService.sendNotificationToUser(
                        parent,
                        {
                          title: '📅 New Event Created',
                          body: `${event.title} - ${eventDate}${event.location ? ` at ${event.location}` : ''}`,
                          type: 'event_created',
                          priority: 'high'
                        },
                        {
                          eventId: event._id.toString(),
                          eventTitle: event.title,
                          eventDate: event.startDate.toISOString(),
                          eventLocation: event.location || '',
                          eventCategory: event.category,
                          targetType: event.targetType,
                          targetDescription: targetDesc
                        }
                      );
                    }
                    return { success: true };
                  } catch (error) {
                    logger.error(`Error creating notification for parent ${parent._id}:`, error);
                    return { success: false, error: error.message };
                  }
                });
                
                const notifResults = await Promise.allSettled(notificationPromises);
                const notifSuccessCount = notifResults.filter(r => r.status === 'fulfilled' && r.value?.success).length;
                
                logger.info(`Created ${notifSuccessCount}/${parentUsers.length} in-app notifications for event ${event._id}`);
              } else {
                logger.info(`No parents with FCM tokens found for event ${event._id}`);
              }
            }
          } catch (pushError) {
            logger.error('Error sending push notifications for event:', pushError);
            // Don't fail the reminder sending if push notifications fail
          }
        } catch (error) {
          logger.error('Error sending immediate reminders:', error);
        }
      });
    }

    res.status(201).json({
      success: true,
      data: event,
      recurringInstancesCount: recurringInstancesCount,
      message: isRecurring ? `Event created successfully with ${recurringInstancesCount} recurring instances. Reminders will be sent shortly.` : 'Event created successfully. Reminders will be sent shortly.'
    });
  } catch (error) {
    logger.error('Error creating event:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating event',
      error: error.message
    });
  }
});

// @desc    Update event
// @route   PUT /api/events/:id
// @access  Private (school_admin)
router.put('/:id', protect, authorize('school_admin', 'super_admin'), requireActiveOrganization, async (req, res) => {
  try {
    const schoolId = requestedSchoolId(req);
    if (!schoolId) return res.status(400).json({ success: false, message: 'Organization context is required' });
    let event = await Event.findOne({ _id: req.params.id, schoolId });

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    // Store old event data for comparison
    const oldEvent = {
      title: event.title,
      startDate: event.startDate,
      endDate: event.endDate,
      targetType: event.targetType,
      targetGrade: event.targetGrade,
      targetClass: event.targetClass,
      targetGroup: event.targetGroup,
      reminderTime: event.reminderTime
    };

    // Validate dates if provided
    const { startDate, endDate } = req.body;
    if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
      return res.status(400).json({
        success: false,
        message: 'End date must be after start date'
      });
    }

    // Check if multi-day event
    const isMultiDay = startDate && endDate ? 
      new Date(startDate).toDateString() !== new Date(endDate).toDateString() : 
      event.isMultiDay;

    // Prepare update data
    const updateData = { isMultiDay };
    for (const field of EVENT_UPDATE_FIELDS) if (Object.hasOwn(req.body, field)) updateData[field] = req.body[field];
    const proposedEvent = { ...(event.toObject ? event.toObject() : event), ...updateData, schoolId };
    const targetError = await validateEventTarget(proposedEvent, schoolId);
    if (targetError) return res.status(400).json({ success: false, message: targetError });
    const recipients = await getEventRecipients(proposedEvent);

    // Update event
    const updatedEvent = await Event.findOneAndUpdate(
      { _id: req.params.id, schoolId },
      updateData,
      { new: true, runValidators: true }
    );

    // If it's a recurring event, update all future instances
    let updatedInstancesCount = 0;
    if (updatedEvent.isRecurring && !updatedEvent.isRecurringInstance) {
      try {
        updatedInstancesCount = await recurringEventService.updateRecurringInstances(
          updatedEvent._id,
          updateData
        );
        logger.info(`Updated ${updatedInstancesCount} future instances for recurring event ${updatedEvent._id}`);
      } catch (error) {
        logger.error('Error updating recurring instances:', error);
      }
    }

    // Determine what changed for smart notifications
    const changes = {
      titleChanged: oldEvent.title !== updatedEvent.title,
      dateChanged: oldEvent.startDate.toString() !== updatedEvent.startDate.toString() || 
                  oldEvent.endDate.toString() !== updatedEvent.endDate.toString(),
      timeChanged: oldEvent.reminderTime !== updatedEvent.reminderTime,
      recipientsChanged: oldEvent.targetType !== updatedEvent.targetType ||
                        oldEvent.targetGrade !== updatedEvent.targetGrade ||
                        oldEvent.targetClass !== updatedEvent.targetClass ||
                        oldEvent.targetGroup !== updatedEvent.targetGroup
    };

    // Send update notifications based on changes
    if (changes.titleChanged || changes.dateChanged || changes.timeChanged || changes.recipientsChanged) {
      try {
        if (recipients.length > 0) {
          // Send immediate update notification
          await notificationService.sendEventUpdateNotification(updatedEvent, recipients, changes);
          
          // If date changed, reset and reschedule reminders
          if (changes.dateChanged || changes.timeChanged) {
            // Reset reminder status
            updatedEvent.reminders = {
              immediate: { sent: false, sentAt: null, recipientCount: 0 },
              twoDaysBefore: { sent: false, sentAt: null, recipientCount: 0 },
              oneDayBefore: { sent: false, sentAt: null, recipientCount: 0 }
            };
            await updatedEvent.save();
            
            logger.info(`Event reminders reset for updated event: ${updatedEvent._id}`);
          }
        }
      } catch (notificationError) {
        logger.error('Error sending update notifications:', notificationError);
        // Don't fail the update if notifications fail
      }
    }

    logger.info(`Event updated: ${event._id} by user ${req.user._id}. Changes: ${JSON.stringify(changes)}`);

    res.json({
      success: true,
      data: updatedEvent,
      updatedInstancesCount: updatedInstancesCount,
      message: updatedInstancesCount > 0 ? `Event updated successfully along with ${updatedInstancesCount} future instances` : 'Event updated successfully',
      changes: changes
    });
  } catch (error) {
    logger.error('Error updating event:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating event',
      error: error.message
    });
  }
});

// @desc    Delete event
// @route   DELETE /api/events/:id
// @access  Private (school_admin)
router.delete('/:id', protect, authorize('school_admin', 'super_admin'), requireActiveOrganization, async (req, res) => {
  try {
    const schoolId = requestedSchoolId(req);
    if (!schoolId) return res.status(400).json({ success: false, message: 'Organization context is required' });
    const event = await Event.findOne({ _id: req.params.id, schoolId });

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Event not found'
      });
    }

    const recipients = await getEventRecipients(event);
    // Send deletion notifications before deleting
    try {
      if (recipients.length > 0) {
        // Send deletion notification
        await notificationService.sendEventDeletionNotification(event, recipients);
        logger.info(`Deletion notifications sent to ${recipients.length} recipients for event ${event._id}`);
      }
    } catch (notificationError) {
      logger.error('Error sending deletion notifications:', notificationError);
      // Don't fail the deletion if notifications fail
    }

    // If it's a recurring event, delete all future instances
    let deletedInstancesCount = 0;
    if (event.isRecurring && !event.isRecurringInstance) {
      try {
        deletedInstancesCount = await recurringEventService.deleteRecurringInstances(event._id);
        logger.info(`Deleted ${deletedInstancesCount} future instances for recurring event ${event._id}`);
      } catch (error) {
        logger.error('Error deleting recurring instances:', error);
      }
    }

    // Soft delete - skip validation to avoid date comparison issues
    event.isActive = false;
    event.isCancelled = true;
    await event.save({ validateBeforeSave: false });

    logger.info(`Event deleted: ${event._id} by user ${req.user._id}`);

    res.json({
      success: true,
      deletedInstancesCount: deletedInstancesCount,
      message: deletedInstancesCount > 0 ? `Event and ${deletedInstancesCount} future instances deleted successfully. Cancellation notifications have been sent to all recipients.` : 'Event deleted successfully. Cancellation notifications have been sent to all recipients.'
    });
  } catch (error) {
    logger.error('Error deleting event:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting event',
      error: error.message
    });
  }
});

// @desc    Get event reminder logs
// @route   GET /api/events/:id/reminders
// @access  Private (school_admin)
router.get('/:id/reminders', protect, authorize('school_admin', 'super_admin'), async (req, res) => {
  try {
    const schoolId = requestedSchoolId(req);
    if (!schoolId) return res.status(400).json({ success: false, message: 'Organization context is required' });
    const event = await Event.findOne({ _id: req.params.id, schoolId }).select('_id');
    if (!event) return res.status(404).json({ success: false, message: 'Event not found' });
    const reminders = await EventReminder.find({ eventId: event._id })
      .populate('recipientId', 'firstName lastName')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: reminders,
      count: reminders.length
    });
  } catch (error) {
    logger.error('Error fetching reminder logs:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching reminder logs',
      error: error.message
    });
  }
});

// Helper function to get recipients based on event target type
async function getEventRecipients(event) {
  let recipients = [];

  try {
    switch (event.targetType) {
      case 'all':
        // Get all parents in the school
        recipients = await User.find({
          role: 'parent',
          schoolId: event.schoolId,
          isActive: true
        }).select('firstName lastName email phone phoneNumber preferences');
        
        // Format recipients for notification service
        recipients = recipients.map(parent => ({
          id: parent._id,
          _id: parent._id,
          name: `${parent.firstName} ${parent.lastName}`,
          email: parent.email,
          phone: parent.phone || parent.phoneNumber,
          preferences: parent.preferences
        }));
        break;

      case 'grade':
        // Get all students in the grade, then their parents
        const studentsInGrade = await User.find({
          role: 'student',
          studentGrade: event.targetGrade,
          schoolId: event.schoolId,
          isActive: true
        }).select('_id');
        const gradeParents = await guardianRecipients(studentsInGrade, event.schoolId);
        if (gradeParents.length > 0) {
          recipients = gradeParents.map(parent => ({
            id: parent._id,
            _id: parent._id,
            name: `${parent.firstName} ${parent.lastName}`,
            email: parent.email,
            phone: parent.phone || parent.phoneNumber,
            preferences: parent.preferences
          }));
        }
        break;

      case 'class':
        // Get all students in the class, then their parents
        const studentsInClass = await User.find({
          role: 'student',
          classId: event.targetClass,
          schoolId: event.schoolId,
          isActive: true
        }).select('_id');
        const classParents = await guardianRecipients(studentsInClass, event.schoolId);
        if (classParents.length > 0) {
          recipients = classParents.map(parent => ({
            id: parent._id,
            _id: parent._id,
            name: `${parent.firstName} ${parent.lastName}`,
            email: parent.email,
            phone: parent.phone || parent.phoneNumber,
            preferences: parent.preferences
          }));
        }
        break;

      case 'group':
        // Get group members
        const group = await ParentGroup.findOne({ _id: event.targetGroup, schoolId: event.schoolId, isActive: true })
          .populate('members.parentId', 'firstName lastName email phone phoneNumber preferences schoolId role isActive');
        if (group) {
          recipients = group.members.filter(m => m.parentId && m.parentId.role === 'parent' && m.parentId.isActive !== false && String(m.parentId.schoolId) === String(event.schoolId)).map(m => ({
            id: m.parentId._id,
            _id: m.parentId._id,
            name: `${m.parentId.firstName} ${m.parentId.lastName}`,
            email: m.parentId.email,
            phone: m.parentId.phone || m.parentId.phoneNumber,
            preferences: m.parentId.preferences
          }));
        }
        break;
    }

    // Remove duplicates based on email
    const uniqueRecipients = recipients.filter((recipient, index, self) =>
      index === self.findIndex(r => r.email === recipient.email)
    );

    return uniqueRecipients;
  } catch (error) {
    logger.error('Error getting event recipients:', error);
    throw error;
  }
}

module.exports = router;

