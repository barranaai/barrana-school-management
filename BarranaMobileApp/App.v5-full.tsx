import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  TextInput, 
  TouchableOpacity, 
  SafeAreaView,
  Alert,
  ActivityIndicator,
  ScrollView,
  Image
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import apiService, { User } from './apiService';
import { BrandingProvider, useBranding } from './contexts/BrandingContext';
import StudentsScreenReal from './screens/StudentsScreen';
import ReportsScreenReal from './screens/ReportsScreen';
import TeacherDashboardReal from './TeacherDashboard';

const Stack = createStackNavigator();

// VERSION 8: Adding real ReportsScreen

// Dashboard Screen (Simple - for fallback)
function DashboardScreen({ navigation, user, onLogout }: any) {
  const { branding } = useBranding();
  const primaryColor = branding?.branding?.primaryColor || '#667eea';
  const secondaryColor = branding?.branding?.secondaryColor || '#764ba2';
  const schoolName = branding?.schoolName || 'School';
  const logoUrl = branding?.logo;

  console.log('📱 Dashboard screen loaded');
  console.log('📱 School:', schoolName);
  console.log('📱 Logo URL:', logoUrl);

  return (
    <LinearGradient colors={[primaryColor, secondaryColor]} style={styles.gradient}>
      <ScrollView style={styles.dashboardScroll}>
        {/* School Banner */}
        <View style={styles.schoolBanner}>
          <View style={styles.bannerContent}>
            <View style={styles.bannerLeft}>
              <Text style={styles.schoolName}>{schoolName}</Text>
              <Text style={styles.bannerSubtext}>School Management System</Text>
            </View>
            {logoUrl && (
              <Image 
                source={{ uri: logoUrl }} 
                style={styles.schoolLogo}
                resizeMode="contain"
              />
            )}
          </View>
        </View>

        {/* Header */}
        <View style={styles.dashboardHeader}>
          <View>
            <Text style={styles.welcomeText}>
              Welcome, {user.firstName} {user.lastName}!
            </Text>
            <Text style={styles.roleText}>Teacher Dashboard</Text>
            <Text style={styles.versionText}>Version 5: Full Branding + Navigation</Text>
          </View>
          <TouchableOpacity onPress={onLogout} style={styles.headerLogoutBtn}>
            <Text style={styles.headerLogoutText}>Logout</Text>
          </TouchableOpacity>
        </View>

        {/* Navigation Cards */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>📚 Quick Navigation</Text>
          
          <TouchableOpacity 
            style={styles.navButton}
            onPress={() => navigation.navigate('Students')}
          >
            <Text style={styles.navButtonText}>👥 My Students</Text>
            <Text style={styles.navArrow}>→</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.navButton}
            onPress={() => navigation.navigate('Reports')}
          >
            <Text style={styles.navButtonText}>📝 Reports</Text>
            <Text style={styles.navArrow}>→</Text>
          </TouchableOpacity>
        </View>

        {/* Branding Info */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>🎨 Dynamic Branding Active</Text>
          <Text style={styles.statusText}>✅ School: {schoolName}</Text>
          <Text style={styles.statusText}>✅ Primary: {primaryColor}</Text>
          <Text style={styles.statusText}>✅ Secondary: {secondaryColor}</Text>
          <Text style={styles.statusText}>✅ Logo: {logoUrl ? 'Loaded' : 'Default'}</Text>
          <Text style={styles.statusText}>✅ Navigation: Working!</Text>
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </LinearGradient>
  );
}

// Students Screen
function StudentsScreen({ navigation }: any) {
  const { branding } = useBranding();
  const primaryColor = branding?.branding?.primaryColor || '#667eea';
  const secondaryColor = branding?.branding?.secondaryColor || '#764ba2';

  return (
    <LinearGradient colors={[primaryColor, secondaryColor]} style={styles.gradient}>
      <SafeAreaView style={styles.container}>
        <View style={styles.screenHeader}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.screenTitle}>My Students</Text>
        </View>
        
        <ScrollView style={styles.screenContent}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>👥 Student List</Text>
            <Text style={styles.placeholderText}>
              Student list will appear here.
            </Text>
            <Text style={styles.placeholderText}>
              Navigation is working! ✅
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

// Reports Screen
function ReportsScreen({ navigation }: any) {
  const { branding } = useBranding();
  const primaryColor = branding?.branding?.primaryColor || '#667eea';
  const secondaryColor = branding?.branding?.secondaryColor || '#764ba2';

  return (
    <LinearGradient colors={[primaryColor, secondaryColor]} style={styles.gradient}>
      <SafeAreaView style={styles.container}>
        <View style={styles.screenHeader}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.screenTitle}>Reports</Text>
        </View>
        
        <ScrollView style={styles.screenContent}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>📝 Reports List</Text>
            <Text style={styles.placeholderText}>
              Reports will appear here.
            </Text>
            <Text style={styles.placeholderText}>
              Navigation is working! ✅
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

// Calendar Screen
function CalendarScreen({ navigation }: any) {
  const { branding } = useBranding();
  const primaryColor = branding?.branding?.primaryColor || '#667eea';
  const secondaryColor = branding?.branding?.secondaryColor || '#764ba2';

  return (
    <LinearGradient colors={[primaryColor, secondaryColor]} style={styles.gradient}>
      <SafeAreaView style={styles.container}>
        <View style={styles.screenHeader}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.screenTitle}>Calendar</Text>
        </View>
        
        <ScrollView style={styles.screenContent}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>📅 School Calendar</Text>
            <Text style={styles.placeholderText}>
              Calendar events will appear here.
            </Text>
            <Text style={styles.placeholderText}>
              Navigation is working! ✅
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

// App Content with Navigation
function AppContent() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  
  const { branding } = useBranding();
  const primaryColor = branding?.branding?.primaryColor || '#667eea';
  const secondaryColor = branding?.branding?.secondaryColor || '#764ba2';
  
  console.log('📱 VERSION 5: Full Branding + Navigation loaded');

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const user = await apiService.getStoredUserData();
      if (user) {
        setCurrentUser(user);
        setIsLoggedIn(true);
      }
    } catch (error: any) {
      console.error('📱 Auth error:', error);
    } finally {
      setIsInitializing(false);
    }
  };

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Error', 'Please enter both email and password');
      return;
    }

    setIsLoading(true);
    try {
      const response = await apiService.login({ email, password });
      setCurrentUser(response.user);
      setIsLoggedIn(true);
      Alert.alert('Success', 'Logged in successfully!');
    } catch (error: any) {
      Alert.alert('Login Failed', error.message || 'Invalid credentials');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await apiService.logout();
      setIsLoggedIn(false);
      setCurrentUser(null);
      setEmail('');
      setPassword('');
    } catch (error: any) {
      console.error('📱 Logout error:', error);
    }
  };

  if (isInitializing) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="light" />
        <LinearGradient colors={[primaryColor, secondaryColor]} style={styles.gradient}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="white" />
            <Text style={styles.loadingText}>Loading...</Text>
          </View>
        </LinearGradient>
      </SafeAreaView>
    );
  }

  // Teacher Dashboard with Navigation - Using REAL components (No Calendar needed)
  if (isLoggedIn && currentUser && currentUser.role === 'teacher') {
    return (
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Dashboard">
            {(props) => (
              <TeacherDashboardReal 
                user={currentUser}
                onLogout={handleLogout}
                onNavigateToStudents={() => props.navigation.navigate('Students')}
                onNavigateToReports={() => props.navigation.navigate('Reports')}
              />
            )}
          </Stack.Screen>
          <Stack.Screen name="Students">
            {(props) => <StudentsScreenReal {...props} user={currentUser} onBack={() => props.navigation.goBack()} />}
          </Stack.Screen>
          <Stack.Screen name="Reports">
            {(props) => <ReportsScreenReal user={currentUser} onBack={() => props.navigation.goBack()} />}
          </Stack.Screen>
        </Stack.Navigator>
      </NavigationContainer>
    );
  }

  // Login Screen
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      <LinearGradient colors={[primaryColor, secondaryColor]} style={styles.gradient}>
        <View style={styles.loginContainer}>
          <View style={styles.logoSection}>
            <Text style={styles.logo}>🎓</Text>
            <Text style={styles.appTitle}>Barrana.ai</Text>
            <Text style={styles.appSubtitle}>School Management System</Text>
            <Text style={styles.versionTextLogin}>Version 5: Full System Test</Text>
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
              editable={!isLoading}
            />
            
            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor="#999"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCorrect={false}
              editable={!isLoading}
            />
            
            <TouchableOpacity 
              style={[styles.loginButton, isLoading && styles.loginButtonDisabled]}
              onPress={handleLogin}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text style={styles.loginButtonText}>Sign In</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </LinearGradient>
    </SafeAreaView>
  );
}

// Main App with BrandingProvider
export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  
  useEffect(() => {
    apiService.getStoredUserData().then(user => {
      if (user) setCurrentUser(user);
    });
  }, []);

  const schoolId = currentUser?.schoolId as any;
  const extractedSchoolId = schoolId?._id || schoolId || undefined;

  return (
    <BrandingProvider schoolId={extractedSchoolId} userRole={currentUser?.role}>
      <AppContent />
    </BrandingProvider>
  );
}

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
    marginTop: 10,
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
  versionTextLogin: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.6)',
    marginTop: 5,
  },
  loginForm: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 15,
    padding: 25,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  loginTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 20,
    textAlign: 'center',
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
    fontSize: 16,
    color: '#333',
  },
  loginButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 10,
    padding: 15,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'white',
    marginTop: 10,
  },
  loginButtonDisabled: {
    opacity: 0.6,
  },
  loginButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  schoolBanner: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingVertical: 15,
    paddingHorizontal: 20,
    marginBottom: 10,
    borderBottomWidth: 2,
    borderBottomColor: 'rgba(255, 255, 255, 0.3)',
  },
  bannerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bannerLeft: {
    flex: 1,
  },
  schoolName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 3,
  },
  bannerSubtext: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  schoolLogo: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  dashboardScroll: {
    flex: 1,
  },
  dashboardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 10,
  },
  welcomeText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 3,
  },
  roleText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    marginBottom: 3,
  },
  versionText: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  headerLogoutBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'white',
  },
  headerLogoutText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 15,
    padding: 20,
    marginHorizontal: 20,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 15,
  },
  navButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    padding: 16,
    borderRadius: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  navButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  navArrow: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
  statusText: {
    color: 'white',
    fontSize: 14,
    marginBottom: 8,
  },
  bottomSpacer: {
    height: 30,
  },
  screenHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    paddingTop: 10,
  },
  backButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'white',
    marginRight: 15,
  },
  backButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  screenTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: 'white',
  },
  screenContent: {
    flex: 1,
  },
  placeholderText: {
    color: 'white',
    fontSize: 14,
    marginBottom: 10,
    textAlign: 'center',
  },
});

