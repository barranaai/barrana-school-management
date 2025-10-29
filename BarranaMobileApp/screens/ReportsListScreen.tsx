import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { format } from 'date-fns';
import apiService from '../apiService';
import { useBranding } from '../contexts/BrandingContext';

interface Report {
  _id: string;
  title: string;
  date: string;
  status: string;
  pdfUrl?: string;
  studentId: {
    _id: string;
    firstName: string;
    lastName: string;
    studentId: string;
  };
  teacherId: {
    _id: string;
    firstName: string;
    lastName: string;
  };
  templateId?: {
    name: string;
    type: string;
  };
}

interface ReportsListScreenProps {
  navigation: any;
}

const ReportsListScreen: React.FC<ReportsListScreenProps> = ({ navigation }) => {
  const { branding } = useBranding();
  const [reports, setReports] = useState<Report[]>([]);
  const [filteredReports, setFilteredReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const primaryColor = branding?.branding.primaryColor || '#667eea';
  const secondaryColor = branding?.branding.secondaryColor || '#764ba2';

  useEffect(() => {
    loadReports();
  }, []);

  useEffect(() => {
    filterReports();
  }, [searchQuery, reports]);

  const loadReports = async () => {
    try {
      setLoading(true);
      const response = await apiService.makeRequest<{ success: boolean; data: Report[] }>(
        '/parents/me/reports'
      );

      if (response.success && response.data) {
        setReports(response.data);
      }
    } catch (error) {
      console.error('Error loading reports:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const filterReports = () => {
    if (!searchQuery.trim()) {
      setFilteredReports(reports);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = reports.filter(
      (report) =>
        report.title.toLowerCase().includes(query) ||
        `${report.studentId.firstName} ${report.studentId.lastName}`.toLowerCase().includes(query) ||
        `${report.teacherId.firstName} ${report.teacherId.lastName}`.toLowerCase().includes(query)
    );

    setFilteredReports(filtered);
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadReports();
  };

  const handleReportPress = (report: Report) => {
    if (report.pdfUrl) {
      navigation.navigate('PDFViewer', {
        reportId: report._id,
        reportTitle: report.title,
        studentName: `${report.studentId.firstName} ${report.studentId.lastName}`,
        date: report.date,
        pdfUrl: `${apiService.getBaseUrl()}${report.pdfUrl}`,
      });
    }
  };

  // Group reports by student
  const groupedReports = filteredReports.reduce((acc, report) => {
    const studentName = `${report.studentId.firstName} ${report.studentId.lastName}`;
    if (!acc[studentName]) {
      acc[studentName] = [];
    }
    acc[studentName].push(report);
    return acc;
  }, {} as Record<string, Report[]>);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={primaryColor} />
        <Text style={styles.loadingText}>Loading reports...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={20} color="#999" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search reports..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor="#999"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color="#999" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Reports List */}
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={primaryColor}
          />
        }
      >
        {Object.keys(groupedReports).length > 0 ? (
          Object.entries(groupedReports).map(([studentName, studentReports]) => (
            <View key={studentName} style={styles.studentSection}>
              <View style={styles.studentHeader}>
                <View style={[styles.studentAvatar, { backgroundColor: `${primaryColor}20` }]}>
                  <Text style={[styles.studentInitial, { color: primaryColor }]}>
                    {studentName.charAt(0)}
                  </Text>
                </View>
                <View style={styles.studentInfo}>
                  <Text style={styles.studentName}>{studentName}</Text>
                  <Text style={styles.reportCount}>
                    {studentReports.length} report{studentReports.length > 1 ? 's' : ''}
                  </Text>
                </View>
              </View>

              {studentReports.map((report) => (
                <TouchableOpacity
                  key={report._id}
                  style={styles.reportCard}
                  onPress={() => handleReportPress(report)}
                  activeOpacity={0.7}
                >
                  <View style={styles.reportHeader}>
                    <LinearGradient
                      colors={[primaryColor, secondaryColor]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.reportIconContainer}
                    >
                      <Ionicons name="document-text" size={24} color="#fff" />
                    </LinearGradient>
                    
                    <View style={styles.reportInfo}>
                      <Text style={styles.reportTitle} numberOfLines={1}>
                        {report.title}
                      </Text>
                      <View style={styles.reportMeta}>
                        <Ionicons name="calendar-outline" size={14} color="#999" />
                        <Text style={styles.reportDate}>
                          {format(new Date(report.date), 'MMM dd, yyyy')}
                        </Text>
                      </View>
                      <View style={styles.reportMeta}>
                        <Ionicons name="person-outline" size={14} color="#999" />
                        <Text style={styles.reportTeacher}>
                          {report.teacherId.firstName} {report.teacherId.lastName}
                        </Text>
                      </View>
                    </View>

                    {report.pdfUrl ? (
                      <View style={[styles.pdfBadge, { backgroundColor: `${primaryColor}15` }]}>
                        <Ionicons name="document" size={18} color={primaryColor} />
                        <Text style={[styles.pdfText, { color: primaryColor }]}>PDF</Text>
                      </View>
                    ) : (
                      <View style={styles.noPdfBadge}>
                        <Text style={styles.noPdfText}>No PDF</Text>
                      </View>
                    )}
                  </View>

                  {report.templateId && (
                    <View style={styles.reportFooter}>
                      <View style={[styles.templateBadge, { backgroundColor: `${secondaryColor}15` }]}>
                        <Text style={[styles.templateText, { color: secondaryColor }]}>
                          {report.templateId.type}
                        </Text>
                      </View>
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          ))
        ) : (
          <View style={styles.emptyContainer}>
            <Ionicons name="document-text-outline" size={80} color="#e0e0e0" />
            <Text style={styles.emptyTitle}>
              {searchQuery ? 'No Reports Found' : 'No Reports Yet'}
            </Text>
            <Text style={styles.emptyText}>
              {searchQuery
                ? 'Try adjusting your search'
                : 'Reports will appear here once they are available'}
            </Text>
          </View>
        )}

        <View style={{ height: 20 }} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f7fa',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f7fa',
  },
  loadingText: {
    marginTop: 15,
    fontSize: 16,
    color: '#666',
  },
  searchContainer: {
    padding: 15,
    backgroundColor: '#fff',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f7fa',
    borderRadius: 12,
    paddingHorizontal: 15,
    paddingVertical: 12,
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    fontSize: 16,
    color: '#333',
  },
  scrollView: {
    flex: 1,
  },
  studentSection: {
    marginTop: 20,
    paddingHorizontal: 15,
  },
  studentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  studentAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  studentInitial: {
    fontSize: 22,
    fontWeight: '700',
  },
  studentInfo: {
    flex: 1,
  },
  studentName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
    marginBottom: 2,
  },
  reportCount: {
    fontSize: 14,
    color: '#999',
  },
  reportCard: {
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
  reportHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  reportIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  reportInfo: {
    flex: 1,
  },
  reportTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
    marginBottom: 6,
  },
  reportMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  reportDate: {
    fontSize: 13,
    color: '#999',
    marginLeft: 6,
  },
  reportTeacher: {
    fontSize: 13,
    color: '#999',
    marginLeft: 6,
  },
  pdfBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  pdfText: {
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 4,
  },
  noPdfBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
  },
  noPdfText: {
    fontSize: 12,
    color: '#999',
  },
  reportFooter: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  templateBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  templateText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 80,
    paddingHorizontal: 30,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#999',
    marginTop: 20,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    color: '#bbb',
    textAlign: 'center',
  },
});

export default ReportsListScreen;

