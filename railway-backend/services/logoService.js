const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { logger } = require('../utils/logger');

// Configure multer for logo uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads/logos');
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename with school ID
    const schoolId = req.params.id || req.body.schoolId;
    const timestamp = Date.now();
    const extension = path.extname(file.originalname);
    const filename = `school-${schoolId}-logo-${timestamp}${extension}`;
    cb(null, filename);
  }
});

// File filter for images only
const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPEG, PNG, GIF, and WebP images are allowed.'), false);
  }
};

// Configure multer upload
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  }
});

// Upload logo for a school
const uploadSchoolLogo = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    const schoolId = req.params.id;
    const logoUrl = `/uploads/logos/${req.file.filename}`;
    
    logger.info(`Logo uploaded successfully for school ${schoolId}`, {
      filename: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype
    });

    res.json({
      success: true,
      message: 'Logo uploaded successfully',
      data: {
        logoUrl,
        filename: req.file.filename,
        originalName: req.file.originalname,
        size: req.file.size,
        mimetype: req.file.mimetype
      }
    });

  } catch (error) {
    logger.error('Error uploading logo:', error);
    res.status(500).json({
      success: false,
      message: 'Error uploading logo',
      error: error.message
    });
  }
};

// Get logo URL for a school
const getSchoolLogo = async (schoolId) => {
  try {
    const logoDir = path.join(__dirname, '../uploads/logos');
    const files = fs.readdirSync(logoDir);
    
    // Find logo file for this school
    const logoFile = files.find(file => file.startsWith(`school-${schoolId}-logo-`));
    
    if (logoFile) {
      return `/uploads/logos/${logoFile}`;
    }
    
    return null; // No logo found
  } catch (error) {
    logger.error('Error getting school logo:', error);
    return null;
  }
};

// Delete logo for a school
const deleteSchoolLogo = async (req, res) => {
  try {
    const schoolId = req.params.id;
    const logoDir = path.join(__dirname, '../uploads/logos');
    const files = fs.readdirSync(logoDir);
    
    // Find and delete logo file for this school
    const logoFile = files.find(file => file.startsWith(`school-${schoolId}-logo-`));
    
    if (logoFile) {
      const logoPath = path.join(logoDir, logoFile);
      fs.unlinkSync(logoPath);
      
      logger.info(`Logo deleted successfully for school ${schoolId}`, {
        filename: logoFile
      });

      res.json({
        success: true,
        message: 'Logo deleted successfully'
      });
    } else {
      res.status(404).json({
        success: false,
        message: 'No logo found for this school'
      });
    }

  } catch (error) {
    logger.error('Error deleting logo:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting logo',
      error: error.message
    });
  }
};

module.exports = {
  upload,
  uploadSchoolLogo,
  getSchoolLogo,
  deleteSchoolLogo
}; 