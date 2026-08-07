import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/src/components/ui/app-text';
import { supabase } from '@/src/lib/supabase/client';
import { useAppTheme } from '@/src/theme/theme-provider';

type UserAvatarProps = {
  avatarPath?: string | null;
  displayName?: string | null;
  email?: string | null;
  size?: number;
};

export function UserAvatar({ avatarPath, displayName, email, size = 48 }: UserAvatarProps) {
  const theme = useAppTheme();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!avatarPath) {
      setAvatarUrl(null);
      return;
    }
    let isMounted = true;
    void supabase.storage
      .from('profile-avatars')
      .createSignedUrl(avatarPath, 3600)
      .then(({ data }) => {
        if (isMounted) {
          setAvatarUrl(data?.signedUrl ?? null);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [avatarPath]);

  const initials = (displayName || email || '?')
    .split(/[\s@]+/u)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');

  const fontSize = size >= 90 ? 32 : size >= 50 ? 20 : 14;

  return (
    <View
      style={[
        styles.container,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: theme.colors.primarySoft,
          borderColor: theme.colors.border,
        },
      ]}>
      {avatarUrl ? (
        <Image
          contentFit="cover"
          source={avatarUrl}
          style={[styles.image, { width: size, height: size, borderRadius: size / 2 }]}
        />
      ) : (
        <AppText style={{ fontSize, color: theme.colors.primary, fontWeight: '700' }}>
          {initials}
        </AppText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    borderWidth: 1,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  image: {
    ...StyleSheet.absoluteFillObject,
  },
});
