import { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { api, formatCurrency, getImageUrl } from '../../utils/api';
import PlayerAvatar from '../../components/PlayerAvatar';
import { Users, Shield, Upload, Image as ImageIcon, CheckCircle, Edit, Trash2, DollarSign } from 'lucide-react';


const emptyTeam = { name: '', captainName: '', captainEmail: '', captainPassword: '', budget: '' };

export default function AdminTeams() {
  const { id: auctionId } = useParams();
  const [teams, setTeams] = useState([]);
  const [players, setPlayers] = useState([]);
  const [auction, setAuction] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editTeam, setEditTeam] = useState(null);
  const [form, setForm] = useState(emptyTeam);
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const [saving, setSaving] = useState(false);
  const [users, setUsers] = useState([]);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [topupTeam, setTopupTeam] = useState(null);
  const [topupAmount, setTopupAmount] = useState('');
  const logoInputRef = useRef();

  const load = async () => {
    try {
      let currentAuctionId = auctionId;
      if (!currentAuctionId || currentAuctionId === 'undefined') {
        const aRes = await api.get('/auctions');
        const defaultAuc = aRes.data?.[0];
        if (defaultAuc) currentAuctionId = defaultAuc.id;
      }

      if (!currentAuctionId) {
        setLoading(false);
        return;
      }

      try {
        const [aRes, tRes, uRes, pRes] = await Promise.all([
          api.get(`/auctions/${currentAuctionId}`),
          api.get(`/auctions/${currentAuctionId}/teams`),
          api.get('/users'),
          api.get(`/auctions/${currentAuctionId}/players`)
        ]);
        setAuction(aRes.data);
        setTeams(tRes.data || []);
        setUsers(uRes.data || []);
        setPlayers(pRes.data || []);
      } catch (innerErr) {
        // Stale auctionId in URL, fallback to first available auction
        const allAuctionsRes = await api.get('/auctions');
        const firstAuc = allAuctionsRes.data?.[0];
        if (firstAuc) {
          const [aRes, tRes, uRes, pRes] = await Promise.all([
            api.get(`/auctions/${firstAuc.id}`),
            api.get(`/auctions/${firstAuc.id}/teams`),
            api.get('/users'),
            api.get(`/auctions/${firstAuc.id}/players`)
          ]);
          setAuction(aRes.data);
          setTeams(tRes.data || []);
          setUsers(uRes.data || []);
          setPlayers(pRes.data || []);
        }
      }
    } catch (err) {
      console.error('Failed to load teams data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [auctionId]);

  const openAdd = () => {
    setEditTeam(null);
    setForm({ ...emptyTeam, budget: auction?.startingBudget || 100000 });
    setLogoFile(null);
    setLogoPreview(null);
    setShowModal(true);
  };

  const openEdit = (t) => {
    setEditTeam(t);
    const captain = users.find(u => u.id === t.captainId);
    setForm({
      name: t.name,
      captainName: captain?.name || '',
      captainEmail: captain?.email || '',
      captainPassword: '',
      budget: t.initialBudget
    });
    setLogoPreview(t.logoUrl ? getImageUrl(t.logoUrl) : null);
    setLogoFile(null);
    setShowModal(true);
  };

  const handleLogoChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const MAX_SIZE = 800 * 1024;
    if (file.size > MAX_SIZE) {
      alert(`⚠️ Logo size is ${(file.size / 1024).toFixed(0)} KB, which exceeds the 800 KB limit! Please select an image under 800 KB.`);
      if (logoInputRef.current) logoInputRef.current.value = '';
      return;
    }

    setLogoFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setLogoPreview(ev.target.result);
    reader.readAsDataURL(file);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('name', form.name);
      fd.append('budget', Number(form.budget));
      if (form.captainName) fd.append('captainName', form.captainName);
      if (form.captainEmail) fd.append('captainEmail', form.captainEmail);
      if (form.captainPassword) fd.append('captainPassword', form.captainPassword);
      if (logoFile) fd.append('logo', logoFile);

      let targetAuctionId = auctionId && auctionId !== 'undefined' ? auctionId : auction?.id;
      if (!targetAuctionId) {
        const aRes = await api.get('/auctions');
        targetAuctionId = aRes.data?.[0]?.id;
      }

      if (!targetAuctionId) {
        alert('No auction available to save team to. Please create an auction first.');
        setSaving(false);
        return;
      }

      if (editTeam) {
        await api.patch(`/teams/${editTeam.id}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      } else {
        await api.post(`/auctions/${targetAuctionId}/teams`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      }
      setShowModal(false);
      load();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to save team');
    } finally {
      setSaving(false);
    }
  };


  const handleDelete = async (t) => {
    if (!confirm(`Delete team "${t.name}"? This cannot be undone.`)) return;
    await api.delete(`/teams/${t.id}`);
    load();
  };

  const getCaptain = (t) => users.find(u => u.id === t.captainId);

  // Strict Player Isolation: get players genuinely sold to this team only
  const getTeamSquad = (teamId) => {
    return players.filter(p => p.soldTo === teamId && p.status === 'SOLD');
  };

  return (
    <div className="page-content">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 className="page-title" style={{ marginBottom: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
            <Users size={26} color="var(--orange)" /> Auction Teams
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 4 }}>
            {auction?.name || 'All Teams'} · Add team logos, manage budgets, and assign captains
          </p>
        </div>
        <button className="btn btn-primary" onClick={openAdd} style={{ gap: 6, fontWeight: 700 }}>
          + Add New Team
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60 }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
      ) : (
        <div className="grid grid-auto gap-4">
          {teams.length === 0 ? (
            <div className="empty-state" style={{ gridColumn: '1/-1' }}>
              <div className="empty-state-icon">👥</div>
              <h3>No teams added yet</h3>
              <p>Add teams with logos and assign captains to prepare the live auction</p>
              <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={openAdd}>Add First Team</button>
            </div>
          ) : teams.map(t => {
            const captain = getCaptain(t);
            const squad = getTeamSquad(t.id);
            const spent = t.initialBudget - t.remainingBudget;
            const budgetPct = Math.round((t.remainingBudget / t.initialBudget) * 100);

            return (
              <div key={t.id} className="card" style={{ cursor: 'pointer', position: 'relative' }} onClick={() => setSelectedTeam(selectedTeam?.id === t.id ? null : t)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12, gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    {t.logoUrl ? (
                      <img
                        src={getImageUrl(t.logoUrl)}
                        alt={t.name}
                        style={{ width: 48, height: 48, borderRadius: 12, objectFit: 'contain', background: '#FFFFFF', padding: 4, border: '1px solid var(--border)' }}
                      />
                    ) : (
                      <div style={{ width: 48, height: 48, borderRadius: 12, background: 'var(--navy)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--orange)', fontWeight: 800, fontSize: 18 }}>
                        {t.name?.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <h3 style={{ fontSize: 17, fontWeight: 800, marginBottom: 2 }}>{t.name}</h3>
                      {captain && (
                        <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                          Captain: <strong style={{ color: 'var(--text)' }}>{captain.name}</strong> ({captain.email})
                        </p>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="btn btn-navy btn-sm" title="Top up funds" onClick={e => { e.stopPropagation(); setTopupTeam(t); setTopupAmount(''); }}>
                      <DollarSign size={13} /> Top Up
                    </button>
                    <button className="btn btn-outline btn-sm" title="Edit team and logo" onClick={e => { e.stopPropagation(); openEdit(t); }}>
                      <Edit size={13} />
                    </button>
                    <button className="btn btn-danger btn-sm" title="Delete team" onClick={e => { e.stopPropagation(); handleDelete(t); }}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                <div className="grid grid-2 gap-3" style={{ marginBottom: 12 }}>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>Remaining Budget</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: budgetPct > 50 ? 'var(--green)' : budgetPct > 20 ? 'var(--amber)' : 'var(--red)' }}>
                      {formatCurrency(t.remainingBudget)}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>Acquired Players</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--navy)' }}>
                      {squad.length} <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>/ {auction?.maxSquadSize || 11}</span>
                    </div>
                  </div>
                </div>

                <div className="budget-bar-track" style={{ height: 6 }}>
                  <div
                    className={`budget-bar-fill ${budgetPct < 20 ? 'low' : budgetPct < 50 ? 'medium' : ''}`}
                    style={{ width: `${budgetPct}%` }}
                  />
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, display: 'flex', justifyContent: 'space-between' }}>
                  <span>Spent: {formatCurrency(spent)}</span>
                  <span>{budgetPct}% budget remaining</span>
                </div>

                {/* Squad list expandable */}
                {selectedTeam?.id === t.id && (
                  <div style={{ marginTop: 16, borderTop: '1px solid var(--border)', paddingTop: 14 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 10, display: 'flex', justifyContent: 'space-between' }}>
                      <span>Acquired Squad ({squad.length})</span>
                      <span style={{ color: 'var(--green)' }}>✓ Verified Isolated</span>
                    </div>

                    {squad.length === 0 ? (
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: '10px 0' }}>
                        No players acquired yet in auction.
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {squad.map(p => (
                          <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13, padding: '6px 8px', background: 'var(--bg)', borderRadius: 6 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <PlayerAvatar
                                player={p}
                                size={24}
                                borderRadius={4}
                              />
                              <span style={{ fontWeight: 600 }}>{p.name}</span>
                              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>({p.category})</span>
                            </div>
                            <span style={{ fontWeight: 700, color: 'var(--orange)' }}>
                              {formatCurrency(p.soldPrice ?? p.price ?? p.currentBid ?? p.basePrice)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Captain login info */}
      {teams.length > 0 && (
        <div className="card" style={{ marginTop: 24 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Captain Login Credentials</h3>
          <table className="data-table">
            <thead>
              <tr>
                <th>Team</th>
                <th>Captain</th>
                <th>Email</th>
                <th>Login URL</th>
              </tr>
            </thead>
            <tbody>
              {teams.map(t => {
                const c = getCaptain(t);
                return (
                  <tr key={t.id}>
                    <td style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                      {t.logoUrl && <img src={getImageUrl(t.logoUrl)} alt="" style={{ width: 22, height: 22, borderRadius: 4, objectFit: 'contain' }} />}
                      {t.name}
                    </td>
                    <td>{c?.name || '—'}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: 13 }}>{c?.email || '—'}</td>
                    <td><a href="/login" style={{ color: 'var(--navy)', fontWeight: 600, fontSize: 13 }}>/login</a></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Add/Edit Team Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal" style={{ maxWidth: 540 }}>
            <div className="modal-header">
              <h3 className="modal-title">{editTeam ? 'Edit Team Details & Logo' : 'Add New Auction Team'}</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
            </div>
            <form onSubmit={handleSave}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

                {/* Team Logo & Name */}
                <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                  <div style={{ flexShrink: 0, textAlign: 'center' }}>
                    <div
                      style={{
                        width: 80, height: 80, borderRadius: 12, overflow: 'hidden',
                        background: '#FFFFFF', border: '2px dashed var(--border)',
                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
                      }}
                      onClick={() => logoInputRef.current.click()}
                      title="Click to upload team logo"
                    >
                      {logoPreview ? (
                        <img src={logoPreview} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 4 }} />
                      ) : (
                        <div style={{ textAlign: 'center', padding: 4 }}>
                          <ImageIcon size={24} color="var(--text-muted)" style={{ margin: '0 auto 2px' }} />
                          <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600 }}>Team Logo</div>
                        </div>
                      )}
                    </div>
                    <input ref={logoInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleLogoChange} />
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4, fontWeight: 600 }}>Max 800 KB</div>
                  </div>

                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div className="form-group">
                      <label className="form-label">Team Name *</label>
                      <input className="form-input" required value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. SPECTRA Warriors" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Fixed Auction Budget (QC) *</label>
                      <input className="form-input" type="number" min="0" required value={form.budget} onChange={e => setForm(p => ({ ...p, budget: e.target.value }))} />
                    </div>
                  </div>
                </div>

                {/* Captain Account */}
                <div style={{ padding: '14px', background: 'var(--bg)', borderRadius: 10, border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 12 }}>Captain Account Details</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div className="form-group">
                      <label className="form-label">Captain Name</label>
                      <input className="form-input" value={form.captainName} onChange={e => setForm(p => ({ ...p, captainName: e.target.value }))} placeholder="Captain's full name" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Captain Email</label>
                      <input className="form-input" type="email" value={form.captainEmail} onChange={e => setForm(p => ({ ...p, captainEmail: e.target.value }))} placeholder="captain@team.com" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Password</label>
                      <input className="form-input" type="password" value={form.captainPassword} onChange={e => setForm(p => ({ ...p, captainPassword: e.target.value }))} placeholder={editTeam ? 'Leave blank to keep current' : 'Set password'} />
                    </div>
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving} style={{ fontWeight: 700 }}>
                  {saving ? 'Saving...' : editTeam ? 'Update Team' : 'Add Team'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Top Up Modal */}
      {topupTeam && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setTopupTeam(null)}>
          <div className="modal" style={{ maxWidth: 400 }}>
            <div className="modal-header">
              <h3 className="modal-title">💰 Top Up Budget — {topupTeam.name}</h3>
              <button className="modal-close" onClick={() => setTopupTeam(null)}>×</button>
            </div>
            <form onSubmit={async (e) => {
              e.preventDefault();
              if (!topupAmount || Number(topupAmount) <= 0) return;
              await api.post(`/teams/${topupTeam.id}/topup`, { amount: Number(topupAmount) });
              setTopupTeam(null);
              load();
            }}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                  Current Remaining Budget: <strong>{formatCurrency(topupTeam.remainingBudget)}</strong>
                </div>
                <div className="form-group">
                  <label className="form-label">Top Up Amount (QC) *</label>
                  <input
                    className="form-input"
                    type="number"
                    min="1"
                    required
                    value={topupAmount}
                    onChange={e => setTopupAmount(e.target.value)}
                    placeholder="Enter QC amount to add"
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setTopupTeam(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Add Funds (QC)</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
