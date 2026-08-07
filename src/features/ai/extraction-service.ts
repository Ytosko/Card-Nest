import { getProviderKey, extractBusinessCard, type AiProvider } from '@/src/features/ai/ai-provider';
import { duplicateScore } from '@/src/features/cards/duplicate-score';
import { supabase } from '@/src/lib/supabase/client';

export async function runConfiguredExtraction(cardId: string, userId: string, imageUris: string[]) {
  const { data: preference, error: preferenceError } = await supabase.from('user_preferences').select('*').eq('user_id', userId).maybeSingle();
  if (preferenceError) throw preferenceError;
  const provider = preference?.selected_ai_provider as AiProvider | null;
  const model = preference?.selected_ai_model;
  if (!provider || !model) return false;
  const key = await getProviderKey(provider);
  if (!key) return false;

  const { data: job, error: jobError } = await supabase.from('processing_jobs').insert({ user_id: userId, card_id: cardId, job_type: 'extraction', status: 'processing', provider, model, started_at: new Date().toISOString() }).select('id').single();
  if (jobError) throw jobError;
  try {
    await supabase.from('cards').update({ status: 'processing', extraction_provider: provider, extraction_model: model }).eq('id', cardId);
    const extracted = await extractBusinessCard(provider, model, key, imageUris);
    const values = {
      display_name: extracted.displayName || [extracted.firstName, extracted.middleName, extracted.lastName].filter(Boolean).join(' ') || extracted.company || 'New business card',
      first_name: extracted.firstName || null, middle_name: extracted.middleName || null, last_name: extracted.lastName || null,
      company: extracted.company || null, job_title: extracted.jobTitle || null, department: extracted.department || null,
      primary_email: extracted.emails[0] || null, primary_phone: extracted.phones[0] || null, website: extracted.websites[0] || null,
      address_line_1: extracted.addressLine1 || null, address_line_2: extracted.addressLine2 || null, city: extracted.city || null,
      state_region: extracted.stateRegion || null, postal_code: extracted.postalCode || null, country: extracted.country || null,
      notes: extracted.notes || null, raw_extracted_text: extracted.rawText || null, extraction_provider: provider,
      extraction_model: model, extraction_confidence: extracted.confidence, extraction_quality: { reviewed: false, source_count: imageUris.length }, status: 'review' as const,
    };
    const { data: existing, error: existingError } = await supabase.from('cards').select('*').neq('id', cardId).neq('status', 'archived').limit(100);
    if (existingError) throw existingError;
    const duplicate = existing.map((card) => ({ card, score: duplicateScore(values, card) })).sort((a, b) => b.score - a.score)[0];
    const { error: updateError } = await supabase.from('cards').update({ ...values, duplicate_of_id: duplicate && duplicate.score >= 0.78 ? duplicate.card.id : null }).eq('id', cardId);
    if (updateError) throw updateError;

    const relationDeletes = await Promise.all(['card_emails', 'card_phone_numbers', 'card_websites', 'card_addresses'].map((table) => supabase.from(table as 'card_emails').delete().eq('card_id', cardId)));
    const relationError = relationDeletes.find((result) => result.error)?.error; if (relationError) throw relationError;
    const relations = [];
    if (extracted.emails[0]) relations.push(supabase.from('card_emails').insert({ user_id: userId, card_id: cardId, email: extracted.emails[0], is_primary: true }));
    if (extracted.phones[0]) relations.push(supabase.from('card_phone_numbers').insert({ user_id: userId, card_id: cardId, phone_number: extracted.phones[0], is_primary: true }));
    if (extracted.websites[0]) relations.push(supabase.from('card_websites').insert({ user_id: userId, card_id: cardId, url: extracted.websites[0], is_primary: true }));
    const relationResults = await Promise.all(relations); const insertError = relationResults.find((result) => result.error)?.error; if (insertError) throw insertError;
    await supabase.from('processing_jobs').update({ status: 'synced', completed_at: new Date().toISOString(), result: { confidence: extracted.confidence } }).eq('id', job.id);
    return true;
  } catch {
    await Promise.all([
      supabase.from('processing_jobs').update({ status: 'failed', completed_at: new Date().toISOString(), last_error: 'Extraction needs attention.' }).eq('id', job.id),
      supabase.from('cards').update({ status: 'review' }).eq('id', cardId),
    ]);
    return false;
  }
}
