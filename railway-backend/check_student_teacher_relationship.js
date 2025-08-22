const mongoose = require('mongoose');
const User = require('./models/User');
const Class = require('./models/Class');
const School = require('./models/School');
require('dotenv').config();

async function checkStudentTeacherRelationship() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    const teacherId = '689604bef58dff7d009df4ba';
    const schoolId = '68960451f58dff7d009df46e'; // Test School 10
    
    // Find the teacher
    const teacher = await User.findById(teacherId).populate('schoolId');
    if (!teacher) {
      console.log('❌ Teacher not found');
      return;
    }
    
    console.log('👨‍🏫 Teacher:', teacher.firstName, teacher.lastName, 'at', teacher.schoolId?.name);
    
    // Step 1: Find classes assigned to this teacher
    const teacherClasses = await Class.find({ 
      'assignedTeachers.teacherId': teacherId 
    });
    console.log('📚 Classes assigned to teacher:', teacherClasses.length);
    teacherClasses.forEach(c => {
      console.log('  -', c.name, '(ID:', c._id, ')');
    });
    
    if (teacherClasses.length === 0) {
      console.log('❌ No classes assigned to teacher');
      return;
    }
    
    // Step 2: Find students in these classes
    const classIds = teacherClasses.map(c => c._id);
    const studentsInClasses = await User.find({ 
      class: { $in: classIds }
    });
    console.log('👥 Students in teacher\'s classes:', studentsInClasses.length);
    
    if (studentsInClasses.length > 0) {
      console.log('📋 Sample students:');
      studentsInClasses.slice(0, 10).forEach(s => {
        console.log('  -', s.firstName, s.lastName, '(Class:', s.class, ', Role:', s.role, ')');
      });
    }
    
    // Step 3: Check what the backend API is actually looking for
    console.log('\n🔍 Backend API Logic:');
    console.log('The backend API looks for: role: "parent" AND assignedTeacher: teacherId');
    
    const parentStudents = await User.find({ 
      role: 'parent', 
      assignedTeacher: teacherId 
    });
    console.log('👥 Parent users with assignedTeacher = teacherId:', parentStudents.length);
    
    // Step 4: Check if there are any users with role 'student' in the classes
    const studentUsers = await User.find({ 
      role: 'student',
      class: { $in: classIds }
    });
    console.log('👥 Users with role "student" in teacher\'s classes:', studentUsers.length);
    
    // Step 5: Check all users in the classes regardless of role
    const allUsersInClasses = await User.find({ 
      class: { $in: classIds }
    });
    console.log('👥 All users in teacher\'s classes (any role):', allUsersInClasses.length);
    
    if (allUsersInClasses.length > 0) {
      console.log('📋 All users in classes:');
      allUsersInClasses.forEach(s => {
        console.log('  -', s.firstName, s.lastName, '(Role:', s.role, ', Class:', s.class, ')');
      });
    }
    
    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.disconnect();
  }
}

checkStudentTeacherRelationship();
