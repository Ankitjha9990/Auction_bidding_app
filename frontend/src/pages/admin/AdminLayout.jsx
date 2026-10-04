import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { useState } from 'react';
import { LayoutDashboard, Trophy, PlusCircle, LogOut, Menu, Radio, Shield, Users } from 'lucide-react';

const navSections = [
  {
    label: 'Overview',
    items: [
      { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, exact: true },
    ]
  },
  {
    label: 'Tournament & Players',
    items: [
      { to: '/admin/auctions', label: 'All Auctions', icon: Trophy },
      { to: '/admin/auctions/create', label: 'Create Auction', icon: PlusCircle },
      { to: '/admin/players', label: 'Players Directory', icon: Users },
    ]
  }
];

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const { connected } = useSocket();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', width: '100%' }}>
      {/* Sidebar */}
      <nav className={`sidebar ${mobileOpen ? 'open' : ''}`} style={{
        transform: mobileOpen ? 'translateX(0)' : 'translateX(-100%)',
        transition: 'transform 0.3s ease',
        zIndex: 1000
      }}>
        <div className="sidebar-logo">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <svg width="24" height="24" viewBox="0 0 32 32" fill="none">
              <polygon points="16,2 28,8 28,20 16,30 4,20 4,8" fill="none" stroke="#C41230" strokeWidth="1.5"/>
              <path d="M12 12 L16 8 L20 12 L16 22 Z" fill="#C41230"/>
            </svg>
            <h1>VALOR CUP</h1>
          </div>
          <p>AUCTION 2026 — ADMIN</p>
        </div>

        <div className="sidebar-nav">
          {navSections.map(section => (
            <div key={section.label}>
              <div className="nav-section-label">{section.label}</div>
              {section.items.map(item => {
                const IconComponent = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.exact}
                    className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                    onClick={() => setMobileOpen(false)}
                  >
                    <IconComponent size={18} />
                    <span>{item.label}</span>
                  </NavLink>
                );
              })}
            </div>
          ))}
        </div>

        {/* Connection status */}
        <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(196,18,48,0.15)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, letterSpacing: 1.5, textTransform: 'uppercase', fontWeight: 700, color: connected ? 'var(--green)' : 'var(--red)' }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: connected ? 'var(--green)' : 'var(--red)', animation: connected ? 'vcPulse 1.4s infinite' : 'none', boxShadow: connected ? '0 0 6px rgba(22,196,127,0.6)' : 'none' }} />
            {connected ? 'SOCKET CONNECTED' : 'DISCONNECTED'}
          </div>
        </div>

        {/* User info */}
        <div style={{ padding: '14px 16px', borderTop: '1px solid rgba(196,18,48,0.15)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <div className="avatar" style={{ background: 'rgba(196,18,48,0.15)', color: 'var(--crimson-bright)', fontWeight: 800 }}>
              {user?.name?.[0] || 'A'}
            </div>
            <div>
              <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, fontWeight: 800, color: 'rgba(255,255,255,0.9)', letterSpacing: 1, textTransform: 'uppercase' }}>{user?.name}</div>
              <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 10, color: 'var(--crimson-bright)', textTransform: 'uppercase', letterSpacing: 1.5, fontWeight: 700 }}>ADMINISTRATOR</div>
            </div>
          </div>
          <button onClick={handleLogout} className="btn btn-outline-white btn-sm w-full" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <LogOut size={13} /> LOGOUT
          </button>
        </div>
      </nav>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 999 }}
          onClick={() => setMobileOpen(false)} />
      )}

      {/* Main content */}
      <div className="main-content" style={{ flex: 1, width: '100%', marginLeft: 0 }}>
        {/* Top bar */}
        <div className="topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, display: 'block' }}
              onClick={() => setMobileOpen(true)}>
              <Menu size={22} />
            </button>
            <div className="topbar-title">VALOR CUP — AUCTION CONTROL</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-secondary)', fontWeight: 600 }}>
              <span>{user?.name}</span>
            </div>
            <button className="btn btn-outline btn-sm" onClick={handleLogout} style={{ gap: 6 }}>
              <LogOut size={14} /> Logout
            </button>
          </div>
        </div>

        <div style={{ flex: 1, width: '100%', display: 'flex', flexDirection: 'column' }}>
          <Outlet />
        </div>
      </div>
    </div>
  );
}
