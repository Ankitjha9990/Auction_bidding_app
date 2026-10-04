import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, formatCurrency } from '../../utils/api';
import { Trophy, Radio, CheckCircle2, FileText, Plus, Settings, Users, ArrowRight, Trash2 } from 'lucide-react';

export default function AdminDashboard() {
  const [auctions, setAuctions] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    api.get('/auctions').then(res => setAuctions(res.data)).finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const handleDeleteAuction = async (auction) => {
    if (!confirm(`Are you sure you want to delete auction "${auction.name}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/auctions/${auction.id}`);
      setAuctions(prev => prev.filter(a => a.id !== auction.id));
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete auction');
    }
  };


  const liveAuction = auctions.find(a => a.status === 'LIVE');
  const totalAuctions = auctions.length;
  const liveCount = auctions.filter(a => a.status === 'LIVE').length;
  const completedCount = auctions.filter(a => a.status === 'COMPLETED').length;
  const draftCount = auctions.filter(a => a.status === 'DRAFT').length;

  return (
    <div className="page-content" style={{ width: '100%', maxWidth: '100%' }}>
      <div style={{ marginBottom: 28 }}>
        <h2 className="page-title" style={{ marginBottom: 4 }}>Auction Dashboard</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: 15 }}>
          Welcome back! Manage your auctions, teams, and players.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-4 gap-4" style={{ marginBottom: 28 }}>
        {[
          { label: 'Total Auctions', value: totalAuctions, icon: Trophy, color: 'var(--navy)', bg: 'rgba(18,49,91,0.08)' },
          { label: 'Live Now', value: liveCount, icon: Radio, color: '#EF4444', bg: '#FEE2E2' },
          { label: 'Completed', value: completedCount, icon: CheckCircle2, color: '#10B981', bg: '#D1FAE5' },
          { label: 'Draft', value: draftCount, icon: FileText, color: 'var(--text-secondary)', bg: '#F1F5F9' },
        ].map(stat => {
          const IconComponent = stat.icon;
          return (
            <div key={stat.label} className="stat-card" style={{ gap: 14 }}>
              <div style={{ width: 44, height: 44, borderRadius: 10, background: stat.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: stat.color }}>
                <IconComponent size={24} />
              </div>
              <div>
                <div className="stat-value" style={{ color: stat.color }}>{stat.value}</div>
                <div className="stat-label" style={{ marginTop: 4 }}>{stat.label}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Live auction banner */}
      {liveAuction && (
        <div style={{
          background: 'linear-gradient(135deg, var(--navy-dark), var(--navy))',
          borderRadius: 16,
          padding: '28px 32px',
          marginBottom: 28,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 20,
          border: '1px solid rgba(246,165,26,0.3)',
          boxShadow: '0 8px 30px rgba(11,35,66,0.2)'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <div className="live-indicator">
                <div className="live-dot" style={{ background: '#EF4444' }} />
                <span style={{ color: '#EF4444', fontWeight: 800 }}>LIVE AUCTION ACTIVE</span>
              </div>
            </div>
            <h3 style={{ fontSize: 24, fontWeight: 800, color: 'white', marginBottom: 4 }}>
              {liveAuction.name}
            </h3>
            <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14 }}>
              {liveAuction.seriesName || liveAuction.tournamentName} · Fixed Budget: {formatCurrency(liveAuction.startingBudget)}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <Link to={`/admin/auctions/${liveAuction.id}/live`} className="btn btn-primary btn-lg" style={{ borderRadius: 10 }}>
              Control Panel <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      )}

      {/* Auction list */}
      <div className="card" style={{ padding: 0, overflow: 'hidden', width: '100%' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Trophy size={18} color="var(--orange)" /> All Auctions
          </h3>
          <Link to="/admin/auctions/create" className="btn btn-primary btn-sm">
            <Plus size={16} /> Create Auction
          </Link>
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: 'center' }}>
            <div className="spinner" style={{ margin: '0 auto' }} />
          </div>
        ) : auctions.length === 0 ? (
          <div className="empty-state">
            <div style={{ margin: '0 auto 16px', width: 64, height: 64, borderRadius: '50%', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
              <Trophy size={32} />
            </div>
            <h3>No auctions yet</h3>
            <p>Create your first tournament auction to get started</p>
            <Link to="/admin/auctions/create" className="btn btn-primary" style={{ marginTop: 16 }}>
              <Plus size={16} /> Create Auction
            </Link>
          </div>
        ) : (
          <table className="data-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>Auction Name</th>
                <th>Status</th>
                <th>Budget (QC)</th>
                <th>Teams</th>
                <th>Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {auctions.map(auction => (
                <tr key={auction.id}>
                  <td>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{auction.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{auction.tournamentName}</div>
                  </td>
                  <td>
                    <span className={`badge badge-${auction.status.toLowerCase()}`}>
                      {auction.status}
                    </span>
                  </td>
                  <td style={{ fontWeight: 700, color: 'var(--navy)' }}>{formatCurrency(auction.startingBudget)}</td>
                  <td>{auction.numTeams || '—'}</td>
                  <td style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                    {auction.auctionDate ? new Date(auction.auctionDate).toLocaleDateString('en-IN') : '—'}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <Link to={`/admin/auctions/${auction.id}/live`} className="btn btn-navy btn-sm" style={{ gap: 4 }}>
                        <Settings size={14} /> {auction.status === 'LIVE' ? 'Control' : 'Manage'}
                      </Link>
                      <Link to={`/admin/auctions/${auction.id}/players`} className="btn btn-outline btn-sm">
                        Players
                      </Link>
                      <Link to={`/admin/auctions/${auction.id}/teams`} className="btn btn-outline btn-sm">
                        Teams
                      </Link>
                      <button 
                        className="btn btn-outline btn-sm" 
                        onClick={() => handleDeleteAuction(auction)}
                        title="Delete Auction"
                        style={{ padding: '4px 6px', color: 'var(--red)', borderColor: 'rgba(239,68,68,0.3)' }}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
