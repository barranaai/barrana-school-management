const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const moment = require('moment-timezone');
const Report = require('../models/Report');
const { canExposeProgressReport, finalizedParentContent } = require('../utils/reportPublication');
const ReportTemplate = require('../models/ReportTemplate');
const Progress = require('../models/Progress');
const ChildParticipation = require('../models/ChildParticipation');
const DeliveredSession = require('../models/DeliveredSession');
const Enrollment = require('../models/Enrollment');
const User = require('../models/User');
const School = require('../models/School');
const { calculateDueDate, isReportDue, getCurrentDateInTimezone, getStartOfFrequencyPeriod } = require('../utils/dateUtils');
const loggerUtils = require('../utils/logger');
const logger = loggerUtils.logger;
const { protect, authorize } = require('../middleware/auth');
const { developmentOnly } = require('../middleware/environment');
const { canAccessReport, canAccessStudent, belongsToSchool, scopeSchoolId } = require('../middleware/resourceAuthorization');
const { requireActiveOrganization } = require('../middleware/lifecycleAuthorization');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
// Sharp is optional - may not be available in all environments
let sharp = null;
try {
  sharp = require('sharp');
} catch (error) {
  console.log('Sharp not available in reports route - image processing disabled');
}
const { sendReportEmail } = require('../services/emailService');
const firebaseService = require('../services/firebaseService');
const { createReportPdf } = require('../services/reportPdf');
const { compatibleTemplates, compatibility } = require('../services/reportTemplateContext');
const { canTeacherAccessParticipantReporting } = require('../services/reportParticipantAuthorization');
const { resolveWorkspaceProfile } = require('../domain/workspaceProfile');

// Maximum number of media attachments (images + videos combined) per report.
// Enforced on create and on append-media routes. Mirrored in the Report model.
const MAX_REPORT_ATTACHMENTS = 10;

const reportSchoolId = (req, source = req.query) => scopeSchoolId(req.user, source?.schoolId);

const reportMediaUploadDir = () => process.env.REPORT_MEDIA_UPLOAD_DIR || 'uploads/media';

async function cleanupRequestUploads(req) {
  const files = Array.isArray(req.files) ? req.files : (req.file ? [req.file] : []);
  await Promise.all(files.map(async file => {
    if (!file?.path) return;
    try { await fs.promises.unlink(file.path); }
    catch (error) { if (error.code !== 'ENOENT') logger.warn('Failed to clean up rejected report upload', { service: 'reports', code: error.code || 'UPLOAD_CLEANUP_FAILED' }); }
  }));
}

async function authorizeReportMediaUpload(req, res, next) {
  try {
    const schoolId = scopeSchoolId(req.user, req.query?.schoolId);
    if (!schoolId) return res.status(400).json({ success: false, message: 'Organization context is required' });
    const report = await Report.findOne({ _id: req.params.reportId, schoolId });
    if (!report || !canAccessReport(req.user, report)) return res.status(404).json({ success: false, message: 'Report not found' });
    if (report.progressId && ['approved', 'sent', 'archived'].includes(report.status)) return res.status(409).json({ success: false, message: 'Finalized reports cannot have media changed' });
    req.report = report;
    next();
  } catch (_error) {
    return res.status(404).json({ success: false, message: 'Report not found' });
  }
}

async function progressReportContext(progressId, schoolId) {
  const progress = await Progress.findOne({ _id: progressId, schoolId });
  if (!progress) return null;
  const participation = await ChildParticipation.findOne({ _id: progress.childParticipationId, schoolId });
  const session = participation && await DeliveredSession.findOne({ _id: participation.deliveredSessionId, schoolId });
  const enrollment = participation && await Enrollment.findOne({ _id: participation.enrollmentId, schoolId, childId: participation.childId });
  if (!participation || !session || !enrollment || String(participation.programId) !== String(session.programId) || String(participation.levelId) !== String(session.levelId) || String(enrollment.programId) !== String(session.programId)) return { conflict: true };
  const [school, child] = await Promise.all([School.findById(schoolId).select('accountType organizationType terminologyProfile'), User.findOne({ _id: participation.childId, schoolId }).select('studentGrade')]);
  if (!school || !child) return { conflict: true };
  return { progress, participation, session, enrollment, context: { schoolId, programId: session.programId, levelId: session.levelId, grade: child.studentGrade, allowLegacyGrade: resolveWorkspaceProfile(school).capabilities.requiresAcademicReportGrade } };
}

async function legacyReportContext(req, suppliedSchoolId, studentId, templateId, { requireCompatibleEnrollment = false } = {}) {
  const schoolId = scopeSchoolId(req.user, suppliedSchoolId);
  if (![schoolId, studentId, templateId].every(value => mongoose.Types.ObjectId.isValid(value))) return { error: 'Reporting context not found', status: 404 };
  const [template, student, school] = await Promise.all([
    ReportTemplate.findOne({ _id: templateId, schoolId, isActive: true }),
    User.findOne({ _id: studentId, schoolId, role: 'student' }).select('studentGrade schoolId role isActive').lean(),
    School.findById(schoolId).select('settings accountType organizationType terminologyProfile')
  ]);
  if (!template || !student || !school) return { error: 'Reporting context not found', status: 404 };
  if (req.user.role === 'teacher') {
    const teacher = await User.findById(req.user._id).select('schoolId role isActive');
    if (!teacher || !await canTeacherAccessParticipantReporting(teacher, student)) return { error: 'Reporting context not found', status: 404 };
  }
  if (!requireCompatibleEnrollment) return { schoolId, template, student, school };
  const enrollments = await Enrollment.find({ schoolId, childId: student._id, status: { $in: ['active', 'pending'] } })
    .select('_id programId currentLevelId status').lean();
  const allowLegacyGrade = resolveWorkspaceProfile(school).capabilities.requiresAcademicReportGrade;
  const compatibleEnrollment = enrollments.find(enrollment => compatibility(template, {
    schoolId, programId: enrollment.programId, levelId: enrollment.currentLevelId,
    grade: student.studentGrade, allowLegacyGrade
  }));
  if (!compatibleEnrollment) return { error: 'The selected report template is not compatible with an active Enrollment', status: 409 };
  return { schoolId, template, student, school, enrollment: compatibleEnrollment };
}

router.get('/from-progress/:progressId/templates', protect, authorize('teacher', 'school_admin', 'super_admin'), async (req, res) => {
  try {
    const schoolId = scopeSchoolId(req.user, req.query.schoolId);
    if (!mongoose.Types.ObjectId.isValid(schoolId) || !mongoose.Types.ObjectId.isValid(req.params.progressId)) return res.status(404).json({ success: false, message: 'Progress not found' });
    const source = await progressReportContext(req.params.progressId, schoolId);
    if (!source) return res.status(404).json({ success: false, message: 'Progress not found' });
    if (source.conflict) return res.status(409).json({ success: false, message: 'Progress reporting context is inconsistent' });
    if (req.user.role === 'teacher' && String(source.session.deliveredBy) !== String(req.user._id)) return res.status(403).json({ success: false, message: 'Not authorized to create a report for this Progress' });
    const templates = await ReportTemplate.find({ schoolId, isActive: true }).populate('programId', 'name').populate('levelId', 'name');
    res.json({ success: true, data: compatibleTemplates(templates, source.context), context: { programId: source.session.programId, levelId: source.session.levelId } });
  } catch (_) { res.status(500).json({ success: false, message: 'Unable to load compatible report templates' }); }
});


// Create a deterministic, Progress-backed draft without introducing AI or changing legacy report creation.
router.post('/from-progress/:progressId', protect, authorize('teacher', 'school_admin', 'super_admin'), requireActiveOrganization, async (req, res) => {
  try {
    const schoolId = scopeSchoolId(req.user, req.body?.schoolId);
    if (!mongoose.Types.ObjectId.isValid(schoolId) || !mongoose.Types.ObjectId.isValid(req.params.progressId)) return res.status(404).json({ success: false, message: 'Progress not found' });
    const source = await progressReportContext(req.params.progressId, schoolId);
    if (!source) return res.status(404).json({ success: false, message: 'Progress not found' });
    if (source.conflict) return res.status(409).json({ success: false, message: 'Progress reporting context is inconsistent' });
    const { progress, participation, session } = source;
    if (['cancelled', 'absent', 'excused'].includes(participation.status)) return res.status(409).json({ success: false, message: 'Progress source participation is not valid for a report' });
    if (session.status === 'cancelled') return res.status(409).json({ success: false, message: 'Progress source session is cancelled' });
    if (req.user.role === 'teacher' && String(session.deliveredBy) !== String(req.user._id)) return res.status(403).json({ success: false, message: 'Not authorized to create a report for this Progress' });
    const template = req.body?.templateId && await ReportTemplate.findOne({ _id: req.body.templateId, schoolId, isActive: true });
    if (!template) return res.status(400).json({ success: false, message: 'A valid active templateId is required' });
    if (!compatibility(template, source.context)) return res.status(400).json({ success: false, message: 'The selected report template is not compatible with this Program and Level' });
    const templateSnapshot = {
      templateId: template._id,
      name: template.name,
      programId: template.programId,
      levelId: template.levelId,
      grade: template.grade,
      reportFrequency: template.reportFrequency,
      content: template.content,
      customFields: (template.customFields || []).map(field => ({
        name: field.name,
        type: field.type,
        isRequired: field.isRequired,
        options: field.options,
        defaultValue: field.defaultValue
      })),
      settings: template.settings ? {
        includeStudentPhoto: template.settings.includeStudentPhoto,
        includeTeacherSignature: template.settings.includeTeacherSignature,
        includeSchoolLogo: template.settings.includeSchoolLogo,
        autoSendToParents: template.settings.autoSendToParents,
        requireTeacherApproval: template.settings.requireTeacherApproval
      } : undefined
    };
    const existing = await Report.findOne({ schoolId, progressId: progress._id, status: { $in: ['draft', 'review', 'approved', 'sent'] } });
    if (existing) return res.status(409).json({ success: false, message: 'A report already exists for this Progress', data: { reportId: existing._id } });
    const objectiveText = (progress.objectiveResults || []).map(o => `${o.sequence}. ${o.title}: ${o.status}${o.instructorNote ? ` — ${o.instructorNote}` : ''}`).join('\n');
    const parameterText = (progress.parameterResults || []).map(p => `${p.parameterLabel}: ${String(p.value)}${p.note ? ` — ${p.note}` : ''}`).join('\n');
    const content = [`Session: ${session.title}`, objectiveText && `Objectives:\n${objectiveText}`, parameterText && `Parameters:\n${parameterText}`, progress.observations && `Observations:\n${progress.observations}`, progress.recommendations && `Recommendations:\n${progress.recommendations}`].filter(Boolean).join('\n\n');
    const snapshot = { progressId: progress._id, progressRevisionNumber: progress.revisionNumber || 1, childParticipationId: participation._id, deliveredSessionId: session._id, programId: session.programId, levelId: session.levelId, objectiveResults: progress.objectiveResults, parameterResults: progress.parameterResults, observations: progress.observations, recommendations: progress.recommendations, overallStatus: progress.overallStatus, capturedAt: new Date(), progressUpdatedAt: progress.updatedAt };
    const start = session.scheduledAt || new Date();
    const report = await Report.create({ title: req.body.title || `${session.title} Progress Report`, schoolId, studentId: participation.childId, teacherId: session.deliveredBy, templateId: template._id, templateSnapshot, content: content || 'Progress report draft', customFieldValues: {}, reportType: 'progress', reportPeriod: { startDate: start, endDate: session.deliveredAt || start }, status: 'draft', progressId: progress._id, childParticipationId: participation._id, deliveredSessionId: session._id, progressSnapshot: snapshot, aiGenerated: { isAiGenerated: false } });
    res.status(201).json({ success: true, message: 'Progress-backed report draft created', data: report });
  } catch (error) { res.status(400).json({ success: false, message: error.code === 11000 ? 'A report already exists for this Progress' : error.message }); }
});

// Check if ffmpeg is available
let ffmpeg = null;

try {
  ffmpeg = require('fluent-ffmpeg');
} catch (error) {
  console.log('FFmpeg not available in reports route - audio/video processing disabled');
}

// Configure multer for file uploads with report ID
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = reportMediaUploadDir();
    // Create directory if it doesn't exist
    try {
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      cb(null, uploadDir);
    } catch (error) {
      console.warn('Could not create upload directory:', error.message);
      // Use temp directory as fallback
      cb(null, '/tmp');
    }
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
    const uploadDir = reportMediaUploadDir();
    console.log('Temp storage destination:', uploadDir);
    // Create directory if it doesn't exist
    try {
      if (!fs.existsSync(uploadDir)) {
        console.log('Creating upload directory:', uploadDir);
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      cb(null, uploadDir);
    } catch (error) {
      console.warn('Could not create temp upload directory:', error.message);
      // Use temp directory as fallback
      cb(null, '/tmp');
    }
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
      logger.warn('Temporary report media upload rejected', { service: 'reports', code: err.code || 'UPLOAD_LIMIT' });
      return cleanupRequestUploads(req).then(() => res.status(400).json({ success: false, message: `File upload error: ${err.message}` }));
    } else if (err) {
      logger.error('Temporary report media upload failed', { service: 'reports', code: err.code || 'UPLOAD_FAILED' });
      return cleanupRequestUploads(req).then(() => res.status(500).json({ success: false, message: `Upload error: ${err.message}` }));
    }
    next();
  });
};

const reportUploadWithErrorHandling = (req, res, next) => {
  upload.array('media', 10)(req, res, err => {
    if (!err) return next();
    cleanupRequestUploads(req).then(() => res.status(err instanceof multer.MulterError ? 400 : 500).json({
      success: false,
      message: err instanceof multer.MulterError ? `File upload error: ${err.message}` : `Upload error: ${err.message}`
    }));
  });
};

// FFmpeg configuration - optional
// if (process.env.NODE_ENV === 'production') {
//   const ffmpegPath = require('ffmpeg-static');
//   ffmpeg.setFfmpegPath(ffmpegPath);
// }

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
router.post('/temp-media', protect, authorize('teacher', 'school_admin', 'super_admin'), requireActiveOrganization, tempUploadWithErrorHandling, async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No files uploaded'
      });
    }

    const uploadedMedia = [];

    for (const file of req.files) {
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
    }

    logger.info('Temporary report media upload completed', { service: 'reports', fileCount: uploadedMedia.length });

    res.status(201).json({
      success: true,
      message: 'Temporary media uploaded successfully',
      data: uploadedMedia
    });

  } catch (error) {
    await cleanupRequestUploads(req);
    logger.error('Temporary report media upload failed', { service: 'reports', code: error.code || 'UPLOAD_FAILED' });

    res.status(500).json({
      success: false,
      message: 'Error uploading temporary media',
      error: error.message
    });
  }
});



// @desc    Get all reports for a school
// @route   GET /api/reports
// @access  Private (school_admin, super_admin, teacher)
router.get('/', protect, authorize('school_admin', 'super_admin', 'teacher'), async (req, res) => {
  try {
    const { schoolId, teacherId, studentId, status, limit = 50, page = 1 } = req.query;
    const query = {};

    const scopedSchoolId = scopeSchoolId(req.user, schoolId);
    if (!scopedSchoolId) return res.status(400).json({ success: false, message: 'Organization context is required' });
    query.schoolId = scopedSchoolId;

    // Additional filters
    if (teacherId) query.teacherId = teacherId;
    if (studentId) query.studentId = studentId;
    if (status) query.status = status;

    // If teacher role, only show their reports
    if (req.user.role === 'teacher') {
      query.teacherId = req.user._id;
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
// 
// NOTE: This endpoint uses dateUtils directly for single student/template checks.
// For bulk due reports checking, use GET /api/reports/due which uses the centralized calculator.
// Both use the same underlying dateUtils.calculateDueDate() function (now case-insensitive).
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

    const context = await legacyReportContext(req, req.query.schoolId, studentId, templateId);
    if (context.error) return res.status(context.status).json({ success: false, message: context.error });
    const { template, school, schoolId } = context;

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
      schoolId,
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
      schoolId,
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
router.post('/debug-due-calculations', developmentOnly, protect, authorize('teacher'), async (req, res) => {
  try {
    const { studentId, templateId, frontendCalculations } = req.body;
    
    logger.info('🔍 Frontend due calculations debug', {
      studentId,
      templateId,
      frontendCalculations,
      userId: req.user._id
    });

    const context = await legacyReportContext(req, req.body.schoolId, studentId, templateId);
    if (context.error) return res.status(context.status).json({ success: false, message: context.error });
    const { template, school, schoolId } = context;

    const settings = school.settings || {};
    const frequency = template.reportFrequency;
    const timezone = settings.timezone || 'UTC';
    const now = getCurrentDateInTimezone(timezone);

    const lastReport = await Report.findOne({
      schoolId,
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
router.get('/test-media/:filename', developmentOnly, protect, async (req, res) => {
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
router.post('/check-due', protect, authorize('teacher'), requireActiveOrganization, async (req, res) => {
  try {
    const { calculateDueReportsForTeacher } = require('../services/dueReportsCalculator');
    const teacher = await User.findById(req.user._id).select('notifications');
    if (!teacher) return res.status(403).json({ success: false, message: 'Teacher not found' });
    const dueReports = await calculateDueReportsForTeacher(String(req.user._id));
    const createdNotifications = [];
    for (const item of dueReports) {
      const dueDayKey = new Date(item.dueDate).toISOString().slice(0, 10);
      const duplicate = (teacher.notifications || []).some(n => n.type === 'report' && n.data?.enrollmentId === item.enrollmentId && n.data?.templateId === item.templateId && n.data?.dueDayKey === dueDayKey && n.isRead === false);
      if (duplicate) continue;
      const notification = { id: `rep-${item.enrollmentId}-${item.templateId}-${Date.now()}`, type: 'report', title: `Report due: ${item.templateName}`, message: `A ${item.frequency} report for ${item.studentName} is due now.`, data: { studentId:item.studentId, studentName:item.studentName, enrollmentId:item.enrollmentId, programId:item.programId, levelId:item.levelId, templateId:item.templateId, templateName:item.templateName, frequency:item.frequency, dueDate:item.dueDate, dueDayKey } };
      await User.updateOne({ _id: teacher._id }, { $push: { notifications: notification } });
      createdNotifications.push(notification);
    }
    res.json({ success:true, data:{ created:createdNotifications.length, notifications:createdNotifications } });
  } catch (error) { logger.error('Error checking due reports for teacher', { service:'reports', error:error.message, user:req.user._id }); res.status(500).json({ success:false, message:'Error checking due reports' }); }
});
// @desc    Create new report
// @route   POST /api/reports
// @access  Private (teacher, school_admin, super_admin)
router.post('/', protect, authorize('teacher', 'school_admin', 'super_admin'), requireActiveOrganization, async (req, res) => {
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

    // Enforce max attachment cap on create
    if (Array.isArray(attachments) && attachments.length > MAX_REPORT_ATTACHMENTS) {
      return res.status(400).json({
        success: false,
        message: `A report cannot have more than ${MAX_REPORT_ATTACHMENTS} media attachments.`,
        data: {
          provided: attachments.length,
          max: MAX_REPORT_ATTACHMENTS
        }
      });
    }

    const context = await legacyReportContext(req, req.body.schoolId, studentId, templateId, { requireCompatibleEnrollment: true });
    if (context.error) return res.status(context.status).json({ success: false, message: context.error });
    const { template, student, schoolId } = context;

    // Enforce due-date rules for teachers based on school settings
    // Super Admin and School Admin can bypass enforcement; only enforce for teachers
    if (req.user.role === 'teacher') {
      try {
        const school = await School.findById(schoolId).select('settings name');
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
          schoolId,
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
          schoolId,
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
      schoolId,
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
      .populate('studentId', 'firstName lastName grade studentClass class parentEmail')
      .populate('teacherId', 'firstName lastName')
      .populate('templateId', 'name reportFrequency');

    // Debug logging after population
    console.log('🔍 Backend - Populated Report Voice Recording:', JSON.stringify(populatedReport.voiceRecording, null, 2));
    console.log('🔍 Backend - Populated Report Recordings Array:', populatedReport.voiceRecording?.recordings);
    console.log('🔍 Backend - Populated Report Recordings Length:', populatedReport.voiceRecording?.recordings?.length || 0);

    // Send push notification and create in-app notification for parent (don't wait for it)
    setImmediate(async () => {
      try {
        const student = populatedReport.studentId;
        
        if (student && student.parentEmail) {
          // Find parent user account
          const parentUser = await User.findOne({
            email: student.parentEmail,
            role: 'parent',
            schoolId
          });

          if (parentUser) {
            const studentName = `${student.firstName} ${student.lastName}`;
            const teacherName = `${populatedReport.teacherId.firstName} ${populatedReport.teacherId.lastName}`;
            const reportTitle = populatedReport.templateId?.name || 'Report';

            // Create in-app notification
            try {
              parentUser.notifications.push({
                id: `report_${populatedReport._id}_${Date.now()}`,
                type: 'report',
                title: 'New Report',
                message: `A new ${reportTitle} for ${studentName} has been generated by ${teacherName}.`,
                data: {
                  reportId: populatedReport._id.toString(),
                  studentId: student._id.toString(),
                  studentName: studentName,
                  reportTitle: reportTitle,
                  teacherName: teacherName,
                  reportType: populatedReport.reportType
                },
                isRead: false,
                createdAt: new Date()
              });
              await parentUser.save();
              logger.info(`In-app notification created for parent`, {
                parentEmail: student.parentEmail,
                reportId: populatedReport._id
              });
            } catch (notifSaveError) {
              logger.error('Error saving in-app notification:', notifSaveError);
            }

            // Send push notification if tokens available
            if (parentUser.fcmTokens && parentUser.fcmTokens.length > 0) {
              await firebaseService.sendNotificationToUser(
                parentUser,
                {
                  title: '📋 New Report Available',
                  body: `A new ${reportTitle} for ${studentName} has been generated by ${teacherName}.`,
                  type: 'report_generated',
                  priority: 'high'
                },
                {
                  reportId: populatedReport._id.toString(),
                  studentId: student._id.toString(),
                  studentName: studentName,
                  reportTitle: reportTitle,
                  teacherName: teacherName,
                  reportType: populatedReport.reportType
                }
              );

              logger.info(`Push notification sent to parent for new report`, {
                parentEmail: student.parentEmail,
                studentName: studentName,
                reportId: populatedReport._id
              });
            }
          }
        }
      } catch (notifError) {
        // Log but don't fail the request
        logger.error('Error sending notification for new report:', {
          error: notifError.message,
          reportId: populatedReport._id
        });
      }
    });

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
// Compare-and-swap for Progress-backed draft/review writes. __v is Mongoose's
// revision token; the separate application 'version' field remains unchanged.
const editableProgressRevision = report => ({
  _id: report._id, schoolId: report.schoolId, teacherId: report.teacherId,
  progressId: report.progressId, status: { $in: ['draft', 'review'] },
  finalizedSnapshot: null,
  __v: report.__v === undefined ? { $exists: false } : report.__v
});
const staleReportResponse = res => res.status(409).json({
  success: false, code: 'REPORT_REVISION_CONFLICT',
  message: 'Report changed or was finalized. Reload before trying again.'
});

router.put('/:id', protect, authorize('teacher', 'school_admin', 'super_admin'), requireActiveOrganization, async (req, res) => {
  try {
    const schoolId = reportSchoolId(req, req.body);
    if (!schoolId) return res.status(400).json({ success: false, message: 'Organization context is required' });
    const report = await Report.findOne({ _id: req.params.id, schoolId });

    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Report not found'
      });
    }

    if (!canAccessReport(req.user, report))
      return res.status(404).json({ success: false, message: 'Report not found' });
    if (['approved', 'sent', 'archived'].includes(report.status)) {
      return res.status(409).json({ success: false, message: 'Finalized reports cannot be edited' });
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
      voiceRecording,
      aiGenerated,
      tags,
      categories
    } = req.body;

    const changes = { title, content, customFieldValues, reportType, reportPeriod,
      voiceRecording, aiGenerated, tags, categories };
    const updatedReport = await (report.progressId
      ? Report.findOneAndUpdate(editableProgressRevision(report),
        { $set: changes, $inc: { __v: 1 } }, { new: true, runValidators: true })
      : Report.findByIdAndUpdate(req.params.id, changes, { new: true, runValidators: true }))
    .populate('studentId', 'firstName lastName grade studentClass class')
    .populate('teacherId', 'firstName lastName')
    .populate('templateId', 'name reportFrequency');

    if (!updatedReport && report.progressId) return staleReportResponse(res);

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
router.patch('/:id/approve', protect, authorize('teacher', 'school_admin', 'super_admin'), requireActiveOrganization, async (req, res) => {
  try {
    const schoolId = reportSchoolId(req, req.body);
    if (!schoolId) return res.status(400).json({ success: false, message: 'Organization context is required' });
    const report = await Report.findOne({ _id: req.params.id, schoolId });

    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Report not found'
      });
    }

    if (!canAccessReport(req.user, report))
      return res.status(404).json({ success: false, message: 'Report not found' });
    if (['approved', 'sent', 'archived'].includes(report.status)) return res.status(409).json({ success: false, message: 'Report is already finalized' });
    if (report.progressId && (!report.progressSnapshot || !report.templateSnapshot)) return res.status(409).json({ success: false, message: 'Progress-backed report snapshots are incomplete' });
    if (report.progressId) {
      const finalizedSnapshot = {
        finalizedAt: new Date(), finalizedBy: req.user._id,
        reportContent: report.content, customFieldValues: report.customFieldValues,
        progressSnapshot: report.progressSnapshot, templateSnapshot: report.templateSnapshot,
        attachments: (report.attachments || []).map(a => ({ filename: a.filename, originalName: a.originalName, mimeType: a.mimeType, size: a.size, url: a.url, uploadedAt: a.uploadedAt })),
        parentVisibleContent: report.content,
        reportMetadata: { title: report.title, reportType: report.reportType, reportPeriod: report.reportPeriod }
      };
      const finalized = await Report.findOneAndUpdate(editableProgressRevision(report), {
        $set: { status: 'approved', finalizedSnapshot },
        $push: { approvals: { userId: req.user._id, role: req.user.role, status: 'approved', comments: req.body.comments, approvedAt: finalizedSnapshot.finalizedAt } },
        $inc: { __v: 1 }
      }, { new: true, runValidators: true });
      if (!finalized) return staleReportResponse(res);
    } else await report.approve(req.user._id, req.user.role, req.body.comments);

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
// Both public endpoints execute this handler exactly once. No implicit resend.
// This process-local guard prevents overlapping requests; it is not a distributed lock.
const publishing = new Set();
function deliveryData(report) {
  const published = report.progressId ? finalizedParentContent(report) : null;
  return {
    studentName: [report.studentId.firstName, report.studentId.lastName].join(' '),
    teacherName: [report.teacherId.firstName, report.teacherId.lastName].join(' '),
    reportTitle: published ? published.title : report.title,
    reportContent: published ? published.content : report.content,
    reportDate: new Date(published ? report.finalizedSnapshot.finalizedAt : report.createdAt).toISOString().slice(0, 10),
    schoolName: report.schoolId.name, schoolId: String(report.schoolId._id),
    schoolLogo: report.schoolId.branding?.logo || report.schoolId.logo || null,
    reportId: String(report._id), studentId: String(report.studentId._id),
    attachments: published ? published.attachments : (report.attachments || [])
  };
}
const reportQuery = (id, schoolId) => Report.findOne({ _id: id, schoolId })
  .populate('studentId', 'firstName lastName parentEmail')
  .populate('teacherId', 'firstName lastName')
  .populate('schoolId', 'name branding logo');
async function publishReport(req, res) {
  const key = String(req.params.id).toLowerCase();
  if (publishing.has(key)) return res.status(409).json({ success: false, outcome: 'publication_blocked', message: 'Publication is in progress or requires reconciliation; do not resend automatically' });
  publishing.add(key);
  let accepted = false;
  try {
    const schoolId = reportSchoolId(req, req.body);
    if (!schoolId) return res.status(400).json({ success: false, outcome: 'not_authorized', message: 'Organization context is required' });
    const report = await reportQuery(req.params.id, schoolId);
    if (!report || !canAccessReport(req.user, report)) return res.status(404).json({ success: false, outcome: 'not_authorized', message: 'Report not found' });
    if (report.status === 'sent') return res.status(409).json({ success: false, outcome: 'already_sent', message: 'Report was already sent; no email was sent again' });
    if (report.status === 'archived' || (report.progressId && (report.status !== 'approved' || !canExposeProgressReport(report)))) return res.status(409).json({ success: false, outcome: 'not_finalized', message: 'Report must be approved with a valid finalized snapshot' });
    const recipients = req.body.parentEmails || [req.body.parentEmail];
    const expected = report.studentId?.parentEmail?.trim().toLowerCase();
    if (!Array.isArray(recipients) || !recipients.length || !expected || recipients.some(email => typeof email !== 'string' || email.trim().toLowerCase() !== expected)) return res.status(403).json({ success: false, outcome: 'not_authorized', message: 'Recipient is not authorized for this report' });
    // The current child model has one parent email. Deduplicate aliases/array entries.
    const data = { ...deliveryData(report), parentEmail: expected };
    const parentUser = await User.findOne({ schoolId: report.schoolId._id, role: 'parent', email: expected }).select('phoneNumber phone preferences fcmTokens');
    data.parentPhoneNumber = parentUser?.phoneNumber || parentUser?.phone;
    data.whatsappEnabled = parentUser?.preferences?.notifications?.whatsapp || false;
    data.parentId = parentUser?._id;
    data.preparePdf = options => createReportPdf(report, { ...data, ...options });
    const result = await sendReportEmail(data);
    if (result.simulated) return res.json({ success: false, outcome: 'simulated', message: 'Development simulation only; report was not sent', data: { reportId: report._id, simulated: true, transportAccepted: false } });
    if (!result.transportAccepted) throw Object.assign(new Error('Email transport did not accept the message'), { code: 'delivery_failure' });
    accepted = true;
    report.status = 'sent';
    report.parentCommunication = { ...(report.parentCommunication?.toObject?.() || report.parentCommunication || {}), isSent: true, sentAt: result.acceptedAt, sentTo: [{ email: expected, method: 'email' }] };
    report.pdfArtifact = result.pdfArtifact;
    try { await report.save(); } catch (_) {
      // Keep the local guard until reconciliation/restart; never automatically resend.
      return res.status(500).json({ success: false, outcome: 'persistence_failure', message: 'Transport accepted the email, but report persistence failed. Reconcile before any retry.', data: { reportId: report._id, transportAccepted: true, messageId: result.messageId } });
    }
    publishing.delete(key);
    setImmediate(async () => {
      try { if (parentUser?.fcmTokens?.length) await firebaseService.sendNotificationToUser(parentUser, { title: 'Report sent', body: data.reportTitle + ' was accepted by the email transport.', type: 'report_sent' }, { reportId: String(report._id) }); }
      catch (_) { logger.warn('Report push notification failed'); }
    });
    return res.json({ success: true, outcome: 'sent', message: 'Email transport accepted the report; inbox delivery is not confirmed', data: { reportId: report._id, transportAccepted: true, simulated: false, messageId: result.messageId, sentAt: result.acceptedAt, pdfUrl: '/api/parents/me/reports/' + report._id + '/pdf' } });
  } catch (error) {
    accepted = accepted || error.transportAccepted === true;
    const outcome = accepted ? 'persistence_failure' : (['pdf_failure', 'configuration_failure'].includes(error.code) ? error.code : 'delivery_failure');
    return res.status(outcome === 'configuration_failure' ? 503 : 502).json({ success: false, outcome, message: accepted ? 'Transport accepted; completion failed. Reconcile before retry.' : outcome === 'pdf_failure' ? 'PDF generation failed; no email was sent' : 'Email publication failed; report remains unsent', data: { transportAccepted: accepted } });
  } finally { if (!accepted) publishing.delete(key); }
}
router.patch('/:id/send', protect, authorize('teacher', 'school_admin', 'super_admin'), requireActiveOrganization, publishReport);
router.post('/:id/send-email', protect, authorize('teacher', 'school_admin', 'super_admin'), requireActiveOrganization, publishReport);

// Explicit human-authorized repair; never sends email or changes approval/communication.
router.post('/:id/regenerate-pdf', protect, authorize('teacher', 'school_admin', 'super_admin'), requireActiveOrganization, async (req, res) => {
  try {
    const schoolId = reportSchoolId(req, req.body);
    if (!schoolId) return res.status(400).json({ success: false, message: 'Organization context is required' });
    const report = await reportQuery(req.params.id, schoolId);
    if (!report || !canAccessReport(req.user, report)) return res.status(404).json({ success: false, message: 'Report not found' });
    if (!['approved', 'sent'].includes(report.status) || (report.progressId && !canExposeProgressReport(report))) return res.status(409).json({ success: false, message: 'Report is not finalized' });
    const pdf = await createReportPdf(report, deliveryData(report));
    report.pdfArtifact = pdf.artifact;
    await report.save();
    res.json({ success: true, data: { reportId: report._id, pdfUrl: '/api/parents/me/reports/' + report._id + '/pdf' } });
  } catch (_) { res.status(500).json({ success: false, message: 'PDF regeneration failed' }); }
});

// @desc    Test media file access
// @route   GET /api/reports/test-media/:filename
// @access  Public (for testing)
router.get('/test-media/:filename', developmentOnly, protect, async (req, res) => {
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
router.post('/test-temp-media', developmentOnly, protect, requireActiveOrganization, tempUploadWithErrorHandling, async (req, res) => {
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
router.post('/test-upload', developmentOnly, protect, requireActiveOrganization, upload.array('media', 1), async (req, res) => {
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
router.post('/:reportId/media', protect, authorize('teacher', 'school_admin', 'super_admin'), requireActiveOrganization, authorizeReportMediaUpload, reportUploadWithErrorHandling, async (req, res) => {
  try {
    const { reportId } = req.params;

    const report = req.report;

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No files uploaded'
      });
    }

    if (req.files.some(file => !file.path || !file.filename || !file.originalname || !file.mimetype || !Number.isFinite(file.size))) {
      await cleanupRequestUploads(req);
      return res.status(400).json({ success: false, message: 'Invalid attachment metadata' });
    }

    // Enforce max attachment cap before persisting any new files.
    // Multer has already written files to disk; clean them up if rejected.
    const currentCount = report.attachments?.length || 0;
    const incomingCount = req.files.length;
    if (currentCount + incomingCount > MAX_REPORT_ATTACHMENTS) {
      await cleanupRequestUploads(req);
      return res.status(400).json({
        success: false,
        message: `A report cannot have more than ${MAX_REPORT_ATTACHMENTS} media attachments. This report already has ${currentCount}; ${incomingCount} more would exceed the limit.`,
        data: {
          current: currentCount,
          incoming: incomingCount,
          max: MAX_REPORT_ATTACHMENTS,
          remaining: Math.max(0, MAX_REPORT_ATTACHMENTS - currentCount)
        }
      });
    }

    const uploadedMedia = [];

    for (const file of req.files) {
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
    }

    await report.save();

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
    await cleanupRequestUploads(req);
    logger.error('Error uploading media', {
      service: 'reports',
      code: error.code || 'UPLOAD_FAILED',
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
    const schoolId = reportSchoolId(req);
    if (!schoolId) return res.status(400).json({ success: false, message: 'Organization context is required' });
    
    // Find the report
    const report = await Report.findOne({ _id: reportId, schoolId });
    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Report not found'
      });
    }

    if (!canAccessReport(req.user, report))
      return res.status(404).json({ success: false, message: 'Report not found' });
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
router.delete('/:reportId/media/:mediaId', protect, authorize('teacher', 'school_admin', 'super_admin'), requireActiveOrganization, async (req, res) => {
  try {
    const { reportId, mediaId } = req.params;

    const schoolId = scopeSchoolId(req.user, req.query?.schoolId || req.body?.schoolId);
    if (!schoolId) return res.status(400).json({ success: false, message: 'Organization context is required' });
    const report = await Report.findOne({ _id: reportId, schoolId });
    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Report not found'
      });
    }

    if (!canAccessReport(req.user, report))
      return res.status(404).json({ success: false, message: 'Report not found' });
    if (report.progressId && ['approved', 'sent', 'archived'].includes(report.status)) return res.status(409).json({ success: false, message: 'Finalized reports cannot have media changed' });
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

/**
 * @route   POST /api/reports/check-due
 * @desc    Manually trigger due report check for the current teacher
 * @access  Teacher only
 */
router.post('/check-due', protect, authorize('teacher'), requireActiveOrganization, async (req, res) => {
  try {
    const { checkDueReports } = require('../services/reminderScheduler');
    
    logger.info(`Manual due report check triggered by teacher ${req.user._id}`, {
      service: 'reports',
      user: req.user._id
    });

    // Run the check
    await checkDueReports();

    res.json({
      success: true,
      message: 'Due reports check completed successfully'
    });

  } catch (error) {
    logger.error('Error in manual due report check', {
      service: 'reports',
      error: error.message,
      user: req.user._id
    });

    res.status(500).json({
      success: false,
      message: 'Error checking due reports',
      error: error.message
    });
  }
});

/**
 * GET /api/reports/due
 * Get due reports for current teacher using centralized calculator
 * Returns consistent results across all platforms
 */
router.get('/due', protect, authorize('teacher'), async (req, res) => {
  try {
    const { calculateDueReportsForTeacher } = require('../services/dueReportsCalculator');
    
    logger.info(`📊 Getting due reports for teacher ${req.user._id}`, {
      service: 'reports',
      user: req.user._id
    });

    const dueReports = await calculateDueReportsForTeacher(req.user._id.toString());

    res.json({
      success: true,
      data: {
        dueReports,
        count: dueReports.length,
        calculatedAt: new Date()
      },
      message: `Found ${dueReports.length} due report(s)`
    });

  } catch (error) {
    logger.error('Error getting due reports', {
      service: 'reports',
      error: error.message,
      user: req.user._id
    });

    res.status(500).json({
      success: false,
      message: 'Error calculating due reports',
      error: error.message
    });
  }
});

/**
 * POST /api/reports/can-generate
 * Check if a specific report can be generated
 * Validates cross-teacher conflicts
 */
router.post('/can-generate', protect, authorize('teacher'), async (req, res) => {
  try {
    const { studentId, templateId } = req.body;
    
    if (!studentId || !templateId) {
      return res.status(400).json({
        success: false,
        message: 'studentId and templateId are required'
      });
    }
    
    const context = await legacyReportContext(req, req.body.schoolId, studentId, templateId);
    if (context.error) return res.status(context.status).json({ success: false, message: context.error });
    const { canGenerateReport } = require('../services/dueReportsCalculator');
    
    const result = await canGenerateReport(
      req.user._id.toString(),
      studentId,
      templateId
    );

    res.json({
      success: true,
      data: result
    });

  } catch (error) {
    logger.error('Error checking if report can be generated', {
      service: 'reports',
      error: error.message,
      user: req.user._id
    });

    res.status(500).json({
      success: false,
      message: 'Error checking report status',
      error: error.message
    });
  }
});

/** Return templates compatible with each qualifying Enrollment for this participant. */
router.get('/available-templates/:studentId', protect, authorize('teacher'), async (req, res) => {
  try {
    const teacher = await User.findById(req.user._id).select('schoolId role isActive');
    const student = teacher && await User.findOne({ _id:req.params.studentId, schoolId:teacher.schoolId, role:'student' }).select('firstName lastName studentGrade schoolId').lean();
    if (!teacher || !student || !await canTeacherAccessParticipantReporting(teacher, student)) return res.status(404).json({ success:false, message:'Participant not found' });
    const school = await School.findById(teacher.schoolId).select('settings accountType organizationType terminologyProfile');
    if (!school) return res.status(404).json({ success:false, message:'Organization not found' });
    const [enrollments,templates] = await Promise.all([
      Enrollment.find({ schoolId:teacher.schoolId, childId:student._id, status:{ $in:['active','pending'] } }).select('_id programId currentLevelId status').lean(),
      ReportTemplate.find({ schoolId:teacher.schoolId, isActive:true }).select('_id name reportFrequency grade programId levelId isActive').lean()
    ]);
    const academic=resolveWorkspaceProfile(school).capabilities.requiresAcademicReportGrade;
    const settings=school.settings||{},now=moment().tz(settings.timezone||'UTC');
    const {getReportForCurrentPeriod}=require('../services/dueReportsCalculator');
    const contexts=[];
    for(const enrollment of enrollments){
      const compatible=compatibleTemplates(templates,{schoolId:teacher.schoolId,programId:enrollment.programId,levelId:enrollment.currentLevelId,grade:student.studentGrade,allowLegacyGrade:academic});
      const availableTemplates=await Promise.all(compatible.map(async template=>{const existing=await getReportForCurrentPeriod(student._id,String(template._id),String(teacher.schoolId),template.reportFrequency,settings,now);return{...template,isAvailable:!existing,existingReport:existing?{id:existing._id,createdAt:existing.createdAt,status:existing.status}:undefined};}));
      contexts.push({enrollmentId:enrollment._id,programId:enrollment.programId,levelId:enrollment.currentLevelId,availableTemplates});
    }
    const availableTemplates=Array.from(new Map(contexts.flatMap(context=>context.availableTemplates).map(template=>[String(template._id),template])).values());
    res.json({success:true,data:{student:{id:student._id,name:`${student.firstName} ${student.lastName}`,grade:student.studentGrade},contexts,availableTemplates,totalTemplates:availableTemplates.length,availableCount:availableTemplates.filter(template=>template.isAvailable).length,unavailableCount:availableTemplates.filter(template=>!template.isAvailable).length,timezone:settings.timezone||'UTC',calculatedAt:new Date().toISOString()}});
  } catch(error){logger.error('Error getting available templates',{error:error.message,studentId:req.params.studentId});res.status(500).json({success:false,message:'Error getting available templates'});}
});
module.exports = router;
