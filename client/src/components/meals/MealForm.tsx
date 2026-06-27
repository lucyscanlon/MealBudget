import { useState, useEffect } from 'react';
import { api } from '../../utils/api';
import { MEAL_SLOTS, type MealSlot } from 'shared';
import BarcodeScanner from './BarcodeScanner';
import IngredientSearch from './IngredientSearch';

const TAG_LABELS: Record<MealSlot, string> = {
  breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', dessert: 'Dessert', snack: 'Snack',
};

interface IngredientInput {
  name: string;
  weightGrams: number;
  caloriesPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
  barcode: string | null;
  resolved: boolean;
  groupName: string | null;
  groupCookedWeight: number | null;
}

interface Props {
  onSaved: () => void;
  onCancel: () => void;
  editMeal?: import('shared').Meal;
}

const emptyIngredient = (): IngredientInput => ({
  name: '', weightGrams: 100, caloriesPer100g: 0, proteinPer100g: 0, carbsPer100g: 0, fatPer100g: 0, barcode: null, resolved: false, groupName: null, groupCookedWeight: null,
});

export default function MealForm({ onSaved, onCancel, editMeal }: Props) {
  const [name, setName] = useState(editMeal?.name || '');
  const [tags, setTags] = useState<MealSlot[]>(editMeal?.tags || []);
  const [ingredients, setIngredients] = useState<IngredientInput[]>([]);
  const [addingMode, setAddingMode] = useState<'search' | 'manual' | 'barcode' | null>(null);

  useEffect(() => {
    if (!editMeal) return;
    api.get<IngredientInput[]>(`/api/meals/${editMeal.id}/ingredients`).then((data) => {
      setIngredients(data.map((ing) => ({ ...ing, resolved: true })));
    });
  }, [editMeal]);
  const [manualInput, setManualInput] = useState(emptyIngredient());
  const [saving, setSaving] = useState(false);

  const addResolvedIngredient = (ing: IngredientInput) => {
    setIngredients((prev) => [...prev, ing]);
    setAddingMode(null);
    setManualInput(emptyIngredient());
  };

  const handleSearchSelect = (product: { name: string; caloriesPer100g: number; proteinPer100g: number; carbsPer100g: number; fatPer100g: number; barcode: string }) => {
    addResolvedIngredient({
      name: product.name,
      weightGrams: 100,
      caloriesPer100g: product.caloriesPer100g,
      proteinPer100g: product.proteinPer100g,
      carbsPer100g: product.carbsPer100g,
      fatPer100g: product.fatPer100g,
      barcode: product.barcode,
      resolved: true,
      groupName: null,
      groupCookedWeight: null,
    });
  };

  const handleBarcodeScan = async (barcode: string) => {
    try {
      const product = await api.get<{
        name: string; caloriesPer100g: number; proteinPer100g: number; carbsPer100g: number; fatPer100g: number; barcode: string;
      }>(`/api/barcode/${barcode}`);
      addResolvedIngredient({
        name: product.name,
        weightGrams: 100,
        caloriesPer100g: product.caloriesPer100g,
        proteinPer100g: product.proteinPer100g,
        carbsPer100g: product.carbsPer100g,
        fatPer100g: product.fatPer100g,
        barcode: product.barcode,
        resolved: true,
        groupName: null,
        groupCookedWeight: null,
      });
    } catch {
      alert('Product not found. Try searching by name or entering manually.');
    }
  };

  const handleSubmit = async () => {
    if (!name.trim()) return alert('Please enter a meal name');
    if (ingredients.length === 0) return alert('Add at least one ingredient');
    setSaving(true);
    try {
      if (editMeal) {
        await api.put(`/api/meals/${editMeal.id}`, { name, tags, ingredients });
      } else {
        await api.post('/api/meals', { name, tags, ingredients });
      }
      onSaved();
    } catch {
      alert('Failed to save meal');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 24, background: 'var(--card)' }}>
      <h3 style={{ fontSize: 17, fontWeight: 600, marginBottom: 16 }}>{editMeal ? 'Edit meal' : 'New meal'}</h3>

      <input
        placeholder="Meal name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        style={{ width: '100%', marginBottom: 16, fontSize: 15, fontWeight: 500 }}
      />

      {/* Tag picker */}
      <div style={{
        fontSize: 11, fontWeight: 500, color: 'var(--text-light)',
        textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6,
      }}>
        Meal type
      </div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
        {MEAL_SLOTS.map((slot) => {
          const active = tags.includes(slot);
          return (
            <button
              key={slot}
              onClick={() => setTags((prev) => active ? prev.filter((t) => t !== slot) : [...prev, slot])}
              style={{
                padding: '4px 12px', fontSize: 13,
                border: `1px solid ${active ? 'var(--primary)' : 'var(--border)'}`,
                background: active ? 'var(--primary)' : 'var(--bg)',
                color: active ? '#fff' : 'var(--text-light)',
                fontWeight: active ? 500 : 400,
              }}
            >
              {TAG_LABELS[slot]}
            </button>
          );
        })}
      </div>

      <div style={{
        fontSize: 11, fontWeight: 500, color: 'var(--text-light)',
        textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8,
      }}>
        Ingredients
      </div>

      {/* Added ingredients — grouped and ungrouped */}
      {(() => {
        const groups = new Map<string, { indices: number[]; cookedWeight: number }>();
        const ungrouped: number[] = [];
        ingredients.forEach((ing, i) => {
          if (ing.groupName) {
            if (!groups.has(ing.groupName)) {
              groups.set(ing.groupName, { indices: [], cookedWeight: ing.groupCookedWeight || 0 });
            }
            groups.get(ing.groupName)!.indices.push(i);
          } else {
            ungrouped.push(i);
          }
        });

        return (
          <>
            {/* Grouped ingredients */}
            {Array.from(groups.entries()).map(([groupName, group]) => (
              <div key={groupName} style={{
                border: '2px solid var(--border)', borderRadius: 'var(--radius-sm)', marginBottom: 8, overflow: 'hidden',
              }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px',
                  background: 'var(--secondary-bg)', borderBottom: '1px solid var(--border)',
                }}>
                  <span style={{ fontSize: 12, fontWeight: 600, flex: 1 }}>{groupName}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-light)' }}>Cooked:</span>
                  <input
                    type="number"
                    value={group.cookedWeight}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setIngredients((prev) => prev.map((item, idx) =>
                        group.indices.includes(idx) ? { ...item, groupCookedWeight: val } : item
                      ));
                    }}
                    style={{ width: 60, textAlign: 'center', fontSize: 12, padding: '3px 6px' }}
                  />
                  <span style={{ fontSize: 11, color: 'var(--text-light)' }}>g</span>
                  <button
                    onClick={() => {
                      setIngredients((prev) => prev.map((item, idx) =>
                        group.indices.includes(idx) ? { ...item, groupName: null, groupCookedWeight: null } : item
                      ));
                    }}
                    style={{ color: 'var(--text-light)', fontSize: 11, padding: '2px 6px' }}
                  >
                    Ungroup
                  </button>
                </div>
                {group.indices.map((i) => (
                  <IngredientRow key={i} ing={ingredients[i]} index={i} setIngredients={setIngredients} />
                ))}
              </div>
            ))}

            {/* Ungrouped ingredients */}
            {ungrouped.map((i) => (
              <IngredientRow key={i} ing={ingredients[i]} index={i} setIngredients={setIngredients} />
            ))}

            {/* Group button */}
            {ingredients.length >= 2 && (
              <GroupBuilder ingredients={ingredients} setIngredients={setIngredients} />
            )}
          </>
        );
      })()}

      {/* Add ingredient modes */}
      {addingMode === null && (
        <div style={{ display: 'flex', gap: 8, marginTop: 8, marginBottom: 20 }}>
          <button
            onClick={() => setAddingMode('search')}
            style={{ flex: 1, border: '2px solid var(--border)', padding: '8px 0', fontSize: 13, fontWeight: 500 }}
          >
            + Search
          </button>
          <button
            onClick={() => setAddingMode('barcode')}
            style={{ flex: 1, border: '2px solid var(--border)', padding: '8px 0', fontSize: 13, color: 'var(--text-light)' }}
          >
            Scan barcode
          </button>
        </div>
      )}

      {addingMode === 'search' && (
        <div style={{ border: '2px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: 12, marginTop: 8, marginBottom: 20 }}>
          <IngredientSearch
            onSelect={handleSearchSelect}
            onSwitchToManual={() => setAddingMode('manual')}
          />
          <button
            onClick={() => setAddingMode(null)}
            style={{ color: 'var(--text-light)', fontSize: 12, marginTop: 8 }}
          >
            Cancel
          </button>
        </div>
      )}

      {addingMode === 'manual' && (
        <div style={{ border: '2px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: 12, marginTop: 8, marginBottom: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 10 }}>Manual entry</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <input
              placeholder="Ingredient name"
              value={manualInput.name}
              onChange={(e) => setManualInput({ ...manualInput, name: e.target.value })}
            />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              <div>
                <label style={{ fontSize: 11, color: 'var(--text-light)' }}>Weight (g)</label>
                <input type="number" value={manualInput.weightGrams} onChange={(e) => setManualInput({ ...manualInput, weightGrams: Number(e.target.value) })} style={{ width: '100%' }} />
              </div>
              <div>
                <label style={{ fontSize: 11, color: 'var(--text-light)' }}>Calories /100g</label>
                <input type="number" value={manualInput.caloriesPer100g} onChange={(e) => setManualInput({ ...manualInput, caloriesPer100g: Number(e.target.value) })} style={{ width: '100%' }} />
              </div>
              <div>
                <label style={{ fontSize: 11, color: 'var(--text-light)' }}>Protein /100g</label>
                <input type="number" value={manualInput.proteinPer100g} onChange={(e) => setManualInput({ ...manualInput, proteinPer100g: Number(e.target.value) })} style={{ width: '100%' }} />
              </div>
              <div>
                <label style={{ fontSize: 11, color: 'var(--text-light)' }}>Carbs /100g</label>
                <input type="number" value={manualInput.carbsPer100g} onChange={(e) => setManualInput({ ...manualInput, carbsPer100g: Number(e.target.value) })} style={{ width: '100%' }} />
              </div>
              <div>
                <label style={{ fontSize: 11, color: 'var(--text-light)' }}>Fat /100g</label>
                <input type="number" value={manualInput.fatPer100g} onChange={(e) => setManualInput({ ...manualInput, fatPer100g: Number(e.target.value) })} style={{ width: '100%' }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
              <button onClick={() => setAddingMode('search')} style={{ color: 'var(--text-light)', fontSize: 13 }}>Back</button>
              <button
                onClick={() => {
                  if (!manualInput.name.trim()) return alert('Enter an ingredient name');
                  addResolvedIngredient({ ...manualInput, resolved: true, groupName: manualInput.groupName || null, groupCookedWeight: manualInput.groupCookedWeight || null });
                }}
                style={{ background: 'var(--primary)', color: '#fff', fontSize: 13, padding: '6px 14px' }}
              >
                Add
              </button>
            </div>
          </div>
        </div>
      )}

      {addingMode === 'barcode' && (
        <BarcodeScanner
          onScan={(barcode) => { handleBarcodeScan(barcode); setAddingMode(null); }}
          onClose={() => setAddingMode(null)}
        />
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', borderTop: '1px solid var(--border)', paddingTop: 16 }}>
        <button onClick={onCancel} style={{ color: 'var(--text-light)', padding: '6px 14px' }}>Cancel</button>
        <button onClick={handleSubmit} disabled={saving} style={{ background: 'var(--primary)', color: '#fff', padding: '6px 14px' }}>
          {saving ? 'Saving...' : editMeal ? 'Update meal' : 'Save meal'}
        </button>
      </div>
    </div>
  );
}

function IngredientRow({ ing, index, setIngredients }: {
  ing: IngredientInput; index: number;
  setIngredients: React.Dispatch<React.SetStateAction<IngredientInput[]>>;
}) {
  return (
    <div style={{
      display: 'flex', gap: 8, alignItems: 'center', padding: '8px 10px',
      background: ing.groupName ? 'var(--bg)' : 'var(--secondary-bg)',
      borderRadius: ing.groupName ? 0 : 4, marginBottom: ing.groupName ? 0 : 4,
      borderBottom: ing.groupName ? '1px solid var(--border)' : 'none',
      fontSize: 13,
    }}>
      <span style={{ flex: 1, fontWeight: 500 }}>{ing.name}</span>
      <input
        type="number"
        value={ing.weightGrams}
        onChange={(e) => {
          const val = Number(e.target.value);
          setIngredients((prev) => prev.map((item, idx) => idx === index ? { ...item, weightGrams: val } : item));
        }}
        style={{ width: 60, textAlign: 'center', fontSize: 13, padding: '4px 6px' }}
      />
      <span style={{ fontSize: 12, color: 'var(--text-light)' }}>g</span>
      <button
        onClick={() => setIngredients((prev) => prev.filter((_, idx) => idx !== index))}
        style={{ color: 'var(--text-light)', padding: '0 6px', fontSize: 16, lineHeight: 1 }}
      >
        ×
      </button>
    </div>
  );
}

function GroupBuilder({ ingredients, setIngredients }: {
  ingredients: IngredientInput[];
  setIngredients: React.Dispatch<React.SetStateAction<IngredientInput[]>>;
}) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<number[]>([]);
  const [groupName, setGroupName] = useState('');
  const [cookedWeight, setCookedWeight] = useState(0);

  const ungrouped = ingredients.map((ing, i) => ({ ing, i })).filter(({ ing }) => !ing.groupName);

  if (ungrouped.length < 2) return null;

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        style={{ fontSize: 12, color: 'var(--accent)', padding: '4px 0', marginTop: 4, marginBottom: 8 }}
      >
        Group ingredients together
      </button>
    );
  }

  const handleCreate = () => {
    if (!groupName.trim()) return alert('Enter a group name');
    if (selected.length < 2) return alert('Select at least 2 ingredients');
    if (cookedWeight <= 0) return alert('Enter the cooked weight');
    setIngredients((prev) => prev.map((item, i) =>
      selected.includes(i) ? { ...item, groupName: groupName.trim(), groupCookedWeight: cookedWeight } : item
    ));
    setOpen(false);
    setSelected([]);
    setGroupName('');
    setCookedWeight(0);
  };

  return (
    <div style={{ border: '2px solid var(--accent)', borderRadius: 'var(--radius-sm)', padding: 12, marginTop: 4, marginBottom: 8 }}>
      <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 8 }}>Create ingredient group</div>
      <p style={{ fontSize: 12, color: 'var(--text-light)', marginBottom: 8 }}>
        Select ingredients that are cooked together and weighed as one.
      </p>
      <input
        placeholder="Group name (e.g., Korean BBQ Chicken)"
        value={groupName}
        onChange={(e) => setGroupName(e.target.value)}
        style={{ width: '100%', marginBottom: 8, fontSize: 13 }}
      />
      {ungrouped.map(({ ing, i }) => (
        <label key={i} style={{
          display: 'flex', gap: 8, alignItems: 'center', padding: '4px 8px',
          borderRadius: 3, cursor: 'pointer', fontSize: 13,
          background: selected.includes(i) ? 'rgba(82, 183, 136, 0.1)' : 'transparent',
        }}>
          <input
            type="checkbox"
            checked={selected.includes(i)}
            onChange={() => setSelected((prev) =>
              prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i]
            )}
            style={{ accentColor: 'var(--accent)' }}
          />
          <span>{ing.name} ({ing.weightGrams}g)</span>
        </label>
      ))}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
        <span style={{ fontSize: 12, color: 'var(--text-light)' }}>Total cooked weight:</span>
        <input
          type="number"
          value={cookedWeight || ''}
          onChange={(e) => setCookedWeight(Number(e.target.value))}
          placeholder="e.g. 280"
          style={{ width: 80, fontSize: 13, padding: '4px 6px' }}
        />
        <span style={{ fontSize: 12, color: 'var(--text-light)' }}>g</span>
      </div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
        <button onClick={() => { setOpen(false); setSelected([]); }} style={{ color: 'var(--text-light)', fontSize: 12 }}>Cancel</button>
        <button onClick={handleCreate} style={{ background: 'var(--primary)', color: '#fff', fontSize: 12, padding: '4px 12px' }}>
          Create group
        </button>
      </div>
    </div>
  );
}
