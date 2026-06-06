import { Share, Linking, Alert } from 'react-native';

export interface MealShareData {
  dishName: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  youtubeVideoId?: string | null;
  youtubeTitle?: string | null;
}

function buildMealText(data: MealShareData): string {
  const lines = [
    `🍽 ${data.dishName}`,
    '',
    '📊 Nutrition per serving',
    `• ${Math.round(data.calories)} kcal`,
    `• Protein: ${Math.round(data.proteinG)}g`,
    `• Carbs: ${Math.round(data.carbsG)}g`,
    `• Fat: ${Math.round(data.fatG)}g`,
  ];

  if (data.youtubeVideoId && data.youtubeTitle) {
    lines.push('', `🎥 ${data.youtubeTitle}`);
    lines.push(`https://youtu.be/${data.youtubeVideoId}`);
  }

  lines.push('', '🥗 Logged on Dindin');
  return lines.join('\n');
}

// Native iOS/Android share sheet — works with WhatsApp, Instagram, Pinterest, Messages, etc.
export async function shareNative(data: MealShareData): Promise<void> {
  const message = buildMealText(data);
  const url = data.youtubeVideoId ? `https://youtu.be/${data.youtubeVideoId}` : undefined;

  await Share.share(
    { message, url },
    { dialogTitle: `Share ${data.dishName}` },
  );
}

// Open Pinterest "Pin It" with recipe video thumbnail
export async function sharePinterest(data: MealShareData): Promise<void> {
  if (!data.youtubeVideoId) {
    Alert.alert('No recipe video', 'Select a recipe video first to pin it on Pinterest.');
    return;
  }

  const videoUrl = `https://youtu.be/${data.youtubeVideoId}`;
  const description = encodeURIComponent(buildMealText(data));
  const media = encodeURIComponent(`https://img.youtube.com/vi/${data.youtubeVideoId}/mqdefault.jpg`);
  const url = encodeURIComponent(videoUrl);

  // Try Pinterest app first, fall back to web
  const appUrl = `pinterest://pin/create/button/?url=${url}&media=${media}&description=${description}`;
  const webUrl = `https://pinterest.com/pin/create/button/?url=${url}&media=${media}&description=${description}`;

  const canOpen = await Linking.canOpenURL(appUrl);
  await Linking.openURL(canOpen ? appUrl : webUrl);
}

// Open Instagram — shows share sheet or opens Instagram if installed
export async function shareInstagram(data: MealShareData): Promise<void> {
  // Instagram doesn't support programmatic feed posts from third-party apps.
  // We open the native share sheet filtered to Instagram where supported,
  // or open the Instagram app for the user to post manually.
  const canOpenInstagram = await Linking.canOpenURL('instagram://app');

  if (canOpenInstagram) {
    // Share the full meal card text via native sheet (user picks Instagram from there)
    await shareNative(data);
  } else {
    Alert.alert(
      'Instagram not found',
      'Install Instagram to share your meal, or use the "Share" button to send via other apps.',
    );
  }
}
