import { Router } from 'express';
import pool from '../db.js';
import { getDayCalories, getBudget, calcStatus } from '../services/budgetService.js';
import { adjustMealPortion } from '../services/adjustService.js';

const router = Router();
const USER_ID = 1;

router.get('/:weekStart', async (req, res) => {
  const { weekStart } = req.params;
  const budget = await getBudget();

  let plan = await pool.query('SELECT id FROM weekly_plans WHERE user_id = $1 AND week_start = $2', [USER_ID, weekStart]);
  if (plan.rows.length === 0) {
    plan = await pool.query('INSERT INTO weekly_plans (user_id, week_start) VALUES ($1, $2) RETURNING id', [USER_ID, weekStart]);
  }
  const planId = plan.rows[0].id;

  const entries = await pool.query(
    `SELECT pe.id, pe.meal_id, pe.day_of_week, pe.slot, pe.portion_scale, pe.sort_order,
            m.name as meal_name, COALESCE(m.photo_data, m.photo_url) as photo
     FROM plan_entries pe
     JOIN meals m ON m.id = pe.meal_id
     WHERE pe.plan_id = $1
     ORDER BY pe.day_of_week, pe.sort_order`,
    [planId]
  );

  const mealIds = [...new Set(entries.rows.map((e) => e.meal_id))];
  let ingredientsByMeal: Record<number, any[]> = {};
  if (mealIds.length > 0) {
    const ingredients = await pool.query(
      'SELECT meal_id, id, name, weight_grams, barcode, group_name, group_cooked_weight FROM ingredients WHERE meal_id = ANY($1)',
      [mealIds]
    );
    for (const ing of ingredients.rows) {
      if (!ingredientsByMeal[ing.meal_id]) ingredientsByMeal[ing.meal_id] = [];
      ingredientsByMeal[ing.meal_id].push({
        id: ing.id,
        name: ing.name,
        weightGrams: Number(ing.weight_grams),
        barcode: ing.barcode,
        groupName: ing.group_name || null,
        groupCookedWeight: ing.group_cooked_weight ? Number(ing.group_cooked_weight) : null,
      });
    }
  }

  const days = [];
  for (let d = 0; d < 7; d++) {
    const dayEntries = entries.rows
      .filter((e) => e.day_of_week === d)
      .map((e) => ({
        id: e.id,
        mealId: e.meal_id,
        meal: {
          id: e.meal_id,
          name: e.meal_name,
          photoUrl: e.photo || null,
          ingredients: (ingredientsByMeal[e.meal_id] || []).map((ing: any) => ({
            ...ing,
            weightGrams: Math.round(ing.weightGrams * Number(e.portion_scale)),
          })),
        },
        dayOfWeek: e.day_of_week,
        slot: e.slot,
        portionScale: Number(e.portion_scale),
        sortOrder: e.sort_order,
      }));

    const totalCals = await getDayCalories(planId, d);
    const ratio = budget > 0 ? totalCals / budget : 0;

    days.push({
      dayOfWeek: d,
      entries: dayEntries,
      budgetRatio: Math.round(ratio * 100) / 100,
      status: calcStatus(totalCals, budget),
    });
  }

  res.json({ id: planId, weekStart, days });
});

router.post('/:weekStart/entries', async (req, res) => {
  const { weekStart } = req.params;
  const { mealId, dayOfWeek, slot } = req.body;

  let plan = await pool.query('SELECT id FROM weekly_plans WHERE user_id = $1 AND week_start = $2', [USER_ID, weekStart]);
  if (plan.rows.length === 0) {
    plan = await pool.query('INSERT INTO weekly_plans (user_id, week_start) VALUES ($1, $2) RETURNING id', [USER_ID, weekStart]);
  }
  const planId = plan.rows[0].id;

  const maxOrder = await pool.query(
    'SELECT COALESCE(MAX(sort_order), -1) as max_order FROM plan_entries WHERE plan_id = $1 AND day_of_week = $2 AND slot = $3',
    [planId, dayOfWeek, slot]
  );

  const result = await pool.query(
    'INSERT INTO plan_entries (plan_id, meal_id, day_of_week, slot, sort_order) VALUES ($1, $2, $3, $4, $5) RETURNING id',
    [planId, mealId, dayOfWeek, slot, maxOrder.rows[0].max_order + 1]
  );

  res.status(201).json({ id: result.rows[0].id });
});

router.put('/entries/:id', async (req, res) => {
  const { id } = req.params;
  const { dayOfWeek, slot, sortOrder } = req.body;
  const sets: string[] = [];
  const vals: any[] = [];
  let i = 1;

  if (dayOfWeek !== undefined) { sets.push(`day_of_week = $${i++}`); vals.push(dayOfWeek); }
  if (slot !== undefined) { sets.push(`slot = $${i++}`); vals.push(slot); }
  if (sortOrder !== undefined) { sets.push(`sort_order = $${i++}`); vals.push(sortOrder); }

  if (sets.length > 0) {
    vals.push(id);
    await pool.query(`UPDATE plan_entries SET ${sets.join(', ')} WHERE id = $${i}`, vals);
  }
  res.json({ success: true });
});

router.delete('/entries/:id', async (req, res) => {
  await pool.query('DELETE FROM plan_entries WHERE id = $1', [req.params.id]);
  res.json({ success: true });
});

router.post('/adjust', async (req, res) => {
  const { weekStart, dayOfWeek, targetEntryId } = req.body;

  const plan = await pool.query('SELECT id FROM weekly_plans WHERE user_id = $1 AND week_start = $2', [USER_ID, weekStart]);
  if (plan.rows.length === 0) return res.status(404).json({ error: 'Plan not found' });

  const budget = await getBudget();
  const result = await adjustMealPortion(plan.rows[0].id, dayOfWeek, targetEntryId, budget);
  res.json(result);
});

router.post('/adjust/custom', async (req, res) => {
  const { targetEntryId, customWeights } = req.body;
  // customWeights: { name: string, newGrams: number }[]
  // Recalculate portion_scale based on custom weights
  const entry = await pool.query('SELECT meal_id, portion_scale FROM plan_entries WHERE id = $1', [targetEntryId]);
  if (entry.rows.length === 0) return res.status(404).json({ error: 'Entry not found' });

  const ingredients = await pool.query(
    'SELECT name, weight_grams FROM ingredients WHERE meal_id = $1',
    [entry.rows[0].meal_id]
  );

  // Find the max scale across all custom weights to use as portion_scale
  // (individual ingredient weights are stored as base * portion_scale, so we need a single scale)
  // Instead, we'll use a scale of 1 and store absolute weights by adjusting base weights
  // Actually simpler: just keep portion_scale and note that the display uses custom weights
  // For now, save the overall portion_scale as the average ratio
  let totalRatio = 0;
  let count = 0;
  for (const cw of customWeights) {
    const orig = ingredients.rows.find((i: any) => i.name === cw.name);
    if (orig) {
      totalRatio += cw.newGrams / Number(orig.weight_grams);
      count++;
    }
  }
  const avgScale = count > 0 ? totalRatio / count : 1;
  await pool.query('UPDATE plan_entries SET portion_scale = $1 WHERE id = $2', [avgScale, targetEntryId]);
  res.json({ success: true, portionScale: avgScale });
});

router.get('/:weekStart/:day/macros', async (req, res) => {
  const { weekStart, day } = req.params;
  const dayOfWeek = Number(day);

  const plan = await pool.query('SELECT id FROM weekly_plans WHERE user_id = $1 AND week_start = $2', [USER_ID, weekStart]);
  if (plan.rows.length === 0) return res.json({ proteinGrams: 0, carbsGrams: 0, fatGrams: 0 });

  const result = await pool.query(
    `SELECT pe.portion_scale, i.weight_grams, i.protein_per_100g, i.carbs_per_100g, i.fat_per_100g
     FROM plan_entries pe
     JOIN ingredients i ON i.meal_id = pe.meal_id
     WHERE pe.plan_id = $1 AND pe.day_of_week = $2`,
    [plan.rows[0].id, dayOfWeek]
  );

  let protein = 0, carbs = 0, fat = 0;
  for (const row of result.rows) {
    const weight = Number(row.weight_grams) * Number(row.portion_scale);
    protein += (weight / 100) * Number(row.protein_per_100g);
    carbs += (weight / 100) * Number(row.carbs_per_100g);
    fat += (weight / 100) * Number(row.fat_per_100g);
  }

  res.json({ proteinGrams: Math.round(protein), carbsGrams: Math.round(carbs), fatGrams: Math.round(fat) });
});

export default router;
