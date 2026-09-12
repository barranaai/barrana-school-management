const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: require('path').join(__dirname, '..', 'config.env') });
const User = require('../models/User');
const School = require('../models/School');
const Class = require('../models/Class');

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/barrana_ai';
const DEMO_PASSWORD = process.env.KIDSIBLE_DEMO_PASSWORD;
if (typeof DEMO_PASSWORD !== 'string' || !DEMO_PASSWORD.trim()) {
  throw new Error('KIDSIBLE_DEMO_PASSWORD must be explicitly configured before running demo setup');
}
const DEMO_SCHOOL = { name: 'Kidsible Demo Academy', slug: 'kidsible-demo-academy', schoolType: 'montessori_school', estimatedStudents: 1, gradeLevels: ['early-learning'], address: { street: '1 Kidsible Way', city: 'Toronto', state: 'ON', zipCode: 'M1M 1M1', country: 'Canada' }, contactPerson: { name: 'Demo Administrator', email: 'admin@kidsible.local', phone: '+1-555-0100', role: 'School Administrator' }, isActive: true };
const accounts = [
  { firstName: 'Demo', lastName: 'Super Administrator', email: 'superadmin@kidsible.local', role: 'super_admin' },
  { firstName: 'Demo', lastName: 'School Administrator', email: 'admin@kidsible.local', role: 'school_admin' },
  { firstName: 'Demo', lastName: 'Teacher', email: 'teacher@kidsible.local', role: 'teacher', grade: 'early-learning' },
  { firstName: 'Demo', lastName: 'Parent', email: 'parent@kidsible.local', role: 'parent' }
];
async function ensureUser(data, schoolId) {
  let user = await User.findOne({ email: data.email });
  if (user) return user;
  user = await User.create({ ...data, schoolId: data.role === 'super_admin' ? undefined : schoolId, password: DEMO_PASSWORD, isEmailVerified: true, isActive: true });
  return user;
}
async function main() {
  await mongoose.connect(MONGO_URI);
  let school = await School.findOne({ slug: DEMO_SCHOOL.slug });
  if (!school) school = await School.create(DEMO_SCHOOL);
  const users = {};
  for (const account of accounts) users[account.role] = await ensureUser(account, school._id);
  if (!school.adminId) { school.adminId = users.school_admin._id; await school.save(); }
  let child = await User.findOne({ email: 'child@kidsible.local' });
  if (!child) child = await User.create({ firstName: 'Demo', lastName: 'Child', email: 'child@kidsible.local', password: DEMO_PASSWORD, role: 'student', schoolId: school._id, studentId: 'KIDSIBLE-DEMO-001', studentGrade: 'early-learning', grade: 'early-learning', parentId: users.parent._id, parentName: `${users.parent.firstName} ${users.parent.lastName}`, parentEmail: users.parent.email, isEmailVerified: true, isActive: true });
  let group = await Class.findOne({ schoolId: school._id, name: 'Demo Class' });
  if (!group) group = await Class.create({ name: 'Demo Class', schoolId: school._id, grade: 'early-learning', description: 'Development-only demonstration class', assignedTeachers: [{ teacherId: users.teacher._id, role: 'primary', assignedDate: new Date() }], createdBy: users.school_admin._id, schedule: { academicYear: '2026-2027', semester: 'fall' }, status: 'active' });
  if (!child.classId || String(child.classId) !== String(group._id)) { child.classId = group._id; child.studentClass = group.name; await child.save(); }
  console.log(JSON.stringify({ school: school.slug, createdOrPresent: accounts.map(a => a.email).concat(child.email), class: group.name }));
}
main().catch(error => { console.error('Demo setup failed:', error.message); process.exitCode = 1; }).finally(async () => { await mongoose.connection.close(); });