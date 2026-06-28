import { useState, useEffect, useCallback } from 'react';
import { DndContext, DragOverlay, closestCenter, type DragStartEvent, type DragEndEvent, useDraggable } from '@dnd-kit/core';
import { api, uploadsUrl } from '../../utils/api';
import type { Meal, WeekPlan, MacroBreakdown, MealSlot } from 'shared';
import { MEAL_SLOTS } from 'shared';
import AdjustModal from './AdjustModal';
import DayColumn from './DayColumn';

const SLOT_LABELS: Record<MealSlot, string> = {
  breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', dessert: 'Dessert', snack: 'Snack',
};

const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function getMonday(d: Date): string {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  return date.toISOString().split('T')[0];
}

export default function WeeklyPlanner() {
  const [meals, setMeals] = useState<Meal[]>([]);
  const [plan, setPlan] = useState<WeekPlan | null>(null);
  const [weekStart, setWeekStart] = useState(() => getMonday(new Date()));
  const [adjustDay, setAdjustDay] = useState<number | null>(null);
  const [macros, setMacros] = useState<Record<number, MacroBreakdown>>({});
  const [expandedMacros, setExpandedMacros] = useState<Record<number, boolean>>({});
  const [activeMeal, setActiveMeal] = useState<Meal | null>(null);

  const loadPlan = useCallback(() => {
    api.get<WeekPlan>(`/api/planner/${weekStart}`).then(setPlan);
  }, [weekStart]);

  useEffect(() => {
    api.get<Meal[]>('/api/meals').then(setMeals);
    loadPlan();
  }, [loadPlan]);

  const handleDragStart = (e: DragStartEvent) => {
    const meal = meals.find((m) => m.id === Number(e.active.id));
    if (meal) setActiveMeal(meal);
  };

  const handleDragEnd = async (e: DragEndEvent) => {
    setActiveMeal(null);
    if (!e.over) return;
    const mealId = Number(e.active.id);
    const [dayStr, slot] = (e.over.id as string).split('-');
    await api.post(`/api/planner/${weekStart}/entries`, { mealId, dayOfWeek: Number(dayStr), slot });
    loadPlan();
  };

  const handleRemoveEntry = async (entryId: number) => {
    await api.del(`/api/planner/entries/${entryId}`);
    loadPlan();
  };

  const toggleMacros = async (day: number) => {
    if (expandedMacros[day]) {
      setExpandedMacros((prev) => ({ ...prev, [day]: false }));
      return;
    }
    setExpandedCalories((prev) => ({ ...prev, [day]: false }));
    const data = await api.get<MacroBreakdown>(`/api/planner/${weekStart}/${day}/macros`);
    setMacros((prev) => ({ ...prev, [day]: data }));
    setExpandedMacros((prev) => ({ ...prev, [day]: true }));
  };

  const [calories, setCalories] = useState<Record<number, number>>({});
  const [expandedCalories, setExpandedCalories] = useState<Record<number, boolean>>({});

  const toggleCalories = async (day: number) => {
    if (expandedCalories[day]) {
      setExpandedCalories((prev) => ({ ...prev, [day]: false }));
      return;
    }
    setExpandedMacros((prev) => ({ ...prev, [day]: false }));
    const data = await api.get<{ totalCalories: number }>(`/api/planner/${weekStart}/${day}/calories`);
    setCalories((prev) => ({ ...prev, [day]: data.totalCalories }));
    setExpandedCalories((prev) => ({ ...prev, [day]: true }));
  };

  const adjustDayData = adjustDay !== null ? plan?.days.find((d) => d.dayOfWeek === adjustDay) : null;

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '40px clamp(12px, 3vw, 24px)' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32, flexWrap: 'wrap', gap: 12 }}>
        <h2 style={{ fontSize: 22, fontWeight: 600 }}>Planner</h2>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center', fontSize: 14 }}>
          <button onClick={() => {
            const d = new Date(weekStart); d.setDate(d.getDate() - 7); setWeekStart(getMonday(d));
          }} style={{ padding: '4px 10px', color: 'var(--text-light)' }}>←</button>
          <span style={{ fontWeight: 500, minWidth: 140, textAlign: 'center', color: 'var(--text)' }}>
            Week of {new Date(weekStart).toLocaleDateString('en-GB', { month: 'long', day: 'numeric' })}
          </span>
          <button onClick={() => {
            const d = new Date(weekStart); d.setDate(d.getDate() + 7); setWeekStart(getMonday(d));
          }} style={{ padding: '4px 10px', color: 'var(--text-light)' }}>→</button>
        </div>
      </div>

      <DndContext collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="planner-layout">
          {/* Meal library sidebar grouped by tag */}
          <div className="planner-sidebar">
            {MEAL_SLOTS.map((slot) => {
              const slotMeals = meals.filter((m) => m.tags.includes(slot));
              if (slotMeals.length === 0) return null;
              return (
                <div key={slot} style={{ marginBottom: 16 }}>
                  <div style={{
                    fontSize: 11, fontWeight: 500, color: 'var(--text-light)',
                    textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6,
                  }}>
                    {SLOT_LABELS[slot]}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {slotMeals.map((meal) => (
                      <DraggableMeal key={`${slot}-${meal.id}`} meal={meal} />
                    ))}
                  </div>
                </div>
              );
            })}
            {/* Untagged meals */}
            {(() => {
              const untagged = meals.filter((m) => m.tags.length === 0);
              if (untagged.length === 0) return null;
              return (
                <div style={{ marginBottom: 16 }}>
                  <div style={{
                    fontSize: 11, fontWeight: 500, color: 'var(--text-light)',
                    textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6,
                  }}>
                    Other
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {untagged.map((meal) => (
                      <DraggableMeal key={meal.id} meal={meal} />
                    ))}
                  </div>
                </div>
              );
            })()}
            {meals.length === 0 && (
              <p style={{ fontSize: 13, color: 'var(--text-light)' }}>
                Add meals first
              </p>
            )}
          </div>

          {/* Day grid — wraps to new lines */}
          <div className="planner-grid">
            {plan?.days.map((day) => {
              const isEmpty = day.entries.length === 0;
              const borderColor = isEmpty ? 'var(--border)' : day.status === 'red' ? 'var(--red)' : day.status === 'amber' ? '#F59E0B' : 'var(--green)';
              return (
                <div key={day.dayOfWeek} style={{
                  border: `1px solid ${borderColor}`,
                  borderRadius: 'var(--radius)',
                  padding: 14,
                  transition: 'border-color 0.2s',
                  background: 'var(--card)',
                }}>
                  {/* Day header */}
                  <div style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    marginBottom: 12, paddingBottom: 8, borderBottom: '1px solid var(--border)',
                  }}>
                    <span style={{ fontWeight: 600, fontSize: 15 }}>{DAY_NAMES[day.dayOfWeek]}</span>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {(day.status === 'red' || day.status === 'amber') && (
                        <button
                          onClick={() => setAdjustDay(day.dayOfWeek)}
                          style={{ color: day.status === 'red' ? 'var(--red)' : '#F59E0B', fontSize: 12, fontWeight: 500, padding: '2px 8px' }}
                        >
                          Adjust
                        </button>
                      )}
                      <button
                        onClick={() => toggleCalories(day.dayOfWeek)}
                        style={{ color: expandedCalories[day.dayOfWeek] ? 'var(--lemon-text)' : 'var(--text-light)', fontSize: 12, padding: '2px 8px' }}
                      >
                        {expandedCalories[day.dayOfWeek] ? 'Hide' : 'Cals'}
                      </button>
                      <button
                        onClick={() => toggleMacros(day.dayOfWeek)}
                        style={{ color: expandedMacros[day.dayOfWeek] ? 'var(--sage)' : 'var(--text-light)', fontSize: 12, padding: '2px 8px' }}
                      >
                        {expandedMacros[day.dayOfWeek] ? 'Hide' : 'Macros'}
                      </button>
                    </div>
                  </div>

                  {/* Over budget notice */}
                  {day.status === 'amber' && (
                    <div style={{
                      fontSize: 12, color: '#F59E0B', fontWeight: 500,
                      marginBottom: 10, padding: '4px 0',
                    }}>
                      Slightly over budget
                    </div>
                  )}
                  {day.status === 'red' && (
                    <div style={{
                      fontSize: 12, color: 'var(--red)', fontWeight: 500,
                      marginBottom: 10, padding: '4px 0',
                    }}>
                      Over budget
                    </div>
                  )}

                  {/* Calories */}
                  {expandedCalories[day.dayOfWeek] && calories[day.dayOfWeek] !== undefined && (
                    <div style={{
                      fontSize: 13, fontWeight: 600, color: 'var(--lemon-text)',
                      background: 'var(--lemon)', borderRadius: 8, padding: '6px 10px',
                      marginBottom: 10, textAlign: 'center',
                    }}>
                      {calories[day.dayOfWeek]} kcal
                    </div>
                  )}

                  {/* Macros */}
                  {expandedMacros[day.dayOfWeek] && macros[day.dayOfWeek] && (
                    <div style={{
                      fontSize: 12, display: 'flex', gap: 8, marginBottom: 10,
                      background: 'var(--foam)', borderRadius: 8, padding: '6px 10px',
                      justifyContent: 'center',
                    }}>
                      <span style={{ color: 'var(--sage)' }}>P {macros[day.dayOfWeek].proteinGrams}g</span>
                      <span style={{ color: 'var(--sage)' }}>C {macros[day.dayOfWeek].carbsGrams}g</span>
                      <span style={{ color: 'var(--sage)' }}>F {macros[day.dayOfWeek].fatGrams}g</span>
                    </div>
                  )}

                  <DayColumn day={day} onRemoveEntry={handleRemoveEntry} />
                </div>
              );
            })}
          </div>
        </div>

        <DragOverlay>
          {activeMeal && (
            <div style={{
              background: 'var(--bg)', border: '2px solid var(--border)',
              borderRadius: 'var(--radius-sm)', padding: '6px 10px', fontSize: 13, fontWeight: 500,
              boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
            }}>
              {activeMeal.name}
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {adjustDay !== null && adjustDayData && (
        <AdjustModal
          entries={adjustDayData.entries}
          weekStart={weekStart}
          dayOfWeek={adjustDay}
          onClose={() => setAdjustDay(null)}
          onAdjusted={loadPlan}
        />
      )}
    </div>
  );
}

function DraggableMeal({ meal }: { meal: Meal }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: String(meal.id) });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={{
        padding: '6px 10px', borderRadius: 'var(--radius-sm)',
        border: `1px solid ${meal.isFavourite ? 'var(--mint)' : 'var(--border)'}`,
        background: meal.isFavourite ? 'var(--foam)' : 'var(--bg)',
        cursor: 'grab', opacity: isDragging ? 0.4 : 1,
        touchAction: 'none', fontSize: 13,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {meal.photoUrl ? (
          <img src={meal.photoUrl} alt="" style={{ width: 32, height: 32, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }} />
        ) : (
          <div style={{ width: 32, height: 32, borderRadius: 6, background: 'var(--secondary-bg)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: 'var(--text-light)' }}>
            <i className="ti ti-bowl" style={{ fontSize: 14 }} />
          </div>
        )}
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 13, display: 'flex', alignItems: 'center', gap: 4 }}>
            {meal.isFavourite && <span style={{ color: 'var(--coral)', fontSize: 11 }}>♥</span>}
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{meal.name}</span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-light)' }}>{meal.ingredients.length} items</div>
        </div>
      </div>
    </div>
  );
}
