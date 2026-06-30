import { Router } from 'express';
import pool from '../db.js';
import { getDayCaloriesAndVeg, getBudget, calcStatus } from '../services/budgetService.js';
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
    `SELECT pe.id, pe.meal_id, pe.day_of_week, pe.slot, pe.portion_scale, pe.sort_order, pe.is_takeaway, pe.custom_weights,
            m.name as meal_name, m.tags as meal_tags, (m.photo_data IS NOT NULL AND m.photo_data != '') AS has_photo, m.photo_url
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

  // Load day-off data
  const daysOff = await pool.query('SELECT day_of_week, note FROM day_off WHERE plan_id = $1', [planId]);
  const dayOffMap = new Map<number, string | null>();
  for (const row of daysOff.rows) {
    dayOffMap.set(row.day_of_week, row.note || null);
  }

  const days = [];
  for (let d = 0; d < 7; d++) {
    const isDayOff = dayOffMap.has(d);
    const dayEntries = entries.rows
      .filter((e) => e.day_of_week === d)
      .map((e) => {
        const cwMap: Record<string, number> = {};
        if (e.custom_weights) {
          for (const cw of e.custom_weights) cwMap[cw.name] = cw.grams;
        }
        return {
          id: e.id,
          mealId: e.meal_id,
          meal: {
            id: e.meal_id,
            name: e.is_takeaway ? 'Takeaway' : e.meal_name,
            tags: e.meal_tags || [],
            photoUrl: e.has_photo ? `/api/meals/${e.meal_id}/photo` : (e.photo_url || null),
            ingredients: e.is_takeaway ? [] : (ingredientsByMeal[e.meal_id] || []).map((ing: any) => ({
              ...ing,
              weightGrams: cwMap[ing.name] !== undefined
                ? cwMap[ing.name]
                : Math.round(ing.weightGrams * Number(e.portion_scale)),
            })),
          },
          dayOfWeek: e.day_of_week,
          slot: e.slot,
          portionScale: Number(e.portion_scale),
          sortOrder: e.sort_order,
          isTakeaway: e.is_takeaway || false,
          hasCustomWeights: !!e.custom_weights,
        };
      });

    // Veg calories increase the effective budget rather than counting against it
    const { consumed, vegBonus } = isDayOff ? { consumed: 0, vegBonus: 0 } : await getDayCaloriesAndVeg(planId, d);
    const effectiveBudget = budget + vegBonus;
    const ratio = effectiveBudget > 0 ? consumed / effectiveBudget : 0;

    days.push({
      dayOfWeek: d,
      entries: dayEntries,
      budgetRatio: Math.round(ratio * 100) / 100,
      status: isDayOff ? 'green' as const : calcStatus(consumed, effectiveBudget),
      isDayOff,
      dayOffNote: dayOffMap.get(d) || null,
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
  // customWeights: { name: string, grams: number }[]
  const entry = await pool.query('SELECT meal_id FROM plan_entries WHERE id = $1', [targetEntryId]);
  if (entry.rows.length === 0) return res.status(404).json({ error: 'Entry not found' });

  // Store per-ingredient weights as JSONB; compute calorie-weighted portion_scale for budget display
  const ingredients = await pool.query(
    'SELECT name, weight_grams, calories_per_100g FROM ingredients WHERE meal_id = $1',
    [entry.rows[0].meal_id]
  );

  let originalCals = 0;
  let customCals = 0;
  const cwMap: Record<string, number> = {};
  for (const cw of customWeights) cwMap[cw.name] = cw.grams;

  for (const ing of ingredients.rows) {
    const baseCals = (Number(ing.weight_grams) / 100) * Number(ing.calories_per_100g);
    originalCals += baseCals;
    const newGrams = cwMap[ing.name] !== undefined ? cwMap[ing.name] : Number(ing.weight_grams);
    customCals += (newGrams / 100) * Number(ing.calories_per_100g);
  }

  const portionScale = originalCals > 0 ? customCals / originalCals : 1;

  await pool.query(
    'UPDATE plan_entries SET portion_scale = $1, custom_weights = $2 WHERE id = $3',
    [portionScale, JSON.stringify(customWeights.map((cw: any) => ({ name: cw.name, grams: cw.grams }))), targetEntryId]
  );
  res.json({ success: true, portionScale });
});

// Add takeaway entry
router.post('/:weekStart/takeaway', async (req, res) => {
  const { weekStart } = req.params;
  const { dayOfWeek, slot } = req.body;

  let plan = await pool.query('SELECT id FROM weekly_plans WHERE user_id = $1 AND week_start = $2', [USER_ID, weekStart]);
  if (plan.rows.length === 0) {
    plan = await pool.query('INSERT INTO weekly_plans (user_id, week_start) VALUES ($1, $2) RETURNING id', [USER_ID, weekStart]);
  }

  // Need a dummy meal for takeaway — use the first meal or create a placeholder
  const firstMeal = await pool.query('SELECT id FROM meals WHERE user_id = $1 LIMIT 1', [USER_ID]);
  if (firstMeal.rows.length === 0) return res.status(400).json({ error: 'Create at least one meal first' });

  const result = await pool.query(
    'INSERT INTO plan_entries (plan_id, meal_id, day_of_week, slot, is_takeaway) VALUES ($1, $2, $3, $4, true) RETURNING id',
    [plan.rows[0].id, firstMeal.rows[0].id, dayOfWeek, slot]
  );
  res.json({ id: result.rows[0].id });
});

// Toggle day off
router.post('/:weekStart/dayoff', async (req, res) => {
  const { weekStart } = req.params;
  const { dayOfWeek, note } = req.body;

  let plan = await pool.query('SELECT id FROM weekly_plans WHERE user_id = $1 AND week_start = $2', [USER_ID, weekStart]);
  if (plan.rows.length === 0) {
    plan = await pool.query('INSERT INTO weekly_plans (user_id, week_start) VALUES ($1, $2) RETURNING id', [USER_ID, weekStart]);
  }
  const planId = plan.rows[0].id;

  const existing = await pool.query('SELECT id FROM day_off WHERE plan_id = $1 AND day_of_week = $2', [planId, dayOfWeek]);
  if (existing.rows.length > 0) {
    await pool.query('DELETE FROM day_off WHERE id = $1', [existing.rows[0].id]);
    res.json({ isDayOff: false });
  } else {
    await pool.query('INSERT INTO day_off (plan_id, day_of_week, note) VALUES ($1, $2, $3)', [planId, dayOfWeek, note || null]);
    res.json({ isDayOff: true });
  }
});

router.get('/:weekStart/:day/macros', async (req, res) => {
  const { weekStart, day } = req.params;
  const dayOfWeek = Number(day);

  const plan = await pool.query('SELECT id FROM weekly_plans WHERE user_id = $1 AND week_start = $2', [USER_ID, weekStart]);
  if (plan.rows.length === 0) return res.json({ proteinGrams: 0, carbsGrams: 0, fatGrams: 0 });

  const result = await pool.query(
    `SELECT pe.id, pe.portion_scale, pe.custom_weights, i.name, i.weight_grams, i.protein_per_100g, i.carbs_per_100g, i.fat_per_100g
     FROM plan_entries pe
     JOIN ingredients i ON i.meal_id = pe.meal_id
     WHERE pe.plan_id = $1 AND pe.day_of_week = $2`,
    [plan.rows[0].id, dayOfWeek]
  );

  const entryCwMap = new Map<number, Record<string, number>>();
  for (const row of result.rows) {
    if (row.custom_weights && !entryCwMap.has(row.id)) {
      const cw: Record<string, number> = {};
      for (const item of row.custom_weights) cw[item.name] = item.grams;
      entryCwMap.set(row.id, cw);
    }
  }

  let protein = 0, carbs = 0, fat = 0;
  for (const row of result.rows) {
    const cw = entryCwMap.get(row.id);
    const weight = cw && cw[row.name] !== undefined
      ? cw[row.name]
      : Number(row.weight_grams) * Number(row.portion_scale);
    protein += (weight / 100) * Number(row.protein_per_100g);
    carbs += (weight / 100) * Number(row.carbs_per_100g);
    fat += (weight / 100) * Number(row.fat_per_100g);
  }

  res.json({ proteinGrams: Math.round(protein), carbsGrams: Math.round(carbs), fatGrams: Math.round(fat) });
});

router.get('/:weekStart/:day/calories', async (req, res) => {
  const { weekStart, day } = req.params;
  const dayOfWeek = Number(day);

  const plan = await pool.query('SELECT id FROM weekly_plans WHERE user_id = $1 AND week_start = $2', [USER_ID, weekStart]);
  if (plan.rows.length === 0) return res.json({ totalCalories: 0 });

  const { consumed } = await getDayCaloriesAndVeg(plan.rows[0].id, dayOfWeek);
  res.json({ totalCalories: Math.round(consumed) });
});

export default router;
