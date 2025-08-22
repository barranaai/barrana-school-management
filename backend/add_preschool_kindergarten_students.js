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
    console.log('📊 MongoDB Connected for adding Preschool and Kindergarten students to Test School 2');
  } catch (error) {
    console.error('Database connection failed:', error);
    process.exit(1);
  }
};

// Additional students for Preschool and Kindergarten classes
const additionalStudents = [
  // Preschool - 4 students
  {
    firstName: "Zoe",
    lastName: "Garcia",
    email: "zoe.garcia@testschool2.com",
    role: "parent",
    studentGrade: "Preschool",
    studentClass: "Preschool",
    parentName: "Maria Garcia",
    parentEmail: "maria.garcia@email.com",
    parentPhone: "+1-555-0141",
    enrollmentDate: new Date("2024-09-01"),
    dateOfBirth: new Date("2020-01-15"),
    address: "123 Learning Lane, Test City, TC 12345",
    emergencyContact: "+1-555-0142",
    medicalInfo: "No known allergies",
    academicLevel: "beginner",
    notes: "Very social and friendly",
    isActive: true,
    isEmailVerified: false
  },
  {
    firstName: "Leo",
    lastName: "Martinez",
    email: "leo.martinez@testschool2.com",
    role: "parent",
    studentGrade: "Preschool",
    studentClass: "Preschool",
    parentName: "Carlos Martinez",
    parentEmail: "carlos.martinez@email.com",
    parentPhone: "+1-555-0143",
    enrollmentDate: new Date("2024-09-01"),
    dateOfBirth: new Date("2020-03-22"),
    address: "456 Discovery Drive, Test City, TC 12345",
    emergencyContact: "+1-555-0144",
    medicalInfo: "No known allergies",
    academicLevel: "beginner",
    notes: "Loves building blocks",
    isActive: true,
    isEmailVerified: false
  },
  {
    firstName: "Luna",
    lastName: "Rodriguez",
    email: "luna.rodriguez@testschool2.com",
    role: "parent",
    studentGrade: "Preschool",
    studentClass: "Preschool",
    parentName: "Ana Rodriguez",
    parentEmail: "ana.rodriguez@email.com",
    parentPhone: "+1-555-0145",
    enrollmentDate: new Date("2024-09-01"),
    dateOfBirth: new Date("2020-05-10"),
    address: "789 Wonder Way, Test City, TC 12345",
    emergencyContact: "+1-555-0146",
    medicalInfo: "No known allergies",
    academicLevel: "beginner",
    notes: "Creative and artistic",
    isActive: true,
    isEmailVerified: false
  },
  {
    firstName: "Felix",
    lastName: "Lopez",
    email: "felix.lopez@testschool2.com",
    role: "parent",
    studentGrade: "Preschool",
    studentClass: "Preschool",
    parentName: "Jose Lopez",
    parentEmail: "jose.lopez@email.com",
    parentPhone: "+1-555-0147",
    enrollmentDate: new Date("2024-09-01"),
    dateOfBirth: new Date("2020-07-18"),
    address: "321 Imagination Street, Test City, TC 12345",
    emergencyContact: "+1-555-0148",
    medicalInfo: "No known allergies",
    academicLevel: "beginner",
    notes: "Enjoys story time",
    isActive: true,
    isEmailVerified: false
  },

  // Kindergarten - 3 students
  {
    firstName: "Nova",
    lastName: "Gonzalez",
    email: "nova.gonzalez@testschool2.com",
    role: "parent",
    studentGrade: "Kindergarten",
    studentClass: "Kindergarten",
    parentName: "Isabella Gonzalez",
    parentEmail: "isabella.gonzalez@email.com",
    parentPhone: "+1-555-0149",
    enrollmentDate: new Date("2024-09-01"),
    dateOfBirth: new Date("2019-02-14"),
    address: "654 Adventure Avenue, Test City, TC 12345",
    emergencyContact: "+1-555-0150",
    medicalInfo: "No known allergies",
    academicLevel: "beginner",
    notes: "Natural leader in class",
    isActive: true,
    isEmailVerified: false
  },
  {
    firstName: "Atlas",
    lastName: "Perez",
    email: "atlas.perez@testschool2.com",
    role: "parent",
    studentGrade: "Kindergarten",
    studentClass: "Kindergarten",
    parentName: "Miguel Perez",
    parentEmail: "miguel.perez@email.com",
    parentPhone: "+1-555-0151",
    enrollmentDate: new Date("2024-09-01"),
    dateOfBirth: new Date("2019-04-30"),
    address: "987 Explorer Road, Test City, TC 12345",
    emergencyContact: "+1-555-0152",
    medicalInfo: "No known allergies",
    academicLevel: "beginner",
    notes: "Excellent problem solver",
    isActive: true,
    isEmailVerified: false
  },
  {
    firstName: "Iris",
    lastName: "Torres",
    email: "iris.torres@testschool2.com",
    role: "parent",
    studentGrade: "Kindergarten",
    studentClass: "Kindergarten",
    parentName: "Carmen Torres",
    parentEmail: "carmen.torres@email.com",
    parentPhone: "+1-555-0153",
    enrollmentDate: new Date("2024-09-01"),
    dateOfBirth: new Date("2019-08-25"),
    address: "147 Curiosity Court, Test City, TC 12345",
    emergencyContact: "+1-555-0154",
    medicalInfo: "No known allergies",
    academicLevel: "beginner",
    notes: "Loves science experiments",
    isActive: true,
    isEmailVerified: false
  }
];

// Function to add additional students to Test School 2
const addPreschoolKindergartenStudents = async () => {
  try {
    console.log('🚀 Starting to add Preschool and Kindergarten students to Test School 2...');

    // Find Test School 2 specifically
    const testSchool2 = await School.findOne({ name: "Test School 2" });
    
    if (!testSchool2) {
      console.error('❌ Test School 2 not found in database');
      return;
    }
    
    console.log(`🎯 Found Test School 2: ${testSchool2.name} (${testSchool2.slug})`);

    // Add schoolId to all students
    const studentsWithSchoolId = additionalStudents.map(student => ({
      ...student,
      schoolId: testSchool2._id
    }));

    // Insert students
    console.log('📝 Adding Preschool and Kindergarten students to Test School 2...');
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
    
    console.log('\n📊 New Student Distribution in Test School 2:');
    Object.entries(classSummary).forEach(([className, count]) => {
      console.log(`   ${className}: ${count} students`);
    });

    // Get total students for Test School 2
    const totalStudents = await User.find({ 
      schoolId: testSchool2._id, 
      role: "parent" 
    });
    
    console.log(`\n📈 Total students in Test School 2: ${totalStudents.length}`);

  } catch (error) {
    console.error('❌ Error adding Preschool and Kindergarten students to Test School 2:', error);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Database connection closed');
    process.exit(0);
  }
};

// Run the script
connectDB().then(addPreschoolKindergartenStudents); 