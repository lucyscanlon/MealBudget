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

interface IngRow {
  name: string;
  groupName: string | null;
  originalGrams: number;
  newGrams: number;
  caloriesPer100g: number;
  locked: boolean;
}

export default function AdjustModal({ entries, weekStart, dayOfWeek, onClose, onAdjusted }: Props) {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [result, setResult] = useState<AdjustResult | null>(null);
  const [rows, setRows] = useState<IngRow[]>([]);
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
      // Flatten all ingredients (grouped and ungrouped) into rows
      setRows(res.adjustedIngredients.map((i) => ({
        name: i.name,
        groupName: i.groupName,
        originalGrams: i.originalGrams,
        newGrams: i.newGrams,
        caloriesPer100g: i.caloriesPer100g,
        locked: false,
      })));
    } catch {
      alert('Adjustment failed');
    } finally {
      setLoading(false);
    }
  };

  // Lock a row at its current value and rebalance unlocked rows
  const lockRow = (index: number) => {
    setRows((prev) => {
      const updated = prev.map((r, i) => i === index ? { ...r, locked: true } : r);

      const targetCalories = prev.reduce((sum, r) => sum + (r.newGrams / 100) * r.caloriesPer100g, 0);
      const lockedCalories = updated
        .filter((r) => r.locked)
        .reduce((sum, r) => sum + (r.newGrams / 100) * r.caloriesPer100g, 0);

      const remainingCals = targetCalories - lockedCalories;
      const unlocked = updated.filter((r) => !r.locked);
      const unlockedOrigCals = unlocked.reduce((sum, r) => sum + (r.originalGrams / 100) * r.caloriesPer100g, 0);

      if (unlockedOrigCals > 0) {
        const ratio = Math.max(0, remainingCals / unlockedOrigCals);
        return updated.map((r) => r.locked ? r : { ...r, newGrams: Math.max(0, Math.round(r.originalGrams * ratio)) });
      }
      return updated;
    });
  };

  const unlockRow = (index: number) => {
    setRows((prev) => prev.map((r, i) => i === index ? { ...r, locked: false } : r));
  };

  const setGrams = (index: number, grams: number) => {
    setRows((prev) => prev.map((r, i) => i === index ? { ...r, newGrams: Math.max(0, grams) } : r));
  };

  const handleSave = async () => {
    if (!result) return;
    setSaving(true);
    try {
      await api.post('/api/planner/adjust/custom', {
        targetEntryId: result.entryId,
        customWeights: rows.map((r) => ({ name: r.name, grams: r.newGrams })),
      });
      onAdjusted();
      onClose();
    } catch {
      alert('Failed to save');
    } finally {
      setSaving(false);
    }
  };

  // Group rows by groupName for display
  const grouped: { groupName: string | null; rows: (IngRow & { index: number })[] }[] = [];
  rows.forEach((r, i) => {
    const existing = grouped.find((g) => g.groupName === r.groupName);
    if (existing) {
      existing.rows.push({ ...r, index: i });
    } else {
      grouped.push({ groupName: r.groupName, rows: [{ ...r, index: i }] });
    }
  });

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }}>
      <div style={{
        background: 'var(--bg)', borderRadius: 'var(--radius)', padding: 24, width: 460,
        maxWidth: '95vw', maxHeight: '85vh', overflow: 'auto', border: '1px solid var(--border)',
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
              Change a weight, then click <i className="ti ti-lock" style={{ fontSize: 12 }} /> to lock it in — unlocked ingredients will rebalance automatically.
            </p>

            <div style={{ marginTop: 12 }}>
              {grouped.map((group) => (
                <div key={group.groupName ?? '__none__'}>
                  {group.groupName && (
                    <div style={{
                      fontSize: 11, fontWeight: 600, color: 'var(--text-light)',
                      textTransform: 'uppercase', letterSpacing: '0.04em',
                      padding: '10px 0 4px', borderTop: '1px solid var(--border)',
                    }}>
                      {group.groupName} (group)
                      {(() => {
                        // Show group cooked weight summary
                        const grp = result.adjustedGroups.find((g) => g.name === group.groupName);
                        if (!grp) return null;
                        return (
                          <span style={{ fontWeight: 400, color: 'var(--text-light)', marginLeft: 8 }}>
                            cooked: <span style={{ textDecoration: 'line-through', marginRight: 4 }}>{grp.originalGrams}g</span>
                            <strong style={{ color: 'var(--text)' }}>{Math.round(grp.newGrams * (rows.filter(r => r.groupName === group.groupName).reduce((s, r) => s + r.newGrams, 0) / Math.max(1, rows.filter(r => r.groupName === group.groupName).reduce((s, r) => s + r.originalGrams, 0))))}g</strong>
                          </span>
                        );
                      })()}
                    </div>
                  )}
                  {group.rows.map((row) => {
                    const pct = row.originalGrams > 0 ? Math.round(((row.newGrams - row.originalGrams) / row.originalGrams) * 100) : 0;
                    return (
                      <div key={row.index} style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: 13,
                        paddingLeft: group.groupName ? 12 : 0,
                      }}>
                        {/* Lock button */}
                        <button
                          onClick={() => row.locked ? unlockRow(row.index) : lockRow(row.index)}
                          title={row.locked ? 'Unlock — will rebalance with others' : 'Lock this weight in and rebalance others'}
                          style={{
                            padding: '3px 5px', fontSize: 14, flexShrink: 0,
                            color: row.locked ? 'var(--sage)' : 'var(--text-light)',
                            background: row.locked ? 'var(--foam)' : 'transparent',
                            borderRadius: 6,
                          }}
                        >
                          <i className={`ti ${row.locked ? 'ti-lock' : 'ti-lock-open'}`} style={{ fontSize: 14 }} />
                        </button>

                        {/* Name */}
                        <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {row.name}
                        </span>

                        {/* Original */}
                        <span style={{ textDecoration: 'line-through', color: 'var(--text-light)', fontSize: 12, flexShrink: 0 }}>
                          {row.originalGrams}g
                        </span>

                        {/* Input */}
                        <input
                          type="number"
                          value={row.newGrams}
                          onChange={(e) => setGrams(row.index, Number(e.target.value))}
                          onFocus={(e) => e.target.select()}
                          style={{ width: 64, textAlign: 'center', fontSize: 13, padding: '4px 6px', fontWeight: 600 }}
                        />
                        <span style={{ fontSize: 11, color: 'var(--text-light)', flexShrink: 0 }}>g</span>

                        {/* % change */}
                        <span style={{
                          fontSize: 11, minWidth: 38, textAlign: 'right', flexShrink: 0,
                          color: pct < 0 ? 'var(--coral)' : pct > 0 ? 'var(--sage)' : 'var(--text-light)',
                        }}>
                          {pct > 0 ? `+${pct}%` : pct < 0 ? `${pct}%` : '–'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>

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
