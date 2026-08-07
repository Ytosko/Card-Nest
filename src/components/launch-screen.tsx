import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { AccessibilityInfo, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { AppText } from '@/src/components/ui/app-text';
import { useAppTheme } from '@/src/theme/theme-provider';

export function LaunchScreen({ onFinish }: { onFinish: () => void }) {
  const theme = useAppTheme();
  const [reduceMotion, setReduceMotion] = useState(false);

  // Animation values
  const entrance = useSharedValue(0);
  const logoSpring = useSharedValue(0);
  const idle = useSharedValue(0);
  const glow = useSharedValue(0);

  useEffect(() => {
    let mounted = true;

    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (!mounted) return;
      setReduceMotion(enabled);

      if (enabled) {
        // Fast, subtle fade for reduced motion preference
        entrance.value = withTiming(1, { duration: 350 }, (finished) => {
          if (finished && mounted) {
            runOnJS(onFinish)();
          }
        });
      } else {
        // Full springy nest animation (1.6 - 1.8s)
        entrance.value = withTiming(1, {
          duration: 1600,
          easing: Easing.out(Easing.cubic),
        });

        // Logo spring entry with soft overshoot and wobble
        logoSpring.value = withDelay(
          180,
          withSpring(1, {
            damping: 11,
            stiffness: 90,
            mass: 0.9,
          })
        );

        // Cyan glow pulsing behind nest center
        glow.value = withDelay(
          300,
          withRepeat(
            withSequence(
              withTiming(1, { duration: 1200, easing: Easing.inOut(Easing.quad) }),
              withTiming(0.4, { duration: 1200, easing: Easing.inOut(Easing.quad) })
            ),
            -1,
            true
          )
        );

        // Subtle living idle motion after convergence
        idle.value = withDelay(
          1200,
          withRepeat(
            withSequence(
              withTiming(1, { duration: 2000, easing: Easing.inOut(Easing.quad) }),
              withTiming(0, { duration: 2000, easing: Easing.inOut(Easing.quad) })
            ),
            -1,
            true
          )
        );

        // Trigger finish callback once initial spring settles
        const timer = setTimeout(() => {
          if (mounted) {
            onFinish();
          }
        }, 1800);

        return () => clearTimeout(timer);
      }
    });

    return () => {
      mounted = false;
    };
  }, [entrance, glow, idle, logoSpring, onFinish]);

  // Animated styles for nest cards floating in from corners
  const cardTopLeftStyle = useAnimatedStyle(() => {
    if (reduceMotion) return { opacity: entrance.value };
    const p = entrance.value;
    const idleY = interpolate(idle.value, [0, 1], [0, -4]);
    return {
      opacity: interpolate(p, [0, 0.4, 1], [0, 0.8, 0.9]),
      transform: [
        { translateX: interpolate(p, [0, 1], [-130, -32]) },
        { translateY: interpolate(p, [0, 1], [-110, -26]) + idleY },
        { rotate: `${interpolate(p, [0, 1], [-32, -14])}deg` },
        { scale: interpolate(p, [0, 1], [0.6, 0.96]) },
      ],
    };
  });

  const cardTopRightStyle = useAnimatedStyle(() => {
    if (reduceMotion) return { opacity: entrance.value };
    const p = entrance.value;
    const idleY = interpolate(idle.value, [0, 1], [0, 5]);
    return {
      opacity: interpolate(p, [0, 0.4, 1], [0, 0.8, 0.88]),
      transform: [
        { translateX: interpolate(p, [0, 1], [130, 30]) },
        { translateY: interpolate(p, [0, 1], [-100, -22]) + idleY },
        { rotate: `${interpolate(p, [0, 1], [30, 12])}deg` },
        { scale: interpolate(p, [0, 1], [0.6, 0.94]) },
      ],
    };
  });

  const cardBottomLeftStyle = useAnimatedStyle(() => {
    if (reduceMotion) return { opacity: entrance.value };
    const p = entrance.value;
    const idleY = interpolate(idle.value, [0, 1], [0, 4]);
    return {
      opacity: interpolate(p, [0, 0.4, 1], [0, 0.75, 0.85]),
      transform: [
        { translateX: interpolate(p, [0, 1], [-120, -24]) },
        { translateY: interpolate(p, [0, 1], [110, 26]) + idleY },
        { rotate: `${interpolate(p, [0, 1], [-26, -9])}deg` },
        { scale: interpolate(p, [0, 1], [0.6, 0.95]) },
      ],
    };
  });

  const cardBottomRightStyle = useAnimatedStyle(() => {
    if (reduceMotion) return { opacity: entrance.value };
    const p = entrance.value;
    const idleY = interpolate(idle.value, [0, 1], [0, -3]);
    return {
      opacity: interpolate(p, [0, 0.4, 1], [0, 0.75, 0.85]),
      transform: [
        { translateX: interpolate(p, [0, 1], [120, 26]) },
        { translateY: interpolate(p, [0, 1], [100, 24]) + idleY },
        { rotate: `${interpolate(p, [0, 1], [28, 11])}deg` },
        { scale: interpolate(p, [0, 1], [0.6, 0.93]) },
      ],
    };
  });

  // Animated style for central materializing logo card
  const logoCardStyle = useAnimatedStyle(() => {
    if (reduceMotion) {
      return {
        opacity: entrance.value,
        transform: [{ scale: interpolate(entrance.value, [0, 1], [0.95, 1]) }],
      };
    }
    const s = logoSpring.value;
    const idleY = interpolate(idle.value, [0, 1], [0, -2]);
    return {
      opacity: interpolate(s, [0, 0.2, 1], [0, 0.9, 1]),
      transform: [
        { translateY: idleY },
        { scale: interpolate(s, [0, 0.7, 1], [0.4, 1.06, 1]) },
        { rotate: `${interpolate(s, [0, 0.5, 0.8, 1], [-9, 3, -1, 0])}deg` },
      ],
    };
  });

  // Cyan ambient glow style
  const glowStyle = useAnimatedStyle(() => {
    if (reduceMotion) return { opacity: 0.15 };
    return {
      opacity: interpolate(glow.value, [0, 1], [0.12, 0.28]),
      transform: [{ scale: interpolate(glow.value, [0, 1], [0.92, 1.1]) }],
    };
  });

  // Wordmark & tagline fade/slide style
  const wordmarkStyle = useAnimatedStyle(() => {
    if (reduceMotion) return { opacity: entrance.value };
    const p = entrance.value;
    return {
      opacity: interpolate(p, [0, 0.4, 1], [0, 0.2, 1]),
      transform: [{ translateY: interpolate(p, [0, 1], [14, 0]) }],
    };
  });

  return (
    <View
      accessibilityLabel="Card Nest is opening"
      accessibilityRole="progressbar"
      style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Cyan Ambient Glow */}
      <Animated.View
        style={[
          styles.glowCircle,
          { backgroundColor: theme.colors.primary },
          glowStyle,
        ]}
      />

      {/* Nest Canvas / Floating Abstract Cards */}
      <View style={styles.nestCanvas}>
        <Animated.View
          style={[
            styles.abstractCard,
            {
              backgroundColor: theme.colors.primarySoft,
              borderColor: theme.colors.primary,
            },
            cardTopLeftStyle,
          ]}
        />
        <Animated.View
          style={[
            styles.abstractCard,
            {
              backgroundColor: theme.colors.surfaceRaised,
              borderColor: theme.colors.border,
            },
            cardTopRightStyle,
          ]}
        />
        <Animated.View
          style={[
            styles.abstractCard,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.borderStrong,
            },
            cardBottomLeftStyle,
          ]}
        />
        <Animated.View
          style={[
            styles.abstractCard,
            {
              backgroundColor: theme.colors.primarySoft,
              borderColor: theme.colors.primary,
            },
            cardBottomRightStyle,
          ]}
        />

        {/* Central Logo Card */}
        <Animated.View
          style={[
            styles.centerCard,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.primary,
              shadowColor: theme.colors.primary,
            },
            logoCardStyle,
          ]}>
          <Image
            accessibilityIgnoresInvertColors
            contentFit="contain"
            source={require('@/assets/images/cardnest-icon.png')}
            style={styles.logoImage}
          />
        </Animated.View>
      </View>

      {/* Wordmark & Tagline */}
      <Animated.View style={[styles.wordmark, wordmarkStyle]}>
        <AppText variant="title">Card Nest</AppText>
        <AppText muted variant="caption">
          The contacts worth keeping
        </AppText>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  abstractCard: {
    borderRadius: 20,
    borderWidth: 1.5,
    height: 130,
    position: 'absolute',
    width: 210,
  },
  centerCard: {
    alignItems: 'center',
    borderRadius: 24,
    borderWidth: 2,
    elevation: 8,
    height: 144,
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    width: 224,
    zIndex: 10,
  },
  container: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  glowCircle: {
    borderRadius: 140,
    height: 280,
    position: 'absolute',
    width: 280,
  },
  logoImage: {
    height: 96,
    width: 96,
  },
  nestCanvas: {
    alignItems: 'center',
    height: 200,
    justifyContent: 'center',
    width: 280,
  },
  wordmark: {
    alignItems: 'center',
    gap: 4,
    marginTop: 36,
  },
});

