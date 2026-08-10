import * as Haptics from 'expo-haptics';
import React, { useCallback, useRef } from 'react';
import { PanResponder, Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/src/components/ui/app-text';
import { useAppTheme } from '@/src/theme/theme-provider';

const ALPHABET = ['#', ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')];

interface AZFastScrollIndexProps {
  availableSections: Set<string>;
  onSelectLetter: (letter: string) => void;
}

export const AZFastScrollIndex = React.memo(function AZFastScrollIndex({
  availableSections,
  onSelectLetter,
}: AZFastScrollIndexProps) {
  const theme = useAppTheme();
  const containerRef = useRef<View>(null);
  const lastSelectedRef = useRef<string | null>(null);

  const handleTouchLetter = useCallback(
    (letter: string) => {
      if (lastSelectedRef.current !== letter) {
        lastSelectedRef.current = letter;
        void Haptics.selectionAsync().catch(() => undefined);
        onSelectLetter(letter);
      }
    },
    [onSelectLetter],
  );

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        const { locationY } = evt.nativeEvent;
        const letterIndex = Math.floor((locationY / 400) * ALPHABET.length);
        const letter = ALPHABET[Math.max(0, Math.min(ALPHABET.length - 1, letterIndex))];
        if (letter) handleTouchLetter(letter);
      },
      onPanResponderMove: (evt, gestureState) => {
        const letterIndex = Math.floor(((gestureState.moveY - 120) / 420) * ALPHABET.length);
        const letter = ALPHABET[Math.max(0, Math.min(ALPHABET.length - 1, letterIndex))];
        if (letter) handleTouchLetter(letter);
      },
      onPanResponderRelease: () => {
        lastSelectedRef.current = null;
      },
    }),
  ).current;

  return (
    <View
      ref={containerRef}
      {...panResponder.panHandlers}
      style={styles.container}
      accessibilityRole="text"
      accessibilityLabel="A to Z index scroll bar"
    >
      {ALPHABET.map((letter) => {
        const hasSection = availableSections.has(letter);
        return (
          <Pressable
            key={letter}
            onPress={() => handleTouchLetter(letter)}
            hitSlop={{ top: 2, bottom: 2, left: 6, right: 6 }}
            style={styles.letterBtn}
          >
            <AppText
              style={[
                styles.letterText,
                {
                  color: hasSection ? theme.colors.primary : theme.colors.textMuted + '60',
                  fontWeight: hasSection ? '700' : '400',
                },
              ]}
            >
              {letter}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'space-evenly',
    paddingVertical: 4,
    position: 'absolute',
    right: 2,
    top: 140,
    bottom: 20,
    width: 20,
    zIndex: 10,
  },
  letterBtn: {
    alignItems: 'center',
    height: 14,
    justifyContent: 'center',
    width: 16,
  },
  letterText: {
    fontSize: 9,
    lineHeight: 11,
    textAlign: 'center',
  },
});
