import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';

export default function CaptainLayout() {
  const { user, logout } = useAuth();
  const { connected } = useSocket();
  const navigate = useNavigate();

  return (
    <div className="captain-layout">
      {/* Connection Banner */}
      {!connected && (
        <div className="conn-banner disconnected">
          ⚠ CONNECTION LOST — Bidding disabled until reconnected
        </div>
      )}

      {/* Header */}
      <div className="captain-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <svg width="24" height="24" viewBox="0 0 32 32" fill="none">
            <polygon points="16,2 28,8 28,20 16,30 4,20 4,8" fill="none" stroke="#C41230" strokeWidth="1.5"/>
            <path d="M12 12 L16 8 L20 12 L16 22 Z" fill="#C41230"/>
          </svg>
          <h1>VALOR CUP</h1>
          <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 10, color: 'var(--crimson-bright)', letterSpacing: 3, fontWeight: 600, marginTop: 2 }}>2026</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div className="live-indicator">
            <div className="live-dot" style={{ background: connected ? 'var(--crimson-bright)' : 'var(--red)', animation: connected ? 'vcPulse 1.4s infinite' : 'none' }} />
            {connected ? 'LIVE' : 'OFFLINE'}
          </div>
          <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.5)', letterSpacing: 1 }}>{user?.name}</span>
          <button
            className="btn btn-outline-white btn-sm"
            onClick={() => { logout(); navigate('/login'); }}>
            LOGOUT
          </button>
        </div>
      </div>

      {/* Nav tabs */}
      <div style={{ background: 'var(--surface-2)', display: 'flex', borderBottom: '1px solid rgba(196,18,48,0.25)' }}>
        <NavLink to="/captain" end className={({ isActive }) =>
          `tab ${isActive ? 'active' : ''}`}>
          🎯 Live Auction
        </NavLink>
        <NavLink to="/captain/team" className={({ isActive }) =>
          `tab ${isActive ? 'active' : ''}`}>
          👥 My Team
        </NavLink>
      </div>

      <Outlet />
    </div>
  );
}
