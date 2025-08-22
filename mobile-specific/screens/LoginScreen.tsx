import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';

const { width, height } = Dimensions.get('window');

const LoginScreen: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'teacher' | 'parent'>('teacher');
  const [showPassword, setShowPassword] = useState(false);
  const { login, error, isLoading } = useAuth();

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Missing Information', 'Please fill in all fields');
      return;
    }

    try {
      await login({ email, password, role });
    } catch (err) {
      Alert.alert('Login Failed', 'Please check your credentials and try again');
    }
  };

  const handleDemoLogin = (demoEmail: string, demoRole: 'teacher' | 'parent') => {
    setEmail(demoEmail);
    setPassword('demo123');
    setRole(demoRole);
    login({ email: demoEmail, password: 'demo123', role: demoRole });
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Header Section */}
          <View style={styles.header}>
            <View style={styles.logoContainer}>
              <View style={styles.logoCircle}>
                <Ionicons name="school" size={40} color="#25D366" />
              </View>
            </View>
            <Text style={styles.title}>Barrana.ai</Text>
            <Text style={styles.subtitle}>School Management System</Text>
            <Text style={styles.tagline}>Connect, Learn, Grow</Text>
          </View>

          {/* Login Form */}
          <View style={styles.formContainer}>
            <View style={styles.form}>
              <View style={styles.inputContainer}>
                <Ionicons name="mail-outline" size={20} color="#8E8E93" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Email address"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholderTextColor="#8E8E93"
                />
              </View>

              <View style={styles.inputContainer}>
                <Ionicons name="lock-closed-outline" size={20} color="#8E8E93" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Password"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholderTextColor="#8E8E93"
                />
                <TouchableOpacity 
                  onPress={() => setShowPassword(!showPassword)}
                  style={styles.eyeButton}
                >
                  <Ionicons 
                    name={showPassword ? "eye-off-outline" : "eye-outline"} 
                    size={20} 
                    color="#8E8E93" 
                  />
                </TouchableOpacity>
              </View>

              {/* Role Selection */}
              <View style={styles.roleContainer}>
                <TouchableOpacity
                  style={[
                    styles.roleButton,
                    role === 'teacher' && styles.roleButtonActive
                  ]}
                  onPress={() => setRole('teacher')}
                >
                  <Ionicons 
                    name="school-outline" 
                    size={20} 
                    color={role === 'teacher' ? '#25D366' : '#8E8E93'} 
                  />
                  <Text style={[
                    styles.roleButtonText,
                    role === 'teacher' && styles.roleButtonTextActive
                  ]}>
                    Teacher
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.roleButton,
                    role === 'parent' && styles.roleButtonActive
                  ]}
                  onPress={() => setRole('parent')}
                >
                  <Ionicons 
                    name="people-outline" 
                    size={20} 
                    color={role === 'parent' ? '#25D366' : '#8E8E93'} 
                  />
                  <Text style={[
                    styles.roleButtonText,
                    role === 'parent' && styles.roleButtonTextActive
                  ]}>
                    Parent
                  </Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={[styles.loginButton, isLoading && styles.loginButtonDisabled]}
                onPress={handleLogin}
                disabled={isLoading}
              >
                <Text style={styles.loginButtonText}>
                  {isLoading ? 'Signing in...' : 'Sign In'}
                </Text>
                <Ionicons name="arrow-forward" size={20} color="white" />
              </TouchableOpacity>

              {error && (
                <View style={styles.errorContainer}>
                  <Ionicons name="alert-circle-outline" size={16} color="#FF3B30" />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}
            </View>
          </View>

          {/* Demo Accounts Section */}
          <View style={styles.demoSection}>
            <View style={styles.demoHeader}>
              <Ionicons name="flash-outline" size={20} color="#25D366" />
              <Text style={styles.demoTitle}>Quick Demo Access</Text>
            </View>
            <Text style={styles.demoSubtitle}>Tap any account to sign in instantly</Text>

            <View style={styles.demoContainer}>
              <Text style={styles.demoSectionTitle}>👨‍🏫 Teachers</Text>
              
              <TouchableOpacity
                style={styles.demoButton}
                onPress={() => handleDemoLogin('emily.rodriguez@barranaischool.edu', 'teacher')}
              >
                <View style={styles.demoButtonContent}>
                  <View style={styles.demoAvatar}>
                    <Text style={styles.demoAvatarText}>ER</Text>
                  </View>
                  <View style={styles.demoButtonInfo}>
                    <Text style={styles.demoButtonName}>Emily Rodriguez</Text>
                    <Text style={styles.demoButtonSchool}>Barrana AI School</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#8E8E93" />
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.demoButton}
                onPress={() => handleDemoLogin('michael.chen@barranaischool.edu', 'teacher')}
              >
                <View style={styles.demoButtonContent}>
                  <View style={styles.demoAvatar}>
                    <Text style={styles.demoAvatarText}>MC</Text>
                  </View>
                  <View style={styles.demoButtonInfo}>
                    <Text style={styles.demoButtonName}>Michael Chen</Text>
                    <Text style={styles.demoButtonSchool}>Barrana AI School</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#8E8E93" />
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.demoButton}
                onPress={() => handleDemoLogin('maria.rodriguez@barranadaycare.edu', 'teacher')}
              >
                <View style={styles.demoButtonContent}>
                  <View style={styles.demoAvatar}>
                    <Text style={styles.demoAvatarText}>MR</Text>
                  </View>
                  <View style={styles.demoButtonInfo}>
                    <Text style={styles.demoButtonName}>Maria Rodriguez</Text>
                    <Text style={styles.demoButtonSchool}>Barrana Day Care</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#8E8E93" />
                </View>
              </TouchableOpacity>

              <Text style={styles.demoSectionTitle}>👨‍👩‍👧‍👦 Parents</Text>

              <TouchableOpacity
                style={styles.demoButton}
                onPress={() => handleDemoLogin('jennifer.smith@email.com', 'parent')}
              >
                <View style={styles.demoButtonContent}>
                  <View style={styles.demoAvatar}>
                    <Text style={styles.demoAvatarText}>JS</Text>
                  </View>
                  <View style={styles.demoButtonInfo}>
                    <Text style={styles.demoButtonName}>Jennifer Smith</Text>
                    <Text style={styles.demoButtonSchool}>Barrana AI School</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#8E8E93" />
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.demoButton}
                onPress={() => handleDemoLogin('carlos.rodriguez@email.com', 'parent')}
              >
                <View style={styles.demoButtonContent}>
                  <View style={styles.demoAvatar}>
                    <Text style={styles.demoAvatarText}>CR</Text>
                  </View>
                  <View style={styles.demoButtonInfo}>
                    <Text style={styles.demoButtonName}>Carlos Rodriguez</Text>
                    <Text style={styles.demoButtonSchool}>Barrana AI School</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#8E8E93" />
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.demoButton}
                onPress={() => handleDemoLogin('jessica.martinez@email.com', 'parent')}
              >
                <View style={styles.demoButtonContent}>
                  <View style={styles.demoAvatar}>
                    <Text style={styles.demoAvatarText}>JM</Text>
                  </View>
                  <View style={styles.demoButtonInfo}>
                    <Text style={styles.demoButtonName}>Jessica Martinez</Text>
                    <Text style={styles.demoButtonSchool}>Barrana Day Care</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color="#8E8E93" />
                </View>
              </TouchableOpacity>
            </View>

            <View style={styles.demoNote}>
              <Ionicons name="information-circle-outline" size={16} color="#8E8E93" />
              <Text style={styles.demoNoteText}>
                All demo accounts use password: demo123
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
  },
  header: {
    alignItems: 'center',
    marginTop: height * 0.08,
    marginBottom: 40,
  },
  logoContainer: {
    marginBottom: 20,
  },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#1C1C1E',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#8E8E93',
    marginBottom: 4,
  },
  tagline: {
    fontSize: 14,
    color: '#25D366',
    fontWeight: '500',
  },
  formContainer: {
    marginBottom: 30,
  },
  form: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    marginBottom: 16,
    paddingHorizontal: 16,
    height: 56,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#1C1C1E',
    paddingVertical: 0,
  },
  eyeButton: {
    padding: 8,
  },
  roleContainer: {
    flexDirection: 'row',
    marginBottom: 24,
    gap: 12,
  },
  roleButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    gap: 8,
  },
  roleButtonActive: {
    backgroundColor: '#25D366',
  },
  roleButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#8E8E93',
  },
  roleButtonTextActive: {
    color: '#FFFFFF',
  },
  loginButton: {
    backgroundColor: '#25D366',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  loginButtonDisabled: {
    backgroundColor: '#C7C7CC',
  },
  loginButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFE5E5',
    borderRadius: 8,
    padding: 12,
    marginTop: 16,
    gap: 8,
  },
  errorText: {
    color: '#FF3B30',
    fontSize: 14,
  },
  demoSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    marginBottom: 30,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  demoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  demoTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1C1C1E',
  },
  demoSubtitle: {
    fontSize: 14,
    color: '#8E8E93',
    marginBottom: 20,
  },
  demoContainer: {
    marginBottom: 16,
  },
  demoSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1C1C1E',
    marginTop: 16,
    marginBottom: 12,
  },
  demoButton: {
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    marginBottom: 8,
    overflow: 'hidden',
  },
  demoButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  demoAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#25D366',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  demoAvatarText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  demoButtonInfo: {
    flex: 1,
  },
  demoButtonName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1C1C1E',
  },
  demoButtonSchool: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 2,
  },
  demoNote: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
    borderRadius: 8,
    padding: 12,
    gap: 8,
  },
  demoNoteText: {
    fontSize: 12,
    color: '#8E8E93',
    flex: 1,
  },
});

export default LoginScreen; 