import { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { api } from '../utils/api';

interface DayMenu {
  date: string;
  dayName: string;
  slots: {
    slot: string;
    meals: {
      name: string;
      portionScale: number;
      ingredients: { name: string; weightGrams: number; groupName: string | null; groupCookedWeight: number | null }[];
    }[];
  }[];
}

const SLOT_LABELS: Record<string, string> = {
  breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', dessert: 'Dessert', snack: 'Snack',
};

export default function TodayPage() {
  const [menu, setMenu] = useState<DayMenu | null>(null);
  const [showWidget, setShowWidget] = useState(false);

  useEffect(() => {
    api.get<DayMenu>('/api/daily/today').then(setMenu);
  }, []);

  const mobileUrl = `http://${window.location.hostname}:3001/api/daily/today/mobile`;
  const widgetUrl = `http://${window.location.hostname}:3001/api/widget/scriptable`;

  if (!menu) return <p style={{ padding: 40, color: 'var(--text-light)' }}>Loading...</p>;

  return (
    <div style={{ maxWidth: 700, margin: '0 auto', padding: '40px clamp(12px, 3vw, 24px)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 600 }}>{menu.dayName}</h2>
          <p style={{ fontSize: 13, color: 'var(--text-light)' }}>
            {new Date(menu.date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => setShowWidget(!showWidget)}
            style={{ fontSize: 13, color: 'var(--accent)' }}
          >
            {showWidget ? 'Hide setup' : 'iPhone Widget'}
          </button>
        </div>
      </div>

      {/* Widget setup */}
      {showWidget && (
        <div style={{ border: '2px solid var(--border)', borderRadius: 'var(--radius)', padding: 20, marginBottom: 24 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>Set up iPhone Widget</h3>
          <ol style={{ fontSize: 13, color: 'var(--text-light)', paddingLeft: 20, lineHeight: 2 }}>
            <li>Install <strong>Scriptable</strong> from the App Store (free)</li>
            <li>On your phone, open Safari and go to:<br />
              <code style={{ background: 'var(--secondary-bg)', padding: '2px 6px', borderRadius: 3, fontSize: 12, userSelect: 'all' }}>
                {widgetUrl}
              </code>
            </li>
            <li>Select all the code → Copy</li>
            <li>Open Scriptable → tap <strong>+</strong> → paste → tap Done</li>
            <li>Long press home screen → add widget → Scriptable → choose "MealBudget"</li>
          </ol>
          <div style={{ textAlign: 'center', marginTop: 16 }}>
            <p style={{ fontSize: 12, color: 'var(--text-light)', marginBottom: 8 }}>Or scan to open the script on your phone:</p>
            <QRCodeSVG value={widgetUrl} size={160} />
          </div>
        </div>
      )}

      {/* Daily menu */}
      {menu.slots.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-light)' }}>
          <p style={{ fontSize: 14 }}>No meals planned for today.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {menu.slots.map((slot) => (
            <div key={slot.slot}>
              <div style={{
                fontSize: 11, fontWeight: 500, color: 'var(--text-light)',
                textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6,
              }}>
                {SLOT_LABELS[slot.slot] || slot.slot}
              </div>
              {slot.meals.map((meal, i) => (
                <div key={i} style={{
                  border: '2px solid var(--border)', borderRadius: 'var(--radius)', padding: 16, marginBottom: 8,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <span style={{ fontSize: 15, fontWeight: 600 }}>{meal.name}</span>
                    {meal.portionScale !== 1 && (
                      <span style={{
                        fontSize: 10, fontWeight: 600, color: 'var(--red)',
                        background: '#FDEAE5', padding: '1px 5px', borderRadius: 3,
                      }}>
                        Reduced
                      </span>
                    )}
                  </div>
                  {(() => {
                    const groups = new Map<string, { cookedWeight: number; ings: typeof meal.ingredients }>();
                    const ungrouped: typeof meal.ingredients = [];
                    for (const ing of meal.ingredients) {
                      if (ing.groupName) {
                        if (!groups.has(ing.groupName)) {
                          groups.set(ing.groupName, { cookedWeight: ing.groupCookedWeight || 0, ings: [] });
                        }
                        groups.get(ing.groupName)!.ings.push(ing);
                      } else {
                        ungrouped.push(ing);
                      }
                    }
                    return (
                      <>
                        {Array.from(groups.entries()).map(([name, g]) => (
                          <div key={name} style={{ marginBottom: 4 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 600, padding: '2px 0' }}>
                              <span>{name}</span>
                              <span>{g.cookedWeight}g</span>
                            </div>
                            {g.ings.map((ing, j) => (
                              <div key={j} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-light)', paddingLeft: 12, padding: '1px 0 1px 12px' }}>
                                <span>{ing.name}</span>
                                <span>{ing.weightGrams}g</span>
                              </div>
                            ))}
                          </div>
                        ))}
                        {ungrouped.map((ing, j) => (
                          <div key={j} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--text-light)', padding: '2px 0' }}>
                            <span>{ing.name}</span>
                            <span style={{ fontWeight: 500, color: 'var(--text)' }}>{ing.weightGrams}g</span>
                          </div>
                        ))}
                      </>
                    );
                  })()}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
