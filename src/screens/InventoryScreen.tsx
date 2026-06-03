import React, { useState, useCallback } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  RefreshControl,
  Alert,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useInventory } from '@hooks/useInventory';
import { InventoryItemCard } from '@components/inventory/InventoryItemCard';
import { AddItemSheet } from '@components/inventory/AddItemSheet';
import { BlinkitNudgeCard } from '@components/inventory/BlinkitNudgeCard';
import { ExpiryBadge } from '@components/inventory/ExpiryBadge';
import { DinText } from '@components/ui/DinText';
import { Colors, FontFamily, BorderRadius, Spacing } from '@constants/theme';
import type { InventoryItemRich } from '@hooks/useInventory';
import type { InventoryItem } from '@db/database';

const CATEGORY_ORDER = [
  'produce', 'meat', 'seafood', 'dairy',
  'beverages', 'grains', 'condiments', 'frozen', 'other',
];

type FilterTab = 'all' | 'expiring' | 'category';

interface InventoryScreenProps {
  coupleId: string;
  userId: string;
}

export function InventoryScreen({ coupleId, userId }: InventoryScreenProps) {
  const {
    items,
    byCategory,
    expiringSoon,
    expired,
    loading,
    refresh,
    addItem,
    markDepleted,
    deleteItem,
  } = useInventory(coupleId);

  const [filter, setFilter]         = useState<FilterTab>('all');
  const [addSheetOpen, setAddSheet] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItemRich | null>(null);

  const fabScale = useSharedValue(1);
  const fabStyle = useAnimatedStyle(() => ({ transform: [{ scale: fabScale.value }] }));

  async function handleRefresh() {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }

  function handleMarkDepleted(id: string) {
    markDepleted(id).catch((e) =>
      Alert.alert('Error', e instanceof Error ? e.message : 'Could not update item'),
    );
  }

  function handleDelete(id: string) {
    Alert.alert('Remove item', 'Delete this item from your inventory?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteItem(id) },
    ]);
  }

  // Items to display based on active filter
  const alertBanner = [...expired, ...expiringSoon];
  const displayItems: InventoryItemRich[] =
    filter === 'expiring' ? [...expired, ...expiringSoon] : items;

  // Sections: group by category (only for 'all' view)
  const sections =
    filter === 'all'
      ? CATEGORY_ORDER
          .filter((cat) => byCategory[cat]?.length)
          .map((cat) => ({ category: cat, items: byCategory[cat] }))
      : [{ category: 'expiring', items: displayItems }];

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={Colors.deepGreen}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <DinText variant="heading" style={styles.title}>Our Fridge</DinText>
            <DinText variant="caption" color={Colors.textSecondary}>
              {items.length} item{items.length !== 1 ? 's' : ''} · shared inventory
            </DinText>
          </View>
        </View>

        {/* Blinkit nudge card */}
        {alertBanner.length > 0 && (
          <BlinkitNudgeCard items={alertBanner} />
        )}

        {/* Filter tabs */}
        <View style={styles.filterRow}>
          <FilterChip label="All items" active={filter === 'all'} onPress={() => setFilter('all')} />
          <FilterChip
            label={`Expiring (${expiringSoon.length + expired.length})`}
            active={filter === 'expiring'}
            onPress={() => setFilter('expiring')}
            alert={expired.length > 0}
          />
        </View>

        {/* Empty state */}
        {items.length === 0 && !loading && (
          <View style={styles.emptyWrap}>
            <DinText style={styles.emptyEmoji}>🫙</DinText>
            <DinText variant="subheading" style={{ textAlign: 'center' }}>
              Your fridge is empty
            </DinText>
            <DinText variant="body" color={Colors.textSecondary} style={{ textAlign: 'center' }}>
              Scan your fridge with the camera or tap + to add items manually.
            </DinText>
          </View>
        )}

        {/* Item sections */}
        {sections.map(({ category, items: sectionItems }) => (
          <View key={category} style={styles.section}>
            <SectionHeader category={category} count={sectionItems.length} />
            {sectionItems.map((item) => (
              <InventoryItemCard
                key={item.id}
                item={item}
                onMarkDepleted={handleMarkDepleted}
                onDelete={handleDelete}
                onPress={setSelectedItem}
              />
            ))}
          </View>
        ))}

        {/* Swipe hint */}
        {items.length > 0 && (
          <DinText variant="caption" color={Colors.textMuted} style={styles.swipeHint}>
            ← Swipe left on an item to mark it as used up
          </DinText>
        )}
      </ScrollView>

      {/* FAB */}
      <Animated.View style={[styles.fabWrap, fabStyle]}>
        <TouchableOpacity
          style={styles.fab}
          onPress={() => setAddSheet(true)}
          activeOpacity={0.85}
        >
          <DinText style={styles.fabIcon}>+</DinText>
        </TouchableOpacity>
      </Animated.View>

      {/* Add item sheet */}
      <AddItemSheet
        visible={addSheetOpen}
        coupleId={coupleId}
        userId={userId}
        onAdd={addItem}
        onClose={() => setAddSheet(false)}
      />
    </SafeAreaView>
  );
}

// ─── Sub-components ──────────────────────────────────────────

function FilterChip({
  label, active, onPress, alert = false,
}: {
  label: string; active: boolean; onPress: () => void; alert?: boolean;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.filterChip, active && styles.filterChipActive]}
      activeOpacity={0.8}
    >
      <DinText
        style={[styles.filterChipLabel, active && styles.filterChipLabelActive]}
      >
        {label}
      </DinText>
      {alert && <View style={styles.alertDot} />}
    </TouchableOpacity>
  );
}

function SectionHeader({ category, count }: { category: string; count: number }) {
  const ICONS: Record<string, string> = {
    produce: '🥦', dairy: '🥛', meat: '🥩', seafood: '🐟',
    grains: '🌾', condiments: '🫙', beverages: '🧃', frozen: '❄️',
    other: '📦', expiring: '⚠️',
  };

  return (
    <View style={styles.sectionHeader}>
      <DinText style={styles.sectionIcon}>{ICONS[category] ?? '📦'}</DinText>
      <DinText variant="label">{category.charAt(0).toUpperCase() + category.slice(1)}</DinText>
      <View style={styles.sectionCount}>
        <DinText variant="caption" color={Colors.textMuted}>{count}</DinText>
      </View>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.paleGoldLight },
  scroll: { flex: 1 },
  content: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: 120,
    gap: Spacing.md,
  },
  header: {
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  title: { fontSize: 30, lineHeight: 38 },

  filterRow: {
    flexDirection: 'row',
    gap: 8,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.paleGoldMedium,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  filterChipActive: {
    borderColor: Colors.deepGreen,
    backgroundColor: Colors.paleGoldLight,
  },
  filterChipLabel: {
    fontFamily: FontFamily.sora,
    fontSize: 13,
    color: Colors.textSecondary,
  },
  filterChipLabelActive: {
    fontFamily: FontFamily.soraSemibold,
    color: Colors.deepGreen,
  },
  alertDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#C0392B',
  },

  section: { gap: 6 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 4,
  },
  sectionIcon: { fontSize: 16 },
  sectionCount: {
    marginLeft: 'auto',
    backgroundColor: Colors.paleGoldMedium,
    borderRadius: BorderRadius.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },

  emptyWrap: {
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.xxl,
  },
  emptyEmoji: { fontSize: 52 },

  swipeHint: {
    textAlign: 'center',
    marginTop: Spacing.sm,
  },

  fabWrap: {
    position: 'absolute',
    bottom: 36,
    right: 24,
  },
  fab: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.deepGreen,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.deepGreen,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.32,
    shadowRadius: 10,
    elevation: 7,
  },
  fabIcon: {
    fontSize: 30,
    color: Colors.paleGoldLight,
    lineHeight: 34,
  },
});
