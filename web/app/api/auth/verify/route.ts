import { createClient, type EmailOtpType } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const allowedTypes = new Set<EmailOtpType>([
  'email',
  'email_change',
  'invite',
  'magiclink',
  'recovery',
  'signup',
]);

const responseHeaders = {
  'Cache-Control': 'no-store, max-age=0',
  Pragma: 'no-cache',
};

function errorResponse(message: string, status: number) {
  return Response.json({ ok: false, message }, { status, headers: responseHeaders });
}

function getServerConfiguration() {
  const url = process.env.SUPABASE_URL?.trim();
  const anonKey = process.env.SUPABASE_ANON_KEY?.trim();

  if (!url || !anonKey) return null;

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return null;
  } catch {
    return null;
  }

  return { url, anonKey };
}

export async function POST(request: Request) {
  let payload: { tokenHash?: unknown; type?: unknown };

  try {
    payload = await request.json();
  } catch {
    return errorResponse('This verification request is incomplete.', 400);
  }

  const tokenHash = typeof payload.tokenHash === 'string' ? payload.tokenHash.trim() : '';
  const type = typeof payload.type === 'string' ? payload.type.trim() : '';

  if (tokenHash.length < 16 || tokenHash.length > 1024 || !allowedTypes.has(type as EmailOtpType)) {
    return errorResponse('This secure link is invalid or incomplete.', 400);
  }

  const configuration = getServerConfiguration();
  if (!configuration) {
    return errorResponse('Card Nest verification is temporarily unavailable. Please try again shortly.', 503);
  }

  const supabase = createClient(configuration.url, configuration.anonKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });

  const { data, error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: type as EmailOtpType,
  });

  if (error) {
    if (error.status === 429) {
      return errorResponse('Too many verification attempts. Please wait a moment and try again.', 429);
    }

    return errorResponse('This secure link has expired, was already used, or is not valid.', 400);
  }

  return Response.json(
    {
      ok: true,
      flowType: type,
      session: data.session
        ? {
            accessToken: data.session.access_token,
            refreshToken: data.session.refresh_token,
          }
        : null,
    },
    { headers: responseHeaders },
  );
}
