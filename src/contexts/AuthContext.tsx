import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import { apiService } from '../services/apiService';

// Use localStorage for web app instead of AsyncStorage
const storage = {
  getItem: (key: string) => {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem: (key: string, value: string) => {
    try {
      localStorage.setItem(key, value);
    } catch {
      // Fallback for environments without localStorage
    }
  },
  removeItem: (key: string) => {
    try {
      localStorage.removeItem(key);
    } catch {
      // Fallback for environments without localStorage
    }
  }
};

// Types
export interface User {
  _id: string;
  id?: string; // For backward compatibility
  firstName: string;
  lastName: string;
  email: string;
  role: 'teacher' | 'parent' | 'student' | 'school_admin' | 'super_admin';
  schoolId?: string | { _id: string; name: string; [key: string]: any };
  isEmailVerified: boolean;
  preferences?: {
    language: string;
    timezone: string;
    notifications: {
      email: boolean;
      push: boolean;
      sms: boolean;
    };
  };
  lastLogin?: string;
  lastActivity?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

export interface LoginCredentials {
  email: string;
  password: string;
  role?: string;
}

const mapApiUser = (apiUser: any): User => ({
  _id: apiUser.id || apiUser._id,
  id: apiUser.id || apiUser._id,
  firstName: apiUser.firstName,
  lastName: apiUser.lastName,
  email: apiUser.email,
  role: apiUser.role,
  schoolId: apiUser.schoolId,
  isEmailVerified: apiUser.isEmailVerified,
  preferences: apiUser.preferences,
  lastLogin: apiUser.lastLogin,
  lastActivity: apiUser.lastActivity,
  createdAt: apiUser.createdAt,
  updatedAt: apiUser.updatedAt
});

// Action types
type AuthAction =
  | { type: 'AUTH_START' }
  | { type: 'AUTH_SUCCESS'; payload: { user: User; token: string } }
  | { type: 'AUTH_FAILURE'; payload: string }
  | { type: 'LOGOUT' }
  | { type: 'CLEAR_ERROR' }
  | { type: 'UPDATE_USER'; payload: Partial<User> };

// Initial state
const initialState: AuthState = {
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,
};

// Reducer
const authReducer = (state: AuthState, action: AuthAction): AuthState => {
  switch (action.type) {
    case 'AUTH_START':
      return {
        ...state,
        isLoading: true,
        error: null,
      };
    case 'AUTH_SUCCESS':
      const newState = {
        ...state,
        user: action.payload.user,
        token: action.payload.token,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      };
      return newState;
    case 'AUTH_FAILURE':
      return {
        ...state,
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
        error: action.payload,
      };
    case 'LOGOUT':
      return {
        ...state,
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      };
    case 'CLEAR_ERROR':
      return {
        ...state,
        error: null,
      };
    case 'UPDATE_USER':
      return {
        ...state,
        user: state.user ? { ...state.user, ...action.payload } : null,
      };
    default:
      return state;
  }
};

// Context
const AuthContext = createContext<AuthState & {
  login: (credentials: LoginCredentials) => Promise<void>;
  authenticateWithToken: (token: string) => Promise<User>;
  logout: () => void;
  clearError: () => void;
  updateUser: (userData: Partial<User>) => void;
}>({
  ...initialState,
  login: async () => {},
  authenticateWithToken: async () => { throw new Error('Authentication is unavailable'); },
  logout: () => {},
  clearError: () => {},
  updateUser: () => {},
});

// Provider
export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);
  

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const token = storage.getItem('token');
        if (token) {
          // Set token in apiService
          apiService.setToken(token);
          // Verify token with API with timeout
          const response = await Promise.race([
            apiService.getCurrentUser(),
            new Promise<never>((_, reject) => 
              setTimeout(() => reject(new Error('Auth timeout')), 5000)
            )
          ]) as any;
          
          if (response.success && response.data) {
            const apiUser = response.data.user || response.data; // Handle both response structures
            
            // Convert API user to our User interface
            const user = mapApiUser(apiUser);
            try {
              dispatch({
                type: 'AUTH_SUCCESS',
                payload: { user, token },
              });
            } catch {
              console.error('Authentication state update failed');
            }
                            } else {
            // Token is invalid, clear storage
            storage.removeItem('token');
            storage.removeItem('user');
            dispatch({ type: 'LOGOUT' });
          }
        } else {
          // No token found, set loading to false
          dispatch({ type: 'LOGOUT' });
        }
    } catch {
      console.error('Authentication check failed');
      // Clear storage on error
      storage.removeItem('token');
      storage.removeItem('user');
      dispatch({ type: 'LOGOUT' });
    }
    };

    checkAuth();
  }, []);

  const login = async (credentials: LoginCredentials) => {
    dispatch({ type: 'AUTH_START' });

    try {
      // Use real API for authentication
      const response = await apiService.login({
        email: credentials.email,
        password: credentials.password
      });

      if (!response.success || !response.data) {
        throw new Error(response.error || 'Login failed');
      }

      const { user: apiUser, token } = response.data;
      
      const user = mapApiUser(apiUser);
      // Store token
      storage.setItem('token', token);
      storage.setItem('user', JSON.stringify(user));
      
      // Set token in apiService
      apiService.setToken(token);

      dispatch({ 
        type: 'AUTH_SUCCESS', 
        payload: { user, token } 
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Login failed';
      dispatch({ type: 'AUTH_FAILURE', payload: errorMessage });
      throw error;
    }
  };

  const authenticateWithToken = async (token: string): Promise<User> => {
    dispatch({ type: 'AUTH_START' });
    apiService.setToken(token);

    try {
      const response = await apiService.getCurrentUser();
      if (!response.success || !response.data) {
        throw new Error('Unable to confirm the new account');
      }

      const apiUser = (response.data as any).user || response.data;
      const user = mapApiUser(apiUser);
      storage.setItem('token', token);
      storage.setItem('user', JSON.stringify(user));
      dispatch({ type: 'AUTH_SUCCESS', payload: { user, token } });
      return user;
    } catch (error) {
      apiService.clearToken();
      storage.removeItem('token');
      storage.removeItem('user');
      dispatch({ type: 'AUTH_FAILURE', payload: 'Unable to confirm the new account' });
      throw error;
    }
  };

  const logout = async () => {
    try {
      // Call API logout endpoint
      await apiService.logout();
    } catch {
      console.error('Logout request failed');
    } finally {
      // Clear local storage regardless of API call success
      storage.removeItem('token');
      storage.removeItem('user');
      apiService.clearToken();
      dispatch({ type: 'LOGOUT' });
      
      // Force navigation to login page
      window.location.href = '/login';
    }
  };

  const clearError = () => {
    dispatch({ type: 'CLEAR_ERROR' });
  };

  const updateUser = (userData: Partial<User>) => {
    dispatch({ type: 'UPDATE_USER', payload: userData });
  };

  return (
    <AuthContext.Provider
      value={{
        ...state,
        login,
        authenticateWithToken,
        logout,
        clearError,
        updateUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}; 