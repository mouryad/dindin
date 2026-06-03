import React, { useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { DinText } from '@components/ui/DinText';
import { Colors, FontFamily, BorderRadius, Spacing } from '@constants/theme';
import type { InventoryItemRich } from '@hooks/useInventory';

interface BlinkitNudgeCardProps {
  items: InventoryItemRich[];     // expiring-soon or expired
}

// Blinkit deep link — searches for the first item name
const BLINKIT_SEARCH = (query: string) =>
  `https://blinkit.com/s/?q=${encodeURIComponent(query)}`;

export function BlinkitNudgeCard({ items }: BlinkitNudgeCardProps) {
  const scale     = useSharedValue(0.96);
  const glowOp    = useSharedValue(0.5);

  useEffect(() => {
    scale.value = withSpring(1, { damping: 14, stiffness: 160 });
    glowOp.value = withRepeat(
      withSequence(
        withTiming(0.8, { duration: 1400 }),
        withTiming(0.35, { duration: 1400 }),
      ),
      -1,
      true,
    );
  }, []);

  const cardStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const glowStyle = useAnimatedStyle(() => ({ opacity: glowOp.value }));

  if (items.length === 0) return null;

  const topItem = items[0];
  const rest    = items.slice(1, 4);
  const more    = Math.max(0, items.length - 4);

  async function openBlinkit() {
    const url = BLINKIT_SEARCH(topItem.name);
    const can = await Linking.canOpenURL(url);
    Linking.openURL(can ? url : 'https://blinkit.com');
  }

  return (
    <Animated.View style={[styles.card, cardStyle]}>
      {/* Subtle glow blob */}
      <Animated.View style={[styles.glow, glowStyle]} />

      <View style={styles.header}>
        <DinText style={styles.blinkitIcon}>🛒</DinText>
        <View style={{ flex: 1 }}>
          <DinText style={styles.title}>Order today on Blinkit</DinText>
          <DinText variant="caption" color={Colors.textSecondary}>
            {items.length} item{items.length !== 1 ? 's' : ''} running low
          </DinText>
        </View>
      </View>

      {/* Item list */}
      <View style={styles.itemList}>
        <ItemRow item={topItem} primary />
        {rest.map((item) => (
          <ItemRow key={item.id} item={item} />
        ))}
        {more > 0 && (
          <DinText variant="caption" color={Colors.textMuted} style={{ paddingLeft: 32 }}>
            + {more} more
          </DinText>
        )}
      </View>

      {/* CTA */}
      <TouchableOpacity onPress={openBlinkit} style={styles.ctaBtn} activeOpacity={0.85}>
        <DinText style={styles.ctaText}>Open Blinkit →</DinText>
      </TouchableOpacity>
    </Animated.View>
  );
}

function ItemRow({ item, primary }: { item: InventoryItemRich; primary?: boolean }) {
  const dotColor = item.expiryStatus === 'expired'  ? '#C0392B'
                 : item.expiryStatus === 'critical' ? '#D35400'
                 : Colors.gold;

  return (
    <View style={styles.itemRow}>
      <View style={[styles.itemDot, { backgroundColor: dotColor }]} />
      <DinText
        style={[styles.itemName, primary && styles.itemNamePrimary]}
        numberOfLines={1}
      >
        {item.name}
      </DinText>
      {item.daysUntilExpiry !== null && (
        <DinText variant="caption" color={Colors.textMuted}>
          {item.daysUntilExpiry <= 0 ? 'expired' : `${item.daysUntilExpiry}d`}
        </DinText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.deepGreen,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    gap: Spacing.md,
    overflow: 'hidden',
    position: 'relative',
  },
  glow: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: Colors.gold,
    top: -60,
    right: -40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
  },
  blinkitIcon: { fontSize: 26 },
  title: {
    fontFamily: FontFamily.frauncesBold,
    fontSize: 18,
    color: Colors.paleGoldLight,
    lineHeight: 24,
  },
  itemList: { gap: 6 },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  itemDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  itemName: {
    flex: 1,
    fontFamily: FontFamily.sora,
    fontSize: 14,
    color: 'rgba(244,241,232,0.8)',
  },
  itemNamePrimary: {
    fontFamily: FontFamily.soraSemibold,
    color: Colors.paleGoldLight,
    fontSize: 15,
  },
  ctaBtn: {
    backgroundColor: Colors.gold,
    borderRadius: BorderRadius.full,
    paddingVertical: 12,
    alignItems: 'center',
  },
  ctaText: {
    fontFamily: FontFamily.soraSemibold,
    fontSize: 15,
    color: Colors.deepGreen,
  },
});
