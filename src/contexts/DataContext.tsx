import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { apiService, Student as ApiStudent, Teacher as ApiTeacher, Report as ApiReport } from '../services/apiService';
import { useAuth } from './AuthContext';

// Types
export interface MedicalInfo {
  allergies?: string[];
  conditions?: string[];
  medications?: string[];
  dietaryRestrictions?: string[];
}

export interface Student {
  _id: string;
  id?: string; // For backward compatibility
  firstName: string;
  lastName: string;
  name: string;
  age?: number;
  grade: string;
  class?: string;
  studentClass?: string; // Class assignment for students
  studentId?: string; // Student ID field
  status?: 'active' | 'pending' | 'inactive';
  lastReport: string;
  parentName?: string;
  parentEmail?: string;
  parentPhone?: string;
  avatar?: string;
  teacherId?: string;
  parentId?: string;
  schoolId: string;
  enrollmentDate?: string;
  dateOfBirth?: string;
  address?: string;
  emergencyContact?: string;
  medicalInfo?: MedicalInfo | string;
  academicLevel?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Teacher {
  _id: string;
  id?: string; // For backward compatibility
  firstName: string;
  lastName: string;
  name?: string; // For backward compatibility
  email: string;
  phone?: string;
  grade?: string;
  password?: string; // For teacher creation
  students?: number;
  reportsGenerated?: number;
  lastLogin?: string;
  status?: 'active' | 'inactive';
  isActive?: boolean;
  canEmailReports?: boolean;
  avgTimePerReport?: number;
  efficiency?: number;
  avatar?: string;
  hireDate?: string;
  specialization?: string;
  qualifications?: string;
  bio?: string;
  performanceScore?: number;
  trainingCompleted?: string[];
  schoolId: string;
  subjects: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface Parent {
  id: string;
  name: string;
  email: string;
  phone: string;
  children: string[];
  lastLogin: string;
  status: 'active' | 'inactive';
  avatar: string;
  address: string;
  emergencyContact: string;
  preferences: {
    language: string;
    notifications: {
      email: boolean;
      sms: boolean;
      push: boolean;
    };
  };
}

export interface Report {
  _id: string;
  id?: string; // For backward compatibility
  studentId: string | { _id: string; firstName: string; lastName: string; grade: string; studentClass?: string; class?: string };
  teacherId: string | { _id: string; firstName: string; lastName: string };
  schoolId: string;
  title: string;
  content: string;
  status: 'draft' | 'completed' | 'sent' | 'review' | 'approved' | 'archived';
  createdAt: string;
  updatedAt: string;
  sentAt?: string;
  template?: string;
  pdfUrl?: string; // URL to generated PDF
  voiceRecordingUrl?: string;
  voiceRecording?: {
    hasRecording: boolean;
    recordings?: Array<{
      url: string;
      duration: number;
      transcription?: string;
    }>;
    recordingUrl?: string;
    recordingDuration?: number;
    transcription?: string;
    isTranscribed: boolean;
  };
  aiGenerated?: boolean | {
    isAiGenerated: boolean;
    originalTranscription?: string;
    generationModel?: string;
    generationPrompt?: string;
    generatedAt?: string;
  };
  reviewedBy?: string[];
  tags?: string[];
  academicPeriod?: string;
  subjects?: string[];
  skills?: {
    [key: string]: {
      score: number;
      level: string;
      comments: string;
    };
  };
  attachments?: Array<{
    id: string;
    filename: string;
    originalName: string;
    mimeType: string;
    size: number;
    url: string;
    thumbnail?: string;
    uploadedAt: string;
  }>;
  type?: string;
}

export interface Class {
  _id: string;
  id?: string; // For backward compatibility
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

// Types for operation results
type StudentOperationResult = {
  success: boolean;
  data?: Student;
  error?: string;
  field?: string;
  message?: string;
  errors?: Array<{
    msg: string;
    param: string;
    location: string;
  }>;
  parentAccount?: {
    email: string;
    hasAccount: boolean;
  };
};

// Context interface
interface DataContextType {
  students: Student[];
  teachers: Teacher[];
  parents: Parent[];
  reports: Report[];
  classes: Class[];
  isLoading: boolean;
  error: string | null;
  addReport: (newReport: Report) => void;
  getStudentsByTeacher: (teacherId: string) => Student[];
  getStudentsByTeacherClasses: (teacherId: string) => Student[];
  getStudentsByParent: (parentId: string) => Student[];
  getReportsByStudent: (studentId: string) => Report[];
  getReportsByTeacher: (teacherId: string) => Report[];
  getReportsByTeacherStudents: (teacherId: string) => Report[];
  // CRUD operations for students
  addStudent: (student: Omit<Student, '_id'>) => Promise<StudentOperationResult>;
  updateStudent: (id: string, updates: Partial<Student>) => Promise<void>;
  deleteStudent: (id: string) => Promise<void>;
  // CRUD operations for teachers
  addTeacher: (teacher: Omit<Teacher, '_id'>) => Promise<any>;
  updateTeacher: (id: string, updates: Partial<Teacher>) => Promise<void>;
  deleteTeacher: (id: string) => Promise<void>;
  // Refresh data
  refreshData: () => Promise<void>;
  // Analytics data
  analytics: {
    totalStudents: number;
    totalTeachers: number;
    totalReports: number;
    activeStudents: number;
    activeTeachers: number;
    completedReports: number;
    averagePerformance: number;
    parentEngagement: number;
    classUtilization: number;
    recentActivity: any[];
  };
  // School data
  school: {
    id: string;
    name: string;
    type: string;
    status: string;
    gradeLevels: string[];
    settings?: any;
  };
}

// Provider component
export const DataProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [students, setStudents] = useState<Student[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [parents, setParents] = useState<Parent[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);

  const addReport = useCallback((newReport: Report) => {
    setReports(prevReports => [newReport, ...prevReports]);
  }, []);
  const [schoolData, setSchoolData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Get authentication state - destructure directly to ensure reactivity
  const authContext = useAuth();
  const { isAuthenticated, isLoading: authLoading, user } = authContext;

  // Helper functions to convert API data to our interfaces
  const convertApiStudent = (apiStudent: ApiStudent): Student => ({
    _id: apiStudent._id,
    id: apiStudent._id,
    firstName: apiStudent.firstName,
    lastName: apiStudent.lastName,
    name: apiStudent.name || `${apiStudent.firstName} ${apiStudent.lastName}`,
    age: apiStudent.age,
    grade: apiStudent.grade || (apiStudent as any).studentGrade, // Handle both grade and studentGrade
    class: (apiStudent as any).studentClass, // Backend sends studentClass, frontend expects class
    studentClass: (apiStudent as any).studentClass, // Add studentClass field
    studentId: apiStudent.studentId, // Add studentId field
    status: (apiStudent as any).status || ((apiStudent as any).isActive ? 'active' : 'inactive'),
    lastReport: apiStudent.lastReport || 'Never',
    parentName: (apiStudent as any).parentName,
    parentEmail: (apiStudent as any).parentEmail,
    parentPhone: (apiStudent as any).parentPhone,
    schoolId: apiStudent.schoolId,
    teacherId: apiStudent.teacherId,
    parentId: apiStudent.parentId,
    avatar: apiStudent.avatar,
    enrollmentDate: (apiStudent as any).enrollmentDate,
    dateOfBirth: (apiStudent as any).dateOfBirth,
    address: (apiStudent as any).address,
    emergencyContact: (apiStudent as any).emergencyContact,
    medicalInfo: (apiStudent as any).medicalInfo,
    academicLevel: (apiStudent as any).academicLevel,
    notes: (apiStudent as any).notes,
    createdAt: apiStudent.createdAt,
    updatedAt: apiStudent.updatedAt
  });

  const convertApiTeacher = (apiTeacher: ApiTeacher): Teacher => ({
    _id: apiTeacher._id,
    id: apiTeacher._id,
    firstName: apiTeacher.firstName,
    lastName: apiTeacher.lastName,
    name: `${apiTeacher.firstName} ${apiTeacher.lastName}`,
    email: apiTeacher.email,
    phone: apiTeacher.phone,
    grade: apiTeacher.grade,
    students: apiTeacher.students,
    reportsGenerated: apiTeacher.reportsGenerated,
    lastLogin: apiTeacher.lastLogin,
    status: apiTeacher.isActive ? 'active' : 'inactive',
    isActive: apiTeacher.isActive,
    canEmailReports: (apiTeacher as any).canEmailReports,
    avgTimePerReport: apiTeacher.avgTimePerReport,
    efficiency: apiTeacher.efficiency,
    avatar: apiTeacher.avatar,
    hireDate: apiTeacher.hireDate,
    specialization: apiTeacher.specialization,
    qualifications: apiTeacher.qualifications,
    bio: apiTeacher.bio,
    performanceScore: apiTeacher.performanceScore,
    trainingCompleted: apiTeacher.trainingCompleted,
    schoolId: typeof apiTeacher.schoolId === 'string' ? apiTeacher.schoolId : apiTeacher.schoolId._id,
    subjects: apiTeacher.subjects,
    createdAt: apiTeacher.createdAt,
    updatedAt: apiTeacher.updatedAt
  });

  const convertApiReport = (apiReport: ApiReport): Report => {
    const converted = {
      _id: apiReport._id,
      id: apiReport._id,
      studentId: apiReport.studentId,
      teacherId: apiReport.teacherId,
      schoolId: apiReport.schoolId,
      title: apiReport.title,
      content: apiReport.content,
      status: apiReport.status as 'draft' | 'completed' | 'sent',
      createdAt: apiReport.createdAt,
      updatedAt: apiReport.updatedAt,
      template: (apiReport as any).templateId?.name || (apiReport as any).template,
      voiceRecording: (apiReport as any).voiceRecording, // Include the full voiceRecording object with recordings array
      voiceRecordingUrl: (apiReport as any).voiceRecording?.recordingUrl,
      aiGenerated: (apiReport as any).aiGenerated?.isAiGenerated
    };
    
    // Debug logging for voiceRecording conversion
    if ((apiReport as any).voiceRecording) {
      console.log('🔄 DataContext convertApiReport - Original voiceRecording:', (apiReport as any).voiceRecording);
      console.log('🔄 DataContext convertApiReport - Converted voiceRecording:', converted.voiceRecording);
      console.log('🔄 DataContext convertApiReport - Recordings array length:', (apiReport as any).voiceRecording?.recordings?.length || 0);
    }
    
    return converted;
  };

  const convertApiClass = (apiClass: any): Class => ({
    _id: apiClass._id,
    id: apiClass._id,
    name: apiClass.name,
    schoolId: apiClass.schoolId,
    grade: apiClass.grade,
    description: apiClass.description,
    status: apiClass.status as 'active' | 'inactive' | 'archived',
    assignedTeachers: apiClass.assignedTeachers || [],
    schedule: apiClass.schedule,
    capacity: apiClass.capacity,
    currentEnrollment: apiClass.currentEnrollment,
    subjects: apiClass.subjects || [],
    createdBy: apiClass.createdBy,
    isActive: apiClass.isActive,
    isFull: apiClass.isFull,
    availableSpots: apiClass.availableSpots,
    createdAt: apiClass.createdAt,
    updatedAt: apiClass.updatedAt
  });

  const getStudentsByTeacher = (teacherId: string) => 
    students.filter(student => student.teacherId === teacherId);

  const getStudentsByTeacherClasses = (teacherId: string) => {
    // Get teacher's assigned classes
    const teacherAssignedClasses = classes.filter(cls => 
      cls.assignedTeachers.some(assignment => 
        assignment.teacherId && (
          assignment.teacherId._id === teacherId || 
          assignment.teacherId._id.toString() === teacherId
        )
      )
    );
    
    // Get students from teacher's assigned classes
    return students.filter(student => 
      teacherAssignedClasses.some(cls => cls.name === student.studentClass)
    );
  };

  const getStudentsByParent = (parentId: string) => 
    students.filter(student => student.parentId === parentId);

  const getReportsByStudent = (studentId: string) => 
    reports.filter(report => {
      if (typeof report.studentId === 'string') {
        return report.studentId === studentId;
      } else {
        return report.studentId && report.studentId._id === studentId;
      }
    });

  const getReportsByTeacher = (teacherId: string) => 
    reports.filter(report => {
      if (typeof report.teacherId === 'string') {
        return report.teacherId === teacherId;
      } else {
        return report.teacherId && report.teacherId._id === teacherId;
      }
    });

  const getReportsByTeacherStudents = (teacherId: string) => {
    const teacherStudents = getStudentsByTeacherClasses(teacherId);
    return reports.filter(report => {
      const reportStudentId = typeof report.studentId === 'string' ? report.studentId : (report.studentId && report.studentId._id);
      return reportStudentId && teacherStudents.some(student => student._id === reportStudentId);
    });
  };

  // CRUD operations for students
  const addStudent = async (student: Omit<Student, '_id'>): Promise<StudentOperationResult> => {
    try {
      console.log('DataContext - addStudent called with:', student);
      const response = await apiService.createStudent(student);
      console.log('DataContext - createStudent API response:', response);
      
      if (response.success && response.data) {
        console.log('DataContext - Student created successfully, converting data...');
        const convertedStudent = convertApiStudent(response.data);
        console.log('DataContext - Converted student:', convertedStudent);
        setStudents(prev => {
          const newStudents = [...prev, convertedStudent];
          console.log('DataContext - Updated students array length:', newStudents.length);
          return newStudents;
        });
        console.log('DataContext - Student added to state successfully');
        return { success: true, data: convertedStudent };
      } else {
        console.error('DataContext - Failed to create student:', response);
        const errorMessage = response.message || response.error || 'Failed to add student';
        setError(errorMessage);
        
        // Return field-specific error information
        return { 
          success: false, 
          error: errorMessage,
          field: (response as any).field,
          message: (response as any).message
        };
      }
    } catch (err) {
      console.error('DataContext - Error in addStudent:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to add student';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    }
  };

  const updateStudent = async (id: string, updates: Partial<Student>) => {
    try {
      console.log('DataContext - updateStudent called with:', { id, updates });
      const response = await apiService.updateStudent(id, updates);
      console.log('DataContext - updateStudent API response:', response);
      
      if (response.success && response.data) {
        setStudents(prev => prev.map(student => 
          student._id === id ? convertApiStudent(response.data!) : student
        ));
        console.log('✅ DataContext - Student updated successfully in state');
      } else {
        const errorMessage = response.error || response.message || 'Failed to update student';
        console.error('❌ DataContext - Update failed:', errorMessage);
        setError(errorMessage);
        throw new Error(errorMessage);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update student';
      console.error('❌ DataContext - Update error:', err);
      setError(errorMessage);
      throw err; // Re-throw to allow component to handle
    }
  };

  const deleteStudent = async (id: string) => {
    try {
      const response = await apiService.deleteStudent(id);
      if (response.success) {
        setStudents(prev => prev.filter(student => student._id !== id));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete student');
    }
  };

  // Refresh data function
  const refreshData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // Load all data in parallel
      const schoolId = typeof user?.schoolId === 'string' ? user.schoolId : (user?.schoolId as any)?._id;
      
      console.log('DataContext - About to call getSchool with schoolId:', schoolId);
      console.log('DataContext - User object:', user);
      console.log('DataContext - User schoolId type:', typeof user?.schoolId);
      console.log('DataContext - User schoolId value:', user?.schoolId);

         // Load data with individual error handling for each API call
         // Use appropriate classes API based on user role
         const classesApiCall = user?.role === 'teacher' 
           ? apiService.getTeacherAssignedClasses() 
           : apiService.getClasses();
         
         console.log('DataContext - User role:', user?.role);
         console.log('DataContext - Using classes API call:', user?.role === 'teacher' ? 'getTeacherAssignedClasses' : 'getClasses');

         const [studentsResponse, teachersResponse, reportsResponse, classesResponse, schoolResponse] = await Promise.allSettled([
           apiService.getStudents(),
           apiService.getTeachers(),
           apiService.getReports(true), // Include cross-teacher reports for due calculation
           classesApiCall,
           schoolId ? apiService.getSchool(schoolId) : Promise.resolve({ success: false, data: null })
         ]);

         // Extract the actual responses from Promise.allSettled results
         const studentsResult = studentsResponse.status === 'fulfilled' ? studentsResponse.value : { success: false, data: null };
         const teachersResult = teachersResponse.status === 'fulfilled' ? teachersResponse.value : { success: false, data: null };
         const reportsResult = reportsResponse.status === 'fulfilled' ? reportsResponse.value : { success: false, data: null };
         const classesResult = classesResponse.status === 'fulfilled' ? classesResponse.value : { success: false, data: null };
         const schoolResult = schoolResponse.status === 'fulfilled' ? schoolResponse.value : { success: false, data: null };



              if (studentsResult.success && studentsResult.data && Array.isArray(studentsResult.data)) {
          setStudents(studentsResult.data.map(convertApiStudent));
        } else {
          console.log('DataContext - Students response not successful or not an array:', studentsResult);
          setStudents([]);
        }

        if (teachersResult.success && teachersResult.data && Array.isArray(teachersResult.data)) {
          console.log('DataContext - Loading teachers, API returned:', teachersResult.data.length, 'teachers');
          const convertedTeachers = teachersResult.data.map(convertApiTeacher);
          console.log('DataContext - Converted teachers:', convertedTeachers);
          setTeachers(convertedTeachers);
        } else {
          console.log('DataContext - Teachers response not successful or not an array:', teachersResult);
          setTeachers([]);
        }

        if (reportsResult.success && reportsResult.data && Array.isArray(reportsResult.data)) {
          setReports(reportsResult.data.map(convertApiReport));
        } else {
          console.log('DataContext - Reports response not successful or not an array:', reportsResult);
          setReports([]);
        }

        if (classesResult.success && classesResult.data && Array.isArray(classesResult.data)) {
          console.log('DataContext - Loading classes, API returned:', classesResult.data.length, 'classes');
          const convertedClasses = classesResult.data.map(convertApiClass);
          console.log('DataContext - Converted classes:', convertedClasses);
          setClasses(convertedClasses);
        } else {
          console.log('DataContext - Classes response not successful or not an array:', classesResult);
          setClasses([]);
        }

        // Handle school data
        console.log('DataContext - School response:', schoolResult);
        console.log('DataContext - School response success:', schoolResult.success);
        console.log('DataContext - School response data:', schoolResult.data);
        console.log('DataContext - School response error:', (schoolResult as any).error);
        
        if (schoolResult.success && schoolResult.data) {
          console.log('DataContext - Setting school data:', schoolResult.data);
          console.log('DataContext - School gradeLevels:', schoolResult.data.gradeLevels);
          console.log('DataContext - School gradeLevels length:', schoolResult.data.gradeLevels?.length);
          setSchoolData(schoolResult.data);
        } else {
          console.log('DataContext - School response failed or no data');
          console.log('DataContext - SchoolId used for API call:', schoolId);
          
          // If school data loading failed, set an empty school data to prevent infinite loading
          if (schoolId) {
            console.warn('DataContext - Failed to load school data for schoolId:', schoolId);
            setSchoolData(null);
          }
        }

      // For now, keep parents as empty array since we don't have a parents API endpoint
      setParents([]);

    } catch (err) {
      console.error('DataContext - Error loading data:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to load data';
      setError(errorMessage);
      
      // If it's an authentication error, don't set school data to null
      if (errorMessage.includes('401') || errorMessage.includes('Unauthorized')) {
        console.log('DataContext - Authentication error detected, not clearing school data');
      } else {
        setSchoolData(null);
      }
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // Load data from API when user is authenticated
  useEffect(() => {
    // Don't load data if still checking authentication or not authenticated
    if (authLoading || !isAuthenticated) {
      setIsLoading(false);
      return;
    }

    const loadData = async () => {
      try {
        await refreshData();
      } catch (error) {
        console.error('DataContext - Error loading data:', error);
      }
    };

    loadData();
    // `refreshData` is defined later in this provider and intentionally
    // excluded — including it would create an infinite loop because the
    // function identity changes on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, authLoading, user]); // Removed refreshData from dependencies

  // CRUD operations for teachers
  const addTeacher = async (teacher: Omit<Teacher, '_id'>) => {
    try {
      console.log('DataContext - addTeacher called with:', teacher);
      const response = await apiService.createTeacher(teacher);
      console.log('DataContext - createTeacher API response:', response);
      console.log('DataContext - response.generatedPassword:', response.generatedPassword);
      console.log('DataContext - response keys:', Object.keys(response));
      
      if (response.success && response.data) {
        console.log('DataContext - Teacher created successfully, refreshing data...');
        // Optimistically add the newly created teacher to the list for immediate UI feedback
        setTeachers(prev => [convertApiTeacher(response.data!), ...prev]);
        // Then refresh all data to ensure complete consistency
        await refreshData();
        console.log('DataContext - Data refresh completed after adding teacher');
        // Return the full response including generatedPassword
        console.log('DataContext - Returning response with generatedPassword:', response.generatedPassword);
        return response;
      } else {
        console.error('DataContext - Failed to create teacher:', response);
        setError(response.error || 'Failed to add teacher');
        return response;
      }
    } catch (err) {
      console.error('DataContext - Error in addTeacher:', err);
      setError(err instanceof Error ? err.message : 'Failed to add teacher');
      throw err;
    }
  };

  const updateTeacher = async (id: string, updates: Partial<Teacher>) => {
    try {
      const response = await apiService.updateTeacher(id, updates);
      if (response.success && response.data) {
        setTeachers(prev => prev.map(teacher => 
          teacher._id === id ? convertApiTeacher(response.data!) : teacher
        ));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update teacher');
    }
  };

  const deleteTeacher = async (id: string) => {
    try {
      const response = await apiService.deleteTeacher(id);
      if (response.success) {
        setTeachers(prev => prev.filter(teacher => teacher._id !== id));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete teacher');
    }
  };

  // Analytics data
  const analytics = {
    totalStudents: students.length,
    totalTeachers: teachers.length,
    totalReports: reports.length,
    activeStudents: students.filter(s => s.status === 'active').length,
    activeTeachers: teachers.filter(t => t.status === 'active').length,
    completedReports: reports.filter(r => r.status === 'completed').length,
    averagePerformance: teachers.length > 0 
      ? teachers.reduce((sum, teacher) => sum + (teacher.performanceScore || 0), 0) / teachers.length 
      : 0,
    parentEngagement: students.length > 0 ? Math.round((students.filter(s => s.parentEmail).length / students.length) * 100) : 0,
    classUtilization: classes.length > 0 ? Math.round((students.length / classes.reduce((sum, c) => sum + (c.capacity || 0), 0)) * 100) : 0,
    recentActivity: [
      { type: 'report', message: 'New report generated', timestamp: new Date().toISOString() },
      { type: 'student', message: 'Student enrolled', timestamp: new Date().toISOString() },
      { type: 'teacher', message: 'Teacher logged in', timestamp: new Date().toISOString() }
    ]
  };

  // School data from authenticated user
  const schoolId = typeof user?.schoolId === 'string' ? user.schoolId : (user?.schoolId as any)?._id;
  
  console.log('DataContext - User object:', user);
  console.log('DataContext - User schoolId type:', typeof user?.schoolId);
  console.log('DataContext - User schoolId value:', user?.schoolId);
  console.log('DataContext - Extracted schoolId:', schoolId);
  
  const school = {
    id: schoolId || '',
    name: schoolData?.name || (schoolId ? 'Loading...' : 'Barrana AI School'),
    type: schoolData?.schoolType || 'Unknown',
    status: schoolData?.isActive !== undefined ? (schoolData.isActive ? 'Active' : 'Inactive') : 'Unknown',
    gradeLevels: schoolData?.gradeLevels || [],
    settings: schoolData?.settings || {}
  };
  
  console.log('DataContext - schoolData state:', schoolData);
  console.log('DataContext - constructed school object:', school);
  

  

  
  // Force refresh if school data is missing but we have a schoolId
  const [hasAttemptedSchoolLoad, setHasAttemptedSchoolLoad] = useState(false);
  
  // Reset the flag when user changes
  useEffect(() => {
    setHasAttemptedSchoolLoad(false);
  }, [user]);
  
  useEffect(() => {
    if (schoolId && !hasAttemptedSchoolLoad && (!schoolData || !schoolData.gradeLevels || schoolData.gradeLevels.length === 0)) {
      setHasAttemptedSchoolLoad(true);
      // Use a timeout to prevent immediate re-triggering
      const timeoutId = setTimeout(() => {
        refreshData();
      }, 1000);
      
      return () => clearTimeout(timeoutId);
    }
    // `refreshData` is defined later in this provider and intentionally
    // excluded — including it would re-trigger this guarded refresh loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schoolId, schoolData, hasAttemptedSchoolLoad]); // Removed refreshData from dependencies
  
  
  

  


  const value: DataContextType = {
    students,
    teachers,
    parents,
    reports,
    classes,
    isLoading,
    error,
    getStudentsByTeacher,
    getStudentsByTeacherClasses,
    getStudentsByParent,
    getReportsByStudent,
    getReportsByTeacher,
    getReportsByTeacherStudents,
    addStudent,
    updateStudent,
    deleteStudent,
    addTeacher,
    updateTeacher,
    deleteTeacher,
    refreshData,
    addReport,
    analytics,
    school
  };

  return (
    <DataContext.Provider value={value}>
      {children}
    </DataContext.Provider>
  );
};

// Context
const DataContext = createContext<DataContextType | undefined>(undefined);

// Hook
export const useData = () => {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
}; 