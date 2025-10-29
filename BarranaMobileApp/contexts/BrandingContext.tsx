import React, { createContext, useState, useEffect, useContext, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiService from '../apiService';

export interface SchoolBranding {
  schoolId: string;
  schoolName: string;
  logo: string | null;
  branding: {
    primaryColor: string;
    secondaryColor: string;
  };
}

interface BrandingContextType {
  branding: SchoolBranding | null;
  loading: boolean;
  error: string | null;
  refreshBranding: () => Promise<void>;
}

const BrandingContext = createContext<BrandingContextType | undefined>(undefined);

const DEFAULT_BRANDING: SchoolBranding = {
  schoolId: '',
  schoolName: 'School',
  logo: null,
  branding: {
    primaryColor: '#667eea',
    secondaryColor: '#764ba2',
  },
};

interface BrandingProviderProps {
  children: ReactNode;
  schoolId?: string;
}

export const BrandingProvider: React.FC<BrandingProviderProps> = ({ children, schoolId }) => {
  const [branding, setBranding] = useState<SchoolBranding | null>(DEFAULT_BRANDING);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadBranding = async () => {
    try {
      setLoading(true);
      setError(null);

      // Try to load from cache first
      const cached = await AsyncStorage.getItem('school_branding');
      if (cached) {
        setBranding(JSON.parse(cached));
      }

      // Fetch from API
      const response = await apiService.makeRequest<{ success: boolean; data: SchoolBranding }>(
        '/parents/me/school-branding'
      );

      if (response.success && response.data) {
        setBranding(response.data);
        // Cache the branding
        await AsyncStorage.setItem('school_branding', JSON.stringify(response.data));
      } else {
        throw new Error('Failed to load branding');
      }
    } catch (err: any) {
      console.error('Error loading branding:', err);
      setError(err.message || 'Failed to load school branding');
      // Use default branding on error
      setBranding(DEFAULT_BRANDING);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBranding();
  }, [schoolId]);

  const refreshBranding = async () => {
    await loadBranding();
  };

  return (
    <BrandingContext.Provider value={{ branding, loading, error, refreshBranding }}>
      {children}
    </BrandingContext.Provider>
  );
};

export const useBranding = (): BrandingContextType => {
  const context = useContext(BrandingContext);
  if (context === undefined) {
    throw new Error('useBranding must be used within a BrandingProvider');
  }
  return context;
};

