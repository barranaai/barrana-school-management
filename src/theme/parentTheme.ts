import { createTheme, ThemeOptions } from '@mui/material/styles';

/**
 * Parent Dashboard Theme Configuration
 * Based on modern, clean design with pastel highlights
 * 
 * Color Reference:
 * - Background: Soft beige/cream (#F5F1E8)
 * - Cards: White (#FFFFFF)
 * - Primary: Bright blue (#007AFF)
 * - Pastel highlights for categories/subjects
 */

const themeOptions: ThemeOptions = {
  palette: {
    mode: 'light',
    background: {
      default: '#F8F9FA', // Very light grey background
      paper: '#FFFFFF',   // White cards
    },
    primary: {
      main: '#007AFF',    // Bright blue for primary actions
      light: '#4DA3FF',
      dark: '#0051D5',
      contrastText: '#FFFFFF',
    },
    secondary: {
      main: '#764ba2',    // Purple for secondary actions (keeping existing)
      light: '#9D7CC7',
      dark: '#5A3580',
      contrastText: '#FFFFFF',
    },
    text: {
      primary: '#1A1A1A',   // Near black for main text
      secondary: '#6B6B6B', // Gray for secondary text
      disabled: '#ABABAB',  // Light gray for disabled
    },
    divider: '#E5E5E5',     // Subtle divider color
    action: {
      hover: '#F8F9FA',     // Light gray hover
      selected: '#E8F4FF',  // Light blue selection
      disabled: '#ABABAB',
    },
    success: {
      main: '#34C759',      // Green for success states
      light: '#68D786',
      dark: '#28A745',
    },
    warning: {
      main: '#FF9500',      // Orange for warnings
      light: '#FFB340',
      dark: '#CC7700',
    },
    error: {
      main: '#FF3B30',      // Red for errors
      light: '#FF6B60',
      dark: '#CC2F26',
    },
    info: {
      main: '#007AFF',      // Blue for info
      light: '#4DA3FF',
      dark: '#0051D5',
    },
  },
  typography: {
    fontFamily: "'Inter', 'SF Pro Display', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif",
    h1: {
      fontSize: '32px',
      fontWeight: 700,
      lineHeight: 1.2,
      letterSpacing: '-0.5px',
    },
    h2: {
      fontSize: '28px',
      fontWeight: 700,
      lineHeight: 1.3,
      letterSpacing: '-0.3px',
    },
    h3: {
      fontSize: '24px',
      fontWeight: 600,
      lineHeight: 1.3,
    },
    h4: {
      fontSize: '20px',
      fontWeight: 600,
      lineHeight: 1.4,
    },
    h5: {
      fontSize: '18px',
      fontWeight: 600,
      lineHeight: 1.4,
    },
    h6: {
      fontSize: '16px',
      fontWeight: 600,
      lineHeight: 1.5,
    },
    body1: {
      fontSize: '14px',
      fontWeight: 400,
      lineHeight: 1.6,
    },
    body2: {
      fontSize: '13px',
      fontWeight: 400,
      lineHeight: 1.6,
    },
    button: {
      fontSize: '14px',
      fontWeight: 500,
      textTransform: 'none' as const,
      letterSpacing: '0.2px',
    },
    caption: {
      fontSize: '12px',
      fontWeight: 400,
      lineHeight: 1.5,
    },
    overline: {
      fontSize: '11px',
      fontWeight: 500,
      textTransform: 'uppercase' as const,
      letterSpacing: '1px',
    },
  },
  shape: {
    borderRadius: 12, // Default rounded corners
  },
  shadows: [
    'none',
    '0 1px 2px rgba(0,0,0,0.04)',
    '0 2px 4px rgba(0,0,0,0.06)',
    '0 4px 8px rgba(0,0,0,0.08)',
    '0 8px 16px rgba(0,0,0,0.10)',
    '0 12px 24px rgba(0,0,0,0.12)',
    '0 16px 32px rgba(0,0,0,0.14)',
    '0 20px 40px rgba(0,0,0,0.16)',
    '0 24px 48px rgba(0,0,0,0.18)',
    '0 28px 56px rgba(0,0,0,0.20)',
    '0 32px 64px rgba(0,0,0,0.22)',
    '0 36px 72px rgba(0,0,0,0.24)',
    '0 40px 80px rgba(0,0,0,0.26)',
    '0 44px 88px rgba(0,0,0,0.28)',
    '0 48px 96px rgba(0,0,0,0.30)',
    '0 52px 104px rgba(0,0,0,0.32)',
    '0 56px 112px rgba(0,0,0,0.34)',
    '0 60px 120px rgba(0,0,0,0.36)',
    '0 64px 128px rgba(0,0,0,0.38)',
    '0 68px 136px rgba(0,0,0,0.40)',
    '0 72px 144px rgba(0,0,0,0.42)',
    '0 76px 152px rgba(0,0,0,0.44)',
    '0 80px 160px rgba(0,0,0,0.46)',
    '0 84px 168px rgba(0,0,0,0.48)',
  ],
  components: {
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 16,
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
          border: 'none',
          transition: 'box-shadow 0.2s ease-in-out',
          '&:hover': {
            boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
          },
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          textTransform: 'none',
          fontWeight: 500,
          padding: '8px 16px',
          boxShadow: 'none',
          transition: 'all 0.2s ease-in-out',
          '&:hover': {
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          },
        },
        contained: {
          '&:hover': {
            boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
          },
        },
        outlined: {
          borderWidth: '1.5px',
          '&:hover': {
            borderWidth: '1.5px',
          },
        },
        text: {
          '&:hover': {
            backgroundColor: 'rgba(0, 122, 255, 0.08)',
          },
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 10,
            backgroundColor: '#FFFFFF',
            transition: 'all 0.2s ease-in-out',
            '&:hover': {
              backgroundColor: '#FAFAF9',
            },
            '&.Mui-focused': {
              backgroundColor: '#FFFFFF',
            },
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
        },
        elevation1: {
          boxShadow: '0 2px 4px rgba(0,0,0,0.06)',
        },
        elevation2: {
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
        },
        elevation3: {
          boxShadow: '0 4px 12px rgba(0,0,0,0.10)',
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          fontWeight: 500,
          height: 'auto',
          padding: '4px 8px',
        },
      },
    },
    MuiListItem: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          marginBottom: '4px',
          transition: 'all 0.2s ease-in-out',
          '&:hover': {
            backgroundColor: 'rgba(0, 122, 255, 0.08)',
          },
          '&.Mui-selected': {
            backgroundColor: '#007AFF',
            color: '#FFFFFF',
            '&:hover': {
              backgroundColor: '#0051D5',
            },
            '& .MuiListItemIcon-root': {
              color: '#FFFFFF',
            },
            '& .MuiListItemText-primary': {
              fontWeight: 600,
            },
          },
        },
      },
    },
    MuiCheckbox: {
      styleOverrides: {
        root: {
          borderRadius: 4,
          '&.Mui-checked': {
            color: '#007AFF',
          },
        },
      },
    },
    MuiBadge: {
      styleOverrides: {
        badge: {
          borderRadius: 10,
          minWidth: '18px',
          height: '18px',
          fontSize: '11px',
          fontWeight: 600,
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 20,
          boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
        },
      },
    },
    MuiSelect: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          backgroundColor: '#FFFFFF',
        },
      },
    },
    MuiTableHead: {
      styleOverrides: {
        root: {
          '& .MuiTableCell-head': {
            fontWeight: 600,
            fontSize: '13px',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          },
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          borderBottom: '1px solid #E5E5E5',
        },
      },
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: {
          borderRadius: 4,
          height: 8,
        },
        bar: {
          borderRadius: 4,
        },
      },
    },
  },
};

// Create and export the default theme
const parentTheme = createTheme(themeOptions);

// Helper function to calculate luminance of a color (to determine lightness)
const getLuminance = (color: string): number => {
  const r = parseInt(color.slice(1, 3), 16) / 255;
  const g = parseInt(color.slice(3, 5), 16) / 255;
  const b = parseInt(color.slice(5, 7), 16) / 255;
  
  // Apply gamma correction
  const [rs, gs, bs] = [r, g, b].map(val => {
    return val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4);
  });
  
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
};

// Calculate light and dark variants of a color
const getLightColor = (color: string) => {
  const r = parseInt(color.slice(1, 3), 16);
  const g = parseInt(color.slice(3, 5), 16);
  const b = parseInt(color.slice(5, 7), 16);
  
  const lightR = Math.min(255, Math.floor(r + (255 - r) * 0.6));
  const lightG = Math.min(255, Math.floor(g + (255 - g) * 0.6));
  const lightB = Math.min(255, Math.floor(b + (255 - b) * 0.6));
  
  return `#${lightR.toString(16).padStart(2, '0')}${lightG.toString(16).padStart(2, '0')}${lightB.toString(16).padStart(2, '0')}`;
};

const getDarkColor = (color: string) => {
  const r = parseInt(color.slice(1, 3), 16);
  const g = parseInt(color.slice(3, 5), 16);
  const b = parseInt(color.slice(5, 7), 16);
  
  const darkR = Math.max(0, Math.floor(r * 0.7));
  const darkG = Math.max(0, Math.floor(g * 0.7));
  const darkB = Math.max(0, Math.floor(b * 0.7));
  
  return `#${darkR.toString(16).padStart(2, '0')}${darkG.toString(16).padStart(2, '0')}${darkB.toString(16).padStart(2, '0')}`;
};

// Function to create theme with custom primary and secondary colors (for school branding)
export const createParentTheme = (primaryColor?: string, secondaryColor?: string) => {
  if (!primaryColor) {
    return parentTheme;
  }

  // Determine which color is lighter to use as background
  const primaryLuminance = getLuminance(primaryColor);
  const secondaryLuminance = secondaryColor ? getLuminance(secondaryColor) : -1;
  
  // Use the lighter color as background, darker as hover
  let backgroundColor: string;
  let hoverColor: string;
  
  if (secondaryColor && secondaryLuminance > primaryLuminance) {
    // Secondary is lighter - use it as background
    backgroundColor = secondaryColor;
    hoverColor = primaryColor;
  } else {
    // Primary is lighter (or no secondary) - use primary as background
    backgroundColor = primaryColor;
    hoverColor = secondaryColor || getDarkColor(primaryColor);
  }

  // Ensure contrast text is white for both colors
  const contrastText = '#FFFFFF';

  const customThemeOptions = {
    ...themeOptions,
    palette: {
      ...themeOptions.palette,
      primary: {
        main: backgroundColor, // Lighter color for normal state
        light: getLightColor(backgroundColor),
        dark: hoverColor, // Darker color for hover state
        contrastText: contrastText,
      },
      secondary: {
        main: hoverColor, // Store darker color in secondary for hover use
        light: getLightColor(hoverColor),
        dark: getDarkColor(hoverColor),
        contrastText: contrastText,
      },
      info: {
        ...themeOptions.palette.info,
        main: backgroundColor,
        light: getLightColor(backgroundColor),
        dark: hoverColor,
      },
    },
  };

  const theme = createTheme(customThemeOptions);
  
  // Store the hover color in the theme for easy access
  (theme as any).hoverColor = hoverColor;
  
  return theme;
};

// Export color constants for use in components
export const themeColors = {
  highlights: {
    yellow: '#FFF9E6',
    pink: '#FFE8E8',
    mint: '#E8F9F0',
    blue: '#E8F4FF',
    purple: '#F0E8FF',
    orange: '#FFF4E6',
  },
  background: {
    default: '#F8F9FA',
    paper: '#FFFFFF',
    subtle: '#FAFAF9',
  },
  text: {
    primary: '#1A1A1A',
    secondary: '#6B6B6B',
    disabled: '#ABABAB',
  },
} as const;

export default parentTheme;

