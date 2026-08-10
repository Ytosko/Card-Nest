import { randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { createServerSupabaseClient } from '@/lib/supabase/server';

const productionOrigin = 'https://cardnest.ytosko.dev';

export async function GET() {
  const nonce = randomBytes(32).toString('base64url');
  const cookieStore = await cookies();
  cookieStore.set('cardnest_web_pin_reset', nonce, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 300, path: '/' });
  const supabase = await createServerSupabaseClient();
  const redirectTo = `${productionOrigin}/auth/callback?mode=web&pin_reset_nonce=${encodeURIComponent(nonce)}`;
  const { data, error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo, skipBrowserRedirect: true } });
  if (error || !data.url) return NextResponse.redirect(`${productionOrigin}/app?reauth=failed`);
  return NextResponse.redirect(data.url);
}
