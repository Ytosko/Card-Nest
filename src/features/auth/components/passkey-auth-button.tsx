import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { StyleSheet } from 'react-native';

import { AppButton } from '@/src/components/ui/app-button';
import { useAppTheme } from '@/src/theme/theme-provider';

export function PasskeyAuthButton({
  disabled,
  loading,
  onPress,
}: {
  disabled?: boolean;
  loading?: boolean;
  onPress: () => void;
}) {
  const theme = useAppTheme();
  return (
    <AppButton
      disabled={disabled}
      loading={loading}
      onPress={onPress}
      variant="secondary"
      style={[styles.button, { borderColor: theme.colors.border }]}>
      <MaterialCommunityIcons name="fingerprint" size={20} color={theme.colors.primary} style={{ marginRight: 8 }} />
      Continue with passkey
    </AppButton>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 48,
  },
});
