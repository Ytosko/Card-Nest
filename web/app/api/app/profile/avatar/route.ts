import { requireWebUser } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

function unavailable(status: number) {
  return new Response(null, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

export async function GET() {
  const auth = await requireWebUser();
  if (auth.status === 'unauthenticated') return unavailable(401);
  if (auth.status === 'unavailable') return unavailable(503);

  const { supabase, user } = auth;
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('avatar_path')
    .eq('user_id', user.id)
    .maybeSingle();
  const avatarPath = profile?.avatar_path;
  if (profileError || !avatarPath || !avatarPath.startsWith(`${user.id}/`)) return unavailable(404);

  const { data, error } = await supabase.storage.from('profile-avatars').createSignedUrl(avatarPath, 60);
  if (error || !data?.signedUrl) return unavailable(404);

  const upstream = await fetch(data.signedUrl, { cache: 'no-store' });
  const contentType = upstream.headers.get('content-type');
  if (!upstream.ok || !upstream.body || !contentType?.startsWith('image/')) return unavailable(404);

  const headers = new Headers({
    'Cache-Control': 'private, max-age=300, stale-while-revalidate=60',
    'Content-Type': contentType,
    'Vary': 'Cookie',
    'X-Content-Type-Options': 'nosniff',
  });
  const contentLength = upstream.headers.get('content-length');
  const etag = upstream.headers.get('etag');
  if (contentLength) headers.set('Content-Length', contentLength);
  if (etag) headers.set('ETag', etag);

  return new Response(upstream.body, { status: 200, headers });
}
