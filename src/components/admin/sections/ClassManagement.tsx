import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Avatar,
  LinearProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Alert,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Container,
  Fade,
  Grow,
  Autocomplete,
  Tooltip,
  Snackbar,
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
  Search,
  Refresh,
  Group,
  Info,
  PersonAdd,
  PersonRemove,
} from '@mui/icons-material';
import { useData } from '../../../contexts/DataContext';
import { useAuth } from '../../../contexts/AuthContext';
import { apiService, CreateClassData } from '../../../services/apiService';
import { themeColors } from '../../../theme/adminTheme';
import NotificationIcon from '../../common/NotificationIcon';
import {
  formatGradeForDisplay as formatGradeDisplay,
  convertDisplayToRawGrade as convertDisplayToRaw,
  areGradesEqual,
  normalizeGradeFormat as normalizeGradeForDisplay,
} from '../../../utils/gradeDisplayUtils';

interface ClassManagementProps {
  schoolBranding?: any;
}

interface Class {
  _id: string;
  id?: string;
  name: string;
  schoolId: string;
  grade: string;
  description?: string;
  status: 'active' | 'inactive' | 'archived';
  assignedTeachers: Array<{
    teacherId: {
      _id: string;
      firstName: string;
      lastName: string;
      email: string;
      avatar?: string;
      grade?: string;
      specialization?: string;
    };
    role: 'primary' | 'secondary' | 'assistant';
    assignedDate: string;
  }>;
  schedule: {
    academicYear: string;
    semester: 'fall' | 'spring' | 'summer';
    startDate: string;
    endDate?: string;
  };
  capacity: number;
  currentEnrollment: number;
  subjects: string[];
  createdBy: {
    _id: string;
    firstName: string;
    lastName: string;
  };
  isActive: boolean;
  isFull?: boolean;
  availableSpots?: number;
  createdAt: string;
  updatedAt: string;
}

interface Teacher {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  avatar?: string;
  grade?: string;
  specialization?: string;
  isActive: boolean;
}

const ClassManagement: React.FC<ClassManagementProps> = ({ schoolBranding }) => {
  const [openClassDialog, setOpenClassDialog] = useState(false);
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [selectedClass, setSelectedClass] = useState<Class | null>(null);
  const [dialogType, setDialogType] = useState<'add' | 'edit' | 'view'>('add');
  const [classToDelete, setClassToDelete] = useState<Class | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterGrade, setFilterGrade] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [classes, setClasses] = useState<Class[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'info' | 'warning';
  }>({
    open: false,
    message: '',
    severity: 'success',
  });

  // State for class form
  const [classForm, setClassForm] = useState({
    name: '',
    grade: '',
    description: '',
    capacity: 25,
    academicYear: new Date().getFullYear().toString(),
    semester: 'fall' as 'fall' | 'spring' | 'summer',
    subjects: [] as string[],
    assignedTeachers: [] as Array<{
      teacherId: string;
      role: 'primary' | 'secondary' | 'assistant';
    }>,
    status: 'active' as 'active' | 'inactive' | 'archived',
  });

  const { school, refreshData } = useData();
  const { user } = useAuth();

  // Get available grades from school data with fallback to default grades
  // If the school doesn't have gradeLevels configured, use standard grade levels
  const availableGrades = school.gradeLevels && school.gradeLevels.length > 0 
    ? school.gradeLevels 
    : ['preschool', 'kindergarten', 'grade1', 'grade2', 'grade3', 'grade4', 'grade5', 'grade6', 'grade7', 'grade8', 'grade9', 'grade10', 'grade11', 'grade12'];
  
  console.log('ClassManagement - school object:', school);
  console.log('ClassManagement - availableGrades:', availableGrades);

  const showSnackbar = (message: string, severity: 'success' | 'error' | 'info' | 'warning' = 'success') => {
    setSnackbar({
      open: true,
      message,
      severity,
    });
  };

  const handleCloseSnackbar = () => {
    setSnackbar(prev => ({ ...prev, open: false }));
  };

  // Load classes and teachers
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const [classesResponse, teachersResponse] = await Promise.all([
        apiService.getClasses(),
        apiService.getTeachers()
      ]);

      if (classesResponse.success && classesResponse.data) {
        // Convert grades to display format for existing classes
        const classesWithFormattedGrades = classesResponse.data.map((cls: any) => ({
          ...cls,
          grade: normalizeGradeForDisplay(cls.grade)
        }));
        setClasses(classesWithFormattedGrades);
      }

      if (teachersResponse.success && teachersResponse.data) {
        const activeTeachers = teachersResponse.data.filter((teacher: any) => teacher.isActive !== false);
        setTeachers(activeTeachers);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setIsLoading(false);
    }
  };

  // Filter classes based on search and filters
  const filteredClasses = classes.filter(classItem => {
    const matchesSearch = searchTerm === '' || 
      classItem.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      classItem.grade.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesGrade = filterGrade === '' || areGradesEqual(classItem.grade, filterGrade);
    const matchesStatus = filterStatus === '' || classItem.status === filterStatus;
    
    return matchesSearch && matchesGrade && matchesStatus;
  });

  const classStats = {
    totalClasses: classes.length,
    activeClasses: classes.filter(c => c.status === 'active').length,
    totalTeachers: classes.reduce((sum, c) => sum + c.assignedTeachers.length, 0),
    avgTeachersPerClass: classes.length > 0 ? Math.round(classes.reduce((sum, c) => sum + c.assignedTeachers.length, 0) / classes.length) : 0,
    totalEnrollment: classes.reduce((sum, c) => sum + c.currentEnrollment, 0),
    avgEnrollment: classes.length > 0 ? Math.round(classes.reduce((sum, c) => sum + c.currentEnrollment, 0) / classes.length) : 0,
  };

  // Use centralized grade display utilities for consistency
  const formatGradeForDisplay = formatGradeDisplay;
  const formatGradeForDatabase = convertDisplayToRaw;
  
  console.log('ClassManagement - availableGrades (raw):', availableGrades);
  const grades = availableGrades.length > 0 
    ? availableGrades.map(formatGradeForDisplay) 
    : [];
    
  console.log('ClassManagement - grades array (converted):', grades);
  
  // Debug: Test formatGradeForDisplay function
  console.log('ClassManagement - formatGradeForDisplay test:', {
    'preschool': formatGradeForDisplay('preschool'),
    'grade1': formatGradeForDisplay('grade1'),
    'grade5': formatGradeForDisplay('grade5'),
    'Grade 1': formatGradeForDisplay('Grade 1'), // Should return as is
    'Preschool': formatGradeForDisplay('Preschool'), // Should return as is
  });
  
  const semesters = ['fall', 'spring', 'summer'];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'success';
      case 'inactive': return 'warning';
      case 'archived': return 'error';
      default: return 'default';
    }
  };

  const getEnrollmentColor = (current: number, capacity: number) => {
    const percentage = (current / capacity) * 100;
    if (percentage >= 90) return 'error';
    if (percentage >= 75) return 'warning';
    return 'success';
  };

  // Display helpers for UI title-casing
  const formatWordCase = (text: string) => {
    if (!text) return text;
    return text
      .split(' ')
      .filter(Boolean)
      .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join(' ');
  };

  const formatStatusLabel = (status: string) => {
    switch ((status || '').toLowerCase()) {
      case 'active': return 'Active';
      case 'inactive': return 'Inactive';
      case 'archived': return 'Archived';
      default: return status;
    }
  };

  const formatRoleLabel = (role: string) => {
    switch ((role || '').toLowerCase()) {
      case 'primary': return 'Primary';
      case 'secondary': return 'Secondary';
      case 'assistant': return 'Assistant';
      default: return role;
    }
  };

  const formatSemesterLabel = (semester: string) => {
    switch ((semester || '').toLowerCase()) {
      case 'fall': return 'Fall';
      case 'spring': return 'Spring';
      case 'summer': return 'Summer';
      default: return semester;
    }
  };

  const handleOpenClassDialog = (type: 'add' | 'edit' | 'view', classId?: string) => {
    setDialogType(type);
    setOpenClassDialog(true);
    
    if (type === 'add') {
      setClassForm({
        name: '',
        grade: '',
        description: '',
        capacity: 25,
        academicYear: new Date().getFullYear().toString(),
        semester: 'fall',
        subjects: [],
        assignedTeachers: [],
        status: 'active',
      });
      setSelectedClass(null);
    } else if (classId) {
      const classItem = classes.find(c => c.id === classId || c._id === classId);
      if (classItem) {
        setSelectedClass(classItem);
        setClassForm({
          name: classItem.name,
          grade: normalizeGradeForDisplay(classItem.grade),
          description: classItem.description || '',
          capacity: classItem.capacity,
          academicYear: classItem.schedule.academicYear,
          semester: classItem.schedule.semester,
          subjects: classItem.subjects || [],
          assignedTeachers: classItem.assignedTeachers
            .filter(at => at.teacherId) // Filter out null teachers
            .map(at => ({
              teacherId: at.teacherId._id,
              role: at.role,
            })),
          status: classItem.status,
        });
      }
    }
  };

  const handleCloseClassDialog = () => {
    setOpenClassDialog(false);
    setClassForm({
      name: '',
      grade: '',
      description: '',
      capacity: 25,
      academicYear: new Date().getFullYear().toString(),
      semester: 'fall',
      subjects: [],
      assignedTeachers: [],
      status: 'active',
    });
    setSelectedClass(null);
  };

  const handleFormChange = (field: string, value: any) => {
    setClassForm(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  // Helpers for role-based teacher selections in the dialog
  const getSelectedTeachersByRole = (role: 'primary' | 'secondary') => {
    const selectedIds = classForm.assignedTeachers
      .filter(at => at.role === role)
      .map(at => at.teacherId);
    return teachers.filter(t => selectedIds.includes(t._id));
  };

  const setPrimaryTeachers = (selected: Teacher[]) => {
    const primaryEntries = selected.map(t => ({ teacherId: t._id, role: 'primary' as const }));
    // Keep non-primary entries but ensure no duplicates with new primary list
    const nonPrimary = classForm.assignedTeachers.filter(at => at.role !== 'primary' && !primaryEntries.some(p => p.teacherId === at.teacherId));
    handleFormChange('assignedTeachers', [...nonPrimary, ...primaryEntries]);
  };

  const setSecondaryTeachers = (selected: Teacher[]) => {
    const secondaryEntries = selected.map(t => ({ teacherId: t._id, role: 'secondary' as const }));
    // Keep non-secondary entries but ensure no duplicates with new secondary list
    const nonSecondary = classForm.assignedTeachers.filter(at => at.role !== 'secondary' && !secondaryEntries.some(s => s.teacherId === at.teacherId));
    handleFormChange('assignedTeachers', [...nonSecondary, ...secondaryEntries]);
  };

  const handleSaveClass = async () => {
    try {
      if (dialogType === 'add') {
        const classData: CreateClassData = {
          name: classForm.name,
          grade: formatGradeForDatabase(classForm.grade),
          description: classForm.description,
          capacity: classForm.capacity,
          academicYear: classForm.academicYear,
          semester: classForm.semester,
          subjects: classForm.subjects,
          assignedTeachers: classForm.assignedTeachers,
          status: classForm.status,
        };

        const response = await apiService.createClass(classData);
        if (response.success) {
          await loadData();
          showSnackbar('Class created successfully!', 'success');
        } else {
          showSnackbar(`Error creating class: ${response.error}`, 'error');
        }
      } else if (dialogType === 'edit' && selectedClass) {
        const classData: Partial<CreateClassData> = {
          name: classForm.name,
          grade: formatGradeForDatabase(classForm.grade),
          description: classForm.description,
          capacity: classForm.capacity,
          status: classForm.status,
          assignedTeachers: classForm.assignedTeachers,
        };

        const response = await apiService.updateClass(selectedClass._id, classData);
        if (response.success) {
          await loadData();
          showSnackbar('Class updated successfully!', 'success');
        } else {
          showSnackbar(`Error updating class: ${response.error}`, 'error');
        }
      }
      
      handleCloseClassDialog();
    } catch (error) {
      console.error('Error saving class:', error);
      showSnackbar('Error saving class. Please try again.', 'error');
    }
  };

  const handleDeleteClass = (classItem: Class) => {
    setClassToDelete(classItem);
    setOpenDeleteDialog(true);
  };

  const confirmDeleteClass = async () => {
    if (classToDelete) {
      try {
        const response = await apiService.deleteClass(classToDelete._id);
        if (response.success) {
          await loadData();
          showSnackbar('Class deleted successfully!', 'success');
        } else {
          showSnackbar(`Error deleting class: ${response.error}`, 'error');
        }
      } catch (error) {
        console.error('Error deleting class:', error);
        showSnackbar('Error deleting class. Please try again.', 'error');
      }
      setClassToDelete(null);
      setOpenDeleteDialog(false);
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
            Class Management
          </Typography>
        </Fade>
        <NotificationIcon />
      </Box>

      {/* Performance Overview */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grow in timeout={800}>
          <Grid item xs={12} md={2}>
            <Paper
              elevation={0}
              sx={{
                background: getRandomCardColor(0),
                borderRadius: 4,
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(255,255,255,0.3)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: '0 12px 40px rgba(0,0,0,0.15)',
                  borderColor: 'rgba(255,255,255,0.5)',
                },
              }}
            >
              <CardContent sx={{ textAlign: 'center', p: 3 }}>
                <Typography 
                  variant="h4" 
                  sx={{ 
                    fontWeight: 700,
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    backgroundClip: 'text',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                  }}
                >
                  {classStats.totalClasses}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  Total Classes
                </Typography>
              </CardContent>
            </Paper>
          </Grid>
        </Grow>

        <Grow in timeout={800} style={{ transitionDelay: '100ms' }}>
          <Grid item xs={12} md={2}>
            <Paper
              elevation={0}
              sx={{
                background: getRandomCardColor(0),
                borderRadius: 4,
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(255,255,255,0.3)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: '0 12px 40px rgba(0,0,0,0.15)',
                  borderColor: 'rgba(255,255,255,0.5)',
                },
              }}
            >
              <CardContent sx={{ textAlign: 'center', p: 3 }}>
                <Typography 
                  variant="h4" 
                  sx={{ 
                    fontWeight: 700,
                    color: 'success.main',
                  }}
                >
                  {classStats.activeClasses}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  Active Classes
                </Typography>
              </CardContent>
            </Paper>
          </Grid>
        </Grow>

        <Grow in timeout={800} style={{ transitionDelay: '200ms' }}>
          <Grid item xs={12} md={2}>
            <Paper
              elevation={0}
              sx={{
                background: getRandomCardColor(0),
                borderRadius: 4,
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(255,255,255,0.3)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: '0 12px 40px rgba(0,0,0,0.15)',
                  borderColor: 'rgba(255,255,255,0.5)',
                },
              }}
            >
              <CardContent sx={{ textAlign: 'center', p: 3 }}>
                <Typography 
                  variant="h4" 
                  sx={{ 
                    fontWeight: 700,
                    color: 'primary.main',
                  }}
                >
                  {classStats.totalTeachers}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  Assigned Teachers
                </Typography>
              </CardContent>
            </Paper>
          </Grid>
        </Grow>

        <Grow in timeout={800} style={{ transitionDelay: '300ms' }}>
          <Grid item xs={12} md={2}>
            <Paper
              elevation={0}
              sx={{
                background: getRandomCardColor(0),
                borderRadius: 4,
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(255,255,255,0.3)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: '0 12px 40px rgba(0,0,0,0.15)',
                  borderColor: 'rgba(255,255,255,0.5)',
                },
              }}
            >
              <CardContent sx={{ textAlign: 'center', p: 3 }}>
                <Typography 
                  variant="h4" 
                  sx={{ 
                    fontWeight: 700,
                    color: 'info.main',
                  }}
                >
                  {classStats.avgTeachersPerClass}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  Avg Teachers/Class
                </Typography>
              </CardContent>
            </Paper>
          </Grid>
        </Grow>

        <Grow in timeout={800} style={{ transitionDelay: '400ms' }}>
          <Grid item xs={12} md={2}>
            <Paper
              elevation={0}
              sx={{
                background: getRandomCardColor(0),
                borderRadius: 4,
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(255,255,255,0.3)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: '0 12px 40px rgba(0,0,0,0.15)',
                  borderColor: 'rgba(255,255,255,0.5)',
                },
              }}
            >
              <CardContent sx={{ textAlign: 'center', p: 3 }}>
                <Typography 
                  variant="h4" 
                  sx={{ 
                    fontWeight: 700,
                    color: 'warning.main',
                  }}
                >
                  {classStats.totalEnrollment}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  Total Enrollment
                </Typography>
              </CardContent>
            </Paper>
          </Grid>
        </Grow>

        <Grow in timeout={800} style={{ transitionDelay: '500ms' }}>
          <Grid item xs={12} md={2}>
            <Paper
              elevation={0}
              sx={{
                background: getRandomCardColor(0),
                borderRadius: 4,
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(255,255,255,0.3)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: '0 12px 40px rgba(0,0,0,0.15)',
                  borderColor: 'rgba(255,255,255,0.5)',
                },
              }}
            >
              <CardContent sx={{ textAlign: 'center', p: 3 }}>
                <Typography 
                  variant="h4" 
                  sx={{ 
                    fontWeight: 700,
                    color: 'secondary.main',
                  }}
                >
                  {classStats.avgEnrollment}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  Avg Enrollment
                </Typography>
              </CardContent>
            </Paper>
          </Grid>
        </Grow>
      </Grid>

      {/* Class List */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h5" sx={{ display: 'flex', alignItems: 'center' }}>
                  <Group sx={{ mr: 1 }} />
                  Class Directory
                </Typography>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button
                    variant="outlined"
                    color="primary"
                    startIcon={<Refresh />}
                    onClick={loadData}
                  >
                    Refresh
                  </Button>
                  <Button
                    variant="contained"
                    startIcon={<Add />}
                    onClick={() => handleOpenClassDialog('add')}
                  >
                    Add Class
                  </Button>
                </Box>
              </Box>

              {/* Search and Filters */}
              <Grid container spacing={3} sx={{ mb: 3 }}>
                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    placeholder="Search classes..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    InputProps={{
                      startAdornment: <Search sx={{ mr: 1, color: 'text.secondary' }} />,
                    }}
                  />
                </Grid>
                <Grid item xs={12} md={2}>
                  <FormControl fullWidth>
                    <InputLabel>Grade</InputLabel>
                    <Select
                      value={filterGrade}
                      onChange={(e) => setFilterGrade(e.target.value)}
                      label="Grade"
                    >
                      <MenuItem value="">All Grades</MenuItem>
                      {grades.map(grade => (
                        <MenuItem key={grade} value={grade}>{grade}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={2}>
                  <FormControl fullWidth>
                    <InputLabel>Status</InputLabel>
                    <Select
                      value={filterStatus}
                      onChange={(e) => setFilterStatus(e.target.value)}
                      label="Status"
                    >
                      <MenuItem value="">All Status</MenuItem>
                      <MenuItem value="active">Active</MenuItem>
                      <MenuItem value="inactive">Inactive</MenuItem>
                      <MenuItem value="archived">Archived</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={4}>
                  <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                    <Typography variant="body2" sx={{ alignSelf: 'center' }}>
                      {filteredClasses.length} class(es) found
                    </Typography>
                  </Box>
                </Grid>
              </Grid>

              {isLoading && <LinearProgress sx={{ mb: 2 }} />}

              {error && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {error}
                </Alert>
              )}

              <TableContainer component={Paper}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Class</TableCell>
                      <TableCell>Grade</TableCell>
                      <TableCell>Teachers</TableCell>
                      <TableCell>Enrollment</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Schedule</TableCell>
                      <TableCell>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredClasses.map((classItem) => (
                      <TableRow key={classItem.id || classItem._id}>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <Avatar sx={{ mr: 2, bgcolor: 'primary.main' }}>
                              {classItem.name.charAt(0).toUpperCase()}
                            </Avatar>
                            <Box>
                              <Typography variant="body1" fontWeight="bold">
                                {classItem.name}
                              </Typography>
                              <Typography variant="body2" color="text.secondary">
                                {classItem.description || 'No description'}
                              </Typography>
                            </Box>
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Chip label={formatGradeDisplay(classItem.grade)} color="primary" size="small" />
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                            {classItem.assignedTeachers.filter(assignment => assignment.teacherId).map((assignment, index) => (
                              <Box key={index} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Avatar sx={{ width: 24, height: 24, fontSize: '0.75rem' }}>
                                  {assignment.teacherId.firstName.charAt(0)}{assignment.teacherId.lastName.charAt(0)}
                                </Avatar>
                                <Typography variant="body2">
                                  {formatWordCase(assignment.teacherId.firstName)} {formatWordCase(assignment.teacherId.lastName)}
                                </Typography>
                                <Chip 
                                  label={formatRoleLabel(assignment.role)} 
                                  size="small" 
                                  color={assignment.role === 'primary' ? 'primary' : 'default'}
                                />
                              </Box>
                            ))}
                            {classItem.assignedTeachers.filter(assignment => assignment.teacherId).length === 0 && (
                              <Typography variant="body2" color="text.secondary">
                                No teachers assigned
                              </Typography>
                            )}
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="body2">
                              {classItem.currentEnrollment}/{classItem.capacity}
                            </Typography>
                            <Chip
                              label={`${Math.round((classItem.currentEnrollment / classItem.capacity) * 100)}%`}
                              color={getEnrollmentColor(classItem.currentEnrollment, classItem.capacity) as any}
                              size="small"
                            />
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={formatStatusLabel(classItem.status)}
                            color={getStatusColor(classItem.status) as any}
                            size="small"
                          />
                        </TableCell>
                        <TableCell>
                          <Box>
                            <Typography variant="body2">
                              {classItem.schedule.academicYear}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {formatSemesterLabel(classItem.schedule.semester)}
                            </Typography>
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', gap: 1 }}>
                            <Tooltip title="View Details">
                              <IconButton 
                                size="small"
                                color="primary"
                                onClick={() => handleOpenClassDialog('view', classItem.id || classItem._id)}
                              >
                                <Info />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Edit Class">
                              <IconButton 
                                size="small" 
                                color="primary"
                                onClick={() => handleOpenClassDialog('edit', classItem.id || classItem._id)}
                              >
                                <Edit />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Delete Class">
                              <IconButton 
                                size="small" 
                                color="error"
                                onClick={() => handleDeleteClass(classItem)}
                              >
                                <Delete />
                              </IconButton>
                            </Tooltip>
                          </Box>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Add/Edit Class Dialog */}
      <Dialog open={openClassDialog} onClose={handleCloseClassDialog} maxWidth="md" fullWidth>
        <DialogTitle>
          {dialogType === 'add' && 'Add New Class'}
          {dialogType === 'edit' && 'Edit Class'}
          {dialogType === 'view' && 'Class Details'}
        </DialogTitle>
        <DialogContent>
          {dialogType === 'view' ? (
            <Box>
              {selectedClass && (
                <Grid container spacing={3} sx={{ mt: 1 }}>
                  <Grid item xs={12} md={6}>
                    <Typography variant="h6" gutterBottom>Class Information</Typography>
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="body2" color="text.secondary">Name</Typography>
                      <Typography variant="body1">{selectedClass.name}</Typography>
                    </Box>
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="body2" color="text.secondary">Grade</Typography>
                      <Typography variant="body1">{selectedClass.grade}</Typography>
                    </Box>
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="body2" color="text.secondary">Description</Typography>
                      <Typography variant="body1">{selectedClass.description || 'No description'}</Typography>
                    </Box>
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="body2" color="text.secondary">Status</Typography>
                      <Chip
                        label={selectedClass.status}
                        color={getStatusColor(selectedClass.status) as any}
                        size="small"
                      />
                    </Box>
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="body2" color="text.secondary">Capacity</Typography>
                      <Typography variant="body1">{selectedClass.capacity} students</Typography>
                    </Box>
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="body2" color="text.secondary">Current Enrollment</Typography>
                      <Typography variant="body1">{selectedClass.currentEnrollment} students</Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Typography variant="h6" gutterBottom>Schedule & Teachers</Typography>
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="body2" color="text.secondary">Academic Year</Typography>
                      <Typography variant="body1">{selectedClass.schedule.academicYear}</Typography>
                    </Box>
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="body2" color="text.secondary">Semester</Typography>
                      <Typography variant="body1">{selectedClass.schedule.semester}</Typography>
                    </Box>
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="body2" color="text.secondary">Assigned Teachers</Typography>
                      {selectedClass.assignedTeachers.filter((assignment: any) => assignment.teacherId).map((assignment: any, index: number) => (
                        <Box key={index} sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Avatar sx={{ width: 24, height: 24, fontSize: '0.75rem' }}>
                            {assignment.teacherId.firstName.charAt(0)}{assignment.teacherId.lastName.charAt(0)}
                          </Avatar>
                          <Typography variant="body2">
                            {assignment.teacherId.firstName} {assignment.teacherId.lastName}
                          </Typography>
                          <Chip 
                            label={assignment.role} 
                            size="small" 
                            color={assignment.role === 'primary' ? 'primary' : 'default'}
                          />
                        </Box>
                      ))}
                      {selectedClass.assignedTeachers.filter((assignment: any) => assignment.teacherId).length === 0 && (
                        <Typography variant="body2" color="text.secondary">
                          No teachers assigned
                        </Typography>
                      )}
                    </Box>
                  </Grid>
                </Grid>
              )}
            </Box>
          ) : (
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12} md={6}>
                <TextField 
                  fullWidth 
                  label="Class Name" 
                  value={classForm.name}
                  onChange={(e) => handleFormChange('name', e.target.value)}
                  required
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth required>
                  <InputLabel>Grade</InputLabel>
                  <Select 
                    label="Grade"
                    value={classForm.grade}
                    onChange={(e) => handleFormChange('grade', e.target.value)}
                  >
                    {grades.map(grade => (
                      <MenuItem key={grade} value={grade}>{grade}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12}>
                <TextField 
                  fullWidth 
                  label="Description" 
                  multiline
                  rows={3}
                  value={classForm.description}
                  onChange={(e) => handleFormChange('description', e.target.value)}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField 
                  fullWidth 
                  label="Capacity" 
                  type="number"
                  value={classForm.capacity}
                  onChange={(e) => handleFormChange('capacity', parseInt(e.target.value))}
                  inputProps={{ min: 1 }}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField 
                  fullWidth 
                  label="Academic Year" 
                  value={classForm.academicYear}
                  onChange={(e) => handleFormChange('academicYear', e.target.value)}
                  required
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Semester</InputLabel>
                  <Select 
                    label="Semester"
                    value={classForm.semester}
                    onChange={(e) => handleFormChange('semester', e.target.value)}
                  >
                    {semesters.map(semester => (
                      <MenuItem key={semester} value={semester}>{semester}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Status</InputLabel>
                  <Select 
                    label="Status"
                    value={classForm.status}
                    onChange={(e) => handleFormChange('status', e.target.value)}
                  >
                    <MenuItem value="active">Active</MenuItem>
                    <MenuItem value="inactive">Inactive</MenuItem>
                    <MenuItem value="archived">Archived</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={6}>
                <Autocomplete
                  multiple
                  options={teachers}
                  getOptionLabel={(option) => `${option.firstName} ${option.lastName} (${option.email})`}
                  value={getSelectedTeachersByRole('primary')}
                  onChange={(event, newValue) => setPrimaryTeachers(newValue as Teacher[])}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Primary Teachers"
                      placeholder="Select primary teachers"
                    />
                  )}
                  renderOption={(props, option) => (
                    <Box component="li" {...props}>
                      <Avatar sx={{ mr: 2, width: 24, height: 24, fontSize: '0.75rem' }}>
                        {option.firstName.charAt(0)}{option.lastName.charAt(0)}
                      </Avatar>
                      <Box>
                        <Typography variant="body2">
                          {option.firstName} {option.lastName}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {option.email} • {option.specialization || 'No specialization'}
                        </Typography>
                      </Box>
                    </Box>
                  )}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <Autocomplete
                  multiple
                  options={teachers}
                  getOptionLabel={(option) => `${option.firstName} ${option.lastName} (${option.email})`}
                  value={getSelectedTeachersByRole('secondary')}
                  onChange={(event, newValue) => setSecondaryTeachers(newValue as Teacher[])}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Secondary Teachers"
                      placeholder="Select secondary teachers"
                    />
                  )}
                  renderOption={(props, option) => (
                    <Box component="li" {...props}>
                      <Avatar sx={{ mr: 2, width: 24, height: 24, fontSize: '0.75rem' }}>
                        {option.firstName.charAt(0)}{option.lastName.charAt(0)}
                      </Avatar>
                      <Box>
                        <Typography variant="body2">
                          {option.firstName} {option.lastName}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {option.email} • {option.specialization || 'No specialization'}
                        </Typography>
                      </Box>
                    </Box>
                  )}
                />
              </Grid>
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseClassDialog}>Cancel</Button>
          {dialogType !== 'view' && (
            <Button 
              variant="contained" 
              onClick={handleSaveClass}
              disabled={!classForm.name || !classForm.grade || !classForm.academicYear}
            >
              {dialogType === 'add' ? 'Add Class' : 'Save Changes'}
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={openDeleteDialog} onClose={() => setOpenDeleteDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <Typography variant="body1">
            Are you sure you want to delete {classToDelete?.name}? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDeleteDialog(false)}>Cancel</Button>
          <Button 
            variant="contained" 
            color="error" 
            onClick={confirmDeleteClass}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert 
          onClose={handleCloseSnackbar} 
          severity={snackbar.severity}
          sx={{ width: '100%' }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Container>
  );
};

export default ClassManagement; 