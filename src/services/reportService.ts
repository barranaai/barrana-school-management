const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5050/api';

export interface Report {
  _id: string;
  title: string;
  schoolId: string;
  studentId: {
    _id: string;
    firstName: string;
    lastName: string;
    grade: string;
  };
  teacherId: {
    _id: string;
    firstName: string;
    lastName: string;
  };
  templateId: {
    _id: string;
    name: string;
    reportFrequency: string;
  };
  content: string;
  customFieldValues: { [key: string]: any };
  reportType: 'progress' | 'behavior' | 'academic' | 'development' | 'general';
  reportPeriod: {
    startDate: string;
    endDate: string;
  };
  status: 'draft' | 'review' | 'approved' | 'sent' | 'archived';
  voiceRecording?: {
    hasRecording: boolean;
    recordings?: Array<{
      url: string;
      duration: number;
      transcription?: string;
    }>;
    // Legacy fields for backward compatibility
    recordingUrl?: string;
    recordingDuration?: number;
    transcription?: string;
    isTranscribed: boolean;
  };
  aiGenerated?: {
    isAiGenerated: boolean;
    originalTranscription?: string;
    generationModel?: string;
    generationPrompt?: string;
    generatedAt?: string;
  };
  approvals: Array<{
    userId: string;
    role: string;
    status: 'pending' | 'approved' | 'rejected';
    comments?: string;
    approvedAt?: string;
  }>;
  parentCommunication: {
    isSent: boolean;
    sentAt?: string;
    sentTo: Array<{
      parentId?: string;
      email: string;
      method: 'email' | 'portal' | 'both';
    }>;
    isRead: boolean;
    readAt?: string;
    parentFeedback?: string;
  };
  tags: string[];
  categories: string[];
  version: number;
  analytics: {
    viewCount: number;
    lastViewed?: string;
    downloadCount: number;
    shareCount: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface CreateReportData {
  title: string;
  studentId: string;
  templateId: string;
  content: string;
  customFieldValues?: { [key: string]: any };
  reportType?: 'progress' | 'behavior' | 'academic' | 'development' | 'general';
  reportPeriod?: {
    startDate: Date;
    endDate: Date;
  };
  voiceRecording?: {
    hasRecording: boolean;
    recordings?: Array<{
      url: string;
      duration: number;
      transcription?: string;
    }>;
    // Legacy fields for backward compatibility
    recordingUrl?: string;
    recordingDuration?: number;
    transcription?: string;
    isTranscribed: boolean;
  };
  aiGenerated?: {
    isAiGenerated: boolean;
    originalTranscription?: string;
    generationModel?: string;
    generationPrompt?: string;
    generatedAt?: string;
  };
  attachments?: Array<{
    filename: string;
    originalName: string;
    mimeType: string;
    size: number;
    url: string;
    uploadedAt: Date | string;
  }>;
  tags?: string[];
  categories?: string[];
}

export interface DueStatusResponse {
  due: boolean;
  nextDueDate: string | null;
  lastReportDate: string | null;
  timezone: string;
  frequency: string;
  hasExistingReportInPeriod?: boolean;
  existingReportInPeriod?: {
    reportId: string;
    teacherName: string | null;
    createdAt: string;
    status: string;
  } | null;
}

export interface UpdateReportData extends Partial<CreateReportData> {
  id: string;
  status?: 'draft' | 'review' | 'approved' | 'sent' | 'archived';
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  count?: number;
  total?: number;
  page?: number;
  pages?: number;
}

class ReportService {
  private baseUrl = '/reports';

  // Helper function to get headers
  private getHeaders(): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    const token = localStorage.getItem('token');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    return headers;
  }

  // Get all reports
  async getReports(options: {
    schoolId?: string;
    teacherId?: string;
    studentId?: string;
    status?: string;
    limit?: number;
    page?: number;
  } = {}): Promise<ApiResponse<Report[]>> {
    try {
      const queryParams = new URLSearchParams();
      
      Object.entries(options).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          queryParams.append(key, value.toString());
        }
      });

      const url = `${API_BASE_URL}${this.baseUrl}${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: this.getHeaders(),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || `HTTP error! status: ${response.status}`);
      }
      
      return data;
    } catch (error) {
      console.error('Error fetching reports:', error);
      throw error;
    }
  }

  // Get single report
  async getReport(id: string): Promise<ApiResponse<Report>> {
    try {
      const response = await fetch(`${API_BASE_URL}${this.baseUrl}/${id}`, {
        method: 'GET',
        headers: this.getHeaders(),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || `HTTP error! status: ${response.status}`);
      }
      
      return data;
    } catch (error) {
      console.error('Error fetching report:', error);
      throw error;
    }
  }

  // Create new report
  async createReport(data: CreateReportData): Promise<ApiResponse<Report>> {
    try {
      const url = `${API_BASE_URL}${this.baseUrl}`;
      console.log('Creating report at URL:', url);
      console.log('Request headers:', this.getHeaders());
      console.log('Request data:', data);
      
      const response = await fetch(url, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(data),
      });
      
      const responseData = await response.json();
      
      console.log('Response status:', response.status);
      console.log('Response data:', responseData);
      
      if (!response.ok) {
        throw new Error(responseData.message || `HTTP error! status: ${response.status}`);
      }
      
      return responseData;
    } catch (error) {
      console.error('Error creating report:', error);
      throw error;
    }
  }

  // Update report
  async updateReport(data: UpdateReportData): Promise<ApiResponse<Report>> {
    try {
      const { id, ...updateData } = data;
      const response = await fetch(`${API_BASE_URL}${this.baseUrl}/${id}`, {
        method: 'PUT',
        headers: this.getHeaders(),
        body: JSON.stringify(updateData),
      });
      
      const responseData = await response.json();
      
      if (!response.ok) {
        throw new Error(responseData.message || `HTTP error! status: ${response.status}`);
      }
      
      return responseData;
    } catch (error) {
      console.error('Error updating report:', error);
      throw error;
    }
  }

  // Delete report
  async deleteReport(id: string): Promise<ApiResponse<void>> {
    try {
      const response = await fetch(`${API_BASE_URL}${this.baseUrl}/${id}`, {
        method: 'DELETE',
        headers: this.getHeaders(),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || `HTTP error! status: ${response.status}`);
      }
      
      return data;
    } catch (error) {
      console.error('Error deleting report:', error);
      throw error;
    }
  }

  // Approve report
  async approveReport(id: string, comments?: string): Promise<ApiResponse<Report>> {
    try {
      const response = await fetch(`${API_BASE_URL}${this.baseUrl}/${id}/approve`, {
        method: 'PATCH',
        headers: this.getHeaders(),
        body: JSON.stringify({ comments }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || `HTTP error! status: ${response.status}`);
      }
      
      return data;
    } catch (error) {
      console.error('Error approving report:', error);
      throw error;
    }
  }

  // Send report to parents
  async sendReportToParents(id: string, parentEmails: string[]): Promise<ApiResponse<Report>> {
    try {
      // Send email to each parent
      const results = [];
      for (const parentEmail of parentEmails) {
        const response = await fetch(`${API_BASE_URL}${this.baseUrl}/${id}/send-email`, {
          method: 'POST',
          headers: this.getHeaders(),
          body: JSON.stringify({ parentEmail }),
        });
        
        const data = await response.json();
        
        if (!response.ok) {
          throw new Error(data.message || `HTTP error! status: ${response.status}`);
        }
        
        results.push(data);
      }
      
      // Return the last result (they should all be the same)
      return results[results.length - 1];
    } catch (error) {
      console.error('Error sending report:', error);
      throw error;
    }
  }

  // Get reports by teacher
  async getReportsByTeacher(teacherId: string, options: {
    status?: string;
    studentId?: string;
    limit?: number;
    page?: number;
  } = {}): Promise<ApiResponse<Report[]>> {
    try {
      const queryParams = new URLSearchParams();
      
      Object.entries(options).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          queryParams.append(key, value.toString());
        }
      });

      const url = `${API_BASE_URL}${this.baseUrl}/teacher/${teacherId}${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: this.getHeaders(),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || `HTTP error! status: ${response.status}`);
      }
      
      return data;
    } catch (error) {
      console.error('Error fetching teacher reports:', error);
      throw error;
    }
  }

  // Get reports by student
  async getReportsByStudent(studentId: string, options: {
    status?: string;
    limit?: number;
    page?: number;
  } = {}): Promise<ApiResponse<Report[]>> {
    try {
      const queryParams = new URLSearchParams();
      
      Object.entries(options).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          queryParams.append(key, value.toString());
        }
      });

      const url = `${API_BASE_URL}${this.baseUrl}/student/${studentId}${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: this.getHeaders(),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || `HTTP error! status: ${response.status}`);
      }
      
      return data;
    } catch (error) {
      console.error('Error fetching student reports:', error);
      throw error;
    }
  }

  // Validate report data
  validateReportData(data: CreateReportData): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!data.title || data.title.trim().length === 0) {
      errors.push('Report title is required');
    }

    if (!data.studentId || data.studentId.trim().length === 0) {
      errors.push('Student selection is required');
    }

    if (!data.templateId || data.templateId.trim().length === 0) {
      errors.push('Report template is required');
    }

    if (!data.content || data.content.trim().length === 0) {
      errors.push('Report content is required');
    }

    if (data.title && data.title.length > 100) {
      errors.push('Report title cannot exceed 100 characters');
    }

    if (data.content && data.content.length > 10000) {
      errors.push('Report content cannot exceed 10000 characters');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // Helper to format report period for display
  formatReportPeriod(reportPeriod: { startDate: string; endDate: string }): string {
    const start = new Date(reportPeriod.startDate).toLocaleDateString();
    const end = new Date(reportPeriod.endDate).toLocaleDateString();
    return `${start} - ${end}`;
  }

  // Helper to get status color
  getStatusColor(status: string): string {
    switch (status) {
      case 'draft':
        return '#gray';
      case 'review':
        return '#orange';
      case 'approved':
        return '#green';
      case 'sent':
        return '#blue';
      case 'archived':
        return '#purple';
      default:
        return '#gray';
    }
  }

  // Helper to get status label
  getStatusLabel(status: string): string {
    switch (status) {
      case 'draft':
        return 'Draft';
      case 'review':
        return 'Under Review';
      case 'approved':
        return 'Approved';
      case 'sent':
        return 'Sent to Parents';
      case 'archived':
        return 'Archived';
      default:
        return status;
    }
  }

  // Check due status for a specific student and template
  async checkDueStatus(studentId: string, templateId: string): Promise<DueStatusResponse> {
    try {
      const url = `${API_BASE_URL}${this.baseUrl}/due-status?studentId=${encodeURIComponent(studentId)}&templateId=${encodeURIComponent(templateId)}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: this.getHeaders(),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || `HTTP error! status: ${response.status}`);
      }
      
      return data.data;
    } catch (error) {
      console.error('Error checking due status:', error);
      throw error;
    }
  }

  // Check due reports for current teacher and create notifications
  async checkDueReports(): Promise<{ created: number; notifications: any[] }> {
    try {
      const url = `${API_BASE_URL}${this.baseUrl}/check-due`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: this.getHeaders(),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || `HTTP error! status: ${response.status}`);
      }
      
      return data.data;
    } catch (error) {
      console.error('Error checking due reports:', error);
      throw error;
    }
  }
}

export const reportService = new ReportService();