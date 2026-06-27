import type { Meal } from 'shared';
import { uploadsUrl } from '../../utils/api';

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
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 12 }}>
          {meal.ingredients.map((ing) => (
            <span key={ing.id} style={{
              fontSize: 12, color: 'var(--text-light)', background: 'var(--secondary-bg)',
              borderRadius: 3, padding: '2px 6px',
            }}>
              {ing.name} · {ing.weightGrams}g
            </span>
          ))}
        </div>
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
