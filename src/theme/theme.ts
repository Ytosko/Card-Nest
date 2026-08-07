import { palette, radii, sizes, spacing, typography } from './tokens';

export type AppColors = {
  background: string;
  surface: string;
  surfaceRaised: string;
  surfaceBrand: string;
  text: string;
  textMuted: string;
  textOnBrand: string;
  border: string;
  borderStrong: string;
  primary: string;
  primaryPressed: string;
  primarySoft: string;
  success: string;
  successSoft: string;
  warning: string;
  warningSoft: string;
  danger: string;
  dangerSoft: string;
  scrim: string;
};

const lightColors: AppColors = {
  background: palette.ink50,
  surface: palette.white,
  surfaceRaised: palette.white,
  surfaceBrand: palette.brand500,
  text: palette.ink900,
  textMuted: palette.ink500,
  textOnBrand: palette.white,
  border: palette.ink100,
  borderStrong: palette.ink200,
  primary: palette.brand600,
  primaryPressed: palette.brand700,
  primarySoft: palette.brand100,
  success: palette.green500,
  successSoft: palette.green100,
  warning: palette.amber500,
  warningSoft: palette.amber100,
  danger: palette.red500,
  dangerSoft: palette.red100,
  scrim: `${palette.black}80`,
};

const darkColors: AppColors = {
  background: palette.ink950,
  surface: '#0E252A',
  surfaceRaised: '#143139',
  surfaceBrand: palette.brand600,
  text: palette.ink50,
  textMuted: palette.ink300,
  textOnBrand: palette.ink950,
  border: '#244149',
  borderStrong: '#365860',
  primary: palette.brand300,
  primaryPressed: palette.brand500,
  primarySoft: '#103B44',
  success: '#64D6AD',
  successSoft: '#123B30',
  warning: '#F6BE61',
  warningSoft: '#473317',
  danger: '#FF8C98',
  dangerSoft: '#4B2027',
  scrim: `${palette.black}99`,
};

export type AppTheme = {
  dark: boolean;
  colors: AppColors;
  spacing: typeof spacing;
  radii: typeof radii;
  sizes: typeof sizes;
  typography: typeof typography;
};

export const lightTheme: AppTheme = {
  dark: false,
  colors: lightColors,
  spacing,
  radii,
  sizes,
  typography,
};

export const darkTheme: AppTheme = {
  ...lightTheme,
  dark: true,
  colors: darkColors,
};
