const { gradesMatch } = require('../utils/gradeUtils');

const id = value => String(value?._id || value || '');

function compatibility(template, context) {
  if (!template?.isActive || id(template.schoolId) !== id(context.schoolId)) return 0;
  if (template.programId) {
    if (id(template.programId) !== id(context.programId)) return 0;
    if (template.levelId && id(template.levelId) !== id(context.levelId)) return 0;
    if (template.grade && (!context.grade || !gradesMatch(template.grade, context.grade))) return 0;
    return template.levelId ? 3 : 2;
  }
  if (!context.allowLegacyGrade || !template.grade || !context.grade) return 0;
  return gradesMatch(template.grade, context.grade) ? 1 : 0;
}

function compatibleTemplates(templates, context) {
  const ranked = templates.map(template => ({ template, rank: compatibility(template, context) })).filter(row => row.rank > 0);
  if (!ranked.length) return [];
  const highest = Math.max(...ranked.map(row => row.rank));
  return ranked.filter(row => row.rank === highest).map(row => row.template).sort((a, b) =>
    String(a.name).localeCompare(String(b.name)) || String(a.reportFrequency).localeCompare(String(b.reportFrequency)) || id(a._id).localeCompare(id(b._id))
  );
}

module.exports = { compatibility, compatibleTemplates, id };
