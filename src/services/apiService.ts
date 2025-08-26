// API Service for Barrana.ai
// This service handles all HTTP requests to the backend

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5050/api';

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: 'teacher' | 'parent' | 'school_admin' | 'super_admin';
  schoolId?: string | { _id: string; name: string; [key: string]: any };
  isEmailVerified: boolean;
  preferences?: {
    language: string;
    timezone: string;
    notifications: {
      email: boolean;
      push: boolean;
      sms: boolean;
    };
  };
  lastLogin?: string;
  lastActivity?: string;
  createdAt: string;
  updatedAt: string;
}

export interface School {
  _id: string;
  name: string;
  slug: string;
  schoolType: string;
  estimatedStudents: number;
  gradeLevels: string[];
  address: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };
  contactPerson: {
    name: string;
    email: string;
    phone: string;
    role: string;
  };
  subscription: {
    plan: string;
    status: string;
    startDate: string;
    endDate: string;
  };
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SchoolAdminCredentials {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

export interface CreateSchoolResponse {
  data: School;
  schoolAdmin: SchoolAdminCredentials | null;
}

export interface Student {
  _id: string;
  firstName: string;
  lastName: string;
  name: string;
  age: number;
  grade: string;
  schoolId: string;
  teacherId?: string;
  parentId?: string;
  avatar?: string;
  lastReport: string;
  createdAt: string;
  updatedAt: string;
}

export interface Teacher {
  _id: string;
  id?: string; // For backward compatibility
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  role: 'teacher';
  schoolId: string | { _id: string; name: string; [key: string]: any };
  grade?: string;
  password?: string; // For teacher creation
  specialization?: string;
  qualifications?: string;
  bio?: string;
  hireDate?: string;
  subjects: string[];
  avatar?: string;
  isActive: boolean;
  isEmailVerified: boolean;
  canEmailReports?: boolean;
  lastLogin?: string;
  lastActivity?: string;
  performanceScore?: number;
  trainingCompleted?: string[];
  reportsGenerated?: number;
  avgTimePerReport?: number;
  efficiency?: number;
  students?: number;
  createdAt: string;
  updatedAt: string;
}

export interface Report {
  _id: string;
  studentId: string | { _id: string; firstName: string; lastName: string; grade: string; studentClass?: string; class?: string };
  teacherId: string;
  schoolId: string;
  title: string;
  content: string;
  type: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface Class {
  _id: string;
  id?: string; // For backward compatibility
  name: string;
  schoolId: string;
  grade: string;
  description?: string;
  status: 'active' | 'inactive' | 'archived';
  assignedTeachers: Array<{
    teacherId: {
      _id: string;
      firstName: string;
      lastName: string;
      email: string;
      avatar?: string;
      grade?: string;
      specialization?: string;
    };
    role: 'primary' | 'secondary' | 'assistant';
    assignedDate: string;
  }>;
  schedule: {
    academicYear: string;
    semester: 'fall' | 'spring' | 'summer';
    startDate: string;
    endDate?: string;
  };
  capacity: number;
  currentEnrollment: number;
  subjects: string[];
  createdBy: {
    _id: string;
    firstName: string;
    lastName: string;
  };
  isActive: boolean;
  isFull?: boolean;
  availableSpots?: number;
  createdAt: string;
  updatedAt: string;
}

// Interface for creating/updating classes (without assignedDate)
export interface CreateClassData {
  name: string;
  grade: string;
  description?: string;
  capacity?: number;
  academicYear?: string;
  semester?: 'fall' | 'spring' | 'summer';
  subjects?: string[];
  assignedTeachers?: Array<{
    teacherId: string;
    role: 'primary' | 'secondary' | 'assistant';
  }>;
  status?: 'active' | 'inactive' | 'archived';
}

class ApiService {
  private token: string | null = null;

  // Set authentication token
  setToken(token: string): void {
    this.token = token;
    localStorage.setItem('token', token);
  }

  // Get authentication token
  getToken(): string | null {
    if (!this.token) {
      this.token = localStorage.getItem('token');
    }
    return this.token;
  }

  // Clear authentication token
  clearToken(): void {
    this.token = null;
    localStorage.removeItem('token');
  }

  // Get headers for API requests
  private getHeaders(): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    const token = this.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    return headers;
  }

  // Generic API request method
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    try {
      const url = `${API_BASE_URL}${endpoint}`;
      const response = await fetch(url, {
        ...options,
        headers: this.getHeaders(),
      });

      const data = await response.json();

      if (!response.ok) {
        // Handle validation errors specifically
        if (data.errors && Array.isArray(data.errors)) {
          const validationErrors = data.errors.map((err: any) => `${err.path}: ${err.msg}`).join(', ');
          return {
            success: false,
            error: `Validation errors: ${validationErrors}`,
            message: data.message
          };
        }
        
        return {
          success: false,
          error: data.message || `HTTP ${response.status}: ${response.statusText}`,
        };
      }

      return {
        success: true,
        data: data.data || data,
        message: data.message,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error',
      };
    }
  }

  // Authentication endpoints
  async login(credentials: LoginCredentials): Promise<ApiResponse<{ user: User; token: string }>> {
    return this.request<{ user: User; token: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
  }

  async register(userData: Partial<User> & { password: string }): Promise<ApiResponse<{ user: User; token: string }>> {
    return this.request<{ user: User; token: string }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  }

  async logout(): Promise<ApiResponse<void>> {
    const response = await this.request<void>('/auth/logout', {
      method: 'POST',
    });
    this.clearToken();
    return response;
  }

  async getCurrentUser(): Promise<ApiResponse<User>> {
    return this.request<User>('/auth/me');
  }

  // School endpoints
  async getSchools(): Promise<ApiResponse<School[]>> {
    return this.request<School[]>('/schools');
  }

  async getSchool(id: string): Promise<ApiResponse<School>> {
    return this.request<School>(`/schools/${id}`);
  }

  async createSchool(schoolData: Partial<School>): Promise<ApiResponse<CreateSchoolResponse>> {
    return this.request<CreateSchoolResponse>('/schools', {
      method: 'POST',
      body: JSON.stringify(schoolData),
    });
  }

  async updateSchool(id: string, schoolData: Partial<School>): Promise<ApiResponse<School>> {
    return this.request<School>(`/schools/${id}`, {
      method: 'PUT',
      body: JSON.stringify(schoolData),
    });
  }

  async deleteSchool(id: string): Promise<ApiResponse<void>> {
    return this.request<void>(`/schools/${id}`, {
      method: 'DELETE',
    });
  }

  async updateSchoolSettings(id: string, settings: any): Promise<ApiResponse<School>> {
    return this.request<School>(`/schools/${id}/settings`, {
      method: 'PUT',
      body: JSON.stringify(settings),
    });
  }

  // User endpoints
  async getUsers(): Promise<ApiResponse<User[]>> {
    return this.request<User[]>('/users');
  }

  async getUser(id: string): Promise<ApiResponse<User>> {
    return this.request<User>(`/users/${id}`);
  }

  async createUser(userData: Partial<User> & { password: string }): Promise<ApiResponse<User>> {
    return this.request<User>('/users', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  }

  async updateUser(id: string, userData: Partial<User>): Promise<ApiResponse<User>> {
    return this.request<User>(`/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(userData),
    });
  }

  async deleteUser(id: string): Promise<ApiResponse<void>> {
    return this.request<void>(`/users/${id}`, {
      method: 'DELETE',
    });
  }

  // Student endpoints
  async getStudents(): Promise<ApiResponse<Student[]>> {
    return this.request<Student[]>('/students');
  }

  async getStudent(id: string): Promise<ApiResponse<Student>> {
    return this.request<Student>(`/students/${id}`);
  }

  async createStudent(studentData: Partial<Student>): Promise<ApiResponse<Student>> {
    return this.request<Student>('/students', {
      method: 'POST',
      body: JSON.stringify(studentData),
    });
  }

  async updateStudent(id: string, studentData: Partial<Student>): Promise<ApiResponse<Student>> {
    return this.request<Student>(`/students/${id}`, {
      method: 'PUT',
      body: JSON.stringify(studentData),
    });
  }

  async deleteStudent(id: string): Promise<ApiResponse<void>> {
    return this.request<void>(`/students/${id}`, {
      method: 'DELETE',
    });
  }

  // Teacher endpoints
  async getTeachers(): Promise<ApiResponse<Teacher[]>> {
    return this.request<Teacher[]>('/teachers');
  }

  async getTeacher(id: string): Promise<ApiResponse<Teacher>> {
    return this.request<Teacher>(`/teachers/${id}`);
  }

  async createTeacher(teacherData: Partial<Teacher>): Promise<ApiResponse<Teacher>> {
    return this.request<Teacher>('/teachers', {
      method: 'POST',
      body: JSON.stringify(teacherData),
    });
  }

  async updateTeacher(id: string, teacherData: Partial<Teacher>): Promise<ApiResponse<Teacher>> {
    return this.request<Teacher>(`/teachers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(teacherData),
    });
  }

  async deleteTeacher(id: string): Promise<ApiResponse<void>> {
    return this.request<void>(`/teachers/${id}`, {
      method: 'DELETE',
    });
  }

  // Class endpoints
  async getClasses(): Promise<ApiResponse<Class[]>> {
    return this.request<Class[]>('/classes');
  }

  async getTeacherAssignedClasses(): Promise<ApiResponse<Class[]>> {
    return this.request<Class[]>('/classes/teacher/assigned');
  }

  async getClass(id: string): Promise<ApiResponse<Class>> {
    return this.request<Class>(`/classes/${id}`);
  }

  async createClass(classData: CreateClassData): Promise<ApiResponse<Class>> {
    return this.request<Class>('/classes', {
      method: 'POST',
      body: JSON.stringify(classData),
    });
  }

  async updateClass(id: string, classData: Partial<CreateClassData>): Promise<ApiResponse<Class>> {
    return this.request<Class>(`/classes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(classData),
    });
  }

  async deleteClass(id: string): Promise<ApiResponse<void>> {
    return this.request<void>(`/classes/${id}`, {
      method: 'DELETE',
    });
  }

  async assignTeacherToClass(classId: string, teacherId: string, role: 'primary' | 'secondary' | 'assistant' = 'primary'): Promise<ApiResponse<Class>> {
    return this.request<Class>(`/classes/${classId}/teachers`, {
      method: 'POST',
      body: JSON.stringify({ teacherId, role }),
    });
  }

  async removeTeacherFromClass(classId: string, teacherId: string): Promise<ApiResponse<Class>> {
    return this.request<Class>(`/classes/${classId}/teachers/${teacherId}`, {
      method: 'DELETE',
    });
  }

  async getTeacherStats(): Promise<ApiResponse<{
    totalTeachers: number;
    activeTeachers: number;
    totalReports: number;
    avgReportsPerTeacher: number;
    avgEfficiency: number;
    avgTimePerReport: number;
  }>> {
    return this.request<{
      totalTeachers: number;
      activeTeachers: number;
      totalReports: number;
      avgReportsPerTeacher: number;
      avgEfficiency: number;
      avgTimePerReport: number;
    }>('/teachers/stats/overview');
  }

  // Report endpoints
  async getReports(includeCrossTeacher: boolean = false): Promise<ApiResponse<Report[]>> {
    const queryParam = includeCrossTeacher ? '?includeCrossTeacher=true' : '';
    return this.request<Report[]>(`/reports${queryParam}`);
  }

  async getAvailableTemplatesForStudent(studentId: string): Promise<ApiResponse<{
    student: { id: string; name: string; grade: string };
    availableTemplates: Array<{
      _id: string;
      name: string;
      reportFrequency: string;
      grade: string;
      isAvailable: boolean;
      existingReport?: {
        id: string;
        createdAt: string;
        teacherName: string;
        status: string;
      };
      periodStart: string;
      periodEnd: string;
    }>;
    totalTemplates: number;
    availableCount: number;
    unavailableCount: number;
    timezone: string;
    calculatedAt: string;
  }>> {
    return this.request<any>(`/reports/available-templates/${studentId}`);
  }

  async getAllSchoolReports(schoolId: string): Promise<ApiResponse<Report[]>> {
    return this.request<Report[]>(`/schools/${schoolId}/reports`);
  }

  async getReport(id: string): Promise<ApiResponse<Report>> {
    return this.request<Report>(`/reports/${id}`);
  }

  async createReport(reportData: Partial<Report>): Promise<ApiResponse<Report>> {
    return this.request<Report>('/reports', {
      method: 'POST',
      body: JSON.stringify(reportData),
    });
  }

  async updateReport(id: string, reportData: Partial<Report>): Promise<ApiResponse<Report>> {
    return this.request<Report>(`/reports/${id}`, {
      method: 'PUT',
      body: JSON.stringify(reportData),
    });
  }

  async deleteReport(id: string): Promise<ApiResponse<void>> {
    return this.request<void>(`/reports/${id}`, {
      method: 'DELETE',
    });
  }

  async sendReportEmail(reportId: string, parentEmail: string): Promise<ApiResponse<{ reportId: string; emailResult: any }>> {
    return this.request<{ reportId: string; emailResult: any }>(`/reports/${reportId}/send-email`, {
      method: 'POST',
      body: JSON.stringify({ parentEmail }),
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  // Health check
  async healthCheck(): Promise<ApiResponse<{ status: string; timestamp: string }>> {
    return this.request<{ status: string; timestamp: string }>('/health');
  }

  // Generic request method for debug and other endpoints
  async makeRequest<T>(endpoint: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, options);
  }
}

// Export singleton instance
export const apiService = new ApiService();
export default apiService; 