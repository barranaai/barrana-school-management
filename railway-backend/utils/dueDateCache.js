/**
 * Backend Due Date Calculation Cache
 * Implements caching for due date calculations with Redis fallback to memory
 */

const moment = require('moment-timezone');
const { logDueDateCalculation, logCalculationError } = require('./logger');

class DueDateCache {
  constructor() {
    this.memoryCache = new Map();
    this.maxMemoryEntries = 1000;
    this.totalHits = 0;
    this.totalMisses = 0;
    this.redisClient = null;
    
    // Try to initialize Redis if available
    this.initializeRedis();
  }
  
  /**
   * Initialize Redis client if available
   */
  async initializeRedis() {
    try {
      if (process.env.REDIS_URL) {
        const redis = require('redis');
        this.redisClient = redis.createClient({
          url: process.env.REDIS_URL
        });
        
        await this.redisClient.connect();
        console.log('✅ Redis cache connected for due date calculations');
        
        logDueDateCalculation('cache-redis-connected', {
          redisUrl: process.env.REDIS_URL ? '[configured]' : '[not configured]'
        });
      }
    } catch (error) {
      console.warn('⚠️ Redis not available, falling back to memory cache:', error.message);
      this.redisClient = null;
    }
  }
  
  /**
   * Generate cache key
   */
  generateCacheKey(frequency, schoolId, studentId = null, templateId = null, settingsHash, baseDate) {
    const key = {
      frequency,
      schoolId: schoolId.toString(),
      studentId: studentId ? studentId.toString() : null,
      templateId: templateId ? templateId.toString() : null,
      settingsHash,
      baseDate: baseDate.toISOString(),
      version: 'v1'
    };
    
    return `due_calc:${Buffer.from(JSON.stringify(key)).toString('base64')}`;
  }
  
  /**
   * Generate settings hash
   */
  generateSettingsHash(schoolSettings, frequency) {
    const relevantSettings = {
      timezone: schoolSettings.timezone,
      reportFrequency: schoolSettings.reportFrequencies?.[frequency],
      calendar: schoolSettings.calendar
    };
    
    return require('crypto')
      .createHash('md5')
      .update(JSON.stringify(relevantSettings))
      .digest('hex')
      .substring(0, 16);
  }
  
  /**
   * Calculate expiration time based on frequency
   */
  calculateExpiration(frequency) {
    const now = moment();
    
    switch (frequency) {
      case 'Daily':
        return now.add(2, 'hours');
      case 'Weekly':
        return now.add(12, 'hours');
      case 'Bi-Weekly':
        return now.add(1, 'day');
      case 'Monthly':
        return now.add(2, 'days');
      case 'Bi-Monthly':
        return now.add(3, 'days');
      case 'Quarterly':
        return now.add(1, 'week');
      case 'Annually':
        return now.add(2, 'weeks');
      default:
        return now.add(6, 'hours');
    }
  }
  
  /**
   * Get from cache
   */
  async get(frequency, schoolSettings, schoolId, studentId = null, templateId = null, baseDate = null) {
    try {
      const settingsHash = this.generateSettingsHash(schoolSettings, frequency);
      const actualBaseDate = baseDate || moment().tz(schoolSettings.timezone || 'UTC');
      const cacheKey = this.generateCacheKey(frequency, schoolId, studentId, templateId, settingsHash, actualBaseDate);
      
      let result = null;
      let source = 'none';
      
      // Try Redis first
      if (this.redisClient) {
        try {
          const redisResult = await this.redisClient.get(cacheKey);
          if (redisResult) {
            result = JSON.parse(redisResult);
            source = 'redis';
          }
        } catch (redisError) {
          console.warn('Redis cache read error:', redisError.message);
        }
      }
      
      // Fallback to memory cache
      if (!result && this.memoryCache.has(cacheKey)) {
        const memoryEntry = this.memoryCache.get(cacheKey);
        if (moment().isBefore(moment(memoryEntry.expiresAt))) {
          result = memoryEntry.result;
          source = 'memory';
          
          // Update access stats
          memoryEntry.hitCount++;
          memoryEntry.lastAccessed = moment().toISOString();
        } else {
          // Expired, remove it
          this.memoryCache.delete(cacheKey);
        }
      }
      
      if (result) {
        this.totalHits++;
        logDueDateCalculation('cache-hit', {
          frequency,
          schoolId: schoolId.toString(),
          studentId: studentId ? studentId.toString() : null,
          templateId: templateId ? templateId.toString() : null,
          source,
          cacheKey: cacheKey.substring(0, 32) + '...'
        });
        
        // Reconstruct moment objects
        if (result.dueDate) {
          result.dueDate = moment(result.dueDate);
        }
        
        return result;
      }
      
      this.totalMisses++;
      logDueDateCalculation('cache-miss', {
        frequency,
        schoolId: schoolId.toString(),
        studentId: studentId ? studentId.toString() : null,
        templateId: templateId ? templateId.toString() : null,
        cacheKey: cacheKey.substring(0, 32) + '...'
      });
      
      return null;
    } catch (error) {
      logCalculationError('cache-get', studentId || 'system', templateId || 'system', frequency, error, {
        schoolId: schoolId.toString()
      });
      return null;
    }
  }
  
  /**
   * Set in cache
   */
  async set(frequency, schoolSettings, schoolId, result, studentId = null, templateId = null, baseDate = null) {
    try {
      const settingsHash = this.generateSettingsHash(schoolSettings, frequency);
      const actualBaseDate = baseDate || moment().tz(schoolSettings.timezone || 'UTC');
      const cacheKey = this.generateCacheKey(frequency, schoolId, studentId, templateId, settingsHash, actualBaseDate);
      const expiration = this.calculateExpiration(frequency);
      
      // Prepare result for caching (serialize moment objects)
      const cacheableResult = {
        ...result,
        dueDate: result.dueDate ? result.dueDate.toISOString() : null
      };
      
      const cacheEntry = {
        result: cacheableResult,
        calculatedAt: moment().toISOString(),
        expiresAt: expiration.toISOString(),
        hitCount: 0,
        lastAccessed: moment().toISOString()
      };
      
      // Store in Redis if available
      if (this.redisClient) {
        try {
          const ttlSeconds = expiration.diff(moment(), 'seconds');
          await this.redisClient.setEx(cacheKey, ttlSeconds, JSON.stringify(cacheableResult));
        } catch (redisError) {
          console.warn('Redis cache write error:', redisError.message);
        }
      }
      
      // Store in memory cache
      this.memoryCache.set(cacheKey, cacheEntry);
      
      // Clean up memory cache if it gets too large
      if (this.memoryCache.size > this.maxMemoryEntries) {
        this.evictLRU();
      }
      
      logDueDateCalculation('cache-set', {
        frequency,
        schoolId: schoolId.toString(),
        studentId: studentId ? studentId.toString() : null,
        templateId: templateId ? templateId.toString() : null,
        expiresAt: expiration.toISOString(),
        cacheKey: cacheKey.substring(0, 32) + '...',
        memoryCacheSize: this.memoryCache.size
      });
      
    } catch (error) {
      logCalculationError('cache-set', studentId || 'system', templateId || 'system', frequency, error, {
        schoolId: schoolId.toString()
      });
    }
  }
  
  /**
   * Evict least recently used entries from memory cache
   */
  evictLRU() {
    const entries = Array.from(this.memoryCache.entries());
    entries.sort((a, b) => 
      moment(a[1].lastAccessed).diff(moment(b[1].lastAccessed))
    );
    
    const toRemove = entries.slice(0, this.memoryCache.size - this.maxMemoryEntries + 100);
    toRemove.forEach(([key]) => this.memoryCache.delete(key));
    
    logDueDateCalculation('cache-eviction', {
      entriesRemoved: toRemove.length,
      remainingEntries: this.memoryCache.size
    });
  }
  
  /**
   * Invalidate cache entries
   */
  async invalidate(criteria) {
    let invalidatedCount = 0;
    
    try {
      // Invalidate memory cache
      const keysToDelete = [];
      for (const [key, entry] of this.memoryCache.entries()) {
        // Simple pattern matching for invalidation
        const shouldInvalidate = (
          (criteria.schoolId && key.includes(criteria.schoolId.toString())) ||
          (criteria.frequency && key.includes(criteria.frequency)) ||
          (criteria.all === true)
        );
        
        if (shouldInvalidate) {
          keysToDelete.push(key);
        }
      }
      
      keysToDelete.forEach(key => this.memoryCache.delete(key));
      invalidatedCount += keysToDelete.length;
      
      // For Redis, we'd need to scan keys (expensive) or use key patterns
      // For now, we'll rely on expiration for Redis cleanup
      
      logDueDateCalculation('cache-invalidation', {
        criteria,
        entriesInvalidated: invalidatedCount,
        remainingEntries: this.memoryCache.size
      });
      
    } catch (error) {
      logCalculationError('cache-invalidation', 'system', 'system', 'all', error, {
        criteria
      });
    }
    
    return invalidatedCount;
  }
  
  /**
   * Get cache statistics
   */
  getStats() {
    const totalRequests = this.totalHits + this.totalMisses;
    const entries = Array.from(this.memoryCache.values());
    const now = moment();
    
    const ages = entries.map(entry => 
      now.diff(moment(entry.calculatedAt), 'minutes')
    );
    
    return {
      totalEntries: this.memoryCache.size,
      hitRate: totalRequests > 0 ? (this.totalHits / totalRequests) * 100 : 0,
      missRate: totalRequests > 0 ? (this.totalMisses / totalRequests) * 100 : 0,
      totalHits: this.totalHits,
      totalMisses: this.totalMisses,
      averageAge: ages.length > 0 ? ages.reduce((a, b) => a + b, 0) / ages.length : 0,
      redisAvailable: !!this.redisClient,
      redisConnected: this.redisClient ? this.redisClient.isReady : false
    };
  }
  
  /**
   * Clear all cache
   */
  async clear() {
    const memorySize = this.memoryCache.size;
    this.memoryCache.clear();
    this.totalHits = 0;
    this.totalMisses = 0;
    
    if (this.redisClient) {
      try {
        // Note: This is dangerous in production - only clear our keys
        const keys = await this.redisClient.keys('due_calc:*');
        if (keys.length > 0) {
          await this.redisClient.del(keys);
        }
      } catch (redisError) {
        console.warn('Redis cache clear error:', redisError.message);
      }
    }
    
    logDueDateCalculation('cache-clear', {
      memoryCacheCleared: memorySize,
      redisCleared: !!this.redisClient
    });
  }
}

// Create singleton instance
const dueDateCache = new DueDateCache();

module.exports = {
  dueDateCache
};
