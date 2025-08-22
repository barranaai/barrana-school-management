const mongoose = require('mongoose');
const User = require('./models/User');
require('dotenv').config();

async function revertManualChanges() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    const schoolId = '68960451f58dff7d009df46e'; // Test School 10
    
    // Revert the manual changes I made
    console.log('🔄 Reverting manual database changes...');
    
    // Remove assignedTeacher field from parent users
    const updateResult = await User.updateMany(
      { 
        schoolId: schoolId,
        role: 'parent'
      },
      { 
        $unset: { assignedTeacher: 1 }
      }
    );
    
    console.log('✅ Removed assignedTeacher from', updateResult.modifiedCount, 'parent users');
    
    // Reset studentClass to original values (if needed)
    // This would depend on what the original values were
    
    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');
    
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.disconnect();
  }
}

revertManualChanges();
