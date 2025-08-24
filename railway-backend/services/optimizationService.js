// Simplified Optimization Service for Railway Deployment
// Note: FFmpeg functionality is disabled for Railway deployment
// Use Sharp for image optimization instead

const path = require('path');
const fs = require('fs').promises;

// Check if sharp is available (may fail in some environments)
let sharp = null;
try {
  sharp = require('sharp');
  console.log('Sharp module loaded successfully');
} catch (error) {
  console.log('Sharp not available - image optimization disabled:', error.message);
}

// Check if ffmpeg is available (it won't be in Railway)
let ffmpeg = null;
try {
  ffmpeg = require('fluent-ffmpeg');
  console.log('FFmpeg module loaded successfully');
} catch (error) {
  console.log('FFmpeg not available - audio/video optimization disabled');
}

class OptimizationService {
  constructor() {
    this.ffmpegAvailable = !!ffmpeg;
    this.sharpAvailable = !!sharp;
    console.log('OptimizationService initialized:', { 
      sharp: this.sharpAvailable, 
      ffmpeg: this.ffmpegAvailable 
    });
  }

  // Image optimization using Sharp (if available)
  async optimizeImage(inputPath, outputPath, options = {}) {
    if (!this.sharpAvailable) {
      console.log('Image optimization disabled - Sharp not available');
      return inputPath;
    }

    try {
      const {
        quality = 80,
        width,
        height,
        format = 'jpeg'
      } = options;

      let sharpInstance = sharp(inputPath);

      // Resize if dimensions provided
      if (width || height) {
        sharpInstance = sharpInstance.resize(width, height, {
          fit: 'inside',
          withoutEnlargement: true
        });
      }

      // Convert format and set quality
      switch (format.toLowerCase()) {
        case 'jpeg':
        case 'jpg':
          sharpInstance = sharpInstance.jpeg({ quality });
          break;
        case 'png':
          sharpInstance = sharpInstance.png({ quality });
          break;
        case 'webp':
          sharpInstance = sharpInstance.webp({ quality });
          break;
        default:
          sharpInstance = sharpInstance.jpeg({ quality });
      }

      await sharpInstance.toFile(outputPath);
      return outputPath;
    } catch (error) {
      console.error('Image optimization failed:', error);
      // Return original path if optimization fails
      return inputPath;
    }
  }

  // Audio optimization (disabled in Railway)
  async optimizeAudio(inputPath, outputPath, options = {}) {
    if (!this.ffmpegAvailable) {
      console.log('Audio optimization disabled - FFmpeg not available');
      return inputPath;
    }

    try {
      const {
        bitrate = '128k',
        format = 'mp3'
      } = options;

      return new Promise((resolve, reject) => {
        const command = ffmpeg(inputPath)
          .audioBitrate(bitrate)
          .format(format)
          .on('end', () => resolve(outputPath))
          .on('error', (err) => {
            console.error('Audio optimization failed:', err);
            resolve(inputPath); // Return original if optimization fails
          })
          .save(outputPath);
      });
    } catch (error) {
      console.error('Audio optimization error:', error);
      return inputPath;
    }
  }

  // Video optimization (disabled in Railway)
  async optimizeVideo(inputPath, outputPath, options = {}) {
    if (!this.ffmpegAvailable) {
      console.log('Video optimization disabled - FFmpeg not available');
      return inputPath;
    }

    try {
      const {
        videoBitrate = '1000k',
        audioBitrate = '128k',
        format = 'mp4'
      } = options;

      return new Promise((resolve, reject) => {
        ffmpeg.ffprobe(inputPath, (err, metadata) => {
          if (err) {
            console.error('Video probe failed:', err);
            resolve(inputPath);
            return;
          }

          const command = ffmpeg(inputPath)
            .videoBitrate(videoBitrate)
            .audioBitrate(audioBitrate)
            .format(format)
            .on('end', () => resolve(outputPath))
            .on('error', (err) => {
              console.error('Video optimization failed:', err);
              resolve(inputPath);
            })
            .save(outputPath);
        });
      });
    } catch (error) {
      console.error('Video optimization error:', error);
      return inputPath;
    }
  }

  // Get file metadata (simplified for Railway)
  async getFileMetadata(filePath) {
    try {
      const stats = await fs.stat(filePath);
      const ext = path.extname(filePath).toLowerCase();
      
      const metadata = {
        size: stats.size,
        format: ext.replace('.', ''),
        created: stats.birthtime,
        modified: stats.mtime
      };

      // Try to get image metadata if it's an image and Sharp is available
      if (this.sharpAvailable && ['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(ext)) {
        try {
          const imageInfo = await sharp(filePath).metadata();
          metadata.width = imageInfo.width;
          metadata.height = imageInfo.height;
        } catch (error) {
          console.log('Could not get image metadata:', error.message);
        }
      }

      return metadata;
    } catch (error) {
      console.error('Error getting file metadata:', error);
      return null;
    }
  }

  // Batch optimize images
  async optimizeImages(files, options = {}) {
    const results = [];
    
    for (const file of files) {
      try {
        const optimizedPath = await this.optimizeImage(file.path, file.path, options);
        results.push({
          original: file.path,
          optimized: optimizedPath,
          success: true
        });
      } catch (error) {
        console.error(`Failed to optimize ${file.path}:`, error);
        results.push({
          original: file.path,
          optimized: file.path,
          success: false,
          error: error.message
        });
      }
    }

    return results;
  }
}

module.exports = new OptimizationService();
