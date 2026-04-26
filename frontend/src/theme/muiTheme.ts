/**
 * MATERIAL UI THEME - TRUSTLESS VOTING
 * =====================================
 * Production-grade theming with modern color theory
 * 
 * COLOR THEORY FOUNDATIONS:
 * - 60-30-10 Rule: 60% neutral, 30% secondary, 10% accent
 * - WCAG 2.1 AA contrast ratios (4.5:1 normal text, 3:1 large text)
 * - Semantic color mapping for accessibility
 * - Perceptually uniform color spacing (LAB color space considerations)
 * - Harmonious palette using split-complementary scheme
 * 
 * PALETTE PHILOSOPHY:
 * Primary: Trust/Security (Purple-Blue gradient) - conveys authority & innovation
 * Secondary: Action/Energy (Violet-Purple) - calls to action
 * Success: Verification/Proof (Emerald) - confirmed states
 * Error: Alert/Critical (Rose-Red) - warning states  
 * Warning: Caution (Amber) - attention needed
 * Info: Neutral information (Blue) - informational states
 */

import { createTheme, ThemeOptions, alpha, PaletteOptions } from '@mui/material/styles';

// ============================================================================
// COLOR SYSTEM - Based on perceptually uniform color scales
// ============================================================================

const colors = {
  // Primary: Indigo-Violet gradient (trust, security, innovation)
  primary: {
    50: '#eef2ff',
    100: '#e0e7ff',
    200: '#c7d2fe',
    300: '#a5b4fc',
    400: '#818cf8',
    500: '#667eea',  // Main
    600: '#4f46e5',
    700: '#4338ca',
    800: '#3730a3',
    900: '#312e81',
    950: '#1e1b4b',
  },
  
  // Secondary: Purple-Violet (energy, creativity, action)
  secondary: {
    50: '#faf5ff',
    100: '#f3e8ff',
    200: '#e9d5ff',
    300: '#d8b4fe',
    400: '#c084fc',
    500: '#a855f7',
    600: '#9333ea',
    700: '#764ba2',  // Main - adjusted for brand
    800: '#6b21a8',
    900: '#581c87',
    950: '#3b0764',
  },
  
  // Success: Emerald (verification, confirmed, proof)
  success: {
    50: '#ecfdf5',
    100: '#d1fae5',
    200: '#a7f3d0',
    300: '#6ee7b7',
    400: '#34d399',
    500: '#10b981',  // Main
    600: '#059669',
    700: '#047857',
    800: '#065f46',
    900: '#064e3b',
    950: '#022c22',
  },
  
  // Error: Rose-Red (critical alerts, failures)
  error: {
    50: '#fff1f2',
    100: '#ffe4e6',
    200: '#fecdd3',
    300: '#fda4af',
    400: '#fb7185',
    500: '#f43f5e',
    600: '#e11d48',
    700: '#be123c',
    800: '#9f1239',
    900: '#881337',
    950: '#4c0519',
  },
  
  // Warning: Amber (attention, caution)
  warning: {
    50: '#fffbeb',
    100: '#fef3c7',
    200: '#fde68a',
    300: '#fcd34d',
    400: '#fbbf24',
    500: '#f59e0b',  // Main
    600: '#d97706',
    700: '#b45309',
    800: '#92400e',
    900: '#78350f',
    950: '#451a03',
  },
  
  // Info: Sky Blue (informational, neutral guidance)
  info: {
    50: '#f0f9ff',
    100: '#e0f2fe',
    200: '#bae6fd',
    300: '#7dd3fc',
    400: '#38bdf8',
    500: '#0ea5e9',
    600: '#0284c7',
    700: '#0369a1',
    800: '#075985',
    900: '#0c4a6e',
    950: '#082f49',
  },
  
  // Neutral: Slate (backgrounds, text, borders)
  neutral: {
    0: '#ffffff',
    50: '#f8fafc',
    100: '#f1f5f9',
    200: '#e2e8f0',
    300: '#cbd5e1',
    400: '#94a3b8',
    500: '#64748b',
    600: '#475569',
    700: '#334155',
    800: '#1e293b',
    900: '#0f172a',
    950: '#020617',
  },
};

// ============================================================================
// TYPOGRAPHY SYSTEM - Modular scale (1.25 ratio)
// ============================================================================

const typography: ThemeOptions['typography'] = {
  fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  
  // Display headings - for hero sections
  h1: {
    fontWeight: 800,
    fontSize: 'clamp(2.5rem, 5vw, 4rem)',
    lineHeight: 1.1,
    letterSpacing: '-0.02em',
  },
  h2: {
    fontWeight: 700,
    fontSize: 'clamp(2rem, 4vw, 3rem)',
    lineHeight: 1.2,
    letterSpacing: '-0.01em',
  },
  h3: {
    fontWeight: 700,
    fontSize: 'clamp(1.5rem, 3vw, 2rem)',
    lineHeight: 1.3,
    letterSpacing: '-0.01em',
  },
  h4: {
    fontWeight: 600,
    fontSize: '1.5rem',
    lineHeight: 1.4,
  },
  h5: {
    fontWeight: 600,
    fontSize: '1.25rem',
    lineHeight: 1.5,
  },
  h6: {
    fontWeight: 600,
    fontSize: '1rem',
    lineHeight: 1.5,
  },
  
  // Body text
  body1: {
    fontSize: '1rem',
    lineHeight: 1.6,
    letterSpacing: '0.01em',
  },
  body2: {
    fontSize: '0.875rem',
    lineHeight: 1.6,
    letterSpacing: '0.01em',
  },
  
  // UI elements
  subtitle1: {
    fontSize: '1rem',
    fontWeight: 500,
    lineHeight: 1.5,
    letterSpacing: '0.01em',
  },
  subtitle2: {
    fontSize: '0.875rem',
    fontWeight: 500,
    lineHeight: 1.5,
    letterSpacing: '0.01em',
  },
  button: {
    textTransform: 'none',
    fontWeight: 600,
    letterSpacing: '0.02em',
  },
  caption: {
    fontSize: '0.75rem',
    lineHeight: 1.5,
    letterSpacing: '0.03em',
  },
  overline: {
    fontSize: '0.75rem',
    fontWeight: 700,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
  },
};

// ============================================================================
// SPACING & SHAPE - 8px grid system
// ============================================================================

const shape = {
  borderRadius: 12,
};

const spacing = 8; // Base spacing unit

// ============================================================================
// SHADOWS - Layered elevation system
// ============================================================================

const lightShadows = [
  'none',
  '0 1px 2px 0 rgb(0 0 0 / 0.05)',
  '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
  '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
  '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
  '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
  '0 25px 50px -12px rgb(0 0 0 / 0.25)',
  // Primary color shadows for interactive elements
  `0 4px 14px 0 ${alpha(colors.primary[500], 0.25)}`,
  `0 8px 25px -5px ${alpha(colors.primary[500], 0.3)}`,
  // Error shadows
  `0 4px 14px 0 ${alpha(colors.error[500], 0.25)}`,
  // Success shadows
  `0 4px 14px 0 ${alpha(colors.success[500], 0.25)}`,
  // Remaining to fill MUI's 25 shadow slots
  '0 25px 50px -12px rgb(0 0 0 / 0.25)',
  '0 25px 50px -12px rgb(0 0 0 / 0.25)',
  '0 25px 50px -12px rgb(0 0 0 / 0.25)',
  '0 25px 50px -12px rgb(0 0 0 / 0.25)',
  '0 25px 50px -12px rgb(0 0 0 / 0.25)',
  '0 25px 50px -12px rgb(0 0 0 / 0.25)',
  '0 25px 50px -12px rgb(0 0 0 / 0.25)',
  '0 25px 50px -12px rgb(0 0 0 / 0.25)',
  '0 25px 50px -12px rgb(0 0 0 / 0.25)',
  '0 25px 50px -12px rgb(0 0 0 / 0.25)',
  '0 25px 50px -12px rgb(0 0 0 / 0.25)',
  '0 25px 50px -12px rgb(0 0 0 / 0.25)',
  '0 25px 50px -12px rgb(0 0 0 / 0.25)',
  '0 25px 50px -12px rgb(0 0 0 / 0.25)',
] as const;

const darkShadows = [
  'none',
  '0 1px 2px 0 rgb(0 0 0 / 0.3)',
  '0 1px 3px 0 rgb(0 0 0 / 0.4), 0 1px 2px -1px rgb(0 0 0 / 0.4)',
  '0 4px 6px -1px rgb(0 0 0 / 0.4), 0 2px 4px -2px rgb(0 0 0 / 0.4)',
  '0 10px 15px -3px rgb(0 0 0 / 0.4), 0 4px 6px -4px rgb(0 0 0 / 0.4)',
  '0 20px 25px -5px rgb(0 0 0 / 0.5), 0 8px 10px -6px rgb(0 0 0 / 0.5)',
  '0 25px 50px -12px rgb(0 0 0 / 0.6)',
  // Primary glow for interactive elements
  `0 0 20px ${alpha(colors.primary[400], 0.3)}, 0 4px 14px 0 ${alpha(colors.primary[500], 0.2)}`,
  `0 0 30px ${alpha(colors.primary[400], 0.35)}, 0 8px 25px -5px ${alpha(colors.primary[500], 0.25)}`,
  // Error glow
  `0 0 20px ${alpha(colors.error[400], 0.3)}, 0 4px 14px 0 ${alpha(colors.error[500], 0.2)}`,
  // Success glow
  `0 0 20px ${alpha(colors.success[400], 0.3)}, 0 4px 14px 0 ${alpha(colors.success[500], 0.2)}`,
  // Fill remaining
  '0 25px 50px -12px rgb(0 0 0 / 0.6)',
  '0 25px 50px -12px rgb(0 0 0 / 0.6)',
  '0 25px 50px -12px rgb(0 0 0 / 0.6)',
  '0 25px 50px -12px rgb(0 0 0 / 0.6)',
  '0 25px 50px -12px rgb(0 0 0 / 0.6)',
  '0 25px 50px -12px rgb(0 0 0 / 0.6)',
  '0 25px 50px -12px rgb(0 0 0 / 0.6)',
  '0 25px 50px -12px rgb(0 0 0 / 0.6)',
  '0 25px 50px -12px rgb(0 0 0 / 0.6)',
  '0 25px 50px -12px rgb(0 0 0 / 0.6)',
  '0 25px 50px -12px rgb(0 0 0 / 0.6)',
  '0 25px 50px -12px rgb(0 0 0 / 0.6)',
  '0 25px 50px -12px rgb(0 0 0 / 0.6)',
  '0 25px 50px -12px rgb(0 0 0 / 0.6)',
] as const;

// ============================================================================
// LIGHT THEME PALETTE
// ============================================================================

const lightPalette: PaletteOptions = {
  mode: 'light',
  
  primary: {
    main: colors.primary[500],
    light: colors.primary[400],
    dark: colors.primary[700],
    contrastText: colors.neutral[0],
  },
  
  secondary: {
    main: colors.secondary[700],
    light: colors.secondary[500],
    dark: colors.secondary[800],
    contrastText: colors.neutral[0],
  },
  
  success: {
    main: colors.success[500],
    light: colors.success[400],
    dark: colors.success[700],
    contrastText: colors.neutral[0],
  },
  
  error: {
    main: colors.error[500],
    light: colors.error[400],
    dark: colors.error[700],
    contrastText: colors.neutral[0],
  },
  
  warning: {
    main: colors.warning[500],
    light: colors.warning[400],
    dark: colors.warning[700],
    contrastText: colors.neutral[900],
  },
  
  info: {
    main: colors.info[500],
    light: colors.info[400],
    dark: colors.info[700],
    contrastText: colors.neutral[0],
  },
  
  background: {
    default: colors.neutral[50],
    paper: colors.neutral[0],
  },
  
  text: {
    primary: colors.neutral[900],    // #0f172a - 15.4:1 contrast on white ✓
    secondary: colors.neutral[700],  // #334155 - 9.6:1 contrast on white ✓ (was 600)
    disabled: colors.neutral[500],   // #64748b - 4.6:1 contrast on white ✓ (was 400)
  },
  
  divider: colors.neutral[300],      // Slightly darker for visibility
  
  action: {
    active: colors.neutral[700],     // Darker for visibility (was 600)
    hover: alpha(colors.neutral[900], 0.06),  // Slightly more visible
    selected: alpha(colors.primary[500], 0.12),
    disabled: colors.neutral[400],
    disabledBackground: colors.neutral[200],
    focus: alpha(colors.primary[500], 0.16),
  },
};

// ============================================================================
// DARK THEME PALETTE  
// ============================================================================

const darkPalette: PaletteOptions = {
  mode: 'dark',
  
  primary: {
    main: colors.primary[400],  // Lighter for dark mode
    light: colors.primary[300],
    dark: colors.primary[600],
    contrastText: colors.neutral[950],
  },
  
  secondary: {
    main: colors.secondary[400],
    light: colors.secondary[300],
    dark: colors.secondary[600],
    contrastText: colors.neutral[950],
  },
  
  success: {
    main: colors.success[400],
    light: colors.success[300],
    dark: colors.success[600],
    contrastText: colors.neutral[950],
  },
  
  error: {
    main: colors.error[400],
    light: colors.error[300],
    dark: colors.error[600],
    contrastText: colors.neutral[950],
  },
  
  warning: {
    main: colors.warning[400],
    light: colors.warning[300],
    dark: colors.warning[600],
    contrastText: colors.neutral[950],
  },
  
  info: {
    main: colors.info[400],
    light: colors.info[300],
    dark: colors.info[600],
    contrastText: colors.neutral[950],
  },
  
  background: {
    default: colors.neutral[950],
    paper: colors.neutral[900],
  },
  
  text: {
    primary: colors.neutral[50],     // #f8fafc - High contrast on dark
    secondary: colors.neutral[300],  // #cbd5e1 - Better contrast (was 400)
    disabled: colors.neutral[500],   // #64748b - Still visible but muted
  },
  
  divider: colors.neutral[700],      // Slightly lighter for visibility (was 800)
  
  action: {
    active: colors.neutral[200],     // Lighter for visibility (was 300)
    hover: alpha(colors.neutral[50], 0.1),  // Slightly more visible
    selected: alpha(colors.primary[400], 0.2),
    disabled: colors.neutral[600],
    disabledBackground: colors.neutral[800],
    focus: alpha(colors.primary[400], 0.28),
  },
};

// ============================================================================
// COMPONENT OVERRIDES - Shared
// ============================================================================

const getComponentOverrides = (mode: 'light' | 'dark'): ThemeOptions['components'] => {
  const isDark = mode === 'dark';
  
  return {
    MuiCssBaseline: {
      styleOverrides: {
        '*, *::before, *::after': {
          boxSizing: 'border-box',
        },
        html: {
          WebkitFontSmoothing: 'antialiased',
          MozOsxFontSmoothing: 'grayscale',
        },
        body: {
          scrollBehavior: 'smooth',
        },
        '::selection': {
          backgroundColor: alpha(colors.primary[500], isDark ? 0.4 : 0.2),
          color: isDark ? colors.neutral[50] : colors.neutral[900],
        },
        ':focus-visible': {
          outline: `2px solid ${colors.primary[isDark ? 400 : 500]}`,
          outlineOffset: '2px',
        },
      },
    },
    
    MuiButton: {
      defaultProps: {
        disableElevation: true,
      },
      styleOverrides: {
        root: {
          borderRadius: 10,
          padding: '10px 24px',
          fontSize: '0.9375rem',
          fontWeight: 600,
          transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        },
        contained: {
          '&:hover': {
            transform: 'translateY(-1px)',
          },
          '&:active': {
            transform: 'translateY(0)',
          },
        },
        containedPrimary: {
          background: `linear-gradient(135deg, ${colors.primary[500]} 0%, ${colors.secondary[700]} 100%)`,
          boxShadow: `0 4px 14px 0 ${alpha(colors.primary[500], 0.35)}`,
          '&:hover': {
            background: `linear-gradient(135deg, ${colors.primary[600]} 0%, ${colors.secondary[800]} 100%)`,
            boxShadow: `0 6px 20px 0 ${alpha(colors.primary[500], 0.45)}`,
          },
        },
        containedSecondary: {
          background: `linear-gradient(135deg, ${colors.secondary[600]} 0%, ${colors.secondary[800]} 100%)`,
          boxShadow: `0 4px 14px 0 ${alpha(colors.secondary[600], 0.35)}`,
          '&:hover': {
            background: `linear-gradient(135deg, ${colors.secondary[700]} 0%, ${colors.secondary[900]} 100%)`,
          },
        },
        containedSuccess: {
          background: `linear-gradient(135deg, ${colors.success[500]} 0%, ${colors.success[700]} 100%)`,
          boxShadow: `0 4px 14px 0 ${alpha(colors.success[500], 0.35)}`,
          '&:hover': {
            background: `linear-gradient(135deg, ${colors.success[600]} 0%, ${colors.success[800]} 100%)`,
          },
        },
        containedError: {
          background: `linear-gradient(135deg, ${colors.error[500]} 0%, ${colors.error[700]} 100%)`,
          boxShadow: `0 4px 14px 0 ${alpha(colors.error[500], 0.35)}`,
          '&:hover': {
            background: `linear-gradient(135deg, ${colors.error[600]} 0%, ${colors.error[800]} 100%)`,
          },
        },
        outlined: {
          borderWidth: 2,
          '&:hover': {
            borderWidth: 2,
            backgroundColor: isDark 
              ? alpha(colors.neutral[50], 0.05) 
              : alpha(colors.neutral[900], 0.04),
          },
        },
        outlinedPrimary: {
          borderColor: colors.primary[isDark ? 400 : 500],
          color: colors.primary[isDark ? 400 : 500],
          '&:hover': {
            borderColor: colors.primary[isDark ? 300 : 600],
            backgroundColor: alpha(colors.primary[500], isDark ? 0.12 : 0.08),
          },
        },
        text: {
          '&:hover': {
            backgroundColor: isDark 
              ? alpha(colors.neutral[50], 0.08) 
              : alpha(colors.neutral[900], 0.04),
          },
        },
        sizeSmall: {
          padding: '6px 16px',
          fontSize: '0.8125rem',
        },
        sizeLarge: {
          padding: '14px 32px',
          fontSize: '1rem',
        },
      },
    },
    
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 16,
          backgroundImage: 'none',
          border: isDark ? `1px solid ${colors.neutral[800]}` : 'none',
          boxShadow: isDark 
            ? `0 4px 20px ${alpha(colors.neutral[950], 0.5)}` 
            : `0 4px 20px ${alpha(colors.neutral[900], 0.08)}`,
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          '&:hover': {
            boxShadow: isDark 
              ? `0 8px 30px ${alpha(colors.neutral[950], 0.6)}` 
              : `0 8px 30px ${alpha(colors.neutral[900], 0.12)}`,
          },
        },
      },
    },
    
    MuiCardHeader: {
      styleOverrides: {
        root: {
          padding: '20px 24px 16px',
        },
        title: {
          fontWeight: 600,
          fontSize: '1.125rem',
        },
        subheader: {
          color: isDark ? colors.neutral[300] : colors.neutral[600],
          marginTop: 4,
        },
      },
    },
    
    MuiCardContent: {
      styleOverrides: {
        root: {
          padding: '16px 24px',
          '&:last-child': {
            paddingBottom: 24,
          },
        },
      },
    },
    
    MuiChip: {
      styleOverrides: {
        root: {
          fontWeight: 600,
          borderRadius: 8,
        },
        filled: {
          '&.MuiChip-colorSuccess': {
            background: `linear-gradient(135deg, ${colors.success[isDark ? 600 : 500]} 0%, ${colors.success[isDark ? 700 : 600]} 100%)`,
          },
          '&.MuiChip-colorError': {
            background: `linear-gradient(135deg, ${colors.error[isDark ? 600 : 500]} 0%, ${colors.error[isDark ? 700 : 600]} 100%)`,
          },
          '&.MuiChip-colorWarning': {
            background: `linear-gradient(135deg, ${colors.warning[isDark ? 600 : 500]} 0%, ${colors.warning[isDark ? 700 : 600]} 100%)`,
          },
          '&.MuiChip-colorInfo': {
            background: `linear-gradient(135deg, ${colors.info[isDark ? 600 : 500]} 0%, ${colors.info[isDark ? 700 : 600]} 100%)`,
          },
          '&.MuiChip-colorPrimary': {
            background: `linear-gradient(135deg, ${colors.primary[isDark ? 500 : 500]} 0%, ${colors.secondary[isDark ? 600 : 700]} 100%)`,
          },
          '&.MuiChip-colorSecondary': {
            background: `linear-gradient(135deg, ${colors.secondary[isDark ? 500 : 600]} 0%, ${colors.secondary[isDark ? 700 : 800]} 100%)`,
          },
        },
        outlined: {
          borderWidth: 2,
        },
        sizeSmall: {
          fontSize: '0.75rem',
          height: 24,
        },
      },
    },
    
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          borderRadius: 12,
        },
        outlined: {
          borderColor: isDark ? colors.neutral[800] : colors.neutral[200],
        },
        elevation1: {
          boxShadow: isDark
            ? `0 2px 8px ${alpha(colors.neutral[950], 0.4)}`
            : `0 2px 8px ${alpha(colors.neutral[900], 0.06)}`,
        },
        elevation2: {
          boxShadow: isDark
            ? `0 4px 16px ${alpha(colors.neutral[950], 0.5)}`
            : `0 4px 16px ${alpha(colors.neutral[900], 0.08)}`,
        },
        elevation3: {
          boxShadow: isDark
            ? `0 8px 24px ${alpha(colors.neutral[950], 0.6)}`
            : `0 8px 24px ${alpha(colors.neutral[900], 0.1)}`,
        },
      },
    },
    
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          boxShadow: 'none',
          borderBottom: `1px solid ${isDark ? colors.neutral[800] : colors.neutral[200]}`,
        },
        colorDefault: {
          backgroundColor: isDark 
            ? alpha(colors.neutral[900], 0.8) 
            : alpha(colors.neutral[0], 0.8),
          backdropFilter: 'blur(8px)',
        },
      },
    },
    
    MuiDrawer: {
      styleOverrides: {
        paper: {
          borderRight: isDark 
            ? `1px solid ${colors.neutral[800]}` 
            : `1px solid ${colors.neutral[200]}`,
        },
      },
    },
    
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 10,
            transition: 'all 0.2s ease',
            '&:hover .MuiOutlinedInput-notchedOutline': {
              borderColor: colors.primary[isDark ? 400 : 500],
            },
            '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
              borderWidth: 2,
              borderColor: colors.primary[isDark ? 400 : 500],
            },
          },
          '& .MuiInputLabel-root.Mui-focused': {
            color: colors.primary[isDark ? 400 : 500],
          },
        },
      },
    },
    
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          '& .MuiOutlinedInput-notchedOutline': {
            borderColor: isDark ? colors.neutral[700] : colors.neutral[300],
          },
        },
        input: {
          padding: '14px 16px',
        },
      },
    },
    
    MuiAlert: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          padding: '12px 16px',
        },
        standardSuccess: {
          backgroundColor: alpha(colors.success[500], isDark ? 0.15 : 0.1),
          color: colors.success[isDark ? 300 : 700],
          '& .MuiAlert-icon': {
            color: colors.success[isDark ? 400 : 500],
          },
        },
        standardError: {
          backgroundColor: alpha(colors.error[500], isDark ? 0.15 : 0.1),
          color: colors.error[isDark ? 300 : 700],
          '& .MuiAlert-icon': {
            color: colors.error[isDark ? 400 : 500],
          },
        },
        standardWarning: {
          backgroundColor: alpha(colors.warning[500], isDark ? 0.15 : 0.1),
          color: colors.warning[isDark ? 300 : 700],
          '& .MuiAlert-icon': {
            color: colors.warning[isDark ? 400 : 500],
          },
        },
        standardInfo: {
          backgroundColor: alpha(colors.info[500], isDark ? 0.15 : 0.1),
          color: colors.info[isDark ? 300 : 700],
          '& .MuiAlert-icon': {
            color: colors.info[isDark ? 400 : 500],
          },
        },
        filled: {
          fontWeight: 500,
        },
        filledSuccess: {
          background: `linear-gradient(135deg, ${colors.success[500]} 0%, ${colors.success[600]} 100%)`,
        },
        filledError: {
          background: `linear-gradient(135deg, ${colors.error[500]} 0%, ${colors.error[600]} 100%)`,
        },
        filledWarning: {
          background: `linear-gradient(135deg, ${colors.warning[500]} 0%, ${colors.warning[600]} 100%)`,
          color: colors.neutral[900],
        },
        filledInfo: {
          background: `linear-gradient(135deg, ${colors.info[500]} 0%, ${colors.info[600]} 100%)`,
        },
      },
    },
    
    MuiLinearProgress: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          height: 8,
          backgroundColor: isDark 
            ? alpha(colors.neutral[400], 0.2) 
            : alpha(colors.neutral[500], 0.15),
        },
        bar: {
          borderRadius: 8,
        },
        barColorPrimary: {
          background: `linear-gradient(90deg, ${colors.primary[500]} 0%, ${colors.secondary[600]} 100%)`,
        },
        barColorSecondary: {
          background: `linear-gradient(90deg, ${colors.secondary[500]} 0%, ${colors.secondary[700]} 100%)`,
        },
      },
    },
    
    MuiCircularProgress: {
      styleOverrides: {
        colorPrimary: {
          color: colors.primary[isDark ? 400 : 500],
        },
        colorSecondary: {
          color: colors.secondary[isDark ? 400 : 600],
        },
      },
    },
    
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          backgroundColor: isDark ? colors.neutral[800] : colors.neutral[900],
          color: colors.neutral[50],
          fontSize: '0.8125rem',
          fontWeight: 500,
          padding: '8px 12px',
          borderRadius: 8,
          boxShadow: `0 4px 14px ${alpha(colors.neutral[950], 0.25)}`,
        },
        arrow: {
          color: isDark ? colors.neutral[800] : colors.neutral[900],
        },
      },
    },
    
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 20,
          boxShadow: isDark
            ? `0 24px 48px -12px ${alpha(colors.neutral[950], 0.5)}`
            : `0 24px 48px -12px ${alpha(colors.neutral[900], 0.2)}`,
        },
      },
    },
    
    MuiDialogTitle: {
      styleOverrides: {
        root: {
          fontSize: '1.25rem',
          fontWeight: 600,
          padding: '24px 24px 16px',
        },
      },
    },
    
    MuiDialogContent: {
      styleOverrides: {
        root: {
          padding: '16px 24px',
        },
      },
    },
    
    MuiDialogActions: {
      styleOverrides: {
        root: {
          padding: '16px 24px 24px',
          gap: 12,
        },
      },
    },
    
    MuiTabs: {
      styleOverrides: {
        root: {
          minHeight: 48,
        },
        indicator: {
          height: 3,
          borderRadius: '3px 3px 0 0',
          background: `linear-gradient(90deg, ${colors.primary[500]} 0%, ${colors.secondary[600]} 100%)`,
        },
      },
    },
    
    MuiTab: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 600,
          fontSize: '0.9375rem',
          minHeight: 48,
          padding: '12px 24px',
          '&.Mui-selected': {
            color: colors.primary[isDark ? 400 : 500],
          },
        },
      },
    },
    
    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          marginBottom: 4,
          '&.Mui-selected': {
            backgroundColor: alpha(colors.primary[500], isDark ? 0.16 : 0.08),
            '&:hover': {
              backgroundColor: alpha(colors.primary[500], isDark ? 0.24 : 0.12),
            },
          },
          '&:hover': {
            backgroundColor: isDark 
              ? alpha(colors.neutral[50], 0.05) 
              : alpha(colors.neutral[900], 0.04),
          },
        },
      },
    },
    
    MuiSwitch: {
      styleOverrides: {
        root: {
          width: 52,
          height: 32,
          padding: 0,
        },
        switchBase: {
          padding: 4,
          '&.Mui-checked': {
            transform: 'translateX(20px)',
            '& + .MuiSwitch-track': {
              backgroundColor: colors.primary[isDark ? 400 : 500],
              opacity: 1,
            },
          },
        },
        thumb: {
          width: 24,
          height: 24,
          boxShadow: `0 2px 4px ${alpha(colors.neutral[900], 0.2)}`,
        },
        track: {
          borderRadius: 16,
          backgroundColor: isDark ? colors.neutral[700] : colors.neutral[300],
          opacity: 1,
        },
      },
    },
    
    MuiRadio: {
      styleOverrides: {
        root: {
          '&.Mui-checked': {
            color: colors.primary[isDark ? 400 : 500],
          },
        },
      },
    },
    
    MuiCheckbox: {
      styleOverrides: {
        root: {
          '&.Mui-checked': {
            color: colors.primary[isDark ? 400 : 500],
          },
        },
      },
    },
    
    MuiSlider: {
      styleOverrides: {
        root: {
          '& .MuiSlider-thumb': {
            width: 20,
            height: 20,
            '&:hover, &.Mui-focusVisible': {
              boxShadow: `0 0 0 8px ${alpha(colors.primary[500], 0.16)}`,
            },
          },
          '& .MuiSlider-track': {
            background: `linear-gradient(90deg, ${colors.primary[500]} 0%, ${colors.secondary[600]} 100%)`,
            border: 'none',
          },
          '& .MuiSlider-rail': {
            backgroundColor: isDark ? colors.neutral[700] : colors.neutral[300],
          },
        },
      },
    },
    
    MuiDivider: {
      styleOverrides: {
        root: {
          borderColor: isDark ? colors.neutral[800] : colors.neutral[200],
        },
      },
    },
    
    MuiSkeleton: {
      styleOverrides: {
        root: {
          backgroundColor: isDark 
            ? alpha(colors.neutral[400], 0.1) 
            : alpha(colors.neutral[500], 0.1),
        },
      },
    },
    
    MuiAccordion: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          '&:before': {
            display: 'none',
          },
          '&.Mui-expanded': {
            margin: '8px 0',
          },
        },
      },
    },
    
    MuiAccordionSummary: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          minHeight: 56,
          '&.Mui-expanded': {
            minHeight: 56,
          },
        },
        content: {
          '&.Mui-expanded': {
            margin: '12px 0',
          },
        },
      },
    },
    
    MuiTableHead: {
      styleOverrides: {
        root: {
          '& .MuiTableCell-root': {
            fontWeight: 600,
            backgroundColor: isDark ? colors.neutral[900] : colors.neutral[50],
            borderBottom: `2px solid ${isDark ? colors.neutral[800] : colors.neutral[200]}`,
          },
        },
      },
    },
    
    MuiTableCell: {
      styleOverrides: {
        root: {
          borderBottom: `1px solid ${isDark ? colors.neutral[800] : colors.neutral[200]}`,
        },
      },
    },
    
    MuiBadge: {
      styleOverrides: {
        badge: {
          fontWeight: 600,
          fontSize: '0.75rem',
        },
        colorPrimary: {
          background: `linear-gradient(135deg, ${colors.primary[500]} 0%, ${colors.secondary[600]} 100%)`,
        },
        colorError: {
          background: `linear-gradient(135deg, ${colors.error[500]} 0%, ${colors.error[600]} 100%)`,
        },
      },
    },
    
    MuiAvatar: {
      styleOverrides: {
        root: {
          fontWeight: 600,
        },
        colorDefault: {
          background: `linear-gradient(135deg, ${colors.primary[500]} 0%, ${colors.secondary[600]} 100%)`,
          color: colors.neutral[0],
        },
      },
    },
    
    MuiIconButton: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          transition: 'all 0.2s ease',
          '&:hover': {
            backgroundColor: isDark 
              ? alpha(colors.neutral[50], 0.08) 
              : alpha(colors.neutral[900], 0.04),
          },
        },
        colorPrimary: {
          '&:hover': {
            backgroundColor: alpha(colors.primary[500], isDark ? 0.16 : 0.08),
          },
        },
      },
    },
    
    MuiFab: {
      styleOverrides: {
        primary: {
          background: `linear-gradient(135deg, ${colors.primary[500]} 0%, ${colors.secondary[700]} 100%)`,
          boxShadow: `0 8px 20px ${alpha(colors.primary[500], 0.4)}`,
          '&:hover': {
            background: `linear-gradient(135deg, ${colors.primary[600]} 0%, ${colors.secondary[800]} 100%)`,
            boxShadow: `0 12px 28px ${alpha(colors.primary[500], 0.5)}`,
          },
        },
      },
    },
    
    MuiSnackbar: {
      styleOverrides: {
        root: {
          '& .MuiPaper-root': {
            borderRadius: 12,
          },
        },
      },
    },
    
    MuiMenu: {
      styleOverrides: {
        paper: {
          borderRadius: 12,
          marginTop: 8,
          boxShadow: isDark
            ? `0 8px 24px ${alpha(colors.neutral[950], 0.5)}`
            : `0 8px 24px ${alpha(colors.neutral[900], 0.15)}`,
          border: isDark ? `1px solid ${colors.neutral[800]}` : 'none',
        },
      },
    },
    
    MuiMenuItem: {
      styleOverrides: {
        root: {
          borderRadius: 6,
          margin: '2px 8px',
          padding: '10px 16px',
          '&:hover': {
            backgroundColor: isDark 
              ? alpha(colors.neutral[50], 0.05) 
              : alpha(colors.neutral[900], 0.04),
          },
          '&.Mui-selected': {
            backgroundColor: alpha(colors.primary[500], isDark ? 0.16 : 0.08),
            '&:hover': {
              backgroundColor: alpha(colors.primary[500], isDark ? 0.24 : 0.12),
            },
          },
        },
      },
    },
    
    MuiPopover: {
      styleOverrides: {
        paper: {
          borderRadius: 12,
          boxShadow: isDark
            ? `0 8px 24px ${alpha(colors.neutral[950], 0.5)}`
            : `0 8px 24px ${alpha(colors.neutral[900], 0.15)}`,
        },
      },
    },
    
    MuiAutocomplete: {
      styleOverrides: {
        paper: {
          borderRadius: 12,
          boxShadow: isDark
            ? `0 8px 24px ${alpha(colors.neutral[950], 0.5)}`
            : `0 8px 24px ${alpha(colors.neutral[900], 0.15)}`,
        },
        listbox: {
          padding: 8,
          '& .MuiAutocomplete-option': {
            borderRadius: 8,
            margin: '2px 0',
          },
        },
      },
    },
    
    MuiBreadcrumbs: {
      styleOverrides: {
        separator: {
          color: isDark ? colors.neutral[500] : colors.neutral[500],
        },
      },
    },
    
    MuiStepIcon: {
      styleOverrides: {
        root: {
          '&.Mui-completed': {
            color: colors.success[isDark ? 400 : 500],
          },
          '&.Mui-active': {
            color: colors.primary[isDark ? 400 : 500],
          },
        },
      },
    },
    
    MuiRating: {
      styleOverrides: {
        iconFilled: {
          color: colors.warning[isDark ? 400 : 500],
        },
        iconHover: {
          color: colors.warning[isDark ? 300 : 400],
        },
      },
    },
    
    MuiPagination: {
      styleOverrides: {
        root: {
          '& .MuiPaginationItem-root': {
            borderRadius: 8,
            '&.Mui-selected': {
              background: `linear-gradient(135deg, ${colors.primary[500]} 0%, ${colors.secondary[600]} 100%)`,
              color: colors.neutral[0],
              '&:hover': {
                background: `linear-gradient(135deg, ${colors.primary[600]} 0%, ${colors.secondary[700]} 100%)`,
              },
            },
          },
        },
      },
    },
  };
};

// ============================================================================
// CREATE THEMES
// ============================================================================

export const lightTheme = createTheme({
  palette: lightPalette,
  typography,
  shape,
  spacing,
  shadows: lightShadows as any,
  components: getComponentOverrides('light'),
});

export const darkTheme = createTheme({
  palette: darkPalette,
  typography,
  shape,
  spacing,
  shadows: darkShadows as any,
  components: getComponentOverrides('dark'),
});

// ============================================================================
// THEME UTILITIES - Export color tokens for custom components
// ============================================================================

export { colors };

// Gradient utility
export const gradients = {
  primary: `linear-gradient(135deg, ${colors.primary[500]} 0%, ${colors.secondary[700]} 100%)`,
  primaryHover: `linear-gradient(135deg, ${colors.primary[600]} 0%, ${colors.secondary[800]} 100%)`,
  success: `linear-gradient(135deg, ${colors.success[500]} 0%, ${colors.success[700]} 100%)`,
  error: `linear-gradient(135deg, ${colors.error[500]} 0%, ${colors.error[700]} 100%)`,
  warning: `linear-gradient(135deg, ${colors.warning[500]} 0%, ${colors.warning[700]} 100%)`,
  info: `linear-gradient(135deg, ${colors.info[500]} 0%, ${colors.info[700]} 100%)`,
  dark: `linear-gradient(135deg, ${colors.neutral[800]} 0%, ${colors.neutral[950]} 100%)`,
  aurora: `linear-gradient(135deg, ${colors.primary[400]} 0%, ${colors.secondary[500]} 50%, ${colors.info[400]} 100%)`,
  sunset: `linear-gradient(135deg, ${colors.warning[400]} 0%, ${colors.error[500]} 100%)`,
  ocean: `linear-gradient(135deg, ${colors.info[400]} 0%, ${colors.primary[600]} 100%)`,
  forest: `linear-gradient(135deg, ${colors.success[400]} 0%, ${colors.success[700]} 100%)`,
};

// Glass effect utility (for frosted glass cards)
export const glassEffect = (isDark: boolean) => ({
  backgroundColor: isDark 
    ? alpha(colors.neutral[900], 0.7) 
    : alpha(colors.neutral[0], 0.7),
  backdropFilter: 'blur(12px)',
  border: `1px solid ${isDark ? alpha(colors.neutral[50], 0.1) : alpha(colors.neutral[900], 0.1)}`,
});

// Glow effect utility
export const glowEffect = (color: string, intensity: 'low' | 'medium' | 'high' = 'medium') => {
  const opacities = { low: 0.2, medium: 0.35, high: 0.5 };
  return `0 0 20px ${alpha(color, opacities[intensity])}, 0 0 40px ${alpha(color, opacities[intensity] * 0.5)}`;
};
