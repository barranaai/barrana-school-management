const mongoose = require('mongoose');
const User = require('./models/User');
const School = require('./models/School');
require('dotenv').config();

async function testTeacherCreation() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    // Find "repub 2" school
    const school = await School.findOne({ name: 'repub 2' });
    
    if (!school) {
      console.log('❌ School "repub 2" not found');
      await mongoose.disconnect();
      return;
    }
    
    console.log('🏫 School "repub 2" found:');
    console.log('  ID:', school._id);
    console.log('  Name:', school.name);
    
    // Test teacher data
    const testTeacherData = {
      firstName: 'Test',
      lastName: 'Teacher',
      email: 'test.teacher@repub2.com',
      password: 'TestPass123',
      phone: '123-456-7890',
      grade: 'preschool',
      specialization: 'Early Childhood Education',
      qualifications: 'Bachelor in Education',
      bio: 'Experienced preschool teacher',
      hireDate: new Date(),
      subjects: [],
      schoolId: school._id,
      canEmailReports: true,
      isActive: true,
      isEmailVerified: false,
      role: 'teacher',
      avatar: 'TT'
    };
    
    console.log('\n📋 Test teacher data:');
    console.log(JSON.stringify(testTeacherData, null, 2));
    
    // Check if teacher already exists
    const existingTeacher = await User.findOne({ email: testTeacherData.email });
    if (existingTeacher) {
      console.log('\n⚠️ Teacher with this email already exists, deleting...');
      await User.findByIdAndDelete(existingTeacher._id);
    }
    
    // Create the teacher
    const teacher = new User(testTeacherData);
    await teacher.save();
    
    console.log('\n✅ Teacher created successfully!');
    console.log('  ID:', teacher._id);
    console.log('  Name:', teacher.firstName, teacher.lastName);
    console.log('  Email:', teacher.email);
    console.log('  SchoolId:', teacher.schoolId);
    console.log('  Created:', teacher.createdAt);
    
    // Verify the teacher was saved correctly
    const savedTeacher = await User.findById(teacher._id).select('-password');
    console.log('\n🔍 Verification - Saved teacher:');
    console.log('  Name:', savedTeacher.firstName, savedTeacher.lastName);
    console.log('  Email:', savedTeacher.email);
    console.log('  SchoolId:', savedTeacher.schoolId);
    console.log('  Role:', savedTeacher.role);
    
    // Check if teacher appears in school's teacher list
    const schoolTeachers = await User.find({ 
      role: 'teacher', 
      schoolId: school._id 
    }).select('-password');
    
    console.log(`\n👨‍🏫 Teachers for "repub 2" after creation (${schoolTeachers.length} found):`);
    schoolTeachers.forEach((t, index) => {
      console.log(`  ${index + 1}. ${t.firstName} ${t.lastName} (${t.email})`);
    });
    
    // Clean up - delete the test teacher
    await User.findByIdAndDelete(teacher._id);
    console.log('\n🧹 Test teacher deleted for cleanup');
    
    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');
    
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.disconnect();
  }
}

testTeacherCreation();
