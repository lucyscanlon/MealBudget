import { Router } from 'express';
import { lookupBarcode, searchByName } from '../services/openfoodfacts.js';
import { lookupTescoUrl } from '../services/tesco.js';
import pool from '../db.js';

const router = Router();
const USER_ID = 1;

router.get('/search', async (req, res) => {
  const query = req.query.q as string;
  if (!query || query.length < 2) return res.json([]);

  // Search custom products first
  const customResult = await pool.query(
    `SELECT name, brand, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, barcode
     FROM custom_products WHERE user_id = $1 AND name ILIKE $2 LIMIT 5`,
    [USER_ID, `%${query}%`]
  );
  const customProducts = customResult.rows.map((r) => ({
    name: r.name,
    brand: r.brand ? `${r.brand} (saved)` : '(saved)',
    imageUrl: null,
    caloriesPer100g: Number(r.calories_per_100g),
    proteinPer100g: Number(r.protein_per_100g),
    carbsPer100g: Number(r.carbs_per_100g),
    fatPer100g: Number(r.fat_per_100g),
    barcode: r.barcode || '',
  }));

  // Then search external APIs
  const apiResults = await searchByName(query);

  // Custom products appear first
  res.json([...customProducts, ...apiResults]);
});

router.post('/tesco', async (req, res) => {
  const { url } = req.body;
  if (!url || !url.includes('tesco.com')) return res.status(400).json({ error: 'Invalid Tesco URL' });
  const product = await lookupTescoUrl(url);
  if (!product) return res.status(404).json({ error: 'Could not extract product data' });
  res.json(product);
});

router.get('/:code', async (req, res) => {
  const product = await lookupBarcode(req.params.code);
  if (!product) return res.status(404).json({ error: 'Product not found' });
  res.json(product);
});

export default router;
