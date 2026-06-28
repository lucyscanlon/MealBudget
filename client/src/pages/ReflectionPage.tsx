import { useState, useEffect } from 'react';
import { api } from '../utils/api';

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

type DayStatus = 'none' | 'on_track' | 'off_track';

interface DayReflection {
  dayOfWeek: number;
  status: DayStatus;
}

interface Reflection {
  weekStart: string;
  days: DayReflection[];
  notes: string;
  wins: string;
  struggles: string;
}

interface WeekSummary {
  weekStart: string;
  onTrack: number;
  offTrack: number;
  total: number;
}

function getSunday(d: Date): string {
  const date = new Date(d);
  date.setDate(date.getDate() - date.getDay());
  return date.toISOString().split('T')[0];
}

export default function ReflectionPage() {
  const [weekStart, setWeekStart] = useState(() => getSunday(new Date()));
  const [reflection, setReflection] = useState<Reflection | null>(null);
  const [history, setHistory] = useState<WeekSummary[]>([]);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.get<Reflection>(`/api/reflection/${weekStart}`).then(setReflection);
    api.get<WeekSummary[]>('/api/reflection').then(setHistory);
  }, [weekStart]);

  const toggleDay = (dayOfWeek: number) => {
    if (!reflection) return;
    setReflection((prev) => {
      if (!prev) return prev;
      const days = prev.days.map((d) => {
        if (d.dayOfWeek !== dayOfWeek) return d;
        const next: DayStatus = d.status === 'none' ? 'on_track' : d.status === 'on_track' ? 'off_track' : 'none';
        return { ...d, status: next };
      });
      return { ...prev, days };
    });
  };

  const handleSave = async () => {
    if (!reflection) return;
    setSaving(true);
    await api.put(`/api/reflection/${weekStart}`, reflection);
    setSaving(false);
    setSaved(true);
    api.get<WeekSummary[]>('/api/reflection').then(setHistory);
    setTimeout(() => setSaved(false), 2000);
  };

  if (!reflection) return <p style={{ padding: 40, color: 'var(--text-light)' }}>Loading...</p>;

  const onTrackCount = reflection.days.filter((d) => d.status === 'on_track').length;
  const offTrackCount = reflection.days.filter((d) => d.status === 'off_track').length;
  const markedCount = onTrackCount + offTrackCount;

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '40px clamp(12px, 3vw, 24px)' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <i className="ti ti-notebook" style={{ fontSize: 20, color: 'var(--sage)' }} />
          <h2 style={{ fontSize: 22, fontWeight: 600 }}>Weekly reflection</h2>
        </div>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center', fontSize: 14 }}>
          <button onClick={() => {
            const d = new Date(weekStart); d.setDate(d.getDate() - 7); setWeekStart(getSunday(d));
          }} style={{ padding: '4px 10px', color: 'var(--text-light)' }}>←</button>
          <span style={{ fontWeight: 500, minWidth: 140, textAlign: 'center' }}>
            Week of {new Date(weekStart + 'T00:00:00').toLocaleDateString('en-GB', { month: 'long', day: 'numeric' })}
          </span>
          <button onClick={() => {
            const d = new Date(weekStart); d.setDate(d.getDate() + 7); setWeekStart(getSunday(d));
          }} style={{ padding: '4px 10px', color: 'var(--text-light)' }}>→</button>
        </div>
      </div>

      {/* Day tracker */}
      <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 16, background: 'var(--card)', marginBottom: 20 }}>
        <div style={{ fontSize: 12, color: 'var(--text-light)', marginBottom: 10, fontWeight: 600 }}>
          Tap each day: green = on track, red = off track, grey = not marked
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {reflection.days.map((day) => (
            <button
              key={day.dayOfWeek}
              onClick={() => toggleDay(day.dayOfWeek)}
              style={{
                flex: 1, padding: '10px 0', borderRadius: 'var(--radius-sm)', fontSize: 12, fontWeight: 600,
                border: '1.5px solid',
                borderColor: day.status === 'on_track' ? 'var(--mint)' : day.status === 'off_track' ? 'var(--coral)' : 'var(--border)',
                background: day.status === 'on_track' ? 'var(--foam)' : day.status === 'off_track' ? 'var(--coral-light)' : 'var(--card)',
                color: day.status === 'on_track' ? 'var(--forest)' : day.status === 'off_track' ? 'var(--coral)' : 'var(--text-light)',
              }}
            >
              {DAY_NAMES[day.dayOfWeek].slice(0, 3)}
            </button>
          ))}
        </div>
        {markedCount > 0 && (
          <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginTop: 12, fontSize: 13 }}>
            <span style={{ color: 'var(--forest)', fontWeight: 600 }}>{onTrackCount} on track</span>
            {offTrackCount > 0 && <span style={{ color: 'var(--coral)', fontWeight: 600 }}>{offTrackCount} off track</span>}
            <span style={{ color: 'var(--text-light)' }}>{Math.round((onTrackCount / 7) * 100)}% adherence</span>
          </div>
        )}
      </div>

      {/* Reflection prompts */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 20 }}>
        <ReflectionField
          icon="ti-trophy"
          iconColor="var(--lemon-text)"
          bg="var(--lemon)"
          border="var(--lemon-border)"
          label="Wins this week"
          placeholder="What went well? What are you proud of?"
          value={reflection.wins}
          onChange={(v) => setReflection({ ...reflection, wins: v })}
        />
        <ReflectionField
          icon="ti-alert-triangle"
          iconColor="var(--coral)"
          bg="var(--coral-light)"
          border="var(--coral)"
          label="Struggles"
          placeholder="What was hard? What tripped you up?"
          value={reflection.struggles}
          onChange={(v) => setReflection({ ...reflection, struggles: v })}
        />
        <ReflectionField
          icon="ti-notes"
          iconColor="var(--sage)"
          bg="var(--foam)"
          border="var(--mint-border)"
          label="Notes for next week"
          placeholder="Anything to change or try differently?"
          value={reflection.notes}
          onChange={(v) => setReflection({ ...reflection, notes: v })}
        />
      </div>

      {/* Save */}
      <button
        onClick={handleSave}
        disabled={saving}
        style={{
          width: '100%', padding: '10px 0', fontSize: 14, fontWeight: 600,
          background: saved ? 'var(--mint)' : 'var(--forest)',
          color: '#D8F3DC', borderRadius: 'var(--radius-sm)',
        }}
      >
        {saved ? 'Saved!' : saving ? 'Saving...' : 'Save reflection'}
      </button>

      {/* History */}
      {history.length > 0 && (
        <div style={{ marginTop: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <i className="ti ti-chart-bar" style={{ fontSize: 16, color: 'var(--sage)' }} />
            <h3 style={{ fontSize: 15, fontWeight: 600 }}>Adherence history</h3>
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end', height: 80 }}>
            {history.slice().reverse().map((week) => {
              const pct = week.total > 0 ? Math.round((week.onTrack / 7) * 100) : 0;
              const weekDate = new Date(week.weekStart + 'T00:00:00');
              return (
                <div key={week.weekStart} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: pct >= 70 ? 'var(--sage)' : pct > 0 ? 'var(--coral)' : 'var(--text-light)' }}>
                    {pct > 0 ? `${pct}%` : ''}
                  </div>
                  <div style={{
                    width: '100%', maxWidth: 32, height: Math.max(pct * 0.6, 4), borderRadius: 4,
                    background: pct >= 70 ? 'var(--mint)' : pct > 0 ? 'var(--coral)' : 'var(--border)',
                  }} />
                  <div style={{ fontSize: 9, color: 'var(--text-light)' }}>
                    {weekDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function ReflectionField({ icon, iconColor, bg, border, label, placeholder, value, onChange }: {
  icon: string; iconColor: string; bg: string; border: string;
  label: string; placeholder: string; value: string; onChange: (v: string) => void;
}) {
  return (
    <div style={{ border: `1px solid ${border}`, borderRadius: 'var(--radius)', overflow: 'hidden' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px',
        background: bg,
      }}>
        <i className={`ti ${icon}`} style={{ fontSize: 16, color: iconColor }} />
        <span style={{ fontSize: 13, fontWeight: 600, color: iconColor }}>{label}</span>
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={2}
        style={{
          width: '100%', border: 'none', padding: '10px 14px', fontSize: 13,
          fontFamily: 'var(--font)', outline: 'none', resize: 'vertical',
          background: 'var(--card)', color: 'var(--text)',
        }}
      />
    </div>
  );
}
