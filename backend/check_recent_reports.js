const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const Report = require('./models/Report');
const User = require('./models/User');

async function checkRecentReports() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/barrana_ai');
    console.log('✅ Connected to MongoDB');

    // Find test teacher 101
    const teacher = await User.findOne({ 
      $or: [
        { email: 'test.teacher.101@barrana.ai' },
        { email: 'test.teacher.101@example.com' },
        { firstName: 'Test', lastName: 'Teacher' }
      ]
    });

    if (!teacher) {
      console.log('❌ Test teacher 101 not found');
      console.log('Available teachers:');
      const allTeachers = await User.find({ role: 'teacher' }).limit(5);
      allTeachers.forEach(t => console.log(`- ${t.firstName} ${t.lastName} (${t.email})`));
      return;
    }

    console.log('✅ Found teacher:', teacher.firstName, teacher.lastName, `(${teacher.email})`);
    console.log('Teacher ID:', teacher._id);

    // Find recent reports by this teacher
    const reports = await Report.find({ teacherId: teacher._id })
      .sort({ createdAt: -1 })
      .limit(10);

    console.log(`\n📊 Found ${reports.length} reports by test teacher 101:\n`);

    if (reports.length === 0) {
      console.log('❌ No reports found for this teacher');
      return;
    }

    reports.forEach((report, index) => {
      console.log(`\n--- Report ${index + 1} ---`);
      console.log(`📝 Title: ${report.title}`);
      console.log(`📅 Created: ${report.createdAt}`);
      console.log(`📊 Status: ${report.status}`);
      console.log(`📏 Content Length: ${report.content ? report.content.length : 0} characters`);
      
      // Check voice recording data
      if (report.voiceRecording) {
        console.log(`🎤 Voice Recording: Yes`);
        if (report.voiceRecording.transcription) {
          console.log(`📝 Transcription: "${report.voiceRecording.transcription.substring(0, 100)}..."`);
        } else {
          console.log(`📝 Transcription: Not available`);
        }
        if (report.voiceRecording.recordings && report.voiceRecording.recordings.length > 0) {
          console.log(`🎵 Recordings: ${report.voiceRecording.recordings.length} audio files`);
        }
      } else {
        console.log(`🎤 Voice Recording: No`);
      }

      // Show content preview
      if (report.content) {
        console.log(`📄 Content Preview: "${report.content.substring(0, 200)}..."`);
      } else {
        console.log(`📄 Content: No content available`);
      }

      // Check AI generation data
      if (report.aiGenerated) {
        console.log(`🤖 AI Generated: Yes`);
        if (report.aiGenerated.originalTranscription) {
          console.log(`📝 Original Transcription: "${report.aiGenerated.originalTranscription.substring(0, 100)}..."`);
        }
      } else {
        console.log(`🤖 AI Generated: No`);
      }
    });

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Run the script
checkRecentReports(); 