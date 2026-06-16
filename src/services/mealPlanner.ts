import { CLAUDE_API_KEY } from '@constants/env';
import { format, addDays } from 'date-fns';
import type { Profile, InventoryItem } from '@db/database';
import type { RecipeQueueItem } from '@hooks/useRecipeQueue';

export interface SuggestedMeal {
  name: string;
  type: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  calories: number;
  emoji: string;
  have: string[];
  missing: string[];
  tip: string;
  prepNote?: string;  // what needs to be done the day before (e.g. soak dal, marinate)
}

export interface DayPlan {
  label: string;
  date: string;
  meals: SuggestedMeal[];
}

export interface MealPlan {
  days: DayPlan[];
  generatedAt: string;
}

export async function generateMealPlan(params: {
  profile: Profile;
  partnerProfile?: Profile | null;
  inventory: InventoryItem[];
  recipes: RecipeQueueItem[];
  cuisine?: string;
  likedMeals?: string[];
  excludeMeals?: string[];
}): Promise<MealPlan> {
  const { profile, partnerProfile, inventory, recipes, cuisine = 'any', likedMeals = [], excludeMeals = [] } = params;

  const today = new Date();
  const dayLabels = [
    { label: 'Today',    date: format(today, 'yyyy-MM-dd') },
    { label: 'Tomorrow', date: format(addDays(today, 1), 'yyyy-MM-dd') },
    { label: format(addDays(today, 2), 'EEEE'), date: format(addDays(today, 2), 'yyyy-MM-dd') },
  ];

  // Group inventory by category, cap at 8 per category
  const byCategory: Record<string, string[]> = {};
  inventory.forEach((item) => {
    const cat = item.category ?? 'other';
    if (!byCategory[cat]) byCategory[cat] = [];
    if (byCategory[cat].length < 8) byCategory[cat].push(item.name);
  });
  const fridgeText = Object.keys(byCategory).length > 0
    ? Object.entries(byCategory).map(([c, items]) => `${c}: ${items.join(', ')}`).join('\n')
    : 'No inventory — assume a basic pantry (rice, pasta, eggs, oil, onion, garlic)';

  // Group saved recipes by meal category so the model can slot them in directly
  const recipesByCategory: Record<string, string[]> = {};
  recipes.forEach((r) => {
    const cat = r.meal_category || 'any';
    if (!recipesByCategory[cat]) recipesByCategory[cat] = [];
    if (recipesByCategory[cat].length < 4) recipesByCategory[cat].push(r.title);
  });
  const recipeHints = Object.entries(recipesByCategory)
    .map(([cat, titles]) => `${cat}: ${titles.join(', ')}`)
    .join('\n') || 'none saved yet';

  const prompt = `You are a personal nutritionist. Create a personalised 3-day meal plan (breakfast, lunch, dinner each day).

USER:
- Calorie target: ${profile.daily_calorie_target ?? 2000} kcal/day
- Protein: ${profile.daily_protein_g ?? 150}g · Carbs: ${profile.daily_carbs_g ?? 200}g · Fat: ${profile.daily_fat_g ?? 67}g
- Goal: ${profile.weight_goal ?? 'maintain'}
- Dietary restrictions: ${profile.dietary_restrictions?.join(', ') || 'none'}

FRIDGE:
${fridgeText}

SAVED RECIPES (user bookmarked these from videos/links — actively slot matching ones in as real meals, one per category at most across the 3 days, not just for inspiration):
${recipeHints}

CUISINE PREFERENCE: ${cuisine === 'any' ? 'No preference — varied and balanced' : cuisine}

WEIGHT GOAL GUIDANCE:
${profile.weight_goal === 'lose'
  ? '- Smaller portions, lean proteins, high-fibre, limit refined carbs and added fat'
  : profile.weight_goal === 'gain'
  ? '- Larger portions, calorie-dense foods, high protein, healthy fats'
  : '- Balanced portions, maintain energy and muscle'}

${partnerProfile ? `PARTNER (${partnerProfile.display_name ?? 'Partner'}):
- Calorie target: ${partnerProfile.daily_calorie_target ?? 2000} kcal/day
- Goal: ${partnerProfile.weight_goal ?? 'maintain'}
- Dietary restrictions: ${partnerProfile.dietary_restrictions?.join(', ') || 'none'}
→ Suggest ONE shared meal per slot that works for BOTH. In the "tip" field, note per-person serving sizes if goals differ (e.g. "1.5 cups for ${profile.display_name ?? 'you'}, 1 cup for ${partnerProfile.display_name ?? 'partner'}")
` : ''}
FAVOURITES (user enjoyed these — suggest similar dishes or repeat occasionally):
${likedMeals.length > 0 ? likedMeals.slice(0, 10).join(', ') : 'none yet'}

${excludeMeals.length > 0 ? `RECENTLY SUGGESTED (already shown to the user — do NOT repeat any of these, pick genuinely different dishes):
${excludeMeals.slice(0, 24).join(', ')}
` : ''}
RULES:
- Follow the cuisine preference for all meals if specified
- 4 meals per day: breakfast (~20%), lunch (~30%), snack (~15%), dinner (~35%)
- Snack must include a seasonal fruit (apple, banana, mango, etc.) + one light bite (nuts, yogurt, roasted seeds, etc.)
- Prefer fridge ingredients; keep "missing" to 1–3 items per meal
- Real, practical meals — not complex restaurant dishes
- Vary the dishes meaningfully across days and refreshes — avoid defaulting to the same staples (e.g. dal chawal, poha, sabzi roti) every time unless they're the clear best fit
- emoji = one food emoji that best represents the dish
- prepNote: ONLY for dinner or lunch that genuinely needs advance prep (e.g. "Soak dal overnight", "Marinate chicken for 4 hrs", "Make dosa batter"). Leave empty "" for simple meals.

Respond ONLY with valid JSON, no markdown:
{"days":[{"label":"Today","date":"${dayLabels[0].date}","meals":[{"name":"","type":"breakfast","calories":0,"emoji":"","have":[],"missing":[],"tip":"","prepNote":""}]},{"label":"Tomorrow","date":"${dayLabels[1].date}","meals":[]},{"label":"${dayLabels[2].label}","date":"${dayLabels[2].date}","meals":[]}]}`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': CLAUDE_API_KEY!,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) throw new Error(`Claude API error: ${res.status}`);

  const data = await res.json();
  const raw: string = data.content?.[0]?.text ?? '';
  const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

  try {
    const parsed = JSON.parse(cleaned) as { days: DayPlan[] };
    return { days: parsed.days, generatedAt: new Date().toISOString() };
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]) as { days: DayPlan[] };
      return { days: parsed.days, generatedAt: new Date().toISOString() };
    }
    throw new Error('Failed to parse meal plan');
  }
}

export async function refreshSingleMeal(params: {
  profile: Profile;
  inventory: InventoryItem[];
  mealType: string;
  cuisine: string;
  exclude: string[];
  recipes?: RecipeQueueItem[];
}): Promise<SuggestedMeal> {
  const { profile, inventory, mealType, cuisine, exclude, recipes = [] } = params;

  const fridgeItems = inventory.slice(0, 20).map((i) => i.name).join(', ') || 'basic pantry items';
  const calorieTarget =
    mealType === 'breakfast' ? Math.round((profile.daily_calorie_target ?? 2000) * 0.20) :
    mealType === 'lunch'     ? Math.round((profile.daily_calorie_target ?? 2000) * 0.30) :
    mealType === 'snack'     ? Math.round((profile.daily_calorie_target ?? 2000) * 0.15) :
                               Math.round((profile.daily_calorie_target ?? 2000) * 0.35);

  // Saved recipes matching this meal's category — offer as candidates, not exclusions
  const matchingRecipes = recipes
    .filter((r) => r.meal_category === mealType)
    .map((r) => r.title)
    .filter((title) => !exclude.includes(title))
    .slice(0, 4);

  const prompt = `Suggest one ${mealType} meal.
Cuisine: ${cuisine === 'any' ? 'any' : cuisine}
Calories: ~${calorieTarget} kcal
Dietary restrictions: ${profile.dietary_restrictions?.join(', ') || 'none'}
Fridge: ${fridgeItems}
Do NOT suggest: ${exclude.join(', ')}
${matchingRecipes.length > 0 ? `User's saved ${mealType} recipes — prefer one of these if it fits: ${matchingRecipes.join(', ')}\n` : ''}
Reply ONLY with JSON (no markdown):
{"name":"","type":"${mealType}","calories":${calorieTarget},"emoji":"","have":[],"missing":[],"tip":""}`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': CLAUDE_API_KEY!,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 256,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) throw new Error(`Claude API error: ${res.status}`);

  const data = await res.json();
  const raw: string = data.content?.[0]?.text ?? '';
  const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

  try {
    return JSON.parse(cleaned) as SuggestedMeal;
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]) as SuggestedMeal;
    throw new Error('Failed to parse replacement meal');
  }
}
