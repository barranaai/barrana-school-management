/**
 * Unit Tests for Due Date Calculations
 * Tests the shared calculation utilities for consistency and correctness
 */

import moment from 'moment-timezone';
import {
  calculateDueDate,
  isReportDue,
  getStartOfFrequencyPeriod,
  convertWorkingDaysToArray,
  isHoliday,
  isWeekend,
  getNextWorkingDay
} from '../dueDateCalculations';
import { ReportFrequency } from '../../constants/reportFrequencies';

// Mock the calculation logger to avoid console spam in tests
jest.mock('../calculationLogger', () => ({
  calculationLogger: {
    logCalculationPhase: jest.fn(),
    logCalculationResult: jest.fn(),
    logCalculationError: jest.fn(),
    logFrequencyConfigValidation: jest.fn(),
    logTimezoneConversion: jest.fn(),
    logPeriodCalculation: jest.fn(),
  }
}));

// Mock the cache to avoid side effects
jest.mock('../dueDateCache', () => ({
  dueDateCache: {
    get: jest.fn(() => null),
    set: jest.fn(),
  }
}));

describe('Due Date Calculations', () => {
  const mockSchoolSettings = {
    timezone: 'America/New_York',
    reportFrequencies: {
      Daily: {
        enabled: true,
        workingDays: [1, 2, 3, 4, 5], // Mon-Fri
        dueTime: '17:00',
        skipWeekends: true,
        skipHolidays: false
      },
      Weekly: {
        enabled: true,
        dueDay: 5, // Friday
        dueTime: '17:00'
      },
      Monthly: {
        enabled: true,
        rule: 'lastWorkingDay',
        dueTime: '17:00'
      },
      Quarterly: {
        enabled: true,
        quarters: {
          q1: { enabled: true, month: 3, day: 31 }, // March 31
          q2: { enabled: true, month: 6, day: 30 }, // June 30
          q3: { enabled: true, month: 9, day: 30 }, // September 30
          q4: { enabled: true, month: 12, day: 31 } // December 31
        },
        dueTime: '17:00'
      }
    },
    calendar: {
      workingDays: {
        monday: true,
        tuesday: true,
        wednesday: true,
        thursday: true,
        friday: true,
        saturday: false,
        sunday: false
      },
      holidays: [
        {
          name: 'Christmas',
          date: '2024-12-25',
          isRecurring: true
        },
        {
          name: 'New Year',
          date: '2024-01-01',
          isRecurring: true
        }
      ]
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('convertWorkingDaysToArray', () => {
    it('should convert working days object to array format', () => {
      const workingDays = {
        monday: true,
        tuesday: true,
        wednesday: true,
        thursday: true,
        friday: true,
        saturday: false,
        sunday: false
      };

      const result = convertWorkingDaysToArray(workingDays);
      expect(result).toEqual([1, 2, 3, 4, 5]);
    });

    it('should handle array input', () => {
      const workingDays = [1, 2, 3, 4, 5];
      const result = convertWorkingDaysToArray(workingDays);
      expect(result).toEqual([1, 2, 3, 4, 5]);
    });

    it('should return default working days for invalid input', () => {
      const result = convertWorkingDaysToArray(null);
      expect(result).toEqual([1, 2, 3, 4, 5]);
    });
  });

  describe('isHoliday', () => {
    const holidays = [
      {
        name: 'Christmas',
        date: '2024-12-25',
        isRecurring: true
      },
      {
        name: 'Independence Day 2024',
        date: '2024-07-04',
        isRecurring: false
      }
    ];

    it('should detect recurring holidays', () => {
      const christmasDate = moment('2025-12-25');
      expect(isHoliday(christmasDate, holidays)).toBe(true);
    });

    it('should detect non-recurring holidays', () => {
      const independenceDay = moment('2024-07-04');
      expect(isHoliday(independenceDay, holidays)).toBe(true);
    });

    it('should not detect non-recurring holidays in different years', () => {
      const independenceDay2025 = moment('2025-07-04');
      expect(isHoliday(independenceDay2025, holidays)).toBe(false);
    });

    it('should return false for non-holiday dates', () => {
      const regularDate = moment('2024-06-15');
      expect(isHoliday(regularDate, holidays)).toBe(false);
    });
  });

  describe('isWeekend', () => {
    const workingDays = [1, 2, 3, 4, 5]; // Mon-Fri

    it('should detect Saturday as weekend', () => {
      const saturday = moment('2024-06-15'); // Saturday
      expect(isWeekend(saturday, workingDays)).toBe(true);
    });

    it('should detect Sunday as weekend', () => {
      const sunday = moment('2024-06-16'); // Sunday
      expect(isWeekend(sunday, workingDays)).toBe(true);
    });

    it('should not detect weekdays as weekend', () => {
      const monday = moment('2024-06-17'); // Monday
      expect(isWeekend(monday, workingDays)).toBe(false);
    });
  });

  describe('getNextWorkingDay', () => {
    const workingDays = [1, 2, 3, 4, 5];
    const holidays: any[] = [];

    it('should find next working day after weekend', () => {
      const saturday = moment('2024-06-15'); // Saturday
      const nextWorkingDay = getNextWorkingDay(saturday, workingDays, holidays);
      expect(nextWorkingDay.day()).toBe(1); // Monday
    });

    it('should find next working day after holiday', () => {
      const holidaysWithChristmas = [{
        name: 'Christmas',
        date: '2024-12-25',
        isRecurring: false
      }];
      
      const christmas = moment('2024-12-25'); // Wednesday (Christmas)
      const nextWorkingDay = getNextWorkingDay(christmas, workingDays, holidaysWithChristmas);
      expect(nextWorkingDay.format('YYYY-MM-DD')).toBe('2024-12-26');
    });
  });

  describe('calculateDueDate', () => {
    describe('Daily frequency', () => {
      it('should calculate due date for daily reports on working day', () => {
        const baseDate = moment.tz('2024-06-17 10:00', 'America/New_York'); // Monday
        const result = calculateDueDate('Daily', mockSchoolSettings, baseDate);

        expect(result.frequency).toBe('Daily');
        expect(result.calculationMethod).toBe('working-days');
        expect(result.dueDate.hour()).toBe(17);
        expect(result.dueDate.minute()).toBe(0);
      });

      it('should move to next working day if starting on weekend', () => {
        const baseDate = moment.tz('2024-06-15 10:00', 'America/New_York'); // Saturday
        const result = calculateDueDate('Daily', mockSchoolSettings, baseDate);

        expect(result.dueDate.day()).toBe(1); // Should be Monday
      });
    });

    describe('Weekly frequency', () => {
      it('should calculate due date for weekly reports', () => {
        const baseDate = moment.tz('2024-06-17 10:00', 'America/New_York'); // Monday
        const result = calculateDueDate('Weekly', mockSchoolSettings, baseDate);

        expect(result.frequency).toBe('Weekly');
        expect(result.calculationMethod).toBe('weekly-target-day');
        expect(result.dueDate.day()).toBe(5); // Friday
        expect(result.dueDate.hour()).toBe(17);
      });

      it('should move to next week if already past due day', () => {
        const baseDate = moment.tz('2024-06-21 18:00', 'America/New_York'); // Friday 6 PM (past due time)
        const result = calculateDueDate('Weekly', mockSchoolSettings, baseDate);

        expect(result.dueDate.isAfter(baseDate)).toBe(true);
        expect(result.dueDate.day()).toBe(5); // Friday of next week
      });
    });

    describe('Monthly frequency', () => {
      it('should calculate due date for monthly reports', () => {
        const baseDate = moment.tz('2024-06-15 10:00', 'America/New_York');
        const result = calculateDueDate('Monthly', mockSchoolSettings, baseDate);

        expect(result.frequency).toBe('Monthly');
        expect(result.calculationMethod).toBe('monthly-rule');
        expect(result.dueDate.date()).toBeGreaterThan(25); // Should be near end of month
      });
    });

    describe('Quarterly frequency', () => {
      it('should calculate due date for quarterly reports', () => {
        const baseDate = moment.tz('2024-02-15 10:00', 'America/New_York'); // February
        const result = calculateDueDate('Quarterly', mockSchoolSettings, baseDate);

        expect(result.frequency).toBe('Quarterly');
        expect(result.calculationMethod).toBe('quarterly-periods');
        expect(result.dueDate.month()).toBe(2); // March (0-indexed)
        expect(result.dueDate.date()).toBe(31);
      });
    });

    describe('Error handling', () => {
      it('should throw error for disabled frequency', () => {
        const settingsWithDisabledFrequency = {
          ...mockSchoolSettings,
          reportFrequencies: {
            Daily: {
              enabled: false
            }
          }
        };

        expect(() => {
          calculateDueDate('Daily', settingsWithDisabledFrequency);
        }).toThrow('Frequency Daily is not enabled for this school');
      });

      it('should throw error for missing frequency config', () => {
        const settingsWithoutFrequency = {
          ...mockSchoolSettings,
          reportFrequencies: {}
        };

        expect(() => {
          calculateDueDate('Daily', settingsWithoutFrequency);
        }).toThrow('Frequency Daily is not enabled for this school');
      });

      it('should throw error for unsupported frequency', () => {
        expect(() => {
          calculateDueDate('Hourly' as ReportFrequency, mockSchoolSettings);
        }).toThrow('Unsupported frequency: Hourly');
      });
    });
  });

  describe('getStartOfFrequencyPeriod', () => {
    it('should return start of day for daily frequency', () => {
      const currentDate = moment.tz('2024-06-17 15:30', 'America/New_York');
      const result = getStartOfFrequencyPeriod('Daily', mockSchoolSettings, currentDate);

      expect(result.hour()).toBe(0);
      expect(result.minute()).toBe(0);
      expect(result.date()).toBe(17);
    });

    it('should return start of week for weekly frequency', () => {
      const currentDate = moment.tz('2024-06-19 15:30', 'America/New_York'); // Wednesday
      const result = getStartOfFrequencyPeriod('Weekly', mockSchoolSettings, currentDate);

      expect(result.day()).toBe(1); // Monday
      expect(result.hour()).toBe(0);
    });

    it('should return start of month for monthly frequency', () => {
      const currentDate = moment.tz('2024-06-17 15:30', 'America/New_York');
      const result = getStartOfFrequencyPeriod('Monthly', mockSchoolSettings, currentDate);

      expect(result.date()).toBe(1);
      expect(result.hour()).toBe(0);
      expect(result.month()).toBe(5); // June (0-indexed)
    });
  });

  describe('isReportDue', () => {
    it('should return true when report is due', () => {
      const lastReportDate = moment.tz('2024-06-10', 'America/New_York').toDate();
      const currentDate = moment.tz('2024-06-17 18:00', 'America/New_York'); // Monday 6 PM

      const result = isReportDue('Daily', mockSchoolSettings, lastReportDate, currentDate);
      expect(result).toBe(true);
    });

    it('should return false when report is not due', () => {
      const lastReportDate = moment.tz('2024-06-17 16:00', 'America/New_York').toDate(); // Today 4 PM
      const currentDate = moment.tz('2024-06-17 16:30', 'America/New_York'); // Today 4:30 PM

      const result = isReportDue('Daily', mockSchoolSettings, lastReportDate, currentDate);
      expect(result).toBe(false);
    });

    it('should return true when no last report exists', () => {
      const currentDate = moment.tz('2024-06-17 18:00', 'America/New_York');

      const result = isReportDue('Daily', mockSchoolSettings, null, currentDate);
      expect(result).toBe(true);
    });

    it('should handle calculation errors gracefully', () => {
      const invalidSettings = {
        timezone: 'Invalid/Timezone',
        reportFrequencies: {}
      };

      const result = isReportDue('Daily', invalidSettings, null);
      expect(result).toBe(false);
    });
  });

  describe('Timezone handling', () => {
    it('should calculate due dates in correct timezone', () => {
      const settingsLA = {
        ...mockSchoolSettings,
        timezone: 'America/Los_Angeles'
      };

      const baseDateUTC = moment.utc('2024-06-17 22:00'); // 10 PM UTC
      const result = calculateDueDate('Daily', settingsLA, baseDateUTC);

      // Should be calculated in LA timezone (3 PM LA time)
      expect(result.timezone).toBe('America/Los_Angeles');
      expect(result.dueDate.tz()).toBe('America/Los_Angeles');
    });

    it('should default to UTC when no timezone specified', () => {
      const settingsNoTimezone = {
        ...mockSchoolSettings,
        timezone: undefined
      };

      const result = calculateDueDate('Daily', settingsNoTimezone);
      expect(result.timezone).toBe('UTC');
    });
  });

  describe('Performance and caching', () => {
    it('should complete calculations within reasonable time', () => {
      const start = performance.now();
      
      for (let i = 0; i < 100; i++) {
        calculateDueDate('Daily', mockSchoolSettings);
      }
      
      const end = performance.now();
      const avgTime = (end - start) / 100;
      
      // Should complete within 10ms on average
      expect(avgTime).toBeLessThan(10);
    });
  });
});

describe('Edge cases and special scenarios', () => {
  const schoolSettings = {
    timezone: 'America/New_York',
    reportFrequencies: {
      Daily: { enabled: true, workingDays: [1, 2, 3, 4, 5], dueTime: '17:00' },
      Weekly: { enabled: true, dueDay: 5, dueTime: '17:00' },
      Monthly: { enabled: true, rule: 'specificDate', specificDay: 31, dueTime: '17:00' }
    },
    calendar: {
      workingDays: { monday: true, tuesday: true, wednesday: true, thursday: true, friday: true, saturday: false, sunday: false },
      holidays: []
    }
  };

  it('should handle February in leap year for monthly reports', () => {
    const baseDate = moment.tz('2024-02-15', 'America/New_York'); // 2024 is leap year
    const result = calculateDueDate('Monthly', schoolSettings, baseDate);
    
    // Should handle February having only 29 days in leap year
    expect(result.dueDate.month()).toBe(1); // February (0-indexed)
    expect(result.dueDate.date()).toBe(29); // Last day of February in leap year
  });

  it('should handle February in non-leap year for monthly reports', () => {
    const baseDate = moment.tz('2025-02-15', 'America/New_York'); // 2025 is not leap year
    const result = calculateDueDate('Monthly', schoolSettings, baseDate);
    
    // Should handle February having only 28 days in non-leap year
    expect(result.dueDate.month()).toBe(1); // February (0-indexed)
    expect(result.dueDate.date()).toBe(28); // Last day of February in non-leap year
  });

  it('should handle daylight saving time transitions', () => {
    // Spring forward (2:00 AM becomes 3:00 AM)
    const springForward = moment.tz('2024-03-10 01:00', 'America/New_York');
    const result1 = calculateDueDate('Daily', schoolSettings, springForward);
    
    expect(result1.dueDate.hour()).toBe(17);
    expect(result1.dueDate.isDST()).toBe(true);

    // Fall back (2:00 AM becomes 1:00 AM)
    const fallBack = moment.tz('2024-11-03 01:00', 'America/New_York');
    const result2 = calculateDueDate('Daily', schoolSettings, fallBack);
    
    expect(result2.dueDate.hour()).toBe(17);
  });

  it('should handle year boundaries for quarterly reports', () => {
    const quarterlySettings = {
      ...schoolSettings,
      reportFrequencies: {
        Quarterly: {
          enabled: true,
          quarters: {
            q1: { enabled: true, month: 3, day: 31 },
            q2: { enabled: true, month: 6, day: 30 },
            q3: { enabled: true, month: 9, day: 30 },
            q4: { enabled: true, month: 12, day: 31 }
          },
          dueTime: '17:00'
        }
      }
    };

    const baseDate = moment.tz('2024-11-15', 'America/New_York'); // November
    const result = calculateDueDate('Quarterly', quarterlySettings, baseDate);
    
    // Next quarter should be Q4 of same year
    expect(result.dueDate.year()).toBe(2024);
    expect(result.dueDate.month()).toBe(11); // December (0-indexed)
    expect(result.dueDate.date()).toBe(31);
  });
});
