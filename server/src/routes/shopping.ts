import { Router } from 'express';
import pool from '../db.js';
const router = Router();
const USER_ID = 1;

router.get('/:weekStart', async (req, res) => {
  const { weekStart } = req.params;

  const plan = await pool.query(
    'SELECT id FROM weekly_plans WHERE user_id = $1 AND week_start = $2',
    [USER_ID, weekStart]
  );
  if (plan.rows.length === 0) return res.json([]);

  const result = await pool.query(
    `SELECT i.name, i.group_name,
            SUM(i.weight_grams * pe.portion_scale) as total_grams
     FROM plan_entries pe
     JOIN ingredients i ON i.meal_id = pe.meal_id
     WHERE pe.plan_id = $1
     GROUP BY i.name, i.group_name
     ORDER BY i.name`,
    [plan.rows[0].id]
  );

  res.json(result.rows.map((r) => ({
    name: r.name,
    groupName: r.group_name || null,
    totalGrams: Math.round(Number(r.total_grams)),
  })));
});

router.get('/:weekStart/mobile', async (req, res) => {
  const { weekStart } = req.params;

  const plan = await pool.query(
    'SELECT id FROM weekly_plans WHERE user_id = $1 AND week_start = $2',
    [USER_ID, weekStart]
  );

  let items: { name: string; weight: string }[] = [];
  if (plan.rows.length > 0) {
    const result = await pool.query(
      `SELECT i.name, SUM(i.weight_grams * pe.portion_scale) as total_grams
       FROM plan_entries pe
       JOIN ingredients i ON i.meal_id = pe.meal_id
       WHERE pe.plan_id = $1
       GROUP BY i.name
       ORDER BY i.name`,
      [plan.rows[0].id]
    );
    items = result.rows.map((r) => {
      const g = Math.round(Number(r.total_grams));
      return { name: r.name, weight: g >= 1000 ? `${(g / 1000).toFixed(1)}kg` : `${g}g` };
    });
  }

  const weekDate = new Date(weekStart + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'long' });
  const listLines = items.map((i) => `${i.name} — ${i.weight}`);
  const listTextRaw = `Shopping List – Week of ${weekDate}\n\n${listLines.join('\n')}`;
  const shareTextJson = JSON.stringify(listTextRaw);

  const itemsHtml = items.length > 0
    ? items.map((i) => `
      <label class="item">
        <input type="checkbox" />
        <span class="name">${i.name}</span>
        <span class="weight">${i.weight}</span>
      </label>`).join('')
    : '<p style="color:#999;text-align:center;padding:40px">No items</p>';

  res.setHeader('Content-Type', 'text/html');
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Shopping List – Week of ${weekDate}</title>
<meta name="apple-mobile-web-app-capable" content="yes" />
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; background:#fff; color:#2B2D2E; padding:20px; max-width:480px; margin:0 auto; }
  h1 { font-size:20px; font-weight:700; margin-bottom:4px; color:#1B4332; }
  .subtitle { font-size:13px; color:#6C757D; margin-bottom:20px; }
  .item { display:flex; align-items:center; gap:12px; padding:12px 0; border-bottom:1px solid #DEE2E6; cursor:pointer; }
  .item input[type="checkbox"] { width:20px; height:20px; accent-color:#52B788; flex-shrink:0; }
  .item.checked .name { text-decoration:line-through; color:#6C757D; }
  .name { flex:1; font-size:15px; }
  .weight { font-size:13px; color:#6C757D; font-weight:500; }
  .actions { display:flex; gap:8px; margin-top:20px; }
  .btn { flex:1; padding:12px; border:none; border-radius:6px; font-size:14px; font-weight:600; cursor:pointer; text-align:center; text-decoration:none; }
  .btn-primary { background:#1B4332; color:#D8F3DC; }
  .counter { font-size:12px; color:#9b9a97; margin-bottom:12px; }
</style>
</head>
<body>
  <h1>Shopping List</h1>
  <p class="subtitle">Week of ${weekDate}</p>
  <p class="counter"><span id="count">0</span> of ${items.length} checked</p>
  <div id="list">${itemsHtml}</div>
  <div class="actions">
    <button class="btn btn-primary" onclick="copyList()">Copy List</button>
  </div>
  <p style="text-align:center;margin-top:12px;font-size:11px;color:#9b9a97">Or just use this page as your checklist while shopping</p>
  <script>
    const listText = ${shareTextJson};

    document.querySelectorAll('.item input').forEach(cb => {
      cb.addEventListener('change', function() {
        this.closest('.item').classList.toggle('checked', this.checked);
        document.getElementById('count').textContent = document.querySelectorAll('.item input:checked').length;
      });
    });

    async function copyList() {
      try {
        await navigator.clipboard.writeText(listText);
        document.querySelector('.btn-primary').textContent = 'Copied!';
        setTimeout(() => document.querySelector('.btn-primary').textContent = 'Copy List', 2000);
      } catch {
        // Fallback for older browsers
        const ta = document.createElement('textarea');
        ta.value = listText;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        document.querySelector('.btn-primary').textContent = 'Copied!';
        setTimeout(() => document.querySelector('.btn-primary').textContent = 'Copy List', 2000);
      }
    }
  </script>
</body>
</html>`);
});

export default router;
