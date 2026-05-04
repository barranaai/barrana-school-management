import React, { useState, useMemo } from 'react';
import {
  Autocomplete,
  TextField,
  Chip,
  Typography,
  Box,
} from '@mui/material';
import { Public } from '@mui/icons-material';
import { getTimezoneOptions, type TimezoneOption } from '../../utils/timezoneUtils';

interface TimezoneSelectorProps {
  value: string;
  onChange: (timezone: string) => void;
  label?: string;
  placeholder?: string;
  error?: boolean;
  helperText?: string;
  fullWidth?: boolean;
  required?: boolean;
}

const TimezoneSelector: React.FC<TimezoneSelectorProps> = ({
  value,
  onChange,
  label = 'Timezone',
  placeholder = 'Search for a timezone...',
  error = false,
  helperText,
  fullWidth = true,
  required = false,
}) => {
  const [searchText, setSearchText] = useState('');
  
  // Get all timezone options
  const allTimezones = useMemo(() => getTimezoneOptions(), []);
  
  // Filter timezones based on search text
  const filteredTimezones = useMemo(() => {
    if (!searchText) return allTimezones;
    
    const search = searchText.toLowerCase();
    return allTimezones.filter(tz => 
      tz.label.toLowerCase().includes(search) ||
      tz.value.toLowerCase().includes(search)
    );
  }, [allTimezones, searchText]);
  
  // Find the current timezone option
  const currentTimezone = useMemo(() => {
    return allTimezones.find(tz => tz.value === value) || undefined;
  }, [allTimezones, value]);

  const handleChange = (_: any, newValue: TimezoneOption | null) => {
    if (newValue) {
      onChange(newValue.value);
    }
  };

  const renderOption = (props: any, option: TimezoneOption) => (
    <Box component="li" {...props} sx={{ flexDirection: 'column', alignItems: 'flex-start', py: 1 }}>
      <Typography variant="body2" fontWeight="medium">
        {option.label}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        {option.value}
      </Typography>
    </Box>
  );

  const renderInput = (params: any) => (
    <TextField
      {...params}
      label={label}
      placeholder={placeholder}
      error={error}
      helperText={helperText}
      required={required}
      InputProps={{
        ...params.InputProps,
        startAdornment: (
          <>
            <Public sx={{ color: 'action.active', mr: 1, my: 0.5 }} />
            {params.InputProps.startAdornment}
          </>
        ),
      }}
      sx={{
        '& .MuiOutlinedInput-root': {
          borderRadius: 2,
          '&:hover .MuiOutlinedInput-notchedOutline': {
            borderColor: 'primary.main',
          },
        },
      }}
    />
  );

  const renderTags = (value: TimezoneOption[], getTagProps: any) =>
    value.map((option, index) => (
      <Chip
        {...getTagProps({ index })}
        key={option.value}
        label={option.label}
        size="small"
        sx={{ 
          maxWidth: '100%',
          '& .MuiChip-label': {
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            maxWidth: '200px'
          }
        }}
      />
    ));

  return (
    <Autocomplete
      value={currentTimezone}
      onChange={handleChange}
      onInputChange={(_, newInputValue) => setSearchText(newInputValue)}
      options={filteredTimezones}
      getOptionLabel={(option) => option.label}
      isOptionEqualToValue={(option, value) => option.value === value.value}
      renderOption={renderOption}
      renderInput={renderInput}
      renderTags={renderTags}
      fullWidth={fullWidth}
      disableClearable
      filterOptions={(options) => options} // We handle filtering manually
      noOptionsText="No matching timezones found"
      sx={{
        '& .MuiAutocomplete-popupIndicator': {
          color: 'action.active',
        },
      }}
      componentsProps={{
        popper: {
          placement: 'bottom-start',
          modifiers: [
            {
              name: 'offset',
              options: {
                offset: [0, 4],
              },
            },
          ],
        },
      }}
      ListboxProps={{
        style: {
          maxHeight: '300px',
        },
      }}
    />
  );
};

export default TimezoneSelector;
