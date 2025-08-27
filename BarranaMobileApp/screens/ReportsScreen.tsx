import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
  ActivityIndicator,
  Modal,
  Dimensions,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import apiService, { User } from '../apiService';

interface ReportsScreenProps {
  user: User;
  onBack: () => void;
}

interface Report {
  _id: string;
  studentId: string | {
    _id: string;
    firstName: string;
    lastName: string;
    name?: string;
    grade?: string;
    studentGrade?: string;
    studentClass?: string;
    class?: string;
  };
  teacherId: string;
  schoolId: string;
  title: string;
  content: string;
  status: 'draft' | 'completed' | 'sent' | 'review' | 'approved' | 'archived';
  createdAt: string;
  updatedAt: string;
  sentAt?: string;
  template?: string;
  voiceRecordingUrl?: string;
  voiceRecording?: {
    hasRecording: boolean;
    recordings?: Array<{
      url: string;
      duration: number;
      transcription?: string;
    }>;
    recordingUrl?: string;
    recordingDuration?: number;
    transcription?: string;
    isTranscribed: boolean;
  };
  aiGenerated?: boolean | {
    isAiGenerated: boolean;
    originalTranscription?: string;
    generationModel?: string;
    generationPrompt?: string;
    generatedAt?: string;
  };
}

const ReportsScreen: React.FC<ReportsScreenProps> = ({ user, onBack }) => {
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [reports, setReports] = useState<Report[]>([]);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showTranscriptionModal, setShowTranscriptionModal] = useState(false);
  const [showAudioModal, setShowAudioModal] = useState(false);
  const [currentSound, setCurrentSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playingReportId, setPlayingReportId] = useState<string | null>(null);
  const [playingRecordingIndex, setPlayingRecordingIndex] = useState<number | null>(null);
  const [selectedDateFilter, setSelectedDateFilter] = useState('today');
  const [showDateFilter, setShowDateFilter] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const loadReports = async () => {
    setLoading(true);
    try {
      console.log('📊 Loading teacher reports...');
      const reportsData = await apiService.getTeacherReports(user.id);
      console.log('📊 Reports received:', reportsData);
      
      // Debug: Log student data from reports
      if (reportsData && reportsData.length > 0) {
        console.log('📊 First report student data:', reportsData[0].studentId);
        console.log('📊 All reports student data:', reportsData.map(r => ({ 
          reportId: r._id, 
          studentId: r.studentId,
          studentType: typeof r.studentId,
          studentData: typeof r.studentId === 'object' ? r.studentId : 'Not populated'
        })));
      }
      
      // The reports already include populated student data from the backend
      // No need to fetch student details separately
      setReports(reportsData);
    } catch (error) {
      console.error('Error loading reports:', error);
      Alert.alert('Error', 'Failed to load reports');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadReports();
    setRefreshing(false);
  };

  const getStudentName = (report: Report) => {
    // Handle populated studentId field
    if (typeof report.studentId === 'object' && report.studentId) {
      const student = report.studentId;
      if (student.firstName && student.lastName) {
        return `${student.firstName} ${student.lastName}`;
      } else if (student.firstName) {
        return student.firstName;
      } else if (student.lastName) {
        return student.lastName;
      } else if (student.name) {
        return student.name;
      }
    }
    return 'Unknown Student';
  };

  const getGradeAndClass = (report: Report) => {
    // Handle populated studentId field
    if (typeof report.studentId === 'object' && report.studentId) {
      const student = report.studentId;
      
      // Debug logging
      console.log('📊 Getting grade for student:', {
        studentId: student._id,
        studentGrade: student.studentGrade,
        grade: student.grade,
        studentClass: student.studentClass,
        class: student.class,
        allFields: Object.keys(student)
      });
      
      // Backend now provides grade from the Class document
      // Try grade field (from class), then fallback to studentGrade field, then Unknown
      const grade = student.grade || student.studentGrade || 'Unknown';
      const studentClass = student.studentClass || student.class || 'Unknown';
      
      console.log('📊 Resolved grade and class:', { grade, class: studentClass });
      
      return { grade, class: studentClass };
    }
    
    console.log('📊 Student data not populated or missing:', typeof report.studentId, report.studentId);
    return { grade: 'Unknown', class: 'Unknown' };
  };

  const getTranscription = (report: Report) => {
    if (report.voiceRecording?.transcription) {
      return report.voiceRecording.transcription;
    }
    if (report.aiGenerated && typeof report.aiGenerated === 'object' && report.aiGenerated.originalTranscription) {
      return report.aiGenerated.originalTranscription;
    }
    return null;
  };

  const hasAudioRecording = (report: Report) => {
    const hasRecording = !!(
      report.voiceRecording?.hasRecording ||
      report.voiceRecording?.recordingUrl ||
      report.voiceRecording?.recordings?.length ||
      report.voiceRecordingUrl
    );
    
    // Additional check: make sure we have valid (non-blob) URLs
    if (hasRecording) {
      const recordings = getAudioRecordings(report);
      const hasValidRecordings = recordings.length > 0;
      
      console.log('🎵 Audio check for report:', report._id, {
        hasRecordingFlag: report.voiceRecording?.hasRecording,
        recordingUrl: report.voiceRecording?.recordingUrl,
        recordingsCount: report.voiceRecording?.recordings?.length || 0,
        legacyUrl: report.voiceRecordingUrl,
        validRecordingsAfterConversion: hasValidRecordings
      });
      
      return hasValidRecordings;
    }
    
    return false;
  };

  const getAudioUrl = (report: Report) => {
    let url = null;
    
    if (report.voiceRecording?.recordingUrl) {
      url = report.voiceRecording.recordingUrl;
    } else if (report.voiceRecording?.recordings?.length) {
      url = report.voiceRecording.recordings[0].url;
    } else if (report.voiceRecordingUrl) {
      url = report.voiceRecordingUrl;
    }
    
    // Convert relative URLs to full server URLs, skip blob URLs
    if (url && !url.startsWith('blob:')) {
      if (url.startsWith('http')) {
        return url;
      } else {
        // Convert relative URL to full server URL using the same base as API service
        const serverUrl = url.startsWith('/') ? url : '/' + url;
        // Remove /api from base URL since media URLs don't include /api prefix
        const baseUrl = apiService.getBaseUrl().replace('/api', '');
        return `${baseUrl}${serverUrl}`;
      }
    }
    
    return null;
  };

  const convertAudioUrl = (url: string | undefined) => {
    if (!url || url.startsWith('blob:')) {
      return null; // Skip blob URLs
    }
    
    if (url.startsWith('http')) {
      return url; // Already a full URL
    }
    
    // Convert relative URL to full server URL using the same base as API service
    const serverUrl = url.startsWith('/') ? url : '/' + url;
    // Remove /api from base URL since media URLs don't include /api prefix
    const baseUrl = apiService.getBaseUrl().replace('/api', '');
    return `${baseUrl}${serverUrl}`;
  };

  const getAudioRecordings = (report: Report) => {
    const recordings = [];
    
    // Check for multiple recordings array
    if (report.voiceRecording?.recordings?.length) {
      return report.voiceRecording.recordings
        .map((recording, index) => {
          const originalUrl = (recording as any).url || (recording as any).uri;
          const convertedUrl = convertAudioUrl(originalUrl);
          
          if (!convertedUrl) return null; // Skip invalid URLs
          
          return {
            url: convertedUrl,
            duration: recording.duration || 0,
            transcription: recording.transcription || '',
            title: `Recording ${index + 1}`
          };
        })
        .filter((recording): recording is NonNullable<typeof recording> => recording !== null); // Remove null entries
    }
    
    // Check for single recording URL
    if (report.voiceRecording?.recordingUrl) {
      const convertedUrl = convertAudioUrl(report.voiceRecording.recordingUrl);
      if (convertedUrl) {
        recordings.push({
          url: convertedUrl,
          duration: report.voiceRecording.recordingDuration || 0,
          transcription: report.voiceRecording.transcription || '',
          title: 'Recording 1'
        });
      }
    }
    
    // Legacy single recording URL
    if (report.voiceRecordingUrl) {
      const convertedUrl = convertAudioUrl(report.voiceRecordingUrl);
      if (convertedUrl) {
        recordings.push({
          url: convertedUrl,
          duration: 0,
          transcription: '',
          title: 'Recording 1'
        });
      }
    }
    
    return recordings;
  };

  const playAudio = async (report: Report) => {
    const recordings = getAudioRecordings(report);
    if (recordings.length === 0) {
      Alert.alert('Error', 'No audio recording found');
      return;
    } else if (recordings.length === 1) {
      // If only one recording, play it directly
      await playSpecificRecording(recordings[0].url, 0, report._id);
    } else {
      // If multiple recordings, open the modal
      openAudioModal(report);
    }
  };

  const stopAudio = async () => {
    if (currentSound) {
      await currentSound.unloadAsync();
      setCurrentSound(null);
      setIsPlaying(false);
      setPlayingReportId(null);
      setPlayingRecordingIndex(null);
    }
  };

  const openAudioModal = (report: Report) => {
    const recordings = getAudioRecordings(report);
    if (recordings.length === 0) {
      Alert.alert('Error', 'No audio recordings found');
      return;
    }
    
    setSelectedReport(report);
    setShowAudioModal(true);
  };

  const playSpecificRecording = async (recordingUrl: string, recordingIndex: number, reportId: string) => {
    try {
      // Stop any currently playing audio
      if (currentSound) {
        await currentSound.unloadAsync();
        setCurrentSound(null);
        setIsPlaying(false);
        setPlayingReportId(null);
        setPlayingRecordingIndex(null);
      }

      console.log('🎵 Playing audio:', recordingUrl);
      console.log('🎵 Audio URL type:', typeof recordingUrl);
      console.log('🎵 Audio URL valid:', !!recordingUrl);
      
      if (!recordingUrl) {
        throw new Error('Audio URL is empty or null');
      }
      
      if (recordingUrl.startsWith('blob:')) {
        throw new Error('Cannot play blob URLs - audio recording expired');
      }
      
      const { sound } = await Audio.Sound.createAsync(
        { uri: recordingUrl },
        { shouldPlay: true }
      );
      
      setCurrentSound(sound);
      setIsPlaying(true);
      setPlayingReportId(reportId);
      setPlayingRecordingIndex(recordingIndex);
      
      console.log('✅ Audio playback started successfully');
      
      // Handle when audio finishes playing
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          console.log('🎵 Audio playback finished');
          setIsPlaying(false);
          setPlayingReportId(null);
          setPlayingRecordingIndex(null);
          setCurrentSound(null);
        }
      });
    } catch (error) {
      console.error('❌ Error playing audio:', error);
      console.error('❌ Failed URL:', recordingUrl);
      
      // More specific error messages
      let errorMessage = 'Failed to play audio';
      const errorStr = error instanceof Error ? error.message : String(error);
      
      if (errorStr.includes('blob:')) {
        errorMessage = 'This audio recording has expired. New recordings will work properly.';
      } else if (errorStr.includes('Network')) {
        errorMessage = 'Network error. Please check your connection and try again.';
      } else if (errorStr.includes('404')) {
        errorMessage = 'Audio file not found on server.';
      }
      
      Alert.alert('Audio Playback Error', errorMessage);
    }
  };

  const viewReport = (report: Report) => {
    setSelectedReport(report);
    setShowReportModal(true);
  };

  const viewTranscription = (report: Report) => {
    setSelectedReport(report);
    setShowTranscriptionModal(true);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return '#4caf50';
      case 'sent': return '#2196f3';
      case 'approved': return '#9c27b0';
      case 'draft': return '#ff9800';
      case 'review': return '#f44336';
      default: return '#666';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const dateFilterOptions = [
    { key: 'all', label: 'All Time', icon: 'calendar' },
    { key: 'today', label: 'Today', icon: 'today' },
    { key: 'week', label: 'This Week', icon: 'calendar-outline' },
    { key: 'month', label: 'This Month', icon: 'calendar' },
    { key: 'quarter', label: 'Last 3 Months', icon: 'calendar' },
    { key: 'year', label: 'This Year', icon: 'calendar' },
  ];

  const filterReportsByDate = (reports: Report[], filter: string) => {
    if (filter === 'all') return reports;
    
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfQuarter = new Date(now.getFullYear(), now.getMonth() - 3, 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    
    return reports.filter(report => {
      const reportDate = new Date(report.createdAt);
      
      switch (filter) {
        case 'today':
          return reportDate >= startOfToday;
        case 'week':
          return reportDate >= startOfWeek;
        case 'month':
          return reportDate >= startOfMonth;
        case 'quarter':
          return reportDate >= startOfQuarter;
        case 'year':
          return reportDate >= startOfYear;
        default:
          return true;
      }
    });
  };

  const filterReportsBySearch = (reports: Report[], searchTerm: string) => {
    if (!searchTerm.trim()) return reports;
    
    const searchLower = searchTerm.toLowerCase().trim();
    
    return reports.filter(report => {
      const { grade, class: studentClass } = getGradeAndClass(report);
      const studentName = getStudentName(report);
      
      // Search in student name, grade, and class
      const matchesName = studentName.toLowerCase().includes(searchLower);
      const matchesGrade = grade.toLowerCase().includes(searchLower);
      const matchesClass = studentClass.toLowerCase().includes(searchLower);
      
      return matchesName || matchesGrade || matchesClass;
    });
  };

  const getFilteredReports = () => {
    // First filter by date, then by search term
    const dateFiltered = filterReportsByDate(reports, selectedDateFilter);
    return filterReportsBySearch(dateFiltered, searchTerm);
  };

  const getSelectedFilterLabel = () => {
    const option = dateFilterOptions.find(opt => opt.key === selectedDateFilter);
    return option ? option.label : 'All Time';
  };

  useEffect(() => {
    loadReports();
    
    // Cleanup audio on unmount
    return () => {
      if (currentSound) {
        currentSound.unloadAsync();
      }
      setShowAudioModal(false);
    };
  }, []);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#667eea" />
        <Text style={styles.loadingText}>Loading reports...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Reports</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView 
        style={styles.scrollView}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh}
            colors={['#667eea']}
            tintColor="#667eea"
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Combined Search and Filter Section */}
        <View style={styles.combinedFilterSection}>
          <View style={styles.searchInputContainer}>
            <Ionicons name="search" size={20} color="#999" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search by student name, grade, or class..."
              placeholderTextColor="#999"
              value={searchTerm}
              onChangeText={setSearchTerm}
              returnKeyType="search"
            />
            {searchTerm.length > 0 && (
              <TouchableOpacity 
                style={styles.clearSearchButton}
                onPress={() => setSearchTerm('')}
              >
                <Ionicons name="close-circle" size={20} color="#999" />
              </TouchableOpacity>
            )}
          </View>
          
          <TouchableOpacity 
            style={styles.filterButton}
            onPress={() => setShowDateFilter(true)}
          >
            <Ionicons name="filter" size={16} color="#667eea" />
            <Text style={styles.filterButtonText}>{getSelectedFilterLabel()}</Text>
            <Ionicons name="chevron-down" size={16} color="#667eea" />
          </TouchableOpacity>
        </View>

        {/* Count Section */}
        <View style={styles.countSection}>
          <Text style={styles.countText}>
            {getFilteredReports().length} {getFilteredReports().length === 1 ? 'Report' : 'Reports'}
          </Text>
          <Text style={styles.filterSubtext}>
            {(selectedDateFilter !== 'all' || searchTerm) && 
              `${selectedDateFilter !== 'all' ? `${getSelectedFilterLabel()}` : ''}${
                (selectedDateFilter !== 'all' && searchTerm) ? ' • ' : ''
              }${searchTerm ? `"${searchTerm}"` : ''}`
            }
          </Text>
        </View>

        {/* Reports List */}
        <View style={styles.reportsSection}>
          {getFilteredReports().map((report) => {
            const { grade, class: studentClass } = getGradeAndClass(report);
            const transcription = getTranscription(report);
            const hasAudio = hasAudioRecording(report);
            const isPlayingThis = playingReportId === report._id;

            return (
              <View key={report._id} style={styles.reportCard}>
                {/* Header */}
                <View style={styles.cardHeader}>
                  <View style={styles.studentInfo}>
                    <Text style={styles.studentName}>
                      {getStudentName(report)}
                    </Text>
                    <View style={styles.chipsContainer}>
                      <View style={styles.chip}>
                        <Ionicons name="school" size={12} color="#667eea" />
                        <Text style={styles.chipText}>{grade}</Text>
                      </View>
                      <View style={styles.chip}>
                        <Ionicons name="people" size={12} color="#667eea" />
                        <Text style={styles.chipText}>{studentClass}</Text>
                      </View>
                    </View>
                  </View>
                  <View style={[
                    styles.statusBadge, 
                    { backgroundColor: getStatusColor(report.status) }
                  ]}>
                    <Text style={styles.statusText}>{report.status}</Text>
                  </View>
                </View>

                {/* Report Info */}
                <View style={styles.cardBody}>
                  <Text style={styles.reportTitle}>Progress Report</Text>
                  <Text style={styles.reportDate}>
                    Created: {formatDate(report.createdAt)}
                  </Text>
                  {report.sentAt && (
                    <Text style={styles.reportDate}>
                      Sent: {formatDate(report.sentAt)}
                    </Text>
                  )}
                </View>

                {/* Action Buttons */}
                <View style={styles.cardActions}>
                  {/* Audio Controls */}
                  <TouchableOpacity 
                    style={[
                      styles.actionButton, 
                      !hasAudio && styles.disabledButton
                    ]}
                    onPress={() => hasAudio && (isPlayingThis ? stopAudio() : playAudio(report))}
                    disabled={!hasAudio}
                  >
                    <Ionicons 
                      name={isPlayingThis ? "stop" : "play"} 
                      size={16} 
                      color={hasAudio ? "white" : "#ccc"} 
                    />
                    <Text style={[
                      styles.actionButtonText,
                      !hasAudio && styles.disabledButtonText
                    ]}>
                      {isPlayingThis ? 'Stop' : 'Audio'}
                    </Text>
                  </TouchableOpacity>

                  {/* Transcription Button */}
                  <TouchableOpacity 
                    style={[
                      styles.actionButton, 
                      { backgroundColor: '#4caf50' },
                      !transcription && styles.disabledButton
                    ]}
                    onPress={() => transcription && viewTranscription(report)}
                    disabled={!transcription}
                  >
                    <Ionicons 
                      name="text" 
                      size={16} 
                      color={transcription ? "white" : "#ccc"} 
                    />
                    <Text style={[
                      styles.actionButtonText,
                      !transcription && styles.disabledButtonText
                    ]}>
                      Transcript
                    </Text>
                  </TouchableOpacity>

                  {/* View Report Button */}
                  <TouchableOpacity 
                    style={[styles.actionButton, { backgroundColor: '#ff9800' }]}
                    onPress={() => viewReport(report)}
                  >
                    <Ionicons name="document-text" size={16} color="white" />
                    <Text style={styles.actionButtonText}>Report</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </View>

        {getFilteredReports().length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="document-text-outline" size={64} color="#ccc" />
            <Text style={styles.emptyStateTitle}>
              {reports.length === 0 ? 'No Reports Found' : 
               searchTerm ? 'No Matching Reports' : 'No Reports in Selected Period'}
            </Text>
            <Text style={styles.emptyStateText}>
              {reports.length === 0 
                ? 'You haven\'t generated any reports yet. Start by creating reports for your students.'
                : searchTerm
                ? `No reports found matching "${searchTerm}". Try a different search term.`
                : `No reports found for ${getSelectedFilterLabel().toLowerCase()}. Try selecting a different time period.`
              }
            </Text>
            {reports.length > 0 && (selectedDateFilter !== 'all' || searchTerm) && (
              <View style={styles.clearFiltersContainer}>
                {searchTerm && (
                  <TouchableOpacity 
                    style={styles.clearFilterButton}
                    onPress={() => setSearchTerm('')}
                  >
                    <Text style={styles.clearFilterText}>Clear Search</Text>
                  </TouchableOpacity>
                )}
                {selectedDateFilter !== 'all' && (
                  <TouchableOpacity 
                    style={styles.clearFilterButton}
                    onPress={() => setSelectedDateFilter('all')}
                  >
                    <Text style={styles.clearFilterText}>Show All Time</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* Report Content Modal */}
      <Modal
        visible={showReportModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowReportModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowReportModal(false)} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Report Content</Text>
            <View style={styles.headerRight} />
          </View>
          
          {selectedReport && (
            <ScrollView style={styles.modalScrollView} showsVerticalScrollIndicator={false}>
              <View style={styles.modalContent}>
                <Text style={styles.modalReportTitle}>{selectedReport.title}</Text>
                <Text style={styles.modalStudentName}>
                  Student: {getStudentName(selectedReport)}
                </Text>
                <Text style={styles.modalDate}>
                  Created: {formatDate(selectedReport.createdAt)}
                </Text>
                <View style={styles.modalDivider} />
                <Text style={styles.modalReportContent}>{selectedReport.content}</Text>
              </View>
            </ScrollView>
          )}
        </View>
      </Modal>

      {/* Transcription Modal */}
      <Modal
        visible={showTranscriptionModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowTranscriptionModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowTranscriptionModal(false)} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Audio Transcription</Text>
            <View style={styles.headerRight} />
          </View>
          
          {selectedReport && (
            <ScrollView style={styles.modalScrollView} showsVerticalScrollIndicator={false}>
              <View style={styles.modalContent}>
                <Text style={styles.modalReportTitle}>Original Transcription</Text>
                <Text style={styles.modalStudentName}>
                  Student: {getStudentName(selectedReport)}
                </Text>
                <Text style={styles.modalDate}>
                  Created: {formatDate(selectedReport.createdAt)}
                </Text>
                <View style={styles.modalDivider} />
                <Text style={styles.modalTranscriptionContent}>
                  {getTranscription(selectedReport) || 'No transcription available'}
                </Text>
              </View>
            </ScrollView>
          )}
        </View>
      </Modal>

      {/* Audio Modal */}
      <Modal
        visible={showAudioModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowAudioModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowAudioModal(false)} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Audio Recordings</Text>
            <View style={styles.headerRight} />
          </View>
          
          {selectedReport && (
            <ScrollView style={styles.modalScrollView} showsVerticalScrollIndicator={false}>
              <View style={styles.modalContent}>
                <Text style={styles.modalReportTitle}>Audio Recordings</Text>
                <Text style={styles.modalStudentName}>
                  Student: {getStudentName(selectedReport)}
                </Text>
                <Text style={styles.modalDate}>
                  Created: {formatDate(selectedReport.createdAt)}
                </Text>
                <View style={styles.modalDivider} />
                
                {getAudioRecordings(selectedReport).map((recording, index) => {
                  if (!recording) return null; // Safety check
                  
                  const isPlayingThis = playingReportId === selectedReport._id && playingRecordingIndex === index;
                  const duration = recording.duration ? `${Math.floor(recording.duration / 60)}:${(recording.duration % 60).toString().padStart(2, '0')}` : '';
                  
                  return (
                    <View key={index} style={styles.audioRecordingItem}>
                      <View style={styles.audioRecordingHeader}>
                        <Text style={styles.audioRecordingTitle}>{recording.title}</Text>
                        {duration && <Text style={styles.audioRecordingDuration}>{duration}</Text>}
                      </View>
                      
                      <View style={styles.audioRecordingControls}>
                        <TouchableOpacity 
                          style={[styles.audioPlayButton, isPlayingThis && styles.audioStopButton]}
                          onPress={() => isPlayingThis ? stopAudio() : playSpecificRecording(recording.url, index, selectedReport._id)}
                        >
                          <Ionicons 
                            name={isPlayingThis ? "stop" : "play"} 
                            size={20} 
                            color="white" 
                          />
                          <Text style={styles.audioPlayButtonText}>
                            {isPlayingThis ? 'Stop' : 'Play'}
                          </Text>
                        </TouchableOpacity>
                      </View>
                      
                      {recording.transcription && (
                        <View style={styles.audioTranscriptionPreview}>
                          <Text style={styles.audioTranscriptionLabel}>Transcription:</Text>
                          <Text style={styles.audioTranscriptionText}>
                            {recording.transcription.length > 100 
                              ? `${recording.transcription.substring(0, 100)}...` 
                              : recording.transcription
                            }
                          </Text>
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            </ScrollView>
          )}
        </View>
      </Modal>

      {/* Date Filter Modal */}
      <Modal
        visible={showDateFilter}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowDateFilter(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowDateFilter(false)} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Filter by Date</Text>
            <View style={styles.headerRight} />
          </View>
          
          <ScrollView style={styles.modalScrollView} showsVerticalScrollIndicator={false}>
            <View style={styles.modalContent}>
              <Text style={styles.filterModalTitle}>Select Time Period</Text>
              <Text style={styles.filterModalSubtitle}>
                Choose a time period to filter your reports
              </Text>
              
              <View style={styles.filterOptionsContainer}>
                {dateFilterOptions.map((option) => {
                  const isSelected = selectedDateFilter === option.key;
                  const filteredCount = filterReportsByDate(reports, option.key).length;
                  
                  return (
                    <TouchableOpacity
                      key={option.key}
                      style={[
                        styles.filterOption,
                        isSelected && styles.filterOptionSelected
                      ]}
                      onPress={() => {
                        setSelectedDateFilter(option.key);
                        setShowDateFilter(false);
                      }}
                    >
                      <View style={styles.filterOptionLeft}>
                        <View style={[
                          styles.filterOptionIcon,
                          isSelected && styles.filterOptionIconSelected
                        ]}>
                          <Ionicons 
                            name={option.icon as any} 
                            size={20} 
                            color={isSelected ? "#667eea" : "#666"} 
                          />
                        </View>
                        <View style={styles.filterOptionText}>
                          <Text style={[
                            styles.filterOptionLabel,
                            isSelected && styles.filterOptionLabelSelected
                          ]}>
                            {option.label}
                          </Text>
                          <Text style={styles.filterOptionCount}>
                            {filteredCount} {filteredCount === 1 ? 'report' : 'reports'}
                          </Text>
                        </View>
                      </View>
                      
                      {isSelected && (
                        <View style={styles.filterOptionCheck}>
                          <Ionicons name="checkmark-circle" size={24} color="#667eea" />
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
              
              <TouchableOpacity
                style={styles.resetFilterButton}
                onPress={() => {
                  setSelectedDateFilter('all');
                  setShowDateFilter(false);
                }}
              >
                <Ionicons name="refresh" size={16} color="#666" />
                <Text style={styles.resetFilterText}>Reset to All Time</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 15,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    padding: 5,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  headerRight: {
    width: 34,
  },
  scrollView: {
    flex: 1,
  },
  combinedFilterSection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    gap: 12,
  },
  searchContainer: {
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    paddingVertical: 4,
  },
  clearSearchButton: {
    padding: 4,
    marginLeft: 8,
  },
  countSection: {
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  filterSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingBottom: 10,
  },
  countContainer: {
    flex: 1,
  },
  countText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  filterSubtext: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9ff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e8ecff',
    marginLeft: 12,
  },
  filterButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#667eea',
    marginHorizontal: 6,
  },
  reportsSection: {
    padding: 20,
    paddingTop: 0,
  },
  reportCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  studentInfo: {
    flex: 1,
  },
  studentName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  chipsContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  chip: {
    backgroundColor: '#f8f9ff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e8ecff',
    flexDirection: 'row',
    alignItems: 'center',
  },
  chipText: {
    fontSize: 11,
    color: '#667eea',
    fontWeight: '600',
    marginLeft: 4,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
    color: 'white',
    textTransform: 'capitalize',
  },
  cardBody: {
    marginBottom: 12,
  },
  reportTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  reportDate: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  cardActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    backgroundColor: '#667eea',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  actionButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 4,
  },
  disabledButton: {
    backgroundColor: '#e0e0e0',
  },
  disabledButtonText: {
    color: '#999',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 16,
  },
  clearFiltersContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  clearFilterButton: {
    backgroundColor: '#667eea',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  clearFilterText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  // Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 15,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  closeButton: {
    padding: 5,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  modalScrollView: {
    flex: 1,
    padding: 20,
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  modalReportTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginBottom: 8,
  },
  modalStudentName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#667eea',
    marginBottom: 4,
  },
  modalDate: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  modalDivider: {
    height: 1,
    backgroundColor: '#e0e0e0',
    marginBottom: 16,
  },
  modalReportContent: {
    fontSize: 16,
    lineHeight: 24,
    color: '#333',
  },
  modalTranscriptionContent: {
    fontSize: 16,
    lineHeight: 24,
    color: '#333',
    fontFamily: 'monospace',
  },
  audioRecordingItem: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  audioRecordingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  audioRecordingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  audioRecordingDuration: {
    fontSize: 14,
    color: '#666',
    backgroundColor: '#e9ecef',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  audioRecordingControls: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  audioPlayButton: {
    backgroundColor: '#667eea',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  audioStopButton: {
    backgroundColor: '#f44336',
  },
  audioPlayButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  audioTranscriptionPreview: {
    marginTop: 8,
    padding: 12,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  audioTranscriptionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  audioTranscriptionText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#333',
    fontStyle: 'italic',
  },
  // Date Filter Modal Styles
  filterModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
    marginBottom: 8,
  },
  filterModalSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 24,
  },
  filterOptionsContainer: {
    marginBottom: 24,
  },
  filterOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  filterOptionSelected: {
    borderColor: '#667eea',
    backgroundColor: '#f8f9ff',
  },
  filterOptionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  filterOptionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  filterOptionIconSelected: {
    backgroundColor: '#e8ecff',
  },
  filterOptionText: {
    flex: 1,
  },
  filterOptionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  filterOptionLabelSelected: {
    color: '#667eea',
  },
  filterOptionCount: {
    fontSize: 12,
    color: '#666',
  },
  filterOptionCheck: {
    marginLeft: 12,
  },
  resetFilterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  resetFilterText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginLeft: 8,
  },
});

export default ReportsScreen;