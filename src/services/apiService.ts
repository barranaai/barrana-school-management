// API Service for Barrana.ai
// This service handles all HTTP requests to the backend

// In production, use a relative path so Nginx proxies /api correctly.
// In development, the proxy field in package.json forwards /api to localhost:5050.
const API_BASE_URL = process.env.REACT_APP_API_URL || '/api';

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  /**
   * Some create-user endpoints (e.g. POST /teachers) return an
   * auto-generated password at the top level alongside the user data.
   * Optional everywhere; consumers must null-check before use.
   */
  generatedPassword?: string;
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
  role: 'teacher' | 'parent' | 'student' | 'school_admin' | 'super_admin';
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

export interface MedicalInfo {
  allergies?: string[];
  conditions?: string[];
  medications?: string[];
  dietaryRestrictions?: string[];
}

export interface Student {
  _id: string;
  firstName: string;
  lastName: string;
  name: string;
  age: number;
  grade: string;
  studentId?: string; // Student ID field
  schoolId: string;
  teacherId?: string;
  parentId?: string;
  avatar?: string;
  lastReport: string;
  emergencyContact?: string;
  medicalInfo?: MedicalInfo | string;
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
  pdfUrl?: string; // URL to generated PDF
}

export type IncidentType =
  | 'injury'
  | 'behavior'
  | 'illness'
  | 'allergic_reaction'
  | 'medication_error'
  | 'environmental'
  | 'lost_child'
  | 'property_damage'
  | 'other';

export type IncidentSeverity = 'minor' | 'moderate' | 'serious' | 'critical';

export type IncidentStatus =
  | 'reported'
  | 'parent_notified'
  | 'acknowledged'
  | 'under_review'
  | 'resolved'
  | 'closed';

export type IncidentNotificationMethod =
  | 'email'
  | 'sms'
  | 'whatsapp'
  | 'push'
  | 'phone'
  | 'in_person';

export interface IncidentInjury {
  _id?: string;
  bodyPart?: string;
  injuryType?: string;
  severity?: IncidentSeverity;
  notes?: string;
}

export interface IncidentStudentInvolved {
  _id?: string;
  studentId:
    | string
    | {
        _id: string;
        firstName: string;
        lastName: string;
        studentGrade?: string;
        studentClass?: string;
        parentEmail?: string;
      };
  role?: 'affected' | 'involved' | 'witness';
  injuries?: IncidentInjury[];
  notes?: string;
}

export interface IncidentWitness {
  _id?: string;
  type?: 'staff' | 'student' | 'parent' | 'visitor' | 'other';
  userId?: string | { _id: string; firstName: string; lastName: string };
  name?: string;
  statement?: string;
}

export interface IncidentParentNotification {
  _id?: string;
  studentId: string | { _id: string; firstName: string; lastName: string };
  parentEmail?: string;
  notifiedAt?: string;
  method: IncidentNotificationMethod;
  notifiedBy?: string | { _id: string; firstName: string; lastName: string };
  deliveryStatus?: 'queued' | 'sent' | 'failed' | 'skipped';
  deliveryError?: string;
  acknowledged?: boolean;
  acknowledgedAt?: string;
  acknowledgmentNotes?: string;
}

export interface IncidentAttachment {
  _id?: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
  uploadedAt?: string;
}

export interface IncidentEditHistoryEntry {
  editedAt: string;
  editedBy?: string | { _id: string; firstName: string; lastName: string };
  summary?: string;
  fieldsChanged?: string[];
}

export interface IncidentReport {
  _id: string;
  schoolId: string;
  reportNumber: string;
  occurredAt: string;
  reportedAt: string;
  reportedBy:
    | string
    | { _id: string; firstName: string; lastName: string; email?: string; role?: string };
  location?: string;
  incidentType: IncidentType;
  severity: IncidentSeverity;
  description: string;
  studentsInvolved: IncidentStudentInvolved[];
  witnesses?: IncidentWitness[];
  immediateAction?: string;
  firstAidGiven?: boolean;
  firstAidDetails?: string;
  emergencyServicesCalled?: boolean;
  emergencyServicesDetails?: string;
  attachments?: IncidentAttachment[];
  parentNotifications?: IncidentParentNotification[];
  status: IncidentStatus;
  followUpRequired?: boolean;
  followUpActions?: string;
  resolvedAt?: string;
  resolvedBy?: string | { _id: string; firstName: string; lastName: string };
  resolutionNotes?: string;
  reviewedBy?: string | { _id: string; firstName: string; lastName: string };
  reviewedAt?: string;
  reviewNotes?: string;
  isLocked?: boolean;
  lockedAt?: string;
  lockedBy?: string | { _id: string; firstName: string; lastName: string };
  editHistory?: IncidentEditHistoryEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface IncidentEnums {
  incidentTypes: IncidentType[];
  severities: IncidentSeverity[];
  statuses: IncidentStatus[];
  notificationMethods: IncidentNotificationMethod[];
}

export interface IncidentStats {
  total: number;
  last30Days: number;
  severityLast30: Partial<Record<IncidentSeverity, number>>;
  typeLast30: Partial<Record<IncidentType, number>>;
  byStatus: Partial<Record<IncidentStatus, number>>;
}

// ─── Meetings types ──────────────────────────────────────────────────

export type MeetingFormat = 'in_person' | 'virtual' | 'phone';
export type AvailabilityStatus = 'published' | 'booked' | 'cancelled';
export type MeetingStatus =
  | 'confirmed'
  | 'cancelled'
  | 'completed'
  | 'no_show'
  | 'rescheduled';

export interface AvailabilitySlot {
  _id: string;
  schoolId: string;
  teacherId:
    | string
    | { _id: string; firstName: string; lastName: string; email?: string; role?: string };
  startsAt: string;
  endsAt: string;
  durationMinutes: number;
  location?: string;
  meetingUrl?: string;
  format: MeetingFormat;
  notes?: string;
  status: AvailabilityStatus;
  meetingId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MeetingReminderEntry {
  type: '24h' | '1h';
  sentAt: string;
  deliveryStatus?: 'queued' | 'sent' | 'failed' | 'skipped';
  deliveryError?: string;
}

export interface Meeting {
  _id: string;
  schoolId: string;
  meetingNumber: string;
  teacherId:
    | string
    | { _id: string; firstName: string; lastName: string; email?: string; photo?: string };
  parentId:
    | string
    | { _id: string; firstName: string; lastName: string; email?: string };
  studentId:
    | string
    | {
        _id: string;
        firstName: string;
        lastName: string;
        studentGrade?: string;
        studentClass?: string;
        parentEmail?: string;
        photo?: string;
      };
  slotId: string;
  startsAt: string;
  endsAt: string;
  location?: string;
  meetingUrl?: string;
  format: MeetingFormat;
  bookingMessage?: string;
  teacherNotes?: string;
  status: MeetingStatus;
  cancelledBy?: string | { _id: string; firstName: string; lastName: string };
  cancelledAt?: string;
  cancellationReason?: string;
  completedAt?: string;
  noShowAt?: string;
  noShowReportedBy?: string | { _id: string; firstName: string; lastName: string };
  rescheduledToMeetingId?: string;
  rescheduledFromMeetingId?: string;
  reminderHistory?: MeetingReminderEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface MeetingStats {
  total: number;
  upcoming30Days: number;
  cancelled: number;
  completed: number;
  noShow: number;
}

export interface AvailabilityListFilters {
  teacherId?: string;
  from?: string;
  to?: string;
  status?: AvailabilityStatus;
  onlyMyTeachers?: boolean;
}

export interface MeetingListFilters {
  status?: MeetingStatus;
  from?: string;
  to?: string;
  teacherId?: string;
  parentId?: string;
  upcoming?: boolean;
}

export interface IncidentListFilters {
  severity?: IncidentSeverity;
  status?: IncidentStatus;
  incidentType?: IncidentType;
  studentId?: string;
  from?: string;
  to?: string;
  limit?: number;
  skip?: number;
}

// ─── Expenses types ──────────────────────────────────────────────────

export type ExpenseCategory =
  | 'salaries'
  | 'rent'
  | 'utilities'
  | 'supplies'
  | 'food'
  | 'transport'
  | 'maintenance'
  | 'software'
  | 'marketing'
  | 'training'
  | 'insurance'
  | 'taxes'
  | 'events'
  | 'fees'
  | 'other';

export type ExpensePaymentMethod =
  | 'cash'
  | 'card'
  | 'bank_transfer'
  | 'cheque'
  | 'e_transfer'
  | 'other';

export type ExpenseTaxType = 'GST' | 'HST' | 'PST' | 'QST' | 'OTHER';

export type ExpenseStatus = 'recorded' | 'void';

export interface ExpenseTax {
  type: ExpenseTaxType;
  rate?: number | null;
  amount: number; // major units (CAD)
}

export interface ExpenseLineItem {
  description: string;
  amount: number; // major units (CAD)
}

export interface ExpenseAttachment {
  _id: string;
  filename: string;
  originalName?: string;
  mimeType?: string;
  size?: number;
  url: string; // auth-gated download path
  isReceipt?: boolean;
  uploadedAt?: string;
  uploadedBy?: string | { _id: string; firstName: string; lastName: string };
}

export interface ExpenseStagedAttachment {
  filename: string;
  originalName?: string;
  mimeType?: string;
  size?: number;
  storagePath: string;
  isReceipt?: boolean;
}

export interface ExpenseEditHistoryEntry {
  editedAt: string;
  editedBy?: string | { _id: string; firstName: string; lastName: string };
  summary?: string;
  fieldsChanged?: string[];
}

export interface ExpenseOcrMeta {
  processed: boolean;
  processedAt?: string;
  model?: string | null;
  confidence?: number | null;
  rawText?: string;
}

export interface Expense {
  _id: string;
  schoolId: string;
  expenseNumber: string;
  incurredAt: string;
  recordedAt: string;
  recordedBy:
    | string
    | { _id: string; firstName: string; lastName: string; email?: string; role?: string };
  category: ExpenseCategory;
  subcategory?: string;
  vendorName?: string;
  description?: string;
  tags?: string[];
  lineItems?: ExpenseLineItem[];
  subtotal: number; // major units
  taxes?: ExpenseTax[];
  taxTotal: number; // major units
  total: number; // major units
  currency: string;
  paymentMethod?: ExpensePaymentMethod;
  paymentReference?: string;
  isPaid?: boolean;
  paidAt?: string;
  attachments?: ExpenseAttachment[];
  ocr?: ExpenseOcrMeta;
  status: ExpenseStatus;
  voidedAt?: string;
  voidedBy?: string | { _id: string; firstName: string; lastName: string };
  voidReason?: string;
  isLocked?: boolean;
  lockedAt?: string;
  lockedBy?: string | { _id: string; firstName: string; lastName: string };
  editHistory?: ExpenseEditHistoryEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface ExpenseEnums {
  categories: ExpenseCategory[];
  paymentMethods: ExpensePaymentMethod[];
  taxTypes: ExpenseTaxType[];
  statuses: ExpenseStatus[];
  currency: string;
  maxAttachments: number;
}

export interface ExpenseStats {
  byStatus: Partial<Record<ExpenseStatus, number>>;
  last30Days: { total: number; count: number };
  monthToDate: { total: number; count: number };
  yearToDate: { total: number; count: number };
  currency: string;
}

export interface ExpenseListFilters {
  status?: ExpenseStatus;
  category?: ExpenseCategory;
  paymentMethod?: ExpensePaymentMethod;
  vendor?: string;
  from?: string;
  to?: string;
  q?: string;
  page?: number;
  limit?: number;
}

export interface ExpenseListResponse {
  data: Expense[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export interface ExpenseOcrResult {
  attachment: ExpenseStagedAttachment;
  parsed: {
    vendorName?: string | null;
    incurredAt?: string | null;
    subtotal?: number | null;
    taxes?: ExpenseTax[];
    total?: number | null;
    currency?: string | null;
    paymentMethod?: ExpensePaymentMethod | null;
    category?: ExpenseCategory | null;
    lineItems?: ExpenseLineItem[];
    confidence?: number | null;
  };
  ocr: ExpenseOcrMeta;
  error?: string;
  warning?: string;
}

export interface CreateExpenseInput {
  incurredAt: string;
  category: ExpenseCategory;
  subcategory?: string;
  vendorName?: string;
  description?: string;
  tags?: string[];
  subtotal: number;
  taxes?: ExpenseTax[];
  total?: number;
  paymentMethod?: ExpensePaymentMethod;
  paymentReference?: string;
  isPaid?: boolean;
  paidAt?: string | null;
  lineItems?: ExpenseLineItem[];
  attachments?: ExpenseStagedAttachment[];
  ocr?: ExpenseOcrMeta;
}

// ─── Phase 2: Reports & Analytics ───────────────────────────────────────

export type ExpenseReportDimension =
  | 'category'
  | 'paymentMethod'
  | 'vendor'
  | 'taxType'
  | 'day'
  | 'week'
  | 'month'
  | 'year';

export interface ExpenseReportSummary {
  range: { from: string | null; to: string | null };
  currency: string;
  total: number;
  subtotal: number;
  taxTotal: number;
  count: number;
  avg: number;
  largest: number;
  paid: { count: number; total: number };
  unpaid: { count: number; total: number };
  statusCounts: Partial<Record<ExpenseStatus, number>>;
}

export interface ExpenseReportRow {
  key: string | null;
  label: string;
  total: number;
  count: number;
  percentage: number;
  /** Only present for time-series dimensions (day/week/month/year). */
  subtotal?: number;
  taxTotal?: number;
  /** Only present for the `vendor` dimension. */
  lastDate?: string;
}

export interface ExpenseReportFilters {
  from?: string;
  to?: string;
  includeVoid?: boolean;
  category?: ExpenseCategory;
  paymentMethod?: ExpensePaymentMethod;
  status?: ExpenseStatus;
}

export interface ExpenseExportFilters extends ExpenseReportFilters {
  format: 'csv' | 'pdf';
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

  // Generic API request method (internal)
  private async _request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    try {
      const url = `${API_BASE_URL}${endpoint}`;
      const response = await fetch(url, {
        ...options,
        headers: {
          ...this.getHeaders(),
          ...options.headers,
        },
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
          error: data.error || data.message || `HTTP ${response.status}: ${response.statusText}`,
        };
      }

      return {
        success: true,
        data: data.data || data,
        message: data.message,
        ...data, // Pass through any additional fields from the API response (e.g., generatedPassword)
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
    return this._request<{ user: User; token: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
  }

  async register(userData: Partial<User> & { password: string }): Promise<ApiResponse<{ user: User; token: string }>> {
    return this._request<{ user: User; token: string }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  }

  async logout(): Promise<ApiResponse<void>> {
    const response = await this.request<void>('/auth/logout', 'POST');
    this.clearToken();
    return response;
  }

  async getCurrentUser(): Promise<ApiResponse<User>> {
    return this._request<User>('/auth/me');
  }

  // School endpoints
  async getSchools(): Promise<ApiResponse<School[]>> {
    return this._request<School[]>('/schools');
  }

  async getSchool(id: string): Promise<ApiResponse<School>> {
    return this._request<School>(`/schools/${id}`);
  }

  async createSchool(schoolData: Partial<School>): Promise<ApiResponse<CreateSchoolResponse>> {
    return this._request<CreateSchoolResponse>('/schools', {
      method: 'POST',
      body: JSON.stringify(schoolData),
    });
  }

  async updateSchool(id: string, schoolData: Partial<School>): Promise<ApiResponse<School>> {
    return this._request<School>(`/schools/${id}`, {
      method: 'PUT',
      body: JSON.stringify(schoolData),
    });
  }

  async deleteSchool(id: string): Promise<ApiResponse<void>> {
    return this._request<void>(`/schools/${id}`, {
      method: 'DELETE',
    });
  }

  async updateSchoolSettings(id: string, settings: any): Promise<ApiResponse<School>> {
    return this._request<School>(`/schools/${id}/settings`, {
      method: 'PUT',
      body: JSON.stringify(settings),
    });
  }

  // User endpoints
  async getUsers(): Promise<ApiResponse<User[]>> {
    return this._request<User[]>('/users');
  }

  async getUser(id: string): Promise<ApiResponse<User>> {
    return this._request<User>(`/users/${id}`);
  }

  async createUser(userData: Partial<User> & { password: string }): Promise<ApiResponse<User>> {
    return this._request<User>('/users', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  }

  async updateUser(id: string, userData: Partial<User>): Promise<ApiResponse<User>> {
    return this._request<User>(`/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(userData),
    });
  }

  async deleteUser(id: string): Promise<ApiResponse<void>> {
    return this._request<void>(`/users/${id}`, {
      method: 'DELETE',
    });
  }

  // Student endpoints
  async getStudents(): Promise<ApiResponse<Student[]>> {
    return this._request<Student[]>('/students');
  }

  async getStudent(id: string): Promise<ApiResponse<Student>> {
    return this._request<Student>(`/students/${id}`);
  }

  async createStudent(studentData: Partial<Student>): Promise<ApiResponse<Student>> {
    return this._request<Student>('/students', {
      method: 'POST',
      body: JSON.stringify(studentData),
    });
  }

  async updateStudent(id: string, studentData: Partial<Student>): Promise<ApiResponse<Student>> {
    return this._request<Student>(`/students/${id}`, {
      method: 'PUT',
      body: JSON.stringify(studentData),
    });
  }

  async deleteStudent(id: string): Promise<ApiResponse<void>> {
    return this._request<void>(`/students/${id}`, {
      method: 'DELETE',
    });
  }

  // Teacher endpoints
  async getTeachers(): Promise<ApiResponse<Teacher[]>> {
    return this._request<Teacher[]>('/teachers');
  }

  async getTeacher(id: string): Promise<ApiResponse<Teacher>> {
    return this._request<Teacher>(`/teachers/${id}`);
  }

  async createTeacher(teacherData: Partial<Teacher>): Promise<ApiResponse<Teacher>> {
    return this._request<Teacher>('/teachers', {
      method: 'POST',
      body: JSON.stringify(teacherData),
    });
  }

  async updateTeacher(id: string, teacherData: Partial<Teacher>): Promise<ApiResponse<Teacher>> {
    return this._request<Teacher>(`/teachers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(teacherData),
    });
  }

  async deleteTeacher(id: string): Promise<ApiResponse<void>> {
    return this._request<void>(`/teachers/${id}`, {
      method: 'DELETE',
    });
  }

  // Class endpoints
  async getClasses(): Promise<ApiResponse<Class[]>> {
    return this._request<Class[]>('/classes');
  }

  async getTeacherAssignedClasses(): Promise<ApiResponse<Class[]>> {
    return this._request<Class[]>('/classes/teacher/assigned');
  }

  async getClass(id: string): Promise<ApiResponse<Class>> {
    return this._request<Class>(`/classes/${id}`);
  }

  async createClass(classData: CreateClassData): Promise<ApiResponse<Class>> {
    return this._request<Class>('/classes', {
      method: 'POST',
      body: JSON.stringify(classData),
    });
  }

  async updateClass(id: string, classData: Partial<CreateClassData>): Promise<ApiResponse<Class>> {
    return this._request<Class>(`/classes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(classData),
    });
  }

  async deleteClass(id: string): Promise<ApiResponse<void>> {
    return this._request<void>(`/classes/${id}`, {
      method: 'DELETE',
    });
  }

  async assignTeacherToClass(classId: string, teacherId: string, role: 'primary' | 'secondary' | 'assistant' = 'primary'): Promise<ApiResponse<Class>> {
    return this._request<Class>(`/classes/${classId}/teachers`, {
      method: 'POST',
      body: JSON.stringify({ teacherId, role }),
    });
  }

  async removeTeacherFromClass(classId: string, teacherId: string): Promise<ApiResponse<Class>> {
    return this._request<Class>(`/classes/${classId}/teachers/${teacherId}`, {
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
    return this._request<{
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
    return this._request<Report[]>(`/reports${queryParam}`);
  }

  // NEW: Get due reports using centralized calculator
  async getDueReports(): Promise<ApiResponse<{
    dueReports: Array<{
      studentId: string;
      studentName: string;
      studentGrade: string;
      studentClass: string;
      templateId: string;
      templateName: string;
      frequency: string;
      dueDate: Date;
      daysOverdue: number;
      reportStatus: string;
      reportId: string | null;
      createdBy: string | null;
      teacherName: string;
      timezone: string;
      calculatedAt: Date;
    }>;
    count: number;
    calculatedAt: Date;
  }>> {
    return this._request<any>('/reports/due');
  }

  // NEW: Check if a specific report can be generated
  async canGenerateReport(studentId: string, templateId: string): Promise<ApiResponse<{
    canGenerate: boolean;
    reason: string;
    existingReport?: any;
  }>> {
    return this._request<any>('/reports/can-generate', {
      method: 'POST',
      body: JSON.stringify({ studentId, templateId }),
    });
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
    return this._request<any>(`/reports/available-templates/${studentId}`);
  }

  async getAllSchoolReports(schoolId: string): Promise<ApiResponse<Report[]>> {
    return this._request<Report[]>(`/schools/${schoolId}/reports`);
  }

  async getReport(id: string): Promise<ApiResponse<Report>> {
    return this._request<Report>(`/reports/${id}`);
  }

  async createReport(reportData: Partial<Report>): Promise<ApiResponse<Report>> {
    return this._request<Report>('/reports', {
      method: 'POST',
      body: JSON.stringify(reportData),
    });
  }

  async updateReport(id: string, reportData: Partial<Report>): Promise<ApiResponse<Report>> {
    return this._request<Report>(`/reports/${id}`, {
      method: 'PUT',
      body: JSON.stringify(reportData),
    });
  }

  async deleteReport(id: string): Promise<ApiResponse<void>> {
    return this._request<void>(`/reports/${id}`, {
      method: 'DELETE',
    });
  }

  async sendReportEmail(reportId: string, parentEmail: string): Promise<ApiResponse<{ reportId: string; emailResult: any }>> {
    return this._request<{ reportId: string; emailResult: any }>(`/reports/${reportId}/send-email`, {
      method: 'POST',
      body: JSON.stringify({ parentEmail }),
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  // Health check
  async healthCheck(): Promise<ApiResponse<{ status: string; timestamp: string }>> {
    return this._request<{ status: string; timestamp: string }>('/health');
  }

  // Generic request method for debug and other endpoints
  async makeRequest<T>(endpoint: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
    return this._request<T>(endpoint, options);
  }

  /**
   * Generic request convenience method.
   *
   * Signature is intentionally backwards-compatible with all existing
   * callsites in the codebase, including the 4-argument form that passes
   * query parameters as the last argument.
   *
   * Examples:
   *   apiService.request('/parent-groups')                              // GET
   *   apiService.request('/events/123', 'DELETE')                       // DELETE
   *   apiService.request('/events', 'POST', { title: 'X' })             // POST + body
   *   apiService.request('/users', 'GET', undefined, { role: 'parent' })// GET + query
   */
  async request<T = any>(
    endpoint: string,
    method: string = 'GET',
    body?: any,
    queryParams?: Record<string, any>
  ): Promise<ApiResponse<T>> {
    let url = endpoint;
    if (queryParams && typeof queryParams === 'object') {
      const params = new URLSearchParams();
      Object.entries(queryParams).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') params.append(k, String(v));
      });
      const qs = params.toString();
      if (qs) url += (endpoint.includes('?') ? '&' : '?') + qs;
    }

    const options: RequestInit = {
      method: method.toUpperCase(),
    };

    if (body !== undefined && method.toUpperCase() !== 'GET') {
      options.body = JSON.stringify(body);
      options.headers = {
        'Content-Type': 'application/json',
      };
    }

    return this.makeRequest<T>(url, options);
  }

  // ─── Incidents API ─────────────────────────────────────────────────

  async getIncidentEnums(): Promise<ApiResponse<IncidentEnums>> {
    return this._request<IncidentEnums>('/incidents/enums');
  }

  async getIncidentStats(): Promise<ApiResponse<IncidentStats>> {
    return this._request<IncidentStats>('/incidents/stats');
  }

  async getIncidents(filters: IncidentListFilters = {}): Promise<ApiResponse<IncidentReport[]>> {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') params.append(k, String(v));
    });
    const qs = params.toString();
    return this._request<IncidentReport[]>(`/incidents${qs ? `?${qs}` : ''}`);
  }

  async getIncident(id: string): Promise<ApiResponse<IncidentReport>> {
    return this._request<IncidentReport>(`/incidents/${id}`);
  }

  async createIncident(data: Partial<IncidentReport>): Promise<ApiResponse<IncidentReport>> {
    return this._request<IncidentReport>('/incidents', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateIncident(
    id: string,
    data: Partial<IncidentReport>
  ): Promise<ApiResponse<IncidentReport>> {
    return this._request<IncidentReport>(`/incidents/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteIncident(id: string): Promise<ApiResponse<{}>> {
    return this._request(`/incidents/${id}`, { method: 'DELETE' });
  }

  async notifyParentsOfIncident(
    id: string,
    methods: IncidentNotificationMethod[] = ['push'],
    note?: string
  ): Promise<ApiResponse<IncidentReport>> {
    return this._request<IncidentReport>(`/incidents/${id}/notify-parents`, {
      method: 'POST',
      body: JSON.stringify({ methods, note }),
    });
  }

  async acknowledgeIncident(
    id: string,
    notes?: string
  ): Promise<ApiResponse<IncidentReport>> {
    return this._request<IncidentReport>(`/incidents/${id}/acknowledge`, {
      method: 'POST',
      body: JSON.stringify({ notes }),
    });
  }

  async resolveIncident(
    id: string,
    resolutionNotes?: string
  ): Promise<ApiResponse<IncidentReport>> {
    return this._request<IncidentReport>(`/incidents/${id}/resolve`, {
      method: 'POST',
      body: JSON.stringify({ resolutionNotes }),
    });
  }

  async reviewIncident(
    id: string,
    reviewNotes?: string
  ): Promise<ApiResponse<IncidentReport>> {
    return this._request<IncidentReport>(`/incidents/${id}/review`, {
      method: 'POST',
      body: JSON.stringify({ reviewNotes }),
    });
  }

  async toggleIncidentLock(
    id: string,
    lock: boolean
  ): Promise<ApiResponse<IncidentReport>> {
    return this._request<IncidentReport>(`/incidents/${id}/lock`, {
      method: 'POST',
      body: JSON.stringify({ lock }),
    });
  }

  /**
   * Upload one or more media files to an incident.
   * Uses raw fetch (with FormData) since `_request` always sets JSON headers.
   */
  async uploadIncidentMedia(
    id: string,
    files: File[]
  ): Promise<ApiResponse<IncidentReport>> {
    try {
      const fd = new FormData();
      for (const f of files) fd.append('media', f);
      const token = this.getToken();
      const res = await fetch(`${API_BASE_URL}/incidents/${id}/media`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: fd,
      });
      const json = await res.json();
      if (!res.ok) {
        return { success: false, error: json.error || json.message || 'Upload failed' };
      }
      return json;
    } catch (err: any) {
      return { success: false, error: err.message || 'Upload failed' };
    }
  }

  // ─── Availability + Meetings API ───────────────────────────────────

  async getAvailability(filters: AvailabilityListFilters = {}): Promise<ApiResponse<AvailabilitySlot[]>> {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') params.append(k, String(v));
    });
    const qs = params.toString();
    return this._request<AvailabilitySlot[]>(`/availability${qs ? `?${qs}` : ''}`);
  }

  async createAvailability(
    data: Partial<AvailabilitySlot> | { slots: Partial<AvailabilitySlot>[] }
  ): Promise<ApiResponse<AvailabilitySlot[]>> {
    return this._request<AvailabilitySlot[]>('/availability', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async deleteAvailability(id: string): Promise<ApiResponse<{}>> {
    return this._request(`/availability/${id}`, { method: 'DELETE' });
  }

  async getMeetings(filters: MeetingListFilters = {}): Promise<ApiResponse<Meeting[]>> {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') params.append(k, String(v));
    });
    const qs = params.toString();
    return this._request<Meeting[]>(`/meetings${qs ? `?${qs}` : ''}`);
  }

  async getMeetingStats(): Promise<ApiResponse<MeetingStats>> {
    return this._request<MeetingStats>('/meetings/stats');
  }

  async getMeeting(id: string): Promise<ApiResponse<Meeting>> {
    return this._request<Meeting>(`/meetings/${id}`);
  }

  async bookMeeting(
    slotId: string,
    studentId: string,
    bookingMessage?: string
  ): Promise<ApiResponse<Meeting>> {
    return this._request<Meeting>('/meetings', {
      method: 'POST',
      body: JSON.stringify({ slotId, studentId, bookingMessage }),
    });
  }

  async cancelMeeting(id: string, reason?: string): Promise<ApiResponse<Meeting>> {
    return this._request<Meeting>(`/meetings/${id}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  }

  async rescheduleMeeting(id: string, newSlotId: string): Promise<ApiResponse<Meeting>> {
    return this._request<Meeting>(`/meetings/${id}/reschedule`, {
      method: 'POST',
      body: JSON.stringify({ newSlotId }),
    });
  }

  async completeMeeting(id: string, teacherNotes?: string): Promise<ApiResponse<Meeting>> {
    return this._request<Meeting>(`/meetings/${id}/complete`, {
      method: 'POST',
      body: JSON.stringify({ teacherNotes }),
    });
  }

  async markMeetingNoShow(id: string, reason?: string): Promise<ApiResponse<Meeting>> {
    return this._request<Meeting>(`/meetings/${id}/no-show`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  }

  // ─── Expenses API ──────────────────────────────────────────────────

  async getExpenseEnums(): Promise<ApiResponse<ExpenseEnums>> {
    return this._request<ExpenseEnums>('/expenses/enums');
  }

  async getExpenseStats(): Promise<ApiResponse<ExpenseStats>> {
    return this._request<ExpenseStats>('/expenses/stats');
  }

  async getExpenses(
    filters: ExpenseListFilters = {}
  ): Promise<ApiResponse<Expense[]> & { pagination?: ExpenseListResponse['pagination'] }> {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') params.append(k, String(v));
    });
    const qs = params.toString();
    return this._request<Expense[]>(`/expenses${qs ? `?${qs}` : ''}`);
  }

  async getExpense(id: string): Promise<ApiResponse<Expense>> {
    return this._request<Expense>(`/expenses/${id}`);
  }

  async createExpense(input: CreateExpenseInput): Promise<ApiResponse<Expense>> {
    return this._request<Expense>('/expenses', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  async updateExpense(id: string, input: Partial<CreateExpenseInput>): Promise<ApiResponse<Expense>> {
    return this._request<Expense>(`/expenses/${id}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    });
  }

  async voidExpense(id: string, reason?: string): Promise<ApiResponse<Expense>> {
    return this._request<Expense>(`/expenses/${id}`, {
      method: 'DELETE',
      body: JSON.stringify({ reason }),
      headers: { 'Content-Type': 'application/json' },
    });
  }

  async toggleExpenseLock(id: string, lock: boolean): Promise<ApiResponse<Expense>> {
    return this._request<Expense>(`/expenses/${id}/lock`, {
      method: 'POST',
      body: JSON.stringify({ lock }),
    });
  }

  /**
   * Upload one or more attachments to an EXISTING expense. Uses raw fetch
   * with FormData (the default _request always sets JSON headers).
   */
  async uploadExpenseAttachments(
    id: string,
    files: File[]
  ): Promise<ApiResponse<Expense>> {
    try {
      const fd = new FormData();
      for (const f of files) fd.append('files', f);
      const token = this.getToken();
      const res = await fetch(`${API_BASE_URL}/expenses/${id}/attachments`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: fd,
      });
      const json = await res.json();
      if (!res.ok) {
        return { success: false, error: json.error || json.message || 'Upload failed' };
      }
      return json;
    } catch (err: any) {
      return { success: false, error: err.message || 'Upload failed' };
    }
  }

  async deleteExpenseAttachment(
    expenseId: string,
    attachmentId: string
  ): Promise<ApiResponse<Expense>> {
    return this._request<Expense>(
      `/expenses/${expenseId}/attachments/${attachmentId}`,
      { method: 'DELETE' }
    );
  }

  /**
   * Upload a single receipt for OCR. Returns parsed data + a *staged*
   * attachment which the form passes back to createExpense() so the file
   * is only saved once (see backend POST /expenses/ocr).
   */
  async ocrReceipt(file: File): Promise<ApiResponse<ExpenseOcrResult>> {
    try {
      const fd = new FormData();
      fd.append('file', file);
      const token = this.getToken();
      const res = await fetch(`${API_BASE_URL}/expenses/ocr`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: fd,
      });
      const json = await res.json();
      if (!res.ok) {
        return { success: false, error: json.error || json.message || 'OCR failed' };
      }
      return json;
    } catch (err: any) {
      return { success: false, error: err.message || 'OCR failed' };
    }
  }

  /**
   * Build the auth-gated URL for a receipt download. Receipts can't be
   * loaded with a plain `<img src>` because the route requires a Bearer
   * token, so callers should fetch via this method which returns a Blob
   * URL the UI can render or open in a new tab.
   */
  async fetchExpenseAttachment(url: string): Promise<string | null> {
    try {
      const token = this.getToken();
      const fullUrl = url.startsWith('http') ? url : url; // path is absolute under /api
      const res = await fetch(fullUrl, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) return null;
      const blob = await res.blob();
      return URL.createObjectURL(blob);
    } catch {
      return null;
    }
  }

  // ─── Phase 2: Reports & Analytics ──────────────────────────────────

  async getExpenseReportSummary(
    filters: ExpenseReportFilters = {}
  ): Promise<ApiResponse<ExpenseReportSummary>> {
    const qs = this._buildQuery(filters);
    return this._request<ExpenseReportSummary>(`/expenses/reports/summary${qs}`);
  }

  async getExpenseReportGroup(
    dimension: ExpenseReportDimension,
    filters: ExpenseReportFilters & { limit?: number } = {}
  ): Promise<ApiResponse<ExpenseReportRow[]>> {
    const qs = this._buildQuery({ ...filters, dimension });
    return this._request<ExpenseReportRow[]>(`/expenses/reports/group${qs}`);
  }

  async getExpenseTopVendors(
    filters: ExpenseReportFilters & { limit?: number } = {}
  ): Promise<ApiResponse<ExpenseReportRow[]>> {
    const qs = this._buildQuery(filters);
    return this._request<ExpenseReportRow[]>(`/expenses/reports/top-vendors${qs}`);
  }

  async getExpenseTaxBreakdown(
    filters: ExpenseReportFilters = {}
  ): Promise<ApiResponse<ExpenseReportRow[]>> {
    const qs = this._buildQuery(filters);
    return this._request<ExpenseReportRow[]>(`/expenses/reports/tax-breakdown${qs}`);
  }

  /**
   * Trigger an Expense report download (CSV or PDF). Returns a Blob URL +
   * a sensible filename so the caller can build an `<a download>` link.
   * The browser downloads the actual file via fetch with the Bearer token,
   * since the `<a>` tag wouldn't carry auth headers.
   */
  async exportExpenses(
    filters: ExpenseExportFilters
  ): Promise<{ success: true; blobUrl: string; filename: string } | { success: false; error: string }> {
    try {
      const qs = this._buildQuery(filters);
      const token = this.getToken();
      const res = await fetch(`${API_BASE_URL}/expenses/export${qs}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        let msg = `Export failed (${res.status})`;
        try {
          const j = await res.json();
          msg = j.error || j.message || msg;
        } catch {
          // ignore — non-JSON body
        }
        return { success: false, error: msg };
      }
      const blob = await res.blob();
      const stamp = new Date().toISOString().slice(0, 10);
      // Pull filename out of Content-Disposition if the server set one
      const cd = res.headers.get('content-disposition') || '';
      const m = /filename="?([^"]+)"?/i.exec(cd);
      const filename =
        m?.[1] || `expenses-${stamp}.${filters.format === 'pdf' ? 'pdf' : 'csv'}`;
      return { success: true, blobUrl: URL.createObjectURL(blob), filename };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Export failed' };
    }
  }

  /**
   * Build a `?key=value&...` query string from a filter object, dropping
   * empty values. Booleans serialize to "1"/"0" so the backend can parse
   * with parseBoolean(). Used by Phase 2 report endpoints.
   */
  private _buildQuery(filters: Record<string, any>): string {
    const params = new URLSearchParams();
    Object.entries(filters || {}).forEach(([k, v]) => {
      if (v === undefined || v === null || v === '') return;
      if (typeof v === 'boolean') {
        params.append(k, v ? '1' : '0');
      } else {
        params.append(k, String(v));
      }
    });
    const qs = params.toString();
    return qs ? `?${qs}` : '';
  }
}

// Export singleton instance
export const apiService = new ApiService();
export default apiService; 