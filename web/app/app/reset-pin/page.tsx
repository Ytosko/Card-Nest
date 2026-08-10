import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import { ResetWebPin } from '@/components/reset-web-pin';
import { requireWebUser } from '@/lib/supabase/server';

type Query = Promise<{ nonce?: string }>;

export default async function ResetPinPage({ searchParams }: { searchParams: Query }) {
  const { user } = await requireWebUser(); if (!user) redirect('/auth?mode=signin');
  const { nonce } = await searchParams; const cookieStore = await cookies(); const expected = cookieStore.get('cardnest_web_pin_reset')?.value;
  if (!nonce || !expected || nonce !== expected) redirect('/app?reauth=required');
  return <ResetWebPin userId={user.id} />;
}
