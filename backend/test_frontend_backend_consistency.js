const mongoose = require('mongoose');
const User = require('./models/User');
const Class = require('./models/Class');
const ReportTemplate = require('./models/ReportTemplate');
const { getCurrentDateInTimezone, isReportDue, calculateDueDate } = require('./utils/dateUtils');
require('dotenv').config();

async function testFrontendBackendConsistency() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    const teacherId = '689604bef58dff7d009df4ba';
    
    // Find the teacher and school
    const teacher = await User.findById(teacherId);
    const School = require('./models/School');
    const school = await School.findById(teacher.schoolId).select('settings');
    
    console.log('👨‍🏫 Teacher:', teacher.firstName, teacher.lastName);
    console.log('🏫 School:', school.name);
    
    // Get current time
    const now = getCurrentDateInTimezone('UTC');
    console.log('⏰ Current time (UTC):', now.format());
    
    // Find teacher's classes
    const teacherClasses = await Class.find({
      'assignedTeachers.teacherId': teacherId,
      isActive: true
    });
    
    // Find students in teacher's classes
    const students = await User.find({
      role: 'parent',
      studentClass: { $in: teacherClasses.map(cls => cls.name) },
      schoolId: teacher.schoolId
    });
    
    // Find report templates
    const templates = await ReportTemplate.find({
      schoolId: teacher.schoolId,
      isActive: true
    });
    
    console.log(`📊 Found ${students.length} students and ${templates.length} templates`);
    
    // Test each student-template combination
    let totalDueReports = 0;
    
    for (const student of students.slice(0, 3)) { // Test first 3 students
      console.log(`\n👤 Testing student: ${student.firstName} ${student.lastName} (${student.studentClass})`);
      
      for (const template of templates) {
        console.log(`  📋 Template: ${template.name} (${template.reportFrequency})`);
        
        // Backend logic (what the API would return)
        const settings = school.settings || {};
        const frequency = template.reportFrequency;
        const frequencyConfig = settings.reportFrequencies?.[frequency];
        
        if (!frequencyConfig || !frequencyConfig.enabled) {
          console.log(`    ❌ Backend: Frequency ${frequency} not enabled`);
          continue;
        }
        
        // Check if student is in teacher's classes (backend verification)
        const studentInClass = await User.findOne({
          _id: student._id,
          role: 'parent',
          studentClass: { $in: teacherClasses.map(cls => cls.name) },
          schoolId: teacher.schoolId
        });
        
        if (!studentInClass) {
          console.log(`    ❌ Backend: Student not in teacher's classes`);
          continue;
        }
        
        // Check due status (backend logic)
        const Report = require('./models/Report');
        const lastReport = await Report.findOne({
          schoolId: teacher.schoolId,
          studentId: student._id,
          templateId: template._id
        }).sort({ createdAt: -1 });
        
        const lastReportDate = lastReport ? lastReport.createdAt : null;
        const due = isReportDue(frequency, settings, lastReportDate, now.toDate());
        const nextDue = calculateDueDate(frequency, settings, now);
        
        console.log(`    📅 Backend due status: ${due ? 'DUE' : 'NOT DUE'}`);
        console.log(`    📅 Next due: ${nextDue ? nextDue.format() : 'N/A'}`);
        
        if (due) {
          totalDueReports++;
        }
        
        // Simulate frontend logic (simplified)
        const dueTime = frequencyConfig.dueTime || '17:00';
        const [hours, minutes] = dueTime.split(':').map(Number);
        const todayDueDate = now.clone().hours(hours).minutes(minutes).seconds(0).milliseconds(0);
        const frontendDue = now.isAfter(todayDueDate);
        
        console.log(`    🖥️  Frontend due status: ${frontendDue ? 'DUE' : 'NOT DUE'}`);
        console.log(`    🖥️  Due time: ${todayDueDate.format()}`);
        
        if (due !== frontendDue) {
          console.log(`    ⚠️  MISMATCH: Backend=${due}, Frontend=${frontendDue}`);
        }
      }
    }
    
    console.log(`\n📊 Summary: ${totalDueReports} reports due according to backend logic`);
    
    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.disconnect();
  }
}

testFrontendBackendConsistency();
