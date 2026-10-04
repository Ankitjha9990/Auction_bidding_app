import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api, formatCurrency, timeAgo } from '../../utils/api';

export default function AdminBidHistory() {
  const { id: auctionId } = useParams();
  const [bids, setBids] = useState([]);
  const [teams, setTeams] = useState([]);
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get(`/auctions/${auctionId}/bids`),
      api.get(`/auctions/${auctionId}/teams`),
      api.get(`/auctions/${auctionId}/players`)
    ]).then(([bRes, tRes, pRes]) => {
      setBids(bRes.data);
      setTeams(tRes.data);
      setPlayers(pRes.data);
      setLoading(false);
    });
  }, [auctionId]);

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}><div className="spinner" /></div>;

  return (
    <div className="page-content">
      <h2 className="page-title">📜 Bid History</h2>
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {bids.length === 0 ? (
          <div className="empty-state"><div className="empty-state-icon">📜</div><h3>No bids yet</h3></div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Player</th>
                <th>Team</th>
                <th>Amount</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              {bids.map((b, i) => {
                const player = players.find(p => p.id === b.playerId);
                const team = teams.find(t => t.id === b.teamId);
                return (
                  <tr key={b.id}>
                    <td style={{ color: 'var(--text-muted)', fontWeight: 600 }}>{b.sequence || bids.length - i}</td>
                    <td style={{ fontWeight: 600 }}>{player?.name || b.playerId}</td>
                    <td>{team?.name || b.teamId}</td>
                    <td style={{ fontWeight: 700, color: 'var(--navy)' }}>{formatCurrency(b.amount)}</td>
                    <td style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{timeAgo(b.createdAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
