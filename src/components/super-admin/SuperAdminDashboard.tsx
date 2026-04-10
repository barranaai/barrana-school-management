import React, { useState, useEffect } from 'react';
import {
  Box,
  Drawer,
  AppBar,
  Toolbar,
  List,
  Typography,
  Divider,
  IconButton,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Avatar,
  Menu,
  MenuItem,
  Card,
  CardContent,
  Grid,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  LinearProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Alert,
  Select,
  FormControl,
  InputLabel,
  Chip,
  Switch,
  FormControlLabel,
  Snackbar,
} from '@mui/material';
import {
  Dashboard,
  Business,
  People,
  Payment,
  Analytics,
  Support,
  Settings,
  AccountCircle,
  Notifications,
  School,
  TrendingUp,
  TrendingDown,
  CheckCircle,
  Warning,
  Schedule,
  Email,
  Phone,
  LocationOn,
  Edit,
  Delete,
  Visibility,
  Send,
  Archive,
  Star,
  StarBorder,
  Logout,
  Person,
  MonetizationOn,
  Assessment,
  Description,
  Security,
  Cloud,
  Storage,
  Speed,
  Add,
  Info,
  ContactPhone,
  AccountBalance,
  Public,

} from '@mui/icons-material';
import { Country, State, City } from 'country-state-city';
import { useAuth } from '../../contexts/AuthContext';
import { useData } from '../../contexts/DataContext';
import SchoolConfiguration from '../admin/sections/SchoolConfiguration';
import apiService from '../../services/apiService';
import { getTimezoneOptions } from '../../utils/timezoneUtils';
import TimezoneSelector from '../common/TimezoneSelector';
import {
  getGradeCodesForSchoolType,
  formatGradeForDisplay,
  getGradeDisplayNamesForSchoolType
} from '../../utils/gradeDisplayUtils';

// Get countries from the library
const COUNTRIES = Country.getAllCountries().sort((a, b) => a.name.localeCompare(b.name));

// Get comprehensive timezone options
const timezoneOptions = getTimezoneOptions();

// Helper functions for country, state, and city selection
const getStatesForCountry = (countryCode: string) => {
  return State.getStatesOfCountry(countryCode).sort((a, b) => a.name.localeCompare(b.name));
};

const getCitiesForCountry = (countryCode: string, stateCode?: string) => {
  if (stateCode) {
    return City.getCitiesOfState(countryCode, stateCode)?.sort((a, b) => a.name.localeCompare(b.name)) || [];
  }
  return City.getCitiesOfCountry(countryCode)?.sort((a, b) => a.name.localeCompare(b.name)) || [];
};

// Helper function to get grade levels for a school type (raw codes)
const getGradeLevelsForSchoolType = (schoolType: string) => {
  return getGradeCodesForSchoolType(schoolType);
};

// Helper function to get display name for grade level
// Now uses centralized utility for consistency
const getGradeLevelDisplayName = (gradeLevel: string) => {
  return formatGradeForDisplay(gradeLevel);
};

const SuperAdminDashboard: React.FC = () => {
  const { user, logout } = useAuth();
  const { students, teachers, reports, school } = useData();
  const [currentSection, setCurrentSection] = useState('overview');
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [schools, setSchools] = useState<any[]>([]);

  // Handle hash navigation for direct access to sections
  useEffect(() => {
    const timer = setTimeout(() => {
      const hash = window.location.hash.replace('#', '');
      if (hash && menuItems.some(item => item.section === hash)) {
        setCurrentSection(hash);
      } else if (!hash) {
        window.location.hash = 'overview';
      }
    }, 0);
    
    return () => clearTimeout(timer);
  }, []);

  // Update URL hash when section changes
  useEffect(() => {
    const hash = window.location.hash.replace('#', '');
    if (hash !== currentSection) {
      window.location.hash = currentSection;
    }
  }, [currentSection]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [openSchoolDialog, setOpenSchoolDialog] = useState(false);
  const [openViewSchoolDialog, setOpenViewSchoolDialog] = useState(false);
  const [openEditSchoolDialog, setOpenEditSchoolDialog] = useState(false);
  const [selectedSchool, setSelectedSchool] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });
  const [schoolDetailView, setSchoolDetailView] = useState(false);
  const [schoolStats, setSchoolStats] = useState({
    totalClasses: 0,
    totalStudents: 0,
    totalTeachers: 0
  });
  const [selectedDataType, setSelectedDataType] = useState<'classes' | 'students' | 'teachers' | null>(null);
  const [schoolClasses, setSchoolClasses] = useState<any[]>([]);
  const [schoolStudents, setSchoolStudents] = useState<any[]>([]);
  const [schoolTeachers, setSchoolTeachers] = useState<any[]>([]);
  const [loadingSchoolData, setLoadingSchoolData] = useState(false);
  const [perStudentCosts, setPerStudentCosts] = useState<{ [key: string]: number }>({});
  const [editingCost, setEditingCost] = useState<string | null>(null);
  const [schoolStudentCounts, setSchoolStudentCounts] = useState<{ [key: string]: number }>({});
  const [loadingBillingData, setLoadingBillingData] = useState(false);

  // School form state
  const [schoolForm, setSchoolForm] = useState({
    name: '',
    schoolType: 'licensed_daycare',
    estimatedStudents: '',
    gradeLevels: [] as string[],
    contactPerson: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    zipCode: '',
    country: 'Canada',
    customCity: '',
    subscriptionPlan: 'basic',
    isActive: true,
    timezone: 'UTC'
  });

  // State for dynamic dropdowns
  const [states, setStates] = useState<any[]>([]);
  const [cities, setCities] = useState<any[]>([]);
  const [selectedCountryCode, setSelectedCountryCode] = useState('CA');
  const [selectedStateCode, setSelectedStateCode] = useState('');

  const drawerWidth = 240;

  const menuItems = [
    { text: 'Global Overview', section: 'overview', icon: <Dashboard /> },
    { text: 'School Management', section: 'schools', icon: <School /> },
    { text: 'School Configuration', section: 'reportTemplates', icon: <Description /> },
    { text: 'User Management', section: 'users', icon: <People /> },
    { text: 'Billing Management', section: 'billing', icon: <Payment /> },
    { text: 'Advanced Analytics', section: 'analytics', icon: <Analytics /> },
    { text: 'Support Center', section: 'support', icon: <Support /> },
    { text: 'System Settings', section: 'settings', icon: <Settings /> },
  ];

  useEffect(() => {
    fetchData();
    // Initialize states for Canada (default country)
    const canadaStates = getStatesForCountry('CA');
    setStates(canadaStates);
  }, []);

  useEffect(() => {
    if (currentSection === 'billing') {
      fetchSchoolStudentCounts();
    }
  }, [currentSection, schools]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [schoolsData, usersData] = await Promise.all([
        apiService.getSchools(),
        apiService.getUsers()
      ]);
      setSchools(schoolsData.data || []);
      setUsers(usersData.data || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      setSnackbar({ open: true, message: 'Error fetching data', severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    logout();
  };

  const handleCountryChange = (countryName: string) => {
    const country = COUNTRIES.find(c => c.name === countryName);
    if (country) {
      setSelectedCountryCode(country.isoCode);
      setStates(getStatesForCountry(country.isoCode));
      setCities([]);
      setSelectedStateCode('');
              setSchoolForm({
          ...schoolForm,
          country: countryName,
          state: '',
          city: '',
          customCity: '',
          timezone: 'UTC'
        });
    }
  };

  const handleStateChange = (stateName: string) => {
    const state = states.find(s => s.name === stateName);
    if (state) {
      setSelectedStateCode(state.isoCode);
      setCities(getCitiesForCountry(selectedCountryCode, state.isoCode));
      setSchoolForm({
        ...schoolForm,
        state: stateName,
        city: '',
        customCity: ''
      });
    }
  };

  const handleSchoolTypeChange = (schoolType: string) => {
    // Get grade levels for the selected school type
    const gradeLevels = getGradeLevelsForSchoolType(schoolType);
    
    setSchoolForm({
      ...schoolForm,
      schoolType: schoolType,
      gradeLevels: [] // Reset grade levels when school type changes
    });
  };

  const handleViewSchool = (school: any) => {
    setSelectedSchool(school);
    setOpenViewSchoolDialog(true);
  };

  const handleSchoolClick = async (school: any) => {
    setSelectedSchool(school);
    setSchoolDetailView(true);
    setSelectedDataType(null);
    await fetchSchoolData(school._id || school.id);
  };

  const fetchSchoolData = async (schoolId: string) => {
    try {
      setLoadingSchoolData(true);
      
      // Fetch school statistics and data
      const [classesData, studentsData, teachersData] = await Promise.all([
        apiService.getClasses(),
        apiService.getStudents(),
        apiService.getTeachers()
      ]);

      // Filter data by school ID
      const schoolClasses = classesData.data?.filter((cls: any) => cls.schoolId === schoolId) || [];
      const schoolStudents = studentsData.data?.filter((student: any) => student.schoolId === schoolId) || [];
      const schoolTeachers = teachersData.data?.filter((teacher: any) => teacher.schoolId === schoolId) || [];

      setSchoolClasses(schoolClasses);
      setSchoolStudents(schoolStudents);
      setSchoolTeachers(schoolTeachers);

      setSchoolStats({
        totalClasses: schoolClasses.length,
        totalStudents: schoolStudents.length,
        totalTeachers: schoolTeachers.length
      });
    } catch (error) {
      console.error('Error fetching school data:', error);
      setSnackbar({ open: true, message: 'Error fetching school data', severity: 'error' });
    } finally {
      setLoadingSchoolData(false);
    }
  };

  const handleDataTypeClick = (dataType: 'classes' | 'students' | 'teachers') => {
    setSelectedDataType(selectedDataType === dataType ? null : dataType);
  };

  const handleBackToSchools = () => {
    setSchoolDetailView(false);
    setSelectedSchool(null);
    setSelectedDataType(null);
    setSchoolStats({ totalClasses: 0, totalStudents: 0, totalTeachers: 0 });
    setSchoolClasses([]);
    setSchoolStudents([]);
    setSchoolTeachers([]);
  };

  const handleCostEdit = (schoolId: string) => {
    setEditingCost(schoolId);
  };

  const handleCostSave = (schoolId: string, cost: number) => {
    setPerStudentCosts(prev => ({
      ...prev,
      [schoolId]: cost
    }));
    setEditingCost(null);
  };

  const handleCostCancel = () => {
    setEditingCost(null);
  };

  const calculateMonthlyCost = (schoolId: string, studentCount: number) => {
    const perStudentCost = perStudentCosts[schoolId] || 0;
    return studentCount * perStudentCost;
  };

  const calculateTotalRevenue = () => {
    return schools.reduce((total, school) => {
      const schoolId = school._id || school.id;
      const studentCount = schoolStudentCounts[schoolId] || 0;
      const perStudentCost = perStudentCosts[schoolId] || 0;
      return total + (studentCount * perStudentCost);
    }, 0);
  };

  const fetchSchoolStudentCounts = async () => {
    try {
      setLoadingBillingData(true);
      
      // Fetch all students to get counts per school
      const studentsResponse = await apiService.getStudents();
      const allStudents = studentsResponse.data || [];
      
      // Count students per school
      const studentCounts: { [key: string]: number } = {};
      allStudents.forEach((student: any) => {
        const schoolId = student.schoolId;
        if (schoolId) {
          studentCounts[schoolId] = (studentCounts[schoolId] || 0) + 1;
        }
      });
      
      setSchoolStudentCounts(studentCounts);
    } catch (error) {
      console.error('Error fetching student counts:', error);
      setSnackbar({ open: true, message: 'Error fetching student counts', severity: 'error' });
    } finally {
      setLoadingBillingData(false);
    }
  };

  const handleEditSchool = (school: any) => {
    console.log('🔵 handleEditSchool - Loading school for edit:', school);
    console.log('   school.address:', school.address);
    console.log('   school.address.country:', school.address?.country);
    console.log('   school.address.state:', school.address?.state);
    console.log('   school.address.city:', school.address?.city);
    
    setSelectedSchool(school);
    
    // Extract address fields correctly - address is ALWAYS an object with nested fields
    const countryName = school.address?.country || school.country || 'United States';
    const stateName = school.address?.state || school.state || '';
    const cityName = school.address?.city || school.city || '';
    
    console.log('   Extracted values:', { countryName, stateName, cityName });
    
    // Find country and populate states/cities
    const country = COUNTRIES.find(c => c.name === countryName);
    if (country) {
      console.log('   Found country:', country.name, 'ISO:', country.isoCode);
      setSelectedCountryCode(country.isoCode);
      const statesForCountry = getStatesForCountry(country.isoCode);
      setStates(statesForCountry);
      
      if (stateName) {
        const state = State.getStatesOfCountry(country.isoCode).find(s => s.name === stateName);
        if (state) {
          console.log('   Found state:', state.name, 'ISO:', state.isoCode);
          setSelectedStateCode(state.isoCode);
          const citiesForState = getCitiesForCountry(country.isoCode, state.isoCode);
          setCities(citiesForState);
          console.log('   Loaded cities for state:', citiesForState.length);
        } else {
          console.log('   State not found:', stateName);
        }
      }
    } else {
      console.log('   Country not found:', countryName);
    }

    setSchoolForm({
      name: school.name || '',
      schoolType: school.schoolType || 'licensed_daycare',
      estimatedStudents: school.estimatedStudents?.toString() || '',
      gradeLevels: school.gradeLevels || [],
      contactPerson: typeof school.contactPerson === 'object' ? school.contactPerson?.name || '' : school.contactPerson || '',
      email: typeof school.contactPerson === 'object' ? school.contactPerson?.email || '' : school.email || '',
      phone: typeof school.contactPerson === 'object' ? school.contactPerson?.phone || '' : school.phone || '',
      address: school.address?.street || '',
      city: cityName,
      state: stateName,
      zipCode: school.address?.zipCode || '',
      country: countryName,
      customCity: school.customCity || '',
      subscriptionPlan: school.subscription?.plan || 'basic',
      isActive: school.isActive !== false,
      timezone: school.settings?.timezone || 'UTC'
    });
    
    console.log('✅ School form populated:', {
      country: countryName,
      state: stateName,
      city: cityName
    });
    
    setOpenEditSchoolDialog(true);
  };

  const handleAddSchool = async () => {
    try {
      setIsSubmitting(true);
      
      // Validate required fields
      if (!schoolForm.name || !schoolForm.contactPerson || !schoolForm.email || !schoolForm.address || !schoolForm.city || !schoolForm.state || !schoolForm.zipCode) {
        setSnackbar({ open: true, message: 'Please fill in all required fields', severity: 'error' });
        return;
      }
      
      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(schoolForm.email)) {
        setSnackbar({ open: true, message: 'Please enter a valid email address', severity: 'error' });
        return;
      }
      
      // Validate estimated students
      const estimatedStudents = parseInt(schoolForm.estimatedStudents);
      if (isNaN(estimatedStudents) || estimatedStudents < 1) {
        setSnackbar({ open: true, message: 'Estimated students must be at least 1', severity: 'error' });
        return;
      }
      
      // Validate custom city if selected
      if (schoolForm.city === 'custom' && !schoolForm.customCity) {
        setSnackbar({ open: true, message: 'Please enter a custom city name', severity: 'error' });
        return;
      }
      
      const cityToUse = schoolForm.city === 'custom' ? schoolForm.customCity : schoolForm.city;
      
      // Generate slug from school name
      const slug = schoolForm.name.toLowerCase().replace(/ /g, '-').replace(/[^\w-]+/g, '');
      
      // Ensure gradeLevels is always an array
      const gradeLevels = Array.isArray(schoolForm.gradeLevels) ? schoolForm.gradeLevels : [];
      
      const schoolData = {
        name: schoolForm.name,
        slug: slug,
        schoolType: schoolForm.schoolType,
        estimatedStudents: parseInt(schoolForm.estimatedStudents) || 1, // Must be at least 1
        gradeLevels: gradeLevels,
        contactPerson: {
          name: schoolForm.contactPerson,
          email: schoolForm.email,
          phone: schoolForm.phone || '', // Ensure phone is not undefined
          role: 'Administrator'
        },
        address: {
          street: schoolForm.address,
          city: cityToUse,
          state: schoolForm.state,
          zipCode: schoolForm.zipCode,
          country: schoolForm.country
        },
        subscription: {
          plan: schoolForm.subscriptionPlan
          // status will be set to 'trial' by default in the backend model
        },
        isActive: schoolForm.isActive,
        settings: {
          timezone: schoolForm.timezone
        }
      };


      const response = await apiService.createSchool(schoolData as any);
      
      if (response.success && response.data) {
        // Check if school admin credentials were generated
        if (response.data.schoolAdmin) {
          setSnackbar({ 
            open: true, 
            message: `School added successfully! School admin login: ${response.data.schoolAdmin.email} / ${response.data.schoolAdmin.password}`, 
            severity: 'success' 
          });
        } else {
          setSnackbar({ open: true, message: 'School added successfully', severity: 'success' });
        }
        
        setOpenSchoolDialog(false);
        
        // Reset form
        setSchoolForm({
          name: '',
          schoolType: 'licensed_daycare',
          estimatedStudents: '',
          gradeLevels: [],
          contactPerson: '',
          email: '',
          phone: '',
          address: '',
          city: '',
          state: '',
          zipCode: '',
          country: 'United States',
          customCity: '',
          subscriptionPlan: 'basic',
          isActive: true,
          timezone: 'UTC'
        });
        
        // Refresh the schools list
        await fetchData();
            } else {
        // Handle API response error
        let errorMessage = 'Failed to add school';
        
        // Check if we have detailed validation errors
        if (response.error && typeof response.error === 'string') {
          errorMessage = response.error;
        } else if (response.message) {
          errorMessage = response.message;
        }
        

        setSnackbar({ open: true, message: errorMessage, severity: 'error' });
        return;
      }
        } catch (error: any) {
      console.error('Error adding school:', error);

 
      let errorMessage = 'Error adding school';
      
      // Handle different types of errors
      if (error.response?.data?.errors) {
        // Validation errors from fetch
        const validationErrors = error.response.data.errors;
        errorMessage = `Validation errors: ${validationErrors.map((err: any) => `${err.path}: ${err.msg}`).join(', ')}`;
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.message) {
        errorMessage = error.message;
      } else if (error.error) {
        // API response error
        errorMessage = error.error;
      }
      
      setSnackbar({ open: true, message: errorMessage, severity: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateSchool = async () => {
    try {
      setIsSubmitting(true);
      const cityToUse = schoolForm.city === 'custom' ? schoolForm.customCity : schoolForm.city;
      
      const schoolData = {
        name: schoolForm.name,
        schoolType: schoolForm.schoolType,
        estimatedStudents: parseInt(schoolForm.estimatedStudents) || 1, // Must be at least 1
        gradeLevels: schoolForm.gradeLevels,
        contactPerson: {
          name: schoolForm.contactPerson,
          email: schoolForm.email,
          phone: schoolForm.phone,
          role: 'Administrator'
        },
        address: {
          street: schoolForm.address,
          city: cityToUse,
          state: schoolForm.state,
          zipCode: schoolForm.zipCode,
          country: schoolForm.country
        },
        subscription: {
          plan: schoolForm.subscriptionPlan
          // status will be managed by the backend based on the school's active status
        },
        isActive: schoolForm.isActive,
        settings: {
          timezone: schoolForm.timezone
        }
      };



      const response = await apiService.updateSchool(selectedSchool._id || selectedSchool.id, schoolData as any);
      
      if (response.success && response.data) {
        setSnackbar({ open: true, message: 'School updated successfully', severity: 'success' });
        setOpenEditSchoolDialog(false);
        
        // Update the selectedSchool with the new data
        setSelectedSchool(response.data);
        
        // Refresh the schools list
        await fetchData();
      } else {
        throw new Error(response.error || 'Failed to update school');
      }
      
      setSchoolForm({
        name: '',
        schoolType: 'licensed_daycare',
        estimatedStudents: '',
        gradeLevels: [],
        contactPerson: '',
        email: '',
        phone: '',
        address: '',
        city: '',
        state: '',
        zipCode: '',
        country: 'United States',
        customCity: '',
        subscriptionPlan: 'basic',
        isActive: true,
        timezone: 'UTC'
      });
    } catch (error) {
      console.error('Error updating school:', error);
      setSnackbar({ open: true, message: 'Error updating school', severity: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderSection = () => {
    switch (currentSection) {
      case 'overview':
        return <GlobalOverview />;
      case 'schools':
        return <SchoolManagement />;
      case 'reportTemplates':
        return <SchoolConfiguration />;
      case 'users':
        return <UserManagement />;
      case 'billing':
        return <BillingManagement />;
      case 'analytics':
        return <AdvancedAnalytics />;
      case 'support':
        return <SupportCenter />;
      case 'settings':
        return <SystemSettings />;
      default:
        return <GlobalOverview />;
    }
  };

  const GlobalOverview = () => (
    <Box>
      <Typography variant="h4" gutterBottom>
        Global Overview
      </Typography>
      <Grid container spacing={3}>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Total Schools
              </Typography>
              <Typography variant="h4">
                {schools.length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Total Users
              </Typography>
              <Typography variant="h4">
                {users.length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Active Subscriptions
              </Typography>
              <Typography variant="h4">
                {schools.filter(s => s.subscription?.status === 'active').length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom>
                Revenue (Monthly)
              </Typography>
              <Typography variant="h4">
                ${schools.reduce((sum, school) => {
                  const plan = school.subscription?.plan;
                  const amount = plan === 'enterprise' ? 500 : plan === 'premium' ? 200 : 50;
                  return sum + amount;
                }, 0).toLocaleString()}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );

  const SchoolDetailView = () => (
    <Box>
      {/* Header with Back Button */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box display="flex" alignItems="center" gap={2}>
          <Button
            variant="outlined"
            startIcon={<Settings />}
            onClick={handleBackToSchools}
            sx={{ borderRadius: 2 }}
          >
            Back to Schools
          </Button>
          <Typography variant="h4">
            {selectedSchool?.name}
          </Typography>
        </Box>
        <Chip 
          label={selectedSchool?.isActive ? 'Active' : 'Inactive'} 
          color={selectedSchool?.isActive ? 'success' : 'default'} 
        />
      </Box>

      {/* Statistics Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={4}>
          <Card 
            sx={{ 
              cursor: 'pointer', 
              transition: 'all 0.3s ease',
              '&:hover': { 
                transform: 'translateY(-4px)', 
                boxShadow: 4,
                bgcolor: selectedDataType === 'classes' ? 'primary.50' : 'background.paper'
              }
            }}
            onClick={() => handleDataTypeClick('classes')}
          >
            <CardContent sx={{ textAlign: 'center', py: 3 }}>
              <Typography color="textSecondary" gutterBottom>
                Total Classes
              </Typography>
              <Typography variant="h3" color="primary" sx={{ fontWeight: 'bold' }}>
                {schoolStats.totalClasses}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Click to view details
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card 
            sx={{ 
              cursor: 'pointer', 
              transition: 'all 0.3s ease',
              '&:hover': { 
                transform: 'translateY(-4px)', 
                boxShadow: 4,
                bgcolor: selectedDataType === 'students' ? 'primary.50' : 'background.paper'
              }
            }}
            onClick={() => handleDataTypeClick('students')}
          >
            <CardContent sx={{ textAlign: 'center', py: 3 }}>
              <Typography color="textSecondary" gutterBottom>
                Total Students
              </Typography>
              <Typography variant="h3" color="primary" sx={{ fontWeight: 'bold' }}>
                {schoolStats.totalStudents}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Click to view details
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card 
            sx={{ 
              cursor: 'pointer', 
              transition: 'all 0.3s ease',
              '&:hover': { 
                transform: 'translateY(-4px)', 
                boxShadow: 4,
                bgcolor: selectedDataType === 'teachers' ? 'primary.50' : 'background.paper'
              }
            }}
            onClick={() => handleDataTypeClick('teachers')}
          >
            <CardContent sx={{ textAlign: 'center', py: 3 }}>
              <Typography color="textSecondary" gutterBottom>
                Total Teachers
              </Typography>
              <Typography variant="h3" color="primary" sx={{ fontWeight: 'bold' }}>
                {schoolStats.totalTeachers}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Click to view details
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Data Tables */}
      {loadingSchoolData && (
        <Box display="flex" justifyContent="center" my={4}>
          <LinearProgress sx={{ width: '100%' }} />
        </Box>
      )}

      {selectedDataType === 'classes' && (
        <Box>
          <Typography variant="h5" gutterBottom>
            Classes ({schoolClasses.length})
          </Typography>
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Class Name</TableCell>
                  <TableCell>Grade Level</TableCell>
                  <TableCell>Teacher</TableCell>
                  <TableCell>Students</TableCell>
                  <TableCell>Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {schoolClasses.length > 0 ? schoolClasses.map((cls) => (
                  <TableRow key={cls._id || cls.id}>
                    <TableCell>{cls.name || 'N/A'}</TableCell>
                    <TableCell>{cls.gradeLevel || 'N/A'}</TableCell>
                    <TableCell>{cls.teacher?.firstName ? `${cls.teacher.firstName} ${cls.teacher.lastName}` : 'N/A'}</TableCell>
                    <TableCell>{cls.students?.length || 0}</TableCell>
                    <TableCell>
                      <Chip 
                        label={cls.isActive ? 'Active' : 'Inactive'} 
                        size="small"
                        color={cls.isActive ? 'success' : 'default'} 
                      />
                    </TableCell>
                  </TableRow>
                )) : (
                  <TableRow>
                    <TableCell colSpan={5} align="center">No classes found</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      )}

      {selectedDataType === 'students' && (
        <Box>
          <Typography variant="h5" gutterBottom>
            Students ({schoolStudents.length})
          </Typography>
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Grade</TableCell>
                  <TableCell>Class</TableCell>
                  <TableCell>Parent Email</TableCell>
                  <TableCell>Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {schoolStudents.length > 0 ? schoolStudents.map((student) => (
                  <TableRow key={student._id || student.id}>
                    <TableCell>{student.firstName && student.lastName ? `${student.firstName} ${student.lastName}` : student.firstName || student.lastName || 'N/A'}</TableCell>
                    <TableCell>{student.grade || student.studentGrade || 'N/A'}</TableCell>
                    <TableCell>{student.studentClass || student.class || 'N/A'}</TableCell>
                    <TableCell>{student.parentEmail || 'N/A'}</TableCell>
                    <TableCell>
                      <Chip 
                        label="Active" 
                        size="small"
                        color="success" 
                      />
                    </TableCell>
                  </TableRow>
                )) : (
                  <TableRow>
                    <TableCell colSpan={5} align="center">No students found</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      )}

      {selectedDataType === 'teachers' && (
        <Box>
          <Typography variant="h5" gutterBottom>
            Teachers ({schoolTeachers.length})
          </Typography>
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Email</TableCell>
                  <TableCell>Phone</TableCell>
                  <TableCell>Classes</TableCell>
                  <TableCell>Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {schoolTeachers.length > 0 ? schoolTeachers.map((teacher) => (
                  <TableRow key={teacher._id || teacher.id}>
                    <TableCell>{teacher.firstName && teacher.lastName ? `${teacher.firstName} ${teacher.lastName}` : teacher.firstName || teacher.lastName || 'N/A'}</TableCell>
                    <TableCell>{teacher.email || 'N/A'}</TableCell>
                    <TableCell>{teacher.phone || 'N/A'}</TableCell>
                    <TableCell>{teacher.classes?.length || 0}</TableCell>
                    <TableCell>
                      <Chip 
                        label={teacher.isActive ? 'Active' : 'Inactive'} 
                        size="small"
                        color={teacher.isActive ? 'success' : 'default'} 
                      />
                    </TableCell>
                  </TableRow>
                )) : (
                  <TableRow>
                    <TableCell colSpan={5} align="center">No teachers found</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      )}
    </Box>
  );

  const SchoolManagement = () => {
    if (schoolDetailView && selectedSchool) {
      return <SchoolDetailView />;
    }

    return (
      <Box>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Typography variant="h4">
            School Management
          </Typography>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => setOpenSchoolDialog(true)}
          >
            Add School
          </Button>
        </Box>

        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>School Name</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Location</TableCell>
                <TableCell>Contact</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Subscription</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {schools.map((school) => (
                <TableRow 
                  key={school.id} 
                  sx={{ cursor: 'pointer', '&:hover': { bgcolor: 'grey.50' } }}
                  onClick={() => handleSchoolClick(school)}
                >
                  <TableCell>{school.name}</TableCell>
                  <TableCell>
                    <Chip 
                      label={school.schoolType?.replace('_', ' ').toUpperCase()} 
                      size="small" 
                      color="primary" 
                    />
                  </TableCell>
                  <TableCell>
                    {typeof school.address === 'string' 
                      ? `${school.city || 'N/A'}, ${school.state || 'N/A'}`
                      : `${school.address?.city || school.city || 'N/A'}, ${school.address?.state || school.state || 'N/A'}`
                    }
                  </TableCell>
                  <TableCell>{school.contactPerson?.name || 'N/A'}</TableCell>
                  <TableCell>
                    <Chip 
                      label={school.isActive ? 'Active' : 'Inactive'} 
                      size="small"
                      color={school.isActive ? 'success' : 'default'} 
                    />
                  </TableCell>
                  <TableCell>
                    <Chip 
                      label={school.subscription?.plan?.toUpperCase()} 
                      size="small" 
                      color="secondary" 
                    />
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <IconButton onClick={() => handleViewSchool(school)}>
                        <Visibility />
                      </IconButton>
                    <IconButton onClick={() => handleEditSchool(school)}>
                        <Edit />
                      </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>
    );
  };

  const UserManagement = () => (
    <Box>
      <Typography variant="h4" gutterBottom>
        User Management
      </Typography>
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Email</TableCell>
              <TableCell>Role</TableCell>
              <TableCell>School</TableCell>
              <TableCell>Status</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {users && users.length > 0 ? users.map((user) => (
              <TableRow key={user.id}>
                <TableCell>{user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : user.firstName || user.lastName || 'N/A'}</TableCell>
                <TableCell>{user.email || 'N/A'}</TableCell>
                <TableCell>
                  <Chip 
                    label={user.role?.toUpperCase() || 'N/A'} 
                    size="small"
                    color="primary" 
                  />
                </TableCell>
                <TableCell>{typeof user.school === 'string' ? user.school : user.school?.name || 'N/A'}</TableCell>
                <TableCell>
                  <Chip 
                    label="Active" 
                    size="small"
                    color="success" 
                  />
                </TableCell>
              </TableRow>
            )) : (
              <TableRow>
                <TableCell colSpan={5} align="center">No users found</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );

  const BillingManagement = () => (
    <Box>
      <Typography variant="h4" gutterBottom>
        Billing Management
      </Typography>
      
      {/* Summary Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Total Schools
              </Typography>
              <Typography variant="h3" color="primary" sx={{ fontWeight: 'bold' }}>
                {schools.length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Total Students
              </Typography>
              <Typography variant="h3" color="primary" sx={{ fontWeight: 'bold' }}>
                {Object.values(schoolStudentCounts).reduce((sum, count) => sum + count, 0).toLocaleString()}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Total Monthly Revenue
              </Typography>
              <Typography variant="h3" color="success.main" sx={{ fontWeight: 'bold' }}>
                ${calculateTotalRevenue().toLocaleString()}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* School Billing Table */}
      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            School Billing Details
          </Typography>
          {loadingBillingData && (
            <Box display="flex" justifyContent="center" my={2}>
              <LinearProgress sx={{ width: '100%' }} />
            </Box>
          )}
          <TableContainer component={Paper} sx={{ mt: 2 }}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>School Name</TableCell>
                  <TableCell>Students</TableCell>
                  <TableCell>Per Student Cost ($)</TableCell>
                  <TableCell>Monthly Cost ($)</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {schools.map((school) => {
                  const schoolId = school._id || school.id;
                  const studentCount = schoolStudentCounts[schoolId] || 0;
                  const perStudentCost = perStudentCosts[schoolId] || 0;
                  const monthlyCost = calculateMonthlyCost(schoolId, studentCount);
                  const isEditing = editingCost === schoolId;

                  return (
                    <TableRow key={schoolId}>
                      <TableCell>
                        <Box>
                          <Typography variant="body1" sx={{ fontWeight: 500 }}>
                            {school.name}
                          </Typography>
                          <Typography variant="caption" color="textSecondary">
                            {school.schoolType?.replace('_', ' ').toUpperCase()}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body1">
                          {studentCount.toLocaleString()}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        {isEditing ? (
                          <Box display="flex" alignItems="center" gap={1}>
                            <TextField
                              type="number"
                              size="small"
                              value={perStudentCost}
                              onChange={(e) => {
                                const newCost = parseFloat(e.target.value) || 0;
                                setPerStudentCosts(prev => ({
                                  ...prev,
                                  [schoolId]: newCost
                                }));
                              }}
                              sx={{ width: 100 }}
                              inputProps={{ min: 0, step: 0.01 }}
                            />
                            <IconButton 
                              size="small" 
                              color="primary"
                              onClick={() => handleCostSave(schoolId, perStudentCost)}
                            >
                              <CheckCircle />
                            </IconButton>
                            <IconButton 
                              size="small" 
                              color="error"
                              onClick={handleCostCancel}
                            >
                              <Delete />
                            </IconButton>
                          </Box>
                        ) : (
                          <Box display="flex" alignItems="center" gap={1}>
                            <Typography variant="body1">
                              ${perStudentCost.toFixed(2)}
                            </Typography>
                            <IconButton 
                              size="small" 
                              onClick={() => handleCostEdit(schoolId)}
                            >
                              <Edit />
                            </IconButton>
                          </Box>
                        )}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body1" sx={{ fontWeight: 500, color: 'success.main' }}>
                          ${monthlyCost.toLocaleString()}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip 
                          label={school.subscription?.plan?.toUpperCase()} 
                          size="small" 
                          color="secondary" 
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* Subscription Plans Info */}
      <Grid container spacing={3} sx={{ mt: 3 }}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Subscription Plans
              </Typography>
              <Box sx={{ mb: 2 }}>
                <Typography variant="body1" sx={{ fontWeight: 500 }}>
                  Basic: $50/month
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  Suitable for small schools
                </Typography>
              </Box>
              <Box sx={{ mb: 2 }}>
                <Typography variant="body1" sx={{ fontWeight: 500 }}>
                  Premium: $200/month
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  For medium-sized institutions
                </Typography>
              </Box>
              <Box>
                <Typography variant="body1" sx={{ fontWeight: 500 }}>
                  Enterprise: $500/month
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  For large school districts
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Billing Summary
              </Typography>
              <Box sx={{ mb: 2 }}>
                <Typography variant="body1">
                  Total Schools: {schools.length}
                </Typography>
                <Typography variant="body1">
                  Total Students: {Object.values(schoolStudentCounts).reduce((sum, count) => sum + count, 0).toLocaleString()}
                </Typography>
                <Typography variant="body1">
                  Average Per Student: ${Object.values(schoolStudentCounts).reduce((sum, count) => sum + count, 0) > 0 ? (calculateTotalRevenue() / Object.values(schoolStudentCounts).reduce((sum, count) => sum + count, 0)).toFixed(2) : '0.00'}
                </Typography>
              </Box>
              <Box sx={{ p: 2, bgcolor: 'success.50', borderRadius: 1, border: '1px solid', borderColor: 'success.200' }}>
                <Typography variant="h6" color="success.main" sx={{ fontWeight: 'bold' }}>
                  Total Monthly Revenue: ${calculateTotalRevenue().toLocaleString()}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );

  const AdvancedAnalytics = () => (
    <Box>
      <Typography variant="h4" gutterBottom>
        Advanced Analytics
        </Typography>
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                School Distribution by Type
              </Typography>
              <LinearProgress variant="determinate" value={70} />
              <Typography variant="body2" color="textSecondary">
                Private Schools: 70%
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                User Growth
              </Typography>
              <LinearProgress variant="determinate" value={85} />
              <Typography variant="body2" color="textSecondary">
                Monthly Growth: 85%
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );

  const SupportCenter = () => (
    <Box>
      <Typography variant="h4" gutterBottom>
        Support Center
      </Typography>
      <Grid container spacing={3}>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Open Tickets
              </Typography>
              <Typography variant="h4">12</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Resolved Today
              </Typography>
              <Typography variant="h4">8</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Average Response Time
              </Typography>
              <Typography variant="h4">2.5h</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );

  const SystemSettings = () => (
    <Box>
      <Typography variant="h4" gutterBottom>
        System Settings
      </Typography>
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                System Status
              </Typography>
              <Chip label="All Systems Operational" color="success" />
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Database Status
              </Typography>
              <Chip label="Connected" color="success" />
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex' }}>
      {/* App Bar */}
      <AppBar position="fixed" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}>
        <Toolbar sx={{ background: 'linear-gradient(135deg, #17437b 0%, #26aea6 100%)' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexGrow: 1 }}>
            <img src="/kidsible-logo.png" alt="Kidsible" style={{ height: '32px', width: 'auto', objectFit: 'contain', filter: 'brightness(0) invert(1)' }} />
            <Typography variant="body2" noWrap sx={{ color: 'rgba(255,255,255,0.75)', fontStyle: 'italic' }}>
              Super Admin
            </Typography>
          </Box>
          <IconButton
            size="large"
            edge="end"
            color="inherit"
            onClick={handleMenuOpen}
          >
            <AccountCircle />
          </IconButton>
          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={handleMenuClose}
          >
            <MenuItem onClick={handleMenuClose}>
              <AccountCircle sx={{ mr: 2 }} />
              Profile
            </MenuItem>
            <MenuItem onClick={handleMenuClose}>
              <Settings sx={{ mr: 2 }} />
              Settings
            </MenuItem>
            <Divider />
            <MenuItem onClick={handleLogout}>
              <Logout sx={{ mr: 2 }} />
              Logout
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      {/* Sidebar */}
      <Drawer
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: drawerWidth,
            boxSizing: 'border-box',
          },
        }}
        variant="permanent"
        anchor="left"
      >
        <Toolbar />
        <Box sx={{ overflow: 'auto', display: 'flex', flexDirection: 'column', height: 'calc(100% - 64px)' }}>
          <List sx={{ flex: 1 }}>
            {menuItems.map((item) => (
              <ListItem key={item.text} disablePadding>
                <ListItemButton
                  selected={currentSection === item.section}
                  onClick={() => setCurrentSection(item.section)}
                >
                  <ListItemIcon>{item.icon}</ListItemIcon>
                  <ListItemText primary={item.text} />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
          {/* Kidsible Platform Branding */}
          <Box sx={{ p: 2, borderTop: '1px solid rgba(0,0,0,0.08)', textAlign: 'center' }}>
            <Typography variant="caption" sx={{ color: '#727272', fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'block', mb: 0.5 }}>
              Powered by
            </Typography>
            <img
              src="/kidsible-logo.png"
              alt="Kidsible"
              style={{ height: '28px', width: 'auto', objectFit: 'contain', display: 'block', margin: '0 auto' }}
            />
          </Box>
        </Box>
      </Drawer>

      {/* Main Content */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          bgcolor: 'background.default',
          p: 3,
          mt: 8,
        }}
      >
        {loading ? (
          <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
            <LinearProgress sx={{ width: '100%' }} />
          </Box>
        ) : (
          renderSection()
        )}
      </Box>

      {/* Add School Dialog */}
      <Dialog 
        open={openSchoolDialog} 
        onClose={() => setOpenSchoolDialog(false)} 
        maxWidth="md" 
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 2,
            boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
          }
        }}
      >
        <DialogTitle sx={{ 
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          pb: 2
        }}>
          <Add sx={{ fontSize: 28 }} />
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              Add New School
            </Typography>
            <Typography variant="body2" sx={{ opacity: 0.9, mt: 0.5 }}>
              Create a new school with comprehensive information
            </Typography>
          </Box>
        </DialogTitle>
        
        <DialogContent sx={{ p: 3 }}>
          <Box>
            {/* Basic Information Section */}
            <Box sx={{ mb: 3 }}>
              <Typography variant="h6" sx={{ 
                mb: 2, 
                color: 'primary.main', 
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: 1
              }}>
                <Info sx={{ fontSize: 20 }} />
                Basic Information
              </Typography>
              <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
                  <TextField 
                    fullWidth 
                    label="School Name" 
                    value={schoolForm.name}
                    onChange={(e) => setSchoolForm({...schoolForm, name: e.target.value})}
                    required
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        borderRadius: 2,
                        '&:hover fieldset': {
                          borderColor: 'primary.main',
                        },
                      },
                    }}
                  />
            </Grid>
            <Grid item xs={12} md={6}>
                  <FormControl fullWidth>
                    <InputLabel>School Type</InputLabel>
                    <Select 
                      label="School Type"
                      value={schoolForm.schoolType}
                      onChange={(e) => handleSchoolTypeChange(e.target.value)}
                      sx={{
                        borderRadius: 2,
                        '& .MuiOutlinedInput-notchedOutline': {
                          '&:hover': {
                            borderColor: 'primary.main',
                          },
                        },
                      }}
                    >
                      <MenuItem value="licensed_daycare">Licensed Daycare</MenuItem>
                      <MenuItem value="montessori_school">Montessori School</MenuItem>
                      <MenuItem value="public_private_school">Public & Private School</MenuItem>
                    </Select>
                  </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
                  <TextField 
                    fullWidth 
                    label="Estimated Students" 
                    type="number" 
                    value={schoolForm.estimatedStudents}
                    onChange={(e) => setSchoolForm({...schoolForm, estimatedStudents: e.target.value})}
                    required
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        borderRadius: 2,
                        '&:hover fieldset': {
                          borderColor: 'primary.main',
                        },
                      },
                    }}
                  />
            </Grid>
                        <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                    <InputLabel>Grade Levels</InputLabel>
                    <Select 
                      multiple
                      label="Grade Levels"
                      value={schoolForm.gradeLevels}
                      onChange={(e) => setSchoolForm({...schoolForm, gradeLevels: Array.isArray(e.target.value) ? e.target.value : [e.target.value]})}
                      renderValue={(selected) => selected.map(grade => getGradeLevelDisplayName(grade)).join(', ')}
                      sx={{
                        borderRadius: 2,
                        '& .MuiOutlinedInput-notchedOutline': {
                          '&:hover': {
                            borderColor: 'primary.main',
                          },
                        },
                      }}
                    >
                      {getGradeLevelsForSchoolType(schoolForm.schoolType).map((gradeLevel) => (
                        <MenuItem key={gradeLevel} value={gradeLevel}>
                          {getGradeLevelDisplayName(gradeLevel)}
                        </MenuItem>
                      ))}
                </Select>
              </FormControl>
            </Grid>
              </Grid>
            </Box>

            {/* Contact Information Section */}
            <Box sx={{ mb: 3 }}>
              <Typography variant="h6" sx={{ 
                mb: 2, 
                color: 'primary.main', 
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: 1
              }}>
                <ContactPhone sx={{ fontSize: 20 }} />
                Contact Information
              </Typography>
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <TextField 
                    fullWidth 
                    label="Contact Person" 
                    value={schoolForm.contactPerson}
                    onChange={(e) => setSchoolForm({...schoolForm, contactPerson: e.target.value})}
                    required
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        borderRadius: 2,
                        '&:hover fieldset': {
                          borderColor: 'primary.main',
                        },
                      },
                    }}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField 
                    fullWidth 
                    label="Email Address" 
                    type="email" 
                    value={schoolForm.email}
                    onChange={(e) => setSchoolForm({...schoolForm, email: e.target.value})}
                    required
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        borderRadius: 2,
                        '&:hover fieldset': {
                          borderColor: 'primary.main',
                        },
                      },
                    }}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField 
                    fullWidth 
                    label="Phone Number" 
                    value={schoolForm.phone}
                    onChange={(e) => setSchoolForm({...schoolForm, phone: e.target.value})}
                    required
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        borderRadius: 2,
                        '&:hover fieldset': {
                          borderColor: 'primary.main',
                        },
                      },
                    }}
                  />
                </Grid>
              </Grid>
            </Box>

            {/* Address Information Section */}
            <Box sx={{ mb: 3 }}>
              <Typography variant="h6" sx={{ 
                mb: 2, 
                color: 'primary.main', 
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: 1
              }}>
                <LocationOn sx={{ fontSize: 20 }} />
                Address Information
              </Typography>
              <Grid container spacing={3}>
            <Grid item xs={12}>
                  <TextField 
                    fullWidth 
                    label="Street Address" 
                    multiline 
                    rows={2} 
                    value={schoolForm.address}
                    onChange={(e) => setSchoolForm({...schoolForm, address: e.target.value})}
                    required
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        borderRadius: 2,
                        '&:hover fieldset': {
                          borderColor: 'primary.main',
                        },
                      },
                    }}
                  />
            </Grid>
                <Grid item xs={12} md={6}>
                  <FormControl fullWidth>
                    <InputLabel>Country</InputLabel>
                    <Select 
                      label="Country"
                      value={schoolForm.country}
                      onChange={(e) => handleCountryChange(e.target.value)}
                      sx={{
                        borderRadius: 2,
                        '& .MuiOutlinedInput-notchedOutline': {
                          '&:hover': {
                            borderColor: 'primary.main',
                          },
                        },
                      }}
                    >
                      {COUNTRIES.map((country) => (
                        <MenuItem key={country.isoCode} value={country.name}>{country.name}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={6}>
                  <FormControl fullWidth>
                    <InputLabel>State/Province</InputLabel>
                    <Select 
                      label="State/Province"
                      value={schoolForm.state}
                      onChange={(e) => handleStateChange(e.target.value)}
                      disabled={!states.length}
                      sx={{
                        borderRadius: 2,
                        '& .MuiOutlinedInput-notchedOutline': {
                          '&:hover': {
                            borderColor: 'primary.main',
                          },
                        },
                      }}
                    >
                      {states.map((state) => (
                        <MenuItem key={state.isoCode} value={state.name}>{state.name}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={6}>
                  <FormControl fullWidth>
                    <InputLabel>City</InputLabel>
                    <Select 
                      label="City"
                      value={schoolForm.city}
                      onChange={(e) => setSchoolForm({...schoolForm, city: e.target.value})}
                      disabled={!cities.length}
                      sx={{
                        borderRadius: 2,
                        '& .MuiOutlinedInput-notchedOutline': {
                          '&:hover': {
                            borderColor: 'primary.main',
                          },
                        },
                      }}
                    >
                      {cities.map((city) => (
                        <MenuItem key={city.id} value={city.name}>{city.name}</MenuItem>
                      ))}
                      <MenuItem value="custom">Custom City...</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                {schoolForm.city === 'custom' && (
                  <Grid item xs={12} md={6}>
                    <TextField 
                      fullWidth 
                      label="Custom City Name" 
                      value={schoolForm.customCity}
                      onChange={(e) => setSchoolForm({...schoolForm, customCity: e.target.value})}
                      required
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          borderRadius: 2,
                          '&:hover fieldset': {
                            borderColor: 'primary.main',
                          },
                        },
                      }}
                    />
                  </Grid>
                )}
                <Grid item xs={12} md={6}>
                  <TextField 
                    fullWidth 
                    label="ZIP/Postal Code" 
                    value={schoolForm.zipCode}
                    onChange={(e) => setSchoolForm({...schoolForm, zipCode: e.target.value})}
                    required
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        borderRadius: 2,
                        '&:hover fieldset': {
                          borderColor: 'primary.main',
                        },
                      },
                    }}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TimezoneSelector
                    value={schoolForm.timezone}
                    onChange={(timezone) => setSchoolForm({...schoolForm, timezone})}
                    label="Timezone *"
                    placeholder="Search for a timezone..."
                    required
                    fullWidth
                  />
                </Grid>
              </Grid>
            </Box>

            {/* Subscription & Status Section */}
            <Box>
              <Typography variant="h6" sx={{ 
                mb: 2, 
                color: 'primary.main', 
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: 1
              }}>
                <AccountBalance sx={{ fontSize: 20 }} />
                Subscription & Status
              </Typography>
              <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Subscription Plan</InputLabel>
                    <Select 
                      label="Subscription Plan"
                      value={schoolForm.subscriptionPlan}
                      onChange={(e) => setSchoolForm({...schoolForm, subscriptionPlan: e.target.value})}
                      sx={{
                        borderRadius: 2,
                        '& .MuiOutlinedInput-notchedOutline': {
                          '&:hover': {
                            borderColor: 'primary.main',
                          },
                        },
                      }}
                    >
                      <MenuItem value="basic">Basic ($50/month)</MenuItem>
                      <MenuItem value="premium">Premium ($200/month)</MenuItem>
                      <MenuItem value="enterprise">Enterprise ($500/month)</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
                  <Box sx={{ 
                    p: 2, 
                    borderRadius: 2, 
                    bgcolor: 'grey.50',
                    border: '1px solid',
                    borderColor: 'grey.200',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      School Status
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={schoolForm.isActive}
                            onChange={(e) => setSchoolForm({...schoolForm, isActive: e.target.checked})}
                            color="primary"
                          />
                        }
                        label=""
                      />
                      <Chip 
                        label={schoolForm.isActive ? 'Active' : 'Inactive'} 
                        color={schoolForm.isActive ? 'success' : 'default'} 
                        sx={{ 
                          fontWeight: 600,
                          '& .MuiChip-label': {
                            px: 2
                          }
                        }}
                      />
                    </Box>
                  </Box>
            </Grid>
          </Grid>
            </Box>
          </Box>
        </DialogContent>
        
        <DialogActions sx={{ p: 3, pt: 0 }}>
          <Button 
            onClick={() => setOpenSchoolDialog(false)}
            sx={{ 
              px: 3, 
              py: 1.5, 
              borderRadius: 2,
              textTransform: 'none',
              fontWeight: 600
            }}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleAddSchool} 
            variant="contained" 
            disabled={isSubmitting}
            sx={{ 
              px: 3, 
              py: 1.5, 
              borderRadius: 2,
              textTransform: 'none',
              fontWeight: 600,
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              '&:hover': {
                background: 'linear-gradient(135deg, #5a6fd8 0%, #6a4190 100%)',
              }
            }}
          >
            {isSubmitting ? 'Adding...' : 'Add School'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit School Dialog */}
      <Dialog 
        open={openEditSchoolDialog} 
        onClose={() => setOpenEditSchoolDialog(false)} 
        maxWidth="md" 
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 2,
            boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
          }
        }}
      >
        <DialogTitle sx={{ 
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          pb: 2
        }}>
          <Edit sx={{ fontSize: 28 }} />
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              Edit School
            </Typography>
            <Typography variant="body2" sx={{ opacity: 0.9, mt: 0.5 }}>
              Update school information and settings
            </Typography>
          </Box>
        </DialogTitle>
        
        <DialogContent sx={{ p: 3 }}>
          <Box>
            {/* Basic Information Section */}
            <Box sx={{ mb: 3 }}>
              <Typography variant="h6" sx={{ 
                mb: 2, 
                color: 'primary.main', 
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: 1
              }}>
                <Info sx={{ fontSize: 20 }} />
                Basic Information
              </Typography>
              <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
                  <TextField 
                    fullWidth 
                    label="School Name" 
                    value={schoolForm.name}
                    onChange={(e) => setSchoolForm({...schoolForm, name: e.target.value})}
                    required
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        borderRadius: 2,
                        '&:hover fieldset': {
                          borderColor: 'primary.main',
                        },
                      },
                    }}
                  />
            </Grid>
                            <Grid item xs={12} md={6}>
                  <FormControl fullWidth>
                    <InputLabel>School Type</InputLabel>
                    <Select 
                      label="School Type"
                      value={schoolForm.schoolType}
                      onChange={(e) => handleSchoolTypeChange(e.target.value)}
                      sx={{
                        borderRadius: 2,
                        '& .MuiOutlinedInput-notchedOutline': {
                          '&:hover': {
                            borderColor: 'primary.main',
                          },
                        },
                      }}
                    >
                      <MenuItem value="licensed_daycare">Licensed Daycare</MenuItem>
                      <MenuItem value="montessori_school">Montessori School</MenuItem>
                      <MenuItem value="public_private_school">Public & Private School</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField 
                    fullWidth 
                    label="Estimated Students" 
                    type="number" 
                    value={schoolForm.estimatedStudents}
                    onChange={(e) => setSchoolForm({...schoolForm, estimatedStudents: e.target.value})}
                    required
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        borderRadius: 2,
                        '&:hover fieldset': {
                          borderColor: 'primary.main',
                        },
                      },
                    }}
                  />
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                    <InputLabel>Grade Levels</InputLabel>
                    <Select 
                      multiple
                      label="Grade Levels"
                      value={schoolForm.gradeLevels}
                      onChange={(e) => setSchoolForm({...schoolForm, gradeLevels: Array.isArray(e.target.value) ? e.target.value : [e.target.value]})}
                      renderValue={(selected) => selected.map(grade => getGradeLevelDisplayName(grade)).join(', ')}
                      sx={{
                        borderRadius: 2,
                        '& .MuiOutlinedInput-notchedOutline': {
                          '&:hover': {
                            borderColor: 'primary.main',
                          },
                        },
                      }}
                    >
                      {getGradeLevelsForSchoolType(schoolForm.schoolType).map((gradeLevel) => (
                        <MenuItem key={gradeLevel} value={gradeLevel}>
                          {getGradeLevelDisplayName(gradeLevel)}
                        </MenuItem>
                      ))}
                </Select>
              </FormControl>
            </Grid>
              </Grid>
            </Box>

            {/* Contact Information Section */}
            <Box sx={{ mb: 3 }}>
              <Typography variant="h6" sx={{ 
                mb: 2, 
                color: 'primary.main', 
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: 1
              }}>
                <ContactPhone sx={{ fontSize: 20 }} />
                Contact Information
              </Typography>
              <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
                  <TextField 
                    fullWidth 
                    label="Contact Person" 
                    value={schoolForm.contactPerson}
                    onChange={(e) => setSchoolForm({...schoolForm, contactPerson: e.target.value})}
                    required
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        borderRadius: 2,
                        '&:hover fieldset': {
                          borderColor: 'primary.main',
                        },
                      },
                    }}
                  />
            </Grid>
                <Grid item xs={12} md={6}>
                  <TextField 
                    fullWidth 
                    label="Email Address" 
                    type="email" 
                    value={schoolForm.email}
                    onChange={(e) => setSchoolForm({...schoolForm, email: e.target.value})}
                    required
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        borderRadius: 2,
                        '&:hover fieldset': {
                          borderColor: 'primary.main',
                        },
                      },
                    }}
                  />
          </Grid>
                <Grid item xs={12} md={6}>
                  <TextField 
                    fullWidth 
                    label="Phone Number" 
                    value={schoolForm.phone}
                    onChange={(e) => setSchoolForm({...schoolForm, phone: e.target.value})}
                    required
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        borderRadius: 2,
                        '&:hover fieldset': {
                          borderColor: 'primary.main',
                        },
                      },
                    }}
                  />
                </Grid>
              </Grid>
            </Box>

            {/* Address Information Section */}
            <Box sx={{ mb: 3 }}>
              <Typography variant="h6" sx={{ 
                mb: 2, 
                color: 'primary.main', 
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: 1
              }}>
                <LocationOn sx={{ fontSize: 20 }} />
                Address Information
              </Typography>
              <Grid container spacing={3}>
                <Grid item xs={12}>
                  <TextField 
                    fullWidth 
                    label="Street Address" 
                    multiline 
                    rows={2} 
                    value={schoolForm.address}
                    onChange={(e) => setSchoolForm({...schoolForm, address: e.target.value})}
                    required
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        borderRadius: 2,
                        '&:hover fieldset': {
                          borderColor: 'primary.main',
                        },
                      },
                    }}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <FormControl fullWidth>
                    <InputLabel>Country</InputLabel>
                    <Select 
                      label="Country"
                      value={schoolForm.country}
                      onChange={(e) => handleCountryChange(e.target.value)}
                      sx={{
                        borderRadius: 2,
                        '& .MuiOutlinedInput-notchedOutline': {
                          '&:hover': {
                            borderColor: 'primary.main',
                          },
                        },
                      }}
                    >
                      {COUNTRIES.map((country) => (
                        <MenuItem key={country.isoCode} value={country.name}>{country.name}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={6}>
                  <FormControl fullWidth>
                    <InputLabel>State/Province</InputLabel>
                    <Select 
                      label="State/Province"
                      value={schoolForm.state}
                      onChange={(e) => handleStateChange(e.target.value)}
                      disabled={!states.length}
                      sx={{
                        borderRadius: 2,
                        '& .MuiOutlinedInput-notchedOutline': {
                          '&:hover': {
                            borderColor: 'primary.main',
                          },
                        },
                      }}
                    >
                      {states.map((state) => (
                        <MenuItem key={state.isoCode} value={state.name}>{state.name}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={6}>
                  <FormControl fullWidth>
                    <InputLabel>City</InputLabel>
                    <Select 
                      label="City"
                      value={schoolForm.city}
                      onChange={(e) => setSchoolForm({...schoolForm, city: e.target.value})}
                      disabled={!cities.length}
                      sx={{
                        borderRadius: 2,
                        '& .MuiOutlinedInput-notchedOutline': {
                          '&:hover': {
                            borderColor: 'primary.main',
                          },
                        },
                      }}
                    >
                      {cities.map((city) => (
                        <MenuItem key={city.id} value={city.name}>{city.name}</MenuItem>
                      ))}
                      <MenuItem value="custom">Custom City...</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                {schoolForm.city === 'custom' && (
                  <Grid item xs={12} md={6}>
                    <TextField 
                      fullWidth 
                      label="Custom City Name" 
                      value={schoolForm.customCity}
                      onChange={(e) => setSchoolForm({...schoolForm, customCity: e.target.value})}
                      required
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          borderRadius: 2,
                          '&:hover fieldset': {
                            borderColor: 'primary.main',
                          },
                        },
                      }}
                    />
                  </Grid>
                )}
                <Grid item xs={12} md={6}>
                  <TextField 
                    fullWidth 
                    label="ZIP/Postal Code" 
                    value={schoolForm.zipCode}
                    onChange={(e) => setSchoolForm({...schoolForm, zipCode: e.target.value})}
                    required
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        borderRadius: 2,
                        '&:hover fieldset': {
                          borderColor: 'primary.main',
                        },
                      },
                    }}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TimezoneSelector
                    value={schoolForm.timezone}
                    onChange={(timezone) => setSchoolForm({...schoolForm, timezone})}
                    label="Timezone *"
                    placeholder="Search for a timezone..."
                    required
                    fullWidth
                  />
                </Grid>
              </Grid>
            </Box>

            {/* Subscription & Status Section */}
            <Box>
              <Typography variant="h6" sx={{ 
                mb: 2, 
                color: 'primary.main', 
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: 1
              }}>
                <AccountBalance sx={{ fontSize: 20 }} />
                Subscription & Status
              </Typography>
              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <FormControl fullWidth>
                    <InputLabel>Subscription Plan</InputLabel>
                    <Select 
                      label="Subscription Plan"
                      value={schoolForm.subscriptionPlan}
                      onChange={(e) => setSchoolForm({...schoolForm, subscriptionPlan: e.target.value})}
                      sx={{
                        borderRadius: 2,
                        '& .MuiOutlinedInput-notchedOutline': {
                          '&:hover': {
                            borderColor: 'primary.main',
                          },
                        },
                      }}
                    >
                      <MenuItem value="basic">Basic ($50/month)</MenuItem>
                      <MenuItem value="premium">Premium ($200/month)</MenuItem>
                      <MenuItem value="enterprise">Enterprise ($500/month)</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Box sx={{ 
                    p: 2, 
                    borderRadius: 2, 
                    bgcolor: 'grey.50',
                    border: '1px solid',
                    borderColor: 'grey.200',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      School Status
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={schoolForm.isActive}
                            onChange={(e) => setSchoolForm({...schoolForm, isActive: e.target.checked})}
                            color="primary"
                          />
                        }
                        label=""
                      />
                      <Chip 
                        label={schoolForm.isActive ? 'Active' : 'Inactive'} 
                        color={schoolForm.isActive ? 'success' : 'default'} 
                        sx={{ 
                          fontWeight: 600,
                          '& .MuiChip-label': {
                            px: 2
                          }
                        }}
                      />
                    </Box>
                  </Box>
                </Grid>
              </Grid>
            </Box>
          </Box>
        </DialogContent>
        
        <DialogActions sx={{ p: 3, pt: 0 }}>
          <Button 
            onClick={() => setOpenEditSchoolDialog(false)}
            sx={{ 
              borderRadius: 2,
              px: 3,
              py: 1,
              textTransform: 'none',
              fontWeight: 600
            }}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleUpdateSchool} 
            variant="contained" 
            disabled={isSubmitting}
            sx={{ 
              borderRadius: 2,
              px: 3,
              py: 1,
              textTransform: 'none',
              fontWeight: 600
            }}
          >
            {isSubmitting ? 'Updating...' : 'Update School'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* View School Dialog */}
      <Dialog 
        open={openViewSchoolDialog} 
        onClose={() => setOpenViewSchoolDialog(false)} 
        maxWidth="md" 
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 2,
            boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
          }
        }}
      >
        <DialogTitle sx={{ 
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          pb: 2
        }}>
          <School sx={{ fontSize: 28 }} />
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              School Details
            </Typography>
            <Typography variant="body2" sx={{ opacity: 0.9, mt: 0.5 }}>
              Comprehensive information about the school
            </Typography>
          </Box>
        </DialogTitle>
        
        <DialogContent sx={{ p: 3 }}>
          {selectedSchool && (
            <Box>
              {/* School Basic Info Section */}
              <Box sx={{ mb: 3 }}>
                <Typography variant="h6" sx={{ 
                  mb: 2, 
                  color: 'primary.main', 
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1
                }}>
                  <Info sx={{ fontSize: 20 }} />
                  Basic Information
                </Typography>
                <Grid container spacing={3}>
                  <Grid item xs={12} md={6}>
                    <Box sx={{ 
                      p: 2, 
                      borderRadius: 2, 
                      bgcolor: 'grey.50',
                      border: '1px solid',
                      borderColor: 'grey.200'
                    }}>
                      <Typography variant="caption" color="textSecondary" sx={{ fontWeight: 600, textTransform: 'uppercase' }}>
                        School Name
                      </Typography>
                      <Typography variant="body1" sx={{ mt: 0.5, fontWeight: 500 }}>
                        {selectedSchool.name}
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Box sx={{ 
                      p: 2, 
                      borderRadius: 2, 
                      bgcolor: 'grey.50',
                      border: '1px solid',
                      borderColor: 'grey.200'
                    }}>
                      <Typography variant="caption" color="textSecondary" sx={{ fontWeight: 600, textTransform: 'uppercase' }}>
                        School Type
                      </Typography>
                      <Typography variant="body1" sx={{ mt: 0.5, fontWeight: 500 }}>
                        {selectedSchool.schoolType?.replace('_', ' ').toUpperCase()}
                      </Typography>
                    </Box>
                  </Grid>
                </Grid>
              </Box>

              {/* Contact Information Section */}
              <Box sx={{ mb: 3 }}>
                <Typography variant="h6" sx={{ 
                  mb: 2, 
                  color: 'primary.main', 
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1
                }}>
                  <ContactPhone sx={{ fontSize: 20 }} />
                  Contact Information
                </Typography>
                <Grid container spacing={3}>
                  <Grid item xs={12} md={6}>
                    <Box sx={{ 
                      p: 2, 
                      borderRadius: 2, 
                      bgcolor: 'grey.50',
                      border: '1px solid',
                      borderColor: 'grey.200'
                    }}>
                      <Typography variant="caption" color="textSecondary" sx={{ fontWeight: 600, textTransform: 'uppercase' }}>
                        Contact Person
                      </Typography>
                      <Typography variant="body1" sx={{ mt: 0.5, fontWeight: 500 }}>
                        {selectedSchool.contactPerson?.name || 'N/A'}
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Box sx={{ 
                      p: 2, 
                      borderRadius: 2, 
                      bgcolor: 'grey.50',
                      border: '1px solid',
                      borderColor: 'grey.200'
                    }}>
                      <Typography variant="caption" color="textSecondary" sx={{ fontWeight: 600, textTransform: 'uppercase' }}>
                        Email Address
                      </Typography>
                      <Typography variant="body1" sx={{ mt: 0.5, fontWeight: 500 }}>
                        {selectedSchool.contactPerson?.email || 'N/A'}
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Box sx={{ 
                      p: 2, 
                      borderRadius: 2, 
                      bgcolor: 'grey.50',
                      border: '1px solid',
                      borderColor: 'grey.200'
                    }}>
                      <Typography variant="caption" color="textSecondary" sx={{ fontWeight: 600, textTransform: 'uppercase' }}>
                        Phone Number
                      </Typography>
                      <Typography variant="body1" sx={{ mt: 0.5, fontWeight: 500 }}>
                        {selectedSchool.contactPerson?.phone || 'N/A'}
                      </Typography>
                    </Box>
                  </Grid>
                </Grid>
              </Box>

              {/* Timezone Section */}
              <Box sx={{ mb: 3 }}>
                <Typography variant="h6" sx={{ 
                  mb: 2, 
                  color: 'primary.main', 
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1
                }}>
                  <Public sx={{ fontSize: 20 }} />
                  Timezone Settings
                </Typography>
                <Grid container spacing={3}>
                  <Grid item xs={12} md={6}>
                    <Box sx={{ 
                      p: 2, 
                      borderRadius: 2, 
                      bgcolor: 'grey.50',
                      border: '1px solid',
                      borderColor: 'grey.200'
                    }}>
                      <Typography variant="caption" color="textSecondary" sx={{ fontWeight: 600, textTransform: 'uppercase' }}>
                        Current Timezone
                      </Typography>
                      <Typography variant="body1" sx={{ mt: 0.5, fontWeight: 500 }}>
                        {timezoneOptions.find((tz: any) => tz.value === selectedSchool.settings?.timezone)?.label || selectedSchool.settings?.timezone || 'UTC'}
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Button
                      variant="outlined"
                      startIcon={<Edit />}
                      onClick={() => {
                        setSchoolForm({
                          ...schoolForm,
                          timezone: selectedSchool.settings?.timezone || 'UTC'
                        });
                        setOpenEditSchoolDialog(true);
                      }}
                      sx={{
                        borderRadius: 2,
                        px: 3,
                        py: 1.5,
                        fontWeight: 600,
                        borderColor: 'rgba(102, 126, 234, 0.3)',
                        color: '#667eea',
                        '&:hover': {
                          borderColor: '#667eea',
                          backgroundColor: 'rgba(102, 126, 234, 0.05)'
                        }
                      }}
                    >
                      Update Timezone
                    </Button>
                  </Grid>
                </Grid>
              </Box>

              {/* Address Section */}
              <Box sx={{ mb: 3 }}>
                <Typography variant="h6" sx={{ 
                  mb: 2, 
                  color: 'primary.main', 
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1
                }}>
                  <LocationOn sx={{ fontSize: 20 }} />
                  Address Information
                </Typography>
                <Grid container spacing={3}>
                  <Grid item xs={12}>
                    <Box sx={{ 
                      p: 2, 
                      borderRadius: 2, 
                      bgcolor: 'grey.50',
                      border: '1px solid',
                      borderColor: 'grey.200'
                    }}>
                      <Typography variant="caption" color="textSecondary" sx={{ fontWeight: 600, textTransform: 'uppercase' }}>
                        Street Address
                      </Typography>
                      <Typography variant="body1" sx={{ mt: 0.5, fontWeight: 500 }}>
                        {typeof selectedSchool.address === 'string' 
                          ? selectedSchool.address 
                          : selectedSchool.address?.street || 'N/A'
                        }
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <Box sx={{ 
                      p: 2, 
                      borderRadius: 2, 
                      bgcolor: 'grey.50',
                      border: '1px solid',
                      borderColor: 'grey.200'
                    }}>
                      <Typography variant="caption" color="textSecondary" sx={{ fontWeight: 600, textTransform: 'uppercase' }}>
                        City
                      </Typography>
                      <Typography variant="body1" sx={{ mt: 0.5, fontWeight: 500 }}>
                        {typeof selectedSchool.address === 'string' 
                          ? selectedSchool.city 
                          : selectedSchool.address?.city || selectedSchool.city || 'N/A'
                        }
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <Box sx={{ 
                      p: 2, 
                      borderRadius: 2, 
                      bgcolor: 'grey.50',
                      border: '1px solid',
                      borderColor: 'grey.200'
                    }}>
                      <Typography variant="caption" color="textSecondary" sx={{ fontWeight: 600, textTransform: 'uppercase' }}>
                        State/Province
                      </Typography>
                      <Typography variant="body1" sx={{ mt: 0.5, fontWeight: 500 }}>
                        {typeof selectedSchool.address === 'string' 
                          ? selectedSchool.state 
                          : selectedSchool.address?.state || selectedSchool.state || 'N/A'
                        }
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <Box sx={{ 
                      p: 2, 
                      borderRadius: 2, 
                      bgcolor: 'grey.50',
                      border: '1px solid',
                      borderColor: 'grey.200'
                    }}>
                      <Typography variant="caption" color="textSecondary" sx={{ fontWeight: 600, textTransform: 'uppercase' }}>
                        ZIP/Postal Code
                      </Typography>
                      <Typography variant="body1" sx={{ mt: 0.5, fontWeight: 500 }}>
                        {typeof selectedSchool.address === 'string' 
                          ? selectedSchool.zipCode 
                          : selectedSchool.address?.zipCode || selectedSchool.zipCode || 'N/A'
                        }
                      </Typography>
                    </Box>
                  </Grid>
                </Grid>
              </Box>

              {/* Subscription & Status Section */}
              <Box>
                <Typography variant="h6" sx={{ 
                  mb: 2, 
                  color: 'primary.main', 
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1
                }}>
                  <AccountBalance sx={{ fontSize: 20 }} />
                  Subscription & Status
                </Typography>
                <Grid container spacing={3}>
                  <Grid item xs={12} md={6}>
                    <Box sx={{ 
                      p: 2, 
                      borderRadius: 2, 
                      bgcolor: 'grey.50',
                      border: '1px solid',
                      borderColor: 'grey.200'
                    }}>
                      <Typography variant="caption" color="textSecondary" sx={{ fontWeight: 600, textTransform: 'uppercase' }}>
                        Subscription Plan
                      </Typography>
                      <Typography variant="body1" sx={{ mt: 0.5, fontWeight: 500 }}>
                        {selectedSchool.subscription?.plan?.toUpperCase()}
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Box sx={{ 
                      p: 2, 
                      borderRadius: 2, 
                      bgcolor: 'grey.50',
                      border: '1px solid',
                      borderColor: 'grey.200'
                    }}>
                      <Typography variant="caption" color="textSecondary" sx={{ fontWeight: 600, textTransform: 'uppercase' }}>
                        Status
                      </Typography>
                      <Box sx={{ mt: 0.5 }}>
                        <Chip 
                          label={selectedSchool.isActive ? 'Active' : 'Inactive'} 
                          color={selectedSchool.isActive ? 'success' : 'default'} 
                          sx={{ 
                            fontWeight: 600,
                            '& .MuiChip-label': {
                              px: 2
                            }
                          }}
                        />
                      </Box>
                    </Box>
                  </Grid>
                </Grid>
              </Box>
            </Box>
          )}
        </DialogContent>
        
        <DialogActions sx={{ p: 3, pt: 0 }}>
          <Button 
            onClick={() => setOpenViewSchoolDialog(false)}
            variant="contained"
            sx={{ 
              borderRadius: 2,
              px: 3,
              py: 1,
              textTransform: 'none',
              fontWeight: 600
            }}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert 
          onClose={() => setSnackbar({ ...snackbar, open: false })} 
          severity={snackbar.severity}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default SuperAdminDashboard; 