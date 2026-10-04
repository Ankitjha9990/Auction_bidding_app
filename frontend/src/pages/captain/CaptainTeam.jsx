import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api, formatCurrency, getImageUrl } from '../../utils/api';
import PlayerAvatar from '../../components/PlayerAvatar';
import TeamLogo from '../../components/TeamLogo';
import { Shield, Eye } from 'lucide-react';

export default function CaptainTeam() {
  const { user } = useAuth();
  const [allTeams, setAllTeams] = useState([]);
  const [selectedTeamId, setSelectedTeamId] = useState(null);
  const [myTeam, setMyTeam] = useState(null);
  const [players, setPlayers] = useState([]);
  const [auction, setAuction] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [aRes, uRes] = await Promise.all([api.get('/auctions'), api.get('/users')]);
        const auctions = aRes.data;
        const liveAuction = auctions.find(a => a.status === 'LIVE' || a.status === 'SCHEDULED' || a.status === 'READY') || auctions[0];
        if (!liveAuction) { setLoading(false); return; }

        setAuction(liveAuction);
        const [tRes, pRes] = await Promise.all([
          api.get(`/auctions/${liveAuction.id}/teams`),
          api.get(`/auctions/${liveAuction.id}/players`)
        ]);

        const teams = tRes.data || [];
        setAllTeams(teams);

        const assignedTeam = teams.find(t => t.captainId === user?.id) ||
          teams.find(t => {
            const captain = uRes.data.find(u => u.id === t.captainId);
            return captain?.email === user?.email;
          }) || teams[0];

        setMyTeam(assignedTeam);
        setSelectedTeamId(assignedTeam?.id || teams[0]?.id);
        setPlayers(pRes.data || []);
      } catch (err) {
        console.error('Failed to load captain teams data:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user]);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
        <div className="spinner" />
      </div>
    );
  }

  const currentTeam = allTeams.find(t => t.id === selectedTeamId) || myTeam;

  if (!currentTeam) {
    return (
      <div className="empty-state" style={{ padding: 60 }}>
        <div className="empty-state-icon">👥</div>
        <h3>No teams found</h3>
        <p>No teams are configured for this auction.</p>
      </div>
    );
  }

  const isMyTeam = myTeam && currentTeam.id === myTeam.id;

  // Authoritative players list
  const rawPlayers = Array.isArray(currentTeam.players) ? currentTeam.players : [];
  const currentSquad = rawPlayers.map((tp, idx) => {
    const master = players.find(p => (p.id || p.masterPlayerId) === (tp.playerId || tp.id)) || {};
    const price = Number(tp.soldPrice ?? tp.price ?? tp.finalPrice ?? master.soldPrice ?? master.price ?? 0);
    return {
      ...master,
      ...tp,
      id: tp.id || tp.playerId || master.id || `p-${idx}`,
      name: tp.name || master.full_name || master.name || 'Player',
      category: tp.category || master.category || 'Category A',
      registrationId: tp.registrationId || master.registration_id || master.registrationId || (tp.id ? String(tp.id).slice(-3) : ''),
      soldPrice: price,
      price: price
    };
  });

  const initialBudget = Number(currentTeam.initialBudget || 100000);
  const totalSpent = currentSquad.reduce((sum, p) => sum + (p.soldPrice || 0), 0);
  const remainingBudget = Math.max(0, initialBudget - totalSpent);
  const budgetPct = Math.round((remainingBudget / (initialBudget || 1)) * 100);
  const maxSquad = auction?.maxSquadSize || 11;
  const slotsLeft = Math.max(0, maxSquad - currentSquad.length);

  return (
    <div style={{ padding: 20, maxWidth: 900, margin: '0 auto' }}>
      {/* Team Navigation & Selection Tabs */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 13, letterSpacing: 1.5, color: 'var(--text-dim)', textTransform: 'uppercase' }}>
            INSPECT AUCTION TEAMS
          </div>
          <div style={{ fontSize: 11, fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--text-faint)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
            <Eye size={12} /> PUBLIC READ-ONLY SQUAD ACCESS
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 6 }}>
          {allTeams.map(t => {
            const isSelected = t.id === currentTeam.id;
            const isMine = myTeam && t.id === myTeam.id;
            return (
              <button
                key={t.id}
                onClick={() => setSelectedTeamId(t.id)}
                style={{
                  background: isSelected ? 'var(--navy)' : '#FFFFFF',
                  color: isSelected ? '#FFFFFF' : 'var(--text-dark)',
                  border: isSelected ? '1px solid var(--navy)' : '1px solid var(--border)',
                  borderRadius: 6,
                  padding: '6px 12px',
                  fontFamily: "'Barlow Condensed', sans-serif",
                  fontWeight: 800,
                  fontSize: 12,
                  letterSpacing: 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  boxShadow: isSelected ? '0 2px 6px rgba(0,0,0,0.15)' : 'none',
                  transition: 'all 0.15s ease'
                }}
              >
                <TeamLogo logoUrl={t.logoUrl} name={t.name} size={18} />
                <span>{t.name}</span>
                {isMine && (
                  <span style={{ background: 'var(--crimson)', color: '#FFFFFF', fontSize: 9, padding: '1px 5px', borderRadius: 3, fontWeight: 900 }}>
                    MY TEAM
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Team header card */}
      <div style={{ background: 'linear-gradient(135deg, var(--navy-dark), var(--navy))', borderRadius: 16, padding: '24px 28px', marginBottom: 20, color: 'white', borderTop: isMyTeam ? '4px solid var(--orange)' : '4px solid var(--crimson)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
          <TeamLogo
            logoUrl={currentTeam.logoUrl}
            name={currentTeam.name}
            size={64}
            style={{ borderRadius: 12, background: '#FFFFFF', padding: 4 }}
          />
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: 1 }}>
                {isMyTeam ? 'MY TEAM SQUAD' : 'TEAM SQUAD'}
              </span>
              {!isMyTeam && (
                <span style={{ background: 'rgba(255,255,255,0.15)', color: '#FFFFFF', fontSize: 10, padding: '2px 6px', borderRadius: 4, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Shield size={10} /> READ-ONLY
                </span>
              )}
            </div>
            <h2 style={{ fontSize: 28, fontWeight: 900, color: isMyTeam ? 'var(--orange)' : '#FFFFFF', margin: '4px 0 0' }}>{currentTeam.name}</h2>
            {currentTeam.captainName && (
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', margin: '2px 0 0' }}>
                Captain: <strong style={{ color: 'rgba(255,255,255,0.9)' }}>{currentTeam.captainName}</strong>
                {currentTeam.captainEmail ? ` (${currentTeam.captainEmail})` : ''}
              </p>
            )}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          {[
            { label: 'Remaining Budget', value: formatCurrency(remainingBudget), color: budgetPct < 20 ? '#EF4444' : 'white' },
            { label: 'Total Spent', value: formatCurrency(totalSpent), color: 'white' },
            { label: 'Players Bought', value: `${currentSquad.length} / ${maxSquad}`, color: 'white' },
            { label: 'Slots Remaining', value: slotsLeft, color: slotsLeft === 0 ? '#EF4444' : 'white' },
          ].map(s => (
            <div key={s.label}>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>{s.label}</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: s.color }}>{s.value}</div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 6 }}>
            <span>Budget used</span>
            <span>{100 - budgetPct}%</span>
          </div>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${100 - budgetPct}%`, background: isMyTeam ? 'var(--orange)' : 'var(--crimson)' }} />
          </div>
        </div>
      </div>

      {/* Players Section */}
      <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>Squad ({currentSquad.length}/{maxSquad})</span>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          {isMyTeam ? 'Your Roster' : `Viewing ${currentTeam.name}'s Roster`}
        </span>
      </div>

      {currentSquad.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">⚡</div>
          <h3>No players acquired yet</h3>
          <p>{isMyTeam ? 'Start bidding in the live auction to build your squad!' : 'This team has not acquired any players yet.'}</p>
        </div>
      ) : (
        <div className="grid grid-2 gap-4">
          {currentSquad.map((p, idx) => (
            <div key={p.id || idx} className="card" style={{ display: 'flex', gap: 14, padding: 16, alignItems: 'center' }}>
              <div style={{ width: 56, height: 70, borderRadius: 8, overflow: 'hidden', background: 'var(--navy)', flexShrink: 0 }}>
                <PlayerAvatar
                  player={p}
                  size={56}
                  borderRadius={8}
                  style={{ width: '100%', height: '100%' }}
                />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 800, fontSize: 15, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{p.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>
                  REG #{p.registrationId || (p.id ? String(p.id).slice(-3) : '')} · {p.category}
                </div>
                {p.xfactor && (
                  <div style={{ fontSize: 11, color: 'var(--orange)', fontWeight: 600, marginBottom: 4 }}>⭐ {p.xfactor}</div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    Base: {formatCurrency(p.basePrice)}
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 900, color: 'var(--crimson)' }}>
                    {formatCurrency(p.soldPrice ?? p.price)}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty slots representation */}
      {slotsLeft > 0 && (
        <div style={{ marginTop: 16, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {Array.from({ length: slotsLeft }).map((_, i) => (
            <div key={i} style={{
              width: 40, height: 40, borderRadius: 8,
              border: '2px dashed var(--border)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--text-muted)', fontSize: 16
            }}>+</div>
          ))}
          <span style={{ fontSize: 13, color: 'var(--text-muted)', marginLeft: 8 }}>
            {slotsLeft} squad slot{slotsLeft !== 1 ? 's' : ''} available
          </span>
        </div>
      )}
    </div>
  );
}
