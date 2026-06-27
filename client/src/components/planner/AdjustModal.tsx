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

export default function AdjustModal({ entries, weekStart, dayOfWeek, onClose, onAdjusted }: Props) {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [result, setResult] = useState<AdjustResult | null>(null);
  const [loading, setLoading] = useState(false);

  const handleAdjust = async () => {
    if (!selectedId) return;
    setLoading(true);
    try {
      const res = await api.post<AdjustResult>('/api/planner/adjust', {
        weekStart, dayOfWeek, targetEntryId: selectedId,
      });
      setResult(res);
    } catch {
      alert('Adjustment failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }}>
      <div style={{
        background: 'var(--bg)', borderRadius: 'var(--radius)', padding: 24, width: 400,
        maxHeight: '80vh', overflow: 'auto', border: '2px solid var(--border)',
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
                background: selectedId === entry.id ? 'var(--secondary-bg)' : 'transparent',
                border: selectedId === entry.id ? '1.5px solid var(--accent)' : '1.5px solid transparent',
              }}>
                <input
                  type="radio"
                  name="adjustTarget"
                  checked={selectedId === entry.id}
                  onChange={() => setSelectedId(entry.id)}
                  style={{ accentColor: 'var(--accent)' }}
                />
                <div>
                  <div style={{ fontWeight: 500, fontSize: 14 }}>{entry.meal.name}</div>
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
                  background: 'var(--primary)', color: '#fff', padding: '6px 14px',
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
                background: 'var(--secondary-bg)', padding: 10, borderRadius: 'var(--radius-sm)',
                marginBottom: 14, fontSize: 13, color: 'var(--red)',
              }}>
                This meal would be very small. Consider removing a different meal.
              </div>
            )}
            <p style={{ fontSize: 13, color: 'var(--text-light)', marginBottom: 12 }}>Updated portions:</p>
            {result.adjustedGroups.length > 0 && result.adjustedGroups.map((group, i) => {
              const pct = Math.round((1 - group.newGrams / group.originalGrams) * 100);
              return (
                <div key={`g-${i}`} style={{
                  display: 'flex', justifyContent: 'space-between', padding: '6px 0',
                  borderBottom: '1px solid var(--border)', fontSize: 13, fontWeight: 600,
                }}>
                  <span>{group.name} (cooked)</span>
                  <span>
                    <span style={{ textDecoration: 'line-through', color: 'var(--text-light)', marginRight: 8 }}>{group.originalGrams}g</span>
                    <strong>{group.newGrams}g</strong>
                    <span style={{ fontSize: 11, color: 'var(--red)', marginLeft: 6 }}>−{pct}%</span>
                  </span>
                </div>
              );
            })}
            {result.adjustedIngredients.filter((ing) => !ing.groupName).map((ing, i) => {
              const pct = ing.originalGrams > 0 ? Math.round((1 - ing.newGrams / ing.originalGrams) * 100) : 0;
              return (
                <div key={i} style={{
                  display: 'flex', justifyContent: 'space-between', padding: '6px 0',
                  borderBottom: '1px solid var(--border)', fontSize: 13,
                }}>
                  <span>{ing.name}</span>
                  <span>
                    <span style={{ textDecoration: 'line-through', color: 'var(--text-light)', marginRight: 8 }}>{ing.originalGrams}g</span>
                    <strong>{ing.newGrams}g</strong>
                    {pct > 0 && <span style={{ fontSize: 11, color: 'var(--red)', marginLeft: 6 }}>−{pct}%</span>}
                  </span>
                </div>
              );
            })}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
              <button
                onClick={() => { onAdjusted(); onClose(); }}
                style={{ background: 'var(--primary)', color: '#fff', padding: '6px 14px' }}
              >
                Done
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
