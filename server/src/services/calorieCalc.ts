export interface ProfileData {
  weightLbs: number;
  heightCm: number;
  age: number;
  sex: 'male' | 'female';
  activityLevel: 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
  weeklyLossTarget: number;
}

const ACTIVITY_MULTIPLIERS: Record<string, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

export function calculateTDEE(profile: ProfileData): number {
  const weightKg = profile.weightLbs * 0.453592;
  // Mifflin-St Jeor
  let bmr: number;
  if (profile.sex === 'male') {
    bmr = 10 * weightKg + 6.25 * profile.heightCm - 5 * profile.age + 5;
  } else {
    bmr = 10 * weightKg + 6.25 * profile.heightCm - 5 * profile.age - 161;
  }
  return Math.round(bmr * (ACTIVITY_MULTIPLIERS[profile.activityLevel] || 1.2));
}

export function calculateDailyBudget(profile: ProfileData): number {
  const tdee = calculateTDEE(profile);
  const weeklyDeficit = profile.weeklyLossTarget * 3500;
  const dailyDeficit = weeklyDeficit / 7;
  return Math.round(Math.max(1200, tdee - dailyDeficit));
}

export function lbsToStone(lbs: number): { stone: number; pounds: number } {
  const stone = Math.floor(lbs / 14);
  const pounds = Math.round((lbs % 14) * 10) / 10;
  return { stone, pounds };
}

export function stoneToLbs(stone: number, pounds: number): number {
  return stone * 14 + pounds;
}
