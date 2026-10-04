import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../utils/api';
import { Trophy, Users, Zap, Bot, ClipboardList, Settings, ArrowRight } from 'lucide-react';

const defaultForm = {
  name: 'SPECTRA 2026 Auction',
  seriesName: 'Valor Cup Season 2',
  tournamentName: 'SPECTRA 2026',
  organizerName: '',
  auctionDate: '',
  scheduledDateTime: '',
  location: '',
  sponsor: '',
  startingBudget: 100000,
  maxSquadSize: 11,
  minSquadSize: 7,
  minimumBid: 1000,
  playerTimer: 120,
  numTeams: 8,
  maxPlayersPerTeam: 11,
  allowRebid: true,
  allowUnsoldReauction: true,
};

// Defined at module level so it never remounts and preserves input focus!
function FormField({ label, name, value, onChange, type = 'text', min, step, help }) {
  return (
    <div className="form-group">
      <label className="form-label">{label}</label>
      <input
        type={type}
        className="form-input"
        value={value ?? ''}
        min={min}
        step={step}
        onChange={e => onChange(name, type === 'number' ? Number(e.target.value) : e.target.value)}
      />
      {help && <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{help}</p>}
    </div>
  );
}

export default function AdminCreateAuction() {
  const [form, setForm] = useState(defaultForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleFieldChange = (name, value) => {
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      let scheduledAtIso = null;
      if (form.scheduledDateTime) {
        scheduledAtIso = new Date(form.scheduledDateTime).toISOString();
      } else if (form.auctionDate) {
        scheduledAtIso = new Date(form.auctionDate).toISOString();
      }

      const res = await api.post('/auctions', {
        ...form,
        scheduledAt: scheduledAtIso,
        startingBudget: Number(form.startingBudget),
        minimumBid: Number(form.minimumBid),
        playerTimer: Number(form.playerTimer),
        numTeams: Number(form.numTeams)
      });
      navigate(`/admin/auctions/${res.data.id}/teams`);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create auction. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-content" style={{ width: '100%', maxWidth: '100%' }}>
      <div style={{ marginBottom: 28 }}>
        <h2 className="page-title" style={{ marginBottom: 4, display: 'flex', alignItems: 'center', gap: 10 }}>
          <Trophy color="var(--orange)" size={28} /> Create New Auction
        </h2>
        <p style={{ color: 'var(--text-secondary)' }}>Configure your tournament auction settings</p>
      </div>

      {/* Auction type selector */}
      <div className="grid grid-3 gap-4" style={{ marginBottom: 28 }}>
        {[
          { icon: Users, title: 'Tournament Auction', desc: 'Teams bid on players live', active: true },
          { icon: Zap, title: 'IPL Draft Style', desc: 'Fast draft-style bidding', active: false },
          { icon: Bot, title: 'Auto Allocation', desc: 'Automatic squad assignment', active: false },
        ].map(type => {
          const IconComponent = type.icon;
          return (
            <div key={type.title} className="card" style={{
              border: `2px solid ${type.active ? 'var(--orange)' : 'var(--border)'}`,
              background: type.active ? 'var(--orange-light)' : 'white',
              cursor: type.active ? 'default' : 'not-allowed',
              opacity: type.active ? 1 : 0.5,
              textAlign: 'center',
              padding: 20
            }}>
              <div style={{ margin: '0 auto 8px', width: 44, height: 44, borderRadius: 12, background: type.active ? 'white' : 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: type.active ? 'var(--navy)' : 'var(--text-muted)' }}>
                <IconComponent size={24} />
              </div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{type.title}</div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>{type.desc}</div>
              {type.active && <div style={{ marginTop: 10 }}><span className="badge badge-live">Active</span></div>}
            </div>
          );
        })}
      </div>

      <form onSubmit={handleSubmit} style={{ width: '100%' }}>
        {/* Basic Info */}
        <div className="card" style={{ marginBottom: 20, width: '100%' }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
            <ClipboardList size={18} color="var(--navy)" /> Basic Information
          </h3>
          <div className="grid grid-2 gap-4">
            <FormField label="Auction Name *" name="name" value={form.name} onChange={handleFieldChange} />
            <FormField label="Series Name" name="seriesName" value={form.seriesName} onChange={handleFieldChange} />
            <FormField label="Tournament Name" name="tournamentName" value={form.tournamentName} onChange={handleFieldChange} />
            <FormField label="Organizer Name" name="organizerName" value={form.organizerName} onChange={handleFieldChange} />
            <FormField label="Scheduled Date & Time" name="scheduledDateTime" type="datetime-local" value={form.scheduledDateTime} onChange={handleFieldChange} help="Authoritative scheduled time (Asia/Kolkata IST)" />
            <FormField label="Location" name="location" value={form.location} onChange={handleFieldChange} />
            <FormField label="Sponsor" name="sponsor" value={form.sponsor} onChange={handleFieldChange} />
          </div>
        </div>

        {/* Auction Config */}
        <div className="card" style={{ marginBottom: 20, width: '100%' }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Settings size={18} color="var(--navy)" /> Auction Configuration
          </h3>
          <div className="grid grid-2 gap-4">
            <FormField
              label="Fixed Budget Per Team (QC)"
              name="startingBudget"
              type="number"
              min="10"
              step="10"
              value={form.startingBudget}
              onChange={handleFieldChange}
              help="Fixed budget allocated for each and every team"
            />
            <FormField
              label="Minimum Bid (QC)"
              name="minimumBid"
              type="number"
              min="1"
              step="1"
              value={form.minimumBid}
              onChange={handleFieldChange}
            />
            <FormField
              label="Player Timer (seconds)"
              name="playerTimer"
              type="number"
              min="5"
              step="5"
              value={form.playerTimer}
              onChange={handleFieldChange}
              help="Default time per player: 120 seconds (2 minutes)"
            />
            <FormField
              label="Number of Teams"
              name="numTeams"
              type="number"
              min="2"
              value={form.numTeams}
              onChange={handleFieldChange}
            />
            <FormField
              label="Max Squad Size"
              name="maxSquadSize"
              type="number"
              min="1"
              value={form.maxSquadSize}
              onChange={handleFieldChange}
              help="Maximum players per team"
            />
            <FormField
              label="Min Squad Size"
              name="minSquadSize"
              type="number"
              min="1"
              value={form.minSquadSize}
              onChange={handleFieldChange}
            />
          </div>

          <div style={{ marginTop: 20, display: 'flex', gap: 24 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14 }}>
              <input
                type="checkbox"
                checked={form.allowRebid}
                onChange={e => handleFieldChange('allowRebid', e.target.checked)}
              />
              <span style={{ fontWeight: 600 }}>Allow Re-bid</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14 }}>
              <input
                type="checkbox"
                checked={form.allowUnsoldReauction}
                onChange={e => handleFieldChange('allowUnsoldReauction', e.target.checked)}
              />
              <span style={{ fontWeight: 600 }}>Allow Unsold Re-auction</span>
            </label>
          </div>
        </div>

        {error && (
          <div style={{ padding: 14, background: '#FEE2E2', color: 'var(--red)', borderRadius: 8, marginBottom: 20, fontSize: 14 }}>
            ⚠ {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-outline" onClick={() => navigate('/admin/auctions')}>Cancel</button>
          <button className="btn btn-primary btn-lg" type="submit" disabled={loading} style={{ fontWeight: 700 }}>
            {loading ? 'Creating...' : <>Create Auction & Add Teams <ArrowRight size={18} /></>}
          </button>
        </div>
      </form>
    </div>
  );
}
