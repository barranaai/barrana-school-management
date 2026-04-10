/**
 * GRADE NORMALIZATION UTILITIES (Backend)
 *
 * SINGLE SOURCE OF TRUTH for grade name standardization on the backend.
 * Mirrors src/utils/gradeDisplayUtils.ts on the frontend.
 *
 * Canonical grade names (display format) stored in the database:
 *   studentGrade, ReportTemplate.grade, Class.grade, School.gradeLevels
 *
 * All comparisons MUST go through normalizeGrade() to handle:
 *  - Raw codes:    'pre_casa_toddler', 'grade1'
 *  - Display names: 'Pre-Casa (Toddler)', 'Grade 1'
 *  - Legacy variants: 'Pre Casa/Toddler', 'Pre-Casa Toddler', etc.
 */

/** Map: raw code → canonical display name */
const GRADE_DISPLAY_NAMES = {
  // Licensed Daycare
  infant: 'Infant',
  toddler: 'Toddler',
  preschool: 'Preschool',
  kindergarten: 'Kindergarten',
  primary_junior_school_age: 'Primary/Junior School Age',
  junior_school_age: 'Junior School Age',

  // Montessori Schools
  infant_community_nido: 'Infant Community (Nido)',
  pre_casa_toddler: 'Pre-Casa (Toddler)',
  casa_childrens_house: "Casa (Children's House)",
  sr_casa: 'Sr. Casa',
  lower_elementary: 'Lower Elementary',
  upper_elementary: 'Upper Elementary',
  secondary: 'Secondary',

  // Public & Private Schools
  junior_kindergarten_jk: 'Junior Kindergarten (JK)',
  senior_kindergarten_sk: 'Senior Kindergarten (SK)',
  grade1: 'Grade 1',
  grade2: 'Grade 2',
  grade3: 'Grade 3',
  grade4: 'Grade 4',
  grade5: 'Grade 5',
  grade6: 'Grade 6',
  grade7: 'Grade 7',
  grade8: 'Grade 8',
  grade9: 'Grade 9',
  grade10: 'Grade 10',
  grade11: 'Grade 11',
  grade12: 'Grade 12',
};

/** Map: display name → raw code */
const DISPLAY_TO_CODE = Object.entries(GRADE_DISPLAY_NAMES).reduce((acc, [code, display]) => {
  acc[display] = code;
  return acc;
}, {});

/** Known legacy/variant spellings → canonical display name */
const GRADE_VARIANTS = {
  'Pre Casa/Toddler': 'Pre-Casa (Toddler)',
  'Pre Casa Toddler': 'Pre-Casa (Toddler)',
  'PreCasa Toddler': 'Pre-Casa (Toddler)',
  'Pre-Casa Toddler': 'Pre-Casa (Toddler)',
  'Infant Community / Nido': 'Infant Community (Nido)',
  'Infant Community/Nido': 'Infant Community (Nido)',
  "Casa / Children's House": "Casa (Children's House)",
  "Casa/Children's House": "Casa (Children's House)",
  'Sr Casa': 'Sr. Casa',
  'SrCasa': 'Sr. Casa',
};

/**
 * Convert any grade value (raw code or display name or legacy variant)
 * to its canonical DISPLAY name.
 *
 * @param {string} grade
 * @returns {string} Canonical display name (e.g. 'Pre-Casa (Toddler)', 'Grade 1')
 */
function formatGradeForDisplay(grade) {
  if (!grade) return '';
  const trimmed = grade.trim();

  // Already a known display name
  if (DISPLAY_TO_CODE[trimmed]) return trimmed;

  // Known legacy variant
  if (GRADE_VARIANTS[trimmed]) return GRADE_VARIANTS[trimmed];

  // Raw code lookup (case-insensitive)
  const lower = trimmed.toLowerCase();
  if (GRADE_DISPLAY_NAMES[lower]) return GRADE_DISPLAY_NAMES[lower];

  // "grade X" without underscore (e.g. "grade 1" or "Grade 1")
  const gradeNumMatch = lower.match(/^grade\s*(\d+)$/);
  if (gradeNumMatch) return `Grade ${gradeNumMatch[1]}`;

  // Fallback: return as-is (custom grade or already display)
  return trimmed;
}

/**
 * Normalize a grade to a stable lowercase key for comparison.
 * Two grades are equivalent iff normalizeGrade(a) === normalizeGrade(b).
 *
 * @param {string} grade
 * @returns {string} lowercase canonical display name for comparison
 */
function normalizeGrade(grade) {
  return formatGradeForDisplay(grade).toLowerCase();
}

/**
 * Check if two grade values are equivalent (format-agnostic).
 *
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
function gradesMatch(a, b) {
  if (!a || !b) return false;
  return normalizeGrade(a) === normalizeGrade(b);
}

module.exports = { formatGradeForDisplay, normalizeGrade, gradesMatch };
