import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
  Dimensions,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useBranding } from './contexts/BrandingContext';
import { Ionicons } from '@expo/vector-icons';
import apiService, { User } from './apiService';

interface ParentDashboardProps {
  user: User;
  onLogout: () => void;
}

interface Child {
  id: string;
  firstName: string;
  lastName: string;
  grade: string;
  class: string;
  teacherName: string;
  lastReportDate?: string;
}

interface ProgressReport {
  id: string;
  title: string;
  content: string;
  status: 'draft' | 'completed' | 'sent';
  createdAt: string;
  teacherName: string;
  subject?: string;
  grade?: string;
}

interface Activity {
  id: string;
  title: string;
  description: string;
  date: string;
  type: 'academic' | 'social' | 'physical' | 'creative';
}

const ParentDashboard: React.FC<ParentDashboardProps> = ({ user, onLogout }) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [fadeAnim] = useState(new Animated.Value(0));
  const [slideAnim] = useState(new Animated.Value(50));
  const [children, setChildren] = useState<Child[]>([]);
  const [reports, setReports] = useState<ProgressReport[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      // Load children data
      const childrenData = await apiService.getChildReports();
      setChildren([
        {
          id: '1',
          firstName: 'Emma',
          lastName: 'Johnson',
          grade: 'Kindergarten',
          class: 'K-A',
          teacherName: 'Ms. Rodriguez',
          lastReportDate: '2024-01-15',
        },
        {
          id: '2',
          firstName: 'Liam',
          lastName: 'Smith',
          grade: '1st Grade',
          class: '1-B',
          teacherName: 'Mr. Chen',
          lastReportDate: '2024-01-14',
        },
      ]);

      // Load reports
      const reportsData = await apiService.getChildReports();
      setReports([
        {
          id: '1',
          title: 'Monthly Progress Report',
          content: 'Emma has shown excellent progress in reading and math...',
          status: 'sent',
          createdAt: '2024-01-15T10:00:00Z',
          teacherName: 'Ms. Rodriguez',
          subject: 'General',
          grade: 'A',
        },
        {
          id: '2',
          title: 'Weekly Assessment',
          content: 'Liam continues to develop his social skills...',
          status: 'completed',
          createdAt: '2024-01-14T14:30:00Z',
          teacherName: 'Mr. Chen',
          subject: 'Social Studies',
          grade: 'B+',
        },
      ]);

      // Load activities
      setActivities([
        {
          id: '1',
          title: 'Reading Circle',
          description: 'Group reading activity with classmates',
          date: '2024-01-15',
          type: 'academic',
        },
        {
          id: '2',
          title: 'Art Project',
          description: 'Creative painting session',
          date: '2024-01-14',
          type: 'creative',
        },
        {
          id: '3',
          title: 'Playground Time',
          description: 'Outdoor physical activities',
          date: '2024-01-13',
          type: 'physical',
        },
      ]);
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
    
    // Animate components on mount
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  const renderOverview = () => (
    <ScrollView style={styles.tabContent} refreshControl={
      <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
    }>
      {/* Children Summary */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>My Children ({children.length})</Text>
        {children.map((child) => (
          <View key={child.id} style={styles.childCard}>
            <View style={styles.childHeader}>
              <View style={styles.childAvatar}>
                <Text style={styles.avatarText}>
                  {child.firstName.charAt(0)}{child.lastName.charAt(0)}
                </Text>
              </View>
              <View style={styles.childInfo}>
                <Text style={styles.childName}>
                  {child.firstName} {child.lastName}
                </Text>
                <Text style={styles.childDetails}>
                  Grade {child.grade} • {child.class}
                </Text>
                <Text style={styles.teacherName}>
                  Teacher: {child.teacherName}
                </Text>
              </View>
            </View>
            {child.lastReportDate && (
              <Text style={styles.lastReport}>
                Last report: {new Date(child.lastReportDate).toLocaleDateString()}
              </Text>
            )}
          </View>
        ))}
      </View>

      {/* Recent Reports */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recent Reports</Text>
        {reports.slice(0, 3).map((report) => (
          <View key={report.id} style={styles.reportCard}>
            <View style={styles.reportHeader}>
              <Text style={styles.reportTitle}>{report.title}</Text>
              <View style={[styles.statusBadge, 
                { backgroundColor: report.status === 'sent' ? '#4caf50' : '#ff9800' }]}>
                <Text style={styles.statusText}>{report.status}</Text>
              </View>
            </View>
            <Text style={styles.reportTeacher}>{report.teacherName}</Text>
            <Text style={styles.reportDate}>
              {new Date(report.createdAt).toLocaleDateString()}
            </Text>
            {report.grade && (
              <Text style={styles.reportGrade}>Grade: {report.grade}</Text>
            )}
          </View>
        ))}
      </View>
    </ScrollView>
  );

  const renderChildren = () => (
    <ScrollView style={styles.tabContent} refreshControl={
      <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
    }>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>My Children</Text>
        
        {children.map((child) => (
          <TouchableOpacity key={child.id} style={styles.childCard}>
            <View style={styles.childHeader}>
              <View style={styles.childAvatar}>
                <Text style={styles.avatarText}>
                  {child.firstName.charAt(0)}{child.lastName.charAt(0)}
                </Text>
              </View>
              <View style={styles.childInfo}>
                <Text style={styles.childName}>
                  {child.firstName} {child.lastName}
                </Text>
                <Text style={styles.childDetails}>
                  Grade {child.grade} • {child.class}
                </Text>
                <Text style={styles.teacherName}>
                  Teacher: {child.teacherName}
                </Text>
              </View>
            </View>
            
            {child.lastReportDate && (
              <Text style={styles.lastReport}>
                Last report: {new Date(child.lastReportDate).toLocaleDateString()}
              </Text>
            )}
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );

  const renderReports = () => (
    <ScrollView style={styles.tabContent} refreshControl={
      <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
    }>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Progress Reports ({reports.length})</Text>
        
        {reports.map((report) => (
          <TouchableOpacity key={report.id} style={styles.reportCard}>
            <View style={styles.reportHeader}>
              <Text style={styles.reportTitle}>{report.title}</Text>
              <View style={[styles.statusBadge, 
                { backgroundColor: report.status === 'sent' ? '#4caf50' : '#ff9800' }]}>
                <Text style={styles.statusText}>{report.status}</Text>
              </View>
            </View>
            
            <Text style={styles.reportTeacher}>{report.teacherName}</Text>
            <Text style={styles.reportDate}>
              {new Date(report.createdAt).toLocaleDateString()}
            </Text>
            
            {report.subject && (
              <Text style={styles.reportSubject}>Subject: {report.subject}</Text>
            )}
            
            {report.grade && (
              <Text style={styles.reportGrade}>Grade: {report.grade}</Text>
            )}
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );

  const renderActivities = () => (
    <ScrollView style={styles.tabContent} refreshControl={
      <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
    }>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Daily Activities</Text>
        
        {activities.map((activity) => (
          <View key={activity.id} style={styles.activityCard}>
            <View style={styles.activityHeader}>
              <View style={[styles.activityIcon, 
                { backgroundColor: activity.type === 'academic' ? '#1976d2' : 
                  activity.type === 'creative' ? '#9c27b0' : 
                  activity.type === 'physical' ? '#4caf50' : '#ff9800' }]}>
                <Ionicons 
                  name={activity.type === 'academic' ? 'school' : 
                    activity.type === 'creative' ? 'brush' : 
                    activity.type === 'physical' ? 'fitness' : 'people'} 
                  size={16} 
                  color="white" 
                />
              </View>
              <View style={styles.activityInfo}>
                <Text style={styles.activityTitle}>{activity.title}</Text>
                <Text style={styles.activityDescription}>{activity.description}</Text>
                <Text style={styles.activityDate}>{activity.date}</Text>
              </View>
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );

  const renderMessages = () => (
    <ScrollView style={styles.tabContent} refreshControl={
      <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
    }>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Messages</Text>
        
        <TouchableOpacity style={styles.messageCard}>
          <Ionicons name="mail" size={24} color="#2196f3" />
          <Text style={styles.messageTitle}>New Report Available</Text>
          <Text style={styles.messageSubtitle}>
            Emma's monthly progress report is ready to view
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.messageCard}>
          <Ionicons name="notifications" size={24} color="#ff9800" />
          <Text style={styles.messageTitle}>Parent-Teacher Meeting</Text>
          <Text style={styles.messageSubtitle}>
            Scheduled for next week - check your calendar
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.messageCard}>
          <Ionicons name="calendar" size={24} color="#4caf50" />
          <Text style={styles.messageTitle}>School Event</Text>
          <Text style={styles.messageSubtitle}>
            Art showcase this Friday at 3 PM
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return renderOverview();
      case 'children':
        return renderChildren();
      case 'reports':
        return renderReports();
      case 'activities':
        return renderActivities();
      case 'messages':
        return renderMessages();
      default:
        return renderOverview();
    }
  };

  const { branding } = useBranding();
  const primaryColor = branding?.branding?.primaryColor || '#667eea';
  const secondaryColor = branding?.branding?.secondaryColor || '#764ba2';

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
      {/* Enhanced Header */}
      <LinearGradient 
        colors={[primaryColor, secondaryColor]} 
        style={styles.modernHeader}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.headerSafeArea}>
          <View style={styles.headerTopRow}>
            <TouchableOpacity style={styles.menuButton}>
              <Ionicons name="menu" size={24} color="rgba(255,255,255,0.9)" />
            </TouchableOpacity>
            <TouchableOpacity onPress={onLogout} style={styles.modernLogoutButton}>
              <Ionicons name="log-out-outline" size={20} color="rgba(255,255,255,0.9)" />
            </TouchableOpacity>
          </View>
          
          <View style={styles.headerMainContent}>
            <Text style={styles.modernHeaderTitle}>Family Hub</Text>
            <View style={styles.headerUserInfo}>
              <Text style={styles.headerGreeting}>Good morning, {user.firstName}!</Text>
              {typeof user.schoolId === 'object' && user.schoolId?.name && (
                <Text style={styles.headerSchool}>{user.schoolId.name}</Text>
              )}
            </View>
          </View>
        </View>
      </LinearGradient>

      {/* Enhanced Tab Navigation */}
      <View style={styles.modernTabContainer}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.modernTabContentContainer}
        >
          {[
            { key: 'overview', label: 'Overview', icon: 'home', badge: null },
            { key: 'children', label: 'Children', icon: 'people', badge: children.length },
            { key: 'reports', label: 'Reports', icon: 'document-text', badge: reports.filter(r => r.status === 'sent').length },
            { key: 'activities', label: 'Activities', icon: 'calendar', badge: null },
            { key: 'messages', label: 'Messages', icon: 'mail', badge: 2 },
          ].map((tab) => (
            <TouchableOpacity
              key={tab.key}
              style={[
                styles.modernTab, 
                activeTab === tab.key && styles.modernActiveTab
              ]}
              onPress={() => setActiveTab(tab.key)}
              activeOpacity={0.8}
            >
              <View style={styles.tabIconContainer}>
                <Ionicons 
                  name={tab.icon as any} 
                  size={22} 
                  color={activeTab === tab.key ? primaryColor : '#8e8e93'} 
                />
                {tab.badge !== null && tab.badge > 0 && (
                  <View style={styles.tabBadge}>
                    <Text style={styles.tabBadgeText}>
                      {tab.badge > 99 ? '99+' : tab.badge}
                    </Text>
                  </View>
                )}
              </View>
              <Text style={[
                styles.modernTabText, 
                activeTab === tab.key && styles.modernActiveTabText
              ]}>
                {tab.label}
              </Text>
              {activeTab === tab.key && (
                <View style={styles.tabIndicator} />
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Tab Content */}
      {renderTabContent()}
    </View>
  );
};

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6c757d',
    fontWeight: '500',
  },
  
  // Modern Header Styles
  modernHeader: {
    paddingTop: 50,
    paddingBottom: 24,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  headerSafeArea: {
    paddingHorizontal: 20,
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  menuButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modernLogoutButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerMainContent: {
    alignItems: 'flex-start',
  },
  modernHeaderTitle: {
    fontSize: 32,
    fontWeight: '700',
    color: 'white',
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  headerUserInfo: {
    flexDirection: 'column',
  },
  headerGreeting: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '500',
  },
  headerSchool: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
  },
  // Modern Tab Styles
  modernTabContainer: {
    backgroundColor: 'white',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modernTabContentContainer: {
    paddingHorizontal: 16,
    gap: 8,
  },
  modernTab: {
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 16,
    minWidth: 80,
    position: 'relative',
  },
  modernActiveTab: {
    backgroundColor: '#f0f4ff',
  },
  tabIconContainer: {
    position: 'relative',
    marginBottom: 4,
  },
  tabBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    backgroundColor: '#ff4757',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  tabBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: 'white',
  },
  modernTabText: {
    fontSize: 12,
    color: '#8e8e93',
    fontWeight: '500',
    textAlign: 'center',
  },
  modernActiveTabText: {
    color: '#667eea',
    fontWeight: '600',
  },
  tabIndicator: {
    position: 'absolute',
    bottom: 0,
    left: '50%',
    marginLeft: -12,
    width: 24,
    height: 3,
    backgroundColor: '#667eea',
    borderRadius: 2,
  },
  tabContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 16,
    letterSpacing: -0.3,
  },
  childCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  childHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  childAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#667eea',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 16,
  },
  childInfo: {
    flex: 1,
  },
  childName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  childDetails: {
    fontSize: 14,
    color: '#6c757d',
    marginTop: 2,
  },
  teacherName: {
    fontSize: 12,
    color: '#8e8e93',
    marginTop: 2,
  },
  lastReport: {
    fontSize: 12,
    color: '#8e8e93',
    marginTop: 4,
  },
  reportCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  reportHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  reportTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    flex: 1,
  },
  reportTeacher: {
    fontSize: 14,
    color: '#6c757d',
    marginBottom: 4,
  },
  reportDate: {
    fontSize: 12,
    color: '#8e8e93',
  },
  reportSubject: {
    fontSize: 12,
    color: '#6c757d',
    marginTop: 4,
    fontWeight: '500',
  },
  reportGrade: {
    fontSize: 12,
    color: '#4caf50',
    fontWeight: '600',
    marginTop: 4,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 11,
    color: 'white',
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  activityCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  activityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  activityIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  activityInfo: {
    flex: 1,
  },
  activityTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  activityDescription: {
    fontSize: 14,
    color: '#6c757d',
    marginTop: 2,
  },
  activityDate: {
    fontSize: 12,
    color: '#8e8e93',
    marginTop: 4,
  },
  messageCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
    flexDirection: 'row',
    alignItems: 'center',
  },
  messageTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginTop: 8,
  },
  messageSubtitle: {
    fontSize: 14,
    color: '#6c757d',
    marginTop: 4,
  },
});

export default ParentDashboard; 