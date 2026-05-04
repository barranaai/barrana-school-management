import React, { useState, useEffect } from 'react';
import {
  TextField,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Box,
  Typography,
  InputAdornment,
  FormHelperText,
} from '@mui/material';
import { WhatsApp, CheckCircle, Error as ErrorIcon } from '@mui/icons-material';
import { parsePhoneNumber, isValidPhoneNumber } from 'libphonenumber-js';

// Popular countries for quick access
const POPULAR_COUNTRIES = [
  { code: 'PK', name: 'Pakistan', dial: '+92', flag: '🇵🇰', length: 10 },
  { code: 'US', name: 'United States', dial: '+1', flag: '🇺🇸', length: 10 },
  { code: 'GB', name: 'United Kingdom', dial: '+44', flag: '🇬🇧', length: 10 },
  { code: 'AE', name: 'UAE', dial: '+971', flag: '🇦🇪', length: 9 },
  { code: 'SA', name: 'Saudi Arabia', dial: '+966', flag: '🇸🇦', length: 9 },
  { code: 'IN', name: 'India', dial: '+91', flag: '🇮🇳', length: 10 },
  { code: 'CA', name: 'Canada', dial: '+1', flag: '🇨🇦', length: 10 },
];

// Extended list of countries
const ALL_COUNTRIES = [
  ...POPULAR_COUNTRIES,
  { code: 'AF', name: 'Afghanistan', dial: '+93', flag: '🇦🇫', length: 9 },
  { code: 'AL', name: 'Albania', dial: '+355', flag: '🇦🇱', length: 9 },
  { code: 'DZ', name: 'Algeria', dial: '+213', flag: '🇩🇿', length: 9 },
  { code: 'AR', name: 'Argentina', dial: '+54', flag: '🇦🇷', length: 10 },
  { code: 'AU', name: 'Australia', dial: '+61', flag: '🇦🇺', length: 9 },
  { code: 'AT', name: 'Austria', dial: '+43', flag: '🇦🇹', length: 10 },
  { code: 'BH', name: 'Bahrain', dial: '+973', flag: '🇧🇭', length: 8 },
  { code: 'BD', name: 'Bangladesh', dial: '+880', flag: '🇧🇩', length: 10 },
  { code: 'BE', name: 'Belgium', dial: '+32', flag: '🇧🇪', length: 9 },
  { code: 'BR', name: 'Brazil', dial: '+55', flag: '🇧🇷', length: 11 },
  { code: 'CN', name: 'China', dial: '+86', flag: '🇨🇳', length: 11 },
  { code: 'EG', name: 'Egypt', dial: '+20', flag: '🇪🇬', length: 10 },
  { code: 'FR', name: 'France', dial: '+33', flag: '🇫🇷', length: 9 },
  { code: 'DE', name: 'Germany', dial: '+49', flag: '🇩🇪', length: 10 },
  { code: 'GR', name: 'Greece', dial: '+30', flag: '🇬🇷', length: 10 },
  { code: 'HK', name: 'Hong Kong', dial: '+852', flag: '🇭🇰', length: 8 },
  { code: 'ID', name: 'Indonesia', dial: '+62', flag: '🇮🇩', length: 10 },
  { code: 'IR', name: 'Iran', dial: '+98', flag: '🇮🇷', length: 10 },
  { code: 'IQ', name: 'Iraq', dial: '+964', flag: '🇮🇶', length: 10 },
  { code: 'IE', name: 'Ireland', dial: '+353', flag: '🇮🇪', length: 9 },
  { code: 'IL', name: 'Israel', dial: '+972', flag: '🇮🇱', length: 9 },
  { code: 'IT', name: 'Italy', dial: '+39', flag: '🇮🇹', length: 10 },
  { code: 'JP', name: 'Japan', dial: '+81', flag: '🇯🇵', length: 10 },
  { code: 'JO', name: 'Jordan', dial: '+962', flag: '🇯🇴', length: 9 },
  { code: 'KW', name: 'Kuwait', dial: '+965', flag: '🇰🇼', length: 8 },
  { code: 'LB', name: 'Lebanon', dial: '+961', flag: '🇱🇧', length: 8 },
  { code: 'MY', name: 'Malaysia', dial: '+60', flag: '🇲🇾', length: 9 },
  { code: 'MX', name: 'Mexico', dial: '+52', flag: '🇲🇽', length: 10 },
  { code: 'MA', name: 'Morocco', dial: '+212', flag: '🇲🇦', length: 9 },
  { code: 'NL', name: 'Netherlands', dial: '+31', flag: '🇳🇱', length: 9 },
  { code: 'NZ', name: 'New Zealand', dial: '+64', flag: '🇳🇿', length: 9 },
  { code: 'NG', name: 'Nigeria', dial: '+234', flag: '🇳🇬', length: 10 },
  { code: 'NO', name: 'Norway', dial: '+47', flag: '🇳🇴', length: 8 },
  { code: 'OM', name: 'Oman', dial: '+968', flag: '🇴🇲', length: 8 },
  { code: 'PH', name: 'Philippines', dial: '+63', flag: '🇵🇭', length: 10 },
  { code: 'PL', name: 'Poland', dial: '+48', flag: '🇵🇱', length: 9 },
  { code: 'PT', name: 'Portugal', dial: '+351', flag: '🇵🇹', length: 9 },
  { code: 'QA', name: 'Qatar', dial: '+974', flag: '🇶🇦', length: 8 },
  { code: 'RU', name: 'Russia', dial: '+7', flag: '🇷🇺', length: 10 },
  { code: 'SG', name: 'Singapore', dial: '+65', flag: '🇸🇬', length: 8 },
  { code: 'ZA', name: 'South Africa', dial: '+27', flag: '🇿🇦', length: 9 },
  { code: 'KR', name: 'South Korea', dial: '+82', flag: '🇰🇷', length: 10 },
  { code: 'ES', name: 'Spain', dial: '+34', flag: '🇪🇸', length: 9 },
  { code: 'LK', name: 'Sri Lanka', dial: '+94', flag: '🇱🇰', length: 9 },
  { code: 'SE', name: 'Sweden', dial: '+46', flag: '🇸🇪', length: 9 },
  { code: 'CH', name: 'Switzerland', dial: '+41', flag: '🇨🇭', length: 9 },
  { code: 'SY', name: 'Syria', dial: '+963', flag: '🇸🇾', length: 9 },
  { code: 'TW', name: 'Taiwan', dial: '+886', flag: '🇹🇼', length: 9 },
  { code: 'TH', name: 'Thailand', dial: '+66', flag: '🇹🇭', length: 9 },
  { code: 'TR', name: 'Turkey', dial: '+90', flag: '🇹🇷', length: 10 },
  { code: 'UA', name: 'Ukraine', dial: '+380', flag: '🇺🇦', length: 9 },
  { code: 'VN', name: 'Vietnam', dial: '+84', flag: '🇻🇳', length: 9 },
  { code: 'YE', name: 'Yemen', dial: '+967', flag: '🇾🇪', length: 9 },
];

interface PhoneNumberInputProps {
  value: string;
  onChange: (value: string) => void;
  error?: boolean;
  helperText?: string;
  required?: boolean;
  label?: string;
}

const PhoneNumberInput: React.FC<PhoneNumberInputProps> = ({
  value,
  onChange,
  error: externalError,
  helperText: externalHelperText,
  required = false,
  label = 'Parent WhatsApp Number',
}) => {
  const [countryCode, setCountryCode] = useState<string>('PK');
  const [phoneNumber, setPhoneNumber] = useState<string>('');
  const [isValid, setIsValid] = useState<boolean | null>(null);
  const [validationMessage, setValidationMessage] = useState<string>('');

  // Parse existing value on mount
  useEffect(() => {
    if (value && value.startsWith('+')) {
      try {
        const parsed = parsePhoneNumber(value);
        if (parsed) {
          setCountryCode(parsed.country || 'PK');
          setPhoneNumber(parsed.nationalNumber);
          validatePhone(value);
        }
      } catch (error) {
        // If parsing fails, try to extract country code manually
        const country = ALL_COUNTRIES.find(c => value.startsWith(c.dial));
        if (country) {
          setCountryCode(country.code);
          setPhoneNumber(value.substring(country.dial.length));
        }
      }
    }
    // Parse the initial `value` prop only on mount; subsequent updates are
    // controlled by the user's interaction with the input.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const validatePhone = (fullNumber: string) => {
    if (!fullNumber || fullNumber.length < 8) {
      setIsValid(null);
      setValidationMessage('');
      return;
    }

    try {
      const valid = isValidPhoneNumber(fullNumber);
      setIsValid(valid);

      if (valid) {
        setValidationMessage('✓ Valid WhatsApp number');
      } else {
        setValidationMessage('Invalid phone number format');
      }
    } catch (error) {
      setIsValid(false);
      setValidationMessage('Invalid phone number');
    }
  };

  const handleCountryChange = (newCountryCode: string) => {
    setCountryCode(newCountryCode);
    const country = ALL_COUNTRIES.find(c => c.code === newCountryCode);
    if (country && phoneNumber) {
      const fullNumber = `${country.dial}${phoneNumber}`;
      validatePhone(fullNumber);
      onChange(fullNumber);
    }
  };

  const handlePhoneChange = (newPhone: string) => {
    // Only allow digits
    const cleaned = newPhone.replace(/\D/g, '');
    setPhoneNumber(cleaned);

    const country = ALL_COUNTRIES.find(c => c.code === countryCode);
    if (country) {
      const fullNumber = cleaned ? `${country.dial}${cleaned}` : '';
      validatePhone(fullNumber);
      onChange(fullNumber);
    }
  };

  const selectedCountry = ALL_COUNTRIES.find(c => c.code === countryCode) || ALL_COUNTRIES[0];

  return (
    <Box>
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
        {/* Country Code Dropdown */}
        <FormControl sx={{ minWidth: 200 }} error={externalError}>
          <InputLabel>Country</InputLabel>
          <Select
            value={countryCode}
            onChange={(e) => handleCountryChange(e.target.value)}
            label="Country"
          >
            <MenuItem disabled>
              <Typography variant="caption" color="text.secondary">
                Popular Countries
              </Typography>
            </MenuItem>
            {POPULAR_COUNTRIES.map((country) => (
              <MenuItem key={country.code} value={country.code}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <span style={{ fontSize: '1.2em' }}>{country.flag}</span>
                  <span>{country.name}</span>
                  <Typography variant="caption" color="text.secondary">
                    ({country.dial})
                  </Typography>
                </Box>
              </MenuItem>
            ))}
            <MenuItem disabled>
              <Typography variant="caption" color="text.secondary">
                ─────────────────
              </Typography>
            </MenuItem>
            <MenuItem disabled>
              <Typography variant="caption" color="text.secondary">
                All Countries
              </Typography>
            </MenuItem>
            {ALL_COUNTRIES.filter(c => !POPULAR_COUNTRIES.find(p => p.code === c.code))
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((country) => (
                <MenuItem key={country.code} value={country.code}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <span style={{ fontSize: '1.2em' }}>{country.flag}</span>
                    <span>{country.name}</span>
                    <Typography variant="caption" color="text.secondary">
                      ({country.dial})
                    </Typography>
                  </Box>
                </MenuItem>
              ))}
          </Select>
        </FormControl>

        {/* Phone Number Input */}
        <TextField
          fullWidth
          label={label}
          value={phoneNumber}
          onChange={(e) => handlePhoneChange(e.target.value)}
          placeholder={`e.g., ${'3'.repeat(selectedCountry.length)}`}
          required={required}
          error={externalError || (isValid === false && phoneNumber.length > 0)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <span style={{ fontSize: '1.2em' }}>{selectedCountry.flag}</span>
                  <Typography variant="body2" color="text.secondary">
                    {selectedCountry.dial}
                  </Typography>
                </Box>
              </InputAdornment>
            ),
            endAdornment: phoneNumber.length > 0 && (
              <InputAdornment position="end">
                {isValid === true && (
                  <CheckCircle sx={{ color: 'success.main', fontSize: 20 }} />
                )}
                {isValid === false && (
                  <ErrorIcon sx={{ color: 'error.main', fontSize: 20 }} />
                )}
                {isValid === null && (
                  <WhatsApp sx={{ color: 'action.disabled', fontSize: 20 }} />
                )}
              </InputAdornment>
            ),
          }}
        />
      </Box>

      {/* Helper Text */}
      <FormHelperText
        sx={{
          ml: 1,
          mt: 0.5,
          display: 'flex',
          alignItems: 'center',
          gap: 0.5,
          color: isValid === true ? 'success.main' : isValid === false ? 'error.main' : 'text.secondary',
        }}
      >
        <WhatsApp sx={{ fontSize: 14 }} />
        {externalHelperText || validationMessage || `Enter parent's WhatsApp number for notifications (${selectedCountry.length} digits)`}
      </FormHelperText>

      {/* Full Number Preview */}
      {phoneNumber && (
        <Typography
          variant="caption"
          sx={{
            ml: 1,
            mt: 0.5,
            display: 'block',
            color: 'text.secondary',
            fontFamily: 'monospace',
          }}
        >
          Full Number: {selectedCountry.dial}{phoneNumber}
        </Typography>
      )}
    </Box>
  );
};

export default PhoneNumberInput;

