import { CLAUDE_API_KEY } from '@constants/env';
import type { SuggestedMeal } from './mealPlanner';

export interface HindiRecipe {
  nameHindi: string;
  ingredientsHindi: string[];
  steps: string[];       // Hindi cooking steps
  stepsEnglish: string[]; // English cooking steps (for non-Hindi speakers)
}

export async function translateMealToHindi(meal: SuggestedMeal): Promise<HindiRecipe> {
  const allIngredients = [...meal.have, ...meal.missing].join(', ') || 'common kitchen ingredients';

  const prompt = `You are a bilingual cooking assistant. For this meal, provide:
1. The dish name in Hindi (Devanagari script)
2. A list of ingredients in Hindi
3. Simple step-by-step cooking instructions in Hindi (5–8 steps, in Devanagari)
4. The same steps in English (simple language a cook can follow)

Meal: ${meal.name}
Ingredients available: ${allIngredients}
Tip: ${meal.tip}

Respond ONLY with valid JSON, no markdown:
{"nameHindi":"","ingredientsHindi":[],"steps":[],"stepsEnglish":[]}`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': CLAUDE_API_KEY!,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) throw new Error(`Translation failed: ${res.status}`);

  const data = await res.json();
  const raw: string = data.content?.[0]?.text ?? '';
  const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

  try {
    return JSON.parse(cleaned) as HindiRecipe;
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]) as HindiRecipe;
    throw new Error('Could not parse Hindi recipe');
  }
}
