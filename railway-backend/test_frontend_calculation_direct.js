const mongoose = require('mongoose');
require('dotenv').config();

// Simulate the exact frontend calculation logic
const simulateFrontendCalculation = (schoolData, students, templates, reports) => {
  console.log('🔍 Simulating frontend due reports calculation...');
  
  // Check if we have all required data
  if (!schoolData?.settings) {
    console.log('❌ No school settings');
    return [];
  }
  
  if (!schoolData.settings.timezone) {
    console.log('❌ No timezone in school settings');
    return [];
  }
  
  if (!schoolData.settings.reportFrequencies) {
    console.log('❌ No report frequencies in school settings');
    return [];
  }
  
  if (students.length === 0) {
    console.log('❌ No students');
    return [];
  }
  
  if (templates.length === 0) {
    console.log('❌ No templates');
    return [];
  }
  
  console.log('✅ All required data present, starting calculation...');
  
  // Get current time in school timezone (frontend logic)
  const timezone = schoolData.settings.timezone;
  const now = new Date(new Date().toLocaleString("en-US", {timeZone: timezone}));
  
  console.log('⏰ Current time in school timezone:', {
    timezone,
    now: now.toISOString(),
    localTime: now.toLocaleString()
  });
  
  const dueReports = [];
  
  // Filter students that have classId (frontend logic)
  const studentsWithClass = students.filter(s => s.classId);
  console.log(`📊 Processing ${studentsWithClass.length} students with classId`);
  
  studentsWithClass.forEach(student => {
    console.log(`\n👤 Processing student: ${student.firstName} ${student.lastName}`);
    
    // Find templates for this student's grade (case-insensitive)
    const gradeTemplates = templates.filter(template => 
      template.grade.toLowerCase() === student.grade.toLowerCase() && template.isActive
    );
    
    console.log(`📋 Found ${gradeTemplates.length} templates for grade ${student.grade}`);
    
    gradeTemplates.forEach(template => {
      console.log(`\n📄 Checking template: ${template.name} (${template.reportFrequency})`);
      
      // Get ALL reports for this student
      const allStudentReports = reports.filter(r => {
        const reportStudentId = typeof r.studentId === 'string' ? r.studentId : (r.studentId && r.studentId._id);
        return reportStudentId === student._id;
      });
      
      console.log(`📊 Found ${allStudentReports.length} reports for this student`);
      
      // Check if there's a report for the current period based on frequency
      const currentPeriodReport = getReportForCurrentPeriod(allStudentReports, template.reportFrequency, now);
      
      if (currentPeriodReport) {
        console.log(`✅ Found report for current period: ${currentPeriodReport.status}`);
        
        if (currentPeriodReport.status === 'sent') {
          console.log('📤 Report is sent - not due');
        } else {
          // Report exists but not sent (draft or completed)
          const dueDate = calculateDueDateForFrequency(template.reportFrequency, now, schoolData.settings);
          const isOverdue = now.getTime() > dueDate.getTime();
          
          console.log('📝 Report exists but not sent:', {
            status: currentPeriodReport.status,
            dueDate: dueDate.toISOString(),
            now: now.toISOString(),
            isOverdue
          });
          
          if (isOverdue) {
            const daysOverdue = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
            dueReports.push({
              studentId: student._id,
              studentName: `${student.firstName} ${student.lastName}`,
              templateName: template.name,
              frequency: template.reportFrequency,
              dueDate: dueDate,
              daysOverdue: daysOverdue,
              templateId: template._id,
              reportStatus: currentPeriodReport.status,
              reportId: currentPeriodReport._id
            });
            
            console.log(`🚨 ADDED DUE REPORT: ${template.name} for ${student.firstName} ${student.lastName}`);
          }
        }
      } else {
        console.log('❌ No report for current period');
        
        // No report for current period - calculate due date
        const dueDate = calculateDueDateForFrequency(template.reportFrequency, now, schoolData.settings);
        const isOverdue = now.getTime() > dueDate.getTime();
        
        console.log('📅 No report for current period:', {
          dueDate: dueDate.toISOString(),
          now: now.toISOString(),
          isOverdue
        });
        
        if (isOverdue) {
          const daysOverdue = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
          dueReports.push({
            studentId: student._id,
            studentName: `${student.firstName} ${student.lastName}`,
            templateName: template.name,
            frequency: template.reportFrequency,
            dueDate,
            daysOverdue,
            templateId: template._id,
            reportStatus: 'missing',
            reportId: null
          });
          
          console.log(`🚨 ADDED DUE REPORT: ${template.name} for ${student.firstName} ${student.lastName}`);
        }
      }
    });
  });
  
  console.log(`\n📊 CALCULATION COMPLETED: ${dueReports.length} due reports found`);
  return dueReports;
};

// Frontend helper functions (copied from the frontend code)
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
      default:
        return false;
    }
  });
};

const calculateDueDateForFrequency = (frequency, currentDate, schoolSettings) => {
  const now = currentDate;
  const frequencyConfig = schoolSettings.reportFrequencies?.[frequency];
  
  if (frequencyConfig?.enabled) {
    let dueDate = new Date(now);
    
    switch (frequency) {
      case 'Daily':
        const workingDays = frequencyConfig.workingDays || [1, 2, 3, 4, 5];
        const currentDayOfWeek = now.getDay();
        const isWorkingDay = workingDays.includes(currentDayOfWeek);
        
        if (!isWorkingDay) {
          let nextWorkingDay = new Date(now);
          do {
            nextWorkingDay.setDate(nextWorkingDay.getDate() + 1);
          } while (!workingDays.includes(nextWorkingDay.getDay()));
          dueDate = nextWorkingDay;
        } else {
          dueDate = new Date(now);
        }
        
        const [dailyHours, dailyMinutes] = (frequencyConfig.dueTime || '17:00').split(':').map(Number);
        dueDate.setHours(dailyHours, dailyMinutes, 0, 0);
        dueDate.setMilliseconds(0);
        break;
      case 'Weekly':
        const targetDay = frequencyConfig.dueDay - 1;
        const currentDay = now.getDay();
        const daysToAdd = (targetDay - currentDay + 7) % 7;
        
        dueDate = new Date(now);
        dueDate.setDate(now.getDate() + daysToAdd);
        const [weeklyHours, weeklyMinutes] = (frequencyConfig.dueTime || '17:00').split(':').map(Number);
        dueDate.setHours(weeklyHours, weeklyMinutes, 0, 0);
        
        if (dueDate.getTime() <= now.getTime()) {
          dueDate.setDate(dueDate.getDate() + 7);
        }
        break;
      default:
        dueDate = new Date(now);
        break;
    }
    
    return dueDate;
  }
  
  return new Date(now);
};

async function testFrontendCalculationDirect() {
  try {
    console.log('🔍 Testing frontend calculation directly...');
    
    await mongoose.connect(process.env.MONGODB_URI);
    const User = require('./models/User');
    const Class = require('./models/Class');
    const School = require('./models/School');
    const Report = require('./models/Report');
    const ReportTemplate = require('./models/ReportTemplate');
    
    const schoolId = '68a4b0c04283c7f05947b15e';
    
    // Get all required data
    const school = await School.findById(schoolId);
    const students = await User.find({ schoolId: schoolId, role: 'parent' }).populate('classId');
    const templates = await ReportTemplate.find({ schoolId: schoolId, isActive: true });
    const reports = await Report.find({ schoolId: schoolId });
    
    console.log('📊 Data loaded:', {
      school: !!school,
      studentsCount: students.length,
      templatesCount: templates.length,
      reportsCount: reports.length
    });
    
    // Simulate frontend calculation
    const dueReports = simulateFrontendCalculation(school, students, templates, reports);
    
    console.log('\n🎯 FINAL RESULT:', {
      totalDueReports: dueReports.length,
      dueReports: dueReports.map(dr => ({
        studentName: dr.studentName,
        templateName: dr.templateName,
        frequency: dr.frequency,
        dueDate: dr.dueDate.toISOString(),
        daysOverdue: dr.daysOverdue
      }))
    });
    
    if (dueReports.length > 0) {
      console.log('✅ Frontend calculation shows due reports!');
      console.log('💡 The issue might be in the frontend data loading or caching.');
    } else {
      console.log('❌ Frontend calculation shows no due reports.');
      console.log('💡 This matches what you see in the UI.');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await mongoose.disconnect();
  }
}

testFrontendCalculationDirect();
