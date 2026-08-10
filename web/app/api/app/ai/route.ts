import { NextResponse } from 'next/server';

import { requireWebUser } from '@/lib/supabase/server';

function config() {
  const url = process.env.SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY ?? process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Web backend is not configured.');
  return { url, key };
}

async function context() {
  const { supabase, user } = await requireWebUser();
  if (!user) return null;
  const { data } = await supabase.auth.getSession();
  if (!data.session) return null;
  return { supabase, user, token: data.session.access_token };
}

async function proxyCredential(request: Request, method: 'GET' | 'POST' | 'DELETE') {
  const ctx = await context(); if (!ctx) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  const incoming = new URL(request.url); const { url, key } = config();
  const query = new URLSearchParams(); for (const name of ['action', 'provider']) { const value = incoming.searchParams.get(name); if (value) query.set(name, value); }
  const response = await fetch(`${url}/functions/v1/ai-credentials${query.size ? `?${query}` : ''}`, { method, headers: { apikey: key, Authorization: `Bearer ${ctx.token}`, ...(method === 'POST' ? { 'Content-Type': 'application/json' } : {}) }, body: method === 'POST' ? await request.text() : undefined, cache: 'no-store' });
  return new NextResponse(await response.text(), { status: response.status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store' } });
}

export async function GET(request: Request) { return proxyCredential(request, 'GET'); }
export async function DELETE(request: Request) { return proxyCredential(request, 'DELETE'); }
export async function POST(request: Request) {
  const incoming = new URL(request.url);
  if (incoming.searchParams.get('action') !== 'preferences') return proxyCredential(request, 'POST');
  const ctx = await context(); if (!ctx) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
  const body = await request.json().catch(() => ({})) as { provider?: string; model?: string };
  if (!['openai','gemini'].includes(body.provider ?? '') || !body.model?.trim()) return NextResponse.json({ error: 'Choose a provider and model.' }, { status: 400 });
  const { error } = await ctx.supabase.from('user_preferences').upsert({ user_id: ctx.user.id, selected_ai_provider: body.provider, selected_ai_model: body.model.trim() }, { onConflict: 'user_id' });
  if (error) return NextResponse.json({ error: 'Could not save AI preferences.' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
