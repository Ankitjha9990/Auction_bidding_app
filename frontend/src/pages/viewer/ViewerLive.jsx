import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useSocket } from '../../context/SocketContext';
import { api, getImageUrl, formatTime, timeAgo } from '../../utils/api';
import PlayerAvatar from '../../components/PlayerAvatar';
import TeamLogo from '../../components/TeamLogo';
import TeamSquadModal from '../../components/TeamSquadModal';
import { Radio, Clock, Trophy, Award, Activity, Smartphone, Eye } from 'lucide-react';

export default function ViewerLive() {
  const { auctionId: paramAuctionId } = useParams();
  const { socket, connected, getServerTime } = useSocket();
  const [snapshot, setSnapshot] = useState(null);
  const [recentBids, setRecentBids] = useState([]);
  const [soldOverlay, setSoldOverlay] = useState(null);
  const [selectedTeamModal, setSelectedTeamModal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [liveBid, setLiveBid] = useState(null);
  const timerRef = useRef();
  const sequenceRef = useRef(0);
  const bidToastTimerRef = useRef(null);
  const lastRecentBidRef = useRef(null);

  const triggerBidToast = (data) => {
    const teamName = data?.highestBidderName || data?.bid?.teamName || 'TEAM';
    const amount = Number(data?.currentBid ?? data?.bid?.amount ?? 0);
    setLiveBid({ teamName, amount, kind: 'NEW BID' });
    if (bidToastTimerRef.current) clearTimeout(bidToastTimerRef.current);
    bidToastTimerRef.current = setTimeout(() => setLiveBid(null), 1800);
  };

  const loadAndJoin = useCallback(async () => {
    try {
      const aRes = await api.get('/auctions');
      const auctions = aRes.data;
      const auction = paramAuctionId
        ? auctions.find(a => a.id === paramAuctionId)
        : auctions.find(a => a.status === 'LIVE' || a.status === 'SCHEDULED' || a.status === 'READY') || auctions[0];

      if (!auction) { setLoading(false); return; }

      if (socket) socket.emit('JOIN_AUCTION', { auctionId: auction.id });
      const snapRes = await api.get(`/auctions/${auction.id}/snapshot`);
      if (snapRes.data) {
        setSnapshot(snapRes.data);
        setRecentBids(snapRes.data.recentBids || []);
        if (snapRes.data.sequence) sequenceRef.current = snapRes.data.sequence;
      }
      setLoading(false);
    } catch (err) {
      console.error('Failed to load viewer state:', err);
      setLoading(false);
    }
  }, [paramAuctionId, socket]);

  useEffect(() => { loadAndJoin(); }, [loadAndJoin]);

  useEffect(() => {
    if (connected && snapshot?.auction?.id) loadAndJoin();
  }, [connected, snapshot?.auction?.id, loadAndJoin]);

  useEffect(() => {
    if (!socket) return;

    const checkSeq = (data) => {
      if (data?.auctionId && data.auctionId !== snapshot?.auction?.id) return false;
      const sequence = data?.sequence;
      if (sequence && sequence < sequenceRef.current) return false;
      if (sequence) sequenceRef.current = sequence;
      return true;
    };

    const handleState = (data) => {
      if (!checkSeq(data)) return;
      setSnapshot(data);
      setRecentBids(data.recentBids || []);
    };

    const handleBid = (data) => {
      if (!checkSeq(data)) return;
      triggerBidToast(data);
      setSnapshot(prev => prev ? {
        ...prev,
        currentBid: data.currentBid,
        highestBidder: data.highestBidder,
        highestBidderName: data.highestBidderName,
        endsAt: data.endsAt,
        bidEndsAt: data.bidEndsAt
      } : prev);
      setRecentBids(prev => [{
        ...data.bid,
        teamName: data.highestBidderName,
        createdAt: data.bid?.createdAt || Date.now()
      }, ...prev].slice(0, 15));
    };

    const handlePlayerStarted = (data) => {
      if (!checkSeq(data)) return;
      setRecentBids([]);
      setSnapshot(prev => prev ? {
        ...prev,
        status: 'LIVE',
        currentPlayer: data.player,
        currentBid: data.currentBid,
        highestBidder: null,
        highestBidderName: null,
        endsAt: data.endsAt,
        bidEndsAt: data.bidEndsAt
      } : prev);
    };

    const handleSold = (data) => {
      if (!checkSeq(data)) return;
      setSoldOverlay({ type: 'SOLD', player: data.player, team: data.team, price: data.finalPrice });
      setSnapshot(prev => prev ? {
        ...prev,
        status: 'SOLD',
        players: prev.players?.map(p => p.id === data.player?.id ? data.player : p),
        teams: prev.teams?.map(t => t.id === data.team?.id ? data.team : t)
      } : prev);
      if (selectedTeamModal?.id === data.team?.id) {
        setSelectedTeamModal(data.team);
      }
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

    const handleTeamUpdated = (data) => {
      if (!checkSeq(data)) return;
      setSnapshot(prev => prev ? {
        ...prev,
        teams: prev.teams?.map(t => t.id === data.team?.id ? data.team : t)
      } : prev);
      if (selectedTeamModal?.id === data.team?.id) {
        setSelectedTeamModal(data.team);
      }
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
    socket.on('TEAM_UPDATED', handleTeamUpdated);

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
      socket.off('TEAM_UPDATED', handleTeamUpdated);
    };
  }, [socket, snapshot?.auction?.id, triggerBidToast]);

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

  const currentPlayer = snapshot?.currentPlayer;
  const currentBid = Number(snapshot?.currentBid || 0);
  const highestBidder = snapshot?.highestBidder;
  const auctionStatus = snapshot?.status || 'DRAFT';
  const teams = snapshot?.teams || [];
  const players = snapshot?.players || [];

  const soldPlayersCount = players.filter(p => p.status === 'SOLD').length;
  const maxSquad = snapshot?.auction?.maxSquadSize || 11;
  const highestBidderTeam = teams.find(t => t.id === highestBidder);

  const secRemaining = Math.ceil(timeRemaining / 1000);
  const isUrgent = secRemaining <= 5 && secRemaining > 0 && auctionStatus === 'LIVE';
  const isWarning = secRemaining <= 10 && secRemaining > 5 && auctionStatus === 'LIVE';

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#F4F5F8' }}>
      <div style={{ textAlign: 'center' }}>
        <div className="spinner" style={{ margin: '0 auto 14px' }} />
        <div style={{ fontFamily: "'Barlow Condensed', sans-serif", color: 'var(--crimson)', letterSpacing: 3, fontWeight: 800, fontSize: 13 }}>Tuning into VALOR CUP Live Broadcast...</div>
      </div>
    </div>
  );

  return (
    <div className="vc-root vc-body vc-viewer-live" style={{ background: '#F4F5F8', color: '#0D0E12', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {liveBid && (
        <div className="live-bid-toast visible" aria-live="polite">
          <div className="live-bid-toast-label">{liveBid.kind}</div>
          <div className="live-bid-toast-team">{liveBid.teamName}</div>
          <div className="live-bid-toast-amount">Qc {liveBid.amount.toLocaleString()}</div>
        </div>
      )}

      {/* ── BROADCAST TOP HEADER ── */}
      <header className="vc-viewer-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ background: 'transparent', padding: '6px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 22, color: 'var(--text-dark)', letterSpacing: 2 }}>VALOR CUP</span>
            <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 12, color: 'var(--crimson)', letterSpacing: 1.5, background: 'rgba(196,18,48,0.1)', padding: '2px 6px', borderRadius: 3 }}>AUCTION 2026</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(196,18,48,0.08)', border: '1px solid var(--border-crimson)', padding: '4px 12px', borderRadius: 4 }}>
            <Radio size={14} color="var(--crimson)" className="pulse" />
            <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 12, letterSpacing: 2, color: 'var(--crimson)', textTransform: 'uppercase' }}>
              ● LIVE BROADCAST
            </span>
          </div>
        </div>

        {/* Center Timer Display */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#F8F9FD', border: '1px solid var(--border-light)', padding: '6px 20px', borderRadius: 4 }}>
          <Clock size={18} color={isUrgent ? 'var(--red)' : 'var(--crimson)'} />
          <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 12, color: 'var(--text-dim)', letterSpacing: 1.5 }}>TIME LEFT:</span>
          <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 28, letterSpacing: 2, color: isUrgent ? 'var(--red)' : isWarning ? '#F59E0B' : 'var(--text-dark)' }}>
            {formatTime(timeRemaining)}
          </span>
        </div>

        {/* Round & Lot Info & Mobile Switch */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <Link
            to={snapshot?.auction?.id ? `/mobile/${snapshot.auction.id}` : '/mobile'}
            style={{
              background: '#FFFFFF',
              border: '2px solid #111111',
              boxShadow: '2px 2px 0px #111111',
              color: '#111111',
              padding: '6px 12px',
              borderRadius: 4,
              fontFamily: "'Barlow Condensed', sans-serif",
              fontWeight: 800,
              fontSize: 13,
              letterSpacing: 1,
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6
            }}
          >
            <Smartphone size={14} color="var(--crimson)" /> MOBILE VIEW
          </Link>
          <div style={{ background: '#1E293B', color: '#FFFFFF', padding: '6px 12px', borderRadius: 4, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 13, letterSpacing: 1.5 }}>
            ROUND {String(Math.floor(soldPlayersCount / 10) + 1).padStart(2,'0')}
          </div>
          <div style={{ background: 'var(--maroon-dark)', color: 'var(--crimson-bright)', border: '1px solid var(--crimson)', padding: '6px 12px', borderRadius: 4, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 13, letterSpacing: 1.5 }}>
            LOT #{String(soldPlayersCount + (currentPlayer ? 1 : 0)).padStart(3,'0')}
          </div>
        </div>
      </header>

      {/* Broadcast Going Once / Going Twice Notice */}
      {isUrgent && auctionStatus === 'LIVE' && (
        <div style={{ background: 'var(--crimson)', color: '#FFFFFF', padding: '6px 24px', textAlign: 'center', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 16, letterSpacing: 3, textTransform: 'uppercase' }}>
          {secRemaining <= 2 ? 'GOING TWICE... FINAL CALL!' : 'GOING ONCE...'}
        </div>
      )}

      {/* ── MAIN BROADCAST HERO AREA ── */}
      <div className="vc-viewer-hero-grid">

        {/* HERO PLAYER DISPLAY PANEL */}
        <div style={{ background: '#FFFFFF', border: '1px solid var(--border-light)', borderRadius: 8, padding: 28, boxShadow: 'var(--shadow-md)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 6, background: 'linear-gradient(90deg, var(--maroon), var(--crimson), var(--crimson-bright))' }} />

          {currentPlayer ? (
            <div className="vc-viewer-player-grid">

              {/* Player Image / Branded Card */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <PlayerAvatar player={currentPlayer} size={280} borderRadius={8} border="4px solid var(--maroon)" style={{ maxWidth: '100%' }} />
              </div>

              {/* Player Profile & Massive Current Bid */}
              <div style={{ display: 'flex', flexDirection: 'column' }}>

                {/* Badges */}
                <div style={{ display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                  <span style={{ background: 'var(--maroon-dark)', color: '#FFFFFF', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 14, padding: '4px 10px', borderRadius: 4, letterSpacing: 1.5 }}>
                    REG. ID #{currentPlayer.registrationId || currentPlayer.registration_id || currentPlayer.id?.slice(-3) || '—'}
                  </span>
                  <span style={{ background: 'var(--crimson)', color: '#FFFFFF', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 14, padding: '4px 10px', borderRadius: 4, letterSpacing: 1.5 }}>
                    CATEGORY {currentPlayer.category || currentPlayer.auction_category || 'A'}
                  </span>
                  {(currentPlayer.playerType || currentPlayer.player_type || currentPlayer.player_type_name) && (
                    <span style={{ background: '#E0E7FF', color: '#3730A3', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 14, padding: '4px 10px', borderRadius: 4, letterSpacing: 1.5 }}>
                      {String(currentPlayer.playerType || currentPlayer.player_type || currentPlayer.player_type_name).toUpperCase()}
                    </span>
                  )}
                </div>

                {/* Huge Dynamic Player Name */}
                <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 44, color: 'var(--text-dark)', textTransform: 'uppercase', lineHeight: 1.05, letterSpacing: 1, marginBottom: 18 }}>
                  {currentPlayer.name || currentPlayer.fullName || currentPlayer.full_name || currentPlayer.displayName || currentPlayer.display_name || 'Player'}
                </div>

                {/* MASSIVE CURRENT BID BOX */}
                <div style={{ background: '#FFFFFF', borderRadius: 12, padding: '24px', border: '1px solid var(--border-light)', color: 'var(--text-dark)', marginBottom: 18, boxShadow: '0 4px 20px rgba(0,0,0,0.05)', position: 'relative' }}>
                  <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 12, letterSpacing: 3, color: 'var(--text-faint)', textTransform: 'uppercase' }}>
                    CURRENT BID
                  </div>
                  <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 54, color: '#4F46E5', letterSpacing: 1, lineHeight: 1, margin: '6px 0 16px' }}>
                    Qc {currentBid.toLocaleString()}
                  </div>

                  <div style={{ position: 'absolute', bottom: 16, right: 16 }}>
                    {highestBidderTeam ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#F8F9FD', border: '1px solid var(--border-light)', padding: '6px 12px', borderRadius: 20 }}>
                        <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 11, color: 'var(--text-faint)', letterSpacing: 1, textTransform: 'uppercase' }}>
                          LEADING:
                        </span>
                        <TeamLogo logoUrl={highestBidderTeam.logoUrl} name={highestBidderTeam.name} size={20} />
                        <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 14, color: 'var(--text-dark)', letterSpacing: 0.5 }}>
                          {highestBidderTeam.name}
                        </span>
                      </div>
                    ) : (
                      <div style={{ background: '#F8F9FD', border: '1px solid var(--border-light)', padding: '6px 12px', borderRadius: 20 }}>
                        <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 12, color: 'var(--text-faint)' }}>
                          NO BIDS PLACED YET
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Key Statistics Cards */}
                <div className="vc-viewer-stats-grid">
                  <div style={{ background: '#F8F9FD', padding: 12, borderRadius: 6, border: '1px solid var(--border-light)' }}>
                    <div style={{ fontSize: 10, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, color: 'var(--text-faint)', letterSpacing: 1 }}>BASE PRICE</div>
                    <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 16, color: 'var(--text-dark)' }}>
                      Qc {Number(currentPlayer.basePrice ?? currentPlayer.base_price ?? 0).toLocaleString()}
                    </div>
                  </div>
                  <div style={{ background: '#F8F9FD', padding: 12, borderRadius: 6, border: '1px solid var(--border-light)' }}>
                    <div style={{ fontSize: 10, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, color: 'var(--text-faint)', letterSpacing: 1 }}>LAST YEAR PRICE</div>
                    <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 16, color: 'var(--text-secondary)' }}>
                      {(currentPlayer.lastYearPrice || currentPlayer.last_year_price) ? `Qc ${(currentPlayer.lastYearPrice || currentPlayer.last_year_price).toLocaleString()}` : '—'}
                    </div>
                  </div>
                  <div style={{ background: '#F8F9FD', padding: 12, borderRadius: 6, border: '1px solid var(--border-light)' }}>
                    <div style={{ fontSize: 10, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, color: 'var(--text-faint)', letterSpacing: 1 }}>X-FACTOR</div>
                    <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 16, color: 'var(--crimson)' }}>
                      {currentPlayer.xfactor || currentPlayer.xFactor || currentPlayer.x_factor || '—'}
                    </div>
                  </div>
                  <div style={{ background: '#F8F9FD', padding: 12, borderRadius: 6, border: '1px solid var(--border-light)' }}>
                    <div style={{ fontSize: 10, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, color: 'var(--text-faint)', letterSpacing: 1 }}>EXPERIENCE</div>
                    <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 16, color: 'var(--text-dark)' }}>
                      {currentPlayer.experience || '—'}
                    </div>
                  </div>
                </div>

                {/* Player Insights if available */}
                {(currentPlayer.bio || currentPlayer.speciality) && (
                  <div style={{ marginTop: 12, padding: '10px 14px', background: '#F8F9FD', borderRadius: 6, border: '1px solid var(--border-light)', fontSize: 13, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--crimson)', fontSize: 12 }}>
                      INSIGHTS:
                    </span>
                    <span>{currentPlayer.bio || currentPlayer.speciality}</span>
                  </div>
                )}

              </div>
            </div>
          ) : (
            <div style={{ padding: '80px 30px', textAlign: 'center', background: '#F8F9FD', borderRadius: 8, border: '1px dashed var(--border-subtle)', margin: 'auto 0' }}>
              <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 28, color: 'var(--text-dim)', letterSpacing: 3, textTransform: 'uppercase' }}>
                {auctionStatus === 'READY' || auctionStatus === 'LIVE' ? 'STANDBY FOR NEXT PLAYER' : `AUCTION IS ${auctionStatus}`}
              </div>
              <div style={{ fontSize: 14, color: 'var(--text-faint)', marginTop: 8 }}>
                The live auction is underway. Next player card will appear automatically.
              </div>
            </div>
          )}
        </div>

        {/* RIGHT SIDE PANEL — LIVE BIDDING FEED */}
        <div style={{ background: '#FFFFFF', border: '1px solid var(--border-light)', borderRadius: 8, padding: 20, boxShadow: 'var(--shadow-sm)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 16, letterSpacing: 2, color: 'var(--text-dark)', textTransform: 'uppercase', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Activity size={18} color="var(--crimson)" />
            <span>LIVE BIDDING FEED</span>
          </div>

          <div style={{ overflowY: 'auto', flex: 1, maxHeight: 420 }}>
            {recentBids.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-faint)', fontSize: 13, fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: 1 }}>
                Awaiting bids for current player...
              </div>
            ) : (
              recentBids.map((b, i) => {
                const team = teams.find(t => t.id === b.teamId);
                return (
                  <div key={b.id || i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderBottom: '1px solid #F1F5F9', borderRadius: 4, background: i === 0 ? '#FFF0F3' : 'transparent', marginBottom: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                      <TeamLogo logoUrl={team?.logoUrl} name={team?.name || b.teamName} size={22} />
                      <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 14, color: 'var(--text-dark)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                        {team?.name || b.teamName}
                      </span>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 16, color: i === 0 ? 'var(--crimson)' : 'var(--text-dark)' }}>
                        Qc {Number(b.amount || 0).toLocaleString()}
                      </div>
                      <div style={{ fontSize: 9, color: 'var(--text-faint)', fontFamily: "'Barlow Condensed', sans-serif" }}>
                        {timeAgo(b.createdAt)}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>

      {/* ── ALL TEAMS SCOREBOARD (BOTTOM) ── */}
      <div style={{ background: '#FFFFFF', borderTop: '2px solid var(--border-light)', padding: '16px 20px', boxShadow: '0 -4px 16px rgba(0,0,0,0.04)' }}>
        <div style={{ maxWidth: 1800, margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 13, letterSpacing: 2, color: 'var(--text-dim)', textTransform: 'uppercase' }}>
              TEAMS SCOREBOARD
            </div>
            <div style={{ fontSize: 11, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, color: 'var(--crimson)', letterSpacing: 1, display: 'flex', alignItems: 'center', gap: 4 }}>
              <Eye size={12} /> CLICK ANY TEAM TO VIEW SQUAD & SPENT DETAILS
            </div>
          </div>

          <div className="vc-viewer-scoreboard-grid">
            {teams.map(t => {
              const pCount = (t.players || []).length;
              const isLeading = t.id === highestBidder;
              return (
                <div
                  key={t.id}
                  onClick={() => setSelectedTeamModal(t)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setSelectedTeamModal(t); }}
                  title={`Click to inspect ${t.name}'s squad and budget details`}
                  style={{
                    background: isLeading ? '#FFF0F3' : '#F8F9FD',
                    border: `1px solid ${isLeading ? 'var(--border-crimson)' : 'var(--border-light)'}`,
                    borderRadius: 6,
                    padding: '10px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    userSelect: 'none'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 6px 14px rgba(0,0,0,0.08)';
                    e.currentTarget.style.borderColor = 'var(--crimson)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'none';
                    e.currentTarget.style.boxShadow = 'none';
                    e.currentTarget.style.borderColor = isLeading ? 'var(--border-crimson)' : 'var(--border-light)';
                  }}
                >
                  <TeamLogo logoUrl={t.logoUrl} name={t.name} size={32} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 14, color: 'var(--text-dark)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                        {t.name}
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-faint)', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700 }}>
                      {pCount} / {maxSquad} PLAYERS · <span style={{ color: 'var(--crimson)', fontWeight: 800 }}>VIEW SQUAD ↗</span>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 9, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, color: 'var(--text-faint)', letterSpacing: 1 }}>QC LEFT</div>
                    <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 15, color: 'var(--crimson)' }}>
                      {(t.remainingBudget || 0).toLocaleString()}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── INTERACTIVE TEAM SQUAD MODAL FOR VIEWERS ── */}
      <TeamSquadModal
        isOpen={Boolean(selectedTeamModal)}
        onClose={() => setSelectedTeamModal(null)}
        team={selectedTeamModal ? (teams.find(t => t.id === selectedTeamModal.id) || selectedTeamModal) : null}
        teams={teams}
        onSelectTeam={setSelectedTeamModal}
        maxSquadSize={maxSquad}
        allPlayers={snapshot?.players || []}
      />

      {/* ── BROADCAST SOLD/UNSOLD OVERLAY ── */}
      {soldOverlay && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.82)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#FFFFFF', padding: '40px 60px', borderRadius: 12, textAlign: 'center', borderTop: `8px solid ${soldOverlay.type === 'SOLD' ? 'var(--green)' : 'var(--text-dim)'}`, minWidth: 460, boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 64, color: soldOverlay.type === 'SOLD' ? 'var(--green)' : 'var(--text-dim)', letterSpacing: 4, textTransform: 'uppercase', lineHeight: 1 }}>
              {soldOverlay.type}
            </div>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 32, color: 'var(--text-dark)', margin: '16px 0 8px', textTransform: 'uppercase' }}>
              {soldOverlay.player?.name || soldOverlay.player?.fullName || soldOverlay.player?.full_name || soldOverlay.player?.displayName || 'Player'}
            </div>
            {soldOverlay.type === 'SOLD' && (
              <>
                <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 42, color: 'var(--crimson)', margin: '8px 0' }}>
                  Qc {Number(soldOverlay.price || 0).toLocaleString()}
                </div>
                <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 20, color: 'var(--text-secondary)', letterSpacing: 1.5, textTransform: 'uppercase' }}>
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
