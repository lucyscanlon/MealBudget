import { Router } from 'express';
import pool from '../db.js';
import { calculateDailyBudget, calculateTDEE } from '../services/calorieCalc.js';

const router = Router();
const USER_ID = 1;

router.get('/', async (_req, res) => {
  const result = await pool.query(
    'SELECT daily_calorie_budget, height_cm, age, sex, activity_level, goal_weight_lbs, weekly_loss_target FROM users WHERE id = $1',
    [USER_ID]
  );
  if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });

  const u = result.rows[0];

  // Get starting weight (first log) and current weight (latest log)
  const firstLog = await pool.query(
    'SELECT weight_lbs FROM weight_logs WHERE user_id = $1 ORDER BY logged_at ASC LIMIT 1',
    [USER_ID]
  );
  const latestLog = await pool.query(
    'SELECT weight_lbs FROM weight_logs WHERE user_id = $1 ORDER BY logged_at DESC LIMIT 1',
    [USER_ID]
  );

  res.json({
    heightCm: u.height_cm ? Number(u.height_cm) : null,
    age: u.age,
    sex: u.sex,
    activityLevel: u.activity_level,
    goalWeightLbs: u.goal_weight_lbs ? Number(u.goal_weight_lbs) : null,
    weeklyLossTarget: u.weekly_loss_target ? Number(u.weekly_loss_target) : 1,
    dailyCalorieBudget: u.daily_calorie_budget,
    startingWeightLbs: firstLog.rows[0] ? Number(firstLog.rows[0].weight_lbs) : null,
    currentWeightLbs: latestLog.rows[0] ? Number(latestLog.rows[0].weight_lbs) : null,
  });
});

router.put('/', async (req, res) => {
  const { heightCm, age, sex, activityLevel, goalWeightLbs, weeklyLossTarget, currentWeightLbs } = req.body;

  await pool.query(
    `UPDATE users SET height_cm = $1, age = $2, sex = $3, activity_level = $4, goal_weight_lbs = $5, weekly_loss_target = $6 WHERE id = $7`,
    [heightCm, age, sex, activityLevel, goalWeightLbs, weeklyLossTarget || 1, USER_ID]
  );

  // If currentWeightLbs provided, log it as the starting weight
  if (currentWeightLbs) {
    await pool.query(
      `INSERT INTO weight_logs (user_id, weight_lbs, logged_at) VALUES ($1, $2, CURRENT_DATE)
       ON CONFLICT (user_id, logged_at) DO UPDATE SET weight_lbs = $2`,
      [USER_ID, currentWeightLbs]
    );
  }

  // Recalculate calorie budget
  const weightLbs = currentWeightLbs || 150;
  const budget = calculateDailyBudget({
    weightLbs,
    heightCm: heightCm || 170,
    age: age || 30,
    sex: sex || 'female',
    activityLevel: activityLevel || 'sedentary',
    weeklyLossTarget: weeklyLossTarget || 1,
  });

  await pool.query('UPDATE users SET daily_calorie_budget = $1 WHERE id = $2', [budget, USER_ID]);

  res.json({ dailyCalorieBudget: budget });
});

export default router;
