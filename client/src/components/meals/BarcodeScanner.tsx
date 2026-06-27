import { useState } from 'react';

interface Props {
  onScan: (barcode: string) => void;
  onClose: () => void;
}

export default function BarcodeScanner({ onScan, onClose }: Props) {
  const [manual, setManual] = useState('');

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }}>
      <div style={{
        background: 'var(--bg)', borderRadius: 'var(--radius)', padding: 24, width: 360,
        border: '2px solid var(--border)', boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
      }}>
        <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>Scan barcode</h3>
        <p style={{ fontSize: 13, color: 'var(--text-light)', marginBottom: 14 }}>
          Enter the barcode number from the packaging.
        </p>
        <input
          placeholder="e.g. 5000159461122"
          value={manual}
          onChange={(e) => setManual(e.target.value)}
          style={{ width: '100%', marginBottom: 14 }}
          autoFocus
          onKeyDown={(e) => { if (e.key === 'Enter' && manual.trim()) onScan(manual.trim()); }}
        />
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ color: 'var(--text-light)', padding: '6px 14px' }}>Cancel</button>
          <button
            onClick={() => manual.trim() && onScan(manual.trim())}
            style={{ background: 'var(--primary)', color: '#fff', padding: '6px 14px' }}
          >
            Look up
          </button>
        </div>
      </div>
    </div>
  );
}
