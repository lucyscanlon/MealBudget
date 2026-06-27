import { Router } from 'express';
import pool from '../db.js';

const router = Router();
const USER_ID = 1;

router.get('/', async (_req, res) => {
  const result = await pool.query('SELECT daily_calorie_budget FROM users WHERE id = $1', [USER_ID]);
  if (result.rows.length === 0) {
    return res.status(404).json({ error: 'User not found' });
  }
  res.json({ dailyCalorieBudget: result.rows[0].daily_calorie_budget });
});

router.put('/', async (req, res) => {
  const { dailyCalorieBudget } = req.body;
  if (!dailyCalorieBudget || typeof dailyCalorieBudget !== 'number' || dailyCalorieBudget < 100) {
    return res.status(400).json({ error: 'Invalid calorie budget' });
  }
  await pool.query('UPDATE users SET daily_calorie_budget = $1 WHERE id = $2', [dailyCalorieBudget, USER_ID]);
  res.json({ dailyCalorieBudget });
});

export default router;
