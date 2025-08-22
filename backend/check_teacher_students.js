const mongoose = require('mongoose');
const User = require('./models/User');
const Class = require('./models/Class');
const School = require('./models/School');
require('dotenv').config();

async function checkTeacherStudents() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    const teacherId = '689604bef58dff7d009df4ba';
    
    // Find the teacher
    const teacher = await User.findById(teacherId).populate('schoolId');
    if (!teacher) {
      console.log('❌ Teacher not found');
      return;
    }
    
    console.log('👨‍🏫 Teacher:', teacher.firstName, teacher.lastName);
    console.log('🏫 School:', teacher.schoolId ? teacher.schoolId.name : 'No school assigned');
    
    // Find classes assigned to this teacher
    const classes = await Class.find({ 
      teacherId: teacherId 
    }).populate('schoolId', 'name');
    
    console.log('📚 Classes assigned to teacher:', classes.length);
    classes.forEach(c => {
      console.log('  -', c.name, 'at', c.schoolId ? c.schoolId.name : 'Unknown School');
    });
    
    // Find students in these classes
    const classIds = classes.map(c => c._id);
    const students = await User.find({ 
      role: 'student',
      class: { $in: classIds }
    }).populate('class', 'name').populate('schoolId', 'name');
    
    console.log('👥 Students in teacher\'s classes:', students.length);
    students.forEach(s => {
      console.log('  -', s.firstName, s.lastName, 'in', s.class ? s.class.name : 'No Class', 'at', s.schoolId ? s.schoolId.name : 'Unknown School');
    });
    
    // If no students, let's create some test students
    if (students.length === 0) {
      console.log('⚠️  No students found. Creating test students...');
      
      if (classes.length === 0) {
        console.log('❌ No classes found. Cannot create students without classes.');
        return;
      }
      
      const testStudents = [
        { firstName: 'Alice', lastName: 'Johnson', grade: 'Grade 3' },
        { firstName: 'Bob', lastName: 'Smith', grade: 'Grade 3' },
        { firstName: 'Charlie', lastName: 'Brown', grade: 'Grade 4' },
        { firstName: 'Diana', lastName: 'Wilson', grade: 'Grade 4' }
      ];
      
      for (let i = 0; i < testStudents.length; i++) {
        const studentData = testStudents[i];
        const classIndex = i % classes.length;
        const assignedClass = classes[classIndex];
        
        const newStudent = new User({
          firstName: studentData.firstName,
          lastName: studentData.lastName,
          email: `${studentData.firstName.toLowerCase()}.${studentData.lastName.toLowerCase()}@test.com`,
          password: 'password123',
          role: 'student',
          schoolId: teacher.schoolId._id,
          class: assignedClass._id,
          grade: studentData.grade,
          parentEmail: `parent.${studentData.firstName.toLowerCase()}@test.com`,
          isActive: true
        });
        
        await newStudent.save();
        console.log('✅ Created student:', studentData.firstName, studentData.lastName, 'in', assignedClass.name);
      }
      
      console.log('✅ Created', testStudents.length, 'test students');
    }
    
    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.disconnect();
  }
}

checkTeacherStudents();
