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

import { cardDraftSchema, type CardDraft, type EmailItem, type PhoneItem } from '../card-schema';

const PHONE_LABELS = ['Mobile', 'Work', 'Office', 'Direct', 'Landline', 'Fax', 'Other'];
const EMAIL_LABELS = ['Work', 'Personal', 'Other'];

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

  // Multi-phone helpers
  const phones: PhoneItem[] = draft.phones?.length
    ? draft.phones
    : [{ phone: draft.phone || '', label: 'Mobile', isPrimary: true }];

  function updatePhone(index: number, key: keyof PhoneItem, val: any) {
    const next = [...phones];
    if (key === 'isPrimary' && val === true) {
      next.forEach((p, i) => {
        p.isPrimary = i === index;
      });
    } else {
      (next[index] as any)[key] = val;
    }
    setDraft((cur) => ({ ...cur, phones: next, phone: next.find((p) => p.isPrimary)?.phone || next[0]?.phone || '' }));
  }

  function addPhone() {
    setDraft((cur) => ({
      ...cur,
      phones: [...phones, { phone: '', label: 'Work', isPrimary: phones.length === 0 }],
    }));
  }

  function removePhone(index: number) {
    const next = phones.filter((_, i) => i !== index);
    if (next.length > 0 && !next.some((p) => p.isPrimary)) {
      next[0].isPrimary = true;
    }
    setDraft((cur) => ({ ...cur, phones: next, phone: next[0]?.phone || '' }));
  }

  // Multi-email helpers
  const emails: EmailItem[] = draft.emails?.length
    ? draft.emails
    : [{ email: draft.email || '', label: 'Work', isPrimary: true }];

  function updateEmail(index: number, key: keyof EmailItem, val: any) {
    const next = [...emails];
    if (key === 'isPrimary' && val === true) {
      next.forEach((e, i) => {
        e.isPrimary = i === index;
      });
    } else {
      (next[index] as any)[key] = val;
    }
    setDraft((cur) => ({ ...cur, emails: next, email: next.find((e) => e.isPrimary)?.email || next[0]?.email || '' }));
  }

  function addEmail() {
    setDraft((cur) => ({
      ...cur,
      emails: [...emails, { email: '', label: 'Personal', isPrimary: emails.length === 0 }],
    }));
  }

  function removeEmail(index: number) {
    const next = emails.filter((_, i) => i !== index);
    if (next.length > 0 && !next.some((e) => e.isPrimary)) {
      next[0].isPrimary = true;
    }
    setDraft((cur) => ({ ...cur, emails: next, email: next[0]?.email || '' }));
  }

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

        {/* 1. Full Name */}
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

        {/* 2. Business & Company */}
        <FormSection badge="2" icon="domain" title="Business & Company">
          <AppTextField autoCapitalize="words" icon="domain" label="Company / Business Name" onChangeText={set('company')} value={draft.company} />
          <AppTextField autoCapitalize="words" icon="briefcase-outline" label="Job Title" onChangeText={set('jobTitle')} value={draft.jobTitle} />
          <AppTextField autoCapitalize="words" label="Department" onChangeText={set('department')} value={draft.department} />
        </FormSection>

        {/* 3. MULTIPLE Phone Numbers */}
        <FormSection badge="3" icon="phone-outline" title="Phone Numbers (Multiple Supported)">
          {phones.map((p, idx) => (
            <View key={idx} style={[styles.itemCard, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
              <View style={styles.itemHeader}>
                <Pressable
                  onPress={() => updatePhone(idx, 'isPrimary', true)}
                  style={[styles.primaryBadge, { backgroundColor: p.isPrimary ? theme.colors.primarySoft : theme.colors.surface }]}>
                  <MaterialCommunityIcons color={p.isPrimary ? theme.colors.primary : theme.colors.textMuted} name={p.isPrimary ? 'star' : 'star-outline'} size={16} />
                  <AppText variant="caption" style={{ color: p.isPrimary ? theme.colors.primary : theme.colors.textMuted, fontWeight: p.isPrimary ? '700' : '400' }}>
                    {p.isPrimary ? 'Primary Phone' : 'Set Primary'}
                  </AppText>
                </Pressable>

                {phones.length > 1 ? (
                  <Pressable hitSlop={8} onPress={() => removePhone(idx)}>
                    <MaterialCommunityIcons color={theme.colors.danger} name="trash-can-outline" size={18} />
                  </Pressable>
                ) : null}
              </View>

              <AppTextField
                autoComplete="tel"
                icon="phone-outline"
                keyboardType="phone-pad"
                label={`Phone Number ${idx + 1}`}
                onChangeText={(text) => updatePhone(idx, 'phone', text)}
                placeholder="+1 555-0199"
                value={p.phone}
              />

              <View style={styles.labelsRow}>
                <AppText muted variant="caption">Label:</AppText>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                  {PHONE_LABELS.map((lbl) => (
                    <Pressable
                      key={lbl}
                      onPress={() => updatePhone(idx, 'label', lbl)}
                      style={[
                        styles.chipOption,
                        {
                          backgroundColor: p.label === lbl ? theme.colors.primarySoft : theme.colors.surface,
                          borderColor: p.label === lbl ? theme.colors.primary : theme.colors.border,
                        },
                      ]}>
                      <AppText variant="caption" style={{ color: p.label === lbl ? theme.colors.primary : theme.colors.text }}>
                        {lbl}
                      </AppText>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            </View>
          ))}

          <AppButton onPress={addPhone} variant="secondary">
            + Add another phone number
          </AppButton>
        </FormSection>

        {/* 4. MULTIPLE Email Addresses */}
        <FormSection badge="4" icon="email-outline" title="Email Addresses (Multiple Supported)">
          {emails.map((e, idx) => (
            <View key={idx} style={[styles.itemCard, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
              <View style={styles.itemHeader}>
                <Pressable
                  onPress={() => updateEmail(idx, 'isPrimary', true)}
                  style={[styles.primaryBadge, { backgroundColor: e.isPrimary ? theme.colors.primarySoft : theme.colors.surface }]}>
                  <MaterialCommunityIcons color={e.isPrimary ? theme.colors.primary : theme.colors.textMuted} name={e.isPrimary ? 'star' : 'star-outline'} size={16} />
                  <AppText variant="caption" style={{ color: e.isPrimary ? theme.colors.primary : theme.colors.textMuted, fontWeight: e.isPrimary ? '700' : '400' }}>
                    {e.isPrimary ? 'Primary Email' : 'Set Primary'}
                  </AppText>
                </Pressable>

                {emails.length > 1 ? (
                  <Pressable hitSlop={8} onPress={() => removeEmail(idx)}>
                    <MaterialCommunityIcons color={theme.colors.danger} name="trash-can-outline" size={18} />
                  </Pressable>
                ) : null}
              </View>

              <AppTextField
                autoCapitalize="none"
                autoComplete="email"
                icon="email-outline"
                keyboardType="email-address"
                label={`Email Address ${idx + 1}`}
                onChangeText={(text) => updateEmail(idx, 'email', text)}
                placeholder="person@company.com"
                value={e.email}
              />

              <View style={styles.labelsRow}>
                <AppText muted variant="caption">Label:</AppText>
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  {EMAIL_LABELS.map((lbl) => (
                    <Pressable
                      key={lbl}
                      onPress={() => updateEmail(idx, 'label', lbl)}
                      style={[
                        styles.chipOption,
                        {
                          backgroundColor: e.label === lbl ? theme.colors.primarySoft : theme.colors.surface,
                          borderColor: e.label === lbl ? theme.colors.primary : theme.colors.border,
                        },
                      ]}>
                      <AppText variant="caption" style={{ color: e.label === lbl ? theme.colors.primary : theme.colors.text }}>
                        {lbl}
                      </AppText>
                    </Pressable>
                  ))}
                </View>
              </View>
            </View>
          ))}

          <AppButton onPress={addEmail} variant="secondary">
            + Add another email address
          </AppButton>

          <AppTextField autoCapitalize="none" icon="web" keyboardType="url" label="Website / Social Profile" onChangeText={set('website')} placeholder="https://" value={draft.website} />
        </FormSection>

        {/* 5. Address */}
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

        {/* 6. Notes */}
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
  chipOption: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  content: { alignSelf: 'center', maxWidth: 760, paddingBottom: 48, width: '100%' },
  flex: { flex: 1 },
  itemCard: {
    borderRadius: 12,
    borderWidth: 1,
    gap: 10,
    padding: 12,
  },
  itemHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  labelsRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
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
  primaryBadge: {
    alignItems: 'center',
    borderRadius: 999,
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  section: { borderWidth: 1 },
  sectionHeader: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  split: { flexDirection: 'row', gap: 12 },
});
