import { REPORT_FREQUENCIES, type ReportFrequency } from '../constants/reportFrequencies';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5050/api';

export interface ReportTemplate {
  _id: string;
  name: string;
  schoolId: string;
  grade: string;

  reportFrequency: ReportFrequency;
  content?: string;
  aiPrompt?: string;
  customFields?: Array<{
    name: string;
    type: 'text' | 'rating' | 'percentage' | 'checkbox';
    isRequired: boolean;
    options?: string[];
    defaultValue?: string;
  }>;
  settings?: {
    includeStudentPhoto: boolean;
    includeTeacherSignature: boolean;
    includeSchoolLogo: boolean;
    autoSendToParents: boolean;
    requireTeacherApproval: boolean;
  };
  isActive: boolean;
  createdBy: {
    _id: string;
    firstName: string;
    lastName: string;
  };
  lastModified: string;
  usage?: {
    totalReportsGenerated: number;
    lastUsed?: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface CreateReportTemplateData {
  name: string;
  grade: string;

  reportFrequency: ReportFrequency;
  content?: string;
  aiPrompt?: string;
  schoolId?: string;
  customFields?: Array<{
    name: string;
    type: 'text' | 'rating' | 'percentage' | 'checkbox';
    isRequired: boolean;
    options?: string[];
    defaultValue?: string;
  }>;
  settings?: {
    includeStudentPhoto: boolean;
    includeTeacherSignature: boolean;
    includeSchoolLogo: boolean;
    autoSendToParents: boolean;
    requireTeacherApproval: boolean;
  };
  isActive?: boolean;
}

export interface UpdateReportTemplateData extends Partial<CreateReportTemplateData> {
  id: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  count?: number;
}

class ReportTemplateService {
  private baseUrl = '/report-templates';

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

  // Get all report templates
  async getReportTemplates(schoolId?: string): Promise<ApiResponse<ReportTemplate[]>> {
    try {
      console.log('🔍 ReportTemplateService.getReportTemplates called');
      console.log('🏫 SchoolId parameter:', schoolId);
      
      const url = schoolId ? `${this.baseUrl}?schoolId=${schoolId}` : this.baseUrl;
      const fullUrl = `${API_BASE_URL}${url}`;
      console.log('🌐 Full URL:', fullUrl);
      
      const headers = this.getHeaders();
      console.log('🔑 Headers:', headers);
      
      const response = await fetch(fullUrl, {
        method: 'GET',
        headers: headers,
      });
      console.log('📡 Response status:', response.status);
      console.log('📡 Response ok:', response.ok);
      
      const data = await response.json();
      console.log('📡 Response data:', data);
      
      if (!response.ok) {
        console.log('❌ HTTP error:', response.status, data.message);
        throw new Error(data.message || `HTTP error! status: ${response.status}`);
      }
      
      console.log('✅ ReportTemplateService.getReportTemplates successful');
      return data;
    } catch (error) {
      console.error('Error fetching report templates:', error);
      throw error;
    }
  }

  // Get single report template
  async getReportTemplate(id: string): Promise<ApiResponse<ReportTemplate>> {
    try {
      const response = await fetch(`${API_BASE_URL}${this.baseUrl}/${id}`, {
        method: 'GET',
        headers: this.getHeaders(),
      });
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching report template:', error);
      throw error;
    }
  }

  // Create new report template
  async createReportTemplate(data: CreateReportTemplateData): Promise<ApiResponse<ReportTemplate>> {
    try {
      console.log('🐛 createReportTemplate - Input data:', data);
      console.log('🐛 createReportTemplate - URL:', `${API_BASE_URL}${this.baseUrl}`);
      console.log('🐛 createReportTemplate - Headers:', this.getHeaders());
      console.log('🐛 createReportTemplate - Body:', JSON.stringify(data));
      
      const response = await fetch(`${API_BASE_URL}${this.baseUrl}`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(data),
      });
      
      console.log('🐛 createReportTemplate - Response status:', response.status);
      console.log('🐛 createReportTemplate - Response ok:', response.ok);
      
      const responseData = await response.json();
      console.log('🐛 createReportTemplate - Response data:', responseData);
      
      return responseData;
    } catch (error) {
      console.error('🐛 createReportTemplate - Error:', error);
      throw error;
    }
  }

  // Update report template
  async updateReportTemplate(data: UpdateReportTemplateData): Promise<ApiResponse<ReportTemplate>> {
    try {
      const { id, ...updateData } = data;
      const response = await fetch(`${API_BASE_URL}${this.baseUrl}/${id}`, {
        method: 'PUT',
        headers: this.getHeaders(),
        body: JSON.stringify(updateData),
      });
      const responseData = await response.json();
      return responseData;
    } catch (error) {
      console.error('Error updating report template:', error);
      throw error;
    }
  }

  // Delete report template
  async deleteReportTemplate(id: string): Promise<ApiResponse<void>> {
    try {
      const response = await fetch(`${API_BASE_URL}${this.baseUrl}/${id}`, {
        method: 'DELETE',
        headers: this.getHeaders(),
      });
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error deleting report template:', error);
      throw error;
    }
  }

  // Get templates by grade
  async getTemplatesByGrade(grade: string): Promise<ApiResponse<ReportTemplate[]>> {
    try {
      const response = await fetch(`${API_BASE_URL}${this.baseUrl}/grade/${encodeURIComponent(grade)}`, {
        method: 'GET',
        headers: this.getHeaders(),
      });
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching templates by grade:', error);
      throw error;
    }
  }

  // Get templates by frequency
  async getTemplatesByFrequency(frequency: ReportFrequency): Promise<ApiResponse<ReportTemplate[]>> {
    try {
      const response = await fetch(`${API_BASE_URL}${this.baseUrl}/frequency/${encodeURIComponent(frequency)}`, {
        method: 'GET',
        headers: this.getHeaders(),
      });
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching templates by frequency:', error);
      throw error;
    }
  }

  // Toggle template active status
  async toggleTemplateStatus(id: string): Promise<ApiResponse<ReportTemplate>> {
    try {
      const response = await fetch(`${API_BASE_URL}${this.baseUrl}/${id}/toggle`, {
        method: 'PATCH',
        headers: this.getHeaders(),
      });
      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error toggling template status:', error);
      throw error;
    }
  }

  // Validate template data
  validateTemplateData(data: CreateReportTemplateData): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!data.name || data.name.trim().length === 0) {
      errors.push('Template name is required');
    }

    if (!data.grade || data.grade.trim().length === 0) {
      errors.push('Grade is required');
    }

    if (!data.reportFrequency || !REPORT_FREQUENCIES.includes(data.reportFrequency)) {
      errors.push('Valid report frequency is required');
    }

    // standards and aiPrompt are optional

    return {
      isValid: errors.length === 0,
      errors
    };
  }



  // Get frequency options
  getFrequencyOptions(): ReportFrequency[] {
    return [...REPORT_FREQUENCIES];
  }

  // Get default template settings
  getDefaultSettings() {
    return {
      includeStudentPhoto: true,
      includeTeacherSignature: true,
      includeSchoolLogo: true,
      autoSendToParents: false,
      requireTeacherApproval: true
    };
  }
}

export const reportTemplateService = new ReportTemplateService(); 