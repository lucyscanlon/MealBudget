import { Router } from 'express';
import pool from '../db.js';

const router = Router();
const USER_ID = 1;

function getMonday(d: Date): string {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  return date.toISOString().split('T')[0];
}

async function getDayMenu(dateStr?: string) {
  const date = dateStr ? new Date(dateStr + 'T00:00:00') : new Date();
  const weekStart = getMonday(date);
  const dayOfWeek = (date.getDay() + 6) % 7; // Mon=0

  const plan = await pool.query(
    'SELECT id FROM weekly_plans WHERE user_id = $1 AND week_start = $2',
    [USER_ID, weekStart]
  );
  if (plan.rows.length === 0) return { date: date.toISOString().split('T')[0], dayName: getDayName(dayOfWeek), slots: [] };

  const entries = await pool.query(
    `SELECT pe.slot, pe.portion_scale, m.name as meal_name, m.photo_url
     FROM plan_entries pe
     JOIN meals m ON m.id = pe.meal_id
     WHERE pe.plan_id = $1 AND pe.day_of_week = $2
     ORDER BY pe.sort_order`,
    [plan.rows[0].id, dayOfWeek]
  );

  const mealIds = [...new Set(entries.rows.map((e) => e.meal_id))];
  let ingredientsByMeal: Record<string, any[]> = {};

  if (entries.rows.length > 0) {
    const mealNames = entries.rows.map((e) => e.meal_name);
    for (const entry of entries.rows) {
      const ings = await pool.query(
        `SELECT i.name, i.weight_grams, i.group_name, i.group_cooked_weight
         FROM ingredients i
         JOIN meals m ON m.id = i.meal_id
         WHERE m.name = $1 AND m.user_id = $2`,
        [entry.meal_name, USER_ID]
      );
      const key = `${entry.meal_name}-${entry.slot}`;
      ingredientsByMeal[key] = ings.rows.map((i) => ({
        name: i.name,
        weightGrams: Math.round(Number(i.weight_grams) * Number(entry.portion_scale)),
        groupName: i.group_name || null,
        groupCookedWeight: i.group_cooked_weight ? Math.round(Number(i.group_cooked_weight) * Number(entry.portion_scale)) : null,
      }));
    }
  }

  const slotOrder = ['breakfast', 'lunch', 'dinner', 'dessert', 'snack'];
  const slots = slotOrder.map((slot) => {
    const slotEntries = entries.rows.filter((e) => e.slot === slot);
    return {
      slot,
      meals: slotEntries.map((e) => ({
        name: e.meal_name,
        photoUrl: e.photo_url,
        portionScale: Number(e.portion_scale),
        ingredients: ingredientsByMeal[`${e.meal_name}-${e.slot}`] || [],
      })),
    };
  }).filter((s) => s.meals.length > 0);

  return {
    date: date.toISOString().split('T')[0],
    dayName: getDayName(dayOfWeek),
    slots,
  };
}

function getDayName(dow: number) {
  return ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][dow];
}

// JSON API
router.get('/today', async (_req, res) => {
  res.json(await getDayMenu());
});

router.get('/:date', async (req, res) => {
  res.json(await getDayMenu(req.params.date));
});

// Mobile HTML page
router.get('/:date/mobile', async (req, res) => {
  const menu = await getDayMenu(req.params.date === 'today' ? undefined : req.params.date);

  const slotsHtml = menu.slots.length > 0
    ? menu.slots.map((s) => `
      <div class="slot">
        <div class="slot-label">${s.slot}</div>
        ${s.meals.map((m) => `
          <div class="meal">
            <div class="meal-name">${m.name}${m.portionScale !== 1 ? `<span class="reduced">Reduced</span>` : ''}</div>
            <div class="ingredients">
              ${m.ingredients.map((i) => `<div class="ing">${i.name} <span>${i.weightGrams}g</span></div>`).join('')}
            </div>
          </div>
        `).join('')}
      </div>
    `).join('')
    : '<p class="empty">No meals planned for today</p>';

  res.setHeader('Content-Type', 'text/html');
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${menu.dayName}'s Menu</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; background:#fff; color:#2B2D2E; padding:20px; max-width:480px; margin:0 auto; }
  h1 { font-size:22px; font-weight:700; margin-bottom:2px; color:#1B4332; }
  .subtitle { font-size:13px; color:#6C757D; margin-bottom:24px; }
  .slot { margin-bottom:20px; }
  .slot-label { font-size:11px; font-weight:600; text-transform:uppercase; letter-spacing:0.04em; color:#2D6A4F; margin-bottom:6px; }
  .meal { background:#F8F9FA; border-radius:6px; padding:12px; margin-bottom:6px; border-left:3px solid #52B788; }
  .meal-name { font-size:15px; font-weight:600; margin-bottom:6px; display:flex; align-items:center; gap:6px; }
  .reduced { font-size:10px; font-weight:600; color:#E76F51; background:#FDEAE5; padding:1px 5px; border-radius:3px; }
  .ingredients { }
  .ing { display:flex; justify-content:space-between; font-size:13px; color:#6C757D; padding:2px 0; }
  .ing span { font-weight:500; color:#2B2D2E; }
  .empty { text-align:center; padding:40px; color:#6C757D; font-size:14px; }
  .nav { display:flex; justify-content:center; gap:16px; margin-top:20px; }
  .nav a { color:#2D6A4F; text-decoration:none; font-size:14px; font-weight:500; }
</style>
</head>
<body>
  <h1>${menu.dayName}</h1>
  <p class="subtitle">${new Date(menu.date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
  ${slotsHtml}
  <div class="nav">
    <a href="tomorrow" id="tomorrow-link">Tomorrow →</a>
  </div>
  <script>
    const d = new Date('${menu.date}T00:00:00');
    d.setDate(d.getDate() + 1);
    const tom = d.toISOString().split('T')[0];
    document.getElementById('tomorrow-link').href = tom + '/mobile';
  </script>
</body>
</html>`);
});

export { getDayMenu };
export default router;
