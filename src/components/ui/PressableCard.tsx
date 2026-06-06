import React from 'react';
import { TouchableOpacity, ViewStyle } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';

interface Props {
  onPress?: () => void;
  onLongPress?: () => void;
  style?: ViewStyle | ViewStyle[];
  children: React.ReactNode;
  hitSlop?: { top?: number; bottom?: number; left?: number; right?: number };
  disabled?: boolean;
  scaleTo?: number;
}

export function PressableCard({
  onPress, onLongPress, style, children, hitSlop, disabled, scaleTo = 0.98,
}: Props) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <TouchableOpacity
      onPress={onPress}
      onLongPress={onLongPress}
      onPressIn={() => { scale.value = withSpring(scaleTo, { damping: 20, stiffness: 300 }); }}
      onPressOut={() => { scale.value = withSpring(1, { damping: 20, stiffness: 260 }); }}
      activeOpacity={1}
      hitSlop={hitSlop}
      disabled={disabled}
    >
      <Animated.View style={[style, animStyle]}>
        {children}
      </Animated.View>
    </TouchableOpacity>
  );
}
