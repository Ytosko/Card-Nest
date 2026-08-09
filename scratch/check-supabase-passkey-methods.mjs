import { createClient } from '@supabase/supabase-js';

const supabase = createClient('https://kncwnbxoynkxsckvnevb.supabase.co', 'dummy_key');

for (const key of Object.keys(supabase.auth.passkey)) {
  console.log(`supabase.auth.passkey.${key}:`, supabase.auth.passkey[key].toString());
}
