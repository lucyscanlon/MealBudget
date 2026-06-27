import type { BudgetStatus } from 'shared';

interface Props {
  ratio: number;
  status: BudgetStatus;
}

const colors: Record<BudgetStatus, string> = {
  green: 'var(--green)',
  amber: 'var(--amber)',
  red: 'var(--red)',
};

export default function BudgetBar({ ratio, status }: Props) {
  const pct = Math.min(ratio * 100, 100);
  const overflowPct = ratio > 1 ? Math.min((ratio - 1) * 100, 100) : 0;

  return (
    <div style={{ marginTop: 8, marginBottom: 4 }}>
      <div style={{
        height: 10,
        borderRadius: 5,
        background: '#e8e8e8',
        overflow: 'hidden',
        position: 'relative',
      }}>
        <div style={{
          height: '100%',
          width: `${pct}%`,
          background: colors[status],
          borderRadius: 5,
          transition: 'width 0.3s, background 0.3s',
        }} />
      </div>
      {overflowPct > 0 && (
        <div style={{ fontSize: 12, color: 'var(--red)', marginTop: 4, fontWeight: 600 }}>
          Over budget!
        </div>
      )}
    </div>
  );
}
