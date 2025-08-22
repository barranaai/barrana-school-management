import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import { apiService, User as ApiUser, LoginCredentials as ApiLoginCredentials } from '../services/apiService';

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
  role: 'teacher' | 'parent' | 'school_admin' | 'super_admin';
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
  console.log('AuthContext - Reducer called with action:', action);
  console.log('AuthContext - Reducer current state:', state);
  
  switch (action.type) {
    case 'AUTH_START':
      console.log('AuthContext - Processing AUTH_START');
      return {
        ...state,
        isLoading: true,
        error: null,
      };
    case 'AUTH_SUCCESS':
      console.log('AuthContext - Processing AUTH_SUCCESS with payload:', action.payload);
      const newState = {
        ...state,
        user: action.payload.user,
        token: action.payload.token,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      };
      console.log('AuthContext - AUTH_SUCCESS new state:', newState);
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
  logout: () => void;
  clearError: () => void;
  updateUser: (userData: Partial<User>) => void;
}>({
  ...initialState,
  login: async () => {},
  logout: () => {},
  clearError: () => {},
  updateUser: () => {},
});

// Provider
export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);
  
  // Debug: Log state changes
  useEffect(() => {
    console.log('AuthContext - State updated:', state);
  }, [state]);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const token = storage.getItem('token');
        console.log('AuthContext - Checking auth, token exists:', !!token);
        
        if (token) {
          // Set token in apiService
          apiService.setToken(token);
          console.log('AuthContext - Token set in apiService');
          
          // Verify token with API with timeout
          const response = await Promise.race([
            apiService.getCurrentUser(),
            new Promise<never>((_, reject) => 
              setTimeout(() => reject(new Error('Auth timeout')), 5000)
            )
          ]) as any;
          
          if (response.success && response.data) {
            console.log('AuthContext - API response successful:', response.data);
            console.log('AuthContext - API response data structure:', {
              hasUser: !!response.data.user,
              hasDirectProps: !!response.data.id,
              keys: Object.keys(response.data)
            });
            const apiUser = response.data.user || response.data; // Handle both response structures
            
            // Convert API user to our User interface
            const user: User = {
              _id: apiUser.id || (apiUser as any)._id,
              id: apiUser.id || (apiUser as any)._id, // For backward compatibility
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
            };
            
            console.log('AuthContext - API user schoolId:', apiUser.schoolId);
            console.log('AuthContext - Created user schoolId:', user.schoolId);
            
            console.log('AuthContext - Final user object:', user);
            console.log('AuthContext - Dispatching AUTH_SUCCESS with user:', user);
            console.log('AuthContext - About to dispatch with payload:', { user, token });
            
            try {
              dispatch({
                type: 'AUTH_SUCCESS',
                payload: { user, token },
              });
              console.log('AuthContext - Dispatch completed successfully');
            } catch (error) {
              console.error('AuthContext - Dispatch error:', error);
            }
                            } else {
            // Token is invalid, clear storage
            console.log('AuthContext - Token is invalid, clearing storage');
            storage.removeItem('token');
            storage.removeItem('user');
            dispatch({ type: 'LOGOUT' });
          }
        } else {
          // No token found, set loading to false
          console.log('AuthContext - No token found, dispatching LOGOUT');
          dispatch({ type: 'LOGOUT' });
        }
    } catch (error) {
      console.error('Auth check failed:', error);
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
      
      // Convert API user to our User interface
      const user: User = {
        _id: apiUser.id || (apiUser as any)._id,
        id: apiUser.id || (apiUser as any)._id, // For backward compatibility
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
      };
      
      console.log('AuthContext - API user schoolId:', apiUser.schoolId);
      console.log('AuthContext - Created user schoolId:', user.schoolId);
      console.log('AuthContext - Full API user object:', apiUser);
      console.log('AuthContext - Full created user object:', user);

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

  const logout = async () => {
    try {
      // Call API logout endpoint
      await apiService.logout();
    } catch (error) {
      console.error('Error during logout:', error);
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