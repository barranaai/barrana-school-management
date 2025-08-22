const mongoose = require('mongoose');
const { calculateDueDate, isReportDue, getCurrentDateInTimezone } = require('./utils/dateUtils');
const logger = require('./utils/logger');

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/barrana_ai', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

async function testApiDueStatus() {
  try {
    logger.info('🧪 Testing API due-status endpoint logic');
    
    // Get the specific school and data
    const School = require('./models/School');
    const ReportTemplate = require('./models/ReportTemplate');
    const User = require('./models/User');
    const Report = require('./models/Report');
    
    const school = await School.findOne({name: /Hunululu/i}).select('settings');
    const student = await User.findOne({schoolId: school._id, role: 'parent'}).select('_id firstName lastName grade');
    const template = await ReportTemplate.findOne({schoolId: school._id, grade: 'Infant', isActive: true}).select('_id name reportFrequency');
    
    logger.info('📋 Test data', {
      schoolName: 'Republica of Hunululu',
      student: student.firstName + ' ' + student.lastName,
      template: template.name,
      frequency: template.reportFrequency
    });
    
    // Simulate the exact logic from the due-status API endpoint
    const settings = school.settings || {};
    const frequency = template.reportFrequency;
    const timezone = settings.timezone || 'UTC';
    const now = getCurrentDateInTimezone(timezone);

    logger.info('📅 API calculation parameters', {
      studentId: student._id,
      templateId: template._id,
      frequency,
      timezone,
      now: now.format(),
      settings: settings.reportFrequencies?.[frequency]
    });

    const lastReport = await Report.findOne({
      schoolId: school._id,
      studentId: student._id,
      templateId: template._id
    }).sort({ createdAt: -1 });

    const lastReportDate = lastReport ? lastReport.createdAt : null;
    
    logger.info('📋 Last report found', {
      lastReportId: lastReport?._id,
      lastReportDate: lastReportDate ? moment(lastReportDate).format() : 'null',
      lastReportStatus: lastReport?.status
    });
    
    const due = isReportDue(frequency, settings, lastReportDate, now.toDate());
    const nextDueResult = calculateDueDate(frequency, settings, now);
    const nextDue = nextDueResult.dueDate;

    logger.info('✅ API due status result', {
      studentId: student._id,
      templateId: template._id,
      frequency,
      due,
      nextDueDate: nextDue ? nextDue.format() : 'null',
      lastReportDate: lastReportDate ? moment(lastReportDate).format() : 'null',
      timezone
    });

    // Compare with frontend calculation
    logger.info('🔍 Comparing with frontend calculation');
    
    // Simulate frontend calculation
    const frontendNow = new Date();
    const frontendSettings = school.settings;
    const frontendFrequencyConfig = frontendSettings.reportFrequencies?.[frequency];
    
    if (frontendFrequencyConfig?.enabled) {
      let frontendDueDate = new Date(frontendNow);
      
      if (frequency === 'Daily') {
        const [hours, minutes] = (frontendFrequencyConfig.dueTime || '17:00').split(':').map(Number);
        frontendDueDate = new Date(frontendNow);
        frontendDueDate.setHours(hours, minutes, 0, 0);
        frontendDueDate.setMilliseconds(0);
      }
      
      const frontendIsOverdue = frontendNow.getTime() > frontendDueDate.getTime();
      
      logger.info('🔍 Frontend vs Backend comparison', {
        frontendNow: frontendNow.toString(),
        frontendDueDate: frontendDueDate.toString(),
        frontendIsOverdue,
        backendDue: due,
        backendNextDue: nextDue ? nextDue.format() : 'null',
        match: frontendIsOverdue === due
      });
    }
    
  } catch (error) {
    logger.error('❌ Test failed', {
      error: error.message
    });
  } finally {
    await mongoose.disconnect();
    logger.info('✅ Test completed');
  }
}

testApiDueStatus();
