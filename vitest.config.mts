import path from 'path';
import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  define: {
    __DEV__: 'true',
    'process.env.EXPO_PUBLIC_SUPABASE_URL': JSON.stringify('https://cardnest-test.supabase.co'),
    'process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY': JSON.stringify('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy_test_anon_key'),
  },
  test: {
    environment: 'node',
    exclude: [...configDefaults.exclude, 'web/**'],
  },
  resolve: {
    alias: {
      'react-native': 'react-native-web',
      '@': path.resolve(import.meta.dirname, '.'),
    },
  },
});
