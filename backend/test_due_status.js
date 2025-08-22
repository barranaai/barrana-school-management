const mongoose = require('mongoose');
const { calculateDueDate, isReportDue, getCurrentDateInTimezone } = require('./utils/dateUtils');
const logger = require('./utils/logger');

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/barrana_ai', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

async function testDueStatus() {
  try {
    logger.info('🧪 Starting due status test for Republica of Hunululu');
    
    // Get the specific school
    const School = require('./models/School');
    const school = await School.findOne({name: /Hunululu/i}).select('settings');
    
    if (!school) {
      logger.error('❌ Republica of Hunululu school not found');
      return;
    }
    
    logger.info('🏫 School found', {
      schoolId: school._id,
      schoolName: 'Republica of Hunululu',
      timezone: school.settings?.timezone,
      settings: school.settings
    });
    
    // Test with different frequencies
    const frequencies = ['Daily', 'Weekly', 'Monthly'];
    const timezone = school.settings?.timezone || 'UTC';
    const now = getCurrentDateInTimezone(timezone);
    
    logger.info('⏰ Current time', {
      timezone,
      now: now.format(),
      nowLocal: now.local().format()
    });
    
    for (const frequency of frequencies) {
      logger.info(`🔍 Testing frequency: ${frequency}`);
      
      try {
        const dueDateResult = calculateDueDate(frequency, school.settings, now);
        logger.info(`✅ Due date calculated for ${frequency}`, {
          dueDate: dueDateResult.dueDate.format(),
          dueDateLocal: dueDateResult.dueDate.local().format(),
          timezone: dueDateResult.timezone
        });
        
        // Test isReportDue with no last report
        const isDue = isReportDue(frequency, school.settings, null, now.toDate());
        logger.info(`📋 Is report due for ${frequency} (no last report)`, {
          isDue,
          nowAfterDue: now.isAfter(dueDateResult.dueDate)
        });
        
      } catch (error) {
        logger.error(`❌ Error testing ${frequency}`, {
          error: error.message
        });
      }
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

testDueStatus();
