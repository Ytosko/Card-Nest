import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/src/components/ui/app-text';
import { getSignedContactPhotoUrl } from '@/src/features/cards/card-service';
import { useAppTheme } from '@/src/theme/theme-provider';
import { getGravatarUrl } from '@/src/utils/gravatar';

type ContactAvatarProps = {
  contactPhotoPath?: string | null;
  email?: string | null;
  name?: string | null;
  company?: string | null;
  size?: number;
};

export function ContactAvatar({ contactPhotoPath, email, name, company, size = 46 }: ContactAvatarProps) {
  const theme = useAppTheme();
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [gravatarFailed, setGravatarFailed] = useState(false);

  useEffect(() => {
    setGravatarFailed(false);
    if (!contactPhotoPath) {
      setPhotoUrl(null);
      return;
    }
    let mounted = true;
    void getSignedContactPhotoUrl(contactPhotoPath).then((url) => {
      if (mounted) setPhotoUrl(url);
    });
    return () => {
      mounted = false;
    };
  }, [contactPhotoPath]);

  const gravatar = getGravatarUrl(email, size * 2);
  const initials = (name || company || '?')
    .split(/[\s@]+/u)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');

  const fontSize = size >= 80 ? 28 : size >= 50 ? 18 : 14;

  const currentSourceUrl = photoUrl || (!gravatarFailed && gravatar ? gravatar : null);

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
      {currentSourceUrl ? (
        <Image
          contentFit="cover"
          onError={() => setGravatarFailed(true)}
          source={currentSourceUrl}
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
