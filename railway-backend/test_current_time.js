const { getCurrentDateInTimezone } = require('./utils/dateUtils');

function testCurrentTime() {
  console.log('🕐 Testing current time vs due time...');
  
  const now = getCurrentDateInTimezone('UTC');
  console.log('⏰ Current time (UTC):', now.format());
  
  // Test Daily report due time (5:00 PM)
  const dueTime = '17:00';
  const [hours, minutes] = dueTime.split(':').map(Number);
  
  const todayDueDate = now.clone().hours(hours).minutes(minutes).seconds(0).milliseconds(0);
  console.log('📅 Today\'s due time (5:00 PM):', todayDueDate.format());
  
  const isDue = now.isAfter(todayDueDate);
  console.log('✅ Is currently due?', isDue);
  
  if (!isDue) {
    const hoursUntilDue = todayDueDate.diff(now, 'hours', true);
    console.log('⏳ Hours until due:', hoursUntilDue.toFixed(2));
  }
}

testCurrentTime();
