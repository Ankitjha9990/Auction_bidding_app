import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Trophy, Users, Zap, Eye, EyeOff, ShieldCheck, Lock, Mail, ArrowRight, AlertCircle } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const user = await login(email.trim(), password.trim());
      if (user.role === 'admin') navigate('/admin');
      else if (user.role === 'captain') navigate('/captain');
      else navigate('/viewer');
    } catch (err) {
      if (err.response?.data?.error) {
        setError(err.response.data.error);
      } else if (err.message === 'Network Error' || !err.response) {
        setError('Cannot connect to backend server (http://localhost:3001). Please check if backend is running.');
      } else {
        setError(err.message || 'Invalid email or password.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      {/* Left side */}
      <div className="login-left">
        <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', maxWidth: 480 }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, background: 'linear-gradient(135deg, #F6A51A, #E8970F)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', color: '#0B2342', boxShadow: '0 8px 24px rgba(246,165,26,0.35)' }}>
            <Trophy size={32} />
          </div>
          <div style={{ fontSize: 13, fontWeight: 800, color: 'rgba(255,255,255,0.5)', letterSpacing: '3px', textTransform: 'uppercase', marginBottom: 12 }}>
            SPECTRA 2026
          </div>
          <h1 style={{ fontSize: 44, fontWeight: 900, color: '#fff', lineHeight: 1.1, marginBottom: 16 }}>
            VALOR CUP
          </h1>
          <p style={{ fontSize: 18, color: 'rgba(255,255,255,0.7)', fontWeight: 400, lineHeight: 1.5 }}>
            Esports Auction Platform with Real-Time Bidding and Quad Currency (QC) Engine.
          </p>
          <div style={{ marginTop: 40, display: 'flex', gap: 32, justifyContent: 'center' }}>
            {[
              { icon: Trophy, label: 'Auctions' },
              { icon: Users, label: 'Captains' },
              { icon: Zap, label: 'Live Bids' }
            ].map(({ icon: IconComponent, label }) => (
              <div key={label} style={{ textAlign: 'center' }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 8px', color: '#F6A51A' }}>
                  <IconComponent size={22} />
                </div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>{label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right side */}
      <div className="login-right">
        <div className="login-box">
          <div style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: 28, fontWeight: 800, color: 'var(--text)', marginBottom: 6 }}>Welcome back</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: 15 }}>Sign in to access your portal</p>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div className="form-group">
              <label className="form-label">Email address</label>
              <div style={{ position: 'relative' }}>
                <input
                  type="email"
                  className="form-input"
                  placeholder="admin@spectra.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoFocus
                  style={{ paddingLeft: 40 }}
                />
                <Mail size={18} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--text-muted)' }} />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="form-input"
                  placeholder="Enter password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  style={{ paddingLeft: 40, paddingRight: 40 }}
                />
                <Lock size={18} style={{ position: 'absolute', left: 12, top: 12, color: 'var(--text-muted)' }} />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute',
                    right: 12,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    cursor: 'pointer',
                    color: 'var(--text-muted)',
                    display: 'flex',
                    alignItems: 'center'
                  }}
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {error && (
              <div style={{ padding: '10px 14px', background: '#FEE2E2', border: '1px solid #FCA5A5', color: '#991B1B', borderRadius: 8, fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                <AlertCircle size={18} style={{ flexShrink: 0 }} />
                <span>{error}</span>
              </div>
            )}

            <button className="btn btn-primary btn-lg w-full" type="submit" disabled={loading} style={{ fontWeight: 700, borderRadius: 10 }}>
              {loading ? <><div className="spinner" style={{ width: 18, height: 18 }} /> Signing in...</> : <>Sign In <ArrowRight size={18} /></>}
            </button>
          </form>

          <div style={{ marginTop: 24, padding: '16px', background: 'var(--bg)', borderRadius: 12, border: '1px solid var(--border)' }}>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8, fontWeight: 500 }}>
              Spectator Access (No login required):
            </p>
            <Link to="/viewer" style={{ fontSize: 14, fontWeight: 700, color: 'var(--navy)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Eye size={16} /> Open Public Live Viewer →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
