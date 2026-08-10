'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { requireWebUser } from '@/lib/supabase/server';

function clean(value: FormDataEntryValue | null) { const text = String(value ?? '').trim(); return text || null; }
function lines(value: FormDataEntryValue | null) { return String(value ?? '').split(/\r?\n/u).map((item) => item.trim()).filter(Boolean); }

export async function saveContact(formData: FormData) {
  const { supabase, user } = await requireWebUser();
  if (!user) redirect('/auth?mode=signin');
  const id = String(formData.get('id') ?? '');
  const emails = lines(formData.get('emails'));
  const phones = lines(formData.get('phones'));
  const websites = lines(formData.get('websites'));
  const firstName = clean(formData.get('firstName'));
  const lastName = clean(formData.get('lastName'));
  const company = clean(formData.get('company'));
  const displayName = clean(formData.get('displayName')) || [firstName, lastName].filter(Boolean).join(' ') || company || 'Unnamed contact';
  const values = {
    display_name: displayName, first_name: firstName, middle_name: clean(formData.get('middleName')), last_name: lastName,
    company, job_title: clean(formData.get('jobTitle')), department: clean(formData.get('department')),
    primary_email: emails[0] ?? null, primary_phone: phones[0] ?? null, website: websites[0] ?? null,
    address_line_1: clean(formData.get('addressLine1')), address_line_2: clean(formData.get('addressLine2')),
    city: clean(formData.get('city')), state_region: clean(formData.get('stateRegion')), postal_code: clean(formData.get('postalCode')),
    country: clean(formData.get('country')), notes: clean(formData.get('notes')), raw_extracted_text: clean(formData.get('rawText')),
    status: 'ready', extraction_provider: id ? undefined : 'manual', user_id: user.id,
  };
  const query = id && id !== 'new'
    ? supabase.from('cards').update(values).eq('id', id).select('id').single()
    : supabase.from('cards').insert(values).select('id').single();
  const { data: card, error } = await query;
  if (error || !card) throw new Error('Card Nest could not save this contact.');

  await Promise.all(['card_emails', 'card_phone_numbers', 'card_websites', 'card_addresses', 'card_tags'].map((table) => supabase.from(table).delete().eq('card_id', card.id)));
  if (emails.length) await supabase.from('card_emails').insert(emails.map((email, index) => ({ user_id: user.id, card_id: card.id, email, label: index ? 'Other' : 'Work', is_primary: index === 0 })));
  if (phones.length) await supabase.from('card_phone_numbers').insert(phones.map((phone_number, index) => ({ user_id: user.id, card_id: card.id, phone_number, label: index ? 'Other' : 'Mobile', is_primary: index === 0 })));
  if (websites.length) await supabase.from('card_websites').insert(websites.map((url, index) => ({ user_id: user.id, card_id: card.id, url, label: index ? 'Other' : 'Work', is_primary: index === 0 })));
  if (values.address_line_1 || values.address_line_2 || values.city || values.state_region || values.postal_code || values.country) {
    await supabase.from('card_addresses').insert({ user_id: user.id, card_id: card.id, label: 'Work', is_primary: true, address_line_1: values.address_line_1, address_line_2: values.address_line_2, city: values.city, state_region: values.state_region, postal_code: values.postal_code, country: values.country });
  }
  const tagNames = String(formData.get('tags') ?? '').split(',').map((name) => name.trim()).filter(Boolean).slice(0, 20);
  for (const name of tagNames) {
    let { data: tag } = await supabase.from('tags').select('id').eq('user_id', user.id).ilike('name', name).maybeSingle();
    if (!tag) { const created = await supabase.from('tags').insert({ user_id: user.id, name, color: '#0CC0DF' }).select('id').single(); tag = created.data; }
    if (tag) await supabase.from('card_tags').upsert({ user_id: user.id, card_id: card.id, tag_id: tag.id }, { onConflict: 'card_id,tag_id' });
  }
  revalidatePath('/app'); revalidatePath('/app/contacts'); redirect(`/app/contacts/${card.id}?saved=true`);
}

export async function toggleContactFavorite(id: string, favorite: boolean) {
  const { supabase, user } = await requireWebUser(); if (!user) throw new Error('Authentication required.');
  const { error } = await supabase.from('cards').update({ is_favorite: favorite }).eq('id', id); if (error) throw error;
  revalidatePath('/app/contacts'); revalidatePath(`/app/contacts/${id}`);
}

export async function setContactsFavorite(ids: string[], favorite: boolean) {
  const { supabase, user } = await requireWebUser(); if (!user) throw new Error('Authentication required.');
  const safeIds = ids.filter((id) => /^[0-9a-f-]{36}$/iu.test(id)).slice(0, 200); if (!safeIds.length) return;
  const { error } = await supabase.from('cards').update({ is_favorite: favorite }).in('id', safeIds); if (error) throw error;
  revalidatePath('/app'); revalidatePath('/app/contacts');
}

export async function deleteContacts(ids: string[]) {
  const { supabase, user } = await requireWebUser(); if (!user) throw new Error('Authentication required.');
  const safeIds = [...new Set(ids.filter((id) => /^[0-9a-f-]{36}$/iu.test(id)))].slice(0, 200);
  if (!safeIds.length) return { succeededIds: [] as string[], failedIds: [] as string[] };
  const { data, error: loadError } = await supabase.from('cards').select('id,contact_photo_path,card_images(storage_path)').in('id', safeIds);
  if (loadError) throw new Error('Card Nest could not prepare those contacts for deletion.');
  const existing = data ?? [];
  const existingIds = existing.map((card) => card.id);
  if (!existingIds.length) return { succeededIds: [] as string[], failedIds: safeIds };

  const { data: deleted, error } = await supabase.from('cards').delete().in('id', existingIds).select('id');
  if (error) throw new Error('Card Nest could not delete those contacts.');
  const succeededIds = (deleted ?? []).map((card) => card.id);
  const succeeded = new Set(succeededIds);
  const removedCards = existing.filter((card) => succeeded.has(card.id));
  const photos = removedCards.flatMap((card) => card.contact_photo_path ? [card.contact_photo_path] : []);
  const images = removedCards.flatMap((card) => card.card_images.map((image) => image.storage_path));
  if (photos.length) await supabase.storage.from('contact-photos').remove(photos);
  if (images.length) await supabase.storage.from('card-images').remove(images);
  revalidatePath('/app'); revalidatePath('/app/contacts');
  return { succeededIds, failedIds: safeIds.filter((id) => !succeeded.has(id)) };
}

export async function toggleFavoriteForm(formData: FormData) {
  const id = String(formData.get('id') ?? '');
  await toggleContactFavorite(id, formData.get('favorite') === 'true');
}

export async function uploadContactPhoto(formData: FormData) {
  const { supabase, user } = await requireWebUser(); if (!user) redirect('/auth');
  const id = String(formData.get('id') ?? ''); const file = formData.get('photo');
  if (!(file instanceof File) || !file.type.startsWith('image/') || file.size === 0 || file.size > 8 * 1024 * 1024) redirect(`/app/contacts/${id}?photo=invalid`);
  const path = `${user.id}/${id}/photo-${Date.now()}.${file.type.includes('png') ? 'png' : 'jpg'}`;
  const { data: existing } = await supabase.from('cards').select('contact_photo_path').eq('id', id).single();
  const upload = await supabase.storage.from('contact-photos').upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type, upsert: true });
  if (upload.error) redirect(`/app/contacts/${id}?photo=failed`);
  await supabase.from('cards').update({ contact_photo_path: path }).eq('id', id);
  if (existing?.contact_photo_path) await supabase.storage.from('contact-photos').remove([existing.contact_photo_path]);
  revalidatePath(`/app/contacts/${id}`); redirect(`/app/contacts/${id}?photo=saved`);
}
