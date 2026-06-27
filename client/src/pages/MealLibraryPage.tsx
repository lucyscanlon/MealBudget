import { useState, useEffect } from 'react';
import { api } from '../utils/api';
import type { Meal } from 'shared';
import MealCard from '../components/meals/MealCard';
import MealForm from '../components/meals/MealForm';

export default function MealLibraryPage() {
  const [meals, setMeals] = useState<Meal[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingMeal, setEditingMeal] = useState<Meal | null>(null);

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

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '40px clamp(12px, 3vw, 24px)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 32 }}>
        <h2 style={{ fontSize: 22, fontWeight: 600 }}>Meals</h2>
        {!showForm && (
          <button
            onClick={() => { setEditingMeal(null); setShowForm(true); }}
            style={{ color: 'var(--accent)', fontWeight: 500, fontSize: 14 }}
          >
            + New meal
          </button>
        )}
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

      <div className="meal-grid">
        {meals.map((meal) => (
          <MealCard key={meal.id} meal={meal} onDelete={handleDelete} onEdit={handleEdit} onToggleFavourite={handleToggleFavourite} onUploadPhoto={handleUploadPhoto} />
        ))}
      </div>

      {meals.length === 0 && !showForm && (
        <div style={{ textAlign: 'center', padding: '80px 0', color: 'var(--text-light)' }}>
          <p style={{ fontSize: 14 }}>No meals yet. Click "+ New meal" to get started.</p>
        </div>
      )}
    </div>
  );
}
