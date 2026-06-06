import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  ScrollView,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  RefreshControl,
  Alert,
  Linking,
  Modal,
} from 'react-native';
import Animated, {
  FadeInDown, useSharedValue, useAnimatedStyle,
  withSpring, withSequence, withRepeat, withTiming,
} from 'react-native-reanimated';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { format, addDays } from 'date-fns';
import { supabase } from '@lib/supabase';
import { useAuth } from '@context/AuthContext';
import { useCouple } from '@hooks/useCouple';
import { DinText } from '@components/ui/DinText';
import { Colors, FontFamily, BorderRadius, Spacing } from '@constants/theme';
import type { InventoryItem, StockLevel } from '@db/database';
import type { MealPlan } from '@services/mealPlanner';
import type { FridgeScanResult } from '@services/aiVision';
import { notifyMealPlanCacheUpdated } from '@hooks/useMealPlan';
import { CameraScreen } from '@screens/CameraScreen';
import { FridgeConfirmScreen } from '@screens/FridgeConfirmScreen';

// ─── Guess category from ingredient name ─────────────────────

function guessCategory(name: string): string {
  const n = name.toLowerCase();
  const fresh = ['tomato', 'onion', 'garlic', 'ginger', 'lemon', 'lime', 'chili', 'chilli',
    'pepper', 'capsicum', 'spinach', 'coriander', 'cilantro', 'potato', 'carrot', 'cucumber',
    'lettuce', 'herb', 'vegetable', 'fruit', 'berry', 'apple', 'banana', 'mango', 'orange',
    'mushroom', 'broccoli', 'cauliflower', 'cabbage', 'peas', 'beans', 'mint', 'basil',
    'leaves', 'spring onion', 'avocado', 'zucchini', 'eggplant', 'aubergine', 'celery',
    'radish', 'beetroot', 'pumpkin', 'gourd', 'drumstick', 'fenugreek', 'methi', 'palak'];
  const grains = ['rice', 'dal', 'lentil', 'flour', 'atta', 'maida', 'pasta', 'bread',
    'noodle', 'quinoa', 'oat', 'wheat', 'barley', 'semolina', 'suji', 'poha', 'millet', 'ragi'];
  const dairy = ['milk', 'cheese', 'paneer', 'curd', 'yogurt', 'cream', 'butter', 'ghee', 'dahi'];
  const cond = ['oil', 'salt', 'sugar', 'masala', 'cumin', 'turmeric', 'cardamom', 'cinnamon',
    'clove', 'mustard', 'sauce', 'vinegar', 'soy', 'paste', 'coconut', 'tamarind', 'honey',
    'pepper powder', 'chili powder', 'garam masala', 'jeera', 'hing', 'asafoetida'];

  if (fresh.some((k) => n.includes(k)))  return 'produce';
  if (dairy.some((k) => n.includes(k)))  return 'dairy';
  if (grains.some((k) => n.includes(k))) return 'grains';
  if (cond.some((k) => n.includes(k)))   return 'condiments';
  return 'produce'; // default to fresh for unknowns
}

// ─── Category mapping ────────────────────────────────────────

const FRESH_CATS   = new Set(['produce']);
const RATION_CATS  = new Set(['grains', 'dairy', 'condiments', 'beverages', 'meat', 'seafood', 'frozen', 'other']);

function tabFor(cat: string | null): 'fresh' | 'ration' {
  return FRESH_CATS.has(cat ?? '') ? 'fresh' : 'ration';
}

// ─── Stock level config ──────────────────────────────────────

const STOCK_CONFIG: Record<StockLevel, { color: string; bg: string; label: string; dot: string }> = {
  abundant: { color: Colors.deepGreen,   bg: '#E8F5EE', label: 'In stock',      dot: '🟢' },
  low:      { color: '#C07C00',          bg: '#FFF8E1', label: 'Running low',   dot: '🟡' },
  out:      { color: Colors.error,       bg: '#FDECEA', label: 'Out of stock',  dot: '🔴' },
};

const NEXT_LEVEL: Record<StockLevel, StockLevel> = {
  abundant: 'low',
  low: 'out',
  out: 'abundant',
};

// ─── Main screen ─────────────────────────────────────────────

export function GroceryScreen() {
  const { user } = useAuth();
  const { couple } = useCouple();

  const [items,           setItems]           = useState<InventoryItem[]>([]);
  const [loading,         setLoading]         = useState(false);
  const [refreshing,      setRefreshing]       = useState(false);
  const [activeTab,       setActiveTab]        = useState<'fresh' | 'ration'>('fresh');
  const [addSheetOpen,    setAddSheetOpen]     = useState(false);
  const [fridgeCamera,    setFridgeCamera]     = useState(false);
  const [fridgeScanData,  setFridgeScanData]   = useState<{ uri: string; result: FridgeScanResult } | null>(null);

  const fetchItems = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q = (supabase as any)
      .from('inventory_items')
      .select('*')
      .eq('is_depleted', false)
      .order('name');
    q = couple?.id
      ? q.eq('couple_id', couple.id)
      : q.is('couple_id', null).eq('added_by_user_id', user.id);
    const { data } = await q as { data: InventoryItem[] | null };
    const fetched = data ?? [];
    setItems(fetched);
    setLoading(false);
    // After loading inventory, sync missing meal-plan ingredients
    await syncMealPlan(fetched);
  }, [user?.id, couple?.id]); // syncMealPlan is defined below and stable

  // Reads today's cached meal plan and adds missing ingredients as 'out'
  // if they don't already exist in inventory
  async function syncMealPlan(existingItems: InventoryItem[]) {
    if (!user?.id) return;
    const today = format(new Date(), 'yyyy-MM-dd');

    // Try every possible cuisine cache key for today
    const keys = await AsyncStorage.getAllKeys();
    const planKeys = keys.filter(
      (k) => k.startsWith(`meal_plan_${user.id}_${today}`),
    );

    // Collect all missing ingredients across all cached plans for today
    const allMissing = new Map<string, string>(); // name → category
    for (const key of planKeys) {
      try {
        const raw = await AsyncStorage.getItem(key);
        if (!raw) continue;
        const plan = JSON.parse(raw) as MealPlan;
        plan.days.forEach((day) => {
          day.meals.forEach((meal) => {
            meal.missing.forEach((ing) => {
              const name = ing.trim();
              if (name) allMissing.set(name.toLowerCase(), name);
            });
          });
        });
      } catch { /* skip corrupt cache */ }
    }

    if (allMissing.size === 0) return;

    // Filter out ones already in inventory
    const existingNames = new Set(existingItems.map((i) => i.name.toLowerCase()));
    const toAdd = [...allMissing.values()].filter(
      (name) => !existingNames.has(name.toLowerCase()),
    );
    if (toAdd.length === 0) return;

    const inserts = toAdd.map((name) => ({
      couple_id:        couple?.id ?? null,
      added_by_user_id: user.id,
      name,
      category:         guessCategory(name),
      stock_level:      'out' as StockLevel,
      purchase_date:    today,
      expiry_date:      format(addDays(new Date(), 7), 'yyyy-MM-dd'),
      is_depleted:      false,
      notes:            'From meal plan',
    }));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase as any)
      .from('inventory_items')
      .insert(inserts)
      .select();

    if (data) {
      setItems((prev) => {
        const newNames = new Set((data as InventoryItem[]).map((i) => i.name.toLowerCase()));
        const deduped  = prev.filter((i) => !newNames.has(i.name.toLowerCase()));
        return [...deduped, ...(data as InventoryItem[])];
      });
    }
  }

  useEffect(() => { fetchItems(); }, [fetchItems]);

  async function handleRefresh() {
    setRefreshing(true);
    await fetchItems();
    setRefreshing(false);
  }

  async function cycleStockLevel(item: InventoryItem) {
    const currentLevel = item.stock_level ?? 'abundant';
    const next = NEXT_LEVEL[currentLevel];
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setItems((prev) => prev.map((i) => i.id === item.id ? { ...i, stock_level: next } : i));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any).from('inventory_items').update({ stock_level: next }).eq('id', item.id);
    // Keep meal plan have/missing lists in sync
    await syncStockToMealPlan(item.name, next);
  }

  // When stock level changes, update all cached meal plans for today so the
  // have ↔ missing lists stay accurate (Home tab reads fresh cache on re-mount)
  async function syncStockToMealPlan(ingredientName: string, newLevel: StockLevel) {
    if (!user?.id) return;
    const today    = format(new Date(), 'yyyy-MM-dd');
    const allKeys  = await AsyncStorage.getAllKeys();
    const planKeys = allKeys.filter((k) => k.startsWith(`meal_plan_${user.id}_${today}`));

    for (const key of planKeys) {
      try {
        const raw = await AsyncStorage.getItem(key);
        if (!raw) continue;
        const plan = JSON.parse(raw) as MealPlan;
        const nameLow = ingredientName.toLowerCase();

        const updatedDays = plan.days.map((day) => ({
          ...day,
          meals: day.meals.map((meal) => {
            if (newLevel === 'abundant' || newLevel === 'low') {
              // Item is now available — move from missing → have
              if (!meal.missing.some((m) => m.toLowerCase() === nameLow)) return meal;
              return {
                ...meal,
                missing: meal.missing.filter((m) => m.toLowerCase() !== nameLow),
                have:    meal.have.some((h) => h.toLowerCase() === nameLow)
                           ? meal.have
                           : [...meal.have, ingredientName],
              };
            } else {
              // Item is now out — move from have → missing
              if (!meal.have.some((h) => h.toLowerCase() === nameLow)) return meal;
              return {
                ...meal,
                have:    meal.have.filter((h) => h.toLowerCase() !== nameLow),
                missing: meal.missing.some((m) => m.toLowerCase() === nameLow)
                           ? meal.missing
                           : [...meal.missing, ingredientName],
              };
            }
          }),
        }));

        await AsyncStorage.setItem(key, JSON.stringify({ ...plan, days: updatedDays }));
      } catch { /* skip corrupt cache entry */ }
    }
    // Tell useMealPlan (on HomeScreen) to re-read from the updated cache
    notifyMealPlanCacheUpdated();
  }

  async function deleteItem(id: string) {
    Alert.alert('Remove item', 'Remove from your pantry?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          setItems((prev) => prev.filter((i) => i.id !== id));
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase as any).from('inventory_items').update({ is_depleted: true }).eq('id', id);
        },
      },
    ]);
  }

  async function addItem(name: string, category: string) {
    if (!user?.id || !name.trim()) return;
    const insert = {
      couple_id: couple?.id ?? null,
      added_by_user_id: user.id,
      name: name.trim(),
      category,
      stock_level: 'abundant' as StockLevel,
      purchase_date: format(new Date(), 'yyyy-MM-dd'),
      expiry_date: format(addDays(new Date(), category === 'produce' ? 5 : 90), 'yyyy-MM-dd'),
      is_depleted: false,
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).from('inventory_items').insert(insert).select().single();
    if (!error && data) setItems((prev) => [...prev, data as InventoryItem]);
    setAddSheetOpen(false);
  }

  function sendWhatsApp(tab: 'fresh' | 'ration') {
    const tabItems = items.filter((i) => tabFor(i.category) === tab);
    const needItems = tabItems.filter((i) => (i.stock_level ?? 'abundant') !== 'abundant');
    if (needItems.length === 0) {
      Alert.alert('All stocked!', 'Nothing to order right now.');
      return;
    }

    const tabLabel   = tab === 'fresh' ? '🥦 Vegetables & Fruits' : '🌾 Ration & Pantry';
    const outItems   = needItems.filter((i) => i.stock_level === 'out');
    const lowItems   = needItems.filter((i) => i.stock_level === 'low');

    const lines: string[] = [`${tabLabel} — Shopping List`, ''];
    if (outItems.length) {
      lines.push('*🔴 Urgently needed:*');
      outItems.forEach((i) => lines.push(`• ${i.name}`));
      lines.push('');
    }
    if (lowItems.length) {
      lines.push('*🟡 Running low:*');
      lowItems.forEach((i) => lines.push(`• ${i.name}`));
      lines.push('');
    }
    lines.push('Please arrange for the next 2–3 days. Thank you! 🙏');
    lines.push('_Sent via Dindin_');

    const url = `https://wa.me/?text=${encodeURIComponent(lines.join('\n'))}`;
    Linking.openURL(url).catch(() => Alert.alert('WhatsApp not found', 'Install WhatsApp to send shopping lists.'));
  }

  const tabItems   = items.filter((i) => tabFor(i.category) === activeTab);
  const outItems   = tabItems.filter((i) => (i.stock_level ?? 'abundant') === 'out');
  const lowItems   = tabItems.filter((i) => (i.stock_level ?? 'abundant') === 'low');
  const goodItems  = tabItems.filter((i) => (i.stock_level ?? 'abundant') === 'abundant');
  const needCount  = outItems.length + lowItems.length;
  const allNeedCount = items.filter((i) => (i.stock_level ?? 'abundant') !== 'abundant').length;

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <DinText variant="heading" style={styles.title}>Pantry & Stock</DinText>
          <DinText variant="caption" color={Colors.textSecondary}>
            {allNeedCount > 0
              ? `${allNeedCount} item${allNeedCount > 1 ? 's' : ''} to source`
              : 'All stocked up ✓'}
          </DinText>
        </View>
        <View style={styles.headerBtns}>
          <TouchableOpacity onPress={() => setFridgeCamera(true)} style={styles.scanBtn}>
            <DinText style={styles.scanBtnLabel}>📷</DinText>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setAddSheetOpen(true)} style={styles.addBtn}>
            <DinText style={styles.addBtnLabel}>+ Add</DinText>
          </TouchableOpacity>
        </View>
      </View>

      {/* Category tabs */}
      <View style={styles.tabs}>
        <TabPill label="🥦 Fresh" active={activeTab === 'fresh'} onPress={() => setActiveTab('fresh')}
          badge={items.filter((i) => tabFor(i.category) === 'fresh' && (i.stock_level ?? 'abundant') !== 'abundant').length} />
        <TabPill label="🌾 Ration" active={activeTab === 'ration'} onPress={() => setActiveTab('ration')}
          badge={items.filter((i) => tabFor(i.category) === 'ration' && (i.stock_level ?? 'abundant') !== 'abundant').length} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={Colors.deepGreen} />}
      >
        {/* Skeleton while loading */}
        {loading && items.length === 0 && <SkeletonChips />}

        {/* Out of stock */}
        {outItems.length > 0 && (
          <StockSection level="out"      items={outItems}  onCycle={cycleStockLevel} onDelete={deleteItem} />
        )}
        {/* Low */}
        {lowItems.length > 0 && (
          <StockSection level="low"      items={lowItems}  onCycle={cycleStockLevel} onDelete={deleteItem} />
        )}
        {/* Abundant */}
        {goodItems.length > 0 && (
          <StockSection level="abundant" items={goodItems} onCycle={cycleStockLevel} onDelete={deleteItem} />
        )}

        {tabItems.length === 0 && (
          <View style={styles.emptyState}>
            <DinText style={styles.emptyEmoji}>{activeTab === 'fresh' ? '🥦' : '🌾'}</DinText>
            <DinText variant="body" style={{ textAlign: 'center' }}>
              No items yet. Add produce from your fridge scan or tap + Add.
            </DinText>
          </View>
        )}

        {/* Hint */}
        <DinText variant="caption" color={Colors.textMuted} style={styles.tapHint}>
          Tap any item to cycle stock level · Long press to remove
        </DinText>
      </ScrollView>

      {/* Bottom: send WhatsApp */}
      {needCount > 0 && (
        <View style={styles.footer}>
          <TouchableOpacity style={styles.whatsappBtn} onPress={() => sendWhatsApp(activeTab)} activeOpacity={0.85}>
            <DinText style={styles.whatsappBtnText}>
              {`📲  Send ${activeTab === 'fresh' ? 'fresh list' : 'ration list'} via WhatsApp`}
            </DinText>
          </TouchableOpacity>
        </View>
      )}

      {/* Fridge camera modal */}
      {fridgeCamera && (
        <Modal visible animationType="slide" statusBarTranslucent onRequestClose={() => setFridgeCamera(false)}>
          <CameraScreen
            initialMode="fridge"
            showModeSwitcher={false}
            onFridgeCaptured={(uri, result) => { setFridgeCamera(false); setFridgeScanData({ uri, result }); }}
            onClose={() => setFridgeCamera(false)}
          />
        </Modal>
      )}

      {/* Fridge confirm */}
      {fridgeScanData && (
        <Modal visible animationType="slide">
          <FridgeConfirmScreen
            imageUri={fridgeScanData.uri}
            result={fridgeScanData.result}
            coupleId={couple?.id ?? null}
            onSaved={(count) => {
              setFridgeScanData(null);
              fetchItems();
              Alert.alert('Pantry updated', `${count} item${count !== 1 ? 's' : ''} added.`);
            }}
            onCancel={() => setFridgeScanData(null)}
          />
        </Modal>
      )}

      {/* Add item sheet */}
      {addSheetOpen && (
        <AddItemSheet
          defaultTab={activeTab}
          onAdd={addItem}
          onClose={() => setAddSheetOpen(false)}
        />
      )}
    </SafeAreaView>
  );
}

// ─── Stock section ────────────────────────────────────────────

function StockSection({
  level, items, onCycle, onDelete,
}: {
  level: StockLevel;
  items: InventoryItem[];
  onCycle: (item: InventoryItem) => void;
  onDelete: (id: string) => void;
}) {
  const cfg = STOCK_CONFIG[level];
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <DinText style={[styles.sectionTitle, { color: cfg.color }]}>
          {cfg.dot}  {cfg.label}
        </DinText>
        <DinText variant="caption" color={Colors.textMuted}>{items.length}</DinText>
      </View>
      <View style={styles.chipGrid}>
        {items.map((item, i) => {
          const fromPlan = item.notes === 'From meal plan';
          return (
            <Animated.View key={item.id} entering={FadeInDown.delay(i * 30).springify()}>
              <TouchableOpacity
                style={[styles.itemChip, { backgroundColor: cfg.bg, borderColor: cfg.color + '40' }]}
                onPress={() => onCycle(item)}
                onLongPress={() => onDelete(item.id)}
                activeOpacity={0.8}
              >
                <View style={[styles.itemDot, { backgroundColor: cfg.color }]} />
                <DinText style={[styles.itemName, { color: cfg.color }]} numberOfLines={1}>
                  {item.name}
                </DinText>
                {fromPlan && (
                  <View style={styles.mealPlanBadge}>
                    <DinText style={styles.mealPlanBadgeText}>🍽</DinText>
                  </View>
                )}
              </TouchableOpacity>
            </Animated.View>
          );
        })}
      </View>
    </View>
  );
}

// ─── Tab pill ─────────────────────────────────────────────────

function TabPill({ label, active, onPress, badge }: {
  label: string; active: boolean; onPress: () => void; badge: number;
}) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  function handlePress() {
    scale.value = withSequence(
      withSpring(0.95, { damping: 20, stiffness: 280 }),
      withSpring(1.0,  { damping: 22, stiffness: 220 }),
    );
    onPress();
  }

  return (
    <TouchableOpacity onPress={handlePress} activeOpacity={1}>
      <Animated.View style={[styles.tabPill, active && styles.tabPillActive, animStyle]}>
        <DinText style={[styles.tabLabel, active && styles.tabLabelActive]}>{label}</DinText>
        {badge > 0 && (
          <View style={[styles.badge, active ? styles.badgeActive : styles.badgeInactive]}>
            <DinText style={[styles.badgeText, active && styles.badgeTextActive]}>{badge}</DinText>
          </View>
        )}
      </Animated.View>
    </TouchableOpacity>
  );
}

// ─── Skeleton loading ────────────────────────────────────────

function SkeletonChips() {
  const opacity = useSharedValue(0.4);
  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(withTiming(1, { duration: 700 }), withTiming(0.4, { duration: 700 })),
      -1, true,
    );
  }, []);
  const pulse = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return (
    <View style={{ gap: 20 }}>
      {[5, 4, 6].map((count, si) => (
        <View key={si} style={{ gap: 10 }}>
          <Animated.View style={[{ height: 11, width: 90, borderRadius: 6, backgroundColor: Colors.paleGoldMedium }, pulse]} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {Array.from({ length: count }).map((_, i) => (
              <Animated.View key={i} style={[{
                height: 44, width: 80 + (i % 3) * 22,
                borderRadius: 22, backgroundColor: Colors.paleGoldMedium,
              }, pulse]} />
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

// ─── Add item sheet ───────────────────────────────────────────

function AddItemSheet({
  defaultTab, onAdd, onClose,
}: {
  defaultTab: 'fresh' | 'ration';
  onAdd: (name: string, category: string) => void;
  onClose: () => void;
}) {
  const [name, setName]       = useState('');
  const [tab,  setTab]        = useState(defaultTab);
  const [saving, setSaving]   = useState(false);

  const freshCategories  = [
    { value: 'produce',  label: '🥦 Vegetables & Fruits' },
  ];
  const rationCategories = [
    { value: 'grains',     label: '🌾 Grains & Pulses' },
    { value: 'dairy',      label: '🥛 Dairy' },
    { value: 'condiments', label: '🫙 Spices & Condiments' },
    { value: 'beverages',  label: '🧃 Beverages' },
    { value: 'meat',       label: '🥩 Meat & Poultry' },
    { value: 'seafood',    label: '🐟 Seafood' },
    { value: 'other',      label: '📦 Other' },
  ];

  const [category, setCategory] = useState(defaultTab === 'fresh' ? 'produce' : 'grains');
  const categories = tab === 'fresh' ? freshCategories : rationCategories;

  async function handleAdd() {
    if (!name.trim()) return;
    setSaving(true);
    await onAdd(name.trim(), category);
    setSaving(false);
  }

  return (
    <>
      <TouchableOpacity style={styles.backdrop} onPress={onClose} activeOpacity={1} />
      <View style={styles.sheet}>
        <View style={styles.sheetHandle} />
        <DinText variant="subheading" style={styles.sheetTitle}>Add to pantry</DinText>

        {/* Tab toggle */}
        <View style={styles.sheetTabs}>
          <TouchableOpacity
            onPress={() => { setTab('fresh'); setCategory('produce'); }}
            style={[styles.sheetTab, tab === 'fresh' && styles.sheetTabActive]}
          >
            <DinText style={[styles.sheetTabLabel, tab === 'fresh' && styles.sheetTabLabelActive]}>
              🥦 Fresh
            </DinText>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => { setTab('ration'); setCategory('grains'); }}
            style={[styles.sheetTab, tab === 'ration' && styles.sheetTabActive]}
          >
            <DinText style={[styles.sheetTabLabel, tab === 'ration' && styles.sheetTabLabelActive]}>
              🌾 Ration
            </DinText>
          </TouchableOpacity>
        </View>

        {/* Item name */}
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Item name (e.g. Tomatoes)"
          placeholderTextColor={Colors.textMuted}
          style={styles.sheetInput}
          autoFocus
          returnKeyType="done"
          onSubmitEditing={handleAdd}
        />

        {/* Category chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: Spacing.md }}>
          <View style={{ flexDirection: 'row', gap: 8, paddingVertical: 4 }}>
            {categories.map((c) => (
              <TouchableOpacity
                key={c.value}
                onPress={() => setCategory(c.value)}
                style={[styles.catChip, category === c.value && styles.catChipActive]}
              >
                <DinText style={[styles.catChipLabel, category === c.value && styles.catChipLabelActive]}>
                  {c.label}
                </DinText>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        <TouchableOpacity
          onPress={handleAdd}
          disabled={!name.trim() || saving}
          style={[styles.sheetSaveBtn, (!name.trim() || saving) && { opacity: 0.5 }]}
        >
          <DinText style={styles.sheetSaveBtnLabel}>Add to pantry</DinText>
        </TouchableOpacity>
      </View>
    </>
  );
}

// ─── Styles ──────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe:  { flex: 1, backgroundColor: Colors.paleGoldLight },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
    paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg, paddingBottom: Spacing.sm,
  },
  title: { fontSize: 26, lineHeight: 32 },
  headerBtns: { flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 4 },
  scanBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: Colors.paleGoldMedium,
    alignItems: 'center', justifyContent: 'center',
  },
  scanBtnLabel: { fontSize: 18 },
  addBtn: {
    backgroundColor: Colors.deepGreen, borderRadius: BorderRadius.full,
    paddingHorizontal: 16, paddingVertical: 8,
  },
  addBtnLabel: { fontFamily: FontFamily.soraSemibold, fontSize: 13, color: Colors.paleGoldLight },

  // Tabs
  tabs: { flexDirection: 'row', gap: 10, paddingHorizontal: Spacing.lg, marginBottom: Spacing.sm },
  tabPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 20, paddingVertical: 11, borderRadius: BorderRadius.full,
    backgroundColor: Colors.paleGoldMedium,
  },
  tabPillActive: { backgroundColor: Colors.deepGreen },
  tabLabel: { fontFamily: FontFamily.soraSemibold, fontSize: 13, color: Colors.textSecondary },
  tabLabelActive: { color: Colors.paleGoldLight },
  badge: { borderRadius: 10, minWidth: 20, height: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  badgeActive: { backgroundColor: Colors.gold },
  badgeInactive: { backgroundColor: Colors.textMuted },
  badgeText: { fontFamily: FontFamily.soraSemibold, fontSize: 11, color: Colors.deepGreen },
  badgeTextActive: { color: Colors.deepGreen },

  scroll: { flex: 1 },
  content: { paddingHorizontal: Spacing.lg, paddingBottom: 120, gap: Spacing.md },

  // Stock sections
  section: { gap: 10 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { fontFamily: FontFamily.soraSemibold, fontSize: 11, letterSpacing: 1.0, textTransform: 'uppercase' },

  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  itemChip: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 14, paddingVertical: 11, borderRadius: BorderRadius.full,
    borderWidth: 1.5, maxWidth: 200,
  },
  itemDot: { width: 10, height: 10, borderRadius: 5 },
  itemName: { fontFamily: FontFamily.soraSemibold, fontSize: 13, flexShrink: 1 },
  mealPlanBadge: { marginLeft: 2 },
  mealPlanBadgeText: { fontSize: 11 },

  tapHint: { textAlign: 'center', marginTop: Spacing.sm },
  emptyState: { alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.xl },
  emptyEmoji: { fontSize: 48 },

  // Footer
  footer: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xl, paddingTop: Spacing.sm },
  whatsappBtn: {
    backgroundColor: '#25D366', borderRadius: BorderRadius.full,
    paddingVertical: 14, alignItems: 'center',
  },
  whatsappBtnText: { fontFamily: FontFamily.soraSemibold, fontSize: 15, color: '#fff' },

  // Add sheet
  backdrop: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(45,58,31,0.4)', zIndex: 10,
  },
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: Colors.paleGoldLight, borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: Spacing.lg, paddingBottom: 52, zIndex: 11,
  },
  sheetHandle: {
    width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.paleGoldMedium,
    alignSelf: 'center', marginTop: 12, marginBottom: 8,
  },
  sheetTitle: { textAlign: 'center', marginBottom: Spacing.md },
  sheetTabs: {
    flexDirection: 'row', backgroundColor: Colors.paleGoldMedium,
    borderRadius: BorderRadius.full, padding: 4, gap: 4, marginBottom: Spacing.md,
  },
  sheetTab: { flex: 1, paddingVertical: 9, borderRadius: BorderRadius.full, alignItems: 'center' },
  sheetTabActive: { backgroundColor: Colors.deepGreen },
  sheetTabLabel: { fontFamily: FontFamily.soraSemibold, fontSize: 13, color: Colors.textSecondary },
  sheetTabLabelActive: { color: Colors.paleGoldLight },
  sheetInput: {
    backgroundColor: Colors.paleGoldMedium, borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md, paddingVertical: 14,
    fontFamily: FontFamily.sora, fontSize: 15, color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  catChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: BorderRadius.full,
    backgroundColor: Colors.paleGoldMedium, borderWidth: 1.5, borderColor: 'transparent',
  },
  catChipActive: { backgroundColor: Colors.deepGreen, borderColor: Colors.deepGreen },
  catChipLabel: { fontFamily: FontFamily.sora, fontSize: 12, color: Colors.textSecondary },
  catChipLabelActive: { fontFamily: FontFamily.soraSemibold, color: Colors.paleGoldLight },
  sheetSaveBtn: {
    backgroundColor: Colors.deepGreen, borderRadius: BorderRadius.full,
    paddingVertical: 14, alignItems: 'center',
  },
  sheetSaveBtnLabel: { fontFamily: FontFamily.soraSemibold, fontSize: 15, color: Colors.paleGoldLight },
});
