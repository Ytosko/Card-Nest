import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton } from '@/src/components/ui/app-button';
import { AppText } from '@/src/components/ui/app-text';
import { AuthNotice } from '@/src/features/auth/components/auth-notice';
import { useCaptureQueue } from '@/src/features/capture/capture-queue-provider';
import { useFeatureAccess } from '@/src/features/entitlements/use-entitlement';
import { useAppTheme } from '@/src/theme/theme-provider';

type Side = 'front' | 'back';

export default function ScanScreen() {
  const theme = useAppTheme(); const router = useRouter(); const queue = useCaptureQueue();
  const camera = useRef<CameraView>(null); const [permission, requestPermission] = useCameraPermissions();
  const access = useFeatureAccess('scan_card');
  const [side, setSide] = useState<Side>('front'); const [frontUri, setFrontUri] = useState<string | null>(null); const [backUri, setBackUri] = useState<string | null>(null);
  const [previewUri, setPreviewUri] = useState<string | null>(null); const [saving, setSaving] = useState(false); const [error, setError] = useState<string | null>(null);

  async function takePhoto() {
    setError(null);
    try { const result = await camera.current?.takePictureAsync({ quality: 0.92, skipProcessing: false }); if (result?.uri) setPreviewUri(result.uri); }
    catch { setError('The photo could not be captured. Please try again.'); }
  }

  async function pickPhoto() {
    setError(null);
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [16, 10], quality: 0.95 });
    if (!result.canceled) setPreviewUri(result.assets[0]?.uri ?? null);
  }

  function keepPhoto() {
    if (!previewUri) return;
    if (side === 'front') { setFrontUri(previewUri); setPreviewUri(null); setSide('back'); }
    else { setBackUri(previewUri); setPreviewUri(null); }
  }

  async function saveCapture(includePreview = false) {
    const currentFront = side === 'front' && includePreview ? previewUri : frontUri;
    const currentBack = side === 'back' && includePreview ? previewUri : backUri;
    if (!currentFront) { setError('Capture the front of the card first.'); return; }
    setSaving(true); setError(null);
    try {
      const cardId = await queue.enqueue(currentFront, currentBack);
      setFrontUri(null); setBackUri(null); setPreviewUri(null); setSide('front');
      router.push({ pathname: '/(app)/capture-saved', params: { id: cardId } });
    } catch { setError('Card Nest could not secure this capture on your device. Check available storage and try again.'); }
    finally { setSaving(false); }
  }

  if (!permission || access.isLoading) return <View style={[styles.center, { backgroundColor: theme.colors.background }]}><ActivityIndicator color={theme.colors.primary} /></View>;
  if (!access.allowed) return <SafeAreaView style={[styles.center, { backgroundColor: theme.colors.background, padding: theme.spacing[6] }]}><View style={[styles.permissionIcon, { backgroundColor: theme.colors.warningSoft }]}><MaterialCommunityIcons color={theme.colors.warning} name="lock-outline" size={42} /></View><AppText accessibilityRole="header" variant="title" style={styles.centerText}>Scanning is unavailable for this account</AppText><AppText muted style={styles.centerText}>Your current Card Nest access policy does not include card scanning. You can still view and export saved contacts.</AppText></SafeAreaView>;
  if (!permission.granted) return (
    <SafeAreaView style={[styles.center, { backgroundColor: theme.colors.background, padding: theme.spacing[6] }]}>
      <View style={[styles.permissionIcon, { backgroundColor: theme.colors.primarySoft }]}><MaterialCommunityIcons color={theme.colors.primary} name="camera-outline" size={42} /></View>
      <AppText accessibilityRole="header" variant="title" style={styles.centerText}>Photograph business cards</AppText>
      <AppText muted style={styles.centerText}>Camera access lets Card Nest capture a card’s front and optional back. You can also choose an existing photo.</AppText>
      <AppButton onPress={() => void requestPermission()}>Allow camera</AppButton>
      <AppButton onPress={() => void pickPhoto()} variant="secondary">Choose a photo</AppButton>
    </SafeAreaView>
  );

  return (
    <SafeAreaView edges={['top']} style={[styles.safeArea, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.header, { padding: theme.spacing[5] }]}>
        <View><AppText variant="title">{side === 'front' ? 'Front of card' : 'Back of card'}</AppText><AppText muted variant="caption">{side === 'front' ? 'Keep all four edges inside the frame.' : 'Optional — capture extra details or save now.'}</AppText></View>
        {frontUri ? <View style={[styles.frontDone, { backgroundColor: theme.colors.successSoft }]}><MaterialCommunityIcons color={theme.colors.success} name="check" size={18} /><AppText variant="caption" style={{ color: theme.colors.success }}>Front saved</AppText></View> : null}
      </View>
      <View style={styles.viewport}>
        {previewUri ? <Image contentFit="contain" source={previewUri} style={StyleSheet.absoluteFill} /> : <CameraView facing="back" ref={camera} style={StyleSheet.absoluteFill} />}
        {!previewUri ? <View pointerEvents="none" style={[styles.guide, { borderColor: theme.colors.primary }]}><View style={[styles.guideLabel, { backgroundColor: theme.colors.primary }]}><AppText variant="caption" style={{ color: theme.colors.textOnBrand }}>{side === 'front' ? 'FRONT' : 'BACK'}</AppText></View></View> : null}
      </View>
      {error ? <View style={{ paddingHorizontal: theme.spacing[5], paddingTop: theme.spacing[3] }}><AuthNotice message={error} /></View> : null}
      <View style={[styles.controls, { padding: theme.spacing[5] }]}>
        {previewUri ? (
          <><AppButton disabled={saving} onPress={() => setPreviewUri(null)} variant="secondary">Retake</AppButton><AppButton disabled={saving} onPress={keepPhoto}>{side === 'front' ? 'Use front' : 'Use back'}</AppButton>{side === 'back' ? <AppButton loading={saving} onPress={() => void saveCapture(true)}>Add to Card Nest</AppButton> : null}</>
        ) : (
          <><Pressable accessibilityLabel={`Capture ${side} of business card`} accessibilityRole="button" onPress={() => void takePhoto()} style={[styles.shutter, { borderColor: theme.colors.primary }]}><View style={[styles.shutterCore, { backgroundColor: theme.colors.primary }]} /></Pressable><View style={styles.controlRow}><AppButton onPress={() => void pickPhoto()} variant="secondary">Choose photo</AppButton>{side === 'back' && frontUri ? <AppButton loading={saving} onPress={() => void saveCapture()}>Save without back</AppButton> : null}</View></>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', flex: 1, gap: 16, justifyContent: 'center' }, centerText: { maxWidth: 440, textAlign: 'center' }, controlRow: { flexDirection: 'row', gap: 12, justifyContent: 'center' }, controls: { gap: 12 }, frontDone: { alignItems: 'center', borderRadius: 999, flexDirection: 'row', gap: 4, paddingHorizontal: 10, paddingVertical: 6 }, guide: { alignItems: 'center', aspectRatio: 1.58, borderRadius: 18, borderWidth: 3, justifyContent: 'flex-start', width: '86%' }, guideLabel: { borderBottomLeftRadius: 8, borderBottomRightRadius: 8, paddingHorizontal: 14, paddingVertical: 4 }, header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' }, permissionIcon: { alignItems: 'center', borderRadius: 999, height: 84, justifyContent: 'center', width: 84 }, safeArea: { flex: 1 }, shutter: { alignItems: 'center', alignSelf: 'center', borderRadius: 999, borderWidth: 4, height: 72, justifyContent: 'center', width: 72 }, shutterCore: { borderRadius: 999, height: 54, width: 54 }, viewport: { alignItems: 'center', backgroundColor: '#020809', flex: 1, justifyContent: 'center', minHeight: 280, overflow: 'hidden' },
});
