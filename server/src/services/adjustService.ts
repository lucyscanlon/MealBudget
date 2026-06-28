import pool from '../db.js';
import type { AdjustResult } from 'shared';

export async function adjustMealPortion(
  planId: number,
  dayOfWeek: number,
  targetEntryId: number,
  budget: number
): Promise<AdjustResult> {
  const entries = await pool.query(
    `SELECT pe.id, pe.meal_id, pe.portion_scale
     FROM plan_entries pe
     WHERE pe.plan_id = $1 AND pe.day_of_week = $2`,
    [planId, dayOfWeek]
  );

  let otherCalories = 0;
  let targetEntry: { id: number; meal_id: number; portion_scale: number } | null = null;

  for (const entry of entries.rows) {
    const ingredients = await pool.query(
      'SELECT weight_grams, calories_per_100g FROM ingredients WHERE meal_id = $1',
      [entry.meal_id]
    );
    const mealCals = ingredients.rows.reduce((sum: number, ing: any) => {
      return sum + (Number(ing.weight_grams) * Number(entry.portion_scale) / 100) * Number(ing.calories_per_100g);
    }, 0);

    if (entry.id === targetEntryId) {
      targetEntry = entry;
    } else {
      otherCalories += mealCals;
    }
  }

  if (!targetEntry) throw new Error('Target entry not found');

  const targetIngredients = await pool.query(
    'SELECT name, weight_grams, calories_per_100g, group_name, group_cooked_weight FROM ingredients WHERE meal_id = $1',
    [targetEntry.meal_id]
  );

  const baseCalories = targetIngredients.rows.reduce((sum: number, ing: any) => {
    return sum + (Number(ing.weight_grams) / 100) * Number(ing.calories_per_100g);
  }, 0);

  if (baseCalories === 0) {
    return { entryId: targetEntryId, newPortionScale: 1, adjustedIngredients: [], adjustedGroups: [], totalCaloriesToCut: 0, tooSmall: false };
  }

  const available = budget - otherCalories;
  const newScale = Math.max(0, available / baseCalories);
  const tooSmall = newScale < 0.3;

  await pool.query('UPDATE plan_entries SET portion_scale = $1 WHERE id = $2', [newScale, targetEntryId]);

  const totalCaloriesToCut = Math.round((baseCalories * Number(targetEntry.portion_scale)) - (baseCalories * newScale));

  const adjustedIngredients = targetIngredients.rows.map((ing: any) => ({
    name: ing.name,
    originalGrams: Math.round(Number(ing.weight_grams) * Number(targetEntry!.portion_scale)),
    newGrams: Math.round(Number(ing.weight_grams) * newScale),
    groupName: ing.group_name || null,
    caloriesPer100g: Number(ing.calories_per_100g),
  }));

  // Build adjusted groups — show cooked weight changes
  const groupMap = new Map<string, { cookedWeight: number }>();
  for (const ing of targetIngredients.rows) {
    if (ing.group_name && ing.group_cooked_weight) {
      if (!groupMap.has(ing.group_name)) {
        groupMap.set(ing.group_name, { cookedWeight: Number(ing.group_cooked_weight) });
      }
    }
  }

  const adjustedGroups = Array.from(groupMap.entries()).map(([name, g]) => ({
    name,
    originalGrams: Math.round(g.cookedWeight * Number(targetEntry!.portion_scale)),
    newGrams: Math.round(g.cookedWeight * newScale),
  }));

  return { entryId: targetEntryId, newPortionScale: newScale, adjustedIngredients, adjustedGroups, totalCaloriesToCut, tooSmall };
}
