import * as Notifications from 'expo-notifications';
import type { RecipeQueueItem } from '@hooks/useRecipeQueue';
import { generateDailySuggestions } from './mealSuggestions';

const MORNING_ID = 'dindin-morning-meal';
const EVENING_ID = 'dindin-evening-meal';

export async function scheduleDailyMealNotifications(params: {
  dietaryRestrictions: string[];
  allergies: string[];
  savedRecipes: RecipeQueueItem[];
}): Promise<void> {
  const { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') return;

  // Generate today's suggestions (used for tomorrow's notifications)
  let suggestions;
  try {
    suggestions = await generateDailySuggestions(params);
  } catch {
    suggestions = {
      breakfast: 'Something healthy',
      lunch: 'A balanced meal',
      dinner: 'A warm dinner',
      breakfastQueue: null, lunchQueue: null, dinnerQueue: null,
    };
  }

  const morningBody = buildMorningBody(suggestions.breakfast, suggestions.lunch, suggestions.breakfastQueue, suggestions.lunchQueue);
  const eveningBody = buildEveningBody(suggestions.dinner, suggestions.dinnerQueue);

  // Cancel old ones and reschedule with fresh content
  await Notifications.cancelScheduledNotificationAsync(MORNING_ID).catch(() => {});
  await Notifications.cancelScheduledNotificationAsync(EVENING_ID).catch(() => {});

  await Notifications.scheduleNotificationAsync({
    identifier: MORNING_ID,
    content: {
      title: 'Good morning! 🌅 Today\'s cooking plan',
      body: morningBody,
      data: { screen: 'recipes' },
      sound: true,
    },
    trigger: { hour: 8, minute: 0, repeats: true } as Notifications.CalendarTriggerInput,
  });

  await Notifications.scheduleNotificationAsync({
    identifier: EVENING_ID,
    content: {
      title: 'Dinner time 🌙 Send your cook the plan',
      body: eveningBody,
      data: { screen: 'recipes' },
      sound: true,
    },
    trigger: { hour: 17, minute: 0, repeats: true } as Notifications.CalendarTriggerInput,
  });
}

function buildMorningBody(
  breakfast: string,
  lunch: string,
  bq: RecipeQueueItem | null,
  lq: RecipeQueueItem | null,
): string {
  const parts: string[] = [];
  parts.push(`☀️ Breakfast: ${breakfast}${bq ? ' (in your queue)' : ''}`);
  parts.push(`🍱 Lunch: ${lunch}${lq ? ' (in your queue)' : ''}`);
  return parts.join(' · ');
}

function buildEveningBody(dinner: string, dq: RecipeQueueItem | null): string {
  return `🥘 Tonight: ${dinner}${dq ? ' — tap to see the recipe you saved' : ' — check your queue for ideas'}`;
}
