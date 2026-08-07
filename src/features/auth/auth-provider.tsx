import type { Session, User } from '@supabase/supabase-js';
import { useQueryClient } from '@tanstack/react-query';
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

import { supabase } from '@/src/lib/supabase/client';
import type { Tables } from '@/src/types/database.helpers';

type Profile = Tables<'profiles'>;

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
        if (mounted.current && activeUserId.current === currentUser.id) setProfile(data);
        return;
      }

      const fallbackName = typeof currentUser.user_metadata.display_name === 'string'
        ? currentUser.user_metadata.display_name.trim().slice(0, 120) || null
        : null;
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
      signOut,
    }),
    [initialized, pendingEmail, profile, profileLoading, recoveryMode, refreshProfile, session, signOut, updateDisplayName],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider.');
  return value;
}
