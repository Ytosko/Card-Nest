// TypeScript fallback. Metro resolves auth-storage.native.ts or auth-storage.web.ts at runtime.
export const authStorage = globalThis.localStorage;
