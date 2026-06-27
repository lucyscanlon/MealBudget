import { useState, useEffect } from 'react';
import { api } from '../../utils/api';

export default function BudgetSetup() {
  const [budget, setBudget] = useState<number>(2000);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<{ dailyCalorieBudget: number }>('/api/budget').then((data) => {
      setBudget(data.dailyCalorieBudget);
      setLoading(false);
    });
  }, []);

  const handleSave = async () => {
    await api.put('/api/budget', { dailyCalorieBudget: budget });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  if (loading) return <p style={{ color: 'var(--text-light)', fontSize: 14 }}>Loading...</p>;

  return (
    <div>
      <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>Daily calorie budget</h2>
      <p style={{ color: 'var(--text-light)', marginBottom: 20, fontSize: 14 }}>
        This is the only place you'll see a number.
      </p>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16 }}>
        <input
          type="number"
          value={budget}
          onChange={(e) => setBudget(Number(e.target.value))}
          min={100}
          step={50}
          style={{ width: 120, fontSize: 20, fontWeight: 600, textAlign: 'center' }}
        />
        <span style={{ color: 'var(--text-light)', fontSize: 14 }}>kcal</span>
      </div>
      <button
        onClick={handleSave}
        style={{
          padding: '8px 20px',
          background: saved ? 'var(--green)' : 'var(--primary)',
          color: '#fff',
          fontSize: 14,
          fontWeight: 500,
        }}
      >
        {saved ? 'Saved' : 'Save'}
      </button>
    </div>
  );
}
