import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  SafeAreaView,
  Dimensions,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { useData } from '../../contexts/DataContext';

const { width, height } = Dimensions.get('window');

const TeacherDashboard: React.FC = () => {
  const [currentTab, setCurrentTab] = useState('dashboard');
  const [dueReports, setDueReports] = useState<any[]>([]);
  const [reportTemplates, setReportTemplates] = useState<any[]>([]);
  const { user, logout } = useAuth();
  const { students, reports, getStudentsByTeacherClasses, getReportsByTeacherStudents } = useData();

  const myStudents = user?.id ? getStudentsByTeacherClasses(user.id) : [];
  const myReports = user?.id ? getReportsByTeacherStudents(user.id) : [];

  // Load report templates
  useEffect(() => {
    const loadReportTemplates = async () => {
      try {
        // For now, we'll use a mock template since the mobile app doesn't have the reportTemplateService
        // In a real implementation, you would import and use the reportTemplateService
        const mockTemplate = {
          _id: 'mock-template-1',
          name: 'test template 1',
          grade: 'preschool',
          isActive: true,
          reportFrequency: 'Monthly',
          createdAt: new Date().toISOString(),
        };
        setReportTemplates([mockTemplate]);
      } catch (error) {
        console.error('Error loading report templates:', error);
      }
    };

    loadReportTemplates();
  }, []);

  // Calculate due reports
  useEffect(() => {
    const calculateDueReports = () => {
      const due: any[] = [];
      const now = new Date();

      myStudents.forEach(student => {
        // Find templates for this student's grade (case-insensitive)
        const gradeTemplates = reportTemplates.filter(template => 
          template.grade.toLowerCase() === student.grade.toLowerCase() && template.isActive
        );

        gradeTemplates.forEach(template => {
          const lastReport = myReports
            .filter(r => r.studentId === student._id)
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

          let dueDate: Date;

          if (lastReport) {
            // Calculate next due date based on last report
            dueDate = new Date(lastReport.createdAt);
            dueDate.setDate(dueDate.getDate() + 30); // Monthly frequency
          } else {
            // No previous report, due date is based on template creation
            dueDate = new Date(template.createdAt || new Date());
            dueDate.setDate(dueDate.getDate() + 30);
          }

          const daysOverdue = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

          // Only include if overdue or due within 7 days
          if (daysOverdue >= 0 || daysOverdue >= -7) {
            due.push({
              studentId: student._id,
              studentName: student.name,
              templateName: template.name,
              frequency: template.reportFrequency,
              dueDate,
              daysOverdue,
              templateId: template._id,
            });
          }
        });
      });

      setDueReports(due);
    };

    if (myStudents.length > 0 && reportTemplates.length > 0) {
      calculateDueReports();
    }
  }, [myStudents.length, reportTemplates.length, myReports.length]);

  const handleLogout = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign Out', onPress: logout, style: 'destructive' },
      ]
    );
  };

  const renderDashboard = () => (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View style={styles.userInfo}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {user?.firstName?.[0]}{user?.lastName?.[0]}
              </Text>
            </View>
            <View style={styles.userDetails}>
              <Text style={styles.welcomeText}>Welcome back!</Text>
              <Text style={styles.userName}>{user?.firstName} {user?.lastName}</Text>
            </View>
          </View>
          <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
            <Ionicons name="log-out-outline" size={24} color="#FF3B30" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Due Reports Notification */}
      {dueReports.length > 0 && (
        <View style={styles.notificationBanner}>
          <View style={styles.notificationIcon}>
            <Ionicons name="warning" size={20} color="white" />
          </View>
          <View style={styles.notificationContent}>
            <Text style={styles.notificationTitle}>
              {dueReports.length} Report{dueReports.length > 1 ? 's' : ''} Due
            </Text>
            <Text style={styles.notificationSubtitle}>
              {dueReports.length} student{dueReports.length > 1 ? 's' : ''} have overdue reports
            </Text>
          </View>
          <TouchableOpacity style={styles.notificationButton}>
            <Text style={styles.notificationButtonText}>View</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Quick Stats */}
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <View style={styles.statIcon}>
            <Ionicons name="people-outline" size={24} color="#25D366" />
          </View>
          <Text style={styles.statNumber}>{myStudents.length}</Text>
          <Text style={styles.statLabel}>Students</Text>
        </View>

        <View style={styles.statCard}>
          <View style={styles.statIcon}>
            <Ionicons name="document-text-outline" size={24} color="#007AFF" />
          </View>
          <Text style={styles.statNumber}>{myReports.length}</Text>
          <Text style={styles.statLabel}>Reports</Text>
        </View>

        <View style={styles.statCard}>
          <View style={styles.statIcon}>
            <Ionicons name="mic-outline" size={24} color="#FF9500" />
          </View>
          <Text style={styles.statNumber}>0</Text>
          <Text style={styles.statLabel}>Recordings</Text>
        </View>
      </View>

      {/* Quick Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.actionGrid}>
          <TouchableOpacity style={styles.actionCard}>
            <View style={styles.actionIcon}>
              <Ionicons name="mic" size={24} color="white" />
            </View>
            <Text style={styles.actionText}>Record Voice</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionCard}>
            <View style={styles.actionIcon}>
              <Ionicons name="document-text" size={24} color="white" />
            </View>
            <Text style={styles.actionText}>Create Report</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionCard}>
            <View style={styles.actionIcon}>
              <Ionicons name="people" size={24} color="white" />
            </View>
            <Text style={styles.actionText}>View Students</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionCard}>
            <View style={styles.actionIcon}>
              <Ionicons name="settings" size={24} color="white" />
            </View>
            <Text style={styles.actionText}>Settings</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Recent Activity */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recent Activity</Text>
        <View style={styles.activityCard}>
          <View style={styles.activityIcon}>
            <Ionicons name="document-text" size={20} color="#25D366" />
          </View>
          <View style={styles.activityContent}>
            <Text style={styles.activityTitle}>Report Generated</Text>
            <Text style={styles.activitySubtitle}>
              Monthly progress report for Emma Johnson
            </Text>
            <Text style={styles.activityTime}>2 hours ago</Text>
          </View>
        </View>

        <View style={styles.activityCard}>
          <View style={styles.activityIcon}>
            <Ionicons name="mic" size={20} color="#FF9500" />
          </View>
          <View style={styles.activityContent}>
            <Text style={styles.activityTitle}>Voice Recording</Text>
            <Text style={styles.activitySubtitle}>
              Recorded observations for Liam Chen
            </Text>
            <Text style={styles.activityTime}>1 day ago</Text>
          </View>
        </View>
      </View>

      {/* My Students Preview */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>My Students</Text>
          <TouchableOpacity>
            <Text style={styles.seeAllText}>See All</Text>
          </TouchableOpacity>
        </View>
        {myStudents.slice(0, 3).map((student) => (
          <View key={student.id} style={styles.studentCard}>
            <View style={styles.studentAvatar}>
              <Text style={styles.studentAvatarText}>{student.avatar}</Text>
            </View>
            <View style={styles.studentInfo}>
              <Text style={styles.studentName}>{student.name}</Text>
              <Text style={styles.studentGrade}>{student.grade} - {student.class}</Text>
              <Text style={styles.studentStatus}>
                Status: {student.status}
              </Text>
            </View>
            <TouchableOpacity style={styles.viewButton}>
              <Ionicons name="chevron-forward" size={20} color="#8E8E93" />
            </TouchableOpacity>
          </View>
        ))}
      </View>
    </ScrollView>
  );

  const renderStudents = () => (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>My Students</Text>
          <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
            <Ionicons name="log-out-outline" size={24} color="#FF3B30" />
          </TouchableOpacity>
        </View>
      </View>

      {myStudents.map((student) => (
        <View key={student.id} style={styles.studentCard}>
          <View style={styles.studentAvatar}>
            <Text style={styles.studentAvatarText}>{student.avatar}</Text>
          </View>
          <View style={styles.studentInfo}>
            <Text style={styles.studentName}>{student.name}</Text>
            <Text style={styles.studentGrade}>{student.grade} - {student.class}</Text>
            <Text style={styles.studentStatus}>
              Status: {student.status}
            </Text>
            <Text style={styles.studentLastReport}>
              Last Report: {new Date(student.lastReport).toLocaleDateString()}
            </Text>
          </View>
          <TouchableOpacity style={styles.viewButton}>
            <Ionicons name="chevron-forward" size={20} color="#8E8E93" />
          </TouchableOpacity>
        </View>
      ))}
    </ScrollView>
  );

  const renderReports = () => (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>My Reports</Text>
          <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
            <Ionicons name="log-out-outline" size={24} color="#FF3B30" />
          </TouchableOpacity>
        </View>
      </View>

      {myReports.map((report) => (
        <View key={report.id} style={styles.reportCard}>
          <View style={styles.reportHeader}>
            <Text style={styles.reportTitle}>{report.title}</Text>
            <View style={[
              styles.statusBadge,
              { backgroundColor: report.status === 'completed' ? '#25D366' : '#FF9500' }
            ]}>
              <Text style={styles.statusText}>{report.status}</Text>
            </View>
          </View>
          <Text style={styles.reportContent} numberOfLines={3}>
            {report.content}
          </Text>
          <Text style={styles.reportDate}>
            {new Date(report.createdAt).toLocaleDateString()}
          </Text>
        </View>
      ))}
    </ScrollView>
  );

  const renderVoiceRecording = () => (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Voice Recording</Text>
          <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
            <Ionicons name="log-out-outline" size={24} color="#FF3B30" />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.recordingContainer}>
        <View style={styles.recordingCard}>
          <View style={styles.recordingIcon}>
            <Ionicons name="mic" size={48} color="#25D366" />
          </View>
          <Text style={styles.recordingTitle}>Voice Recording</Text>
          <Text style={styles.recordingSubtitle}>
            Record observations and notes for your students
          </Text>
          
          <TouchableOpacity style={styles.recordButton}>
            <Ionicons name="mic" size={24} color="white" />
            <Text style={styles.recordButtonText}>Start Recording</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );

  const renderSettings = () => (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Settings</Text>
          <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
            <Ionicons name="log-out-outline" size={24} color="#FF3B30" />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.settingsContainer}>
        <TouchableOpacity style={styles.settingItem}>
          <Ionicons name="person-outline" size={24} color="#8E8E93" />
          <Text style={styles.settingText}>Profile</Text>
          <Ionicons name="chevron-forward" size={20} color="#8E8E93" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.settingItem}>
          <Ionicons name="notifications-outline" size={24} color="#8E8E93" />
          <Text style={styles.settingText}>Notifications</Text>
          <Ionicons name="chevron-forward" size={20} color="#8E8E93" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.settingItem}>
          <Ionicons name="language-outline" size={24} color="#8E8E93" />
          <Text style={styles.settingText}>Language</Text>
          <Ionicons name="chevron-forward" size={20} color="#8E8E93" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.settingItem}>
          <Ionicons name="help-circle-outline" size={24} color="#8E8E93" />
          <Text style={styles.settingText}>Help & Support</Text>
          <Ionicons name="chevron-forward" size={20} color="#8E8E93" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.settingItem} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={24} color="#FF3B30" />
          <Text style={[styles.settingText, { color: '#FF3B30' }]}>Sign Out</Text>
          <Ionicons name="chevron-forward" size={20} color="#FF3B30" />
        </TouchableOpacity>
      </View>
    </ScrollView>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      {currentTab === 'dashboard' && renderDashboard()}
      {currentTab === 'students' && renderStudents()}
      {currentTab === 'reports' && renderReports()}
      {currentTab === 'recording' && renderVoiceRecording()}
      {currentTab === 'settings' && renderSettings()}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  container: {
    flex: 1,
    paddingHorizontal: 16,
  },
  notificationBanner: {
    backgroundColor: '#FF9500',
    borderRadius: 12,
    padding: 16,
    margin: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  notificationIcon: {
    marginRight: 12,
  },
  notificationContent: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
    marginBottom: 2,
  },
  notificationSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  notificationButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  notificationButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  header: {
    backgroundColor: '#FFFFFF',
    paddingTop: Platform.OS === 'ios' ? 0 : 20,
    paddingBottom: 16,
    marginBottom: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E5E5EA',
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#25D366',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  userDetails: {
    flex: 1,
  },
  welcomeText: {
    fontSize: 14,
    color: '#8E8E93',
  },
  userName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1C1C1E',
  },
  logoutButton: {
    padding: 8,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginHorizontal: 4,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  statIcon: {
    marginBottom: 8,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1C1C1E',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#8E8E93',
    fontWeight: '500',
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 16,
  },
  seeAllText: {
    fontSize: 16,
    color: '#25D366',
    fontWeight: '500',
  },
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  actionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    width: '48%',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#25D366',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  actionText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1C1C1E',
    textAlign: 'center',
  },
  activityCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  activityIcon: {
    marginRight: 16,
  },
  activityContent: {
    flex: 1,
  },
  activityTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 4,
  },
  activitySubtitle: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 4,
  },
  activityTime: {
    fontSize: 12,
    color: '#8E8E93',
  },
  studentCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  studentAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#25D366',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  studentAvatarText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  studentInfo: {
    flex: 1,
  },
  studentName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
    marginBottom: 2,
  },
  studentGrade: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 2,
  },
  studentStatus: {
    fontSize: 12,
    color: '#8E8E93',
    marginBottom: 2,
  },
  studentLastReport: {
    fontSize: 12,
    color: '#25D366',
  },
  viewButton: {
    padding: 8,
  },
  reportCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  reportHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  reportTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  reportContent: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 8,
  },
  reportDate: {
    fontSize: 12,
    color: '#8E8E93',
  },
  recordingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    paddingVertical: 40,
  },
  recordingCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  recordingIcon: {
    marginBottom: 16,
  },
  recordingTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1C1C1E',
    marginBottom: 8,
  },
  recordingSubtitle: {
    fontSize: 16,
    color: '#8E8E93',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  recordButton: {
    backgroundColor: '#25D366',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  recordButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  settingsContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E5E5EA',
  },
  settingText: {
    flex: 1,
    fontSize: 16,
    color: '#1C1C1E',
    marginLeft: 16,
  },
});

export default TeacherDashboard; 