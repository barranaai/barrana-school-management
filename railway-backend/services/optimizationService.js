const sharp = require('sharp');
const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs').promises;
const { logger } = require('../utils/logger');

// Set ffmpeg path for production
if (process.env.NODE_ENV === 'production') {
  const ffmpegPath = require('ffmpeg-static');
  ffmpeg.setFfmpegPath(ffmpegPath);
}

class OptimizationService {
  constructor() {
    this.supportedImageFormats = ['jpeg', 'jpg', 'png', 'gif', 'webp'];
    this.supportedVideoFormats = ['mp4', 'avi', 'mov', 'wmv', 'flv', 'webm'];
  }

  async optimizeImage(inputPath, outputPath, options = {}) {
    try {
      const { quality = 85, maxWidth = 1920, maxHeight = 1080 } = options;

      const originalStats = await fs.stat(inputPath);
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

      const optimizedStats = await fs.stat(outputPath);
      const optimizedSize = optimizedStats.size;
      const compressionRatio = ((originalSize - optimizedSize) / originalSize * 100).toFixed(2);

      return {
        success: true,
        originalSize,
        optimizedSize,
        compressionRatio: parseFloat(compressionRatio),
        originalDimensions: { width, height },
        optimizedDimensions: { width: newWidth, height: newHeight },
        format: 'jpeg',
        outputPath
      };

    } catch (error) {
      logger.error('Image optimization failed', { error: error.message, inputPath });
      throw error;
    }
  }

  async optimizeVideo(inputPath, outputPath, options = {}) {
    try {
      const { quality = 'medium', maxWidth = 1920, maxHeight = 1080 } = options;

      const originalStats = await fs.stat(inputPath);
      const originalSize = originalStats.size;

      const videoInfo = await this.getVideoInfo(inputPath);
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

      const optimizedStats = await fs.stat(outputPath);
      const optimizedSize = optimizedStats.size;
      const compressionRatio = ((originalSize - optimizedSize) / originalSize * 100).toFixed(2);

      return {
        success: true,
        originalSize,
        optimizedSize,
        compressionRatio: parseFloat(compressionRatio),
        originalDimensions: { width, height },
        optimizedDimensions: { width: newWidth, height: newHeight },
        format: 'mp4',
        outputPath
      };

    } catch (error) {
      logger.error('Video optimization failed', { error: error.message, inputPath });
      throw error;
    }
  }

  async getVideoInfo(inputPath) {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(inputPath, (err, metadata) => {
        if (err) {
          reject(err);
          return;
        }

        const videoStream = metadata.streams.find(stream => stream.codec_type === 'video');
        
        resolve({
          width: videoStream?.width || 0,
          height: videoStream?.height || 0,
          duration: metadata.format.duration || 0,
          bitrate: metadata.format.bit_rate || 0
        });
      });
    });
  }

  async generateVideoThumbnail(inputPath, outputPath, time = '00:00:01') {
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
  }

  shouldOptimize(filePath, fileSize) {
    const ext = path.extname(filePath).toLowerCase().slice(1);
    
    if (fileSize > 10 * 1024 * 1024) return true;
    if (this.supportedImageFormats.includes(ext) && fileSize > 1024 * 1024) return true;
    if (this.supportedVideoFormats.includes(ext) && fileSize > 5 * 1024 * 1024) return true;
    
    return false;
  }

  getFileType(filePath) {
    const ext = path.extname(filePath).toLowerCase().slice(1);
    
    if (this.supportedImageFormats.includes(ext)) return 'image';
    if (this.supportedVideoFormats.includes(ext)) return 'video';
    
    return 'unknown';
  }
}

module.exports = new OptimizationService();
