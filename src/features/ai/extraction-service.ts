import { AiExtractionError, getProviderKey, getServerCredentialStatus, extractBusinessCard, type AiProvider } from '@/src/features/ai/ai-provider';
import { checkSelectedModelAgainstCache, recordModelValidation } from '@/src/features/ai/model-catalog';
import { duplicateScore } from '@/src/features/cards/duplicate-score';
import { supabase } from '@/src/lib/supabase/client';

export async function runConfiguredExtraction(cardId: string, userId: string, imageUris: string[]) {
  const { data: preference, error: preferenceError } = await supabase
    .from('user_preferences')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (preferenceError) throw preferenceError;

  const provider = preference?.selected_ai_provider as AiProvider | null;
  const model = preference?.selected_ai_model;
  const localKey = provider ? await getProviderKey(provider) : null;

  // Check server credential status if local key is not available
  const serverStatus = provider ? await getServerCredentialStatus() : {};
  const hasServerKey = provider ? Boolean(serverStatus[provider]?.hasKey) : false;

  if (!provider || !model || (!localKey && !hasServerKey)) {
    const reason = !provider || !model
      ? 'Configure your OpenAI or Gemini provider and model in Settings > AI.'
      : 'Provide your API key in Settings > AI to enable extraction.';

    await supabase.from('cards').update({
      status: 'review',
      extraction_quality: { failed: true, error: reason },
    }).eq('id', cardId);
    return false;
  }

  // Cheap pre-flight against the cached model catalog: never send a scan to a model
  // already known to be gone. 'unknown' (no fresh cache) must not block extraction —
  // real availability is enforced by the provider call's AI_MODEL_UNAVAILABLE mapping.
  if (checkSelectedModelAgainstCache(provider, model) === 'unavailable') {
    const reason = `Your selected model (${model}) is no longer available. Choose another model in Settings > AI.`;
    await supabase.from('cards').update({
      status: 'review',
      extraction_quality: { failed: true, error: reason },
    }).eq('id', cardId);
    if (__DEV__) {
      console.warn(`[CardNest AI Pipeline] Skipping extraction — cached catalog marks model unavailable`, { provider, model });
    }
    return false;
  }

  const { data: job, error: jobError } = await supabase
    .from('processing_jobs')
    .insert({
      user_id: userId,
      card_id: cardId,
      job_type: 'extraction',
      status: 'processing',
      provider,
      model,
      started_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (jobError) throw jobError;

  try {
    await supabase
      .from('cards')
      .update({ status: 'processing', extraction_provider: provider, extraction_model: model })
      .eq('id', cardId);

    // Stage 1 & Stage 2: Invoke Backend & Validate Response
    const imageInputs = imageUris.map((uri, idx) => ({
      uri,
      cardId,
      side: (idx === 0 ? 'front' : 'back') as 'front' | 'back',
      userId,
    }));

    const extracted = await extractBusinessCard(provider, model, localKey, imageInputs);
    const classification = extracted.documentClassification ?? {
      result: 'VALID_CARD',
      confidence: 1.0,
      reason: 'Valid contact card',
    };

    // Stage 2.5: Rejection of non-contact images (NOT_A_CARD)
    if (classification.result === 'NOT_A_CARD') {
      // 1. Delete temporary card record from Supabase database — ZERO garbage contacts created!
      await supabase.from('cards').delete().eq('id', cardId);

      // 2. Mark processing job as not_a_card
      await supabase
        .from('processing_jobs')
        .update({
          status: 'not_a_card',
          completed_at: new Date().toISOString(),
          last_error: classification.reason || 'This image does not appear to contain a contact card.',
          result: { documentClassification: classification },
        })
        .eq('id', job.id);

      if (__DEV__) {
        console.warn(`[CardNest AI Pipeline] Image rejected as NOT_A_CARD`, { cardId, reason: classification.reason });
      }

      return {
        success: false,
        isNotACard: true,
        classification,
        error: classification.reason || 'This image does not appear to contain a contact card.',
      };
    }

    // Stage 3: Normalize Contact Data & Structural Metadata
    const primaryPhoneItem = extracted.phones.find((p) => p.isPrimary) || extracted.phones[0];
    const primaryEmailItem = extracted.emails.find((e) => e.isPrimary) || extracted.emails[0];
    const isUncertain = classification.result === 'UNCERTAIN_CARD';

    const values = {
      display_name:
        extracted.displayName ||
        [extracted.firstName, extracted.middleName, extracted.lastName].filter(Boolean).join(' ') ||
        extracted.company ||
        (isUncertain ? 'Uncertain contact note' : 'New business card'),
      first_name: extracted.firstName || null,
      middle_name: extracted.middleName || null,
      last_name: extracted.lastName || null,
      company: extracted.company || null,
      job_title: extracted.jobTitle || null,
      department: extracted.department || null,
      primary_email: primaryEmailItem?.email || null,
      primary_phone: primaryPhoneItem?.number || null,
      website: extracted.websites[0] || null,
      address_line_1: extracted.addressLine1 || null,
      address_line_2: extracted.addressLine2 || null,
      city: extracted.city || null,
      state_region: extracted.stateRegion || null,
      postal_code: extracted.postalCode || null,
      country: extracted.country || null,
      notes: extracted.notes || null,
      raw_extracted_text: extracted.rawText || null,
      extraction_provider: provider,
      extraction_model: model,
      extraction_confidence: extracted.confidence,
      extraction_quality: {
        reviewed: false,
        failed: false,
        needsReview: false,
        documentClassification: classification,
        source_count: imageUris.length,
      },
      // Both VALID_CARD and UNCERTAIN_CARD auto-process directly into ready contacts.
      status: 'ready' as const,
    };

    if (__DEV__) {
      console.log(`[CardNest AI Pipeline] Contact normalized`, {
        cardId,
        classification: classification.result,
        phoneCount: extracted.phones.length,
        emailCount: extracted.emails.length,
        hasPrimaryPhone: Boolean(values.primary_phone),
        hasPrimaryEmail: Boolean(values.primary_email),
      });
    }

    // Stage 4: Persist Structured Contact Record
    const { data: existing, error: existingError } = await supabase
      .from('cards')
      .select('*')
      .neq('id', cardId)
      .neq('status', 'archived')
      .limit(100);

    if (existingError) throw existingError;

    const duplicate = existing
      .map((card) => ({ card, score: duplicateScore(values, card) }))
      .sort((a, b) => b.score - a.score)[0];

    const { error: updateError } = await supabase
      .from('cards')
      .update({
        ...values,
        duplicate_of_id: duplicate && duplicate.score >= 0.78 ? duplicate.card.id : null,
      })
      .eq('id', cardId);

    if (updateError) throw updateError;

    // Persist all relational phone numbers (with service metadata) and email addresses
    const relationDeletes = await Promise.all(
      ['card_emails', 'card_phone_numbers', 'card_websites', 'card_addresses'].map((table) =>
        supabase.from(table as 'card_emails').delete().eq('card_id', cardId)
      )
    );
    const relationError = relationDeletes.find((result) => result.error)?.error;
    if (relationError) throw relationError;

    const relations = [];
    for (const p of extracted.phones) {
      if (p.number?.trim()) {
        relations.push(
          supabase.from('card_phone_numbers').insert({
            user_id: userId,
            card_id: cardId,
            phone_number: p.number.trim(),
            label: p.label || 'Mobile',
            service: p.service || null,
            service_label: p.serviceLabel || null,
            is_primary: p.isPrimary ?? false,
          })
        );
      }
    }

    for (const e of extracted.emails) {
      if (e.email?.trim()) {
        relations.push(
          supabase.from('card_emails').insert({
            user_id: userId,
            card_id: cardId,
            email: e.email.trim(),
            label: e.label || 'Work',
            is_primary: e.isPrimary ?? false,
          })
        );
      }
    }

    for (const w of extracted.websites) {
      if (w?.trim()) {
        relations.push(
          supabase.from('card_websites').insert({
            user_id: userId,
            card_id: cardId,
            url: w.trim(),
            is_primary: true,
          })
        );
      }
    }

    const relationResults = await Promise.all(relations);
    const insertError = relationResults.find((result) => result.error)?.error;
    if (insertError) throw insertError;

    await supabase
      .from('processing_jobs')
      .update({
        status: 'synced',
        completed_at: new Date().toISOString(),
        result: { confidence: extracted.confidence, documentClassification: classification },
      })
      .eq('id', job.id);

    if (__DEV__) {
      console.log(`[CardNest AI Pipeline] Contact saved`, { cardId, status: values.status, classification: classification.result });
    }

    return {
      success: true,
      needsReview: false,
      classification,
    };
  } catch (error) {
    const modelGone = error instanceof AiExtractionError && error.code === 'AI_MODEL_UNAVAILABLE';
    if (modelGone) {
      // Mark the saved model stale in the cached catalog so future scans fail fast
      // instead of repeatedly calling a dead model. The user's preference itself is
      // never silently switched — they choose the replacement.
      recordModelValidation(provider, model, { status: 'unavailable', message: 'Provider reports this model is gone.' });
    }
    const errorMessage = modelGone
      ? `Your selected model (${model}) is no longer available. Choose another model in Settings > AI, then retry.`
      : error instanceof Error
        ? error.message
        : 'AI extraction could not read this card.';
    if (__DEV__) {
      console.error(`[CardNest AI Pipeline] Processing pipeline error`, {
        cardId,
        sanitizedError: errorMessage.slice(0, 150),
      });
    }

    await Promise.all([
      supabase
        .from('processing_jobs')
        .update({
          status: 'failed',
          completed_at: new Date().toISOString(),
          last_error: errorMessage,
        })
        .eq('id', job.id),
      supabase
        .from('cards')
        .update({
          status: 'review',
          extraction_quality: { failed: true, error: errorMessage },
        })
        .eq('id', cardId),
    ]);
    return false;
  }
}
