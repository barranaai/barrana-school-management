const mongoose = require('mongoose');
const User = require('./models/User');
const Class = require('./models/Class');
require('dotenv').config();

async function checkCurrentState() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    const teacherId = '689604bef58dff7d009df4ba';
    const schoolId = '68960451f58dff7d009df46e'; // Test School 10
    
    // Find the teacher's assigned classes
    const teacherClasses = await Class.find({ 
      'assignedTeachers.teacherId': teacherId 
    });
    
    console.log('📚 Teacher\'s assigned classes:', teacherClasses.length);
    teacherClasses.forEach(c => {
      console.log('  -', c.name, '(ID:', c._id, ')');
    });
    
    // Find parent users in the school
    const parentUsers = await User.find({ 
      schoolId: schoolId,
      role: 'parent'
    });
    
    console.log('👥 Parent users in school:', parentUsers.length);
    
    // Check current studentClass values
    const currentClasses = [...new Set(parentUsers.map(p => p.studentClass).filter(Boolean))];
    console.log('📋 Current studentClass values:', currentClasses);
    
    // Check if any parent users have assignedTeacher
    const parentsWithTeacher = await User.find({ 
      schoolId: schoolId,
      role: 'parent',
      assignedTeacher: { $exists: true }
    });
    console.log('👥 Parent users with assignedTeacher:', parentsWithTeacher.length);
    
    // Test the corrected backend logic
    const classNames = teacherClasses.map(c => c.name);
    const studentsByClass = await User.find({
      role: 'parent',
      studentClass: { $in: classNames },
      schoolId: schoolId
    });
    
    console.log('👥 Students found using corrected backend logic:', studentsByClass.length);
    
    // Test the old backend logic (assignedTeacher)
    const studentsByTeacher = await User.find({
      role: 'parent',
      assignedTeacher: teacherId,
      schoolId: schoolId
    });
    
    console.log('👥 Students found using old backend logic (assignedTeacher):', studentsByTeacher.length);
    
    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.disconnect();
  }
}

checkCurrentState();
