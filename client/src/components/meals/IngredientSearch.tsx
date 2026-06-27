import { useState, useEffect, useRef } from 'react';
import { api } from '../../utils/api';

interface FoodProduct {
  name: string;
  brand: string;
  caloriesPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
  barcode: string;
}

interface Props {
  onSelect: (product: FoodProduct) => void;
  onSwitchToManual: () => void;
}

export default function IngredientSearch({ onSelect, onSwitchToManual }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<FoodProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      setSearched(false);
      return;
    }

    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await api.get<FoodProduct[]>(`/api/barcode/search?q=${encodeURIComponent(query)}`);
        setResults(data);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
        setSearched(true);
      }
    }, 400);

    return () => clearTimeout(debounceRef.current);
  }, [query]);

  return (
    <div>
      <input
        placeholder="Search for an ingredient..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        style={{ width: '100%', marginBottom: 8 }}
        autoFocus
      />

      {loading && <p style={{ fontSize: 13, color: 'var(--text-light)', padding: '6px 0' }}>Searching...</p>}

      {results.length > 0 && (
        <div style={{ border: '2px solid var(--border)', borderRadius: 'var(--radius-sm)', maxHeight: 220, overflow: 'auto', marginBottom: 8 }}>
          {results.map((product, i) => (
            <button
              key={i}
              onClick={() => onSelect(product)}
              style={{
                width: '100%', textAlign: 'left', padding: '8px 10px',
                background: i % 2 === 0 ? 'var(--bg)' : 'var(--secondary-bg)',
                borderBottom: '1px solid var(--border)', borderRadius: 0,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                fontSize: 13,
              }}
            >
              <span>
                <span style={{ fontWeight: 500 }}>{product.name}</span>
                {product.brand && <span style={{ color: 'var(--text-light)' }}> · {product.brand}</span>}
              </span>
              <span style={{ fontSize: 11, color: 'var(--text-light)', whiteSpace: 'nowrap', marginLeft: 8 }}>
                P:{Math.round(product.proteinPer100g)}g
                C:{Math.round(product.carbsPer100g)}g
                F:{Math.round(product.fatPer100g)}g
              </span>
            </button>
          ))}
        </div>
      )}

      {searched && results.length === 0 && !loading && (
        <p style={{ fontSize: 13, color: 'var(--text-light)', padding: '6px 0' }}>No results found.</p>
      )}

      <button
        onClick={onSwitchToManual}
        style={{ color: 'var(--text-light)', fontSize: 12, padding: '4px 0' }}
      >
        Can't find it? Enter manually →
      </button>
    </div>
  );
}
