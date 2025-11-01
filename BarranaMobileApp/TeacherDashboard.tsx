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
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useBranding } from './contexts/BrandingContext';
import apiService, { User } from './apiService';

interface TeacherDashboardProps {
  user: User;
  onLogout: () => void;
  onNavigateToStudents: () => void;
  onNavigateToReports: () => void;
}

interface Student {
  id: string;
  firstName: string;
  lastName: string;
  grade: string;
  class: string;
  status: string;
  lastReportDate?: string;
}

interface Report {
  id: string;
  studentId: string;
  studentName: string;
  title: string;
  content: string;
  status: 'draft' | 'completed' | 'sent';
  createdAt: string;
  updatedAt: string;
  voiceRecording?: {
    hasRecording: boolean;
    recordingUrl?: string;
    duration?: number;
  };
}

const TeacherDashboard: React.FC<TeacherDashboardProps> = ({ user, onLogout, onNavigateToStudents, onNavigateToReports }) => {
  const { branding } = useBranding();
  const primaryColor = branding?.branding?.primaryColor || '#667eea';
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [students, setStudents] = useState<Student[]>([]);
  const [reports, setReports] = useState<Report[]>([]);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      // Load students assigned to this teacher
      const studentsData = await apiService.getTeacherStudents(user.id);
      setStudents(studentsData);

      // Load reports for this teacher
      const reportsData = await apiService.getTeacherReports(user.id);
      setReports(reportsData);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      Alert.alert('Error', 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadDashboardData();
    setRefreshing(false);
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={primaryColor} />
        <Text style={styles.loadingText}>Loading dashboard...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView 
        style={styles.scrollView}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh}
            colors={[primaryColor]}
            tintColor={primaryColor}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Stats Section */}
        <View style={styles.statsSection}>
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Ionicons name="people" size={20} color={primaryColor} />
              <Text style={styles.statValue}>{students.length}</Text>
              <Text style={styles.statLabel}>Students</Text>
            </View>
            <View style={styles.statCard}>
              <Ionicons name="document-text" size={20} color="#4caf50" />
              <Text style={styles.statValue}>{reports.length}</Text>
              <Text style={styles.statLabel}>Reports</Text>
            </View>
            <View style={styles.statCard}>
              <Ionicons name="time" size={20} color="#9c27b0" />
              <Text style={styles.statValue}>
                {reports.filter(r => r.status === 'draft').length}
              </Text>
              <Text style={styles.statLabel}>Draft</Text>
            </View>
            <View style={styles.statCard}>
              <Ionicons name="checkmark-circle" size={20} color="#ff9800" />
              <Text style={styles.statValue}>
                {reports.filter(r => r.status === 'completed').length}
              </Text>
              <Text style={styles.statLabel}>Completed</Text>
            </View>
          </View>
        </View>

        {/* Quick Access Cards */}
        <View style={styles.quickAccessSection}>
          <TouchableOpacity style={styles.quickAccessCard} onPress={onNavigateToStudents}>
            <Ionicons name="people" size={32} color={primaryColor} />
            <Text style={styles.quickAccessTitle}>My Students</Text>
            <Text style={styles.quickAccessCount}>{students.length} students</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.quickAccessCard} onPress={onNavigateToReports}>
            <Ionicons name="document-text" size={32} color="#4caf50" />
            <Text style={styles.quickAccessTitle}>My Reports</Text>
            <Text style={styles.quickAccessCount}>{reports.length} reports</Text>
          </TouchableOpacity>
        </View>






      </ScrollView>
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
    marginTop: 16,
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  scrollView: {
    flex: 1,
  },
  statsSection: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statCard: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    width: '23%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 3,
    marginBottom: 1,
  },
  statLabel: {
    fontSize: 10,
    color: '#666',
    fontWeight: '500',
  },
  section: {
    padding: 20,
    paddingTop: 0,
  },
  studentCard: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 15,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  studentInfo: {
    flex: 1,
  },
  studentName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  studentDetails: {
    fontSize: 14,
    color: '#666',
  },
  reportCard: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 15,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  reportInfo: {
    flex: 1,
  },
  reportTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  reportStudent: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  reportDate: {
    fontSize: 12,
    color: '#999',
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
  actionCard: {
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 15,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  actionText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginLeft: 10,
  },
  quickAccessSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  quickAccessCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 20,
    width: '48%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  quickAccessTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginTop: 8,
    marginBottom: 4,
  },
  quickAccessCount: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
});

export default TeacherDashboard; 