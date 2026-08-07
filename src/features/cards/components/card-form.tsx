import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppButton } from '@/src/components/ui/app-button';
import { AppText } from '@/src/components/ui/app-text';
import { AppTextField } from '@/src/components/ui/app-text-field';
import { AuthNotice } from '@/src/features/auth/components/auth-notice';
import { uploadContactPhoto, removeContactPhoto } from '@/src/features/cards/card-service';
import { useAppTheme } from '@/src/theme/theme-provider';

import { cardDraftSchema, type CardDraft } from '../card-schema';

export function CardForm({
  initial,
  submitLabel,
  busy,
  error,
  onSubmit,
  cardId,
  userId,
  contactPhotoPath,
}: {
  initial: CardDraft;
  submitLabel: string;
  busy: boolean;
  error: string | null;
  onSubmit: (draft: CardDraft) => void;
  cardId?: string;
  userId?: string;
  contactPhotoPath?: string | null;
}) {
  const theme = useAppTheme();
  const [draft, setDraft] = useState(initial);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoRemoved, setPhotoRemoved] = useState(false);

  const set = (field: keyof CardDraft) => (value: string) =>
    setDraft((current) => ({ ...current, [field]: value }));

  async function pickPhoto() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    if (!result.canceled && result.assets[0]) {
      setPhotoUri(result.assets[0].uri);
      setPhotoRemoved(false);
    }
  }

  async function takePhoto() {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) return;
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    if (!result.canceled && result.assets[0]) {
      setPhotoUri(result.assets[0].uri);
      setPhotoRemoved(false);
    }
  }

  async function submit() {
    const result = cardDraftSchema.safeParse(draft);
    if (!result.success) {
      setFieldError(result.error.issues[0]?.message ?? 'Review the highlighted details.');
      return;
    }
    setFieldError(null);

    // If user uploaded or removed a contact photo
    if (cardId && userId) {
      if (photoUri) {
        await uploadContactPhoto(cardId, userId, photoUri).catch(() => undefined);
      } else if (photoRemoved && contactPhotoPath) {
        await removeContactPhoto(cardId, contactPhotoPath).catch(() => undefined);
      }
    }

    onSubmit(result.data);
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
      <ScrollView
        contentContainerStyle={[styles.content, { gap: theme.spacing[5], padding: theme.spacing[5] }]}
        keyboardShouldPersistTaps="handled">
        {error || fieldError ? <AuthNotice message={error ?? fieldError ?? ''} /> : null}

        {/* Contact Photo Selector */}
        <FormSection icon="account-box-outline" title="Contact Person Photo">
          <View style={styles.photoWrap}>
            <View style={[styles.avatarPreview, { backgroundColor: theme.colors.primarySoft, borderColor: theme.colors.border }]}>
              {photoUri ? (
                <Image source={{ uri: photoUri }} style={styles.avatarImage} />
              ) : (
                <MaterialCommunityIcons color={theme.colors.primary} name="account" size={48} />
              )}
            </View>
            <View style={styles.photoActions}>
              <Pressable
                accessibilityLabel="Choose contact photo from gallery"
                onPress={() => void pickPhoto()}
                style={[styles.photoBtn, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                <MaterialCommunityIcons color={theme.colors.primary} name="image-outline" size={18} />
                <AppText variant="caption">Gallery</AppText>
              </Pressable>
              <Pressable
                accessibilityLabel="Take contact photo with camera"
                onPress={() => void takePhoto()}
                style={[styles.photoBtn, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
                <MaterialCommunityIcons color={theme.colors.primary} name="camera-outline" size={18} />
                <AppText variant="caption">Camera</AppText>
              </Pressable>
              {photoUri || (contactPhotoPath && !photoRemoved) ? (
                <Pressable
                  accessibilityLabel="Remove contact photo"
                  onPress={() => {
                    setPhotoUri(null);
                    setPhotoRemoved(true);
                  }}
                  style={[styles.photoBtn, { backgroundColor: theme.colors.surface, borderColor: theme.colors.danger }]}>
                  <AppText variant="caption" style={{ color: theme.colors.danger }}>
                    Remove
                  </AppText>
                </Pressable>
              ) : null}
            </View>
          </View>
        </FormSection>

        {/* 1. Full Name (Core Field 1) */}
        <FormSection badge="1" icon="account-outline" title="Full Name">
          <AppTextField
            autoCapitalize="words"
            icon="badge-account-outline"
            label="Display Name *"
            onChangeText={set('displayName')}
            placeholder="How this contact appears"
            value={draft.displayName}
          />
          <View style={styles.split}>
            <AppTextField autoCapitalize="words" label="First Name" onChangeText={set('firstName')} style={styles.flex} value={draft.firstName} />
            <AppTextField autoCapitalize="words" label="Last Name" onChangeText={set('lastName')} style={styles.flex} value={draft.lastName} />
          </View>
          <AppTextField autoCapitalize="words" label="Middle Name" onChangeText={set('middleName')} value={draft.middleName} />
        </FormSection>

        {/* 2. Business & Company (Core Field 2) */}
        <FormSection badge="2" icon="domain" title="Business & Company">
          <AppTextField autoCapitalize="words" icon="domain" label="Company / Business Name" onChangeText={set('company')} value={draft.company} />
          <AppTextField autoCapitalize="words" icon="briefcase-outline" label="Job Title" onChangeText={set('jobTitle')} value={draft.jobTitle} />
          <AppTextField autoCapitalize="words" label="Department" onChangeText={set('department')} value={draft.department} />
        </FormSection>

        {/* 3. Phone Numbers (Core Field 3) */}
        <FormSection badge="3" icon="phone-outline" title="Phone Numbers">
          <AppTextField autoComplete="tel" icon="phone-outline" keyboardType="phone-pad" label="Primary Phone" onChangeText={set('phone')} value={draft.phone} />
          <AppTextField icon="fax" keyboardType="phone-pad" label="Fax Number" onChangeText={set('fax')} value={draft.fax} />
        </FormSection>

        {/* 4. Email & Web (Core Field 4) */}
        <FormSection badge="4" icon="email-outline" title="Email & Web">
          <AppTextField autoCapitalize="none" autoComplete="email" icon="email-outline" keyboardType="email-address" label="Email Address" onChangeText={set('email')} value={draft.email} />
          <AppTextField autoCapitalize="none" icon="web" keyboardType="url" label="Website / Social Profile" onChangeText={set('website')} placeholder="https://" value={draft.website} />
        </FormSection>

        {/* 5. Address (Core Field 5) */}
        <FormSection badge="5" icon="map-marker-outline" title="Physical Address">
          <AppTextField label="Street Address Line 1" onChangeText={set('addressLine1')} value={draft.addressLine1} />
          <AppTextField label="Suite / Unit / Line 2" onChangeText={set('addressLine2')} value={draft.addressLine2} />
          <View style={styles.split}>
            <AppTextField label="City" onChangeText={set('city')} style={styles.flex} value={draft.city} />
            <AppTextField label="State / Region" onChangeText={set('stateRegion')} style={styles.flex} value={draft.stateRegion} />
          </View>
          <View style={styles.split}>
            <AppTextField label="Postal Code" onChangeText={set('postalCode')} style={styles.flex} value={draft.postalCode} />
            <AppTextField label="Country" onChangeText={set('country')} style={styles.flex} value={draft.country} />
          </View>
        </FormSection>

        {/* 6. Additional Notes & Raw Transcription */}
        <FormSection icon="text-box-outline" title="Notes & Raw Transcription">
          <AppTextField
            label="Notes"
            multiline
            numberOfLines={4}
            onChangeText={set('notes')}
            style={styles.notes}
            textAlignVertical="top"
            value={draft.notes}
          />
          {draft.rawText ? (
            <AppTextField
              editable={false}
              label="Original Card Text (Raw Transcription)"
              multiline
              numberOfLines={4}
              style={[styles.notes, { backgroundColor: theme.colors.background }]}
              textAlignVertical="top"
              value={draft.rawText}
            />
          ) : null}
        </FormSection>

        <AppButton loading={busy} onPress={() => void submit()}>
          {submitLabel}
        </AppButton>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function FormSection({
  title,
  badge,
  icon,
  children,
}: {
  title: string;
  badge?: string;
  icon?: string;
  children: React.ReactNode;
}) {
  const theme = useAppTheme();
  return (
    <View
      style={[
        styles.section,
        {
          backgroundColor: theme.colors.surface,
          borderColor: badge ? theme.colors.primary : theme.colors.border,
          borderRadius: theme.radii.lg,
          gap: theme.spacing[4],
          padding: theme.spacing[5],
        },
      ]}>
      <View style={styles.sectionHeader}>
        {badge ? (
          <View style={[styles.badge, { backgroundColor: theme.colors.primary }]}>
            <AppText variant="caption" style={{ color: theme.colors.textOnBrand, fontWeight: '700' }}>
              {badge}
            </AppText>
          </View>
        ) : null}
        {icon ? (
          <MaterialCommunityIcons color={badge ? theme.colors.primary : theme.colors.textMuted} name={icon as any} size={20} />
        ) : null}
        <AppText variant="title" style={{ flex: 1 }}>
          {title}
        </AppText>
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  avatarImage: { borderRadius: 36, height: 72, width: 72 },
  avatarPreview: {
    alignItems: 'center',
    borderRadius: 36,
    borderWidth: 1,
    height: 72,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 72,
  },
  badge: {
    alignItems: 'center',
    borderRadius: 999,
    height: 22,
    justifyContent: 'center',
    width: 22,
  },
  content: { alignSelf: 'center', maxWidth: 760, paddingBottom: 48, width: '100%' },
  flex: { flex: 1 },
  notes: { minHeight: 100, paddingTop: 12 },
  photoActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  photoBtn: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    minHeight: 36,
    paddingHorizontal: 12,
  },
  photoWrap: { alignItems: 'center', flexDirection: 'row', gap: 16 },
  section: { borderWidth: 1 },
  sectionHeader: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  split: { flexDirection: 'row', gap: 12 },
});
