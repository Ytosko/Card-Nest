import { File } from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';

import { supabase } from '@/src/lib/supabase/client';
import { getCardImageStoragePath } from '@/src/lib/supabase/storage-paths';
import type { Card, Tables, TablesUpdate } from '@/src/types/database.helpers';

import { displayNameForDraft, type CardDraft } from './card-schema';

export type CardWithRelations = Card & {
  card_emails: Tables<'card_emails'>[];
  card_phone_numbers: Tables<'card_phone_numbers'>[];
  card_websites: Tables<'card_websites'>[];
  card_addresses: Tables<'card_addresses'>[];
  card_images: Tables<'card_images'>[];
  card_tags: { tags: Tables<'tags'> | null }[];
};

function clean(value?: string | null) {
  if (!value) return null;
  return value.trim() || null;
}

function cardValues(draft: CardDraft) {
  const primaryEmail =
    draft.emails?.find((e) => e.isPrimary)?.email || draft.emails?.[0]?.email || draft.email;
  const primaryPhone =
    draft.phones?.find((p) => p.isPrimary)?.phone || draft.phones?.[0]?.phone || draft.phone;

  return {
    display_name: displayNameForDraft(draft),
    first_name: clean(draft.firstName),
    middle_name: clean(draft.middleName),
    last_name: clean(draft.lastName),
    company: clean(draft.company),
    job_title: clean(draft.jobTitle),
    department: clean(draft.department),
    primary_email: clean(primaryEmail),
    primary_phone: clean(primaryPhone),
    website: clean(draft.website),
    address_line_1: clean(draft.addressLine1),
    address_line_2: clean(draft.addressLine2),
    city: clean(draft.city),
    state_region: clean(draft.stateRegion),
    postal_code: clean(draft.postalCode),
    country: clean(draft.country),
    notes: clean(draft.notes),
    status: 'ready' as const,
    extraction_provider: 'manual' as const,
  };
}

export async function listCards(limit = 100) {
  // Placeholder cards mid-capture (capture_pending/uploading/processing/failed) must never
  // surface as contacts; only saved contacts and extractions awaiting review are listed.
  const { data, error } = await supabase
    .from('cards')
    .select('*, card_emails(*), card_phone_numbers(*), card_websites(*), card_addresses(*), card_images(*), card_tags(tags(*))')
    .in('status', ['ready', 'review'])
    .order('updated_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data as CardWithRelations[];
}

export async function searchCards(query: string) {
  if (!query.trim()) {
    return listCards(100);
  }
  const { data, error } = await supabase.rpc('search_cards', {
    search_query: query.trim(),
    page_size: 100,
    page_offset: 0,
  });
  if (error) throw error;
  return data;
}

export async function getCard(cardId: string) {
  const { data, error } = await supabase
    .from('cards')
    .select('*, card_emails(*), card_phone_numbers(*), card_websites(*), card_addresses(*), card_images(*), card_tags(tags(*))')
    .eq('id', cardId)
    .single();
  if (error) throw error;
  return data as CardWithRelations;
}

export async function createCard(userId: string, draft: CardDraft) {
  const values = cardValues(draft);
  const { data: card, error } = await supabase
    .from('cards')
    .insert({ ...values, user_id: userId })
    .select('*')
    .single();
  if (error) throw error;

  await syncPrimaryRelations(card.id, userId, draft);
  return card;
}

export async function updateCard(cardId: string, userId: string, draft: CardDraft) {
  const { data, error } = await supabase
    .from('cards')
    .update(cardValues(draft))
    .eq('id', cardId)
    .select('*')
    .single();
  if (error) throw error;
  await syncPrimaryRelations(cardId, userId, draft);
  return data;
}

async function syncPrimaryRelations(cardId: string, userId: string, draft: CardDraft) {
  const tables = ['card_emails', 'card_phone_numbers', 'card_websites', 'card_addresses'] as const;
  const deletions = await Promise.all(tables.map((table) => supabase.from(table).delete().eq('card_id', cardId)));
  const deletionError = deletions.find((result) => result.error)?.error;
  if (deletionError) throw deletionError;

  const inserts = [];

  // Insert all emails
  const validEmails = draft.emails?.filter((e) => Boolean(e.email?.trim())) ?? [];
  if (validEmails.length > 0) {
    for (const e of validEmails) {
      inserts.push(
        supabase.from('card_emails').insert({
          user_id: userId,
          card_id: cardId,
          email: e.email.trim(),
          label: e.label?.trim() || 'Work',
          is_primary: Boolean(e.isPrimary),
        })
      );
    }
  } else if (draft.email) {
    inserts.push(
      supabase.from('card_emails').insert({
        user_id: userId,
        card_id: cardId,
        email: draft.email.trim(),
        label: 'Work',
        is_primary: true,
      })
    );
  }

  // Insert all phones
  const validPhones = draft.phones?.filter((p) => Boolean(p.phone?.trim())) ?? [];
  if (validPhones.length > 0) {
    for (const p of validPhones) {
      inserts.push(
        supabase.from('card_phone_numbers').insert({
          user_id: userId,
          card_id: cardId,
          phone_number: p.phone.trim(),
          label: p.label?.trim() || 'Mobile',
          service: p.service?.trim() || null,
          service_label: p.serviceLabel?.trim() || null,
          is_primary: Boolean(p.isPrimary),
        })
      );
    }
  } else if (draft.phone) {
    inserts.push(
      supabase.from('card_phone_numbers').insert({
        user_id: userId,
        card_id: cardId,
        phone_number: draft.phone.trim(),
        label: 'Mobile',
        is_primary: true,
      })
    );
  }

  if (draft.website) {
    inserts.push(
      supabase.from('card_websites').insert({
        user_id: userId,
        card_id: cardId,
        url: draft.website.trim(),
        is_primary: true,
      })
    );
  }

  if (draft.addressLine1 || draft.addressLine2 || draft.city || draft.stateRegion || draft.postalCode || draft.country) {
    inserts.push(
      supabase.from('card_addresses').insert({
        user_id: userId,
        card_id: cardId,
        is_primary: true,
        address_line_1: clean(draft.addressLine1),
        address_line_2: clean(draft.addressLine2),
        city: clean(draft.city),
        state_region: clean(draft.stateRegion),
        postal_code: clean(draft.postalCode),
        country: clean(draft.country),
      })
    );
  }

  const results = await Promise.all(inserts);
  const insertionError = results.find((result) => result.error)?.error;
  if (insertionError) throw insertionError;
}

export async function toggleFavorite(cardId: string, isFavorite: boolean) {
  const { error } = await supabase.from('cards').update({ is_favorite: isFavorite }).eq('id', cardId);
  if (error) throw error;
}

export async function deleteCard(card: CardWithRelations | Card) {
  // Clean up contact photo if present
  if (card.contact_photo_path) {
    await supabase.storage.from('contact-photos').remove([card.contact_photo_path]).catch(() => undefined);
  }

  // Clean up business card images if present
  if ('card_images' in card && Array.isArray(card.card_images) && card.card_images.length) {
    const paths = card.card_images.map((image) => image.storage_path);
    if (paths.length) {
      await supabase.storage.from('card-images').remove(paths).catch(() => undefined);
    }
  }

  const { error } = await supabase.from('cards').delete().eq('id', card.id);
  if (error) throw error;
}

export async function bulkDeleteCards(cards: Card[]): Promise<{ deletedCount: number; failedIds: string[] }> {
  let deletedCount = 0;
  const failedIds: string[] = [];

  for (const card of cards) {
    try {
      await deleteCard(card);
      deletedCount++;
    } catch {
      failedIds.push(card.id);
    }
  }

  return { deletedCount, failedIds };
}

export async function bulkToggleFavorite(cardIds: string[], isFavorite: boolean): Promise<void> {
  if (cardIds.length === 0) return;
  const { error } = await supabase.from('cards').update({ is_favorite: isFavorite }).in('id', cardIds);
  if (error) throw error;
}

/**
 * Removes the placeholder card record and any orphan cloud files created by a failed capture.
 * Contacts saved through Review (status 'ready') are never touched — deleting a failed
 * processing job must not destroy a valid contact. Related rows (card_images, processing_jobs,
 * emails/phones/etc.) cascade with the card row.
 */
export async function deleteFailedCaptureArtifacts(cardId: string, userId: string): Promise<void> {
  const { data: card, error } = await supabase
    .from('cards')
    .select('id, status, user_id, contact_photo_path, card_images(storage_path)')
    .eq('id', cardId)
    .maybeSingle();
  if (error) throw error;
  if (card && card.status === 'ready') return;

  // Remove cloud images at both recorded and deterministic paths — an upload can succeed
  // in Storage even when the card_images metadata row was never written.
  const paths = new Set<string>([
    ...(card?.card_images ?? []).map((image) => image.storage_path),
    getCardImageStoragePath(userId, cardId, 'front', 'jpg'),
    getCardImageStoragePath(userId, cardId, 'back', 'jpg'),
  ]);
  await supabase.storage.from('card-images').remove(Array.from(paths)).catch(() => undefined);

  if (!card) return;
  if (card.contact_photo_path) {
    await supabase.storage.from('contact-photos').remove([card.contact_photo_path]).catch(() => undefined);
  }
  const { error: deleteError } = await supabase.from('cards').delete().eq('id', cardId);
  if (deleteError) throw deleteError;
}


export async function uploadContactPhoto(cardId: string, userId: string, uri: string): Promise<string> {
  const resized = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: 512, height: 512 } }],
    { compress: 0.82, format: ImageManipulator.SaveFormat.JPEG }
  );
  const path = `${userId}/${cardId}/photo.jpg`;
  const file = new File(resized.uri);
  const { error: uploadError } = await supabase.storage
    .from('contact-photos')
    .upload(path, await file.arrayBuffer(), { contentType: 'image/jpeg', upsert: true });

  if (uploadError) throw uploadError;

  const { error: updateError } = await supabase
    .from('cards')
    .update({ contact_photo_path: path })
    .eq('id', cardId);

  if (updateError) throw updateError;

  const { data: signed } = await supabase.storage.from('contact-photos').createSignedUrl(path, 3600);
  return signed?.signedUrl ?? '';
}

export async function removeContactPhoto(cardId: string, photoPath: string): Promise<void> {
  await supabase.storage.from('contact-photos').remove([photoPath]).catch(() => undefined);
  const { error } = await supabase.from('cards').update({ contact_photo_path: null }).eq('id', cardId);
  if (error) throw error;
}

export async function getSignedContactPhotoUrl(photoPath?: string | null): Promise<string | null> {
  if (!photoPath) return null;
  const { data, error } = await supabase.storage.from('contact-photos').createSignedUrl(photoPath, 3600);
  if (error) return null;
  return data.signedUrl;
}

export async function getSignedCardImageUrls(card: CardWithRelations) {
  const entries = await Promise.all(
    card.card_images.map(async (image) => {
      const { data, error } = await supabase.storage.from('card-images').createSignedUrl(image.storage_path, 3_600);
      if (error) throw error;
      return [image.side, data.signedUrl] as const;
    })
  );
  return Object.fromEntries(entries) as Partial<Record<'front' | 'back', string>>;
}

export async function markCardExported(cardId: string) {
  const { error } = await supabase
    .from('cards')
    .update({ last_exported_to_contacts_at: new Date().toISOString() })
    .eq('id', cardId);
  if (error) throw error;
}

export async function keepCardSeparate(cardId: string) {
  const { error } = await supabase.from('cards').update({ duplicate_of_id: null }).eq('id', cardId);
  if (error) throw error;
}

export async function mergeDuplicateCard(candidate: CardWithRelations) {
  if (!candidate.duplicate_of_id) throw new Error('No duplicate target is available.');
  const existing = await getCard(candidate.duplicate_of_id);
  const mergeFields = [
    'display_name',
    'first_name',
    'middle_name',
    'last_name',
    'company',
    'job_title',
    'department',
    'primary_email',
    'primary_phone',
    'website',
    'address_line_1',
    'address_line_2',
    'city',
    'state_region',
    'postal_code',
    'country',
    'notes',
  ] as const;
  const updates = Object.fromEntries(
    mergeFields.map((field) => [field, existing[field] || candidate[field]])
  ) as TablesUpdate<'cards'>;
  const { error: updateError } = await supabase.from('cards').update(updates).eq('id', existing.id);
  if (updateError) throw updateError;
  const tagRows = candidate.card_tags.flatMap((relation) =>
    relation.tags ? [{ user_id: candidate.user_id, card_id: existing.id, tag_id: relation.tags.id }] : []
  );
  if (tagRows.length) {
    const { error: tagError } = await supabase
      .from('card_tags')
      .upsert(tagRows, { onConflict: 'card_id,tag_id', ignoreDuplicates: true });
    if (tagError) throw tagError;
  }
  await deleteCard(candidate);
  return existing.id;
}

export async function listTags() {
  const { data, error } = await supabase.from('tags').select('*').order('name');
  if (error) throw error;
  return data;
}

export async function createTag(userId: string, name: string) {
  const { data, error } = await supabase
    .from('tags')
    .insert({ user_id: userId, name: name.trim(), color: '#0CC0DF' })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function setCardTag(cardId: string, userId: string, tagId: string, attached: boolean) {
  const query = attached
    ? supabase.from('card_tags').upsert({ card_id: cardId, user_id: userId, tag_id: tagId }, { onConflict: 'card_id,tag_id' })
    : supabase.from('card_tags').delete().eq('card_id', cardId).eq('tag_id', tagId);
  const { error } = await query;
  if (error) throw error;
}

export function draftFromCard(card: CardWithRelations | Card): CardDraft {
  const emails =
    'card_emails' in card && Array.isArray(card.card_emails) && card.card_emails.length > 0
      ? card.card_emails.map((e) => ({
          id: e.id,
          email: e.email,
          label: e.label ?? 'Work',
          isPrimary: e.is_primary ?? false,
        }))
      : card.primary_email
      ? [{ email: card.primary_email, label: 'Work', isPrimary: true }]
      : [{ email: '', label: 'Work', isPrimary: true }];

  const phones =
    'card_phone_numbers' in card && Array.isArray(card.card_phone_numbers) && card.card_phone_numbers.length > 0
      ? card.card_phone_numbers.map((p) => ({
          id: p.id,
          phone: p.phone_number,
          label: p.label ?? 'Mobile',
          service: p.service ?? '',
          serviceLabel: p.service_label ?? '',
          isPrimary: p.is_primary ?? false,
        }))
      : card.primary_phone
      ? [{ phone: card.primary_phone, label: 'Mobile', service: '', serviceLabel: '', isPrimary: true }]
      : [{ phone: '', label: 'Mobile', service: '', serviceLabel: '', isPrimary: true }];

  return {
    firstName: card.first_name ?? '',
    middleName: card.middle_name ?? '',
    lastName: card.last_name ?? '',
    displayName: card.display_name ?? '',
    company: card.company ?? '',
    jobTitle: card.job_title ?? '',
    department: card.department ?? '',
    email: card.primary_email ?? emails[0]?.email ?? '',
    phone: card.primary_phone ?? phones[0]?.phone ?? '',
    fax: '',
    emails,
    phones,
    website: card.website ?? '',
    addressLine1: card.address_line_1 ?? '',
    addressLine2: card.address_line_2 ?? '',
    city: card.city ?? '',
    stateRegion: card.state_region ?? '',
    postalCode: card.postal_code ?? '',
    country: card.country ?? '',
    notes: card.notes ?? '',
    rawText: card.raw_extracted_text ?? '',
  };
}
