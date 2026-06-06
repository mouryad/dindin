import { CLAUDE_API_KEY } from '@constants/env';
import type { RecipeQueueItem } from '@hooks/useRecipeQueue';

export interface DailySuggestions {
  breakfast: string;
  lunch: string;
  dinner: string;
  breakfastQueue: RecipeQueueItem | null;
  lunchQueue: RecipeQueueItem | null;
  dinnerQueue: RecipeQueueItem | null;
}

export async function generateDailySuggestions(params: {
  dietaryRestrictions: string[];
  allergies: string[];
  savedRecipes: RecipeQueueItem[];
}): Promise<DailySuggestions> {
  const { dietaryRestrictions, allergies, savedRecipes } = params;

  // Find matching recipes from queue for each meal type
  const breakfastQueue = savedRecipes.find((r) => r.meal_category === 'breakfast') ?? null;
  const lunchQueue = savedRecipes.find((r) => r.meal_category === 'lunch') ?? null;
  const dinnerQueue = savedRecipes.find((r) => r.meal_category === 'dinner') ?? null;

  if (!CLAUDE_API_KEY) {
    return {
      breakfast: breakfastQueue?.title ?? 'Oats with banana',
      lunch: lunchQueue?.title ?? 'Dal chawal',
      dinner: dinnerQueue?.title ?? 'Sabzi with roti',
      breakfastQueue, lunchQueue, dinnerQueue,
    };
  }

  const queueLines = savedRecipes.slice(0, 8).map(
    (r) => `• ${r.title} [${r.meal_category}]`,
  ).join('\n') || 'None saved yet';

  const prompt = `You are a friendly meal planner. Suggest one dish for breakfast, lunch, and dinner today.

User's saved recipe queue:
${queueLines}

Dietary restrictions: ${dietaryRestrictions.join(', ') || 'none'}
Allergies: ${allergies.join(', ') || 'none'}

Rules:
- If a saved recipe matches the meal type, use its exact title
- Otherwise suggest a simple, realistic home-cooked dish
- Keep each suggestion under 6 words
- No markdown, no explanation

Respond with valid JSON only:
{"breakfast":"","lunch":"","dinner":""}`;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 128,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    const data = await res.json();
    const text = (data.content?.[0]?.text as string) ?? '';
    const parsed = JSON.parse(text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()) as {
      breakfast: string; lunch: string; dinner: string;
    };
    return { ...parsed, breakfastQueue, lunchQueue, dinnerQueue };
  } catch {
    return {
      breakfast: breakfastQueue?.title ?? 'Poha or upma',
      lunch: lunchQueue?.title ?? 'Dal rice',
      dinner: dinnerQueue?.title ?? 'Sabzi with roti',
      breakfastQueue, lunchQueue, dinnerQueue,
    };
  }
}
