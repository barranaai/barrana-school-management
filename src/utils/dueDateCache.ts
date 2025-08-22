/**
 * Due Date Calculation Cache
 * Implements intelligent caching for due date calculations to improve performance
 */

import moment from 'moment-timezone';
import { ReportFrequency } from '../constants/reportFrequencies';
import { calculationLogger } from './calculationLogger';

export interface CacheKey {
  frequency: ReportFrequency;
  schoolId: string;
  studentId?: string;
  templateId?: string;
  settingsHash: string;
  baseDate: string; // ISO string
}

export interface CacheEntry {
  key: CacheKey;
  result: any;
  calculatedAt: string;
  expiresAt: string;
  hitCount: number;
  lastAccessed: string;
}

export interface CacheStats {
  totalEntries: number;
  hitRate: number;
  missRate: number;
  totalHits: number;
  totalMisses: number;
  averageAge: number;
  expiredEntries: number;
}

class DueDateCache {
  private cache = new Map<string, CacheEntry>();
  private maxEntries = 1000;
  private totalHits = 0;
  private totalMisses = 0;
  
  /**
   * Generate cache key from parameters
   */
  private generateCacheKey(
    frequency: ReportFrequency,
    schoolSettings: any,
    schoolId: string,
    studentId?: string,
    templateId?: string,
    baseDate?: moment.Moment
  ): CacheKey {
    // Create a hash of the relevant settings that affect calculations
    const settingsForHash = {
      timezone: schoolSettings.timezone,
      reportFrequencies: schoolSettings.reportFrequencies?.[frequency],
      calendar: schoolSettings.calendar
    };
    
    const settingsHash = this.hashObject(settingsForHash);
    const baseDateString = baseDate ? baseDate.toISOString() : moment().toISOString();
    
    return {
      frequency,
      schoolId,
      studentId,
      templateId,
      settingsHash,
      baseDate: baseDateString
    };
  }
  
  /**
   * Generate string key for Map storage
   */
  private stringifyKey(key: CacheKey): string {
    return JSON.stringify(key);
  }
  
  /**
   * Simple hash function for objects
   */
  private hashObject(obj: any): string {
    return btoa(JSON.stringify(obj)).replace(/[^a-zA-Z0-9]/g, '').substring(0, 16);
  }
  
  /**
   * Calculate expiration time based on frequency
   */
  private calculateExpiration(frequency: ReportFrequency): moment.Moment {
    const now = moment();
    
    switch (frequency) {
      case 'Daily':
        // Cache for 2 hours for daily reports
        return now.add(2, 'hours');
      case 'Weekly':
        // Cache for 12 hours for weekly reports
        return now.add(12, 'hours');
      case 'Bi-Weekly':
        // Cache for 1 day for bi-weekly reports
        return now.add(1, 'day');
      case 'Monthly':
        // Cache for 2 days for monthly reports
        return now.add(2, 'days');
      case 'Bi-Monthly':
        // Cache for 3 days for bi-monthly reports
        return now.add(3, 'days');
      case 'Quarterly':
        // Cache for 1 week for quarterly reports
        return now.add(1, 'week');
      case 'Annually':
        // Cache for 2 weeks for annual reports
        return now.add(2, 'weeks');
      default:
        // Default to 6 hours
        return now.add(6, 'hours');
    }
  }
  
  /**
   * Check if cache entry is expired
   */
  private isExpired(entry: CacheEntry): boolean {
    return moment().isAfter(moment(entry.expiresAt));
  }
  
  /**
   * Clean up expired entries
   */
  private cleanupExpired(): void {
    const expiredKeys: string[] = [];
    
    Array.from(this.cache.entries()).forEach(([key, entry]) => {
      if (this.isExpired(entry)) {
        expiredKeys.push(key);
      }
    });
    
    expiredKeys.forEach(key => this.cache.delete(key));
    
    if (expiredKeys.length > 0) {
      calculationLogger.logDueDateCalculation('cache-cleanup', {
        expiredEntriesRemoved: expiredKeys.length,
        remainingEntries: this.cache.size
      });
    }
  }
  
  /**
   * Evict least recently used entries if cache is full
   */
  private evictLRU(): void {
    if (this.cache.size <= this.maxEntries) return;
    
    // Sort by last accessed time and remove oldest entries
    const entries = Array.from(this.cache.entries());
    entries.sort((a, b) => 
      moment(a[1].lastAccessed).diff(moment(b[1].lastAccessed))
    );
    
    const toRemove = entries.slice(0, this.cache.size - this.maxEntries + 100); // Remove extra for buffer
    toRemove.forEach(([key]) => this.cache.delete(key));
    
    calculationLogger.logDueDateCalculation('cache-eviction', {
      entriesRemoved: toRemove.length,
      remainingEntries: this.cache.size,
      reason: 'LRU-eviction'
    });
  }
  
  /**
   * Get cached result
   */
  get(
    frequency: ReportFrequency,
    schoolSettings: any,
    schoolId: string,
    studentId?: string,
    templateId?: string,
    baseDate?: moment.Moment
  ): any | null {
    this.cleanupExpired();
    
    const cacheKey = this.generateCacheKey(frequency, schoolSettings, schoolId, studentId, templateId, baseDate);
    const stringKey = this.stringifyKey(cacheKey);
    const entry = this.cache.get(stringKey);
    
    if (!entry) {
      this.totalMisses++;
      calculationLogger.logDueDateCalculation('cache-miss', {
        frequency,
        schoolId,
        studentId,
        templateId,
        reason: 'not-found'
      });
      return null;
    }
    
    if (this.isExpired(entry)) {
      this.cache.delete(stringKey);
      this.totalMisses++;
      calculationLogger.logDueDateCalculation('cache-miss', {
        frequency,
        schoolId,
        studentId,
        templateId,
        reason: 'expired',
        expiredAt: entry.expiresAt
      });
      return null;
    }
    
    // Update access statistics
    entry.hitCount++;
    entry.lastAccessed = moment().toISOString();
    this.totalHits++;
    
    calculationLogger.logDueDateCalculation('cache-hit', {
      frequency,
      schoolId,
      studentId,
      templateId,
      hitCount: entry.hitCount,
      age: moment().diff(moment(entry.calculatedAt), 'minutes')
    });
    
    return entry.result;
  }
  
  /**
   * Store result in cache
   */
  set(
    frequency: ReportFrequency,
    schoolSettings: any,
    schoolId: string,
    result: any,
    studentId?: string,
    templateId?: string,
    baseDate?: moment.Moment
  ): void {
    this.cleanupExpired();
    this.evictLRU();
    
    const cacheKey = this.generateCacheKey(frequency, schoolSettings, schoolId, studentId, templateId, baseDate);
    const stringKey = this.stringifyKey(cacheKey);
    const now = moment();
    const expiration = this.calculateExpiration(frequency);
    
    const entry: CacheEntry = {
      key: cacheKey,
      result,
      calculatedAt: now.toISOString(),
      expiresAt: expiration.toISOString(),
      hitCount: 0,
      lastAccessed: now.toISOString()
    };
    
    this.cache.set(stringKey, entry);
    
    calculationLogger.logDueDateCalculation('cache-set', {
      frequency,
      schoolId,
      studentId,
      templateId,
      expiresAt: entry.expiresAt,
      cacheSize: this.cache.size
    });
  }
  
  /**
   * Invalidate cache for specific criteria
   */
  invalidate(criteria: {
    frequency?: ReportFrequency;
    schoolId?: string;
    studentId?: string;
    templateId?: string;
  }): number {
    const keysToDelete: string[] = [];
    
    Array.from(this.cache.entries()).forEach(([stringKey, entry]) => {
      const key = entry.key;
      let shouldDelete = true;
      
      if (criteria.frequency && key.frequency !== criteria.frequency) {
        shouldDelete = false;
      }
      if (criteria.schoolId && key.schoolId !== criteria.schoolId) {
        shouldDelete = false;
      }
      if (criteria.studentId && key.studentId !== criteria.studentId) {
        shouldDelete = false;
      }
      if (criteria.templateId && key.templateId !== criteria.templateId) {
        shouldDelete = false;
      }
      
      if (shouldDelete) {
        keysToDelete.push(stringKey);
      }
    });
    
    keysToDelete.forEach(key => this.cache.delete(key));
    
    calculationLogger.logDueDateCalculation('cache-invalidation', {
      criteria,
      entriesInvalidated: keysToDelete.length,
      remainingEntries: this.cache.size
    });
    
    return keysToDelete.length;
  }
  
  /**
   * Invalidate all cache entries for a school (when settings change)
   */
  invalidateSchool(schoolId: string): number {
    return this.invalidate({ schoolId });
  }
  
  /**
   * Invalidate all cache entries for a frequency (when frequency config changes)
   */
  invalidateFrequency(frequency: ReportFrequency): number {
    return this.invalidate({ frequency });
  }
  
  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    this.cleanupExpired();
    
    const entries = Array.from(this.cache.values());
    const now = moment();
    const totalRequests = this.totalHits + this.totalMisses;
    
    const ages = entries.map(entry => 
      now.diff(moment(entry.calculatedAt), 'minutes')
    );
    
    const expiredCount = entries.filter(entry => this.isExpired(entry)).length;
    
    return {
      totalEntries: this.cache.size,
      hitRate: totalRequests > 0 ? (this.totalHits / totalRequests) * 100 : 0,
      missRate: totalRequests > 0 ? (this.totalMisses / totalRequests) * 100 : 0,
      totalHits: this.totalHits,
      totalMisses: this.totalMisses,
      averageAge: ages.length > 0 ? ages.reduce((a, b) => a + b, 0) / ages.length : 0,
      expiredEntries: expiredCount
    };
  }
  
  /**
   * Clear all cache entries
   */
  clear(): void {
    const size = this.cache.size;
    this.cache.clear();
    this.totalHits = 0;
    this.totalMisses = 0;
    
    calculationLogger.logDueDateCalculation('cache-clear', {
      entriesCleared: size
    });
  }
  
  /**
   * Get cache contents (for debugging)
   */
  debug(): {
    entries: CacheEntry[];
    stats: CacheStats;
  } {
    return {
      entries: Array.from(this.cache.values()),
      stats: this.getStats()
    };
  }
  
  /**
   * Warm up cache with common calculations
   */
  async warmUp(schoolId: string, schoolSettings: any, commonFrequencies: ReportFrequency[] = ['Daily', 'Weekly', 'Monthly']): Promise<void> {
    calculationLogger.logDueDateCalculation('cache-warmup-start', {
      schoolId,
      frequencies: commonFrequencies
    });
    
    const warmupPromises = commonFrequencies.map(async frequency => {
      try {
        // Import calculation function to avoid circular dependency
        const { calculateDueDate } = await import('./dueDateCalculations');
        const result = calculateDueDate(frequency, schoolSettings);
        this.set(frequency, schoolSettings, schoolId, result);
      } catch (error) {
        calculationLogger.logCalculationError('cache-warmup', 'system', 'system', frequency, error as Error, {
          schoolId
        });
      }
    });
    
    await Promise.all(warmupPromises);
    
    calculationLogger.logDueDateCalculation('cache-warmup-complete', {
      schoolId,
      frequencies: commonFrequencies,
      cacheSize: this.cache.size
    });
  }
}

// Create singleton instance
export const dueDateCache = new DueDateCache();

// Development helper - expose cache to window for debugging
if (process.env.NODE_ENV === 'development' && typeof window !== 'undefined') {
  (window as any).dueDateCache = dueDateCache;
}

export default dueDateCache;
