import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, formatCurrency, formatDateTimeIST } from '../../utils/api';
import { Trophy, Plus, Settings, Users, User, BarChart3, Clock, Trash2 } from 'lucide-react';

export default function AdminAuctions() {
  const [auctions, setAuctions] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = () => api.get('/auctions').then(r => { setAuctions(r.data); setLoading(false); });
  useEffect(() => { load(); }, []);

  const handleDeleteAuction = async (a) => {
    if (!confirm(`Are you sure you want to delete auction "${a.name}"? This will remove its teams and state.`)) return;
    try {
      await api.delete(`/auctions/${a.id}`);
      setAuctions(prev => prev.filter(item => item.id !== a.id));
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete auction');
    }
  };

  return (
    <div className="page-content" style={{ width: '100%', maxWidth: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 className="page-title" style={{ marginBottom: 4 }}>Tournaments & Auctions</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Create, manage and control your live esports auctions</p>
        </div>
        <Link to="/admin/auctions/create" className="btn btn-primary" style={{ gap: 6 }}>
          <Plus size={18} /> Create Auction
        </Link>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60 }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 20, width: '100%' }}>
          {auctions.length === 0 ? (
            <div className="empty-state" style={{ gridColumn: '1/-1' }}>
              <div style={{ margin: '0 auto 16px', width: 64, height: 64, borderRadius: '50%', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                <Trophy size={32} />
              </div>
              <h3>No auctions created</h3>
              <p>Create your first auction to begin assigning teams and players</p>
              <Link to="/admin/auctions/create" className="btn btn-primary" style={{ marginTop: 16 }}>
                <Plus size={16} /> Create Auction
              </Link>
            </div>
          ) : auctions.map(a => (
            <div key={a.id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h3 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)' }}>{a.name}</h3>
                  <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>{a.tournamentName || a.seriesName}</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className={`badge badge-${a.status.toLowerCase()}`}>{a.status}</span>
                  <button 
                    className="btn btn-outline btn-sm" 
                    onClick={() => handleDeleteAuction(a)}
                    title="Delete Auction"
                    style={{ padding: '4px 6px', color: 'var(--red)', borderColor: 'rgba(239,68,68,0.3)' }}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, padding: '12px', background: 'var(--bg)', borderRadius: 10, fontSize: 13 }}>
                <div><span style={{ color: 'var(--text-muted)', fontSize: 11, display: 'block', textTransform: 'uppercase', fontWeight: 600 }}>Schedule (IST)</span><strong style={{ fontSize: 13, color: 'var(--navy)' }}>{a.scheduledAt ? formatDateTimeIST(a.scheduledAt) : (a.auctionDate || '—')}</strong></div>
                <div><span style={{ color: 'var(--text-muted)', fontSize: 11, display: 'block', textTransform: 'uppercase', fontWeight: 600 }}>Budget Per Team</span><strong style={{ fontSize: 14, color: 'var(--navy)' }}>{formatCurrency(a.startingBudget)}</strong></div>
                <div><span style={{ color: 'var(--text-muted)', fontSize: 11, display: 'block', textTransform: 'uppercase', fontWeight: 600 }}>Bid raises</span><strong style={{ fontSize: 14 }}>+10 · +25 · +50 · +100 QC</strong></div>
                <div><span style={{ color: 'var(--text-muted)', fontSize: 11, display: 'block', textTransform: 'uppercase', fontWeight: 600 }}>Player Timer</span><strong style={{ fontSize: 14 }}>{a.playerTimer}s</strong></div>
              </div>

              <div className="divider" style={{ margin: '4px 0' }} />
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Link to={`/admin/auctions/${a.id}/live`} className="btn btn-navy btn-sm" style={{ gap: 4 }}>
                  <Settings size={14} /> Control
                </Link>
                <Link to={`/admin/auctions/${a.id}/players`} className="btn btn-outline btn-sm" style={{ gap: 4 }}>
                  <User size={14} /> Players
                </Link>
                <Link to={`/admin/auctions/${a.id}/teams`} className="btn btn-outline btn-sm" style={{ gap: 4 }}>
                  <Users size={14} /> Teams
                </Link>
                <Link to={`/admin/auctions/${a.id}/results`} className="btn btn-outline btn-sm" style={{ gap: 4 }}>
                  <BarChart3 size={14} /> Results
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
