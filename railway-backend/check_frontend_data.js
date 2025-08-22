const mongoose = require('mongoose');
const User = require('./models/User');
const Class = require('./models/Class');
const School = require('./models/School');
require('dotenv').config();

async function checkFrontendData() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    const teacherId = '689604bef58dff7d009df4ba';
    
    // Check what the frontend might be loading
    console.log('🔍 Checking different ways to find students...');
    
    // Method 1: Students with role 'student' in teacher's school
    const teacher = await User.findById(teacherId).populate('schoolId');
    if (teacher) {
      console.log('👨‍🏫 Teacher:', teacher.firstName, teacher.lastName, 'at', teacher.schoolId?.name);
      
      const studentsInSchool = await User.find({ 
        schoolId: teacher.schoolId._id, 
        role: 'student' 
      });
      console.log('👥 Students in teacher\'s school (role: student):', studentsInSchool.length);
      
      // Method 2: Students with role 'parent' assigned to teacher
      const parentStudents = await User.find({ 
        role: 'parent', 
        assignedTeacher: teacherId 
      });
      console.log('👥 Students assigned to teacher (role: parent):', parentStudents.length);
      
      // Method 3: Students in teacher's classes
      const teacherClasses = await Class.find({ 
        'assignedTeachers.teacherId': teacherId 
      });
      console.log('📚 Classes assigned to teacher:', teacherClasses.length);
      
      const classIds = teacherClasses.map(c => c._id);
      const studentsInClasses = await User.find({ 
        role: 'student',
        class: { $in: classIds }
      });
      console.log('👥 Students in teacher\'s classes:', studentsInClasses.length);
      
      // Method 4: All users with 'student' in their name or email
      const allStudents = await User.find({ 
        $or: [
          { firstName: { $regex: /student/i } },
          { lastName: { $regex: /student/i } },
          { email: { $regex: /student/i } }
        ]
      });
      console.log('👥 All users with "student" in name/email:', allStudents.length);
      
      if (allStudents.length > 0) {
        console.log('📋 Sample students found:');
        allStudents.slice(0, 5).forEach(s => {
          console.log('  -', s.firstName, s.lastName, '(Role:', s.role, ', School:', s.schoolId, ')');
        });
      }
      
      // Method 5: Check if there are any users with 'infant' in their name/email
      const infantUsers = await User.find({ 
        $or: [
          { firstName: { $regex: /infant/i } },
          { lastName: { $regex: /infant/i } },
          { email: { $regex: /infant/i } }
        ]
      });
      console.log('👥 All users with "infant" in name/email:', infantUsers.length);
      
      if (infantUsers.length > 0) {
        console.log('📋 Sample infant users found:');
        infantUsers.slice(0, 5).forEach(s => {
          console.log('  -', s.firstName, s.lastName, '(Role:', s.role, ', School:', s.schoolId, ')');
        });
      }
    }
    
    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.disconnect();
  }
}

checkFrontendData();
