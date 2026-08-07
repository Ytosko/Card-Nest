import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import * as Clipboard from 'expo-clipboard';
import { Image } from 'expo-image';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQueryClient } from '@tanstack/react-query';

import { AppButton } from '@/src/components/ui/app-button';
import { AppText } from '@/src/components/ui/app-text';
import { ContactAvatar } from '@/src/components/ui/contact-avatar';
import { AuthNotice } from '@/src/features/auth/components/auth-notice';
import { useCard, cardKeys } from '@/src/features/cards/card-hooks';
import {
  deleteCard,
  getSignedCardImageUrls,
  keepCardSeparate,
  markCardExported,
  mergeDuplicateCard,
  toggleFavorite,
} from '@/src/features/cards/card-service';
import { checkNativeContactMatch, exportCardToContacts } from '@/src/features/contacts/contact-export';
import { CardTagsEditor } from '@/src/features/cards/components/card-tags-editor';
import { useAppTheme } from '@/src/theme/theme-provider';

export default function CardDetailScreen() {
  const { id = '' } = useLocalSearchParams<{ id: string }>();
  const theme = useAppTheme();
  const router = useRouter();
  const client = useQueryClient();

  const card = useCard(id);
  const [images, setImages] = useState<Partial<Record<'front' | 'back', string>>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [inNativeContacts, setInNativeContacts] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const person = card.data;

  // Resolve business card signed image URLs
  useEffect(() => {
    if (person?.card_images?.length) {
      void getSignedCardImageUrls(person).then(setImages).catch(() => undefined);
    }
  }, [person]);

  // Check native device contacts match
  useEffect(() => {
    if (person) {
      void checkNativeContactMatch(person).then((res) => {
        if (res.isMatched || Boolean(person.last_exported_to_contacts_at)) {
          setInNativeContacts(true);
        }
      });
    }
  }, [person]);

  if (card.isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator color={theme.colors.primary} />
      </View>
    );
  }

  if (!person) {
    return (
      <View style={[styles.center, { backgroundColor: theme.colors.background, padding: 24 }]}>
        <AppText variant="title">Contact not found</AppText>
        <AppText muted>This contact may have been deleted or moved.</AppText>
        <AppButton onPress={() => router.replace('/(app)/(tabs)')}>Back to contacts</AppButton>
      </View>
    );
  }

  async function handleToggleFavorite() {
    if (!person) return;
    const nextState = !person.is_favorite;
    try {
      await toggleFavorite(person.id, nextState);
      await Promise.all([
        client.invalidateQueries({ queryKey: cardKeys.all }),
        client.invalidateQueries({ queryKey: cardKeys.detail(person.id) }),
      ]);
    } catch {
      setError('Could not update favorite status.');
    }
  }

  async function exportContact() {
    if (!person) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await exportCardToContacts(person);
      await markCardExported(person.id);
      setInNativeContacts(true);
      setNotice('Saved to your phone contacts.');
      await card.refetch();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not export contact.');
    } finally {
      setBusy(false);
    }
  }

  async function shareContact() {
    if (!person) return;
    const text = [
      person.display_name,
      [person.job_title, person.company].filter(Boolean).join(' at '),
      person.primary_phone,
      person.primary_email,
      person.website,
    ]
      .filter(Boolean)
      .join('\n');
    await Share.share({ title: person.display_name ?? 'Card Nest contact', message: text });
  }

  function confirmDelete() {
    Alert.alert(
      'Delete contact?',
      'This contact and its private card images will be permanently removed.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => void executeDelete(),
        },
      ]
    );
  }

  async function executeDelete() {
    if (!person) return;
    setIsDeleting(true);
    setError(null);
    try {
      await deleteCard(person);
      await client.invalidateQueries({ queryKey: cardKeys.all });
      setIsDeleting(false);
      router.replace('/(app)/(tabs)');
    } catch {
      setIsDeleting(false);
      setError('We could not delete this contact. Please try again.');
    }
  }

  async function handleDuplicate(action: 'merge' | 'separate') {
    if (!person) return;
    setBusy(true);
    setError(null);
    try {
      if (action === 'merge') {
        const existingId = await mergeDuplicateCard(person);
        await client.invalidateQueries({ queryKey: cardKeys.all });
        router.replace({ pathname: '/(app)/cards/[id]', params: { id: existingId } });
      } else {
        await keepCardSeparate(person.id);
        await card.refetch();
        setNotice('Kept as a separate contact.');
      }
    } catch {
      setError('Could not resolve duplicate. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  function copyValue(label: string, value: string) {
    void Clipboard.setStringAsync(value);
    setToastMessage(`${label} copied to clipboard`);
    setTimeout(() => setToastMessage(null), 2500);
  }

  const phoneNumbers =
    person.card_phone_numbers?.length > 0
      ? person.card_phone_numbers
      : person.primary_phone
      ? [{ id: 'primary', phone_number: person.primary_phone, label: 'Mobile', is_primary: true }]
      : [];

  const emails =
    person.card_emails?.length > 0
      ? person.card_emails
      : person.primary_email
      ? [{ id: 'primary', email: person.primary_email, label: 'Work', is_primary: true }]
      : [];

  return (
    <SafeAreaView edges={['bottom']} style={[styles.safeArea, { backgroundColor: theme.colors.background }]}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: person.display_name ?? 'Contact Details',
          headerRight: () => (
            <Pressable
              accessibilityLabel={person.is_favorite ? 'Remove from favorites' : 'Add to favorites'}
              onPress={() => void handleToggleFavorite()}>
              <MaterialCommunityIcons
                color={person.is_favorite ? theme.colors.warning : theme.colors.textMuted}
                name={person.is_favorite ? 'star' : 'star-outline'}
                size={26}
              />
            </Pressable>
          ),
        }}
      />

      {/* Blocking Progress Modal for Delete */}
      <Modal animationType="fade" transparent visible={isDeleting}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalBox, { backgroundColor: theme.colors.surface, borderRadius: theme.radii.lg }]}>
            <ActivityIndicator color={theme.colors.danger} size="large" />
            <AppText variant="title">Deleting contact...</AppText>
            <AppText muted variant="caption">
              Cleaning up card details and private images
            </AppText>
          </View>
        </View>
      </Modal>

      <ScrollView contentContainerStyle={[styles.content, { gap: theme.spacing[4], padding: theme.spacing[5] }]}>
        {/* Contact Avatar & Person Overview Header */}
        <View style={styles.hero}>
          <ContactAvatar
            company={person.company}
            contactPhotoPath={person.contact_photo_path}
            email={person.primary_email}
            name={person.display_name}
            size={96}
          />

          <AppText accessibilityRole="header" variant="display" style={styles.centerText}>
            {person.display_name ?? person.company ?? 'Unnamed contact'}
          </AppText>

          <AppText muted style={styles.centerText}>
            {[person.job_title, person.company].filter(Boolean).join(' · ')}
          </AppText>

          {inNativeContacts ? (
            <View style={[styles.inContactsBadge, { backgroundColor: theme.colors.primarySoft }]}>
              <MaterialCommunityIcons color={theme.colors.primary} name="check-circle" size={15} />
              <AppText variant="caption" style={{ color: theme.colors.primary, fontWeight: '700' }}>
                ✓ In your contacts
              </AppText>
            </View>
          ) : null}
        </View>

        {notice ? <AuthNotice message={notice} tone="success" /> : null}
        {error ? <AuthNotice message={error} /> : null}
        {toastMessage ? <AuthNotice message={toastMessage} tone="success" /> : null}

        {/* Duplicate Banner */}
        {person.duplicate_of_id ? (
          <View
            style={[
              styles.duplicate,
              {
                backgroundColor: theme.colors.warningSoft,
                borderColor: theme.colors.warning,
                borderRadius: theme.radii.lg,
                padding: theme.spacing[4],
              },
            ]}>
            <MaterialCommunityIcons color={theme.colors.warning} name="account-multiple-check-outline" size={26} />
            <View style={styles.detailCopy}>
              <AppText variant="bodyStrong">Possible duplicate</AppText>
              <AppText variant="caption">Card Nest found a similar saved contact. Review before merging.</AppText>
              <View style={styles.duplicateActions}>
                <AppButton disabled={busy} onPress={() => void handleDuplicate('merge')}>
                  Merge contacts
                </AppButton>
                <AppButton disabled={busy} onPress={() => void handleDuplicate('separate')} variant="secondary">
                  Keep separate
                </AppButton>
              </View>
            </View>
          </View>
        ) : null}

        {/* Action-First Quick Actions Bar */}
        <View style={styles.quickActions}>
          <QuickAction
            disabled={!person.primary_phone}
            icon="phone-outline"
            label="Call"
            onPress={() => void Linking.openURL(`tel:${person.primary_phone}`)}
          />
          <QuickAction
            disabled={!person.primary_phone}
            icon="message-outline"
            label="Message"
            onPress={() => void Linking.openURL(`sms:${person.primary_phone}`)}
          />
          <QuickAction
            disabled={!person.primary_email}
            icon="email-outline"
            label="Email"
            onPress={() => void Linking.openURL(`mailto:${person.primary_email}`)}
          />
          <QuickAction
            icon="share-variant-outline"
            label="Share"
            onPress={() => void shareContact()}
          />
          <QuickAction
            icon={inNativeContacts ? 'account-check-outline' : 'account-plus-outline'}
            label={inNativeContacts ? 'Saved' : 'Add to phone'}
            onPress={() => void exportContact()}
          />
        </View>

        {/* Structured Contact Details — Support ALL Phone Numbers */}
        <Section title="Phone Numbers">
          {phoneNumbers.length > 0 ? (
            phoneNumbers.map((p, idx) => (
              <View key={p.id || idx} style={styles.multiRow}>
                <MaterialCommunityIcons color={theme.colors.primary} name="phone-outline" size={21} />
                <View style={styles.detailCopy}>
                  <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                    <AppText muted variant="caption">
                      {p.label || 'Phone'}
                    </AppText>
                    {p.is_primary ? (
                      <AppText variant="caption" style={{ color: theme.colors.primary, fontWeight: '700' }}>
                        (Primary)
                      </AppText>
                    ) : null}
                  </View>
                  <AppText style={{ color: theme.colors.primary, fontSize: 16 }}>{p.phone_number}</AppText>
                </View>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Pressable accessibilityLabel="Call" hitSlop={6} onPress={() => void Linking.openURL(`tel:${p.phone_number}`)}>
                    <MaterialCommunityIcons color={theme.colors.primary} name="phone" size={20} />
                  </Pressable>
                  <Pressable accessibilityLabel="SMS" hitSlop={6} onPress={() => void Linking.openURL(`sms:${p.phone_number}`)}>
                    <MaterialCommunityIcons color={theme.colors.primary} name="message-text-outline" size={20} />
                  </Pressable>
                  <Pressable accessibilityLabel="Copy phone" hitSlop={6} onPress={() => copyValue(p.label || 'Phone', p.phone_number)}>
                    <MaterialCommunityIcons color={theme.colors.textMuted} name="content-copy" size={18} />
                  </Pressable>
                </View>
              </View>
            ))
          ) : (
            <AppText muted variant="caption">No phone number recorded</AppText>
          )}
        </Section>

        {/* Structured Contact Details — Support ALL Email Addresses */}
        <Section title="Email Addresses">
          {emails.length > 0 ? (
            emails.map((e, idx) => (
              <View key={e.id || idx} style={styles.multiRow}>
                <MaterialCommunityIcons color={theme.colors.primary} name="email-outline" size={21} />
                <View style={styles.detailCopy}>
                  <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                    <AppText muted variant="caption">
                      {e.label || 'Email'}
                    </AppText>
                    {e.is_primary ? (
                      <AppText variant="caption" style={{ color: theme.colors.primary, fontWeight: '700' }}>
                        (Primary)
                      </AppText>
                    ) : null}
                  </View>
                  <AppText style={{ color: theme.colors.primary, fontSize: 16 }}>{e.email}</AppText>
                </View>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Pressable accessibilityLabel="Email" hitSlop={6} onPress={() => void Linking.openURL(`mailto:${e.email}`)}>
                    <MaterialCommunityIcons color={theme.colors.primary} name="email" size={20} />
                  </Pressable>
                  <Pressable accessibilityLabel="Copy email" hitSlop={6} onPress={() => copyValue(e.label || 'Email', e.email)}>
                    <MaterialCommunityIcons color={theme.colors.textMuted} name="content-copy" size={18} />
                  </Pressable>
                </View>
              </View>
            ))
          ) : (
            <AppText muted variant="caption">No email address recorded</AppText>
          )}
        </Section>

        {/* Company & Job Information */}
        <Section title="Organization & Details">
          <DetailRow
            icon="domain"
            label="Company"
            onCopy={() => copyValue('Company', person.company!)}
            value={person.company}
          />
          <DetailRow icon="briefcase-outline" label="Job Title" value={person.job_title} />
          <DetailRow icon="office-building" label="Department" value={person.department} />
          <DetailRow
            icon="web"
            label="Website"
            onCopy={() => copyValue('Website', person.website!)}
            onPress={() => void Linking.openURL(person.website!)}
            value={person.website}
          />
          <DetailRow
            icon="map-marker-outline"
            label="Address"
            onCopy={() =>
              copyValue(
                'Address',
                [
                  person.address_line_1,
                  person.address_line_2,
                  person.city,
                  person.state_region,
                  person.postal_code,
                  person.country,
                ]
                  .filter(Boolean)
                  .join(', ')
              )
            }
            value={
              [
                person.address_line_1,
                person.address_line_2,
                person.city,
                person.state_region,
                person.postal_code,
                person.country,
              ]
                .filter(Boolean)
                .join(', ') || null
            }
          />
        </Section>

        <Section title="Tags">
          <CardTagsEditor card={person} />
        </Section>

        {person.notes ? (
          <Section title="Notes">
            <AppText>{person.notes}</AppText>
          </Section>
        ) : null}

        {/* Original Scanned Card Images */}
        {images.front || images.back ? (
          <Section title="Original Scanned Business Card">
            <View style={styles.images}>
              {(['front', 'back'] as const).map((side) =>
                images[side] ? (
                  <View key={side} style={styles.imageWrap}>
                    <Image
                      contentFit="contain"
                      source={images[side]}
                      style={[styles.image, { backgroundColor: theme.colors.background, borderRadius: theme.radii.md }]}
                    />
                    <AppText muted variant="caption">
                      {side === 'front' ? 'Front Side' : 'Back Side'}
                    </AppText>
                  </View>
                ) : null
              )}
            </View>
          </Section>
        ) : null}

        {/* Action Controls */}
        <View style={styles.actions}>
          <AppButton onPress={() => router.push({ pathname: '/(app)/cards/[id]/edit', params: { id } })}>
            Edit Contact Details
          </AppButton>
          <AppButton disabled={busy || isDeleting} onPress={confirmDelete} variant="secondary">
            Delete Contact
          </AppButton>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function QuickAction({
  icon,
  iconColor,
  label,
  onPress,
  disabled = false,
}: {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  iconColor?: string;
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const theme = useAppTheme();
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.quick,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.border,
          borderRadius: theme.radii.md,
          opacity: disabled ? 0.35 : pressed ? 0.65 : 1,
        },
      ]}>
      <MaterialCommunityIcons color={iconColor ?? theme.colors.primary} name={icon} size={22} />
      <AppText variant="caption" style={{ fontSize: 11, textAlign: 'center' }}>
        {label}
      </AppText>
    </Pressable>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const theme = useAppTheme();
  return (
    <View
      style={[
        styles.section,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.border,
          borderRadius: theme.radii.lg,
          gap: theme.spacing[3],
          padding: theme.spacing[5],
        },
      ]}>
      <AppText variant="title">{title}</AppText>
      {children}
    </View>
  );
}

function DetailRow({
  icon,
  label,
  value,
  onPress,
  onCopy,
}: {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
  value: string | null;
  onPress?: () => void;
  onCopy?: () => void;
}) {
  const theme = useAppTheme();
  if (!value) return null;

  return (
    <Pressable
      accessibilityRole={onPress ? 'link' : undefined}
      onLongPress={onCopy}
      onPress={onPress ?? onCopy}
      style={styles.detail}>
      <MaterialCommunityIcons color={theme.colors.primary} name={icon} size={21} />
      <View style={styles.detailCopy}>
        <AppText muted variant="caption">
          {label}
        </AppText>
        <AppText style={{ color: onPress ? theme.colors.primary : theme.colors.text }}>{value}</AppText>
      </View>
      {onCopy ? (
        <Pressable accessibilityLabel={`Copy ${label}`} hitSlop={8} onPress={onCopy}>
          <MaterialCommunityIcons color={theme.colors.textMuted} name="content-copy" size={18} />
        </Pressable>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  actions: { gap: 12 },
  center: { alignItems: 'center', flex: 1, gap: 18, justifyContent: 'center' },
  centerText: { textAlign: 'center' },
  content: { alignSelf: 'center', maxWidth: 760, paddingBottom: 40, width: '100%' },
  detail: { alignItems: 'center', flexDirection: 'row', gap: 12, minHeight: 54 },
  detailCopy: { flex: 1 },
  duplicate: { alignItems: 'flex-start', borderWidth: 1, flexDirection: 'row', gap: 12 },
  duplicateActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  hero: { alignItems: 'center', gap: 8, paddingVertical: 12 },
  image: { aspectRatio: 1.58, width: '100%' },
  imageWrap: { flex: 1, gap: 5, minWidth: 220 },
  images: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  inContactsBadge: {
    alignItems: 'center',
    borderRadius: 999,
    flexDirection: 'row',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  modalBackdrop: {
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  modalBox: {
    alignItems: 'center',
    gap: 12,
    maxWidth: 340,
    padding: 28,
    width: '100%',
  },
  multiRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    minHeight: 52,
  },
  quick: {
    alignItems: 'center',
    borderWidth: 1,
    flex: 1,
    gap: 4,
    justifyContent: 'center',
    minHeight: 64,
    paddingHorizontal: 4,
  },
  quickActions: { flexDirection: 'row', gap: 8 },
  safeArea: { flex: 1 },
  section: { borderWidth: 1 },
});
