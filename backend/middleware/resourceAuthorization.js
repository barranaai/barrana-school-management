const Class = require('../models/Class');
const idOf = value => value ? String(value._id || value) : null;
const sameId = (a, b) => Boolean(idOf(a) && idOf(a) === idOf(b));
const isSuperAdmin = user => user?.role === 'super_admin';
const belongsToSchool = (user, resource) => isSuperAdmin(user) || sameId(user?.schoolId, resource?.schoolId);
const canAccessReport = (user, report) => Boolean(user && report && (isSuperAdmin(user) ||
  (belongsToSchool(user, report) && (user.role === 'school_admin' ||
    (user.role === 'teacher' && sameId(user._id, report.teacherId))))));
const canAccessStudent = async (user, student) => {
  if (!user || !student) return false;
  if (isSuperAdmin(user)) return true;
  if (!belongsToSchool(user, student) || student.role !== 'student') return false;
  if (user.role === 'school_admin') return true;
  if (user.role === 'parent') return sameId(student.parentId, user._id) ||
    Boolean(student.parentEmail && user.email && student.parentEmail.toLowerCase() === user.email.toLowerCase());
  if (user.role !== 'teacher') return false;
  if (sameId(student.assignedTeacher, user._id)) return true;
  return Boolean(student.classId && await Class.exists({ _id: student.classId, schoolId: user.schoolId, 'assignedTeachers.teacherId': user._id }));
};
const scopeSchoolId = (user, requested) => isSuperAdmin(user) ? (requested || undefined) : idOf(user?.schoolId);
module.exports = { idOf, sameId, isSuperAdmin, belongsToSchool, canAccessReport, canAccessStudent, scopeSchoolId };
