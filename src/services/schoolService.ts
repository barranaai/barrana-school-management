import apiService from './apiService';

export interface SchoolSettings {
  timezone?: string;
  calendar?: {
    schoolYear: {
      startMonth: number;
      startDay: number;
      endMonth: number;
      endDay: number;
    };
    holidays: Array<{
      name: string;
      date: Date;
      isRecurring: boolean;
      description?: string;
    }>;
    workingDays: {
      monday: boolean;
      tuesday: boolean;
      wednesday: boolean;
      thursday: boolean;
      friday: boolean;
      saturday: boolean;
      sunday: boolean;
    };
  };
  reportFrequencies?: {
    [frequency: string]: {
      enabled: boolean;
      dueDay: number;
      dueTime: string;
      skipWeekends: boolean;
      skipHolidays: boolean;
    };
  };
}

class SchoolService {
  private baseURL: string;

  constructor() {
    this.baseURL = process.env.REACT_APP_API_URL || 'http://localhost:5050/api';
  }

  /**
   * Update school settings
   * @param schoolId - School ID
   * @param settings - Settings to update
   * @returns Promise with update result
   */
  async updateSchoolSettings(schoolId: string, settings: SchoolSettings): Promise<{
    success: boolean;
    message?: string;
    data?: any;
    error?: string;
  }> {
    try {
      const response = await apiService.updateSchoolSettings(schoolId, settings);
      
      if (response.success) {
        return {
          success: true,
          message: response.message || 'School settings updated successfully',
          data: response.data
        };
      } else {
        return {
          success: false,
          error: response.message || 'Failed to update school settings'
        };
      }
    } catch (error: any) {
      console.error('Error updating school settings:', error);
      return {
        success: false,
        error: error.response?.data?.message || error.message || 'Failed to update school settings'
      };
    }
  }

  /**
   * Get school settings
   * @param schoolId - School ID
   * @returns Promise with school data including settings
   */
  async getSchoolSettings(schoolId: string): Promise<{
    success: boolean;
    data?: any;
    error?: string;
  }> {
    try {
      const response = await apiService.getSchool(schoolId);
      
      if (response.success) {
        return {
          success: true,
          data: response.data
        };
      } else {
        return {
          success: false,
          error: response.message || 'Failed to fetch school settings'
        };
      }
    } catch (error: any) {
      console.error('Error fetching school settings:', error);
      return {
        success: false,
        error: error.response?.data?.message || error.message || 'Failed to fetch school settings'
      };
    }
  }

  /**
   * Validate school settings
   * @param settings - Settings to validate
   * @returns Validation result
   */
  validateSchoolSettings(settings: SchoolSettings): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    // Validate timezone
    if (settings.timezone && !this.isValidTimezone(settings.timezone)) {
      errors.push('Invalid timezone');
    }

    // Validate calendar
    if (settings.calendar) {
      const { schoolYear, workingDays } = settings.calendar;

      if (schoolYear) {
        if (schoolYear.startMonth < 1 || schoolYear.startMonth > 12) {
          errors.push('Invalid school year start month');
        }
        if (schoolYear.startDay < 1 || schoolYear.startDay > 31) {
          errors.push('Invalid school year start day');
        }
        if (schoolYear.endMonth < 1 || schoolYear.endMonth > 12) {
          errors.push('Invalid school year end month');
        }
        if (schoolYear.endDay < 1 || schoolYear.endDay > 31) {
          errors.push('Invalid school year end day');
        }
      }

      if (workingDays) {
        const hasWorkingDays = Object.values(workingDays).some(day => day);
        if (!hasWorkingDays) {
          errors.push('At least one working day must be selected');
        }
      }
    }

    // Validate report frequencies
    if (settings.reportFrequencies) {
      Object.entries(settings.reportFrequencies).forEach(([frequency, config]) => {
        if (config.enabled) {
          if (config.dueDay < 1 || config.dueDay > 31) {
            errors.push(`Invalid due day for ${frequency}`);
          }
          if (!this.isValidTime(config.dueTime)) {
            errors.push(`Invalid due time for ${frequency}`);
          }
        }
      });
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Check if timezone is valid
   * @param timezone - Timezone to validate
   * @returns True if valid
   */
  private isValidTimezone(timezone: string): boolean {
    try {
      // Check if it's a valid timezone by trying to create a date with it
      Intl.DateTimeFormat('en', { timeZone: timezone });
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Check if time is valid (HH:MM format)
   * @param time - Time to validate
   * @returns True if valid
   */
  private isValidTime(time: string): boolean {
    const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
    return timeRegex.test(time);
  }
}

export const schoolService = new SchoolService();
