const mongoose = require('mongoose');
const User = require('./models/User');
require('dotenv').config();

async function assignParentsToTeacher() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    const teacherId = '689604bef58dff7d009df4ba';
    const schoolId = '68960451f58dff7d009df46e'; // Test School 10
    
    // Find all parent users in Test School 10 without assignedTeacher
    const parentUsers = await User.find({ 
      schoolId: schoolId,
      role: 'parent',
      assignedTeacher: { $exists: false }
    });
    
    console.log('👥 Parent users without assignedTeacher:', parentUsers.length);
    
    if (parentUsers.length > 0) {
      // Assign them to the teacher
      const updateResult = await User.updateMany(
        { 
          schoolId: schoolId,
          role: 'parent',
          assignedTeacher: { $exists: false }
        },
        { 
          $set: { assignedTeacher: teacherId }
        }
      );
      
      console.log('✅ Updated', updateResult.modifiedCount, 'parent users');
      
      // Verify the update
      const assignedParents = await User.find({ 
        schoolId: schoolId,
        role: 'parent',
        assignedTeacher: teacherId
      });
      
      console.log('👥 Parent users now assigned to teacher:', assignedParents.length);
      
      if (assignedParents.length > 0) {
        console.log('📋 Sample assigned users:');
        assignedParents.slice(0, 5).forEach(p => {
          console.log('  -', p.firstName, p.lastName, '(assignedTeacher:', p.assignedTeacher, ')');
        });
      }
    }
    
    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.disconnect();
  }
}

assignParentsToTeacher();
