import { useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import type { DayPlan, MealSlot, PlanEntry } from 'shared';
import { MEAL_SLOTS } from 'shared';

const SLOT_LABELS: Record<MealSlot, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  dessert: 'Dessert',
  snack: 'Snack',
};

interface Props {
  day: DayPlan;
  onRemoveEntry: (entryId: number) => void;
}

export default function DayColumn({ day, onRemoveEntry }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {MEAL_SLOTS.map((slot) => (
        <SlotDropZone key={slot} dayOfWeek={day.dayOfWeek} slot={slot} label={SLOT_LABELS[slot]}>
          {day.entries
            .filter((e) => e.slot === slot)
            .map((entry) => (
              <EntryCard key={entry.id} entry={entry} onRemove={onRemoveEntry} />
            ))}
        </SlotDropZone>
      ))}
    </div>
  );
}

function EntryCard({ entry, onRemove }: { entry: PlanEntry; onRemove: (id: number) => void }) {
  const [expanded, setExpanded] = useState(false);
  const isReduced = entry.portionScale !== 1;
  const pctChange = Math.round((1 - entry.portionScale) * 100);

  return (
    <div style={{
      borderRadius: 3, background: 'var(--bg)',
      border: '2px solid var(--border)', marginBottom: 3, fontSize: 13,
    }}>
      <div
        style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '5px 8px', cursor: 'pointer',
        }}
        onClick={() => setExpanded(!expanded)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontWeight: 500 }}>{entry.meal.name}</span>
          {isReduced && (
            <span style={{
              fontSize: 10, fontWeight: 600, color: 'var(--red)',
              background: '#FDEAE5', padding: '1px 5px', borderRadius: 3,
            }}>
              Reduced
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ fontSize: 11, color: 'var(--text-light)' }}>
            {expanded ? '▾' : '▸'}
          </span>
          <button
            onClick={(e) => { e.stopPropagation(); onRemove(entry.id); }}
            style={{ color: 'var(--text-light)', padding: '0 4px', fontSize: 16, lineHeight: 1 }}
          >
            ×
          </button>
        </div>
      </div>
      {expanded && (
        <div style={{ padding: '4px 8px 8px', borderTop: '1px solid var(--border)' }}>
          {(() => {
            const groups = new Map<string, { cookedWeight: number; ingredients: typeof entry.meal.ingredients }>();
            const ungrouped: typeof entry.meal.ingredients = [];
            for (const ing of entry.meal.ingredients) {
              if (ing.groupName) {
                if (!groups.has(ing.groupName)) {
                  groups.set(ing.groupName, { cookedWeight: ing.groupCookedWeight || 0, ingredients: [] });
                }
                groups.get(ing.groupName)!.ingredients.push(ing);
              } else {
                ungrouped.push(ing);
              }
            }
            return (
              <>
                {Array.from(groups.entries()).map(([name, group]) => (
                  <div key={name} style={{ marginBottom: 4 }}>
                    <div style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '3px 0', fontSize: 12, fontWeight: 600, color: 'var(--text)',
                    }}>
                      <span>{name}</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span>{Math.round(group.cookedWeight * entry.portionScale)}g</span>
                        {isReduced && (
                          <span style={{ fontSize: 10, color: 'var(--red)' }}>−{pctChange}%</span>
                        )}
                      </span>
                    </div>
                    {group.ingredients.map((ing, i) => (
                      <div key={i} style={{
                        display: 'flex', justifyContent: 'space-between', padding: '1px 0 1px 12px',
                        fontSize: 11, color: 'var(--text-light)',
                      }}>
                        <span>{ing.name}</span>
                        <span>{ing.weightGrams}g</span>
                      </div>
                    ))}
                  </div>
                ))}
                {ungrouped.map((ing, i) => (
                  <div key={i} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '2px 0', fontSize: 12, color: 'var(--text-light)',
                  }}>
                    <span>{ing.name}</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ fontWeight: 500, color: 'var(--text)' }}>{ing.weightGrams}g</span>
                      {isReduced && (
                        <span style={{ fontSize: 10, color: 'var(--red)' }}>−{pctChange}%</span>
                      )}
                    </span>
                  </div>
                ))}
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
}

function SlotDropZone({ dayOfWeek, slot, label, children }: {
  dayOfWeek: number; slot: MealSlot; label: string; children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `${dayOfWeek}-${slot}` });

  return (
    <div
      ref={setNodeRef}
      style={{
        background: isOver ? 'rgba(82, 183, 136, 0.08)' : 'var(--secondary-bg)',
        borderRadius: 'var(--radius-sm)',
        padding: 8,
        minHeight: 48,
        border: isOver ? '1.5px dashed var(--accent)' : '1.5px dashed transparent',
        transition: 'all 0.15s',
      }}
    >
      <div style={{
        fontSize: 11, fontWeight: 500, color: 'var(--text-light)',
        textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4,
      }}>
        {label}
      </div>
      {children}
    </div>
  );
}
