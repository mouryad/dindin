import React, { useState } from 'react';
import {
  View,
  ScrollView,
  Image,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  ActivityIndicator,
  ActionSheetIOS,
  Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as Haptics from 'expo-haptics';
import { useAuth } from '@context/AuthContext';
import { bulkAddFromFridgeScan } from '@services/inventory';
import { scanFridge } from '@services/aiVision';
import { IngredientsList } from '@components/camera/IngredientsList';
import { DinText } from '@components/ui/DinText';
import { DinButton } from '@components/ui/DinButton';
import { Colors, FontFamily, BorderRadius, Spacing } from '@constants/theme';
import type { FridgeScanResult, FridgeIngredient } from '@services/aiVision';

interface FridgeConfirmScreenProps {
  imageUri: string;
  result: FridgeScanResult;
  coupleId: string | null;
  onSaved: (addedCount: number) => void;
  onCancel: () => void;
}

export function FridgeConfirmScreen({
  imageUri,
  result,
  coupleId,
  onSaved,
  onCancel,
}: FridgeConfirmScreenProps) {
  const { user, profile } = useAuth();

  const [imageUris, setImageUris] = useState<string[]>([imageUri]);
  const [ingredients, setIngredients] = useState<FridgeIngredient[]>(result.ingredients);
  const [recipeSuggestions, setRecipeSuggestions] = useState<string[]>(result.recipeSuggestions);
  const [selected, setSelected] = useState<Set<number>>(
    new Set(result.ingredients.map((_, i) => i)),
  );
  const [saving, setSaving] = useState(false);
  const [scanning, setScanning] = useState(false);

  function toggleItem(index: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  function editItem(index: number, updated: FridgeIngredient) {
    setIngredients((prev) => {
      const next = [...prev];
      next[index] = updated;
      return next;
    });
  }

  function selectAll() { setSelected(new Set(ingredients.map((_, i) => i))); }
  function deselectAll() { setSelected(new Set()); }

  async function toJpeg(uri: string): Promise<string> {
    const result = await ImageManipulator.manipulateAsync(
      uri,
      [],
      { compress: 0.82, format: ImageManipulator.SaveFormat.JPEG },
    );
    return result.uri;
  }

  async function scanAndMerge(uri: string) {
    const jpegUri = await toJpeg(uri);
    uri = jpegUri;
    setScanning(true);
    try {
      const newResult = await scanFridge(uri);
      const existingNames = new Set(ingredients.map((i) => i.name.toLowerCase()));
      const newItems = newResult.ingredients.filter(
        (i) => !existingNames.has(i.name.toLowerCase()),
      );

      setImageUris((prev) => [...prev, uri]);
      setIngredients((prev) => {
        const merged = [...prev, ...newItems];
        // auto-select the newly added items
        setSelected(new Set(merged.map((_, i) => i)));
        return merged;
      });
      // Merge recipe suggestions (deduplicate)
      setRecipeSuggestions((prev) => {
        const existing = new Set(prev.map((r) => r.toLowerCase()));
        const newSuggestions = newResult.recipeSuggestions.filter(
          (r) => !existing.has(r.toLowerCase()),
        );
        return [...prev, ...newSuggestions].slice(0, 6);
      });

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (newItems.length === 0) {
        Alert.alert('No new items', 'All detected items are already in your list.');
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : (e as any)?.message ?? 'Scan failed';
      Alert.alert('Scan failed', msg);
    } finally {
      setScanning(false);
    }
  }

  function promptAddMore() {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', 'Take a photo', 'Choose from library'],
          cancelButtonIndex: 0,
        },
        async (index) => {
          if (index === 1) await pickFromCamera();
          if (index === 2) await pickFromLibrary();
        },
      );
    } else {
      Alert.alert('Add more ingredients', 'Choose source', [
        { text: 'Take a photo', onPress: pickFromCamera },
        { text: 'Choose from library', onPress: pickFromLibrary },
        { text: 'Cancel', style: 'cancel' },
      ]);
    }
  }

  async function pickFromCamera() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Camera access is required to take photos.');
      return;
    }
    const res = await ImagePicker.launchCameraAsync({ quality: 0.82 });
    if (!res.canceled && res.assets?.[0]?.uri) {
      await scanAndMerge(res.assets[0].uri);
    }
  }

  async function pickFromLibrary() {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      quality: 0.85,
    });
    if (!res.canceled && res.assets?.[0]?.uri) {
      await scanAndMerge(res.assets[0].uri);
    }
  }

  async function handleSave() {
    if (!user || !profile) {
      Alert.alert('Not ready', 'Your profile is still loading. Please try again.');
      return;
    }
    if (selected.size === 0) {
      Alert.alert('Nothing selected', 'Select at least one item to add.');
      return;
    }

    setSaving(true);
    try {
      const selectedIngredients = ingredients.filter((_, i) => selected.has(i));
      const { added } = await bulkAddFromFridgeScan({
        coupleId,
        userId: profile.id,
        ingredients: selectedIngredients,
      });

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onSaved(added);
    } catch (e) {
      const msg = e instanceof Error ? e.message : (e as any)?.message ?? JSON.stringify(e);
      Alert.alert('Save failed', msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onCancel} style={styles.backBtn}>
          <DinText style={styles.backArrow}>←</DinText>
        </TouchableOpacity>
        <DinText variant="subheading">Fridge scan</DinText>
        <TouchableOpacity
          onPress={promptAddMore}
          style={styles.addMoreBtn}
          disabled={scanning}
          activeOpacity={0.7}
        >
          {scanning
            ? <ActivityIndicator size="small" color={Colors.deepGreen} />
            : <DinText style={styles.addMoreLabel}>+ Scan more</DinText>
          }
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Photo strip */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoStrip}>
          {imageUris.map((uri, i) => (
            <Image key={i} source={{ uri }} style={styles.photoThumb} resizeMode="cover" />
          ))}
          {/* Add another photo tile */}
          <TouchableOpacity
            onPress={promptAddMore}
            style={styles.addPhotoTile}
            disabled={scanning}
            activeOpacity={0.7}
          >
            {scanning
              ? <ActivityIndicator color={Colors.deepGreen} />
              : <>
                  <DinText style={styles.addPhotoPlus}>+</DinText>
                  <DinText variant="caption" color={Colors.textSecondary}>Add photo</DinText>
                </>
            }
          </TouchableOpacity>
        </ScrollView>

        {/* Selection controls */}
        <View style={styles.selectionBar}>
          <DinText variant="caption" color={Colors.textSecondary}>
            {selected.size} of {ingredients.length} selected
          </DinText>
          <View style={styles.selectionActions}>
            <TouchableOpacity onPress={selectAll}>
              <DinText variant="caption" color={Colors.deepGreen}>All</DinText>
            </TouchableOpacity>
            <DinText variant="caption" color={Colors.textMuted}> · </DinText>
            <TouchableOpacity onPress={deselectAll}>
              <DinText variant="caption" color={Colors.textSecondary}>None</DinText>
            </TouchableOpacity>
          </View>
        </View>

        {/* Ingredients + recipe suggestions */}
        <IngredientsList
          ingredients={ingredients}
          selected={selected}
          onToggle={toggleItem}
          onEdit={editItem}
          recipeSuggestions={recipeSuggestions}
        />
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <DinButton
          label={`Add ${selected.size} item${selected.size !== 1 ? 's' : ''} to fridge`}
          onPress={handleSave}
          loading={saving}
          disabled={saving || scanning || selected.size === 0}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.paleGoldLight },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  backArrow: { fontSize: 24, color: Colors.deepGreen },
  addMoreBtn: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    minWidth: 80,
    alignItems: 'flex-end',
  },
  addMoreLabel: {
    fontSize: 13,
    fontFamily: FontFamily.soraSemibold,
    color: Colors.deepGreen,
  },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: 100,
    gap: Spacing.md,
  },
  // Photo strip
  photoStrip: {
    marginHorizontal: -Spacing.lg,
    paddingHorizontal: Spacing.lg,
  },
  photoThumb: {
    width: 100,
    height: 100,
    borderRadius: BorderRadius.md,
    marginRight: 8,
  },
  addPhotoTile: {
    width: 100,
    height: 100,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
    borderColor: Colors.deepGreen,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: Colors.paleGoldMedium,
  },
  addPhotoPlus: {
    fontSize: 28,
    color: Colors.deepGreen,
    lineHeight: 32,
  },
  selectionBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selectionActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  footer: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xl,
    paddingTop: Spacing.md,
  },
});
