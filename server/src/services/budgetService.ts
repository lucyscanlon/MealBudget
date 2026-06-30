import pool from '../db.js';
import type { BudgetStatus } from 'shared';

const USER_ID = 1;

function entryCalories(rows: any[], entryId: number, cwMap: Record<string, number> | undefined, portionScale: number): number {
  return rows
    .filter((r) => r.id === entryId)
    .reduce((sum, r) => {
      const weight = cwMap && cwMap[r.name] !== undefined
        ? cwMap[r.name]
        : Number(r.weight_grams) * portionScale;
      return sum + (weight / 100) * Number(r.calories_per_100g);
    }, 0);
}

export async function getDayCaloriesAndVeg(planId: number, dayOfWeek: number): Promise<{ consumed: number; vegBonus: number }> {
  const result = await pool.query(
    `SELECT pe.id, pe.portion_scale, pe.custom_weights, m.tags,
            i.name, i.weight_grams, i.calories_per_100g
     FROM plan_entries pe
     JOIN meals m ON m.id = pe.meal_id
     JOIN ingredients i ON i.meal_id = pe.meal_id
     WHERE pe.plan_id = $1 AND pe.day_of_week = $2 AND (pe.is_takeaway IS NULL OR pe.is_takeaway = false)`,
    [planId, dayOfWeek]
  );

  const entryCwMap = new Map<number, Record<string, number>>();
  const entryIsVeg = new Map<number, boolean>();
  const entryScale = new Map<number, number>();

  for (const row of result.rows) {
    if (!entryCwMap.has(row.id)) {
      const cw: Record<string, number> = {};
      if (row.custom_weights) for (const item of row.custom_weights) cw[item.name] = item.grams;
      entryCwMap.set(row.id, cw);
      entryIsVeg.set(row.id, Array.isArray(row.tags) && row.tags.includes('fruit_veg'));
      entryScale.set(row.id, Number(row.portion_scale));
    }
  }

  let consumed = 0;
  let vegBonus = 0;
  for (const row of result.rows) {
    const cw = entryCwMap.get(row.id);
    const scale = entryScale.get(row.id) ?? 1;
    const weight = cw && cw[row.name] !== undefined ? cw[row.name] : Number(row.weight_grams) * scale;
    const cals = (weight / 100) * Number(row.calories_per_100g);
    if (entryIsVeg.get(row.id)) {
      vegBonus += cals;
    } else {
      consumed += cals;
    }
  }
  return { consumed, vegBonus };
}

export async function getDayCalories(planId: number, dayOfWeek: number): Promise<number> {
  const { consumed } = await getDayCaloriesAndVeg(planId, dayOfWeek);
  return consumed;
}

export async function getBudget(): Promise<number> {
  const result = await pool.query('SELECT daily_calorie_budget FROM users WHERE id = $1', [USER_ID]);
  return result.rows[0]?.daily_calorie_budget || 2000;
}

export function calcStatus(totalCalories: number, budget: number): BudgetStatus {
  const over = totalCalories - budget;
  if (over <= 0) return 'green';
  if (over <= 80) return 'amber';
  return 'red';
}
