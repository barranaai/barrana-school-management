const mongoose = require('mongoose');
const moment = require('moment-timezone');
require('dotenv').config();

// Simulate frontend calculation logic
const frontendCalculateDueDate = (frequency, schoolSettings, currentDate) => {
  console.log('🔍 Frontend calculateDueDateForFrequency called', {
    frequency,
    currentDate: currentDate.toISOString(),
    schoolSettings: schoolSettings
  });
  
  const now = currentDate;
  const frequencyConfig = schoolSettings.reportFrequencies?.[frequency];
  
  console.log('🔍 Frontend frequency config', {
    frequency,
    frequencyConfig,
    enabled: frequencyConfig?.enabled
  });
  
  if (frequencyConfig?.enabled) {
    let dueDate = new Date(now);
    
    switch (frequency) {
      case 'Daily':
        // Check if today is a working day
        const workingDays = frequencyConfig.workingDays || [1, 2, 3, 4, 5]; // Default to Mon-Fri
        const currentDayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
        const isWorkingDay = workingDays.includes(currentDayOfWeek);
        
        if (!isWorkingDay) {
          // Find the next working day
          let nextWorkingDay = new Date(now);
          do {
            nextWorkingDay.setDate(nextWorkingDay.getDate() + 1);
          } while (!workingDays.includes(nextWorkingDay.getDay()));
          dueDate = nextWorkingDay;
        } else {
          dueDate = new Date(now);
        }
        
        // Set the configured time
        const [dailyHours, dailyMinutes] = (frequencyConfig.dueTime || '17:00').split(':').map(Number);
        dueDate.setHours(dailyHours, dailyMinutes, 0, 0);
        dueDate.setMilliseconds(0);
        break;
      case 'Weekly':
        // Due on configured day of the week
        const targetDay = frequencyConfig.dueDay - 1; // Convert to 0-6
        const currentDay = now.getDay();
        const daysToAdd = (targetDay - currentDay + 7) % 7;
        
        dueDate = new Date(now);
        dueDate.setDate(now.getDate() + daysToAdd);
        const [weeklyHours, weeklyMinutes] = (frequencyConfig.dueTime || '17:00').split(':').map(Number);
        dueDate.setHours(weeklyHours, weeklyMinutes, 0, 0);
        
        // If the calculated due date has already passed, move to next week
        if (dueDate.getTime() <= now.getTime()) {
          dueDate.setDate(dueDate.getDate() + 7);
        }
        break;
      default:
        // Simplified for other frequencies
        dueDate = new Date(now);
        break;
    }
    
    return dueDate;
  }
  
  return new Date(now);
};

// Simulate backend calculation logic
const backendCalculateDueDate = (frequency, schoolSettings, baseDate = null) => {
  const timezone = schoolSettings.timezone || 'UTC';
  const currentDate = baseDate || moment().tz(timezone);
  const frequencyConfig = schoolSettings.reportFrequencies?.[frequency];
  
  if (!frequencyConfig || !frequencyConfig.enabled) {
    throw new Error(`Frequency ${frequency} is not enabled for this school`);
  }
  
  let dueDate = currentDate.clone();
  
  switch (frequency) {
    case 'Daily':
      // For daily reports, check if today is a working day
      const workingDays = frequencyConfig.workingDays || [1, 2, 3, 4, 5]; // Default to Mon-Fri
      const currentDayOfWeek = dueDate.day(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
      const isWorkingDay = workingDays.includes(currentDayOfWeek);
      
      if (!isWorkingDay) {
        // Find the next working day
        let nextWorkingDay = dueDate.clone();
        do {
          nextWorkingDay.add(1, 'day');
        } while (!workingDays.includes(nextWorkingDay.day()));
        dueDate = nextWorkingDay;
      }
      break;
      
    case 'Weekly':
      // Set to the configured day of the week
      const targetDay = frequencyConfig.dueDay - 1; // Convert to moment day (0-6)
      const currentDay = dueDate.day();
      const daysToAdd = (targetDay - currentDay + 7) % 7;
      dueDate.add(daysToAdd, 'days');
      break;
      
    default:
      // Simplified for other frequencies
      break;
  }
  
  // Set the configured time
  const [hours, minutes] = (frequencyConfig.dueTime || '17:00').split(':').map(Number);
  dueDate.hours(hours).minutes(minutes).seconds(0).milliseconds(0);
  
  return dueDate;
};

async function testFrontendBackendCalculationDiff() {
  try {
    console.log('🔍 Testing frontend vs backend calculation differences...');
    
    await mongoose.connect(process.env.MONGODB_URI);
    const School = require('./models/School');
    
    // Get school settings
    const school = await School.findById('68a4b0c04283c7f05947b15e');
    const schoolSettings = school.settings;
    
    console.log('🏫 School settings loaded:', {
      timezone: schoolSettings.timezone,
      reportFrequencies: Object.keys(schoolSettings.reportFrequencies)
    });
    
    // Test with current time
    const now = new Date();
    const nowMoment = moment().tz(schoolSettings.timezone);
    
    console.log('⏰ Current time:', {
      jsDate: now.toISOString(),
      momentDate: nowMoment.format(),
      timezone: schoolSettings.timezone
    });
    
    // Test Daily frequency
    console.log('\n📅 Testing Daily frequency:');
    
    const frontendDailyDue = frontendCalculateDueDate('Daily', schoolSettings, now);
    const backendDailyDue = backendCalculateDueDate('Daily', schoolSettings, nowMoment);
    
    console.log('Frontend Daily due date:', frontendDailyDue.toISOString());
    console.log('Backend Daily due date:', backendDailyDue.format());
    console.log('Difference (minutes):', Math.abs(frontendDailyDue.getTime() - backendDailyDue.valueOf()) / (1000 * 60));
    
    // Test Weekly frequency
    console.log('\n📅 Testing Weekly frequency:');
    
    const frontendWeeklyDue = frontendCalculateDueDate('Weekly', schoolSettings, now);
    const backendWeeklyDue = backendCalculateDueDate('Weekly', schoolSettings, nowMoment);
    
    console.log('Frontend Weekly due date:', frontendWeeklyDue.toISOString());
    console.log('Backend Weekly due date:', backendWeeklyDue.format());
    console.log('Difference (minutes):', Math.abs(frontendWeeklyDue.getTime() - backendWeeklyDue.valueOf()) / (1000 * 60));
    
    // Test if reports are due
    console.log('\n🔍 Testing if reports are due:');
    
    const frontendDailyDueTime = frontendDailyDue.getTime();
    const backendDailyDueTime = backendDailyDue.valueOf();
    const currentTime = now.getTime();
    
    console.log('Frontend Daily due check:', {
      currentTime: new Date(currentTime).toISOString(),
      dueTime: new Date(frontendDailyDueTime).toISOString(),
      isDue: currentTime > frontendDailyDueTime
    });
    
    console.log('Backend Daily due check:', {
      currentTime: nowMoment.format(),
      dueTime: backendDailyDue.format(),
      isDue: nowMoment.isAfter(backendDailyDue)
    });
    
    // Test with a specific time that should be due
    console.log('\n🔍 Testing with specific time (should be due):');
    
    const testTime = new Date('2025-08-20T15:00:00.000Z'); // 3 PM UTC
    const testMoment = moment(testTime).tz(schoolSettings.timezone);
    
    console.log('Test time:', {
      jsDate: testTime.toISOString(),
      momentDate: testMoment.format(),
      timezone: schoolSettings.timezone
    });
    
    const frontendTestDue = frontendCalculateDueDate('Daily', schoolSettings, testTime);
    const backendTestDue = backendCalculateDueDate('Daily', schoolSettings, testMoment);
    
    console.log('Frontend test due date:', frontendTestDue.toISOString());
    console.log('Backend test due date:', backendTestDue.format());
    
    const frontendTestDueTime = frontendTestDue.getTime();
    const backendTestDueTime = backendTestDue.valueOf();
    const testCurrentTime = testTime.getTime();
    
    console.log('Frontend test due check:', {
      currentTime: new Date(testCurrentTime).toISOString(),
      dueTime: new Date(frontendTestDueTime).toISOString(),
      isDue: testCurrentTime > frontendTestDueTime
    });
    
    console.log('Backend test due check:', {
      currentTime: testMoment.format(),
      dueTime: backendTestDue.format(),
      isDue: testMoment.isAfter(backendTestDue)
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
  }
}

testFrontendBackendCalculationDiff();
