/**
 * Frontend Calculation Logging Utility
 * Provides consistent logging for due date calculations on the frontend
 */

export interface CalculationLogEntry {
  operation: string;
  timestamp: string;
  calculationId: string;
  data: any;
}

export interface CalculationPhaseData {
  phase: string;
  studentId: string;
  templateId: string;
  frequency: string;
  [key: string]: any;
}

export interface CalculationResultData {
  studentId: string;
  templateId: string;
  frequency: string;
  result: {
    due?: boolean;
    dueDate?: string;
    periodStart?: string;
    calculationMethod?: string;
  };
  performance: {
    executionTimeMs: number;
    timestamp: string;
  };
}

class CalculationLogger {
  private logs: CalculationLogEntry[] = [];
  private maxLogs = 1000; // Keep last 1000 log entries in memory
  
  /**
   * Generate a unique calculation ID
   */
  private generateCalculationId(): string {
    return `calc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  /**
   * Core logging function
   */
  private log(operation: string, data: any): string {
    const calculationId = this.generateCalculationId();
    const logEntry: CalculationLogEntry = {
      operation,
      timestamp: new Date().toISOString(),
      calculationId,
      data
    };
    
    // Add to memory logs
    this.logs.push(logEntry);
    
    // Keep only the last maxLogs entries
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }
    
    // Console logging with better formatting
    if (process.env.NODE_ENV === 'development') {
      const emoji = this.getOperationEmoji(operation);
      console.group(`${emoji} [Frontend Calculation] ${operation}`);
      console.log('📅 Timestamp:', logEntry.timestamp);
      console.log('🆔 Calculation ID:', calculationId);
      console.log('📊 Data:', data);
      console.groupEnd();
    }
    
    return calculationId;
  }
  
  /**
   * Get emoji for operation type
   */
  private getOperationEmoji(operation: string): string {
    if (operation.includes('error')) return '❌';
    if (operation.includes('result')) return '✅';
    if (operation.includes('phase')) return '🔄';
    if (operation.includes('validation')) return '🔍';
    if (operation.includes('timezone')) return '🌍';
    if (operation.includes('period')) return '📅';
    return '🔍';
  }
  
  /**
   * Log due date calculation start
   */
  logDueDateCalculation(operation: string, data: any): string {
    return this.log(`due-date-${operation}`, data);
  }
  
  /**
   * Log calculation phase
   */
  logCalculationPhase(phase: string, studentId: string, templateId: string, frequency: string, data: any = {}): string {
    return this.log(`calculation-phase-${phase}`, {
      phase,
      studentId,
      templateId,
      frequency,
      ...data
    });
  }
  
  /**
   * Log calculation result
   */
  logCalculationResult(studentId: string, templateId: string, frequency: string, result: any, executionTime: number): string {
    return this.log('calculation-result', {
      studentId,
      templateId,
      frequency,
      result: {
        due: result.due,
        dueDate: result.dueDate?.toISOString?.() || result.dueDate,
        periodStart: result.periodStart?.toISOString?.() || result.periodStart,
        calculationMethod: result.calculationMethod
      },
      performance: {
        executionTimeMs: executionTime,
        timestamp: new Date().toISOString()
      }
    });
  }
  
  /**
   * Log calculation error
   */
  logCalculationError(phase: string, studentId: string, templateId: string, frequency: string, error: Error, context: any = {}): string {
    return this.log(`calculation-error-${phase}`, {
      phase,
      studentId,
      templateId,
      frequency,
      error: {
        message: error.message,
        name: error.name,
        stack: error.stack
      },
      context
    });
  }
  
  /**
   * Log frequency configuration validation
   */
  logFrequencyConfigValidation(frequency: string, schoolId: string, config: any, isValid: boolean, errors: string[] = []): string {
    return this.log('frequency-config-validation', {
      frequency,
      schoolId,
      config,
      validation: {
        isValid,
        errors
      }
    });
  }
  
  /**
   * Log timezone conversion
   */
  logTimezoneConversion(fromTimezone: string, toTimezone: string, originalDate: Date | string, convertedDate: Date | string): string {
    return this.log('timezone-conversion', {
      fromTimezone,
      toTimezone,
      originalDate: originalDate instanceof Date ? originalDate.toISOString() : originalDate,
      convertedDate: convertedDate instanceof Date ? convertedDate.toISOString() : convertedDate,
      conversionValid: !!(originalDate && convertedDate)
    });
  }
  
  /**
   * Log period calculation
   */
  logPeriodCalculation(frequency: string, baseDate: Date | string, periodStart: Date | string, periodEnd: Date | string, method: string): string {
    return this.log('period-calculation', {
      frequency,
      baseDate: baseDate instanceof Date ? baseDate.toISOString() : baseDate,
      periodStart: periodStart instanceof Date ? periodStart.toISOString() : periodStart,
      periodEnd: periodEnd instanceof Date ? periodEnd.toISOString() : periodEnd,
      method
    });
  }
  
  /**
   * Log frontend vs backend comparison
   */
  logComparisonResult(studentId: string, templateId: string, frequency: string, comparison: any): string {
    return this.log('frontend-backend-comparison', {
      studentId,
      templateId,
      frequency,
      comparison: {
        differences: comparison.differences,
        frontend: comparison.frontend,
        backend: comparison.backend,
        hasDiscrepancies: comparison.differences.length > 0
      }
    });
  }
  
  /**
   * Get all logs
   */
  getAllLogs(): CalculationLogEntry[] {
    return [...this.logs];
  }
  
  /**
   * Get logs by operation type
   */
  getLogsByOperation(operationPattern: string): CalculationLogEntry[] {
    return this.logs.filter(log => log.operation.includes(operationPattern));
  }
  
  /**
   * Get logs for specific student/template
   */
  getLogsForStudentTemplate(studentId: string, templateId: string): CalculationLogEntry[] {
    return this.logs.filter(log => 
      log.data.studentId === studentId && log.data.templateId === templateId
    );
  }
  
  /**
   * Get calculation statistics
   */
  getCalculationStats(): {
    totalCalculations: number;
    successfulCalculations: number;
    failedCalculations: number;
    averageExecutionTime: number;
    frequencies: { [key: string]: number };
    recentErrors: CalculationLogEntry[];
  } {
    const resultLogs = this.getLogsByOperation('calculation-result');
    const errorLogs = this.getLogsByOperation('calculation-error');
    
    const executionTimes = resultLogs
      .map(log => log.data.performance?.executionTimeMs)
      .filter(time => typeof time === 'number');
    
    const frequencies: { [key: string]: number } = {};
    resultLogs.forEach(log => {
      const freq = log.data.frequency;
      if (freq) {
        frequencies[freq] = (frequencies[freq] || 0) + 1;
      }
    });
    
    return {
      totalCalculations: resultLogs.length + errorLogs.length,
      successfulCalculations: resultLogs.length,
      failedCalculations: errorLogs.length,
      averageExecutionTime: executionTimes.length > 0 
        ? executionTimes.reduce((a, b) => a + b, 0) / executionTimes.length 
        : 0,
      frequencies,
      recentErrors: errorLogs.slice(-10) // Last 10 errors
    };
  }
  
  /**
   * Clear logs
   */
  clearLogs(): void {
    this.logs = [];
  }
  
  /**
   * Export logs as JSON
   */
  exportLogs(): string {
    return JSON.stringify({
      exportTime: new Date().toISOString(),
      stats: this.getCalculationStats(),
      logs: this.logs
    }, null, 2);
  }
  
  /**
   * Send logs to backend for analysis (if endpoint available)
   */
  async sendLogsToBackend(): Promise<boolean> {
    try {
      const response = await fetch('/api/debug/frontend-logs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          logs: this.logs,
          stats: this.getCalculationStats(),
          timestamp: new Date().toISOString()
        })
      });
      
      return response.ok;
    } catch (error) {
      console.warn('Failed to send logs to backend:', error);
      return false;
    }
  }
}

// Create singleton instance
export const calculationLogger = new CalculationLogger();

// Development helper - expose logger to window for debugging
if (process.env.NODE_ENV === 'development' && typeof window !== 'undefined') {
  (window as any).calculationLogger = calculationLogger;
}

export default calculationLogger;
