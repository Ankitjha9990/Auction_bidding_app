import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api, formatCurrency, getImageUrl } from '../../utils/api';
import PlayerAvatar from '../../components/PlayerAvatar';


export default function CaptainTeam() {
  const { user } = useAuth();
  const [myTeam, setMyTeam] = useState(null);
  const [players, setPlayers] = useState([]);
  const [auction, setAuction] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const [aRes, uRes] = await Promise.all([api.get('/auctions'), api.get('/users')]);
      const auctions = aRes.data;
      const liveAuction = auctions.find(a => a.status === 'LIVE') || auctions[0];
      if (!liveAuction) { setLoading(false); return; }

      setAuction(liveAuction);
      const [tRes, pRes] = await Promise.all([
        api.get(`/auctions/${liveAuction.id}/teams`),
        api.get(`/auctions/${liveAuction.id}/players`)
      ]);

      const team = tRes.data.find(t => t.captainId === user.id) ||
        tRes.data.find(t => {
          const captain = uRes.data.find(u => u.id === t.captainId);
          return captain?.email === user.email;
        });

      setMyTeam(team);
      setPlayers(pRes.data);
      setLoading(false);
    };
    load();
  }, [user]);

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><div className="spinner" /></div>;
  if (!myTeam) return (
    <div className="empty-state" style={{ padding: 60 }}>
      <div className="empty-state-icon">👥</div>
      <h3>No team assigned</h3>
      <p>Contact the admin to be assigned a team.</p>
    </div>
  );

  const myPlayers = players
    .filter(p => p.soldTo === myTeam.id && p.status === 'SOLD')
    .map(p => {
      const tp = (myTeam.players || []).find(item => item.playerId === p.id);
      return {
        ...p,
        soldPrice: tp ? tp.price : (p.soldPrice || p.basePrice)
      };
    });

  const spent = myPlayers.reduce((s, p) => s + (p.soldPrice || 0), 0);
  const budgetPct = Math.round((myTeam.remainingBudget / myTeam.initialBudget) * 100);
  const slotsLeft = (auction?.maxSquadSize || 11) - myPlayers.length;

  return (
    <div style={{ padding: 20, maxWidth: 800, margin: '0 auto' }}>
      {/* Team header */}
      <div style={{ background: 'linear-gradient(135deg, var(--navy-dark), var(--navy))', borderRadius: 16, padding: '24px 28px', marginBottom: 20, color: 'white' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
          {myTeam.logoUrl && (
            <img
              src={getImageUrl(myTeam.logoUrl)}
              alt={myTeam.name}
              style={{ width: 64, height: 64, borderRadius: 14, objectFit: 'contain', background: '#FFFFFF', padding: 4 }}
            />
          )}
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: 1 }}>
              MY TEAM SQUAD
            </div>
            <h2 style={{ fontSize: 28, fontWeight: 900, color: 'var(--orange)', margin: '4px 0 0' }}>{myTeam.name}</h2>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          {[
            { label: 'Remaining Budget', value: formatCurrency(myTeam.remainingBudget), color: budgetPct < 20 ? '#EF4444' : 'white' },
            { label: 'Total Spent', value: formatCurrency(spent), color: 'white' },
            { label: 'Players Bought', value: myPlayers.length, color: 'white' },
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
            <div className="progress-fill" style={{ width: `${100 - budgetPct}%` }} />
          </div>
        </div>
      </div>

      {/* Players */}
      <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 14 }}>
        Squad ({myPlayers.length}/{auction?.maxSquadSize || 11})
      </div>

      {myPlayers.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">⚡</div>
          <h3>No players yet</h3>
          <p>Start bidding to build your squad!</p>
        </div>
      ) : (
        <div className="grid grid-2 gap-4">
          {myPlayers.map(p => (
            <div key={p.id} className="card" style={{ display: 'flex', gap: 14, padding: 16 }}>
              <div style={{ width: 56, height: 70, borderRadius: 8, overflow: 'hidden', background: 'var(--navy)', flexShrink: 0 }}>
                <PlayerAvatar
                  player={p}
                  size={56}
                  borderRadius={8}
                  style={{ width: '100%', height: '100%' }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{p.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>{p.category}</div>
                {p.xfactor && (
                  <div style={{ fontSize: 11, color: 'var(--orange)', fontWeight: 600, marginBottom: 4 }}>⭐ {p.xfactor}</div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    Base: {formatCurrency(p.basePrice)}
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--navy)' }}>
                    {formatCurrency(p.soldPrice)}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty slots */}
      {slotsLeft > 0 && myPlayers.length > 0 && (
        <div style={{ marginTop: 16, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {Array.from({ length: slotsLeft }).map((_, i) => (
            <div key={i} style={{
              width: 40, height: 40, borderRadius: 8,
              border: '2px dashed var(--border)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--text-muted)', fontSize: 18
            }}>+</div>
          ))}
          <span style={{ alignSelf: 'center', fontSize: 13, color: 'var(--text-muted)' }}>{slotsLeft} slot{slotsLeft !== 1 ? 's' : ''} remaining</span>
        </div>
      )}
    </div>
  );
}
