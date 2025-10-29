import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Switch,
  FormControlLabel,
  Button,
  Chip,
  Alert,
  Divider,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  ListSubheader,
} from '@mui/material';
import {
  Add,
  Delete,
  Edit,
  Schedule,
  Public,
  Event,
  Work,
} from '@mui/icons-material';
import { REPORT_FREQUENCIES } from '../../../constants/reportFrequencies';
import { getTimezoneOptions, TimezoneOption } from '../../../utils/timezoneUtils';

interface FrequencyConfig {
  enabled: boolean;
  dueDay: number;
  dueTime: string;
  skipWeekends: boolean;
  skipHolidays: boolean;
}

interface SchoolCalendar {
  schoolYear: {
    startMonth: number;
    startDay: number;
    endMonth: number;
    endDay: number;
  };
  holidays: Array<{
    name: string;
    date: Date;
    isRecurring: boolean;
    description?: string;
  }>;
  workingDays: {
    monday: boolean;
    tuesday: boolean;
    wednesday: boolean;
    thursday: boolean;
    friday: boolean;
    saturday: boolean;
    sunday: boolean;
  };
}

interface FrequencyConfigurationProps {
  schoolSettings: any;
  onSettingsChange: (settings: any) => void;
}

const FrequencyConfiguration: React.FC<FrequencyConfigurationProps> = ({
  schoolSettings,
  onSettingsChange
}) => {
  // Local state to hold pending changes
  const [localSettings, setLocalSettings] = useState<any>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Initialize local settings from props
  useEffect(() => {
    if (schoolSettings && Object.keys(schoolSettings).length > 0) {
      // Always reinitialize when schoolSettings changes (on page load or refresh)
      console.log('✅ Initializing/Reinitializing local settings');
      console.log('   Timezone:', schoolSettings.timezone);
      console.log('   Daily workingDays:', schoolSettings.reportFrequencies?.Daily?.workingDays);
      console.log('   Daily dueTime:', schoolSettings.reportFrequencies?.Daily?.dueTime);
      setLocalSettings(initializeSettings(schoolSettings));
      setHasUnsavedChanges(false); // Reset unsaved changes flag on initialization
    }
  }, [JSON.stringify(schoolSettings)]); // Reinitialize whenever schoolSettings content changes

  // Helper function to initialize settings with defaults
  const initializeSettings = (schoolSettings: any) => ({
    timezone: schoolSettings.timezone || 'UTC',
    calendar: {
      workingDays: {
        monday: schoolSettings.calendar?.workingDays?.monday ?? true,
        tuesday: schoolSettings.calendar?.workingDays?.tuesday ?? true,
        wednesday: schoolSettings.calendar?.workingDays?.wednesday ?? true,
        thursday: schoolSettings.calendar?.workingDays?.thursday ?? true,
        friday: schoolSettings.calendar?.workingDays?.friday ?? true,
        saturday: schoolSettings.calendar?.workingDays?.saturday ?? false,
        sunday: schoolSettings.calendar?.workingDays?.sunday ?? false
      },
      schoolYear: {
        startMonth: schoolSettings.calendar?.schoolYear?.startMonth ?? 9,
        startDay: schoolSettings.calendar?.schoolYear?.startDay ?? 1,
        endMonth: schoolSettings.calendar?.schoolYear?.endMonth ?? 6,
        endDay: schoolSettings.calendar?.schoolYear?.endDay ?? 30
      },
      holidays: schoolSettings.calendar?.holidays || []
    },
    reportFrequencies: {
      Daily: {
        enabled: schoolSettings.reportFrequencies?.Daily?.enabled ?? true,
        workingDays: schoolSettings.reportFrequencies?.Daily?.workingDays ?? [1, 2, 3, 4, 5], // Monday to Friday by default
        dueTime: schoolSettings.reportFrequencies?.Daily?.dueTime ?? '17:00',
        skipWeekends: schoolSettings.reportFrequencies?.Daily?.skipWeekends ?? true,
        skipHolidays: schoolSettings.reportFrequencies?.Daily?.skipHolidays ?? true
      },
      Weekly: {
        enabled: schoolSettings.reportFrequencies?.Weekly?.enabled ?? true,
        dueDay: schoolSettings.reportFrequencies?.Weekly?.dueDay ?? 5,
        dueTime: schoolSettings.reportFrequencies?.Weekly?.dueTime ?? '17:00',
        skipWeekends: schoolSettings.reportFrequencies?.Weekly?.skipWeekends ?? true,
        skipHolidays: schoolSettings.reportFrequencies?.Weekly?.skipHolidays ?? true
      },
      'Bi-Weekly': {
        enabled: schoolSettings.reportFrequencies?.['Bi-Weekly']?.enabled ?? true,
        dueTime: schoolSettings.reportFrequencies?.['Bi-Weekly']?.dueTime ?? '17:00',
        skipWeekends: schoolSettings.reportFrequencies?.['Bi-Weekly']?.skipWeekends ?? true,
        skipHolidays: schoolSettings.reportFrequencies?.['Bi-Weekly']?.skipHolidays ?? true,
        rule: schoolSettings.reportFrequencies?.['Bi-Weekly']?.rule ?? 'alternateWeeks', // 'alternateWeeks', 'specificWeeks', 'nthWeekOfMonth'
        dueDay: schoolSettings.reportFrequencies?.['Bi-Weekly']?.dueDay ?? 5, // Day of week (1-7, Monday-Sunday)
        specificWeeks: schoolSettings.reportFrequencies?.['Bi-Weekly']?.specificWeeks ?? [1, 3], // Week numbers (1-5)
        nthWeekOfMonth: schoolSettings.reportFrequencies?.['Bi-Weekly']?.nthWeekOfMonth ?? { n: 1, week: 3 }, // Only used if rule is 'nthWeekOfMonth'
        weekendPolicy: schoolSettings.reportFrequencies?.['Bi-Weekly']?.weekendPolicy ?? 'nextWorkingDay', // 'nextWorkingDay', 'previousWorkingDay', 'nearestWorkingDay', 'none'
        startWeek: schoolSettings.reportFrequencies?.['Bi-Weekly']?.startWeek ?? 1 // Which week to start (1 or 2)
      },
      'Bi-Monthly': {
        enabled: schoolSettings.reportFrequencies?.['Bi-Monthly']?.enabled ?? true,
        dueTime: schoolSettings.reportFrequencies?.['Bi-Monthly']?.dueTime ?? '17:00',
        skipWeekends: schoolSettings.reportFrequencies?.['Bi-Monthly']?.skipWeekends ?? true,
        skipHolidays: schoolSettings.reportFrequencies?.['Bi-Monthly']?.skipHolidays ?? true,
        rule: schoolSettings.reportFrequencies?.['Bi-Monthly']?.rule ?? 'lastWorkingDay', // 'specificDate', 'lastDay', 'lastWorkingDay', 'nthWeekday'
        specificDay: schoolSettings.reportFrequencies?.['Bi-Monthly']?.specificDay ?? 28, // Only used if rule is 'specificDate'
        nthWeekday: schoolSettings.reportFrequencies?.['Bi-Monthly']?.nthWeekday ?? { n: 1, weekday: 5 }, // Only used if rule is 'nthWeekday'
        weekendPolicy: schoolSettings.reportFrequencies?.['Bi-Monthly']?.weekendPolicy ?? 'nextWorkingDay', // 'nextWorkingDay', 'previousWorkingDay', 'nearestWorkingDay', 'none'
        startMonth: schoolSettings.reportFrequencies?.['Bi-Monthly']?.startMonth ?? 9 // September (1-based)
      },
      Monthly: {
        enabled: schoolSettings.reportFrequencies?.Monthly?.enabled ?? true,
        dueTime: schoolSettings.reportFrequencies?.Monthly?.dueTime ?? '17:00',
        skipWeekends: schoolSettings.reportFrequencies?.Monthly?.skipWeekends ?? true,
        skipHolidays: schoolSettings.reportFrequencies?.Monthly?.skipHolidays ?? true,
        rule: schoolSettings.reportFrequencies?.Monthly?.rule ?? 'lastWorkingDay', // 'specificDate', 'lastDay', 'lastWorkingDay', 'nthWeekday'
        specificDay: schoolSettings.reportFrequencies?.Monthly?.specificDay ?? 28, // Only used if rule is 'specificDate'
        nthWeekday: schoolSettings.reportFrequencies?.Monthly?.nthWeekday ?? { n: 1, weekday: 5 }, // Only used if rule is 'nthWeekday'
        weekendPolicy: schoolSettings.reportFrequencies?.Monthly?.weekendPolicy ?? 'nextWorkingDay' // 'nextWorkingDay', 'previousWorkingDay', 'nearestWorkingDay', 'none'
      },
              Quarterly: {
          enabled: schoolSettings.reportFrequencies?.Quarterly?.enabled ?? true,
          dueTime: schoolSettings.reportFrequencies?.Quarterly?.dueTime ?? '17:00',
          skipWeekends: schoolSettings.reportFrequencies?.Quarterly?.skipWeekends ?? true,
          skipHolidays: schoolSettings.reportFrequencies?.Quarterly?.skipHolidays ?? true,
          quarters: schoolSettings.reportFrequencies?.Quarterly?.quarters ?? {
            q1: { enabled: true, month: 10, day: 30 }, // October 30
            q2: { enabled: true, month: 1, day: 15 },  // January 15
            q3: { enabled: true, month: 3, day: 30 },  // March 30
            q4: { enabled: true, month: 6, day: 10 }   // June 10
          }
        },
              Annually: {
          enabled: schoolSettings.reportFrequencies?.Annually?.enabled ?? true,
          dueDay: schoolSettings.reportFrequencies?.Annually?.dueDay ?? 615, // June 15th (6 * 100 + 15)
          dueTime: schoolSettings.reportFrequencies?.Annually?.dueTime ?? '17:00',
          skipWeekends: false, // Not applicable for annual reports
          skipHolidays: false  // Not applicable for annual reports
        }
    }
  });

  // Use local settings if available, otherwise show loading state
  const settings = localSettings || initializeSettings(schoolSettings);

  const [openHolidayDialog, setOpenHolidayDialog] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState<any>(null);
  const [holidayForm, setHolidayForm] = useState({
    name: '',
    date: '',
    isRecurring: false,
    description: ''
  });

  // Get comprehensive timezone options
  const timezoneOptions = getTimezoneOptions();

  const dayOptions = [
    { value: 1, label: 'Monday' },
    { value: 2, label: 'Tuesday' },
    { value: 3, label: 'Wednesday' },
    { value: 4, label: 'Thursday' },
    { value: 5, label: 'Friday' },
    { value: 6, label: 'Saturday' },
    { value: 7, label: 'Sunday' },
  ];

  const monthOptions = [
    { value: 1, label: 'January' },
    { value: 2, label: 'February' },
    { value: 3, label: 'March' },
    { value: 4, label: 'April' },
    { value: 5, label: 'May' },
    { value: 6, label: 'June' },
    { value: 7, label: 'July' },
    { value: 8, label: 'August' },
    { value: 9, label: 'September' },
    { value: 10, label: 'October' },
    { value: 11, label: 'November' },
    { value: 12, label: 'December' },
  ];

  const ruleOptions = [
    { value: 'lastWorkingDay', label: 'Last working day of month' },
    { value: 'lastDay', label: 'Last day of month' },
    { value: 'specificDate', label: 'Specific date' },
    { value: 'nthWeekday', label: 'Nth weekday of month' }
  ];

  const biWeeklyRuleOptions = [
    { value: 'alternateWeeks', label: 'Every other week (alternating)' },
    { value: 'specificWeeks', label: 'Specific weeks of month' },
    { value: 'nthWeekOfMonth', label: 'Nth week of each month' }
  ];

  const weekendPolicyOptions = [
    { value: 'nextWorkingDay', label: 'Next working day' },
    { value: 'previousWorkingDay', label: 'Previous working day' },
    { value: 'nearestWorkingDay', label: 'Nearest working day' },
    { value: 'none', label: 'No adjustment' }
  ];

  const nthOptions = [
    { value: 1, label: '1st' },
    { value: 2, label: '2nd' },
    { value: 3, label: '3rd' },
    { value: 4, label: '4th' },
    { value: -1, label: 'Last' }
  ];

  const handleFrequencyChange = (frequency: string, field: string, value: any) => {
    console.log('🔄 Frequency change:', { frequency, field, value });
    
    const updatedSettings = {
      ...settings,
      reportFrequencies: {
        ...settings.reportFrequencies,
        [frequency]: {
          ...settings.reportFrequencies[frequency as keyof typeof settings.reportFrequencies],
          [field]: value
        }
      }
    };
    
    setLocalSettings(updatedSettings);
    setHasUnsavedChanges(true);
  };

  const handleCalendarChange = (field: string, value: any) => {
    const updatedSettings = {
      ...settings,
      calendar: {
        ...settings.calendar,
        [field]: value
      }
    };
    setLocalSettings(updatedSettings);
    setHasUnsavedChanges(true);
  };

  const handleWorkingDayChange = (day: string, value: boolean) => {
    const updatedSettings = {
      ...settings,
      calendar: {
        ...settings.calendar,
        workingDays: {
          ...settings.calendar.workingDays,
          [day as keyof typeof settings.calendar.workingDays]: value
        }
      }
    };
    setLocalSettings(updatedSettings);
    setHasUnsavedChanges(true);
  };

  const handleQuarterChange = (quarter: string, field: string, value: any) => {
    const updatedSettings = {
      ...settings,
      reportFrequencies: {
        ...settings.reportFrequencies,
        Quarterly: {
          ...settings.reportFrequencies.Quarterly,
          quarters: {
            ...settings.reportFrequencies.Quarterly.quarters,
            [quarter]: {
              ...settings.reportFrequencies.Quarterly.quarters[quarter as keyof typeof settings.reportFrequencies.Quarterly.quarters],
              [field]: value
            }
          }
        }
      }
    };
    setLocalSettings(updatedSettings);
    setHasUnsavedChanges(true);
  };

  // Save all changes
  const handleSaveChanges = async () => {
    setIsSaving(true);
    try {
      await onSettingsChange(settings);
      setHasUnsavedChanges(false);
    } catch (error) {
      console.error('Error saving settings:', error);
    } finally {
      setIsSaving(false);
    }
  };

  // Discard changes and reset to saved state
  const handleCancelChanges = () => {
    setLocalSettings(initializeSettings(schoolSettings));
    setHasUnsavedChanges(false);
  };

  const handleAddHoliday = () => {
    setEditingHoliday(null);
    setHolidayForm({
      name: '',
      date: '',
      isRecurring: false,
      description: ''
    });
    setOpenHolidayDialog(true);
  };

  const handleEditHoliday = (holiday: any, index: number) => {
    setEditingHoliday({ ...holiday, index });
    setHolidayForm({
      name: holiday.name,
      date: new Date(holiday.date).toISOString().split('T')[0],
      isRecurring: holiday.isRecurring,
      description: holiday.description || ''
    });
    setOpenHolidayDialog(true);
  };

  const handleDeleteHoliday = (index: number) => {
    const updatedHolidays = [...settings.calendar.holidays];
    updatedHolidays.splice(index, 1);
    handleCalendarChange('holidays', updatedHolidays);
  };

  const handleSaveHoliday = () => {
    const newHoliday = {
      name: holidayForm.name,
      date: new Date(holidayForm.date),
      isRecurring: holidayForm.isRecurring,
      description: holidayForm.description
    };

    const updatedHolidays = [...settings.calendar.holidays];
    
    if (editingHoliday !== null) {
      updatedHolidays[editingHoliday.index] = newHoliday;
    } else {
      updatedHolidays.push(newHoliday);
    }

    handleCalendarChange('holidays', updatedHolidays);
    setOpenHolidayDialog(false);
  };

  const getFrequencyDescription = (frequency: string) => {
    switch (frequency) {
      case 'Daily':
        return 'Reports due every day';
      case 'Weekly':
        return 'Reports due every week';
      case 'Bi-Weekly':
        return 'Reports due every two weeks (configure alternating weeks, specific weeks, or nth week of month)';
      case 'Bi-Monthly':
        return 'Reports due every two months';
      case 'Monthly':
        return 'Reports due every month';
      case 'Quarterly':
        return 'Reports due on specific dates for each quarter/term (configure individual quarters below)';
      case 'Annually':
        return 'Reports due once per year on a specific date (weekend/holiday skipping not applicable)';
      default:
        return '';
    }
  };

  // Show loading state if settings haven't been initialized yet
  if (!localSettings) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <Typography>Loading configuration...</Typography>
      </Box>
    );
  }

  return (
    <Box>
      {/* Save/Cancel Bar - Fixed at top when there are unsaved changes */}
      {hasUnsavedChanges && (
        <Box 
          sx={{ 
            position: 'sticky', 
            top: 0, 
            zIndex: 1000,
            bgcolor: 'warning.light',
            p: 2,
            mb: 3,
            borderRadius: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: 3
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="body1" sx={{ fontWeight: 600, color: 'warning.dark' }}>
              ⚠️ You have unsaved changes
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Remember to save your configuration before leaving this page
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button
              variant="outlined"
              onClick={handleCancelChanges}
              disabled={isSaving}
              sx={{ 
                borderColor: 'grey.400',
                color: 'text.primary',
                '&:hover': {
                  borderColor: 'grey.600',
                  bgcolor: 'grey.50'
                }
              }}
            >
              Cancel Changes
            </Button>
            <Button
              variant="contained"
              onClick={handleSaveChanges}
              disabled={isSaving}
              sx={{ 
                bgcolor: 'success.main',
                '&:hover': {
                  bgcolor: 'success.dark'
                }
              }}
            >
              {isSaving ? 'Saving...' : 'Save All Changes'}
            </Button>
          </Box>
        </Box>
      )}

      {/* Timezone Display (Read-only) */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <Public sx={{ mr: 1 }} />
            School Timezone
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Your school's timezone is set by the system administrator. Contact your administrator to change this setting.
          </Typography>
          
          <Box sx={{ 
            p: 2, 
            borderRadius: 2, 
            bgcolor: 'grey.50',
            border: '1px solid',
            borderColor: 'grey.200',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <Typography variant="body1" sx={{ fontWeight: 500 }}>
              Current Timezone
            </Typography>
            <Chip 
              label={timezoneOptions.find((tz: TimezoneOption) => tz.value === settings.timezone)?.label || settings.timezone}
              color="primary"
              variant="outlined"
            />
          </Box>
        </CardContent>
      </Card>

      {/* Working Days Configuration */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <Work sx={{ mr: 1 }} />
            Working Days
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Configure which days of the week your school operates.
          </Typography>
          

          
          <Grid container spacing={2}>
            {Object.entries({
              monday: 'Monday',
              tuesday: 'Tuesday',
              wednesday: 'Wednesday',
              thursday: 'Thursday',
              friday: 'Friday',
              saturday: 'Saturday',
              sunday: 'Sunday'
            }).map(([day, label]) => (
              <Grid item xs={12} sm={6} md={3} key={day}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={settings.calendar.workingDays[day as keyof typeof settings.calendar.workingDays]}
                      onChange={(e) => handleWorkingDayChange(day, e.target.checked)}
                    />
                  }
                  label={label}
                />
              </Grid>
            ))}
          </Grid>
        </CardContent>
      </Card>

      {/* School Year Configuration */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <Event sx={{ mr: 1 }} />
            School Year
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Define your school year start and end dates.
          </Typography>
          
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>School Year Start</Typography>
              <Grid container spacing={1}>
                <Grid item xs={6}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Month</InputLabel>
                    <Select
                      value={settings.calendar.schoolYear.startMonth}
                      onChange={(e) => handleCalendarChange('schoolYear', {
                        ...settings.calendar.schoolYear,
                        startMonth: e.target.value
                      })}
                      label="Month"
                    >
                      {monthOptions.map((month) => (
                        <MenuItem key={month.value} value={month.value}>
                          {month.label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    size="small"
                    type="number"
                    label="Day"
                                          value={settings.calendar.schoolYear.startDay}
                      onChange={(e) => handleCalendarChange('schoolYear', {
                        ...settings.calendar.schoolYear,
                        startDay: parseInt(e.target.value)
                      })}
                    inputProps={{ min: 1, max: 31 }}
                  />
                </Grid>
              </Grid>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>School Year End</Typography>
              <Grid container spacing={1}>
                <Grid item xs={6}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Month</InputLabel>
                    <Select
                      value={settings.calendar.schoolYear.endMonth}
                      onChange={(e) => handleCalendarChange('schoolYear', {
                        ...settings.calendar.schoolYear,
                        endMonth: e.target.value
                      })}
                      label="Month"
                    >
                      {monthOptions.map((month) => (
                        <MenuItem key={month.value} value={month.value}>
                          {month.label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    size="small"
                    type="number"
                    label="Day"
                                          value={settings.calendar.schoolYear.endDay}
                      onChange={(e) => handleCalendarChange('schoolYear', {
                        ...settings.calendar.schoolYear,
                        endDay: parseInt(e.target.value)
                      })}
                    inputProps={{ min: 1, max: 31 }}
                  />
                </Grid>
              </Grid>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Holidays Configuration */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center' }}>
              <Event sx={{ mr: 1 }} />
              School Holidays
            </Typography>
            <Button
              variant="outlined"
              startIcon={<Add />}
              onClick={handleAddHoliday}
              size="small"
            >
              Add Holiday
            </Button>
          </Box>
          
          {settings.calendar.holidays.length > 0 ? (
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Holiday Name</TableCell>
                    <TableCell>Date</TableCell>
                    <TableCell>Recurring</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {settings.calendar.holidays.map((holiday: any, index: number) => (
                    <TableRow key={index}>
                      <TableCell>{holiday.name}</TableCell>
                      <TableCell>
                        {new Date(holiday.date).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={holiday.isRecurring ? 'Yes' : 'No'}
                          size="small"
                          color={holiday.isRecurring ? 'primary' : 'default'}
                        />
                      </TableCell>
                      <TableCell>
                        <IconButton
                          size="small"
                          onClick={() => handleEditHoliday(holiday, index)}
                        >
                          <Edit />
                        </IconButton>
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleDeleteHoliday(index)}
                        >
                          <Delete />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          ) : (
            <Alert severity="info">
              No holidays configured. Add holidays to ensure accurate due date calculations.
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Frequency Configuration */}
      <Card>
        <CardContent>
          <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <Schedule sx={{ mr: 1 }} />
            Report Frequency Configuration
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Configure when reports are due for each frequency type.
          </Typography>
          
          {REPORT_FREQUENCIES.map((frequency) => {
            const config = settings.reportFrequencies[frequency];
            
            return (
              <Box key={frequency} sx={{ mb: 3, p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Box>
                    <Typography variant="subtitle1" fontWeight="bold">
                      {frequency}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {getFrequencyDescription(frequency)}
                    </Typography>
                    {/* Debug info for each frequency */}
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                      Debug: enabled={config.enabled}, dueTime={config.dueTime}, skipWeekends={config.skipWeekends}, skipHolidays={config.skipHolidays}
                      {frequency === 'Daily' ? `, workingDays=${JSON.stringify((config as any).workingDays)}` : ''}
                      {frequency === 'Weekly' || frequency === 'Bi-Weekly' ? `, dueDay=${(config as any).dueDay}` : ''}
                      {frequency === 'Annually' ? `, dueDay=${(config as any).dueDay}` : ''}
                    </Typography>
                  </Box>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={config.enabled}
                        onChange={(e) => {
                          console.log('🔄 Enabled change:', { frequency, value: e.target.checked });
                          handleFrequencyChange(frequency, 'enabled', e.target.checked);
                        }}
                      />
                    }
                    label="Enabled"
                  />
                </Box>
                
                {config.enabled && (
                  <Grid container spacing={2}>
                    {frequency === 'Annually' ? (
                      // Annual reports: Due Month + Due Day
                      <>
                        <Grid item xs={12} md={3}>
                          <FormControl fullWidth size="small">
                            <InputLabel>Due Month</InputLabel>
                            <Select
                              value={Math.floor((config as any).dueDay / 100) || 6} // Extract month from dueDay (e.g., 615 = June 15th)
                              onChange={(e) => {
                                const month = Number(e.target.value);
                                const day = (config as any).dueDay % 100 || 15; // Keep existing day or default to 15
                                const newDueDay = month * 100 + day;
                                handleFrequencyChange(frequency, 'dueDay', newDueDay);
                              }}
                              label="Due Month"
                            >
                              {monthOptions.map((month) => (
                                <MenuItem key={month.value} value={month.value}>
                                  {month.label}
                                </MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                        </Grid>
                        <Grid item xs={12} md={3}>
                          <TextField
                            fullWidth
                            size="small"
                            type="number"
                            label="Due Day"
                            value={(config as any).dueDay % 100 || 15} // Extract day from dueDay
                            onChange={(e) => {
                              const month = Math.floor((config as any).dueDay / 100) || 6; // Keep existing month or default to June
                              const day = parseInt(e.target.value);
                              const newDueDay = month * 100 + day;
                              handleFrequencyChange(frequency, 'dueDay', newDueDay);
                            }}
                            inputProps={{ min: 1, max: 31 }}
                          />
                        </Grid>
                      </>
                    ) : frequency === 'Quarterly' ? (
                      // Quarterly reports: 4 individual quarter configurations
                      <Grid item xs={12}>
                        <Typography variant="subtitle2" sx={{ mb: 2, color: 'text.secondary' }}>
                          Configure due dates for each quarter/term:
                        </Typography>
                        <Grid container spacing={2}>
                          {[
                            { key: 'q1', label: 'Quarter 1 (Fall)', defaultMonth: 10, defaultDay: 30 },
                            { key: 'q2', label: 'Quarter 2 (Winter)', defaultMonth: 1, defaultDay: 15 },
                            { key: 'q3', label: 'Quarter 3 (Spring)', defaultMonth: 3, defaultDay: 30 },
                            { key: 'q4', label: 'Quarter 4 (Summer)', defaultMonth: 6, defaultDay: 10 }
                          ].map((quarter) => (
                            <Grid item xs={12} md={6} key={quarter.key}>
                              <Box sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                                  <Typography variant="body2" fontWeight="medium">
                                    {quarter.label}
                                  </Typography>
                                  <FormControlLabel
                                    control={
                                      <Switch
                                        size="small"
                                        checked={(config as any).quarters?.[quarter.key]?.enabled ?? true}
                                        onChange={(e) => handleQuarterChange(quarter.key, 'enabled', e.target.checked)}
                                      />
                                    }
                                    label=""
                                  />
                                </Box>
                                {(config as any).quarters?.[quarter.key]?.enabled && (
                                  <Grid container spacing={1}>
                                    <Grid item xs={6}>
                                      <FormControl fullWidth size="small">
                                        <InputLabel>Month</InputLabel>
                                        <Select
                                          value={(config as any).quarters?.[quarter.key]?.month ?? quarter.defaultMonth}
                                          onChange={(e) => handleQuarterChange(quarter.key, 'month', Number(e.target.value))}
                                          label="Month"
                                        >
                                          {monthOptions.map((month) => (
                                            <MenuItem key={month.value} value={month.value}>
                                              {month.label}
                                            </MenuItem>
                                          ))}
                                        </Select>
                                      </FormControl>
                                    </Grid>
                                    <Grid item xs={6}>
                                      <TextField
                                        fullWidth
                                        size="small"
                                        type="number"
                                        label="Day"
                                        value={(config as any).quarters?.[quarter.key]?.day ?? quarter.defaultDay}
                                        onChange={(e) => handleQuarterChange(quarter.key, 'day', parseInt(e.target.value))}
                                        inputProps={{ min: 1, max: 31 }}
                                      />
                                    </Grid>
                                  </Grid>
                                )}
                              </Box>
                            </Grid>
                          ))}
                        </Grid>
                      </Grid>
                    ) : frequency === 'Bi-Weekly' ? (
                      // Bi-Weekly: Rule-based configuration
                      <Grid item xs={12}>
                        <Typography variant="subtitle2" sx={{ mb: 2, color: 'text.secondary' }}>
                          Configure bi-weekly report schedule:
                        </Typography>
                        <Grid container spacing={2}>
                          <Grid item xs={12} md={4}>
                            <FormControl fullWidth size="small">
                              <InputLabel>Rule Type</InputLabel>
                              <Select
                                value={(config as any).rule || 'alternateWeeks'}
                                onChange={(e) => handleFrequencyChange(frequency, 'rule', e.target.value)}
                                label="Rule Type"
                              >
                                {biWeeklyRuleOptions.map((rule) => (
                                  <MenuItem key={rule.value} value={rule.value}>
                                    {rule.label}
                                  </MenuItem>
                                ))}
                              </Select>
                            </FormControl>
                          </Grid>
                          
                          <Grid item xs={12} md={4}>
                            <FormControl fullWidth size="small">
                              <InputLabel>Day of Week</InputLabel>
                              <Select
                                value={(config as any).dueDay || 5}
                                onChange={(e) => handleFrequencyChange(frequency, 'dueDay', parseInt(e.target.value))}
                                label="Day of Week"
                              >
                                {dayOptions.map((day) => (
                                  <MenuItem key={day.value} value={day.value}>
                                    {day.label}
                                  </MenuItem>
                                ))}
                              </Select>
                            </FormControl>
                          </Grid>
                          
                          {(config as any).rule === 'alternateWeeks' && (
                            <Grid item xs={12} md={4}>
                              <FormControl fullWidth size="small">
                                <InputLabel>Start Week</InputLabel>
                                <Select
                                  value={(config as any).startWeek || 1}
                                  onChange={(e) => handleFrequencyChange(frequency, 'startWeek', parseInt(e.target.value))}
                                  label="Start Week"
                                >
                                  <MenuItem value={1}>Week 1 (1st, 3rd, 5th weeks)</MenuItem>
                                  <MenuItem value={2}>Week 2 (2nd, 4th weeks)</MenuItem>
                                </Select>
                              </FormControl>
                            </Grid>
                          )}
                          
                          {(config as any).rule === 'specificWeeks' && (
                            <Grid item xs={12} md={4}>
                              <FormControl fullWidth size="small">
                                <InputLabel>Specific Weeks</InputLabel>
                                <Select
                                  multiple
                                  value={(config as any).specificWeeks || [1, 3]}
                                  onChange={(e) => handleFrequencyChange(frequency, 'specificWeeks', e.target.value)}
                                  label="Specific Weeks"
                                  renderValue={(selected) => selected.join(', ')}
                                >
                                  <MenuItem value={1}>Week 1</MenuItem>
                                  <MenuItem value={2}>Week 2</MenuItem>
                                  <MenuItem value={3}>Week 3</MenuItem>
                                  <MenuItem value={4}>Week 4</MenuItem>
                                  <MenuItem value={5}>Week 5</MenuItem>
                                </Select>
                              </FormControl>
                            </Grid>
                          )}
                          
                          {(config as any).rule === 'nthWeekOfMonth' && (
                            <>
                              <Grid item xs={12} md={4}>
                                <FormControl fullWidth size="small">
                                  <InputLabel>Nth</InputLabel>
                                  <Select
                                    value={(config as any).nthWeekOfMonth?.n || 1}
                                    onChange={(e) => handleFrequencyChange(frequency, 'nthWeekOfMonth', { 
                                      ...(config as any).nthWeekOfMonth, 
                                      n: parseInt(e.target.value) 
                                    })}
                                    label="Nth"
                                  >
                                    {nthOptions.map((option) => (
                                      <MenuItem key={option.value} value={option.value}>
                                        {option.label}
                                      </MenuItem>
                                    ))}
                                  </Select>
                                </FormControl>
                              </Grid>
                              <Grid item xs={12} md={4}>
                                <FormControl fullWidth size="small">
                                  <InputLabel>Week</InputLabel>
                                  <Select
                                    value={(config as any).nthWeekOfMonth?.week || 3}
                                    onChange={(e) => handleFrequencyChange(frequency, 'nthWeekOfMonth', { 
                                      ...(config as any).nthWeekOfMonth, 
                                      week: parseInt(e.target.value) 
                                    })}
                                    label="Week"
                                  >
                                    <MenuItem value={1}>1st week</MenuItem>
                                    <MenuItem value={2}>2nd week</MenuItem>
                                    <MenuItem value={3}>3rd week</MenuItem>
                                    <MenuItem value={4}>4th week</MenuItem>
                                    <MenuItem value={5}>5th week</MenuItem>
                                  </Select>
                                </FormControl>
                              </Grid>
                            </>
                          )}
                          
                          <Grid item xs={12} md={4}>
                            <FormControl fullWidth size="small">
                              <InputLabel>Weekend Policy</InputLabel>
                              <Select
                                value={(config as any).weekendPolicy || 'nextWorkingDay'}
                                onChange={(e) => handleFrequencyChange(frequency, 'weekendPolicy', e.target.value)}
                                label="Weekend Policy"
                              >
                                {weekendPolicyOptions.map((policy) => (
                                  <MenuItem key={policy.value} value={policy.value}>
                                    {policy.label}
                                  </MenuItem>
                                ))}
                              </Select>
                            </FormControl>
                          </Grid>
                        </Grid>
                      </Grid>
                    ) : frequency === 'Monthly' || frequency === 'Bi-Monthly' ? (
                      // Monthly and Bi-Monthly: Rule-based configuration
                      <Grid item xs={12}>
                        <Typography variant="subtitle2" sx={{ mb: 2, color: 'text.secondary' }}>
                          Configure due date rule for {frequency.toLowerCase()} reports:
                        </Typography>
                        <Grid container spacing={2}>
                          <Grid item xs={12} md={4}>
                            <FormControl fullWidth size="small">
                              <InputLabel>Rule Type</InputLabel>
                              <Select
                                value={(config as any).rule || 'lastWorkingDay'}
                                onChange={(e) => handleFrequencyChange(frequency, 'rule', e.target.value)}
                                label="Rule Type"
                              >
                                {ruleOptions.map((rule) => (
                                  <MenuItem key={rule.value} value={rule.value}>
                                    {rule.label}
                                  </MenuItem>
                                ))}
                              </Select>
                            </FormControl>
                          </Grid>
                          
                          {(config as any).rule === 'specificDate' && (
                            <Grid item xs={12} md={4}>
                              <TextField
                                fullWidth
                                size="small"
                                type="number"
                                label="Day of Month"
                                value={(config as any).specificDay || 28}
                                onChange={(e) => handleFrequencyChange(frequency, 'specificDay', parseInt(e.target.value))}
                                inputProps={{ min: 1, max: 31 }}
                                helperText="Will adjust if day exceeds month length"
                              />
                            </Grid>
                          )}
                          
                          {(config as any).rule === 'nthWeekday' && (
                            <>
                              <Grid item xs={12} md={4}>
                                <FormControl fullWidth size="small">
                                  <InputLabel>Nth</InputLabel>
                                  <Select
                                    value={(config as any).nthWeekday?.n || 1}
                                    onChange={(e) => handleFrequencyChange(frequency, 'nthWeekday', { 
                                      ...(config as any).nthWeekday, 
                                      n: parseInt(e.target.value) 
                                    })}
                                    label="Nth"
                                  >
                                    {nthOptions.map((option) => (
                                      <MenuItem key={option.value} value={option.value}>
                                        {option.label}
                                      </MenuItem>
                                    ))}
                                  </Select>
                                </FormControl>
                              </Grid>
                              <Grid item xs={12} md={4}>
                                <FormControl fullWidth size="small">
                                  <InputLabel>Weekday</InputLabel>
                                  <Select
                                    value={(config as any).nthWeekday?.weekday || 5}
                                    onChange={(e) => handleFrequencyChange(frequency, 'nthWeekday', { 
                                      ...(config as any).nthWeekday, 
                                      weekday: parseInt(e.target.value) 
                                    })}
                                    label="Weekday"
                                  >
                                    {dayOptions.map((day) => (
                                      <MenuItem key={day.value} value={day.value}>
                                        {day.label}
                                      </MenuItem>
                                    ))}
                                  </Select>
                                </FormControl>
                              </Grid>
                            </>
                          )}
                          
                          <Grid item xs={12} md={4}>
                            <FormControl fullWidth size="small">
                              <InputLabel>Weekend Policy</InputLabel>
                              <Select
                                value={(config as any).weekendPolicy || 'nextWorkingDay'}
                                onChange={(e) => handleFrequencyChange(frequency, 'weekendPolicy', e.target.value)}
                                label="Weekend Policy"
                              >
                                {weekendPolicyOptions.map((policy) => (
                                  <MenuItem key={policy.value} value={policy.value}>
                                    {policy.label}
                                  </MenuItem>
                                ))}
                              </Select>
                            </FormControl>
                          </Grid>
                          
                          {frequency === 'Bi-Monthly' && (
                            <Grid item xs={12} md={4}>
                              <FormControl fullWidth size="small">
                                <InputLabel>Start Month</InputLabel>
                                <Select
                                  value={(config as any).startMonth || 9}
                                  onChange={(e) => handleFrequencyChange(frequency, 'startMonth', parseInt(e.target.value))}
                                  label="Start Month"
                                >
                                  {monthOptions.map((month) => (
                                    <MenuItem key={month.value} value={month.value}>
                                      {month.label}
                                    </MenuItem>
                                  ))}
                                </Select>
                              </FormControl>
                            </Grid>
                          )}
                        </Grid>
                      </Grid>
                    ) : frequency === 'Daily' ? (
                      // Daily: Multiselect for working days
                      <Grid item xs={12} md={6}>
                        <FormControl fullWidth size="small">
                          <InputLabel>Working Days</InputLabel>
                          <Select
                            multiple
                            value={(config as any).workingDays || [1, 2, 3, 4, 5]}
                            onChange={(e) => {
                              console.log('🔄 Daily working days change:', { frequency, value: e.target.value });
                              handleFrequencyChange(frequency, 'workingDays', e.target.value);
                            }}
                            label="Working Days"
                            renderValue={(selected) => {
                              const selectedDays = selected as number[];
                              return selectedDays.map(day => 
                                dayOptions.find(option => option.value === day)?.label
                              ).join(', ');
                            }}
                          >
                            {dayOptions.map((day) => (
                              <MenuItem key={day.value} value={day.value}>
                                {day.label}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      </Grid>
                    ) : (
                      // Weekly and other simple frequencies: Due Day (day of week)
                      <Grid item xs={12} md={3}>
                        <FormControl fullWidth size="small">
                          <InputLabel>Due Day</InputLabel>
                          <Select
                            value={(config as any).dueDay}
                            onChange={(e) => {
                              console.log('🔄 Due Day change:', { frequency, value: e.target.value });
                              handleFrequencyChange(frequency, 'dueDay', e.target.value);
                            }}
                            label="Due Day"
                          >
                            {dayOptions.map((day) => (
                              <MenuItem key={day.value} value={day.value}>
                                {day.label}
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      </Grid>
                    )}
                    
                    <Grid item xs={12} md={3}>
                      <TextField
                        fullWidth
                        size="small"
                        type="time"
                        label="Due Time"
                        value={config.dueTime}
                        onChange={(e) => {
                          console.log('🔄 Due Time change:', { frequency, value: e.target.value });
                          handleFrequencyChange(frequency, 'dueTime', e.target.value);
                        }}
                        InputLabelProps={{ shrink: true }}
                      />
                    </Grid>
                    
                    {frequency !== 'Annually' && (
                      <>
                        <Grid item xs={12} md={3}>
                          <FormControlLabel
                            control={
                              <Switch
                                checked={config.skipWeekends}
                                onChange={(e) => {
                                  console.log('🔄 Skip Weekends change:', { frequency, value: e.target.checked });
                                  handleFrequencyChange(frequency, 'skipWeekends', e.target.checked);
                                }}
                              />
                            }
                            label="Skip Weekends"
                          />
                        </Grid>
                        
                        <Grid item xs={12} md={3}>
                          <FormControlLabel
                            control={
                              <Switch
                                checked={config.skipHolidays}
                                onChange={(e) => {
                                  console.log('🔄 Skip Holidays change:', { frequency, value: e.target.checked });
                                  handleFrequencyChange(frequency, 'skipHolidays', e.target.checked);
                                }}
                              />
                            }
                            label="Skip Holidays"
                          />
                        </Grid>
                      </>
                    )}
                  </Grid>
                )}
              </Box>
            );
          })}
        </CardContent>
      </Card>

      {/* Holiday Dialog */}
      <Dialog open={openHolidayDialog} onClose={() => setOpenHolidayDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingHoliday ? 'Edit Holiday' : 'Add Holiday'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Holiday Name"
                value={holidayForm.name}
                onChange={(e) => setHolidayForm({ ...holidayForm, name: e.target.value })}
                required
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                type="date"
                label="Date"
                value={holidayForm.date}
                onChange={(e) => setHolidayForm({ ...holidayForm, date: e.target.value })}
                required
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={holidayForm.isRecurring}
                    onChange={(e) => setHolidayForm({ ...holidayForm, isRecurring: e.target.checked })}
                  />
                }
                label="Recurring Holiday (same date every year)"
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                multiline
                rows={2}
                label="Description (Optional)"
                value={holidayForm.description}
                onChange={(e) => setHolidayForm({ ...holidayForm, description: e.target.value })}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenHolidayDialog(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleSaveHoliday}
            disabled={!holidayForm.name || !holidayForm.date}
          >
            {editingHoliday ? 'Update' : 'Add'} Holiday
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default FrequencyConfiguration;
