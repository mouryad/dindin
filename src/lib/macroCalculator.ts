import type { ActivityLevel, WeightGoal, Gender, MacroTargets } from '@db/database';

const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary:   1.2,
  light:       1.375,
  moderate:    1.55,
  active:      1.725,
  very_active: 1.9,
};

// Mifflin-St Jeor equation
function calculateBMR(
  weightKg: number,
  heightCm: number,
  ageYears: number,
  gender: Gender,
): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * ageYears;
  return gender === 'male' ? base + 5 : base - 161;
}

function getAgeFromDOB(dob: string): number {
  const birth = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

export function calculateDailyTargets(params: {
  weightKg: number;
  targetWeightKg: number;
  heightCm: number;
  dateOfBirth: string;
  gender: Gender;
  activityLevel: ActivityLevel;
  weightGoal: WeightGoal;
}): MacroTargets {
  const { weightKg, heightCm, dateOfBirth, gender, activityLevel, weightGoal } = params;

  const age = getAgeFromDOB(dateOfBirth);
  const bmr = calculateBMR(weightKg, heightCm, age, gender);
  const tdee = bmr * ACTIVITY_MULTIPLIERS[activityLevel];

  // Safe deficit/surplus: ±500 kcal/day = ~0.5 kg/week change
  const calorieDelta = weightGoal === 'lose' ? -500 : weightGoal === 'gain' ? 300 : 0;
  const calories = Math.round(Math.max(1200, tdee + calorieDelta));

  // Macro split: 30% protein, 40% carbs, 30% fat (adjustable)
  const protein_g = Math.round((calories * 0.30) / 4);
  const carbs_g   = Math.round((calories * 0.40) / 4);
  const fat_g     = Math.round((calories * 0.30) / 9);

  return { calories, protein_g, carbs_g, fat_g };
}
