import type { SupportedStorage } from '@supabase/supabase-js';

const memory = new Map<string, string>();

const serverStorage: SupportedStorage = {
  getItem: (key) => memory.get(key) ?? null,
  removeItem: (key) => {
    memory.delete(key);
  },
  setItem: (key, value) => {
    memory.set(key, value);
  },
};

export const authStorage = typeof globalThis.localStorage === 'undefined' ? serverStorage : globalThis.localStorage;
