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
  ScrollView
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import apiService, { User } from './apiService';
import { BrandingProvider, useBranding } from './contexts/BrandingContext';

// VERSION 4: Dashboard + BrandingContext (testing if branding causes crash)
function AppContent() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  
  // Get branding (will use default if fails)
  const { branding } = useBranding();
  const primaryColor = branding?.branding?.primaryColor || '#667eea';
  const secondaryColor = branding?.branding?.secondaryColor || '#764ba2';
  
  console.log('📱 VERSION 4: Dashboard with Branding loaded');
  console.log('📱 Branding colors:', primaryColor, secondaryColor);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      console.log('📱 Checking auth...');
      const user = await apiService.getStoredUserData();
      if (user) {
        console.log('📱 Found stored user');
        setCurrentUser(user);
        setIsLoggedIn(true);
      }
    } catch (error: any) {
      console.error('📱 Error checking auth:', error);
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

  // Teacher Dashboard with Dynamic Branding
  if (isLoggedIn && currentUser && currentUser.role === 'teacher') {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="light" />
        <LinearGradient colors={[primaryColor, secondaryColor]} style={styles.gradient}>
          <ScrollView style={styles.dashboardScroll}>
            {/* Header */}
            <View style={styles.dashboardHeader}>
              <View>
                <Text style={styles.headerTitle}>Barrana.ai</Text>
                <Text style={styles.headerSubtitle}>Teacher Dashboard</Text>
              </View>
              <TouchableOpacity onPress={handleLogout} style={styles.headerLogoutBtn}>
                <Text style={styles.headerLogoutText}>Logout</Text>
              </TouchableOpacity>
            </View>

            {/* Welcome Section */}
            <View style={styles.welcomeSection}>
              <Text style={styles.welcomeText}>
                Welcome, {currentUser.firstName} {currentUser.lastName}!
              </Text>
              <Text style={styles.roleText}>Teacher Dashboard</Text>
              <Text style={styles.versionText}>Version 4: Branding Test</Text>
            </View>

            {/* Branding Status Card */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>🎨 Dynamic Branding</Text>
              <Text style={styles.statusText}>Primary Color: {primaryColor}</Text>
              <Text style={styles.statusText}>Secondary Color: {secondaryColor}</Text>
              <Text style={styles.statusText}>
                {branding?.schoolName ? `School: ${branding.schoolName}` : 'School: Default'}
              </Text>
              <Text style={styles.infoText}>
                The gradient background uses these dynamic colors!
              </Text>
            </View>

            {/* User Info Card */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>📋 Your Information</Text>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Name:</Text>
                <Text style={styles.infoValue}>
                  {currentUser.firstName} {currentUser.lastName}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Email:</Text>
                <Text style={styles.infoValue}>{currentUser.email}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Role:</Text>
                <Text style={styles.infoValue}>{currentUser.role}</Text>
              </View>
            </View>

            {/* Quick Actions */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>⚡ Quick Actions</Text>
              <TouchableOpacity style={styles.actionButton}>
                <Text style={styles.actionButtonText}>📚 My Students (Coming Soon)</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionButton}>
                <Text style={styles.actionButtonText}>📝 Reports (Coming Soon)</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionButton}>
                <Text style={styles.actionButtonText}>📅 Calendar (Coming Soon)</Text>
              </TouchableOpacity>
            </View>

            {/* Status Card */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>✅ App Status</Text>
              <Text style={styles.statusText}>✅ Login: Working</Text>
              <Text style={styles.statusText}>✅ API: Connected</Text>
              <Text style={styles.statusText}>✅ Dashboard: Loaded</Text>
              <Text style={styles.statusText}>✅ Branding: Active!</Text>
              <Text style={styles.statusText}>❌ Navigation: Not Added Yet</Text>
            </View>

            <View style={styles.bottomSpacer} />
          </ScrollView>
        </LinearGradient>
      </SafeAreaView>
    );
  }

  // Login Screen with Dynamic Branding
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      <LinearGradient colors={[primaryColor, secondaryColor]} style={styles.gradient}>
        <View style={styles.loginContainer}>
          <View style={styles.logoSection}>
            <Text style={styles.logo}>🎓</Text>
            <Text style={styles.appTitle}>Barrana.ai</Text>
            <Text style={styles.appSubtitle}>School Management System</Text>
            <Text style={styles.versionTextLogin}>Version 4: Branding Test</Text>
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
  
  // Check for user to get schoolId and role
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
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
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
  welcomeSection: {
    padding: 20,
    paddingTop: 10,
  },
  welcomeText: {
    fontSize: 22,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 5,
  },
  roleText: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    marginBottom: 5,
  },
  versionText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.6)',
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
  infoRow: {
    marginBottom: 10,
  },
  infoLabel: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: 3,
  },
  infoValue: {
    fontSize: 16,
    color: 'white',
    fontWeight: '600',
  },
  infoText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
    fontStyle: 'italic',
    marginTop: 10,
  },
  actionButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  actionButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  statusText: {
    color: 'white',
    fontSize: 14,
    marginBottom: 8,
  },
  bottomSpacer: {
    height: 30,
  },
});

