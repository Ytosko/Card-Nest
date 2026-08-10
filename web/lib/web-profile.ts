import 'server-only';

import { createHash } from 'node:crypto';
import { cache } from 'react';

import { requireWebUser } from '@/lib/supabase/server';

type UserMetadata = Record<string, unknown>;

export type WebProfileIdentity = {
  avatarPath: string | null;
  avatarSources: string[];
  displayName: string;
  email: string;
};

function metadataText(metadata: UserMetadata, key: string) {
  const value = metadata[key];
  return typeof value === 'string' ? value.trim() : '';
}

function googleAvatarUrl(metadata: UserMetadata) {
  const candidate = metadataText(metadata, 'avatar_url') || metadataText(metadata, 'picture');
  if (!candidate) return null;

  try {
    const url = new URL(candidate);
    const googleHosted = url.hostname === 'googleusercontent.com' || url.hostname.endsWith('.googleusercontent.com');
    return url.protocol === 'https:' && googleHosted ? url.toString() : null;
  } catch {
    return null;
  }
}

function gravatarUrl(email: string) {
  if (!email) return null;
  const hash = createHash('md5').update(email.trim().toLowerCase()).digest('hex');
  return `https://www.gravatar.com/avatar/${hash}?s=256&d=404`;
}

export const getWebProfileIdentity = cache(async () => {
  const auth = await requireWebUser();
  if (auth.status !== 'authenticated') return auth;

  const { supabase, user } = auth;
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('display_name,avatar_path,updated_at')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) throw new Error('Card Nest could not load your profile.');

  const metadata = user.user_metadata as UserMetadata;
  const email = user.email ?? '';
  const displayName =
    profile?.display_name ||
    metadataText(metadata, 'display_name') ||
    metadataText(metadata, 'full_name') ||
    metadataText(metadata, 'name') ||
    email.split('@')[0] ||
    'Card Nest user';
  const avatarPath = profile?.avatar_path ?? null;
  const avatarSources = [
    avatarPath ? `/api/app/profile/avatar?v=${encodeURIComponent(profile?.updated_at ?? '')}` : null,
    googleAvatarUrl(metadata),
    gravatarUrl(email),
  ].filter((source): source is string => Boolean(source));

  return {
    status: 'authenticated' as const,
    supabase,
    user,
    profile: {
      avatarPath,
      avatarSources: [...new Set(avatarSources)],
      displayName,
      email,
    } satisfies WebProfileIdentity,
  };
});
