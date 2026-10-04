import { useEffect, useState, useRef, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { api, getImageUrl, formatTime, timeAgo } from '../../utils/api';
import PlayerAvatar from '../../components/PlayerAvatar';
import { Shield, Zap, TrendingUp, AlertTriangle, CheckCircle, Clock } from 'lucide-react';

function TeamLogo({ logoUrl, name, size = 26 }) {
  const src = logoUrl ? getImageUrl(logoUrl) : null;
  const initials = (name || '?').slice(0, 2).toUpperCase();
  if (src) {
    return (
      <img
        src={src}
        alt={name}
        style={{ width: size, height: size, objectFit: 'contain', borderRadius: 4, background: '#F1F5F9', border: '1px solid #E2E8F0', flexShrink: 0 }}
        onError={e => { e.target.style.display = 'none'; }}
      />
    );
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: 4,
      background: 'rgba(196,18,48,0.1)', border: '1px solid var(--border-crimson)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'Barlow Condensed', sans-serif",
      fontWeight: 800, fontSize: Math.max(10, Math.round(size * 0.4)),
      color: 'var(--crimson)', flexShrink: 0,
    }}>
      {initials}
    </div>
  );
}

export default function CaptainLive() {
  const { user, logout } = useAuth();
  const { socket, connected, getServerTime } = useSocket();

  const [snapshot, setSnapshot] = useState(null);
  const [myTeam, setMyTeam] = useState(null);
  const [recentBids, setRecentBids] = useState([]);
  const [bidState, setBidState] = useState('idle');
  const [bidError, setBidError] = useState('');
  const [customIncrement, setCustomIncrement] = useState('');
  const [showCustom, setShowCustom] = useState(false);
  const [soldOverlay, setSoldOverlay] = useState(null);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [loading, setLoading] = useState(true);
  const [bidFlash, setBidFlash] = useState(false);
  const [liveBid, setLiveBid] = useState(null);

  const timerRef = useRef();
  const sequenceRef = useRef(0);
  const bidToastTimerRef = useRef(null);

  const triggerBidToast = useCallback((data) => {
    const teamName = data?.highestBidderName || data?.bid?.teamName || 'TEAM';
    const amount = Number(data?.currentBid ?? data?.bid?.amount ?? 0);
    const toastKind = data?.highestBidder === myTeam?.id ? 'YOUR BID' : data?.highestBidder ? 'OUTBID' : 'NEW BID';

    setLiveBid({ teamName, amount, kind: toastKind });
    if (bidToastTimerRef.current) clearTimeout(bidToastTimerRef.current);
    bidToastTimerRef.current = setTimeout(() => setLiveBid(null), 1800);
  }, [myTeam?.id]);

  const loadState = useCallback(async () => {
    try {
      const [auctRes, usersRes] = await Promise.all([
        api.get('/auctions'),
        api.get('/users')
      ]);
      const auctions = auctRes.data;
      const liveAuction = auctions.find(a => a.status === 'LIVE' || a.status === 'SCHEDULED' || a.status === 'READY') || auctions[0];
      if (!liveAuction) { setLoading(false); return; }

      const teamsRes = await api.get(`/auctions/${liveAuction.id}/teams`);
      const team = teamsRes.data.find(t => t.captainId === user?.id) ||
        teamsRes.data.find(t => t.captainId && usersRes.data.find(u => u.id === t.captainId && u.email === user?.email));

      setMyTeam(team);
      const snapRes = await api.get(`/auctions/${liveAuction.id}/snapshot`);
      if (snapRes.data) {
        setSnapshot(snapRes.data);
        setRecentBids(snapRes.data.recentBids || []);
        if (snapRes.data.sequence) sequenceRef.current = snapRes.data.sequence;
      }
      setLoading(false);
      if (socket) socket.emit('JOIN_AUCTION', { auctionId: liveAuction.id });
    } catch (err) {
      console.error('Failed to load captain state:', err);
      setLoading(false);
    }
  }, [user, socket]);

  useEffect(() => { loadState(); }, [loadState]);

  useEffect(() => {
    if (connected && snapshot?.auction?.id) loadState();
  }, [connected, snapshot?.auction?.id, loadState]);

  useEffect(() => {
    if (!socket) return;

    const checkSeq = (seq) => {
      if (seq?.auctionId && seq.auctionId !== snapshot?.auction?.id) return false;
      const sequence = typeof seq === 'object' ? seq.sequence : seq;
      if (sequence && sequence < sequenceRef.current) return false;
      if (sequence) sequenceRef.current = sequence;
      return true;
    };

    const handleState = (data) => {
      if (!checkSeq(data)) return;
      setSnapshot(data);
      setRecentBids(data.recentBids || []);
      if (data.teams && myTeam) {
        const updated = data.teams.find(t => t.id === myTeam.id);
        if (updated) setMyTeam(updated);
      }
    };

    const handleBid = (data) => {
      if (!checkSeq(data)) return;
      setBidFlash(true);
      triggerBidToast(data);
      setTimeout(() => setBidFlash(false), 600);
      setSnapshot(prev => prev ? {
        ...prev, currentBid: data.currentBid, highestBidder: data.highestBidder,
        highestBidderName: data.highestBidderName, endsAt: data.endsAt, bidEndsAt: data.bidEndsAt
      } : prev);
      setRecentBids(prev => [{
        ...data.bid, teamName: data.highestBidderName, createdAt: data.bid?.createdAt || Date.now()
      }, ...prev].slice(0, 10));
    };

    const handlePlayerStarted = (data) => {
      if (!checkSeq(data)) return;
      setRecentBids([]);
      setBidState('idle');
      setBidError('');
      setShowCustom(false);
      setSnapshot(prev => prev ? {
        ...prev, status: 'LIVE', currentPlayer: data.player, currentBid: data.currentBid,
        highestBidder: null, highestBidderName: null, endsAt: data.endsAt, bidEndsAt: data.bidEndsAt
      } : prev);
    };

    const handleSold = (data) => {
      if (!checkSeq(data)) return;
      setSoldOverlay({ type: 'SOLD', player: data.player, team: data.team, price: data.finalPrice });
      setSnapshot(prev => prev ? {
        ...prev, status: 'SOLD', teams: prev.teams?.map(t => t.id === data.team?.id ? data.team : t)
      } : prev);
      if (data.team?.id === myTeam?.id) setMyTeam(data.team);
      setTimeout(() => setSoldOverlay(null), 4000);
    };

    const handleUnsold = (data) => {
      if (!checkSeq(data)) return;
      setSoldOverlay({ type: 'UNSOLD', player: data.player });
      setTimeout(() => setSoldOverlay(null), 2500);
    };

    const handleReady = (data) => {
      if (!checkSeq(data)) return;
      setSnapshot(prev => prev ? { ...prev, status: 'READY', currentPlayer: null, currentBid: 0, highestBidder: null, endsAt: null } : prev);
      setBidState('idle');
    };

    const handlePaused = (data) => {
      if (!checkSeq(data)) return;
      setSnapshot(prev => prev ? { ...prev, status: 'PAUSED' } : prev);
    };

    const handleResumed = (d) => {
      if (!checkSeq(d)) return;
      setSnapshot(prev => prev ? { ...prev, status: 'LIVE', endsAt: d.endsAt, bidEndsAt: d.bidEndsAt } : prev);
    };

    const handleCompleted = (data) => {
      if (!checkSeq(data)) return;
      setSnapshot(prev => prev ? { ...prev, status: 'COMPLETED' } : prev);
    };

    socket.on('AUCTION_STATE', handleState);
    socket.on('BID_PLACED', handleBid);
    socket.on('PLAYER_STARTED', handlePlayerStarted);
    socket.on('PLAYER_SOLD', handleSold);
    socket.on('PLAYER_UNSOLD', handleUnsold);
    socket.on('AUCTION_READY', handleReady);
    socket.on('AUCTION_PAUSED', handlePaused);
    socket.on('AUCTION_RESUMED', handleResumed);
    socket.on('AUCTION_COMPLETED', handleCompleted);

    return () => {
      socket.off('AUCTION_STATE', handleState);
      socket.off('BID_PLACED', handleBid);
      socket.off('PLAYER_STARTED', handlePlayerStarted);
      socket.off('PLAYER_SOLD', handleSold);
      socket.off('PLAYER_UNSOLD', handleUnsold);
      socket.off('AUCTION_READY', handleReady);
      socket.off('AUCTION_PAUSED', handlePaused);
      socket.off('AUCTION_RESUMED', handleResumed);
      socket.off('AUCTION_COMPLETED', handleCompleted);
    };
  }, [socket, myTeam, snapshot?.auction?.id, triggerBidToast]);

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

  const placeBid = async (increment) => {
    if (!snapshot?.currentPlayer || !myTeam) return;
    if (!connected) { setBidError('No connection to live server.'); return; }

    const numericIncrement = Number(increment);
    if (!Number.isSafeInteger(numericIncrement) || numericIncrement <= 0) {
      setBidError('Enter a positive whole-number increment.');
      return;
    }
    const targetBid = Number(snapshot.currentBid || 0) + numericIncrement;
    if (myTeam.remainingBudget < targetBid) {
      setBidError(`Insufficient budget! Max available: Qc ${myTeam.remainingBudget.toLocaleString()}`);
      return;
    }

    setBidState('bidding');
    setBidError('');
    const requestId = `bid-${myTeam.id}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    try {
      const response = await api.post(`/auctions/${snapshot.auction?.id}/bid`, {
        teamId: myTeam.id,
        increment: numericIncrement,
        amount: targetBid,
        requestId
      });
      const acceptedAmount = Number(response.data?.bid?.amount);
      if (Number.isSafeInteger(acceptedAmount)) {
        setSnapshot(prev => prev ? {
          ...prev,
          currentBid: acceptedAmount,
          highestBidder: myTeam.id,
          highestBidderName: myTeam.name
        } : prev);
      }
      setBidState('accepted');
      setCustomIncrement('');
      setShowCustom(false);
      setTimeout(() => setBidState('idle'), 2500);
    } catch (err) {
      const msg = err.response?.data?.error || 'Bid failed. Please try again.';
      setBidError(msg);
      setBidState('error');
      setTimeout(() => setBidState('idle'), 3000);
    }
  };

  const currentPlayer = snapshot?.currentPlayer;
  const currentBid = Number(snapshot?.currentBid || 0);
  const highestBidder = snapshot?.highestBidder;
  const auctionStatus = snapshot?.status || 'DRAFT';
  const teams = snapshot?.teams || [];

  const otherTeams = teams.filter(t => t.id !== myTeam?.id);
  const iAmHighest = myTeam && highestBidder === myTeam.id;
  const isLive = auctionStatus === 'LIVE';

  const secRemaining = Math.ceil(timeRemaining / 1000);
  const isUrgent = secRemaining <= 5 && secRemaining > 0 && isLive;
  const isWarning = secRemaining <= 10 && secRemaining > 5 && isLive;

  const maxSquad = snapshot?.auction?.maxSquadSize || 11;
  const myPlayers = myTeam?.players || [];
  const playersBoughtCount = myPlayers.length;
  const slotsRemaining = Math.max(0, maxSquad - playersBoughtCount);
  const totalSpent = (myTeam?.initialBudget || 100000) - (myTeam?.remainingBudget || 100000);

  // Calculate Max Safe Bid
  // Max Safe Bid = remainingBudget - (remainingRequiredSlots * minBasePrice)
  const minBasePrice = 50;
  const safeReserve = Math.max(0, (slotsRemaining - 1)) * minBasePrice;
  const maxSafeBid = Math.max(0, (myTeam?.remainingBudget || 0) - safeReserve);

  const highestBidderTeam = teams.find(t => t.id === highestBidder);

  let disableReason = '';
  if (!isLive) disableReason = `AUCTION ${auctionStatus}`;
  else if (!connected) disableReason = 'RECONNECTING...';
  else if (!currentPlayer) disableReason = 'NO ACTIVE PLAYER';
  else if (iAmHighest) disableReason = 'YOU ARE LEADING';
  else if (slotsRemaining <= 0) disableReason = 'MAX SQUAD REACHED';

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#F4F5F8' }}>
      <div style={{ textAlign: 'center' }}>
        <div className="spinner" style={{ margin: '0 auto 14px' }} />
        <div style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--crimson)', letterSpacing: 3, fontWeight: 800, fontSize: 13 }}>CONNECTING TO CAPTAIN DESK...</div>
      </div>
    </div>
  );

  return (
    <div className="vc-root vc-body vc-captain-live" style={{ height: '100vh', minHeight: '100vh', overflow: 'hidden' }}>
      {liveBid && (
        <div className="live-bid-toast visible" aria-live="polite">
          <div className="live-bid-toast-label">{liveBid.kind}</div>
          <div className="live-bid-toast-team">{liveBid.teamName}</div>
          <div className="live-bid-toast-amount">Qc {liveBid.amount.toLocaleString()}</div>
        </div>
      )}
      {/* ── TOP HEADER ── */}
      <header className="vc-header" style={{ background: '#FFFFFF', borderBottom: '2px solid var(--crimson)', height: 64, padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', sticky: 'top', zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ background: 'transparent', padding: '6px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 18, color: 'var(--text-dark)', letterSpacing: 2 }}>VALOR CUP</span>
            <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 11, color: 'var(--crimson)', letterSpacing: 1.5, background: 'rgba(196,18,48,0.1)', padding: '2px 6px', borderRadius: 3 }}>2026</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ background: isLive ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)', color: isLive ? 'var(--green)' : '#D97706', border: `1px solid ${isLive ? 'rgba(16,185,129,0.3)' : 'rgba(245,158,11,0.3)'}`, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 11, padding: '2px 8px', borderRadius: 3, letterSpacing: 1.5 }}>
              ● {auctionStatus}
            </span>
          </div>
        </div>

        {/* Center: Timer readout */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#F8F9FD', border: '1px solid var(--border-light)', padding: '4px 16px', borderRadius: 4 }}>
          <Clock size={16} color={isUrgent ? 'var(--red)' : 'var(--crimson)'} />
          <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 11, color: 'var(--text-dim)', letterSpacing: 1.5 }}>TIME LEFT:</span>
          <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 24, letterSpacing: 1.5, color: isUrgent ? 'var(--red)' : isWarning ? '#F59E0B' : 'var(--text-dark)' }}>
            {formatTime(timeRemaining)}
          </span>
        </div>

        {/* Right: Captain identity + Logout */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {myTeam && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <TeamLogo logoUrl={myTeam.logoUrl} name={myTeam.name} size={28} />
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 14, color: 'var(--text-dark)', lineHeight: 1 }}>{myTeam.name}</span>
                <span style={{ fontSize: 10, color: 'var(--text-faint)' }}>CAPTAIN: {user?.name || 'LOGGED IN'}</span>
              </div>
            </div>
          )}
          <button onClick={logout} style={{ background: 'transparent', border: '1px solid var(--border-subtle)', color: 'var(--text-dim)', padding: '4px 10px', borderRadius: 4, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 11, cursor: 'pointer', letterSpacing: 1 }}>
            LOGOUT
          </button>
        </div>
      </header>

      {/* Error / Notification Banner */}
      {bidError && (
        <div style={{ padding: '10px 24px', background: '#FEE2E2', borderBottom: '1px solid #FCA5A5', display: 'flex', alignItems: 'center', gap: 10, color: '#991B1B' }}>
          <AlertTriangle size={16} />
          <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 13, letterSpacing: 1 }}>{bidError}</span>
          <button onClick={() => setBidError('')} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#991B1B', cursor: 'pointer', fontSize: 18, fontWeight: 800 }}>×</button>
        </div>
      )}

      {/* ── THREE COLUMN MAIN BODY ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '280px minmax(0, 1fr) 310px', gap: 16, padding: 16, maxWidth: 1800, margin: '0 auto', width: '100%', flex: 1, minHeight: 0, height: 'calc(100vh - 64px - 90px)' }}>

        {/* ══════════════════════════════════════════
           LEFT COLUMN: Timer & Other Team Stats
        ══════════════════════════════════════════ */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* TIMER CARD */}
          <div style={{ background: '#FFFFFF', border: '1px solid var(--border-light)', borderRadius: 6, padding: 16, textAlign: 'center', boxShadow: 'var(--shadow-sm)', borderTop: `4px solid ${isUrgent ? 'var(--red)' : isWarning ? '#F59E0B' : 'var(--crimson)'}` }}>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 11, letterSpacing: 2, color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: 4 }}>
              AUCTION TIMER
            </div>
            <div style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              fontWeight: 900,
              fontSize: 48,
              lineHeight: 1,
              letterSpacing: 2,
              color: isUrgent ? 'var(--red)' : isWarning ? '#F59E0B' : 'var(--text-dark)'
            }}>
              {isLive ? formatTime(timeRemaining) : auctionStatus}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 4, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700 }}>
              {isUrgent ? 'FINAL SECONDS!' : isWarning ? 'CLOSING SOON' : 'LIVE BIDDING IN PROGRESS'}
            </div>
          </div>

          {/* OTHER TEAMS STATS CARD */}
          <div style={{ background: '#FFFFFF', border: '1px solid var(--border-light)', borderRadius: 6, padding: 16, boxShadow: 'var(--shadow-sm)', flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 14, letterSpacing: 2, color: 'var(--text-dark)', textTransform: 'uppercase', marginBottom: 12 }}>
              OTHER TEAM STATS
            </div>

            <div style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 480 }}>
              {otherTeams.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--text-faint)', fontSize: 12, padding: 20 }}>No other teams configured.</div>
              ) : (
                otherTeams.map(t => {
                  const pCount = (t.players || []).length;
                  const isLeading = t.id === highestBidder;
                  return (
                    <div key={t.id} style={{
                      padding: 10, borderRadius: 6, border: `1px solid ${isLeading ? 'var(--border-crimson)' : 'var(--border-light)'}`,
                      background: isLeading ? '#FFF0F3' : '#F8F9FD', display: 'flex', alignItems: 'center', gap: 10
                    }}>
                      <TeamLogo logoUrl={t.logoUrl} name={t.name} size={30} />
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 13, color: 'var(--text-dark)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                          {t.name}
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--text-faint)', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700 }}>
                          {pCount} / {maxSquad} PLAYERS
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 9, color: 'var(--text-faint)', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700 }}>QC LEFT</div>
                        <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 13, color: 'var(--crimson)' }}>
                          {(t.remainingBudget || 0).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════════
           CENTER COLUMN: Premium Player Profile Card
        ══════════════════════════════════════════ */}
        <div style={{ background: '#FFFFFF', border: '1px solid var(--border-light)', borderRadius: 8, padding: 22, boxShadow: 'var(--shadow-sm)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', overflowY: 'auto' }}>

          {currentPlayer ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Player Top Banner: Badges & Lot */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #E2E8F0', paddingBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ background: 'var(--navy)', color: '#FFFFFF', padding: '3px 10px', borderRadius: 4, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 13, letterSpacing: 1 }}>
                    REG. ID {currentPlayer.registrationId || currentPlayer.registration_id || `#P-${String(currentPlayer.auctionOrder || 1).padStart(2,'0')}`}
                  </span>
                  <span style={{ background: 'var(--crimson)', color: '#FFFFFF', padding: '3px 10px', borderRadius: 4, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 13, letterSpacing: 1 }}>
                    {currentPlayer.category || 'Category A'}
                  </span>
                  <span style={{
                    background: (currentPlayer.playerType || currentPlayer.player_type || '').toUpperCase() === 'RETURNING' ? 'rgba(246,165,26,0.15)' : 'rgba(59,130,246,0.15)',
                    color: (currentPlayer.playerType || currentPlayer.player_type || '').toUpperCase() === 'RETURNING' ? 'var(--orange)' : '#3B82F6',
                    padding: '3px 10px', borderRadius: 4, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 13, letterSpacing: 1
                  }}>
                    {(currentPlayer.playerType || currentPlayer.player_type || '').toUpperCase() === 'RETURNING' ? 'RETURNING' : 'NEW'}
                  </span>
                  {currentPlayer.isHighlighted && (
                    <span style={{ background: 'rgba(236,72,153,0.15)', color: '#EC4899', padding: '3px 10px', borderRadius: 4, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 13, letterSpacing: 1 }}>
                      ⭐ FEATURED
                    </span>
                  )}
                </div>

                <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 12, color: 'var(--text-dim)', letterSpacing: 1 }}>
                  AUCTION POOL · LOT #{String(currentPlayer.auctionOrder || 1).padStart(3,'0')}
                </div>
              </div>

              {/* Player Portrait & Main Hero Section */}
              <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: 20, alignItems: 'center' }}>
                {/* Large Clean Portrait Area */}
                <div style={{ position: 'relative', width: 180, height: 210, borderRadius: 8, overflow: 'hidden', border: '2px solid var(--border-light)', background: '#F8F9FD', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.06)' }}>
                  <PlayerAvatar player={currentPlayer} size={180} borderRadius={6} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  <div style={{ position: 'absolute', bottom: 6, left: 6, background: 'rgba(15,35,62,0.85)', color: '#FFF', padding: '2px 8px', borderRadius: 4, fontSize: 10, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, letterSpacing: 1 }}>
                    VALOR CUP 2026
                  </div>
                </div>

                {/* Player Name & Headline Metrics */}
                <div>
                  <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 36, color: 'var(--text-dark)', textTransform: 'uppercase', lineHeight: 1.1, letterSpacing: 0.5, marginBottom: 6 }}>
                    {currentPlayer.fullName || currentPlayer.full_name || currentPlayer.name}
                  </div>
                  <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 13, color: 'var(--crimson)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 14 }}>
                    {currentPlayer.category || 'Category A'} · {currentPlayer.playerType || 'Player'} {currentPlayer.scoreOutOf5 ? `· ⭐ SCORE: ${Number(currentPlayer.scoreOutOf5).toFixed(1)} / 5.0` : ''}
                  </div>

                  {/* Primary Key Metrics Grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, background: '#F8F9FD', padding: 12, borderRadius: 6, border: '1px solid var(--border-light)' }}>
                    <div>
                      <div style={{ fontSize: 9, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, color: 'var(--text-faint)', letterSpacing: 1 }}>BASE PRICE</div>
                      <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 18, color: 'var(--text-dark)' }}>
                        Qc {(currentPlayer.basePrice || currentPlayer.base_price || 100).toLocaleString()}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 9, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, color: 'var(--text-faint)', letterSpacing: 1 }}>LAST YEAR PRICE</div>
                      <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 18, color: currentPlayer.lastYearPrice ? 'var(--orange)' : 'var(--text-muted)' }}>
                        {currentPlayer.lastYearPrice ? `Qc ${Number(currentPlayer.lastYearPrice).toLocaleString()}` : '—'}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 9, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, color: 'var(--text-faint)', letterSpacing: 1 }}>SCORE / 5</div>
                      <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 18, color: 'var(--green)' }}>
                        ⭐ {currentPlayer.scoreOutOf5 ? Number(currentPlayer.scoreOutOf5).toFixed(1) : (currentPlayer.overallRating ? (currentPlayer.overallRating / 20).toFixed(1) : '3.8')}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 9, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, color: 'var(--text-faint)', letterSpacing: 1 }}>X-FACTOR</div>
                      <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 14, color: 'var(--crimson)' }}>
                        {currentPlayer.xFactor || currentPlayer.xfactor || 'Clutch'}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 9, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, color: 'var(--text-faint)', letterSpacing: 1 }}>EXPERIENCE</div>
                      <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 14, color: 'var(--text-dark)' }}>
                        {currentPlayer.experience || '2 Seasons'}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 9, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, color: 'var(--text-faint)', letterSpacing: 1 }}>CURRENT STATUS</div>
                      <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 14, color: 'var(--green)' }}>
                        LIVE BIDDING
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Compact Player Insights Strip */}
              {(currentPlayer.speciality || currentPlayer.xFactor || currentPlayer.bio || currentPlayer.highlightReason) && (
                <div style={{ background: '#F1F5F9', border: '1px solid #E2E8F0', borderRadius: 6, padding: '10px 14px' }}>
                  <div style={{ fontSize: 10, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, color: 'var(--text-dim)', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 4 }}>
                    PLAYER INSIGHTS & SPECIAL SKILLS
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-dark)', lineHeight: 1.4 }}>
                    {currentPlayer.highlightReason ? (
                      <span style={{ color: 'var(--crimson)', fontWeight: 700 }}>• {currentPlayer.highlightReason} </span>
                    ) : null}
                    {currentPlayer.speciality ? (
                      <span>• <strong>Speciality:</strong> {currentPlayer.speciality} </span>
                    ) : null}
                    {currentPlayer.bio ? (
                      <span>• {currentPlayer.bio}</span>
                    ) : null}
                  </div>
                </div>
              )}

              {/* Auction Decision Quick Reference */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, background: '#FFF8F0', border: '1px solid #FED7AA', borderRadius: 6, padding: '10px 12px', textAlign: 'center' }}>
                <div>
                  <div style={{ fontSize: 9, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, color: '#C2410C' }}>CURRENT BID</div>
                  <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 18, color: 'var(--crimson)' }}>
                    Qc {currentBid.toLocaleString()}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 9, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, color: '#C2410C' }}>YOUR BUDGET</div>
                  <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 18, color: '#4F46E5' }}>
                    Qc {(myTeam?.remainingBudget || 0).toLocaleString()}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 9, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, color: '#C2410C' }}>MAX SAFE BID</div>
                  <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 18, color: 'var(--green)' }}>
                    Qc {maxSafeBid.toLocaleString()}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 9, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, color: '#C2410C' }}>NEXT MIN BID</div>
                  <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 18, color: 'var(--text-dark)' }}>
                    Qc {(currentBid + 10).toLocaleString()}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ padding: '60px 20px', textAlign: 'center', background: '#F8F9FD', borderRadius: 6, border: '1px dashed var(--border-subtle)', margin: 'auto 0' }}>
              <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 22, color: 'var(--text-dim)', letterSpacing: 2, textTransform: 'uppercase' }}>
                {isLive ? 'WAITING FOR NEXT PLAYER' : `AUCTION IS ${auctionStatus}`}
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-faint)', marginTop: 6 }}>
                The auctioneer will load the next player shortly. Prepare your budget!
              </div>
            </div>
          )}
        </div>

        {/* ══════════════════════════════════════════
           RIGHT COLUMN: My Team Budget & History
        ══════════════════════════════════════════ */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* MY TEAM BUDGET CARD */}
          <div style={{ background: '#FFFFFF', border: '1px solid var(--border-light)', borderRadius: 6, padding: 16, boxShadow: 'var(--shadow-sm)', borderTop: '4px solid var(--crimson)' }}>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 14, letterSpacing: 2, color: 'var(--text-dark)', textTransform: 'uppercase', marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>YOUR TEAM BUDGET</span>
              <span style={{ fontSize: 11, color: 'var(--crimson)', fontWeight: 800 }}>{myTeam?.name || 'MY TEAM'}</span>
            </div>

            <div style={{ background: '#FFFFFF', padding: '12px 14px', borderRadius: 8, border: '1px solid var(--border-light)', color: 'var(--text-dark)', marginBottom: 12, boxShadow: '0 4px 15px rgba(0,0,0,0.03)' }}>
              <div style={{ fontSize: 10, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, color: 'var(--text-faint)', letterSpacing: 2 }}>QC LEFT</div>
              <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 28, color: '#4F46E5', letterSpacing: 1, margin: '2px 0' }}>
                Qc {(myTeam?.remainingBudget || 0).toLocaleString()}
              </div>
              <div style={{ fontSize: 10, fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--text-faint)', letterSpacing: 1 }}>
                MAX SAFE BID: Qc {maxSafeBid.toLocaleString()}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, fontSize: 11, textAlign: 'center' }}>
              <div style={{ background: '#F8F9FD', padding: 8, borderRadius: 4, border: '1px solid var(--border-light)' }}>
                <div style={{ color: 'var(--text-faint)', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700 }}>BOUGHT</div>
                <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 15, color: 'var(--text-dark)' }}>
                  {playersBoughtCount} / {maxSquad}
                </div>
              </div>
              <div style={{ background: '#F8F9FD', padding: 8, borderRadius: 4, border: '1px solid var(--border-light)' }}>
                <div style={{ color: 'var(--text-faint)', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700 }}>REMAINING</div>
                <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 15, color: 'var(--crimson)' }}>
                  {slotsRemaining} SLOTS
                </div>
              </div>
              <div style={{ background: '#F8F9FD', padding: 8, borderRadius: 4, border: '1px solid var(--border-light)' }}>
                <div style={{ color: 'var(--text-faint)', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700 }}>SPENT</div>
                <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 13, color: 'var(--text-secondary)' }}>
                  Qc {totalSpent.toLocaleString()}
                </div>
              </div>
            </div>
          </div>

          {/* PURCHASED PLAYERS HISTORY CARD */}
          <div style={{ background: '#FFFFFF', border: '1px solid var(--border-light)', borderRadius: 6, padding: 16, boxShadow: 'var(--shadow-sm)', flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 14, letterSpacing: 2, color: 'var(--text-dark)', textTransform: 'uppercase', marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>PLAYERS BOUGHT</span>
              <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-dim)' }}>{myPlayers.length} PLAYERS</span>
            </div>

            <div style={{ overflowY: 'auto', flex: 1, maxHeight: 280, paddingRight: 4 }}>
              {myPlayers.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-faint)', fontSize: 12, fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: 1 }}>
                  No players purchased yet.
                </div>
              ) : (
                myPlayers.map((p, i) => (
                  <div key={p.id || i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 8px', borderBottom: '1px solid #F1F5F9', fontSize: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                      <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, color: 'var(--text-faint)', fontSize: 11 }}>{String(i + 1).padStart(2,'0')}</span>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 700, color: 'var(--text-dark)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{p.name}</div>
                        <div style={{ fontSize: 10, color: 'var(--text-faint)', fontFamily: "'Barlow Condensed', sans-serif" }}>CAT {p.category || 'B'}</div>
                      </div>
                    </div>
                    <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, color: 'var(--crimson)', fontSize: 13 }}>
                      Qc {Number(p.soldPrice || p.currentBid || 0).toLocaleString()}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════
         BOTTOM DEDICATED BIDDING PANEL & CONTROLS
      ══════════════════════════════════════════ */}
      <div style={{ background: '#FFFFFF', borderTop: '2px solid var(--crimson)', padding: '14px 24px', boxShadow: '0 -4px 16px rgba(0,0,0,0.06)', position: 'sticky', bottom: 0, zIndex: 15 }}>
        <div style={{ maxWidth: 1800, margin: '0 auto', display: 'grid', gridTemplateColumns: '320px minmax(0, 1fr) 280px', gap: 20, alignItems: 'center' }}>

          {/* Current Bid & Leading State */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 11, letterSpacing: 2, color: 'var(--text-dim)', textTransform: 'uppercase' }}>CURRENT BID</span>
              {iAmHighest ? (
                <span style={{ background: 'rgba(16,185,129,0.12)', color: 'var(--green)', border: '1px solid rgba(16,185,129,0.3)', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 11, padding: '2px 8px', borderRadius: 3, letterSpacing: 1 }}>
                  ● YOU ARE LEADING
                </span>
              ) : highestBidderTeam ? (
                <span style={{ background: '#FFF0F3', color: 'var(--crimson)', border: '1px solid var(--border-crimson)', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 11, padding: '2px 8px', borderRadius: 3, letterSpacing: 1 }}>
                  ● YOU ARE OUTBID ({highestBidderTeam.name})
                </span>
              ) : (
                <span style={{ background: '#F8F9FD', color: 'var(--text-faint)', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 11, padding: '2px 8px', borderRadius: 3 }}>
                  NO BIDS YET
                </span>
              )}
            </div>

            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 36, color: 'var(--crimson)', lineHeight: 1 }}>
              Qc {currentBid.toLocaleString()}
            </div>
          </div>

          {/* Bid Action Buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 12, letterSpacing: 2, color: 'var(--text-dark)', textTransform: 'uppercase' }}>
                PLACE YOUR BID (QC INCREMENTS)
              </span>
              {disableReason && (
                <span style={{ background: '#FEE2E2', color: '#991B1B', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 10, padding: '2px 6px', borderRadius: 3, letterSpacing: 1 }}>
                  {disableReason}
                </span>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr) auto', gap: 10 }}>
              {[10, 25, 50, 100].map(inc => (
                <button
                  key={inc}
                  onClick={() => placeBid(inc)}
                  disabled={!!disableReason || bidState === 'bidding'}
                  style={{
                    background: (!disableReason && bidState !== 'bidding') ? 'var(--crimson)' : '#CBD5E1',
                    color: '#FFFFFF',
                    border: 'none',
                    padding: '12px 10px',
                    borderRadius: 4,
                    fontFamily: "'Barlow Condensed', sans-serif",
                    fontWeight: 900,
                    fontSize: 18,
                    cursor: (!disableReason && bidState !== 'bidding') ? 'pointer' : 'not-allowed',
                    letterSpacing: 1,
                    boxShadow: (!disableReason && bidState !== 'bidding') ? '0 2px 8px rgba(196,18,48,0.25)' : 'none',
                    transition: 'all 0.15s ease'
                  }}
                >
                  +{inc}
                </button>
              ))}

              <button
                onClick={() => setShowCustom(!showCustom)}
                disabled={!!disableReason}
                style={{ background: '#1E293B', color: '#FFFFFF', border: 'none', padding: '12px 14px', borderRadius: 4, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 13, cursor: disableReason ? 'not-allowed' : 'pointer', opacity: disableReason ? 0.5 : 1 }}
              >
                {showCustom ? 'CANCEL' : 'CUSTOM'}
              </button>
            </div>

            {/* Custom Bid Input */}
            {showCustom && (
              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <input
                  type="number"
                  placeholder="Enter custom increment..."
                  value={customIncrement}
                  onChange={e => setCustomIncrement(e.target.value)}
                  style={{ flex: 1, padding: '8px 12px', border: '1px solid var(--border-light)', borderRadius: 4, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 14 }}
                />
                <button
                  onClick={() => placeBid(customIncrement)}
                  disabled={!customIncrement || !!disableReason}
                  style={{ background: 'var(--crimson)', color: '#FFFFFF', border: 'none', padding: '8px 16px', borderRadius: 4, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 13, cursor: 'pointer' }}
                >
                  SUBMIT BID
                </button>
              </div>
            )}
          </div>

          {/* Live Bids Feed Column */}
          <div style={{ background: '#F8F9FD', border: '1px solid var(--border-light)', borderRadius: 6, padding: 8, height: 72, overflowY: 'auto' }}>
            <div style={{ fontSize: 9, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, color: 'var(--text-faint)', letterSpacing: 1.5, marginBottom: 4, textTransform: 'uppercase' }}>
              LIVE BIDDING FEED
            </div>
            {recentBids.length === 0 ? (
              <div style={{ fontSize: 11, color: 'var(--text-faint)', fontFamily: "'Barlow Condensed', sans-serif" }}>Awaiting bids...</div>
            ) : (
              recentBids.slice(0, 3).map((b, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, color: i === 0 ? 'var(--crimson)' : 'var(--text-secondary)' }}>
                  <span>{b.teamName}</span>
                  <span>Qc {Number(b.amount || 0).toLocaleString()}</span>
                </div>
              ))
            )}
          </div>

        </div>
      </div>

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
