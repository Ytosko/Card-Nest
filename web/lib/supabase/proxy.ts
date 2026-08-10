import { createServerClient } from '@supabase/ssr';
import { type NextRequest, NextResponse } from 'next/server';

import { getSupabaseConfig } from '@/lib/supabase/config';

export async function updateSupabaseSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { url, key } = getSupabaseConfig();
  const supabase = createServerClient(url, key, {
    auth: { flowType: 'pkce' },
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (values, headers) => {
        for (const { name, value } of values) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of values) {
          response.cookies.set(name, value, {
            ...options,
            sameSite: 'lax',
            secure: process.env.NODE_ENV === 'production',
          });
        }
        for (const [name, value] of Object.entries(headers)) response.headers.set(name, value);
      },
    },
  });

  // Supabase SSR refreshes expiring tokens here, before Server Components
  // read them, and mirrors any rotated cookies to both the request and response.
  await supabase.auth.getClaims();
  return response;
}
