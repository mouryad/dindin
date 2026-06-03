import * as FileSystem from 'expo-file-system';
import { OPENAI_API_KEY } from '@constants/env';
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
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return base64;
}

async function callOpenAIVision(base64Image: string, prompt: string): Promise<string> {
  if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is not configured');

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      max_tokens: 1000,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: {
                url: `data:image/jpeg;base64,${base64Image}`,
                detail: 'high',
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
    throw new Error(`OpenAI API error: ${response.status} — ${JSON.stringify(err)}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content ?? '';
}

// ────────────────────────────────────────────────────────────
// MEAL ANALYSIS
// ────────────────────────────────────────────────────────────
const MEAL_PROMPT = `You are a professional nutritionist analyzing a food photo.
Identify every dish or food item visible. For the TOTAL meal on the plate, estimate:
- dish_name: the main dish name
- ingredients: array of {name, quantity, unit} for key ingredients
- calories: total kcal (number)
- protein_g: total protein in grams (number)
- carbs_g: total carbohydrates in grams (number)
- fat_g: total fat in grams (number)
- fiber_g: total fiber in grams (number)
- serving_size: e.g. "1 plate (350g)"
- confidence: 0–1 float representing your confidence

Respond ONLY with valid JSON matching exactly this schema — no markdown, no explanation:
{"dish_name":"","ingredients":[],"calories":0,"protein_g":0,"carbs_g":0,"fat_g":0,"fiber_g":0,"serving_size":"","confidence":0.8}`;

export async function analyzeMeal(imageUri: string): Promise<AiMealAnalysis> {
  const base64 = await uriToBase64(imageUri);
  const raw = await callOpenAIVision(base64, MEAL_PROMPT);

  try {
    const parsed = JSON.parse(raw.trim()) as AiMealAnalysis;
    return parsed;
  } catch {
    // Attempt to extract JSON if model wrapped it
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]) as AiMealAnalysis;
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
  const raw = await callOpenAIVision(base64, FRIDGE_PROMPT);

  try {
    const parsed = JSON.parse(raw.trim()) as { ingredients: FridgeIngredient[]; recipeSuggestions: string[] };
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

export async function analyzeWaste(imageUri: string): Promise<{
  waste_items: Array<{ name: string; qty: number; unit: string; calories: number }>;
  estimated_weight_g: number;
  estimated_calories: number;
}> {
  const base64 = await uriToBase64(imageUri);
  const raw = await callOpenAIVision(base64, WASTE_PROMPT);

  try {
    return JSON.parse(raw.trim());
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error('AI returned unparseable waste response');
  }
}
