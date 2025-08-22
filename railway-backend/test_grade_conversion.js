// Test the grade conversion logic from StudentManagement.tsx

function formatGradeForDisplay(grade) {
  if (!grade) return grade;
  const lower = grade.toLowerCase();
  switch (lower) {
    // Daycare / early childhood
    case 'infant': return 'Infant';
    case 'toddler': return 'Toddler';
    case 'preschool': return 'Preschool';
    case 'kindergarten': return 'Kindergarten';
    case 'primary_junior_school_age': return 'Primary/Junior School Age';
    case 'junior_school_age': return 'Junior School Age';

    // Montessori
    case 'infant_community_nido': return 'Infant Community (Nido)';
    case 'pre_casa_toddler': return 'Pre-Casa (Toddler)';
    case 'casa_childrens_house': return "Casa (Children's House)";
    case 'sr_casa': return 'Sr. Casa';
    case 'lower_elementary': return 'Lower Elementary';
    case 'upper_elementary': return 'Upper Elementary';
    case 'secondary': return 'Secondary';

    // Public/Private
    case 'junior_kindergarten_jk': return 'Junior Kindergarten (JK)';
    case 'senior_kindergarten_sk': return 'Senior Kindergarten (SK)';

    // Standard grades
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
    default: {
      // Title-case unknown codes, replacing underscores
      const title = lower
        .replace(/_/g, ' ')
        .split(' ')
        .map(w => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w))
        .join(' ');
      return title;
    }
  }
}

function convertDisplayToRawGrade(displayGrade) {
  switch (displayGrade) {
    // Daycare / early childhood (display -> raw)
    case 'Infant': return 'infant';
    case 'Toddler': return 'toddler';
    case 'Preschool': return 'preschool';
    case 'Kindergarten': return 'kindergarten';
    case 'Primary/Junior School Age': return 'primary_junior_school_age';
    case 'Junior School Age': return 'junior_school_age';

    // Montessori
    case 'Infant Community (Nido)': return 'infant_community_nido';
    case 'Pre-Casa (Toddler)': return 'pre_casa_toddler';
    case "Casa (Children's House)": return 'casa_childrens_house';
    case 'Sr. Casa': return 'sr_casa';
    case 'Lower Elementary': return 'lower_elementary';
    case 'Upper Elementary': return 'upper_elementary';
    case 'Secondary': return 'secondary';

    // Public/Private
    case 'Junior Kindergarten (JK)': return 'junior_kindergarten_jk';
    case 'Senior Kindergarten (SK)': return 'senior_kindergarten_sk';

    // Standard grades
    case 'Preschool ': return 'preschool';
    default:
      if (displayGrade.startsWith('Grade ')) {
        return displayGrade.toLowerCase().replace(' ', '');
      }
      // Generic fallback: lowercase and replace spaces/slashes with underscores, remove punctuation
      return displayGrade
        .toLowerCase()
        .replace(/[\s/]+/g, '_')
        .replace(/[()'']/g, '')
        .replace(/__+/g, '_');
  }
}

// Test the conversion logic
console.log('🧪 Testing Grade Conversion Logic:');
console.log('');

// Test raw to display
console.log('📤 Raw → Display:');
console.log('infant →', formatGradeForDisplay('infant'));
console.log('toddler →', formatGradeForDisplay('toddler'));
console.log('preschool →', formatGradeForDisplay('preschool'));
console.log('');

// Test display to raw
console.log('📥 Display → Raw:');
console.log('Infant →', convertDisplayToRawGrade('Infant'));
console.log('Toddler →', convertDisplayToRawGrade('Toddler'));
console.log('Preschool →', convertDisplayToRawGrade('Preschool'));
console.log('');

// Test the matching logic
console.log('🔍 Testing Matching Logic:');
const classGrade = 'infant';
const formDataGrade = 'Infant';
const formDataGradeRaw = convertDisplayToRawGrade(formDataGrade);

console.log('Class grade:', classGrade);
console.log('Form data grade:', formDataGrade);
console.log('Form data grade (raw):', formDataGradeRaw);

const isMatch1 = classGrade === formDataGrade;
const isMatch2 = classGrade === formDataGradeRaw;
const isMatch3 = classGrade?.toLowerCase() === formDataGrade?.toLowerCase();
const isMatch4 = classGrade?.toLowerCase() === formDataGradeRaw?.toLowerCase();

console.log('');
console.log('Matching results:');
console.log('classGrade === formDataGrade:', isMatch1);
console.log('classGrade === formDataGradeRaw:', isMatch2);
console.log('classGrade?.toLowerCase() === formDataGrade?.toLowerCase():', isMatch3);
console.log('classGrade?.toLowerCase() === formDataGradeRaw?.toLowerCase():', isMatch4);

const finalMatch = isMatch1 || isMatch2 || isMatch3 || isMatch4;
console.log('');
console.log('Final match result:', finalMatch);
