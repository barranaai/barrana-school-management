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
  private apiKey: string | null = null;
  private baseUrl: string = 'https://api.openai.com/v1';

  constructor() {
    // Frontend uses backend API, no direct OpenAI key needed
    this.apiKey = 'backend-api'; // Placeholder to indicate backend usage
    
    console.log('AIService initialized - Using backend API for AI operations');
  }

  // Initialize with API key
  initialize(apiKey: string) {
    this.apiKey = apiKey;
    localStorage.setItem('openai_api_key', apiKey);
    console.log('AIService initialized with API key');
  }

  // Set API key manually (not needed for backend API usage)
  setApiKey(apiKey: string) {
    console.log('AIService: Using backend API, direct API key not required');
  }

  // Voice to Text Transcription
  async transcribeAudio(request: TranscriptionRequest): Promise<AIResponse> {
    // Using backend API, no frontend API key check needed

    try {
      // Create FormData for file upload
      const formData = new FormData();
      formData.append('file', request.audioBlob, 'recording.webm');
      formData.append('model', 'whisper-1');
      formData.append('language', request.language || 'en');
      formData.append('prompt', `This is a teacher's voice note about student ${request.studentName}. Please transcribe it clearly.`);
      
      const response = await fetch(`${this.baseUrl}/audio/transcriptions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: formData
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Transcription failed: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      return {
        success: true,
        data: result.text
      };
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
      const response = await fetch('/api/ai/generate-report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
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
    const configured = !!this.apiKey;
    console.log('AIService.isConfigured() called - Result:', configured);
    console.log('Current apiKey:', this.apiKey ? 'SET' : 'NOT SET');
    return configured;
  }

  // Get API key status
  getApiKeyStatus(): { configured: boolean; source: string } {
    if (process.env.REACT_APP_OPENAI_API_KEY) {
      return { configured: true, source: 'environment' };
    } else if (localStorage.getItem('openai_api_key')) {
      return { configured: true, source: 'localStorage' };
    } else {
      return { configured: false, source: 'none' };
    }
  }

  // Test API connection
  async testConnection(): Promise<AIResponse> {
    if (!this.apiKey) {
      return {
        success: false,
        error: 'API key not configured. Please add your OpenAI API key in settings.'
      };
    }

    try {
      const response = await fetch(`${this.baseUrl}/models`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        }
      });

      if (!response.ok) {
        throw new Error(`API test failed: ${response.statusText}`);
      }

      return {
        success: true,
        data: 'API connection successful'
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'API test failed'
      };
    }
  }

  // Get usage statistics
  async getUsage(): Promise<AIResponse> {
    if (!this.apiKey) {
      return {
        success: false,
        error: 'API key not configured'
      };
    }

    try {
      const response = await fetch(`${this.baseUrl}/usage`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        }
      });

      if (!response.ok) {
        throw new Error(`Usage fetch failed: ${response.statusText}`);
      }

      const result = await response.json();
      return {
        success: true,
        data: result
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Usage fetch failed'
      };
    }
  }

  // Get AI insights for a student
  async getStudentInsights(studentId: string): Promise<AIInsight[]> {
    try {
      const response = await fetch(`${this.baseUrl}/insights/student/${studentId}`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
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