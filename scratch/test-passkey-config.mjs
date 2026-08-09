import { createClient } from '@supabase/supabase-js';

const supabase = createClient('https://kncwnbxoynkxsckvnevb.supabase.co', 'dummy_key', {
  auth: {
    experimental: {
      passkey: true,
    },
  },
});

console.log('Client created with experimental.passkey: true');
console.log('Passkey object:', typeof supabase.auth.passkey);
