const mongoose = require('mongoose');
const User = require('./models/User');
const Class = require('./models/Class');
const ReportTemplate = require('./models/ReportTemplate');
require('dotenv').config();

async function testDueStatusEndpoint() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    const teacherId = '689604bef58dff7d009df4ba';
    
    // Find the teacher
    const teacher = await User.findById(teacherId);
    console.log('👨‍🏫 Teacher:', teacher.firstName, teacher.lastName);
    
    // Find teacher's classes
    const teacherClasses = await Class.find({
      'assignedTeachers.teacherId': teacherId,
      isActive: true
    });
    console.log('📚 Teacher\'s classes:', teacherClasses.map(c => c.name));
    
    // Find students in teacher's classes
    const students = await User.find({
      role: 'parent',
      studentClass: { $in: teacherClasses.map(cls => cls.name) },
      schoolId: teacher.schoolId
    });
    console.log('👥 Students in teacher\'s classes:', students.length);
    
    // Find report templates
    const templates = await ReportTemplate.find({
      schoolId: teacher.schoolId,
      isActive: true
    });
    console.log('📋 Report templates:', templates.map(t => ({ name: t.name, frequency: t.reportFrequency, grade: t.grade })));
    
    if (students.length === 0 || templates.length === 0) {
      console.log('❌ No students or templates found');
      return;
    }
    
    // Test the due status logic for first student and template
    const student = students[0];
    const template = templates[0];
    
    console.log('\n🧪 Testing due status for:');
    console.log('  Student:', student.firstName, student.lastName, '(Class:', student.studentClass, ')');
    console.log('  Template:', template.name, '(Frequency:', template.reportFrequency, ', Grade:', template.grade, ')');
    
    // Simulate the due status check logic
    const School = require('./models/School');
    const { getCurrentDateInTimezone, isReportDue, calculateDueDate } = require('./utils/dateUtils');
    
    const school = await School.findById(teacher.schoolId).select('settings');
    const settings = school.settings || {};
    const frequency = template.reportFrequency;
    const timezone = settings.timezone || 'UTC';
    const now = getCurrentDateInTimezone(timezone);
    
    console.log('⏰ Current time in school timezone:', now.format());
    console.log('🏫 School settings:', JSON.stringify(settings.reportFrequencies?.[frequency], null, 2));
    
    // Check if student is in teacher's classes (the new logic)
    const studentInClass = await User.findOne({
      _id: student._id,
      role: 'parent',
      studentClass: { $in: teacherClasses.map(cls => cls.name) },
      schoolId: teacher.schoolId
    });
    
    console.log('✅ Student found in teacher\'s classes:', !!studentInClass);
    
    // Check due status
    const Report = require('./models/Report');
    const lastReport = await Report.findOne({
      schoolId: teacher.schoolId,
      studentId: student._id,
      templateId: template._id
    }).sort({ createdAt: -1 });
    
    const lastReportDate = lastReport ? lastReport.createdAt : null;
    console.log('📄 Last report date:', lastReportDate);
    
    const due = isReportDue(frequency, settings, lastReportDate, now.toDate());
    const nextDue = calculateDueDate(frequency, settings, now);
    
    console.log('📅 Due status:', {
      due,
      nextDueDate: nextDue ? nextDue.format() : null,
      lastReportDate,
      timezone,
      frequency
    });
    
    await mongoose.disconnect();
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.disconnect();
  }
}

testDueStatusEndpoint();
