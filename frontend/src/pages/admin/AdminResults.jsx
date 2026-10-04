import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api, formatCurrency } from '../../utils/api';

export default function AdminResults() {
  const { id: auctionId } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('summary');

  useEffect(() => {
    api.get(`/auctions/${auctionId}/results`).then(r => { setData(r.data); setLoading(false); });
  }, [auctionId]);

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><div className="spinner" /></div>;
  if (!data) return null;

  const { teams, sold, unsold, totalSpent, highest, avg, players, purchases } = data;

  const exportCSV = () => {
    const rows = [['Player', 'Category', 'Base Price', 'Final Price', 'Team']];
    purchases.forEach(p => {
      const player = players.find(pl => pl.id === p.playerId);
      const team = teams.find(t => t.id === p.teamId);
      rows.push([player?.name, player?.category, player?.basePrice, p.finalPrice, team?.name]);
    });
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'auction_results.csv';
    a.click();
  };

  return (
    <div className="page-content">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <h2 className="page-title" style={{ marginBottom: 0 }}>📊 Auction Results</h2>
        <button className="btn btn-outline" onClick={exportCSV}>⬇ Export CSV</button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-4 gap-4" style={{ marginBottom: 24 }}>
        {[
          { label: 'Total Players', value: players.length, icon: '👤' },
          { label: 'Sold', value: sold.length, icon: '✅', color: 'var(--green)' },
          { label: 'Unsold', value: unsold.length, icon: '❌', color: 'var(--red)' },
          { label: 'Total Spent', value: formatCurrency(totalSpent), icon: '💰', color: 'var(--navy)' },
          { label: 'Highest Sale', value: formatCurrency(highest), icon: '🏆', color: 'var(--orange)' },
          { label: 'Average Sale', value: formatCurrency(avg), icon: '📈' },
          { label: 'Teams', value: teams.length, icon: '👥' },
        ].map(s => (
          <div key={s.label} className="stat-card" style={{ gap: 8 }}>
            <div style={{ fontSize: 24 }}>{s.icon}</div>
            <div className="stat-value" style={{ color: s.color || 'var(--text)', fontSize: 22 }}>{s.value}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="tab-bar">
        {[['summary', 'Summary'], ['teams', 'Team Results'], ['sold', 'Sold Players'], ['unsold', 'Unsold Players']].map(([k, l]) => (
          <button key={k} className={`tab ${tab === k ? 'active' : ''}`} onClick={() => setTab(k)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>{l}</button>
        ))}
      </div>

      {tab === 'summary' && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
            <h3 style={{ fontWeight: 700 }}>All Purchases</h3>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Player</th>
                <th>Category</th>
                <th>Base Price</th>
                <th>Final Price</th>
                <th>Team</th>
                <th>Multiplier</th>
              </tr>
            </thead>
            <tbody>
              {purchases.sort((a, b) => b.finalPrice - a.finalPrice).map(p => {
                const player = players.find(pl => pl.id === p.playerId);
                const team = teams.find(t => t.id === p.teamId);
                const mult = player ? (p.finalPrice / player.basePrice).toFixed(1) : '—';
                return (
                  <tr key={p.id}>
                    <td style={{ fontWeight: 600 }}>{player?.name || '—'}</td>
                    <td style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{player?.category || '—'}</td>
                    <td>{formatCurrency(player?.basePrice)}</td>
                    <td style={{ fontWeight: 700, color: 'var(--navy)' }}>{formatCurrency(p.finalPrice)}</td>
                    <td>{team?.name || '—'}</td>
                    <td style={{ color: mult > 5 ? 'var(--green)' : 'var(--text-secondary)', fontWeight: 600 }}>{mult}×</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'teams' && (
        <div className="grid grid-2 gap-4">
          {teams.map(t => {
            const teamPurchases = purchases.filter(p => p.teamId === t.id);
            const spent = teamPurchases.reduce((s, p) => s + p.finalPrice, 0);
            return (
              <div key={t.id} className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                  <div>
                    <h3 style={{ fontSize: 18, fontWeight: 800 }}>{t.name}</h3>
                    <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 2 }}>
                      {teamPurchases.length} players · Remaining: {formatCurrency(t.remainingBudget)}
                    </p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--navy)' }}>{formatCurrency(spent)}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Total Spent</div>
                  </div>
                </div>
                {teamPurchases.map(p => {
                  const player = players.find(pl => pl.id === p.playerId);
                  return (
                    <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: 14 }}>
                      <div>
                        <span style={{ fontWeight: 600 }}>{player?.name}</span>
                        <span style={{ color: 'var(--text-muted)', marginLeft: 8, fontSize: 12 }}>{player?.category}</span>
                      </div>
                      <span style={{ fontWeight: 700, color: 'var(--navy)' }}>{formatCurrency(p.finalPrice)}</span>
                    </div>
                  );
                })}
                {teamPurchases.length === 0 && (
                  <p style={{ color: 'var(--text-muted)', fontSize: 14, textAlign: 'center', padding: 16 }}>No players bought</p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {tab === 'sold' && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="data-table">
            <thead>
              <tr><th>Player</th><th>Category</th><th>Base Price</th><th>Sold For</th><th>Team</th></tr>
            </thead>
            <tbody>
              {sold.map(p => {
                const purchase = purchases.find(pu => pu.playerId === p.id);
                const team = purchase ? teams.find(t => t.id === purchase.teamId) : null;
                return (
                  <tr key={p.id}>
                    <td style={{ fontWeight: 600 }}>{p.name}</td>
                    <td style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{p.category}</td>
                    <td>{formatCurrency(p.basePrice)}</td>
                    <td style={{ fontWeight: 700, color: 'var(--green)' }}>{formatCurrency(purchase?.finalPrice)}</td>
                    <td>{team?.name || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'unsold' && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {unsold.length === 0 ? (
            <div className="empty-state"><div className="empty-state-icon">🎉</div><h3>No unsold players!</h3></div>
          ) : (
            <table className="data-table">
              <thead>
                <tr><th>Player</th><th>Category</th><th>Base Price</th><th>X-Factor</th></tr>
              </thead>
              <tbody>
                {unsold.map(p => (
                  <tr key={p.id}>
                    <td style={{ fontWeight: 600 }}>{p.name}</td>
                    <td style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{p.category}</td>
                    <td>{formatCurrency(p.basePrice)}</td>
                    <td>{p.xfactor ? <span style={{ fontSize: 12, background: 'var(--orange-light)', color: 'var(--orange)', padding: '2px 8px', borderRadius: 99, fontWeight: 600 }}>⭐ {p.xfactor}</span> : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
