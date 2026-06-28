import { Router } from 'express';
import pool from '../db.js';

const router = Router();
const USER_ID = 1;

router.get('/:weekStart', async (req, res) => {
  const { weekStart } = req.params;
  const result = await pool.query(
    'SELECT * FROM weekly_reflections WHERE user_id = $1 AND week_start = $2',
    [USER_ID, weekStart]
  );
  if (result.rows.length === 0) {
    return res.json({
      weekStart,
      days: [0, 1, 2, 3, 4, 5, 6].map((d) => ({ dayOfWeek: d, status: 'none' })),
      notes: '', wins: '', struggles: '',
    });
  }
  const r = result.rows[0];
  res.json({
    weekStart,
    days: [0, 1, 2, 3, 4, 5, 6].map((d) => ({
      dayOfWeek: d,
      status: r[`day_${d}_status`] || 'none',
    })),
    notes: r.notes || '',
    wins: r.wins || '',
    struggles: r.struggles || '',
  });
});

router.put('/:weekStart', async (req, res) => {
  const { weekStart } = req.params;
  const { days, notes, wins, struggles } = req.body;

  const dayStatuses: Record<string, string> = {};
  for (const d of days) {
    dayStatuses[`day_${d.dayOfWeek}_status`] = d.status;
  }

  const existing = await pool.query(
    'SELECT id FROM weekly_reflections WHERE user_id = $1 AND week_start = $2',
    [USER_ID, weekStart]
  );

  if (existing.rows.length > 0) {
    await pool.query(
      `UPDATE weekly_reflections SET
        day_0_status=$1, day_1_status=$2, day_2_status=$3, day_3_status=$4,
        day_4_status=$5, day_5_status=$6, day_6_status=$7,
        notes=$8, wins=$9, struggles=$10
       WHERE id=$11`,
      [
        dayStatuses.day_0_status || 'none', dayStatuses.day_1_status || 'none',
        dayStatuses.day_2_status || 'none', dayStatuses.day_3_status || 'none',
        dayStatuses.day_4_status || 'none', dayStatuses.day_5_status || 'none',
        dayStatuses.day_6_status || 'none',
        notes || '', wins || '', struggles || '',
        existing.rows[0].id,
      ]
    );
  } else {
    await pool.query(
      `INSERT INTO weekly_reflections (user_id, week_start,
        day_0_status, day_1_status, day_2_status, day_3_status,
        day_4_status, day_5_status, day_6_status,
        notes, wins, struggles)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [
        USER_ID, weekStart,
        dayStatuses.day_0_status || 'none', dayStatuses.day_1_status || 'none',
        dayStatuses.day_2_status || 'none', dayStatuses.day_3_status || 'none',
        dayStatuses.day_4_status || 'none', dayStatuses.day_5_status || 'none',
        dayStatuses.day_6_status || 'none',
        notes || '', wins || '', struggles || '',
      ]
    );
  }
  res.json({ success: true });
});

// Get streak of weeks with reflections
router.get('/', async (_req, res) => {
  const result = await pool.query(
    `SELECT week_start, day_0_status, day_1_status, day_2_status, day_3_status,
            day_4_status, day_5_status, day_6_status
     FROM weekly_reflections WHERE user_id = $1 ORDER BY week_start DESC LIMIT 12`,
    [USER_ID]
  );
  const weeks = result.rows.map((r) => {
    const statuses = [r.day_0_status, r.day_1_status, r.day_2_status, r.day_3_status, r.day_4_status, r.day_5_status, r.day_6_status];
    const onTrack = statuses.filter((s) => s === 'on_track').length;
    const offTrack = statuses.filter((s) => s === 'off_track').length;
    return { weekStart: r.week_start, onTrack, offTrack, total: onTrack + offTrack };
  });
  res.json(weeks);
});

export default router;
