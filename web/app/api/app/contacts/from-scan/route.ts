import { NextResponse } from 'next/server';

import { requireWebUser } from '@/lib/supabase/server';

type Extraction = { displayName?: string; firstName?: string; middleName?: string; lastName?: string; company?: string; jobTitle?: string; department?: string; emails?: { email?: string; label?: string; isPrimary?: boolean }[]; phones?: { number?: string; label?: string; service?: string; serviceLabel?: string; isPrimary?: boolean }[]; websites?: string[]; addressLine1?: string; addressLine2?: string; city?: string; stateRegion?: string; postalCode?: string; country?: string; notes?: string; rawText?: string; confidence?: number };
function clean(value?: string) { return value?.trim() || null; }
function decodeDataUrl(value: string) { const match = value.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/u); if (!match) throw new Error('Invalid image payload.'); return { mime: match[1], bytes: Buffer.from(match[2], 'base64'), ext: match[1].includes('png') ? 'png' : match[1].includes('webp') ? 'webp' : 'jpg' }; }

export async function POST(request: Request) {
  const { supabase, user } = await requireWebUser(); if (!user) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  const body = await request.json().catch(() => ({})) as { result?: Extraction; originals?: { side: 'front' | 'back'; data: string }[]; provider?: string; model?: string; allowDuplicate?: boolean };
  if (!body.result || !body.originals?.length) return NextResponse.json({ error: 'Review data and at least one card image are required.' }, { status: 400 });
  const result = body.result; const emails = (result.emails ?? []).filter((item) => item.email?.trim()); const phones = (result.phones ?? []).filter((item) => item.number?.trim()); const websites = (result.websites ?? []).filter(Boolean);
  const primaryEmail = clean(emails.find((item) => item.isPrimary)?.email ?? emails[0]?.email)?.toLowerCase() ?? null;
  const primaryPhone = clean(phones.find((item) => item.isPrimary)?.number ?? phones[0]?.number) ?? null;
  let duplicate: { id: string; display_name: string | null } | null = null;
  if (primaryEmail) {
    const match = await supabase.from('cards').select('id,display_name').ilike('primary_email', primaryEmail).in('status', ['ready', 'review']).limit(1).maybeSingle();
    duplicate = match.data;
  }
  if (!duplicate && primaryPhone) {
    const match = await supabase.from('cards').select('id,display_name').eq('primary_phone', primaryPhone).in('status', ['ready', 'review']).limit(1).maybeSingle();
    duplicate = match.data;
  }
  if (duplicate && !body.allowDuplicate) return NextResponse.json({ error: 'A matching contact already exists.', duplicate }, { status: 409 });
  const { data: card, error } = await supabase.from('cards').insert({ user_id: user.id, status: 'ready', duplicate_of_id: duplicate?.id ?? null, display_name: clean(result.displayName) || [clean(result.firstName),clean(result.lastName)].filter(Boolean).join(' ') || clean(result.company) || 'Unnamed contact', first_name: clean(result.firstName), middle_name: clean(result.middleName), last_name: clean(result.lastName), company: clean(result.company), job_title: clean(result.jobTitle), department: clean(result.department), primary_email: primaryEmail, primary_phone: primaryPhone, website: clean(websites[0]), address_line_1: clean(result.addressLine1), address_line_2: clean(result.addressLine2), city: clean(result.city), state_region: clean(result.stateRegion), postal_code: clean(result.postalCode), country: clean(result.country), notes: clean(result.notes), raw_extracted_text: clean(result.rawText), extraction_provider: clean(body.provider), extraction_model: clean(body.model), extraction_confidence: typeof result.confidence === 'number' ? result.confidence : null }).select('id').single();
  if (error || !card) return NextResponse.json({ error: 'Card Nest could not create the contact.' }, { status: 500 });
  try {
    for (const original of body.originals.slice(0, 2)) { const file = decodeDataUrl(original.data); if (file.bytes.length > 15 * 1024 * 1024) throw new Error('Each image must be smaller than 15 MB.'); const path = `${user.id}/${card.id}/${original.side}.${file.ext}`; const upload = await supabase.storage.from('card-images').upload(path, file.bytes, { contentType: file.mime, upsert: true }); if (upload.error) throw upload.error; await supabase.from('card_images').insert({ user_id: user.id, card_id: card.id, side: original.side, storage_path: path, mime_type: file.mime, byte_size: file.bytes.length }); await supabase.from('cards').update(original.side === 'front' ? { source_front_image_path: path } : { source_back_image_path: path }).eq('id', card.id); }
    if (emails.length) await supabase.from('card_emails').insert(emails.map((item,index) => ({ user_id: user.id, card_id: card.id, email: item.email!.trim(), label: item.label?.trim() || 'Work', is_primary: item.isPrimary ?? index === 0 })));
    if (phones.length) await supabase.from('card_phone_numbers').insert(phones.map((item,index) => ({ user_id: user.id, card_id: card.id, phone_number: item.number!.trim(), label: item.label?.trim() || 'Mobile', service: clean(item.service), service_label: clean(item.serviceLabel), is_primary: item.isPrimary ?? index === 0 })));
    if (websites.length) await supabase.from('card_websites').insert(websites.map((url,index) => ({ user_id: user.id, card_id: card.id, url, label: 'Work', is_primary: index === 0 })));
    return NextResponse.json({ ok: true, id: card.id });
  } catch (saveError) { await supabase.from('cards').delete().eq('id', card.id); return NextResponse.json({ error: saveError instanceof Error ? saveError.message : 'Card images could not be saved.' }, { status: 500 }); }
}
