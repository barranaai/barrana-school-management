import axios from 'axios';

export interface AnalyticsData {
  students: {
    total: number;
    active: number;
    newThisMonth: number;
    growthRate: number;
  };
  teachers: {
    total: number;
    active: number;
    averageReportsPerTeacher: number;
  };
  reports: {
    total: number;
    thisMonth: number;
    averageGenerationTime: number;
    aiAccuracy: number;
  };
  engagement: {
    parentLoginRate: number;
    averageSessionDuration: number;
    reportViewRate: number;
  };
}

export interface ChartData {
  labels: string[];
  datasets: {
    label: string;
    data: number[];
    backgroundColor?: string;
    borderColor?: string;
    fill?: boolean;
  }[];
}

export interface PerformanceMetrics {
  academicProgress: {
    subject: string;
    averageScore: number;
    improvement: number;
  }[];
  socialDevelopment: {
    skill: string;
    averageRating: string;
    trend: 'improving' | 'stable' | 'declining';
  }[];
  teacherPerformance: {
    teacherId: string;
    teacherName: string;
    reportsGenerated: number;
    averageQuality: number;
    studentSatisfaction: number;
  }[];
}

export interface PredictiveInsights {
  atRiskStudents: {
    studentId: string;
    studentName: string;
    riskFactors: string[];
    confidence: number;
  }[];
  recommendedActions: {
    category: string;
    action: string;
    impact: 'high' | 'medium' | 'low';
    effort: 'high' | 'medium' | 'low';
  }[];
  trends: {
    metric: string;
    currentValue: number;
    predictedValue: number;
    confidence: number;
    timeframe: string;
  }[];
}

class AnalyticsService {
  private baseURL = 'http://localhost:5001/api';

  // Get dashboard analytics
  async getDashboardAnalytics(): Promise<AnalyticsData> {
    try {
      const response = await axios.get(`${this.baseURL}/analytics/dashboard`);
      return response.data.data;
    } catch (error) {
      console.error('Error fetching dashboard analytics:', error);
      // Return empty data structure instead of mock data
      return {
        students: {
          total: 0,
          active: 0,
          newThisMonth: 0,
          growthRate: 0
        },
        teachers: {
          total: 0,
          active: 0,
          averageReportsPerTeacher: 0
        },
        reports: {
          total: 0,
          thisMonth: 0,
          averageGenerationTime: 0,
          aiAccuracy: 0
        },
        engagement: {
          parentLoginRate: 0,
          averageSessionDuration: 0,
          reportViewRate: 0
        }
      };
    }
  }

  // Get chart data for specific metric
  async getChartData(metric: string, timeframe: string = 'month'): Promise<ChartData> {
    try {
      const response = await axios.get(`${this.baseURL}/analytics/chart`, {
        params: { metric, timeframe }
      });
      return response.data.data;
    } catch (error) {
      console.error('Error fetching chart data:', error);
      // Return empty chart data instead of mock data
      return {
        labels: [],
        datasets: [{
          label: metric,
          data: [],
          backgroundColor: 'rgba(25, 118, 210, 0.2)',
          borderColor: 'rgba(25, 118, 210, 1)',
          fill: true
        }]
      };
    }
  }

  // Get performance metrics
  async getPerformanceMetrics(): Promise<PerformanceMetrics> {
    try {
      const response = await axios.get(`${this.baseURL}/analytics/performance`);
      return response.data.data;
    } catch (error) {
      console.error('Error fetching performance metrics:', error);
      // Return empty performance data instead of mock data
      return {
        academicProgress: [],
        socialDevelopment: [],
        teacherPerformance: []
      };
    }
  }

  // Get predictive insights
  async getPredictiveInsights(): Promise<PredictiveInsights> {
    try {
      const response = await axios.get(`${this.baseURL}/analytics/predictive`);
      return response.data.data;
    } catch (error) {
      console.error('Error fetching predictive insights:', error);
      // Return empty predictive data instead of mock data
      return {
        atRiskStudents: [],
        recommendedActions: [],
        trends: []
      };
    }
  }

  // Get comparative analytics
  async getComparativeAnalytics(compareWith: string = 'previous_period'): Promise<{
    current: AnalyticsData;
    comparison: AnalyticsData;
    changes: {
      students: number;
      teachers: number;
      reports: number;
      engagement: number;
    };
  }> {
    try {
      const response = await axios.get(`${this.baseURL}/analytics/comparative`, {
        params: { compareWith }
      });
      return response.data.data;
    } catch (error) {
      console.error('Error fetching comparative analytics:', error);
      throw new Error('Failed to fetch comparative analytics');
    }
  }

  // Export analytics report
  async exportReport(format: 'pdf' | 'excel' | 'csv', filters: any = {}): Promise<Blob> {
    try {
      const response = await axios.post(`${this.baseURL}/analytics/export`, filters, {
        responseType: 'blob',
        params: { format }
      });
      return response.data;
    } catch (error) {
      console.error('Error exporting report:', error);
      throw new Error('Failed to export report');
    }
  }

  // Get real-time analytics
  async getRealTimeAnalytics(): Promise<{
    activeUsers: number;
    currentRecordings: number;
    reportsGeneratedToday: number;
    systemHealth: 'excellent' | 'good' | 'fair' | 'poor';
  }> {
    try {
      const response = await axios.get(`${this.baseURL}/analytics/realtime`);
      return response.data.data;
    } catch (error) {
      console.error('Error fetching real-time analytics:', error);
      // Return empty real-time data instead of mock data
      return {
        activeUsers: 0,
        currentRecordings: 0,
        reportsGeneratedToday: 0,
        systemHealth: 'poor'
      };
    }
  }
}

export const analyticsService = new AnalyticsService();
export default analyticsService; 