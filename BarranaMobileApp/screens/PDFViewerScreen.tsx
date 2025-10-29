import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StatusBar,
  Platform,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import Pdf from 'react-native-pdf';
import { useBranding } from '../contexts/BrandingContext';

const { width, height } = Dimensions.get('window');

interface PDFViewerScreenProps {
  route: {
    params: {
      reportId: string;
      reportTitle: string;
      studentName: string;
      date: string;
      pdfUrl: string;
    };
  };
  navigation: any;
}

const PDFViewerScreen: React.FC<PDFViewerScreenProps> = ({ route, navigation }) => {
  const { reportId, reportTitle, studentName, date, pdfUrl } = route.params;
  const { branding } = useBranding();
  
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [downloading, setDownloading] = useState(false);
  const [localUri, setLocalUri] = useState<string | null>(null);

  const primaryColor = branding?.branding.primaryColor || '#667eea';
  const secondaryColor = branding?.branding.secondaryColor || '#764ba2';

  useEffect(() => {
    downloadPDF();
  }, []);

  const downloadPDF = async () => {
    try {
      setLoading(true);
      
      // Check if already downloaded
      const fileName = `report_${reportId}.pdf`;
      const fileUri = `${FileSystem.documentDirectory}${fileName}`;
      
      const fileInfo = await FileSystem.getInfoAsync(fileUri);
      
      if (fileInfo.exists) {
        setLocalUri(fileUri);
        setLoading(false);
        return;
      }

      // Download the PDF
      const downloadResult = await FileSystem.downloadAsync(
        pdfUrl,
        fileUri
      );

      if (downloadResult.status === 200) {
        setLocalUri(downloadResult.uri);
      } else {
        throw new Error('Failed to download PDF');
      }
      
      setLoading(false);
    } catch (error) {
      console.error('Error downloading PDF:', error);
      Alert.alert('Error', 'Failed to load PDF. Please try again.');
      setLoading(false);
    }
  };

  const handleShare = async () => {
    if (!localUri) {
      Alert.alert('Error', 'PDF not loaded yet');
      return;
    }

    try {
      setDownloading(true);
      const isAvailable = await Sharing.isAvailableAsync();
      
      if (!isAvailable) {
        Alert.alert('Error', 'Sharing is not available on this device');
        return;
      }

      await Sharing.shareAsync(localUri, {
        mimeType: 'application/pdf',
        dialogTitle: `Share ${reportTitle}`,
        UTI: 'com.adobe.pdf',
      });
    } catch (error) {
      console.error('Error sharing PDF:', error);
      Alert.alert('Error', 'Failed to share PDF');
    } finally {
      setDownloading(false);
    }
  };

  const handleDownload = async () => {
    if (!localUri) {
      Alert.alert('Error', 'PDF not loaded yet');
      return;
    }

    try {
      setDownloading(true);
      
      // On iOS, use share to save to Files
      if (Platform.OS === 'ios') {
        await handleShare();
      } else {
        // On Android, copy to downloads folder
        const fileName = `${studentName}_Report_${new Date(date).toISOString().split('T')[0]}.pdf`;
        const destUri = `${FileSystem.documentDirectory}${fileName}`;
        
        await FileSystem.copyAsync({
          from: localUri,
          to: destUri,
        });
        
        Alert.alert(
          'Success',
          `PDF saved successfully!\nLocation: ${destUri}`,
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Error downloading PDF:', error);
      Alert.alert('Error', 'Failed to save PDF');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={primaryColor} />
      
      {/* Header */}
      <View style={[styles.header, { backgroundColor: primaryColor }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        
        <View style={styles.headerTitle}>
          <Text style={styles.headerTitleText} numberOfLines={1}>
            {reportTitle}
          </Text>
          <Text style={styles.headerSubtitle}>
            {studentName} • {new Date(date).toLocaleDateString()}
          </Text>
        </View>
        
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={handleShare}
            disabled={downloading || loading}
          >
            {downloading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="share-outline" size={24} color="#fff" />
            )}
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.iconButton}
            onPress={handleDownload}
            disabled={downloading || loading}
          >
            <Ionicons name="download-outline" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {/* PDF Viewer */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={primaryColor} />
          <Text style={styles.loadingText}>Loading PDF...</Text>
        </View>
      ) : localUri ? (
        <View style={styles.pdfContainer}>
          <Pdf
            source={{ uri: localUri }}
            style={styles.pdf}
            onLoadComplete={(numberOfPages) => {
              setTotalPages(numberOfPages);
              console.log(`PDF loaded: ${numberOfPages} pages`);
            }}
            onPageChanged={(page) => {
              setCurrentPage(page);
            }}
            onError={(error) => {
              console.error('PDF error:', error);
              Alert.alert('Error', 'Failed to load PDF');
            }}
            trustAllCerts={false}
            enablePaging={true}
            spacing={10}
            horizontal={false}
          />
          
          {/* Page Indicator */}
          {totalPages > 0 && (
            <View style={[styles.pageIndicator, { backgroundColor: primaryColor }]}>
              <Text style={styles.pageIndicatorText}>
                Page {currentPage} of {totalPages}
              </Text>
            </View>
          )}
        </View>
      ) : (
        <View style={styles.errorContainer}>
          <Ionicons name="document-text-outline" size={80} color="#ccc" />
          <Text style={styles.errorText}>Failed to load PDF</Text>
          <TouchableOpacity
            style={[styles.retryButton, { backgroundColor: primaryColor }]}
            onPress={downloadPDF}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingBottom: 15,
    paddingHorizontal: 15,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  backButton: {
    padding: 8,
    marginRight: 10,
  },
  headerTitle: {
    flex: 1,
  },
  headerTitleText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 2,
  },
  headerSubtitle: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconButton: {
    padding: 8,
    marginLeft: 10,
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
  pdfContainer: {
    flex: 1,
  },
  pdf: {
    flex: 1,
    width: width,
    height: height,
  },
  pageIndicator: {
    position: 'absolute',
    bottom: 30,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  pageIndicatorText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    color: '#666',
    marginTop: 20,
    marginBottom: 30,
  },
  retryButton: {
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 25,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default PDFViewerScreen;

