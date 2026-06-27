import { useState, useEffect } from 'react';
import { api } from '../../utils/api';

interface WeightPoint {
  date: string;
  weightLbs: number;
}

interface ProjectionData {
  logs: WeightPoint[];
  projection: WeightPoint[];
  goalWeightLbs: number | null;
  estimatedGoalDate: string | null;
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' });
}

function lbsToStone(lbs: number) {
  const stone = Math.floor(lbs / 14);
  const pounds = Math.round((lbs % 14) * 10) / 10;
  return `${stone}st ${pounds}lb`;
}

export default function WeightChart() {
  const [data, setData] = useState<ProjectionData | null>(null);

  useEffect(() => {
    api.get<ProjectionData>('/api/weight/projection').then(setData);
  }, []);

  if (!data || data.logs.length === 0) return null;

  const allPoints = [...data.logs, ...data.projection];
  const allWeights = allPoints.map((p) => p.weightLbs);
  if (data.goalWeightLbs) allWeights.push(data.goalWeightLbs);

  const minW = Math.floor(Math.min(...allWeights) - 2);
  const maxW = Math.ceil(Math.max(...allWeights) + 2);
  const minDate = new Date(allPoints[0].date).getTime();
  const maxDate = new Date(allPoints[allPoints.length - 1].date).getTime();
  const dateRange = maxDate - minDate || 1;

  const W = 580;
  const H = 260;
  const PAD = { top: 20, right: 20, bottom: 30, left: 50 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  const x = (date: string) => PAD.left + ((new Date(date).getTime() - minDate) / dateRange) * plotW;
  const y = (w: number) => PAD.top + ((maxW - w) / (maxW - minW)) * plotH;

  const logPath = data.logs.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.date)},${y(p.weightLbs)}`).join(' ');
  const projPath = data.projection.length > 0
    ? `M${x(data.logs[data.logs.length - 1].date)},${y(data.logs[data.logs.length - 1].weightLbs)} ` +
      data.projection.map((p) => `L${x(p.date)},${y(p.weightLbs)}`).join(' ')
    : '';

  // Y-axis labels (every 7 lbs ≈ half stone)
  const yLabels: number[] = [];
  for (let w = Math.ceil(minW / 7) * 7; w <= maxW; w += 7) yLabels.push(w);

  // X-axis labels (monthly)
  const xLabels: { date: string; label: string }[] = [];
  const seen = new Set<string>();
  for (const p of allPoints) {
    const d = new Date(p.date);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    if (!seen.has(key)) {
      seen.add(key);
      xLabels.push({ date: p.date, label: d.toLocaleDateString('en-GB', { month: 'short' }) });
    }
  }

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 16, background: 'var(--card)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <i className="ti ti-chart-line" style={{ fontSize: 18, color: 'var(--sage)' }} />
        <h3 style={{ fontSize: 16, fontWeight: 600 }}>Progress</h3>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto' }}>
        {/* Y gridlines and labels */}
        {yLabels.map((w) => (
          <g key={w}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(w)} y2={y(w)} stroke="var(--border)" strokeWidth={0.5} />
            <text x={PAD.left - 6} y={y(w) + 4} textAnchor="end" fontSize={10} fill="var(--text-light)">
              {lbsToStone(w)}
            </text>
          </g>
        ))}

        {/* X labels */}
        {xLabels.map(({ date, label }) => (
          <text key={date} x={x(date)} y={H - 6} textAnchor="middle" fontSize={10} fill="var(--text-light)">
            {label}
          </text>
        ))}

        {/* Goal line */}
        {data.goalWeightLbs && (
          <>
            <line
              x1={PAD.left} x2={W - PAD.right}
              y1={y(data.goalWeightLbs)} y2={y(data.goalWeightLbs)}
              stroke="var(--green)" strokeWidth={1} strokeDasharray="4,3"
            />
            <text x={W - PAD.right + 4} y={y(data.goalWeightLbs) + 4} fontSize={9} fill="var(--green)">
              Goal
            </text>
          </>
        )}

        {/* Projection line */}
        {projPath && (
          <path d={projPath} fill="none" stroke="var(--accent)" strokeWidth={1.5} strokeDasharray="4,3" />
        )}

        {/* Actual weight line */}
        <path d={logPath} fill="none" stroke="var(--text)" strokeWidth={2} />

        {/* Data points */}
        {data.logs.map((p, i) => (
          <circle key={i} cx={x(p.date)} cy={y(p.weightLbs)} r={3} fill="var(--text)" />
        ))}

        {/* Goal date marker */}
        {data.estimatedGoalDate && data.goalWeightLbs && (
          <>
            <line
              x1={x(data.estimatedGoalDate)} x2={x(data.estimatedGoalDate)}
              y1={PAD.top} y2={y(data.goalWeightLbs)}
              stroke="var(--green)" strokeWidth={0.5} strokeDasharray="3,3"
            />
            <circle cx={x(data.estimatedGoalDate)} cy={y(data.goalWeightLbs)} r={4} fill="var(--green)" />
            <text
              x={x(data.estimatedGoalDate)}
              y={PAD.top - 4}
              textAnchor="middle" fontSize={9} fill="var(--green)" fontWeight="600"
            >
              {formatDate(data.estimatedGoalDate)}
            </text>
          </>
        )}
      </svg>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginTop: 8, fontSize: 11, color: 'var(--text-light)' }}>
        <span><span style={{ display: 'inline-block', width: 16, height: 2, background: 'var(--text)', marginRight: 4, verticalAlign: 'middle' }} /> Actual</span>
        <span><span style={{ display: 'inline-block', width: 16, height: 2, background: 'var(--accent)', marginRight: 4, verticalAlign: 'middle', borderTop: '1px dashed var(--accent)' }} /> Projected</span>
        <span><span style={{ display: 'inline-block', width: 16, height: 2, background: 'var(--green)', marginRight: 4, verticalAlign: 'middle', borderTop: '1px dashed var(--green)' }} /> Goal</span>
      </div>
    </div>
  );
}
