import axios from 'axios';

export interface MediaFile {
  id: string;
  file: File;
  type: 'image' | 'video';
  url?: string;
  thumbnail?: string;
  size: number;
  name: string;
  uploaded?: boolean;
  uploadProgress?: number;
}

export interface UploadedMedia {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
  thumbnail?: string;
  uploadedAt: string;
  isTemporary?: boolean;
}

class MediaService {
  private baseURL: string;

  constructor() {
    this.baseURL = process.env.REACT_APP_API_URL || 'http://localhost:5050/api';
  }

  // Upload a single media file
  async uploadMedia(file: File, reportId: string, onProgress?: (progress: number) => void): Promise<UploadedMedia> {
    try {
      const formData = new FormData();
      formData.append('media', file);
      formData.append('reportId', reportId);

      console.log('Uploading media file:', {
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        reportId
      });

      // Use temporary upload endpoint if reportId starts with 'temp_'
      const endpoint = reportId.startsWith('temp_') ? '/temp-media' : `/${reportId}/media`;
      const fullUrl = `${this.baseURL}/reports${endpoint}`;
      
      console.log('Upload endpoint:', fullUrl);
      
      const token = localStorage.getItem('token');
      console.log('🔑 Token available:', !!token, token ? `${token.substring(0, 20)}...` : 'none');

      console.log('📤 Starting axios upload request...');
      const startTime = Date.now();
      
      const response = await axios.post(fullUrl, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          'Authorization': `Bearer ${token}`
        },
        timeout: 60000, // 60 second timeout
        onUploadProgress: (progressEvent) => {
          console.log(`📊 Upload progress: ${progressEvent.loaded}/${progressEvent.total} bytes`);
          if (onProgress && progressEvent.total) {
            const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            onProgress(progress);
          }
        }
      });
      
      const endTime = Date.now();
      console.log(`✅ Upload completed in ${endTime - startTime}ms`);

      console.log('Upload response:', response.data);
      
      // Handle different response structures
      let mediaData;
      if (response.data.data && Array.isArray(response.data.data)) {
        // Multiple files uploaded
        mediaData = response.data.data[0]; // Take the first file
      } else if (response.data.data) {
        // Single file uploaded
        mediaData = response.data.data;
      } else if (Array.isArray(response.data)) {
        // Direct array response
        mediaData = response.data[0];
      } else {
        // Direct object response
        mediaData = response.data;
      }
      
      console.log('Processed media data:', mediaData);
      
      // Ensure the response has an id field
      if (mediaData && !mediaData.id) {
        mediaData.id = Math.random().toString(36).substr(2, 9);
      }
      
      // Ensure the response has a url field
      if (mediaData && !mediaData.url) {
        console.error('❌ Media data missing URL:', mediaData);
        throw new Error('Upload response missing URL field');
      }
      
      return mediaData;
    } catch (error: any) {
      console.error('❌ Upload error in mediaService:', error);
      console.error('📋 Upload error details:', {
        message: error.message,
        code: error.code,
        status: error.response?.status,
        responseData: error.response?.data,
        timeout: error.code === 'ECONNABORTED',
        fileName: file.name,
        fileSize: file.size
      });
      
      if (error.code === 'ECONNABORTED') {
        throw new Error(`Upload timeout for ${file.name}. File might be too large or connection is slow.`);
      }
      
      throw new Error(error.response?.data?.message || `Failed to upload ${file.name}: ${error.message}`);
    }
  }

  // Upload multiple media files with retry mechanism
  async uploadMultipleMedia(files: File[], reportId: string, onProgress?: (fileId: string, progress: number) => void): Promise<UploadedMedia[]> {
    console.log('Starting multiple media upload:', {
      fileCount: files.length,
      reportId,
      files: files.map(f => ({ name: f.name, size: f.size, type: f.type }))
    });

    const uploadPromises = files.map(async (file) => {
      const fileId = Math.random().toString(36).substr(2, 9);
      const progressCallback = onProgress ? (progress: number) => onProgress(fileId, progress) : undefined;
      
      // Retry mechanism
      let retries = 2;
      let lastError;
      
      while (retries >= 0) {
        try {
          return await this.uploadMedia(file, reportId, progressCallback);
        } catch (error: any) {
          lastError = error;
          console.error(`Error uploading file ${file.name} (${2 - retries + 1} attempt):`, error);
          
          // Don't retry for certain errors
          if (error.response?.status === 401 || error.response?.status === 413 || error.response?.status === 400) {
            throw error;
          }
          
          retries--;
          if (retries >= 0) {
            // Wait before retrying (exponential backoff)
            const delay = Math.pow(2, 2 - retries) * 1000;
            console.log(`Retrying upload for ${file.name} in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      }
      
      throw lastError;
    });

    try {
      const results = await Promise.all(uploadPromises);
      console.log('Multiple upload completed:', results);
      
      // Ensure each result has an id field
      const processedResults = results.map(result => {
        if (result && !result.id) {
          result.id = Math.random().toString(36).substr(2, 9);
        }
        return result;
      });
      
      return processedResults;
    } catch (error) {
      console.error('Multiple upload failed:', error);
      throw error;
    }
  }

  // Delete a media file
  async deleteMedia(reportId: string, mediaId: string): Promise<boolean> {
    try {
      const response = await axios.delete(`${this.baseURL}/reports/${reportId}/media/${mediaId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      return response.data.success;
    } catch (error) {
      console.error('Error deleting media:', error);
      throw new Error('Failed to delete media file');
    }
  }

  // Get media files for a report
  async getReportMedia(reportId: string): Promise<UploadedMedia[]> {
    try {
      const response = await axios.get(`${this.baseURL}/reports/${reportId}/media`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.data.success) {
        // Add id field to each attachment if it's missing (for backward compatibility)
        const mediaWithIds = (response.data.data || []).map((media: any, index: number) => ({
          ...media,
          id: media.id || media._id || `media_${index}_${Date.now()}`
        }));
        
        return mediaWithIds;
      } else {
        return [];
      }
    } catch (error) {
      console.error('Error fetching report media:', error);
      return [];
    }
  }

  // Validate file type and size
  validateFile(file: File): { isValid: boolean; error?: string } {
    const maxSize = 50 * 1024 * 1024; // 50MB
    const allowedImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    const allowedVideoTypes = ['video/mp4', 'video/avi', 'video/mov', 'video/wmv', 'video/flv', 'video/webm'];

    if (file.size > maxSize) {
      return { isValid: false, error: 'File size must be less than 50MB' };
    }

    if (!allowedImageTypes.includes(file.type) && !allowedVideoTypes.includes(file.type)) {
      return { isValid: false, error: 'File type not supported. Please upload images (JPEG, PNG, GIF, WebP) or videos (MP4, AVI, MOV, WMV, FLV, WebM)' };
    }

    return { isValid: true };
  }

  // Create preview URL for file
  createPreviewURL(file: File): string {
    return URL.createObjectURL(file);
  }

  // Clean up preview URL
  revokePreviewURL(url: string): void {
    URL.revokeObjectURL(url);
  }

  // Get file type
  getFileType(file: File): 'image' | 'video' {
    const imageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    return imageTypes.includes(file.type) ? 'image' : 'video';
  }

  // Format file size
  formatFileSize(bytes: number): string {
    if (!bytes || bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

export const mediaService = new MediaService();
