// AI Service for Barrana.ai
// This service handles voice-to-text transcription and AI report generation

export interface TranscriptionRequest {
  audioBlob: Blob;
  language?: string;
  studentName?: string;
}

export interface ReportGenerationRequest {
  transcription: string;
  studentName: string;
  grade: string;
  template?: string;
  templateId?: string; // ID of the report template for dynamic prompts
}

export interface AIResponse {
  success: boolean;
  data?: any;
  error?: string;
}

export interface AIInsight {
  id: string;
  type: 'academic' | 'behavioral' | 'social' | 'recommendation';
  title: string;
  description: string;
  confidence: number;
  studentId: string;
  createdAt: Date;
  actionable: boolean;
  priority: 'low' | 'medium' | 'high';
}

class AIService {
  private baseUrl: string = '/api/ai';

  private authHeaders(): Record<string, string> {
    const token = localStorage.getItem('token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  constructor() {
    // Frontend uses backend API, no direct OpenAI key needed
    localStorage.removeItem('openai_api_key');
    console.log('AIService initialized - Using backend API for AI operations');
  }

  // Initialize with API key
  initialize(_apiKey?: string) {
    // Browser-side provider keys are intentionally ignored.
  }

  // Set API key manually (not needed for backend API usage)
  setApiKey(_apiKey?: string) {
    console.log('AIService: Using backend API, direct API key not required');
  }

  // Voice to Text Transcription
  async transcribeAudio(request: TranscriptionRequest): Promise<AIResponse> {
    try {
      console.log('🎤 Starting transcription via backend API...');
      
      // Create FormData for file upload to backend
      const formData = new FormData();
      formData.append('audio', request.audioBlob, 'recording.webm');
      formData.append('language', request.language || 'en');
      if (request.studentName) {
        formData.append('studentName', request.studentName);
      }
      
      // Use backend API endpoint instead of calling OpenAI directly
      const response = await fetch(`${this.baseUrl}/process-voice`, {
        method: 'POST',
        headers: this.authHeaders(),
        body: formData
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Transcription API error:', errorText);
        throw new Error(`Transcription failed: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      
      if (result.success && result.data) {
        console.log('✅ Transcription successful:', result.data.transcription);
        return {
          success: true,
          data: result.data.transcription
        };
      } else {
        throw new Error(result.message || 'Transcription failed');
      }
    } catch (error) {
      console.error('Transcription error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Transcription failed'
      };
    }
  }

  // AI Report Generation
  async generateReport(request: ReportGenerationRequest): Promise<AIResponse> {
    try {
      console.log('🤖 Web AI Report Generation Request:', request);
      
      // Use the backend API endpoint instead of calling OpenAI directly
      const response = await fetch(`${this.baseUrl}/generate-report`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.authHeaders(),
        },
        body: JSON.stringify({
          transcription: request.transcription,
          studentName: request.studentName,
          grade: request.grade,
          template: request.template || 'standard',
          templateId: request.templateId, // Pass templateId for dynamic prompts
          timestamp: new Date().toISOString()
        })
      });

      if (!response.ok) {
        throw new Error(`Report generation failed: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (result.success && result.data) {
        return {
          success: true,
          data: result.data
        };
      } else {
        throw new Error(result.message || 'Report generation failed');
      }
    } catch (error) {
      console.error('Error generating report:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Report generation failed'
      };
    }
  }



  // Convert blob to base64
  private async blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(',')[1]); // Remove data URL prefix
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  // Check if API key is configured
  isConfigured(): boolean {
    return true;
  }

  // Get API key status
  getApiKeyStatus(): { configured: boolean; source: string } {
    return { configured: true, source: 'backend' };
  }

  // Test API connection
  async testConnection(): Promise<AIResponse> {
    return { success: true, data: 'AI requests are handled by the backend' };
  }

  // Get usage statistics
  async getUsage(): Promise<AIResponse> {
    return { success: false, error: 'Provider usage is not exposed to the browser' };
  }

  // Get AI insights for a student
  async getStudentInsights(studentId: string): Promise<AIInsight[]> {
    try {
      const response = await fetch(`${this.baseUrl}/insights?studentId=${encodeURIComponent(studentId)}`, {
        headers: {
          'Content-Type': 'application/json',
          ...this.authHeaders(),
        }
      });

      if (!response.ok) {
        throw new Error(`Insights fetch failed: ${response.statusText}`);
      }

      const result = await response.json();
      return result.data || [];
    } catch (error) {
      console.error('Error fetching student insights:', error);
      return [];
    }
  }
}

// Export singleton instance
export const aiService = new AIService();
export default aiService; 
