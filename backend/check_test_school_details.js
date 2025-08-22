const mongoose = require('mongoose');
const User = require('./models/User');
const Class = require('./models/Class');
const School = require('./models/School');
require('dotenv').config();

async function checkTestSchool10Details() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    // Find test school 10
    const school = await School.findOne({ name: { $regex: /test school 10/i } });
    if (!school) {
      console.log('❌ Test School 10 not found');
      return;
    }
    
    console.log('🏫 Test School 10:', school.name, '(ID:', school._id, ')');
    
    // Find classes in this school
    const classes = await Class.find({ schoolId: school._id }).populate('assignedTeachers.teacherId', 'firstName lastName');
    console.log('📚 Classes in Test School 10:', classes.length);
    classes.forEach(c => {
      const teacherNames = c.assignedTeachers.map(at => 
        at.teacherId ? at.teacherId.firstName + ' ' + at.teacherId.lastName : 'No Teacher'
      ).join(', ');
      console.log('  -', c.name, '(Teachers:', teacherNames, ')');
    });
    
    // Find teachers in this school
    const teachers = await User.find({ schoolId: school._id, role: 'teacher' });
    console.log('👨‍🏫 Teachers in Test School 10:', teachers.length);
    teachers.forEach(t => {
      console.log('  -', t.firstName, t.lastName, '(ID:', t._id, ')');
    });
    
    // Find students in this school
    const students = await User.find({ schoolId: school._id, role: 'student' });
    console.log('👥 Students in Test School 10:', students.length);
    students.forEach(s => {
      console.log('  -', s.firstName, s.lastName, '(ID:', s._id, ')');
    });
    
    // Check if there are students in other schools
    const allStudents = await User.find({ role: 'student' }).populate('schoolId', 'name');
    console.log('👥 Total students in database:', allStudents.length);
    
    const studentsBySchool = {};
    allStudents.forEach(s => {
      const schoolName = s.schoolId ? s.schoolId.name : 'No School';
      if (!studentsBySchool[schoolName]) {
        studentsBySchool[schoolName] = [];
      }
      studentsBySchool[schoolName].push(s);
    });
    
    Object.keys(studentsBySchool).forEach(schoolName => {
      console.log('  -', schoolName + ':', studentsBySchool[schoolName].length, 'students');
    });
    
    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.disconnect();
  }
}

checkTestSchool10Details();
