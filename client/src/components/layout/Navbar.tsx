import { NavLink } from 'react-router-dom';

const links = [
  { to: '/', label: 'Dashboard', icon: 'ti-home' },
  { to: '/meals', label: 'Meals', icon: 'ti-bowl' },
  { to: '/planner', label: 'Planner', icon: 'ti-calendar' },
  { to: '/today', label: 'Today', icon: 'ti-sun' },
  { to: '/shopping', label: 'Shopping', icon: 'ti-shopping-cart' },
];

export default function Navbar() {
  return (
    <>
      {/* Desktop sidebar */}
      <nav className="app-sidebar">
        <div style={{
          fontWeight: 600, fontSize: 18, color: 'var(--sage)',
          padding: '0 8px', marginBottom: 24,
        }}>
          MealBudget
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {links.map(({ to, label, icon }) => (
            <NavLink key={to} to={to} style={sidebarLink} end={to === '/'}>
              {({ isActive }) => (
                <span style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px',
                  borderRadius: 10, fontWeight: isActive ? 700 : 500, fontSize: 14,
                  color: isActive ? 'var(--forest)' : 'var(--text-light)',
                  background: isActive ? 'var(--foam)' : 'transparent',
                  transition: 'all 0.15s',
                }}>
                  <i className={`ti ${icon}`} style={{ fontSize: 18 }} />
                  {label}
                </span>
              )}
            </NavLink>
          ))}
        </div>
      </nav>

      {/* Mobile bottom nav */}
      <nav className="app-mobile-nav" style={{
        display: 'none',
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: '#fff', borderTop: '1px solid var(--border)',
        padding: '6px 0', justifyContent: 'space-around', zIndex: 100,
      }}>
        {links.map(({ to, icon, label }) => (
          <NavLink key={to} to={to} end={to === '/'} style={{ textDecoration: 'none' }}>
            {({ isActive }) => (
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                color: isActive ? 'var(--forest)' : 'var(--text-light)',
                fontSize: 10, fontWeight: isActive ? 700 : 500,
              }}>
                <i className={`ti ${icon}`} style={{ fontSize: 20 }} />
                {label}
              </div>
            )}
          </NavLink>
        ))}
      </nav>
    </>
  );
}

const sidebarLink = (): React.CSSProperties => ({
  textDecoration: 'none',
});
