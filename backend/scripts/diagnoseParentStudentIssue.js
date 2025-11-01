/**
 * Diagnostic Script for Parent-Student Issues
 * 
 * This script:
 * 1. Lists all users by role
 * 2. Shows parent accounts and their emails
 * 3. Shows student accounts and their parentEmail fields
 * 4. Identifies mismatches
 * 
 * Usage: node scripts/diagnoseParentStudentIssue.js
 */

const mongoose = require('mongoose');
const User = require('../models/User');
const School = require('../models/School');
require('dotenv').config({ path: require('path').resolve(__dirname, '../config.env') });

const connectDB = async () => {
  try {
    // Load environment variables from config.env
    const path = require('path');
    const envPath = path.resolve(__dirname, '../config.env');
    
    // Check if config.env exists and load it
    try {
      require('dotenv').config({ path: envPath });
      console.log(`📄 Loaded config from: ${envPath}`);
    } catch (e) {
      console.log(`⚠️  Could not load config.env, using defaults`);
    }
    
    // Show what we're using
    console.log(`\n🔍 Environment Check:`);
    console.log(`   MONGODB_URI: ${process.env.MONGODB_URI ? 'SET (' + process.env.MONGODB_URI.substring(0, 30) + '...)' : 'NOT SET'}`);
    console.log(`   MONGODB_URI_PROD: ${process.env.MONGODB_URI_PROD ? 'SET (' + process.env.MONGODB_URI_PROD.substring(0, 30) + '...)' : 'NOT SET'}`);
    
    const mongoURI = process.env.MONGODB_URI || process.env.MONGODB_URI_PROD || 'mongodb://localhost:27017/barrana_ai';
    console.log(`\n🔗 Connecting to MongoDB: ${mongoURI}`);
    
    await mongoose.connect(mongoURI, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    console.log(`✅ MongoDB Connected:`);
    console.log(`   Host: ${mongoose.connection.host}`);
    console.log(`   Port: ${mongoose.connection.port}`);
    console.log(`   Database: ${mongoose.connection.name}\n`);
    
    // List all databases
    const adminDb = mongoose.connection.db.admin();
    const databases = await adminDb.listDatabases();
    console.log(`📚 Available databases:`);
    databases.databases.forEach(db => {
      console.log(`   - ${db.name} (${(db.sizeOnDisk / 1024 / 1024).toFixed(2)} MB)`);
    });
    console.log('');
    
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    return false;
  }
};

const diagnoseIssues = async () => {
  try {
    console.log('🔍 DIAGNOSTIC REPORT\n');
    console.log('='.repeat(80));
    
    // Step 1: Count all users by role
    console.log('\n📊 USER COUNTS BY ROLE:');
    const roleCounts = await User.aggregate([
      {
        $group: {
          _id: '$role',
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);
    
    roleCounts.forEach(item => {
      console.log(`   ${item._id || 'null'}: ${item.count}`);
    });
    
    // Step 2: List all parents
    console.log('\n👨‍👩‍👧 PARENT ACCOUNTS:');
    const parents = await User.find({ role: 'parent' })
      .select('firstName lastName email schoolId isActive')
      .populate('schoolId', 'name')
      .lean();
    
    if (parents.length === 0) {
      console.log('   ❌ No parent accounts found in database!');
    } else {
      parents.forEach((parent, index) => {
        console.log(`\n   ${index + 1}. ${parent.firstName} ${parent.lastName}`);
        console.log(`      Email: ${parent.email || 'NO EMAIL'}`);
        console.log(`      School: ${parent.schoolId ? (typeof parent.schoolId === 'object' ? parent.schoolId.name : parent.schoolId) : 'NO SCHOOL ID'}`);
        console.log(`      Active: ${parent.isActive !== false ? 'Yes' : 'No'}`);
      });
    }
    
    // Step 3: List all students
    console.log('\n\n👶 STUDENT ACCOUNTS:');
    const students = await User.find({ role: 'student' })
      .select('firstName lastName studentId parentEmail parentName schoolId isActive')
      .populate('schoolId', 'name')
      .lean();
    
    if (students.length === 0) {
      console.log('   ❌ No student accounts found in database!');
    } else {
      console.log(`   Total students: ${students.length}\n`);
      students.forEach((student, index) => {
        console.log(`   ${index + 1}. ${student.firstName} ${student.lastName} (${student.studentId || 'NO ID'})`);
        console.log(`      Parent Email: ${student.parentEmail || 'NO PARENT EMAIL'}`);
        console.log(`      Parent Name: ${student.parentName || 'NO PARENT NAME'}`);
        console.log(`      School: ${student.schoolId ? (typeof student.schoolId === 'object' ? student.schoolId.name : student.schoolId) : 'NO SCHOOL ID'}`);
        console.log(`      Active: ${student.isActive !== false ? 'Yes' : 'No'}`);
        console.log('');
      });
    }
    
    // Step 4: Find mismatches
    console.log('\n\n🔍 ANALYZING RELATIONSHIPS:\n');
    
    if (parents.length > 0 && students.length > 0) {
      for (const parent of parents) {
        const parentEmail = parent.email ? parent.email.toLowerCase().trim() : null;
        const parentSchoolId = parent.schoolId 
          ? (typeof parent.schoolId === 'object' ? String(parent.schoolId._id) : String(parent.schoolId))
          : null;
        
        console.log(`\n👤 Parent: ${parent.firstName} ${parent.lastName} (${parentEmail})`);
        
        if (!parentEmail) {
          console.log('   ❌ ERROR: Parent has no email address!');
          continue;
        }
        
        if (!parentSchoolId) {
          console.log('   ❌ ERROR: Parent has no schoolId!');
          continue;
        }
        
        // Find students with matching parentEmail (case-insensitive)
        const matchingStudents = students.filter(student => {
          const studentParentEmail = student.parentEmail ? student.parentEmail.toLowerCase().trim() : null;
          return studentParentEmail === parentEmail;
        });
        
        console.log(`   📚 Students with matching parentEmail: ${matchingStudents.length}`);
        
        if (matchingStudents.length === 0) {
          console.log('   ⚠️  No students found with matching parentEmail!');
          console.log('   Checking students in same school...');
          
          // Check if any students have same schoolId but different parentEmail
          const schoolStudents = students.filter(student => {
            const studentSchoolId = student.schoolId 
              ? (typeof student.schoolId === 'object' ? String(student.schoolId._id) : String(student.schoolId))
              : null;
            return studentSchoolId === parentSchoolId;
          });
          
          if (schoolStudents.length > 0) {
            console.log(`   Found ${schoolStudents.length} student(s) in same school with different parentEmail:`);
            schoolStudents.forEach(student => {
              console.log(`      - ${student.firstName} ${student.lastName}: parentEmail="${student.parentEmail}"`);
            });
          }
        } else {
          matchingStudents.forEach(student => {
            const studentSchoolId = student.schoolId 
              ? (typeof student.schoolId === 'object' ? String(student.schoolId._id) : String(student.schoolId))
              : null;
            
            if (studentSchoolId !== parentSchoolId) {
              console.log(`   ⚠️  MISMATCH: Student "${student.firstName} ${student.lastName}" has different schoolId!`);
              console.log(`      Student schoolId: ${studentSchoolId}`);
              console.log(`      Parent schoolId: ${parentSchoolId}`);
            } else {
              console.log(`   ✅ Student "${student.firstName} ${student.lastName}" is correctly configured`);
            }
          });
        }
      }
    }
    
    // Step 5: List all schools
    console.log('\n\n🏫 SCHOOLS:');
    const schools = await School.find()
      .select('name logo branding')
      .lean();
    
    if (schools.length === 0) {
      console.log('   ❌ No schools found in database!');
    } else {
      schools.forEach((school, index) => {
        console.log(`\n   ${index + 1}. ${school.name}`);
        console.log(`      ID: ${school._id}`);
        console.log(`      Logo: ${school.logo || school.branding?.logo || 'None'}`);
        console.log(`      Branding: ${school.branding ? 'Yes' : 'No'}`);
        if (school.branding) {
          console.log(`         Primary: ${school.branding.primaryColor || 'Not set'}`);
          console.log(`         Secondary: ${school.branding.secondaryColor || 'Not set'}`);
        }
      });
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('\n✅ Diagnostic complete!\n');

    await mongoose.connection.close();
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Error:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
};

// Main execution
(async () => {
  const connected = await connectDB();
  if (!connected) {
    console.error('❌ Failed to connect to database. Exiting.');
    process.exit(1);
  }

  await diagnoseIssues();
})();

