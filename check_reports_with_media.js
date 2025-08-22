const mongoose = require('mongoose');
require('dotenv').config({ path: './backend/config.env' });

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/barrana');

// Define Report schema (simplified)
const reportSchema = new mongoose.Schema({
  attachments: [{
    filename: String,
    originalName: String,
    mimeType: String,
    size: Number,
    url: String,
    uploadedAt: Date
  }]
});

const Report = mongoose.model('Report', reportSchema);

async function checkReportsWithMedia() {
  try {
    console.log('🔍 Checking for reports with media attachments...');
    
    // Find all reports
    const allReports = await Report.find({});
    console.log(`📊 Total reports found: ${allReports.length}`);
    
    // Find reports with attachments
    const reportsWithAttachments = allReports.filter(report => 
      report.attachments && report.attachments.length > 0
    );
    
    console.log(`📊 Reports with attachments: ${reportsWithAttachments.length}`);
    
    if (reportsWithAttachments.length > 0) {
      console.log('\n📋 Reports with attachments:');
      reportsWithAttachments.forEach((report, index) => {
        console.log(`\n${index + 1}. Report ID: ${report._id}`);
        console.log(`   Attachments: ${report.attachments.length}`);
        report.attachments.forEach((attachment, attIndex) => {
          console.log(`   - Attachment ${attIndex + 1}: ${attachment.originalName} (${attachment.mimeType})`);
        });
      });
    } else {
      console.log('\n❌ No reports with attachments found in the database.');
      console.log('💡 This means either:');
      console.log('   1. No media files have been uploaded yet');
      console.log('   2. Media files are stored differently');
      console.log('   3. There\'s an issue with the media upload process');
    }
    
  } catch (error) {
    console.error('❌ Error checking reports:', error);
  } finally {
    mongoose.connection.close();
  }
}

checkReportsWithMedia();
