/**
 * Timezone Utilities
 * Provides timezone options and formatting for the application
 */

export interface TimezoneOption {
  value: string;
  label: string;
}

export const getTimezoneOptions = (): TimezoneOption[] => {
  return [
    { value: 'UTC', label: 'UTC' },
    { value: 'America/New_York', label: 'Eastern Time (New York)' },
    { value: 'America/Chicago', label: 'Central Time (Chicago)' },
    { value: 'America/Denver', label: 'Mountain Time (Denver)' },
    { value: 'America/Los_Angeles', label: 'Pacific Time (Los Angeles)' },
    { value: 'America/Phoenix', label: 'Arizona Time (Phoenix)' },
    { value: 'America/Anchorage', label: 'Alaska Time (Anchorage)' },
    { value: 'Pacific/Honolulu', label: 'Hawaii Time (Honolulu)' },
    { value: 'America/Toronto', label: 'Eastern Time (Toronto)' },
    { value: 'America/Vancouver', label: 'Pacific Time (Vancouver)' },
    { value: 'Europe/London', label: 'London Time' },
    { value: 'Europe/Paris', label: 'Paris Time' },
    { value: 'Europe/Berlin', label: 'Berlin Time' },
    { value: 'Asia/Tokyo', label: 'Tokyo Time' },
    { value: 'Asia/Shanghai', label: 'Shanghai Time' },
    { value: 'Australia/Sydney', label: 'Sydney Time' },
    { value: 'Australia/Melbourne', label: 'Melbourne Time' }
  ];
};

export const formatTimezone = (timezone: string): string => {
  const option = getTimezoneOptions().find(tz => tz.value === timezone);
  return option ? option.label : timezone;
};

const timezoneUtilsDefault = {
  getTimezoneOptions,
  formatTimezone
};

export default timezoneUtilsDefault;
