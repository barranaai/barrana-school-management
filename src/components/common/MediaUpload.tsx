import React, { useState, useRef, useCallback } from 'react';
import {
  Box,
  Button,
  Typography,
  Paper,
  IconButton,
  LinearProgress,
  Chip,
  Grid,
  Card,
  CardMedia,
  CardContent,
  CardActions,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Tooltip,
} from '@mui/material';
import {
  CloudUpload,
  PhotoCamera,
  Videocam,
  Delete,
  Visibility,
  Close,
  Add,
  Image,
  Movie,
} from '@mui/icons-material';
import { mediaService, type MediaFile, type UploadedMedia } from '../../services/mediaService';
import toast from 'react-hot-toast';

interface MediaUploadProps {
  reportId?: string;
  onMediaUploaded?: (media: UploadedMedia[]) => void;
  onMediaDeleted?: (mediaId: string) => void;
  maxFiles?: number;
  acceptedTypes?: ('image' | 'video')[];
  disabled?: boolean;
}

const MediaUpload: React.FC<MediaUploadProps> = ({
  reportId,
  onMediaUploaded,
  onMediaDeleted,
  maxFiles = 10,
  acceptedTypes = ['image', 'video'],
  disabled = false,
}) => {
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([]);
  const [uploadedMedia, setUploadedMedia] = useState<UploadedMedia[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [previewDialog, setPreviewDialog] = useState<{ open: boolean; media: MediaFile | UploadedMedia | null }>({
    open: false,
    media: null,
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle file selection
  const handleFileSelect = useCallback((files: FileList | null) => {
    console.log('🔍 handleFileSelect called with files:', files);
    if (!files) {
      console.log('🔍 No files provided to handleFileSelect');
      return;
    }

    const newFiles: MediaFile[] = [];
    const fileArray = Array.from(files);
    console.log('🔍 File array:', fileArray.map(f => ({ name: f.name, size: f.size, type: f.type })));

    for (const file of fileArray) {
      // Check if we've reached the maximum number of files
      if (mediaFiles.length + uploadedMedia.length + newFiles.length >= maxFiles) {
        toast.error(`Maximum ${maxFiles} files allowed`);
        break;
      }

      // Validate file
      const validation = mediaService.validateFile(file);
      if (!validation.isValid) {
        toast.error(validation.error || 'Invalid file');
        continue;
      }

      // Check if file type is accepted
      const fileType = mediaService.getFileType(file);
      if (!acceptedTypes.includes(fileType)) {
        toast.error(`${fileType} files are not accepted`);
        continue;
      }

      const mediaFile: MediaFile = {
        id: Math.random().toString(36).substr(2, 9),
        file,
        type: fileType,
        url: mediaService.createPreviewURL(file),
        size: file.size,
        name: file.name,
        uploaded: false,
        uploadProgress: 0,
      };

      newFiles.push(mediaFile);
    }

    if (newFiles.length > 0) {
      console.log('🔍 Setting new media files:', newFiles.map(f => ({ id: f.id, name: f.name, type: f.type })));
      setMediaFiles(prev => [...prev, ...newFiles]);
    } else {
      console.log('🔍 No new files to add');
    }
  }, [mediaFiles.length, uploadedMedia.length, maxFiles, acceptedTypes]);

  // Handle drag and drop
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileSelect(e.dataTransfer.files);
  }, [handleFileSelect]);

  // Handle file input change
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFileSelect(e.target.files);
    // Reset input value to allow selecting the same file again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Upload files
  const uploadFiles = async () => {
    console.log('🔍 uploadFiles called with:', { reportId, mediaFilesCount: mediaFiles.length });
    if (!reportId) {
      console.log('🔍 No reportId provided, cannot upload');
      return;
    }
    if (mediaFiles.length === 0) {
      console.log('🔍 No media files to upload');
      return;
    }

    console.log('Starting upload process:', {
      reportId,
      mediaFilesCount: mediaFiles.length,
      mediaFiles: mediaFiles.map(mf => ({ name: mf.name, size: mf.size, type: mf.type }))
    });

    setIsUploading(true);
    const filesToUpload = mediaFiles.map(mf => mf.file);

    try {
      const uploaded = await mediaService.uploadMultipleMedia(
        filesToUpload,
        reportId,
        (fileId, progress) => {
          setMediaFiles(prev => 
            prev.map(mf => 
              mf.id === fileId ? { ...mf, uploadProgress: progress } : mf
            )
          );
        }
      );

      console.log('Upload completed successfully:', uploaded);
      console.log('🔍 Uploaded media URLs:', uploaded.map(m => ({ id: m.id, url: m.url, originalName: m.originalName })));

      // Clean up preview URLs
      mediaFiles.forEach(mf => {
        if (mf.url) {
          mediaService.revokePreviewURL(mf.url);
        }
      });

      // Debug: Check each uploaded media object
      uploaded.forEach((media, index) => {
        console.log(`🔍 Uploaded media ${index + 1}:`, {
          id: media.id,
          url: media.url,
          originalName: media.originalName,
          mimeType: media.mimeType,
          size: media.size,
          hasUrl: !!media.url,
          urlType: typeof media.url
        });
      });

      setUploadedMedia(prev => {
        const newMedia = [...prev, ...uploaded];
        console.log('🔍 Updated uploadedMedia state:', newMedia.map(m => ({ id: m.id, url: m.url, hasUrl: !!m.url })));
        return newMedia;
      });
      setMediaFiles([]);
      
      if (onMediaUploaded) {
        onMediaUploaded(uploaded);
      }

      toast.success(`${uploaded.length} file(s) uploaded successfully!`);
    } catch (error: any) {
      console.error('❌ Upload error occurred:', error);
      console.error('📋 Error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        code: error.code,
        stack: error.stack
      });
      
      let errorMessage = 'Failed to upload files. Please try again.';
      
      if (error.code === 'ECONNABORTED') {
        errorMessage = 'Upload timed out. Please check your internet connection and try again.';
        console.error('⏰ Upload timeout detected');
      } else if (error.response?.status === 401) {
        errorMessage = 'Authentication failed. Please log in again.';
        console.error('🔐 Authentication error detected');
      } else if (error.response?.status === 413) {
        errorMessage = 'File too large. Maximum file size is 50MB.';
        console.error('📏 File size error detected');
      } else if (error.response?.status === 400 && error.response?.data?.message?.includes('Invalid file type')) {
        errorMessage = 'Invalid file type. Only images and videos are allowed.';
        console.error('📎 File type error detected');
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
        console.error('📨 Server error message:', errorMessage);
      } else if (error.message) {
        errorMessage = error.message;
        console.error('💬 General error message:', errorMessage);
      }
      
      console.error('🚨 Displaying error to user:', errorMessage);
      toast.error(errorMessage);
      
      // Reset any stuck progress indicators
      setMediaFiles(prev => prev.map(mf => ({ ...mf, uploadProgress: 0 })));
      
    } finally {
      console.log('🔄 Setting upload state to false');
      setIsUploading(false);
      console.log('✅ Upload process completed (success or error)');
    }
  };

  // Delete file
  const deleteFile = async (mediaId: string, isUploaded: boolean) => {
    if (isUploaded && reportId) {
      try {
        await mediaService.deleteMedia(reportId, mediaId);
        setUploadedMedia(prev => prev.filter(m => m.id !== mediaId));
        if (onMediaDeleted) {
          onMediaDeleted(mediaId);
        }
        toast.success('File deleted successfully');
      } catch (error) {
        console.error('Delete error:', error);
        toast.error('Failed to delete file');
      }
    } else {
      // Remove from local files
      const fileToRemove = mediaFiles.find(mf => mf.id === mediaId);
      if (fileToRemove?.url) {
        mediaService.revokePreviewURL(fileToRemove.url);
      }
      setMediaFiles(prev => prev.filter(mf => mf.id !== mediaId));
    }
  };

  // Open preview dialog
  const openPreview = (media: MediaFile | UploadedMedia) => {
    console.log('🔍 Opening preview for media:', {
      media,
      url: media.url,
      absoluteUrl: getMediaUrl(media.url || ''),
      isImage: isImage(media),
      type: 'type' in media ? media.type : 'mimeType' in media ? media.mimeType : 'unknown',
      hasUrl: !!media.url,
      urlType: typeof media.url,
      mediaKeys: Object.keys(media)
    });
    setPreviewDialog({ open: true, media });
  };

  // Close preview dialog
  const closePreview = () => {
    setPreviewDialog({ open: false, media: null });
  };

  // Get file icon
  const getFileIcon = (type: 'image' | 'video') => {
    return type === 'image' ? <Image /> : <Movie />;
  };

  // Determine if media is an image
  const isImage = (media: MediaFile | UploadedMedia): boolean => {
    // For local files (MediaFile)
    if ('type' in media) {
      return media.type === 'image';
    }
    
    // For uploaded files (UploadedMedia)
    if ('mimeType' in media) {
      return media.mimeType?.startsWith('image/') || false;
    }
    
    // Fallback: check filename extension
    const fileName = ('name' in media ? (media as MediaFile).name : (media as UploadedMedia).originalName) || '';
    return /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(fileName);
  };

  // Test media URL accessibility
  const testMediaUrl = async (url: string) => {
    try {
      const fullUrl = getMediaUrl(url);
      console.log('🔍 Testing media URL:', fullUrl);
      
      const response = await fetch(fullUrl, { method: 'HEAD' });
      console.log('🔍 Media URL test result:', {
        url: fullUrl,
        status: response.status,
        statusText: response.statusText,
        contentType: response.headers.get('content-type'),
        cors: response.headers.get('access-control-allow-origin')
      });
      
      return response.ok;
    } catch (error) {
      console.error('❌ Media URL test failed:', error);
      return false;
    }
  };

  // Get absolute URL for media
  const getMediaUrl = (url: string) => {
    if (!url) return '';
    
    console.log('🔍 getMediaUrl called with:', url);
    
    // If it's already an absolute URL, return as is
    if (url.startsWith('http://') || url.startsWith('https://')) {
      console.log('🔍 Returning absolute URL as is:', url);
      return url;
    }
    
    // If it's a blob URL, return as is
    if (url.startsWith('blob:')) {
      console.log('🔍 Returning blob URL as is:', url);
      return url;
    }
    
    // Get base URL (remove /api suffix if present)
    let baseUrl = process.env.REACT_APP_API_URL || 'http://localhost:5050';
    if (baseUrl.endsWith('/api')) {
      baseUrl = baseUrl.replace('/api', '');
    }
    
    // If it's a relative URL starting with /, make it absolute
    if (url.startsWith('/')) {
      const fullUrl = `${baseUrl}${url}`;
      console.log('🔍 Converting relative URL to absolute:', fullUrl);
      return fullUrl;
    }
    
    // Default case: assume it's a relative URL without leading slash
    const fullUrl = `${baseUrl}/${url}`;
    console.log('🔍 Converting to absolute URL (default case):', fullUrl);
    return fullUrl;
  };

  const totalFiles = mediaFiles.length + uploadedMedia.length;

  return (
    <Box>
      {/* Upload Area */}
      <Paper
        sx={{
          p: 3,
          border: '2px dashed',
          borderColor: isDragging ? 'primary.main' : 'grey.300',
          backgroundColor: isDragging ? 'primary.50' : 'grey.50',
          borderRadius: 2,
          textAlign: 'center',
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.6 : 1,
          transition: 'all 0.2s ease',
          '&:hover': {
            borderColor: disabled ? 'grey.300' : 'primary.main',
            backgroundColor: disabled ? 'grey.50' : 'primary.50',
          },
        }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !disabled && fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={acceptedTypes.map(type => 
            type === 'image' ? 'image/*' : 'video/*'
          ).join(',')}
          onChange={handleFileInputChange}
          style={{ display: 'none' }}
          disabled={disabled}
        />

        <CloudUpload sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
        <Typography variant="h6" gutterBottom>
          Upload Media Files
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Drag and drop files here, or click to select files
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center', flexWrap: 'wrap' }}>
          {acceptedTypes.includes('image') && (
            <Chip icon={<PhotoCamera />} label="Images" size="small" />
          )}
          {acceptedTypes.includes('video') && (
            <Chip icon={<Videocam />} label="Videos" size="small" />
          )}
        </Box>
        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
          Max {maxFiles} files • Max 50MB per file
        </Typography>
      </Paper>

      {/* File List */}
      {(mediaFiles.length > 0 || uploadedMedia.length > 0) && (
        <Box sx={{ mt: 3 }}>
          <Typography variant="h6" gutterBottom>
            Media Files ({totalFiles}/{maxFiles})
          </Typography>

          <Grid container spacing={2}>
            {/* Local files (not yet uploaded) */}
            {mediaFiles.map((media) => (
              <Grid item xs={12} sm={6} md={4} key={media.id}>
                <Card sx={{ position: 'relative' }}>
                  {media.type === 'image' ? (
                    <CardMedia
                      component="img"
                      height="140"
                      image={getMediaUrl(media.url || '')}
                      alt={media.name}
                      sx={{ objectFit: 'cover' }}
                      onLoad={() => {
                        console.log('✅ CardMedia image loaded successfully:', getMediaUrl(media.url || ''));
                      }}
                      onError={(e: React.SyntheticEvent<HTMLImageElement, Event>) => {
                        console.error('❌ CardMedia error for local image:', getMediaUrl(media.url || ''));
                        console.error('❌ Original URL:', media.url);
                        console.error('❌ Error details:', e);
                      }}
                    />
                  ) : (
                    <CardMedia
                      component="video"
                      height="140"
                      src={getMediaUrl(media.url || '')}
                      sx={{ objectFit: 'cover' }}
                      onLoadStart={() => {
                        console.log('🎬 CardMedia video loading started:', getMediaUrl(media.url || ''));
                      }}
                      onCanPlay={() => {
                        console.log('✅ CardMedia video can play:', getMediaUrl(media.url || ''));
                      }}
                      onError={(e: React.SyntheticEvent<HTMLVideoElement, Event>) => {
                        console.error('❌ CardMedia error for local video:', getMediaUrl(media.url || ''));
                        console.error('❌ Original URL:', media.url);
                        console.error('❌ Error details:', e);
                      }}
                    />
                  )}
                  <CardContent sx={{ p: 2 }}>
                    <Typography variant="body2" noWrap>
                      {media.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {media.size ? mediaService.formatFileSize(media.size) : 'Unknown size'}
                    </Typography>
                    {media.uploadProgress !== undefined && media.uploadProgress < 100 && (
                      <LinearProgress 
                        variant="determinate" 
                        value={media.uploadProgress} 
                        sx={{ mt: 1 }}
                      />
                    )}
                  </CardContent>
                  <CardActions sx={{ p: 1, justifyContent: 'space-between' }}>
                    <Tooltip title="Preview">
                      <IconButton size="small" onClick={() => openPreview(media)}>
                        <Visibility />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete">
                      <IconButton 
                        size="small" 
                        color="error"
                        onClick={() => deleteFile(media.id, false)}
                      >
                        <Delete />
                      </IconButton>
                    </Tooltip>
                  </CardActions>
                </Card>
              </Grid>
            ))}

            {/* Uploaded files */}
            {uploadedMedia.map((media) => (
              <Grid item xs={12} sm={6} md={4} key={media.id || media.filename}>
                <Card sx={{ position: 'relative' }}>
                  {isImage(media) ? (
                    <CardMedia
                      component="img"
                      height="140"
                      image={getMediaUrl(media.url)}
                      alt={media.originalName}
                      sx={{ objectFit: 'cover' }}
                      onLoad={() => {
                        console.log('✅ CardMedia uploaded image loaded successfully:', getMediaUrl(media.url || ''));
                      }}
                      onError={(e: React.SyntheticEvent<HTMLImageElement, Event>) => {
                        console.error('❌ CardMedia error for uploaded image:', getMediaUrl(media.url || ''));
                        console.error('❌ Original URL:', media.url);
                        console.error('❌ Error details:', e);
                      }}
                    />
                  ) : (
                    <CardMedia
                      component="video"
                      height="140"
                      src={getMediaUrl(media.url)}
                      sx={{ objectFit: 'cover' }}
                      onLoadStart={() => {
                        console.log('🎬 CardMedia uploaded video loading started:', getMediaUrl(media.url || ''));
                      }}
                      onCanPlay={() => {
                        console.log('✅ CardMedia uploaded video can play:', getMediaUrl(media.url || ''));
                      }}
                      onError={(e: React.SyntheticEvent<HTMLVideoElement, Event>) => {
                        console.error('❌ CardMedia error for uploaded video:', getMediaUrl(media.url || ''));
                        console.error('❌ Original URL:', media.url);
                        console.error('❌ Error details:', e);
                      }}
                    />
                  )}
                  <CardContent sx={{ p: 2 }}>
                    <Typography variant="body2" noWrap>
                      {media.originalName}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {media.size ? mediaService.formatFileSize(media.size) : 'Unknown size'}
                    </Typography>
                  </CardContent>
                  <CardActions sx={{ p: 1, justifyContent: 'space-between' }}>
                    <Tooltip title="Preview">
                      <IconButton size="small" onClick={() => openPreview(media)}>
                        <Visibility />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete">
                      <IconButton 
                        size="small" 
                        color="error"
                        onClick={() => deleteFile(media.id || media.filename, true)}
                      >
                        <Delete />
                      </IconButton>
                    </Tooltip>
                  </CardActions>
                </Card>
              </Grid>
            ))}
          </Grid>

          {/* Upload button for local files */}
          {mediaFiles.length > 0 && reportId && (
            <Box sx={{ mt: 2, textAlign: 'center', display: 'flex', justifyContent: 'center', gap: 2 }}>
              <Button
                variant="contained"
                startIcon={<CloudUpload />}
                onClick={uploadFiles}
                disabled={isUploading || disabled}
                sx={{
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  px: 3,
                  py: 1.5,
                }}
              >
                {isUploading ? 'Uploading...' : `Upload ${mediaFiles.length} File(s)`}
              </Button>
              
              {isUploading && (
                <Button
                  variant="outlined"
                  color="error"
                  onClick={() => {
                    console.log('🛑 Emergency reset triggered by user');
                    setIsUploading(false);
                    setMediaFiles(prev => prev.map(mf => ({ ...mf, uploadProgress: 0 })));
                    toast.success('Upload cancelled');
                  }}
                  sx={{ px: 3, py: 1.5 }}
                >
                  Cancel
                </Button>
              )}
            </Box>
          )}
        </Box>
      )}

      {/* Preview Dialog */}
      <Dialog
        open={previewDialog.open}
        onClose={closePreview}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography variant="h6">
              {previewDialog.media 
                ? ('name' in previewDialog.media 
                    ? previewDialog.media.name 
                    : 'originalName' in previewDialog.media 
                      ? previewDialog.media.originalName 
                      : 'Media File')
                : 'Media File'}
            </Typography>
            <IconButton onClick={closePreview}>
              <Close />
            </IconButton>
          </Box>
        </DialogTitle>
                <DialogContent>
          {previewDialog.media && (() => {
            const isImageMedia = isImage(previewDialog.media);
            const mediaUrl = getMediaUrl(previewDialog.media?.url || '');
            console.log('🔍 Preview dialog rendering:', {
              media: previewDialog.media,
              isImage: isImageMedia,
              url: mediaUrl,
              originalUrl: previewDialog.media?.url,
              mimeType: 'mimeType' in previewDialog.media ? previewDialog.media.mimeType : 'type' in previewDialog.media ? previewDialog.media.type : 'unknown'
            });
            
            // Test the media URL accessibility
            if (previewDialog.media?.url) {
              testMediaUrl(previewDialog.media.url);
            }
            
            return (
              <Box sx={{ textAlign: 'center' }}>
                {isImageMedia ? (
                  <img
                    src={mediaUrl}
                    alt={previewDialog.media 
                      ? ('name' in previewDialog.media 
                          ? previewDialog.media.name 
                          : 'originalName' in previewDialog.media 
                            ? previewDialog.media.originalName 
                            : 'Media File')
                      : 'Media File'}
                    style={{ maxWidth: '100%', maxHeight: '60vh', objectFit: 'contain' }}
                    onLoad={() => {
                      console.log('✅ Image loaded successfully:', mediaUrl);
                    }}
                    onError={(e: React.SyntheticEvent<HTMLImageElement, Event>) => {
                      console.error('❌ Image preview error:', mediaUrl);
                      console.error('❌ Original URL:', previewDialog.media?.url);
                      console.error('❌ Error details:', e);
                      // Show fallback content
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                      const fallback = document.createElement('div');
                      fallback.innerHTML = `
                        <div style="padding: 20px; text-align: center; color: #666;">
                          <p>Image could not be loaded</p>
                          <p>URL: ${mediaUrl}</p>
                          <p>Original URL: ${previewDialog.media?.url}</p>
                        </div>
                      `;
                      target.parentNode?.appendChild(fallback);
                    }}
                  />
                ) : (
                  <video
                    src={mediaUrl}
                    controls
                    style={{ maxWidth: '100%', maxHeight: '60vh' }}
                    onLoadStart={() => {
                      console.log('🎬 Video loading started:', mediaUrl);
                    }}
                    onCanPlay={() => {
                      console.log('✅ Video can play:', mediaUrl);
                    }}
                    onError={(e: React.SyntheticEvent<HTMLVideoElement, Event>) => {
                      console.error('❌ Video preview error:', mediaUrl);
                      console.error('❌ Original URL:', previewDialog.media?.url);
                      console.error('❌ Error details:', e);
                      // Show fallback content
                      const target = e.target as HTMLVideoElement;
                      target.style.display = 'none';
                      const fallback = document.createElement('div');
                      fallback.innerHTML = `
                        <div style="padding: 20px; text-align: center; color: #666;">
                          <p>Video could not be loaded</p>
                          <p>URL: ${mediaUrl}</p>
                          <p>Original URL: ${previewDialog.media?.url}</p>
                        </div>
                      `;
                      target.parentNode?.appendChild(fallback);
                    }}
                  />
                )}
              </Box>
            );
          })()}
        </DialogContent>
        <DialogActions>
          <Button onClick={closePreview}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default MediaUpload;
