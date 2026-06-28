import { Router } from 'express';

const router = Router();

router.get('/scriptable', (_req, res) => {
  const proto = _req.headers['x-forwarded-proto'] || _req.protocol;
  const host = _req.headers['x-forwarded-host'] || _req.headers.host || _req.hostname;
  const serverUrl = `${proto}://${host}`;

  const script = `const SERVER = "${serverUrl}";
const CACHE_KEY = "mealbudget_menu";
const fm = FileManager.local();
const cachePath = fm.joinPath(fm.documentsDirectory(), CACHE_KEY + ".json");

function saveCache(data) {
  const payload = { date: new Date().toISOString().split("T")[0], data };
  fm.writeString(cachePath, JSON.stringify(payload));
}

function loadCache() {
  try {
    if (!fm.fileExists(cachePath)) return null;
    const raw = JSON.parse(fm.readString(cachePath));
    if (raw.date === new Date().toISOString().split("T")[0]) return raw.data;
    return null;
  } catch { return null; }
}

async function fetchMenu() {
  const cached = loadCache();
  const req = new Request(SERVER + "/api/daily/today");
  req.timeoutInterval = 10;
  try {
    const data = await req.loadJSON();
    saveCache(data);
    return data;
  } catch {
    return cached;
  }
}

const menu = await fetchMenu();
const widget = new ListWidget();

const gradient = new LinearGradient();
gradient.locations = [0, 1];
gradient.colors = [new Color("#1B4332"), new Color("#2D6A4F")];
widget.backgroundGradient = gradient;
widget.setPadding(14, 16, 14, 16);

const headerStack = widget.addStack();
headerStack.layoutHorizontally();
headerStack.centerAlignContent();

const dayText = headerStack.addText(menu ? menu.dayName.toUpperCase() : "MEALBUDGET");
dayText.font = Font.boldSystemFont(11);
dayText.textColor = new Color("#52B788");
dayText.letterSpacing = 2;

headerStack.addSpacer();

const dateStr = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short" });
const dateText = headerStack.addText(dateStr);
dateText.font = Font.systemFont(11);
dateText.textColor = new Color("#ffffff", 0.4);

widget.addSpacer(10);

if (menu && menu.isDayOff) {
  const dayOffCard = widget.addStack();
  dayOffCard.layoutVertically();
  dayOffCard.centerAlignContent();
  dayOffCard.setPadding(20, 16, 20, 16);
  dayOffCard.cornerRadius = 10;
  dayOffCard.backgroundColor = new Color("#ffffff", 0.08);

  const dayOffIcon = dayOffCard.addText("🎉");
  dayOffIcon.font = Font.systemFont(28);
  dayOffCard.addSpacer(6);

  const dayOffText = dayOffCard.addText("Enjoy your day!");
  dayOffText.font = Font.semiboldSystemFont(14);
  dayOffText.textColor = new Color("#D8F3DC");
  dayOffCard.addSpacer(2);

  const dayOffSub = dayOffCard.addText("No calorie tracking today");
  dayOffSub.font = Font.systemFont(11);
  dayOffSub.textColor = new Color("#ffffff", 0.5);
} else if (menu && menu.slots && menu.slots.length > 0) {
  const slotConfig = {
    breakfast: { icon: "☀️", color: "#D8F3DC" },
    lunch: { icon: "🥗", color: "#95D5B2" },
    dinner: { icon: "🍽", color: "#52B788" },
    dessert: { icon: "🍰", color: "#D8F3DC" },
    snack: { icon: "🍿", color: "#95D5B2" },
  };

  for (let i = 0; i < menu.slots.length; i++) {
    const slot = menu.slots[i];
    const conf = slotConfig[slot.slot] || { icon: "•", color: "#ffffff" };

    const card = widget.addStack();
    card.layoutHorizontally();
    card.centerAlignContent();
    card.setPadding(8, 10, 8, 10);
    card.cornerRadius = 10;
    card.backgroundColor = new Color("#ffffff", 0.08);
    card.spacing = 10;

    const hasTakeaway = slot.meals.some(m => m.isTakeaway);
    const iconText = card.addText(hasTakeaway ? "🍕" : conf.icon);
    iconText.font = Font.systemFont(16);

    const textStack = card.addStack();
    textStack.layoutVertically();
    textStack.spacing = 1;

    const slotLabel = textStack.addText(slot.slot.charAt(0).toUpperCase() + slot.slot.slice(1));
    slotLabel.font = Font.mediumSystemFont(10);
    slotLabel.textColor = hasTakeaway ? new Color("#FED7AA") : new Color(conf.color);

    const names = hasTakeaway ? "Takeaway — enjoy!" : slot.meals.map(m => m.name).join(", ");
    const mealName = textStack.addText(names);
    mealName.font = Font.semiboldSystemFont(13);
    mealName.textColor = new Color("#ffffff");
    mealName.lineLimit = 1;

    card.addSpacer();

    if (slot.meals.some(m => m.portionScale !== 1)) {
      const badge = card.addText("↓");
      badge.font = Font.boldSystemFont(12);
      badge.textColor = new Color("#E76F51");
    }

    if (i < menu.slots.length - 1) {
      widget.addSpacer(4);
    }
  }
} else {
  const emptyCard = widget.addStack();
  emptyCard.layoutHorizontally();
  emptyCard.centerAlignContent();
  emptyCard.setPadding(16, 12, 16, 12);
  emptyCard.cornerRadius = 10;
  emptyCard.backgroundColor = new Color("#ffffff", 0.08);

  const emptyIcon = emptyCard.addText("📋");
  emptyIcon.font = Font.systemFont(20);
  emptyCard.addSpacer(8);

  const emptyText = emptyCard.addText("No meals planned");
  emptyText.font = Font.systemFont(13);
  emptyText.textColor = new Color("#ffffff", 0.5);
}

widget.addSpacer();

const today = new Date().toISOString().split("T")[0];
widget.url = SERVER + "/api/daily/" + today + "/mobile";

if (config.runsInWidget) {
  Script.setWidget(widget);
} else {
  widget.presentMedium();
}
Script.complete();`;

  const escaped = script.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  res.setHeader('Content-Type', 'text/html');
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>MealBudget Widget Script</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:-apple-system,sans-serif; background:#fff; color:#2B2D2E; padding:20px; max-width:600px; margin:0 auto; }
  h1 { font-size:20px; font-weight:700; color:#1B4332; margin-bottom:4px; }
  .sub { font-size:13px; color:#6C757D; margin-bottom:16px; }
  ol { font-size:14px; padding-left:20px; margin-bottom:20px; line-height:2; color:#495057; }
  .btn { display:block; width:100%; padding:14px; background:#1B4332; color:#D8F3DC; border:none; border-radius:8px; font-size:15px; font-weight:600; cursor:pointer; margin-bottom:16px; }
  pre { background:#F8F9FA; border:1px solid #DEE2E6; border-radius:8px; padding:12px; font-size:11px; overflow:auto; max-height:300px; white-space:pre-wrap; word-break:break-all; }
</style>
</head>
<body>
  <h1>MealBudget Widget</h1>
  <p class="sub">Scriptable widget for your iPhone home screen</p>
  <ol>
    <li>Tap <strong>Copy Script</strong> below</li>
    <li>Open <strong>Scriptable</strong> app</li>
    <li>Tap <strong>+</strong> → Paste → Done</li>
    <li>Add widget to home screen</li>
  </ol>
  <button class="btn" onclick="copyScript()">Copy Script</button>
  <pre id="code">${escaped}</pre>
  <script>
    function copyScript() {
      const code = document.getElementById('code').textContent;
      if (navigator.clipboard) {
        navigator.clipboard.writeText(code).then(() => {
          document.querySelector('.btn').textContent = 'Copied!';
          setTimeout(() => document.querySelector('.btn').textContent = 'Copy Script', 2000);
        });
      } else {
        const ta = document.createElement('textarea');
        ta.value = code;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        document.querySelector('.btn').textContent = 'Copied!';
        setTimeout(() => document.querySelector('.btn').textContent = 'Copy Script', 2000);
      }
    }
  </script>
</body>
</html>`);
});

export default router;
