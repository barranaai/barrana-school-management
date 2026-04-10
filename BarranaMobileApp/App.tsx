import React, { useState, useEffect, Component, ErrorInfo, ReactNode } from 'react';
import { StatusBar } from 'expo-status-bar';
import { 
  StyleSheet, 
  Text, 
  View, 
  TextInput, 
  TouchableOpacity, 
  ScrollView, 
  Alert,
  SafeAreaView,
  Dimensions
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import apiService, { User } from './apiService';
import TeacherDashboard from './TeacherDashboard';
import ParentDashboard from './ParentDashboard';
import EnhancedParentDashboard from './screens/EnhancedParentDashboard';
import PDFViewerScreen from './screens/PDFViewerScreen';
import { BrandingProvider } from './contexts/BrandingContext';
import StudentsScreen from './screens/StudentsScreen';
import ReportsScreen from './screens/ReportsScreen';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';

const Stack = createStackNavigator();

// Error Boundary Component
class ErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('📱 ERROR BOUNDARY CAUGHT:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <SafeAreaView style={{ flex: 1 }}>
          <LinearGradient colors={['#667eea', '#764ba2']} style={{ flex: 1 }}>
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
              <Text style={{ color: 'white', fontSize: 24, fontWeight: 'bold', marginBottom: 20 }}>
                ⚠️ App Error
              </Text>
              <Text style={{ color: 'white', fontSize: 16, textAlign: 'center', marginBottom: 10 }}>
                Something went wrong. Please restart the app.
              </Text>
              <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14, textAlign: 'center' }}>
                {this.state.error?.message || 'Unknown error'}
              </Text>
            </View>
          </LinearGradient>
        </SafeAreaView>
      );
    }

    return this.props.children;
  }
}

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [currentScreen, setCurrentScreen] = useState<'dashboard' | 'students' | 'reports'>('dashboard');
  const [appError, setAppError] = useState<string | null>(null);

  // Check for existing authentication on app start
  useEffect(() => {
    checkAuthentication();
  }, []);

  const checkAuthentication = async () => {
    try {
      console.log('📱 Starting authentication check...');
      
      // First, just check if we have stored user data (no API call)
      const user = await apiService.getStoredUserData();
      console.log('📱 Stored user data:', user ? 'Found' : 'Not found');
      
      if (user) {
        setCurrentUser(user);
        setIsLoggedIn(true);
        console.log('📱 User restored from storage');
      } else {
        console.log('📱 No stored user, showing login');
      }
    } catch (error: any) {
      console.error('📱 Error checking authentication:', error);
      // Don't crash, just show login
      setCurrentUser(null);
      setIsLoggedIn(false);
      setAppError(error?.message || 'Initialization error');
    } finally {
      setIsInitializing(false);
      console.log('📱 Initialization complete');
    }
  };

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Error', 'Please enter both email and password');
      return;
    }

    setIsLoading(true);
    
    try {
      const { user } = await apiService.login({ email, password });
      setCurrentUser(user);
      setIsLoggedIn(true);
      setEmail('');
      setPassword('');
    } catch (error: any) {
      Alert.alert('Login Failed', error.message || 'Invalid credentials');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await apiService.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setCurrentUser(null);
      setIsLoggedIn(false);
      setCurrentScreen('dashboard');
    }
  };

  const navigateToStudents = () => {
    setCurrentScreen('students');
  };

  const navigateToReports = () => {
    setCurrentScreen('reports');
  };

  const navigateBack = () => {
    setCurrentScreen('dashboard');
  };

  const handleDemoLogin = (role: 'teacher' | 'parent' | 'student') => {
    // Demo credentials for testing
    const demoCredentials = {
      teacher: { email: 'teacher@demo.com', password: 'demo12345' },
      parent: { email: 'parent@demo.com', password: 'demo12345' },
      student: { email: 'STU001', password: 'Student123!' }
    };
    
    setEmail(demoCredentials[role].email);
    setPassword(demoCredentials[role].password);
    setTimeout(() => handleLogin(), 100);
  };

  // Show loading screen while checking authentication
  if (isInitializing) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="light" />
        <LinearGradient
          colors={['#667eea', '#764ba2']}
          style={styles.gradient}
        >
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Loading...</Text>
          </View>
        </LinearGradient>
      </SafeAreaView>
    );
  }

  if (isLoggedIn && currentUser) {
    const schoolId = (currentUser as any).schoolId?._id || (currentUser as any).schoolId;
    
    // Wrap everything in try-catch to prevent crashes
    try {
      return (
        <SafeAreaView style={styles.container}>
          <StatusBar style="light" />
          {/* Always provide branding when we have a schoolId so all roles get dynamic colors */}
          <BrandingProvider schoolId={schoolId} userRole={currentUser.role}>
            {/* Branded background gradient */}
            <BrandedBackground>
          {/* Compact Header */}
          <View style={styles.compactHeader}>
            <View style={styles.headerLeft}>
              <Text style={styles.headerTitle}>Barrana.ai</Text>
              <Text style={styles.headerSubtitle}>School Management</Text>
            </View>
            
            <View style={styles.headerRight}>
              <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
                <Text style={styles.logoutText}>Logout</Text>
              </TouchableOpacity>
            </View>
          </View>
          
          {/* Compact User Info */}
          <View style={styles.compactUserInfo}>
            <View style={styles.userInfoLeft}>
              <Text style={styles.welcomeText}>
                Welcome, {currentUser.firstName} {currentUser.lastName}!
              </Text>
              <Text style={styles.roleText}>
                {currentUser.role.charAt(0).toUpperCase() + currentUser.role.slice(1)}
              </Text>
              {typeof currentUser.schoolId === 'object' && currentUser.schoolId?.name && (
                <Text style={styles.schoolText}>
                  📚 {currentUser.schoolId.name}
                </Text>
              )}
            </View>
          </View>

          {currentUser.role === 'teacher' && currentScreen === 'dashboard' && (
            <TeacherDashboard 
              user={currentUser} 
              onLogout={handleLogout}
              onNavigateToStudents={navigateToStudents}
              onNavigateToReports={navigateToReports}
            />
          )}

          {currentUser.role === 'teacher' && currentScreen === 'students' && (
            <StudentsScreen 
              user={currentUser} 
              onBack={navigateBack}
            />
          )}

          {currentUser.role === 'teacher' && currentScreen === 'reports' && (
            <ReportsScreen 
              user={currentUser} 
              onBack={navigateBack}
            />
          )}

          {(currentUser.role === 'parent' || currentUser.role === 'student') && (
            <NavigationContainer>
              <Stack.Navigator screenOptions={{ headerShown: false }}>
                <Stack.Screen name="ParentHome">
                  {(props) => (
                    <EnhancedParentDashboard
                      {...props}
                      user={currentUser}
                      onLogout={handleLogout}
                    />
                  )}
                </Stack.Screen>
                <Stack.Screen name="PDFViewer" component={PDFViewerScreen} />
              </Stack.Navigator>
            </NavigationContainer>
          )}
          </BrandedBackground>
        </BrandingProvider>
      </SafeAreaView>
      );
    } catch (error: any) {
      console.error('📱 CRITICAL ERROR in logged-in view:', error);
      // Show error screen but don't crash
      return (
        <SafeAreaView style={styles.container}>
          <StatusBar style="light" />
          <LinearGradient colors={['#667eea', '#764ba2']} style={styles.gradient}>
            <View style={styles.loadingContainer}>
              <Text style={styles.errorTitle}>⚠️ Error</Text>
              <Text style={styles.errorText}>
                App encountered an error. Please restart.
              </Text>
              <Text style={styles.errorDetails}>
                {error?.message || 'Unknown error'}
              </Text>
              <TouchableOpacity onPress={handleLogout} style={styles.retryButton}>
                <Text style={styles.retryButtonText}>Logout & Retry</Text>
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </SafeAreaView>
      );
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      <LinearGradient colors={['#667eea', '#764ba2']} style={styles.gradient}>
        <View style={styles.loginContainer}>
          <View style={styles.logoSection}>
            <Text style={styles.logo}>🎓</Text>
            <Text style={styles.appTitle}>Barrana.ai</Text>
            <Text style={styles.appSubtitle}>School Management System</Text>
          </View>

          <View style={styles.loginForm}>
            <Text style={styles.loginTitle}>Sign In</Text>
            
            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor="#999"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
            
            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor="#999"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCorrect={false}
            />
            
            <TouchableOpacity 
              style={[styles.loginButton, isLoading && styles.loginButtonDisabled]}
              onPress={handleLogin}
              disabled={isLoading}
            >
              <Text style={styles.loginButtonText}>
                {isLoading ? 'Signing In...' : 'Sign In'}
              </Text>
            </TouchableOpacity>

            <View style={styles.demoSection}>
              <Text style={styles.demoTitle}>Quick Demo Login:</Text>
              
              <TouchableOpacity 
                style={styles.demoButton}
                onPress={() => handleDemoLogin('teacher')}
              >
                <Text style={styles.demoButtonText}>👨‍🏫 Teacher Demo</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.demoButton}
                onPress={() => handleDemoLogin('parent')}
              >
                <Text style={styles.demoButtonText}>👨‍👩‍👧‍👦 Parent Demo</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.demoButton}
                onPress={() => handleDemoLogin('student')}
              >
                <Text style={styles.demoButtonText}>🎓 Student Demo</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </LinearGradient>
    </SafeAreaView>
  );
  }

  // Helper component for branded background
  function BrandedBackground({ children }: { children: React.ReactNode }) {
    try {
      // Lazy import to avoid hook usage before provider in other branches
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { useBranding } = require('./contexts/BrandingContext');
      const { branding } = useBranding();
      const primary = branding?.branding?.primaryColor || '#667eea';
      const secondary = branding?.branding?.secondaryColor || '#764ba2';
      return (
        <LinearGradient colors={[primary, secondary]} style={styles.gradient}>
          {children}
        </LinearGradient>
      );
    } catch (error) {
      console.error('📱 BrandedBackground error, using fallback:', error);
      // Fallback to default gradient if branding fails
      return (
        <LinearGradient colors={['#667eea', '#764ba2']} style={styles.gradient}>
          {children}
        </LinearGradient>
      );
    }
  }

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: 'white',
    fontSize: 18,
  },
  errorTitle: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  errorText: {
    color: 'white',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 10,
    paddingHorizontal: 40,
  },
  errorDetails: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 30,
    paddingHorizontal: 40,
  },
  retryButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'white',
  },
  retryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  loginContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  logoSection: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logo: {
    fontSize: 60,
    marginBottom: 10,
  },
  appTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 5,
  },
  appSubtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  loginForm: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 20,
    padding: 30,
  },
  loginTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    textAlign: 'center',
    marginBottom: 30,
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
    fontSize: 16,
  },
  loginButton: {
    backgroundColor: '#4CAF50',
    borderRadius: 10,
    padding: 15,
    alignItems: 'center',
    marginTop: 10,
  },
  loginButtonDisabled: {
    backgroundColor: '#ccc',
  },
  loginButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  demoSection: {
    marginTop: 30,
  },
  demoTitle: {
    color: 'white',
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 15,
  },
  demoButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    alignItems: 'center',
  },
  demoButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  compactHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 40,
    paddingBottom: 10,
  },
  headerLeft: {
    flex: 1,
  },
  headerRight: {
    //
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 2,
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  logoutButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
  },
  logoutText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  compactUserInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 15,
  },
  userInfoLeft: {
    flex: 1,
  },
  welcomeText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 2,
  },
  roleText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 2,
  },
  schoolText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '600',
  },
  verificationContainer: {
    marginLeft: 15,
  },
  verificationWarning: {
    fontSize: 10,
    color: '#ffeb3b',
    textAlign: 'right',
  },
  dashboard: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 15,
  },
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 15,
    padding: 20,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  cardSubtitle: {
    fontSize: 14,
    color: '#666',
  },

});
