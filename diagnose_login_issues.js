const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function diagnoseLoginIssues() {
  try {
    console.log('🔍 DIAGNOSING LOGIN ISSUES');
    console.log('================================\n');
    
    // Check environment variables
    console.log('1. ENVIRONMENT CONFIGURATION:');
    console.log('   JWT_SECRET:', process.env.JWT_SECRET ? '✅ Set' : '❌ Missing');
    console.log('   JWT_EXPIRE:', process.env.JWT_EXPIRE || '7d (default)');
    console.log('   MONGODB_URI:', process.env.MONGODB_URI ? '✅ Set' : '❌ Missing');
    console.log('   NODE_ENV:', process.env.NODE_ENV || 'undefined');
    
    // Connect to database
    console.log('\n2. DATABASE CONNECTION:');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('   ✅ Connected to MongoDB');
    
    const User = require('./models/User');
    
    // Test a teacher login
    console.log('\n3. TESTING USER AUTHENTICATION:');
    const testEmail = 'emily.rodriguez@barranaischool.edu';
    const testPassword = 'demo123';
    
    // Find user
    const user = await User.findByEmail(testEmail).select('+password');
    if (!user) {
      console.log('   ❌ User not found');
      return;
    }
    
    console.log('   ✅ User found:', user.email);
    console.log('   ✅ User active:', user.isActive);
    console.log('   ✅ Password hash present:', !!user.password);
    
    // Test password
    const isPasswordValid = await bcrypt.compare(testPassword, user.password);
    console.log('   ✅ Password valid:', isPasswordValid);
    
    if (!isPasswordValid) {
      console.log('   ❌ Password comparison failed!');
      return;
    }
    
    // Test JWT token generation
    console.log('\n4. JWT TOKEN TESTING:');
    const token = user.generateAuthToken();
    console.log('   ✅ Token generated:', token.substring(0, 50) + '...');
    
    // Test token verification
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      console.log('   ✅ Token verified successfully');
      console.log('   ✅ Token expires in:', process.env.JWT_EXPIRE || '7d');
      console.log('   ✅ Token payload:', {
        id: decoded.id,
        email: decoded.email,
        role: decoded.role,
        exp: new Date(decoded.exp * 1000).toISOString()
      });
    } catch (tokenError) {
      console.log('   ❌ Token verification failed:', tokenError.message);
      return;
    }
    
    // Test rate limiting configuration
    console.log('\n5. RATE LIMITING ANALYSIS:');
    console.log('   Auth limiter: 50 requests per 15 minutes');
    console.log('   General rate limiting: Disabled for testing');
    
    // Check for any issues with user account
    console.log('\n6. USER ACCOUNT STATUS:');
    console.log('   Account active:', user.isActive);
    console.log('   Email verified:', user.isEmailVerified);
    console.log('   Last login:', user.lastLogin);
    console.log('   Last activity:', user.lastActivity);
    console.log('   School ID:', user.schoolId);
    
    // Test multiple users to see if it's a general issue
    console.log('\n7. TESTING MULTIPLE USERS:');
    const allUsers = await User.find({ role: 'teacher' }).select('+password').limit(3);
    for (const testUser of allUsers) {
      if (!testUser.password) {
        console.log(`   ${testUser.email}: ❌ No password hash | Active: ${testUser.isActive}`);
        continue;
      }
      const canLogin = await bcrypt.compare('demo123', testUser.password);
      console.log(`   ${testUser.email}: ${canLogin ? '✅ Can login' : '❌ Cannot login'} | Active: ${testUser.isActive}`);
    }
    
    // Check if there might be database locking issues
    console.log('\n8. CONCURRENT LOGIN SIMULATION:');
    const promises = [];
    for (let i = 0; i < 3; i++) {
      promises.push(
        User.findByEmail(testEmail).select('+password').then(async (u) => {
          if (u) {
            const valid = await u.comparePassword(testPassword);
            return { attempt: i + 1, success: valid };
          }
          return { attempt: i + 1, success: false };
        })
      );
    }
    
    const results = await Promise.all(promises);
    results.forEach(result => {
      console.log(`   Attempt ${result.attempt}: ${result.success ? '✅ Success' : '❌ Failed'}`);
    });
    
    console.log('\n9. POTENTIAL ISSUES TO CHECK:');
    console.log('   - Frontend localStorage token persistence');
    console.log('   - Browser session storage');
    console.log('   - Network connectivity between frontend/backend');
    console.log('   - CORS configuration');
    console.log('   - Frontend error handling');
    
    console.log('\n✅ DIAGNOSIS COMPLETE');
    console.log('If all tests pass, the issue is likely in the frontend or network layer.');
    
  } catch (error) {
    console.error('❌ Diagnosis failed:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await mongoose.disconnect();
    console.log('\n🔌 Database connection closed');
  }
}

diagnoseLoginIssues();
