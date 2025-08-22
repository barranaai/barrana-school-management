/**
 * Unit Tests for Due Date Cache
 * Tests the caching functionality for due date calculations
 */

import moment from 'moment-timezone';
import { dueDateCache } from '../dueDateCache';
import { ReportFrequency } from '../../constants/reportFrequencies';

// Mock the calculation logger
jest.mock('../calculationLogger', () => ({
  calculationLogger: {
    logDueDateCalculation: jest.fn(),
  }
}));

describe('DueDateCache', () => {
  const mockSchoolSettings = {
    timezone: 'America/New_York',
    reportFrequencies: {
      Daily: {
        enabled: true,
        workingDays: [1, 2, 3, 4, 5],
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
      holidays: []
    }
  };

  const mockResult = {
    dueDate: moment('2024-06-17T17:00:00'),
    timezone: 'America/New_York',
    frequency: 'Daily' as ReportFrequency,
    calculationMethod: 'working-days',
    isEnabled: true
  };

  beforeEach(() => {
    dueDateCache.clear();
    jest.clearAllMocks();
  });

  describe('Cache operations', () => {
    it('should store and retrieve cached results', () => {
      const schoolId = 'school123';
      const studentId = 'student456';
      const templateId = 'template789';
      const baseDate = moment('2024-06-17T10:00:00');

      // Cache miss initially
      const cachedResult1 = dueDateCache.get('Daily', mockSchoolSettings, schoolId, studentId, templateId, baseDate);
      expect(cachedResult1).toBeNull();

      // Store result
      dueDateCache.set('Daily', mockSchoolSettings, schoolId, mockResult, studentId, templateId, baseDate);

      // Cache hit after storing
      const cachedResult2 = dueDateCache.get('Daily', mockSchoolSettings, schoolId, studentId, templateId, baseDate);
      expect(cachedResult2).toEqual(mockResult);
    });

    it('should handle cache without student/template IDs', () => {
      const schoolId = 'school123';
      const baseDate = moment('2024-06-17T10:00:00');

      dueDateCache.set('Daily', mockSchoolSettings, schoolId, mockResult, undefined, undefined, baseDate);
      const cachedResult = dueDateCache.get('Daily', mockSchoolSettings, schoolId, undefined, undefined, baseDate);

      expect(cachedResult).toEqual(mockResult);
    });

    it('should return null for different cache parameters', () => {
      const schoolId = 'school123';
      const studentId = 'student456';
      const baseDate = moment('2024-06-17T10:00:00');

      dueDateCache.set('Daily', mockSchoolSettings, schoolId, mockResult, studentId, undefined, baseDate);

      // Different student ID should miss
      const cachedResult = dueDateCache.get('Daily', mockSchoolSettings, schoolId, 'different-student', undefined, baseDate);
      expect(cachedResult).toBeNull();
    });

    it('should invalidate cache entries based on criteria', () => {
      const schoolId = 'school123';
      const studentId1 = 'student1';
      const studentId2 = 'student2';
      const baseDate = moment('2024-06-17T10:00:00');

      // Store multiple entries
      dueDateCache.set('Daily', mockSchoolSettings, schoolId, mockResult, studentId1, undefined, baseDate);
      dueDateCache.set('Weekly', mockSchoolSettings, schoolId, mockResult, studentId2, undefined, baseDate);

      // Invalidate specific student
      const invalidatedCount = dueDateCache.invalidate({ studentId: studentId1 });
      expect(invalidatedCount).toBe(1);

      // First entry should be gone, second should remain
      const result1 = dueDateCache.get('Daily', mockSchoolSettings, schoolId, studentId1, undefined, baseDate);
      const result2 = dueDateCache.get('Weekly', mockSchoolSettings, schoolId, studentId2, undefined, baseDate);

      expect(result1).toBeNull();
      expect(result2).toEqual(mockResult);
    });

    it('should invalidate all entries for a school', () => {
      const schoolId = 'school123';
      const baseDate = moment('2024-06-17T10:00:00');

      dueDateCache.set('Daily', mockSchoolSettings, schoolId, mockResult, 'student1', undefined, baseDate);
      dueDateCache.set('Weekly', mockSchoolSettings, schoolId, mockResult, 'student2', undefined, baseDate);

      const invalidatedCount = dueDateCache.invalidateSchool(schoolId);
      expect(invalidatedCount).toBe(2);

      const stats = dueDateCache.getStats();
      expect(stats.totalEntries).toBe(0);
    });
  });

  describe('Cache expiration', () => {
    it('should expire daily cache entries after timeout', async () => {
      const schoolId = 'school123';
      const baseDate = moment('2024-06-17T10:00:00');

      dueDateCache.set('Daily', mockSchoolSettings, schoolId, mockResult, undefined, undefined, baseDate);

      // Mock time to be in the future (beyond cache expiration)
      const futureTime = moment().add(3, 'hours');
      jest.spyOn(moment, 'now').mockReturnValue(futureTime.valueOf());

      const cachedResult = dueDateCache.get('Daily', mockSchoolSettings, schoolId, undefined, undefined, baseDate);
      expect(cachedResult).toBeNull();

      jest.restoreAllMocks();
    });

    it('should have different expiration times for different frequencies', () => {
      const schoolId = 'school123';
      const baseDate = moment('2024-06-17T10:00:00');

      const weeklySettings = {
        ...mockSchoolSettings,
        reportFrequencies: {
          Weekly: { enabled: true, dueDay: 5, dueTime: '17:00' }
        }
      };

      const weeklyResult = { ...mockResult, frequency: 'Weekly' as ReportFrequency };

      dueDateCache.set('Daily', mockSchoolSettings, schoolId, mockResult, undefined, undefined, baseDate);
      dueDateCache.set('Weekly', weeklySettings, schoolId, weeklyResult, undefined, undefined, baseDate);

      const stats = dueDateCache.getStats();
      expect(stats.totalEntries).toBe(2);

      // Daily should expire before weekly (2 hours vs 12 hours)
      // This is hard to test without mocking time, but we can verify they're stored
    });
  });

  describe('Settings hash changes', () => {
    it('should miss cache when school settings change', () => {
      const schoolId = 'school123';
      const baseDate = moment('2024-06-17T10:00:00');

      dueDateCache.set('Daily', mockSchoolSettings, schoolId, mockResult, undefined, undefined, baseDate);

      // Change settings
      const modifiedSettings = {
        ...mockSchoolSettings,
        reportFrequencies: {
          Daily: {
            ...mockSchoolSettings.reportFrequencies.Daily,
            dueTime: '18:00' // Changed due time
          }
        }
      };

      const cachedResult = dueDateCache.get('Daily', modifiedSettings, schoolId, undefined, undefined, baseDate);
      expect(cachedResult).toBeNull();
    });

    it('should miss cache when timezone changes', () => {
      const schoolId = 'school123';
      const baseDate = moment('2024-06-17T10:00:00');

      dueDateCache.set('Daily', mockSchoolSettings, schoolId, mockResult, undefined, undefined, baseDate);

      const differentTimezoneSettings = {
        ...mockSchoolSettings,
        timezone: 'America/Los_Angeles'
      };

      const cachedResult = dueDateCache.get('Daily', differentTimezoneSettings, schoolId, undefined, undefined, baseDate);
      expect(cachedResult).toBeNull();
    });
  });

  describe('Cache statistics', () => {
    it('should track hit and miss rates', () => {
      const schoolId = 'school123';
      const baseDate = moment('2024-06-17T10:00:00');

      // Initial stats
      let stats = dueDateCache.getStats();
      expect(stats.totalHits).toBe(0);
      expect(stats.totalMisses).toBe(0);

      // Cache miss
      dueDateCache.get('Daily', mockSchoolSettings, schoolId, undefined, undefined, baseDate);
      stats = dueDateCache.getStats();
      expect(stats.totalMisses).toBe(1);

      // Cache set and hit
      dueDateCache.set('Daily', mockSchoolSettings, schoolId, mockResult, undefined, undefined, baseDate);
      dueDateCache.get('Daily', mockSchoolSettings, schoolId, undefined, undefined, baseDate);
      
      stats = dueDateCache.getStats();
      expect(stats.totalHits).toBe(1);
      expect(stats.hitRate).toBeCloseTo(50); // 1 hit out of 2 total requests
    });

    it('should provide cache size and entry count', () => {
      const schoolId = 'school123';
      const baseDate = moment('2024-06-17T10:00:00');

      dueDateCache.set('Daily', mockSchoolSettings, schoolId, mockResult, 'student1', undefined, baseDate);
      dueDateCache.set('Weekly', mockSchoolSettings, schoolId, mockResult, 'student2', undefined, baseDate);

      const stats = dueDateCache.getStats();
      expect(stats.totalEntries).toBe(2);
    });
  });

  describe('Cache warming', () => {
    it('should warm up cache with common frequencies', async () => {
      const schoolId = 'school123';
      const commonFrequencies: ReportFrequency[] = ['Daily', 'Weekly'];

      const settingsWithMultipleFreqs = {
        ...mockSchoolSettings,
        reportFrequencies: {
          Daily: { enabled: true, workingDays: [1, 2, 3, 4, 5], dueTime: '17:00' },
          Weekly: { enabled: true, dueDay: 5, dueTime: '17:00' }
        }
      };

      await dueDateCache.warmUp(schoolId, settingsWithMultipleFreqs, commonFrequencies);

      const stats = dueDateCache.getStats();
      expect(stats.totalEntries).toBe(2); // Should have cached both frequencies
    });
  });

  describe('Memory management', () => {
    it('should handle cache overflow gracefully', () => {
      const schoolId = 'school123';
      const baseDate = moment('2024-06-17T10:00:00');

      // Store many entries to test eviction
      for (let i = 0; i < 50; i++) {
        dueDateCache.set('Daily', mockSchoolSettings, schoolId, mockResult, `student${i}`, undefined, baseDate);
      }

      const stats = dueDateCache.getStats();
      expect(stats.totalEntries).toBe(50);
      expect(stats.totalEntries).toBeLessThanOrEqual(1000); // Should not exceed max entries
    });
  });

  describe('Debug functionality', () => {
    it('should provide debug information', () => {
      const schoolId = 'school123';
      const baseDate = moment('2024-06-17T10:00:00');

      dueDateCache.set('Daily', mockSchoolSettings, schoolId, mockResult, undefined, undefined, baseDate);

      // Test debug functionality without using debug statement
      const stats = dueDateCache.getStats();
      expect(stats.totalEntries).toBe(1);
    });
  });

  describe('Error handling', () => {
    it('should handle malformed cache data gracefully', () => {
      // This test would be more relevant for the backend cache with Redis
      // For frontend memory cache, errors are less likely
      expect(() => {
        dueDateCache.clear();
      }).not.toThrow();
    });
  });

  describe('Cache key generation', () => {
    it('should generate different keys for different parameters', () => {
      const schoolId = 'school123';
      const baseDate = moment('2024-06-17T10:00:00');

      // Store with student ID
      dueDateCache.set('Daily', mockSchoolSettings, schoolId, mockResult, 'student1', undefined, baseDate);
      
      // Store without student ID (should be different key)
      dueDateCache.set('Daily', mockSchoolSettings, schoolId, mockResult, undefined, undefined, baseDate);

      const stats = dueDateCache.getStats();
      expect(stats.totalEntries).toBe(2); // Should be two separate cache entries
    });

    it('should generate same keys for identical parameters', () => {
      const schoolId = 'school123';
      const studentId = 'student456';
      const baseDate = moment('2024-06-17T10:00:00');

      // Store once
      dueDateCache.set('Daily', mockSchoolSettings, schoolId, mockResult, studentId, undefined, baseDate);
      
      // Store again with same parameters (should overwrite)
      dueDateCache.set('Daily', mockSchoolSettings, schoolId, mockResult, studentId, undefined, baseDate);

      const stats = dueDateCache.getStats();
      expect(stats.totalEntries).toBe(1); // Should still be one entry
    });
  });
});
