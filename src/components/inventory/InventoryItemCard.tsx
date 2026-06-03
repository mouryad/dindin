import React, { useCallback } from 'react';
import { View, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import { ExpiryBadge } from './ExpiryBadge';
import { DinText } from '@components/ui/DinText';
import { Colors, FontFamily, BorderRadius, Spacing } from '@constants/theme';
import type { InventoryItemRich } from '@hooks/useInventory';

const CATEGORY_ICONS: Record<string, string> = {
  produce:    '🥦',
  dairy:      '🥛',
  meat:       '🥩',
  seafood:    '🐟',
  grains:     '🌾',
  condiments: '🫙',
  beverages:  '🧃',
  frozen:     '❄️',
  other:      '📦',
};

const SWIPE_THRESHOLD = -80;   // px left to trigger "mark depleted"

interface InventoryItemCardProps {
  item: InventoryItemRich;
  onMarkDepleted: (id: string) => void;
  onDelete: (id: string) => void;
  onPress: (item: InventoryItemRich) => void;
}

export function InventoryItemCard({
  item, onMarkDepleted, onDelete, onPress,
}: InventoryItemCardProps) {
  const translateX = useSharedValue(0);
  const cardHeight = useSharedValue<number | undefined>(undefined);
  const cardOp     = useSharedValue(1);

  const triggerDepleted = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onMarkDepleted(item.id);
  }, [item.id, onMarkDepleted]);

  const pan = Gesture.Pan()
    .activeOffsetX([-8, 8])
    .onUpdate((e) => {
      // Only allow left-swipe
      translateX.value = Math.min(0, e.translationX);
    })
    .onEnd((e) => {
      if (e.translationX < SWIPE_THRESHOLD) {
        // Animate off screen then call depleted
        translateX.value = withTiming(-400, { duration: 260 }, () => {
          runOnJS(triggerDepleted)();
        });
      } else {
        translateX.value = withSpring(0, { damping: 18 });
      }
    });

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
    opacity: cardOp.value,
  }));

  // Reveal color on the swipe track proportional to swipe distance
  const trackStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, Math.abs(translateX.value) / Math.abs(SWIPE_THRESHOLD)),
  }));

  const icon = CATEGORY_ICONS[item.category ?? 'other'] ?? CATEGORY_ICONS.other;

  return (
    <View style={styles.root}>
      {/* Swipe reveal background */}
      <Animated.View style={[styles.swipeReveal, trackStyle]}>
        <DinText style={styles.swipeIcon}>✓</DinText>
        <DinText style={styles.swipeLabel}>Used up</DinText>
      </Animated.View>

      <GestureDetector gesture={pan}>
        <Animated.View
          style={[
            styles.card,
            item.expiryStatus === 'expired' && styles.cardExpired,
            item.expiryStatus === 'critical' && styles.cardCritical,
            cardStyle,
          ]}
        >
          <TouchableOpacity
            onPress={() => onPress(item)}
            activeOpacity={0.85}
            style={styles.inner}
          >
            {/* Icon */}
            <View style={styles.iconWrap}>
              <DinText style={styles.icon}>{icon}</DinText>
            </View>

            {/* Name + details */}
            <View style={styles.body}>
              <DinText style={styles.name} numberOfLines={1}>{item.name}</DinText>
              <DinText variant="caption" color={Colors.textMuted}>
                {[item.quantity && `${item.quantity}`, item.unit].filter(Boolean).join(' ')}
                {item.category ? ` · ${item.category}` : ''}
              </DinText>
            </View>

            {/* Expiry badge */}
            <ExpiryBadge
              status={item.expiryStatus}
              daysLeft={item.daysUntilExpiry}
              compact
            />
          </TouchableOpacity>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: BorderRadius.md,
  },
  swipeReveal: {
    position: 'absolute',
    inset: 0,
    backgroundColor: '#27AE60',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingRight: 20,
    gap: 6,
    borderRadius: BorderRadius.md,
  },
  swipeIcon: { fontSize: 20, color: '#fff' },
  swipeLabel: {
    fontFamily: FontFamily.soraSemibold,
    fontSize: 13,
    color: '#fff',
  },
  card: {
    backgroundColor: Colors.paleGoldMedium,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  cardExpired: {
    borderColor: '#C0392B',
    backgroundColor: '#FDECEA',
  },
  cardCritical: {
    borderColor: '#D35400',
    backgroundColor: '#FEF3E2',
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.paleGoldLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: { fontSize: 20 },
  body: { flex: 1, gap: 2 },
  name: {
    fontFamily: FontFamily.soraSemibold,
    fontSize: 15,
    color: Colors.deepGreen,
  },
});
