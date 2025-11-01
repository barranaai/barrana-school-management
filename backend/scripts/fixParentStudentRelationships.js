/**
 * Fix Parent-Student Relationships and School Branding
 * 
 * This script:
 * 1. Checks if students have parentEmail matching parent's email
 * 2. Ensures students have correct schoolId
 * 3. Ensures parents have correct schoolId
 * 4. Fixes mismatched relationships
 * 
 * Usage: node scripts/fixParentStudentRelationships.js [parentEmail]
 */

const mongoose = require('mongoose');
const User = require('../models/User');
const School = require('../models/School');
require('dotenv').config({ path: require('path').resolve(__dirname, '../config.env') });

const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI || process.env.MONGODB_URI_PROD || 'mongodb://localhost:27017/barrana_ai';
    console.log(`🔗 Connecting to MongoDB: ${mongoURI.substring(0, 30)}...`);
    
    await mongoose.connect(mongoURI, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    console.log(`✅ MongoDB Connected: ${mongoose.connection.host}`);
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    return false;
  }
};

const fixParentStudentRelationships = async (specificParentEmail = null) => {
  try {
    console.log('\n🔍 Diagnosing parent-student relationships...\n');

    // Step 1: Get all parents
    const parentQuery = { role: 'parent' };
    if (specificParentEmail) {
      parentQuery.email = specificParentEmail.toLowerCase();
    }
    
    const parents = await User.find(parentQuery);
    console.log(`📊 Found ${parents.length} parent(s) to check\n`);

    let fixedCount = 0;
    let errorCount = 0;

    for (const parent of parents) {
      console.log(`\n👤 Parent: ${parent.firstName} ${parent.lastName}`);
      console.log(`   Email: ${parent.email}`);
      console.log(`   School ID: ${parent.schoolId}`);
      
      // Check if parent has schoolId
      if (!parent.schoolId) {
        console.log('   ⚠️  WARNING: Parent has no schoolId!');
        
        // Try to find school by name or other means
        // For now, we'll skip this parent
        console.log('   ❌ Skipping - parent needs to be assigned to a school');
        errorCount++;
        continue;
      }

      // Step 2: Find students with matching parentEmail (case-insensitive)
      const studentQuery = {
        role: 'student',
        parentEmail: { $regex: new RegExp(`^${parent.email}$`, 'i') }
      };

      // Also check if schoolId matches
      const students = await User.find({
        role: 'student',
        $or: [
          { parentEmail: { $regex: new RegExp(`^${parent.email}$`, 'i') } },
          { parentId: parent._id }
        ]
      });

      console.log(`   📚 Found ${students.length} student(s) with matching parentEmail or parentId`);

      if (students.length === 0) {
        console.log('   ⚠️  No students found for this parent');
        continue;
      }

      // Step 3: Fix each student
      for (const student of students) {
        console.log(`   \n   👶 Student: ${student.firstName} ${student.lastName} (${student.studentId})`);
        
        let needsUpdate = false;
        const updates = {};

        // Check parentEmail match (case-insensitive)
        if (!student.parentEmail || student.parentEmail.toLowerCase() !== parent.email.toLowerCase()) {
          console.log(`      ⚠️  parentEmail mismatch: "${student.parentEmail}" != "${parent.email}"`);
          updates.parentEmail = parent.email.toLowerCase();
          needsUpdate = true;
        }

        // Check schoolId match
        const studentSchoolId = typeof student.schoolId === 'object' ? student.schoolId._id : student.schoolId;
        const parentSchoolId = typeof parent.schoolId === 'object' ? parent.schoolId._id : parent.schoolId;
        
        if (String(studentSchoolId) !== String(parentSchoolId)) {
          console.log(`      ⚠️  schoolId mismatch: "${studentSchoolId}" != "${parentSchoolId}"`);
          updates.schoolId = parentSchoolId;
          needsUpdate = true;
        }

        // Check parentId
        if (!student.parentId || String(student.parentId) !== String(parent._id)) {
          console.log(`      ⚠️  parentId missing or incorrect`);
          updates.parentId = parent._id;
          needsUpdate = true;
        }

        // Update if needed
        if (needsUpdate) {
          try {
            await User.findByIdAndUpdate(student._id, updates);
            console.log(`      ✅ Fixed student: Updated parentEmail, schoolId, and/or parentId`);
            fixedCount++;
          } catch (error) {
            console.log(`      ❌ Error updating student: ${error.message}`);
            errorCount++;
          }
        } else {
          console.log(`      ✅ Student is correctly configured`);
        }
      }

      // Step 4: Verify parent's schoolId
      const parentSchoolId = typeof parent.schoolId === 'object' ? parent.schoolId._id : parent.schoolId;
      const school = await School.findById(parentSchoolId);
      
      if (!school) {
        console.log(`   ⚠️  WARNING: Parent's schoolId (${parentSchoolId}) does not exist in School collection!`);
      } else {
        console.log(`   ✅ Parent's school exists: ${school.name}`);
      }
    }

    // Step 5: Summary
    console.log('\n\n📊 SUMMARY:');
    console.log(`   ✅ Fixed ${fixedCount} student(s)`);
    if (errorCount > 0) {
      console.log(`   ❌ ${errorCount} error(s) encountered`);
    }

    // Step 6: Test query
    console.log('\n🧪 Testing parent children query...\n');
    
    for (const parent of parents.slice(0, 3)) { // Test first 3 parents
      if (!parent.schoolId) continue;
      
      const parentSchoolId = typeof parent.schoolId === 'object' ? parent.schoolId._id : parent.schoolId;
      const children = await User.find({
        role: 'student',
        schoolId: parentSchoolId,
        parentEmail: parent.email
      });
      
      console.log(`   Parent: ${parent.email}`);
      console.log(`   Found ${children.length} child(ren) with correct query`);
    }

    await mongoose.connection.close();
    console.log('\n✅ Done!\n');
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

  const parentEmail = process.argv[2] || null;
  await fixParentStudentRelationships(parentEmail);
})();

