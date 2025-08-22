const mongoose = require('mongoose');
const User = require('./models/User');
require('dotenv').config();

async function checkParentUsers() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    const teacherId = '689604bef58dff7d009df4ba';
    const schoolId = '68960451f58dff7d009df46e'; // Test School 10
    
    // Find all parent users in Test School 10
    const parentUsers = await User.find({ 
      schoolId: schoolId,
      role: 'parent'
    });
    
    console.log('👥 Parent users in Test School 10:', parentUsers.length);
    
    // Check which ones have assignedTeacher set
    const withAssignedTeacher = parentUsers.filter(p => p.assignedTeacher);
    console.log('👥 Parent users with assignedTeacher:', withAssignedTeacher.length);
    
    // Check which ones are assigned to our specific teacher
    const assignedToTeacher = parentUsers.filter(p => p.assignedTeacher && p.assignedTeacher.toString() === teacherId);
    console.log('👥 Parent users assigned to test teacher 102:', assignedToTeacher.length);
    
    if (assignedToTeacher.length > 0) {
      console.log('📋 Sample assigned users:');
      assignedToTeacher.slice(0, 5).forEach(p => {
        console.log('  -', p.firstName, p.lastName, '(assignedTeacher:', p.assignedTeacher, ')');
      });
    }
    
    // Check users without assignedTeacher
    const withoutAssignedTeacher = parentUsers.filter(p => !p.assignedTeacher);
    console.log('👥 Parent users WITHOUT assignedTeacher:', withoutAssignedTeacher.length);
    
    if (withoutAssignedTeacher.length > 0) {
      console.log('📋 Sample unassigned users:');
      withoutAssignedTeacher.slice(0, 5).forEach(p => {
        console.log('  -', p.firstName, p.lastName, '(assignedTeacher:', p.assignedTeacher, ')');
      });
    }
    
    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.disconnect();
  }
}

checkParentUsers();
