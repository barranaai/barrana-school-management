const axios = require('axios');

// Test students data
const testStudents = [
  // Grade 1A - 5 students
  {
    firstName: "Emma",
    lastName: "Johnson",
    email: "emma.johnson@test.com",
    grade: "Grade 1",
    studentGrade: "Grade 1",
    studentClass: "Grade 1A",
    parentName: "Sarah Johnson",
    parentEmail: "sarah.johnson@email.com",
    parentPhone: "+1-555-0101",
    enrollmentDate: "2024-09-01",
    dateOfBirth: "2018-03-15",
    address: "123 Oak Street, Test City, TC 12345",
    emergencyContact: "+1-555-0102",
    medicalInfo: "No known allergies",
    academicLevel: "beginner",
    notes: "Enthusiastic learner"
  },
  {
    firstName: "Liam",
    lastName: "Williams",
    email: "liam.williams@test.com",
    grade: "Grade 1",
    studentGrade: "Grade 1",
    studentClass: "Grade 1A",
    parentName: "Michael Williams",
    parentEmail: "michael.williams@email.com",
    parentPhone: "+1-555-0103",
    enrollmentDate: "2024-09-01",
    dateOfBirth: "2018-05-22",
    address: "456 Pine Avenue, Test City, TC 12345",
    emergencyContact: "+1-555-0104",
    medicalInfo: "No known allergies",
    academicLevel: "beginner",
    notes: "Good at math"
  },
  {
    firstName: "Olivia",
    lastName: "Brown",
    email: "olivia.brown@test.com",
    grade: "Grade 1",
    studentGrade: "Grade 1",
    studentClass: "Grade 1A",
    parentName: "Jennifer Brown",
    parentEmail: "jennifer.brown@email.com",
    parentPhone: "+1-555-0105",
    enrollmentDate: "2024-09-01",
    dateOfBirth: "2018-07-10",
    address: "789 Maple Drive, Test City, TC 12345",
    emergencyContact: "+1-555-0106",
    medicalInfo: "No known allergies",
    academicLevel: "beginner",
    notes: "Loves reading"
  },
  {
    firstName: "Noah",
    lastName: "Davis",
    email: "noah.davis@test.com",
    grade: "Grade 1",
    studentGrade: "Grade 1",
    studentClass: "Grade 1A",
    parentName: "David Davis",
    parentEmail: "david.davis@email.com",
    parentPhone: "+1-555-0107",
    enrollmentDate: "2024-09-01",
    dateOfBirth: "2018-01-30",
    address: "321 Elm Street, Test City, TC 12345",
    emergencyContact: "+1-555-0108",
    medicalInfo: "No known allergies",
    academicLevel: "beginner",
    notes: "Creative student"
  },
  {
    firstName: "Ava",
    lastName: "Miller",
    email: "ava.miller@test.com",
    grade: "Grade 1",
    studentGrade: "Grade 1",
    studentClass: "Grade 1A",
    parentName: "Lisa Miller",
    parentEmail: "lisa.miller@email.com",
    parentPhone: "+1-555-0109",
    enrollmentDate: "2024-09-01",
    dateOfBirth: "2018-11-05",
    address: "654 Cedar Lane, Test City, TC 12345",
    emergencyContact: "+1-555-0110",
    medicalInfo: "No known allergies",
    academicLevel: "beginner",
    notes: "Excellent attendance"
  },

  // Grade 1B - 5 students
  {
    firstName: "Ethan",
    lastName: "Wilson",
    email: "ethan.wilson@test.com",
    grade: "Grade 1",
    studentGrade: "Grade 1",
    studentClass: "Grade 1B",
    parentName: "Robert Wilson",
    parentEmail: "robert.wilson@email.com",
    parentPhone: "+1-555-0111",
    enrollmentDate: "2024-09-01",
    dateOfBirth: "2018-04-12",
    address: "987 Birch Road, Test City, TC 12345",
    emergencyContact: "+1-555-0112",
    medicalInfo: "No known allergies",
    academicLevel: "beginner",
    notes: "Very organized"
  },
  {
    firstName: "Sophia",
    lastName: "Taylor",
    email: "sophia.taylor@test.com",
    grade: "Grade 1",
    studentGrade: "Grade 1",
    studentClass: "Grade 1B",
    parentName: "Amanda Taylor",
    parentEmail: "amanda.taylor@email.com",
    parentPhone: "+1-555-0113",
    enrollmentDate: "2024-09-01",
    dateOfBirth: "2018-06-18",
    address: "147 Willow Way, Test City, TC 12345",
    emergencyContact: "+1-555-0114",
    medicalInfo: "No known allergies",
    academicLevel: "beginner",
    notes: "Great team player"
  },
  {
    firstName: "Mason",
    lastName: "Anderson",
    email: "mason.anderson@test.com",
    grade: "Grade 1",
    studentGrade: "Grade 1",
    studentClass: "Grade 1B",
    parentName: "Christopher Anderson",
    parentEmail: "christopher.anderson@email.com",
    parentPhone: "+1-555-0115",
    enrollmentDate: "2024-09-01",
    dateOfBirth: "2018-08-25",
    address: "258 Spruce Street, Test City, TC 12345",
    emergencyContact: "+1-555-0116",
    medicalInfo: "No known allergies",
    academicLevel: "beginner",
    notes: "Natural leader"
  },
  {
    firstName: "Isabella",
    lastName: "Thomas",
    email: "isabella.thomas@test.com",
    grade: "Grade 1",
    studentGrade: "Grade 1",
    studentClass: "Grade 1B",
    parentName: "Nicole Thomas",
    parentEmail: "nicole.thomas@email.com",
    parentPhone: "+1-555-0117",
    enrollmentDate: "2024-09-01",
    dateOfBirth: "2018-02-14",
    address: "369 Poplar Avenue, Test City, TC 12345",
    emergencyContact: "+1-555-0118",
    medicalInfo: "No known allergies",
    academicLevel: "beginner",
    notes: "Excellent reader"
  },
  {
    firstName: "William",
    lastName: "Jackson",
    email: "william.jackson@test.com",
    grade: "Grade 1",
    studentGrade: "Grade 1",
    studentClass: "Grade 1B",
    parentName: "Steven Jackson",
    parentEmail: "steven.jackson@email.com",
    parentPhone: "+1-555-0119",
    enrollmentDate: "2024-09-01",
    dateOfBirth: "2018-10-08",
    address: "741 Aspen Drive, Test City, TC 12345",
    emergencyContact: "+1-555-0120",
    medicalInfo: "No known allergies",
    academicLevel: "beginner",
    notes: "Curious learner"
  },

  // Grade 2A - 5 students
  {
    firstName: "James",
    lastName: "White",
    email: "james.white@test.com",
    grade: "Grade 2",
    studentGrade: "Grade 2",
    studentClass: "Grade 2A",
    parentName: "Patricia White",
    parentEmail: "patricia.white@email.com",
    parentPhone: "+1-555-0121",
    enrollmentDate: "2024-09-01",
    dateOfBirth: "2017-03-20",
    address: "852 Oak Lane, Test City, TC 12345",
    emergencyContact: "+1-555-0122",
    medicalInfo: "No known allergies",
    academicLevel: "intermediate",
    notes: "Advanced math skills"
  },
  {
    firstName: "Charlotte",
    lastName: "Harris",
    email: "charlotte.harris@test.com",
    grade: "Grade 2",
    studentGrade: "Grade 2",
    studentClass: "Grade 2A",
    parentName: "Daniel Harris",
    parentEmail: "daniel.harris@email.com",
    parentPhone: "+1-555-0123",
    enrollmentDate: "2024-09-01",
    dateOfBirth: "2017-05-15",
    address: "963 Pine Street, Test City, TC 12345",
    emergencyContact: "+1-555-0124",
    medicalInfo: "No known allergies",
    academicLevel: "intermediate",
    notes: "Creative writer"
  },
  {
    firstName: "Benjamin",
    lastName: "Clark",
    email: "benjamin.clark@test.com",
    grade: "Grade 2",
    studentGrade: "Grade 2",
    studentClass: "Grade 2A",
    parentName: "Michelle Clark",
    parentEmail: "michelle.clark@email.com",
    parentPhone: "+1-555-0125",
    enrollmentDate: "2024-09-01",
    dateOfBirth: "2017-07-30",
    address: "159 Maple Avenue, Test City, TC 12345",
    emergencyContact: "+1-555-0126",
    medicalInfo: "No known allergies",
    academicLevel: "intermediate",
    notes: "Good problem solver"
  },
  {
    firstName: "Mia",
    lastName: "Lewis",
    email: "mia.lewis@test.com",
    grade: "Grade 2",
    studentGrade: "Grade 2",
    studentClass: "Grade 2A",
    parentName: "Kevin Lewis",
    parentEmail: "kevin.lewis@email.com",
    parentPhone: "+1-555-0127",
    enrollmentDate: "2024-09-01",
    dateOfBirth: "2017-01-12",
    address: "357 Elm Drive, Test City, TC 12345",
    emergencyContact: "+1-555-0128",
    medicalInfo: "No known allergies",
    academicLevel: "intermediate",
    notes: "Excellent artist"
  },
  {
    firstName: "Lucas",
    lastName: "Robinson",
    email: "lucas.robinson@test.com",
    grade: "Grade 2",
    studentGrade: "Grade 2",
    studentClass: "Grade 2A",
    parentName: "Stephanie Robinson",
    parentEmail: "stephanie.robinson@email.com",
    parentPhone: "+1-555-0129",
    enrollmentDate: "2024-09-01",
    dateOfBirth: "2017-09-05",
    address: "468 Cedar Road, Test City, TC 12345",
    emergencyContact: "+1-555-0130",
    medicalInfo: "No known allergies",
    academicLevel: "intermediate",
    notes: "Natural scientist"
  },

  // Grade 2B - 5 students
  {
    firstName: "Amelia",
    lastName: "Walker",
    email: "amelia.walker@test.com",
    grade: "Grade 2",
    studentGrade: "Grade 2",
    studentClass: "Grade 2B",
    parentName: "Richard Walker",
    parentEmail: "richard.walker@email.com",
    parentPhone: "+1-555-0131",
    enrollmentDate: "2024-09-01",
    dateOfBirth: "2017-04-18",
    address: "579 Birch Lane, Test City, TC 12345",
    emergencyContact: "+1-555-0132",
    medicalInfo: "No known allergies",
    academicLevel: "intermediate",
    notes: "Great communicator"
  },
  {
    firstName: "Henry",
    lastName: "Perez",
    email: "henry.perez@test.com",
    grade: "Grade 2",
    studentGrade: "Grade 2",
    studentClass: "Grade 2B",
    parentName: "Laura Perez",
    parentEmail: "laura.perez@email.com",
    parentPhone: "+1-555-0133",
    enrollmentDate: "2024-09-01",
    dateOfBirth: "2017-06-25",
    address: "680 Willow Street, Test City, TC 12345",
    emergencyContact: "+1-555-0134",
    medicalInfo: "No known allergies",
    academicLevel: "intermediate",
    notes: "Bilingual student"
  },
  {
    firstName: "Harper",
    lastName: "Hall",
    email: "harper.hall@test.com",
    grade: "Grade 2",
    studentGrade: "Grade 2",
    studentClass: "Grade 2B",
    parentName: "Mark Hall",
    parentEmail: "mark.hall@email.com",
    parentPhone: "+1-555-0135",
    enrollmentDate: "2024-09-01",
    dateOfBirth: "2017-08-10",
    address: "791 Spruce Avenue, Test City, TC 12345",
    emergencyContact: "+1-555-0136",
    medicalInfo: "No known allergies",
    academicLevel: "intermediate",
    notes: "Loves technology"
  },
  {
    firstName: "Alexander",
    lastName: "Young",
    email: "alexander.young@test.com",
    grade: "Grade 2",
    studentGrade: "Grade 2",
    studentClass: "Grade 2B",
    parentName: "Rebecca Young",
    parentEmail: "rebecca.young@email.com",
    parentPhone: "+1-555-0137",
    enrollmentDate: "2024-09-01",
    dateOfBirth: "2017-02-28",
    address: "802 Poplar Drive, Test City, TC 12345",
    emergencyContact: "+1-555-0138",
    medicalInfo: "No known allergies",
    academicLevel: "intermediate",
    notes: "Athletic student"
  },
  {
    firstName: "Evelyn",
    lastName: "Allen",
    email: "evelyn.allen@test.com",
    grade: "Grade 2",
    studentGrade: "Grade 2",
    studentClass: "Grade 2B",
    parentName: "Thomas Allen",
    parentEmail: "thomas.allen@email.com",
    parentPhone: "+1-555-0139",
    enrollmentDate: "2024-09-01",
    dateOfBirth: "2017-10-15",
    address: "913 Aspen Lane, Test City, TC 12345",
    emergencyContact: "+1-555-0140",
    medicalInfo: "No known allergies",
    academicLevel: "intermediate",
    notes: "Musical talent"
  }
];

// Function to add a single student
async function addStudent(studentData) {
  try {
    const response = await axios.post('http://localhost:5001/api/students', studentData, {
      headers: {
        'Content-Type': 'application/json',
        // Note: This would need a valid admin token in a real scenario
        // For now, we'll try without authentication to see if the endpoint works
      }
    });
    
    if (response.data.success) {
      console.log(`✅ Added student: ${studentData.firstName} ${studentData.lastName}`);
      return true;
    } else {
      console.error(`❌ Failed to add student: ${studentData.firstName} ${studentData.lastName}`, response.data);
      return false;
    }
  } catch (error) {
    console.error(`❌ Error adding student: ${studentData.firstName} ${studentData.lastName}`, error.response?.data || error.message);
    return false;
  }
}

// Function to add all test students
async function addAllTestStudents() {
  console.log('🚀 Starting to add test students...');
  let successCount = 0;
  let failCount = 0;
  
  for (let i = 0; i < testStudents.length; i++) {
    const student = testStudents[i];
    console.log(`📝 Adding student ${i + 1}/${testStudents.length}: ${student.firstName} ${student.lastName}`);
    
    const success = await addStudent(student);
    if (success) {
      successCount++;
    } else {
      failCount++;
    }
    
    // Add a small delay between requests to avoid overwhelming the server
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  console.log(`🎉 Finished adding students!`);
  console.log(`✅ Successfully added: ${successCount} students`);
  console.log(`❌ Failed to add: ${failCount} students`);
  
  return { successCount, failCount };
}

// Run the script
addAllTestStudents().catch(console.error); 