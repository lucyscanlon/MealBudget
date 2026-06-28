import pool from '../db.js';
import type { BudgetStatus } from 'shared';

const USER_ID = 1;

export async function getDayCalories(planId: number, dayOfWeek: number): Promise<number> {
  const result = await pool.query(
    `SELECT pe.portion_scale, i.weight_grams, i.calories_per_100g
     FROM plan_entries pe
     JOIN ingredients i ON i.meal_id = pe.meal_id
     WHERE pe.plan_id = $1 AND pe.day_of_week = $2 AND (pe.is_takeaway IS NULL OR pe.is_takeaway = false)`,
    [planId, dayOfWeek]
  );

  let total = 0;
  for (const row of result.rows) {
    const scale = Number(row.portion_scale);
    const weight = Number(row.weight_grams) * scale;
    const cals = (weight / 100) * Number(row.calories_per_100g);
    total += cals;
  }
  return total;
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
