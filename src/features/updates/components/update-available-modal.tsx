import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppButton } from '@/src/components/ui/app-button';
import { AppText } from '@/src/components/ui/app-text';
import type { NativeRelease } from '@/src/services/update-service';
import { useAppTheme } from '@/src/theme/theme-provider';

interface Props {
  release: NativeRelease;
  visible: boolean;
  onLater: () => void;
  onUpdate: () => void;
}

export function UpdateAvailableModal({ release, visible, onLater, onUpdate }: Props) {
  const theme = useAppTheme();
  const sizeMb = (release.asset.size / (1024 * 1024)).toFixed(1);

  return (
    <Modal
      accessibilityViewIsModal
      animationType="fade"
      onRequestClose={onLater}
      statusBarTranslucent
      transparent
      visible={visible}>
      <View style={[styles.scrim, { backgroundColor: theme.colors.scrim }]}>
        <View
          accessibilityLabel={`Card Nest ${release.versionName} update available`}
          accessibilityRole="alert"
          style={[
            styles.card,
            {
              backgroundColor: theme.colors.surfaceRaised,
              borderColor: theme.colors.border,
              borderRadius: theme.radii.xl,
            },
          ]}>
          <View style={[styles.iconWrap, { backgroundColor: theme.colors.primarySoft }]}>
            <MaterialCommunityIcons color={theme.colors.primary} name="cloud-download-outline" size={30} />
          </View>
          <View style={styles.heading}>
            <AppText variant="title">A new Card Nest is ready</AppText>
            <AppText muted>
              Version {release.versionName} · {sizeMb} MB
            </AppText>
          </View>
          <ScrollView style={styles.notes} contentContainerStyle={styles.notesContent}>
            <AppText muted>{release.releaseNotes}</AppText>
          </ScrollView>
          <View style={styles.actions}>
            <AppButton accessibilityLabel="Download Card Nest update" onPress={onUpdate}>
              Update now
            </AppButton>
            <Pressable
              accessibilityRole="button"
              hitSlop={8}
              onPress={onLater}
              style={({ pressed }) => [styles.later, { opacity: pressed ? 0.6 : 1 }]}>
              <AppText style={{ color: theme.colors.primary }} variant="label">
                Later
              </AppText>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  actions: { gap: 8, width: '100%' },
  card: { alignItems: 'center', borderWidth: 1, gap: 16, maxHeight: '82%', maxWidth: 480, padding: 24, width: '90%' },
  heading: { alignItems: 'center', gap: 4 },
  iconWrap: { alignItems: 'center', borderRadius: 999, height: 60, justifyContent: 'center', width: 60 },
  later: { alignItems: 'center', justifyContent: 'center', minHeight: 48, paddingHorizontal: 16 },
  notes: { maxHeight: 180, width: '100%' },
  notesContent: { paddingVertical: 4 },
  scrim: { alignItems: 'center', flex: 1, justifyContent: 'center', padding: 20 },
});
