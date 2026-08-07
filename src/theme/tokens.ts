export const palette = {
  brand50: '#F0FCFE',
  brand100: '#DDF8FC',
  brand300: '#7BE1F0',
  brand500: '#0CC0DF',
  brand600: '#079CB8',
  brand700: '#067A90',
  ink950: '#071417',
  ink900: '#0B1F24',
  ink700: '#334A50',
  ink500: '#60767C',
  ink300: '#A9BAC0',
  ink200: '#CBD7DB',
  ink100: '#E6EEF0',
  ink50: '#F7FBFC',
  white: '#FFFFFF',
  green500: '#168A62',
  green100: '#DDF5EA',
  amber500: '#B86B00',
  amber100: '#FFF0D5',
  red500: '#C73A4A',
  red100: '#FCE4E8',
  black: '#000000',
} as const;

export const spacing = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
} as const;

export const radii = {
  sm: 8,
  md: 12,
  lg: 18,
  xl: 24,
  pill: 999,
} as const;

export const typography = {
  family: {
    body: 'OpenSans_400Regular',
    bodyStrong: 'OpenSans_600SemiBold',
    heading: 'Poppins_600SemiBold',
    headingBold: 'Poppins_700Bold',
  },
  size: {
    caption: 12,
    label: 14,
    body: 16,
    bodyLarge: 18,
    title: 24,
    display: 36,
  },
  lineHeight: {
    caption: 17,
    label: 20,
    body: 25,
    bodyLarge: 28,
    title: 32,
    display: 44,
  },
} as const;

export const sizes = {
  touchTarget: 48,
  iconSm: 18,
  iconMd: 24,
  iconLg: 32,
  contentMaxWidth: 720,
} as const;
