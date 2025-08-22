const mongoose = require('mongoose');
const User = require('./models/User');
const Class = require('./models/Class');
require('dotenv').config();

async function fixStudentClasses() {
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
    
    if (teacherClasses.length === 0) {
      console.log('❌ No classes assigned to teacher');
      return;
    }
    
    // Find parent users in the school
    const parentUsers = await User.find({ 
      schoolId: schoolId,
      role: 'parent'
    });
    
    console.log('👥 Parent users in school:', parentUsers.length);
    
    // Check current studentClass values
    const currentClasses = [...new Set(parentUsers.map(p => p.studentClass).filter(Boolean))];
    console.log('📋 Current studentClass values:', currentClasses);
    
    // Assign parent users to the teacher's classes
    const classNames = teacherClasses.map(c => c.name);
    console.log('📋 Target class names:', classNames);
    
    let updatedCount = 0;
    for (let i = 0; i < parentUsers.length; i++) {
      const parent = parentUsers[i];
      const targetClass = classNames[i % classNames.length]; // Distribute across classes
      
      if (parent.studentClass !== targetClass) {
        await User.findByIdAndUpdate(parent._id, {
          $set: { 
            studentClass: targetClass,
            assignedTeacher: teacherId // Also set assignedTeacher for the API
          }
        });
        updatedCount++;
        console.log(`✅ Updated ${parent.firstName} ${parent.lastName} to class: ${targetClass}`);
      }
    }
    
    console.log(`✅ Updated ${updatedCount} parent users`);
    
    // Verify the update
    const updatedParents = await User.find({ 
      schoolId: schoolId,
      role: 'parent',
      studentClass: { $in: classNames }
    });
    
    console.log('👥 Parent users now in teacher\'s classes:', updatedParents.length);
    
    // Test the teacher's students API logic
    const teacherStudents = await User.find({
      role: 'parent',
      studentClass: { $in: classNames },
      schoolId: schoolId
    });
    
    console.log('👥 Students found using API logic:', teacherStudents.length);
    
    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.disconnect();
  }
}

fixStudentClasses();
