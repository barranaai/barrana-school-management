/**
 * CENTRALIZED GRADE DISPLAY UTILITIES
 * 
 * SINGLE SOURCE OF TRUTH for grade display formatting across the entire application
 * Used by: SuperAdmin, Admin, Teachers, Students, Report Templates, etc.
 * 
 * This ensures consistency and prevents mismatches between:
 * - School gradeLevels array
 * - Student studentGrade field
 * - Report Template grade field
 * - Display components
 */

/**
 * Raw grade codes used in the database (school.gradeLevels array)
 * These are the standardized codes that should be stored in the database
 */
export const GRADE_CODES = {
  // Licensed Daycare
  INFANT: 'infant',
  TODDLER: 'toddler',
  PRESCHOOL: 'preschool',
  KINDERGARTEN: 'kindergarten',
  PRIMARY_JUNIOR_SCHOOL_AGE: 'primary_junior_school_age',
  JUNIOR_SCHOOL_AGE: 'junior_school_age',
  
  // Montessori Schools
  INFANT_COMMUNITY_NIDO: 'infant_community_nido',
  PRE_CASA_TODDLER: 'pre_casa_toddler',
  CASA_CHILDRENS_HOUSE: 'casa_childrens_house',
  SR_CASA: 'sr_casa',
  LOWER_ELEMENTARY: 'lower_elementary',
  UPPER_ELEMENTARY: 'upper_elementary',
  SECONDARY: 'secondary',
  
  // Public & Private Schools
  JUNIOR_KINDERGARTEN_JK: 'junior_kindergarten_jk',
  SENIOR_KINDERGARTEN_SK: 'senior_kindergarten_sk',
  GRADE1: 'grade1',
  GRADE2: 'grade2',
  GRADE3: 'grade3',
  GRADE4: 'grade4',
  GRADE5: 'grade5',
  GRADE6: 'grade6',
  GRADE7: 'grade7',
  GRADE8: 'grade8',
  GRADE9: 'grade9',
  GRADE10: 'grade10',
  GRADE11: 'grade11',
  GRADE12: 'grade12'
} as const;

/**
 * Display names for grades - THE OFFICIAL FORMAT
 * All components must use this format for consistency
 */
const GRADE_DISPLAY_NAMES: { [key: string]: string } = {
  // Licensed Daycare
  [GRADE_CODES.INFANT]: 'Infant',
  [GRADE_CODES.TODDLER]: 'Toddler',
  [GRADE_CODES.PRESCHOOL]: 'Preschool',
  [GRADE_CODES.KINDERGARTEN]: 'Kindergarten',
  [GRADE_CODES.PRIMARY_JUNIOR_SCHOOL_AGE]: 'Primary/Junior School Age',
  [GRADE_CODES.JUNIOR_SCHOOL_AGE]: 'Junior School Age',
  
  // Montessori Schools - CONSISTENT FORMAT: Use hyphen and parentheses
  [GRADE_CODES.INFANT_COMMUNITY_NIDO]: 'Infant Community (Nido)',
  [GRADE_CODES.PRE_CASA_TODDLER]: 'Pre-Casa (Toddler)',
  [GRADE_CODES.CASA_CHILDRENS_HOUSE]: "Casa (Children's House)",
  [GRADE_CODES.SR_CASA]: 'Sr. Casa',
  [GRADE_CODES.LOWER_ELEMENTARY]: 'Lower Elementary',
  [GRADE_CODES.UPPER_ELEMENTARY]: 'Upper Elementary',
  [GRADE_CODES.SECONDARY]: 'Secondary',
  
  // Public & Private Schools
  [GRADE_CODES.JUNIOR_KINDERGARTEN_JK]: 'Junior Kindergarten (JK)',
  [GRADE_CODES.SENIOR_KINDERGARTEN_SK]: 'Senior Kindergarten (SK)',
  [GRADE_CODES.GRADE1]: 'Grade 1',
  [GRADE_CODES.GRADE2]: 'Grade 2',
  [GRADE_CODES.GRADE3]: 'Grade 3',
  [GRADE_CODES.GRADE4]: 'Grade 4',
  [GRADE_CODES.GRADE5]: 'Grade 5',
  [GRADE_CODES.GRADE6]: 'Grade 6',
  [GRADE_CODES.GRADE7]: 'Grade 7',
  [GRADE_CODES.GRADE8]: 'Grade 8',
  [GRADE_CODES.GRADE9]: 'Grade 9',
  [GRADE_CODES.GRADE10]: 'Grade 10',
  [GRADE_CODES.GRADE11]: 'Grade 11',
  [GRADE_CODES.GRADE12]: 'Grade 12'
};

/**
 * Reverse mapping: display name → raw code
 */
const DISPLAY_TO_CODE: { [key: string]: string } = Object.entries(GRADE_DISPLAY_NAMES)
  .reduce((acc, [code, display]) => {
    acc[display] = code;
    return acc;
  }, {} as { [key: string]: string });

/**
 * Convert raw grade code to display format
 * @param gradeCode - Raw grade code (e.g., 'pre_casa_toddler')
 * @returns Display format (e.g., 'Pre-Casa (Toddler)')
 * 
 * @example
 * formatGradeForDisplay('pre_casa_toddler') // Returns: 'Pre-Casa (Toddler)'
 * formatGradeForDisplay('grade1') // Returns: 'Grade 1'
 */
export const formatGradeForDisplay = (gradeCode: string | null | undefined): string => {
  if (!gradeCode) return gradeCode || '';
  
  // If already in display format (contains parentheses or starts with "Grade"), return as is
  if (gradeCode.includes('(') || gradeCode.startsWith('Grade ')) {
    // Check if it's a known display format
    if (DISPLAY_TO_CODE[gradeCode]) {
      return gradeCode;
    }
    // Might be an old/inconsistent format, try to normalize it
    return normalizeGradeFormat(gradeCode);
  }
  
  const lower = gradeCode.toLowerCase().trim();
  
  // Check if it's a known code
  if (GRADE_DISPLAY_NAMES[lower]) {
    return GRADE_DISPLAY_NAMES[lower];
  }
  
  // Fallback: Try to format unknown codes intelligently
  const formatted = lower
    .replace(/_/g, ' ')
    .split(' ')
    .map(w => w ? w.charAt(0).toUpperCase() + w.slice(1) : w)
    .join(' ');
  
  return formatted;
};

/**
 * Convert display format back to raw grade code
 * @param displayGrade - Display format (e.g., 'Pre-Casa (Toddler)')
 * @returns Raw grade code (e.g., 'pre_casa_toddler')
 * 
 * @example
 * convertDisplayToRawGrade('Pre-Casa (Toddler)') // Returns: 'pre_casa_toddler'
 * convertDisplayToRawGrade('Grade 1') // Returns: 'grade1'
 */
export const convertDisplayToRawGrade = (displayGrade: string | null | undefined): string => {
  if (!displayGrade) return '';
  
  const trimmed = displayGrade.trim();
  
  // Check if it's a known display format
  if (DISPLAY_TO_CODE[trimmed]) {
    return DISPLAY_TO_CODE[trimmed];
  }
  
  // Handle "Grade X" format
  if (trimmed.startsWith('Grade ')) {
    const gradeNum = trimmed.replace('Grade ', '').trim();
    return `grade${gradeNum}`;
  }
  
  // Handle common formats that might have slight variations
  const normalized = normalizeGradeFormat(trimmed);
  if (DISPLAY_TO_CODE[normalized]) {
    return DISPLAY_TO_CODE[normalized];
  }
  
  // Fallback: Convert display format to code format
  return trimmed
    .toLowerCase()
    .replace(/[^\w\s]/g, '') // Remove special characters
    .replace(/\s+/g, '_') // Replace spaces with underscores
    .trim();
};

/**
 * Normalize inconsistent grade formats to the standard display format
 * Handles legacy formats and variations
 * 
 * @param grade - Grade string in any format
 * @returns Normalized grade in standard display format
 */
export const normalizeGradeFormat = (grade: string | null | undefined): string => {
  if (!grade) return '';
  
  const trimmed = grade.trim();
  
  // Common variations that need normalization
  const variations: { [key: string]: string } = {
    // Montessori variations
    'Pre Casa/Toddler': GRADE_DISPLAY_NAMES[GRADE_CODES.PRE_CASA_TODDLER],
    'Pre Casa Toddler': GRADE_DISPLAY_NAMES[GRADE_CODES.PRE_CASA_TODDLER],
    'PreCasa Toddler': GRADE_DISPLAY_NAMES[GRADE_CODES.PRE_CASA_TODDLER],
    'Pre-Casa Toddler': GRADE_DISPLAY_NAMES[GRADE_CODES.PRE_CASA_TODDLER],
    
    'Infant Community / Nido': GRADE_DISPLAY_NAMES[GRADE_CODES.INFANT_COMMUNITY_NIDO],
    'Infant Community/Nido': GRADE_DISPLAY_NAMES[GRADE_CODES.INFANT_COMMUNITY_NIDO],
    
    'Casa / Children\'s House': GRADE_DISPLAY_NAMES[GRADE_CODES.CASA_CHILDRENS_HOUSE],
    'Casa/Children\'s House': GRADE_DISPLAY_NAMES[GRADE_CODES.CASA_CHILDRENS_HOUSE],
    'Casa (Children\'s House)': GRADE_DISPLAY_NAMES[GRADE_CODES.CASA_CHILDRENS_HOUSE],
    
    'Sr Casa': GRADE_DISPLAY_NAMES[GRADE_CODES.SR_CASA],
    'SrCasa': GRADE_DISPLAY_NAMES[GRADE_CODES.SR_CASA],
  };
  
  // Check variations first
  if (variations[trimmed]) {
    return variations[trimmed];
  }
  
  // Check if it's already a standard display format
  if (DISPLAY_TO_CODE[trimmed]) {
    return trimmed;
  }
  
  // Check if it's a raw code
  const lower = trimmed.toLowerCase();
  if (GRADE_DISPLAY_NAMES[lower]) {
    return GRADE_DISPLAY_NAMES[lower];
  }
  
  // Return as-is if no match found (might be custom grade)
  return trimmed;
};

/**
 * Get all grade codes for a school type
 */
export const getGradeCodesForSchoolType = (schoolType: string): string[] => {
  const gradesByType: { [key: string]: string[] } = {
    licensed_daycare: [
      GRADE_CODES.INFANT,
      GRADE_CODES.TODDLER,
      GRADE_CODES.PRESCHOOL,
      GRADE_CODES.KINDERGARTEN,
      GRADE_CODES.PRIMARY_JUNIOR_SCHOOL_AGE,
      GRADE_CODES.JUNIOR_SCHOOL_AGE
    ],
    montessori_school: [
      GRADE_CODES.INFANT_COMMUNITY_NIDO,
      GRADE_CODES.PRE_CASA_TODDLER,
      GRADE_CODES.CASA_CHILDRENS_HOUSE,
      GRADE_CODES.SR_CASA,
      GRADE_CODES.LOWER_ELEMENTARY,
      GRADE_CODES.UPPER_ELEMENTARY,
      GRADE_CODES.SECONDARY
    ],
    public_private_school: [
      GRADE_CODES.JUNIOR_KINDERGARTEN_JK,
      GRADE_CODES.SENIOR_KINDERGARTEN_SK,
      GRADE_CODES.GRADE1,
      GRADE_CODES.GRADE2,
      GRADE_CODES.GRADE3,
      GRADE_CODES.GRADE4,
      GRADE_CODES.GRADE5,
      GRADE_CODES.GRADE6,
      GRADE_CODES.GRADE7,
      GRADE_CODES.GRADE8,
      GRADE_CODES.GRADE9,
      GRADE_CODES.GRADE10,
      GRADE_CODES.GRADE11,
      GRADE_CODES.GRADE12
    ]
  };
  
  return gradesByType[schoolType] || [];
};

/**
 * Get display names for a school type
 */
export const getGradeDisplayNamesForSchoolType = (schoolType: string): string[] => {
  const codes = getGradeCodesForSchoolType(schoolType);
  return codes.map(code => formatGradeForDisplay(code));
};

/**
 * Compare two grades for equality, handling different formats
 * @param grade1 - First grade (any format)
 * @param grade2 - Second grade (any format)
 * @returns true if grades are equivalent
 */
export const areGradesEqual = (grade1: string | null | undefined, grade2: string | null | undefined): boolean => {
  if (!grade1 || !grade2) return false;
  
  // Normalize both to raw codes for comparison
  const code1 = convertDisplayToRawGrade(grade1).toLowerCase();
  const code2 = convertDisplayToRawGrade(grade2).toLowerCase();
  
  // Direct comparison
  if (code1 === code2) return true;
  
  // Also check if normalized display formats match
  const display1 = normalizeGradeFormat(grade1).toLowerCase();
  const display2 = normalizeGradeFormat(grade2).toLowerCase();
  
  return display1 === display2;
};

/**
 * Format an array of grade codes for display
 */
export const formatGradesForDisplay = (gradeCodes: string[]): string[] => {
  return gradeCodes.map(code => formatGradeForDisplay(code));
};

/**
 * Convert an array of display grades to raw codes
 */
export const convertDisplayGradesToRaw = (displayGrades: string[]): string[] => {
  return displayGrades.map(grade => convertDisplayToRawGrade(grade));
};

