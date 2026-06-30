import { Router } from 'express';
import multer from 'multer';
import pool from '../db.js';

const router = Router();
const USER_ID = 1;

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

const ING_SELECT = 'id, meal_id, name, weight_grams, barcode, group_name, group_cooked_weight';
const ING_INSERT = `INSERT INTO ingredients (meal_id, name, weight_grams, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, barcode, group_name, group_cooked_weight)
  VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`;

function mapIngredient(i: any) {
  return {
    id: i.id,
    name: i.name,
    weightGrams: Number(i.weight_grams),
    barcode: i.barcode,
    groupName: i.group_name || null,
    groupCookedWeight: i.group_cooked_weight ? Number(i.group_cooked_weight) : null,
  };
}

function ingParams(mealId: number | string, ing: any) {
  return [mealId, ing.name, ing.weightGrams, ing.caloriesPer100g || 0, ing.proteinPer100g || 0, ing.carbsPer100g || 0, ing.fatPer100g || 0, ing.barcode || null, ing.groupName || null, ing.groupCookedWeight || null];
}

router.get('/', async (_req, res) => {
  const meals = await pool.query(
    `SELECT id, name, photo_url, tags, is_favourite, recipe_url, recipe_notes,
      (photo_data IS NOT NULL AND photo_data != '') AS has_photo
     FROM meals WHERE user_id = $1 ORDER BY is_favourite DESC, created_at DESC`,
    [USER_ID]
  );

  const mealIds = meals.rows.map((m) => m.id);
  let ingredientsByMeal: Record<number, any[]> = {};

  if (mealIds.length > 0) {
    const ingredients = await pool.query(
      `SELECT ${ING_SELECT} FROM ingredients WHERE meal_id = ANY($1)`,
      [mealIds]
    );
    for (const ing of ingredients.rows) {
      if (!ingredientsByMeal[ing.meal_id]) ingredientsByMeal[ing.meal_id] = [];
      ingredientsByMeal[ing.meal_id].push(mapIngredient(ing));
    }
  }

  res.json(
    meals.rows.map((m) => ({
      id: m.id,
      name: m.name,
      photoUrl: m.has_photo ? `/api/meals/${m.id}/photo` : (m.photo_url || null),
      tags: m.tags || [],
      isFavourite: m.is_favourite || false,
      recipeUrl: m.recipe_url || null,
      recipeNotes: m.recipe_notes || null,
      ingredients: ingredientsByMeal[m.id] || [],
    }))
  );
});

router.post('/', async (req, res) => {
  const { name, ingredients, tags, recipeUrl, recipeNotes } = req.body;
  if (!name || !ingredients || !Array.isArray(ingredients)) {
    return res.status(400).json({ error: 'Name and ingredients required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const mealResult = await client.query(
      'INSERT INTO meals (user_id, name, tags, recipe_url, recipe_notes) VALUES ($1, $2, $3, $4, $5) RETURNING id',
      [USER_ID, name, tags || [], recipeUrl || null, recipeNotes || null]
    );
    const mealId = mealResult.rows[0].id;

    for (const ing of ingredients) {
      await client.query(ING_INSERT, ingParams(mealId, ing));
      // Auto-save to custom products database
      if (ing.caloriesPer100g) {
        await client.query(
          `INSERT INTO custom_products (user_id, name, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, barcode)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT DO NOTHING`,
          [USER_ID, ing.name, ing.caloriesPer100g, ing.proteinPer100g || 0, ing.carbsPer100g || 0, ing.fatPer100g || 0, ing.barcode || null]
        ).catch(() => {});
      }
    }
    await client.query('COMMIT');

    res.status(201).json({
      id: mealId, name, photoUrl: null, tags: tags || [], isFavourite: false, recipeUrl: recipeUrl || null, recipeNotes: recipeNotes || null,
      ingredients: ingredients.map((ing: any, i: number) => ({
        id: i, name: ing.name, weightGrams: ing.weightGrams, barcode: ing.barcode,
        groupName: ing.groupName || null, groupCookedWeight: ing.groupCookedWeight || null,
      })),
    });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

router.get('/:id/ingredients', async (req, res) => {
  const ingredients = await pool.query(
    'SELECT name, weight_grams, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, barcode, group_name, group_cooked_weight FROM ingredients WHERE meal_id = $1',
    [req.params.id]
  );
  res.json(ingredients.rows.map((i) => ({
    name: i.name,
    weightGrams: Number(i.weight_grams),
    caloriesPer100g: Number(i.calories_per_100g),
    proteinPer100g: Number(i.protein_per_100g),
    carbsPer100g: Number(i.carbs_per_100g),
    fatPer100g: Number(i.fat_per_100g),
    barcode: i.barcode,
    groupName: i.group_name || null,
    groupCookedWeight: i.group_cooked_weight ? Number(i.group_cooked_weight) : null,
  })));
});

router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { name, ingredients, tags, recipeUrl, recipeNotes } = req.body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    if (name) {
      await client.query('UPDATE meals SET name = $1 WHERE id = $2 AND user_id = $3', [name, id, USER_ID]);
    }
    if (tags) {
      await client.query('UPDATE meals SET tags = $1 WHERE id = $2 AND user_id = $3', [tags, id, USER_ID]);
    }
    if (recipeUrl !== undefined) {
      await client.query('UPDATE meals SET recipe_url = $1 WHERE id = $2 AND user_id = $3', [recipeUrl || null, id, USER_ID]);
    }
    if (recipeNotes !== undefined) {
      await client.query('UPDATE meals SET recipe_notes = $1 WHERE id = $2 AND user_id = $3', [recipeNotes || null, id, USER_ID]);
    }
    if (ingredients) {
      await client.query('DELETE FROM ingredients WHERE meal_id = $1', [id]);
      for (const ing of ingredients) {
        await client.query(ING_INSERT, ingParams(id, ing));
      }
    }
    await client.query('COMMIT');
    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

router.put('/:id/favourite', async (req, res) => {
  await pool.query(
    'UPDATE meals SET is_favourite = NOT is_favourite WHERE id = $1 AND user_id = $2',
    [req.params.id, USER_ID]
  );
  const result = await pool.query('SELECT is_favourite FROM meals WHERE id = $1', [req.params.id]);
  res.json({ isFavourite: result.rows[0]?.is_favourite || false });
});

router.delete('/:id', async (req, res) => {
  await pool.query('DELETE FROM meals WHERE id = $1 AND user_id = $2', [req.params.id, USER_ID]);
  res.json({ success: true });
});

router.get('/:id/photo', async (req, res) => {
  const result = await pool.query('SELECT photo_data FROM meals WHERE id = $1 AND user_id = $2', [req.params.id, USER_ID]);
  const photo = result.rows[0]?.photo_data;
  if (!photo) return res.status(404).end();
  // photo_data is stored as data:image/jpeg;base64,<data>
  const match = photo.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return res.status(404).end();
  const buf = Buffer.from(match[2], 'base64');
  res.setHeader('Content-Type', match[1]);
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  res.send(buf);
});

router.post('/:id/photo', upload.single('photo'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const base64 = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
  await pool.query('UPDATE meals SET photo_data = $1 WHERE id = $2 AND user_id = $3', [base64, req.params.id, USER_ID]);
  res.json({ photoUrl: `/api/meals/${req.params.id}/photo` });
});

export default router;
