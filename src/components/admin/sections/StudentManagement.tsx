import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Avatar,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Checkbox,
  Tooltip,
  Badge,
  Alert,
  Container,
  Fade,
  Grow,
} from '@mui/material';
import {
  Search,
  Add,
  Edit,
  Delete,
  Visibility,
  FilterList,
  Download,
  Upload,
  MoreVert,
  School,
  Person,
  Email,
  Phone,
} from '@mui/icons-material';
import { useData } from '../../../contexts/DataContext';
import toast from 'react-hot-toast';
import PhoneNumberInput from '../../common/PhoneNumberInput';
import { themeColors } from '../../../theme/adminTheme';
import NotificationIcon from '../../common/NotificationIcon';
import {
  formatGradeForDisplay as formatGradeDisplay,
  convertDisplayToRawGrade as convertDisplayToRaw,
  normalizeGradeFormat,
  areGradesEqual
} from '../../../utils/gradeDisplayUtils';

interface StudentManagementProps {
  schoolBranding?: any;
}

// InfoRow component for displaying labeled information
const InfoRow: React.FC<{ label: string; value: string; icon?: React.ReactNode }> = ({ label, value, icon }) => (
  <Box sx={{ 
    display: 'flex', 
    alignItems: 'center', 
    mb: 2.5,
    p: 2,
    background: 'rgba(102, 126, 234, 0.03)',
    borderRadius: 2,
    border: '1px solid rgba(102, 126, 234, 0.1)',
    transition: 'all 0.2s ease-in-out',
    '&:hover': {
      background: 'rgba(102, 126, 234, 0.08)',
      transform: 'translateX(4px)',
    },
  }}>
    {icon && (
      <Box sx={{ mr: 2, display: 'flex', alignItems: 'center' }}>
        {icon}
      </Box>
    )}
    <Box sx={{ flex: 1 }}>
      <Typography 
        variant="body2" 
        sx={{ 
          color: 'text.secondary',
          fontWeight: 600,
          mb: 0.5,
          fontSize: '0.875rem',
        }}
      >
        {label}
      </Typography>
      <Typography 
        variant="body1" 
        sx={{ 
          fontWeight: 500,
          color: 'text.primary',
          lineHeight: 1.4,
        }}
      >
        {value}
      </Typography>
    </Box>
  </Box>
);

const StudentManagement: React.FC<StudentManagementProps> = ({ schoolBranding }) => {
  // Helper function to format medical info for display
  const formatMedicalInfo = (medicalInfo: any): string => {
    if (typeof medicalInfo === 'object' && medicalInfo !== null) {
      const allergies = medicalInfo.allergies?.join(', ') || 'None';
      const conditions = medicalInfo.conditions?.join(', ') || 'None';
      const medications = medicalInfo.medications?.join(', ') || 'None';
      return `Allergies: ${allergies}, Conditions: ${conditions}, Medications: ${medications}`;
    }
    return medicalInfo || 'No medical information available';
  };

  const [searchTerm, setSearchTerm] = useState('');
  const [filterGrade, setFilterGrade] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [openDialog, setOpenDialog] = useState(false);
  const [dialogType, setDialogType] = useState<'add' | 'edit' | 'view'>('add');
  const [selectedStudentData, setSelectedStudentData] = useState<any>(null);
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    studentId: '',
    grade: '',
    class: '',
    status: 'active' as 'active' | 'pending' | 'inactive',
    parentName: '',
    parentEmail: '',
    parentPhone: '',
    enrollmentDate: '',
    dateOfBirth: '',
    address: '',
    emergencyContact: '',
    medicalInfo: '',
    academicLevel: 'beginner',
    notes: '',
  });

  // State for field-specific validation errors
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const { students, addStudent, updateStudent, deleteStudent, classes, teachers, school, isLoading, refreshData } = useData();
  
  console.log('StudentManagement - students from DataContext:', students);
  console.log('StudentManagement - students length:', students.length);
  


  // Get available grades from school data and format them for display
  const availableGrades = school.gradeLevels || [];
  
  console.log('StudentManagement - school object:', school);
  console.log('StudentManagement - availableGrades:', availableGrades);
  
  // Use centralized grade display utilities for consistency across the application
  // This ensures all components use the same grade format, preventing mismatches
  const formatGradeForDisplay = formatGradeDisplay;
  const normalizeGradeForDisplay = normalizeGradeFormat;
  const convertDisplayToRawGrade = convertDisplayToRaw;
  
  const grades = availableGrades.length > 0 
    ? availableGrades.map(formatGradeForDisplay) 
    : [];
  
  console.log('StudentManagement - grades array:', grades);
  console.log('StudentManagement - school loading status:', isLoading);
  
  // Show loading message if school data is not loaded yet
  const isSchoolDataLoading = !school.id || (school.name === 'Loading...' && availableGrades.length === 0);
  

  

  
  // Get available classes from class management - filter by school
  const availableClasses = classes.filter(cls => 
    cls.isActive && 
    cls.status === 'active' && 
    cls.schoolId === school.id
  );
  
  console.log('StudentManagement - classes from DataContext:', classes);
  console.log('StudentManagement - classes length:', classes.length);
  console.log('StudentManagement - school.id for filtering:', school.id);
  console.log('StudentManagement - availableClasses (filtered):', availableClasses);
  console.log('StudentManagement - availableClasses length:', availableClasses.length);
  console.log('StudentManagement - formData.grade:', formData.grade);
  console.log('StudentManagement - school.gradeLevels:', school.gradeLevels);
  console.log('StudentManagement - availableGrades:', availableGrades);
  

  
  // Filter classes based on selected grade
  const filteredClasses = formData.grade 
    ? availableClasses.filter(cls => {
        // Convert the form grade back to raw format for comparison
        const formDataGradeRaw = convertDisplayToRawGrade(formData.grade);
        
        console.log('StudentManagement - Grade matching:', {
          formDataGrade: formData.grade,
          formDataGradeRaw: formDataGradeRaw,
          classGrade: cls.grade,
          className: cls.name
        });
        
        // Check multiple possible matches
        const isMatch = cls.grade === formData.grade || 
                       cls.grade === formDataGradeRaw ||
                       cls.grade?.toLowerCase() === formData.grade?.toLowerCase() ||
                       cls.grade?.toLowerCase() === formDataGradeRaw?.toLowerCase();
        
        console.log('StudentManagement - Grade match result:', isMatch);
        
        return isMatch;
      })
    : [];
    

    
  console.log('StudentManagement - filteredClasses:', filteredClasses);
  console.log('StudentManagement - filteredClasses length:', filteredClasses.length);
  console.log('StudentManagement - formData.grade for filtering:', formData.grade);
  
  const statuses = ['active', 'pending', 'inactive'];

  const [openImportDialog, setOpenImportDialog] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<any[]>([]);
  const [isImporting, setIsImporting] = useState(false);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type === 'text/csv') {
      setImportFile(file);
      previewCSV(file);
    } else {
      toast.error('Please select a valid CSV file');
    }
  };

  const previewCSV = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split('\n');
      const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
      const data = lines.slice(1, 6).map(line => {
        const values = line.split(',').map(v => v.replace(/"/g, '').trim());
        const row: any = {};
        headers.forEach((header, index) => {
          row[header] = values[index] || '';
        });
        return row;
      });
      setImportPreview(data);
    };
    reader.readAsText(file);
  };

  const handleImportStudents = () => {
    if (!importFile) return;
    
    setIsImporting(true);
    toast.loading('Importing students...');
    
    // Simulate import process
    setTimeout(() => {
      // In a real app, this would parse the CSV and add students
      const newStudents = importPreview.map((row, index) => ({
        id: `ST${String(students.length + index + 1).padStart(3, '0')}`,
        firstName: row['First Name'] || row['firstName'] || 'Unknown',
        lastName: row['Last Name'] || row['lastName'] || 'Unknown',
        grade: row['Grade'] || row['grade'] || 'Grade 1',
        class: row['Class'] || row['class'] || '1A',
        status: 'active' as const,
        lastReport: new Date().toISOString().split('T')[0],
        parentEmail: row['Parent Email'] || row['parentEmail'] || 'parent@email.com',
        parentPhone: row['Parent Phone'] || row['parentPhone'] || '+1-555-0000',
        avatar: `${row['First Name']?.[0] || 'U'}${row['Last Name']?.[0] || 'N'}`,
        teacherId: 'T001',
        parentId: `P${String(students.length + index + 1).padStart(3, '0')}`,
        enrollmentDate: new Date().toISOString().split('T')[0],
        dateOfBirth: '2018-01-01',
        address: '123 Main St, City, State',
        emergencyContact: '+1-555-9999',
        medicalInfo: 'No known allergies',
        academicLevel: 'Standard',
        notes: 'Imported student',
      }));
      
      // Add students to context
      newStudents.forEach(student => {
        const { id, ...studentWithoutId } = student;
        addStudent({
          ...studentWithoutId,
          name: `${studentWithoutId.firstName} ${studentWithoutId.lastName}`,
          schoolId: school.id, // Add required schoolId
        });
      });
      
      setImportFile(null);
      setImportPreview([]);
      setOpenImportDialog(false);
      setIsImporting(false);
      toast.success(`Successfully imported ${newStudents.length} students!`);
    }, 2000);
  };

  // Filter students based on search and filters
  const filteredStudents = students.filter(student => {
    const matchesSearch = 
      student.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ((student as any).studentId || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (student.id || student._id || '').toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesGrade = filterGrade === '' || student.grade === filterGrade;
    const matchesStatus = filterStatus === '' || student.status === filterStatus;
    
    return matchesSearch && matchesGrade && matchesStatus;
  });

  const handleSelectAll = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) {
      setSelectedStudents(filteredStudents.map(student => student.id || student._id || ''));
    } else {
      setSelectedStudents([]);
    }
  };

  const handleSelectStudent = (studentId: string) => {
    setSelectedStudents(prev => 
      prev.includes(studentId) 
        ? prev.filter(id => id !== studentId)
        : [...prev, studentId]
    );
  };

  const handleOpenDialog = (type: 'add' | 'edit' | 'view', studentId?: string) => {
    setDialogType(type);
    setOpenDialog(true);
    
    if (type === 'add') {
      setFormData({
        firstName: '',
        lastName: '',
        email: '',
        studentId: '',
        grade: '',
        class: '',
        status: 'active' as 'active' | 'pending' | 'inactive',
        parentName: '',
        parentEmail: '',
        parentPhone: '',
        enrollmentDate: '',
        dateOfBirth: '',
        address: '',
        emergencyContact: '',
        medicalInfo: '',
        academicLevel: 'beginner',
        notes: '',
      });
      setFieldErrors({}); // Clear validation errors
      setSelectedStudentData(null);
    } else if (studentId) {
      // Find student by either id or _id
      const student = students.find(s => (s.id === studentId) || (s._id === studentId) || ((s as any)._id === studentId));
      
      console.log('🔍 Looking for student with ID:', studentId);
      console.log('🔍 Available students:', students.map(s => ({ id: s.id, _id: (s as any)._id, name: s.firstName })));
      
      if (student) {
        console.log('✅ Found student for editing:', student);
        setSelectedStudentData(student);
        
        // Handle different field name variations from backend
        const studentGrade = student.grade || (student as any).studentGrade || '';
        const studentClass = student.class || (student as any).studentClass || '';
        const studentStatus = student.status || ((student as any).isActive ? 'active' : 'inactive');
        
        setFormData({
          firstName: student.firstName || '',
          lastName: student.lastName || '',
          email: (student as any).email || '',
          studentId: (student as any).studentId || '',
          grade: studentGrade,
          class: studentClass,
          status: studentStatus,
          parentName: (student as any).parentName || '',
          parentEmail: student.parentEmail || (student as any).parentEmail || '',
          parentPhone: student.parentPhone || (student as any).parentPhone || '',
          enrollmentDate: student.enrollmentDate ? new Date(student.enrollmentDate).toISOString().split('T')[0] : '',
          dateOfBirth: student.dateOfBirth ? new Date(student.dateOfBirth).toISOString().split('T')[0] : '',
          address: student.address || (student as any).address || '',
          emergencyContact: student.emergencyContact || (student as any).emergencyContact || '',
          medicalInfo: formatMedicalInfo(student.medicalInfo),
          academicLevel: student.academicLevel || (student as any).academicLevel || 'beginner',
          notes: student.notes || (student as any).notes || '',
        });
      } else {
        console.error('❌ Student not found with ID:', studentId);
        toast.error('Student not found. Please refresh the page.');
        return;
      }
    }
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setFormData({
      firstName: '',
      lastName: '',
      email: '',
      studentId: '',
      grade: '',
      class: '',
      status: 'active' as 'active' | 'pending' | 'inactive',
      parentName: '',
      parentEmail: '',
      parentPhone: '',
      enrollmentDate: '',
      dateOfBirth: '',
      address: '',
      emergencyContact: '',
      medicalInfo: '',
      academicLevel: 'beginner',
      notes: '',
    });
    setFieldErrors({}); // Clear validation errors
    setSelectedStudentData(null);
  };

  const handleFormChange = (field: string, value: string) => {
    console.log(`StudentManagement - handleFormChange: ${field} = "${value}"`);
    setFormData(prev => {
      const newData = {
        ...prev,
        [field]: value,
      };
      console.log('StudentManagement - Updated formData:', newData);
      return newData;
    });
    
    // Clear field error when user starts typing
    if (fieldErrors[field]) {
      setFieldErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
    
    // Clear class selection when grade changes
    if (field === 'grade') {
      setFormData(prev => ({
        ...prev,
        class: '', // Clear class when grade changes
      }));
    }
    
    // Auto-populate grade when class is selected
    if (field === 'class' && value) {
      const selectedClass = availableClasses.find(cls => cls.name === value);
      if (selectedClass) {
        setFormData(prev => ({
          ...prev,
          grade: normalizeGradeForDisplay(selectedClass.grade)
        }));
      }
    }
  };

  const handleSaveStudent = async () => {
    console.log('StudentManagement - handleSaveStudent called');
    if (dialogType === 'add') {
      // Generate avatar initials from name (with null safety)
      const firstName = formData.firstName || '';
      const lastName = formData.lastName || '';
      
      let avatar = '';
      if (firstName && lastName) {
        avatar = `${firstName[0]}${lastName[0]}`.toUpperCase();
      } else if (firstName && firstName.length >= 2) {
        avatar = firstName.substring(0, 2).toUpperCase();
      } else if (firstName) {
        avatar = firstName[0].toUpperCase();
      } else {
        avatar = 'ST'; // Default avatar for Student
      }

      // Map form data to backend expectations
      const studentData = {
        firstName: formData.firstName,
        lastName: formData.lastName,
        // Only include email if it's not empty
        ...(formData.email && formData.email.trim() && { email: formData.email.trim() }),
        studentId: formData.studentId.toUpperCase().trim(), // Backend expects studentId
        grade: formData.grade, // Frontend interface expects grade
        studentGrade: formData.grade, // Backend expects studentGrade
        avatar,
        lastReport: 'Never',
        name: `${formData.firstName} ${formData.lastName}`,
        schoolId: school.id,
        // Additional fields for the student record
        parentName: formData.parentName || 'N/A', // Ensure parentName is never empty
        parentEmail: formData.parentEmail,
        parentPhone: formData.parentPhone,
        studentClass: formData.class, // Backend expects studentClass
        enrollmentDate: formData.enrollmentDate || new Date().toISOString().split('T')[0],
        ...(formData.dateOfBirth && { dateOfBirth: formData.dateOfBirth }),
        address: formData.address,
        emergencyContact: formData.emergencyContact,
        medicalInfo: formData.medicalInfo,
        notes: formData.notes,
        isActive: formData.status === 'active', // Convert status to isActive boolean
      };

      // If a class is selected, get the teachers from that class
      if (formData.class) {
        const selectedClass = availableClasses.find(cls => cls.name === formData.class);
        if (selectedClass) {
          // Add classId reference
          if (selectedClass._id) {
            (studentData as any).classId = selectedClass._id;
          }
          
          // Add the primary teacher as assignedTeacher
          if (selectedClass.assignedTeachers && selectedClass.assignedTeachers.length > 0) {
            const primaryTeacher = selectedClass.assignedTeachers.find(t => t.role === 'primary');
            if (primaryTeacher && primaryTeacher.teacherId && primaryTeacher.teacherId._id) {
              (studentData as any).assignedTeacher = primaryTeacher.teacherId._id;
            }
          }
        }
      }

      console.log('StudentManagement - About to call addStudent with:', studentData);
      console.log('StudentManagement - School ID:', school.id);
      console.log('StudentManagement - User role:', (window as any).authUser?.role);
      
      const result = await addStudent(studentData);
      
      if (result.success) {
        let successMessage = 'Student added successfully!';
        
        // Show additional info about parent account creation
        if (result.parentAccount?.hasAccount) {
          successMessage += ` Parent account created for ${result.parentAccount.email}`;
        }
        
        toast.success(successMessage, { duration: 5000 });
        setOpenDialog(false);
        
        // Refresh the students list to ensure the new student appears
        await refreshData();
      } else {
        // Handle field-specific validation errors
        if (result.errors && Array.isArray(result.errors)) {
          // Parse express-validator errors
          const newFieldErrors: Record<string, string> = {};
          result.errors.forEach((error: any) => {
            if (error.param && error.msg) {
              // Map backend field names to frontend field names
              const fieldMapping: Record<string, string> = {
                'firstName': 'firstName',
                'lastName': 'lastName',
                'email': 'email',
                'studentGrade': 'grade',
                'parentName': 'parentName',
                'parentEmail': 'parentEmail',
                'parentPhone': 'parentPhone',
                'dateOfBirth': 'dateOfBirth',
                'enrollmentDate': 'enrollmentDate',
                'academicLevel': 'academicLevel'
              };
              
              const frontendField = fieldMapping[error.param] || error.param;
              newFieldErrors[frontendField] = error.msg;
            }
          });
          
          setFieldErrors(newFieldErrors);
          
          // Show general error message
          const errorCount = Object.keys(newFieldErrors).length;
          toast.error(`Please fix ${errorCount} validation error${errorCount > 1 ? 's' : ''}`);
        } else if (result.field) {
          // Handle single field error (like duplicate email)
          setFieldErrors({ [result.field]: result.message || 'Error occurred' });
          toast.error(result.message || 'Validation error occurred');
        } else {
          // Generic error
          toast.error(result.message || 'Failed to add student');
        }
        return; // Don't close dialog or reset form on error
      }
      
      // Reset form data and errors
      setFormData({
        firstName: '',
        lastName: '',
        email: '',
        studentId: '',
        grade: '',
        class: '',
        status: 'active' as 'active' | 'pending' | 'inactive',
        parentName: '',
        parentEmail: '',
        parentPhone: '',
        enrollmentDate: '',
        dateOfBirth: '',
        address: '',
        emergencyContact: '',
        medicalInfo: '',
        academicLevel: 'beginner',
        notes: '',
      });
      setFieldErrors({}); // Clear validation errors
    } else if (dialogType === 'edit' && selectedStudentData) {
      try {
        console.log('📝 Current formData state:', formData);
        
        // Validate required fields
        if (!formData.firstName || !formData.lastName) {
          toast.error('First name and last name are required');
          return;
        }
        
        // Map form data to backend expectations for update
        const updateData: any = {
          firstName: formData.firstName,
          lastName: formData.lastName,
          // Only include email if it's not empty
          ...(formData.email && formData.email.trim() && { email: formData.email.trim() }),
          studentId: formData.studentId.toUpperCase().trim(), // Backend expects studentId
          studentGrade: formData.grade, // Backend expects studentGrade
          parentName: formData.parentName,
          parentEmail: formData.parentEmail,
          parentPhone: formData.parentPhone,
          studentClass: formData.class, // Backend expects studentClass
          enrollmentDate: formData.enrollmentDate,
          ...(formData.dateOfBirth && { dateOfBirth: formData.dateOfBirth }),
          address: formData.address,
          emergencyContact: formData.emergencyContact,
          medicalInfo: formData.medicalInfo,
          academicLevel: formData.academicLevel,
          notes: formData.notes,
          isActive: formData.status === 'active', // Convert status to isActive boolean
        };
        
        // If a class is selected, update classId and assignedTeacher
        if (formData.class) {
          const selectedClass = availableClasses.find(cls => cls.name === formData.class);
          if (selectedClass) {
            // Add classId reference
            if (selectedClass._id) {
              updateData.classId = selectedClass._id;
            }
            
            // Add the primary teacher as assignedTeacher
            if (selectedClass.assignedTeachers && selectedClass.assignedTeachers.length > 0) {
              const primaryTeacher = selectedClass.assignedTeachers.find(t => t.role === 'primary');
              if (primaryTeacher && primaryTeacher.teacherId && primaryTeacher.teacherId._id) {
                updateData.assignedTeacher = primaryTeacher.teacherId._id;
              }
            }
          }
        }

        console.log('StudentManagement - About to update student with:', {
          studentId: selectedStudentData._id || selectedStudentData.id,
          updateData,
          originalStudentData: selectedStudentData
        });

        // Use _id with fallback to id for consistent ID handling
        const studentId = selectedStudentData._id || selectedStudentData.id;
        await updateStudent(studentId, updateData);
        
        toast.success('Student updated successfully!');
        
        // Refresh the students list to ensure the updated data appears
        await refreshData();
        
      } catch (error) {
        console.error('❌ Error updating student:', error);
        toast.error('Failed to update student. Please try again.');
        return; // Don't close dialog on error
      }
    }
    
    handleCloseDialog();
  };

  const handleDeleteStudents = () => {
    if (selectedStudents.length === 0) {
      toast.error('Please select students to delete');
      return;
    }
    
    setOpenDeleteDialog(true);
  };

  const confirmDeleteStudents = async () => {
    try {
      // Delete all selected students
      const deletePromises = selectedStudents.map(studentId => deleteStudent(studentId));
      await Promise.all(deletePromises);
      
      const count = selectedStudents.length;
      toast.success(`${count} student${count > 1 ? 's' : ''} deleted successfully!`);
      setSelectedStudents([]);
      setOpenDeleteDialog(false);
      
      // Refresh the students list
      await refreshData();
    } catch (error) {
      console.error('Error deleting students:', error);
      toast.error('Failed to delete some students. Please try again.');
    }
  };

  const handleExportStudents = () => {
    const dataToExport = selectedStudents.length > 0
      ? students.filter(student => selectedStudents.includes(student.id || student._id || ''))
      : students;

    // Convert to CSV format
    const headers = ['ID', 'First Name', 'Last Name', 'Grade', 'Class', 'Status', 'Parent Email', 'Parent Phone', 'Last Report'];
    const csvData = dataToExport.map(student => [
      student.id || student._id,
      student.firstName,
      student.lastName,
      student.grade,
      student.class,
      student.status,
      student.parentEmail,
      student.parentPhone,
      student.lastReport
    ]);

    const csvContent = [
      headers.join(','),
      ...csvData.map(row => row.map(field => `"${field}"`).join(','))
    ].join('\n');

    // Create and download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `students_export_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success(`Exported ${dataToExport.length} students successfully!`);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'success';
      case 'pending': return 'warning';
      case 'inactive': return 'error';
      default: return 'default';
    }
  };

  // Helper function to get random card color
  const getRandomCardColor = (index: number) => {
    return themeColors.cardColors[index % themeColors.cardColors.length];
  };

  // Helper function to get branding colors
  const getBrandingColors = () => {
    const primaryColor = schoolBranding?.branding?.primaryColor || schoolBranding?.primaryColor || '#667eea';
    const secondaryColor = schoolBranding?.branding?.secondaryColor || schoolBranding?.secondaryColor || '#764ba2';
    return { primaryColor, secondaryColor };
  };

  const { primaryColor, secondaryColor } = getBrandingColors();
  const brandingGradient = `linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%)`;
  const brandingGradientHover = `linear-gradient(135deg, ${primaryColor}dd 0%, ${secondaryColor}dd 100%)`;

  return (
    <Container maxWidth="xl">
      {/* School Banner */}
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

      {/* Header with Notification Icon */}
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
            Student Management
          </Typography>
        </Fade>
        <NotificationIcon />
      </Box>

      {/* Search and Actions */}
      <Grow in timeout={1000}>
        <Paper
          elevation={0}
          sx={{
            background: 'rgba(255,255,255,0.95)',
            borderRadius: 4,
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255,255,255,0.3)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
            mb: 3,
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            '&:hover': {
              transform: 'translateY(-2px)',
              boxShadow: '0 12px 40px rgba(0,0,0,0.15)',
            },
          }}
        >
          <CardContent sx={{ p: 3 }}>
            <Grid container spacing={3} alignItems="center">
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  placeholder="Search students..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  InputProps={{
                    startAdornment: <Search sx={{ mr: 1, color: 'text.secondary' }} />,
                  }}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 3,
                      '&:hover .MuiOutlinedInput-notchedOutline': {
                        borderColor: `${primaryColor}80`,
                      },
                      '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                        borderColor: primaryColor,
                      },
                    },
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
                    sx={{
                      borderRadius: 3,
                      '& .MuiOutlinedInput-notchedOutline': {
                        borderColor: `${primaryColor}4D`,
                      },
                      '&:hover .MuiOutlinedInput-notchedOutline': {
                        borderColor: `${primaryColor}80`,
                      },
                      '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                        borderColor: primaryColor,
                      },
                    }}
                  >
                    <MenuItem value="">All Grades</MenuItem>
                    {isLoading || grades.length === 0 ? (
                      <MenuItem disabled>{isLoading ? 'Loading grades...' : 'No grades available'}</MenuItem>
                    ) : (
                      grades.map(grade => (
                        <MenuItem key={grade} value={grade}>{grade}</MenuItem>
                      ))
                    )}
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
                    sx={{
                      borderRadius: 3,
                      '& .MuiOutlinedInput-notchedOutline': {
                        borderColor: `${primaryColor}4D`,
                      },
                      '&:hover .MuiOutlinedInput-notchedOutline': {
                        borderColor: `${primaryColor}80`,
                      },
                      '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                        borderColor: primaryColor,
                      },
                    }}
                  >
                    <MenuItem value="">All Status</MenuItem>
                    {statuses.map(status => (
                      <MenuItem key={status} value={status}>
                        {status.charAt(0).toUpperCase() + status.slice(1)}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={4}>
                <Box sx={{ display: 'flex', gap: 1.5, justifyContent: 'flex-end' }}>
                  <Button
                    variant="contained"
                    startIcon={<Add />}
                    onClick={() => handleOpenDialog('add')}
                    sx={{
                      background: brandingGradient,
                      borderRadius: 3,
                      px: 3,
                      py: 1.5,
                      fontWeight: 600,
                      boxShadow: `0 4px 12px ${primaryColor}4D`,
                      '&:hover': {
                        background: brandingGradientHover,
                        transform: 'translateY(-2px)',
                        boxShadow: `0 6px 20px ${primaryColor}66`,
                      },
                      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    }}
                  >
                    Add Student
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={<Upload />}
                    onClick={() => setOpenImportDialog(true)}
                    sx={{
                      borderRadius: 3,
                      px: 3,
                      py: 1.5,
                      fontWeight: 600,
                      borderColor: `${primaryColor}4D`,
                      color: primaryColor,
                      '&:hover': {
                        borderColor: primaryColor,
                        background: `${primaryColor}0D`,
                        transform: 'translateY(-2px)',
                      },
                      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    }}
                  >
                    Import
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={<Download />}
                    onClick={handleExportStudents}
                    sx={{
                      borderRadius: 3,
                      px: 3,
                      py: 1.5,
                      fontWeight: 600,
                      borderColor: `${primaryColor}4D`,
                      color: primaryColor,
                      '&:hover': {
                        borderColor: primaryColor,
                        background: `${primaryColor}0D`,
                        transform: 'translateY(-2px)',
                      },
                      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    }}
                  >
                    Export
                  </Button>

                </Box>
              </Grid>
            </Grid>
          </CardContent>
        </Paper>
      </Grow>

      {/* Bulk Actions */}
      {selectedStudents.length > 0 && (
        <Grow in timeout={1200}>
          <Paper
            elevation={0}
            sx={{
              background: 'rgba(255,255,255,0.8)',
              borderRadius: 4,
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255,255,255,0.3)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
              mb: 3,
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              '&:hover': {
                transform: 'translateY(-2px)',
                boxShadow: '0 12px 40px rgba(0,0,0,0.15)',
              },
            }}
          >
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Typography 
                  variant="body2"
                  sx={{ 
                    fontWeight: 600,
                    color: primaryColor,
                  }}
                >
                  {selectedStudents.length} student(s) selected
                </Typography>
                <Button
                  variant="outlined"
                  color="error"
                  startIcon={<Delete />}
                  onClick={handleDeleteStudents}
                  sx={{
                    borderRadius: 3,
                    px: 3,
                    py: 1.5,
                    fontWeight: 600,
                    borderColor: 'rgba(244, 67, 54, 0.3)',
                    color: '#f44336',
                    '&:hover': {
                      borderColor: '#f44336',
                      background: 'rgba(244, 67, 54, 0.05)',
                      transform: 'translateY(-2px)',
                    },
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  }}
                >
                  Delete Selected
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<Download />}
                  onClick={handleExportStudents}
                  sx={{
                    borderRadius: 3,
                    px: 3,
                    py: 1.5,
                    fontWeight: 600,
                    borderColor: `${primaryColor}4D`,
                    color: primaryColor,
                    '&:hover': {
                      borderColor: primaryColor,
                      background: `${primaryColor}0D`,
                      transform: 'translateY(-2px)',
                    },
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  }}
                >
                  Export Selected
                </Button>
              </Box>
            </CardContent>
          </Paper>
        </Grow>
      )}

      {/* Student Directory Table */}
      <Grow in timeout={1400}>
        <Box>
          <TableContainer component={Paper} sx={{ boxShadow: 'none', borderRadius: 3 }}>
            <Table>
              <TableHead>
                <TableRow sx={{ background: `${primaryColor}0D` }}>
                  <TableCell padding="checkbox">
                    <Checkbox
                      checked={selectedStudents.length === filteredStudents.length && filteredStudents.length > 0}
                      indeterminate={selectedStudents.length > 0 && selectedStudents.length < filteredStudents.length}
                      onChange={handleSelectAll}
                      sx={{
                        color: primaryColor,
                        '&.Mui-checked': {
                          color: primaryColor,
                        },
                      }}
                    />
                  </TableCell>
                  <TableCell sx={{ fontWeight: 600, color: primaryColor }}>Student</TableCell>
                  <TableCell sx={{ fontWeight: 600, color: primaryColor }}>Student ID</TableCell>
                  <TableCell sx={{ fontWeight: 600, color: primaryColor }}>Grade</TableCell>
                  <TableCell sx={{ fontWeight: 600, color: primaryColor }}>Class</TableCell>
                  <TableCell sx={{ fontWeight: 600, color: primaryColor }}>Status</TableCell>
                  <TableCell sx={{ fontWeight: 600, color: primaryColor }}>Last Report</TableCell>
                  <TableCell sx={{ fontWeight: 600, color: primaryColor }}>Parent Contact</TableCell>
                  <TableCell sx={{ fontWeight: 600, color: primaryColor }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredStudents.map((student, index) => (
                  <TableRow 
                    key={student.id || student._id} 
                    hover
                    sx={{
                      '&:hover': {
                        background: `${primaryColor}0D`,
                      },
                      transition: 'all 0.2s ease-in-out',
                    }}
                  >
                    <TableCell padding="checkbox">
                      <Checkbox
                        checked={selectedStudents.includes(student.id || student._id || '')}
                        onChange={() => handleSelectStudent(student.id || student._id || '')}
                        sx={{
                          color: primaryColor,
                          '&.Mui-checked': {
                            color: primaryColor,
                          },
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <Avatar 
                          sx={{ 
                            mr: 2, 
                            background: brandingGradient,
                            boxShadow: `0 4px 12px ${primaryColor}40`,
                          }}
                        >
                          {student.avatar}
                        </Avatar>
                        <Box>
                          <Typography 
                            variant="subtitle2"
                            sx={{ fontWeight: 600 }}
                          >
                            {student.firstName} {student.lastName}
                          </Typography>
                          <Typography 
                            variant="caption" 
                            sx={{ 
                              color: 'text.secondary',
                              opacity: 0.8,
                            }}
                          >
                            ID: {student.id || student._id}
                          </Typography>
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography 
                        sx={{ 
                          fontWeight: 600, 
                          fontFamily: 'monospace',
                          color: primaryColor,
                          fontSize: '0.875rem'
                        }}
                      >
                        {(student as any).studentId || 'N/A'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography sx={{ fontWeight: 500 }}>
                        {student.grade}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography sx={{ fontWeight: 500 }}>
                        {student.class}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={student.status}
                        color={getStatusColor(student.status || 'active') as any}
                        size="small"
                        sx={{
                          fontWeight: 600,
                          borderRadius: 2,
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography sx={{ fontWeight: 500 }}>
                        {student.lastReport}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Box>
                        <Typography 
                          variant="body2"
                          sx={{ fontWeight: 500 }}
                        >
                          {student.parentEmail}
                        </Typography>
                        <Typography 
                          variant="caption" 
                          sx={{ 
                            color: 'text.secondary',
                            opacity: 0.8,
                          }}
                        >
                          {student.parentPhone}
                        </Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <Tooltip title="View Details">
                          <IconButton
                            size="small"
                            onClick={() => handleOpenDialog('view', student.id || student._id)}
                            sx={{
                              color: primaryColor,
                              '&:hover': {
                                background: `${primaryColor}1A`,
                                transform: 'scale(1.1)',
                              },
                              transition: 'all 0.2s ease-in-out',
                            }}
                          >
                            <Visibility />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Edit Student">
                          <IconButton
                            size="small"
                            onClick={() => handleOpenDialog('edit', student.id || student._id)}
                            sx={{
                              color: '#4caf50',
                              '&:hover': {
                                background: 'rgba(76, 175, 80, 0.1)',
                                transform: 'scale(1.1)',
                              },
                              transition: 'all 0.2s ease-in-out',
                            }}
                          >
                            <Edit />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete Student">
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => {
                              setSelectedStudents([student.id || student._id]);
                              handleDeleteStudents();
                            }}
                            sx={{
                              color: '#f44336',
                              '&:hover': {
                                background: 'rgba(244, 67, 54, 0.1)',
                                transform: 'scale(1.1)',
                              },
                              transition: 'all 0.2s ease-in-out',
                            }}
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
          
          {filteredStudents.length === 0 && (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography 
                variant="body1" 
                sx={{ 
                  color: 'text.secondary',
                  opacity: 0.8,
                  fontWeight: 500,
                }}
              >
                No students found matching your criteria
              </Typography>
            </Box>
          )}
        </Box>
      </Grow>

      {/* Student Dialog */}
      <Dialog 
        open={openDialog} 
        onClose={handleCloseDialog} 
        maxWidth="md" 
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 4,
            background: 'rgba(255,255,255,0.95)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255,255,255,0.3)',
            boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
            overflow: 'hidden',
          }
        }}
      >
        <DialogTitle
          sx={{
            background: brandingGradient,
            color: 'white',
            fontWeight: 700,
            fontSize: '1.5rem',
            textAlign: 'center',
            py: 3,
            position: 'relative',
            '&::after': {
              content: '""',
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: '2px',
              background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.5) 50%, transparent 100%)',
            }
          }}
        >
          {dialogType === 'add' && 'Add New Student'}
          {dialogType === 'edit' && 'Edit Student'}
          {dialogType === 'view' && 'Student Details'}
        </DialogTitle>
        <DialogContent sx={{ p: 3, pt: '24px !important', background: 'rgba(255,255,255,0.8)' }}>
          {dialogType === 'view' ? (
            <Box>
              {selectedStudentData && (
                <>
                  {/* Student Avatar and Basic Info Header */}
                    <Box sx={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      mb: 4, 
                      p: 3, 
                      background: `linear-gradient(135deg, ${primaryColor}1A 0%, ${secondaryColor}1A 100%)`,
                      borderRadius: 3,
                      border: `1px solid ${primaryColor}33`,
                    }}>
                    <Avatar 
                      sx={{ 
                        mr: 3, 
                        width: 80, 
                        height: 80,
                        background: brandingGradient,
                        fontSize: '2rem',
                        fontWeight: 700,
                        boxShadow: `0 8px 24px ${primaryColor}4D`,
                      }}
                    >
                      {selectedStudentData.avatar || `${selectedStudentData.firstName?.[0]}${selectedStudentData.lastName?.[0]}`}
                    </Avatar>
                    <Box sx={{ flex: 1 }}>
                      <Typography 
                        variant="h4" 
                        sx={{ 
                          fontWeight: 700,
                          background: brandingGradient,
                          backgroundClip: 'text',
                          WebkitBackgroundClip: 'text',
                          WebkitTextFillColor: 'transparent',
                          mb: 1,
                        }}
                      >
                        {selectedStudentData.firstName} {selectedStudentData.lastName}
                      </Typography>
                      <Typography 
                        variant="body1" 
                        sx={{ 
                          color: 'text.secondary',
                          fontWeight: 500,
                          mb: 1,
                        }}
                      >
                        Student ID: {selectedStudentData.id || selectedStudentData._id}
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                        <Chip
                          label={selectedStudentData.grade}
                          sx={{
                            background: brandingGradient,
                            color: 'white',
                            fontWeight: 600,
                            borderRadius: 2,
                          }}
                        />
                        <Chip
                          label={selectedStudentData.class}
                          variant="outlined"
                          sx={{
                            borderColor: primaryColor,
                            color: primaryColor,
                            fontWeight: 600,
                            borderRadius: 2,
                          }}
                        />
                        <Chip
                          label={selectedStudentData.status}
                          color={getStatusColor(selectedStudentData.status) as any}
                          size="small"
                          sx={{
                            fontWeight: 600,
                            borderRadius: 2,
                          }}
                        />
                      </Box>
                    </Box>
                  </Box>

                  <Grid container spacing={4}>
                    {/* Student Information Section */}
                    <Grid item xs={12} md={6}>
                      <Card
                        elevation={0}
                        sx={{
                          background: 'rgba(255,255,255,0.8)',
                          borderRadius: 3,
                          border: '1px solid rgba(102, 126, 234, 0.1)',
                          boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
                          overflow: 'hidden',
                        }}
                      >
                        <Box sx={{
                          background: brandingGradient,
                          color: 'white',
                          p: 2,
                          textAlign: 'center',
                        }}>
                          <Typography variant="h6" sx={{ fontWeight: 700 }}>
                            Student Information
                          </Typography>
                        </Box>
                        <Box sx={{ p: 3 }}>
                          <InfoRow label="Enrollment Date" value={selectedStudentData.enrollmentDate || 'Not specified'} />
                          <InfoRow label="Date of Birth" value={selectedStudentData.dateOfBirth || 'Not specified'} />
                          <InfoRow label="Academic Level" value={selectedStudentData.academicLevel || 'Not specified'} />
                          <InfoRow label="Last Report" value={selectedStudentData.lastReport || 'Never'} />
                        </Box>
                      </Card>
                    </Grid>

                    {/* Contact Information Section */}
                    <Grid item xs={12} md={6}>
                      <Card
                        elevation={0}
                        sx={{
                          background: 'rgba(255,255,255,0.8)',
                          borderRadius: 3,
                          border: '1px solid rgba(102, 126, 234, 0.1)',
                          boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
                          overflow: 'hidden',
                        }}
                      >
                        <Box sx={{
                          background: brandingGradient,
                          color: 'white',
                          p: 2,
                          textAlign: 'center',
                        }}>
                          <Typography variant="h6" sx={{ fontWeight: 700 }}>
                            Contact Information
                          </Typography>
                        </Box>
                        <Box sx={{ p: 3 }}>
                          <InfoRow label="Parent Email" value={selectedStudentData.parentEmail} icon={<Email sx={{ fontSize: 16, color: primaryColor }} />} />
                          <InfoRow label="Parent Phone" value={selectedStudentData.parentPhone} icon={<Phone sx={{ fontSize: 16, color: primaryColor }} />} />
                          <InfoRow label="Address" value={selectedStudentData.address || 'No address provided'} />
                          <InfoRow label="Emergency Contact" value={selectedStudentData.emergencyContact || 'No emergency contact provided'} />
                        </Box>
                      </Card>
                    </Grid>

                    {/* Medical Information Section */}
                    <Grid item xs={12}>
                      <Card
                        elevation={0}
                        sx={{
                          background: 'rgba(255,255,255,0.8)',
                          borderRadius: 3,
                          border: '1px solid rgba(102, 126, 234, 0.1)',
                          boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
                          overflow: 'hidden',
                        }}
                      >
                        <Box sx={{
                          background: brandingGradient,
                          color: 'white',
                          p: 2,
                          textAlign: 'center',
                        }}>
                          <Typography variant="h6" sx={{ fontWeight: 700 }}>
                            Medical Information
                          </Typography>
                        </Box>
                        <Box sx={{ p: 3 }}>
                          <Typography 
                            variant="body1" 
                            sx={{ 
                              lineHeight: 1.6,
                              color: 'text.primary',
                              fontWeight: 500,
                            }}
                          >
                            {formatMedicalInfo(selectedStudentData.medicalInfo)}
                          </Typography>
                        </Box>
                      </Card>
                    </Grid>

                    {/* Notes Section */}
                    {selectedStudentData.notes && (
                      <Grid item xs={12}>
                        <Card
                          elevation={0}
                          sx={{
                            background: 'rgba(255,255,255,0.8)',
                            borderRadius: 3,
                            border: '1px solid rgba(102, 126, 234, 0.1)',
                            boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
                            overflow: 'hidden',
                          }}
                        >
                          <Box sx={{
                            background: brandingGradient,
                            color: 'white',
                            p: 2,
                            textAlign: 'center',
                          }}>
                            <Typography variant="h6" sx={{ fontWeight: 700 }}>
                              Additional Notes
                            </Typography>
                          </Box>
                          <Box sx={{ p: 3 }}>
                            <Typography 
                              variant="body1" 
                              sx={{ 
                                lineHeight: 1.6,
                                color: 'text.primary',
                                fontStyle: 'italic',
                              }}
                            >
                              {selectedStudentData.notes}
                            </Typography>
                          </Box>
                        </Card>
                      </Grid>
                    )}
                  </Grid>
                </>
              )}
            </Box>
          ) : (
            <Grid container spacing={3} sx={{ mt: 1 }}>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="First Name"
                  value={formData.firstName}
                  onChange={(e) => handleFormChange('firstName', e.target.value)}
                  required
                  error={!!fieldErrors.firstName}
                  helperText={fieldErrors.firstName}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 3,
                      '&:hover .MuiOutlinedInput-notchedOutline': {
                        borderColor: fieldErrors.firstName ? '#f44336' : `${primaryColor}80`,
                      },
                      '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                        borderColor: fieldErrors.firstName ? '#f44336' : primaryColor,
                      },
                    },
                    '& .MuiInputLabel-root.Mui-focused': {
                      color: fieldErrors.firstName ? '#f44336' : primaryColor,
                    },
                  }}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Last Name"
                  value={formData.lastName}
                  onChange={(e) => handleFormChange('lastName', e.target.value)}
                  required
                  error={!!fieldErrors.lastName}
                  helperText={fieldErrors.lastName}
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 3,
                      '&:hover .MuiOutlinedInput-notchedOutline': {
                        borderColor: fieldErrors.lastName ? '#f44336' : `${primaryColor}80`,
                      },
                      '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                        borderColor: fieldErrors.lastName ? '#f44336' : primaryColor,
                      },
                    },
                    '& .MuiInputLabel-root.Mui-focused': {
                      color: fieldErrors.lastName ? '#f44336' : primaryColor,
                    },
                  }}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Student ID"
                  value={formData.studentId}
                  onChange={(e) => handleFormChange('studentId', e.target.value.toUpperCase())}
                  required
                  error={!!fieldErrors.studentId}
                  helperText={fieldErrors.studentId || 'Unique identifier for the student'}
                  placeholder="e.g., STU001"
                  sx={{
                    '& .MuiOutlinedInput-root': {
                      borderRadius: 3,
                      '&:hover .MuiOutlinedInput-notchedOutline': {
                        borderColor: fieldErrors.studentId ? '#f44336' : `${primaryColor}80`,
                      },
                      '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                        borderColor: fieldErrors.studentId ? '#f44336' : primaryColor,
                      },
                    },
                    '& .MuiInputLabel-root.Mui-focused': {
                      color: fieldErrors.studentId ? '#f44336' : primaryColor,
                    },
                  }}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleFormChange('email', e.target.value)}
                  placeholder="Optional"
                  error={!!fieldErrors.email}
                  helperText={fieldErrors.email}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Parent Name"
                  value={formData.parentName}
                  onChange={(e) => handleFormChange('parentName', e.target.value)}
                  required
                  error={!!fieldErrors.parentName}
                  helperText={fieldErrors.parentName}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth required error={!!fieldErrors.grade}>
                  <InputLabel>Grade</InputLabel>
                  <Select
                    value={formData.grade}
                    onChange={(e) => handleFormChange('grade', e.target.value)}
                    label="Grade"
                  >
                    {isLoading || grades.length === 0 ? (
                      <MenuItem disabled>{isLoading ? 'Loading grades...' : 'No grades available'}</MenuItem>
                    ) : (
                      grades.map(grade => (
                        <MenuItem key={grade} value={grade}>{grade}</MenuItem>
                      ))
                    )}
                  </Select>
                  {fieldErrors.grade && (
                    <Typography variant="caption" color="error" sx={{ mt: 0.5, ml: 2 }}>
                      {fieldErrors.grade}
                    </Typography>
                  )}
                </FormControl>
              </Grid>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth required error={!!fieldErrors.class}>
                  <InputLabel>Class</InputLabel>
                  <Select
                    value={formData.class}
                    onChange={(e) => handleFormChange('class', e.target.value)}
                    label="Class"
                  >
                    <MenuItem value="">Select a Class</MenuItem>
                    {filteredClasses.length === 0 ? (
                      <MenuItem disabled>
                        {formData.grade ? `No classes available for ${formData.grade}` : 'Select a grade first'}
                      </MenuItem>
                    ) : (
                      filteredClasses.map(cls => (
                        <MenuItem key={cls._id} value={cls.name}>
                          {cls.name}
                        </MenuItem>
                      ))
                    )}
                  </Select>
                  {fieldErrors.class && (
                    <Typography variant="caption" color="error" sx={{ mt: 0.5, ml: 2 }}>
                      {fieldErrors.class}
                    </Typography>
                  )}
                </FormControl>
              </Grid>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth required>
                  <InputLabel>Status</InputLabel>
                  <Select
                    value={formData.status}
                    onChange={(e) => handleFormChange('status', e.target.value)}
                    label="Status"
                  >
                    {statuses.map(status => (
                      <MenuItem key={status} value={status}>
                        {status.charAt(0).toUpperCase() + status.slice(1)}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Parent Email"
                  type="email"
                  value={formData.parentEmail}
                  onChange={(e) => handleFormChange('parentEmail', e.target.value)}
                  required
                  error={!!fieldErrors.parentEmail}
                  helperText={fieldErrors.parentEmail}
                />
              </Grid>
              <Grid item xs={12}>
                <PhoneNumberInput
                  value={formData.parentPhone}
                  onChange={(value) => handleFormChange('parentPhone', value)}
                  required
                  error={!!fieldErrors.parentPhone}
                  helperText={fieldErrors.parentPhone}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Enrollment Date"
                  type="date"
                  value={formData.enrollmentDate}
                  onChange={(e) => handleFormChange('enrollmentDate', e.target.value)}
                  InputLabelProps={{ shrink: true }}
                  error={!!fieldErrors.enrollmentDate}
                  helperText={fieldErrors.enrollmentDate}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Date of Birth"
                  type="date"
                  value={formData.dateOfBirth}
                  onChange={(e) => handleFormChange('dateOfBirth', e.target.value)}
                  InputLabelProps={{ shrink: true }}
                  error={!!fieldErrors.dateOfBirth}
                  helperText={fieldErrors.dateOfBirth}
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Address"
                  value={formData.address}
                  onChange={(e) => handleFormChange('address', e.target.value)}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Emergency Contact"
                  value={formData.emergencyContact}
                  onChange={(e) => handleFormChange('emergencyContact', e.target.value)}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Medical Info"
                  value={formData.medicalInfo}
                  onChange={(e) => handleFormChange('medicalInfo', e.target.value)}
                />
              </Grid>
              {/* Academic Level removed from Add Student as per requirements. Still available in view/edit via stored data. */}
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Notes"
                  value={formData.notes}
                  onChange={(e) => handleFormChange('notes', e.target.value)}
                />
              </Grid>
            </Grid>
          )}
        </DialogContent>
        <DialogActions sx={{ 
          p: 3, 
          background: 'rgba(102, 126, 234, 0.02)',
          borderTop: '1px solid rgba(102, 126, 234, 0.1)',
          gap: 2,
        }}>
            <Button 
              onClick={handleCloseDialog}
              sx={{
                borderRadius: 3,
                px: 4,
                py: 1.5,
                fontWeight: 600,
                borderColor: `${primaryColor}4D`,
                color: primaryColor,
                '&:hover': {
                  borderColor: primaryColor,
                  background: `${primaryColor}0D`,
                  transform: 'translateY(-2px)',
                },
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              }}
              variant="outlined"
            >
              Close
            </Button>
          {dialogType !== 'view' && (
            <Button 
              variant="contained" 
              onClick={handleSaveStudent}
              disabled={!formData.firstName || !formData.lastName || !formData.studentId || !formData.grade || !formData.parentName || !formData.parentEmail}
              sx={{
                background: brandingGradient,
                borderRadius: 3,
                px: 4,
                py: 1.5,
                fontWeight: 600,
                boxShadow: `0 4px 12px ${primaryColor}4D`,
                '&:hover': {
                  background: brandingGradientHover,
                  transform: 'translateY(-2px)',
                  boxShadow: `0 6px 20px ${primaryColor}66`,
                },
                '&:disabled': {
                  background: 'rgba(0,0,0,0.12)',
                  color: 'rgba(0,0,0,0.38)',
                  transform: 'none',
                  boxShadow: 'none',
                },
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              }}
            >
              {dialogType === 'add' ? 'Add Student' : 'Save Changes'}
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={openDeleteDialog} onClose={() => setOpenDeleteDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <Typography variant="body1">
            Are you sure you want to delete {selectedStudents.length} student(s)? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDeleteDialog(false)}>Cancel</Button>
          <Button 
            variant="contained" 
            color="error" 
            onClick={confirmDeleteStudents}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Import Dialog */}
      <Dialog open={openImportDialog} onClose={() => setOpenImportDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>Import Students from CSV</DialogTitle>
        <DialogContent>
          <Typography variant="body1" sx={{ mb: 2 }}>
            Select a CSV file to import student records. The file should have columns like "First Name", "Last Name", "Grade", "Class", "Status", "Parent Email", "Parent Phone", etc.
          </Typography>
          <input
            type="file"
            accept=".csv"
            style={{ display: 'none' }}
            id="import-file-input"
            onChange={handleFileUpload}
          />
          <label htmlFor="import-file-input">
            <Button variant="outlined" component="span" fullWidth sx={{ mb: 2 }}>
              {importFile ? importFile.name : 'Choose CSV File to Import'}
            </Button>
          </label>

          {importFile && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle2" gutterBottom>Preview of Imported Data:</Typography>
              <TableContainer component={Paper} sx={{ boxShadow: 'none' }}>
                <Table>
                  <TableHead>
                    <TableRow>
                      {Object.keys(importPreview[0] || {}).map(header => (
                        <TableCell key={header}>{header}</TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {importPreview.map((row, index) => (
                      <TableRow key={index}>
                        {Object.values(row).map((value, j) => (
                          <TableCell key={j}>{String(value)}</TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenImportDialog(false)}>Cancel</Button>
          <Button 
            variant="contained" 
            onClick={handleImportStudents}
            disabled={!importFile || isImporting}
          >
            {isImporting ? 'Importing...' : 'Import Students'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default StudentManagement; 