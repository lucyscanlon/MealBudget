import { Router } from 'express';
import pool from '../db.js';

const router = Router();
const USER_ID = 1;

router.get('/', async (req, res) => {
  const query = req.query.q as string;
  let result;
  if (query && query.length >= 2) {
    result = await pool.query(
      `SELECT id, name, brand, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, barcode
       FROM custom_products WHERE user_id = $1 AND name ILIKE $2 ORDER BY name LIMIT 20`,
      [USER_ID, `%${query}%`]
    );
  } else {
    result = await pool.query(
      'SELECT id, name, brand, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, barcode FROM custom_products WHERE user_id = $1 ORDER BY name',
      [USER_ID]
    );
  }
  res.json(result.rows.map((r) => ({
    id: r.id,
    name: r.name,
    brand: r.brand || '',
    imageUrl: null,
    caloriesPer100g: Number(r.calories_per_100g),
    proteinPer100g: Number(r.protein_per_100g),
    carbsPer100g: Number(r.carbs_per_100g),
    fatPer100g: Number(r.fat_per_100g),
    barcode: r.barcode || '',
  })));
});

router.post('/', async (req, res) => {
  const { name, brand, caloriesPer100g, proteinPer100g, carbsPer100g, fatPer100g, barcode } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });

  const existing = await pool.query(
    'SELECT id FROM custom_products WHERE user_id = $1 AND name = $2',
    [USER_ID, name]
  );
  if (existing.rows.length > 0) {
    await pool.query(
      `UPDATE custom_products SET brand=$1, calories_per_100g=$2, protein_per_100g=$3, carbs_per_100g=$4, fat_per_100g=$5, barcode=$6 WHERE id=$7`,
      [brand || null, caloriesPer100g || 0, proteinPer100g || 0, carbsPer100g || 0, fatPer100g || 0, barcode || null, existing.rows[0].id]
    );
    return res.json({ id: existing.rows[0].id, updated: true });
  }

  const result = await pool.query(
    `INSERT INTO custom_products (user_id, name, brand, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, barcode)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
    [USER_ID, name, brand || null, caloriesPer100g || 0, proteinPer100g || 0, carbsPer100g || 0, fatPer100g || 0, barcode || null]
  );
  res.json({ id: result.rows[0].id });
});

export default router;
