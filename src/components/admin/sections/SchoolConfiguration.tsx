import React, { useState, useEffect } from 'react';
import { useData } from '../../../contexts/DataContext';
import { useAuth } from '../../../contexts/AuthContext';
import { REPORT_FREQUENCIES } from '../../../constants/reportFrequencies';
import { reportTemplateService, type ReportTemplate, type CreateReportTemplateData } from '../../../services/reportTemplateService';
import apiService from '../../../services/apiService';
import { schoolService } from '../../../services/schoolService';
import { useNavigate } from 'react-router-dom';
import FrequencyConfiguration from './FrequencyConfiguration';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Switch,
  FormControlLabel,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Container,
  Fade,
  Grow,
  CircularProgress,
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
  Visibility,
  ColorLens,
  Description,
  Login as LoginIcon,
  CloudUpload,
  Delete as DeleteIcon,
  Schedule,
  WhatsApp,
  Email,
  Sms,
  Settings,
} from '@mui/icons-material';
import { themeColors } from '../../../theme/adminTheme';
import NotificationIcon from '../../common/NotificationIcon';
import {
  formatGradeForDisplay,
  getGradeDisplayNamesForSchoolType,
  getGradeCodesForSchoolType,
  formatGradesForDisplay
} from '../../../utils/gradeDisplayUtils';

interface SchoolConfigurationProps {
  schoolBranding?: any;
}

const SchoolConfiguration: React.FC<SchoolConfigurationProps> = ({ schoolBranding }) => {
  const { school } = useData();
  const { user, isAuthenticated, token } = useAuth();
  const navigate = useNavigate();
  const [openTemplateDialog, setOpenTemplateDialog] = useState(false);
  const [openBrandingDialog, setOpenBrandingDialog] = useState(false);
  const [openCommunicationDialog, setOpenCommunicationDialog] = useState(false);
  const [schoolLogo, setSchoolLogo] = useState<string | null>(null);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [brandingForm, setBrandingForm] = useState({
    primaryColor: '#1976d2',
    secondaryColor: '#dc004e'
  });
  const [isSavingBranding, setIsSavingBranding] = useState(false);
  const [communicationForm, setCommunicationForm] = useState({
    whatsapp: {
      enabled: false,
      phoneNumber: '',
      twilioAccountSid: '',
      twilioAuthToken: '',
      displayName: ''
    },
    email: {
      enabled: true,
      fromName: '',
      fromEmail: '',
      replyTo: ''
    },
    sms: {
      enabled: false,
      phoneNumber: '',
      twilioAccountSid: '',
      twilioAuthToken: ''
    }
  });
  const [isSavingCommunication, setIsSavingCommunication] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<ReportTemplate | null>(null);
  const [reportTemplates, setReportTemplates] = useState<ReportTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [formData, setFormData] = useState<CreateReportTemplateData>({
    name: '',
    grade: '',
    reportFrequency: 'Monthly',
    content: '',
    isActive: true
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isSuperAdmin = user?.role === 'super_admin';
  const isSchoolAdmin = user?.role === 'school_admin';
  const [superAdminSchools, setSuperAdminSchools] = useState<Array<{ _id: string; name: string; settings?: any }>>([]);
  const [selectedSchoolId, setSelectedSchoolId] = useState<string>('');
  const [selectedSchoolGrades, setSelectedSchoolGrades] = useState<string[]>([]);
  const [localSchoolSettings, setLocalSchoolSettings] = useState<any>({});

  // Helper to get the current school ID (works for both Super Admin and School Admin)
  const getCurrentSchoolId = () => {
    if (isSuperAdmin) {
      return selectedSchoolId;
    }
    return school?.id || '';
  };

  // Helper to display grade labels in Proper Case from various formats (snake_case, kebab-case, camelCase)
  const toProperCase = (raw: string): string => {
    if (!raw) return '';
    const spaced = raw
      .replace(/[_-]+/g, ' ') // snake/kebab to spaces
      .replace(/([a-z])([A-Z])/g, '$1 $2'); // camelCase split
    return spaced.replace(/\b\w/g, (c) => c.toUpperCase());
  };

  // Get all possible grade display names from all school types (fallback when no school grades available)
  // Use centralized utility to ensure consistency
  const getAllPossibleGradeDisplays = (): string[] => {
    const allGrades = new Set<string>();
    
    // Get grades from all school types
    ['licensed_daycare', 'montessori_school', 'public_private_school'].forEach(schoolType => {
      const displayNames = getGradeDisplayNamesForSchoolType(schoolType);
      displayNames.forEach(grade => allGrades.add(grade));
    });
    
    return Array.from(allGrades).sort();
  };
  
  const DEFAULT_GRADE_OPTIONS: string[] = getAllPossibleGradeDisplays();

  // Get grade options based on user role and selected school
  // Use centralized utility to ensure consistent formatting
  const getGradeOptions = (): string[] => {
    if (isSuperAdmin) {
      // For super admin, use selected school's grades if available
      if (selectedSchoolGrades.length > 0) {
        // Format raw codes to display format using centralized utility
        return formatGradesForDisplay(selectedSchoolGrades);
      }
      // Fallback to default options (already in display format)
      return DEFAULT_GRADE_OPTIONS;
    } else {
      // For school admin, use current school's grades if available
      if (school?.gradeLevels && school.gradeLevels.length > 0) {
        // Format raw codes to display format using centralized utility
        return formatGradesForDisplay(school.gradeLevels);
      }
      // Fallback to default options (already in display format)
      return DEFAULT_GRADE_OPTIONS;
    }
  };

  // Debug logging
  useEffect(() => {
    console.log('🔍 ReportConfiguration - Component mounted');
    console.log('🔍 ReportConfiguration - Auth state:', { isAuthenticated, user, token });
    console.log('🔍 ReportConfiguration - School data:', school);
  }, [isAuthenticated, user, token, school]);

  // Load report templates
  useEffect(() => {
    const loadReportTemplates = async () => {
      try {
        console.log('🔍 ReportConfiguration - Loading report templates...');
        console.log('🔍 ReportConfiguration - Authentication state:', { isAuthenticated, token });
        console.log('🔍 ReportConfiguration - School ID:', school?.id);
        
        if (!isAuthenticated || !token) {
          console.error('❌ ReportConfiguration - Not authenticated or no token');
          setError('Authentication required. Please log in to access report templates.');
          setIsLoading(false);
          return;
        }

        setIsLoading(true);
        setError(null);
        
        // Determine schoolId
        const schoolId = isSuperAdmin ? selectedSchoolId : school?.id;
        console.log('🔍 ReportConfiguration - Calling service with schoolId:', schoolId);
        
        const response = await reportTemplateService.getReportTemplates(schoolId);
        console.log('🔍 ReportConfiguration - Service response:', response);
        
        if (response.success && response.data) {
          console.log('✅ ReportConfiguration - Templates loaded successfully:', response.data);
          setReportTemplates(response.data);
          setError(null); // Clear any previous errors
        } else {
          console.error('❌ ReportConfiguration - Service returned error:', response);
          setError(response.message || 'Failed to load report templates');
        }
      } catch (err) {
        console.error('❌ ReportConfiguration - Error loading report templates:', err);
        setError('Error loading report templates. Please check your connection and try again.');
      } finally {
        setIsLoading(false);
      }
    };

    loadReportTemplates();
  }, [isAuthenticated, token, school?.id, selectedSchoolId]);

  // Load schools for super admin
  useEffect(() => {
    const loadSchools = async () => {
      if (!isSuperAdmin) return;
      try {
        const resp = await apiService.getSchools();
        const list = (resp.data || []).map((s: any) => ({ 
          _id: s._id || s.id, 
          name: s.name,
          settings: s.settings || {}
        }));
        setSuperAdminSchools(list);
        if (!selectedSchoolId && list.length > 0) {
          setSelectedSchoolId(list[0]._id);
        }
      } catch (e) {
        console.error('Failed to load schools for super admin', e);
      }
    };
    loadSchools();
  }, [isSuperAdmin]);

  // Load selected school details (grades) for super admin
  useEffect(() => {
    const loadSelectedSchoolDetails = async () => {
      if (!isSuperAdmin || !selectedSchoolId) {
        console.log('🐛 Skipping school details load - isSuperAdmin:', isSuperAdmin, 'selectedSchoolId:', selectedSchoolId);
        return;
      }
      try {
        console.log('🐛 Loading school details for selectedSchoolId:', selectedSchoolId);
        const resp = await apiService.getSchools();
        console.log('🐛 All schools response:', resp.data);
        const school = (resp.data || []).find((s: any) => (s._id || s.id) === selectedSchoolId);
        console.log('🐛 Found selected school:', school);
        if (school && school.gradeLevels) {
          console.log('🐛 Setting school grades:', school.gradeLevels);
          setSelectedSchoolGrades(school.gradeLevels);
        } else {
          console.log('🐛 No grades found for school, using empty array');
          // Fallback to default grades if school has no specific grades
          setSelectedSchoolGrades([]);
        }
        
        // Update local school settings
        if (school && (school as any).settings) {
          setLocalSchoolSettings((school as any).settings);
        } else {
          setLocalSchoolSettings({});
        }
      } catch (e) {
        console.error('🐛 Failed to load school details', e);
        setSelectedSchoolGrades([]);
        setLocalSchoolSettings({});
      }
    };
    loadSelectedSchoolDetails();
  }, [isSuperAdmin, selectedSchoolId]);

  // Load school logo on component mount
  useEffect(() => {
    if (isAuthenticated && school?.id) {
      console.log('Loading school logo for school ID:', school.id);
      loadSchoolLogo();
    }
  }, [isAuthenticated, school?.id]);

  // Initialize local school settings for school admins
  useEffect(() => {
    console.log('🔵 SchoolConfiguration - Initializing local settings');
    console.log('   isSchoolAdmin:', isSchoolAdmin);
    console.log('   school?.id:', school?.id);
    console.log('   school?.settings:', school?.settings);
    console.log('   school?.settings?.reportFrequencies?.Daily:', school?.settings?.reportFrequencies?.Daily);
    
    if (isSchoolAdmin && school?.settings && Object.keys(school.settings).length > 0) {
      console.log('✅ Setting local school settings from school.settings');
      setLocalSchoolSettings(school.settings);
    } else {
      console.log('⚠️  Not setting local settings - missing isSchoolAdmin or school.settings or settings is empty');
    }
  }, [isSchoolAdmin, school?.id, JSON.stringify(school?.settings)]);

  // Show authentication error message
  if (!isAuthenticated || !token) {
    return (
      <Box>
        <Typography variant="h4" gutterBottom>
          Report & Template Configuration
        </Typography>
        
        <Alert severity="warning" sx={{ mb: 3 }}>
          <Typography variant="body1">
            You need to be logged in to access report templates. Please log in with your credentials.
          </Typography>
          <Typography variant="body2" sx={{ mt: 1 }}>
            Demo credentials: alex.chen@barrana.ai / demo123 (Super Admin)
          </Typography>
          <Box sx={{ mt: 2 }}>
            <Button
              variant="contained"
              startIcon={<LoginIcon />}
              onClick={() => navigate('/login')}
            >
              Go to Login
            </Button>
          </Box>
        </Alert>
      </Box>
    );
  }

  // CRUD Operations
  const handleCreateTemplate = async () => {
    try {
      setIsSubmitting(true);
      
      // DEBUG: Log form data
      console.log('🐛 DEBUG - Form Data:', formData);
      console.log('🐛 DEBUG - Selected School ID:', selectedSchoolId);
      console.log('🐛 DEBUG - Is Super Admin:', isSuperAdmin);
      console.log('🐛 DEBUG - Current School:', school);
      
      const validation = reportTemplateService.validateTemplateData(formData);
      console.log('🐛 DEBUG - Validation Result:', validation);
      
      if (!validation.isValid) {
        setError(validation.errors.join(', '));
        return;
      }

      if (isSuperAdmin && !selectedSchoolId) {
        setError('Please select a school before creating a template.');
        return;
      }

      // Include schoolId when super admin uses this screen
      const payload = isSuperAdmin ? { ...formData, schoolId: selectedSchoolId } : (school?.id ? { ...formData, schoolId: school.id } : formData);
      console.log('🐛 DEBUG - Final Payload:', payload);
      
      const response = await reportTemplateService.createReportTemplate(payload as any);
      console.log('🐛 DEBUG - API Response:', response);
      
      if (response.success && response.data) {
        setReportTemplates(prev => [response.data!, ...prev]);
        setOpenTemplateDialog(false);
        resetForm();
        // Show success message
      } else {
        console.error('🐛 DEBUG - API Error Response:', response);
        setError(response.message || response.error || 'Failed to create template');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error creating template';
      console.error('🐛 DEBUG - Catch Error:', err);
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateTemplate = async () => {
    if (!selectedTemplate) return;

    try {
      setIsSubmitting(true);
      const validation = reportTemplateService.validateTemplateData(formData);
      
      if (!validation.isValid) {
        setError(validation.errors.join(', '));
        return;
      }

      const response = await reportTemplateService.updateReportTemplate({
        id: selectedTemplate._id,
        ...formData
      });
      
      if (response.success && response.data) {
        setReportTemplates(prev => 
          prev.map(template => 
            template._id === selectedTemplate._id ? response.data! : template
          )
        );
        setOpenTemplateDialog(false);
        resetForm();
        // Show success message
      } else {
        setError(response.message || 'Failed to update template');
      }
    } catch (err) {
      setError('Error updating template');
      console.error('Error updating template:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteTemplate = async (templateId: string) => {
    if (!window.confirm('Are you sure you want to delete this template?')) {
      return;
    }

    try {
      const response = await reportTemplateService.deleteReportTemplate(templateId);
      
      if (response.success) {
        setReportTemplates(prev => prev.filter(template => template._id !== templateId));
        // Show success message
      } else {
        setError(response.message || 'Failed to delete template');
      }
    } catch (err) {
      setError('Error deleting template');
      console.error('Error deleting template:', err);
    }
  };

  const handleToggleStatus = async (templateId: string) => {
    try {
      const response = await reportTemplateService.toggleTemplateStatus(templateId);
      
      if (response.success && response.data) {
        setReportTemplates(prev => 
          prev.map(template => 
            template._id === templateId ? response.data! : template
          )
        );
        // Show success message
      } else {
        setError(response.message || 'Failed to toggle template status');
      }
    } catch (err) {
      // Show specific message if backend prevented disabling the last active template
      const message = err instanceof Error ? err.message : 'Error toggling template status';
      setError(message.includes('At least one report frequency') ? message : 'Error toggling template status');
      console.error('Error toggling template status:', err);
    }
  };

  const handleEditTemplate = (template: ReportTemplate) => {
    setSelectedTemplate(template);
        setFormData({
          name: template.name,
          grade: template.grade,
          reportFrequency: template.reportFrequency,
          content: template.content,
          customFields: template.customFields,
          settings: template.settings,
          isActive: template.isActive
        });
    setOpenTemplateDialog(true);
  };

  const handleAddTemplate = () => {
    setSelectedTemplate(null);
    resetForm();
    setOpenTemplateDialog(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      grade: '',
      reportFrequency: 'Monthly',
      content: '',
      isActive: true
    });
    setError(null);
  };

  const handleFormChange = (field: keyof CreateReportTemplateData, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Load school branding from backend
  const loadSchoolBranding = async () => {
    const schoolId = getCurrentSchoolId();
    if (!schoolId) {
      console.log('Cannot load branding: school ID is missing');
      return;
    }
    
    try {
      console.log('Loading branding for school:', schoolId);
      const response = await apiService.request(`/schools/${schoolId}`, 'GET');
      console.log('Load branding response:', response);
      
      if (response.success && response.data.branding) {
        console.log('Branding data:', response.data.branding);
        setBrandingForm({
          primaryColor: response.data.branding.primaryColor || '#1976d2',
          secondaryColor: response.data.branding.secondaryColor || '#dc004e'
        });
        console.log('Branding form updated with:', {
          primaryColor: response.data.branding.primaryColor || '#1976d2',
          secondaryColor: response.data.branding.secondaryColor || '#dc004e'
        });
      } else {
        console.log('No branding data found, using defaults');
      }
    } catch (error) {
      console.error('Error loading school branding:', error);
    }
  };

  // Save branding settings
  const handleSaveBranding = async () => {
    const schoolId = getCurrentSchoolId();
    if (!schoolId) {
      setError('School ID not found. Please select a school first.');
      console.error('Cannot save branding: school ID is missing');
      return;
    }
    
    try {
      setIsSavingBranding(true);
      setError(null);
      setSuccess(null);
      
      console.log('Saving branding for school:', schoolId);
      console.log('Branding data:', brandingForm);
      
      const response = await apiService.request(`/schools/${schoolId}/branding`, 'PUT', brandingForm);
      
      console.log('Save branding response:', response);
      
      if (response.success) {
        setSuccess('Branding settings saved successfully!');
        console.log('Branding saved successfully');
        // Reload branding to confirm
        await loadSchoolBranding();
        // Don't close dialog immediately so user can see success message
        setTimeout(() => {
          setOpenBrandingDialog(false);
        }, 1500);
      } else {
        setError(response.message || 'Failed to save branding settings');
        console.error('Failed to save branding:', response);
      }
    } catch (error: any) {
      console.error('Error saving branding:', error);
      setError(error.message || 'Failed to save branding settings');
    } finally {
      setIsSavingBranding(false);
    }
  };

  // Load communication settings
  const loadCommunicationSettings = async () => {
    const schoolId = getCurrentSchoolId();
    if (!schoolId) {
      console.log('Cannot load communication settings: school ID is missing');
      return;
    }
    
    try {
      const response = await apiService.request(`/schools/${schoolId}`, 'GET');
      console.log('Load communication response:', response);
      
      if (response.success && response.data.communication) {
        console.log('Communication data:', response.data.communication);
        setCommunicationForm(response.data.communication);
      }
    } catch (error) {
      console.error('Error loading communication settings:', error);
    }
  };

  // Save communication settings
  const handleSaveCommunication = async () => {
    const schoolId = getCurrentSchoolId();
    if (!schoolId) {
      setError('School ID not found. Please select a school first.');
      console.error('School ID is missing - cannot save communication settings');
      return;
    }
    
    try {
      setIsSavingCommunication(true);
      setError(null);
      setSuccess(null);
      
      console.log('Saving communication settings for school:', schoolId);
      console.log('Communication data:', communicationForm);
      
      const response = await apiService.request(`/schools/${schoolId}/communication`, 'PUT', communicationForm);
      
      console.log('Save communication response:', response);
      
      if (response.success) {
        setSuccess('Communication settings saved successfully!');
        console.log('Communication settings saved successfully');
        await loadCommunicationSettings();
        setTimeout(() => {
          setOpenCommunicationDialog(false);
        }, 1500);
      } else {
        setError(response.message || 'Failed to save communication settings');
        console.error('Failed to save communication settings:', response);
      }
    } catch (error: any) {
      console.error('Error saving communication settings:', error);
      setError(error.message || 'Failed to save communication settings');
    } finally {
      setIsSavingCommunication(false);
    }
  };

  const brandingSettings = {
    schoolName: school?.name || 'Bright Future Academy',
    primaryColor: brandingForm.primaryColor,
    secondaryColor: brandingForm.secondaryColor,
    logo: schoolLogo || '/logo.png',
    fontFamily: 'Segoe UI',
    fontSize: '14px',
  };

  // Logo upload functions
  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    console.log('🖼️ Logo upload triggered');
    console.log('Event:', event);
    console.log('Files:', event.target.files);
    
    const file = event.target.files?.[0];
    
    if (!file) {
      console.log('❌ No file selected');
      return;
    }
    
    const schoolId = getCurrentSchoolId();
    if (!schoolId) {
      console.error('❌ School ID is missing');
      setError('School ID not found. Please select a school first.');
      return;
    }

    console.log('📁 File selected:', {
      name: file.name,
      size: file.size,
      type: file.type
    });
    console.log('🏫 School ID:', schoolId);

    try {
      setIsUploadingLogo(true);
      setError(null);
      setSuccess(null);
      
      const formData = new FormData();
      formData.append('logo', file);

      const apiUrl = `${process.env.REACT_APP_API_URL || 'http://localhost:5050/api'}/schools/${schoolId}/logo`;
      console.log('📤 Uploading to:', apiUrl);

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      const result = await response.json();
      console.log('📥 Upload response:', result);

      if (result.success) {
        console.log('✅ Logo uploaded successfully!');
        console.log('🖼️ Logo URL:', result.data.logoUrl);
        setSchoolLogo(result.data.logoUrl);
        setSuccess('School logo uploaded successfully!');
      } else {
        setError(result.message || 'Failed to upload logo');
        console.error('❌ Upload failed:', result);
      }
    } catch (error: any) {
      setError(error.message || 'Error uploading logo');
      console.error('❌ Upload error:', error);
    } finally {
      setIsUploadingLogo(false);
      // Reset file input
      event.target.value = '';
    }
  };

  const handleLogoDelete = async () => {
    const schoolId = getCurrentSchoolId();
    if (!schoolId) {
      setError('School ID not found. Please select a school first.');
      return;
    }
    
    if (!window.confirm('Are you sure you want to delete the school logo?')) return;

    try {
      setError(null);
      const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:5050/api'}/schools/${schoolId}/logo`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const result = await response.json();

      if (result.success) {
        setSchoolLogo(null);
        setSuccess('School logo deleted successfully');
        console.log('Logo deleted successfully');
      } else {
        setError(result.message || 'Failed to delete logo');
        console.error('Failed to delete logo:', result.message);
      }
    } catch (error: any) {
      setError(error.message || 'Error deleting logo');
      console.error('Error deleting logo:', error);
    }
  };

  // Load school branding and logo on component mount
  React.useEffect(() => {
    const schoolId = getCurrentSchoolId();
    if (schoolId) {
      loadSchoolBranding();
      loadSchoolLogo();
      loadCommunicationSettings();
    }
  }, [school?.id, selectedSchoolId]);

  const loadSchoolLogo = async () => {
    const schoolId = getCurrentSchoolId();
    if (!schoolId) return;

    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL || 'http://localhost:5050/api'}/schools/${schoolId}/logo`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const result = await response.json();

      if (result.success && result.data.logoUrl) {
        console.log('Logo URL received:', result.data.logoUrl);
        setSchoolLogo(result.data.logoUrl);
      }
    } catch (error) {
      console.error('Error loading school logo:', error);
    }
  };

  const getRandomCardColor = (index: number) => {
    return themeColors.cardColors[index % themeColors.cardColors.length];
  };

  return (
    <Container maxWidth="xl">
      {schoolBranding && (
        <Fade in timeout={600}>
          <Paper
            elevation={0}
            sx={{
              background: `linear-gradient(135deg, ${schoolBranding.branding?.primaryColor || schoolBranding.primaryColor || '#273890'} 0%, ${schoolBranding.branding?.secondaryColor || schoolBranding.secondaryColor || '#7f0f4a'} 100%)`,
              borderRadius: 4,
              p: 3,
              mb: 4,
              mt: 0,
              color: 'white',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} md={9}>
                <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
                  {schoolBranding.name || 'School Name'}
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center' }}>
                  {schoolBranding.established && (
                    <Typography variant="body2" sx={{ opacity: 0.95 }}>
                      📅 Est. {schoolBranding.established}
                    </Typography>
                  )}
                {schoolBranding.address && (
                  <Typography variant="body2" sx={{ opacity: 0.95 }}>
                    📍 {typeof schoolBranding.address === 'string' 
                      ? schoolBranding.address 
                      : `${schoolBranding.address.street}, ${schoolBranding.address.city}, ${schoolBranding.address.state}`}
                  </Typography>
                )}
                  {schoolBranding.email && (
                    <Typography variant="body2" sx={{ opacity: 0.95 }}>
                      ✉️ {schoolBranding.email}
                    </Typography>
                  )}
                  {schoolBranding.phone && (
                    <Typography variant="body2" sx={{ opacity: 0.95 }}>
                      📞 {schoolBranding.phone}
                    </Typography>
                  )}
                </Box>
              </Grid>
              <Grid item xs={12} md={3}>
                {(schoolBranding.logo || schoolBranding.branding?.logo) && (() => {
                  const logoPath = schoolBranding.logo || schoolBranding.branding?.logo || '';
                  const logoUrl = logoPath.startsWith('http://') || logoPath.startsWith('https://') 
                    ? logoPath 
                    : `${(process.env.REACT_APP_API_URL || 'http://localhost:5050').replace('/api', '')}${logoPath.startsWith('/') ? logoPath : '/' + logoPath}`;
                  return (
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <Box sx={{
                        bgcolor: 'rgba(255,255,255,0.95)',
                        borderRadius: 3,
                        p: 2,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}>
                        <img 
                          src={logoUrl} 
                          alt={schoolBranding.name}
                          style={{ 
                            maxWidth: '120px',
                            maxHeight: '120px',
                            objectFit: 'contain'
                          }}
                        />
                      </Box>
                    </Box>
                  );
                })()}
              </Grid>
            </Grid>
          </Paper>
        </Fade>
      )}

      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Fade in timeout={800}>
          <Typography 
            variant="h4" 
            sx={{ 
              fontWeight: 700,
              background: schoolBranding 
                ? `linear-gradient(135deg, ${schoolBranding.branding?.primaryColor || schoolBranding.primaryColor || '#667eea'} 0%, ${schoolBranding.branding?.secondaryColor || schoolBranding.secondaryColor || '#764ba2'} 100%)`
                : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              textShadow: '0 2px 4px rgba(0,0,0,0.1)',
            }}
          >
            School Configuration
          </Typography>
        </Fade>
        <NotificationIcon />
      </Box>

      <Alert severity="info" sx={{ mb: 3 }}>
        <Typography variant="body1">
          Configure report templates, communication settings (WhatsApp, Email, SMS), branding, and frequencies for your school.
        </Typography>
        {reportTemplates.length > 0 && (
          <Typography variant="body2" sx={{ mt: 1 }}>
            Found {reportTemplates.length} report template(s) for your school.
          </Typography>
        )}
      </Alert>

      {/* Report Templates */}
      <Grow in timeout={1000}>
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12}>
            <Paper
              elevation={0}
              sx={{
                background: getRandomCardColor(0),
                borderRadius: 4,
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(255,255,255,0.3)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.1)'
              }}
            >
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, gap: 2 }}>
                  <Typography variant="h5" sx={{ display: 'flex', alignItems: 'center' }}>
                    <Description sx={{ mr: 1 }} />
                    Report Templates
                  </Typography>
                  {isSuperAdmin && (
                    <FormControl size="small" sx={{ minWidth: 260 }}>
                      <InputLabel>School</InputLabel>
                      <Select
                        label="School"
                        value={selectedSchoolId}
                        onChange={(e) => {
                          setSelectedSchoolId(e.target.value);
                          // Reset form grade when school changes since grades may be different
                          if (formData.grade) {
                            setFormData(prev => ({ ...prev, grade: '' }));
                          }
                        }}
                      >
                        {superAdminSchools.map((s) => (
                          <MenuItem key={s._id} value={s._id}>{s.name}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  )}
                  {isSuperAdmin && (
                    <Button
                      variant="contained"
                      startIcon={<Add />}
                      onClick={handleAddTemplate}
                      sx={{
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        borderRadius: 3,
                        px: 3,
                        py: 1.2,
                        fontWeight: 600,
                        boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)',
                        '&:hover': {
                          background: 'linear-gradient(135deg, #5a6fd8 0%, #6a4190 100%)',
                          transform: 'translateY(-2px)',
                          boxShadow: '0 6px 20px rgba(102, 126, 234, 0.4)'
                        },
                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                      }}
                    >
                      Add Template
                    </Button>
                  )}
                </Box>

                <TableContainer component={Paper} sx={{ boxShadow: 'none', borderRadius: 3 }}>
                  <Table>
                    <TableHead>
                      <TableRow sx={{ background: 'rgba(102, 126, 234, 0.05)' }}>
                      <TableCell>Template Name</TableCell>
                      <TableCell>Grade</TableCell>
                      <TableCell>Report Frequency</TableCell>
                      <TableCell>AI Prompt</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Last Modified</TableCell>
                      <TableCell>Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                    {isLoading ? (
                      <TableRow>
                        <TableCell colSpan={8} align="center">
                          <Typography>Loading templates...</Typography>
                        </TableCell>
                      </TableRow>
                    ) : error ? (
                      <TableRow>
                        <TableCell colSpan={8} align="center">
                          <Alert severity="error" sx={{ mb: 2 }}>
                            <Typography variant="body1">{error}</Typography>
                            {error.includes('Authentication') && (
                              <Typography variant="body2" sx={{ mt: 1 }}>
                                Please log in with valid credentials to access report templates.
                              </Typography>
                            )}
                          </Alert>
                        </TableCell>
                      </TableRow>
                    ) : reportTemplates.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} align="center">
                          <Typography>No templates found</Typography>
                        </TableCell>
                      </TableRow>
                    ) : (
                      reportTemplates.map((template) => (
                        <TableRow key={template._id}>
                          <TableCell>
                            <Typography variant="body1" fontWeight="bold">
                              {template.name}
                            </Typography>
                          </TableCell>
                          <TableCell>
                          <Chip label={toProperCase(template.grade)} color="primary" size="small" />
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={template.reportFrequency}
                              color="secondary"
                              size="small"
                              sx={{
                                backgroundColor: 'rgba(156, 39, 176, 0.1)',
                                color: '#9c27b0',
                                fontWeight: 600,
                              }}
                            />
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={template.aiPrompt ? 'Custom' : 'Default'}
                              color={template.aiPrompt ? 'info' : 'default'}
                              size="small"
                              variant={template.aiPrompt ? 'filled' : 'outlined'}
                              sx={{
                                backgroundColor: template.aiPrompt ? 'rgba(33, 150, 243, 0.1)' : undefined,
                                color: template.aiPrompt ? '#2196f3' : undefined,
                                fontWeight: template.aiPrompt ? 600 : 400,
                              }}
                            />
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={template.isActive ? 'Active' : 'Inactive'}
                              color={template.isActive ? 'success' : 'default'}
                              size="small"
                              onClick={() => handleToggleStatus(template._id)}
                              sx={{ cursor: 'pointer' }}
                            />
                          </TableCell>
                          <TableCell>
                            {new Date(template.lastModified).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            <Box sx={{ display: 'flex', gap: 1 }}>
                              {isSuperAdmin ? (
                                <>
                                  <IconButton 
                                    size="small" 
                                    color="primary"
                                    onClick={() => handleEditTemplate(template)}
                                    title="Edit Template"
                                  >
                                    <Edit />
                                  </IconButton>
                                  <IconButton 
                                    size="small" 
                                    color="error"
                                    onClick={() => handleDeleteTemplate(template._id)}
                                    title="Delete Template"
                                  >
                                    <Delete />
                                  </IconButton>
                                </>
                              ) : (
                                <IconButton 
                                  size="small" 
                                  color="info"
                                  onClick={() => handleEditTemplate(template)}
                                  title="View Template (Read-only)"
                                >
                                  <Visibility />
                                </IconButton>
                              )}
                            </Box>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Paper>
          </Grid>
        </Grid>
      </Grow>

      {/* Frequency & Calendar Configuration - Only for School Admins */}
      {isSchoolAdmin && (
        <Grow in timeout={1200}>
          <Grid container spacing={3} sx={{ mb: 4 }}>
            <Grid item xs={12}>
              <Paper
                elevation={0}
                sx={{
                  background: 'rgba(255,255,255,0.8)',
                  borderRadius: 4,
                  backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(255,255,255,0.3)',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.1)'
                }}
              >
                <CardContent>
                  <Typography variant="h5" sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                    <Schedule sx={{ mr: 1 }} />
                    Frequency & Calendar Configuration
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                    Configure timezone, working days, holidays, and report due dates for each frequency type.
                  </Typography>
                  
                  {/* Debug section for settings */}
                  <Alert severity="info" sx={{ mb: 2, fontSize: '0.8em' }}>
                    <Typography variant="caption" component="div" sx={{ mb: 1 }}>
                      🐛 <strong>Settings Debug Info:</strong>
                    </Typography>
                    <Typography variant="caption" component="div">
                      • School ID: {school?.id || 'None'}
                    </Typography>
                    <Typography variant="caption" component="div">
                      • Local Settings: {JSON.stringify(localSchoolSettings, null, 2).substring(0, 200)}...
                    </Typography>
                    <Typography variant="caption" component="div">
                      • School Settings: {JSON.stringify(school?.settings, null, 2).substring(0, 200)}...
                    </Typography>
                  </Alert>
                  
                  <FrequencyConfiguration
                    schoolSettings={localSchoolSettings}
                    onSettingsChange={async (updatedSettings) => {
                      console.log('🔄 ReportConfiguration - Settings change triggered');
                      console.log('🔄 Previous settings:', JSON.stringify(localSchoolSettings, null, 2));
                      console.log('🔄 Updated settings:', JSON.stringify(updatedSettings, null, 2));
                      console.log('🔄 Daily.workingDays comparison:');
                      console.log('   Before:', localSchoolSettings?.reportFrequencies?.Daily?.workingDays);
                      console.log('   After:', updatedSettings?.reportFrequencies?.Daily?.workingDays);
                      
                      // Store current settings for potential rollback
                      const previousSettings = { ...localSchoolSettings };
                      
                      try {
                        const schoolId = school?.id;
                        if (!schoolId) {
                          console.error('❌ No school ID available for settings update');
                          setError('No school ID available');
                          return;
                        }
                        
                        console.log('📤 Sending update to API for school ID:', schoolId);
                        console.log('📤 Request payload:', JSON.stringify(updatedSettings, null, 2));
                        
                        // Update local state immediately for responsive UI
                        setLocalSchoolSettings(updatedSettings);
                        
                        const response = await schoolService.updateSchoolSettings(schoolId, updatedSettings);
                        
                        console.log('📥 API Response:', response);
                        
                        if (response.success) {
                          console.log('✅ School settings updated successfully');
                          console.log('✅ Response data:', response.data);
                          console.log('✅ Response data settings:', response.data?.settings);
                          console.log('✅ Response Daily.workingDays:', response.data?.settings?.reportFrequencies?.Daily?.workingDays);
                          setSuccess('Settings saved successfully');
                          
                          // IMPORTANT: Force update the school in DataContext
                          // This ensures the next page load gets the updated settings
                          if (response.data?.settings) {
                            setLocalSchoolSettings(response.data.settings);
                          }
                        } else {
                          console.error('❌ Failed to update school settings');
                          console.error('❌ Error:', response.error);
                          setError(response.error || 'Failed to update school settings');
                          // Revert local state on error
                          setLocalSchoolSettings(previousSettings);
                        }
                      } catch (error) {
                        console.error('❌ Exception while updating school settings:', error);
                        setError('Failed to update school settings');
                        // Revert local state on error
                        setLocalSchoolSettings(previousSettings);
                      }
                    }}
                  />
                </CardContent>
              </Paper>
            </Grid>
          </Grid>
        </Grow>
      )}

      {/* Branding & Formatting */}
      <Grow in timeout={1300}>
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12}>
            <Paper
              elevation={0}
              sx={{
                background: getRandomCardColor(0),
                borderRadius: 4,
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(255,255,255,0.3)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.1)'
              }}
            >
              <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h5" sx={{ display: 'flex', alignItems: 'center' }}>
                  <ColorLens sx={{ mr: 1 }} />
                  Branding & Formatting
                </Typography>
                <Button
                    variant="outlined"
                    startIcon={<Edit />}
                    onClick={() => setOpenBrandingDialog(true)}
                    sx={{
                      borderRadius: 3,
                      px: 3,
                      py: 1.2,
                      fontWeight: 600,
                      borderColor: 'rgba(102, 126, 234, 0.3)',
                      color: '#667eea',
                      '&:hover': {
                        borderColor: '#667eea',
                        background: 'rgba(102, 126, 234, 0.05)',
                        transform: 'translateY(-2px)'
                      },
                      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                    }}
                  >
                    Edit
                  </Button>
              </Box>

              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="text.secondary">School Name</Typography>
                <Typography variant="body1">{brandingSettings.schoolName}</Typography>
              </Box>

              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="text.secondary">Primary Color</Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box
                    sx={{
                      width: 20,
                      height: 20,
                      bgcolor: brandingSettings.primaryColor,
                      borderRadius: 1,
                    }}
                  />
                  <Typography variant="body1">{brandingSettings.primaryColor}</Typography>
                </Box>
              </Box>

              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="text.secondary">Secondary Color</Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box
                    sx={{
                      width: 20,
                      height: 20,
                      bgcolor: brandingSettings.secondaryColor,
                      borderRadius: 1,
                    }}
                  />
                  <Typography variant="body1">{brandingSettings.secondaryColor}</Typography>
                </Box>
              </Box>

              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="text.secondary">Font Family</Typography>
                <Typography variant="body1">{brandingSettings.fontFamily}</Typography>
              </Box>

              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="text.secondary">Font Size</Typography>
                <Typography variant="body1">{brandingSettings.fontSize}</Typography>
              </Box>

              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>School Logo</Typography>
                {schoolLogo && (
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                    Debug: Logo URL = {schoolLogo}
                  </Typography>
                )}
                {schoolLogo ? (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Box sx={{ position: 'relative' }}>
                      <img 
                        src={`${(process.env.REACT_APP_API_URL || 'http://localhost:5050/api').replace('/api', '')}${schoolLogo}`} 
                        alt="School Logo" 
                        style={{ 
                          maxWidth: 100, 
                          maxHeight: 60, 
                          objectFit: 'contain',
                          border: '1px solid #ddd',
                          borderRadius: 4
                        }} 
                        onError={(e) => {
                          console.error('Failed to load logo image:', schoolLogo);
                          console.error('Full image URL:', `${(process.env.REACT_APP_API_URL || 'http://localhost:5050/api').replace('/api', '')}${schoolLogo}`);
                          e.currentTarget.style.display = 'none';
                          // Show error message
                          if (e.currentTarget.parentNode) {
                            const errorMsg = document.createElement('div');
                            errorMsg.textContent = 'Image failed to load';
                            errorMsg.style.cssText = 'color: red; font-size: 12px; margin-top: 5px;';
                            e.currentTarget.parentNode.appendChild(errorMsg);
                          }
                        }}
                        onLoad={() => {
                          console.log('Logo image loaded successfully:', schoolLogo);
                        }}
                      />
                    </Box>
                    <Button
                      variant="outlined"
                      color="error"
                      size="small"
                      startIcon={<DeleteIcon />}
                      onClick={handleLogoDelete}
                    >
                      Remove
                    </Button>
                  </Box>
                ) : (
                  <Box sx={{ textAlign: 'center', py: 2, border: '2px dashed #ddd', borderRadius: 2 }}>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      No logo uploaded
                    </Typography>
                    <Button
                      variant="outlined"
                      component="label"
                      startIcon={<CloudUpload />}
                      disabled={isUploadingLogo}
                    >
                      {isUploadingLogo ? 'Uploading...' : 'Upload Logo'}
                      <input
                        type="file"
                        hidden
                        accept="image/*"
                        onChange={handleLogoUpload}
                      />
                    </Button>
                  </Box>
                )}
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                  Upload a logo to display in student report emails. Recommended size: 200x60px, max 5MB.
                </Typography>
              </Box>
              </CardContent>
            </Paper>
          </Grid>
        </Grid>
      </Grow>

      {/* Communication Settings */}
      <Grow in timeout={1400}>
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12}>
            <Paper
              elevation={0}
              sx={{
                background: getRandomCardColor(0),
                borderRadius: 4,
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(255,255,255,0.3)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.1)'
              }}
            >
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                  <Typography variant="h5" sx={{ display: 'flex', alignItems: 'center' }}>
                    <Settings sx={{ mr: 1 }} />
                    Communication Settings
                  </Typography>
                  <Button
                    variant="outlined"
                    startIcon={<Edit />}
                    onClick={() => setOpenCommunicationDialog(true)}
                    sx={{
                      borderRadius: 3,
                      px: 3,
                      py: 1.2,
                      fontWeight: 600,
                      borderColor: 'rgba(102, 126, 234, 0.3)',
                      color: '#667eea',
                      '&:hover': {
                        borderColor: '#667eea',
                        background: 'rgba(102, 126, 234, 0.05)',
                        transform: 'translateY(-2px)'
                      },
                      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                    }}
                  >
                    Configure
                  </Button>
                </Box>

                <Grid container spacing={3}>
                  {/* WhatsApp */}
                  <Grid item xs={12} md={4}>
                    <Box sx={{ p: 2, border: '1px solid #e0e0e0', borderRadius: 2, height: '100%' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                        <WhatsApp sx={{ mr: 1, color: '#25D366' }} />
                        <Typography variant="h6">WhatsApp</Typography>
                        <Chip 
                          label={communicationForm.whatsapp.enabled ? 'Enabled' : 'Disabled'} 
                          size="small" 
                          color={communicationForm.whatsapp.enabled ? 'success' : 'default'}
                          sx={{ ml: 'auto' }}
                        />
                      </Box>
                      {communicationForm.whatsapp.enabled ? (
                        <>
                          <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                            Phone Number
                          </Typography>
                          <Typography variant="body1" sx={{ mb: 1 }}>
                            {communicationForm.whatsapp.phoneNumber || 'Not configured'}
                          </Typography>
                          <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                            Display Name
                          </Typography>
                          <Typography variant="body1">
                            {communicationForm.whatsapp.displayName || 'Not set'}
                          </Typography>
                        </>
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          Configure WhatsApp to send event notifications and reports via WhatsApp Business.
                        </Typography>
                      )}
                    </Box>
                  </Grid>

                  {/* Email */}
                  <Grid item xs={12} md={4}>
                    <Box sx={{ p: 2, border: '1px solid #e0e0e0', borderRadius: 2, height: '100%' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                        <Email sx={{ mr: 1, color: '#1976d2' }} />
                        <Typography variant="h6">Email</Typography>
                        <Chip 
                          label={communicationForm.email.enabled ? 'Enabled' : 'Disabled'} 
                          size="small" 
                          color={communicationForm.email.enabled ? 'success' : 'default'}
                          sx={{ ml: 'auto' }}
                        />
                      </Box>
                      {communicationForm.email.enabled ? (
                        <>
                          <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                            From Name
                          </Typography>
                          <Typography variant="body1" sx={{ mb: 1 }}>
                            {communicationForm.email.fromName || 'Default'}
                          </Typography>
                          <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                            From Email
                          </Typography>
                          <Typography variant="body1">
                            {communicationForm.email.fromEmail || 'System default'}
                          </Typography>
                        </>
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          Email notifications are currently disabled.
                        </Typography>
                      )}
                    </Box>
                  </Grid>

                  {/* SMS */}
                  <Grid item xs={12} md={4}>
                    <Box sx={{ p: 2, border: '1px solid #e0e0e0', borderRadius: 2, height: '100%' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                        <Sms sx={{ mr: 1, color: '#ff9800' }} />
                        <Typography variant="h6">SMS</Typography>
                        <Chip 
                          label={communicationForm.sms.enabled ? 'Enabled' : 'Disabled'} 
                          size="small" 
                          color={communicationForm.sms.enabled ? 'success' : 'default'}
                          sx={{ ml: 'auto' }}
                        />
                      </Box>
                      {communicationForm.sms.enabled ? (
                        <>
                          <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                            Phone Number
                          </Typography>
                          <Typography variant="body1">
                            {communicationForm.sms.phoneNumber || 'Not configured'}
                          </Typography>
                        </>
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          Configure SMS to send text message notifications (coming soon).
                        </Typography>
                      )}
                    </Box>
                  </Grid>
                </Grid>
              </CardContent>
            </Paper>
          </Grid>
        </Grid>
      </Grow>

      {/* Template Dialog */}
      <Dialog open={openTemplateDialog} onClose={() => setOpenTemplateDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          {selectedTemplate ? 'Edit Report Template' : 'Add Report Template'}
        </DialogTitle>
        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
          
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField 
                fullWidth 
                label="Template Name" 
                value={formData.name}
                onChange={(e) => handleFormChange('name', e.target.value)}
                required
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Grade</InputLabel>
                <Select 
                  label="Grade"
                  value={formData.grade}
                  onChange={(e) => handleFormChange('grade', e.target.value)}
                  required
                >
                  {getGradeOptions().map((grade) => (
                    <MenuItem key={grade} value={grade}>
                      {grade}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Report Frequency</InputLabel>
                <Select 
                  label="Report Frequency"
                  value={formData.reportFrequency}
                  onChange={(e) => handleFormChange('reportFrequency', e.target.value)}
                  required
                >
                  {REPORT_FREQUENCIES.map((frequency) => (
                    <MenuItem key={frequency} value={frequency}>
                      {frequency}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControlLabel
                control={
                  <Switch 
                    checked={formData.isActive}
                    onChange={(e) => handleFormChange('isActive', e.target.checked)}
                  />
                }
                label="Active"
              />
            </Grid>
            
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Template Content (Structured Format)"
                multiline
                rows={8}
                placeholder={isSuperAdmin ? "Enter the structured template format. Example:&#10;&#10;Practical Life (Self-Care & Environment):&#10;&#10;Feeding: Write the details about, Self-feeding attempts, proficiency with utensils, willingness to try new foods, independence during mealtime.&#10;&#10;Sleeping: Write the details about, Sleep patterns, ability to self-soothe, duration of naps." : "Template content is read-only for school admins"}
                value={formData.content || ''}
                onChange={isSuperAdmin ? (e) => handleFormChange('content', e.target.value) : undefined}
                helperText={isSuperAdmin ? "Required: Structured template format that defines the sections and subsections for intelligent report generation." : "Template content can only be edited by super admins. You can view the content but cannot modify it."}
                InputProps={{
                  readOnly: !isSuperAdmin,
                }}
                sx={{ 
                  '& .MuiInputBase-root': {
                    fontFamily: 'monospace',
                    fontSize: '0.9rem',
                    backgroundColor: !isSuperAdmin ? 'rgba(0, 0, 0, 0.04)' : 'inherit'
                  }
                }}
              />
            </Grid>
            
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenTemplateDialog(false)}>
            {isSuperAdmin ? 'Cancel' : 'Close'}
          </Button>
          {isSuperAdmin && (
            <Button 
              variant="contained" 
              onClick={selectedTemplate ? handleUpdateTemplate : handleCreateTemplate}
              disabled={isSubmitting}
              sx={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                fontWeight: 600,
                '&:hover': {
                  background: 'linear-gradient(135deg, #5a6fd8 0%, #6a4190 100%)'
                }
              }}
            >
              {isSubmitting ? 'Saving...' : (selectedTemplate ? 'Update Template' : 'Save Template')}
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* Branding Dialog */}
      <Dialog open={openBrandingDialog} onClose={() => setOpenBrandingDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>Edit Branding & Formatting</DialogTitle>
        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
          {success && (
            <Alert severity="success" sx={{ mb: 2 }}>
              {success}
            </Alert>
          )}
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField 
                fullWidth 
                label="School Name" 
                value={brandingSettings.schoolName}
                disabled
                helperText="School name cannot be changed here"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField 
                fullWidth 
                label="Primary Color" 
                type="color"
                value={brandingForm.primaryColor}
                onChange={(e) => setBrandingForm({...brandingForm, primaryColor: e.target.value})}
                helperText="Main school color for headers, titles, and accents"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField 
                fullWidth 
                label="Secondary Color" 
                type="color"
                value={brandingForm.secondaryColor}
                onChange={(e) => setBrandingForm({...brandingForm, secondaryColor: e.target.value})}
                helperText="Accent color for sub-headers and emphasis"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Font Family</InputLabel>
                <Select label="Font Family" defaultValue={brandingSettings.fontFamily}>
                  <MenuItem value="Segoe UI">Segoe UI</MenuItem>
                  <MenuItem value="Arial">Arial</MenuItem>
                  <MenuItem value="Helvetica">Helvetica</MenuItem>
                  <MenuItem value="Times New Roman">Times New Roman</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField fullWidth label="Font Size" defaultValue={brandingSettings.fontSize} />
            </Grid>
            <Grid item xs={12}>
              <Box>
                <Button 
                  variant="outlined" 
                  component="label"
                  disabled={isUploadingLogo}
                  startIcon={isUploadingLogo ? <CircularProgress size={20} /> : <CloudUpload />}
                >
                  {isUploadingLogo ? 'Uploading...' : 'Upload Logo'}
                  <input 
                    type="file" 
                    hidden 
                    accept="image/*"
                    onChange={handleLogoUpload}
                  />
                </Button>
                {schoolLogo && (
                  <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
                    <img 
                      src={`${(process.env.REACT_APP_API_URL || 'http://localhost:5050/api').replace('/api', '')}${schoolLogo}`}
                      alt="School Logo" 
                      style={{ maxHeight: '80px', maxWidth: '200px', objectFit: 'contain' }}
                    />
                    <IconButton 
                      color="error" 
                      onClick={handleLogoDelete}
                      size="small"
                      title="Delete Logo"
                    >
                      <DeleteIcon />
                    </IconButton>
                  </Box>
                )}
                <Typography variant="caption" display="block" sx={{ mt: 1 }} color="text.secondary">
                  Recommended size: 200x60px, max 5MB. Supported formats: PNG, JPG, SVG
                </Typography>
              </Box>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenBrandingDialog(false)} disabled={isSavingBranding}>
            Cancel
          </Button>
          <Button 
            variant="contained" 
            onClick={handleSaveBranding}
            disabled={isSavingBranding}
            sx={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              fontWeight: 600,
              '&:hover': {
                background: 'linear-gradient(135deg, #5a6fd8 0%, #6a4190 100%)'
              }
            }}
          >
            {isSavingBranding ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Communication Settings Dialog */}
      <Dialog open={openCommunicationDialog} onClose={() => setOpenCommunicationDialog(false)} maxWidth="lg" fullWidth>
        <DialogTitle>Communication Settings</DialogTitle>
        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
          {success && (
            <Alert severity="success" sx={{ mb: 2 }}>
              {success}
            </Alert>
          )}

          <Alert severity="info" sx={{ mb: 3, mt: 2 }}>
            <Typography variant="body2">
              Configure how your school communicates with parents. Each channel can be enabled/disabled independently.
            </Typography>
          </Alert>

          <Grid container spacing={3} sx={{ mt: 1 }}>
            {/* WhatsApp Configuration */}
            <Grid item xs={12}>
              <Paper elevation={2} sx={{ p: 3, borderLeft: '4px solid #25D366' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <WhatsApp sx={{ mr: 1, fontSize: 28, color: '#25D366' }} />
                  <Typography variant="h6">WhatsApp Business</Typography>
                </Box>

                <FormControlLabel
                  control={
                    <Switch
                      checked={communicationForm.whatsapp.enabled}
                      onChange={(e) => setCommunicationForm({
                        ...communicationForm,
                        whatsapp: { ...communicationForm.whatsapp, enabled: e.target.checked }
                      })}
                    />
                  }
                  label="Enable WhatsApp notifications"
                  sx={{ mb: 2 }}
                />

                {communicationForm.whatsapp.enabled && (
                  <Grid container spacing={2}>
                    <Grid item xs={12} md={6}>
                      <TextField
                        fullWidth
                        label="WhatsApp Phone Number"
                        value={communicationForm.whatsapp.phoneNumber}
                        onChange={(e) => setCommunicationForm({
                          ...communicationForm,
                          whatsapp: { ...communicationForm.whatsapp, phoneNumber: e.target.value }
                        })}
                        helperText="E.164 format: +1234567890"
                        placeholder="+1234567890"
                      />
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <TextField
                        fullWidth
                        label="Display Name"
                        value={communicationForm.whatsapp.displayName}
                        onChange={(e) => setCommunicationForm({
                          ...communicationForm,
                          whatsapp: { ...communicationForm.whatsapp, displayName: e.target.value }
                        })}
                        helperText="Name shown in WhatsApp messages"
                        placeholder="Your School Name"
                      />
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <TextField
                        fullWidth
                        label="Twilio Account SID"
                        value={communicationForm.whatsapp.twilioAccountSid}
                        onChange={(e) => setCommunicationForm({
                          ...communicationForm,
                          whatsapp: { ...communicationForm.whatsapp, twilioAccountSid: e.target.value }
                        })}
                        helperText="From your Twilio account dashboard"
                        placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                      />
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <TextField
                        fullWidth
                        type="password"
                        label="Twilio Auth Token"
                        value={communicationForm.whatsapp.twilioAuthToken}
                        onChange={(e) => setCommunicationForm({
                          ...communicationForm,
                          whatsapp: { ...communicationForm.whatsapp, twilioAuthToken: e.target.value }
                        })}
                        helperText="Keep this secure - from Twilio dashboard"
                        placeholder="••••••••••••••••••••••••••••••••"
                      />
                    </Grid>
                  </Grid>
                )}
              </Paper>
            </Grid>

            {/* Email Configuration */}
            <Grid item xs={12}>
              <Paper elevation={2} sx={{ p: 3, borderLeft: '4px solid #1976d2' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <Email sx={{ mr: 1, fontSize: 28, color: '#1976d2' }} />
                  <Typography variant="h6">Email</Typography>
                </Box>

                <FormControlLabel
                  control={
                    <Switch
                      checked={communicationForm.email.enabled}
                      onChange={(e) => setCommunicationForm({
                        ...communicationForm,
                        email: { ...communicationForm.email, enabled: e.target.checked }
                      })}
                    />
                  }
                  label="Enable email notifications"
                  sx={{ mb: 2 }}
                />

                {communicationForm.email.enabled && (
                  <Grid container spacing={2}>
                    <Grid item xs={12} md={4}>
                      <TextField
                        fullWidth
                        label="From Name"
                        value={communicationForm.email.fromName}
                        onChange={(e) => setCommunicationForm({
                          ...communicationForm,
                          email: { ...communicationForm.email, fromName: e.target.value }
                        })}
                        helperText="Display name in emails"
                        placeholder="Your School Name"
                      />
                    </Grid>
                    <Grid item xs={12} md={4}>
                      <TextField
                        fullWidth
                        label="From Email"
                        type="email"
                        value={communicationForm.email.fromEmail}
                        onChange={(e) => setCommunicationForm({
                          ...communicationForm,
                          email: { ...communicationForm.email, fromEmail: e.target.value }
                        })}
                        helperText="Sender email address"
                        placeholder="notifications@yourschool.com"
                      />
                    </Grid>
                    <Grid item xs={12} md={4}>
                      <TextField
                        fullWidth
                        label="Reply-To Email"
                        type="email"
                        value={communicationForm.email.replyTo}
                        onChange={(e) => setCommunicationForm({
                          ...communicationForm,
                          email: { ...communicationForm.email, replyTo: e.target.value }
                        })}
                        helperText="Where replies should go"
                        placeholder="admin@yourschool.com"
                      />
                    </Grid>
                  </Grid>
                )}
              </Paper>
            </Grid>

            {/* SMS Configuration */}
            <Grid item xs={12}>
              <Paper elevation={2} sx={{ p: 3, borderLeft: '4px solid #ff9800' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <Sms sx={{ mr: 1, fontSize: 28, color: '#ff9800' }} />
                  <Typography variant="h6">SMS Fallback</Typography>
                </Box>

                <FormControlLabel
                  control={
                    <Switch
                      checked={communicationForm.sms.enabled}
                      onChange={(e) => setCommunicationForm({
                        ...communicationForm,
                        sms: { ...communicationForm.sms, enabled: e.target.checked }
                      })}
                    />
                  }
                  label="Enable SMS fallback when WhatsApp fails"
                  sx={{ mb: 2 }}
                />

                {communicationForm.sms.enabled && (
                  <Grid container spacing={2}>
                    <Grid item xs={12} md={6}>
                      <TextField
                        fullWidth
                        label="SMS Phone Number"
                        value={communicationForm.sms.phoneNumber}
                        onChange={(e) => setCommunicationForm({
                          ...communicationForm,
                          sms: { ...communicationForm.sms, phoneNumber: e.target.value }
                        })}
                        helperText="E.164 format: +1234567890 (can be same as WhatsApp)"
                        placeholder="+1234567890"
                      />
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <TextField
                        fullWidth
                        label="Twilio Account SID"
                        value={communicationForm.sms.twilioAccountSid || communicationForm.whatsapp.twilioAccountSid}
                        onChange={(e) => setCommunicationForm({
                          ...communicationForm,
                          sms: { ...communicationForm.sms, twilioAccountSid: e.target.value }
                        })}
                        helperText="Can use same Twilio account as WhatsApp"
                        placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                      />
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <TextField
                        fullWidth
                        type="password"
                        label="Twilio Auth Token"
                        value={communicationForm.sms.twilioAuthToken || communicationForm.whatsapp.twilioAuthToken}
                        onChange={(e) => setCommunicationForm({
                          ...communicationForm,
                          sms: { ...communicationForm.sms, twilioAuthToken: e.target.value }
                        })}
                        helperText="Can use same Twilio token as WhatsApp"
                        placeholder="••••••••••••••••••••••••••••••••"
                      />
                    </Grid>
                  </Grid>
                )}

                <Alert severity="info" sx={{ mt: 2 }}>
                  SMS will automatically be used as backup when WhatsApp messages fail to deliver.
                </Alert>
              </Paper>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenCommunicationDialog(false)} disabled={isSavingCommunication}>
            Cancel
          </Button>
          <Button 
            variant="contained" 
            onClick={handleSaveCommunication}
            disabled={isSavingCommunication}
            sx={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              fontWeight: 600,
              '&:hover': {
                background: 'linear-gradient(135deg, #5a6fd8 0%, #6a4190 100%)'
              }
            }}
          >
            {isSavingCommunication ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default SchoolConfiguration; 