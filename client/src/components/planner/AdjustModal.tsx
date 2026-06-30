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
  isGroup: boolean;
  // For groups: the ingredient names that belong to this group
  groupIngredients?: string[];
  originalGrams: number;
  newGrams: number;
  caloriesPer100g: number; // effective cal/100g (for groups: total cals / cooked weight * 100)
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

      // Build rows: one per group (cooked weight), one per ungrouped ingredient
      const builtRows: IngRow[] = [];

      // Groups first
      for (const group of res.adjustedGroups) {
        // Effective cal/100g for the group = total group cals / original cooked grams * 100
        const groupIngs = res.adjustedIngredients.filter((i) => i.groupName === group.name);
        const totalGroupCals = groupIngs.reduce((s, i) => s + (i.originalGrams / 100) * i.caloriesPer100g, 0);
        const effectiveCal100g = group.originalGrams > 0 ? (totalGroupCals / group.originalGrams) * 100 : 0;
        builtRows.push({
          name: group.name,
          isGroup: true,
          groupIngredients: groupIngs.map((i) => i.name),
          originalGrams: group.originalGrams,
          newGrams: group.newGrams,
          caloriesPer100g: effectiveCal100g,
          locked: false,
        });
      }

      // Ungrouped ingredients
      for (const ing of res.adjustedIngredients.filter((i) => !i.groupName)) {
        builtRows.push({
          name: ing.name,
          isGroup: false,
          originalGrams: ing.originalGrams,
          newGrams: ing.newGrams,
          caloriesPer100g: ing.caloriesPer100g,
          locked: false,
        });
      }

      setRows(builtRows);
    } catch {
      alert('Adjustment failed');
    } finally {
      setLoading(false);
    }
  };

  const toggleLock = (index: number) => {
    setRows((prev) => prev.map((r, i) => i === index ? { ...r, locked: !r.locked } : r));
  };

  const setGrams = (index: number, grams: number) => {
    setRows((prev) => prev.map((r, i) => i === index ? { ...r, newGrams: Math.max(0, grams) } : r));
  };

  const rebalance = () => {
    // Target = what the server calculated as the budget-fitted total calories
    // adjustedIngredients contains all ingredients (including group members), so this is correct
    const serverTargetCals = result!.adjustedIngredients.reduce(
      (sum, i) => sum + (i.newGrams / 100) * i.caloriesPer100g, 0
    );

    setRows((prev) => {
      const lockedCals = prev
        .filter((r) => r.locked)
        .reduce((sum, r) => sum + (r.newGrams / 100) * r.caloriesPer100g, 0);

      const remaining = serverTargetCals - lockedCals;
      const unlocked = prev.filter((r) => !r.locked);
      const unlockedOrigCals = unlocked.reduce((sum, r) => sum + (r.originalGrams / 100) * r.caloriesPer100g, 0);

      if (unlockedOrigCals <= 0) return prev;
      const ratio = Math.max(0, remaining / unlockedOrigCals);

      return prev.map((r) => r.locked ? r : { ...r, newGrams: Math.max(0, Math.round(r.originalGrams * ratio)) });
    });
  };

  const buildCustomWeights = () => {
    if (!result) return [];
    const weights: { name: string; grams: number }[] = [];

    for (const row of rows) {
      if (row.isGroup) {
        // Scale all ingredients in this group proportionally to the new cooked weight
        const scale = row.originalGrams > 0 ? row.newGrams / row.originalGrams : 1;
        const groupIngs = result.adjustedIngredients.filter((i) => i.groupName === row.name);
        for (const ing of groupIngs) {
          weights.push({ name: ing.name, grams: Math.round(ing.originalGrams * scale) });
        }
      } else {
        weights.push({ name: row.name, grams: row.newGrams });
      }
    }
    return weights;
  };

  const handleSave = async () => {
    if (!result) return;
    setSaving(true);
    try {
      await api.post('/api/planner/adjust/custom', {
        targetEntryId: result.entryId,
        customWeights: buildCustomWeights(),
      });
      onAdjusted();
      onClose();
    } catch {
      alert('Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const hasLocked = rows.some((r) => r.locked);

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
                style={{ background: 'var(--primary)', color: '#D8F3DC', padding: '6px 14px', opacity: selectedId ? 1 : 0.4 }}
              >
                {loading ? 'Calculating...' : 'Calculate'}
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
                This meal would be very small. Consider removing a different meal instead.
              </div>
            )}

            {/* Instructions */}
            <div style={{
              background: 'var(--foam)', borderRadius: 'var(--radius-sm)',
              padding: '10px 12px', marginBottom: 14, fontSize: 12, color: 'var(--sage)',
              lineHeight: 1.5,
            }}>
              <strong>How to adjust:</strong>
              <ol style={{ paddingLeft: 16, margin: '4px 0 0' }}>
                <li>Change any weights you want to fix</li>
                <li>Click <i className="ti ti-lock" style={{ fontSize: 11 }} /> to lock those weights</li>
                <li>Click <strong>Rebalance</strong> — unlocked ingredients adjust automatically</li>
                <li>Click <strong>Save</strong> when happy</li>
              </ol>
            </div>

            {/* Ingredient rows */}
            <div>
              {/* Header */}
              <div style={{
                display: 'flex', gap: 8, alignItems: 'center', fontSize: 11,
                color: 'var(--text-light)', paddingBottom: 6, borderBottom: '1px solid var(--border)',
                fontWeight: 600,
              }}>
                <span style={{ width: 28 }} />
                <span style={{ flex: 1 }}>Ingredient</span>
                <span style={{ width: 48, textAlign: 'right' }}>Original</span>
                <span style={{ width: 72, textAlign: 'center' }}>New (g)</span>
                <span style={{ width: 38, textAlign: 'right' }}>Change</span>
              </div>

              {rows.map((row, i) => {
                const pct = row.originalGrams > 0
                  ? Math.round(((row.newGrams - row.originalGrams) / row.originalGrams) * 100)
                  : 0;
                return (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '8px 0', borderBottom: '1px solid var(--border)',
                    background: row.locked ? 'var(--foam)' : 'transparent',
                    borderRadius: row.locked ? 4 : 0,
                    marginLeft: row.locked ? -6 : 0,
                    paddingLeft: row.locked ? 6 : 0,
                    transition: 'background 0.15s',
                  }}>
                    <button
                      onClick={() => toggleLock(i)}
                      title={row.locked ? 'Unlock' : 'Lock this weight'}
                      style={{
                        width: 28, padding: '3px', fontSize: 13, flexShrink: 0,
                        color: row.locked ? 'var(--sage)' : 'var(--text-light)',
                        borderRadius: 6,
                      }}
                    >
                      <i className={`ti ${row.locked ? 'ti-lock' : 'ti-lock-open'}`} />
                    </button>

                    <span style={{ flex: 1, fontSize: 13, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {row.name}
                      {row.isGroup && (
                        <span style={{ fontSize: 10, color: 'var(--text-light)', marginLeft: 5 }}>cooked</span>
                      )}
                    </span>

                    <span style={{ width: 48, textAlign: 'right', fontSize: 12, color: 'var(--text-light)', flexShrink: 0 }}>
                      {row.originalGrams}g
                    </span>

                    <input
                      type="number"
                      value={row.newGrams}
                      onChange={(e) => setGrams(i, Number(e.target.value))}
                      onFocus={(e) => e.target.select()}
                      style={{ width: 72, textAlign: 'center', fontSize: 13, padding: '4px 6px', fontWeight: 600, flexShrink: 0 }}
                    />

                    <span style={{
                      width: 38, textAlign: 'right', fontSize: 11, flexShrink: 0,
                      color: pct < 0 ? 'var(--coral)' : pct > 0 ? 'var(--sage)' : 'var(--text-light)',
                    }}>
                      {pct > 0 ? `+${pct}%` : pct < 0 ? `${pct}%` : '–'}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16, flexWrap: 'wrap' }}>
              <button onClick={onClose} style={{ color: 'var(--text-light)', padding: '6px 14px' }}>
                Cancel
              </button>
              <button
                onClick={rebalance}
                disabled={!hasLocked}
                title={hasLocked ? 'Adjust unlocked weights to fit the budget' : 'Lock at least one ingredient first'}
                style={{
                  padding: '6px 14px', fontWeight: 600, fontSize: 13,
                  background: hasLocked ? 'var(--lemon)' : 'var(--secondary-bg)',
                  color: hasLocked ? 'var(--lemon-text)' : 'var(--text-light)',
                  border: `1.5px solid ${hasLocked ? 'var(--lemon-border)' : 'var(--border)'}`,
                  borderRadius: 'var(--radius-sm)',
                  opacity: hasLocked ? 1 : 0.5,
                }}
              >
                <i className="ti ti-refresh" style={{ fontSize: 13, marginRight: 5 }} />
                Rebalance
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                style={{ background: 'var(--primary)', color: '#D8F3DC', padding: '6px 14px', fontWeight: 600 }}
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
