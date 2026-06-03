import React from 'react';
import { View, StyleSheet } from 'react-native';
import { DinText } from '@components/ui/DinText';
import { Colors, FontFamily, BorderRadius } from '@constants/theme';
import type { ExpiryStatus } from '@hooks/useInventory';

const CONFIG: Record<ExpiryStatus, { bg: string; text: string; label: (d: number | null) => string }> = {
  expired:  { bg: '#FDECEA', text: '#C0392B', label: () => 'Expired' },
  critical: { bg: '#FEF3E2', text: '#D35400', label: (d) => d === 0 ? 'Today' : `${d}d left` },
  soon:     { bg: '#FFFDE7', text: '#B7950B', label: (d) => `${d}d left` },
  ok:       { bg: 'transparent', text: Colors.textMuted, label: (d) => `${d}d` },
  unknown:  { bg: 'transparent', text: Colors.textMuted, label: () => '—' },
};

interface ExpiryBadgeProps {
  status: ExpiryStatus;
  daysLeft: number | null;
  compact?: boolean;
}

export function ExpiryBadge({ status, daysLeft, compact = false }: ExpiryBadgeProps) {
  const cfg = CONFIG[status];
  const label = cfg.label(daysLeft);

  if (compact) {
    return (
      <View style={[styles.pill, { backgroundColor: cfg.bg }]}>
        <DinText style={[styles.pillText, { color: cfg.text }]}>{label}</DinText>
      </View>
    );
  }

  return (
    <View style={[styles.badge, { backgroundColor: cfg.bg }]}>
      <View style={[styles.dot, { backgroundColor: cfg.text }]} />
      <DinText style={[styles.badgeText, { color: cfg.text }]}>{label}</DinText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  badgeText: {
    fontFamily: FontFamily.soraSemibold,
    fontSize: 12,
  },
  pill: {
    borderRadius: BorderRadius.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  pillText: {
    fontFamily: FontFamily.soraSemibold,
    fontSize: 11,
  },
});
