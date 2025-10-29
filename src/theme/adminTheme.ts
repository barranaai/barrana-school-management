import { createTheme, Theme } from '@mui/material/styles';

interface BrandingColors {
  primary: string;
  secondary: string;
}

// Helper function to calculate luminance
const getLuminance = (hex: string): number => {
  const rgb = parseInt(hex.slice(1), 16);
  const r = ((rgb >> 16) & 0xff) / 255;
  const g = ((rgb >> 8) & 0xff) / 255;
  const b = (rgb & 0xff) / 255;
  
  const [rs, gs, bs] = [r, g, b].map(c => {
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
};

// Helper function to darken a color
const darkenColor = (hex: string, percent: number): string => {
  const num = parseInt(hex.slice(1), 16);
  const amt = Math.round(2.55 * percent);
  const R = (num >> 16) - amt;
  const G = (num >> 8 & 0x00FF) - amt;
  const B = (num & 0x0000FF) - amt;
  
  return '#' + (
    0x1000000 +
    (R < 255 ? (R < 0 ? 0 : R) : 255) * 0x10000 +
    (G < 255 ? (G < 0 ? 0 : G) : 255) * 0x100 +
    (B < 255 ? (B < 0 ? 0 : B) : 255)
  ).toString(16).slice(1);
};

export const createAdminTheme = (branding?: BrandingColors): Theme => {
  // Default colors if no branding provided
  const defaultPrimary = '#007AFF';
  const defaultSecondary = '#5856D6';
  
  // Use branding colors if provided, otherwise use defaults
  const primaryColor = branding?.primary || defaultPrimary;
  const secondaryColor = branding?.secondary || defaultSecondary;
  
  // Determine which color is lighter for normal state
  const primaryLuminance = getLuminance(primaryColor);
  const secondaryLuminance = getLuminance(secondaryColor);
  const lighterColor = primaryLuminance > secondaryLuminance ? primaryColor : secondaryColor;
  const darkerColor = primaryLuminance > secondaryLuminance ? secondaryColor : primaryColor;
  
  return createTheme({
    palette: {
      primary: {
        main: lighterColor,
        dark: darkerColor,
        light: lighterColor,
      },
      secondary: {
        main: secondaryColor,
      },
      background: {
        default: '#F8F9FA',
        paper: '#FFFFFF',
      },
      text: {
        primary: '#1A1A1A',
        secondary: '#6B6B6B',
      },
    },
    typography: {
      fontFamily: [
        '-apple-system',
        'BlinkMacSystemFont',
        '"Segoe UI"',
        'Roboto',
        '"Helvetica Neue"',
        'Arial',
        'sans-serif',
      ].join(','),
    },
    components: {
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: 10,
            textTransform: 'none',
            fontWeight: 600,
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: 16,
          },
        },
      },
    },
  });
};

// Theme colors for cards and sections
export const themeColors = {
  cardColors: [
    '#b3e5fc', // Light blue
    '#fff9c4', // Light yellow
    '#ffcdd2', // Light red/pink
    '#c8e6c9', // Light green
    '#e1bee7', // Light purple
  ],
  highlights: {
    blue: 'rgba(102, 126, 234, 0.08)',
    purple: 'rgba(118, 75, 162, 0.08)',
    teal: 'rgba(79, 172, 254, 0.08)',
  },
  nested: 'rgba(255,255,255,0.95)',
};

export default createAdminTheme;

