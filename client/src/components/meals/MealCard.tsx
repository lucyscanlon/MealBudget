import { useState } from 'react';
import type { Meal } from 'shared';
import { api, uploadsUrl } from '../../utils/api';

interface NutritionData {
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  ingredients: { name: string; calories: number; protein: number; carbs: number; fat: number }[];
}

interface Props {
  meal: Meal;
  onDelete: (id: number) => void;
  onEdit: (meal: Meal) => void;
  onToggleFavourite: (id: number) => void;
  onUploadPhoto: (id: number, file: File) => void;
  compact?: boolean;
}

export default function MealCard({ meal, onDelete, onEdit, onToggleFavourite, onUploadPhoto, compact }: Props) {
  const photoSrc = uploadsUrl(meal.photoUrl);
  const [showMacros, setShowMacros] = useState(false);
  const [showCalories, setShowCalories] = useState(false);
  const [nutrition, setNutrition] = useState<NutritionData | null>(null);
  const [nutritionMealKey, setNutritionMealKey] = useState('');
  const [loading, setLoading] = useState(false);

  const mealKey = `${meal.id}-${meal.ingredients.length}-${meal.ingredients.map(i => `${i.name}${i.weightGrams}`).join(',')}`;

  const loadNutrition = async () => {
    if (nutrition && nutritionMealKey === mealKey) return;
    setLoading(true);
    try {
      const ings = await api.get<{
        name: string; weightGrams: number; caloriesPer100g: number;
        proteinPer100g: number; carbsPer100g: number; fatPer100g: number;
      }[]>(`/api/meals/${meal.id}/ingredients`);

      const data: NutritionData = {
        totalCalories: 0, totalProtein: 0, totalCarbs: 0, totalFat: 0,
        ingredients: ings.map((i) => {
          const w = i.weightGrams / 100;
          const cals = Math.round(i.caloriesPer100g * w);
          const protein = Math.round(i.proteinPer100g * w * 10) / 10;
          const carbs = Math.round(i.carbsPer100g * w * 10) / 10;
          const fat = Math.round(i.fatPer100g * w * 10) / 10;
          return { name: i.name, calories: cals, protein, carbs, fat };
        }),
      };
      data.totalCalories = data.ingredients.reduce((s, i) => s + i.calories, 0);
      data.totalProtein = Math.round(data.ingredients.reduce((s, i) => s + i.protein, 0) * 10) / 10;
      data.totalCarbs = Math.round(data.ingredients.reduce((s, i) => s + i.carbs, 0) * 10) / 10;
      data.totalFat = Math.round(data.ingredients.reduce((s, i) => s + i.fat, 0) * 10) / 10;
      setNutrition(data);
      setNutritionMealKey(mealKey);
    } catch {} finally { setLoading(false); }
  };

  const handleShowMacros = async () => {
    await loadNutrition();
    setShowMacros(!showMacros);
    setShowCalories(false);
  };

  const handleShowCalories = async () => {
    await loadNutrition();
    setShowCalories(!showCalories);
    setShowMacros(false);
  };

  if (compact) {
    return (
      <div style={{
        padding: '6px 10px', borderRadius: 'var(--radius-sm)', border: '2px solid var(--border)',
        background: 'var(--bg)', fontSize: 13,
      }}>
        <div style={{ fontWeight: 500 }}>{meal.name}</div>
        <div style={{ fontSize: 12, color: 'var(--text-light)' }}>{meal.ingredients.length} items</div>
      </div>
    );
  }

  return (
    <div style={{
      border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden',
      display: 'flex', flexDirection: 'column',
      background: 'var(--card)',
    }}>
      {photoSrc ? (
        <img src={photoSrc} alt={meal.name} style={{ width: '100%', height: 140, objectFit: 'cover' }} />
      ) : (
        <div style={{
          width: '100%', height: 100, background: 'var(--secondary-bg)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--text-light)', fontSize: 14,
        }}>
          No photo
        </div>
      )}
      <div style={{ padding: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <h4 style={{ fontSize: 15, fontWeight: 600 }}>{meal.name}</h4>
          <button
            onClick={(e) => { e.stopPropagation(); onToggleFavourite(meal.id); }}
            style={{
              background: 'transparent', padding: '2px 4px', fontSize: 18, lineHeight: 1,
              color: meal.isFavourite ? 'var(--coral)' : 'var(--border)',
            }}
          >
            {meal.isFavourite ? '♥' : '♡'}
          </button>
        </div>
        {meal.tags.length > 0 && (
          <div style={{ display: 'flex', gap: 4, marginBottom: 6, flexWrap: 'wrap' }}>
            {meal.tags.map((tag) => (
              <span key={tag} style={{
                fontSize: 11, color: 'var(--forest)', background: 'var(--foam)',
                borderRadius: 20, padding: '2px 10px', textTransform: 'capitalize', fontWeight: 500,
              }}>
                {tag}
              </span>
            ))}
          </div>
        )}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 10 }}>
          {meal.ingredients.map((ing) => (
            <span key={ing.id} style={{
              fontSize: 12, color: 'var(--text-light)', background: 'var(--secondary-bg)',
              borderRadius: 3, padding: '2px 6px',
            }}>
              {ing.name} · {ing.weightGrams}g
            </span>
          ))}
        </div>

        {/* Nutrition toggle buttons */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
          <button
            onClick={handleShowMacros}
            style={{
              flex: 1, fontSize: 11, padding: '4px 0',
              border: `1.5px solid ${showMacros ? 'var(--mint)' : 'var(--border)'}`,
              background: showMacros ? 'var(--foam)' : 'transparent',
              color: showMacros ? 'var(--forest)' : 'var(--text-light)',
              borderRadius: 20,
            }}
          >
            {loading && !nutrition ? '...' : showMacros ? 'Hide macros' : 'Show macros'}
          </button>
          <button
            onClick={handleShowCalories}
            style={{
              flex: 1, fontSize: 11, padding: '4px 0',
              border: `1.5px solid ${showCalories ? 'var(--lemon-border)' : 'var(--border)'}`,
              background: showCalories ? 'var(--lemon)' : 'transparent',
              color: showCalories ? 'var(--lemon-text)' : 'var(--text-light)',
              borderRadius: 20,
            }}
          >
            {loading && !nutrition ? '...' : showCalories ? 'Hide calories' : 'Show calories'}
          </button>
        </div>

        {/* Macros panel */}
        {showMacros && nutrition && (
          <div style={{ border: '1px solid var(--mint-border)', borderRadius: 'var(--radius-sm)', padding: 10, marginBottom: 10, background: 'var(--foam)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-around', marginBottom: 8 }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--forest)' }}>{nutrition.totalProtein}g</div>
                <div style={{ fontSize: 10, color: 'var(--sage)' }}>Protein</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--forest)' }}>{nutrition.totalCarbs}g</div>
                <div style={{ fontSize: 10, color: 'var(--sage)' }}>Carbs</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--forest)' }}>{nutrition.totalFat}g</div>
                <div style={{ fontSize: 10, color: 'var(--sage)' }}>Fat</div>
              </div>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-light)' }}>
              {nutrition.ingredients.map((i, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '1px 0' }}>
                  <span>{i.name}</span>
                  <span>P:{i.protein}g C:{i.carbs}g F:{i.fat}g</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Calories panel */}
        {showCalories && nutrition && (
          <div style={{ border: '1px solid var(--lemon-border)', borderRadius: 'var(--radius-sm)', padding: 10, marginBottom: 10, background: 'var(--lemon)' }}>
            <div style={{ textAlign: 'center', marginBottom: 8 }}>
              <div style={{ fontSize: 20, fontWeight: 600, color: 'var(--lemon-text)' }}>{nutrition.totalCalories} kcal</div>
              <div style={{ fontSize: 10, color: 'var(--lemon-text)' }}>Total for this meal</div>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-light)' }}>
              {nutrition.ingredients.map((i, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '1px 0' }}>
                  <span>{i.name}</span>
                  <span style={{ fontWeight: 600, color: 'var(--lemon-text)' }}>{i.calories} kcal</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {(meal.recipeUrl || meal.recipeNotes) && (
          <div style={{ marginBottom: 10 }}>
            {meal.recipeUrl && (
              <a
                href={meal.recipeUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontSize: 12, color: 'var(--accent)', display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none', marginBottom: 4 }}
              >
                <i className="ti ti-external-link" style={{ fontSize: 14 }} />
                View recipe
              </a>
            )}
            {meal.recipeNotes && (
              <p style={{ fontSize: 12, color: 'var(--text-light)', lineHeight: 1.4, whiteSpace: 'pre-wrap' }}>
                {meal.recipeNotes.length > 80 ? meal.recipeNotes.slice(0, 80) + '...' : meal.recipeNotes}
              </p>
            )}
          </div>
        )}
        <div style={{ display: 'flex', gap: 6, fontSize: 13 }}>
          <button
            onClick={() => onEdit(meal)}
            style={{ flex: 1, border: '2px solid var(--border)', color: 'var(--text)', fontSize: 13, padding: '5px 0' }}
          >
            Edit
          </button>
          <label style={{
            flex: 1, textAlign: 'center', padding: '5px 0',
            border: '2px solid var(--border)', borderRadius: 'var(--radius-sm)',
            cursor: 'pointer', color: 'var(--text-light)',
          }}>
            Photo
            <input
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={(e) => { if (e.target.files?.[0]) onUploadPhoto(meal.id, e.target.files[0]); }}
            />
          </label>
          <button
            onClick={() => onDelete(meal.id)}
            style={{ flex: 1, border: '2px solid var(--border)', color: 'var(--red)', fontSize: 13, padding: '5px 0' }}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
