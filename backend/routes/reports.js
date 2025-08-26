const express = require('express');
const router = express.Router();
const moment = require('moment-timezone');
const Report = require('../models/Report');
const ReportTemplate = require('../models/ReportTemplate');
const User = require('../models/User');
const School = require('../models/School');
const { calculateDueDate, isReportDue, getCurrentDateInTimezone, getStartOfFrequencyPeriod } = require('../utils/dateUtils');
const loggerUtils = require('../utils/logger');
const logger = loggerUtils.logger;
const { protect, authorize } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const ffmpeg = require('fluent-ffmpeg');
const { sendReportEmail } = require('../services/emailService');

// Configure multer for file uploads with report ID
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = 'uploads/media';
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Generate unique filename
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `media-${req.params.reportId}-${uniqueSuffix}${ext}`);
  }
});

// Configure multer for temporary file uploads (no report ID)
const tempStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = 'uploads/media';
    console.log('Temp storage destination:', uploadDir);
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      console.log('Creating upload directory:', uploadDir);
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Generate unique filename for temporary uploads
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    const filename = `temp-media-${uniqueSuffix}${ext}`;
    console.log('Temp storage filename:', filename);
    cb(null, filename);
  }
});

const fileFilter = (req, file, cb) => {
  // Allow images and videos
  const allowedImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  const allowedVideoTypes = ['video/mp4', 'video/avi', 'video/mov', 'video/wmv', 'video/flv', 'video/webm'];
  
  if (allowedImageTypes.includes(file.mimetype) || allowedVideoTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only images and videos are allowed.'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
    files: 10 // Max 10 files per upload
  }
});

const tempUpload = multer({
  storage: tempStorage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
    files: 10 // Max 10 files per upload
  }
}).array('media', 10);

// Wrapper for tempUpload with error handling
const tempUploadWithErrorHandling = (req, res, next) => {
  tempUpload(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      console.error('Multer error:', err);
      return res.status(400).json({
        success: false,
        message: `File upload error: ${err.message}`
      });
    } else if (err) {
      console.error('Other upload error:', err);
      return res.status(500).json({
        success: false,
        message: `Upload error: ${err.message}`
      });
    }
    next();
  });
};

// Set ffmpeg path for production
if (process.env.NODE_ENV === 'production') {
  const ffmpegPath = require('ffmpeg-static');
  ffmpeg.setFfmpegPath(ffmpegPath);
}

// Optimization functions
const optimizeImage = async (inputPath, outputPath, options = {}) => {
  try {
    const { quality = 85, maxWidth = 1920, maxHeight = 1080 } = options;

    const originalStats = await fs.promises.stat(inputPath);
    const originalSize = originalStats.size;

    const metadata = await sharp(inputPath).metadata();
    const { width, height } = metadata;

    let newWidth = width;
    let newHeight = height;
    
    if (width > maxWidth || height > maxHeight) {
      const ratio = Math.min(maxWidth / width, maxHeight / height);
      newWidth = Math.round(width * ratio);
      newHeight = Math.round(height * ratio);
    }

    const pipeline = sharp(inputPath)
      .resize(newWidth, newHeight, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .jpeg({
        quality,
        progressive: true,
        mozjpeg: true
      });

    await pipeline.toFile(outputPath);

    const optimizedStats = await fs.promises.stat(outputPath);
    const optimizedSize = optimizedStats.size;
    const compressionRatio = ((originalSize - optimizedSize) / originalSize * 100).toFixed(2);

    return {
      success: true,
      originalSize,
      optimizedSize,
      compressionRatio: parseFloat(compressionRatio),
      originalDimensions: { width, height },
      optimizedDimensions: { width: newWidth, height: newHeight }
    };

  } catch (error) {
    logger.error('Image optimization failed', { error: error.message, inputPath });
    throw error;
  }
};

const optimizeVideo = async (inputPath, outputPath, options = {}) => {
  try {
    const { quality = 'medium', maxWidth = 1920, maxHeight = 1080 } = options;

    const originalStats = await fs.promises.stat(inputPath);
    const originalSize = originalStats.size;

    // Get video info
    const videoInfo = await new Promise((resolve, reject) => {
      ffmpeg.ffprobe(inputPath, (err, metadata) => {
        if (err) {
          reject(err);
          return;
        }
        const videoStream = metadata.streams.find(stream => stream.codec_type === 'video');
        resolve({
          width: videoStream?.width || 0,
          height: videoStream?.height || 0
        });
      });
    });

    const { width, height } = videoInfo;

    let newWidth = width;
    let newHeight = height;
    
    if (width > maxWidth || height > maxHeight) {
      const ratio = Math.min(maxWidth / width, maxHeight / height);
      newWidth = Math.round(width * ratio);
      newHeight = Math.round(height * ratio);
    }

    const qualityPresets = {
      low: { crf: 28, videoBitrate: '800k', audioBitrate: '64k' },
      medium: { crf: 23, videoBitrate: '1500k', audioBitrate: '128k' },
      high: { crf: 18, videoBitrate: '2500k', audioBitrate: '192k' }
    };

    const preset = qualityPresets[quality] || qualityPresets.medium;

    const command = ffmpeg(inputPath)
      .outputOptions([
        `-c:v libx264`,
        `-preset medium`,
        `-crf ${preset.crf}`,
        `-maxrate ${preset.videoBitrate}`,
        `-bufsize ${preset.videoBitrate}`,
        `-c:a aac`,
        `-b:a ${preset.audioBitrate}`,
        `-movflags +faststart`,
        `-vf scale=${newWidth}:${newHeight}:flags=lanczos`
      ])
      .output(outputPath);

    await new Promise((resolve, reject) => {
      command
        .on('end', () => resolve())
        .on('error', (err) => reject(err))
        .run();
    });

    const optimizedStats = await fs.promises.stat(outputPath);
    const optimizedSize = optimizedStats.size;
    const compressionRatio = ((originalSize - optimizedSize) / originalSize * 100).toFixed(2);

    return {
      success: true,
      originalSize,
      optimizedSize,
      compressionRatio: parseFloat(compressionRatio),
      originalDimensions: { width, height },
      optimizedDimensions: { width: newWidth, height: newHeight }
    };

  } catch (error) {
    logger.error('Video optimization failed', { error: error.message, inputPath });
    throw error;
  }
};

const generateVideoThumbnail = async (inputPath, outputPath, time = '00:00:01') => {
  try {
    const command = ffmpeg(inputPath)
      .outputOptions([
        `-ss ${time}`,
        `-vframes 1`,
        `-q:v 2`
      ])
      .output(outputPath);

    await new Promise((resolve, reject) => {
      command
        .on('end', () => resolve())
        .on('error', (err) => reject(err))
        .run();
    });

    return { success: true, outputPath };

  } catch (error) {
    logger.error('Video thumbnail generation failed', { error: error.message, inputPath });
    throw error;
  }
};

const shouldOptimize = (filePath, fileSize) => {
  const ext = path.extname(filePath).toLowerCase().slice(1);
  const supportedImageFormats = ['jpeg', 'jpg', 'png', 'gif', 'webp'];
  const supportedVideoFormats = ['mp4', 'avi', 'mov', 'wmv', 'flv', 'webm'];
  
  if (fileSize > 10 * 1024 * 1024) return true;
  if (supportedImageFormats.includes(ext) && fileSize > 1024 * 1024) return true;
  if (supportedVideoFormats.includes(ext) && fileSize > 5 * 1024 * 1024) return true;
  
  return false;
};

// @desc    Temporary media upload endpoint (before report creation)
// @route   POST /api/reports/temp-media
// @access  Private (authenticated users)
router.post('/temp-media', protect, tempUploadWithErrorHandling, async (req, res) => {
  try {
    console.log('=== TEMP MEDIA UPLOAD STARTED ===');
    console.log('Temp media upload request:', {
      user: req.user?._id || 'no-auth',
      filesCount: req.files ? req.files.length : 0,
      files: req.files ? req.files.map(f => ({ name: f.originalname, size: f.size, type: f.mimetype })) : []
    });
    console.log('Request headers:', req.headers);
    console.log('Request body keys:', Object.keys(req.body || {}));

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No files uploaded'
      });
    }

    const uploadedMedia = [];

    for (const file of req.files) {
      console.log('Processing temp file:', {
        filename: file.filename,
        originalName: file.originalname,
        size: file.size,
        path: file.path
      });

      const mediaData = {
        id: Math.random().toString(36).substr(2, 9), // Generate temporary ID
        filename: file.filename,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        url: `/uploads/media/${file.filename}`,
        uploadedAt: new Date(),
        isTemporary: true // Mark as temporary
      };

      uploadedMedia.push(mediaData);
      console.log('Temp file processed successfully:', mediaData);
    }

    console.log('Temp upload completed:', {
      uploadedCount: uploadedMedia.length
    });

    res.status(201).json({
      success: true,
      message: 'Temporary media uploaded successfully',
      data: uploadedMedia
    });

  } catch (error) {
    console.error('Temp media upload error:', {
      error: error.message,
      stack: error.stack,
      user: req.user?._id || 'no-auth'
    });

    res.status(500).json({
      success: false,
      message: 'Error uploading temporary media',
      error: error.message
    });
  }
});



// @desc    Get all reports for a school
// @route   GET /api/reports
// @access  Private (school_admin, super_admin, teacher, parent)
router.get('/', protect, authorize('school_admin', 'super_admin', 'teacher', 'parent'), async (req, res) => {
  try {
    const { schoolId, teacherId, studentId, status, limit = 50, page = 1 } = req.query;
    const query = {};

    // Set school filter
    if (schoolId) {
      query.schoolId = schoolId;
    } else if (req.user.role !== 'super_admin') {
      query.schoolId = req.user.schoolId;
    }

    // Additional filters
    if (teacherId) query.teacherId = teacherId;
    if (studentId) query.studentId = studentId;
    if (status) query.status = status;

    // If teacher role, only show their reports
    if (req.user.role === 'teacher') {
      query.teacherId = req.user._id;
    }

    // If parent role, only show reports for their children
    if (req.user.role === 'parent') {
      // Find all children of this parent
      const children = await User.find({
        role: 'parent', // Students are stored as 'parent' role
        parentId: req.user._id,
        schoolId: req.user.schoolId
      });
      
      const childrenIds = children.map(child => child._id);
      query.studentId = { $in: childrenIds };
    }

    const reports = await Report.find(query)
      .populate('studentId', 'firstName lastName grade studentClass class')
      .populate('teacherId', 'firstName lastName')
      .populate('templateId', 'name reportFrequency')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Report.countDocuments(query);

    res.json({
      success: true,
      count: reports.length,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / limit),
      data: reports
    });
  } catch (error) {
    logger.error('Error retrieving reports', {
      service: 'reports',
      error: error.message,
      user: req.user._id
    });
    res.status(500).json({
      success: false,
      message: 'Error retrieving reports',
      error: error.message
    });
  }
});

// @desc    Check due status for a template/student for current period
// @route   GET /api/reports/due-status?studentId=...&templateId=...
// @access  Private (teacher, school_admin, super_admin)
router.get('/due-status', protect, authorize('teacher', 'school_admin', 'super_admin'), async (req, res) => {
  try {
    const { studentId, templateId } = req.query;
    
    logger.info('🔍 due-status endpoint called', {
      studentId,
      templateId,
      userId: req.user._id,
      userRole: req.user.role
    });
    
    if (!studentId || !templateId) {
      logger.warn('❌ Missing required parameters', { studentId, templateId });
      return res.status(400).json({ success: false, message: 'studentId and templateId are required' });
    }

    const template = await ReportTemplate.findById(templateId);
    if (!template) {
      return res.status(404).json({ success: false, message: 'Report template not found' });
    }

    const school = await School.findById(req.user.schoolId).select('settings');
    if (!school) {
      return res.status(400).json({ success: false, message: 'School not found for user' });
    }

    // For teachers, verify the student belongs to their classes
    if (req.user.role === 'teacher') {
      const Class = require('../models/Class');
      
      // Get teacher's assigned classes
      const teacherClasses = await Class.find({
        'assignedTeachers.teacherId': req.user._id,
        isActive: true
      });

      if (teacherClasses.length === 0) {
        return res.status(403).json({ success: false, message: 'No classes assigned to teacher' });
      }

      // Check if student is in teacher's classes
      const student = await User.findOne({
        _id: studentId,
        role: 'parent', // Students are stored as 'parent' role
        studentClass: { $in: teacherClasses.map(cls => cls.name) },
        schoolId: req.user.schoolId
      });

      if (!student) {
        return res.status(403).json({ success: false, message: 'Student not found in teacher\'s classes' });
      }
    }

    const settings = school.settings || {};
    const frequency = template.reportFrequency;
    const timezone = settings.timezone || 'UTC';
    const now = getCurrentDateInTimezone(timezone);

    logger.info('📅 Due status calculation parameters', {
      studentId,
      templateId,
      frequency,
      timezone,
      now: now.format(),
      settings: settings.reportFrequencies?.[frequency]
    });

    const lastReport = await Report.findOne({
      schoolId: req.user.schoolId,
      studentId,
      templateId
    }).sort({ createdAt: -1 }).populate('teacherId', 'firstName lastName');

    const lastReportDate = lastReport ? lastReport.createdAt : null;
    
    logger.info('📋 Last report found', {
      lastReportId: lastReport?._id,
      lastReportDate: lastReportDate ? now.format() : 'null',
      lastReportStatus: lastReport?.status
    });
    
    const due = isReportDue(frequency, settings, lastReportDate, now.toDate());
    const nextDueResult = calculateDueDate(frequency, settings, now);
    const nextDue = nextDueResult.dueDate;

    logger.info('✅ Due status result', {
      studentId,
      templateId,
      frequency,
      due,
      nextDueDate: nextDue ? nextDue.format() : 'null',
      lastReportDate: lastReportDate ? now.format() : 'null',
      timezone
    });

    // Check if there's already a report for the current period
    const periodStart = getStartOfFrequencyPeriod(frequency, settings, now.toDate());
    const existingReportInPeriod = await Report.findOne({
      schoolId: req.user.schoolId,
      studentId,
      templateId,
      createdAt: {
        $gte: periodStart
      }
    }).populate('teacherId', 'firstName lastName');
    
    const hasExistingReportInPeriod = !!existingReportInPeriod;
    const existingTeacherName = existingReportInPeriod?.teacherId 
      ? `${existingReportInPeriod.teacherId.firstName} ${existingReportInPeriod.teacherId.lastName}`
      : null;

    console.log('🔍 Due status check - existing report info:', {
      hasExistingReport: hasExistingReportInPeriod,
      existingTeacherId: existingReportInPeriod?.teacherId,
      existingTeacherName,
      existingReportId: existingReportInPeriod?._id
    });

    res.json({
      success: true,
      data: {
        due,
        nextDueDate: nextDue ? nextDue.toDate() : null,
        lastReportDate,
        timezone,
        frequency,
        hasExistingReportInPeriod,
        existingReportInPeriod: hasExistingReportInPeriod ? {
          reportId: existingReportInPeriod._id,
          teacherName: existingTeacherName,
          createdAt: existingReportInPeriod.createdAt,
          status: existingReportInPeriod.status
        } : null
      }
    });
  } catch (error) {
    logger.error('Error checking due status', { service: 'reports', error: error.message, user: req.user._id });
    res.status(500).json({ success: false, message: 'Error checking due status', error: error.message });
  }
});

// @desc    Debug frontend due report calculations
// @route   POST /api/reports/debug-due-calculations
// @access  Private (teacher)
router.post('/debug-due-calculations', protect, authorize('teacher'), async (req, res) => {
  try {
    const { studentId, templateId, frontendCalculations } = req.body;
    
    logger.info('🔍 Frontend due calculations debug', {
      studentId,
      templateId,
      frontendCalculations,
      userId: req.user._id
    });

    // Get the same data the frontend would use
    const template = await ReportTemplate.findById(templateId);
    const school = await School.findById(req.user.schoolId).select('settings');
    
    if (!template || !school) {
      return res.status(404).json({ success: false, message: 'Template or school not found' });
    }

    const settings = school.settings || {};
    const frequency = template.reportFrequency;
    const timezone = settings.timezone || 'UTC';
    const now = getCurrentDateInTimezone(timezone);

    const lastReport = await Report.findOne({
      schoolId: req.user.schoolId,
      studentId,
      templateId
    }).sort({ createdAt: -1 });

    const lastReportDate = lastReport ? lastReport.createdAt : null;
    const due = isReportDue(frequency, settings, lastReportDate, now.toDate());
    const nextDueResult = calculateDueDate(frequency, settings, now);
    const nextDue = nextDueResult.dueDate;

    const backendResult = {
      due,
      nextDueDate: nextDue ? nextDue.toDate() : null,
      lastReportDate,
      timezone,
      frequency,
      settings: settings.reportFrequencies?.[frequency]
    };

    logger.info('🔍 Backend vs Frontend comparison', {
      studentId,
      templateId,
      frontendCalculations,
      backendResult
    });

    res.json({
      success: true,
      data: {
        frontend: frontendCalculations,
        backend: backendResult,
        comparison: {
          dueMatch: frontendCalculations.due === due,
          timezoneMatch: frontendCalculations.timezone === timezone,
          frequencyMatch: frontendCalculations.frequency === frequency
        }
      }
    });
  } catch (error) {
    logger.error('Error in debug due calculations', { error: error.message, user: req.user._id });
    res.status(500).json({ success: false, message: 'Error in debug due calculations', error: error.message });
  }
});

// @desc    Test media file access
// @route   GET /api/reports/test-media/:filename
// @access  Public
router.get('/test-media/:filename', async (req, res) => {
  try {
    const { filename } = req.params;
    const filePath = path.join(__dirname, '..', 'uploads', 'media', filename);
    
    console.log('Testing media file access:', {
      filename,
      filePath,
      exists: fs.existsSync(filePath)
    });
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: 'File not found',
        filename,
        filePath
      });
    }
    
    const stats = fs.statSync(filePath);
    const ext = path.extname(filename).toLowerCase();
    
    res.json({
      success: true,
      message: 'File exists and is accessible',
      filename,
      filePath,
      size: stats.size,
      extension: ext,
      url: `/uploads/media/${filename}`,
      fullUrl: `${req.protocol}://${req.get('host')}/uploads/media/${filename}`
    });
    
  } catch (error) {
    console.error('Error testing media file:', error);
    res.status(500).json({
      success: false,
      message: 'Error testing media file',
      error: error.message
    });
  }
});

// @desc    Check due reports for current teacher and create notifications
// @route   POST /api/reports/check-due
// @access  Private (teacher)
router.post('/check-due', protect, authorize('teacher'), async (req, res) => {
  try {
    // Load teacher and school settings
    const teacher = await User.findById(req.user._id).select('schoolId grade notifications');
    const school = await School.findById(teacher.schoolId).select('settings name');
    if (!school) {
      return res.status(400).json({ success: false, message: 'School not found' });
    }

    const settings = school.settings || {};
    const timezone = settings.timezone || 'UTC';
    const now = getCurrentDateInTimezone(timezone);

    // Find students assigned to this teacher through their classes
    const Class = require('../models/Class');
    
    // Get teacher's assigned classes
    const teacherClasses = await Class.find({
      'assignedTeachers.teacherId': teacher._id,
      isActive: true
    });

    if (teacherClasses.length === 0) {
      return res.json({ success: true, message: 'No classes assigned to teacher', data: { created: 0 } });
    }

    // Get students from teacher's assigned classes
    const students = await User.find({
      role: 'parent', // Students are stored as 'parent' role
      studentClass: { $in: teacherClasses.map(cls => cls.name) },
      schoolId: teacher.schoolId,
      isActive: true
    }).select('firstName lastName studentGrade studentClass');

    if (students.length === 0) {
      return res.json({ success: true, message: 'No students in teacher\'s classes', data: { created: 0 } });
    }

    // Find templates for this school possibly matching grade
    const templates = await ReportTemplate.find({ schoolId: teacher.schoolId, isActive: true })
      .select('name reportFrequency grade');

    let createdCount = 0;
    const createdNotifications = [];

    // Iterate students x templates
    for (const student of students) {
      const studentName = `${student.firstName} ${student.lastName}`;
      // Filter templates by grade match if template has grade
      const applicableTemplates = templates.filter(t => !t.grade || !student.studentGrade || (t.grade === student.studentGrade));

      for (const template of applicableTemplates) {
        const frequency = template.reportFrequency;
        const freqConfig = settings.reportFrequencies?.[frequency];
        if (!freqConfig || freqConfig.enabled === false) {
          continue;
        }

        const lastReport = await Report.findOne({
          schoolId: teacher.schoolId,
          studentId: student._id,
          templateId: template._id
        }).sort({ createdAt: -1 });

        const lastReportDate = lastReport ? lastReport.createdAt : null;
        let isDue = false;
        let nextDue = null;
        try {
          isDue = isReportDue(frequency, settings, lastReportDate, now.toDate());
          const nextDueResult = calculateDueDate(frequency, settings, now);
        nextDue = nextDueResult.dueDate;
        } catch (e) {
          continue;
        }

        if (isDue) {
          // Avoid duplicate notifications: check if an unread notification exists for this student+template and due date day
          const nextDueDayKey = nextDue ? nextDue.clone().startOf('day').toISOString() : now.clone().startOf('day').toISOString();
          const dup = (teacher.notifications || []).some(n => {
            return n.type === 'report' && n.data && n.data.studentId === String(student._id)
              && n.data.templateId === String(template._id) && n.data.dueDayKey === nextDueDayKey && n.isRead === false;
          });
          if (dup) continue;

          const notification = {
            id: `rep-${student._id}-${template._id}-${Date.now()}`,
            type: 'report',
            title: `Report due: ${template.name}`,
            message: `A ${frequency} report for ${studentName} is due now.`,
            data: {
              studentId: String(student._id),
              studentName,
              templateId: String(template._id),
              templateName: template.name,
              frequency,
              dueDate: nextDue ? nextDue.toDate() : now.toDate(),
        dueDateTimezone: timezone,
              dueDayKey: nextDueDayKey
            }
          };

          await User.updateOne(
            { _id: teacher._id },
            { $push: { notifications: notification } }
          );
          createdCount += 1;
          createdNotifications.push(notification);
        }
      }
    }

    return res.json({ success: true, data: { created: createdCount, notifications: createdNotifications } });
  } catch (error) {
    logger.error('Error checking due reports for teacher', { service: 'reports', error: error.message, user: req.user._id });
    res.status(500).json({ success: false, message: 'Error checking due reports', error: error.message });
  }
});

// @desc    Create new report
// @route   POST /api/reports
// @access  Private (teacher, school_admin, super_admin)
router.post('/', protect, authorize('teacher', 'school_admin', 'super_admin'), async (req, res) => {
  try {
    const {
      title,
      studentId,
      templateId,
      content,
      customFieldValues,
      reportType = 'progress',
      reportPeriod,
      voiceRecording,
      aiGenerated,
      attachments,
      tags,
      categories
    } = req.body;

    // Validate required fields
    if (!title || !studentId || !templateId || !content) {
      return res.status(400).json({
        success: false,
        message: 'Title, student, template, and content are required'
      });
    }

    // Verify template exists
    const template = await ReportTemplate.findById(templateId);
    if (!template) {
      return res.status(404).json({
        success: false,
        message: 'Report template not found'
      });
    }

    // Enforce due-date rules for teachers based on school settings
    // Super Admin and School Admin can bypass enforcement; only enforce for teachers
    if (req.user.role === 'teacher') {
      try {
        const school = await School.findById(req.user.schoolId).select('settings name');
        if (!school) {
          return res.status(400).json({ success: false, message: 'School not found for user' });
        }

        const schoolSettings = school.settings || {};
        const frequency = template.reportFrequency;

        // If frequency disabled, block
        const freqConfig = schoolSettings.reportFrequencies?.[frequency];
        if (!freqConfig || freqConfig.enabled === false) {
          return res.status(403).json({
            success: false,
            message: `Report frequency "${frequency}" is disabled by school settings.`
          });
        }

        const timezone = schoolSettings.timezone || 'UTC';
        const now = getCurrentDateInTimezone(timezone);

        // Check if a report of this frequency has already been generated for this student in the current period
        // This prevents multiple teachers from generating duplicate reports for the same frequency period
        const periodStart = getStartOfFrequencyPeriod(frequency, schoolSettings, now.toDate());
        const existingReportInPeriod = await Report.findOne({
          schoolId: req.user.schoolId,
          studentId,
          templateId,
          createdAt: {
            $gte: periodStart
          }
        }).populate('teacherId', 'firstName lastName');

        if (existingReportInPeriod) {
          const existingTeacherName = existingReportInPeriod.teacherId 
            ? `${existingReportInPeriod.teacherId.firstName} ${existingReportInPeriod.teacherId.lastName}`
            : 'Another teacher';
          
          console.log('🔍 Report creation blocked - existing report found:', {
            existingTeacherId: existingReportInPeriod.teacherId,
            existingTeacherName,
            existingReportId: existingReportInPeriod._id,
            frequency
          });
          
          return res.status(403).json({
            success: false,
            message: `A ${frequency.toLowerCase()} report has already been generated for this student in the current period by ${existingTeacherName}.`,
            data: {
              frequency,
              existingReportId: existingReportInPeriod._id,
              existingReportTeacher: existingReportInPeriod.teacherId,
              existingReportTeacherName: existingTeacherName,
              existingReportDate: existingReportInPeriod.createdAt,
              periodStart,
              timezone
            }
          });
        }


        // Get the last report date for this student and template
        const lastReport = await Report.findOne({
          schoolId: req.user.schoolId,
          studentId,
          templateId
        }).sort({ createdAt: -1 });

        const lastReportDate = lastReport ? lastReport.createdAt : null;

        // Log the due date calculation inputs
        const { logDueDateCalculation, logError } = require('../utils/logger');
        logDueDateCalculation('report-creation-inputs', {
          frequency,
          schoolSettings: {
            timezone: schoolSettings.timezone,
            reportFrequencies: schoolSettings.reportFrequencies,
            frequencyConfig: schoolSettings.reportFrequencies?.[frequency]
          },
          lastReportDate: lastReportDate ? lastReportDate.toISOString() : null,
          lastReportId: lastReport?._id || null,
          currentTime: now.toISOString(),
          studentId,
          templateId,
          teacherId: req.user._id
        });

        let due = true;
        let nextDueDate = null;
        let nextDueDateTimezone = timezone;
        
        try {
          due = isReportDue(frequency, schoolSettings, lastReportDate, now.toDate());
          const nextDueResult = calculateDueDate(frequency, schoolSettings, now);
          const nextDue = nextDueResult.dueDate;
          nextDueDate = nextDue ? nextDue.toDate() : null;
          
          // Log the due date calculation results
          logDueDateCalculation('report-creation-results', {
            frequency,
            due,
            nextDueDate: nextDueDate ? nextDueDate.toISOString() : null,
            nextDueDateTimezone,
            lastReportDate: lastReportDate ? lastReportDate.toISOString() : null,
            calculationSuccess: true
          });
          
        } catch (calcErr) {
          // Log the calculation error
          logError('due-date-calculation', calcErr, {
            frequency,
            schoolSettings: {
              timezone: schoolSettings.timezone,
              reportFrequencies: schoolSettings.reportFrequencies,
              frequencyConfig: schoolSettings.reportFrequencies?.[frequency]
            },
            lastReportDate: lastReportDate ? lastReportDate.toISOString() : null,
            currentTime: now.toISOString(),
            studentId,
            templateId
          });
          
          // If calculation fails, be safe and block with message
          return res.status(400).json({
            success: false,
            message: `Unable to evaluate due date for frequency "${frequency}": ${calcErr.message}`
          });
        }

        if (!due) {
          return res.status(403).json({
            success: false,
            message: 'Report is not due yet based on school frequency configuration.',
            data: {
              frequency,
              nextDueDate,
              timezone
            }
          });
        }
      } catch (enfErr) {
        return res.status(500).json({ success: false, message: 'Failed to enforce due settings', error: enfErr.message });
      }
    }

    // Set default report period if not provided
    const defaultReportPeriod = reportPeriod || {
      startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      endDate: new Date()
    };

    // Debug logging
    console.log('🔍 Backend - Voice Recording Data:', JSON.stringify(voiceRecording, null, 2));
    console.log('🔍 Backend - Recordings Array in Input:', voiceRecording?.recordings);
    console.log('🔍 Backend - Recordings Array Length:', voiceRecording?.recordings?.length || 0);
    console.log('🔍 Backend - Attachments Data:', JSON.stringify(attachments, null, 2));
    console.log('🔍 Backend - Attachments Array Length:', attachments?.length || 0);
    
    // Create report
    const report = await Report.create({
      title,
      schoolId: req.user.schoolId,
      studentId,
      teacherId: req.user._id,
      templateId,
      content,
      customFieldValues: customFieldValues || {},
      reportType,
      reportPeriod: defaultReportPeriod,
      voiceRecording: voiceRecording || {},
      aiGenerated: aiGenerated || {},
      attachments: attachments || [],
      tags: tags || [],
      categories: categories || []
    });

    // If there are temporary media files, transfer them to the permanent report
    if (attachments && attachments.length > 0) {
      console.log('🔍 Transferring temporary media to permanent report:', {
        reportId: report._id,
        attachmentsCount: attachments.length,
        attachments: attachments.map(att => ({ 
          filename: att.filename, 
          originalName: att.originalName,
          isTemporary: att.isTemporary 
        }))
      });
      
      // Update the report with the transferred media
      const updatedReport = await Report.findByIdAndUpdate(
        report._id,
        { 
          attachments: attachments.map(att => ({
            ...att,
            isTemporary: false // Mark as permanent
          }))
        },
        { new: true }
      );
      
      console.log('✅ Media transferred successfully:', {
        reportId: updatedReport._id,
        finalAttachmentsCount: updatedReport.attachments?.length || 0
      });
    }
    
    // Debug logging after creation
    console.log('🔍 Backend - Created Report Voice Recording:', JSON.stringify(report.voiceRecording, null, 2));
    console.log('🔍 Backend - Created Report Recordings Array:', report.voiceRecording?.recordings);
    console.log('🔍 Backend - Created Report Recordings Length:', report.voiceRecording?.recordings?.length || 0);
    console.log('🔍 Backend - Created Report Attachments:', JSON.stringify(report.attachments, null, 2));
    console.log('🔍 Backend - Created Report Attachments Length:', report.attachments?.length || 0);

    const populatedReport = await Report.findById(report._id)
      .populate('studentId', 'firstName lastName grade studentClass class')
      .populate('teacherId', 'firstName lastName')
      .populate('templateId', 'name reportFrequency');

    // Debug logging after population
    console.log('🔍 Backend - Populated Report Voice Recording:', JSON.stringify(populatedReport.voiceRecording, null, 2));
    console.log('🔍 Backend - Populated Report Recordings Array:', populatedReport.voiceRecording?.recordings);
    console.log('🔍 Backend - Populated Report Recordings Length:', populatedReport.voiceRecording?.recordings?.length || 0);

    res.status(201).json({
      success: true,
      message: 'Report created successfully',
      data: populatedReport
    });
  } catch (error) {
    logger.error('Error creating report', {
      service: 'reports',
      error: error.message,
      user: req.user._id
    });
    res.status(500).json({
      success: false,
      message: 'Error creating report',
      error: error.message
    });
  }
});

// @desc    Update report
// @route   PUT /api/reports/:id
// @access  Private (teacher who created it, school_admin, super_admin)
router.put('/:id', protect, authorize('teacher', 'school_admin', 'super_admin'), async (req, res) => {
  try {
    const report = await Report.findById(req.params.id);

    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Report not found'
      });
    }

    // Check if user has permission to update
    const canUpdate = 
      req.user.role === 'super_admin' ||
      (req.user.role === 'school_admin' && report.schoolId.toString() === req.user.schoolId.toString()) ||
      (req.user.role === 'teacher' && report.teacherId.toString() === req.user._id.toString());

    if (!canUpdate) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this report'
      });
    }

    const {
      title,
      content,
      customFieldValues,
      reportType,
      reportPeriod,
      status,
      voiceRecording,
      aiGenerated,
      tags,
      categories
    } = req.body;

    // Update report
    const updatedReport = await Report.findByIdAndUpdate(
      req.params.id,
      {
        title,
        content,
        customFieldValues,
        reportType,
        reportPeriod,
        status,
        voiceRecording,
        aiGenerated,
        tags,
        categories
      },
      { new: true, runValidators: true }
    )
    .populate('studentId', 'firstName lastName grade studentClass class')
    .populate('teacherId', 'firstName lastName')
    .populate('templateId', 'name reportFrequency');

    res.json({
      success: true,
      message: 'Report updated successfully',
      data: updatedReport
    });
  } catch (error) {
    logger.error('Error updating report', {
      service: 'reports',
      error: error.message,
      user: req.user._id,
      reportId: req.params.id
    });
    res.status(500).json({
      success: false,
      message: 'Error updating report',
      error: error.message
    });
  }
});

// @desc    Approve report
// @route   PATCH /api/reports/:id/approve
// @access  Private (teacher who created it, school_admin, super_admin)
router.patch('/:id/approve', protect, authorize('teacher', 'school_admin', 'super_admin'), async (req, res) => {
  try {
    const report = await Report.findById(req.params.id);

    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Report not found'
      });
    }

    await report.approve(req.user._id, req.user.role, req.body.comments);

    const updatedReport = await Report.findById(req.params.id)
      .populate('studentId', 'firstName lastName grade studentClass class')
      .populate('teacherId', 'firstName lastName')
      .populate('templateId', 'name reportFrequency');

    res.json({
      success: true,
      message: 'Report approved successfully',
      data: updatedReport
    });
  } catch (error) {
    logger.error('Error approving report', {
      service: 'reports',
      error: error.message,
      user: req.user._id,
      reportId: req.params.id
    });
    res.status(500).json({
      success: false,
      message: 'Error approving report',
      error: error.message
    });
  }
});

// @desc    Send report to parents
// @route   PATCH /api/reports/:id/send
// @access  Private (teacher who created it, school_admin, super_admin)
router.patch('/:id/send', protect, authorize('teacher', 'school_admin', 'super_admin'), async (req, res) => {
  try {
    const { parentEmails } = req.body;
    const report = await Report.findById(req.params.id);

    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Report not found'
      });
    }

    if (!parentEmails || !Array.isArray(parentEmails) || parentEmails.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Parent emails are required'
      });
    }

    await report.sendToParents(parentEmails);

    const updatedReport = await Report.findById(req.params.id)
      .populate('studentId', 'firstName lastName grade studentClass class')
      .populate('teacherId', 'firstName lastName')
      .populate('templateId', 'name reportFrequency');

    res.json({
      success: true,
      message: 'Report sent to parents successfully',
      data: updatedReport
    });
  } catch (error) {
    logger.error('Error sending report', {
      service: 'reports',
      error: error.message,
      user: req.user._id,
      reportId: req.params.id
    });
    res.status(500).json({
      success: false,
      message: 'Error sending report',
      error: error.message
    });
  }
});

// @desc    Send report email to parent
// @route   POST /api/reports/:id/send-email
// @access  Private (teacher who created it, school_admin, super_admin)
router.post('/:id/send-email', protect, authorize('teacher', 'school_admin', 'super_admin'), async (req, res) => {
  try {
    const { parentEmail } = req.body;
    
    if (!parentEmail) {
      return res.status(400).json({
        success: false,
        message: 'Parent email is required'
      });
    }

    // Find the report with populated data
    const report = await Report.findById(req.params.id)
      .populate('studentId', 'firstName lastName grade studentClass class parentEmail studentGrade')
      .populate('teacherId', 'firstName lastName')
      .populate('schoolId', 'name');

    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Report not found'
      });
    }

    // Check if user has permission to send this report
    if (req.user.role === 'teacher' && report.teacherId._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You can only send reports you created'
      });
    }

    // Get student and teacher names
    const studentName = `${report.studentId.firstName} ${report.studentId.lastName}`;
    const teacherName = `${report.teacherId.firstName} ${report.teacherId.lastName}`;
    const schoolName = report.schoolId?.name || 'Barrana.ai School';

    // Prepare email data
    const emailData = {
      parentEmail,
      studentName,
      teacherName,
      reportTitle: report.title,
      reportContent: report.content,
      reportDate: new Date(report.createdAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }),
      schoolName,
      schoolId: report.schoolId._id.toString()
    };

    // Send the email
    const emailResult = await sendReportEmail(emailData);

    // Update report status to 'sent' if email was successful
    if (emailResult.success) {
      report.status = 'sent';
      report.sentAt = new Date();
      await report.save();
    }

    res.json({
      success: true,
      message: 'Report email sent successfully',
      data: {
        reportId: report._id,
        emailResult
      }
    });

  } catch (error) {
    logger.error('Error sending report email', {
      service: 'reports',
      error: error.message,
      user: req.user._id,
      reportId: req.params.id
    });
    
    res.status(500).json({
      success: false,
      message: 'Error sending report email',
      error: error.message
    });
  }
});

// @desc    Test media file access
// @route   GET /api/reports/test-media/:filename
// @access  Public (for testing)
router.get('/test-media/:filename', async (req, res) => {
  try {
    const { filename } = req.params;
    const filePath = path.join(__dirname, '../uploads/media', filename);
    
    console.log('Testing media file access:', {
      filename,
      filePath,
      exists: require('fs').existsSync(filePath)
    });
    
    if (require('fs').existsSync(filePath)) {
      const stats = require('fs').statSync(filePath);
      res.json({
        success: true,
        message: 'File exists',
        data: {
          filename,
          size: stats.size,
          path: filePath,
          url: `/uploads/media/${filename}`
        }
      });
    } else {
      res.status(404).json({
        success: false,
        message: 'File not found',
        data: { filename, filePath }
      });
    }
  } catch (error) {
    console.error('Test media access error:', error);
    res.status(500).json({
      success: false,
      message: 'Test media access failed',
      error: error.message
    });
  }
});

// @desc    Test temp-media endpoint (without auth)
// @route   POST /api/reports/test-temp-media
// @access  Public (for testing)
router.post('/test-temp-media', tempUploadWithErrorHandling, async (req, res) => {
  try {
    console.log('=== TEST TEMP MEDIA UPLOAD ===');
    console.log('Files received:', req.files ? req.files.length : 0);
    
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No files uploaded'
      });
    }

    const uploadedFiles = req.files.map(file => ({
      id: Math.random().toString(36).substr(2, 9), // Generate a unique ID
      filename: file.filename,
      originalName: file.originalname,
      size: file.size,
      url: `/uploads/media/${file.filename}`
    }));

    res.status(200).json({
      success: true,
      message: 'Test temp upload successful',
      data: uploadedFiles
    });

  } catch (error) {
    console.error('Test temp upload error:', error);
    res.status(500).json({
      success: false,
      message: 'Test temp upload failed',
      error: error.message
    });
  }
});

// @desc    Test upload endpoint
// @route   POST /api/reports/test-upload
// @access  Public (for testing)
router.post('/test-upload', upload.array('media', 1), async (req, res) => {
  try {
    console.log('Test upload request:', {
      filesCount: req.files ? req.files.length : 0,
      files: req.files ? req.files.map(f => ({ name: f.originalname, size: f.size, type: f.mimetype })) : []
    });

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No files uploaded'
      });
    }

    const uploadedFiles = req.files.map(file => ({
      id: Math.random().toString(36).substr(2, 9), // Generate a unique ID
      filename: file.filename,
      originalName: file.originalname,
      size: file.size,
      url: `/uploads/media/${file.filename}`
    }));

    res.status(200).json({
      success: true,
      message: 'Test upload successful',
      data: uploadedFiles
    });

  } catch (error) {
    console.error('Test upload error:', error);
    res.status(500).json({
      success: false,
      message: 'Test upload failed',
      error: error.message
    });
  }
});

// @desc    Upload media files for a report
// @route   POST /api/reports/:reportId/media
// @access  Private (teacher who created the report, school_admin, super_admin)
router.post('/:reportId/media', protect, authorize('teacher', 'school_admin', 'super_admin'), upload.array('media', 10), async (req, res) => {
  try {
    const { reportId } = req.params;
    
    console.log('Media upload request:', {
      reportId,
      user: req.user._id,
      filesCount: req.files ? req.files.length : 0,
      files: req.files ? req.files.map(f => ({ name: f.originalname, size: f.size, type: f.mimetype })) : []
    });
    
    // Find the report
    const report = await Report.findById(reportId);
    if (!report) {
      console.log('Report not found:', reportId);
      return res.status(404).json({
        success: false,
        message: 'Report not found'
      });
    }

    // Check if user has permission to upload media for this report
    if (req.user.role === 'teacher' && report.teacherId.toString() !== req.user._id.toString()) {
      console.log('Permission denied for user:', req.user._id, 'report teacher:', report.teacherId);
      return res.status(403).json({
        success: false,
        message: 'You can only upload media for reports you created'
      });
    }

    if (!req.files || req.files.length === 0) {
      console.log('No files uploaded');
      return res.status(400).json({
        success: false,
        message: 'No files uploaded'
      });
    }

    const uploadedMedia = [];

    for (const file of req.files) {
      console.log('Processing file:', {
        filename: file.filename,
        originalName: file.originalname,
        size: file.size,
        path: file.path
      });

      const mediaData = {
        id: Math.random().toString(36).substr(2, 9), // Generate a unique ID
        filename: file.filename,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        url: `/uploads/media/${file.filename}`,
        uploadedAt: new Date()
      };

      // Add to report attachments
      report.attachments.push(mediaData);
      uploadedMedia.push(mediaData);
      
      console.log('File processed successfully:', mediaData);
    }

    console.log('Saving report with attachments:', {
      reportId,
      attachmentsCount: report.attachments.length,
      uploadedMediaCount: uploadedMedia.length
    });

    await report.save();

    console.log('Report saved successfully');

    logger.info(`Media uploaded for report ${reportId}`, {
      service: 'reports',
      user: req.user._id,
      reportId,
      fileCount: req.files.length
    });

    res.status(201).json({
      success: true,
      message: 'Media uploaded successfully',
      data: uploadedMedia
    });

  } catch (error) {
    console.error('Error uploading media:', {
      error: error.message,
      stack: error.stack,
      user: req.user._id,
      reportId: req.params.reportId
    });

    logger.error('Error uploading media', {
      service: 'reports',
      error: error.message,
      user: req.user._id,
      reportId: req.params.reportId
    });

    res.status(500).json({
      success: false,
      message: 'Error uploading media',
      error: error.message
    });
  }
});

// @desc    Get media files for a report
// @route   GET /api/reports/:reportId/media
// @access  Private (teacher who created the report, school_admin, super_admin)
router.get('/:reportId/media', protect, authorize('teacher', 'school_admin', 'super_admin'), async (req, res) => {
  try {
    const { reportId } = req.params;
    
    // Find the report
    const report = await Report.findById(reportId);
    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Report not found'
      });
    }

    // Check if user has permission to view media for this report
    if (req.user.role === 'teacher' && report.teacherId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You can only view media for reports you created'
      });
    }

    res.json({
      success: true,
      data: report.attachments || []
    });

  } catch (error) {
    logger.error('Error fetching media', {
      service: 'reports',
      error: error.message,
      user: req.user._id,
      reportId: req.params.reportId
    });

    res.status(500).json({
      success: false,
      message: 'Error fetching media',
      error: error.message
    });
  }
});

// @desc    Delete a media file from a report
// @route   DELETE /api/reports/:reportId/media/:mediaId
// @access  Private (teacher who created the report, school_admin, super_admin)
router.delete('/:reportId/media/:mediaId', protect, authorize('teacher', 'school_admin', 'super_admin'), async (req, res) => {
  try {
    const { reportId, mediaId } = req.params;
    
    // Find the report
    const report = await Report.findById(reportId);
    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Report not found'
      });
    }

    // Check if user has permission to delete media for this report
    if (req.user.role === 'teacher' && report.teacherId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You can only delete media for reports you created'
      });
    }

    // Find the media file
    const mediaIndex = report.attachments.findIndex(attachment => attachment._id.toString() === mediaId);
    if (mediaIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Media file not found'
      });
    }

    const mediaFile = report.attachments[mediaIndex];

    // Delete the file from disk
    const filePath = path.join(__dirname, '..', mediaFile.url);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    // Remove from report attachments
    report.attachments.splice(mediaIndex, 1);
    await report.save();

    logger.info(`Media deleted from report ${reportId}`, {
      service: 'reports',
      user: req.user._id,
      reportId,
      mediaId
    });

    res.json({
      success: true,
      message: 'Media deleted successfully'
    });

  } catch (error) {
    logger.error('Error deleting media', {
      service: 'reports',
      error: error.message,
      user: req.user._id,
      reportId: req.params.reportId,
      mediaId: req.params.mediaId
    });

    res.status(500).json({
      success: false,
      message: 'Error deleting media',
      error: error.message
    });
  }
});

module.exports = router;