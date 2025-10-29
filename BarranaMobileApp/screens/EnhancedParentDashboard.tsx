import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Dimensions,
  StatusBar,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { format, isToday, isTomorrow, isPast, parseISO } from 'date-fns';
import apiService, { User } from '../apiService';
import { useBranding } from '../contexts/BrandingContext';
import CalendarScreen from './CalendarScreen';
import ReportsListScreen from './ReportsListScreen';
import CommunicationScreen from '../components/CommunicationScreen';
import notificationService from '../services/notificationService';

const { width } = Dimensions.get('window');

interface EnhancedParentDashboardProps {
  user: User;
  onLogout: () => void;
  navigation: any;
}

interface Child {
  _id: string;
  firstName: string;
  lastName: string;
  studentId: string;
  classId: {
    name: string;
    grade: string;
  };
  teacher: {
    name: string;
    email: string;
  };
}

interface Report {
  _id: string;
  title: string;
  date: string;
  studentId: {
    firstName: string;
    lastName: string;
  };
}

interface Event {
  _id: string;
  title: string;
  startDate: string;
  category?: string;
}

const EnhancedParentDashboard: React.FC<EnhancedParentDashboardProps> = ({ 
  user, 
  onLogout,
  navigation 
}) => {
  const { branding } = useBranding();
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [children, setChildren] = useState<Child[]>([]);
  const [recentReports, setRecentReports] = useState<Report[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<Event[]>([]);
  const [badgeCount, setBadgeCount] = useState(0);

  const primaryColor = branding?.branding.primaryColor || '#667eea';
  const secondaryColor = branding?.branding.secondaryColor || '#764ba2';
  const schoolLogo = branding?.logo;
  const schoolName = branding?.schoolName || 'School';

  useEffect(() => {
    loadDashboardData();
    setupNotifications();
  }, []);

  const setupNotifications = async () => {
    // Register for push notifications
    const token = await notificationService.registerForPushNotifications();
    if (token) {
      await notificationService.registerToken(token);
    }

    // Setup listeners
    notificationService.setupNotificationListeners(
      (notification) => {
        console.log('Notification received:', notification);
        // Refresh data when notification received
        loadDashboardData();
      },
      (response) => {
        console.log('Notification tapped:', response);
        // Handle notification tap - navigate to relevant screen
        const data = response.notification.request.content.data;
        if (data.type === 'report') {
          setActiveTab('reports');
        } else if (data.type === 'event') {
          setActiveTab('calendar');
        } else if (data.type === 'message') {
          setActiveTab('communication');
        }
      }
    );

    // Get badge count
    const count = await notificationService.getBadgeCount();
    setBadgeCount(count);
  };

  const loadDashboardData = async () => {
    try {
      setLoading(true);

      // Load children
      const childrenResponse = await apiService.makeRequest<{ success: boolean; data: Child[] }>(
        '/parents/me/children'
      );
      if (childrenResponse.success && childrenResponse.data) {
        setChildren(childrenResponse.data);
      }

      // Load recent reports
      const reportsResponse = await apiService.makeRequest<{ success: boolean; data: Report[] }>(
        '/parents/me/reports'
      );
      if (reportsResponse.success && reportsResponse.data) {
        // Get last 5 reports
        setRecentReports(reportsResponse.data.slice(0, 5));
      }

      // Load upcoming events
      const eventsResponse = await apiService.makeRequest<{ success: boolean; data: Event[] }>(
        '/parents/me/events'
      );
      if (eventsResponse.success && eventsResponse.data) {
        // Filter upcoming events and sort
        const upcoming = eventsResponse.data
          .filter(event => !isPast(parseISO(event.startDate)))
          .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
          .slice(0, 5);
        setUpcomingEvents(upcoming);
      }
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadDashboardData();
  };

  const getEventDateLabel = (dateStr: string) => {
    const date = parseISO(dateStr);
    if (isToday(date)) return 'Today';
    if (isTomorrow(date)) return 'Tomorrow';
    return format(date, 'MMM dd');
  };

  const getCategoryColor = (category?: string) => {
    switch (category?.toLowerCase()) {
      case 'academic': return '#10b981';
      case 'sports': return '#f59e0b';
      case 'cultural': return '#8b5cf6';
      case 'trip': return '#06b6d4';
      case 'meeting': return '#ef4444';
      default: return primaryColor;
    }
  };

  const renderOverview = () => (
    <ScrollView
      style={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={primaryColor}
        />
      }
    >
      {/* Welcome Section */}
      <LinearGradient
        colors={[primaryColor, secondaryColor]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.welcomeCard}
      >
        <View style={styles.welcomeContent}>
          <Text style={styles.welcomeTitle}>Welcome Back!</Text>
          <Text style={styles.welcomeName}>{user.firstName} {user.lastName}</Text>
          <Text style={styles.welcomeSchool}>{schoolName}</Text>
        </View>
        {schoolLogo && (
          <View style={styles.logoContainer}>
            {/* TODO: Display school logo */}
            <Ionicons name="school" size={60} color="rgba(255,255,255,0.3)" />
          </View>
        )}
      </LinearGradient>

      {/* Quick Stats */}
      <View style={styles.statsContainer}>
        <View style={[styles.statCard, { backgroundColor: `${primaryColor}15` }]}>
          <Ionicons name="people" size={32} color={primaryColor} />
          <Text style={styles.statNumber}>{children.length}</Text>
          <Text style={styles.statLabel}>Children</Text>
        </View>
        
        <View style={[styles.statCard, { backgroundColor: '#10b98115' }]}>
          <Ionicons name="document-text" size={32} color="#10b981" />
          <Text style={styles.statNumber}>{recentReports.length}</Text>
          <Text style={styles.statLabel}>New Reports</Text>
        </View>
        
        <View style={[styles.statCard, { backgroundColor: '#f59e0b15' }]}>
          <Ionicons name="calendar" size={32} color="#f59e0b" />
          <Text style={styles.statNumber}>{upcomingEvents.length}</Text>
          <Text style={styles.statLabel}>Events</Text>
        </View>
      </View>

      {/* Children Section */}
      {children.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>My Children</Text>
          </View>
          {children.map((child) => (
            <View key={child._id} style={styles.childCard}>
              <LinearGradient
                colors={[`${primaryColor}20`, `${secondaryColor}20`]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.childAvatar}
              >
                <Text style={[styles.childInitial, { color: primaryColor }]}>
                  {child.firstName.charAt(0)}
                </Text>
              </LinearGradient>
              
              <View style={styles.childInfo}>
                <Text style={styles.childName}>
                  {child.firstName} {child.lastName}
                </Text>
                <Text style={styles.childClass}>
                  {child.classId?.name} • Grade {child.classId?.grade}
                </Text>
                {child.teacher && (
                  <View style={styles.teacherInfo}>
                    <Ionicons name="person-outline" size={12} color="#999" />
                    <Text style={styles.teacherName}>{child.teacher.name}</Text>
                  </View>
                )}
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Recent Reports */}
      {recentReports.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Reports</Text>
            <TouchableOpacity onPress={() => setActiveTab('reports')}>
              <Text style={[styles.seeAllText, { color: primaryColor }]}>See All</Text>
            </TouchableOpacity>
          </View>
          {recentReports.map((report) => (
            <View key={report._id} style={styles.reportPreview}>
              <View style={[styles.reportIcon, { backgroundColor: `${primaryColor}15` }]}>
                <Ionicons name="document-text" size={20} color={primaryColor} />
              </View>
              <View style={styles.reportPreviewInfo}>
                <Text style={styles.reportPreviewTitle} numberOfLines={1}>
                  {report.title}
                </Text>
                <Text style={styles.reportPreviewMeta}>
                  {report.studentId.firstName} {report.studentId.lastName} • {format(parseISO(report.date), 'MMM dd')}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#ccc" />
            </View>
          ))}
        </View>
      )}

      {/* Upcoming Events */}
      {upcomingEvents.length > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Upcoming Events</Text>
            <TouchableOpacity onPress={() => setActiveTab('calendar')}>
              <Text style={[styles.seeAllText, { color: primaryColor }]}>See All</Text>
            </TouchableOpacity>
          </View>
          {upcomingEvents.map((event) => (
            <View key={event._id} style={styles.eventPreview}>
              <View style={[styles.eventDate, { backgroundColor: getCategoryColor(event.category) }]}>
                <Text style={styles.eventDateDay}>
                  {format(parseISO(event.startDate), 'dd')}
                </Text>
                <Text style={styles.eventDateMonth}>
                  {format(parseISO(event.startDate), 'MMM')}
                </Text>
              </View>
              <View style={styles.eventPreviewInfo}>
                <Text style={styles.eventPreviewTitle} numberOfLines={1}>
                  {event.title}
                </Text>
                <Text style={styles.eventPreviewTime}>
                  {getEventDateLabel(event.startDate)} • {format(parseISO(event.startDate), 'h:mm a')}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#ccc" />
            </View>
          ))}
        </View>
      )}

      <View style={{ height: 30 }} />
    </ScrollView>
  );

  const renderContent = () => {
    if (loading && !refreshing) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={primaryColor} />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      );
    }

    switch (activeTab) {
      case 'overview':
        return renderOverview();
      case 'reports':
        return <ReportsListScreen navigation={navigation} />;
      case 'calendar':
        return <CalendarScreen />;
      case 'communication':
        return <CommunicationScreen user={user} branding={branding} />;
      default:
        return renderOverview();
    }
  };

  const tabs = [
    { id: 'overview', label: 'Overview', icon: 'home' },
    { id: 'reports', label: 'Reports', icon: 'document-text' },
    { id: 'calendar', label: 'Calendar', icon: 'calendar' },
    { id: 'communication', label: 'Messages', icon: 'chatbubbles' },
  ];

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={primaryColor} />
      
      {/* Header */}
      <LinearGradient
        colors={[primaryColor, secondaryColor]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <View>
            <Text style={styles.headerTitle}>{schoolName}</Text>
            <Text style={styles.headerSubtitle}>Parent Portal</Text>
          </View>
          
          <TouchableOpacity
            style={styles.logoutButton}
            onPress={onLogout}
          >
            <Ionicons name="log-out-outline" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* Content */}
      {renderContent()}

      {/* Bottom Tab Bar */}
      <View style={styles.tabBar}>
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab.id}
            style={styles.tab}
            onPress={() => setActiveTab(tab.id)}
            activeOpacity={0.7}
          >
            <View style={activeTab === tab.id ? [styles.activeTabIndicator, { backgroundColor: primaryColor }] : null} />
            <Ionicons
              name={activeTab === tab.id ? tab.icon as any : `${tab.icon}-outline` as any}
              size={24}
              color={activeTab === tab.id ? primaryColor : '#999'}
            />
            <Text style={[
              styles.tabLabel,
              { color: activeTab === tab.id ? primaryColor : '#999' }
            ]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7fa',
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingBottom: 20,
    paddingHorizontal: 20,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    marginTop: 2,
  },
  logoutButton: {
    padding: 8,
  },
  content: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 15,
    fontSize: 16,
    color: '#666',
  },
  welcomeCard: {
    margin: 20,
    borderRadius: 20,
    padding: 25,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  welcomeContent: {
    flex: 1,
  },
  welcomeTitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    marginBottom: 5,
  },
  welcomeName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 5,
  },
  welcomeSchool: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  logoContainer: {
    marginLeft: 15,
  },
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 10,
    gap: 12,
  },
  statCard: {
    flex: 1,
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 28,
    fontWeight: '700',
    color: '#333',
    marginTop: 10,
  },
  statLabel: {
    fontSize: 13,
    color: '#666',
    marginTop: 5,
  },
  section: {
    marginTop: 20,
    paddingHorizontal: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
  },
  seeAllText: {
    fontSize: 14,
    fontWeight: '600',
  },
  childCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
  childAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  childInitial: {
    fontSize: 28,
    fontWeight: '700',
  },
  childInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  childName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginBottom: 4,
  },
  childClass: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  teacherInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  teacherName: {
    fontSize: 13,
    color: '#999',
    marginLeft: 6,
  },
  reportPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  reportIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  reportPreviewInfo: {
    flex: 1,
  },
  reportPreviewTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  reportPreviewMeta: {
    fontSize: 13,
    color: '#999',
  },
  eventPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  eventDate: {
    width: 50,
    height: 50,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  eventDateDay: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  eventDateMonth: {
    fontSize: 11,
    fontWeight: '600',
    color: '#fff',
    textTransform: 'uppercase',
  },
  eventPreviewInfo: {
    flex: 1,
  },
  eventPreviewTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  eventPreviewTime: {
    fontSize: 13,
    color: '#999',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    position: 'relative',
  },
  activeTabIndicator: {
    position: 'absolute',
    top: 0,
    width: 40,
    height: 3,
    borderBottomLeftRadius: 3,
    borderBottomRightRadius: 3,
  },
  tabLabel: {
    fontSize: 12,
    marginTop: 4,
    fontWeight: '600',
  },
});

export default EnhancedParentDashboard;

