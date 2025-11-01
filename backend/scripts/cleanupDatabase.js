/**
 * Database Cleanup Script
 * Removes all data except super_admin user accounts
 * 
 * WARNING: This will permanently delete all schools, users (except super_admin), 
 * reports, messages, conversations, events, classes, and all other data.
 * 
 * Usage: node scripts/cleanupDatabase.js
 */

const mongoose = require('mongoose');
const { logger } = require('../utils/logger');
require('dotenv').config({ path: require('path').resolve(__dirname, '../config.env') });

// Import all models to ensure collections are registered
const User = require('../models/User');
const School = require('../models/School');
const Report = require('../models/Report');
const Message = require('../models/Message');
const Conversation = require('../models/Conversation');
const Class = require('../models/Class');
const NotificationLog = require('../models/NotificationLog');
const Event = require('../models/Event');
const EventReminder = require('../models/EventReminder');
const ParentGroup = require('../models/ParentGroup');
const ReportTemplate = require('../models/ReportTemplate');

const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI || process.env.MONGODB_URI_PROD || 'mongodb://localhost:27017/barrana_ai';
    console.log(`🔗 Connecting to MongoDB: ${mongoURI.substring(0, 30)}...`);
    
    await mongoose.connect(mongoURI, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    console.log(`✅ MongoDB Connected: ${mongoose.connection.host}`);
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    return false;
  }
};

const cleanupDatabase = async () => {
  try {
    console.log('\n🔍 Starting database cleanup...\n');

    // Step 1: Find all super_admin users
    const superAdmins = await User.find({ role: 'super_admin' });
    console.log(`📊 Found ${superAdmins.length} super_admin user(s):`);
    superAdmins.forEach(admin => {
      console.log(`   - ${admin.email || 'No email'} (${admin.firstName} ${admin.lastName})`);
    });

    if (superAdmins.length === 0) {
      console.log('⚠️  WARNING: No super_admin users found!');
      console.log('   The cleanup will proceed, but you may not be able to access the system.');
    }

    // Step 2: Get counts before deletion
    const counts = {
      users: await User.countDocuments({ role: { $ne: 'super_admin' } }),
      schools: await School.countDocuments(),
      reports: await Report.countDocuments(),
      messages: await Message.countDocuments(),
      conversations: await Conversation.countDocuments(),
      classes: await Class.countDocuments(),
      notificationLogs: await NotificationLog.countDocuments(),
      events: await Event.countDocuments(),
      eventReminders: await EventReminder.countDocuments(),
      parentGroups: await ParentGroup.countDocuments(),
      reportTemplates: await ReportTemplate.countDocuments(),
    };

    console.log('\n📈 Current data counts:');
    console.log(`   Non-super_admin Users: ${counts.users}`);
    console.log(`   Schools: ${counts.schools}`);
    console.log(`   Reports: ${counts.reports}`);
    console.log(`   Messages: ${counts.messages}`);
    console.log(`   Conversations: ${counts.conversations}`);
    console.log(`   Classes: ${counts.classes}`);
    console.log(`   Notification Logs: ${counts.notificationLogs}`);
    console.log(`   Events: ${counts.events}`);
    console.log(`   Event Reminders: ${counts.eventReminders}`);
    console.log(`   Parent Groups: ${counts.parentGroups}`);
    console.log(`   Report Templates: ${counts.reportTemplates}`);

    const totalItems = Object.values(counts).reduce((sum, count) => sum + count, 0);
    
    if (totalItems === 0) {
      console.log('\n✅ Database is already clean. No data to delete.');
      await mongoose.connection.close();
      process.exit(0);
    }

    console.log(`\n⚠️  TOTAL ITEMS TO DELETE: ${totalItems}`);
    console.log('\n⚠️  WARNING: This will permanently delete all data except super_admin accounts!');
    console.log('   The following will be deleted:');
    console.log('   - All users except super_admin');
    console.log('   - All schools');
    console.log('   - All reports, messages, conversations');
    console.log('   - All events, classes, notification logs');
    console.log('   - All parent groups and report templates');
    console.log('\n✅ The following will be KEPT:');
    console.log('   - All super_admin user accounts');

    // Step 3: Perform cleanup
    console.log('\n🗑️  Starting deletion...\n');

    // Delete all non-super_admin users
    const deletedUsers = await User.deleteMany({ role: { $ne: 'super_admin' } });
    console.log(`✅ Deleted ${deletedUsers.deletedCount} non-super_admin users`);

    // Delete all schools
    const deletedSchools = await School.deleteMany({});
    console.log(`✅ Deleted ${deletedSchools.deletedCount} schools`);

    // Delete all reports
    const deletedReports = await Report.deleteMany({});
    console.log(`✅ Deleted ${deletedReports.deletedCount} reports`);

    // Delete all messages
    const deletedMessages = await Message.deleteMany({});
    console.log(`✅ Deleted ${deletedMessages.deletedCount} messages`);

    // Delete all conversations
    const deletedConversations = await Conversation.deleteMany({});
    console.log(`✅ Deleted ${deletedConversations.deletedCount} conversations`);

    // Delete all classes
    const deletedClasses = await Class.deleteMany({});
    console.log(`✅ Deleted ${deletedClasses.deletedCount} classes`);

    // Delete all notification logs
    const deletedNotificationLogs = await NotificationLog.deleteMany({});
    console.log(`✅ Deleted ${deletedNotificationLogs.deletedCount} notification logs`);

    // Delete all events
    const deletedEvents = await Event.deleteMany({});
    console.log(`✅ Deleted ${deletedEvents.deletedCount} events`);

    // Delete all event reminders
    const deletedEventReminders = await EventReminder.deleteMany({});
    console.log(`✅ Deleted ${deletedEventReminders.deletedCount} event reminders`);

    // Delete all parent groups
    const deletedParentGroups = await ParentGroup.deleteMany({});
    console.log(`✅ Deleted ${deletedParentGroups.deletedCount} parent groups`);

    // Delete all report templates
    const deletedReportTemplates = await ReportTemplate.deleteMany({});
    console.log(`✅ Deleted ${deletedReportTemplates.deletedCount} report templates`);

    // Step 4: Verify cleanup
    console.log('\n🔍 Verifying cleanup...\n');
    
    const remainingCounts = {
      users: await User.countDocuments(),
      schools: await School.countDocuments(),
      reports: await Report.countDocuments(),
      messages: await Message.countDocuments(),
      conversations: await Conversation.countDocuments(),
      classes: await Class.countDocuments(),
      notificationLogs: await NotificationLog.countDocuments(),
      events: await Event.countDocuments(),
      eventReminders: await EventReminder.countDocuments(),
      parentGroups: await ParentGroup.countDocuments(),
      reportTemplates: await ReportTemplate.countDocuments(),
    };

    const remainingSuperAdmins = await User.find({ role: 'super_admin' });
    
    console.log('📊 Remaining data:');
    console.log(`   Super_admin Users: ${remainingSuperAdmins.length}`);
    console.log(`   Schools: ${remainingCounts.schools}`);
    console.log(`   Reports: ${remainingCounts.reports}`);
    console.log(`   Messages: ${remainingCounts.messages}`);
    console.log(`   Conversations: ${remainingCounts.conversations}`);
    console.log(`   Classes: ${remainingCounts.classes}`);
    console.log(`   Notification Logs: ${remainingCounts.notificationLogs}`);
    console.log(`   Events: ${remainingCounts.events}`);
    console.log(`   Event Reminders: ${remainingCounts.eventReminders}`);
    console.log(`   Parent Groups: ${remainingCounts.parentGroups}`);
    console.log(`   Report Templates: ${remainingCounts.reportTemplates}`);

    if (remainingCounts.schools === 0 && 
        remainingCounts.reports === 0 && 
        remainingCounts.messages === 0 &&
        remainingCounts.conversations === 0 &&
        remainingCounts.classes === 0 &&
        remainingCounts.notificationLogs === 0 &&
        remainingCounts.events === 0 &&
        remainingCounts.eventReminders === 0 &&
        remainingCounts.parentGroups === 0 &&
        remainingCounts.reportTemplates === 0 &&
        remainingCounts.users === remainingSuperAdmins.length) {
      console.log('\n✅ Database cleanup completed successfully!');
      console.log(`   Only ${remainingSuperAdmins.length} super_admin user(s) remain.`);
    } else {
      console.log('\n⚠️  Warning: Some data may still remain. Please verify manually.');
    }

    await mongoose.connection.close();
    console.log('\n✅ Database connection closed.');
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Error during cleanup:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
};

// Main execution
(async () => {
  // Require explicit confirmation via environment variable or command-line argument
  const confirmFlag = process.env.CONFIRM_CLEANUP === 'true' || process.argv.includes('--confirm');
  
  if (!confirmFlag) {
    console.log('\n⚠️  SAFETY CHECK: This script will delete all data except super_admin accounts!');
    console.log('\nTo run this script, you must explicitly confirm by either:');
    console.log('   1. Setting environment variable: CONFIRM_CLEANUP=true node scripts/cleanupDatabase.js');
    console.log('   2. Adding --confirm flag: node scripts/cleanupDatabase.js --confirm');
    console.log('\nExample:');
    console.log('   CONFIRM_CLEANUP=true node scripts/cleanupDatabase.js');
    console.log('\nExiting for safety...');
    process.exit(0);
  }

  const connected = await connectDB();
  if (!connected) {
    console.error('❌ Failed to connect to database. Exiting.');
    process.exit(1);
  }

  await cleanupDatabase();
})();

