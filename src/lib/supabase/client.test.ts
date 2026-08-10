import { describe, expect, it } from 'vitest';

import { supabase } from './client';

describe('Supabase Client Configuration', () => {
  it('instantiates the production client with experimental passkey support enabled', () => {
    expect(supabase).toBeDefined();
    expect(supabase.auth).toBeDefined();
    // Verify that the internal experimental options contain passkey: true
    const authAny = supabase.auth as any;
    expect(authAny.experimental).toBeDefined();
    expect(authAny.experimental.passkey).toBe(true);
  });

  it('preserves essential auth options on the client instance', () => {
    const authAny = supabase.auth as any;
    expect(authAny.autoRefreshToken).toBe(true);
    expect(authAny.persistSession).toBe(true);
  });
});
