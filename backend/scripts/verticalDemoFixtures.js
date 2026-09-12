/* Data-only, non-executing definitions for approved vertical demo tenants. */
const DEMO_SCHOOL_SLUGS = Object.freeze(['barrana-swimming-demo', 'barrana-montessori-demo']);
const userDefaults = Object.freeze({
  get password() {
    const password = process.env.KIDSIBLE_DEMO_PASSWORD;
    if (typeof password !== 'string' || !password.trim()) {
      throw new Error('KIDSIBLE_DEMO_PASSWORD must be explicitly configured before preparing user fixtures');
    }
    return password;
  },
  isEmailVerified: true,
  isActive: true
});
const verticalDemos = Object.freeze({
  swimming: {
    school: { slug: 'barrana-swimming-demo', name: 'Barrana Swimming Demo', schoolType: 'public_private_school', gradeLevels: [] },
    users: [
      { key: 'admin', firstName: 'Avery', lastName: 'Swimming Demo', email: 'swimming-admin@kidsible.local', role: 'school_admin' },
      { key: 'teacher', firstName: 'Morgan', lastName: 'Swimming Demo', email: 'swimming-coach@kidsible.local', role: 'teacher' },
      { key: 'parent', firstName: 'Taylor', lastName: 'Swimming Demo', email: 'swimming-parent@kidsible.local', role: 'parent' }
    ],
    children: [
      { key: 'child-1', firstName: 'Maya', lastName: 'Swimming Demo', studentId: 'SWIM-DEMO-001' },
      { key: 'child-2', firstName: 'Leo', lastName: 'Swimming Demo', studentId: 'SWIM-DEMO-002' },
      { key: 'child-3', firstName: 'Nora', lastName: 'Swimming Demo', studentId: 'SWIM-DEMO-003' }
    ],
    programs: [{ key: 'learn-to-swim', name: 'Learn-to-Swim', description: 'Water safety and stroke development.' }],
    levels: [
      { key: 'water-confidence', programKey: 'learn-to-swim', sequence: 1, name: 'Water Confidence' }, { key: 'beginner', programKey: 'learn-to-swim', sequence: 2, name: 'Beginner' },
      { key: 'stroke-development', programKey: 'learn-to-swim', sequence: 3, name: 'Stroke Development' }, { key: 'advanced', programKey: 'learn-to-swim', sequence: 4, name: 'Advanced' }
    ],
    requirements: [
      { key: 'safe-entry', programKey: 'learn-to-swim', levelKey: 'water-confidence', sequence: 1, name: 'Safe pool entry' }, { key: 'float', programKey: 'learn-to-swim', levelKey: 'water-confidence', sequence: 2, name: 'Front and back float' },
      { key: 'kick', programKey: 'learn-to-swim', levelKey: 'beginner', sequence: 1, name: 'Kick and streamline' }, { key: 'breathing', programKey: 'learn-to-swim', levelKey: 'beginner', sequence: 2, name: 'Freestyle breathing' },
      { key: 'freestyle', programKey: 'learn-to-swim', levelKey: 'stroke-development', sequence: 1, name: 'Stroke technique' }, { key: 'endurance', programKey: 'learn-to-swim', levelKey: 'advanced', sequence: 1, name: 'Stroke endurance' }
    ],
    parameters: [
      { key: 'confidence-rating', programKey: 'learn-to-swim', levelKey: 'water-confidence', requirementKey: 'safe-entry', name: 'Confidence rating', type: 'rating' }, { key: 'float-duration', programKey: 'learn-to-swim', levelKey: 'water-confidence', requirementKey: 'float', name: 'Float duration (seconds)', type: 'number' },
      { key: 'kick-quality', programKey: 'learn-to-swim', levelKey: 'beginner', requirementKey: 'kick', name: 'Kick quality', type: 'select', options: ['Emerging', 'Developing', 'Consistent'] }, { key: 'breathing-score', programKey: 'learn-to-swim', levelKey: 'beginner', requirementKey: 'breathing', name: 'Skill consistency', type: 'percentage' },
      { key: 'freestyle-complete', programKey: 'learn-to-swim', levelKey: 'stroke-development', requirementKey: 'freestyle', name: 'Freestyle completed', type: 'checkbox' }, { key: 'instructor-note', programKey: 'learn-to-swim', levelKey: 'advanced', requirementKey: 'endurance', name: 'Instructor observation', type: 'text' }
    ],
    classes: [
      { key: 'water-confidence-sat', name: 'Water Confidence - Saturday', grade: 'early-learning', academicYear: '2026-2027', semester: 'fall' },
      { key: 'beginner-tue', name: 'Beginner - Tuesday', grade: 'early-learning', academicYear: '2026-2027', semester: 'fall' },
      { key: 'stroke-dev-thu', name: 'Stroke Development - Thursday', grade: 'early-learning', academicYear: '2026-2027', semester: 'fall' }
    ],
    enrollments: [
      { key: 'child-1-beginner', childKey: 'child-1', programKey: 'learn-to-swim', levelKey: 'beginner', classKey: 'beginner-tue' }, { key: 'child-2-water-confidence', childKey: 'child-2', programKey: 'learn-to-swim', levelKey: 'water-confidence', classKey: 'water-confidence-sat' }, { key: 'child-3-stroke-development', childKey: 'child-3', programKey: 'learn-to-swim', levelKey: 'stroke-development', classKey: 'stroke-dev-thu' }
    ],
    reportTemplates: [{ key: 'learn-to-swim-progress', name: 'Learn-to-Swim Progress Report' }]
  },
  montessori: {
    school: { slug: 'barrana-montessori-demo', name: 'Barrana Montessori Demo', schoolType: 'montessori_school', gradeLevels: ['early-learning'] },
    users: [
      { key: 'admin', firstName: 'Jordan', lastName: 'Montessori Demo', email: 'montessori-admin@kidsible.local', role: 'school_admin' }, { key: 'teacher', firstName: 'Riley', lastName: 'Montessori Demo', email: 'montessori-guide@kidsible.local', role: 'teacher' }, { key: 'parent', firstName: 'Casey', lastName: 'Montessori Demo', email: 'montessori-parent@kidsible.local', role: 'parent' }
    ],
    children: [{ key: 'child-1', firstName: 'Ava', lastName: 'Montessori Demo', studentId: 'MONT-DEMO-001' }, { key: 'child-2', firstName: 'Owen', lastName: 'Montessori Demo', studentId: 'MONT-DEMO-002' }],
    programs: [{ key: 'casa-early-development', name: 'Casa Early Development', description: 'Practical life, sensorial, language, and social development.' }],
    levels: [{ key: 'casa-foundations', programKey: 'casa-early-development', sequence: 1, name: 'Casa Foundations' }, { key: 'emerging-independence', programKey: 'casa-early-development', sequence: 2, name: 'Emerging Independence' }, { key: 'developing-independence', programKey: 'casa-early-development', sequence: 3, name: 'Developing Independence' }, { key: 'elementary-readiness', programKey: 'casa-early-development', sequence: 4, name: 'Elementary Readiness' }],
    requirements: [{ key: 'practical-life', programKey: 'casa-early-development', levelKey: 'casa-foundations', sequence: 1, name: 'Practical-life routines' }, { key: 'sensorial-exploration', programKey: 'casa-early-development', levelKey: 'emerging-independence', sequence: 1, name: 'Sensorial exploration' }, { key: 'language-expression', programKey: 'casa-early-development', levelKey: 'developing-independence', sequence: 1, name: 'Language and expression' }, { key: 'independent-work', programKey: 'casa-early-development', levelKey: 'elementary-readiness', sequence: 1, name: 'Elementary readiness' }],
    parameters: [{ key: 'routine-independence', programKey: 'casa-early-development', levelKey: 'casa-foundations', requirementKey: 'practical-life', name: 'Independence rating', type: 'rating' }, { key: 'material-choice', programKey: 'casa-early-development', levelKey: 'emerging-independence', requirementKey: 'sensorial-exploration', name: 'Material choice', type: 'checkbox' }, { key: 'language-observation', programKey: 'casa-early-development', levelKey: 'developing-independence', requirementKey: 'language-expression', name: 'Guide observation', type: 'text' }, { key: 'work-cycle-minutes', programKey: 'casa-early-development', levelKey: 'elementary-readiness', requirementKey: 'independent-work', name: 'Focused work cycle (minutes)', type: 'number' }, { key: 'readiness-stage', programKey: 'casa-early-development', levelKey: 'elementary-readiness', requirementKey: 'independent-work', name: 'Readiness stage', type: 'select', options: ['Emerging', 'Developing', 'Ready'] }, { key: 'self-management', programKey: 'casa-early-development', levelKey: 'elementary-readiness', requirementKey: 'independent-work', name: 'Self-management consistency', type: 'percentage' }],
    classes: [{ key: 'casa-morning', name: 'Casa Foundations - Morning', levelIndependent: true, grade: 'early-learning', academicYear: '2026-2027', semester: 'fall' }, { key: 'casa-afternoon', name: 'Elementary Readiness - Afternoon', levelIndependent: true, grade: 'early-learning', academicYear: '2026-2027', semester: 'fall' }],
    enrollments: [{ key: 'child-1-casa', childKey: 'child-1', programKey: 'casa-early-development', levelKey: 'emerging-independence', classKey: 'casa-morning' }, { key: 'child-2-casa', childKey: 'child-2', programKey: 'casa-early-development', levelKey: 'casa-foundations', classKey: 'casa-afternoon' }],
    reportTemplates: [{ key: 'montessori-developmental-observation', name: 'Montessori Developmental Observation' }]
  }
});

module.exports = Object.freeze({ DEMO_SCHOOL_SLUGS, userDefaults, verticalDemos, creationOrder: Object.freeze(['school', 'users', 'children', 'programs', 'levels', 'requirements', 'parameters', 'classes', 'enrollments', 'reportTemplates']) });
