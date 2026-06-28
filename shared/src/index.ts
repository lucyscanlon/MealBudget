export interface Meal {
  id: number;
  name: string;
  photoUrl: string | null;
  tags: MealSlot[];
  isFavourite: boolean;
  recipeUrl: string | null;
  recipeNotes: string | null;
  ingredients: Ingredient[];
}

export interface Ingredient {
  id: number;
  name: string;
  weightGrams: number;
  barcode: string | null;
  groupName: string | null;
  groupCookedWeight: number | null;
}

export interface IngredientGroup {
  name: string;
  cookedWeightGrams: number;
  ingredients: Ingredient[];
}

export interface PlanEntry {
  id: number;
  mealId: number;
  meal: Meal;
  dayOfWeek: number;
  slot: MealSlot;
  portionScale: number;
  sortOrder: number;
  isTakeaway: boolean;
}

export type MealSlot = 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'dessert';

export const MEAL_SLOTS: MealSlot[] = ['breakfast', 'lunch', 'dinner', 'dessert', 'snack'];

export type BudgetStatus = 'green' | 'amber' | 'red';

export interface DayPlan {
  dayOfWeek: number;
  entries: PlanEntry[];
  budgetRatio: number;
  status: BudgetStatus;
  isDayOff: boolean;
  dayOffNote: string | null;
}

export interface WeekPlan {
  id: number;
  weekStart: string;
  days: DayPlan[];
}

export interface AdjustResult {
  entryId: number;
  newPortionScale: number;
  adjustedIngredients: { name: string; originalGrams: number; newGrams: number; groupName: string | null; caloriesPer100g: number }[];
  adjustedGroups: { name: string; originalGrams: number; newGrams: number }[];
  totalCaloriesToCut: number;
  tooSmall: boolean;
}

export interface MacroBreakdown {
  proteinGrams: number;
  carbsGrams: number;
  fatGrams: number;
}
