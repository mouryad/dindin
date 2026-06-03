import React, { useEffect } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { DinText } from '@components/ui/DinText';
import { Colors, Spacing } from '@constants/theme';

const { width } = Dimensions.get('window');

interface OnboardingStepProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  visible: boolean;
}

export function OnboardingStep({ title, subtitle, children, visible }: OnboardingStepProps) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(20);

  useEffect(() => {
    if (visible) {
      opacity.value = withTiming(1, { duration: 380, easing: Easing.out(Easing.quad) });
      translateY.value = withSpring(0, { damping: 18, stiffness: 120 });
    } else {
      opacity.value = withTiming(0, { duration: 200 });
      translateY.value = withTiming(-10, { duration: 200 });
    }
  }, [visible]);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View style={[styles.container, animStyle]}>
      <View style={styles.header}>
        <DinText variant="heading" style={styles.title}>{title}</DinText>
        {subtitle ? (
          <DinText variant="body" color={Colors.textSecondary} style={styles.subtitle}>
            {subtitle}
          </DinText>
        ) : null}
      </View>
      <View style={styles.content}>{children}</View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width,
    paddingHorizontal: Spacing.lg,
  },
  header: {
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.lg,
    gap: Spacing.sm,
  },
  title: {
    fontSize: 30,
    lineHeight: 38,
  },
  subtitle: {
    lineHeight: 24,
  },
  content: {
    flex: 1,
    gap: Spacing.md,
  },
});
