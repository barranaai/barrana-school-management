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
    console.log('📊 MongoDB Connected for adding test students');
  } catch (error) {
    console.error('Database connection failed:', error);
    process.exit(1);
  }
};

// Test students data for test school 2
const testStudents = [
  // Grade 1A - 5 students
  {
    firstName: "Emma",
    lastName: "Johnson",
    email: "emma.johnson@test.com",
    role: "parent", // Students are stored as 'parent' role
    studentGrade: "Grade 1",
    studentClass: "Grade 1A",
    parentName: "Sarah Johnson",
    parentEmail: "sarah.johnson@email.com",
    parentPhone: "+1-555-0101",
    enrollmentDate: new Date("2024-09-01"),
    dateOfBirth: new Date("2018-03-15"),
    address: "123 Oak Street, Test City, TC 12345",
    emergencyContact: "+1-555-0102",
    medicalInfo: "No known allergies",
    academicLevel: "beginner",
    notes: "Enthusiastic learner",
    isActive: true,
    isEmailVerified: false
  },
  {
    firstName: "Liam",
    lastName: "Williams",
    email: "liam.williams@test.com",
    role: "parent",
    studentGrade: "Grade 1",
    studentClass: "Grade 1A",
    parentName: "Michael Williams",
    parentEmail: "michael.williams@email.com",
    parentPhone: "+1-555-0103",
    enrollmentDate: new Date("2024-09-01"),
    dateOfBirth: new Date("2018-05-22"),
    address: "456 Pine Avenue, Test City, TC 12345",
    emergencyContact: "+1-555-0104",
    medicalInfo: "No known allergies",
    academicLevel: "beginner",
    notes: "Good at math",
    isActive: true,
    isEmailVerified: false
  },
  {
    firstName: "Olivia",
    lastName: "Brown",
    email: "olivia.brown@test.com",
    role: "parent",
    studentGrade: "Grade 1",
    studentClass: "Grade 1A",
    parentName: "Jennifer Brown",
    parentEmail: "jennifer.brown@email.com",
    parentPhone: "+1-555-0105",
    enrollmentDate: new Date("2024-09-01"),
    dateOfBirth: new Date("2018-07-10"),
    address: "789 Maple Drive, Test City, TC 12345",
    emergencyContact: "+1-555-0106",
    medicalInfo: "No known allergies",
    academicLevel: "beginner",
    notes: "Loves reading",
    isActive: true,
    isEmailVerified: false
  },
  {
    firstName: "Noah",
    lastName: "Davis",
    email: "noah.davis@test.com",
    role: "parent",
    studentGrade: "Grade 1",
    studentClass: "Grade 1A",
    parentName: "David Davis",
    parentEmail: "david.davis@email.com",
    parentPhone: "+1-555-0107",
    enrollmentDate: new Date("2024-09-01"),
    dateOfBirth: new Date("2018-01-30"),
    address: "321 Elm Street, Test City, TC 12345",
    emergencyContact: "+1-555-0108",
    medicalInfo: "No known allergies",
    academicLevel: "beginner",
    notes: "Creative student",
    isActive: true,
    isEmailVerified: false
  },
  {
    firstName: "Ava",
    lastName: "Miller",
    email: "ava.miller@test.com",
    role: "parent",
    studentGrade: "Grade 1",
    studentClass: "Grade 1A",
    parentName: "Lisa Miller",
    parentEmail: "lisa.miller@email.com",
    parentPhone: "+1-555-0109",
    enrollmentDate: new Date("2024-09-01"),
    dateOfBirth: new Date("2018-11-05"),
    address: "654 Cedar Lane, Test City, TC 12345",
    emergencyContact: "+1-555-0110",
    medicalInfo: "No known allergies",
    academicLevel: "beginner",
    notes: "Excellent attendance",
    isActive: true,
    isEmailVerified: false
  },

  // Grade 1B - 5 students
  {
    firstName: "Ethan",
    lastName: "Wilson",
    email: "ethan.wilson@test.com",
    role: "parent",
    studentGrade: "Grade 1",
    studentClass: "Grade 1B",
    parentName: "Robert Wilson",
    parentEmail: "robert.wilson@email.com",
    parentPhone: "+1-555-0111",
    enrollmentDate: new Date("2024-09-01"),
    dateOfBirth: new Date("2018-04-12"),
    address: "987 Birch Road, Test City, TC 12345",
    emergencyContact: "+1-555-0112",
    medicalInfo: "No known allergies",
    academicLevel: "beginner",
    notes: "Very organized",
    isActive: true,
    isEmailVerified: false
  },
  {
    firstName: "Sophia",
    lastName: "Taylor",
    email: "sophia.taylor@test.com",
    role: "parent",
    studentGrade: "Grade 1",
    studentClass: "Grade 1B",
    parentName: "Amanda Taylor",
    parentEmail: "amanda.taylor@email.com",
    parentPhone: "+1-555-0113",
    enrollmentDate: new Date("2024-09-01"),
    dateOfBirth: new Date("2018-06-18"),
    address: "147 Willow Way, Test City, TC 12345",
    emergencyContact: "+1-555-0114",
    medicalInfo: "No known allergies",
    academicLevel: "beginner",
    notes: "Great team player",
    isActive: true,
    isEmailVerified: false
  },
  {
    firstName: "Mason",
    lastName: "Anderson",
    email: "mason.anderson@test.com",
    role: "parent",
    studentGrade: "Grade 1",
    studentClass: "Grade 1B",
    parentName: "Christopher Anderson",
    parentEmail: "christopher.anderson@email.com",
    parentPhone: "+1-555-0115",
    enrollmentDate: new Date("2024-09-01"),
    dateOfBirth: new Date("2018-08-25"),
    address: "258 Spruce Street, Test City, TC 12345",
    emergencyContact: "+1-555-0116",
    medicalInfo: "No known allergies",
    academicLevel: "beginner",
    notes: "Natural leader",
    isActive: true,
    isEmailVerified: false
  },
  {
    firstName: "Isabella",
    lastName: "Thomas",
    email: "isabella.thomas@test.com",
    role: "parent",
    studentGrade: "Grade 1",
    studentClass: "Grade 1B",
    parentName: "Nicole Thomas",
    parentEmail: "nicole.thomas@email.com",
    parentPhone: "+1-555-0117",
    enrollmentDate: new Date("2024-09-01"),
    dateOfBirth: new Date("2018-02-14"),
    address: "369 Poplar Avenue, Test City, TC 12345",
    emergencyContact: "+1-555-0118",
    medicalInfo: "No known allergies",
    academicLevel: "beginner",
    notes: "Excellent reader",
    isActive: true,
    isEmailVerified: false
  },
  {
    firstName: "William",
    lastName: "Jackson",
    email: "william.jackson@test.com",
    role: "parent",
    studentGrade: "Grade 1",
    studentClass: "Grade 1B",
    parentName: "Steven Jackson",
    parentEmail: "steven.jackson@email.com",
    parentPhone: "+1-555-0119",
    enrollmentDate: new Date("2024-09-01"),
    dateOfBirth: new Date("2018-10-08"),
    address: "741 Aspen Drive, Test City, TC 12345",
    emergencyContact: "+1-555-0120",
    medicalInfo: "No known allergies",
    academicLevel: "beginner",
    notes: "Curious learner",
    isActive: true,
    isEmailVerified: false
  },

  // Grade 2A - 5 students
  {
    firstName: "James",
    lastName: "White",
    email: "james.white@test.com",
    role: "parent",
    studentGrade: "Grade 2",
    studentClass: "Grade 2A",
    parentName: "Patricia White",
    parentEmail: "patricia.white@email.com",
    parentPhone: "+1-555-0121",
    enrollmentDate: new Date("2024-09-01"),
    dateOfBirth: new Date("2017-03-20"),
    address: "852 Oak Lane, Test City, TC 12345",
    emergencyContact: "+1-555-0122",
    medicalInfo: "No known allergies",
    academicLevel: "intermediate",
    notes: "Advanced math skills",
    isActive: true,
    isEmailVerified: false
  },
  {
    firstName: "Charlotte",
    lastName: "Harris",
    email: "charlotte.harris@test.com",
    role: "parent",
    studentGrade: "Grade 2",
    studentClass: "Grade 2A",
    parentName: "Daniel Harris",
    parentEmail: "daniel.harris@email.com",
    parentPhone: "+1-555-0123",
    enrollmentDate: new Date("2024-09-01"),
    dateOfBirth: new Date("2017-05-15"),
    address: "963 Pine Street, Test City, TC 12345",
    emergencyContact: "+1-555-0124",
    medicalInfo: "No known allergies",
    academicLevel: "intermediate",
    notes: "Creative writer",
    isActive: true,
    isEmailVerified: false
  },
  {
    firstName: "Benjamin",
    lastName: "Clark",
    email: "benjamin.clark@test.com",
    role: "parent",
    studentGrade: "Grade 2",
    studentClass: "Grade 2A",
    parentName: "Michelle Clark",
    parentEmail: "michelle.clark@email.com",
    parentPhone: "+1-555-0125",
    enrollmentDate: new Date("2024-09-01"),
    dateOfBirth: new Date("2017-07-30"),
    address: "159 Maple Avenue, Test City, TC 12345",
    emergencyContact: "+1-555-0126",
    medicalInfo: "No known allergies",
    academicLevel: "intermediate",
    notes: "Good problem solver",
    isActive: true,
    isEmailVerified: false
  },
  {
    firstName: "Mia",
    lastName: "Lewis",
    email: "mia.lewis@test.com",
    role: "parent",
    studentGrade: "Grade 2",
    studentClass: "Grade 2A",
    parentName: "Kevin Lewis",
    parentEmail: "kevin.lewis@email.com",
    parentPhone: "+1-555-0127",
    enrollmentDate: new Date("2024-09-01"),
    dateOfBirth: new Date("2017-01-12"),
    address: "357 Elm Drive, Test City, TC 12345",
    emergencyContact: "+1-555-0128",
    medicalInfo: "No known allergies",
    academicLevel: "intermediate",
    notes: "Excellent artist",
    isActive: true,
    isEmailVerified: false
  },
  {
    firstName: "Lucas",
    lastName: "Robinson",
    email: "lucas.robinson@test.com",
    role: "parent",
    studentGrade: "Grade 2",
    studentClass: "Grade 2A",
    parentName: "Stephanie Robinson",
    parentEmail: "stephanie.robinson@email.com",
    parentPhone: "+1-555-0129",
    enrollmentDate: new Date("2024-09-01"),
    dateOfBirth: new Date("2017-09-05"),
    address: "468 Cedar Road, Test City, TC 12345",
    emergencyContact: "+1-555-0130",
    medicalInfo: "No known allergies",
    academicLevel: "intermediate",
    notes: "Natural scientist",
    isActive: true,
    isEmailVerified: false
  },

  // Grade 2B - 5 students
  {
    firstName: "Amelia",
    lastName: "Walker",
    email: "amelia.walker@test.com",
    role: "parent",
    studentGrade: "Grade 2",
    studentClass: "Grade 2B",
    parentName: "Richard Walker",
    parentEmail: "richard.walker@email.com",
    parentPhone: "+1-555-0131",
    enrollmentDate: new Date("2024-09-01"),
    dateOfBirth: new Date("2017-04-18"),
    address: "579 Birch Lane, Test City, TC 12345",
    emergencyContact: "+1-555-0132",
    medicalInfo: "No known allergies",
    academicLevel: "intermediate",
    notes: "Great communicator",
    isActive: true,
    isEmailVerified: false
  },
  {
    firstName: "Henry",
    lastName: "Perez",
    email: "henry.perez@test.com",
    role: "parent",
    studentGrade: "Grade 2",
    studentClass: "Grade 2B",
    parentName: "Laura Perez",
    parentEmail: "laura.perez@email.com",
    parentPhone: "+1-555-0133",
    enrollmentDate: new Date("2024-09-01"),
    dateOfBirth: new Date("2017-06-25"),
    address: "680 Willow Street, Test City, TC 12345",
    emergencyContact: "+1-555-0134",
    medicalInfo: "No known allergies",
    academicLevel: "intermediate",
    notes: "Bilingual student",
    isActive: true,
    isEmailVerified: false
  },
  {
    firstName: "Harper",
    lastName: "Hall",
    email: "harper.hall@test.com",
    role: "parent",
    studentGrade: "Grade 2",
    studentClass: "Grade 2B",
    parentName: "Mark Hall",
    parentEmail: "mark.hall@email.com",
    parentPhone: "+1-555-0135",
    enrollmentDate: new Date("2024-09-01"),
    dateOfBirth: new Date("2017-08-10"),
    address: "791 Spruce Avenue, Test City, TC 12345",
    emergencyContact: "+1-555-0136",
    medicalInfo: "No known allergies",
    academicLevel: "intermediate",
    notes: "Loves technology",
    isActive: true,
    isEmailVerified: false
  },
  {
    firstName: "Alexander",
    lastName: "Young",
    email: "alexander.young@test.com",
    role: "parent",
    studentGrade: "Grade 2",
    studentClass: "Grade 2B",
    parentName: "Rebecca Young",
    parentEmail: "rebecca.young@email.com",
    parentPhone: "+1-555-0137",
    enrollmentDate: new Date("2024-09-01"),
    dateOfBirth: new Date("2017-02-28"),
    address: "802 Poplar Drive, Test City, TC 12345",
    emergencyContact: "+1-555-0138",
    medicalInfo: "No known allergies",
    academicLevel: "intermediate",
    notes: "Athletic student",
    isActive: true,
    isEmailVerified: false
  },
  {
    firstName: "Evelyn",
    lastName: "Allen",
    email: "evelyn.allen@test.com",
    role: "parent",
    studentGrade: "Grade 2",
    studentClass: "Grade 2B",
    parentName: "Thomas Allen",
    parentEmail: "thomas.allen@email.com",
    parentPhone: "+1-555-0139",
    enrollmentDate: new Date("2024-09-01"),
    dateOfBirth: new Date("2017-10-15"),
    address: "913 Aspen Lane, Test City, TC 12345",
    emergencyContact: "+1-555-0140",
    medicalInfo: "No known allergies",
    academicLevel: "intermediate",
    notes: "Musical talent",
    isActive: true,
    isEmailVerified: false
  }
];

// Function to add test students
const addTestStudents = async () => {
  try {
    console.log('🚀 Starting to add test students...');

    // Find test school 2 (assuming it's the second school or a specific school)
    const schools = await School.find({});
    console.log(`📚 Found ${schools.length} schools in database`);
    
    let targetSchool;
    if (schools.length >= 2) {
      targetSchool = schools[1]; // Second school
      console.log(`🎯 Using school: ${targetSchool.name}`);
    } else if (schools.length === 1) {
      targetSchool = schools[0]; // Use the only school
      console.log(`🎯 Using school: ${targetSchool.name}`);
    } else {
      console.error('❌ No schools found in database');
      return;
    }

    // Add schoolId to all students
    const studentsWithSchoolId = testStudents.map(student => ({
      ...student,
      schoolId: targetSchool._id
    }));

    // Insert students
    console.log('📝 Adding students to database...');
    const createdStudents = await User.insertMany(studentsWithSchoolId);
    
    console.log(`✅ Successfully added ${createdStudents.length} students to ${targetSchool.name}`);
    
    // Show summary by class
    const classSummary = {};
    createdStudents.forEach(student => {
      const className = student.studentClass;
      if (!classSummary[className]) {
        classSummary[className] = 0;
      }
      classSummary[className]++;
    });
    
    console.log('\n📊 Student Distribution:');
    Object.entries(classSummary).forEach(([className, count]) => {
      console.log(`   ${className}: ${count} students`);
    });

  } catch (error) {
    console.error('❌ Error adding test students:', error);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Database connection closed');
    process.exit(0);
  }
};

// Run the script
connectDB().then(addTestStudents); 