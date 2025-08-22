const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const User = require('./models/User');
const School = require('./models/School');

// Database connection
const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/barrana_ai';
    await mongoose.connect(mongoURI, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      bufferCommands: false,
    });
    console.log('📊 MongoDB Connected for adding Preschool students to Test School 2');
  } catch (error) {
    console.error('Database connection failed:', error);
    process.exit(1);
  }
};

// Preschool students data for Test School 2
const preschoolStudents = [
  // Pre A Class - 5 students
  {
    firstName: "Ava",
    lastName: "Anderson",
    email: "ava.anderson@testschool2.com",
    role: "parent",
    studentGrade: "Preschool",
    studentClass: "Pre A",
    parentName: "Lisa Anderson",
    parentEmail: "lisa.anderson@email.com",
    parentPhone: "+1-555-0201",
    enrollmentDate: new Date("2024-09-01"),
    dateOfBirth: new Date("2020-03-15"),
    address: "123 Oak Street, Test City, TC 12345",
    emergencyContact: "+1-555-0202",
    medicalInfo: "No known allergies",
    academicLevel: "beginner",
    notes: "Enthusiastic learner",
    isActive: true,
    isEmailVerified: false
  },
  {
    firstName: "Ethan",
    lastName: "Martinez",
    email: "ethan.martinez@testschool2.com",
    role: "parent",
    studentGrade: "Preschool",
    studentClass: "Pre A",
    parentName: "Carlos Martinez",
    parentEmail: "carlos.martinez@email.com",
    parentPhone: "+1-555-0203",
    enrollmentDate: new Date("2024-09-01"),
    dateOfBirth: new Date("2020-05-22"),
    address: "456 Pine Avenue, Test City, TC 12345",
    emergencyContact: "+1-555-0204",
    medicalInfo: "No known allergies",
    academicLevel: "beginner",
    notes: "Loves art and crafts",
    isActive: true,
    isEmailVerified: false
  },
  {
    firstName: "Sophia",
    lastName: "Thompson",
    email: "sophia.thompson@testschool2.com",
    role: "parent",
    studentGrade: "Preschool",
    studentClass: "Pre A",
    parentName: "Jennifer Thompson",
    parentEmail: "jennifer.thompson@email.com",
    parentPhone: "+1-555-0205",
    enrollmentDate: new Date("2024-09-01"),
    dateOfBirth: new Date("2020-07-10"),
    address: "789 Maple Drive, Test City, TC 12345",
    emergencyContact: "+1-555-0206",
    medicalInfo: "No known allergies",
    academicLevel: "beginner",
    notes: "Great social skills",
    isActive: true,
    isEmailVerified: false
  },
  {
    firstName: "Lucas",
    lastName: "Garcia",
    email: "lucas.garcia@testschool2.com",
    role: "parent",
    studentGrade: "Preschool",
    studentClass: "Pre A",
    parentName: "Maria Garcia",
    parentEmail: "maria.garcia@email.com",
    parentPhone: "+1-555-0207",
    enrollmentDate: new Date("2024-09-01"),
    dateOfBirth: new Date("2020-01-30"),
    address: "321 Elm Street, Test City, TC 12345",
    emergencyContact: "+1-555-0208",
    medicalInfo: "No known allergies",
    academicLevel: "beginner",
    notes: "Curious about everything",
    isActive: true,
    isEmailVerified: false
  },
  {
    firstName: "Isabella",
    lastName: "Wilson",
    email: "isabella.wilson@testschool2.com",
    role: "parent",
    studentGrade: "Preschool",
    studentClass: "Pre A",
    parentName: "Robert Wilson",
    parentEmail: "robert.wilson@email.com",
    parentPhone: "+1-555-0209",
    enrollmentDate: new Date("2024-09-01"),
    dateOfBirth: new Date("2020-11-12"),
    address: "654 Birch Road, Test City, TC 12345",
    emergencyContact: "+1-555-0210",
    medicalInfo: "No known allergies",
    academicLevel: "beginner",
    notes: "Natural leader",
    isActive: true,
    isEmailVerified: false
  },

  // Pre B Class - 5 students
  {
    firstName: "Mason",
    lastName: "Davis",
    email: "mason.davis@testschool2.com",
    role: "parent",
    studentGrade: "Preschool",
    studentClass: "Pre B",
    parentName: "Sarah Davis",
    parentEmail: "sarah.davis@email.com",
    parentPhone: "+1-555-0211",
    enrollmentDate: new Date("2024-09-01"),
    dateOfBirth: new Date("2020-04-18"),
    address: "987 Cedar Lane, Test City, TC 12345",
    emergencyContact: "+1-555-0212",
    medicalInfo: "No known allergies",
    academicLevel: "beginner",
    notes: "Very active child",
    isActive: true,
    isEmailVerified: false
  },
  {
    firstName: "Mia",
    lastName: "Rodriguez",
    email: "mia.rodriguez@testschool2.com",
    role: "parent",
    studentGrade: "Preschool",
    studentClass: "Pre B",
    parentName: "David Rodriguez",
    parentEmail: "david.rodriguez@email.com",
    parentPhone: "+1-555-0213",
    enrollmentDate: new Date("2024-09-01"),
    dateOfBirth: new Date("2020-06-25"),
    address: "147 Spruce Street, Test City, TC 12345",
    emergencyContact: "+1-555-0214",
    medicalInfo: "No known allergies",
    academicLevel: "beginner",
    notes: "Loves music and dance",
    isActive: true,
    isEmailVerified: false
  },
  {
    firstName: "Noah",
    lastName: "Brown",
    email: "noah.brown@testschool2.com",
    role: "parent",
    studentGrade: "Preschool",
    studentClass: "Pre B",
    parentName: "Amanda Brown",
    parentEmail: "amanda.brown@email.com",
    parentPhone: "+1-555-0215",
    enrollmentDate: new Date("2024-09-01"),
    dateOfBirth: new Date("2020-08-03"),
    address: "258 Willow Avenue, Test City, TC 12345",
    emergencyContact: "+1-555-0216",
    medicalInfo: "No known allergies",
    academicLevel: "beginner",
    notes: "Great problem solver",
    isActive: true,
    isEmailVerified: false
  },
  {
    firstName: "Emma",
    lastName: "Miller",
    email: "emma.miller@testschool2.com",
    role: "parent",
    studentGrade: "Preschool",
    studentClass: "Pre B",
    parentName: "James Miller",
    parentEmail: "james.miller@email.com",
    parentPhone: "+1-555-0217",
    enrollmentDate: new Date("2024-09-01"),
    dateOfBirth: new Date("2020-02-14"),
    address: "369 Poplar Drive, Test City, TC 12345",
    emergencyContact: "+1-555-0218",
    medicalInfo: "No known allergies",
    academicLevel: "beginner",
    notes: "Creative imagination",
    isActive: true,
    isEmailVerified: false
  },
  {
    firstName: "William",
    lastName: "Johnson",
    email: "william.johnson@testschool2.com",
    role: "parent",
    studentGrade: "Preschool",
    studentClass: "Pre B",
    parentName: "Emily Johnson",
    parentEmail: "emily.johnson@email.com",
    parentPhone: "+1-555-0219",
    enrollmentDate: new Date("2024-09-01"),
    dateOfBirth: new Date("2020-10-08"),
    address: "741 Aspen Lane, Test City, TC 12345",
    emergencyContact: "+1-555-0220",
    medicalInfo: "No known allergies",
    academicLevel: "beginner",
    notes: "Very helpful to others",
    isActive: true,
    isEmailVerified: false
  }
];

// Function to add preschool students to Test School 2
const addPreschoolStudentsToTestSchool2 = async () => {
  try {
    console.log('🚀 Starting to add Preschool students to Test School 2...');

    // Find Test School 2 specifically
    const testSchool2 = await School.findOne({ name: "Test School 2" });
    
    if (!testSchool2) {
      console.error('❌ Test School 2 not found in database');
      return;
    }
    
    console.log(`🎯 Found Test School 2: ${testSchool2.name} (${testSchool2.slug})`);

    // Check if students already exist for this school
    const existingStudents = await User.find({ 
      schoolId: testSchool2._id, 
      role: "parent" 
    });
    
    if (existingStudents.length > 0) {
      console.log(`⚠️  Found ${existingStudents.length} existing students in Test School 2`);
      console.log('🗑️  Removing existing students to avoid duplicates...');
      await User.deleteMany({ schoolId: testSchool2._id, role: "parent" });
      console.log('✅ Removed existing students');
    }

    // Add schoolId to all students
    const studentsWithSchoolId = preschoolStudents.map(student => ({
      ...student,
      schoolId: testSchool2._id
    }));

    // Insert students
    console.log('📝 Adding Preschool students to Test School 2...');
    const createdStudents = await User.insertMany(studentsWithSchoolId);
    
    console.log(`✅ Successfully added ${createdStudents.length} students to Test School 2`);
    
    // Show summary by class
    const classSummary = {};
    createdStudents.forEach(student => {
      const className = student.studentClass;
      if (!classSummary[className]) {
        classSummary[className] = 0;
      }
      classSummary[className]++;
    });
    
    console.log('\n📊 Student Distribution in Test School 2:');
    Object.entries(classSummary).forEach(([className, count]) => {
      console.log(`   ${className}: ${count} students`);
    });

    // Show total students
    const totalStudents = await User.find({ 
      schoolId: testSchool2._id, 
      role: "parent" 
    });
    console.log(`\n📈 Total students in Test School 2: ${totalStudents.length}`);

  } catch (error) {
    console.error('❌ Error adding Preschool students to Test School 2:', error);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Database connection closed');
    process.exit(0);
  }
};

// Run the script
connectDB().then(addPreschoolStudentsToTestSchool2); 