const mongoose = require('mongoose');
require('./models/Report');
require('./models/User');
require('./models/ReportTemplate');
require('./models/School');

mongoose.connect('mongodb://localhost:27017/barrana_ai').then(async () => {
  try {
    const Report = require('./models/Report');
    const User = require('./models/User');
    const ReportTemplate = require('./models/ReportTemplate');
    const School = require('./models/School');
    
    const school = await School.findOne({name: /Hunululu/i});
    console.log('School:', school.name);
    
    const students = await User.find({schoolId: school._id, role: 'parent'}).select('_id firstName lastName');
    console.log('Students:', students.map(s => ({ id: s._id, name: s.firstName + ' ' + s.lastName })));
    
    const templates = await ReportTemplate.find({schoolId: school._id, grade: 'Infant', isActive: true}).select('_id name reportFrequency');
    console.log('Templates:', templates.map(t => ({ id: t._id, name: t.name, frequency: t.reportFrequency })));
    
    const reports = await Report.find({
      schoolId: school._id, 
      studentId: {$in: students.map(s => s._id)}, 
      templateId: {$in: templates.map(t => t._id)}
    }).populate('studentId', 'firstName lastName').populate('templateId', 'name reportFrequency');
    
    console.log('Existing reports:', reports.map(r => ({ 
      student: r.studentId?.firstName + ' ' + r.studentId?.lastName, 
      template: r.templateId?.name, 
      status: r.status, 
      createdAt: r.createdAt 
    })));
    
    console.log('Total reports found:', reports.length);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
  }
});
