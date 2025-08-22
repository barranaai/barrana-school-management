// Simulate the exact frontend logic for calculating due reports
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
    },
    "Weekly": {
      "enabled": true,
      "dueDay": 3,
      "dueTime": "00:00",
      "skipWeekends": true,
      "skipHolidays": true
    }
  }
};

// Simulate frontend data
const students = [
  { _id: '68a4c8eb10d4f62e24396546', name: 'sfdsfgdsg dfsgdfgdfg', grade: 'Infant' },
  { _id: '68a4c8fb10d4f62e24396561', name: 'asfdaadsf sdf', grade: 'Infant' },
  { _id: '68a4c91210d4f62e2439657f', name: 'fwwfwef sadfsadf', grade: 'Infant' },
  { _id: '68a4c99010d4f62e243965a6', name: 'sdfsd fsdf', grade: 'Infant' },
  { _id: '68a4c9e510d4f62e243965ca', name: 'wdfsdf sdafsad', grade: 'Infant' }
];

const templates = [
  { _id: '68a4ca1810d4f62e243966b8', name: 'Infant Daily', reportFrequency: 'Daily', grade: 'Infant', isActive: true },
  { _id: '68a4ca3310d4f62e243966d5', name: 'Infant Weekly', reportFrequency: 'Weekly', grade: 'Infant', isActive: true }
];

const reports = []; // No existing reports

console.log('🧪 Testing Frontend Due Report Logic');

// Get current time in school timezone (frontend approach)
const timezone = schoolSettings.timezone || 'UTC';
const now = new Date();
console.log('Current time (frontend):', now.toString());
console.log('Current time (UTC):', now.toISOString());

// Frontend calculateDueDateForFrequency function (simplified)
const calculateDueDateForFrequency = (frequency, currentDate) => {
  const frequencyConfig = schoolSettings.reportFrequencies[frequency];
  
  if (frequencyConfig?.enabled) {
    let dueDate = new Date(currentDate);
    
    switch (frequency) {
      case 'Daily':
        const [dailyHours, dailyMinutes] = (frequencyConfig.dueTime || '17:00').split(':').map(Number);
        dueDate = new Date(currentDate);
        dueDate.setHours(dailyHours, dailyMinutes, 0, 0);
        dueDate.setMilliseconds(0);
        break;
      case 'Weekly':
        const [weeklyHours, weeklyMinutes] = (frequencyConfig.dueTime || '17:00').split(':').map(Number);
        const targetDay = frequencyConfig.dueDay - 1;
        const currentDay = currentDate.getDay();
        const daysToAdd = (targetDay - currentDay + 7) % 7;
        dueDate = new Date(currentDate);
        dueDate.setDate(currentDate.getDate() + daysToAdd);
        dueDate.setHours(weeklyHours, weeklyMinutes, 0, 0);
        if (dueDate.getTime() <= currentDate.getTime()) {
          dueDate.setDate(dueDate.getDate() + 7);
        }
        break;
    }
    
    return dueDate;
  }
  
  return currentDate;
};

// Frontend getReportForCurrentPeriod function (simplified)
const getReportForCurrentPeriod = (reports, frequency, currentDate) => {
  const now = new Date(currentDate);
  
  return reports.find(report => {
    const reportDate = new Date(report.createdAt);
    
    switch (frequency) {
      case 'Daily':
        return reportDate.toDateString() === now.toDateString();
      case 'Weekly':
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - now.getDay() + 1);
        weekStart.setHours(0, 0, 0, 0);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        weekEnd.setHours(23, 59, 59, 999);
        return reportDate >= weekStart && reportDate <= weekEnd;
    }
  });
};

// Simulate frontend dueReports calculation
const dueReports = [];

students.forEach(student => {
  const gradeTemplates = templates.filter(template => 
    template.grade.toLowerCase() === student.grade.toLowerCase() && template.isActive
  );

  gradeTemplates.forEach(template => {
    const allStudentReports = reports.filter(r => r.studentId === student._id);
    const currentPeriodReport = getReportForCurrentPeriod(allStudentReports, template.reportFrequency, now);
    
    if (currentPeriodReport) {
      if (currentPeriodReport.status !== 'sent') {
        const dueDate = calculateDueDateForFrequency(template.reportFrequency, now);
        const isOverdue = now.getTime() > dueDate.getTime();
        
        if (isOverdue) {
          const daysOverdue = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
          dueReports.push({
            studentId: student._id,
            studentName: student.name,
            templateName: template.name,
            frequency: template.reportFrequency,
            dueDate: dueDate,
            daysOverdue: daysOverdue,
            templateId: template._id,
            reportStatus: currentPeriodReport.status,
            reportId: currentPeriodReport._id
          });
        }
      }
    } else {
      const dueDate = calculateDueDateForFrequency(template.reportFrequency, now);
      const isOverdue = now.getTime() > dueDate.getTime();
      
      if (isOverdue) {
        const daysOverdue = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
        dueReports.push({
          studentId: student._id,
          studentName: student.name,
          templateName: template.name,
          frequency: template.reportFrequency,
          dueDate: dueDate,
          daysOverdue: daysOverdue,
          templateId: template._id,
          reportStatus: 'missing',
          reportId: null
        });
      }
    }
  });
});

console.log('\nFrontend Due Reports Calculation:');
console.log('Students:', students.length);
console.log('Templates:', templates.length);
console.log('Expected due reports:', students.length * templates.length);
console.log('Actual due reports found:', dueReports.length);

dueReports.forEach((report, index) => {
  console.log(`${index + 1}. ${report.studentName} - ${report.templateName} (${report.frequency})`);
  console.log(`   Due date: ${report.dueDate.toString()}`);
  console.log(`   Days overdue: ${report.daysOverdue}`);
  console.log(`   Status: ${report.reportStatus}`);
});

// Also test backend calculation for comparison
console.log('\nBackend Calculation (for comparison):');
const backendNow = moment().tz(timezone);
console.log('Backend current time:', backendNow.format());

templates.forEach(template => {
  const frequencyConfig = schoolSettings.reportFrequencies[template.reportFrequency];
  if (frequencyConfig?.enabled) {
    const backendDueDate = moment().tz(timezone);
    
    if (template.reportFrequency === 'Daily') {
      const [hours, minutes] = frequencyConfig.dueTime.split(':').map(Number);
      backendDueDate.hours(hours).minutes(minutes).seconds(0).milliseconds(0);
    } else if (template.reportFrequency === 'Weekly') {
      const [hours, minutes] = frequencyConfig.dueTime.split(':').map(Number);
      const targetDay = frequencyConfig.dueDay - 1;
      const currentDay = backendDueDate.day();
      const daysToAdd = (targetDay - currentDay + 7) % 7;
      backendDueDate.add(daysToAdd, 'days').hours(hours).minutes(minutes).seconds(0).milliseconds(0);
    }
    
    const backendIsOverdue = backendNow.isAfter(backendDueDate);
    console.log(`${template.name}: Due ${backendDueDate.format()}, Overdue: ${backendIsOverdue}`);
  }
});
