// Simulate frontend calculation
const moment = require('moment-timezone');

// School settings from the database
const schoolSettings = {
  timezone: "Asia/Karachi",
  reportFrequencies: {
    "Daily": {
      "enabled": true,
      "dueDay": 1,
      "dueTime": "17:00",
      "skipWeekends": true,
      "skipHolidays": true
    }
  }
};

console.log('🧪 Testing Frontend vs Backend Daily calculation');

// Current time
const now = new Date();
console.log('Current time (local):', now.toString());
console.log('Current time (UTC):', now.toISOString());

// Frontend calculation (simulated)
const frequencyConfig = schoolSettings.reportFrequencies.Daily;
const [dailyHours, dailyMinutes] = (frequencyConfig.dueTime || '17:00').split(':').map(Number);

// Create a new date object for today at the specified time
const frontendDueDate = new Date(now);
frontendDueDate.setHours(dailyHours, dailyMinutes, 0, 0);
frontendDueDate.setMilliseconds(0);

console.log('Frontend calculation:');
console.log('  - Due time:', frequencyConfig.dueTime);
console.log('  - Hours:', dailyHours, 'Minutes:', dailyMinutes);
console.log('  - Due date (local):', frontendDueDate.toString());
console.log('  - Due date (UTC):', frontendDueDate.toISOString());

// Backend calculation (using moment-timezone)
const backendNow = moment().tz(schoolSettings.timezone);
const backendDueDate = moment().tz(schoolSettings.timezone);
backendDueDate.hours(dailyHours).minutes(dailyMinutes).seconds(0).milliseconds(0);

console.log('\nBackend calculation:');
console.log('  - Timezone:', schoolSettings.timezone);
console.log('  - Current time (school tz):', backendNow.format());
console.log('  - Due date (school tz):', backendDueDate.format());
console.log('  - Due date (UTC):', backendDueDate.toISOString());

// Comparison
console.log('\nComparison:');
console.log('  - Frontend due date (local):', frontendDueDate.toString());
console.log('  - Backend due date (UTC):', backendDueDate.toISOString());
console.log('  - Frontend due date (UTC):', frontendDueDate.toISOString());

// Check if overdue
const frontendIsOverdue = now.getTime() > frontendDueDate.getTime();
const backendIsOverdue = backendNow.isAfter(backendDueDate);

console.log('\nOverdue check:');
console.log('  - Frontend is overdue:', frontendIsOverdue);
console.log('  - Backend is overdue:', backendIsOverdue);
console.log('  - Current time > Frontend due date:', now.getTime() > frontendDueDate.getTime());
console.log('  - Current time > Backend due date:', now.getTime() > new Date(backendDueDate.toISOString()).getTime());
