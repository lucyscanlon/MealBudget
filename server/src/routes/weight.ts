import { Router } from 'express';
import pool from '../db.js';
import { calculateDailyBudget } from '../services/calorieCalc.js';

const router = Router();
const USER_ID = 1;

// Get all weight logs
router.get('/', async (_req, res) => {
  const result = await pool.query(
    'SELECT id, weight_lbs, logged_at FROM weight_logs WHERE user_id = $1 ORDER BY logged_at ASC',
    [USER_ID]
  );
  res.json(result.rows.map((r) => ({
    id: r.id,
    weightLbs: Number(r.weight_lbs),
    date: r.logged_at,
  })));
});

// Log a weekly weigh-in
router.post('/', async (req, res) => {
  const { weightLbs, date } = req.body;
  if (!weightLbs) return res.status(400).json({ error: 'Weight required' });

  const logDate = date || new Date().toISOString().split('T')[0];

  const result = await pool.query(
    `INSERT INTO weight_logs (user_id, weight_lbs, logged_at) VALUES ($1, $2, $3)
     ON CONFLICT (user_id, logged_at) DO UPDATE SET weight_lbs = $2
     RETURNING id, weight_lbs, logged_at`,
    [USER_ID, weightLbs, logDate]
  );

  // Recalculate calorie budget based on new weight
  const user = await pool.query(
    'SELECT height_cm, age, sex, activity_level, weekly_loss_target FROM users WHERE id = $1',
    [USER_ID]
  );
  if (user.rows[0]?.height_cm) {
    const u = user.rows[0];
    const budget = calculateDailyBudget({
      weightLbs,
      heightCm: Number(u.height_cm),
      age: u.age,
      sex: u.sex,
      activityLevel: u.activity_level,
      weeklyLossTarget: Number(u.weekly_loss_target) || 1,
    });
    await pool.query('UPDATE users SET daily_calorie_budget = $1 WHERE id = $2', [budget, USER_ID]);
  }

  const row = result.rows[0];
  res.json({ id: row.id, weightLbs: Number(row.weight_lbs), date: row.logged_at });
});

// Get projection data
router.get('/projection', async (_req, res) => {
  const user = await pool.query(
    'SELECT goal_weight_lbs, weekly_loss_target FROM users WHERE id = $1',
    [USER_ID]
  );
  const logs = await pool.query(
    'SELECT weight_lbs, logged_at FROM weight_logs WHERE user_id = $1 ORDER BY logged_at ASC',
    [USER_ID]
  );

  if (logs.rows.length === 0 || !user.rows[0]?.goal_weight_lbs) {
    return res.json({ logs: [], projection: [], goalWeightLbs: null, estimatedGoalDate: null });
  }

  const goalLbs = Number(user.rows[0].goal_weight_lbs);
  const weeklyTarget = Number(user.rows[0].weekly_loss_target) || 1;
  const currentWeight = Number(logs.rows[logs.rows.length - 1].weight_lbs);
  const lastDate = new Date(logs.rows[logs.rows.length - 1].logged_at);

  // Project future weights
  const projection: { date: string; weightLbs: number }[] = [];
  let projWeight = currentWeight;
  let projDate = new Date(lastDate);

  for (let i = 0; i < 52 && projWeight > goalLbs; i++) {
    projDate = new Date(projDate);
    projDate.setDate(projDate.getDate() + 7);
    projWeight -= weeklyTarget;
    if (projWeight < goalLbs) projWeight = goalLbs;
    projection.push({ date: projDate.toISOString().split('T')[0], weightLbs: Math.round(projWeight * 10) / 10 });
  }

  const estimatedGoalDate = projection.length > 0 ? projection[projection.length - 1].date : null;

  res.json({
    logs: logs.rows.map((r) => ({ date: r.logged_at, weightLbs: Number(r.weight_lbs) })),
    projection,
    goalWeightLbs: goalLbs,
    estimatedGoalDate,
  });
});

router.get('/trends', async (_req, res) => {
  const user = await pool.query(
    'SELECT goal_weight_lbs, weekly_loss_target FROM users WHERE id = $1',
    [USER_ID]
  );
  const logs = await pool.query(
    'SELECT weight_lbs, logged_at FROM weight_logs WHERE user_id = $1 ORDER BY logged_at ASC',
    [USER_ID]
  );

  if (logs.rows.length < 2) {
    return res.json({ hasEnoughData: false });
  }

  const entries = logs.rows.map((r) => ({
    weightLbs: Number(r.weight_lbs),
    date: new Date(r.logged_at),
  }));

  const weeklyTarget = Number(user.rows[0]?.weekly_loss_target) || 1;
  const goalLbs = user.rows[0]?.goal_weight_lbs ? Number(user.rows[0].goal_weight_lbs) : null;
  const first = entries[0];
  const last = entries[entries.length - 1];
  const totalLost = first.weightLbs - last.weightLbs;
  const daysBetween = (last.date.getTime() - first.date.getTime()) / (1000 * 60 * 60 * 24);
  const weeksBetween = daysBetween / 7;
  const avgPerWeek = weeksBetween > 0 ? Math.round((totalLost / weeksBetween) * 10) / 10 : 0;

  // Last 4 weeks trend
  const recentLogs = entries.slice(-5);
  const weeklyChanges: number[] = [];
  for (let i = 1; i < recentLogs.length; i++) {
    weeklyChanges.push(Math.round((recentLogs[i - 1].weightLbs - recentLogs[i].weightLbs) * 10) / 10);
  }
  const recentAvg = weeklyChanges.length > 0
    ? Math.round((weeklyChanges.reduce((a, b) => a + b, 0) / weeklyChanges.length) * 10) / 10
    : 0;

  // Streak: consecutive weeks of loss
  let streak = 0;
  for (let i = entries.length - 1; i > 0; i--) {
    if (entries[i].weightLbs < entries[i - 1].weightLbs) {
      streak++;
    } else {
      break;
    }
  }

  // Best week
  let bestWeekLoss = 0;
  let bestWeekDate = '';
  for (let i = 1; i < entries.length; i++) {
    const loss = entries[i - 1].weightLbs - entries[i].weightLbs;
    if (loss > bestWeekLoss) {
      bestWeekLoss = Math.round(loss * 10) / 10;
      bestWeekDate = entries[i].date.toISOString().split('T')[0];
    }
  }

  // On track assessment
  let status: 'ahead' | 'on_track' | 'behind' = 'on_track';
  if (avgPerWeek >= weeklyTarget * 1.1) status = 'ahead';
  else if (avgPerWeek < weeklyTarget * 0.7) status = 'behind';

  // Adjusted goal date based on actual rate
  let adjustedGoalDate: string | null = null;
  if (goalLbs && recentAvg > 0) {
    const remaining = last.weightLbs - goalLbs;
    const weeksToGo = remaining / recentAvg;
    const goalDate = new Date(last.date);
    goalDate.setDate(goalDate.getDate() + Math.ceil(weeksToGo * 7));
    adjustedGoalDate = goalDate.toISOString().split('T')[0];
  }

  res.json({
    hasEnoughData: true,
    totalLost: Math.round(totalLost * 10) / 10,
    avgPerWeek,
    recentAvg,
    weeklyTarget,
    weeklyChanges,
    streak,
    bestWeekLoss,
    bestWeekDate,
    status,
    adjustedGoalDate,
    weeksTracked: Math.round(weeksBetween),
  });
});

export default router;
