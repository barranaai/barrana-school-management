require('dotenv').config({ path: './config.env' });
const mongoose = require('mongoose');
const User = require('./models/User');
const whatsappService = require('./services/whatsappService');

async function verifyParentAndTest() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB\n');
    console.log('='.repeat(80));

    // Find all parent users
    const parents = await User.find({ role: 'parent' })
      .select('firstName lastName email phone phoneNumber preferences')
      .lean();
    
    if (parents.length === 0) {
      console.log('❌ No parent users found');
      process.exit(1);
    }

    console.log(`\n📊 Found ${parents.length} parent user(s):\n`);
    
    for (const parent of parents) {
      console.log('─'.repeat(80));
      console.log(`Name:           ${parent.firstName} ${parent.lastName}`);
      console.log(`Email:          ${parent.email}`);
      console.log(`Phone:          ${parent.phone || 'NOT SET'}`);
      console.log(`Phone Number:   ${parent.phoneNumber || 'NOT SET'}`);
      console.log(`MongoDB ID:     ${parent._id}`);
      console.log('');
      console.log('📱 Notification Preferences:');
      console.log(`   Email:       ${parent.preferences?.notifications?.email ? '✅ Enabled' : '❌ Disabled'}`);
      console.log(`   WhatsApp:    ${parent.preferences?.notifications?.whatsapp ? '✅ Enabled' : '❌ Disabled'}`);
      console.log(`   SMS:         ${parent.preferences?.notifications?.sms ? '✅ Enabled' : '❌ Disabled'}`);
      console.log(`   Push:        ${parent.preferences?.notifications?.push ? '✅ Enabled' : '❌ Disabled'}`);
      console.log('');

      // Check phone format
      const phoneToCheck = parent.phone || parent.phoneNumber;
      if (phoneToCheck) {
        const isE164 = /^\+[1-9]\d{7,14}$/.test(phoneToCheck);
        console.log('✓ Phone Format Check:');
        console.log(`   Current:     ${phoneToCheck}`);
        console.log(`   E.164 Valid: ${isE164 ? '✅ YES' : '❌ NO'}`);
        console.log('');

        if (isE164 && parent.preferences?.notifications?.whatsapp) {
          console.log('🧪 SENDING TEST WHATSAPP MESSAGE...\n');
          
          try {
            // Initialize WhatsApp service
            whatsappService.initialize();
            
            if (!whatsappService.isAvailable()) {
              console.log('❌ WhatsApp service not available');
              console.log('   Check Twilio credentials in config.env');
            } else {
              console.log('✅ WhatsApp service initialized');
              console.log(`   Sending to: ${phoneToCheck}\n`);
              
              const testMessage = `🧪 *Test Message from Barrana School*\n\n` +
                `This is a test notification to verify WhatsApp integration.\n\n` +
                `If you receive this message, WhatsApp notifications are working correctly! ✅\n\n` +
                `Event notifications (create, update, delete) will be sent to this number.`;
              
              const result = await whatsappService.sendMessage(phoneToCheck, testMessage);
              
              console.log('✅ TEST MESSAGE SENT SUCCESSFULLY!');
              console.log(`   Status: ${result.status}`);
              console.log(`   Message SID: ${result.sid || 'N/A'}`);
              console.log('');
              console.log('📱 Please check your WhatsApp on:', phoneToCheck);
              console.log('');
            }
          } catch (error) {
            console.log('❌ FAILED TO SEND TEST MESSAGE');
            console.log(`   Error: ${error.message}`);
            console.log('');
            
            if (error.code === 63016) {
              console.log('⚠️  Error 63016: Number not joined to sandbox');
              console.log('   Solution:');
              console.log('   1. Open WhatsApp on this number');
              console.log('   2. Send a message to: +14155238886');
              console.log('   3. Message content: join [your-sandbox-code]');
              console.log('');
            }
          }
        } else if (!isE164) {
          console.log('⚠️  Cannot send test message: Phone not in E.164 format');
        } else if (!parent.preferences?.notifications?.whatsapp) {
          console.log('⚠️  Cannot send test message: WhatsApp not enabled');
          console.log('   Solution: Edit student and save to auto-enable WhatsApp');
        }
      } else {
        console.log('⚠️  No phone number set - cannot send WhatsApp');
      }
      console.log('─'.repeat(80));
    }

    console.log('\n' + '='.repeat(80));
    console.log('\n✅ Verification complete!');
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  }
}

verifyParentAndTest();

