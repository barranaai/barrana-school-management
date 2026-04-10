import axios, { AxiosInstance, AxiosResponse } from 'axios';
import * as SecureStore from 'expo-secure-store';

// API Configuration
const API_BASE_URL = __DEV__ 
  ? 'http://191.101.233.56/api' 
  : 'http://191.101.233.56/api'; // Production server

// Token storage keys
const TOKEN_KEY = 'auth_token';
const USER_KEY = 'user_data';

// API Response interfaces
export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  errors?: any[];
}

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: 'teacher' | 'parent' | 'student' | 'school_admin' | 'super_admin';
  schoolId?: string | {
    _id: string;
    name: string;
    slug: string;
    schoolType: string;
  };
  isEmailVerified: boolean;
  preferences?: any;
  lastLogin?: string;
  lastActivity?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  user: User;
  token: string;
}

export interface RegisterRequest {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  role: 'teacher' | 'parent' | 'student';
  schoolId?: string;
}

class ApiService {
  private api: AxiosInstance;
  private token: string | null = null;

  constructor() {
    this.api = axios.create({
      baseURL: API_BASE_URL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor to add auth token
    this.api.interceptors.request.use(
      async (config) => {
        if (!this.token) {
          this.token = await this.getStoredToken();
        }
        
        if (this.token) {
          config.headers.Authorization = `Bearer ${this.token}`;
        }
        
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor to handle token expiration
    this.api.interceptors.response.use(
      (response) => response,
      async (error) => {
        if (error.response?.status === 401) {
          // Token expired or invalid
          await this.clearStoredData();
          this.token = null;
        }
        return Promise.reject(error);
      }
    );
  }

  // Get base URL
  public getBaseUrl(): string {
    return API_BASE_URL;
  }

  // Get current token (for external use)
  public async getToken(): Promise<string | null> {
    return await this.getStoredToken();
  }

  // Generic request method (for backward compatibility)
  public async makeRequest<T = any>(endpoint: string, options?: any): Promise<T> {
    try {
      const response: AxiosResponse<T> = await this.api.request({
        url: endpoint,
        ...options
      });
      return response.data;
    } catch (error: any) {
      console.error('📱 API Request error:', error);
      throw error;
    }
  }

  // Token management
  private async getStoredToken(): Promise<string | null> {
    try {
      return await SecureStore.getItemAsync(TOKEN_KEY);
    } catch (error) {
      console.error('Error getting stored token:', error);
      return null;
    }
  }

  private async storeToken(token: string): Promise<void> {
    try {
      await SecureStore.setItemAsync(TOKEN_KEY, token);
      this.token = token;
    } catch (error) {
      console.error('Error storing token:', error);
    }
  }

  private async clearStoredData(): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
      await SecureStore.deleteItemAsync(USER_KEY);
      this.token = null;
    } catch (error) {
      console.error('Error clearing stored data:', error);
    }
  }

  // User data management
  private async storeUserData(user: User): Promise<void> {
    try {
      if (!user) {
        console.error('Cannot store user data: user is null or undefined');
        return;
      }
      
      console.log('📱 Storing user data:', {
        id: user.id,
        email: user.email,
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName
      });
      
      // Create a clean user object with only serializable data
      const cleanUser = {
        id: user.id || '',
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        email: user.email || '',
        role: user.role || 'teacher',
        schoolId: typeof user.schoolId === 'string' ? user.schoolId : user.schoolId?._id || user.schoolId?.name || null,
        isEmailVerified: user.isEmailVerified || false,
        preferences: user.preferences ? JSON.stringify(user.preferences) : null,
        lastLogin: user.lastLogin || null,
        lastActivity: user.lastActivity || null
      };
      
      console.log('📱 Clean user data to store:', cleanUser);
      await SecureStore.setItemAsync(USER_KEY, JSON.stringify(cleanUser));
      console.log('📱 User data stored successfully');
    } catch (error) {
      console.error('Error storing user data:', error);
      console.error('User object:', user);
    }
  }

  public async getStoredUserData(): Promise<User | null> {
    try {
      const userData = await SecureStore.getItemAsync(USER_KEY);
      if (!userData) return null;
      
      const parsedUser = JSON.parse(userData);
      
      // Convert back to User interface format
      const user: User = {
        id: parsedUser.id,
        firstName: parsedUser.firstName,
        lastName: parsedUser.lastName,
        email: parsedUser.email,
        role: parsedUser.role,
        schoolId: parsedUser.schoolId,
        isEmailVerified: parsedUser.isEmailVerified,
        preferences: parsedUser.preferences ? JSON.parse(parsedUser.preferences) : undefined,
        lastLogin: parsedUser.lastLogin,
        lastActivity: parsedUser.lastActivity
      };
      
      return user;
    } catch (error) {
      console.error('Error getting stored user data:', error);
      return null;
    }
  }

  // Authentication methods
  public async login(credentials: LoginRequest): Promise<LoginResponse> {
    try {
      console.log('📱 ====== MOBILE LOGIN DEBUG ======');
      console.log('📱 API Base URL:', API_BASE_URL);
      console.log('📱 Login URL:', `${API_BASE_URL}/auth/login`);
      console.log('📱 Attempting login for:', credentials.email);
      console.log('📱 Password length:', credentials.password.length);
      
      const response: AxiosResponse<ApiResponse<LoginResponse>> = await this.api.post('/auth/login', credentials);
      
      console.log('📱 Raw response status:', response.status);
      console.log('📱 Raw response headers:', JSON.stringify(response.headers, null, 2));
      console.log('📱 Raw response data:', JSON.stringify(response.data, null, 2));
      
      console.log('📱 Login response:', {
        success: response.data.success,
        hasData: !!response.data.data,
        data: response.data.data
      });
      
      if (response.data.success && response.data.data) {
        const { user, token } = response.data.data;
        
        console.log('📱 Login successful, user data:', JSON.stringify(user, null, 2));
        console.log('📱 Token received:', token ? 'YES' : 'NO');
        console.log('📱 Token length:', token?.length || 0);
        
        // Store token and user data
        await this.storeToken(token);
        await this.storeUserData(user);
        
        return { user, token };
      } else {
        console.error('📱 Login failed - response not successful');
        console.error('📱 Response message:', response.data.message);
        throw new Error(response.data.message || 'Login failed');
      }
    } catch (error: any) {
      console.error('📱 ====== LOGIN ERROR DEBUG ======');
      console.error('📱 Error type:', error.constructor.name);
      console.error('📱 Error message:', error.message);
      console.error('📱 Error code:', error.code);
      console.error('📱 Network error:', error.isAxiosError);
      console.error('📱 Request config:', error.config);
      console.error('📱 Response status:', error.response?.status);
      console.error('📱 Response data:', JSON.stringify(error.response?.data, null, 2));
      console.error('📱 Full error object:', JSON.stringify(error, null, 2));
      
      if (error.response?.data?.message) {
        throw new Error(error.response.data.message);
      }
      throw new Error(error.message || 'Network error - Check console for details');
    }
  }

  public async register(userData: RegisterRequest): Promise<LoginResponse> {
    try {
      console.log('📱 Attempting registration for:', userData.email);
      const response: AxiosResponse<ApiResponse<LoginResponse>> = await this.api.post('/auth/register', userData);
      
      console.log('📱 Registration response:', {
        success: response.data.success,
        hasData: !!response.data.data,
        data: response.data.data
      });
      
      if (response.data.success && response.data.data) {
        const { user, token } = response.data.data;
        
        console.log('📱 Registration successful, user data:', user);
        console.log('📱 Token received:', token ? 'YES' : 'NO');
        
        // Store token and user data
        await this.storeToken(token);
        await this.storeUserData(user);
        
        return { user, token };
      } else {
        throw new Error(response.data.message || 'Registration failed');
      }
    } catch (error: any) {
      console.error('📱 Registration error:', error);
      console.error('📱 Error response:', error.response?.data);
      
      if (error.response?.data?.message) {
        throw new Error(error.response.data.message);
      }
      throw new Error(error.message || 'Network error');
    }
  }

  public async logout(): Promise<void> {
    try {
      // Call logout endpoint if token exists
      if (this.token) {
        await this.api.post('/auth/logout');
      }
    } catch (error) {
      console.error('Logout API call failed:', error);
    } finally {
      // Always clear local data
      await this.clearStoredData();
    }
  }

  public async getCurrentUser(): Promise<User | null> {
    try {
      console.log('📱 Getting current user...');
      const response: AxiosResponse<ApiResponse<{ user: User }>> = await this.api.get('/auth/me');
      
      console.log('📱 Current user response:', {
        success: response.data.success,
        hasData: !!response.data.data,
        userData: response.data.data
      });
      
      if (response.data.success && response.data.data) {
        const user = response.data.data.user;
        console.log('📱 Current user data:', user);
        await this.storeUserData(user);
        return user;
      }
      return null;
    } catch (error) {
      console.error('📱 Error getting current user:', error);
      return null;
    }
  }

  public async isAuthenticated(): Promise<boolean> {
    const token = await this.getStoredToken();
    if (!token) return false;
    
    try {
      const user = await this.getCurrentUser();
      return !!user;
    } catch (error) {
      return false;
    }
  }

  // Teacher-specific API methods
  public async getTeacherDashboard(): Promise<any> {
    try {
      const response: AxiosResponse<ApiResponse> = await this.api.get('/teachers/dashboard');
      return response.data.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Failed to fetch dashboard data');
    }
  }

  public async getStudents(): Promise<any[]> {
    try {
      const response: AxiosResponse<ApiResponse<any[]>> = await this.api.get('/teachers/students');
      return response.data.data || [];
    } catch (error: any) {
      // For now, return mock data until backend endpoints are ready
      return [
        {
          id: '1',
          firstName: 'Emma',
          lastName: 'Johnson',
          grade: 'Kindergarten',
          class: 'K-A',
          status: 'active',
          lastReportDate: '2024-01-15',
        },
        {
          id: '2',
          firstName: 'Liam',
          lastName: 'Smith',
          grade: 'Kindergarten',
          class: 'K-A',
          status: 'active',
          lastReportDate: '2024-01-14',
        },
        {
          id: '3',
          firstName: 'Olivia',
          lastName: 'Davis',
          grade: 'Kindergarten',
          class: 'K-A',
          status: 'active',
          lastReportDate: '2024-01-13',
        },
      ];
    }
  }

  public async getTeacherStudents(teacherId: string): Promise<any[]> {
    try {
      const response: AxiosResponse<ApiResponse<any[]>> = await this.api.get(`/teachers/${teacherId}/students`);
      return response.data.data || [];
    } catch (error: any) {
      console.error('Error fetching teacher students:', error);
      throw new Error(error.response?.data?.message || 'Failed to fetch teacher students');
    }
  }

  public async getTeacherReports(teacherId: string): Promise<any[]> {
    try {
      const response: AxiosResponse<ApiResponse<any[]>> = await this.api.get(`/teachers/${teacherId}/reports`);
      return response.data.data || [];
    } catch (error: any) {
      console.error('Error fetching teacher reports:', error);
      throw new Error(error.response?.data?.message || 'Failed to fetch teacher reports');
    }
  }



  // This method is replaced by the more comprehensive createReport method below

  public async getReports(includeCrossTeacher: boolean = false): Promise<any[]> {
    try {
      const queryParam = includeCrossTeacher ? '?includeCrossTeacher=true' : '';
      const response: AxiosResponse<ApiResponse<any[]>> = await this.api.get(`/reports${queryParam}`);
      return response.data.data || [];
    } catch (error: any) {
      // For now, return mock data until backend endpoints are ready
      return [
        {
          id: '1',
          studentId: '1',
          studentName: 'Emma Johnson',
          title: 'Monthly Progress Report',
          content: 'Emma has shown excellent progress in reading and math...',
          status: 'completed',
          createdAt: '2024-01-15T10:00:00Z',
          updatedAt: '2024-01-15T10:00:00Z',
          voiceRecording: {
            hasRecording: true,
            duration: 120,
          },
        },
        {
          id: '2',
          studentId: '2',
          studentName: 'Liam Smith',
          title: 'Weekly Assessment',
          content: 'Liam continues to develop his social skills...',
          status: 'draft',
          createdAt: '2024-01-14T14:30:00Z',
          updatedAt: '2024-01-14T14:30:00Z',
          voiceRecording: {
            hasRecording: false,
          },
        },
        {
          id: '3',
          studentId: '3',
          studentName: 'Olivia Davis',
          title: 'Behavioral Observation',
          content: 'Olivia demonstrates strong leadership qualities...',
          status: 'sent',
          createdAt: '2024-01-13T09:15:00Z',
          updatedAt: '2024-01-13T09:15:00Z',
          voiceRecording: {
            hasRecording: true,
            duration: 180,
          },
        },
      ];
    }
  }

  // Due status API method
  public async checkDueStatus(studentId: string, templateId: string): Promise<any> {
    try {
      const response: AxiosResponse<ApiResponse<any>> = await this.api.get(`/reports/due-status?studentId=${studentId}&templateId=${templateId}`);
      return response.data;
    } catch (error: any) {
      console.error('Error checking due status:', error);
      throw new Error(error.response?.data?.message || 'Failed to check due status');
    }
  }

  // NEW: Get due reports from centralized backend calculator (single source of truth)
  public async getDueReports(): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      console.log('📱 Getting due reports from centralized backend...');
      const response: AxiosResponse<ApiResponse<any>> = await this.api.get('/reports/due');
      
      if (response.data.success && response.data.data) {
        console.log('📱 Due reports received:', response.data.data);
        return { 
          success: true, 
          data: response.data.data 
        };
      } else {
        throw new Error(response.data.message || 'Failed to get due reports');
      }
    } catch (error: any) {
      console.error('📱 Error getting due reports:', error);
      return { 
        success: false, 
        error: error.response?.data?.message || error.message || 'Failed to get due reports' 
      };
    }
  }

  // NEW: Check if a report can be generated for a student/template (validation before creating report)
  public async canGenerateReport(studentId: string, templateId: string): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      console.log('📱 Checking if report can be generated:', { studentId, templateId });
      const response: AxiosResponse<ApiResponse<any>> = await this.api.post('/reports/can-generate', {
        studentId,
        templateId
      });
      
      if (response.data.success && response.data.data) {
        console.log('📱 Can generate report:', response.data.data);
        return { 
          success: true, 
          data: response.data.data 
        };
      } else {
        throw new Error(response.data.message || 'Validation failed');
      }
    } catch (error: any) {
      console.error('📱 Error checking if report can be generated:', error);
      return { 
        success: false, 
        error: error.response?.data?.message || error.message || 'Validation failed' 
      };
    }
  }

  // Parent-specific API methods
  public async getParentDashboard(): Promise<any> {
    try {
      const response: AxiosResponse<ApiResponse> = await this.api.get('/parents/dashboard');
      return response.data.data;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Failed to fetch dashboard data');
    }
  }

  public async getChildReports(): Promise<any[]> {
    try {
      const response: AxiosResponse<ApiResponse<any[]>> = await this.api.get('/parents/reports');
      return response.data.data || [];
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Failed to fetch child reports');
    }
  }

  // Utility methods
  public async forgotPassword(email: string): Promise<void> {
    try {
      await this.api.post('/auth/forgot-password', { email });
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Failed to send password reset email');
    }
  }

  public async resetPassword(token: string, password: string): Promise<void> {
    try {
      await this.api.post('/auth/reset-password', { token, password });
    } catch (error: any) {
      throw new Error(error.response?.data?.message || 'Failed to reset password');
    }
  }

  // Report Templates API
  public async getReportTemplates(): Promise<any[]> {
    try {
      const response: AxiosResponse<ApiResponse<any[]>> = await this.api.get('/report-templates');
      return response.data.data || [];
    } catch (error: any) {
      console.error('Error fetching report templates:', error);
      throw new Error(error.response?.data?.message || 'Failed to fetch report templates');
    }
  }

  // School API
  public async getSchool(schoolId: string): Promise<any> {
    try {
      const response: AxiosResponse<ApiResponse<any>> = await this.api.get(`/schools/${schoolId}`);
      return response.data.data || null;
    } catch (error: any) {
      console.error('Error fetching school data:', error);
      throw new Error(error.response?.data?.message || 'Failed to fetch school data');
    }
  }

  // Get school branding (for teachers and parents)
  public async getSchoolBranding(endpoint: string): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      console.log('📱 Fetching school branding from:', endpoint);
      console.log('📱 Full API URL:', API_BASE_URL + endpoint);
      console.log('📱 Has token:', !!(await this.getToken()));
      
      const response: AxiosResponse<ApiResponse<any>> = await this.api.get(endpoint);
      
      console.log('📱 Raw API response status:', response.status);
      console.log('📱 Raw API response data:', JSON.stringify(response.data, null, 2));
      
      if (response.data.success && response.data.data) {
        console.log('📱 School branding fetched successfully');
        console.log('📱 Branding data:', JSON.stringify(response.data.data, null, 2));
        return { 
          success: true, 
          data: response.data.data 
        };
      } else {
        throw new Error(response.data.message || 'Failed to fetch school branding');
      }
    } catch (error: any) {
      console.error('📱 Error fetching school branding:', error);
      console.error('📱 Error response:', error.response?.data);
      console.error('📱 Error status:', error.response?.status);
      return { 
        success: false, 
        error: error.response?.data?.message || error.message || 'Failed to fetch school branding' 
      };
    }
  }

  // AI Services API
  public async transcribeAudio(params: {
    audioBlob: Blob;
    language: string;
    studentName: string;
  }): Promise<{ success: boolean; data?: string; error?: string }> {
    try {
      const formData = new FormData();
      formData.append('audio', params.audioBlob);
      formData.append('language', params.language);
      formData.append('studentName', params.studentName);

      const response = await this.api.post('/ai/transcribe', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      return { success: true, data: response.data.data };
    } catch (error: any) {
      console.error('Error transcribing audio:', error);
      return { 
        success: false, 
        error: error.response?.data?.message || 'Failed to transcribe audio' 
      };
    }
  }

  // Mobile-specific audio upload method for React Native
  public async uploadAudioFile(formData: FormData): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      console.log('📱 Uploading audio file...');
      
      // Use the backend upload endpoint
      const response = await this.api.post('/ai/upload-audio', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        timeout: 60000, // 1 minute timeout for upload
      });

      console.log('📱 Audio upload response status:', response.status);
      console.log('📱 Audio upload response data:', response.data);
      
      if (response.data.success && response.data.data) {
        return { 
          success: true, 
          data: response.data.data
        };
      } else {
        throw new Error(response.data.message || 'Audio upload failed');
      }
    } catch (error: any) {
      console.error('📱 Error uploading audio file:', error);
      console.error('📱 Error message:', error.message);
      
      return {
        success: false,
        error: error.response?.data?.message || error.message || 'Audio upload failed. Please try again.'
      };
    }
  }

  // Mobile-specific transcription method for React Native
  public async transcribeAudioFile(formData: FormData): Promise<{ success: boolean; data?: string; error?: string }> {
    try {
      console.log('📱 Sending audio file for transcription...');
      
      // Use the backend transcription endpoint
      const response = await this.api.post('/ai/process-voice', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        timeout: 120000, // 2 minute timeout for audio processing
      });

      console.log('📱 Transcription response status:', response.status);
      console.log('📱 Transcription response data:', response.data);
      
      if (response.data.success && response.data.data) {
        // Extract transcription from the response
        const transcription = response.data.data.transcription || response.data.data;
        return { 
          success: true, 
          data: typeof transcription === 'string' ? transcription : JSON.stringify(transcription)
        };
      } else {
        throw new Error(response.data.message || 'Transcription failed');
      }
    } catch (error: any) {
      console.error('📱 Error transcribing audio file:', error);
      console.error('📱 Error message:', error.message);
      
      // Return actual error instead of mock data
      return {
        success: false,
        error: error.response?.data?.message || error.message || 'Transcription failed. Please check your audio file and try again.'
      };
    }
  }

  public async generateReport(params: {
    transcription: string;
    studentName: string;
    grade: string;
    template: string;
    templateId?: string; // ID of the report template for dynamic prompts
  }): Promise<{ success: boolean; data?: string; error?: string }> {
    try {
      console.log('📱 Generating report with params:', params);
      console.log('📱 API Base URL:', this.api.defaults.baseURL);
      console.log('📱 Full URL would be:', `${this.api.defaults.baseURL}/ai/generate-report`);
      
      const requestData = {
        transcription: params.transcription,
        studentName: params.studentName,
        grade: params.grade,
        template: params.template,
        templateId: params.templateId, // Pass templateId for dynamic prompts
        timestamp: new Date().toISOString()
      };
      
      console.log('📱 Request data:', requestData);
      
      // Ensure we have a token
      if (!this.token) {
        this.token = await this.getStoredToken();
      }
      
      console.log('📱 Token available:', !!this.token);
      console.log('📱 Token length:', this.token?.length || 0);
      
      // Create a custom axios instance with longer timeout for AI generation
      const aiApi = axios.create({
        baseURL: this.api.defaults.baseURL,
        timeout: 60000, // 60 seconds for AI processing
        headers: {
          'Content-Type': 'application/json',
          ...(this.token && { 'Authorization': `Bearer ${this.token}` }),
        },
      });
      
      console.log('📱 AI API headers:', aiApi.defaults.headers);
      
      const response = await aiApi.post('/ai/generate-report', requestData);
      
      console.log('📱 Report generation response:', response.data);
      console.log('📱 Response status:', response.status);
      console.log('📱 Response headers:', response.headers);
      
      if (response.data.success && response.data.data) {
        // Extract the report content from the response
        const reportContent = response.data.data.content || response.data.data;
        return { success: true, data: typeof reportContent === 'string' ? reportContent : JSON.stringify(reportContent) };
      } else {
        throw new Error(response.data.message || 'Report generation failed');
      }
    } catch (error: any) {
      console.error('📱 Error generating report:', error);
      console.error('📱 Error details:', {
        message: error.message,
        code: error.code,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        config: {
          url: error.config?.url,
          method: error.config?.method,
          baseURL: error.config?.baseURL
        }
      });
      
      // Provide more specific error messages
      let errorMessage = 'Failed to generate report';
      if (error.code === 'NETWORK_ERROR' || error.message.includes('Network Error')) {
        errorMessage = 'Network Error: Unable to connect to server. Please check your internet connection.';
      } else if (error.response?.status === 500) {
        errorMessage = 'Server Error: The server encountered an error while generating the report.';
      } else if (error.response?.status === 401) {
        errorMessage = 'Authentication Error: Please login again.';
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      }
      
      return { 
        success: false, 
        error: errorMessage
      };
    }
  }

  // Reports API
  public async createReport(reportData: any): Promise<{ success: boolean; data?: any; message?: string; error?: string }> {
    try {
      console.log('📱 Creating report with data:', reportData);
      const response: AxiosResponse<ApiResponse> = await this.api.post('/reports', reportData);
      console.log('📱 Report creation response:', response.data);
      return { success: true, data: response.data.data };
    } catch (error: any) {
      console.error('📱 Error creating report:', error);
      return { 
        success: false, 
        error: error.response?.data?.message || 'Failed to create report' 
      };
    }
  }

  public async approveReport(reportId: string, comment: string): Promise<{ success: boolean; message?: string }> {
    try {
      console.log('📱 Approving report:', reportId);
      const response: AxiosResponse<ApiResponse> = await this.api.put(`/reports/${reportId}/approve`, {
        comment
      });
      console.log('📱 Report approval response:', response.data);
      return { success: true };
    } catch (error: any) {
      console.error('📱 Error approving report:', error);
      return { 
        success: false, 
        message: error.response?.data?.message || 'Failed to approve report' 
      };
    }
  }

  public async sendReportToParents(reportId: string, emails: string[]): Promise<{ success: boolean; message?: string }> {
    try {
      console.log('📱 Sending report to parents:', reportId, emails);
      
      // Send email to each parent using the correct endpoint
      const results = [];
      for (const email of emails) {
        const response: AxiosResponse<ApiResponse> = await this.api.post(`/reports/${reportId}/send-email`, {
          parentEmail: email
        });
        console.log('📱 Report send response for', email, ':', response.data);
        results.push(response.data);
      }
      
      return { success: true };
    } catch (error: any) {
      console.error('📱 Error sending report to parents:', error);
      return { 
        success: false, 
        message: error.response?.data?.message || 'Failed to send report to parents' 
      };
    }
  }

  // Media upload methods
  public async uploadReportMedia(reportId: string, mediaFiles: any[]): Promise<{ success: boolean; data?: any; message?: string }> {
    try {
      console.log('📱 Uploading media for report:', reportId);
      console.log('📱 Media files to upload:', mediaFiles.length);
      
      // Ensure we have a token
      if (!this.token) {
        this.token = await this.getStoredToken();
      }
      
      // Create FormData
      const formData = new FormData();
      
      for (let i = 0; i < mediaFiles.length; i++) {
        const file = mediaFiles[i];
        console.log(`📱 Processing file ${i + 1}:`, file.name, file.type);
        
        // Create proper file object for React Native
        const fileObject = {
          uri: file.uri,
          type: file.type === 'image' ? 'image/jpeg' : 'video/mp4', // Default mime types
          name: file.name,
        } as any;
        
        formData.append('media', fileObject);
      }
      
      // Create axios instance without Content-Type (let it set boundary automatically)
      const uploadApi = axios.create({
        baseURL: API_BASE_URL,
        timeout: 120000, // 2 minutes for file uploads
        headers: {
          'Authorization': `Bearer ${this.token}`,
        },
      });
      
      // Determine endpoint
      const isTemporary = !reportId || reportId.startsWith('temp_');
      const endpoint = isTemporary ? '/reports/temp-media' : `/reports/${reportId}/media`;
      
      console.log('📱 Upload endpoint:', endpoint);
      console.log('📱 Is temporary upload:', isTemporary);
      
      const response = await uploadApi.post(endpoint, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      
      console.log('📱 Media upload response:', response.data);
      
      return { 
        success: true, 
        data: response.data.data,
        message: response.data.message
      };
    } catch (error: any) {
      console.error('📱 Error uploading media:', error);
      console.error('📱 Error details:', {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data
      });
      
      return { 
        success: false, 
        message: error.response?.data?.message || error.message || 'Failed to upload media' 
      };
    }
  }

  public async getReportMedia(reportId: string): Promise<{ success: boolean; data?: any[] }> {
    try {
      console.log('📱 Getting media for report:', reportId);
      const response: AxiosResponse<ApiResponse> = await this.api.get(`/reports/${reportId}/media`);
      console.log('📱 Get media response:', response.data);
      
      return { 
        success: true, 
        data: response.data.data || [] 
      };
    } catch (error: any) {
      console.error('📱 Error getting media:', error);
      return { 
        success: false, 
        data: [] 
      };
    }
  }

  public async deleteReportMedia(reportId: string, mediaId: string): Promise<{ success: boolean; message?: string }> {
    try {
      console.log('📱 Deleting media:', reportId, mediaId);
      const response: AxiosResponse<ApiResponse> = await this.api.delete(`/reports/${reportId}/media/${mediaId}`);
      console.log('📱 Delete media response:', response.data);
      
      return { success: true };
    } catch (error: any) {
      console.error('📱 Error deleting media:', error);
      return { 
        success: false, 
        message: error.response?.data?.message || 'Failed to delete media' 
      };
    }
  }

  // Get current teacher data with permissions
  public async getCurrentTeacher(userId: string): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const response: AxiosResponse<ApiResponse<any[]>> = await this.api.get('/teachers');
      
      if (response.data.success && response.data.data) {
        // Find the current teacher based on user ID
        const currentTeacher = response.data.data.find((teacher: any) => 
          teacher._id === userId || teacher.id === userId
        );
        
        return { 
          success: true, 
          data: currentTeacher || null 
        };
      } else {
        throw new Error('Failed to fetch teacher data');
      }
    } catch (error: any) {
      console.error('Error fetching current teacher:', error);
      return { 
        success: false, 
        error: error.response?.data?.message || error.message || 'Failed to fetch teacher data' 
      };
    }
  }
}

// Export singleton instance
export const apiService = new ApiService();
export default apiService; 