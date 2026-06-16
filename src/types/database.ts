// Auto-generated types mirroring the Supabase schema
// Update whenever schema.sql changes

export type DietaryRestriction =
  | 'vegetarian' | 'vegan' | 'pescatarian'
  | 'gluten-free' | 'dairy-free' | 'nut-free'
  | 'halal' | 'kosher' | 'low-carb' | 'keto';

export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
export type WeightGoal   = 'lose' | 'maintain' | 'gain';
export type Gender       = 'male' | 'female' | 'other' | 'prefer_not_to_say';
export type MealType     = 'breakfast' | 'lunch' | 'dinner' | 'snack';
export type MealSource   = 'home_cooked' | 'restaurant' | 'delivery' | 'other';
export type CoupleStatus = 'pending' | 'active' | 'paused';
export type HealthSource = 'apple_health' | 'health_connect' | 'manual';
export type NudgeType    = 'blinkit_restock' | 'waste_prompt' | 'streak_reminder' | 'milestone';

// ────────────────────────────────────────────────────────────
// PROFILES
// ────────────────────────────────────────────────────────────
export interface Profile {
  id: string;
  display_name: string;
  avatar_url: string | null;
  // Dietary
  dietary_restrictions: DietaryRestriction[];
  allergies: string[];
  // Body metrics
  current_weight_kg: number | null;
  target_weight_kg: number | null;
  height_cm: number | null;
  date_of_birth: string | null;       // ISO date string
  gender: Gender | null;
  activity_level: ActivityLevel;
  // Goals
  weight_goal: WeightGoal;
  daily_calorie_target: number | null;
  daily_protein_g: number | null;
  daily_carbs_g: number | null;
  daily_fat_g: number | null;
  // Gamification
  cooking_streak: number;
  longest_streak: number;
  total_meals_logged: number;
  // Onboarding
  onboarding_complete: boolean;
  // Timestamps
  created_at: string;
  updated_at: string;
}

export type ProfileInsert = Omit<Profile, 'created_at' | 'updated_at' | 'cooking_streak' | 'longest_streak' | 'total_meals_logged'>;
export type ProfileUpdate = Partial<Omit<Profile, 'id' | 'created_at'>>;

// ────────────────────────────────────────────────────────────
// COUPLES
// ────────────────────────────────────────────────────────────
export interface Couple {
  id: string;
  user_a_id: string;
  user_b_id: string;
  couple_name: string | null;
  invite_code: string;
  status: CoupleStatus;
  cuisine_pref: string;
  created_at: string;
}

export interface CoupleWithProfiles extends Couple {
  user_a: Profile;
  user_b: Profile;
}

// ────────────────────────────────────────────────────────────
// INVENTORY
// ────────────────────────────────────────────────────────────
export type StockLevel = 'abundant' | 'low' | 'out';

export interface InventoryItem {
  id: string;
  couple_id: string | null;
  added_by_user_id: string;
  name: string;
  category: string | null;
  quantity: number | null;
  unit: string | null;
  purchase_date: string | null;
  expiry_date: string | null;
  low_stock_threshold: number | null;
  photo_url: string | null;
  notes: string | null;
  is_depleted: boolean;
  stock_level: StockLevel;
  created_at: string;
  updated_at: string;
}

export type InventoryItemInsert = Omit<InventoryItem, 'id' | 'created_at' | 'updated_at' | 'is_depleted' | 'stock_level'>
  & { stock_level?: StockLevel };
export type InventoryItemUpdate = Partial<Omit<InventoryItem, 'id' | 'couple_id' | 'added_by_user_id' | 'created_at'>>;

// ────────────────────────────────────────────────────────────
// MEAL LOGS
// ────────────────────────────────────────────────────────────
export interface AiMealAnalysis {
  dish_name?: string;
  ingredients?: Array<{ name: string; quantity: string; unit: string }>;
  calories?: number;
  protein_g?: number;
  carbs_g?: number;
  fat_g?: number;
  fiber_g?: number;
  serving_size?: string;
  confidence?: number;
  notes?: string;
}

export interface MealLog {
  id: string;
  user_id: string;
  couple_id: string | null;
  logged_at: string;
  meal_type: MealType | null;
  meal_source: MealSource;
  dish_name: string | null;
  description: string | null;
  photo_url: string | null;
  ai_raw_response: AiMealAnalysis | null;
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  fiber_g: number | null;
  serving_size: string | null;
  num_servings: number;
  is_shared: boolean;
  is_verified: boolean;
  youtube_video_id: string | null;
  youtube_title: string | null;
  created_at: string;
  updated_at: string;
}

export type MealLogInsert = Omit<MealLog, 'id' | 'created_at' | 'updated_at' | 'is_verified'>;
export type MealLogUpdate = Partial<Omit<MealLog, 'id' | 'user_id' | 'created_at'>>;

// ────────────────────────────────────────────────────────────
// WEIGHT LOGS
// ────────────────────────────────────────────────────────────
export interface WeightLog {
  id: string;
  user_id: string;
  logged_at: string;
  weight_kg: number;
  body_fat_pct: number | null;
  notes: string | null;
  created_at: string;
}

export type WeightLogInsert = Omit<WeightLog, 'id' | 'created_at'>;

// ────────────────────────────────────────────────────────────
// WASTE LOGS
// ────────────────────────────────────────────────────────────
export interface WasteItem {
  name: string;
  qty: number;
  unit: string;
  calories: number;
}

export interface WasteLog {
  id: string;
  couple_id: string;
  logged_by_user_id: string;
  logged_date: string;
  photo_url: string | null;
  estimated_weight_g: number | null;
  estimated_calories: number | null;
  waste_items: WasteItem[] | null;
  notes: string | null;
  created_at: string;
}

export type WasteLogInsert = Omit<WasteLog, 'id' | 'created_at'>;

// ────────────────────────────────────────────────────────────
// SAVED PLAYLISTS
// ────────────────────────────────────────────────────────────
export interface SavedPlaylist {
  id: string;
  couple_id: string;
  added_by_user_id: string;
  youtube_playlist_id: string;
  title: string | null;
  description: string | null;
  thumbnail_url: string | null;
  video_count: number | null;
  tags: string[];
  created_at: string;
}

// ────────────────────────────────────────────────────────────
// HEALTH DATA (wearable placeholder)
// ────────────────────────────────────────────────────────────
export interface HealthData {
  id: string;
  user_id: string;
  data_date: string;
  source: HealthSource | null;
  active_calories_burned: number | null;
  resting_calories: number | null;
  steps: number | null;
  active_minutes: number | null;
  sleep_hours: number | null;
  heart_rate_avg: number | null;
  hrv_ms: number | null;
  raw_data: Record<string, unknown> | null;
  created_at: string;
}

export type HealthDataInsert = Omit<HealthData, 'id' | 'created_at'>;

// ────────────────────────────────────────────────────────────
// DAILY SUMMARIES (calendar data)
// ────────────────────────────────────────────────────────────
export interface DailySummary {
  id: string;
  user_id: string;
  couple_id: string | null;
  summary_date: string;
  total_calories_eaten: number;
  total_protein_g: number;
  total_carbs_g: number;
  total_fat_g: number;
  calories_burned: number;
  calorie_deficit: number;        // GENERATED column
  thumbnail_url: string | null;
  meal_count: number;
  has_weight_log: boolean;
  has_fridge_photo: boolean;
  streak_active: boolean;
  created_at: string;
  updated_at: string;
}

export type DailySummaryUpsert = Omit<DailySummary, 'id' | 'calorie_deficit' | 'created_at' | 'updated_at'>;

// ────────────────────────────────────────────────────────────
// CALENDAR VIEW (rich type for the calendar screen)
// ────────────────────────────────────────────────────────────
export interface CalendarDay {
  date: string;                       // 'YYYY-MM-DD'
  hasData: boolean;
  thumbnailUrl: string | null;
  mealCount: number;
  hasWeightLog: boolean;
  hasFridgePhoto: boolean;
  streakActive: boolean;
  // Populated when day is expanded
  mealLogs?: MealLog[];
  weightLogs?: Array<WeightLog & { user?: Pick<Profile, 'id' | 'display_name' | 'avatar_url'> }>;
  partnerWeightLogs?: WeightLog[];
}

export type CalendarMonth = Record<string, CalendarDay>; // key: 'YYYY-MM-DD'

// ────────────────────────────────────────────────────────────
// MACROS (UI helper)
// ────────────────────────────────────────────────────────────
export interface MacroTargets {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

export interface MacroProgress {
  targets: MacroTargets;
  consumed: MacroTargets;
  remaining: MacroTargets;
  percentages: { calories: number; protein: number; carbs: number; fat: number };
}

// ────────────────────────────────────────────────────────────
// ONBOARDING STATE
// ────────────────────────────────────────────────────────────
export interface OnboardingData {
  step: number;
  displayName: string;
  gender: Gender | null;
  dateOfBirth: string | null;
  heightCm: number | null;
  currentWeightKg: number | null;
  targetWeightKg: number | null;
  weightGoal: WeightGoal;
  activityLevel: ActivityLevel;
  dietaryRestrictions: DietaryRestriction[];
  allergies: string[];
}

// ────────────────────────────────────────────────────────────
// SUPABASE DATABASE HELPER TYPE
// ────────────────────────────────────────────────────────────
export interface Database {
  public: {
    Tables: {
      profiles:         { Row: Profile; Insert: ProfileInsert; Update: ProfileUpdate };
      couples:          { Row: Couple; Insert: Omit<Couple, 'id' | 'invite_code' | 'created_at'>; Update: Partial<Couple> };
      inventory_items:  { Row: InventoryItem; Insert: InventoryItemInsert; Update: InventoryItemUpdate };
      meal_logs:        { Row: MealLog; Insert: MealLogInsert; Update: MealLogUpdate };
      weight_logs:      { Row: WeightLog; Insert: WeightLogInsert; Update: Partial<WeightLog> };
      waste_logs:       { Row: WasteLog; Insert: WasteLogInsert; Update: Partial<WasteLog> };
      saved_playlists:  { Row: SavedPlaylist; Insert: Omit<SavedPlaylist, 'id' | 'created_at'>; Update: Partial<SavedPlaylist> };
      health_data:      { Row: HealthData; Insert: HealthDataInsert; Update: Partial<HealthData> };
      daily_summaries:  { Row: DailySummary; Insert: DailySummaryUpsert; Update: Partial<DailySummary> };
      nudges:           { Row: { id: string; couple_id: string; nudge_type: NudgeType; scheduled_for: string | null; sent_at: string | null; payload: Record<string, unknown> | null; created_at: string }; Insert: Record<string, unknown>; Update: Record<string, unknown> };
    };
    Functions: {
      my_couple_id: { Args: Record<string, never>; Returns: string | null };
    };
  };
}
