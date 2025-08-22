const mongoose = require('mongoose');
const User = require('./models/User');
const Class = require('./models/Class');
const School = require('./models/School');
const ReportTemplate = require('./models/ReportTemplate');
require('dotenv').config();

// Import the date utilities
const { getCurrentDateInTimezone, isReportDue, calculateDueDate } = require('./utils/dateUtils');

async function testCorrectedAPI() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    const teacherId = '689604bef58dff7d009df4ba';
    
    // Load teacher and school settings (simulating the API logic)
    const teacher = await User.findById(teacherId).select('schoolId grade notifications');
    const school = await School.findById(teacher.schoolId).select('settings name');
    
    console.log('👨‍🏫 Teacher:', teacher.firstName, teacher.lastName);
    console.log('🏫 School:', school.name);
    
    const settings = school.settings || {};
    const timezone = settings.timezone || 'UTC';
    const now = getCurrentDateInTimezone(timezone);
    
    console.log('⏰ Current time in school timezone:', now.format());
    
    // Test the corrected logic: Find students through classes
    const teacherClasses = await Class.find({
      'assignedTeachers.teacherId': teacher._id,
      isActive: true
    });
    
    console.log('📚 Teacher\'s assigned classes:', teacherClasses.length);
    teacherClasses.forEach(c => {
      console.log('  -', c.name);
    });
    
    if (teacherClasses.length === 0) {
      console.log('❌ No classes assigned to teacher');
      return;
    }
    
    // Get students from teacher's assigned classes
    const students = await User.find({
      role: 'parent', // Students are stored as 'parent' role
      studentClass: { $in: teacherClasses.map(cls => cls.name) },
      schoolId: teacher.schoolId,
      isActive: true
    }).select('firstName lastName studentGrade studentClass');
    
    console.log('👥 Students found using corrected logic:', students.length);
    students.forEach(s => {
      console.log('  -', s.firstName, s.lastName, '(Class:', s.studentClass, ', Grade:', s.studentGrade, ')');
    });
    
    if (students.length === 0) {
      console.log('❌ No students in teacher\'s classes');
      return;
    }
    
    // Find templates for this school
    const templates = await ReportTemplate.find({ schoolId: teacher.schoolId, isActive: true })
      .select('name reportFrequency grade');
    
    console.log('📋 Report templates found:', templates.length);
    templates.forEach(t => {
      console.log('  -', t.name, '(Frequency:', t.reportFrequency, ', Grade:', t.grade, ')');
    });
    
    // Test due report calculation for each student-template combination
    let dueReportsCount = 0;
    
    for (const student of students) {
      const studentName = `${student.firstName} ${student.lastName}`;
      
      // Filter templates by grade match if template has grade
      const applicableTemplates = templates.filter(t => 
        !t.grade || !student.studentGrade || (t.grade === student.studentGrade)
      );
      
      console.log(`\n📊 Checking ${studentName} (${applicableTemplates.length} applicable templates):`);
      
      for (const template of applicableTemplates) {
        const frequency = template.reportFrequency;
        const freqConfig = settings.reportFrequencies?.[frequency];
        
        if (!freqConfig || freqConfig.enabled === false) {
          console.log(`  ⏭️  ${template.name}: Frequency disabled`);
          continue;
        }
        
        // Check if report is due
        let isDue = false;
        let nextDue = null;
        
        try {
          isDue = isReportDue(frequency, settings, null, now.toDate());
          nextDue = calculateDueDate(frequency, settings, now);
          console.log(`  📅 ${template.name}: Due = ${isDue}, Next due = ${nextDue ? nextDue.format() : 'N/A'}`);
          
          if (isDue) {
            dueReportsCount++;
            console.log(`  ✅ DUE: ${template.name} for ${studentName}`);
          }
        } catch (e) {
          console.log(`  ❌ Error checking ${template.name}:`, e.message);
        }
      }
    }
    
    console.log(`\n📊 Summary: ${dueReportsCount} due reports found for ${students.length} students`);
    
    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.disconnect();
  }
}

testCorrectedAPI();
