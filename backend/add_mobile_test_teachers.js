const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Import models
const User = require('./models/User');
const School = require('./models/School');

// Connect to database
const connectDB = require('./config/database');

const testTeachers = [
  {
    firstName: 'Emily',
    lastName: 'Rodriguez',
    email: 'teacher@demo.com',
    password: 'demo12345',
    role: 'teacher',
    grade: 'Kindergarten',
    specialization: 'Early Childhood Education',
    qualifications: 'Bachelor of Education',
    bio: 'Experienced kindergarten teacher with 5 years of experience in early childhood education.',
    hireDate: new Date('2020-09-01'),
    subjects: ['Reading', 'Math', 'Science', 'Art'],
    isEmailVerified: true,
    isActive: true
  },
  {
    firstName: 'Michael',
    lastName: 'Chen',
    email: 'michael.chen@demo.com',
    password: 'demo12345',
    role: 'teacher',
    grade: '1st Grade',
    specialization: 'Elementary Education',
    qualifications: 'Master of Education',
    bio: 'Passionate elementary teacher focused on creating engaging learning experiences.',
    hireDate: new Date('2019-08-15'),
    subjects: ['Reading', 'Writing', 'Math', 'Social Studies'],
    isEmailVerified: true,
    isActive: true
  },
  {
    firstName: 'Sarah',
    lastName: 'Johnson',
    email: 'sarah.johnson@demo.com',
    password: 'demo12345',
    role: 'teacher',
    grade: '2nd Grade',
    specialization: 'Elementary Education',
    qualifications: 'Bachelor of Education',
    bio: 'Dedicated teacher with expertise in differentiated instruction.',
    hireDate: new Date('2021-01-10'),
    subjects: ['Reading', 'Math', 'Science', 'Physical Education'],
    isEmailVerified: true,
    isActive: true
  }
];

const testParents = [
  {
    firstName: 'Jennifer',
    lastName: 'Smith',
    email: 'parent@demo.com',
    password: 'demo12345',
    role: 'parent',
    studentGrade: 'Kindergarten',
    studentClass: 'K-A',
    parentName: 'Jennifer Smith',
    parentEmail: 'parent@demo.com',
    parentPhone: '+1-555-0123',
    emergencyContact: '+1-555-0124',
    isEmailVerified: true,
    isActive: true
  },
  {
    firstName: 'David',
    lastName: 'Wilson',
    email: 'david.wilson@demo.com',
    password: 'demo12345',
    role: 'parent',
    studentGrade: '1st Grade',
    studentClass: '1-B',
    parentName: 'David Wilson',
    parentEmail: 'david.wilson@demo.com',
    parentPhone: '+1-555-0125',
    emergencyContact: '+1-555-0126',
    isEmailVerified: true,
    isActive: true
  }
];

async function addTestUsers() {
  try {
    await connectDB();
    console.log('Connected to database');

    // Get the first school from the database
    const school = await School.findOne();
    if (!school) {
      console.error('No school found in database. Please create a school first.');
      process.exit(1);
    }

    console.log(`Using school: ${school.name} (${school._id})`);

    // Add test teachers
    console.log('\n=== Adding Test Teachers ===');
    for (const teacherData of testTeachers) {
      const existingTeacher = await User.findOne({ email: teacherData.email });
      if (existingTeacher) {
        console.log(`Teacher ${teacherData.email} already exists, skipping...`);
        continue;
      }

      const teacher = new User({
        ...teacherData,
        schoolId: school._id
      });

      await teacher.save();
      console.log(`✅ Added teacher: ${teacher.firstName} ${teacher.lastName} (${teacher.email})`);
    }

    // Add test parents
    console.log('\n=== Adding Test Parents ===');
    for (const parentData of testParents) {
      const existingParent = await User.findOne({ email: parentData.email });
      if (existingParent) {
        console.log(`Parent ${parentData.email} already exists, skipping...`);
        continue;
      }

      const parent = new User({
        ...parentData,
        schoolId: school._id
      });

      await parent.save();
      console.log(`✅ Added parent: ${parent.firstName} ${parent.lastName} (${parent.email})`);
    }

    console.log('\n=== Test Users Summary ===');
    console.log('Teachers:');
    for (const teacher of testTeachers) {
      console.log(`  - ${teacher.email} (password: ${teacher.password})`);
    }
    
    console.log('\nParents:');
    for (const parent of testParents) {
      console.log(`  - ${parent.email} (password: ${parent.password})`);
    }

    console.log('\n✅ Test users added successfully!');
    console.log('\nYou can now use these credentials in the mobile app:');
    console.log('- Teacher: teacher@demo.com / demo12345');
    console.log('- Parent: parent@demo.com / demo12345');

  } catch (error) {
    console.error('Error adding test users:', error);
  } finally {
    mongoose.connection.close();
    console.log('Database connection closed');
  }
}

// Run the script
addTestUsers(); 