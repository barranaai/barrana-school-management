require('dotenv').config({ path: './config.env' });
const mongoose = require('mongoose');
const User = require('./models/User');

async function fixAdminPhone() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Find the admin user with invalid phone
    const admin = await User.findOne({ email: 'faranarshad.sj@gmail.com' });
    
    if (!admin) {
      console.log('❌ Admin user not found');
      process.exit(1);
    }

    console.log('Found admin user:', {
      email: admin.email,
      role: admin.role,
      phone: admin.phone,
      phoneNumber: admin.phoneNumber
    });

    // Update phone to null or empty string (both are valid)
    admin.phone = null;
    admin.phoneNumber = null;
    
    // Save without validation first to clear invalid data
    await admin.save({ validateBeforeSave: false });
    
    console.log('✅ Phone numbers cleared successfully!');
    
    // Verify the update
    const updated = await User.findOne({ email: 'faranarshad.sj@gmail.com' });
    console.log('Updated user:', {
      email: updated.email,
      phone: updated.phone,
      phoneNumber: updated.phoneNumber
    });

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

fixAdminPhone();

