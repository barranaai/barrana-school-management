import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  ScrollView,
  Alert,
  ActivityIndicator,
  StyleSheet,
  Dimensions,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useBranding } from '../contexts/BrandingContext';
import * as ImagePicker from 'expo-image-picker';
import * as VideoThumbnails from 'expo-video-thumbnails';
import apiService from '../apiService';

interface MediaFile {
  id: string;
  uri: string;
  type: 'image' | 'video';
  name: string;
  size: number;
  thumbnail?: string;
  uploaded?: boolean;
  uploadProgress?: number;
}

interface MediaUploadProps {
  reportId?: string;
  onMediaUploaded?: (media: any[]) => void;
  onMediaDeleted?: (mediaId: string) => void;
  maxFiles?: number;
  disabled?: boolean;
}

const { width } = Dimensions.get('window');

const MediaUpload: React.FC<MediaUploadProps> = ({
  reportId,
  onMediaUploaded,
  onMediaDeleted,
  maxFiles = 10,
  disabled = false,
}) => {
  const { branding } = useBranding();
  const primaryColor = branding?.branding?.primaryColor || '#667eea';
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([]);
  const [uploadedMedia, setUploadedMedia] = useState<any[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [previewModal, setPreviewModal] = useState<{ visible: boolean; media: MediaFile | null }>({
    visible: false,
    media: null,
  });

  // Request permissions
  const requestPermissions = async () => {
    const { status: cameraStatus } = await ImagePicker.requestCameraPermissionsAsync();
    const { status: libraryStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (cameraStatus !== 'granted' || libraryStatus !== 'granted') {
      Alert.alert(
        'Permissions Required',
        'Camera and photo library permissions are required to upload media.',
        [{ text: 'OK' }]
      );
      return false;
    }
    return true;
  };

  // Take photo with camera
  const takePhoto = async () => {
    if (!(await requestPermissions())) return;

    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        await addMediaFile(asset.uri, asset.type || 'image', asset.fileName || 'photo');
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'Failed to take photo. Please try again.');
    }
    setShowOptions(false);
  };

  // Pick from gallery
  const pickFromGallery = async () => {
    if (!(await requestPermissions())) return;

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
        allowsMultipleSelection: true,
        selectionLimit: maxFiles - mediaFiles.length - uploadedMedia.length,
      });

      if (!result.canceled && result.assets) {
        for (const asset of result.assets) {
          await addMediaFile(asset.uri, asset.type || 'image', asset.fileName || 'media');
        }
      }
    } catch (error) {
      console.error('Error picking from gallery:', error);
      Alert.alert('Error', 'Failed to pick media from gallery. Please try again.');
    }
    setShowOptions(false);
  };

  // Add media file to the list
  const addMediaFile = async (uri: string, type: string, fileName: string) => {
    if (mediaFiles.length + uploadedMedia.length >= maxFiles) {
      Alert.alert('Limit Reached', `Maximum ${maxFiles} files allowed.`);
      return;
    }

    try {
      // Get file info
      const response = await fetch(uri);
      const blob = await response.blob();
      const size = blob.size;

      // Validate file size (50MB limit)
      if (size > 50 * 1024 * 1024) {
        Alert.alert('File Too Large', 'File size must be less than 50MB.');
        return;
      }

      let thumbnail = uri;
      if (type === 'video') {
        try {
          const thumbnailResult = await VideoThumbnails.getThumbnailAsync(uri, {
            time: 1000,
          });
          thumbnail = thumbnailResult.uri;
        } catch (error) {
          console.error('Error generating video thumbnail:', error);
        }
      }

      const mediaFile: MediaFile = {
        id: Math.random().toString(36).substr(2, 9),
        uri,
        type: type as 'image' | 'video',
        name: fileName,
        size,
        thumbnail,
        uploaded: false,
        uploadProgress: 0,
      };

      setMediaFiles(prev => [...prev, mediaFile]);
    } catch (error) {
      console.error('Error adding media file:', error);
      Alert.alert('Error', 'Failed to add media file. Please try again.');
    }
  };

  // Upload files
  const uploadFiles = async () => {
    if (mediaFiles.length === 0) {
      Alert.alert('Info', 'No files selected to upload');
      return;
    }

    setIsUploading(true);

    try {
      console.log('📱 Starting media upload...', { reportId, filesCount: mediaFiles.length });
      
      // Pass the media files directly to the API service
      const response = await apiService.uploadReportMedia(reportId || 'temp_upload', mediaFiles);

      if (response.success) {
        console.log('📱 Upload successful:', response.data);
        
        // Update uploaded media state
        setUploadedMedia(prev => [...prev, ...(response.data || [])]);
        setMediaFiles([]);
        
        if (onMediaUploaded) {
          onMediaUploaded(response.data || []);
        }

        Alert.alert('Success', response.message || `${mediaFiles.length} file(s) uploaded successfully!`);
      } else {
        throw new Error(response.message || 'Upload failed');
      }
    } catch (error) {
      console.error('📱 Upload error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to upload files. Please try again.';
      Alert.alert('Upload Error', errorMessage);
    } finally {
      setIsUploading(false);
    }
  };

  // Delete file
  const deleteFile = async (mediaId: string, isUploaded: boolean) => {
    if (isUploaded && reportId) {
      try {
        await apiService.deleteReportMedia(reportId, mediaId);
        setUploadedMedia(prev => prev.filter(m => m.id !== mediaId));
        if (onMediaDeleted) {
          onMediaDeleted(mediaId);
        }
        Alert.alert('Success', 'File deleted successfully');
      } catch (error) {
        console.error('Delete error:', error);
        Alert.alert('Error', 'Failed to delete file');
      }
    } else {
      setMediaFiles(prev => prev.filter(mf => mf.id !== mediaId));
    }
  };

  // Format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Convert media URL to full server URL
  const convertMediaUrl = (url: string | undefined): string => {
    if (!url || url.startsWith('blob:')) {
      return ''; // Skip blob URLs or undefined
    }
    
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url; // Already a full URL
    }
    
    // Convert relative URL to full server URL
    const serverUrl = url.startsWith('/') ? url : '/' + url;
    // Remove /api from base URL since media URLs don't include /api prefix
    const baseUrl = apiService.getBaseUrl().replace('/api', '');
    return `${baseUrl}${serverUrl}`;
  };

  const totalFiles = mediaFiles.length + uploadedMedia.length;

  return (
    <View style={styles.container}>
      {/* Upload Button */}
      <TouchableOpacity
        style={[styles.uploadButton, disabled && styles.disabled]}
        onPress={() => !disabled && setShowOptions(true)}
        disabled={disabled}
      >
        <Ionicons name="cloud-upload" size={32} color={primaryColor} />
        <Text style={[styles.uploadText, { color: primaryColor }]}>Add Photos & Videos</Text>
        <Text style={styles.uploadSubtext}>
          {totalFiles}/{maxFiles} files • Max 50MB each
        </Text>
      </TouchableOpacity>

      {/* Media Grid */}
      {(mediaFiles.length > 0 || uploadedMedia.length > 0) && (
        <View style={styles.mediaContainer}>
          <Text style={styles.mediaTitle}>Media Files ({totalFiles}/{maxFiles})</Text>
          
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.mediaGrid}>
              {/* Local files */}
              {mediaFiles.map((media) => (
                <View key={media.id} style={styles.mediaItem}>
                  <TouchableOpacity
                    style={styles.mediaPreview}
                    onPress={() => setPreviewModal({ visible: true, media })}
                  >
                    {media.type === 'image' ? (
                      <Image source={{ uri: media.thumbnail }} style={styles.mediaImage} />
                    ) : (
                      <View style={styles.videoPreview}>
                        <Image source={{ uri: media.thumbnail }} style={styles.mediaImage} />
                        <View style={styles.videoOverlay}>
                          <Ionicons name="play" size={24} color="white" />
                        </View>
                      </View>
                    )}
                  </TouchableOpacity>
                  
                  <View style={styles.mediaInfo}>
                    <Text style={styles.mediaName} numberOfLines={1}>
                      {media.name}
                    </Text>
                    <Text style={styles.mediaSize}>
                      {formatFileSize(media.size)}
                    </Text>
                  </View>
                  
                  <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={() => deleteFile(media.id, false)}
                  >
                    <Ionicons name="trash" size={16} color="white" />
                  </TouchableOpacity>
                </View>
              ))}

              {/* Uploaded files */}
              {uploadedMedia.map((media) => (
                <View key={media.id} style={styles.mediaItem}>
                  <TouchableOpacity
                    style={styles.mediaPreview}
                    onPress={() => setPreviewModal({ visible: true, media })}
                  >
                    {media.mimeType.startsWith('image/') ? (
                      <Image source={{ uri: convertMediaUrl(media.url) }} style={styles.mediaImage} />
                    ) : (
                      <View style={styles.videoPreview}>
                        <Image source={{ uri: convertMediaUrl(media.thumbnail || media.url) }} style={styles.mediaImage} />
                        <View style={styles.videoOverlay}>
                          <Ionicons name="play" size={24} color="white" />
                        </View>
                      </View>
                    )}
                  </TouchableOpacity>
                  
                  <View style={styles.mediaInfo}>
                    <Text style={styles.mediaName} numberOfLines={1}>
                      {media.originalName}
                    </Text>
                    <Text style={styles.mediaSize}>
                      {formatFileSize(media.size)}
                    </Text>
                  </View>
                  
                  <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={() => deleteFile(media.id, true)}
                  >
                    <Ionicons name="trash" size={16} color="white" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </ScrollView>

          {/* Upload button for local files */}
          {mediaFiles.length > 0 && reportId && (
            <TouchableOpacity
              style={[styles.uploadActionButton, isUploading && styles.uploading]}
              onPress={uploadFiles}
              disabled={isUploading}
            >
              {isUploading ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Ionicons name="cloud-upload" size={20} color="white" />
              )}
              <Text style={styles.uploadActionText}>
                {isUploading ? 'Uploading...' : `Upload ${mediaFiles.length} File(s)`}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Media Options Modal */}
      <Modal
        visible={showOptions}
        transparent
        animationType="slide"
        onRequestClose={() => setShowOptions(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add Media</Text>
            
            <TouchableOpacity style={styles.modalOption} onPress={takePhoto}>
              <Ionicons name="camera" size={24} color={primaryColor} />
              <Text style={styles.modalOptionText}>Take Photo/Video</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.modalOption} onPress={pickFromGallery}>
              <Ionicons name="images" size={24} color={primaryColor} />
              <Text style={styles.modalOptionText}>Choose from Gallery</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.modalOption, styles.cancelOption]}
              onPress={() => setShowOptions(false)}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Preview Modal */}
      <Modal
        visible={previewModal.visible}
        transparent
        animationType="fade"
        onRequestClose={() => setPreviewModal({ visible: false, media: null })}
      >
        <View style={styles.previewOverlay}>
          <TouchableOpacity
            style={styles.previewCloseButton}
            onPress={() => setPreviewModal({ visible: false, media: null })}
          >
            <Ionicons name="close" size={24} color="white" />
          </TouchableOpacity>
          
          {previewModal.media && (
            <View style={styles.previewContent}>
              {('type' in previewModal.media && previewModal.media.type === 'image') || 
               ('mimeType' in previewModal.media && previewModal.media.mimeType?.startsWith('image/')) ? (
                <Image
                  source={{ 
                    uri: 'uri' in previewModal.media 
                      ? previewModal.media.uri  // Local file, use as-is
                      : convertMediaUrl(previewModal.media.url)  // Uploaded file, convert URL
                  }}
                  style={styles.previewImage}
                  resizeMode="contain"
                />
              ) : (
                <View style={styles.previewVideo}>
                  <Text style={styles.videoPreviewText}>Video Preview</Text>
                  <Text style={styles.videoPreviewSubtext}>
                    Video playback not available in preview
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  uploadButton: {
    borderWidth: 2,
    borderColor: '#667eea',
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    backgroundColor: '#f8f9ff',
  },
  disabled: {
    opacity: 0.6,
    borderColor: '#ccc',
  },
  uploadText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#667eea',
    marginTop: 8,
  },
  uploadSubtext: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  mediaContainer: {
    marginTop: 16,
  },
  mediaTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    color: '#333',
  },
  mediaGrid: {
    flexDirection: 'row',
    paddingHorizontal: 4,
  },
  mediaItem: {
    width: 120,
    marginRight: 12,
    borderRadius: 8,
    backgroundColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  mediaPreview: {
    height: 80,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    overflow: 'hidden',
  },
  mediaImage: {
    width: '100%',
    height: '100%',
  },
  videoPreview: {
    position: 'relative',
  },
  videoOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mediaInfo: {
    padding: 8,
  },
  mediaName: {
    fontSize: 12,
    fontWeight: '500',
    color: '#333',
  },
  mediaSize: {
    fontSize: 10,
    color: '#666',
    marginTop: 2,
  },
  deleteButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: '#ff4444',
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#667eea',
    borderRadius: 8,
    padding: 12,
    marginTop: 16,
  },
  uploading: {
    opacity: 0.7,
  },
  uploadActionText: {
    color: 'white',
    fontWeight: '600',
    marginLeft: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 40,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 20,
    color: '#333',
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    backgroundColor: '#f8f9ff',
  },
  modalOptionText: {
    fontSize: 16,
    marginLeft: 12,
    color: '#333',
  },
  cancelOption: {
    backgroundColor: '#ffebee', // MUI error light
    justifyContent: 'center',
  },
  cancelText: {
    fontSize: 16,
    color: '#d32f2f', // MUI error main
    textAlign: 'center',
    fontWeight: '600',
  },
  previewOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewCloseButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  previewImage: {
    width: width - 40,
    height: width - 40,
  },
  previewVideo: {
    width: width - 40,
    height: (width - 40) * 0.75,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
  },
  videoPreviewText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
  },
  videoPreviewSubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
});

export default MediaUpload;
