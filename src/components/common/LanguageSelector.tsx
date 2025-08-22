import React from 'react';
import {
  Box,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Typography,
} from '@mui/material';
import { useLanguage, Language } from '../../contexts/LanguageContext';

const languageOptions = [
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'ar', name: 'العربية', flag: '🇸🇦' },
  { code: 'zh', name: '中文', flag: '🇨🇳' },
];

const LanguageSelector: React.FC = () => {
  const { language, setLanguage } = useLanguage();

  const handleLanguageChange = (event: any) => {
    setLanguage(event.target.value as Language);
  };

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <Typography variant="body2" color="text.secondary">
        🌐
      </Typography>
      <FormControl size="small" sx={{ minWidth: 120 }}>
        <Select
          value={language}
          onChange={handleLanguageChange}
          displayEmpty
          sx={{ 
            '& .MuiSelect-select': { 
              display: 'flex', 
              alignItems: 'center', 
              gap: 1 
            } 
          }}
        >
          {languageOptions.map((option) => (
            <MenuItem key={option.code} value={option.code}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <span>{option.flag}</span>
                <Typography variant="body2">{option.name}</Typography>
              </Box>
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    </Box>
  );
};

export default LanguageSelector; 