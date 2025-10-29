import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Modal,
  Dimensions,
  Platform,
  Linking,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { format } from 'date-fns';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useBranding } from '../contexts/BrandingContext';

const { width } = Dimensions.get('window');

interface EventAttachment {
  _id: string;
  filename: string;
  mimetype: string;
  size: number;
  url: string;
}

interface Event {
  _id: string;
  title: string;
  description?: string;
  category?: string;
  startDate: string;
  endDate?: string;
  location?: string;
  attachments?: EventAttachment[];
  targetAudience?: {
    allParents?: boolean;
    grades?: string[];
    classes?: string[];
  };
}

interface EventDetailModalProps {
  visible: boolean;
  event: Event | null;
  onClose: () => void;
}

const EventDetailModal: React.FC<EventDetailModalProps> = ({ visible, event, onClose }) => {
  const { branding } = useBranding();
  const [downloadingAttachment, setDownloadingAttachment] = useState<string | null>(null);

  const primaryColor = branding?.branding.primaryColor || '#667eea';
  const secondaryColor = branding?.branding.secondaryColor || '#764ba2';

  if (!event) return null;

  const getCategoryColor = (category?: string) => {
    switch (category?.toLowerCase()) {
      case 'academic':
        return '#10b981';
      case 'sports':
        return '#f59e0b';
      case 'cultural':
        return '#8b5cf6';
      case 'trip':
        return '#06b6d4';
      case 'meeting':
        return '#ef4444';
      default:
        return primaryColor;
    }
  };

  const getCategoryIcon = (category?: string) => {
    switch (category?.toLowerCase()) {
      case 'academic':
        return 'school-outline';
      case 'sports':
        return 'trophy-outline';
      case 'cultural':
        return 'color-palette-outline';
      case 'trip':
        return 'airplane-outline';
      case 'meeting':
        return 'people-outline';
      default:
        return 'calendar-outline';
    }
  };

  const getFileIcon = (mimetype: string) => {
    if (mimetype.startsWith('image/')) return 'image-outline';
    if (mimetype.startsWith('video/')) return 'videocam-outline';
    if (mimetype.includes('pdf')) return 'document-text-outline';
    return 'document-outline';
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleDownloadAttachment = async (attachment: EventAttachment) => {
    try {
      setDownloadingAttachment(attachment._id);

      const fileUri = `${FileSystem.documentDirectory}${attachment.filename}`;
      
      const downloadResult = await FileSystem.downloadAsync(
        attachment.url,
        fileUri
      );

      if (downloadResult.status === 200) {
        const isAvailable = await Sharing.isAvailableAsync();
        
        if (isAvailable) {
          await Sharing.shareAsync(downloadResult.uri, {
            mimeType: attachment.mimetype,
            dialogTitle: `Share ${attachment.filename}`,
          });
        } else {
          Alert.alert('Success', 'File downloaded successfully');
        }
      }
    } catch (error) {
      console.error('Error downloading attachment:', error);
      Alert.alert('Error', 'Failed to download attachment');
    } finally {
      setDownloadingAttachment(null);
    }
  };

  const formatDate = (date: string) => {
    return format(new Date(date), 'MMM dd, yyyy');
  };

  const formatTime = (date: string) => {
    return format(new Date(date), 'h:mm a');
  };

  const isMultiDay = event.endDate && 
    new Date(event.startDate).toDateString() !== new Date(event.endDate).toDateString();

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          {/* Header */}
          <LinearGradient
            colors={[primaryColor, secondaryColor]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.modalHeader}
          >
            <View style={styles.headerTop}>
              <View style={[styles.categoryBadge, { backgroundColor: 'rgba(255, 255, 255, 0.3)' }]}>
                <Ionicons 
                  name={getCategoryIcon(event.category) as any} 
                  size={16} 
                  color="#fff" 
                />
                <Text style={styles.categoryText}>
                  {event.category || 'Event'}
                </Text>
              </View>
              
              <TouchableOpacity
                style={styles.closeButton}
                onPress={onClose}
              >
                <Ionicons name="close" size={28} color="#fff" />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalTitle}>{event.title}</Text>
            
            <View style={styles.dateTimeContainer}>
              <View style={styles.dateTimeRow}>
                <Ionicons name="calendar-outline" size={20} color="#fff" />
                <Text style={styles.dateTimeText}>
                  {isMultiDay 
                    ? `${formatDate(event.startDate)} - ${formatDate(event.endDate!)}`
                    : formatDate(event.startDate)
                  }
                </Text>
              </View>
              
              <View style={styles.dateTimeRow}>
                <Ionicons name="time-outline" size={20} color="#fff" />
                <Text style={styles.dateTimeText}>
                  {formatTime(event.startDate)}
                  {event.endDate && ` - ${formatTime(event.endDate)}`}
                </Text>
              </View>
            </View>
          </LinearGradient>

          {/* Content */}
          <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
            {/* Location */}
            {event.location && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Ionicons name="location-outline" size={22} color={primaryColor} />
                  <Text style={styles.sectionTitle}>Location</Text>
                </View>
                <Text style={styles.locationText}>{event.location}</Text>
              </View>
            )}

            {/* Description */}
            {event.description && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Ionicons name="information-circle-outline" size={22} color={primaryColor} />
                  <Text style={styles.sectionTitle}>Description</Text>
                </View>
                <Text style={styles.descriptionText}>{event.description}</Text>
              </View>
            )}

            {/* Target Audience */}
            {event.targetAudience && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Ionicons name="people-outline" size={22} color={primaryColor} />
                  <Text style={styles.sectionTitle}>Who's Invited</Text>
                </View>
                <View style={styles.audienceContainer}>
                  {event.targetAudience.allParents && (
                    <View style={[styles.audienceChip, { backgroundColor: `${primaryColor}20` }]}>
                      <Text style={[styles.audienceChipText, { color: primaryColor }]}>
                        All Parents
                      </Text>
                    </View>
                  )}
                  {event.targetAudience.grades?.map((grade, index) => (
                    <View 
                      key={index} 
                      style={[styles.audienceChip, { backgroundColor: `${secondaryColor}20` }]}
                    >
                      <Text style={[styles.audienceChipText, { color: secondaryColor }]}>
                        Grade {grade}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Attachments */}
            {event.attachments && event.attachments.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <Ionicons name="attach-outline" size={22} color={primaryColor} />
                  <Text style={styles.sectionTitle}>Attachments</Text>
                </View>
                {event.attachments.map((attachment) => (
                  <TouchableOpacity
                    key={attachment._id}
                    style={styles.attachmentItem}
                    onPress={() => handleDownloadAttachment(attachment)}
                    disabled={downloadingAttachment === attachment._id}
                  >
                    <View style={[styles.attachmentIcon, { backgroundColor: `${primaryColor}15` }]}>
                      <Ionicons 
                        name={getFileIcon(attachment.mimetype) as any} 
                        size={24} 
                        color={primaryColor} 
                      />
                    </View>
                    <View style={styles.attachmentInfo}>
                      <Text style={styles.attachmentName} numberOfLines={1}>
                        {attachment.filename}
                      </Text>
                      <Text style={styles.attachmentSize}>
                        {formatFileSize(attachment.size)}
                      </Text>
                    </View>
                    {downloadingAttachment === attachment._id ? (
                      <Text style={styles.downloadingText}>Downloading...</Text>
                    ) : (
                      <Ionicons name="download-outline" size={24} color={primaryColor} />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <View style={{ height: 30 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    maxHeight: '90%',
    overflow: 'hidden',
  },
  modalHeader: {
    paddingTop: 20,
    paddingHorizontal: 20,
    paddingBottom: 25,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
  },
  categoryText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 6,
    textTransform: 'capitalize',
  },
  closeButton: {
    padding: 4,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 15,
  },
  dateTimeContainer: {
    gap: 8,
  },
  dateTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateTimeText: {
    color: '#fff',
    fontSize: 15,
    marginLeft: 10,
    fontWeight: '500',
  },
  modalBody: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  section: {
    marginBottom: 25,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginLeft: 10,
  },
  locationText: {
    fontSize: 16,
    color: '#666',
    lineHeight: 24,
  },
  descriptionText: {
    fontSize: 16,
    color: '#666',
    lineHeight: 24,
  },
  audienceContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  audienceChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  audienceChipText: {
    fontSize: 14,
    fontWeight: '600',
  },
  attachmentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 12,
    marginBottom: 10,
  },
  attachmentIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  attachmentInfo: {
    flex: 1,
    marginLeft: 12,
  },
  attachmentName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  attachmentSize: {
    fontSize: 13,
    color: '#999',
  },
  downloadingText: {
    fontSize: 13,
    color: '#999',
    marginRight: 5,
  },
});

export default EventDetailModal;

