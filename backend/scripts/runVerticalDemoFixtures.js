/* Strictly additive fixtures. Importing this module performs no database I/O. */
const { DEMO_SCHOOL_SLUGS, userDefaults, verticalDemos, creationOrder } = require('./verticalDemoFixtures');
const APPROVED_SLUGS = ['barrana-swimming-demo', 'barrana-montessori-demo'];
const GROUPS = ['users', 'children', 'programs', 'levels', 'requirements', 'parameters', 'classes', 'enrollments', 'reportTemplates'];
// Explicit approved bindings: never infer a level from a class name or current enrollment.
const CLASS_BINDINGS = {
  'barrana-swimming-demo': {
    'water-confidence-sat': ['learn-to-swim', 'water-confidence'],
    'beginner-tue': ['learn-to-swim', 'beginner'],
    'stroke-dev-thu': ['learn-to-swim', 'stroke-development']
  },
  'barrana-montessori-demo': {
    'casa-morning': ['casa-early-development', null],
    'casa-afternoon': ['casa-early-development', null]
  }
};
const conflict = (slug, type, key, reason) => ({ targetSchool: slug, entityType: type, fixtureKey: key, action: 'conflict', reason });
const nonempty = value => typeof value === 'string' && value.trim().length > 0;
const sameId = (a, b) => a != null && b != null && String(a) === String(b);
function assertApprovedSlug(slug) {
  if (!APPROVED_SLUGS.includes(slug) || !DEMO_SCHOOL_SLUGS.includes(slug)) throw new Error(`Unsupported demo school slug: ${slug}`);
}
function preflight(f, slug) {
  assertApprovedSlug(slug);
  const errors = [];
  const fail = (type, key, reason) => errors.push(conflict(slug, type, key, reason));
  if (f.school?.slug !== slug) fail('school', slug, 'fixture school slug does not match approved target');
  const maps = {};
  for (const group of GROUPS) {
    maps[group] = new Map();
    if (!Array.isArray(f[group])) { fail(group, null, 'missing fixture array'); continue; }
    for (const item of f[group]) {
      if (!item || !nonempty(item.key) || maps[group].has(item.key)) { fail(group, item?.key, 'missing or duplicate fixture key'); continue; }
      maps[group].set(item.key, item);
      if (item.schoolId !== undefined) fail(group, item.key, 'fixture schoolId overrides are forbidden');
    }
  }
  const identities = new Set();
  const unique = (type, item, identity) => {
    const token = JSON.stringify([type, ...identity]);
    if (identities.has(token)) fail(type, item.key, 'duplicate fixture identity');
    identities.add(token);
  };
  for (const x of maps.users.values()) {
    if (!nonempty(x.email)) fail('user', x.key, 'missing email identity');
    else unique('user', x, [x.email.trim().toLowerCase()]);
    if (!['school_admin', 'teacher', 'parent'].includes(x.role)) fail('user', x.key, 'invalid approved user role');
  }
  if (maps.users.get('parent')?.role !== 'parent') fail('user', 'parent', 'missing parent dependency');
  for (const x of maps.children.values()) {
    if (typeof x.studentId !== 'string' || !x.studentId.trim() || x.studentId !== x.studentId.trim().toUpperCase()) fail('child', x.key, 'missing or invalid studentId');
    else unique('child', x, [x.studentId]);
    if (x.email && maps.users.size && [...maps.users.values()].some(u => u.email?.trim().toLowerCase() === x.email.trim().toLowerCase())) fail('child', x.key, 'child email collides with adult fixture');
  }
  for (const group of ['programs', 'levels', 'requirements', 'parameters', 'classes', 'reportTemplates']) {
    for (const x of maps[group].values()) {
      if (!nonempty(x.name)) fail(group, x.key, 'missing name identity');
      unique(group, x, [x.programKey || '', x.levelKey || '', x.requirementKey || '', x.name?.trim()]);
    }
  }
  for (const x of maps.levels.values()) if (!maps.programs.has(x.programKey)) fail('level', x.key, 'invalid program dependency');
  for (const x of maps.requirements.values()) {
    if (!maps.programs.has(x.programKey) || maps.levels.get(x.levelKey)?.programKey !== x.programKey) fail('requirement', x.key, 'level/program relationship mismatch');
  }
  for (const x of maps.parameters.values()) {
    const requirement = maps.requirements.get(x.requirementKey);
    if (!maps.programs.has(x.programKey) || maps.levels.get(x.levelKey)?.programKey !== x.programKey || !requirement || requirement.programKey !== x.programKey || requirement.levelKey !== x.levelKey) fail('parameter', x.key, 'requirement/program/level relationship mismatch');
  }
  for (const x of maps.classes.values()) {
    const binding = CLASS_BINDINGS[slug][x.key];
    if (!binding || !maps.programs.has(binding[0]) || (binding[1] ? maps.levels.get(binding[1])?.programKey !== binding[0] || x.levelIndependent === true : x.levelIndependent !== true)) fail('class', x.key, 'missing or inconsistent approved class binding');
  }
  for (const x of maps.enrollments.values()) {
    const binding = CLASS_BINDINGS[slug][x.classKey];
    if (!maps.children.has(x.childKey) || !maps.programs.has(x.programKey) || maps.levels.get(x.levelKey)?.programKey !== x.programKey || !maps.classes.has(x.classKey) || !binding || binding[0] !== x.programKey || (binding[1] && binding[1] !== x.levelKey)) fail('enrollment', x.key, 'invalid child/program/level/class relationship');
    unique('enrollment', x, [x.childKey, x.programKey]);
  }
  return errors;
}
function loadModels() {
  const mongoose = require('mongoose');
  // Set before registering models, including when a caller already has a connection.
  mongoose.set('autoIndex', false);
  mongoose.set('autoCreate', false);
  mongoose.connection.config.autoIndex = false;
  mongoose.connection.config.autoCreate = false;
  const models = {};
  for (const name of ['School', 'User', 'Program', 'Level', 'Requirement', 'Parameter', 'Class', 'Enrollment', 'ReportTemplate']) {
    models[name] = require(`../models/${name}`);
    models[name].schema.set('autoIndex', false);
    models[name].schema.set('autoCreate', false);
  }
  return { mongoose, models };
}
function comparable(value) {
  if (value && typeof value.toHexString === 'function') return value.toHexString();
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(comparable);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(k => [k, comparable(value[k])]));
  return value;
}
function differences(existing, payload, prefix = '') {
  const fields = [];
  for (const [key, value] of Object.entries(payload)) {
    if (value === undefined || ['_id', 'password'].includes(key)) continue;
    const path = prefix + key;
    if (value && typeof value === 'object' && !Array.isArray(value) && !value.toHexString && !(value instanceof Date)) fields.push(...differences(existing?.[key], value, path + '.'));
    else if (JSON.stringify(comparable(existing?.[key])) !== JSON.stringify(comparable(value))) fields.push(path);
  }
  return fields;
}
async function findMatch(entry, slug) {
  const rows = await entry.Model.find(entry.query).limit(2).lean();
  if (rows.length > 1) throw Object.assign(new Error('multiple records match tenant identity'), { detail: conflict(slug, entry.type, entry.key, 'multiple records match tenant identity') });
  const old = rows[0];
  if (old && entry.type !== 'school' && !sameId(old.schoolId, entry.payload.schoolId)) throw Object.assign(new Error('school ownership mismatch'), { detail: conflict(slug, entry.type, entry.key, 'school ownership mismatch') });
  // Relationship fields omitted from a conservative identity query must still agree.
  if (old && entry.type !== 'enrollment') {
    for (const field of ['programId', 'levelId', 'requirementId']) if (entry.payload[field] !== undefined && !sameId(old[field], entry.payload[field])) throw Object.assign(new Error('dependency ownership mismatch'), { detail: conflict(slug, entry.type, entry.key, `${field} dependency mismatch; no replacement allowed`) });
  }
  return old;
}
const running = new Set();
async function runVerticalDemo({ slug, dryRun = true } = {}) {
  assertApprovedSlug(slug);
  if (typeof dryRun !== 'boolean') throw new Error('dryRun must be a boolean');
  if (running.has(slug)) return { targetSchool: slug, dryRun, conflicts: [conflict(slug, 'school', slug, 'fixture already running in this process')], results: [] };
  running.add(slug);
  const report = { targetSchool: slug, dryRun, creationOrder, preflightPassed: false, conflicts: [], validationFailures: [], results: [] };
  try {
    const f = slug === 'barrana-swimming-demo' ? verticalDemos.swimming : verticalDemos.montessori;
    report.conflicts.push(...preflight(f, slug));
    if (report.conflicts.length) return report;
    const { mongoose, models: M } = loadModels();
    const plan = [], identities = new Set();
    const add = async (Model, type, key, query, payload, dependencies = []) => {
      const entry = { Model, type, key, query, payload, dependencies };
      const identity = JSON.stringify([Model.modelName, comparable(query)]);
      if (identities.has(identity)) throw Object.assign(new Error('duplicate resolved identity'), { detail: conflict(slug, type, key, 'duplicate resolved fixture identity') });
      identities.add(identity);
      entry.old = await findMatch(entry, slug);
      entry.id = entry.old?._id || new mongoose.Types.ObjectId();
      entry.result = { targetSchool: slug, entityType: type, fixtureKey: key, action: entry.old ? 'existing' : 'missing', reason: entry.old ? 'existing / preserved' : 'missing / would create', ...(entry.old ? { recordId: String(entry.id) } : {}) };
      if (entry.old) {
        const changed = differences(entry.old, payload);
        if (changed.length) Object.assign(entry.result, { reason: 'existing record differs / preserved', differingFields: changed });
      } else {
        entry.payload = { ...payload, _id: entry.id };
        entry.document = new Model(entry.payload);
        try { await entry.document.validate(); }
        catch (error) {
          entry.result.action = 'validation_failure';
          entry.result.reason = 'validation failure';
          // Field paths only: validation messages can contain fixture credentials.
          entry.result.fields = Object.keys(error.errors || {}).sort();
          report.validationFailures.push({ ...entry.result });
        }
      }
      plan.push(entry);
      report.results.push(entry.result);
      return entry;
    };
    const school = await add(M.School, 'school', slug, { slug }, { ...f.school });
    const schoolId = school.id, users = {}, children = {}, programs = {}, levels = {}, requirements = {}, classes = {};
    for (const x of f.users) {
      const { key, ...data } = x;
      users[key] = await add(M.User, 'user', key, { schoolId, email: x.email.trim().toLowerCase() }, { ...userDefaults, ...data, schoolId }, [school]);
    }
    for (const x of f.children) {
      const { key, ...data } = x;
      children[key] = await add(M.User, 'child', key, { schoolId, studentId: x.studentId }, { ...data, role: 'student', schoolId, parentId: users.parent.id, parentEmail: users.parent.old?.email || users.parent.payload.email, password: userDefaults.password }, [school, users.parent]);
    }
    for (const x of f.programs) programs[x.key] = await add(M.Program, 'program', x.key, { schoolId, name: x.name.trim() }, { schoolId, name: x.name, description: x.description }, [school]);
    for (const x of f.levels) {
      const p = programs[x.programKey];
      levels[x.key] = await add(M.Level, 'level', x.key, { schoolId, programId: p.id, name: x.name.trim() }, { schoolId, programId: p.id, name: x.name, sequence: x.sequence }, [school, p]);
    }
    for (const x of f.requirements) {
      const p = programs[x.programKey], l = levels[x.levelKey];
      requirements[x.key] = await add(M.Requirement, 'requirement', x.key, { schoolId, levelId: l.id, name: x.name.trim() }, { schoolId, programId: p.id, levelId: l.id, name: x.name, sequence: x.sequence }, [school, p, l]);
    }
    for (const x of f.parameters) {
      const p = programs[x.programKey], l = levels[x.levelKey], r = requirements[x.requirementKey];
      await add(M.Parameter, 'parameter', x.key, { schoolId, requirementId: r.id, name: x.name.trim() }, { schoolId, programId: p.id, requirementId: r.id, name: x.name, type: x.type, options: x.options }, [school, p, l, r]);
    }
    for (const x of f.classes) classes[x.key] = await add(M.Class, 'class', x.key, { schoolId, name: x.name.trim() }, { schoolId, name: x.name, grade: x.grade, schedule: { academicYear: x.academicYear, semester: x.semester } }, [school]);
    for (const x of f.enrollments) {
      const child = children[x.childKey], p = programs[x.programKey], l = levels[x.levelKey], c = classes[x.classKey];
      // Status and placement are operational state, not replacement identities.
      await add(M.Enrollment, 'enrollment', x.key, { schoolId, childId: child.id, programId: p.id }, { schoolId, childId: child.id, programId: p.id, currentLevelId: l.id, currentClassId: c.id, status: 'active' }, [school, child, p, l, c]);
    }
    for (const x of f.reportTemplates) await add(M.ReportTemplate, 'reportTemplate', x.key, { schoolId, name: x.name.trim() }, { schoolId, name: x.name }, [school]);
    if (report.validationFailures.length) return report;
    report.preflightPassed = true;
    if (dryRun) return report;
    // A second complete read pass detects changes since planning before the first insert.
    for (const entry of plan) {
      const current = await findMatch(entry, slug);
      if (Boolean(current) !== Boolean(entry.old) || (current && !sameId(current._id, entry.id))) throw Object.assign(new Error('identity changed after preflight'), { detail: conflict(slug, entry.type, entry.key, 'identity changed after preflight; rerun required') });
    }
    for (const entry of plan) {
      if (entry.old) continue; // Never save or update an existing document.
      for (const dependency of entry.dependencies) {
        const current = await findMatch(dependency, slug);
        if (!current || !sameId(current._id, dependency.id)) throw Object.assign(new Error('dependency changed'), { detail: conflict(slug, entry.type, entry.key, 'dependency changed before insert; stopped') });
      }
      if (await findMatch(entry, slug)) throw Object.assign(new Error('identity appeared before insert'), { detail: conflict(slug, entry.type, entry.key, 'identity appeared before insert; preserved, rerun required') });
      try {
        // Only new, already validated payloads reach create. User's model hashes once.
        const created = await entry.Model.create(entry.document.toObject());
        Object.assign(entry.result, { action: 'created', reason: 'missing / created', recordId: String(created._id) });
      } catch (error) {
        const action = error.name === 'ValidationError' ? 'validation_failure' : 'conflict';
        const detail = { ...conflict(slug, entry.type, entry.key, 'insert failed; stopped without rollback'), action, code: error.code, fields: Object.keys(error.errors || {}).sort() };
        (action === 'conflict' ? report.conflicts : report.validationFailures).push(detail);
        entry.result.action = action;
        entry.result.reason = detail.reason;
        break;
      }
    }
    return report;
  } catch (error) {
    report.conflicts.push(error.detail || conflict(slug, 'runner', slug, 'preflight/execution failed; stopped without further writes'));
    return report;
  } finally { running.delete(slug); }
}
module.exports = { runVerticalDemo, assertApprovedSlug, preflight };
