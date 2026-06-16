import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  ScrollView,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Image,
  SafeAreaView,
  Alert,
  Linking,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useRecipeQueue, type RecipeQueueItem } from '@hooks/useRecipeQueue';
import { usePendingSharedUrls } from '@hooks/usePendingSharedUrls';
import { useAuth } from '@context/AuthContext';
import { useCouple } from '@hooks/useCouple';
import { fetchUrlMeta, platformIcon as getPlatformIcon } from '@services/urlMetadata';
import {
  searchRecipeVideos, fetchPlaylistItems, fetchPlaylistInfo,
  parseYouTubePlaylistId, type YouTubeVideo, type YouTubePlaylist,
} from '@services/youtube';
import { DinText } from '@components/ui/DinText';
import { DinButton } from '@components/ui/DinButton';
import { Colors, FontFamily, BorderRadius, Spacing } from '@constants/theme';

const SCREEN_W = Dimensions.get('window').width;

const CATEGORIES = [
  { value: 'breakfast', label: 'Breakfast', icon: '🌅' },
  { value: 'lunch',     label: 'Lunch',     icon: '☀️' },
  { value: 'dinner',    label: 'Dinner',    icon: '🌙' },
  { value: 'snack',     label: 'Snack',     icon: '🍎' },
  { value: 'general',   label: 'General',   icon: '📋' },
];

const CAT_COLORS: Record<string, { bg: string; accent: string }> = {
  breakfast: { bg: '#FFF8EE', accent: '#E8963A' },
  lunch:     { bg: '#EFF7F2', accent: '#4A7C59' },
  dinner:    { bg: '#F5F0FF', accent: '#7B6FA0' },
  snack:     { bg: '#FFF0F5', accent: '#C0537A' },
  general:   { bg: Colors.paleGoldMedium, accent: Colors.deepGreen },
};

type ScreenView = 'boards' | 'category' | 'search';

export function RecipeQueueScreen() {
  const { recipes, loading, addRecipe, removeRecipe } = useRecipeQueue();
  const { pendingUrls, clear: clearPending } = usePendingSharedUrls();
  const { user } = useAuth();
  const { couple } = useCouple();
  const partnerName = couple?.partner?.display_name ?? null;

  const [showAdd,      setShowAdd]      = useState(false);
  const [shareRecipe,  setShareRecipe]  = useState<RecipeQueueItem | null>(null);
  const [pendingUrl,   setPendingUrl]   = useState('');

  // ── Navigation state ──
  const [view,           setView]           = useState<ScreenView>('boards');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  // ── Search state ──
  const [query,      setQuery]      = useState('');
  const [ytResults,  setYtResults]  = useState<YouTubeVideo[]>([]);
  const [ytLoading,  setYtLoading]  = useState(false);
  const [ytSearched, setYtSearched] = useState(false);

  useEffect(() => {
    if (pendingUrls.length > 0) { setPendingUrl(pendingUrls[0]); setShowAdd(true); }
  }, [pendingUrls]);

  // Local search filter
  const localResults = query.trim().length > 1
    ? recipes.filter((r) =>
        r.title.toLowerCase().includes(query.toLowerCase()) ||
        (r.notes ?? '').toLowerCase().includes(query.toLowerCase()),
      )
    : recipes;

  async function searchYouTube() {
    if (!query.trim()) return;
    setYtLoading(true);
    setYtSearched(true);
    try {
      const results = await searchRecipeVideos(query.trim(), 8);
      setYtResults(results);
    } catch {
      setYtResults([]);
    } finally {
      setYtLoading(false);
    }
  }

  function handleSearchFocus() { setView('search'); }
  function handleSearchCancel() { setView('boards'); setQuery(''); setYtResults([]); setYtSearched(false); }

  function openCategory(cat: string) { setActiveCategory(cat); setView('category'); }
  function backToBoards() { setView('boards'); setActiveCategory(null); }

  const activeCatInfo = CATEGORIES.find((c) => c.value === activeCategory);
  const activeCatRecipes = activeCategory ? recipes.filter((r) => r.meal_category === activeCategory) : [];

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        {view === 'category' ? (
          <TouchableOpacity onPress={backToBoards} style={styles.backBtn}>
            <DinText style={styles.backArrow}>←</DinText>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 40 }} />
        )}
        <DinText variant="heading" style={styles.title}>
          {view === 'category' && activeCatInfo
            ? `${activeCatInfo.icon} ${activeCatInfo.label}`
            : 'Recipes'}
        </DinText>
        {view !== 'search' ? (
          <TouchableOpacity onPress={() => setShowAdd(true)} style={styles.addBtn}>
            <DinText style={styles.addBtnText}>+ Add</DinText>
          </TouchableOpacity>
        ) : (
          <View style={{ width: 60 }} />
        )}
      </View>

      {/* Search bar */}
      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <DinText style={styles.searchIcon}>🔍</DinText>
          <TextInput
            value={query}
            onChangeText={setQuery}
            onFocus={handleSearchFocus}
            onSubmitEditing={searchYouTube}
            placeholder="Search recipes or YouTube…"
            placeholderTextColor={Colors.textMuted}
            style={styles.searchInput}
            returnKeyType="search"
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => { setQuery(''); setYtResults([]); setYtSearched(false); }}>
              <DinText style={styles.searchClear}>✕</DinText>
            </TouchableOpacity>
          )}
        </View>
        {view === 'search' && (
          <TouchableOpacity onPress={handleSearchCancel} style={styles.cancelBtn}>
            <DinText style={styles.cancelBtnText}>Cancel</DinText>
          </TouchableOpacity>
        )}
      </View>

      {loading && <ActivityIndicator color={Colors.deepGreen} style={{ marginTop: 40 }} />}

      {/* ── BOARDS VIEW ── */}
      {!loading && view === 'boards' && (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {recipes.length === 0 ? (
            <View style={styles.empty}>
              <View style={styles.emptyIconWrap}><DinText style={styles.emptyEmoji}>🎬</DinText></View>
              <DinText variant="subheading" style={styles.emptyTitle}>No recipes yet</DinText>
              <DinText variant="body" color={Colors.textSecondary} style={styles.emptyBody}>
                Save YouTube / Instagram reels or import a YouTube playlist
              </DinText>
              <TouchableOpacity onPress={() => setShowAdd(true)} style={styles.emptyBtn}>
                <DinText style={styles.emptyBtnLabel}>+ Add your first recipe</DinText>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.boardsGrid}>
              {CATEGORIES.map((cat) => {
                const catRecipes = recipes.filter((r) => r.meal_category === cat.value);
                if (catRecipes.length === 0) return null;
                return (
                  <CategoryBoard
                    key={cat.value}
                    category={cat}
                    recipes={catRecipes}
                    onPress={() => openCategory(cat.value)}
                  />
                );
              })}
            </View>
          )}
        </ScrollView>
      )}

      {/* ── CATEGORY VIEW ── */}
      {!loading && view === 'category' && (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {activeCatRecipes.length === 0 ? (
            <View style={styles.empty}>
              <DinText variant="body" color={Colors.textSecondary}>No recipes in this category yet.</DinText>
            </View>
          ) : activeCatRecipes.map((recipe) => (
            <RecipeCard
              key={recipe.id}
              recipe={recipe}
              currentUserId={user?.id}
              partnerName={partnerName}
              onShare={() => setShareRecipe(recipe)}
              onOpen={() => recipe.url ? Linking.openURL(recipe.url) : null}
              onDelete={() => Alert.alert('Remove recipe?', recipe.title, [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Remove', style: 'destructive', onPress: () => removeRecipe(recipe.id) },
              ])}
            />
          ))}
        </ScrollView>
      )}

      {/* ── SEARCH VIEW ── */}
      {view === 'search' && (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {/* Local matches */}
          {query.trim().length > 1 && localResults.length > 0 && (
            <>
              <DinText variant="label" style={styles.searchSectionLabel}>
                In your collection
              </DinText>
              {localResults.map((recipe) => (
                <RecipeCard
                  key={recipe.id}
                  recipe={recipe}
                  currentUserId={user?.id}
                  partnerName={partnerName}
                  onShare={() => setShareRecipe(recipe)}
                  onOpen={() => recipe.url ? Linking.openURL(recipe.url) : null}
                  onDelete={() => removeRecipe(recipe.id)}
                />
              ))}
            </>
          )}

          {/* YouTube search */}
          <TouchableOpacity
            onPress={searchYouTube}
            style={styles.ytSearchBtn}
            disabled={ytLoading || !query.trim()}
            activeOpacity={0.8}
          >
            {ytLoading
              ? <ActivityIndicator size="small" color={Colors.paleGoldLight} />
              : <DinText style={styles.ytSearchBtnLabel}>
                  {ytSearched ? '🔄 Search again on YouTube' : '▶  Search YouTube for recipes'}
                </DinText>
            }
          </TouchableOpacity>

          {/* YouTube results */}
          {ytResults.length > 0 && (
            <>
              <DinText variant="label" style={styles.searchSectionLabel}>YouTube results</DinText>
              {ytResults.map((vid) => (
                <Animated.View key={vid.videoId} entering={FadeIn.duration(250)}>
                  <YouTubeResultCard
                    video={vid}
                    onAdd={() => {
                      addRecipe({
                        url: `https://youtu.be/${vid.videoId}`,
                        title: vid.title,
                        thumbnail_url: vid.thumbnailUrl,
                        platform: 'youtube',
                        meal_category: 'general',
                        notes: null,
                        user_id: '',
                      } as any);
                      Alert.alert('Added!', `"${vid.title}" saved to your recipes.`);
                    }}
                  />
                </Animated.View>
              ))}
            </>
          )}

          {ytSearched && !ytLoading && ytResults.length === 0 && (
            <DinText variant="caption" color={Colors.textMuted} style={{ textAlign: 'center', marginTop: 24 }}>
              No YouTube results found. Try a different search.
            </DinText>
          )}
        </ScrollView>
      )}

      {shareRecipe && <ShareSheet recipe={shareRecipe} onClose={() => setShareRecipe(null)} />}

      {showAdd && (
        <View style={StyleSheet.absoluteFill}>
          <AddSheet
            initialUrl={pendingUrl}
            onSave={async (item) => {
              await addRecipe(item);
              clearPending();
              setPendingUrl('');
              setShowAdd(false);
            }}
            onClose={() => { setShowAdd(false); setPendingUrl(''); }}
          />
        </View>
      )}
    </SafeAreaView>
  );
}

// ─── Category board (Pinterest tile) ────────────────────────

const BOARD_W = (SCREEN_W - Spacing.lg * 2 - 10) / 2;

function CategoryBoard({ category, recipes, onPress }: {
  category: { value: string; label: string; icon: string };
  recipes: RecipeQueueItem[];
  onPress: () => void;
}) {
  const colors = CAT_COLORS[category.value] ?? CAT_COLORS.general;
  const thumbs = recipes.slice(0, 4).map((r) => r.thumbnail_url).filter(Boolean) as string[];

  return (
    <TouchableOpacity style={[styles.board, { width: BOARD_W }]} onPress={onPress} activeOpacity={0.88}>
      {/* Mosaic thumbnails */}
      <View style={styles.boardMosaic}>
        {thumbs.length === 0 ? (
          <View style={[styles.boardPlaceholder, { backgroundColor: colors.bg }]}>
            <DinText style={styles.boardPlaceholderEmoji}>{category.icon}</DinText>
          </View>
        ) : thumbs.length === 1 ? (
          <Image source={{ uri: thumbs[0] }} style={styles.boardSingleThumb} resizeMode="cover" />
        ) : (
          <View style={styles.boardMulti}>
            <Image source={{ uri: thumbs[0] }} style={styles.boardBigThumb} resizeMode="cover" />
            <View style={styles.boardSmallCol}>
              {thumbs.slice(1, 3).map((t, i) => (
                <Image key={i} source={{ uri: t }} style={styles.boardSmallThumb} resizeMode="cover" />
              ))}
              {thumbs.length > 3 && (
                <View style={[styles.boardMoreOverlay, { backgroundColor: colors.accent + 'CC' }]}>
                  <DinText style={styles.boardMoreText}>+{recipes.length - 3}</DinText>
                </View>
              )}
            </View>
          </View>
        )}
        {/* Category badge */}
        <View style={[styles.boardBadge, { backgroundColor: colors.accent }]}>
          <DinText style={styles.boardBadgeText}>{category.icon}</DinText>
        </View>
      </View>

      {/* Label */}
      <View style={styles.boardLabel}>
        <DinText style={styles.boardLabelTitle}>{category.label}</DinText>
        <DinText style={styles.boardLabelCount}>{recipes.length} recipe{recipes.length !== 1 ? 's' : ''}</DinText>
      </View>
    </TouchableOpacity>
  );
}

// ─── YouTube result card ─────────────────────────────────────

function YouTubeResultCard({ video, onAdd }: { video: YouTubeVideo; onAdd: () => void }) {
  return (
    <View style={styles.ytCard}>
      {video.thumbnailUrl ? (
        <Image source={{ uri: video.thumbnailUrl }} style={styles.ytThumb} resizeMode="cover" />
      ) : (
        <View style={[styles.ytThumb, { backgroundColor: Colors.paleGoldMedium, alignItems: 'center', justifyContent: 'center' }]}>
          <DinText style={{ fontSize: 22 }}>▶️</DinText>
        </View>
      )}
      <View style={styles.ytBody}>
        <DinText style={styles.ytTitle} numberOfLines={2}>{video.title}</DinText>
        <DinText style={styles.ytChannel} numberOfLines={1}>{video.channelTitle}</DinText>
        <TouchableOpacity onPress={onAdd} style={styles.ytAddBtn} activeOpacity={0.85}>
          <DinText style={styles.ytAddBtnLabel}>+ Save recipe</DinText>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Recipe card ──────────────────────────────────────────────

function RecipeCard({
  recipe, currentUserId, partnerName, onShare, onOpen, onDelete,
}: {
  recipe: RecipeQueueItem;
  currentUserId?: string;
  partnerName?: string | null;
  onShare: () => void;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const catInfo  = CATEGORIES.find((c) => c.value === recipe.meal_category) ?? CATEGORIES[4];
  const colors   = CAT_COLORS[recipe.meal_category] ?? CAT_COLORS.general;
  const isManual = recipe.platform === 'manual';
  const isOwner  = !recipe.user_id || !currentUserId || recipe.user_id === currentUserId;

  return (
    <View style={styles.card}>
      {/* Full-width thumbnail */}
      <View style={styles.thumbWrap}>
        {recipe.thumbnail_url ? (
          <Image source={{ uri: recipe.thumbnail_url }} style={styles.thumb} resizeMode="cover" />
        ) : (
          <View style={[styles.thumbEmpty, { backgroundColor: colors.bg }]}>
            <DinText style={styles.thumbEmoji}>{catInfo.icon}</DinText>
            <DinText style={[styles.thumbEmptyLabel, { color: colors.accent }]}>
              {isManual ? 'Manual Recipe' : 'No Preview'}
            </DinText>
          </View>
        )}

        {/* Gradient fade at bottom */}
        <View style={styles.thumbGradient} />

        {/* Category pill — bottom-left of thumbnail */}
        <View style={[styles.catPill, { backgroundColor: colors.accent }]}>
          <DinText style={styles.catPillText}>{catInfo.icon}  {catInfo.label}</DinText>
        </View>

        {/* Platform badge — bottom-right */}
        <View style={styles.platformPill}>
          <DinText style={styles.platformPillText}>
            {getPlatformIcon(recipe.platform as 'youtube' | 'instagram' | 'tiktok' | 'other')}
            {'  '}{isManual ? 'Manual' : recipe.platform}
          </DinText>
        </View>

        {/* Delete — top-right (owner only) */}
        {isOwner && (
          <TouchableOpacity onPress={onDelete} style={styles.deleteCorner} hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}>
            <DinText style={styles.deleteCornerText}>✕</DinText>
          </TouchableOpacity>
        )}

        {/* Partner badge — top-left */}
        {!isOwner && partnerName && (
          <View style={styles.partnerBadge}>
            <DinText style={styles.partnerBadgeText}>from {partnerName}</DinText>
          </View>
        )}
      </View>

      {/* Content */}
      <View style={styles.cardContent}>
        <DinText style={styles.cardTitle} numberOfLines={2}>{recipe.title}</DinText>

        {recipe.notes ? (
          <DinText style={styles.cardNotes} numberOfLines={2}>
            {recipe.notes}
          </DinText>
        ) : null}

        {/* Actions */}
        <View style={styles.cardActions}>
          <TouchableOpacity
            onPress={onOpen}
            style={[styles.actionOpen, { borderColor: colors.accent + '60' }]}
            activeOpacity={0.8}
          >
            <DinText style={[styles.actionOpenLabel, { color: colors.accent }]}>
              Open ↗
            </DinText>
          </TouchableOpacity>

          <TouchableOpacity onPress={onShare} style={styles.actionWa} activeOpacity={0.85}>
            <DinText style={styles.actionWaLabel}>Send to cook ↑</DinText>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

// ─── Share sheet ─────────────────────────────────────────────

function ShareSheet({ recipe, onClose }: { recipe: RecipeQueueItem; onClose: () => void }) {
  const [instructions, setInstructions] = useState(recipe.notes ?? '');

  function send() {
    const lines: string[] = [
      `🎬 *${recipe.title}*`,
      '',
      `🔗 ${recipe.url}`,
    ];
    if (instructions.trim()) {
      lines.push('', `📝 *Instructions:*`, instructions.trim());
    }
    lines.push('', '_Sent via Dindin 🍽_');

    Linking.openURL(`https://wa.me/?text=${encodeURIComponent(lines.join('\n'))}`)
      .catch(() => Alert.alert('WhatsApp not found', 'Please install WhatsApp.'));
    onClose();
  }

  return (
    <>
      {/* Backdrop */}
      <TouchableOpacity
        style={[StyleSheet.absoluteFill, styles.backdrop]}
        onPress={onClose}
        activeOpacity={1}
      />

      {/* Sheet lifted above keyboard */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'position' : undefined}
        style={styles.shareSheetWrap}
        keyboardVerticalOffset={0}
      >
      <View style={styles.shareSheet}>
        <View style={styles.sheetHandle} />

        <DinText variant="subheading" style={styles.sheetTitle}>Share Recipe</DinText>

        {/* Recipe preview */}
        <View style={styles.sharePreview}>
          {recipe.thumbnail_url ? (
            <Image source={{ uri: recipe.thumbnail_url }} style={styles.shareThumb} resizeMode="cover" />
          ) : (
            <View style={[styles.shareThumb, styles.shareThumbEmpty]}>
              <DinText style={{ fontSize: 22 }}>
                {getPlatformIcon(recipe.platform as 'youtube' | 'instagram' | 'tiktok' | 'other')}
              </DinText>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <DinText style={styles.shareTitle} numberOfLines={2}>{recipe.title}</DinText>
            <DinText variant="caption" color={Colors.textMuted} numberOfLines={1}>{recipe.url}</DinText>
          </View>
        </View>

        {/* Extra instructions */}
        <DinText variant="label" style={styles.fieldLabel}>
          Add instructions for cook (optional)
        </DinText>
        <TextInput
          value={instructions}
          onChangeText={setInstructions}
          placeholder="e.g. Make this for Sunday dinner. Less spice for kids."
          placeholderTextColor={Colors.textMuted}
          style={[styles.input, styles.instructionsInput]}
          multiline
        />

        {/* Send button */}
        <TouchableOpacity style={styles.sendWhatsAppBtn} onPress={send} activeOpacity={0.85}>
          <DinText style={styles.sendWhatsAppBtnLabel}>📲  Send via WhatsApp</DinText>
        </TouchableOpacity>
      </View>
      </KeyboardAvoidingView>
    </>
  );
}

// ─── Add sheet (link OR manual) ──────────────────────────────

type AddMode = 'link' | 'manual';

function AddSheet({
  initialUrl,
  onSave,
  onClose,
}: {
  initialUrl: string;
  onSave: (item: Omit<RecipeQueueItem, 'id' | 'created_at'>) => Promise<void>;
  onClose: () => void;
}) {
  const [mode,     setMode]     = useState<AddMode>(initialUrl ? 'link' : 'link');
  const [saving,   setSaving]   = useState(false);

  // ── Link mode state ──
  const [url,          setUrl]         = useState(initialUrl);
  const [title,        setTitle]       = useState('');
  const [notes,        setNotes]       = useState('');
  const [category,     setCategory]    = useState('general');
  const [fetching,     setFetching]    = useState(false);
  const [thumbUrl,     setThumbUrl]    = useState<string | null>(null);
  const [platform,     setPlatform]    = useState('other');
  const [playlistInfo, setPlaylistInfo] = useState<YouTubePlaylist | null>(null);
  const [importing,    setImporting]   = useState(false);

  // ── Manual mode state ──
  const [photo,        setPhoto]        = useState<string | null>(null);
  const [manualTitle,  setManualTitle]  = useState('');
  const [ingredients,  setIngredients]  = useState('');
  const [instructions, setInstructions] = useState('');
  const [manualNotes,  setManualNotes]  = useState('');
  const [manualCat,    setManualCat]    = useState('general');

  // Auto-fetch link metadata + detect playlist
  useEffect(() => {
    if (initialUrl) { setUrl(initialUrl); autoFetch(initialUrl); }
  }, [initialUrl]);

  async function autoFetch(text: string) {
    if (text.length < 10) return;
    setFetching(true);
    setPlaylistInfo(null);
    try {
      // Check if it's a YouTube playlist URL
      const plId = parseYouTubePlaylistId(text.trim());
      if (plId) {
        const info = await fetchPlaylistInfo(plId);
        setPlaylistInfo(info);
        if (info) { setTitle(info.title); setThumbUrl(info.thumbnailUrl); setPlatform('youtube'); }
      } else {
        const meta = await fetchUrlMeta(text.trim());
        if (meta.title) setTitle(meta.title);
        setThumbUrl(meta.thumbnailUrl);
        setPlatform(meta.platform);
      }
    } catch { /**/ }
    setFetching(false);
  }

  async function handleUrlChange(text: string) {
    setUrl(text);
    await autoFetch(text);
  }

  async function importPlaylist() {
    if (!playlistInfo || !url.trim()) return;
    setImporting(true);
    try {
      const videos = await fetchPlaylistItems(playlistInfo.playlistId, 50);
      for (const vid of videos) {
        await onSave({
          url: `https://youtu.be/${vid.videoId}`,
          title: vid.title,
          thumbnail_url: vid.thumbnailUrl,
          platform: 'youtube',
          meal_category: category,
          notes: null,
          user_id: '',
        } as any);
      }
      Alert.alert('Playlist imported!', `${videos.length} recipes added from "${playlistInfo.title}".`);
    } catch (e) {
      Alert.alert('Import failed', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setImporting(false);
    }
  }

  async function pickPhoto() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow photo access to add a dish photo.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({ quality: 0.85, mediaTypes: 'images' });
    if (!res.canceled && res.assets?.[0]?.uri) setPhoto(res.assets[0].uri);
  }

  async function takePhoto() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') return;
    const res = await ImagePicker.launchCameraAsync({ quality: 0.82 });
    if (!res.canceled && res.assets?.[0]?.uri) setPhoto(res.assets[0].uri);
  }

  function promptPhoto() {
    Alert.alert('Add photo', 'Choose a photo of the dish', [
      { text: 'Take photo',         onPress: takePhoto },
      { text: 'Choose from library', onPress: pickPhoto },
      { text: 'Cancel', style: 'cancel' },
    ]);
  }

  async function handleSave() {
    if (mode === 'link') {
      if (!url.trim())   { Alert.alert('Paste a URL first'); return; }
      if (!title.trim()) { Alert.alert('Add a title'); return; }
      setSaving(true);
      await onSave({
        url: url.trim(),
        title: title.trim(),
        thumbnail_url: thumbUrl,
        platform,
        meal_category: category,
        notes: notes.trim() || null,
        user_id: '',
      } as any);
    } else {
      if (!manualTitle.trim()) { Alert.alert('Add a recipe name'); return; }
      // Format instructions into notes so they show in the share sheet
      const formatted = [
        ingredients.trim()  ? `📋 Ingredients:\n${ingredients.trim()}`  : '',
        instructions.trim() ? `👨‍🍳 Instructions:\n${instructions.trim()}` : '',
        manualNotes.trim()  ? `📝 Notes:\n${manualNotes.trim()}`         : '',
      ].filter(Boolean).join('\n\n');
      setSaving(true);
      await onSave({
        url: '',
        title: manualTitle.trim(),
        thumbnail_url: photo,
        platform: 'manual',
        meal_category: manualCat,
        notes: formatted || null,
        user_id: '',
      } as any);
    }
    setSaving(false);
  }

  return (
    <SafeAreaView style={styles.addScreen}>
      {/* Nav header */}
      <View style={styles.addHeader}>
        <TouchableOpacity onPress={onClose} style={styles.addHeaderCancel} activeOpacity={0.7}>
          <DinText style={styles.addHeaderCancelText}>Cancel</DinText>
        </TouchableOpacity>
        <DinText variant="subheading" style={styles.addHeaderTitle}>Add Recipe</DinText>
        <TouchableOpacity
          onPress={handleSave}
          disabled={saving}
          style={styles.addHeaderSave}
          activeOpacity={0.7}
        >
          {saving
            ? <ActivityIndicator size="small" color={Colors.deepGreen} />
            : <DinText style={styles.addHeaderSaveText}>Save</DinText>
          }
        </TouchableOpacity>
      </View>

      {/* Mode toggle */}
      <View style={styles.modeToggleWrap}>
        <View style={styles.modeToggle}>
          <TouchableOpacity
            onPress={() => setMode('link')}
            style={[styles.modeBtn, mode === 'link' && styles.modeBtnActive]}
          >
            <DinText style={[styles.modeBtnLabel, mode === 'link' && styles.modeBtnLabelActive]}>
              📎  From link
            </DinText>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setMode('manual')}
            style={[styles.modeBtn, mode === 'manual' && styles.modeBtnActive]}
          >
            <DinText style={[styles.modeBtnLabel, mode === 'manual' && styles.modeBtnLabelActive]}>
              📷  Manual
            </DinText>
          </TouchableOpacity>
        </View>
      </View>

      {/* Scrollable content */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          style={styles.addScroll}
          contentContainerStyle={styles.addScrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
        >
          {mode === 'link' ? (
            <>
              <DinText variant="label" style={styles.fieldLabel}>Link (Instagram, YouTube…)</DinText>
              <View style={styles.urlRow}>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  placeholder="https://instagram.com/reel/..."
                  placeholderTextColor={Colors.textMuted}
                  value={url}
                  onChangeText={handleUrlChange}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                {fetching && <ActivityIndicator color={Colors.deepGreen} style={{ marginLeft: 8 }} />}
              </View>

              {/* Playlist detected — show import banner */}
              {playlistInfo && (
                <View style={styles.playlistBanner}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <DinText style={styles.playlistTitle}>📋 YouTube Playlist</DinText>
                    <DinText style={styles.playlistName} numberOfLines={1}>{playlistInfo.title}</DinText>
                    <DinText style={styles.playlistCount}>{playlistInfo.videoCount} videos</DinText>
                  </View>
                  <TouchableOpacity
                    onPress={importPlaylist}
                    disabled={importing}
                    style={styles.importBtn}
                    activeOpacity={0.85}
                  >
                    {importing
                      ? <ActivityIndicator size="small" color={Colors.paleGoldLight} />
                      : <DinText style={styles.importBtnLabel}>Import all</DinText>
                    }
                  </TouchableOpacity>
                </View>
              )}

              <DinText variant="label" style={styles.fieldLabel}>Title</DinText>
              <TextInput
                style={styles.input}
                placeholder="Butter Chicken Recipe"
                placeholderTextColor={Colors.textMuted}
                value={title}
                onChangeText={setTitle}
              />

              <DinText variant="label" style={styles.fieldLabel}>Category</DinText>
              <CatChips value={category} onChange={setCategory} />

              <DinText variant="label" style={styles.fieldLabel}>Instructions for cook</DinText>
              <TextInput
                style={[styles.input, styles.multiInput]}
                placeholder="e.g. Make this for Saturday dinner, less spice for kids"
                placeholderTextColor={Colors.textMuted}
                value={notes}
                onChangeText={setNotes}
                multiline
              />
            </>
          ) : (
            <>
              {/* Photo picker */}
              <TouchableOpacity onPress={promptPhoto} style={styles.photoBox} activeOpacity={0.8}>
                {photo ? (
                  <Image source={{ uri: photo }} style={styles.photoPreview} resizeMode="cover" />
                ) : (
                  <View style={styles.photoEmpty}>
                    <DinText style={styles.photoEmptyIcon}>📷</DinText>
                    <DinText variant="body" color={Colors.textSecondary}>Tap to add dish photo</DinText>
                    <DinText variant="caption" color={Colors.textMuted}>Camera or library</DinText>
                  </View>
                )}
              </TouchableOpacity>

              <DinText variant="label" style={styles.fieldLabel}>Recipe name</DinText>
              <TextInput
                style={styles.input}
                placeholder="e.g. Mum's Dal Tadka"
                placeholderTextColor={Colors.textMuted}
                value={manualTitle}
                onChangeText={setManualTitle}
              />

              <DinText variant="label" style={styles.fieldLabel}>Category</DinText>
              <CatChips value={manualCat} onChange={setManualCat} />

              <DinText variant="label" style={styles.fieldLabel}>Ingredients</DinText>
              <TextInput
                style={[styles.input, styles.multiInput]}
                placeholder={'1 cup dal\n2 tomatoes, chopped\n1 onion, sliced\n...'}
                placeholderTextColor={Colors.textMuted}
                value={ingredients}
                onChangeText={setIngredients}
                multiline
              />

              <DinText variant="label" style={styles.fieldLabel}>Instructions / Steps</DinText>
              <TextInput
                style={[styles.input, styles.multiInput]}
                placeholder={'1. Boil dal until soft\n2. Fry onion and tomatoes\n3. Add spices\n...'}
                placeholderTextColor={Colors.textMuted}
                value={instructions}
                onChangeText={setInstructions}
                multiline
              />

              <DinText variant="label" style={styles.fieldLabel}>Notes for cook (optional)</DinText>
              <TextInput
                style={[styles.input, styles.multiInput]}
                placeholder="e.g. Make on Sunday, low oil version"
                placeholderTextColor={Colors.textMuted}
                value={manualNotes}
                onChangeText={setManualNotes}
                multiline
              />
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function CatChips({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catScroll}>
      {CATEGORIES.map((c) => (
        <TouchableOpacity
          key={c.value}
          onPress={() => onChange(c.value)}
          style={[styles.catChip, value === c.value && styles.catChipActive]}
        >
          <DinText style={styles.catIcon}>{c.icon}</DinText>
          <DinText
            variant="caption"
            color={value === c.value ? Colors.paleGoldLight : Colors.textSecondary}
          >
            {c.label}
          </DinText>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

// ─── Styles ──────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.paleGoldLight },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  title: { fontSize: 28, lineHeight: 36 },
  addBtn: {
    backgroundColor: Colors.deepGreen,
    paddingHorizontal: 18, paddingVertical: 10,
    borderRadius: BorderRadius.full,
  },
  addBtnText: { fontFamily: FontFamily.soraSemibold, fontSize: 14, color: Colors.paleGoldLight },

  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: Spacing.lg, paddingBottom: 40, gap: Spacing.sm },

  // Empty state
  empty: {
    alignItems: 'center', gap: Spacing.lg,
    paddingTop: 60, paddingHorizontal: Spacing.xl,
  },
  emptyIconWrap: {
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: Colors.paleGoldMedium,
    alignItems: 'center', justifyContent: 'center',
  },
  emptyEmoji: { fontSize: 44 },
  emptyTitle: { textAlign: 'center' },
  emptyBody: { textAlign: 'center', lineHeight: 22 },
  emptyBtn: {
    backgroundColor: Colors.deepGreen, borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.xl, paddingVertical: 13,
  },
  emptyBtnLabel: {
    fontFamily: FontFamily.soraSemibold, fontSize: 14, color: Colors.paleGoldLight,
  },

  // Recipe card — full-width, tall thumbnail
  card: {
    backgroundColor: Colors.paleGoldMedium,
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.paleGoldMedium,
  },

  // Thumbnail
  thumbWrap: { position: 'relative', height: 140 },
  thumb: { width: '100%', height: '100%' },
  thumbEmpty: {
    flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  thumbEmoji: { fontSize: 48 },
  thumbEmptyLabel: {
    fontFamily: FontFamily.soraSemibold, fontSize: 13,
  },
  thumbGradient: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: 80,
    backgroundColor: 'rgba(45,58,31,0.45)',
  },

  // Overlay badges on thumbnail
  catPill: {
    position: 'absolute', bottom: 10, left: 10,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: BorderRadius.full,
  },
  catPillText: {
    fontFamily: FontFamily.soraSemibold, fontSize: 11, color: '#fff',
  },
  platformPill: {
    position: 'absolute', bottom: 10, right: 10,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 9, paddingVertical: 5,
    borderRadius: BorderRadius.full,
  },
  platformPillText: {
    fontFamily: FontFamily.sora, fontSize: 10,
    color: 'rgba(255,255,255,0.85)', textTransform: 'capitalize',
  },
  deleteCorner: {
    position: 'absolute', top: 10, right: 10,
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center', justifyContent: 'center',
  },
  deleteCornerText: {
    fontSize: 12, color: '#fff', fontFamily: FontFamily.soraSemibold,
  },
  partnerBadge: {
    position: 'absolute', top: 10, left: 10,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 9, paddingVertical: 5,
    borderRadius: BorderRadius.full,
  },
  partnerBadgeText: {
    fontFamily: FontFamily.sora, fontSize: 10,
    color: 'rgba(255,255,255,0.9)',
  },

  // Card content below thumbnail
  cardContent: {
    paddingHorizontal: Spacing.md, paddingVertical: 12, gap: 6,
  },
  cardTitle: {
    fontFamily: FontFamily.frauncesBold,
    fontSize: 14, color: Colors.deepGreen, lineHeight: 19,
  },
  cardNotes: {
    fontFamily: FontFamily.sora, fontSize: 11,
    color: Colors.textSecondary, lineHeight: 16,
  },
  cardActions: {
    flexDirection: 'row', gap: 8, marginTop: 2,
  },
  actionOpen: {
    flex: 1, paddingVertical: 8, borderRadius: BorderRadius.full,
    borderWidth: 1.5, alignItems: 'center',
  },
  actionOpenLabel: {
    fontFamily: FontFamily.soraSemibold, fontSize: 12,
  },
  actionWa: {
    flex: 2, paddingVertical: 8, borderRadius: BorderRadius.full,
    backgroundColor: Colors.deepGreen, alignItems: 'center',
  },
  actionWaLabel: {
    fontFamily: FontFamily.soraSemibold, fontSize: 12, color: Colors.paleGoldLight,
  },

  // Nudge
  nudge: {
    marginHorizontal: Spacing.lg, marginBottom: Spacing.sm,
    backgroundColor: Colors.deepGreen, borderRadius: BorderRadius.lg,
    padding: Spacing.md, gap: 8,
  },
  nudgeText: { fontFamily: FontFamily.sora, fontSize: 13, color: Colors.paleGoldLight, lineHeight: 18 },
  nudgeBtns: { flexDirection: 'row', gap: Spacing.md, alignItems: 'center' },
  nudgeAction: {
    backgroundColor: Colors.gold, borderRadius: BorderRadius.full,
    paddingHorizontal: 16, paddingVertical: 6,
  },
  nudgeActionText: { fontFamily: FontFamily.soraSemibold, fontSize: 13, color: Colors.deepGreen },
  nudgeLater: { paddingHorizontal: 8, paddingVertical: 6 },

  // Backdrop
  backdrop: { backgroundColor: 'rgba(45,58,31,0.45)', zIndex: 10 },

  // Share sheet
  shareSheetWrap: {
    position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 11,
  },
  shareSheet: {
    backgroundColor: Colors.paleGoldLight,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: Spacing.lg, paddingBottom: 48,
    gap: Spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12, shadowRadius: 16,
  },
  sharePreview: {
    flexDirection: 'row', gap: Spacing.sm, alignItems: 'center',
    backgroundColor: Colors.paleGoldMedium, borderRadius: BorderRadius.md,
    overflow: 'hidden',
  },
  shareThumb: { width: 60, height: 60 },
  shareThumbEmpty: { backgroundColor: Colors.paleGoldMedium, alignItems: 'center', justifyContent: 'center' },
  shareTitle: { fontFamily: FontFamily.soraSemibold, fontSize: 13, color: Colors.deepGreen, lineHeight: 18 },
  instructionsInput: { minHeight: 90, textAlignVertical: 'top', paddingTop: 12 },
  sendWhatsAppBtn: {
    backgroundColor: '#25D366', borderRadius: BorderRadius.full,
    paddingVertical: 14, alignItems: 'center', marginTop: 4,
  },
  sendWhatsAppBtnLabel: { fontFamily: FontFamily.soraSemibold, fontSize: 15, color: '#fff' },

  // Add recipe — full screen
  addScreen: {
    flex: 1,
    backgroundColor: Colors.paleGoldLight,
  },
  addHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.paleGoldMedium,
  },
  addHeaderCancel: { paddingVertical: 4, paddingRight: 8, minWidth: 60 },
  addHeaderCancelText: {
    fontFamily: FontFamily.sora, fontSize: 15, color: Colors.textSecondary,
  },
  addHeaderTitle: { fontSize: 18 },
  addHeaderSave: {
    paddingVertical: 4, paddingLeft: 8, minWidth: 60, alignItems: 'flex-end',
  },
  addHeaderSaveText: {
    fontFamily: FontFamily.soraSemibold, fontSize: 15, color: Colors.deepGreen,
  },
  modeToggleWrap: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm },
  addScroll: { flex: 1 },
  addScrollContent: { paddingHorizontal: Spacing.lg, paddingBottom: 60 },

  // Mode toggle
  modeToggle: {
    flexDirection: 'row', backgroundColor: Colors.paleGoldMedium,
    borderRadius: BorderRadius.full, padding: 3, gap: 3,
    marginBottom: Spacing.sm,
  },
  modeBtn: {
    flex: 1, paddingVertical: 9, borderRadius: BorderRadius.full, alignItems: 'center',
  },
  modeBtnActive: { backgroundColor: Colors.deepGreen },
  modeBtnLabel: { fontFamily: FontFamily.soraSemibold, fontSize: 13, color: Colors.textSecondary },
  modeBtnLabelActive: { color: Colors.paleGoldLight },

  // Photo picker
  photoBox: {
    height: 160, borderRadius: BorderRadius.lg, overflow: 'hidden',
    backgroundColor: Colors.paleGoldMedium,
    borderWidth: 1.5, borderColor: Colors.gold, borderStyle: 'dashed',
    marginBottom: Spacing.sm,
  },
  photoPreview: { width: '100%', height: '100%' },
  photoEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6 },
  photoEmptyIcon: { fontSize: 36 },

  multiInput: { minHeight: 80, textAlignVertical: 'top', paddingTop: 12 },
  sheetHandle: {
    width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.paleGoldMedium,
    alignSelf: 'center', marginTop: 12, marginBottom: 4,
  },
  sheetTitle: { textAlign: 'center' },
  fieldLabel: { marginTop: Spacing.md, marginBottom: 6 },
  urlRow: { flexDirection: 'row', alignItems: 'center' },
  input: {
    backgroundColor: Colors.paleGoldMedium,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md, paddingVertical: 12,
    fontFamily: FontFamily.sora, fontSize: 14, color: Colors.textPrimary,
  },
  notesInput: { minHeight: 60, textAlignVertical: 'top' },
  catScroll: { flexGrow: 0, marginVertical: 4 },
  catChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: Colors.paleGoldMedium, borderRadius: BorderRadius.full,
    paddingHorizontal: 12, paddingVertical: 7, marginRight: 8,
  },
  catChipActive: { backgroundColor: Colors.deepGreen },
  catIcon: { fontSize: 14 },
  sheetBtns: { flexDirection: 'row', gap: Spacing.md, alignItems: 'center', marginTop: 8 },
  cancelBtn: { paddingHorizontal: Spacing.md, paddingVertical: 16 },

  // Header
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  backArrow: { fontSize: 24, color: Colors.deepGreen },

  // Search bar
  searchRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: Spacing.lg, paddingBottom: Spacing.sm, gap: 8,
  },
  searchBox: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.paleGoldMedium, borderRadius: BorderRadius.full,
    paddingHorizontal: 14, paddingVertical: 10,
  },
  searchIcon: { fontSize: 14 },
  searchInput: {
    flex: 1, fontFamily: FontFamily.sora, fontSize: 14,
    color: Colors.textPrimary, padding: 0,
  },
  searchClear: { fontSize: 13, color: Colors.textMuted, paddingHorizontal: 4 },
  cancelBtnText: {
    fontFamily: FontFamily.soraSemibold, fontSize: 14, color: Colors.deepGreen,
  },

  // Search view
  searchSectionLabel: { marginBottom: 8, marginTop: 4 },
  ytSearchBtn: {
    backgroundColor: Colors.deepGreen, borderRadius: BorderRadius.full,
    paddingVertical: 13, alignItems: 'center', marginVertical: 8,
  },
  ytSearchBtnLabel: {
    fontFamily: FontFamily.soraSemibold, fontSize: 14, color: Colors.paleGoldLight,
  },

  // YouTube result card
  ytCard: {
    flexDirection: 'row', gap: 10, alignItems: 'flex-start',
    backgroundColor: Colors.paleGoldMedium, borderRadius: BorderRadius.lg,
    overflow: 'hidden',
  },
  ytThumb: { width: 110, height: 80 },
  ytBody: { flex: 1, padding: 10, gap: 4 },
  ytTitle: { fontFamily: FontFamily.soraSemibold, fontSize: 13, color: Colors.deepGreen, lineHeight: 18 },
  ytChannel: { fontFamily: FontFamily.sora, fontSize: 11, color: Colors.textMuted },
  ytAddBtn: {
    alignSelf: 'flex-start', marginTop: 4,
    backgroundColor: Colors.deepGreen, borderRadius: BorderRadius.full,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  ytAddBtnLabel: { fontFamily: FontFamily.soraSemibold, fontSize: 12, color: Colors.paleGoldLight },

  // Category boards
  boardsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  board: { borderRadius: BorderRadius.lg, overflow: 'hidden', backgroundColor: Colors.paleGoldMedium },
  boardMosaic: { height: 120, position: 'relative' },
  boardSingleThumb: { width: '100%', height: '100%' },
  boardPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  boardPlaceholderEmoji: { fontSize: 36 },
  boardMulti: { flexDirection: 'row', height: '100%' },
  boardBigThumb: { width: '60%', height: '100%' },
  boardSmallCol: { flex: 1, gap: 2, position: 'relative' },
  boardSmallThumb: { flex: 1, width: '100%' },
  boardMoreOverlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0, top: '50%',
    alignItems: 'center', justifyContent: 'center',
  },
  boardMoreText: { fontFamily: FontFamily.frauncesBold, fontSize: 18, color: '#fff' },
  boardBadge: {
    position: 'absolute', top: 8, left: 8,
    width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  boardBadgeText: { fontSize: 14 },
  boardLabel: { padding: 10, gap: 1 },
  boardLabelTitle: { fontFamily: FontFamily.frauncesBold, fontSize: 14, color: Colors.deepGreen },
  boardLabelCount: { fontFamily: FontFamily.sora, fontSize: 11, color: Colors.textMuted },

  // Playlist import banner
  playlistBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#EFF7F2', borderRadius: BorderRadius.md,
    padding: Spacing.md, borderLeftWidth: 3, borderLeftColor: '#4A7C59',
    marginBottom: 4,
  },
  playlistTitle: { fontFamily: FontFamily.soraSemibold, fontSize: 11, color: '#4A7C59', textTransform: 'uppercase', letterSpacing: 0.5 },
  playlistName: { fontFamily: FontFamily.soraSemibold, fontSize: 13, color: Colors.deepGreen },
  playlistCount: { fontFamily: FontFamily.sora, fontSize: 11, color: Colors.textMuted },
  importBtn: {
    backgroundColor: Colors.deepGreen, borderRadius: BorderRadius.full,
    paddingHorizontal: 14, paddingVertical: 9, minWidth: 80, alignItems: 'center',
  },
  importBtnLabel: { fontFamily: FontFamily.soraSemibold, fontSize: 13, color: Colors.paleGoldLight },
});
