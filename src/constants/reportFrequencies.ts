export const REPORT_FREQUENCIES = [
  'Daily',
  'Weekly', 
  'Bi-Weekly',
  'Monthly',
  'Bi-Monthly',
  'Quarterly',
  'Annually'
] as const;

export type ReportFrequency = typeof REPORT_FREQUENCIES[number];

// Helper function to get frequency in days for scheduling
export const getFrequencyInDays = (frequency: ReportFrequency): number => {
  switch (frequency) {
    case 'Daily':
      return 1;
    case 'Weekly':
      return 7;
    case 'Bi-Weekly':
      return 14;
    case 'Bi-Monthly':
      return 60; // Approximately 2 months
    case 'Monthly':
      return 30;
    case 'Quarterly':
      return 90;
    case 'Annually':
      return 365;
    default:
      return 30; // Default to monthly
  }
};

// Helper function to get human readable description
export const getFrequencyDescription = (frequency: ReportFrequency): string => {
  switch (frequency) {
    case 'Daily':
      return 'Reports sent every day';
    case 'Weekly':
      return 'Reports sent every week';
    case 'Bi-Weekly':
      return 'Reports sent every two weeks';
    case 'Bi-Monthly':
      return 'Reports sent every two months';
    case 'Monthly':
      return 'Reports sent every month';
    case 'Quarterly':
      return 'Reports sent every quarter (3 months)';
    case 'Annually':
      return 'Reports sent once per year';
    default:
      return 'Reports sent monthly';
  }
}; 