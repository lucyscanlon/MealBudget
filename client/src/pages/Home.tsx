import { useState, useEffect } from 'react';
import { api } from '../utils/api';
import WeightChart from '../components/budget/WeightChart';

interface Profile {
  heightCm: number | null;
  age: number | null;
  sex: string | null;
  activityLevel: string | null;
  goalWeightLbs: number | null;
  weeklyLossTarget: number;
  dailyCalorieBudget: number;
  startingWeightLbs: number | null;
  currentWeightLbs: number | null;
}

function lbsToStone(lbs: number) {
  const stone = Math.floor(lbs / 14);
  const pounds = Math.round((lbs % 14) * 10) / 10;
  return { stone, pounds };
}

function stoneToLbs(stone: number, pounds: number) {
  return stone * 14 + pounds;
}

function formatStone(lbs: number) {
  const { stone, pounds } = lbsToStone(lbs);
  return <>{stone}<small>st</small> {pounds}<small>lb</small></>;
}

export default function Home() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [editing, setEditing] = useState(false);
  const [projectionData, setProjectionData] = useState<{ estimatedGoalDate: string | null; goalWeightLbs: number | null } | null>(null);

  const [startStone, setStartStone] = useState(0);
  const [startPounds, setStartPounds] = useState(0);
  const [goalStone, setGoalStone] = useState(0);
  const [goalPounds, setGoalPounds] = useState(0);
  const [currentStone, setCurrentStone] = useState(0);
  const [currentPounds, setCurrentPounds] = useState(0);
  const [heightFt, setHeightFt] = useState(5);
  const [heightIn, setHeightIn] = useState(6);
  const [age, setAge] = useState(25);
  const [sex, setSex] = useState('female');
  const [activityLevel, setActivityLevel] = useState('sedentary');
  const [weeklyLossTarget, setWeeklyLossTarget] = useState(1);

  // Weigh-in state
  const [weighStone, setWeighStone] = useState(0);
  const [weighPounds, setWeighPounds] = useState(0);
  const [weighLogging, setWeighLogging] = useState(false);
  const [weighDone, setWeighDone] = useState(false);

  const loadProfile = () => api.get<Profile>('/api/profile').then(setProfile);
  const loadProjection = () => api.get<any>('/api/weight/projection').then(setProjectionData);

  useEffect(() => {
    loadProfile();
    loadProjection();
  }, []);

  useEffect(() => {
    if (!profile) return;
    if (profile.startingWeightLbs) {
      const s = lbsToStone(profile.startingWeightLbs);
      setStartStone(s.stone); setStartPounds(s.pounds);
    }
    if (profile.goalWeightLbs) {
      const g = lbsToStone(profile.goalWeightLbs);
      setGoalStone(g.stone); setGoalPounds(g.pounds);
    }
    if (profile.currentWeightLbs) {
      const c = lbsToStone(profile.currentWeightLbs);
      setCurrentStone(c.stone); setCurrentPounds(c.pounds);
    }
    if (profile.heightCm) {
      const totalIn = profile.heightCm / 2.54;
      setHeightFt(Math.floor(totalIn / 12));
      setHeightIn(Math.round(totalIn % 12));
    }
    if (profile.age) setAge(profile.age);
    if (profile.sex) setSex(profile.sex);
    if (profile.activityLevel) setActivityLevel(profile.activityLevel);
    if (profile.weeklyLossTarget) setWeeklyLossTarget(profile.weeklyLossTarget);
    if (!profile.heightCm) setEditing(true);
  }, [profile]);

  const handleSave = async () => {
    const heightCm = Math.round((heightFt * 12 + heightIn) * 2.54);
    const currentWeightLbs = stoneToLbs(currentStone, currentPounds);
    const goalWeightLbs = stoneToLbs(goalStone, goalPounds);

    const result = await api.put<{ dailyCalorieBudget: number }>('/api/profile', {
      heightCm, age, sex, activityLevel, goalWeightLbs, weeklyLossTarget, currentWeightLbs,
    });

    setProfile((prev) => prev ? {
      ...prev, heightCm, age, sex, activityLevel, goalWeightLbs, weeklyLossTarget,
      dailyCalorieBudget: result.dailyCalorieBudget,
      currentWeightLbs,
      startingWeightLbs: prev.startingWeightLbs || currentWeightLbs,
    } : null);
    setEditing(false);
    loadProjection();
  };

  const handleWeighIn = async () => {
    const weightLbs = stoneToLbs(weighStone, weighPounds);
    if (weightLbs <= 0) return;
    setWeighLogging(true);
    await api.post('/api/weight', { weightLbs });
    setWeighLogging(false);
    setWeighDone(true);
    loadProfile();
    loadProjection();
    setTimeout(() => setWeighDone(false), 2000);
  };

  if (!profile) return <p style={{ padding: 40, color: 'var(--text-light)' }}>Loading...</p>;

  const totalLost = profile.startingWeightLbs && profile.currentWeightLbs
    ? Math.round((profile.startingWeightLbs - profile.currentWeightLbs) * 10) / 10
    : null;
  const toGo = profile.currentWeightLbs && profile.goalWeightLbs
    ? Math.round((profile.currentWeightLbs - profile.goalWeightLbs) * 10) / 10
    : null;
  const progressPct = profile.startingWeightLbs && profile.goalWeightLbs && profile.currentWeightLbs
    ? Math.min(100, Math.round(((profile.startingWeightLbs - profile.currentWeightLbs) / (profile.startingWeightLbs - profile.goalWeightLbs)) * 100))
    : 0;

  const hasSetup = !!profile.heightCm;

  // Edit modal
  if (editing) {
    return (
      <div style={{ padding: '40px 24px', maxWidth: 540, margin: '0 auto' }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 16 }}>Your details</h2>
        <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 24, background: 'var(--card)' }}>
          <div className="edit-profile-grid" style={{ marginBottom: 16 }}>
            <div>
              <Label>Height</Label>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <NumInput value={heightFt} onChange={setHeightFt} style={{ width: 60, textAlign: 'center' }} />
                <span style={unitStyle}>ft</span>
                <NumInput value={heightIn} onChange={setHeightIn} style={{ width: 60, textAlign: 'center' }} />
                <span style={unitStyle}>in</span>
              </div>
            </div>
            <div>
              <Label>Age</Label>
              <NumInput value={age} onChange={setAge} style={{ width: '100%' }} />
            </div>
            <div>
              <Label>Sex</Label>
              <select value={sex} onChange={(e) => setSex(e.target.value)} style={{ width: '100%' }}>
                <option value="female">Female</option>
                <option value="male">Male</option>
              </select>
            </div>
            <div>
              <Label>Activity level</Label>
              <select value={activityLevel} onChange={(e) => setActivityLevel(e.target.value)} style={{ width: '100%' }}>
                <option value="sedentary">Sedentary</option>
                <option value="light">Lightly active</option>
                <option value="moderate">Moderately active</option>
                <option value="active">Active</option>
                <option value="very_active">Very active</option>
              </select>
            </div>
          </div>

          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16, marginBottom: 16 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 13, color: 'var(--text-light)', width: 100, flexShrink: 0 }}>Starting weight</span>
                <StoneInput stone={startStone} pounds={startPounds} onStoneChange={setStartStone} onPoundsChange={setStartPounds} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 13, color: 'var(--text-light)', width: 100, flexShrink: 0 }}>Current weight</span>
                <StoneInput stone={currentStone} pounds={currentPounds} onStoneChange={setCurrentStone} onPoundsChange={setCurrentPounds} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 13, color: 'var(--text-light)', width: 100, flexShrink: 0 }}>Goal weight</span>
                <StoneInput stone={goalStone} pounds={goalPounds} onStoneChange={setGoalStone} onPoundsChange={setGoalPounds} />
              </div>
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <Label>Weekly loss target</Label>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <NumInput value={weeklyLossTarget} onChange={setWeeklyLossTarget} step={0.5} min={0.5} max={2} style={{ width: 60 }} />
              <span style={unitStyle}>lbs / week</span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            {hasSetup && <button onClick={() => setEditing(false)} style={{ color: 'var(--text-light)', padding: '6px 14px' }}>Cancel</button>}
            <button onClick={handleSave} style={{ background: 'var(--primary)', color: '#fff', padding: '6px 14px' }}>Save</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '28px clamp(16px, 3vw, 28px) 48px' }}>
      {/* Header row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 600 }}>Dashboard</h1>
        <button onClick={() => setEditing(true)} style={{ color: 'var(--accent)', fontSize: 13 }}>
          Edit profile
        </button>
      </div>

      {/* Top row: stat cards — each pastel */}
      <div className="dashboard-stats" style={{ marginBottom: 20 }}>
        <PastelCard bg="var(--lavender)" border="var(--lavender-border)" labelColor="var(--lavender-text)" label="Starting" icon="ti-flag" value={profile.startingWeightLbs ? formatStone(profile.startingWeightLbs) : '—'} />
        <PastelCard bg="var(--foam)" border="var(--mint-border)" labelColor="#15803D" label="Current" icon="ti-scale" value={profile.currentWeightLbs ? formatStone(profile.currentWeightLbs) : '—'} />
        <PastelCard bg="var(--pink)" border="var(--pink-border)" labelColor="var(--pink-text)" label="Goal" icon="ti-target" value={profile.goalWeightLbs ? formatStone(profile.goalWeightLbs) : '—'} />
        <PastelCard bg="var(--lemon)" border="var(--lemon-border)" labelColor="var(--lemon-text)" label="Total lost" icon="ti-trending-down" value={totalLost !== null ? <>{totalLost}<small>lbs</small></> : '—'} valueColor={totalLost && totalLost > 0 ? '#15803D' : undefined} />
        <PastelCard bg="var(--peach)" border="var(--peach-border)" labelColor="var(--peach-text)" label="To go" icon="ti-road" value={toGo !== null ? <>{toGo}<small>lbs</small></> : '—'} />
      </div>

      {/* Progress bar */}
      {progressPct > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 12, color: 'var(--text-light)' }}>
            <span>Progress to goal</span>
            <span style={{ fontWeight: 600, color: 'var(--text)' }}>{progressPct}%</span>
          </div>
          <div style={{ height: 10, borderRadius: 20, background: '#F0EDE8' }}>
            <div style={{
              height: '100%', width: `${progressPct}%`, borderRadius: 20,
              background: 'var(--sage)',
              transition: 'width 0.3s',
            }} />
          </div>
        </div>
      )}

      {/* Main content: two columns */}
      <div className="dashboard-main">
        {/* Left: chart */}
        <WeightChart />

        {/* Right: sidebar cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Estimated goal date */}
          {projectionData?.estimatedGoalDate && (
            <SideCard bg="var(--foam)" border="var(--mint-border)">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <div style={{ fontSize: 11, color: '#15803D', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>
                  Estimated goal date
                </div>
                <i className="ti ti-calendar-check" style={{ fontSize: 18, color: '#15803D', opacity: 0.4 }} />
              </div>
              <div style={{ fontSize: 20, fontWeight: 600, color: 'var(--forest)' }}>
                {new Date(projectionData.estimatedGoalDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
              </div>
            </SideCard>
          )}

          <CalorieReveal budget={profile.dailyCalorieBudget} />

          <SideCard>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ fontSize: 11, color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>
                Weekly weigh-in
              </div>
              <i className="ti ti-scale" style={{ fontSize: 16, color: 'var(--text-light)', opacity: 0.4 }} />
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <StoneInput stone={weighStone} pounds={weighPounds} onStoneChange={setWeighStone} onPoundsChange={setWeighPounds} />
              <button
                onClick={handleWeighIn}
                disabled={weighLogging}
                style={{
                  background: weighDone ? 'var(--green)' : 'var(--primary)',
                  color: '#D8F3DC', padding: '7px 14px', marginLeft: 'auto', whiteSpace: 'nowrap',
                  borderRadius: 10,
                }}
              >
                {weighDone ? 'Logged!' : weighLogging ? '...' : 'Log'}
              </button>
            </div>
          </SideCard>

          <SideCard>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ fontSize: 11, color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>
                Settings
              </div>
              <i className="ti ti-settings" style={{ fontSize: 16, color: 'var(--text-light)', opacity: 0.4 }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-light)' }}>Weekly target</span>
                <span style={{ fontWeight: 600 }}>{profile.weeklyLossTarget} lbs/week</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-light)' }}>Activity</span>
                <span style={{ fontWeight: 600, textTransform: 'capitalize' }}>{profile.activityLevel?.replace('_', ' ')}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-light)' }}>Height</span>
                <span style={{ fontWeight: 600 }}>{heightFt}ft {heightIn}in</span>
              </div>
            </div>
          </SideCard>
        </div>
      </div>

      {/* Trends insights */}
      {hasSetup && <TrendsPanel />}

      {/* Weight log management */}
      {hasSetup && <WeightLogManager onChanged={() => { loadProfile(); loadProjection(); }} />}
    </div>
  );
}

function PastelCard({ bg, border, labelColor, label, icon, value, valueColor }: {
  bg: string; border: string; labelColor: string; label: string; icon?: string; value: React.ReactNode; valueColor?: string;
}) {
  return (
    <div style={{
      background: bg, border: `1px solid ${border}`,
      borderRadius: 'var(--radius)', padding: '12px 14px', textAlign: 'center',
      position: 'relative', overflow: 'hidden',
    }}>
      {icon && (
        <i className={`ti ${icon}`} style={{
          position: 'absolute', top: 8, right: 8, fontSize: 20, color: labelColor, opacity: 0.3,
        }} />
      )}
      <div style={{ fontSize: 11, color: labelColor, textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600, marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: 17, fontWeight: 600, color: valueColor || 'var(--text)' }}>
        {value}
      </div>
    </div>
  );
}

function SideCard({ children, bg, border }: { children: React.ReactNode; bg?: string; border?: string }) {
  return (
    <div style={{
      background: bg || 'var(--card)',
      border: `1px solid ${border || 'var(--border)'}`,
      borderRadius: 'var(--radius)', padding: 14,
    }}>
      {children}
    </div>
  );
}

interface TrendsData {
  hasEnoughData: boolean;
  totalLost: number;
  avgPerWeek: number;
  recentAvg: number;
  weeklyTarget: number;
  weeklyChanges: number[];
  streak: number;
  bestWeekLoss: number;
  bestWeekDate: string;
  status: 'ahead' | 'on_track' | 'behind';
  adjustedGoalDate: string | null;
  weeksTracked: number;
}

function TrendsPanel() {
  const [trends, setTrends] = useState<TrendsData | null>(null);

  useEffect(() => {
    api.get<TrendsData>('/api/weight/trends').then(setTrends);
  }, []);

  if (!trends || !trends.hasEnoughData) return null;

  const statusConfig = {
    ahead: { label: 'Ahead of target', color: 'var(--mint)', bg: 'var(--foam)' },
    on_track: { label: 'On track', color: 'var(--sage)', bg: 'var(--foam)' },
    behind: { label: 'Behind target', color: 'var(--coral)', bg: '#FDEAE5' },
  };
  const s = statusConfig[trends.status];

  return (
    <div style={{ marginTop: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <i className="ti ti-bulb" style={{ fontSize: 20, color: 'var(--lemon-text)' }} />
        <h3 style={{ fontSize: 18, fontWeight: 600 }}>Insights</h3>
      </div>

      {/* Status banner */}
      <div style={{
        background: s.bg, borderRadius: 'var(--radius)', padding: '12px 16px',
        display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14,
        border: `1px solid ${s.color}`,
      }}>
        <div style={{
          width: 10, height: 10, borderRadius: '50%', background: s.color, flexShrink: 0,
        }} />
        <div>
          <div style={{ fontWeight: 600, fontSize: 14, color: s.color }}>{s.label}</div>
          <div style={{ fontSize: 12, color: 'var(--text-light)' }}>
            Averaging {trends.avgPerWeek}lbs/week vs your {trends.weeklyTarget}lbs/week target
          </div>
        </div>
      </div>

      {/* Stats grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12, marginBottom: 16 }}>
        <TrendCard label="Total lost" value={`${trends.totalLost}lbs`} sub={`over ${trends.weeksTracked} weeks`} />
        <TrendCard label="Avg per week" value={`${trends.avgPerWeek}lbs`} sub={`target: ${trends.weeklyTarget}lbs`} />
        <TrendCard label="Recent avg" value={`${trends.recentAvg}lbs`} sub="last 4 weeks" />
        <TrendCard label="Loss streak" value={`${trends.streak} week${trends.streak !== 1 ? 's' : ''}`} sub="consecutive losses" />
        {trends.bestWeekLoss > 0 && (
          <TrendCard
            label="Best week"
            value={`${trends.bestWeekLoss}lbs`}
            sub={new Date(trends.bestWeekDate + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
          />
        )}
        {trends.adjustedGoalDate && (
          <TrendCard
            label="Realistic goal"
            value={new Date(trends.adjustedGoalDate + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
            sub="based on recent rate"
          />
        )}
      </div>

      {/* Weekly changes mini chart */}
      {trends.weeklyChanges.length > 0 && (
        <div style={{ border: '2px solid var(--border)', borderRadius: 'var(--radius)', padding: 16 }}>
          <div style={{ fontSize: 12, color: 'var(--text-light)', marginBottom: 8 }}>Recent weekly changes</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', height: 60 }}>
            {trends.weeklyChanges.map((change, i) => {
              const maxChange = Math.max(...trends.weeklyChanges.map(Math.abs), 0.1);
              const height = Math.abs(change) / maxChange * 50;
              const isLoss = change > 0;
              return (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <div style={{ fontSize: 10, color: isLoss ? 'var(--sage)' : 'var(--coral)', fontWeight: 600 }}>
                    {isLoss ? '-' : '+'}{Math.abs(change)}
                  </div>
                  <div style={{
                    width: '100%', maxWidth: 40, height: Math.max(height, 4), borderRadius: 3,
                    background: isLoss ? 'var(--mint)' : 'var(--coral)',
                  }} />
                  <div style={{ fontSize: 9, color: 'var(--text-light)' }}>W{i + 1}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function TrendCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 12, background: 'var(--card)' }}>
      <div style={{ fontSize: 11, color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--forest)' }}>{value}</div>
      <div style={{ fontSize: 11, color: 'var(--text-light)' }}>{sub}</div>
    </div>
  );
}

function WeightLogManager({ onChanged }: { onChanged: () => void }) {
  const [logs, setLogs] = useState<{ id: number; weightLbs: number; date: string }[]>([]);
  const [expanded, setExpanded] = useState(false);

  const loadLogs = () => {
    api.get<{ id: number; weightLbs: number; date: string }[]>('/api/weight').then(setLogs);
  };

  useEffect(() => { loadLogs(); }, []);

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this weight log?')) return;
    await api.del(`/api/weight/${id}`);
    loadLogs();
    onChanged();
  };

  if (logs.length === 0) return null;

  return (
    <div style={{ marginTop: 24 }}>
      <button
        onClick={() => setExpanded(!expanded)}
        style={{ fontSize: 13, color: 'var(--text-light)', display: 'flex', alignItems: 'center', gap: 6 }}
      >
        <i className="ti ti-history" style={{ fontSize: 16 }} />
        {expanded ? 'Hide weight history' : 'Weight history'} ({logs.length} entries)
      </button>
      {expanded && (
        <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', marginTop: 10, background: 'var(--card)' }}>
          {logs.map((log, i) => {
            const s = Math.floor(log.weightLbs / 14);
            const p = Math.round((log.weightLbs % 14) * 10) / 10;
            return (
              <div key={log.id} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '8px 14px', borderBottom: i < logs.length - 1 ? '1px solid var(--border)' : 'none',
                fontSize: 13,
              }}>
                <span style={{ color: 'var(--text-light)' }}>
                  {new Date(log.date + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
                <span style={{ fontWeight: 600 }}>{s}st {p}lb</span>
                <button
                  onClick={() => handleDelete(log.id)}
                  style={{ color: 'var(--coral)', fontSize: 14, padding: '2px 6px' }}
                >
                  <i className="ti ti-trash" style={{ fontSize: 14 }} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CalorieReveal({ budget }: { budget: number }) {
  const [revealed, setRevealed] = useState(false);

  return (
    <div
      onClick={() => setRevealed(!revealed)}
      style={{
        border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 14,
        textAlign: 'center', cursor: 'pointer', userSelect: 'none',
        background: 'var(--card)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <div style={{ fontSize: 11, color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>
          Daily calorie budget
        </div>
        <i className={`ti ${revealed ? 'ti-eye' : 'ti-eye-off'}`} style={{ fontSize: 16, color: 'var(--text-light)', opacity: 0.5 }} />
      </div>
      {revealed ? (
        <div style={{ fontSize: 22, fontWeight: 600 }}>
          {budget} <small style={{ fontWeight: 400, fontSize: 13, color: 'var(--text-light)' }}>kcal</small>
        </div>
      ) : (
        <div style={{ fontSize: 13, color: 'var(--text-light)' }}>
          Tap to reveal
        </div>
      )}
    </div>
  );
}

function StoneInput({ stone, pounds, onStoneChange, onPoundsChange }: {
  stone: number; pounds: number; onStoneChange: (v: number) => void; onPoundsChange: (v: number) => void;
}) {
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      <NumInput value={stone} onChange={onStoneChange} style={{ width: 60, textAlign: 'center' }} min={0} />
      <span style={unitStyle}>st</span>
      <NumInput value={pounds} onChange={onPoundsChange} style={{ width: 60, textAlign: 'center' }} min={0} max={13.9} step={0.5} />
      <span style={unitStyle}>lb</span>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 12, color: 'var(--text-light)', marginBottom: 4 }}>{children}</div>;
}

const unitStyle: React.CSSProperties = { fontSize: 12, color: 'var(--text-light)' };

function NumInput({ value, onChange, style, ...rest }: {
  value: number; onChange: (v: number) => void; style?: React.CSSProperties;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'style' | 'type'>) {
  const [display, setDisplay] = useState(String(value));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setDisplay(String(value));
  }, [value, focused]);

  return (
    <input
      type="number"
      value={display}
      onChange={(e) => {
        setDisplay(e.target.value);
        onChange(e.target.value === '' ? 0 : Number(e.target.value));
      }}
      onFocus={(e) => { setFocused(true); e.target.select(); }}
      onBlur={() => { setFocused(false); setDisplay(String(value)); }}
      style={style}
      {...rest}
    />
  );
}
