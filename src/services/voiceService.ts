import axios from 'axios';

export interface VoiceRecording {
  id: string;
  studentId: string;
  teacherId: string;
  duration: number;
  fileUrl: string;
  transcription: string;
  status: 'recording' | 'processing' | 'completed' | 'error';
  createdAt: string;
  processedAt?: string;
}

export interface TranscriptionResult {
  transcription: string;
  confidence: number;
  language: string;
  processingTime: number;
}

export interface AIReportData {
  academicProgress: {
    math: number;
    reading: number;
    science: number;
    socialStudies: number;
  };
  socialDevelopment: {
    collaboration: string;
    communication: string;
    leadership: string;
  };
  areasForGrowth: string[];
  recommendations: string[];
  aiModel: string;
  confidence: number;
}

class VoiceService {
  private baseURL = 'http://localhost:5001/api';

  // Start recording
  async startRecording(studentId: string): Promise<VoiceRecording> {
    try {
      const response = await axios.post(`${this.baseURL}/voice/start`, {
        studentId,
        teacherId: 'current-user-id', // This would come from auth context
        timestamp: new Date().toISOString()
      });
      return response.data.data;
    } catch (error) {
      console.error('Error starting recording:', error);
      throw new Error('Failed to start recording');
    }
  }

  // Upload voice recording
  async uploadRecording(audioBlob: Blob, studentId: string): Promise<TranscriptionResult> {
    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.wav');
      formData.append('studentId', studentId);
      formData.append('timestamp', new Date().toISOString());

      const response = await axios.post(`${this.baseURL}/voice/upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      return response.data.data;
    } catch (error) {
      console.error('Error uploading recording:', error);
      throw new Error('Failed to upload recording');
    }
  }

  // Generate AI report from voice recording
  async generateReport(
    studentId: string,
    voiceData: string,
    template: string = 'default'
  ): Promise<AIReportData> {
    try {
      const response = await axios.post(`${this.baseURL}/reports/generate`, {
        studentId,
        voiceData,
        template,
        timestamp: new Date().toISOString()
      });

      return response.data.data;
    } catch (error) {
      console.error('Error generating report:', error);
      throw new Error('Failed to generate report');
    }
  }

  // Get recording history
  async getRecordingHistory(studentId?: string): Promise<VoiceRecording[]> {
    try {
      const params = studentId ? { studentId } : {};
      const response = await axios.get(`${this.baseURL}/voice/history`, { params });
      return response.data.data;
    } catch (error) {
      console.error('Error fetching recording history:', error);
      throw new Error('Failed to fetch recording history');
    }
  }

  // Delete recording
  async deleteRecording(recordingId: string): Promise<void> {
    try {
      await axios.delete(`${this.baseURL}/voice/${recordingId}`);
    } catch (error) {
      console.error('Error deleting recording:', error);
      throw new Error('Failed to delete recording');
    }
  }

  // Get recording analytics
  async getAnalytics(): Promise<{
    totalRecordings: number;
    averageDuration: number;
    processingTime: number;
    accuracyRate: number;
  }> {
    try {
      const response = await axios.get(`${this.baseURL}/voice/analytics`);
      return response.data.data;
    } catch (error) {
      console.error('Error fetching analytics:', error);
      throw new Error('Failed to fetch analytics');
    }
  }
}

export const voiceService = new VoiceService();
export default voiceService; 