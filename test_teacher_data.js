const mongoose = require('mongoose');
require('./models/User');
const Class = require('./models/Class');

mongoose.connect('mongodb://localhost:27017/barrana_ai').then(async () => {
  try {
    const User = mongoose.model('User');
    
    // Get teacher
    const teacher = await User.findOne({ email: 'tt3@gmail.com' });
    console.log('Teacher found:', {
      id: teacher._id.toString(),
      email: teacher.email,
      name: teacher.firstName + ' ' + teacher.lastName
    });

    // Get classes
    const classes = await Class.find({ schoolId: '688e193fe99006e9e719270d' })
      .populate('assignedTeachers.teacherId', 'firstName lastName email');
    
    console.log('\nClasses with teacher assignments:');
    classes.forEach(cls => {
      const teacherAssignment = cls.assignedTeachers.find(t => 
        t.teacherId.email === 'tt3@gmail.com'
      );
      if (teacherAssignment) {
        console.log(`✅ ${cls.name} - ${teacherAssignment.teacherId.firstName} ${teacherAssignment.teacherId.lastName} (${teacherAssignment.role})`);
      }
    });

    // Get students in Pre School A
    const students = await User.find({ 
      role: 'parent', 
      schoolId: '688e193fe99006e9e719270d',
      studentClass: 'Pre School A'
    }).select('firstName lastName name studentClass studentGrade');

    console.log('\nStudents in Pre School A:');
    students.forEach(student => {
      console.log(`- ${student.name || student.firstName + ' ' + student.lastName} (Class: ${student.studentClass}, Grade: ${student.studentGrade})`);
    });

    console.log(`\nTotal students in Pre School A: ${students.length}`);

    // Test the filtering logic
    const teacherAssignedClasses = classes.filter(cls => 
      cls.assignedTeachers.some(assignment => 
        assignment.teacherId.email === 'tt3@gmail.com'
      )
    );

    console.log('\nTeacher assigned classes:', teacherAssignedClasses.map(c => c.name));

    const teacherStudents = students.filter(student => 
      teacherAssignedClasses.some(cls => cls.name === student.studentClass)
    );

    console.log('\nFiltered students for teacher:', teacherStudents.length);
    teacherStudents.forEach(student => {
      console.log(`- ${student.name || student.firstName + ' ' + student.lastName}`);
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    mongoose.connection.close();
  }
}); 