export const AppColors = {
  // Backgrounds
  background: '#0A0E21',
  surface: '#141829',
  surfaceLight: '#1C2039',
  cardDark: '#141829',
  cardLight: '#1E2235',

  // Primary (Orange)
  primary: '#FF6B35',
  primaryLight: '#FF8A5C',
  primaryDark: '#E55A2B',

  // Secondary (Green)
  secondary: '#00C853',
  secondaryLight: '#5EFC82',
  secondaryDark: '#009624',

  // Accent Colors
  blue: '#2196F3',
  blueLight: '#64B5F6',
  purple: '#7C4DFF',
  red: '#FF5252',
  yellow: '#FFD740',

  // Module Colors
  foodModule: '#00C853',
  rideModule: '#2196F3',
  marketplaceModule: '#FF6B35',

  // Typography Colors
  textPrimary: '#FFFFFF',
  textSecondary: '#8E8E93',
  textTertiary: '#6C6C70',
  textHint: '#48485A',

  // Status
  success: '#00C853',
  warning: '#FFD740',
  error: '#FF5252',
  info: '#2196F3',

  // UI Elements
  divider: '#2A2A3A',
  border: '#2A2D3E',
  shimmerBase: '#1C2039',
  shimmerHighlight: '#2A2D3E',
  overlay: 'rgba(0, 0, 0, 0.5)',
  vegBadge: '#00C853',
  nonVegBadge: '#FF5252',
} as const;

export type AppColorKey = keyof typeof AppColors;

export const colors = AppColors;
