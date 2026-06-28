import { useState } from 'react';
import { api } from '../../utils/api';
import type { PlanEntry, AdjustResult } from 'shared';

interface Props {
  entries: PlanEntry[];
  weekStart: string;
  dayOfWeek: number;
  onClose: () => void;
  onAdjusted: () => void;
}

interface CustomIngredient {
  name: string;
  originalGrams: number;
  newGrams: number;
  caloriesPer100g: number;
  groupName: string | null;
  locked: boolean;
}

export default function AdjustModal({ entries, weekStart, dayOfWeek, onClose, onAdjusted }: Props) {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [result, setResult] = useState<AdjustResult | null>(null);
  const [customIngs, setCustomIngs] = useState<CustomIngredient[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleAdjust = async () => {
    if (!selectedId) return;
    setLoading(true);
    try {
      const res = await api.post<AdjustResult>('/api/planner/adjust', {
        weekStart, dayOfWeek, targetEntryId: selectedId,
      });
      setResult(res);
      setCustomIngs(res.adjustedIngredients.filter((i) => !i.groupName).map((i) => ({
        ...i, locked: false,
      })));
    } catch {
      alert('Adjustment failed');
    } finally {
      setLoading(false);
    }
  };

  const handleIngredientChange = (index: number, newGrams: number) => {
    setCustomIngs((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], newGrams, locked: true };

      // Calculate how many calories this locked ingredient now uses
      const lockedCalories = updated
        .filter((i) => i.locked)
        .reduce((sum, i) => sum + (i.newGrams / 100) * i.caloriesPer100g, 0);

      // Original total calories for this meal
      const originalCalories = prev.reduce((sum, i) => sum + (i.originalGrams / 100) * i.caloriesPer100g, 0);

      // Target total (what the auto-adjust calculated)
      const targetCalories = prev.reduce((sum, i) => sum + (i.newGrams / 100) * i.caloriesPer100g, 0);

      // Remaining calories for unlocked ingredients
      const remainingCals = targetCalories - lockedCalories;

      // Distribute remaining across unlocked ingredients proportionally
      const unlocked = updated.filter((i) => !i.locked);
      const unlockedOrigCals = unlocked.reduce((sum, i) => sum + (i.originalGrams / 100) * i.caloriesPer100g, 0);

      if (unlockedOrigCals > 0 && unlocked.length > 0) {
        const ratio = Math.max(0, remainingCals / unlockedOrigCals);
        for (const ing of updated) {
          if (!ing.locked) {
            ing.newGrams = Math.max(0, Math.round(ing.originalGrams * ratio));
          }
        }
      }

      return updated;
    });
  };

  const toggleLock = (index: number) => {
    setCustomIngs((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], locked: !updated[index].locked };
      return updated;
    });
  };

  const handleSave = async () => {
    if (!result) return;
    setSaving(true);
    try {
      await api.post('/api/planner/adjust/custom', {
        targetEntryId: result.entryId,
        customWeights: customIngs.map((i) => ({ name: i.name, newGrams: i.newGrams })),
      });
      onAdjusted();
      onClose();
    } catch {
      alert('Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }}>
      <div style={{
        background: 'var(--bg)', borderRadius: 'var(--radius)', padding: 24, width: 440,
        maxHeight: '85vh', overflow: 'auto', border: '1px solid var(--border)',
        boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
      }}>
        <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>Adjust portions</h3>

        {!result ? (
          <>
            <p style={{ fontSize: 13, color: 'var(--text-light)', marginBottom: 16 }}>
              Choose which meal to reduce so everything fits within your budget.
            </p>
            {entries.map((entry) => (
              <label key={entry.id} style={{
                display: 'flex', gap: 10, alignItems: 'center', padding: '10px 12px',
                borderRadius: 'var(--radius-sm)', marginBottom: 4, cursor: 'pointer',
                background: selectedId === entry.id ? 'var(--foam)' : 'transparent',
                border: selectedId === entry.id ? '1.5px solid var(--mint)' : '1.5px solid transparent',
              }}>
                <input
                  type="radio"
                  name="adjustTarget"
                  checked={selectedId === entry.id}
                  onChange={() => setSelectedId(entry.id)}
                  style={{ accentColor: 'var(--accent)' }}
                />
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{entry.meal.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-light)' }}>{entry.slot}</div>
                </div>
              </label>
            ))}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
              <button onClick={onClose} style={{ color: 'var(--text-light)', padding: '6px 14px' }}>Cancel</button>
              <button
                onClick={handleAdjust}
                disabled={!selectedId || loading}
                style={{
                  background: 'var(--primary)', color: '#D8F3DC', padding: '6px 14px',
                  opacity: selectedId ? 1 : 0.4,
                }}
              >
                {loading ? 'Adjusting...' : 'Adjust'}
              </button>
            </div>
          </>
        ) : (
          <>
            {result.tooSmall && (
              <div style={{
                background: 'var(--coral-light)', padding: 10, borderRadius: 'var(--radius-sm)',
                marginBottom: 14, fontSize: 13, color: 'var(--coral)',
              }}>
                This meal would be very small. Consider removing a different meal.
              </div>
            )}

            <p style={{ fontSize: 13, color: 'var(--text-light)', marginBottom: 4 }}>
              Adjust individual ingredients — change one and the others rebalance automatically.
            </p>
            <p style={{ fontSize: 11, color: 'var(--text-light)', marginBottom: 12 }}>
              <i className="ti ti-lock" style={{ fontSize: 12 }} /> = locked (won't change when others adjust)
            </p>

            {/* Grouped ingredients */}
            {result.adjustedGroups.length > 0 && result.adjustedGroups.map((group, i) => {
              const pct = Math.round((1 - group.newGrams / group.originalGrams) * 100);
              return (
                <div key={`g-${i}`} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: 13, fontWeight: 600,
                }}>
                  <span>{group.name} (cooked)</span>
                  <span>
                    <span style={{ textDecoration: 'line-through', color: 'var(--text-light)', marginRight: 6 }}>{group.originalGrams}g</span>
                    <strong>{group.newGrams}g</strong>
                    <span style={{ fontSize: 11, color: 'var(--coral)', marginLeft: 6 }}>-{pct}%</span>
                  </span>
                </div>
              );
            })}

            {/* Editable ungrouped ingredients */}
            {customIngs.map((ing, i) => {
              const pct = ing.originalGrams > 0 ? Math.round((1 - ing.newGrams / ing.originalGrams) * 100) : 0;
              return (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: 13,
                }}>
                  <button
                    onClick={() => toggleLock(i)}
                    style={{
                      padding: '2px 4px', fontSize: 14, flexShrink: 0,
                      color: ing.locked ? 'var(--sage)' : 'var(--text-light)',
                    }}
                  >
                    <i className={`ti ${ing.locked ? 'ti-lock' : 'ti-lock-open'}`} style={{ fontSize: 14 }} />
                  </button>
                  <span style={{ flex: 1 }}>{ing.name}</span>
                  <span style={{ textDecoration: 'line-through', color: 'var(--text-light)', fontSize: 12 }}>
                    {ing.originalGrams}g
                  </span>
                  <input
                    type="number"
                    value={ing.newGrams}
                    onChange={(e) => handleIngredientChange(i, Math.max(0, Number(e.target.value)))}
                    onFocus={(e) => e.target.select()}
                    style={{ width: 60, textAlign: 'center', fontSize: 13, padding: '4px 6px', fontWeight: 600 }}
                  />
                  <span style={{ fontSize: 11, color: pct > 0 ? 'var(--coral)' : 'var(--sage)', minWidth: 36, textAlign: 'right' }}>
                    {pct > 0 ? `-${pct}%` : pct < 0 ? `+${Math.abs(pct)}%` : '0%'}
                  </span>
                </div>
              );
            })}

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
              <button onClick={onClose} style={{ color: 'var(--text-light)', padding: '6px 14px' }}>Cancel</button>
              <button
                onClick={handleSave}
                disabled={saving}
                style={{ background: 'var(--primary)', color: '#D8F3DC', padding: '6px 14px' }}
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
