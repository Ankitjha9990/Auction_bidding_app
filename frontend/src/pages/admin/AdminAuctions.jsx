import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSocket } from '../../context/SocketContext';
import { api, formatCurrency, formatDateTimeIST } from '../../utils/api';
import { Trophy, Plus, Settings, Users, User, BarChart3, Clock, Trash2, Edit2, Calendar, X, Check } from 'lucide-react';

export default function AdminAuctions() {
  const [auctions, setAuctions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingAuction, setEditingAuction] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState('');
  const { socket } = useSocket();

  const load = () => api.get('/auctions').then(r => { setAuctions(r.data || []); setLoading(false); });

  useEffect(() => {
    load();
    if (!socket) return;
    const handleUpdate = () => load();
    socket.on('AUCTION_CREATED', handleUpdate);
    socket.on('AUCTION_UPDATED', handleUpdate);
    socket.on('AUCTION_DELETED', handleUpdate);
    socket.on('AUCTIONS_UPDATED', handleUpdate);
    socket.on('AUCTION_STARTED', handleUpdate);
    return () => {
      socket.off('AUCTION_CREATED', handleUpdate);
      socket.off('AUCTION_UPDATED', handleUpdate);
      socket.off('AUCTION_DELETED', handleUpdate);
      socket.off('AUCTIONS_UPDATED', handleUpdate);
      socket.off('AUCTION_STARTED', handleUpdate);
    };
  }, [socket]);

  const handleDeleteAuction = async (a) => {
    if (!confirm(`Are you sure you want to delete auction "${a.name}"? This will permanently remove its teams, bids, and state.`)) return;
    try {
      await api.delete(`/auctions/${a.id}`);
      setAuctions(prev => prev.filter(item => item.id !== a.id));
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete auction');
    }
  };

  const openEditModal = (a) => {
    setEditingAuction(a);
    let schedIso = '';
    if (a.scheduledAt || a.auctionDate) {
      try {
        const d = new Date(a.scheduledAt || a.auctionDate);
        if (!isNaN(d.getTime())) {
          // Format as YYYY-MM-DDTHH:mm for datetime-local input in local time
          const pad = (n) => String(n).padStart(2, '0');
          schedIso = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
        }
      } catch {}
    }

    setEditForm({
      name: a.name || '',
      tournamentName: a.tournamentName || '',
      seriesName: a.seriesName || '',
      organizerName: a.organizerName || '',
      scheduledDateTime: schedIso,
      startingBudget: a.startingBudget || 100000,
      playerTimer: a.playerTimer || 120,
      numTeams: a.numTeams || 8,
      status: a.status || 'DRAFT'
    });
    setEditError('');
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editingAuction) return;
    setEditSaving(true);
    setEditError('');

    try {
      let scheduledAtIso = null;
      if (editForm.scheduledDateTime) {
        scheduledAtIso = new Date(editForm.scheduledDateTime).toISOString();
      }

      const res = await api.patch(`/auctions/${editingAuction.id}`, {
        name: editForm.name,
        tournamentName: editForm.tournamentName,
        seriesName: editForm.seriesName,
        organizerName: editForm.organizerName,
        scheduledAt: scheduledAtIso,
        startingBudget: Number(editForm.startingBudget),
        playerTimer: Number(editForm.playerTimer),
        numTeams: Number(editForm.numTeams),
        status: editForm.status
      });

      setAuctions(prev => prev.map(a => a.id === editingAuction.id ? res.data : a));
      setEditingAuction(null);
    } catch (err) {
      setEditError(err.response?.data?.error || 'Failed to update auction');
    } finally {
      setEditSaving(false);
    }
  };

  return (
    <div className="page-content" style={{ width: '100%', maxWidth: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 className="page-title" style={{ marginBottom: 4 }}>Tournaments & Auctions</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Create, schedule, manage and control your live esports auctions</p>
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
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span className={`badge badge-${a.status.toLowerCase()}`}>{a.status}</span>
                  <button
                    className="btn btn-outline btn-sm"
                    onClick={() => openEditModal(a)}
                    title="Edit / Reschedule Auction"
                    style={{ padding: '4px 6px', color: 'var(--navy)' }}
                  >
                    <Edit2 size={13} />
                  </button>
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
                <div>
                  <span style={{ color: 'var(--text-muted)', fontSize: 11, display: 'block', textTransform: 'uppercase', fontWeight: 600 }}>Schedule (IST)</span>
                  <strong style={{ fontSize: 13, color: 'var(--navy)' }}>
                    {a.scheduledAt ? formatDateTimeIST(a.scheduledAt) : (a.auctionDate ? new Date(a.auctionDate).toLocaleDateString('en-IN') : '—')}
                  </strong>
                </div>
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

      {/* Edit / Reschedule Modal */}
      {editingAuction && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: '#FFFFFF', borderRadius: 12, padding: 28, maxWidth: 540, width: '100%', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, borderBottom: '1px solid #E2E8F0', paddingBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Calendar size={20} color="var(--orange)" />
                <h3 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>Edit & Reschedule Tournament</h3>
              </div>
              <button onClick={() => setEditingAuction(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                <X size={20} />
              </button>
            </div>

            {editError && (
              <div style={{ background: '#FEE2E2', color: '#991B1B', padding: '10px 14px', borderRadius: 6, marginBottom: 16, fontSize: 13 }}>
                {editError}
              </div>
            )}

            <form onSubmit={handleEditSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="form-group">
                <label className="form-label">Auction Name *</label>
                <input
                  type="text"
                  className="form-input"
                  required
                  value={editForm.name}
                  onChange={e => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>

              <div className="grid grid-2 gap-3">
                <div className="form-group">
                  <label className="form-label">Tournament Name</label>
                  <input
                    type="text"
                    className="form-input"
                    value={editForm.tournamentName}
                    onChange={e => setEditForm(prev => ({ ...prev, tournamentName: e.target.value }))}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Series Name</label>
                  <input
                    type="text"
                    className="form-input"
                    value={editForm.seriesName}
                    onChange={e => setEditForm(prev => ({ ...prev, seriesName: e.target.value }))}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Scheduled Date & Time (IST)</label>
                <input
                  type="datetime-local"
                  className="form-input"
                  value={editForm.scheduledDateTime}
                  onChange={e => setEditForm(prev => ({ ...prev, scheduledDateTime: e.target.value }))}
                />
                <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, display: 'block' }}>
                  Authoritative tournament start time. Automatically changes status to SCHEDULED.
                </span>
              </div>

              <div className="grid grid-3 gap-3">
                <div className="form-group">
                  <label className="form-label">Budget (QC)</label>
                  <input
                    type="number"
                    className="form-input"
                    min="1000"
                    step="1000"
                    value={editForm.startingBudget}
                    onChange={e => setEditForm(prev => ({ ...prev, startingBudget: Number(e.target.value) }))}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Player Timer (s)</label>
                  <input
                    type="number"
                    className="form-input"
                    min="10"
                    step="5"
                    value={editForm.playerTimer}
                    onChange={e => setEditForm(prev => ({ ...prev, playerTimer: Number(e.target.value) }))}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Status</label>
                  <select
                    className="form-input"
                    value={editForm.status}
                    onChange={e => setEditForm(prev => ({ ...prev, status: e.target.value }))}
                  >
                    <option value="DRAFT">DRAFT</option>
                    <option value="SCHEDULED">SCHEDULED</option>
                    <option value="READY">READY</option>
                    <option value="LIVE">LIVE</option>
                    <option value="COMPLETED">COMPLETED</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 14 }}>
                <button type="button" onClick={() => setEditingAuction(null)} className="btn btn-outline btn-sm">
                  Cancel
                </button>
                <button type="submit" disabled={editSaving} className="btn btn-primary btn-sm" style={{ gap: 6 }}>
                  <Check size={14} /> {editSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
