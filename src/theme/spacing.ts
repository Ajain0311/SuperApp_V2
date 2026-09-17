export const AppSpacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 40,
} as const;

export const AppRadius = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  round: 999,
} as const;

export const spacing = {
  ...AppSpacing,
  radiusXs: AppRadius.xs,
  radiusSm: AppRadius.sm,
  radiusMd: AppRadius.md,
  radiusLg: AppRadius.lg,
  radiusXl: AppRadius.xl,
  radiusRound: AppRadius.round,
};
