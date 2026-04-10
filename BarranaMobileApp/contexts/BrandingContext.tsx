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
  userRole?: 'teacher' | 'parent' | string;
}

export const BrandingProvider: React.FC<BrandingProviderProps> = ({ children, schoolId, userRole }) => {
  const [branding, setBranding] = useState<SchoolBranding | null>(DEFAULT_BRANDING);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<any>({
    primaryEndpoint: '',
    primaryStatus: '',
    fallbackStatus: '',
    schoolId: schoolId || 'NOT SET',
    userRole: userRole || 'NOT SET',
  });

  const loadBranding = async () => {
    try {
      setLoading(true);
      setError(null);

      // Try to load from cache first
      try {
        const cached = await AsyncStorage.getItem('school_branding');
        if (cached) {
          const parsed = JSON.parse(cached);
          setBranding(parsed);
          console.log('📱 Loaded branding from cache');
        }
      } catch (cacheError) {
        console.warn('📱 Failed to load cached branding:', cacheError);
      }

      // Don't fetch if no user role
      if (!userRole) {
        console.log('📱 No user role, using default branding');
        setBranding(DEFAULT_BRANDING);
        setLoading(false);
        return;
      }

      // Determine endpoint based on user role
      let endpoint = '/parents/me/school-branding';
      if (userRole === 'teacher') {
        endpoint = '/teachers/me/school-branding';
      }

      console.log('📱 Loading branding from:', endpoint, 'Role:', userRole);
      
      setDebugInfo(prev => ({
        ...prev,
        primaryEndpoint: endpoint,
        primaryStatus: 'CALLING...',
      }));

      // Fetch from API using the apiService method (with timeout)
      let response = await Promise.race([
        apiService.getSchoolBranding(endpoint),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Branding fetch timeout')), 10000)
        )
      ]) as { success: boolean; data?: any; error?: string };

      console.log('📱 FULL API RESPONSE:', JSON.stringify(response, null, 2));
      
      setDebugInfo(prev => ({
        ...prev,
        primaryStatus: response.success ? 'SUCCESS' : `FAILED: ${response.error || 'Unknown'}`,
        primaryResponse: JSON.stringify(response, null, 2),
      }));

      // FALLBACK: If endpoint fails, try to get school data directly (like web app does)
      if (!response.success || !response.data) {
        console.warn('📱 Primary endpoint failed, trying fallback to /schools/{schoolId}');
        
        if (schoolId) {
          try {
            const schoolResponse = await apiService.getSchool(schoolId);
            if (schoolResponse) {
              console.log('📱 Fallback school data:', schoolResponse);
              const brandingData = {
                schoolId: schoolResponse._id || schoolResponse.id,
                schoolName: schoolResponse.name,
                logo: schoolResponse.logo || schoolResponse.branding?.logo,
                branding: {
                  primaryColor: schoolResponse.branding?.primaryColor || '#667eea',
                  secondaryColor: schoolResponse.branding?.secondaryColor || '#764ba2'
                }
              };
              response = { success: true, data: brandingData };
              console.log('📱 Using fallback branding:', brandingData);
            }
          } catch (fallbackError) {
            console.error('📱 Fallback also failed:', fallbackError);
          }
        }
      }

      if (response.success && response.data) {
        console.log('📱 Branding loaded successfully:', JSON.stringify(response.data, null, 2));
        console.log('📱 Primary Color:', response.data.branding?.primaryColor);
        console.log('📱 Secondary Color:', response.data.branding?.secondaryColor);
        console.log('📱 School Name:', response.data.schoolName);
        console.log('📱 Logo:', response.data.logo);
        setBranding(response.data);
        // Cache the branding
        try {
          await AsyncStorage.setItem('school_branding', JSON.stringify(response.data));
        } catch (cacheError) {
          console.warn('📱 Failed to cache branding:', cacheError);
        }
      } else {
        console.warn('📱 All branding fetch attempts failed, using default');
        setBranding(DEFAULT_BRANDING);
      }
    } catch (err: any) {
      console.error('📱 Error loading branding:', err);
      setError(err.message || 'Failed to load school branding');
      // Always use default branding on error - don't crash
      setBranding(DEFAULT_BRANDING);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userRole) {
      loadBranding();
    }
  }, [schoolId, userRole]);

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

