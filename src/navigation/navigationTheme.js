import { DefaultTheme } from '@react-navigation/native';
import { colors } from '../utils/theme';

export const navigationTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: colors.background,
    border: colors.border,
    card: colors.card,
    primary: colors.primary,
    text: colors.text,
  },
};
