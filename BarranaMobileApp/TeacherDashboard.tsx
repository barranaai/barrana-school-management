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
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
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
  const secondaryColor = branding?.branding?.secondaryColor || '#764ba2';
  const schoolName = branding?.schoolName || 'School';
  const schoolLogo = branding?.logo;
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
        {/* Branded School Banner */}
        <LinearGradient
          colors={[primaryColor, secondaryColor]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.schoolBanner}
        >
          {/* Logout Button */}
          <TouchableOpacity onPress={onLogout} style={styles.logoutButton}>
            <Ionicons name="log-out-outline" size={24} color="#ffffff" />
          </TouchableOpacity>

          <View style={styles.bannerContent}>
            <View style={styles.bannerLeft}>
              <Text style={styles.schoolNameText}>{schoolName.toUpperCase()}</Text>
              <Text style={styles.dashboardSubtitle}>Teacher Dashboard</Text>
              <View style={styles.userInfoBanner}>
                <Ionicons name="person-circle" size={16} color="rgba(255,255,255,0.9)" />
                <Text style={styles.userNameText}>{user.firstName} {user.lastName}</Text>
              </View>
            </View>
            {schoolLogo && (
              <View style={styles.logoContainer}>
                <Image 
                  source={{ uri: schoolLogo }} 
                  style={styles.schoolLogo}
                  resizeMode="contain"
                />
              </View>
            )}
          </View>
        </LinearGradient>

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

        {/* DEBUG: Branding Info */}
        <View style={styles.debugSection}>
          <Text style={styles.debugTitle}>🔍 DEBUG: Branding Status</Text>
          <Text style={styles.debugText}>School Name: {schoolName}</Text>
          <Text style={styles.debugText}>Primary Color: {primaryColor}</Text>
          <Text style={styles.debugText}>Secondary Color: {secondaryColor}</Text>
          <Text style={styles.debugText}>Logo URL: {schoolLogo || 'NOT SET'}</Text>
          <Text style={styles.debugText}>Branding Object: {branding ? 'EXISTS' : 'NULL'}</Text>
          <Text style={styles.debugText}>Full Branding: {JSON.stringify(branding, null, 2)}</Text>
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
  // Branded School Banner Styles
  schoolBanner: {
    paddingHorizontal: 20,
    paddingVertical: 24,
    paddingTop: 40, // Extra padding for status bar
    position: 'relative',
  },
  logoutButton: {
    position: 'absolute',
    top: 12,
    right: 20,
    zIndex: 10,
    padding: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 8,
  },
  bannerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bannerLeft: {
    flex: 1,
    marginRight: 16,
  },
  schoolNameText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    letterSpacing: 0.5,
    marginBottom: 4,
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  dashboardSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
    marginBottom: 8,
    fontWeight: '400',
  },
  userInfoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  userNameText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.95)',
    fontWeight: '500',
  },
  logoContainer: {
    width: 70,
    height: 70,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  schoolLogo: {
    width: '100%',
    height: '100%',
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
  // Debug Section Styles
  debugSection: {
    margin: 20,
    padding: 16,
    backgroundColor: '#fff3cd',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#ffc107',
  },
  debugTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#856404',
    marginBottom: 12,
  },
  debugText: {
    fontSize: 12,
    color: '#856404',
    marginBottom: 4,
    fontFamily: 'monospace',
  },
});

export default TeacherDashboard; 