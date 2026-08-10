import { NextResponse } from 'next/server';

import { requireWebUser } from '@/lib/supabase/server';

export async function POST(request: Request) {
  const { supabase, user } = await requireWebUser();
  if (!user?.email) return NextResponse.json({ ok: false, message: 'Your session expired. Log in again.' }, { status: 401 });
  const body = await request.json().catch(() => ({})) as { password?: string };
  if (!body.password) return NextResponse.json({ ok: false, message: 'Enter your account password.' }, { status: 400 });
  const { error } = await supabase.auth.signInWithPassword({ email: user.email, password: body.password });
  if (error) return NextResponse.json({ ok: false, message: 'That account password is not correct.' }, { status: 401 });
  return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'private, no-store' } });
}
