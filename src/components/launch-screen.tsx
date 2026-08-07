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
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { AppText } from '@/src/components/ui/app-text';
import { useAppTheme } from '@/src/theme/theme-provider';

export function LaunchScreen({ onFinish }: { onFinish: () => void }) {
  const theme = useAppTheme();
  const [reduceMotion, setReduceMotion] = useState(false);

  // Core animation progress shared values
  const progress = useSharedValue(0); // 0.0 -> 1.0 main progression
  const beamY = useSharedValue(0); // 0 -> 138 vertical scan sweep
  const logoSpring = useSharedValue(0); // 0 -> 1 logo mark morph settle

  useEffect(() => {
    let mounted = true;

    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (!mounted) return;
      setReduceMotion(enabled);

      if (enabled) {
        // Fast, clean static fade for reduced motion
        progress.value = withTiming(1, { duration: 350 }, (finished) => {
          if (finished && mounted) {
            runOnJS(onFinish)();
          }
        });
      } else {
        // Main sequence duration ~1.65 seconds: Scan -> Intelligence -> Card Nest
        progress.value = withTiming(1, {
          duration: 1650,
          easing: Easing.out(Easing.cubic),
        });

        // Beam sweep top to bottom across 138px card height
        beamY.value = withDelay(
          300,
          withTiming(1, { duration: 750, easing: Easing.inOut(Easing.quad) })
        );

        // Logo spring morph
        logoSpring.value = withDelay(
          1100,
          withSpring(1, {
            damping: 14,
            stiffness: 110,
            mass: 0.8,
          })
        );

        const timer = setTimeout(() => {
          if (mounted) {
            onFinish();
          }
        }, 1750);

        return () => clearTimeout(timer);
      }
    });

    return () => {
      mounted = false;
    };
  }, [beamY, logoSpring, onFinish, progress]);

  // Card outline entry style
  const cardFrameStyle = useAnimatedStyle(() => {
    if (reduceMotion) return { opacity: 0 };
    const p = progress.value;
    const morph = logoSpring.value;
    return {
      opacity: interpolate(p, [0, 0.2, 0.95, 1.0], [0, 1, 0.8, 0]),
      transform: [
        { scale: interpolate(morph, [0, 1], [interpolate(p, [0, 0.2], [0.94, 1.0]), 0.45]) },
        { translateY: interpolate(morph, [0, 1], [0, -18]) },
      ],
    };
  });

  // Vertical cyan scanning laser beam style
  const scanBeamStyle = useAnimatedStyle(() => {
    if (reduceMotion) return { opacity: 0 };
    const y = beamY.value;
    return {
      opacity: interpolate(y, [0, 0.05, 0.95, 1.0], [0, 1, 1, 0]),
      transform: [{ translateY: interpolate(y, [0, 1], [4, 134]) }],
    };
  });

  // Intelligence layers revealing as scan beam passes
  const intelligenceStyle = useAnimatedStyle(() => {
    if (reduceMotion) return { opacity: 0 };
    const y = beamY.value;
    return {
      opacity: interpolate(y, [0.15, 0.85], [0, 1]),
    };
  });

  // Final Card Nest logo mark style
  const logoMarkStyle = useAnimatedStyle(() => {
    if (reduceMotion) {
      return {
        opacity: progress.value,
        transform: [{ scale: interpolate(progress.value, [0, 1], [0.95, 1]) }],
      };
    }
    const s = logoSpring.value;
    return {
      opacity: interpolate(s, [0, 0.2, 1], [0, 0.8, 1]),
      transform: [
        { scale: interpolate(s, [0, 0.8, 1], [0.35, 1.05, 1]) },
      ],
    };
  });

  // Title & tagline reveal style
  const titleStyle = useAnimatedStyle(() => {
    if (reduceMotion) return { opacity: progress.value };
    const s = logoSpring.value;
    return {
      opacity: interpolate(s, [0.2, 1], [0, 1]),
      transform: [{ translateY: interpolate(s, [0, 1], [14, 0]) }],
    };
  });

  return (
    <View
      accessibilityLabel="Card Nest is opening"
      accessibilityRole="progressbar"
      style={[styles.container, { backgroundColor: theme.colors.background }]}>
      
      {/* Motion Stage Container */}
      <View style={styles.stage}>
        {/* Stage 1 & 2: Business Card Outline & Scan Beam */}
        <Animated.View
          style={[
            styles.cardFrame,
            { borderColor: theme.colors.primary, backgroundColor: theme.colors.surface },
            cardFrameStyle,
          ]}>
          {/* Scanning Beam */}
          <Animated.View style={[styles.beamLine, scanBeamStyle]} />

          {/* Intelligence Elements Revealed by Beam */}
          <Animated.View style={[styles.intelligenceContent, intelligenceStyle]}>
            {/* Avatar Ring */}
            <View style={[styles.avatarRing, { borderColor: theme.colors.primary }]}>
              <View style={[styles.avatarCore, { backgroundColor: theme.colors.primarySoft }]} />
            </View>

            {/* Abstract Text Lines */}
            <View style={styles.textLines}>
              <View style={[styles.line, { width: 110, backgroundColor: theme.colors.primary }]} />
              <View style={[styles.line, { width: 84, backgroundColor: theme.colors.textMuted }]} />
              <View style={[styles.line, { width: 62, backgroundColor: theme.colors.textMuted }]} />
            </View>

            {/* Connector Node */}
            <View style={[styles.connectorDot, { backgroundColor: theme.colors.primary }]} />
          </Animated.View>
        </Animated.View>

        {/* Stage 3: Card Nest Logo Mark */}
        <Animated.View style={[styles.logoWrapper, logoMarkStyle]}>
          <Image
            accessibilityIgnoresInvertColors
            contentFit="contain"
            source={require('@/assets/images/cardnest-icon.png')}
            style={styles.logoImage}
          />
        </Animated.View>
      </View>

      {/* Stage 4: Wordmark Settle */}
      <Animated.View style={[styles.wordmark, titleStyle]}>
        <AppText variant="display" style={{ color: theme.colors.text }}>
          Card Nest
        </AppText>
        <AppText muted variant="caption">
          Business Card Intelligence
        </AppText>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  avatarCore: {
    borderRadius: 999,
    height: 14,
    width: 14,
  },
  avatarRing: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1.5,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  beamLine: {
    backgroundColor: '#0CC0DF',
    borderRadius: 999,
    elevation: 4,
    height: 2,
    left: 4,
    position: 'absolute',
    right: 4,
    shadowColor: '#0CC0DF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 6,
    top: 0,
    zIndex: 10,
  },
  cardFrame: {
    borderRadius: 14,
    borderWidth: 1.5,
    height: 138,
    overflow: 'hidden',
    position: 'absolute',
    width: 220,
  },
  connectorDot: {
    borderRadius: 999,
    bottom: 16,
    height: 6,
    position: 'absolute',
    right: 16,
    width: 6,
  },
  container: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  intelligenceContent: {
    flex: 1,
    flexDirection: 'row',
    gap: 12,
    padding: 16,
  },
  line: {
    borderRadius: 4,
    height: 4,
  },
  logoImage: {
    height: 92,
    width: 92,
  },
  logoWrapper: {
    alignItems: 'center',
    height: 92,
    justifyContent: 'center',
    position: 'absolute',
    width: 92,
  },
  stage: {
    alignItems: 'center',
    height: 160,
    justifyContent: 'center',
    width: 240,
  },
  textLines: {
    gap: 8,
    justifyContent: 'center',
  },
  wordmark: {
    alignItems: 'center',
    gap: 4,
    marginTop: 24,
  },
});
