import { YOUTUBE_API_KEY } from '@constants/env';

const BASE = 'https://www.googleapis.com/youtube/v3';

export interface YouTubeVideo {
  videoId: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  channelTitle: string;
  duration: string;        // ISO 8601, e.g. "PT12M30S"
  durationSeconds: number;
  publishedAt: string;
}

export interface YouTubePlaylist {
  playlistId: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  videoCount: number;
}

function isoToSeconds(iso: string): number {
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  return (parseInt(match[1] ?? '0') * 3600) +
         (parseInt(match[2] ?? '0') * 60) +
          parseInt(match[3] ?? '0');
}

async function ytFetch<T>(path: string, params: Record<string, string>): Promise<T> {
  if (!YOUTUBE_API_KEY) throw new Error('YOUTUBE_API_KEY is not configured');
  const qs = new URLSearchParams({ ...params, key: YOUTUBE_API_KEY }).toString();
  const res = await fetch(`${BASE}${path}?${qs}`);
  if (!res.ok) throw new Error(`YouTube API error: ${res.status}`);
  return res.json() as Promise<T>;
}

// ────────────────────────────────────────────────────────────
// Search for recipe videos by dish name
// ────────────────────────────────────────────────────────────
export async function searchRecipeVideos(query: string, maxResults = 6): Promise<YouTubeVideo[]> {
  const search = await ytFetch<{ items: Array<{ id: { videoId: string }; snippet: { title: string; description: string; thumbnails: { medium: { url: string } }; channelTitle: string; publishedAt: string } }> }>(
    '/search',
    {
      part: 'snippet',
      q: `${query} recipe`,
      type: 'video',
      videoCategoryId: '26',   // Howto & Style
      maxResults: String(maxResults),
      relevanceLanguage: 'en',
      safeSearch: 'strict',
    },
  );

  const videoIds = search.items.map((i) => i.id.videoId).join(',');
  if (!videoIds) return [];

  const details = await ytFetch<{ items: Array<{ id: string; contentDetails: { duration: string } }> }>(
    '/videos',
    { part: 'contentDetails', id: videoIds },
  );

  const durationMap = new Map(details.items.map((v) => [v.id, v.contentDetails.duration]));

  return search.items.map((item) => {
    const dur = durationMap.get(item.id.videoId) ?? 'PT0S';
    return {
      videoId: item.id.videoId,
      title: item.snippet.title,
      description: item.snippet.description,
      thumbnailUrl: item.snippet.thumbnails.medium.url,
      channelTitle: item.snippet.channelTitle,
      duration: dur,
      durationSeconds: isoToSeconds(dur),
      publishedAt: item.snippet.publishedAt,
    };
  });
}

// ────────────────────────────────────────────────────────────
// Fetch videos from a saved playlist
// ────────────────────────────────────────────────────────────
export async function fetchPlaylistVideos(playlistId: string, maxResults = 20): Promise<YouTubeVideo[]> {
  const items = await ytFetch<{
    items: Array<{
      snippet: {
        resourceId: { videoId: string };
        title: string;
        description: string;
        thumbnails: { medium: { url: string } };
        videoOwnerChannelTitle: string;
        publishedAt: string;
      };
    }>;
  }>(
    '/playlistItems',
    { part: 'snippet', playlistId, maxResults: String(maxResults) },
  );

  const videoIds = items.items.map((i) => i.snippet.resourceId.videoId).join(',');
  if (!videoIds) return [];

  const details = await ytFetch<{ items: Array<{ id: string; contentDetails: { duration: string } }> }>(
    '/videos',
    { part: 'contentDetails', id: videoIds },
  );

  const durationMap = new Map(details.items.map((v) => [v.id, v.contentDetails.duration]));

  return items.items.map((item) => {
    const vid = item.snippet.resourceId.videoId;
    const dur = durationMap.get(vid) ?? 'PT0S';
    return {
      videoId: vid,
      title: item.snippet.title,
      description: item.snippet.description,
      thumbnailUrl: item.snippet.thumbnails.medium.url,
      channelTitle: item.snippet.videoOwnerChannelTitle ?? '',
      duration: dur,
      durationSeconds: isoToSeconds(dur),
      publishedAt: item.snippet.publishedAt,
    };
  });
}

// ────────────────────────────────────────────────────────────
// Parse playlist ID from any YouTube URL
// ────────────────────────────────────────────────────────────
export function parseYouTubePlaylistId(url: string): string | null {
  const m = url.match(/[?&]list=([A-Za-z0-9_-]+)/);
  return m ? m[1] : null;
}

// ────────────────────────────────────────────────────────────
// Fetch all videos in a playlist (max 50 per call)
// ────────────────────────────────────────────────────────────
export async function fetchPlaylistItems(playlistId: string, maxResults = 50): Promise<YouTubeVideo[]> {
  type Item = {
    snippet: {
      title: string; description: string; publishedAt: string; channelTitle: string;
      thumbnails: { medium?: { url: string } };
      resourceId: { videoId: string };
    };
  };
  const data = await ytFetch<{ items: Item[] }>(
    '/playlistItems',
    { part: 'snippet', playlistId, maxResults: String(Math.min(maxResults, 50)) },
  );

  const validItems = data.items.filter((i) => i.snippet.resourceId.videoId !== 'deleted');
  if (!validItems.length) return [];

  const ids = validItems.map((i) => i.snippet.resourceId.videoId).join(',');
  const details = await ytFetch<{ items: Array<{ id: string; contentDetails: { duration: string } }> }>(
    '/videos', { part: 'contentDetails', id: ids },
  );
  const durMap: Record<string, string> = {};
  details.items.forEach((i) => { durMap[i.id] = i.contentDetails.duration; });

  return validItems.map((item) => {
    const vid = item.snippet.resourceId.videoId;
    const dur = durMap[vid] ?? '';
    return {
      videoId:         vid,
      title:           item.snippet.title,
      description:     item.snippet.description,
      thumbnailUrl:    item.snippet.thumbnails.medium?.url ?? '',
      channelTitle:    item.snippet.channelTitle,
      duration:        dur,
      durationSeconds: isoToSeconds(dur),
      publishedAt:     item.snippet.publishedAt,
    };
  });
}

// ────────────────────────────────────────────────────────────
// Fetch playlist metadata
// ────────────────────────────────────────────────────────────
export async function fetchPlaylistInfo(playlistId: string): Promise<YouTubePlaylist | null> {
  const data = await ytFetch<{
    items: Array<{
      id: string;
      snippet: { title: string; description: string; thumbnails: { medium: { url: string } } };
      contentDetails: { itemCount: number };
    }>;
  }>(
    '/playlists',
    { part: 'snippet,contentDetails', id: playlistId },
  );

  const item = data.items?.[0];
  if (!item) return null;

  return {
    playlistId: item.id,
    title: item.snippet.title,
    description: item.snippet.description,
    thumbnailUrl: item.snippet.thumbnails.medium.url,
    videoCount: item.contentDetails.itemCount,
  };
}

// ────────────────────────────────────────────────────────────
// Format WhatsApp share message
// ────────────────────────────────────────────────────────────
export function formatWhatsAppMessage(params: {
  dishName: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  youtubeVideoId: string;
  youtubeTitle: string;
}): string {
  const { dishName, calories, proteinG, carbsG, fatG, youtubeVideoId, youtubeTitle } = params;
  return `🍽 *${dishName}*

📊 *Nutrition (per serving)*
• Calories: ${Math.round(calories)} kcal
• Protein: ${Math.round(proteinG)}g
• Carbs: ${Math.round(carbsG)}g
• Fat: ${Math.round(fatG)}g

🎥 *How to cook it:*
${youtubeTitle}
https://youtu.be/${youtubeVideoId}

_Shared via Dindin_ 💚`;
}
