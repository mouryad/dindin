export type Platform = 'youtube' | 'instagram' | 'pinterest' | 'tiktok' | 'other';

export interface UrlMeta {
  platform: Platform;
  title: string;
  thumbnailUrl: string | null;
  videoId: string | null;
}

function detectPlatform(url: string): Platform {
  if (/youtube\.com|youtu\.be/.test(url)) return 'youtube';
  if (/instagram\.com/.test(url)) return 'instagram';
  if (/pinterest\.com|pin\.it/.test(url)) return 'pinterest';
  if (/tiktok\.com/.test(url)) return 'tiktok';
  return 'other';
}

function extractYouTubeId(url: string): string | null {
  const patterns = [
    /youtu\.be\/([^?&]+)/,
    /youtube\.com\/watch\?v=([^&]+)/,
    /youtube\.com\/shorts\/([^?&]+)/,
    /youtube\.com\/embed\/([^?&]+)/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

export async function fetchUrlMeta(url: string): Promise<UrlMeta> {
  const platform = detectPlatform(url);

  if (platform === 'youtube') {
    const videoId = extractYouTubeId(url);
    try {
      const res = await fetch(
        `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`,
      );
      if (res.ok) {
        const data = await res.json() as { title: string; thumbnail_url: string };
        return {
          platform,
          title: data.title,
          thumbnailUrl: videoId
            ? `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`
            : data.thumbnail_url,
          videoId,
        };
      }
    } catch { /* fall through */ }
    return {
      platform,
      title: 'YouTube Recipe',
      thumbnailUrl: videoId ? `https://img.youtube.com/vi/${videoId}/mqdefault.jpg` : null,
      videoId,
    };
  }

  if (platform === 'instagram') {
    return { platform, title: '', thumbnailUrl: null, videoId: null };
  }

  if (platform === 'pinterest') {
    try {
      const res = await fetch(`https://www.pinterest.com/oembed.json?url=${encodeURIComponent(url)}`);
      if (res.ok) {
        const data = await res.json() as { title: string; thumbnail_url?: string };
        return { platform, title: data.title ?? '', thumbnailUrl: data.thumbnail_url ?? null, videoId: null };
      }
    } catch { /* fall through */ }
    return { platform, title: '', thumbnailUrl: null, videoId: null };
  }

  if (platform === 'tiktok') {
    return { platform, title: '', thumbnailUrl: null, videoId: null };
  }

  return { platform: 'other', title: '', thumbnailUrl: null, videoId: null };
}

export function platformIcon(platform: Platform): string {
  switch (platform) {
    case 'youtube': return '▶️';
    case 'instagram': return '🎬';
    case 'pinterest': return '📌';
    case 'tiktok': return '🎵';
    default: return '🔗';
  }
}
