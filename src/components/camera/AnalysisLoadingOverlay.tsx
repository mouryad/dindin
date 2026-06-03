import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  withSequence,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import { DinText } from '@components/ui/DinText';
import { Colors, FontFamily } from '@constants/theme';
import type { CameraMode } from '@services/aiVision';

const MEAL_MESSAGES = [
  'Reading the dish…',
  'Counting every bite…',
  'Consulting the nutrition oracle…',
  'Weighing up the ingredients…',
];

const FRIDGE_MESSAGES = [
  'Peering into your fridge…',
  'Inventorying your provisions…',
  'Thinking up recipes…',
  'Cataloguing ingredients…',
];

const WASTE_MESSAGES = [
  'Measuring the leftovers…',
  'Counting the calories lost…',
  'Tracking your food story…',
  'Estimating today\'s waste…',
];

interface AnalysisLoadingOverlayProps {
  mode: CameraMode;
  visible: boolean;
}

export function AnalysisLoadingOverlay({ mode, visible }: AnalysisLoadingOverlayProps) {
  const [msgIndex, setMsgIndex] = React.useState(0);
  const opacity = useSharedValue(0);

  const messages = mode === 'meal' ? MEAL_MESSAGES : mode === 'fridge' ? FRIDGE_MESSAGES : WASTE_MESSAGES;

  useEffect(() => {
    if (!visible) return;
    const interval = setInterval(() => {
      setMsgIndex((i) => (i + 1) % messages.length);
    }, 2200);
    return () => clearInterval(interval);
  }, [visible, messages.length]);

  useEffect(() => {
    opacity.value = visible
      ? withTiming(1, { duration: 300 })
      : withTiming(0, { duration: 200 });
  }, [visible]);

  const containerStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  if (!visible) return null;

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.overlay, containerStyle]}>
      {/* Liquid bubble animation */}
      <View style={styles.bubbleWrap}>
        {[0, 1, 2].map((i) => (
          <FloatingBubble key={i} delay={i * 280} />
        ))}
      </View>
      <DinText style={styles.message}>{messages[msgIndex]}</DinText>
    </Animated.View>
  );
}

function FloatingBubble({ delay }: { delay: number }) {
  const y = useSharedValue(0);
  const scale = useSharedValue(0.6);
  const op = useSharedValue(0);

  useEffect(() => {
    y.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(-40, { duration: 900, easing: Easing.inOut(Easing.sin) }),
          withTiming(0, { duration: 900, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
      ),
    );
    scale.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1.15, { duration: 900 }),
          withTiming(0.6, { duration: 900 }),
        ),
        -1,
      ),
    );
    op.value = withDelay(delay, withTiming(1, { duration: 400 }));
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: y.value }, { scale: scale.value }],
    opacity: op.value,
  }));

  return <Animated.View style={[styles.bubble, style]} />;
}

const styles = StyleSheet.create({
  overlay: {
    backgroundColor: 'rgba(45,58,31,0.82)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 32,
    zIndex: 20,
  },
  bubbleWrap: {
    flexDirection: 'row',
    gap: 18,
    alignItems: 'center',
  },
  bubble: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#B8A678',
  },
  message: {
    fontFamily: FontFamily.frauncesItalic ?? FontFamily.fraunces,
    fontSize: 20,
    color: Colors.paleGoldLight,
    textAlign: 'center',
    paddingHorizontal: 32,
    lineHeight: 30,
  },
});
