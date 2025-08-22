const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

// Import models
const User = require('../models/User');
const School = require('../models/School');

// Database connection
const connectDB = async () => {
  try {
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/barrana_ai';
    await mongoose.connect(mongoURI, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      bufferCommands: false,
    });
    console.log('📊 MongoDB Connected for seeding');
  } catch (error) {
    console.error('Database connection failed:', error);
    process.exit(1);
  }
};

// Demo data
const demoSchools = [
  {
    name: 'Barrana AI School',
    slug: 'barrana-ai-school',
    schoolType: 'montessori_school',
    estimatedStudents: 150,
    gradeLevels: ['preschool', 'kindergarten', 'grade1', 'grade2', 'grade3'],
    address: {
      street: '123 Education Drive',
      city: 'San Francisco',
      state: 'CA',
      zipCode: '94105',
      country: 'USA'
    },
    contactPerson: {
      name: 'Sarah Johnson',
      email: 'sarah.johnson@barranaischool.edu',
      phone: '+1-555-0123',
      role: 'School Administrator'
    },
    subscription: {
      plan: 'premium',
      status: 'active',
      startDate: new Date('2024-01-01'),
      endDate: new Date('2025-01-01')
    },
    isActive: true
  },
  {
    name: 'Sunshine Montessori',
    slug: 'sunshine-montessori',
    schoolType: 'montessori_school',
    estimatedStudents: 120,
    gradeLevels: ['preschool', 'kindergarten', 'grade1', 'grade2'],
    address: {
      street: '456 Learning Lane',
      city: 'Los Angeles',
      state: 'CA',
      zipCode: '90210',
      country: 'USA'
    },
    contactPerson: {
      name: 'Maria Garcia',
      email: 'maria.garcia@sunshinemontessori.com',
      phone: '+1-555-0456',
      role: 'Director'
    },
    subscription: {
      plan: 'basic',
      status: 'active',
      startDate: new Date('2024-03-01'),
      endDate: new Date('2025-03-01')
    },
    isActive: true
  }
];

const demoUsers = [
  // Super Admin
  {
    firstName: 'Alex',
    lastName: 'Chen',
    email: 'alex.chen@barrana.ai',
    password: 'demo123',
    role: 'super_admin',
    isEmailVerified: true,
    preferences: {
      language: 'en',
      timezone: 'America/Los_Angeles',
      notifications: {
        email: true,
        push: true,
        sms: false
      }
    },
    lastLogin: new Date(),
    lastActivity: new Date()
  },
  // School Admin for Barrana AI School
  {
    firstName: 'Sarah',
    lastName: 'Johnson',
    email: 'sarah.johnson@barranaischool.edu',
    password: 'demo123',
    role: 'school_admin',
    isEmailVerified: true,
    preferences: {
      language: 'en',
      timezone: 'America/Los_Angeles',
      notifications: {
        email: true,
        push: true,
        sms: true
      }
    },
    lastLogin: new Date(),
    lastActivity: new Date()
  },
  // Teachers
  {
    firstName: 'Emily',
    lastName: 'Rodriguez',
    email: 'emily.rodriguez@barranaischool.edu',
    password: 'demo123',
    role: 'teacher',
    grade: 'grade1',
    isEmailVerified: true,
    preferences: {
      language: 'en',
      timezone: 'America/Los_Angeles',
      notifications: {
        email: true,
        push: true,
        sms: false
      }
    },
    lastLogin: new Date(),
    lastActivity: new Date()
  },
  {
    firstName: 'Michael',
    lastName: 'Thompson',
    email: 'michael.thompson@barranaischool.edu',
    password: 'demo123',
    role: 'teacher',
    grade: 'grade2',
    isEmailVerified: true,
    preferences: {
      language: 'en',
      timezone: 'America/Los_Angeles',
      notifications: {
        email: true,
        push: false,
        sms: false
      }
    },
    lastLogin: new Date(),
    lastActivity: new Date()
  },

  // Additional School Admin
  {
    firstName: 'Michael',
    lastName: 'Thompson',
    email: 'michael.thompson.admin@barranaischool.edu',
    password: 'demo123',
    role: 'school_admin',
    isEmailVerified: true,
    preferences: {
      language: 'en',
      timezone: 'America/Los_Angeles',
      notifications: {
        email: true,
        push: true,
        sms: true
      }
    },
    lastLogin: new Date(),
    lastActivity: new Date()
  },
  // Additional Teachers
  {
    firstName: 'Michael',
    lastName: 'Chen',
    email: 'michael.chen@barranaischool.edu',
    password: 'demo123',
    role: 'teacher',
    grade: 'grade4',
    isEmailVerified: true,
    preferences: {
      language: 'en',
      timezone: 'America/Los_Angeles',
      notifications: {
        email: true,
        push: true,
        sms: false
      }
    },
    lastLogin: new Date(),
    lastActivity: new Date()
  },
  {
    firstName: 'Sarah',
    lastName: 'Williams',
    email: 'sarah.williams@barranaischool.edu',
    password: 'demo123',
    role: 'teacher',
    grade: 'grade3',
    isEmailVerified: true,
    preferences: {
      language: 'en',
      timezone: 'America/Los_Angeles',
      notifications: {
        email: true,
        push: false,
        sms: false
      }
    },
    lastLogin: new Date(),
    lastActivity: new Date()
  },

  // Daycare Admins
  {
    firstName: 'Jessica',
    lastName: 'Martinez',
    email: 'jessica.martinez@barranadaycare.edu',
    password: 'demo123',
    role: 'school_admin',
    isEmailVerified: true,
    preferences: {
      language: 'en',
      timezone: 'America/Los_Angeles',
      notifications: {
        email: true,
        push: true,
        sms: true
      }
    },
    lastLogin: new Date(),
    lastActivity: new Date()
  },
  {
    firstName: 'Robert',
    lastName: 'Wilson',
    email: 'robert.wilson@barranadaycare.edu',
    password: 'demo123',
    role: 'school_admin',
    isEmailVerified: true,
    preferences: {
      language: 'en',
      timezone: 'America/Los_Angeles',
      notifications: {
        email: true,
        push: true,
        sms: true
      }
    },
    lastLogin: new Date(),
    lastActivity: new Date()
  },
  // Daycare Teachers
  {
    firstName: 'Maria',
    lastName: 'Rodriguez',
    email: 'maria.rodriguez@barranadaycare.edu',
    password: 'demo123',
    role: 'teacher',
    grade: 'preschool',
    isEmailVerified: true,
    preferences: {
      language: 'en',
      timezone: 'America/Los_Angeles',
      notifications: {
        email: true,
        push: true,
        sms: false
      }
    },
    lastLogin: new Date(),
    lastActivity: new Date()
  },
  {
    firstName: 'Sarah',
    lastName: 'Johnson',
    email: 'sarah.johnson@barranadaycare.edu',
    password: 'demo123',
    role: 'teacher',
    grade: 'kindergarten',
    isEmailVerified: true,
    preferences: {
      language: 'en',
      timezone: 'America/Los_Angeles',
      notifications: {
        email: true,
        push: true,
        sms: false
      }
    },
    lastLogin: new Date(),
    lastActivity: new Date()
  },
  {
    firstName: 'Emily',
    lastName: 'Chen',
    email: 'emily.chen@barranadaycare.edu',
    password: 'demo123',
    role: 'teacher',
    grade: 'preschool',
    isEmailVerified: true,
    preferences: {
      language: 'en',
      timezone: 'America/Los_Angeles',
      notifications: {
        email: true,
        push: false,
        sms: false
      }
    },
    lastLogin: new Date(),
    lastActivity: new Date()
  },

];

// Seed function
const seedData = async () => {
  try {
    console.log('🌱 Starting database seeding...');

    // Clear existing data
    console.log('🧹 Clearing existing data...');
    await User.deleteMany({});
    await School.deleteMany({});

    // Create schools
    console.log('🏫 Creating schools...');
    const createdSchools = await School.insertMany(demoSchools);
    console.log(`✅ Created ${createdSchools.length} schools`);

    // Hash passwords and create users
    console.log('👥 Creating users...');
    const usersWithHashedPasswords = await Promise.all(
      demoUsers.map(async (user) => {
        const hashedPassword = await bcrypt.hash(user.password, 12);
        let schoolId;
        
        if (user.role === 'super_admin') {
          schoolId = undefined;
        } else if (user.email.includes('barranadaycare.edu') || user.email.includes('sunshinemontessori.com')) {
          schoolId = createdSchools[1]._id; // Sunshine Montessori
        } else {
          schoolId = createdSchools[0]._id; // Barrana AI School
        }
        
        return {
          ...user,
          password: hashedPassword,
          schoolId
        };
      })
    );

    const createdUsers = await User.insertMany(usersWithHashedPasswords);
    console.log(`✅ Created ${createdUsers.length} users`);

    // Update school admin with school reference
    const schoolAdmin = createdUsers.find(u => u.role === 'school_admin');
    if (schoolAdmin) {
      await School.findByIdAndUpdate(createdSchools[0]._id, {
        $set: { adminId: schoolAdmin._id }
      });
    }

    console.log('🎉 Database seeding completed successfully!');
    console.log('\n📊 Summary:');
    console.log(`   Schools: ${createdSchools.length}`);
    console.log(`   Users: ${createdUsers.length}`);
    console.log('\n🔑 Demo Login Credentials:');
    console.log('   Super Admin: alex.chen@barrana.ai / demo123');
    console.log('   School Admins: sarah.johnson@barranaischool.edu, michael.thompson@barranaischool.edu / demo123');
    console.log('   Teachers: emily.rodriguez@barranaischool.edu, michael.chen@barranaischool.edu, sarah.williams@barranaischool.edu / demo123');
    console.log('   Parents: jennifer.smith@email.com, carlos.rodriguez@email.com, sarah.johnson@email.com / demo123');
    console.log('   Daycare Admins: jessica.martinez@barranadaycare.edu, robert.wilson@barranadaycare.edu / demo123');
    console.log('   Daycare Teachers: maria.rodriguez@barranadaycare.edu, emily.chen@barranadaycare.edu / demo123');
    console.log('   Daycare Parents: jessica.martinez@email.com / demo123');

  } catch (error) {
    console.error('❌ Seeding failed:', error);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Database connection closed');
    process.exit(0);
  }
};

// Run seeding
connectDB().then(seedData); 