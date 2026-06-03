import React, { useEffect, useState } from 'react';
import {
  View,
  ScrollView,
  Image,
  TouchableOpacity,
  StyleSheet,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { DinText } from '@components/ui/DinText';
import { Colors, FontFamily, BorderRadius, Spacing } from '@constants/theme';
import { searchRecipeVideos, type YouTubeVideo } from '@services/youtube';

interface RecipeVideoPickerProps {
  dishName: string;
  selectedVideoId: string | null;
  onSelect: (video: YouTubeVideo | null) => void;
}

export function RecipeVideoPicker({ dishName, selectedVideoId, onSelect }: RecipeVideoPickerProps) {
  const [videos, setVideos] = useState<YouTubeVideo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!dishName) return;
    setLoading(true);
    setError(null);
    searchRecipeVideos(dishName, 5)
      .then(setVideos)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load videos'))
      .finally(() => setLoading(false));
  }, [dishName]);

  if (!dishName) return null;

  return (
    <View style={styles.container}>
      <DinText variant="label" style={styles.header}>Recipe videos for "{dishName}"</DinText>

      {loading && (
        <View style={styles.center}>
          <ActivityIndicator color={Colors.deepGreen} />
          <DinText variant="caption" color={Colors.textSecondary}>Fetching from YouTube…</DinText>
        </View>
      )}

      {error && (
        <DinText variant="caption" color={Colors.error ?? '#C0392B'}>{error}</DinText>
      )}

      {!loading && videos.length > 0 && (
        <>
          <DinText variant="caption" color={Colors.textSecondary} style={{ marginBottom: 8 }}>
            Tap to attach a recipe link to this meal
          </DinText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.row}>
              {videos.map((video) => (
                <VideoCard
                  key={video.videoId}
                  video={video}
                  selected={selectedVideoId === video.videoId}
                  onSelect={() => onSelect(selectedVideoId === video.videoId ? null : video)}
                />
              ))}
            </View>
          </ScrollView>
        </>
      )}
    </View>
  );
}

function VideoCard({
  video, selected, onSelect,
}: { video: YouTubeVideo; selected: boolean; onSelect: () => void }) {
  const mins = Math.floor(video.durationSeconds / 60);
  const secs = video.durationSeconds % 60;
  const durLabel = `${mins}:${String(secs).padStart(2, '0')}`;

  return (
    <TouchableOpacity
      onPress={onSelect}
      activeOpacity={0.85}
      style={[styles.card, selected && styles.cardSelected]}
    >
      <View style={styles.thumbWrap}>
        <Image source={{ uri: video.thumbnailUrl }} style={styles.thumb} />
        <View style={styles.durBadge}>
          <DinText style={styles.durText}>{durLabel}</DinText>
        </View>
        {selected && (
          <View style={styles.selectedOverlay}>
            <DinText style={styles.checkIcon}>✓</DinText>
          </View>
        )}
      </View>
      <View style={styles.cardBody}>
        <DinText numberOfLines={2} style={styles.title}>{video.title}</DinText>
        <DinText variant="caption" numberOfLines={1} color={Colors.textMuted}>{video.channelTitle}</DinText>
        <TouchableOpacity
          onPress={() => Linking.openURL(`https://youtu.be/${video.videoId}`)}
          style={styles.previewBtn}
        >
          <DinText variant="caption" color={Colors.deepGreen}>▶ Preview</DinText>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

const Colors_ = Colors as typeof Colors & { error?: string };

const styles = StyleSheet.create({
  container: { gap: Spacing.sm },
  header: { marginBottom: 2 },
  center: { alignItems: 'center', gap: 8, paddingVertical: 16 },
  row: { flexDirection: 'row', gap: Spacing.sm, paddingRight: Spacing.md },
  card: {
    width: 180,
    backgroundColor: Colors.paleGoldMedium,
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  cardSelected: {
    borderColor: Colors.deepGreen,
  },
  thumbWrap: {
    position: 'relative',
  },
  thumb: {
    width: '100%',
    height: 100,
    backgroundColor: Colors.paleGoldMedium,
  },
  durBadge: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    backgroundColor: 'rgba(0,0,0,0.72)',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  durText: {
    fontFamily: FontFamily.soraSemibold,
    fontSize: 11,
    color: '#fff',
  },
  selectedOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(45,58,31,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkIcon: {
    fontSize: 32,
    color: Colors.paleGoldLight,
  },
  cardBody: {
    padding: Spacing.sm,
    gap: 3,
  },
  title: {
    fontFamily: FontFamily.soraMedium,
    fontSize: 12,
    color: Colors.textPrimary,
    lineHeight: 17,
  },
  previewBtn: {
    marginTop: 4,
  },
});
