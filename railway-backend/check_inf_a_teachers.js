const mongoose = require('mongoose');
require('dotenv').config();

async function checkInfATeachers() {
  try {
    console.log('🔍 Checking teachers assigned to Inf A class...');
    
    await mongoose.connect(process.env.MONGODB_URI);
    const Class = require('./models/Class');
    const User = require('./models/User');
    const School = require('./models/School');
    
    const schoolId = '68a4b0c04283c7f05947b15e'; // Republica of Hunululu
    
    // Find the Inf A class
    const infAClass = await Class.findOne({ 
      schoolId: schoolId, 
      name: 'Inf A' 
    }).populate('assignedTeachers.teacherId', 'firstName lastName email role');
    
    if (!infAClass) {
      console.log('❌ Inf A class not found');
      return;
    }
    
    console.log('📋 Inf A Class Details:', {
      classId: infAClass._id,
      className: infAClass.name,
      grade: infAClass.grade,
      totalAssignedTeachers: infAClass.assignedTeachers.length
    });
    
    console.log('\n👨‍🏫 Assigned Teachers:');
    
    if (infAClass.assignedTeachers.length === 0) {
      console.log('❌ No teachers assigned to Inf A class');
    } else {
      infAClass.assignedTeachers.forEach((assignment, index) => {
        const teacher = assignment.teacherId;
        console.log(`${index + 1}. Teacher:`, {
          teacherId: teacher._id,
          name: `${teacher.firstName} ${teacher.lastName}`,
          email: teacher.email,
          role: teacher.role,
          assignmentDate: assignment.assignedDate,
          isActive: assignment.isActive
        });
      });
    }
    
    // Also check all teachers in the school to see who could potentially be assigned
    const allTeachers = await User.find({ 
      schoolId: schoolId, 
      role: 'teacher' 
    });
    
    console.log('\n📊 School Teacher Summary:');
    console.log(`Total teachers in school: ${allTeachers.length}`);
    console.log(`Teachers assigned to Inf A: ${infAClass.assignedTeachers.length}`);
    console.log(`Available teachers for assignment: ${allTeachers.length - infAClass.assignedTeachers.length}`);
    
    // Check if any teachers are not assigned to any class
    const assignedTeacherIds = infAClass.assignedTeachers.map(at => at.teacherId._id.toString());
    const unassignedTeachers = allTeachers.filter(teacher => !assignedTeacherIds.includes(teacher._id.toString()));
    
    if (unassignedTeachers.length > 0) {
      console.log('\n👨‍🏫 Unassigned Teachers (could be assigned to Inf A):');
      unassignedTeachers.forEach((teacher, index) => {
        console.log(`${index + 1}. ${teacher.firstName} ${teacher.lastName} (${teacher.email})`);
      });
    }
    
    // Check students in Inf A class
    const studentsInInfA = await User.find({ 
      schoolId: schoolId, 
      role: 'parent',
      studentClass: 'Inf A'
    });
    
    console.log('\n👥 Students in Inf A Class:');
    console.log(`Total students: ${studentsInInfA.length}`);
    
    if (studentsInInfA.length > 0) {
      studentsInInfA.forEach((student, index) => {
        console.log(`${index + 1}. ${student.firstName} ${student.lastName} (${student.email})`);
      });
    }
    
    // Summary
    console.log('\n📋 SUMMARY:');
    console.log(`✅ Inf A class exists with ${infAClass.assignedTeachers.length} assigned teachers`);
    console.log(`✅ ${studentsInInfA.length} students are in Inf A class`);
    console.log(`✅ ${infAClass.assignedTeachers.length} teachers can generate reports for these students`);
    
    if (infAClass.assignedTeachers.length === 0) {
      console.log('⚠️  WARNING: No teachers are assigned to Inf A class!');
      console.log('💡 You need to assign at least one teacher to generate reports.');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
  }
}

checkInfATeachers();
