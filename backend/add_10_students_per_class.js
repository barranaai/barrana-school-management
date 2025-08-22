/*
  Add 10 students for each class in a given school.
  Usage: node backend/add_10_students_per_class.js "test school 10"
*/

require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('./config/database');
const School = require('./models/School');
const ClassModel = require('./models/Class');
const User = require('./models/User');

function formatGradeForDisplay(grade) {
  if (!grade) return grade;
  const lower = String(grade).toLowerCase();
  switch (lower) {
    case 'infant': return 'Infant';
    case 'toddler': return 'Toddler';
    case 'preschool': return 'Preschool';
    case 'kindergarten': return 'Kindergarten';
    case 'primary_junior_school_age': return 'Primary/Junior School Age';
    case 'junior_school_age': return 'Junior School Age';
    case 'infant_community_nido': return 'Infant Community (Nido)';
    case 'pre_casa_toddler': return 'Pre-Casa (Toddler)';
    case 'casa_childrens_house': return "Casa (Children's House)";
    case 'sr_casa': return 'Sr. Casa';
    case 'lower_elementary': return 'Lower Elementary';
    case 'upper_elementary': return 'Upper Elementary';
    case 'secondary': return 'Secondary';
    case 'junior_kindergarten_jk': return 'Junior Kindergarten (JK)';
    case 'senior_kindergarten_sk': return 'Senior Kindergarten (SK)';
    case 'grade1': return 'Grade 1';
    case 'grade2': return 'Grade 2';
    case 'grade3': return 'Grade 3';
    case 'grade4': return 'Grade 4';
    case 'grade5': return 'Grade 5';
    case 'grade6': return 'Grade 6';
    case 'grade7': return 'Grade 7';
    case 'grade8': return 'Grade 8';
    case 'grade9': return 'Grade 9';
    case 'grade10': return 'Grade 10';
    case 'grade11': return 'Grade 11';
    case 'grade12': return 'Grade 12';
    default: return grade;
  }
}

function slugify(text) {
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

async function run() {
  const schoolNameArg = process.argv[2] || 'test school 10';

  try {
    await connectDB();
    console.log('✅ Connected to DB');

    // Find school by case-insensitive name match
    const school = await School.findOne({ name: new RegExp(`^${schoolNameArg}$`, 'i') });
    if (!school) {
      console.error(`❌ School not found: ${schoolNameArg}`);
      process.exit(1);
    }
    console.log(`🏫 Target school: ${school.name} (${school._id})`);

    const classes = await ClassModel.find({ schoolId: school._id });
    if (classes.length === 0) {
      console.log('⚠️  No classes found for this school');
      process.exit(0);
    }
    console.log(`📚 Found ${classes.length} classes. Adding 10 students per class...`);

    let totalCreated = 0;

    for (const cls of classes) {
      const displayGrade = formatGradeForDisplay(cls.grade);
      const className = cls.name || `${displayGrade}`;
      const classSlug = slugify(className || displayGrade || 'class');

      const studentsToCreate = [];
      const timestamp = Date.now();
      for (let i = 1; i <= 10; i++) {
        const firstName = `Student${i}`;
        const lastName = classSlug.toUpperCase();
        const uniqueToken = `${timestamp}_${i}`;
        const parentEmail = `parent_${classSlug}_${uniqueToken}@example.com`;
        const studentEmail = `student_${classSlug}_${uniqueToken}@example.com`;

        studentsToCreate.push({
          firstName,
          lastName,
          email: studentEmail,
          role: 'parent',
          schoolId: school._id,
          studentGrade: displayGrade,
          studentClass: className,
          parentName: `Parent ${firstName}`,
          parentEmail,
          parentPhone: '+1-555-0000',
          enrollmentDate: new Date(),
          isActive: true,
          isEmailVerified: false,
        });
      }

      const created = await User.insertMany(studentsToCreate);
      totalCreated += created.length;
      console.log(`✅ ${created.length} students added to class: ${className}`);
    }

    console.log(`🎉 Done. Created ${totalCreated} students across ${classes.length} classes.`);
  } catch (err) {
    console.error('❌ Error adding students:', err);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 DB connection closed');
    process.exit(0);
  }
}

run();

