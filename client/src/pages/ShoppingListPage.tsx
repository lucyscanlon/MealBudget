import { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { api } from '../utils/api';

interface ShoppingItem {
  name: string;
  groupName: string | null;
  totalGrams: number;
}

function getMonday(d: Date): string {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  return date.toISOString().split('T')[0];
}

function formatWeight(grams: number): string {
  if (grams >= 1000) return `${(grams / 1000).toFixed(1)}kg`;
  return `${grams}g`;
}

export default function ShoppingListPage() {
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [weekStart, setWeekStart] = useState(() => getMonday(new Date()));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get<ShoppingItem[]>(`/api/shopping/${weekStart}`).then((data) => {
      setItems(data);
      setChecked(new Set());
      setLoading(false);
    });
  }, [weekStart]);

  const toggle = (name: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  };

  const [showQR, setShowQR] = useState(false);
  const mobileUrl = `http://${window.location.hostname}:3001/api/shopping/${weekStart}/mobile`;

  const uncheckedItems = items.filter((i) => !checked.has(i.name));
  const checkedItems = items.filter((i) => checked.has(i.name));

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: '40px clamp(12px, 3vw, 24px)' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <h2 style={{ fontSize: 22, fontWeight: 600 }}>Shopping list</h2>
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

      {loading && <p style={{ color: 'var(--text-light)', fontSize: 14 }}>Loading...</p>}

      {!loading && items.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-light)' }}>
          <p style={{ fontSize: 14 }}>No meals planned for this week yet.</p>
        </div>
      )}

      {!loading && items.length > 0 && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontSize: 12, color: 'var(--text-light)' }}>
              {checked.size} of {items.length} items checked
            </div>
            <button
              onClick={() => setShowQR(true)}
              style={{ background: 'var(--primary)', color: '#fff', padding: '6px 14px', fontSize: 13 }}
            >
              Send to phone
            </button>
          </div>

          {/* Unchecked items */}
          <div style={{ marginBottom: uncheckedItems.length > 0 && checkedItems.length > 0 ? 24 : 0 }}>
            {uncheckedItems.map((item) => (
              <ShoppingRow key={item.name} item={item} checked={false} onToggle={() => toggle(item.name)} />
            ))}
          </div>

          {/* Checked items */}
          {checkedItems.length > 0 && (
            <>
              <div style={{
                fontSize: 11, fontWeight: 500, color: 'var(--text-light)',
                textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8,
              }}>
                Done
              </div>
              {checkedItems.map((item) => (
                <ShoppingRow key={item.name} item={item} checked onToggle={() => toggle(item.name)} />
              ))}
            </>
          )}
        </>
      )}

      {showQR && (
        <div
          onClick={() => setShowQR(false)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--bg)', borderRadius: 'var(--radius)', padding: 32,
              border: '2px solid var(--border)', boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
              textAlign: 'center', maxWidth: 340,
            }}
          >
            <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>Scan with your phone</h3>
            <p style={{ fontSize: 13, color: 'var(--text-light)', marginBottom: 20 }}>
              Opens a shopping checklist you can use in the supermarket. Tap "Add to Reminders" to save it.
            </p>
            <div style={{ display: 'inline-block', padding: 12, background: '#fff', borderRadius: 8, border: '2px solid var(--border)' }}>
              <QRCodeSVG value={mobileUrl} size={200} />
            </div>
            <div style={{ marginTop: 16 }}>
              <button
                onClick={() => setShowQR(false)}
                style={{ color: 'var(--text-light)', padding: '6px 14px', fontSize: 13 }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ShoppingRow({ item, checked, onToggle }: {
  item: ShoppingItem; checked: boolean; onToggle: () => void;
}) {
  return (
    <div
      onClick={onToggle}
      style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px',
        borderBottom: '1px solid var(--border)', cursor: 'pointer',
        opacity: checked ? 0.5 : 1,
        transition: 'opacity 0.15s',
      }}
    >
      <div style={{
        width: 20, height: 20, borderRadius: 'var(--radius-sm)', flexShrink: 0,
        border: checked ? 'none' : '1.5px solid var(--border)',
        background: checked ? 'var(--green)' : 'var(--bg)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#fff', fontSize: 12, fontWeight: 600,
      }}>
        {checked && '✓'}
      </div>
      <div style={{ flex: 1 }}>
        <span style={{
          fontSize: 14, fontWeight: 500,
          textDecoration: checked ? 'line-through' : 'none',
          color: checked ? 'var(--text-light)' : 'var(--text)',
        }}>
          {item.name}
        </span>
      </div>
      <span style={{ fontSize: 13, color: 'var(--text-light)', fontWeight: 500 }}>
        {formatWeight(item.totalGrams)}
      </span>
    </div>
  );
}
