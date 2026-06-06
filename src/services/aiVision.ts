import { File } from 'expo-file-system';
import { CLAUDE_API_KEY } from '@constants/env';
import type { AiMealAnalysis } from '@db/database';

export type CameraMode = 'meal' | 'fridge' | 'waste';

export interface WasteScanResult {
  waste_items: Array<{ name: string; qty: number; unit: string; calories: number }>;
  estimated_weight_g: number;
  estimated_calories: number;
}

export interface FridgeIngredient {
  name: string;
  quantity: string;
  unit: string;
  category: string;
}

export interface FridgeScanResult {
  ingredients: FridgeIngredient[];
  recipeSuggestions: string[];
  rawResponse: string;
}

async function uriToBase64(uri: string): Promise<string> {
  return new File(uri).base64();
}

async function callClaudeVision(base64Image: string, prompt: string): Promise<string> {
  if (!CLAUDE_API_KEY) throw new Error('CLAUDE_API_KEY is not configured. Add it to your .env file.');

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': CLAUDE_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: 'image/jpeg',
                data: base64Image,
              },
            },
            { type: 'text', text: prompt },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(`Claude API error: ${response.status} — ${JSON.stringify(err)}`);
  }

  const data = await response.json();
  return (data.content?.[0]?.text as string) ?? '';
}

// ────────────────────────────────────────────────────────────
// MEAL ANALYSIS
// ────────────────────────────────────────────────────────────
const MEAL_PROMPT = `You are a professional nutritionist analyzing a food photo.

CRITICAL RULES:
1. FIRST decide: does this image show food, a meal, or edible items?
   - If NO (person, face, landscape, building, object, text, animal, blank, etc.) → respond ONLY with: {"not_food":true,"dish_name":"NOTFOOD","ingredients":[],"calories":0,"protein_g":0,"carbs_g":0,"fat_g":0,"fiber_g":0,"serving_size":"","confidence":0}
   - Do NOT guess at food if there is none. Do NOT identify objects as food.
2. If the image is too dark, blurry, or unclear to identify food → set dish_name to "UNCLEAR" and confidence below 0.2.
3. If food IS clearly visible, identify every dish or food item and estimate for the TOTAL meal:
   - dish_name: the main dish name
   - ingredients: array of {name, quantity, unit}
   - calories: total kcal
   - protein_g, carbs_g, fat_g, fiber_g: in grams
   - serving_size: e.g. "1 plate (350g)"
   - confidence: 0–1 float

Respond ONLY with valid JSON — no markdown:
{"dish_name":"","ingredients":[],"calories":0,"protein_g":0,"carbs_g":0,"fat_g":0,"fiber_g":0,"serving_size":"","confidence":0.8}`;

export async function analyzeMeal(imageUri: string): Promise<AiMealAnalysis> {
  const base64 = await uriToBase64(imageUri);
  const raw = await callClaudeVision(base64, MEAL_PROMPT);

  try {
    const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(cleaned) as AiMealAnalysis & { not_food?: boolean };

    if (parsed.not_food || parsed.dish_name === 'NOTFOOD') {
      throw new Error('NOT_FOOD');
    }
    if (!parsed.dish_name || parsed.dish_name === 'UNCLEAR' || (parsed.confidence ?? 1) < 0.2) {
      throw new Error('NOT_RECOGNIZED');
    }
    return parsed;
  } catch (e) {
    if (e instanceof Error && (e.message === 'NOT_FOOD' || e.message === 'NOT_RECOGNIZED')) throw e;
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]) as AiMealAnalysis & { not_food?: boolean };
      if (parsed.not_food || parsed.dish_name === 'NOTFOOD') throw new Error('NOT_FOOD');
      if (!parsed.dish_name || parsed.dish_name === 'UNCLEAR' || (parsed.confidence ?? 1) < 0.2) throw new Error('NOT_RECOGNIZED');
      return parsed;
    }
    throw new Error('AI returned unparseable response');
  }
}

// ────────────────────────────────────────────────────────────
// FRIDGE / PANTRY SCAN
// ────────────────────────────────────────────────────────────
const FRIDGE_PROMPT = `You are a kitchen inventory assistant analyzing a photo of a fridge or pantry.
List EVERY visible food item with its estimated quantity. Also suggest 3 simple recipes you could make with these ingredients.

Respond ONLY with valid JSON — no markdown:
{
  "ingredients": [{"name":"","quantity":"","unit":"","category":""}],
  "recipeSuggestions": ["", "", ""]
}

Categories must be one of: produce, dairy, meat, seafood, grains, condiments, beverages, frozen, other.`;

export async function scanFridge(imageUri: string): Promise<FridgeScanResult> {
  const base64 = await uriToBase64(imageUri);
  const raw = await callClaudeVision(base64, FRIDGE_PROMPT);

  try {
    const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(cleaned) as { ingredients: FridgeIngredient[]; recipeSuggestions: string[] };
    return { ...parsed, rawResponse: raw };
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]) as { ingredients: FridgeIngredient[]; recipeSuggestions: string[] };
      return { ...parsed, rawResponse: raw };
    }
    throw new Error('AI returned unparseable fridge response');
  }
}

// ────────────────────────────────────────────────────────────
// WASTE ESTIMATION
// ────────────────────────────────────────────────────────────
const WASTE_PROMPT = `You are analyzing a photo of food waste or leftovers.
Identify each food item that appears to be wasted or uneaten. Estimate total weight and caloric value of waste.

Respond ONLY with valid JSON:
{
  "waste_items": [{"name":"","qty":0,"unit":"g","calories":0}],
  "estimated_weight_g": 0,
  "estimated_calories": 0
}`;

export async function analyzeWaste(imageUri: string): Promise<WasteScanResult> {
  const base64 = await uriToBase64(imageUri);
  const raw = await callClaudeVision(base64, WASTE_PROMPT);

  try {
    const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(cleaned) as WasteScanResult;
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]) as WasteScanResult;
    throw new Error('AI returned unparseable waste response');
  }
}
