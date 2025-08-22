/**
 * Debug Service for Due Date Calculation Validation
 * Provides functions to compare frontend and backend calculations
 */

import apiService from './apiService';
import { debugCalculations } from '../utils/dueDateCalculations';
import { ReportFrequency } from '../constants/reportFrequencies';

export interface CalculationComparison {
  student: {
    id: string;
    name: string;
    grade: string;
  };
  template: {
    id: string;
    name: string;
    frequency: ReportFrequency;
    grade: string;
  };
  school: {
    id: string;
    name: string;
    timezone?: string;
  };
  lastReport?: {
    id: string;
    createdAt: string;
    status: string;
    teacherName: string;
  } | null;
  backend: {
    timestamp: string;
    timezone: string;
    frequency: ReportFrequency;
    due?: boolean;
    nextDueDate?: string | null;
    lastReportDate?: string | null;
    periodStart?: string;
    calculationSuccess: boolean;
    error?: string | null;
    frequencyConfig?: any;
    workingDays?: any;
    holidaysCount?: number;
  };
  frontend: any;
  differences: Array<{
    field: string;
    backend: any;
    frontend: any;
    severity: 'low' | 'medium' | 'high';
  }>;
}

export interface SchoolSettingsDebug {
  school: {
    id: string;
    name: string;
    timezone?: string;
  };
  currentTime: {
    utc: string;
    schoolTimezone: string;
    timezone: string;
  };
  frequencyAnalysis: {
    [frequency: string]: {
      enabled: boolean;
      configuration: any;
      calculationStatus: 'success' | 'error' | 'not-attempted' | 'no-config';
      nextDueDate?: string;
      error?: string;
    };
  };
  templatesByFrequency: {
    [frequency: string]: Array<{
      id: string;
      name: string;
      grade: string;
    }>;
  };
  settings: {
    calendar?: any;
    reportFrequencies?: any;
  };
}

export interface StudentAssignmentDebug {
  student: {
    id: string;
    name: string;
    grade: string;
    class: string;
    schoolId: string;
    role: string;
  };
  currentUser: {
    id: string;
    role: string;
    canAccessStudent: boolean;
  };
  studentClasses: Array<{
    id: string;
    name: string;
    grade: string;
    assignedTeachers: number;
  }>;
  assignedTeachers: Array<{
    teacherId: string;
    teacherName: string;
    teacherEmail: string;
    className: string;
    classId: string;
    role: string;
  }>;
  applicableTemplates: Array<{
    id: string;
    name: string;
    frequency: ReportFrequency;
    grade: string;
  }>;
  reportsHistory: Array<{
    id: string;
    title: string;
    status: string;
    createdAt: string;
    teacherName: string;
    templateName: string;
    frequency: string;
  }>;
}

export interface AllCalculationsTest {
  summary: {
    totalTemplates: number;
    enabledTemplates: number;
    successfulCalculations: number;
    failedCalculations: number;
    disabledTemplates: number;
  };
  results: Array<{
    templateId: string;
    templateName: string;
    frequency: ReportFrequency;
    grade: string;
    enabled: boolean;
    calculationStatus: 'success' | 'error' | 'not-attempted' | 'disabled';
    nextDueDate?: string;
    periodStart?: string;
    configuration?: any;
    error?: string;
  }>;
  timestamp: string;
  timezone: string;
  school: {
    id: string;
    name: string;
  };
}

class DebugService {
  /**
   * Compare frontend and backend due date calculations
   */
  async compareDueCalculations(
    studentId: string,
    templateId: string,
    schoolSettings: any,
    frequency: ReportFrequency
  ): Promise<CalculationComparison> {
    try {
      // Generate frontend calculations
      const frontendCalculations = debugCalculations(frequency, schoolSettings, studentId, templateId);
      
      // Send to backend for comparison
      const response = await apiService.makeRequest<CalculationComparison>('/debug/due-calculations', {
        method: 'POST',
        body: JSON.stringify({
          studentId,
          templateId,
          frontendCalculations
        }),
      });
      
      if (!response.success) {
        throw new Error(response.message || 'Failed to compare calculations');
      }
      
      return response.data!;
    } catch (error) {
      console.error('Error comparing due calculations:', error);
      throw error;
    }
  }
  
  /**
   * Get school settings and frequency configuration analysis
   */
  async getSchoolSettingsDebug(): Promise<SchoolSettingsDebug> {
    try {
      const response = await apiService.makeRequest<SchoolSettingsDebug>('/debug/school-settings', {
        method: 'GET',
      });
      
      if (!response.success) {
        throw new Error(response.message || 'Failed to get school settings debug');
      }
      
      return response.data!;
    } catch (error) {
      console.error('Error getting school settings debug:', error);
      throw error;
    }
  }
  
  /**
   * Get student assignment and access analysis
   */
  async getStudentAssignmentDebug(studentId: string): Promise<StudentAssignmentDebug> {
    try {
      const response = await apiService.makeRequest<StudentAssignmentDebug>(`/debug/student-assignments/${studentId}`, {
        method: 'GET',
      });
      
      if (!response.success) {
        throw new Error(response.message || 'Failed to get student assignment debug');
      }
      
      return response.data!;
    } catch (error) {
      console.error('Error getting student assignment debug:', error);
      throw error;
    }
  }
  
  /**
   * Test due calculations for all active templates
   */
  async testAllCalculations(): Promise<AllCalculationsTest> {
    try {
      const response = await apiService.makeRequest<AllCalculationsTest>('/debug/test-all-calculations', {
        method: 'POST',
        body: JSON.stringify({}),
      });
      
      if (!response.success) {
        throw new Error(response.message || 'Failed to test all calculations');
      }
      
      return response.data!;
    } catch (error) {
      console.error('Error testing all calculations:', error);
      throw error;
    }
  }
  
  /**
   * Generate a comprehensive debug report
   */
  async generateDebugReport(): Promise<{
    schoolSettings: SchoolSettingsDebug;
    allCalculations: AllCalculationsTest;
    timestamp: string;
  }> {
    try {
      const [schoolSettings, allCalculations] = await Promise.all([
        this.getSchoolSettingsDebug(),
        this.testAllCalculations()
      ]);
      
      return {
        schoolSettings,
        allCalculations,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error generating debug report:', error);
      throw error;
    }
  }
  
  /**
   * Validate a specific student's due reports
   */
  async validateStudentDueReports(
    studentId: string,
    schoolSettings: any
  ): Promise<Array<CalculationComparison & { templateId: string }>> {
    try {
      // Get student assignment info to find applicable templates
      const assignmentInfo = await this.getStudentAssignmentDebug(studentId);
      
      const comparisons = [];
      
      // Compare calculations for each applicable template
      for (const template of assignmentInfo.applicableTemplates) {
        try {
          const comparison = await this.compareDueCalculations(
            studentId,
            template.id,
            schoolSettings,
            template.frequency
          );
          
          comparisons.push({
            ...comparison,
            templateId: template.id
          });
        } catch (error) {
          console.error(`Error comparing calculations for template ${template.id}:`, error);
          // Continue with other templates
        }
      }
      
      return comparisons;
    } catch (error) {
      console.error('Error validating student due reports:', error);
      throw error;
    }
  }
  
  /**
   * Check for inconsistencies in the system
   */
  async checkSystemConsistency(): Promise<{
    issues: Array<{
      type: 'calculation' | 'configuration' | 'access';
      severity: 'low' | 'medium' | 'high';
      description: string;
      details: any;
    }>;
    summary: {
      totalIssues: number;
      highSeverityIssues: number;
      mediumSeverityIssues: number;
      lowSeverityIssues: number;
    };
  }> {
    try {
      const debugReport = await this.generateDebugReport();
      const issues: Array<{
        type: 'calculation' | 'configuration' | 'access';
        severity: 'low' | 'medium' | 'high';
        description: string;
        details: any;
      }> = [];
      
      // Check for configuration issues
      Object.entries(debugReport.schoolSettings.frequencyAnalysis).forEach(([frequency, analysis]) => {
        if (analysis.enabled && analysis.calculationStatus === 'error') {
          issues.push({
            type: 'configuration' as const,
            severity: 'high' as const,
            description: `${frequency} frequency configuration has calculation errors`,
            details: {
              frequency,
              error: analysis.error,
              configuration: analysis.configuration
            }
          });
        }
      });
      
      // Check for templates with disabled frequencies
      Object.entries(debugReport.schoolSettings.templatesByFrequency).forEach(([frequency, templates]) => {
        const frequencyAnalysis = debugReport.schoolSettings.frequencyAnalysis[frequency];
        if (!frequencyAnalysis?.enabled && templates.length > 0) {
          issues.push({
            type: 'configuration' as const,
            severity: 'medium' as const,
            description: `${templates.length} templates use disabled frequency: ${frequency}`,
            details: {
              frequency,
              templates: templates.map(t => t.name),
              frequencyEnabled: frequencyAnalysis?.enabled || false
            }
          });
        }
      });
      
      // Check calculation failures
      const failedCalculations = debugReport.allCalculations.results.filter(r => r.calculationStatus === 'error');
      if (failedCalculations.length > 0) {
        issues.push({
          type: 'calculation' as const,
          severity: 'high' as const,
          description: `${failedCalculations.length} templates have calculation failures`,
          details: {
            failedTemplates: failedCalculations.map(t => ({
              name: t.templateName,
              frequency: t.frequency,
              error: t.error
            }))
          }
        });
      }
      
      const summary = {
        totalIssues: issues.length,
        highSeverityIssues: issues.filter(i => i.severity === 'high').length,
        mediumSeverityIssues: issues.filter(i => i.severity === 'medium').length,
        lowSeverityIssues: issues.filter(i => i.severity === 'low').length
      };
      
      return { issues, summary };
    } catch (error) {
      console.error('Error checking system consistency:', error);
      throw error;
    }
  }
}

export const debugService = new DebugService();
export default debugService;
