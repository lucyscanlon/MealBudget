import { Router } from 'express';
import { lookupBarcode, searchByName } from '../services/openfoodfacts.js';

const router = Router();

router.get('/search', async (req, res) => {
  const query = req.query.q as string;
  if (!query || query.length < 2) return res.json([]);
  const results = await searchByName(query);
  res.json(results);
});

router.get('/:code', async (req, res) => {
  const product = await lookupBarcode(req.params.code);
  if (!product) return res.status(404).json({ error: 'Product not found' });
  res.json(product);
});

export default router;
