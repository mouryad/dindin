import React, { useEffect } from 'react';
import { TouchableOpacity, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withRepeat,
  withTiming,
  cancelAnimation,
  Easing,
} from 'react-native-reanimated';
import type { CaptureState } from '@hooks/useCamera';

interface ShutterButtonProps {
  captureState: CaptureState;
  onPress: () => void;
}

export function ShutterButton({ captureState, onPress }: ShutterButtonProps) {
  const scale = useSharedValue(1);
  const pulseOpacity = useSharedValue(0);

  const isActive = captureState === 'capturing' || captureState === 'analyzing';

  useEffect(() => {
    if (isActive) {
      pulseOpacity.value = withRepeat(
        withTiming(0.6, { duration: 700, easing: Easing.inOut(Easing.ease) }),
        -1,
        true,
      );
    } else {
      cancelAnimation(pulseOpacity);
      pulseOpacity.value = withTiming(0, { duration: 200 });
    }
  }, [isActive]);

  const pulseStyle = useAnimatedStyle(() => ({
    opacity: pulseOpacity.value,
    transform: [{ scale: withSpring(isActive ? 1.25 : 1) }],
  }));

  const innerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  function handlePress() {
    if (isActive) return;
    scale.value = withSpring(0.85, { damping: 10, stiffness: 400 }, () => {
      scale.value = withSpring(1, { damping: 12 });
    });
    onPress();
  }

  return (
    <TouchableOpacity onPress={handlePress} activeOpacity={1} style={styles.touch}>
      {/* Pulse ring */}
      <Animated.View style={[styles.pulse, pulseStyle]} />
      {/* Outer ring */}
      <View style={styles.outerRing}>
        {/* Inner circle */}
        <Animated.View style={[styles.inner, innerStyle, isActive && styles.innerActive]} />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  touch: {
    width: 84,
    height: 84,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulse: {
    position: 'absolute',
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: 'rgba(244,241,232,0.3)',
  },
  outerRing: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 4,
    borderColor: 'rgba(244,241,232,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inner: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: 'rgba(244,241,232,0.95)',
  },
  innerActive: {
    backgroundColor: '#B8A678',
  },
});
