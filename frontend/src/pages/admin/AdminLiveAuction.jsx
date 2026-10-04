import { useEffect, useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api, getStatusBadgeClass, formatTime, timeAgo, getImageUrl } from '../../utils/api';
import { AuctionProvider, useAuction } from '../../context/AuctionContext';
import { useSocket } from '../../context/SocketContext';
import PlayerAvatar from '../../components/PlayerAvatar';
import { Shuffle, Search, AlertCircle, CheckCircle, ShieldAlert } from 'lucide-react';

function TeamLogo({ logoUrl, name, size = 26 }) {
  const src = logoUrl ? getImageUrl(logoUrl) : null;
  const initials = (name || '?').slice(0, 2).toUpperCase();
  if (src) {
    return (
      <img
        src={src}
        alt={name}
        style={{ width: size, height: size, objectFit: 'contain', borderRadius: 4, background: 'rgba(255,255,255,0.06)', flexShrink: 0 }}
        onError={e => { e.target.style.display = 'none'; }}
      />
    );
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: 4,
      background: 'rgba(79, 70, 229, 0.12)', border: '1px solid rgba(79, 70, 229, 0.24)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'Barlow Condensed', sans-serif",
      fontWeight: 800, fontSize: Math.max(10, Math.round(size * 0.4)),
      color: '#312E81', flexShrink: 0,
    }}>
      {initials}
    </div>
  );
}

function LiveControl({ auctionId }) {
  const { snapshot, loading, recentBids, soldOverlay, refetchSnapshot } = useAuction();
  const { connected, getServerTime } = useSocket();
  const [players, setPlayers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [auction, setAuction] = useState(null);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [confirmAction, setConfirmAction] = useState(null);
  const [actionError, setActionError] = useState('');
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [playerSearch, setPlayerSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const [liveBid, setLiveBid] = useState(null);
  const timerRef = useRef();
  const bidToastTimerRef = useRef(null);
  const lastRecentBidRef = useRef(null);

  const triggerBidToast = (data) => {
    const teamName = data?.highestBidderName || data?.bid?.teamName || 'TEAM';
    const amount = Number(data?.currentBid ?? data?.bid?.amount ?? 0);
    setLiveBid({ teamName, amount, kind: 'NEW BID' });
    if (bidToastTimerRef.current) clearTimeout(bidToastTimerRef.current);
    bidToastTimerRef.current = setTimeout(() => setLiveBid(null), 1800);
  };

  useEffect(() => {
    if (!recentBids.length) return;
    const latest = recentBids[0];
    const prev = lastRecentBidRef.current;
    if (prev && (prev.id !== latest.id || prev.amount !== latest.amount || prev.teamName !== latest.teamName)) {
      triggerBidToast({ currentBid: latest.amount || latest.currentBid || 0, highestBidderName: latest.teamName || latest.highestBidderName || 'TEAM' });
    }
    lastRecentBidRef.current = latest;
  }, [recentBids]);

  const loadBase = async () => {
    try {
      const [aRes, pRes, tRes] = await Promise.all([
        api.get(`/auctions/${auctionId}`),
        api.get(`/auctions/${auctionId}/players`),
        api.get(`/auctions/${auctionId}/teams`)
      ]);
      setAuction(aRes.data);
      setPlayers(pRes.data);
      setTeams(tRes.data);
      if (tRes.data.length > 0 && !selectedTeamId) {
        setSelectedTeamId(tRes.data[0].id);
      }
    } catch (err) {
      console.error('Failed to load auction data:', err);
    }
  };

  useEffect(() => { loadBase(); }, [auctionId]);

  useEffect(() => {
    if (snapshot?.teams) setTeams(snapshot.teams);
    if (snapshot?.players) setPlayers(snapshot.players);
    if (snapshot?.auction) setAuction(snapshot.auction);
  }, [snapshot]);

  // Countdown timer
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (snapshot?.status === 'LIVE' && snapshot?.endsAt) {
      timerRef.current = setInterval(() => {
        setTimeRemaining(Math.max(0, snapshot.endsAt - getServerTime()));
      }, 150);
    } else {
      setTimeRemaining(0);
    }
    return () => clearInterval(timerRef.current);
  }, [snapshot?.status, snapshot?.endsAt, getServerTime]);

  const action = async (fn, confirmPayload) => {
    setActionError('');
    if (confirmPayload) {
      setConfirmAction({ ...confirmPayload, fn });
      return;
    }
    try {
      await fn();
      loadBase();
      if (refetchSnapshot) refetchSnapshot();
    } catch (err) {
      setActionError(err.response?.data?.error || err.message || 'Operation failed');
    }
  };

  const startAuction = () => action(() => api.post(`/auctions/${auctionId}/start`), {
    title: 'START AUCTION',
    msg: 'Are you sure you want to start the live auction? All connected captains will be notified.'
  });

  const pauseAuction = () => action(() => api.post(`/auctions/${auctionId}/pause`));
  const resumeAuction = () => action(() => api.post(`/auctions/${auctionId}/resume`));
  const completeAuction = () => action(() => api.post(`/auctions/${auctionId}/complete`), {
    title: 'END AUCTION',
    msg: 'Mark auction as COMPLETED? Bidding will be closed.'
  });

  const startPlayer = async (playerId = 'random') => {
    setActionError('');
    try {
      await api.post(`/auctions/${auctionId}/next-player`, { playerId });
    } catch (err) {
      setActionError(err.response?.data?.error || 'Failed to start player');
    }
  };

  const forceSold = () => {
    if (!snapshot?.highestBidder) { setActionError('No bids placed yet!'); return; }
    const team = teams.find(t => t.id === snapshot.highestBidder);
    action(
      () => api.post(`/auctions/${auctionId}/force-sold`, { teamId: snapshot.highestBidder, amount: snapshot.currentBid }),
      {
        title: 'CONFIRM PLAYER SALE',
        player: snapshot.currentPlayer?.name,
        bid: snapshot.currentBid,
        team: team?.name,
        msg: `Sell ${snapshot.currentPlayer?.name} for Qc ${snapshot.currentBid?.toLocaleString()} to ${team?.name}?`
      }
    );
  };

  const forceUnsold = () => {
    action(
      () => api.post(`/auctions/${auctionId}/force-unsold`),
      {
        title: 'MARK PLAYER UNSOLD',
        player: snapshot?.currentPlayer?.name,
        msg: `Mark ${snapshot?.currentPlayer?.name} as UNSOLD?`
      }
    );
  };

  const extendTimer = () => action(() => api.post(`/auctions/${auctionId}/extend-timer`, { seconds: 10 }));

  const currentPlayer = snapshot?.currentPlayer;
  const currentBid = snapshot?.currentBid || 0;
  const highestBidder = snapshot?.highestBidder;
  const highestBidderTeam = teams.find(t => t.id === highestBidder);
  const auctionStatus = snapshot?.status || auction?.status || 'DRAFT';

  const waitingPlayers = players.filter(p => p.status === 'WAITING');
  const soldPlayers = players.filter(p => p.status === 'SOLD');
  const unsoldPlayers = players.filter(p => p.status === 'UNSOLD');

  const selectedTeam = teams.find(t => t.id === selectedTeamId) || teams[0];
  const teamBoughtPlayers = selectedTeam
    ? players.filter(p => p.soldTeamId === selectedTeam.id || p.soldTo === selectedTeam.id || p.teamId === selectedTeam.id)
    : [];

  const filteredPlayers = players.filter(p => {
    const matchesSearch = !playerSearch || p.name.toLowerCase().includes(playerSearch.toLowerCase()) || String(p.registrationId || '').includes(playerSearch);
    const matchesStatus = statusFilter === 'ALL' || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const rowsPerPage = 10;
  const totalPages = Math.max(1, Math.ceil(filteredPlayers.length / rowsPerPage));
  const paginatedPlayers = filteredPlayers.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

  useEffect(() => {
    setCurrentPage(1);
  }, [playerSearch, statusFilter]);

  const secRemaining = Math.ceil(timeRemaining / 1000);
  const isUrgent = secRemaining <= 5 && secRemaining > 0 && auctionStatus === 'LIVE';
  const isWarning = secRemaining <= 10 && secRemaining > 5 && auctionStatus === 'LIVE';

  const lastBidAmount = recentBids.length > 1 ? recentBids[1]?.amount : (currentPlayer?.basePrice || 0);
  const bidIncrement = currentBid > 0 ? (currentBid - (lastBidAmount || 0)) : (currentPlayer?.basePrice || 50);

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#F4F5F8' }}>
      <div style={{ textAlign: 'center' }}>
        <div className="spinner" style={{ margin: '0 auto 14px' }} />
        <div style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--crimson)', letterSpacing: 3, fontWeight: 800, fontSize: 13 }}>LOADING CONTROL ROOM...</div>
      </div>
    </div>
  );

  return (
    <div className="vc-root vc-body vc-admin-live" style={{ minHeight: '100vh' }}>
      {liveBid && (
        <div className="live-bid-toast visible" aria-live="polite">
          <div className="live-bid-toast-label">{liveBid.kind}</div>
          <div className="live-bid-toast-team">{liveBid.teamName}</div>
          <div className="live-bid-toast-amount">Qc {liveBid.amount.toLocaleString()}</div>
        </div>
      )}
      {/* ── TOP HEADER ── */}
      <header className="vc-header" style={{ background: '#FFFFFF', borderBottom: '1px solid var(--border-light)', height: 64, padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', sticky: 'top', zIndex: 100 }}>
        <div className="vc-logo-block" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ background: 'transparent', padding: '6px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 18, color: 'var(--text-dark)', letterSpacing: 2 }}>VALOR CUP</span>
            <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 11, color: 'var(--crimson)', letterSpacing: 1.5, background: 'rgba(196,18,48,0.1)', padding: '2px 6px', borderRadius: 6 }}>2026</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 14, color: 'var(--text-dark)', letterSpacing: 1, textTransform: 'uppercase' }}>{auction?.name || 'AUCTION CONTROL ROOM'}</span>
            <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 600, fontSize: 11, color: 'var(--text-dim)', letterSpacing: 1 }}>ADMIN PANEL</span>
          </div>
          <Link to="/admin" style={{ marginLeft: 12, fontSize: 12, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, color: 'var(--crimson)', textDecoration: 'none', border: '1px solid var(--border-crimson)', padding: '4px 10px', borderRadius: 4 }}>← Dashboard</Link>
        </div>

        {/* Center: Realtime Status & Round/Lot */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: connected ? 'rgba(16,185,129,0.08)' : 'rgba(148,163,184,0.12)', border: `1px solid ${connected ? 'rgba(16,185,129,0.3)' : 'rgba(148,163,184,0.35)'}`, padding: '4px 12px', borderRadius: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: connected ? 'var(--green)' : '#64748B', boxShadow: connected ? '0 0 8px var(--green)' : 'none' }} />
            <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 12, letterSpacing: 1.5, color: connected ? '#065F46' : '#334155', textTransform: 'uppercase' }}>
              {connected ? 'CONNECTED' : 'DISCONNECTED'}
            </span>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ background: '#E2E8F0', color: '#0F172A', padding: '4px 10px', borderRadius: 8, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 12, letterSpacing: 1.5 }}>
              ROUND {String(Math.floor((soldPlayers.length + unsoldPlayers.length) / 10) + 1).padStart(2,'0')}
            </div>
            <div style={{ background: '#EEF2FF', color: 'var(--crimson)', border: '1px solid rgba(79, 70, 229, 0.24)', padding: '4px 10px', borderRadius: 8, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 12, letterSpacing: 1.5 }}>
              LOT #{String(soldPlayers.length + (currentPlayer ? 1 : 0)).padStart(3,'0')}
            </div>
          </div>
        </div>
      </header>

      {/* Action Error Notification */}
      {actionError && (
        <div style={{ padding: '10px 24px', background: '#EEF2FF', borderBottom: '1px solid rgba(79, 70, 229, 0.18)', display: 'flex', alignItems: 'center', gap: 10, color: '#312E81' }}>
          <AlertCircle size={16} />
          <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 13, letterSpacing: 1 }}>{actionError}</span>
          <button onClick={() => setActionError('')} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#312E81', cursor: 'pointer', fontSize: 18, fontWeight: 800 }}>×</button>
        </div>
      )}

      {/* ── MAIN THREE-COLUMN LAYOUT ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr 340px', gap: 16, padding: 16, flex: 1, maxWidth: 1800, margin: '0 auto', width: '100%' }}>

        {/* ══════════════════════════════════════════
           LEFT COLUMN: Current Player + Team Players
        ══════════════════════════════════════════ */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* CURRENT PLAYER CARD */}
          <div style={{ background: '#FFFFFF', border: '1px solid var(--border-light)', borderRadius: 6, padding: 16, boxShadow: 'var(--shadow-sm)', borderTop: '4px solid var(--crimson)' }}>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 14, letterSpacing: 2, color: 'var(--crimson)', textTransform: 'uppercase', marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>CURRENT PLAYER</span>
              <span className={getStatusBadgeClass(currentPlayer ? 'BIDDING' : auctionStatus)}>{currentPlayer ? 'BIDDING' : auctionStatus}</span>
            </div>

            {currentPlayer ? (
              <div>
                <div style={{ display: 'flex', gap: 14, marginBottom: 14 }}>
                  <PlayerAvatar player={currentPlayer} size={84} borderRadius={4} border="2px solid var(--crimson)" />
                  <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', minWidth: 0, flex: 1 }}>
                    <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 11, letterSpacing: 2, color: 'var(--text-dim)', textTransform: 'uppercase' }}>
                      REG. ID {currentPlayer.registrationId || currentPlayer.id?.slice(-3) || '—'}
                    </div>
                    <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 20, color: 'var(--text-dark)', textTransform: 'uppercase', lineHeight: 1.1, margin: '2px 0 6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {currentPlayer.name}
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <span style={{ background: 'var(--maroon-dark)', color: '#FFFFFF', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 10, padding: '2px 6px', borderRadius: 3, letterSpacing: 1 }}>
                        CAT {currentPlayer.category || 'C'}
                      </span>
                      <span style={{ background: '#F1F5F9', color: 'var(--text-secondary)', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 10, padding: '2px 6px', borderRadius: 3, letterSpacing: 1 }}>
                        BASE: Qc {(currentPlayer.basePrice || 0).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>

                {/* CURRENT BID DISPLAY */}
                <div style={{ background: '#FFFFFF', borderRadius: 12, padding: '16px', border: '1px solid var(--border-light)', color: 'var(--text-dark)', marginBottom: 12, boxShadow: '0 4px 15px rgba(0,0,0,0.03)', position: 'relative' }}>
                  <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 10, letterSpacing: 2, color: 'var(--text-faint)', textTransform: 'uppercase' }}>CURRENT BID</div>
                  <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 28, color: '#4F46E5', letterSpacing: 1, margin: '2px 0 16px' }}>
                    Qc {currentBid.toLocaleString()}
                  </div>
                  <div style={{ position: 'absolute', bottom: 12, right: 12 }}>
                    {highestBidderTeam ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#F8F9FD', border: '1px solid var(--border-light)', padding: '4px 10px', borderRadius: 16 }}>
                        <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 10, letterSpacing: 1.5, color: 'var(--text-faint)', textTransform: 'uppercase' }}>LEADING:</span>
                        <TeamLogo logoUrl={highestBidderTeam.logoUrl} name={highestBidderTeam.name} size={16} />
                        <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 12, color: 'var(--text-dark)' }}>{highestBidderTeam.name}</span>
                      </div>
                    ) : (
                      <div style={{ background: '#F8F9FD', border: '1px solid var(--border-light)', padding: '4px 10px', borderRadius: 16 }}>
                        <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 11, color: 'var(--text-faint)' }}>NO BIDS YET</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ padding: '24px 16px', textAlign: 'center', background: '#F8F9FD', borderRadius: 6, border: '1px stroke #E2E8F0' }}>
                <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 16, color: 'var(--text-dim)', letterSpacing: 1.5, textTransform: 'uppercase' }}>READY FOR NEXT PLAYER</div>
                <div style={{ fontSize: 12, color: 'var(--text-faint)', marginTop: 4 }}>{waitingPlayers.length} players remaining in pool</div>
              </div>
            )}
          </div>

          {/* PLAYERS IN TEAM CARD */}
          <div style={{ background: '#FFFFFF', border: '1px solid var(--border-light)', borderRadius: 6, padding: 16, boxShadow: 'var(--shadow-sm)', flex: 1, display: 'flex', flexDirection: 'column', minHeight: 320 }}>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 14, letterSpacing: 2, color: 'var(--text-dark)', textTransform: 'uppercase', marginBottom: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>PLAYERS IN TEAM</span>
              <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--crimson)', background: '#FFF0F3', padding: '2px 6px', borderRadius: 3 }}>
                {teamBoughtPlayers.length} SQUAD
              </span>
            </div>

            {/* Team Dropdown Selector */}
            <select
              value={selectedTeamId}
              onChange={e => setSelectedTeamId(e.target.value)}
              style={{ width: '100%', padding: '8px 10px', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 13, border: '1px solid var(--border-light)', borderRadius: 4, background: '#F8F9FD', color: 'var(--text-dark)', marginBottom: 12 }}
            >
              {teams.map(t => (
                <option key={t.id} value={t.id}>
                  {t.name} (Qc {(t.remainingBudget || 0).toLocaleString()} left)
                </option>
              ))}
            </select>

            {/* Squad List */}
            <div style={{ overflowY: 'auto', flex: 1, maxHeight: 320, paddingRight: 4 }}>
              {teamBoughtPlayers.length === 0 ? (
                <div style={{ padding: '30px 16px', textAlign: 'center', color: 'var(--text-faint)', fontSize: 12, fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: 1 }}>
                  NO PLAYERS ACQUIRED YET
                </div>
              ) : (
                teamBoughtPlayers.map((p, idx) => (
                  <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', borderBottom: '1px solid #F1F5F9', fontSize: 12, background: idx % 2 === 0 ? '#FFFFFF' : '#F9FAFB' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                      <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, color: 'var(--text-faint)', fontSize: 11, width: 18 }}>{String(idx + 1).padStart(2,'0')}</span>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 700, color: 'var(--text-dark)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{p.name}</div>
                        <div style={{ fontSize: 10, color: 'var(--text-faint)', fontFamily: "'Barlow Condensed', sans-serif" }}>REG #{p.registrationId || p.id?.slice(-3)} · CAT {p.category || 'C'}</div>
                      </div>
                    </div>
                    <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, color: 'var(--crimson)', fontSize: 13, letterSpacing: 0.5 }}>
                      Qc {Number(p.soldPrice || p.currentBid || 0).toLocaleString()}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════════
           CENTER COLUMN: All Players List Table
        ══════════════════════════════════════════ */}
        <div style={{ background: '#FFFFFF', border: '1px solid var(--border-light)', borderRadius: 6, padding: 16, boxShadow: 'var(--shadow-sm)', display: 'flex', flexDirection: 'column', height: '100%', minHeight: 680 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
            <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
              <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 18, letterSpacing: 2, color: 'var(--text-dark)', textTransform: 'uppercase' }}>ALL PLAYERS LIST</div>
              <div style={{ display: 'flex', gap: 12, fontSize: 11, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, textTransform: 'uppercase' }}>
                <span style={{ color: 'var(--text-dim)' }}>{players.length} PLAYERS</span>
                <span style={{ color: '#D97706' }}>{waitingPlayers.length} WAITING</span>
                <span style={{ color: '#059669' }}>{soldPlayers.length} SOLD</span>
                <span style={{ color: '#DC2626' }}>{unsoldPlayers.length} UNSOLD</span>
              </div>
            </div>

            {/* Controls & Filter */}
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  placeholder="Search player / ID..."
                  value={playerSearch}
                  onChange={e => setPlayerSearch(e.target.value)}
                  style={{ padding: '4px 10px 4px 28px', fontSize: 12, border: '1px solid var(--border-light)', borderRadius: 4, fontFamily: "'Barlow', sans-serif", width: 150 }}
                />
                <Search size={13} style={{ position: 'absolute', left: 8, top: 7, color: 'var(--text-faint)' }} />
              </div>

              <div style={{ display: 'flex', background: '#F8F9FD', borderRadius: 4, padding: 2, border: '1px solid var(--border-light)' }}>
                {['ALL', 'WAITING', 'SOLD', 'UNSOLD'].map(status => (
                  <div
                    key={status}
                    className={`admin-filter-tab ${statusFilter === status ? 'active' : ''}`}
                    onClick={() => setStatusFilter(status)}
                  >
                    {status}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Table */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div style={{ border: '1px solid var(--border-light)', borderRadius: 4, flex: 1 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 13 }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                  <tr style={{ background: '#F8F9FD', borderBottom: '2px solid var(--border-light)', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 11, color: 'var(--text-dim)', letterSpacing: 1, textTransform: 'uppercase' }}>
                    <th style={{ padding: '10px 12px' }}>PLAYER</th>
                    <th style={{ padding: '10px 12px' }}>STATUS</th>
                    <th style={{ padding: '10px 12px' }}>SOLD PRICE</th>
                    <th style={{ padding: '10px 12px' }}>TEAM</th>
                    <th style={{ padding: '10px 12px' }}>BASE</th>
                    <th style={{ padding: '10px 12px' }}>CAT</th>
                    <th style={{ padding: '10px 12px' }}>REG ID</th>
                    <th style={{ padding: '10px 12px', textAlign: 'right' }}>ACTION</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedPlayers.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ padding: 30, textAlign: 'center', color: 'var(--text-faint)', fontFamily: "'Barlow Condensed', sans-serif" }}>
                        No players match criteria.
                      </td>
                    </tr>
                  ) : (
                    paginatedPlayers.map((p, idx) => {
                      const isCurrent = p.id === currentPlayer?.id;
                      const soldTeam = teams.find(t => t.id === p.soldTeamId || t.id === p.soldTo || t.id === p.teamId);
                      const isWaiting = p.status === 'WAITING' || p.status === 'READY';
                      const isSold = p.status === 'SOLD';
                      const isUnsold = p.status === 'UNSOLD';
                      return (
                        <tr key={p.id} className={`admin-player-row ${isCurrent ? 'current' : ''}`} style={{ borderBottom: '1px solid #F1F5F9' }}>
                          <td style={{ padding: '10px 12px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <PlayerAvatar player={p} size={32} borderRadius={4} />
                              <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                                <div style={{ fontWeight: 800, fontSize: 14, color: isCurrent ? 'var(--crimson)' : 'var(--text-dark)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: 160 }}>
                                  {p.name}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td style={{ padding: '10px 12px' }}>
                            {isCurrent ? (
                              <div className="admin-status-badge waiting" style={{ background: '#EEF2FF', color: '#4F46E5' }}>
                                <div className="dot" style={{ background: '#4F46E5' }}></div> CURRENT
                              </div>
                            ) : (
                              <div className={`admin-status-badge ${isWaiting ? 'waiting' : isSold ? 'sold' : 'unsold'}`}>
                                <div className="dot"></div> {p.status}
                              </div>
                            )}
                          </td>
                          <td style={{ padding: '10px 12px', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, color: isSold ? '#059669' : 'var(--text-faint)' }}>
                            {isSold ? (
                              <span style={{ background: 'rgba(5,150,105,0.1)', padding: '2px 6px', borderRadius: 4 }}>Qc {Number(p.soldPrice || p.currentBid || 0).toLocaleString()}</span>
                            ) : '—'}
                          </td>
                          <td style={{ padding: '10px 12px', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700 }}>
                            {soldTeam ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <TeamLogo logoUrl={soldTeam.logoUrl} name={soldTeam.name} size={16} />
                                <span style={{ color: 'var(--text-dark)' }}>{soldTeam.name}</span>
                              </div>
                            ) : <span style={{ color: 'var(--text-faint)' }}>—</span>}
                          </td>
                          <td style={{ padding: '10px 12px', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, color: 'var(--text-secondary)' }}>
                            Qc {(p.basePrice || 0).toLocaleString()}
                          </td>
                          <td style={{ padding: '10px 12px', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, color: 'var(--text-dim)' }}>
                            <span style={{ background: '#F1F5F9', padding: '2px 6px', borderRadius: 4 }}>{p.category || 'C'}</span>
                          </td>
                          <td style={{ padding: '10px 12px', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, color: 'var(--text-faint)', fontSize: 12 }}>
                            #{p.registrationId || p.id?.slice(-3)}
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                            {isWaiting && !currentPlayer && (
                              <button
                                onClick={() => startPlayer(p.id)}
                                style={{ background: '#FFFFFF', color: '#0F172A', border: '1px solid var(--border-light)', padding: '4px 10px', borderRadius: 4, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 11, cursor: 'pointer', letterSpacing: 1, transition: '0.2s', ':hover': { borderColor: 'var(--crimson)' } }}
                                onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--crimson)'; e.currentTarget.style.color = 'var(--crimson)'; e.currentTarget.style.background = '#FFF0F3'; }}
                                onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-light)'; e.currentTarget.style.color = '#0F172A'; e.currentTarget.style.background = '#FFFFFF'; }}
                              >
                                SELECT
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            
            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 }}>
                <div style={{ fontFamily: "'Barlow', sans-serif", fontSize: 12, color: 'var(--text-dim)', fontWeight: 600 }}>
                  Showing {(currentPage - 1) * rowsPerPage + 1}–{Math.min(currentPage * rowsPerPage, filteredPlayers.length)} of {filteredPlayers.length} players
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <button
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(c => c - 1)}
                    style={{ background: '#FFFFFF', border: '1px solid var(--border-light)', padding: '4px 10px', borderRadius: 4, cursor: currentPage === 1 ? 'not-allowed' : 'pointer', opacity: currentPage === 1 ? 0.5 : 1, fontSize: 12, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700 }}
                  >
                    PREVIOUS
                  </button>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1).map((p, i, arr) => (
                      <div key={p} style={{ display: 'flex', alignItems: 'center' }}>
                        {i > 0 && p - arr[i - 1] > 1 && <span style={{ padding: '0 4px', color: 'var(--text-faint)' }}>...</span>}
                        <button
                          onClick={() => setCurrentPage(p)}
                          style={{ background: p === currentPage ? 'var(--crimson)' : '#FFFFFF', color: p === currentPage ? '#FFFFFF' : 'var(--text-dark)', border: p === currentPage ? '1px solid var(--crimson)' : '1px solid var(--border-light)', width: 26, height: 26, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 12, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800 }}
                        >
                          {p}
                        </button>
                      </div>
                    ))}
                  </div>
                  <button
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(c => c + 1)}
                    style={{ background: '#FFFFFF', border: '1px solid var(--border-light)', padding: '4px 10px', borderRadius: 4, cursor: currentPage === totalPages ? 'not-allowed' : 'pointer', opacity: currentPage === totalPages ? 0.5 : 1, fontSize: 12, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700 }}
                  >
                    NEXT
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ══════════════════════════════════════════
           RIGHT COLUMN: Auction Controls & Live Bids
        ══════════════════════════════════════════ */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* AUCTION CONTROLS CARD */}
          <div style={{ background: '#FFFFFF', border: '1px solid var(--border-light)', borderRadius: 6, padding: 16, boxShadow: 'var(--shadow-sm)' }}>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 14, letterSpacing: 2, color: 'var(--text-dark)', textTransform: 'uppercase', marginBottom: 12 }}>
              AUCTION CONTROL
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
              {(auctionStatus === 'DRAFT' || auctionStatus === 'READY' || auctionStatus === 'SCHEDULED') && (
                <button
                  onClick={startAuction}
                  style={{ gridColumn: '1 / -1', background: 'var(--crimson)', color: '#FFFFFF', border: 'none', padding: '10px', borderRadius: 4, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 14, cursor: 'pointer', letterSpacing: 1.5, textTransform: 'uppercase' }}
                >
                  START AUCTION
                </button>
              )}

              {auctionStatus === 'LIVE' && (
                <button
                  onClick={pauseAuction}
                  style={{ background: '#F59E0B', color: '#FFFFFF', border: 'none', padding: '8px', borderRadius: 4, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 13, cursor: 'pointer', letterSpacing: 1 }}
                >
                  PAUSE AUCTION
                </button>
              )}

              {auctionStatus === 'PAUSED' && (
                <button
                  onClick={resumeAuction}
                  style={{ background: 'var(--green)', color: '#FFFFFF', border: 'none', padding: '8px', borderRadius: 4, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 13, cursor: 'pointer', letterSpacing: 1 }}
                >
                  RESUME AUCTION
                </button>
              )}

              <button
                onClick={() => startPlayer('random')}
                disabled={waitingPlayers.length === 0 || !!currentPlayer}
                style={{ background: '#1E293B', color: '#FFFFFF', border: 'none', padding: '8px', borderRadius: 4, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 12, cursor: 'pointer', letterSpacing: 1, opacity: (waitingPlayers.length === 0 || !!currentPlayer) ? 0.5 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}
              >
                <Shuffle size={12} /> DRAW NEXT
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
              <button
                onClick={forceSold}
                disabled={!highestBidder || !currentPlayer}
                style={{ background: 'var(--green)', color: '#FFFFFF', border: 'none', padding: '10px', borderRadius: 4, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 13, cursor: 'pointer', letterSpacing: 1, opacity: (!highestBidder || !currentPlayer) ? 0.4 : 1 }}
              >
                MARK SOLD
              </button>
              <button
                onClick={forceUnsold}
                disabled={!currentPlayer}
                style={{ background: '#64748B', color: '#FFFFFF', border: 'none', padding: '10px', borderRadius: 4, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 13, cursor: 'pointer', letterSpacing: 1, opacity: !currentPlayer ? 0.4 : 1 }}
              >
                MARK UNSOLD
              </button>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={extendTimer}
                disabled={auctionStatus !== 'LIVE'}
                style={{ flex: 1, background: '#F8F9FD', border: '1px solid var(--border-light)', color: 'var(--text-dark)', padding: '6px', borderRadius: 4, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 11, cursor: 'pointer', letterSpacing: 1 }}
              >
                +10 SEC TIMER
              </button>
              <button
                onClick={completeAuction}
                style={{ background: 'transparent', border: '1px solid var(--border-crimson)', color: 'var(--crimson)', padding: '6px 10px', borderRadius: 4, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 11, cursor: 'pointer', letterSpacing: 1 }}
              >
                END AUCTION
              </button>
            </div>
          </div>

          {/* ADMIN TIMER DISPLAY CARD */}
          <div style={{ background: '#FFFFFF', border: '1px solid var(--border-light)', borderRadius: 6, padding: 16, boxShadow: 'var(--shadow-sm)', textAlign: 'center' }}>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 11, letterSpacing: 2, color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: 4 }}>
              TIME LEFT
            </div>
            <div style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              fontWeight: 900,
              fontSize: 52,
              lineHeight: 1,
              letterSpacing: 2,
              color: isUrgent ? 'var(--red)' : isWarning ? '#F59E0B' : 'var(--text-dark)',
              textShadow: isUrgent ? '0 0 12px rgba(239,68,68,0.3)' : 'none'
            }}>
              {auctionStatus === 'PAUSED' ? 'PAUSED' : formatTime(timeRemaining)}
            </div>
            <div style={{ marginTop: 6, display: 'flex', justifyContent: 'center', gap: 4 }}>
              <div style={{ width: '33%', height: 4, borderRadius: 2, background: auctionStatus === 'LIVE' ? 'var(--green)' : '#CBD5E1' }} />
              <div style={{ width: '33%', height: 4, borderRadius: 2, background: isWarning || isUrgent ? '#F59E0B' : '#CBD5E1' }} />
              <div style={{ width: '33%', height: 4, borderRadius: 2, background: isUrgent ? 'var(--red)' : '#CBD5E1' }} />
            </div>
          </div>

          {/* ADMIN BID INFORMATION CARD */}
          <div style={{ background: '#F8F9FD', border: '1px solid var(--border-light)', borderRadius: 6, padding: 14 }}>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 11, letterSpacing: 2, color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: 8 }}>
              BID STATE INFORMATION
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: 12 }}>
              <div>
                <div style={{ color: 'var(--text-faint)', fontSize: 10, fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: 1 }}>CURRENT BID</div>
                <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 18, color: 'var(--crimson)' }}>Qc {currentBid.toLocaleString()}</div>
              </div>
              <div>
                <div style={{ color: 'var(--text-faint)', fontSize: 10, fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: 1 }}>LAST BID</div>
                <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 16 }}>Qc {lastBidAmount.toLocaleString()}</div>
              </div>
              <div>
                <div style={{ color: 'var(--text-faint)', fontSize: 10, fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: 1 }}>LEADING TEAM</div>
                <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 14, color: 'var(--text-dark)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                  {highestBidderTeam?.name || '—'}
                </div>
              </div>
              <div>
                <div style={{ color: 'var(--text-faint)', fontSize: 10, fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: 1 }}>BID INCREMENT</div>
                <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 14 }}>Qc {bidIncrement.toLocaleString()}</div>
              </div>
            </div>
          </div>

          {/* LIVE BID HISTORY CARD */}
          <div style={{ background: '#FFFFFF', border: '1px solid var(--border-light)', borderRadius: 6, padding: 14, boxShadow: 'var(--shadow-sm)', flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 13, letterSpacing: 2, color: 'var(--text-dark)', textTransform: 'uppercase', marginBottom: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>LIVE BID HISTORY</span>
              <span style={{ fontSize: 10, color: 'var(--text-faint)', fontWeight: 700 }}>{recentBids.length} BIDS</span>
            </div>

            <div style={{ overflowY: 'auto', flex: 1, maxHeight: 180, paddingRight: 4 }}>
              {recentBids.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-faint)', fontSize: 12, fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: 1 }}>
                  Awaiting bids...
                </div>
              ) : (
                recentBids.map((b, i) => {
                  const team = teams.find(t => t.id === b.teamId);
                  return (
                    <div key={b.id || i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 8px', borderBottom: '1px solid #F1F5F9', fontSize: 12, background: i === 0 ? '#FFF0F3' : 'transparent' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                        <TeamLogo logoUrl={team?.logoUrl} name={team?.name || b.teamName} size={18} />
                        <span style={{ fontWeight: 700, color: 'var(--text-dark)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{team?.name || b.teamName}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, color: i === 0 ? 'var(--crimson)' : 'var(--text-secondary)' }}>
                          Qc {Number(b.amount || 0).toLocaleString()}
                        </span>
                        <span style={{ fontSize: 9, color: 'var(--text-faint)', width: 36, textAlign: 'right' }}>{timeAgo(b.createdAt)}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── SAFETY CONFIRMATION MODAL ── */}
      {confirmAction && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999, padding: 16 }}>
          <div style={{ background: '#FFFFFF', borderRadius: 8, borderTop: '4px solid var(--crimson)', maxWidth: 440, width: '100%', padding: 24, boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--crimson)', marginBottom: 12 }}>
              <ShieldAlert size={22} />
              <h3 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 20, letterSpacing: 1.5, margin: 0, textTransform: 'uppercase' }}>
                {confirmAction.title || 'CONFIRM ACTION'}
              </h3>
            </div>

            {confirmAction.player && (
              <div style={{ background: '#F8F9FD', padding: 12, borderRadius: 6, border: '1px solid var(--border-light)', marginBottom: 14 }}>
                <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 16, color: 'var(--text-dark)' }}>{confirmAction.player}</div>
                {confirmAction.bid && (
                  <div style={{ fontSize: 13, color: 'var(--crimson)', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, marginTop: 4 }}>
                    WINNING BID: Qc {Number(confirmAction.bid).toLocaleString()} ({confirmAction.team || 'Leading Team'})
                  </div>
                )}
              </div>
            )}

            <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 20 }}>
              {confirmAction.msg}
            </p>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setConfirmAction(null)}
                style={{ background: '#F1F5F9', border: '1px solid var(--border-light)', color: 'var(--text-dark)', padding: '8px 16px', borderRadius: 4, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 13, cursor: 'pointer', letterSpacing: 1 }}
              >
                CANCEL
              </button>
              <button
                onClick={async () => {
                  const fn = confirmAction.fn;
                  setConfirmAction(null);
                  await fn();
                  loadBase();
                }}
                style={{ background: 'var(--crimson)', border: 'none', color: '#FFFFFF', padding: '8px 20px', borderRadius: 4, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 13, cursor: 'pointer', letterSpacing: 1, textTransform: 'uppercase' }}
              >
                CONFIRM
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── SOLD/UNSOLD OVERLAY ── */}
      {soldOverlay && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#FFFFFF', padding: 36, borderRadius: 8, textAlign: 'center', borderTop: `6px solid ${soldOverlay.type === 'SOLD' ? 'var(--green)' : 'var(--text-dim)'}`, minWidth: 340 }}>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 48, color: soldOverlay.type === 'SOLD' ? 'var(--green)' : 'var(--text-dim)', letterSpacing: 3, textTransform: 'uppercase', lineHeight: 1 }}>
              {soldOverlay.type}
            </div>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 24, color: 'var(--text-dark)', margin: '12px 0 6px' }}>
              {soldOverlay.player?.name}
            </div>
            {soldOverlay.type === 'SOLD' && (
              <>
                <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 32, color: 'var(--crimson)' }}>
                  Qc {Number(soldOverlay.price || 0).toLocaleString()}
                </div>
                <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 16, color: 'var(--text-secondary)', marginTop: 4 }}>
                  SOLD TO {soldOverlay.team?.name}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminLiveAuction() {
  const { id } = useParams();
  return (
    <AuctionProvider auctionId={id}>
      <LiveControl auctionId={id} />
    </AuctionProvider>
  );
}
