import type { Session, User } from '@supabase/supabase-js';
import { useQueryClient } from '@tanstack/react-query';
import * as WebBrowser from 'expo-web-browser';
import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { getPublicEnv } from '@/src/config/env';
import { supabase } from '@/src/lib/supabase/client';
import type { Tables } from '@/src/types/database.helpers';

import { parseAuthLink } from './auth-link';

// Completes any pending browser auth session when the app regains focus.
WebBrowser.maybeCompleteAuthSession();

type Profile = Tables<'profiles'>;

/** Best display name from auth metadata: ours first, then standard OAuth keys. */
function metadataDisplayName(user: User): string | null {
  for (const key of ['display_name', 'full_name', 'name'] as const) {
    const value = user.user_metadata?.[key];
    if (typeof value === 'string' && value.trim()) return value.trim().slice(0, 120);
  }
  return null;
}

type AuthContextValue = {
  initialized: boolean;
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  profileLoading: boolean;
  recoveryMode: boolean;
  pendingEmail: string | null;
  setPendingEmail: (email: string | null) => void;
  beginRecovery: () => void;
  completeRecovery: () => void;
  refreshProfile: () => Promise<void>;
  updateDisplayName: (displayName: string) => Promise<void>;
  signInWithGoogle: () => Promise<'success' | 'cancelled'>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const queryClient = useQueryClient();
  const [initialized, setInitialized] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const mounted = useRef(true);
  const activeUserId = useRef<string | null>(null);

  const loadProfile = useCallback(async (currentUser: User) => {
    setProfileLoading(true);
    try {
      const { data, error } = await supabase.from('profiles').select('*').eq('user_id', currentUser.id).maybeSingle();
      if (error) throw error;

      if (data) {
        // One-time backfill: fill an empty display name from OAuth metadata (e.g. a
        // first Google sign-in). A name the user has set is never overwritten.
        if (!data.display_name) {
          const metaName = metadataDisplayName(currentUser);
          if (metaName) {
            const { data: backfilled } = await supabase
              .from('profiles')
              .update({ display_name: metaName })
              .eq('user_id', currentUser.id)
              .is('display_name', null)
              .select('*')
              .maybeSingle();
            if (backfilled && mounted.current && activeUserId.current === currentUser.id) {
              setProfile(backfilled);
              return;
            }
          }
        }
        if (mounted.current && activeUserId.current === currentUser.id) setProfile(data);
        return;
      }

      const fallbackName = metadataDisplayName(currentUser);
      const { data: created, error: createError } = await supabase
        .from('profiles')
        .upsert({ user_id: currentUser.id, display_name: fallbackName })
        .select('*')
        .single();
      if (createError) throw createError;
      if (mounted.current && activeUserId.current === currentUser.id) setProfile(created);
    } finally {
      if (mounted.current) setProfileLoading(false);
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (session?.user) await loadProfile(session.user);
  }, [loadProfile, session?.user]);

  useEffect(() => {
    mounted.current = true;

    void supabase.auth.getSession().then(({ data, error }) => {
      if (!mounted.current) return;
      activeUserId.current = error ? null : data.session?.user.id ?? null;
      setSession(error ? null : data.session);
      setInitialized(true);
      if (!error && data.session?.user) void loadProfile(data.session.user).catch(() => undefined);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!mounted.current) return;
      activeUserId.current = nextSession?.user.id ?? null;
      setSession(nextSession);
      setInitialized(true);

      if (event === 'PASSWORD_RECOVERY') setRecoveryMode(true);
      if (event === 'SIGNED_OUT') {
        queryClient.clear();
        setProfile(null);
        setRecoveryMode(false);
        setPendingEmail(null);
      } else if (nextSession?.user) {
        setTimeout(() => void loadProfile(nextSession.user).catch(() => undefined), 0);
      }
    });

    return () => {
      mounted.current = false;
      listener.subscription.unsubscribe();
    };
  }, [loadProfile, queryClient]);

  const updateDisplayName = useCallback(
    async (displayName: string) => {
      if (!session?.user) throw new Error('You must be signed in to update your profile.');
      const normalizedName = displayName.trim() || null;
      const { data, error } = await supabase
        .from('profiles')
        .update({ display_name: normalizedName })
        .eq('user_id', session.user.id)
        .select('*')
        .single();
      if (error) throw error;
      setProfile(data);
      await supabase.auth.updateUser({ data: { display_name: normalizedName } });
    },
    [session?.user],
  );

  const signInWithGoogle = useCallback(async (): Promise<'success' | 'cancelled'> => {
    const env = getPublicEnv();
    // Post-OAuth destination: the Card Nest web callback relays the session into the
    // app via the existing cardnest:// deep-link architecture. Google's own OAuth
    // redirect URI (the Supabase /auth/v1/callback) is configured server-side.
    const callbackOrigin = new URL(env.EXPO_PUBLIC_AUTH_CALLBACK_URL).origin;
    const redirectTo = `${callbackOrigin}/gauth/callback`;
    const returnUrl = `${env.EXPO_PUBLIC_APP_SCHEME}://auth/callback`;

    console.log('[CardNest Mobile Auth] Initiating Google OAuth:', { redirectTo, returnUrl });

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo, skipBrowserRedirect: true },
    });
    if (error) {
      console.error('[CardNest Mobile Auth] Supabase OAuth initiation error:', error);
      throw error;
    }
    if (!data?.url) throw new Error('Google sign-in could not be started. Please try again.');

    const redirectHost = data.url ? new URL(data.url).host : 'none';
    console.log('[CardNest Mobile Auth] OAuth URL generated:', {
      hasUrl: Boolean(data.url),
      redirectHost,
      provider: 'google',
      redirectTo,
      skipBrowserRedirect: true,
    });

    console.log('[CardNest Mobile Auth] Opening WebBrowser auth session...');
    const result = await WebBrowser.openAuthSessionAsync(data.url, returnUrl);
    console.log('[CardNest Mobile Auth] WebBrowser auth session result type:', result.type);
    if (result.type !== 'success' || !result.url) return 'cancelled';

    console.log('[CardNest Mobile Auth] Parsing return deep-link URL...');
    const parsed = parseAuthLink(result.url);
    console.log('[CardNest Mobile Auth] Parsed auth link kind:', parsed.kind);

    if (parsed.kind === 'error') throw new Error(parsed.message);
    if (parsed.kind === 'session') {
      console.log('[CardNest Mobile Auth] Setting session from hash tokens...');
      const { error: sessionError } = await supabase.auth.setSession({
        access_token: parsed.accessToken,
        refresh_token: parsed.refreshToken,
      });
      if (sessionError) {
        console.error('[CardNest Mobile Auth] setSession error:', sessionError);
        throw sessionError;
      }
      console.log('[CardNest Mobile Auth] Session established successfully from hash tokens!');
      return 'success';
    }
    if (parsed.kind === 'code') {
      console.log('[CardNest Mobile Auth] Exchanging PKCE code for session...');
      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(parsed.code);
      if (exchangeError) {
        console.error('[CardNest Mobile Auth] PKCE exchange error:', exchangeError);
        throw exchangeError;
      }
      console.log('[CardNest Mobile Auth] PKCE code exchange succeeded!');
      return 'success';
    }
    throw new Error('Google sign-in did not return a valid Card Nest session. Please try again.');
  }, []);

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      initialized,
      session,
      user: session?.user ?? null,
      profile,
      profileLoading,
      recoveryMode,
      pendingEmail,
      setPendingEmail,
      beginRecovery: () => setRecoveryMode(true),
      completeRecovery: () => setRecoveryMode(false),
      refreshProfile,
      updateDisplayName,
      signInWithGoogle,
      signOut,
    }),
    [initialized, pendingEmail, profile, profileLoading, recoveryMode, refreshProfile, session, signInWithGoogle, signOut, updateDisplayName],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider.');
  return value;
}
