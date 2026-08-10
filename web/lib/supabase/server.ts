import { createServerClient } from '@supabase/ssr';
import { isAuthSessionMissingError } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

import { getSupabaseConfig } from '@/lib/supabase/config';

export async function createServerSupabaseClient(options: { requireCookieWrites?: boolean } = {}) {
  const cookieStore = await cookies();
  const { url, key } = getSupabaseConfig();

  return createServerClient(url, key, {
    auth: { flowType: 'pkce' },
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (values) => {
        try {
          for (const { name, value, options } of values) {
            cookieStore.set(name, value, { ...options, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' });
          }
        } catch (error) {
          if (options.requireCookieWrites) throw error;
          // Server Components cannot write cookies. Route handlers and Server
          // Actions refresh and persist the session before rendering private UI.
        }
      },
    },
  });
}

export async function requireWebUser() {
  const supabase = await createServerSupabaseClient();
  try {
    const { data, error } = await supabase.auth.getUser();
    if (data.user) return { status: 'authenticated' as const, supabase, user: data.user };
    if (
      !error ||
      isAuthSessionMissingError(error) ||
      error.status === 401 ||
      error.code === 'refresh_token_not_found' ||
      error.code === 'refresh_token_already_used'
    ) {
      return { status: 'unauthenticated' as const, supabase, user: null };
    }
    return { status: 'unavailable' as const, supabase, user: null };
  } catch {
    return { status: 'unavailable' as const, supabase, user: null };
  }
}
