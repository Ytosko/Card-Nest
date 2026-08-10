import { NextResponse } from 'next/server';

import { requireWebUser } from '@/lib/supabase/server';

export async function POST(request: Request) {
  const { supabase, user } = await requireWebUser(); if (!user) return NextResponse.json({ ok: false, message: 'Authentication required.' }, { status: 401 });
  const body = await request.json().catch(() => ({})) as { images?: string[] };
  if (!body.images?.length || body.images.length > 2) return NextResponse.json({ ok: false, message: 'Add a front image and optionally a back image.' }, { status: 400 });
  const { data: preference } = await supabase.from('user_preferences').select('selected_ai_provider,selected_ai_model').eq('user_id', user.id).maybeSingle();
  if (!preference?.selected_ai_provider || !preference.selected_ai_model) return NextResponse.json({ ok: false, code: 'AI_NOT_CONFIGURED', message: 'Choose an AI provider and model in Settings before scanning.' }, { status: 400 });
  const { data: sessionData } = await supabase.auth.getSession(); const token = sessionData.session?.access_token; if (!token) return NextResponse.json({ ok: false, message: 'Your session expired.' }, { status: 401 });
  const url = process.env.SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL; const key = process.env.SUPABASE_ANON_KEY ?? process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY; if (!url || !key) return NextResponse.json({ ok: false, message: 'Extraction backend is not configured.' }, { status: 500 });
  const response = await fetch(`${url}/functions/v1/ai-extract`, { method: 'POST', headers: { apikey: key, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ provider: preference.selected_ai_provider, model: preference.selected_ai_model, images: body.images }), cache: 'no-store' });
  return new NextResponse(await response.text(), { status: response.status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store' } });
}
