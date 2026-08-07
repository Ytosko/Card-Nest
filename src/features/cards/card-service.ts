import { supabase } from '@/src/lib/supabase/client';
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

function clean(value: string) {
  return value.trim() || null;
}

function cardValues(draft: CardDraft) {
  return {
    display_name: displayNameForDraft(draft),
    first_name: clean(draft.firstName),
    middle_name: clean(draft.middleName),
    last_name: clean(draft.lastName),
    company: clean(draft.company),
    job_title: clean(draft.jobTitle),
    department: clean(draft.department),
    primary_email: clean(draft.email),
    primary_phone: clean(draft.phone),
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

export async function listCards(limit = 50) {
  const { data, error } = await supabase
    .from('cards')
    .select('*')
    .neq('status', 'archived')
    .order('updated_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
}

export async function searchCards(query: string) {
  const { data, error } = await supabase.rpc('search_cards', {
    search_query: query,
    page_size: 60,
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
  if (draft.email) inserts.push(supabase.from('card_emails').insert({ user_id: userId, card_id: cardId, email: draft.email, is_primary: true }));
  if (draft.phone) inserts.push(supabase.from('card_phone_numbers').insert({ user_id: userId, card_id: cardId, phone_number: draft.phone, is_primary: true }));
  if (draft.website) inserts.push(supabase.from('card_websites').insert({ user_id: userId, card_id: cardId, url: draft.website, is_primary: true }));
  if (draft.addressLine1 || draft.addressLine2 || draft.city || draft.stateRegion || draft.postalCode || draft.country) {
    inserts.push(supabase.from('card_addresses').insert({
      user_id: userId,
      card_id: cardId,
      is_primary: true,
      address_line_1: clean(draft.addressLine1),
      address_line_2: clean(draft.addressLine2),
      city: clean(draft.city),
      state_region: clean(draft.stateRegion),
      postal_code: clean(draft.postalCode),
      country: clean(draft.country),
    }));
  }
  const results = await Promise.all(inserts);
  const insertionError = results.find((result) => result.error)?.error;
  if (insertionError) throw insertionError;
}

export async function toggleFavorite(cardId: string, isFavorite: boolean) {
  const { error } = await supabase.from('cards').update({ is_favorite: isFavorite }).eq('id', cardId);
  if (error) throw error;
}

export async function deleteCard(card: CardWithRelations) {
  const paths = card.card_images.map((image) => image.storage_path);
  if (paths.length) {
    const { error: storageError } = await supabase.storage.from('card-images').remove(paths);
    if (storageError) throw storageError;
  }
  const { error } = await supabase.from('cards').delete().eq('id', card.id);
  if (error) throw error;
}

export async function getSignedCardImageUrls(card: CardWithRelations) {
  const entries = await Promise.all(
    card.card_images.map(async (image) => {
      const { data, error } = await supabase.storage.from('card-images').createSignedUrl(image.storage_path, 3_600);
      if (error) throw error;
      return [image.side, data.signedUrl] as const;
    }),
  );
  return Object.fromEntries(entries) as Partial<Record<'front' | 'back', string>>;
}

export async function markCardExported(cardId: string) {
  const { error } = await supabase.from('cards').update({ last_exported_to_contacts_at: new Date().toISOString() }).eq('id', cardId);
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
    'display_name', 'first_name', 'middle_name', 'last_name', 'company', 'job_title', 'department',
    'primary_email', 'primary_phone', 'website', 'address_line_1', 'address_line_2', 'city',
    'state_region', 'postal_code', 'country', 'notes',
  ] as const;
  const updates = Object.fromEntries(mergeFields.map((field) => [field, existing[field] || candidate[field]])) as TablesUpdate<'cards'>;
  const { error: updateError } = await supabase.from('cards').update(updates).eq('id', existing.id);
  if (updateError) throw updateError;
  const tagRows = candidate.card_tags.flatMap((relation) => relation.tags ? [{ user_id: candidate.user_id, card_id: existing.id, tag_id: relation.tags.id }] : []);
  if (tagRows.length) {
    const { error: tagError } = await supabase.from('card_tags').upsert(tagRows, { onConflict: 'card_id,tag_id', ignoreDuplicates: true });
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
  const { data, error } = await supabase.from('tags').insert({ user_id: userId, name: name.trim(), color: '#0CC0DF' }).select('*').single();
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

export function draftFromCard(card: Card): CardDraft {
  return {
    firstName: card.first_name ?? '', middleName: card.middle_name ?? '', lastName: card.last_name ?? '',
    displayName: card.display_name ?? '', company: card.company ?? '', jobTitle: card.job_title ?? '',
    department: card.department ?? '', email: card.primary_email ?? '', phone: card.primary_phone ?? '',
    website: card.website ?? '', addressLine1: card.address_line_1 ?? '', addressLine2: card.address_line_2 ?? '',
    city: card.city ?? '', stateRegion: card.state_region ?? '', postalCode: card.postal_code ?? '',
    country: card.country ?? '', notes: card.notes ?? '',
  };
}
