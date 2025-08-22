// Database Service for Barrana.ai
// This service handles all database operations through the API

import { apiService } from './apiService';

export interface DatabaseConfig {
  uri: string;
  database: string;
  options?: {
    useNewUrlParser?: boolean;
    useUnifiedTopology?: boolean;
    maxPoolSize?: number;
    serverSelectionTimeoutMS?: number;
    socketTimeoutMS?: number;
  };
}

export interface QueryOptions {
  limit?: number;
  skip?: number;
  sort?: { [key: string]: 1 | -1 };
  projection?: { [key: string]: 1 | 0 };
}

export interface DatabaseResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  count?: number;
}

class DatabaseService {
  private config: DatabaseConfig | null = null;
  private isConnected: boolean = false;

  async initialize(config: DatabaseConfig): Promise<DatabaseResponse<boolean>> {
    try {
      this.config = config;
      
      // Test connection by calling health check
      const healthResponse = await apiService.healthCheck();
      
      if (healthResponse.success) {
        this.isConnected = true;
        console.log('✅ Database service initialized successfully');
        return {
          success: true,
          data: true
        };
      } else {
        throw new Error('Health check failed');
      }
    } catch (error) {
      console.error('❌ Database service initialization failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Initialization failed'
      };
    }
  }

  isDatabaseConnected(): boolean {
    return this.isConnected;
  }

  async create<T>(collection: string, document: T): Promise<DatabaseResponse<T>> {
    if (!this.isConnected) {
      return {
        success: false,
        error: 'Database not connected'
      };
    }

    try {
      let response;
      
      switch (collection) {
        case 'students':
          response = await apiService.createStudent(document as any);
          break;
        case 'teachers':
          response = await apiService.createTeacher(document as any);
          break;
        case 'reports':
          response = await apiService.createReport(document as any);
          break;
        case 'schools':
          response = await apiService.createSchool(document as any);
          break;
        case 'users':
          response = await apiService.createUser(document as any);
          break;
        default:
          throw new Error(`Unsupported collection: ${collection}`);
      }

      if (response.success && response.data) {
        return {
          success: true,
          data: response.data as T
        };
      } else {
        return {
          success: false,
          error: response.error || 'Create operation failed'
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Create operation failed'
      };
    }
  }

  async find<T>(collection: string, query: any = {}, options: QueryOptions = {}): Promise<DatabaseResponse<T[]>> {
    if (!this.isConnected) {
      return {
        success: false,
        error: 'Database not connected'
      };
    }

    try {
      let response;
      
      switch (collection) {
        case 'students':
          response = await apiService.getStudents();
          break;
        case 'teachers':
          response = await apiService.getTeachers();
          break;
        case 'reports':
          response = await apiService.getReports();
          break;
        case 'schools':
          response = await apiService.getSchools();
          break;
        case 'users':
          response = await apiService.getUsers();
          break;
        default:
          throw new Error(`Unsupported collection: ${collection}`);
      }

      if (response.success && response.data) {
        let results = response.data as T[];

        // Apply query filtering (simplified - in real implementation, this would be done on the backend)
        if (Object.keys(query).length > 0) {
          results = results.filter(item => this.matchesQuery(item, query));
        }

        // Apply sorting
        if (options.sort) {
          results = this.sortResults(results, options.sort);
        }

        // Apply pagination
        if (options.skip) {
          results = results.slice(options.skip);
        }
        if (options.limit) {
          results = results.slice(0, options.limit);
        }

        return {
          success: true,
          data: results,
          count: results.length
        };
      } else {
        return {
          success: false,
          error: response.error || 'Find operation failed'
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Find operation failed'
      };
    }
  }

  async findOne<T>(collection: string, query: any = {}): Promise<DatabaseResponse<T>> {
    if (!this.isConnected) {
      return {
        success: false,
        error: 'Database not connected'
      };
    }

    try {
      // For findOne, we'll get all and filter - in production this should be done on the backend
      const findResponse = await this.find<T>(collection, query, { limit: 1 });
      
      if (findResponse.success && findResponse.data && findResponse.data.length > 0) {
        return {
          success: true,
          data: findResponse.data[0]
        };
      } else {
        return {
          success: false,
          error: 'Document not found'
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'FindOne operation failed'
      };
    }
  }

  async update<T>(collection: string, query: any, update: Partial<T>): Promise<DatabaseResponse<T>> {
    if (!this.isConnected) {
      return {
        success: false,
        error: 'Database not connected'
      };
    }

    try {
      // First find the document to get its ID
      const findResponse = await this.findOne<T>(collection, query);
      
      if (!findResponse.success || !findResponse.data) {
        return {
          success: false,
          error: 'Document not found'
        };
      }

      const document = findResponse.data as any;
      const id = document._id || document.id;

      if (!id) {
        return {
          success: false,
          error: 'Document ID not found'
        };
      }

      let response;
      
      switch (collection) {
        case 'students':
          response = await apiService.updateStudent(id, update as any);
          break;
        case 'teachers':
          response = await apiService.updateTeacher(id, update as any);
          break;
        case 'reports':
          response = await apiService.updateReport(id, update as any);
          break;
        case 'schools':
          response = await apiService.updateSchool(id, update as any);
          break;
        case 'users':
          response = await apiService.updateUser(id, update as any);
          break;
        default:
          throw new Error(`Unsupported collection: ${collection}`);
      }

      if (response.success && response.data) {
        return {
          success: true,
          data: response.data as T
        };
      } else {
        return {
          success: false,
          error: response.error || 'Update operation failed'
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Update operation failed'
      };
    }
  }

  async delete(collection: string, query: any): Promise<DatabaseResponse<boolean>> {
    if (!this.isConnected) {
      return {
        success: false,
        error: 'Database not connected'
      };
    }

    try {
      // First find the document to get its ID
      const findResponse = await this.findOne(collection, query);
      
      if (!findResponse.success || !findResponse.data) {
        return {
          success: false,
          error: 'Document not found'
        };
      }

      const document = findResponse.data as any;
      const id = document._id || document.id;

      if (!id) {
        return {
          success: false,
          error: 'Document ID not found'
        };
      }

      let response;
      
      switch (collection) {
        case 'students':
          response = await apiService.deleteStudent(id);
          break;
        case 'teachers':
          response = await apiService.deleteTeacher(id);
          break;
        case 'reports':
          response = await apiService.deleteReport(id);
          break;
        case 'schools':
          response = await apiService.deleteSchool(id);
          break;
        case 'users':
          response = await apiService.deleteUser(id);
          break;
        default:
          throw new Error(`Unsupported collection: ${collection}`);
      }

      if (response.success) {
        return {
          success: true,
          data: true
        };
      } else {
        return {
          success: false,
          error: response.error || 'Delete operation failed'
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Delete operation failed'
      };
    }
  }

  async count(collection: string, query: any = {}): Promise<DatabaseResponse<number>> {
    if (!this.isConnected) {
      return {
        success: false,
        error: 'Database not connected'
      };
    }

    try {
      const findResponse = await this.find(collection, query);
      
      if (findResponse.success) {
        return {
          success: true,
          data: findResponse.count || 0
        };
      } else {
        return {
          success: false,
          error: findResponse.error || 'Count operation failed'
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Count operation failed'
      };
    }
  }

  async aggregate<T>(collection: string, pipeline: any[]): Promise<DatabaseResponse<T[]>> {
    if (!this.isConnected) {
      return {
        success: false,
        error: 'Database not connected'
      };
    }

    try {
      // For now, we'll implement basic aggregation operations
      // In production, this should be handled by the backend API
      
      const findResponse = await this.find(collection);
      
      if (!findResponse.success || !findResponse.data) {
        return {
          success: false,
          error: 'Aggregation failed - no data available'
        };
      }

      let results = findResponse.data as any[];

      // Apply pipeline operations (simplified)
      for (const stage of pipeline) {
        if (stage.$match) {
          results = results.filter(item => this.matchesQuery(item, stage.$match));
        }
        if (stage.$group) {
          results = this.simulateGroup(results, stage.$group);
        }
        if (stage.$sort) {
          results = this.sortResults(results, stage.$sort);
        }
        if (stage.$limit) {
          results = results.slice(0, stage.$limit);
        }
      }

      return {
        success: true,
        data: results as T[]
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Aggregation failed'
      };
    }
  }

  // Helper methods
  private matchesQuery(item: any, query: any): boolean {
    for (const [key, value] of Object.entries(query)) {
      if (item[key] !== value) {
        return false;
      }
    }
    return true;
  }

  private sortResults(results: any[], sort: { [key: string]: 1 | -1 }): any[] {
    return results.sort((a, b) => {
      for (const [key, direction] of Object.entries(sort)) {
        if (a[key] < b[key]) return direction === 1 ? -1 : 1;
        if (a[key] > b[key]) return direction === 1 ? 1 : -1;
      }
      return 0;
    });
  }

  private simulateGroup(results: any[], group: any): any[] {
    // Simplified group simulation
    const grouped: { [key: string]: any[] } = {};
    
    for (const item of results) {
      const groupKey = group._id ? item[group._id] : 'default';
      if (!grouped[groupKey]) {
        grouped[groupKey] = [];
      }
      grouped[groupKey].push(item);
    }

    return Object.entries(grouped).map(([key, items]) => {
      const result: any = { _id: key };
      
      for (const [field, operation] of Object.entries(group)) {
        if (field === '_id') continue;
        
        if (operation === '$sum') {
          result[field] = items.reduce((sum, item) => sum + (item[field] || 0), 0);
        } else if (operation === '$avg') {
          result[field] = items.reduce((sum, item) => sum + (item[field] || 0), 0) / items.length;
        } else if (operation === '$count') {
          result[field] = items.length;
        }
      }
      
      return result;
    });
  }

  async close(): Promise<void> {
    this.isConnected = false;
    console.log('Database service connection closed');
  }
}

// Export singleton instance
export const databaseService = new DatabaseService();
export default databaseService; 