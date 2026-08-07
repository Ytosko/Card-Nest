import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';

import { AppButton } from '@/src/components/ui/app-button';
import { AppText } from '@/src/components/ui/app-text';
import { AppTextField } from '@/src/components/ui/app-text-field';
import { AuthNotice } from '@/src/features/auth/components/auth-notice';
import { useAppTheme } from '@/src/theme/theme-provider';

import { cardDraftSchema, type CardDraft } from '../card-schema';

export function CardForm({ initial, submitLabel, busy, error, onSubmit }: {
  initial: CardDraft;
  submitLabel: string;
  busy: boolean;
  error: string | null;
  onSubmit: (draft: CardDraft) => void;
}) {
  const theme = useAppTheme();
  const [draft, setDraft] = useState(initial);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const set = (field: keyof CardDraft) => (value: string) => setDraft((current) => ({ ...current, [field]: value }));

  function submit() {
    const result = cardDraftSchema.safeParse(draft);
    if (!result.success) {
      setFieldError(result.error.issues[0]?.message ?? 'Review the highlighted details.');
      return;
    }
    setFieldError(null);
    onSubmit(result.data);
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
      <ScrollView contentContainerStyle={[styles.content, { gap: theme.spacing[5], padding: theme.spacing[5] }]} keyboardShouldPersistTaps="handled">
        {error || fieldError ? <AuthNotice message={error ?? fieldError ?? ''} /> : null}
        <FormSection title="Identity">
          <AppTextField autoCapitalize="words" icon="badge-account-outline" label="Display name" onChangeText={set('displayName')} placeholder="How this contact appears" value={draft.displayName} />
          <View style={styles.split}><AppTextField autoCapitalize="words" label="First name" onChangeText={set('firstName')} style={styles.flex} value={draft.firstName} /><AppTextField autoCapitalize="words" label="Last name" onChangeText={set('lastName')} style={styles.flex} value={draft.lastName} /></View>
          <AppTextField autoCapitalize="words" label="Middle name" onChangeText={set('middleName')} value={draft.middleName} />
        </FormSection>
        <FormSection title="Work">
          <AppTextField autoCapitalize="words" icon="domain" label="Company" onChangeText={set('company')} value={draft.company} />
          <AppTextField autoCapitalize="words" icon="briefcase-outline" label="Job title" onChangeText={set('jobTitle')} value={draft.jobTitle} />
          <AppTextField autoCapitalize="words" label="Department" onChangeText={set('department')} value={draft.department} />
        </FormSection>
        <FormSection title="Contact">
          <AppTextField autoCapitalize="none" autoComplete="email" icon="email-outline" keyboardType="email-address" label="Email" onChangeText={set('email')} value={draft.email} />
          <AppTextField autoComplete="tel" icon="phone-outline" keyboardType="phone-pad" label="Phone" onChangeText={set('phone')} value={draft.phone} />
          <AppTextField autoCapitalize="none" icon="web" keyboardType="url" label="Website" onChangeText={set('website')} placeholder="https://" value={draft.website} />
        </FormSection>
        <FormSection title="Address">
          <AppTextField label="Address line 1" onChangeText={set('addressLine1')} value={draft.addressLine1} />
          <AppTextField label="Address line 2" onChangeText={set('addressLine2')} value={draft.addressLine2} />
          <View style={styles.split}><AppTextField label="City" onChangeText={set('city')} style={styles.flex} value={draft.city} /><AppTextField label="State or region" onChangeText={set('stateRegion')} style={styles.flex} value={draft.stateRegion} /></View>
          <View style={styles.split}><AppTextField label="Postal code" onChangeText={set('postalCode')} style={styles.flex} value={draft.postalCode} /><AppTextField label="Country" onChangeText={set('country')} style={styles.flex} value={draft.country} /></View>
        </FormSection>
        <FormSection title="Notes">
          <AppTextField label="Notes" multiline numberOfLines={5} onChangeText={set('notes')} style={styles.notes} textAlignVertical="top" value={draft.notes} />
        </FormSection>
        <AppButton loading={busy} onPress={submit}>{submitLabel}</AppButton>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  const theme = useAppTheme();
  return <View style={[styles.section, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderRadius: theme.radii.lg, gap: theme.spacing[4], padding: theme.spacing[5] }]}><AppText variant="title">{title}</AppText>{children}</View>;
}

const styles = StyleSheet.create({
  content: { alignSelf: 'center', maxWidth: 760, paddingBottom: 40, width: '100%' },
  flex: { flex: 1 },
  notes: { minHeight: 110, paddingTop: 12 },
  section: { borderWidth: 1 },
  split: { flexDirection: 'row', gap: 12 },
});
