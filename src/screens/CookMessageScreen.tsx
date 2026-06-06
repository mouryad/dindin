import React, { useState, useRef } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  SafeAreaView,
  Linking,
  KeyboardAvoidingView,
  Platform,
  Switch,
} from 'react-native';
import { DinText } from '@components/ui/DinText';
import { DinButton } from '@components/ui/DinButton';
import { Colors, FontFamily, BorderRadius, Spacing } from '@constants/theme';
import type { RecipeQueueItem } from '@hooks/useRecipeQueue';

interface EditableRecipe {
  id: string;
  title: string;
  url: string;
  platform: string;
  meal_category: string;
  included: boolean;
  ingredients: string;
  extraNotes: string;
}

interface CookMessageScreenProps {
  recipes: RecipeQueueItem[];
  onClose: () => void;
}

const CAT_LABEL: Record<string, string> = {
  breakfast: '🌅 Breakfast',
  lunch: '☀️ Lunch',
  dinner: '🌙 Dinner',
  snack: '🍎 Snack',
  general: '📋 General',
};

export function CookMessageScreen({ recipes, onClose }: CookMessageScreenProps) {
  const [editables, setEditables] = useState<EditableRecipe[]>(() =>
    recipes.map((r) => ({
      id: r.id,
      title: r.title,
      url: r.url,
      platform: r.platform,
      meal_category: r.meal_category,
      included: true,
      ingredients: '',
      extraNotes: r.notes ?? '',
    })),
  );

  function update(id: string, patch: Partial<EditableRecipe>) {
    setEditables((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  }

  async function handleSend() {
    const selected = editables.filter((e) => e.included);
    if (selected.length === 0) return;

    // Group by meal category
    const grouped: Record<string, EditableRecipe[]> = {};
    for (const r of selected) {
      if (!grouped[r.meal_category]) grouped[r.meal_category] = [];
      grouped[r.meal_category].push(r);
    }

    const catOrder = ['breakfast', 'lunch', 'dinner', 'snack', 'general'];
    const lines: string[] = ['🍽 *Today\'s Recipe Queue*', ''];

    for (const cat of catOrder) {
      const items = grouped[cat];
      if (!items?.length) continue;
      lines.push(`*${CAT_LABEL[cat] ?? cat}*`);
      for (const item of items) {
        lines.push(`• *${item.title}*`);
        lines.push(`  🔗 ${item.url}`);
        if (item.ingredients.trim()) {
          lines.push('');
          lines.push('  🥘 *Ingredients:*');
          for (const ing of item.ingredients.split('\n').filter(Boolean)) {
            lines.push(`  - ${ing.trim()}`);
          }
        }
        if (item.extraNotes.trim()) {
          lines.push('');
          lines.push(`  📝 ${item.extraNotes.trim()}`);
        }
        lines.push('');
      }
    }

    lines.push('_Sent via Dindin 💚_');

    const msg = lines.join('\n');
    const waUrl = `https://wa.me/?text=${encodeURIComponent(msg)}`;
    const canOpen = await Linking.canOpenURL(waUrl);
    await Linking.openURL(canOpen ? waUrl : `sms:?body=${encodeURIComponent(msg)}`);
  }

  const includedCount = editables.filter((e) => e.included).length;

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.backBtn}>
            <DinText style={styles.backArrow}>←</DinText>
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <DinText variant="subheading">Review & Send</DinText>
            <DinText variant="caption" color={Colors.textSecondary}>
              Edit ingredients and instructions before sending
            </DinText>
          </View>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {editables.map((item) => (
            <RecipeEditCard
              key={item.id}
              item={item}
              onUpdate={(patch) => update(item.id, patch)}
            />
          ))}

          {/* Voice note placeholder */}
          <View style={styles.voiceRow}>
            <DinText style={styles.voiceIcon}>🎤</DinText>
            <View style={{ flex: 1 }}>
              <DinText style={styles.voiceLabel}>Add voice note</DinText>
              <DinText variant="caption" color={Colors.textMuted}>Coming soon — record a message for your cook</DinText>
            </View>
            <View style={styles.comingSoonBadge}>
              <DinText style={styles.comingSoonText}>Soon</DinText>
            </View>
          </View>
        </ScrollView>

        {/* Footer */}
        <View style={styles.footer}>
          <DinButton
            label={includedCount === 0 ? 'Select at least one recipe' : `📲 Send ${includedCount} recipe${includedCount !== 1 ? 's' : ''} via WhatsApp`}
            onPress={handleSend}
            disabled={includedCount === 0}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Recipe edit card ─────────────────────────────────────────

interface RecipeEditCardProps {
  item: EditableRecipe;
  onUpdate: (patch: Partial<EditableRecipe>) => void;
}

function RecipeEditCard({ item, onUpdate }: RecipeEditCardProps) {
  const [expanded, setExpanded] = useState(true);

  return (
    <View style={[styles.card, !item.included && styles.cardDisabled]}>
      {/* Card header row */}
      <View style={styles.cardHeader}>
        <Switch
          value={item.included}
          onValueChange={(v) => onUpdate({ included: v })}
          trackColor={{ true: Colors.deepGreen, false: Colors.paleGoldMedium }}
          thumbColor={item.included ? Colors.gold : '#ccc'}
        />
        <View style={{ flex: 1, marginLeft: Spacing.sm }}>
          <DinText style={styles.catLabel}>{CAT_LABEL[item.meal_category] ?? item.meal_category}</DinText>
          <TextInput
            style={styles.titleInput}
            value={item.title}
            onChangeText={(v) => onUpdate({ title: v })}
            placeholder="Recipe title"
            placeholderTextColor={Colors.textMuted}
          />
        </View>
        <TouchableOpacity onPress={() => setExpanded((e) => !e)} style={styles.expandBtn}>
          <DinText style={styles.expandIcon}>{expanded ? '▲' : '▼'}</DinText>
        </TouchableOpacity>
      </View>

      {expanded && item.included && (
        <View style={styles.cardBody}>
          {/* URL — tappable */}
          <TouchableOpacity onPress={() => Linking.openURL(item.url).catch(() => {})}>
            <DinText variant="caption" color={Colors.deepGreen} style={styles.urlText} numberOfLines={1}>
              🔗 {item.url}
            </DinText>
          </TouchableOpacity>

          {/* Ingredients */}
          <View style={styles.fieldBlock}>
            <DinText variant="label" style={styles.fieldLabel}>Ingredients</DinText>
            <DinText variant="caption" color={Colors.textMuted} style={styles.fieldHint}>
              One per line — e.g. "500g chicken"
            </DinText>
            <TextInput
              style={styles.multilineInput}
              value={item.ingredients}
              onChangeText={(v) => onUpdate({ ingredients: v })}
              placeholder={'500g chicken\n2 cups tomato puree\n1 tsp garam masala'}
              placeholderTextColor={Colors.textMuted}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>

          {/* Extra instructions */}
          <View style={styles.fieldBlock}>
            <DinText variant="label" style={styles.fieldLabel}>Instructions / Notes</DinText>
            <TextInput
              style={[styles.multilineInput, styles.notesInput]}
              value={item.extraNotes}
              onChangeText={(v) => onUpdate({ extraNotes: v })}
              placeholder="e.g. Marinate overnight. Serve with naan."
              placeholderTextColor={Colors.textMuted}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>
        </View>
      )}
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.paleGoldLight },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.paleGoldMedium,
  },
  backBtn: { padding: 8, marginLeft: -8 },
  backArrow: { fontSize: 22, color: Colors.deepGreen },

  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: 20,
    gap: Spacing.md,
  },

  card: {
    backgroundColor: Colors.paleGoldMedium,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
  },
  cardDisabled: { opacity: 0.45 },

  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
  },
  catLabel: {
    fontFamily: FontFamily.sora,
    fontSize: 10,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  titleInput: {
    fontFamily: FontFamily.soraSemibold,
    fontSize: 15,
    color: Colors.deepGreen,
    padding: 0,
  },
  expandBtn: { padding: 8 },
  expandIcon: { color: Colors.textMuted, fontSize: 12 },

  cardBody: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
    gap: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.paleGoldLight,
  },
  urlText: {
    marginTop: 4,
    textDecorationLine: 'underline',
  },

  fieldBlock: { gap: 4 },
  fieldLabel: { marginBottom: 0 },
  fieldHint: { marginBottom: 4 },
  multilineInput: {
    backgroundColor: Colors.paleGoldLight,
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    fontFamily: FontFamily.sora,
    fontSize: 13,
    color: Colors.textPrimary,
    minHeight: 80,
    lineHeight: 20,
  },
  notesInput: { minHeight: 60 },

  voiceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.paleGoldMedium,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    opacity: 0.6,
  },
  voiceIcon: { fontSize: 28 },
  voiceLabel: {
    fontFamily: FontFamily.soraSemibold,
    fontSize: 14,
    color: Colors.deepGreen,
  },
  comingSoonBadge: {
    backgroundColor: Colors.gold,
    borderRadius: BorderRadius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  comingSoonText: {
    fontFamily: FontFamily.soraSemibold,
    fontSize: 11,
    color: Colors.deepGreen,
  },

  footer: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xl,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.paleGoldMedium,
  },
});
