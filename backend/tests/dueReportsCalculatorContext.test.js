const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const moment = require('moment-timezone');

const ids = {
  school: '000000000000000000000001', teacher: '000000000000000000000002',
  child: '000000000000000000000003', group: '000000000000000000000004',
  enrollment: '000000000000000000000005', program: '000000000000000000000006',
  otherProgram: '000000000000000000000007', level: '000000000000000000000008',
  otherLevel: '000000000000000000000009'
};

const chain = value => ({
  select() { return this; }, populate() { return this; }, sort() { return this; },
  lean() { return Promise.resolve(value); }, then(resolve, reject) { return Promise.resolve(value).then(resolve, reject); }
});

function loadCalculator({ templates, academic = false, enrollment = {} }) {
  const observed = {};
  const teacher = { _id: ids.teacher, schoolId: ids.school, firstName: 'Test', lastName: 'Teacher' };
  const child = { _id: ids.child, firstName: 'Test', lastName: 'Child', studentGrade: 'Grade 2', studentClass: 'Group A' };
  const rows = [{
    _id: ids.enrollment, childId: ids.child, currentClassId: ids.group,
    programId: ids.program, currentLevelId: ids.level, status: 'active', ...enrollment
  }];
  const models = {
    Report: { findOne(query) { observed.report = query; return chain(null); } },
    ReportTemplate: { find(query) { observed.templates = query; return chain(templates); } },
    User: {
      findById(value) { observed.teacherId = value; return chain(teacher); },
      find(query) { observed.students = query; return chain([child]); }
    },
    School: { findById(value) { observed.schoolId = value; return chain({
      _id: ids.school, settings: { timezone: 'UTC' }, accountType: 'organization',
      organizationType: academic ? 'school' : 'sports_club', terminologyProfile: academic ? 'education' : 'training'
    }); } },
    Enrollment: { find(query) { observed.enrollments = query; return chain(rows); } },
    Class: { find(query) { observed.groups = query; return chain([{ _id: ids.group, name: 'Group A' }]); } }
  };
  const dependencies = {
    'moment-timezone': moment,
    '../utils/logger': { logger: { info() {}, warn() {}, error() {} } },
    './reportTemplateContext': require('../services/reportTemplateContext'),
    '../domain/workspaceProfile': require('../domain/workspaceProfile'),
    '../utils/dateUtils': { calculateDueDate: (_frequency, _settings, now) => ({ dueDate: now.clone().subtract(2, 'days') }) }
  };
  for (const [name, model] of Object.entries(models)) dependencies[`../models/${name}`] = model;
  const filename = path.join(__dirname, '../services/dueReportsCalculator.js');
  const box = { module: { exports: {} }, console, process, Date, require(name) {
    if (Object.hasOwn(dependencies, name)) return dependencies[name];
    throw new Error(`Unexpected dependency: ${name}`);
  } };
  vm.runInNewContext(fs.readFileSync(filename, 'utf8'), box, { filename });
  return { calculator: box.module.exports, observed };
}

const template = (id, name, fields) => ({
  _id: id, name, schoolId: ids.school, reportFrequency: 'Monthly', isActive: true, ...fields
});

test('due reports use authoritative Enrollment Program and Level and order equal exact matches deterministically', async () => {
  const templates = [
    template('000000000000000000000020', 'Zeta exact', { programId: ids.program, levelId: ids.level }),
    template('000000000000000000000021', 'Alpha exact', { programId: ids.program, levelId: ids.level }),
    template('000000000000000000000022', 'Program fallback', { programId: ids.program, levelId: null }),
    template('000000000000000000000023', 'Wrong level', { programId: ids.program, levelId: ids.otherLevel }),
    template('000000000000000000000024', 'Legacy grade', { grade: 'Grade 2', programId: null, levelId: null })
  ];
  const { calculator, observed } = loadCalculator({ templates, enrollment: { programId: ids.program, currentLevelId: ids.level } });
  const result = await calculator.calculateDueReportsForTeacher(ids.teacher);
  assert.equal(Array.from(result, row => row.templateName).join('|'), 'Alpha exact|Zeta exact');
  assert.ok(result.every(row => row.programId === ids.program && row.levelId === ids.level));
  assert.equal(String(observed.enrollments.schoolId), ids.school);
  assert.equal(Array.from(observed.enrollments.status.$in).join('|'), 'active|pending');
  assert.equal(Array.from(observed.enrollments.currentClassId.$in).join('|'), ids.group);
});

test('Program-wide template is selected when no Level-specific template matches', async () => {
  const templates = [
    template('000000000000000000000030', 'Program fallback', { programId: ids.program, levelId: null }),
    template('000000000000000000000031', 'Other Program', { programId: ids.otherProgram, levelId: null }),
    template('000000000000000000000032', 'Wrong level', { programId: ids.program, levelId: ids.otherLevel })
  ];
  const { calculator } = loadCalculator({ templates });
  const result = await calculator.calculateDueReportsForTeacher(ids.teacher);
  assert.equal(Array.from(result, row => row.templateName).join('|'), 'Program fallback');
});

test('academic organizations retain matching legacy grade-template compatibility', async () => {
  const templates = [
    template('000000000000000000000040', 'Grade 2 legacy', { grade: 'grade2', programId: null, levelId: null }),
    template('000000000000000000000041', 'Wrong legacy grade', { grade: 'Grade 3', programId: null, levelId: null })
  ];
  const { calculator } = loadCalculator({ templates, academic: true });
  const result = await calculator.calculateDueReportsForTeacher(ids.teacher);
  assert.equal(Array.from(result, row => row.templateName).join('|'), 'Grade 2 legacy');
  assert.equal(result[0].enrollmentId, ids.enrollment);
});
