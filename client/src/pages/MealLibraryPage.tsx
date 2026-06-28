import { useState, useEffect } from 'react';
import { api } from '../utils/api';
import type { Meal, MealSlot } from 'shared';
import { MEAL_SLOTS } from 'shared';
import MealCard from '../components/meals/MealCard';
import MealForm from '../components/meals/MealForm';

const SLOT_LABELS: Record<MealSlot, string> = {
  breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', dessert: 'Dessert', snack: 'Snack',
};

type Filter = 'all' | MealSlot;

export default function MealLibraryPage() {
  const [meals, setMeals] = useState<Meal[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingMeal, setEditingMeal] = useState<Meal | null>(null);
  const [filter, setFilter] = useState<Filter>('all');

  const loadMeals = () => {
    api.get<Meal[]>('/api/meals').then(setMeals);
  };

  useEffect(loadMeals, []);

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this meal?')) return;
    await api.del(`/api/meals/${id}`);
    loadMeals();
  };

  const handleEdit = (meal: Meal) => {
    setEditingMeal(meal);
    setShowForm(true);
  };

  const handleFormClose = () => {
    setShowForm(false);
    setEditingMeal(null);
  };

  const handleToggleFavourite = async (id: number) => {
    await api.put(`/api/meals/${id}/favourite`, {});
    loadMeals();
  };

  const handleUploadPhoto = async (id: number, file: File) => {
    await api.upload(`/api/meals/${id}/photo`, file);
    loadMeals();
  };

  const filteredMeals = filter === 'all'
    ? meals
    : meals.filter((m) => m.tags.includes(filter));

  // Group meals by tag for the "all" view
  const groupedByTag = () => {
    const groups: { slot: MealSlot; meals: Meal[] }[] = [];
    for (const slot of MEAL_SLOTS) {
      const slotMeals = meals.filter((m) => m.tags.includes(slot));
      if (slotMeals.length > 0) groups.push({ slot, meals: slotMeals });
    }
    const untagged = meals.filter((m) => m.tags.length === 0);
    return { groups, untagged };
  };

  const renderMealCard = (meal: Meal) => (
    <MealCard
      key={meal.id}
      meal={meal}
      onDelete={handleDelete}
      onEdit={handleEdit}
      onToggleFavourite={handleToggleFavourite}
      onUploadPhoto={handleUploadPhoto}
    />
  );

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '40px clamp(12px, 3vw, 24px)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <h2 style={{ fontSize: 22, fontWeight: 600 }}>Meals</h2>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {!showForm && (
            <button
              onClick={() => { setEditingMeal(null); setShowForm(true); }}
              style={{ color: 'var(--accent)', fontWeight: 600, fontSize: 14 }}
            >
              + New meal
            </button>
          )}
        </div>
      </div>

      {/* Filter pills */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 24, flexWrap: 'wrap' }}>
        <FilterPill active={filter === 'all'} onClick={() => setFilter('all')} label="All" count={meals.length} />
        {MEAL_SLOTS.map((slot) => {
          const count = meals.filter((m) => m.tags.includes(slot)).length;
          if (count === 0) return null;
          return <FilterPill key={slot} active={filter === slot} onClick={() => setFilter(slot)} label={SLOT_LABELS[slot]} count={count} />;
        })}
      </div>

      {showForm && (
        <div style={{ marginBottom: 32 }}>
          <MealForm
            editMeal={editingMeal ?? undefined}
            onSaved={() => { handleFormClose(); loadMeals(); }}
            onCancel={handleFormClose}
          />
        </div>
      )}

      {/* Filtered view — flat grid */}
      {filter !== 'all' && (
        <div className="meal-grid">
          {filteredMeals.map(renderMealCard)}
        </div>
      )}

      {/* All view — grouped by tag */}
      {filter === 'all' && (() => {
        const { groups, untagged } = groupedByTag();
        return (
          <>
            {groups.map(({ slot, meals: slotMeals }) => (
              <div key={slot} style={{ marginBottom: 28 }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12,
                }}>
                  <div style={{
                    fontSize: 13, fontWeight: 600, color: 'var(--sage)',
                    textTransform: 'uppercase', letterSpacing: '0.04em',
                  }}>
                    {SLOT_LABELS[slot]}
                  </div>
                  <div style={{
                    fontSize: 11, color: 'var(--text-light)', background: 'var(--foam)',
                    borderRadius: 20, padding: '2px 8px', fontWeight: 600,
                  }}>
                    {slotMeals.length}
                  </div>
                </div>
                <div className="meal-grid">
                  {slotMeals.map(renderMealCard)}
                </div>
              </div>
            ))}
            {untagged.length > 0 && (
              <div style={{ marginBottom: 28 }}>
                <div style={{
                  fontSize: 13, fontWeight: 600, color: 'var(--text-light)',
                  textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 12,
                }}>
                  Other
                </div>
                <div className="meal-grid">
                  {untagged.map(renderMealCard)}
                </div>
              </div>
            )}
          </>
        );
      })()}

      {meals.length === 0 && !showForm && (
        <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--text-light)' }}>
          <p style={{ fontSize: 14 }}>No meals yet. Click "+ New meal" to get started.</p>
        </div>
      )}

      {filter !== 'all' && filteredMeals.length === 0 && meals.length > 0 && (
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-light)' }}>
          <p style={{ fontSize: 14 }}>No {SLOT_LABELS[filter as MealSlot].toLowerCase()} meals yet.</p>
        </div>
      )}
    </div>
  );
}

function FilterPill({ active, onClick, label, count }: {
  active: boolean; onClick: () => void; label: string; count: number;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '5px 14px', borderRadius: 20, fontSize: 13, fontWeight: 600,
        background: active ? 'var(--foam)' : 'transparent',
        color: active ? 'var(--forest)' : 'var(--text-light)',
        border: `1.5px solid ${active ? 'var(--mint)' : 'var(--border)'}`,
      }}
    >
      {label} <span style={{ fontSize: 11, opacity: 0.7 }}>{count}</span>
    </button>
  );
}
