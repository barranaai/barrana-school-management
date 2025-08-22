const mongoose = require('mongoose');
const Report = require('./models/Report');
const User = require('./models/User');
require('dotenv').config();

async function cleanupOrphanedReports() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');
    
    // Get all reports
    const reports = await Report.find({});
    console.log('📊 Total reports before cleanup:', reports.length);
    
    // Get all existing user IDs
    const existingUserIds = await User.find({}).distinct('_id');
    console.log('👥 Total existing users:', existingUserIds.length);
    
    // Find orphaned reports (reports that reference non-existent students or teachers)
    const orphanedReports = reports.filter(report => {
      const studentExists = !report.studentId || existingUserIds.some(id => id.toString() === report.studentId.toString());
      const teacherExists = !report.teacherId || existingUserIds.some(id => id.toString() === report.teacherId.toString());
      return !studentExists || !teacherExists;
    });
    
    console.log('🗑️ Orphaned reports found:', orphanedReports.length);
    
    if (orphanedReports.length > 0) {
      console.log('📋 Sample orphaned reports:');
      orphanedReports.slice(0, 5).forEach(r => {
        console.log('  -', r.title, '(Student ID:', r.studentId, ', Teacher ID:', r.teacherId, ')');
      });
      
      // Delete orphaned reports
      const orphanedReportIds = orphanedReports.map(r => r._id);
      const deleteResult = await Report.deleteMany({ _id: { $in: orphanedReportIds } });
      
      console.log('✅ Deleted', deleteResult.deletedCount, 'orphaned reports');
    }
    
    // Verify cleanup
    const remainingReports = await Report.countDocuments();
    console.log('📊 Total reports after cleanup:', remainingReports);
    
    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');
    
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.disconnect();
  }
}

cleanupOrphanedReports();
