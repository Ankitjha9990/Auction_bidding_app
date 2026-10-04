import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useSocket } from '../../context/SocketContext';
import { api } from '../../utils/api';
import MobileLiveCard from '../../components/MobileLiveCard';
import TeamSquadModal from '../../components/TeamSquadModal';
import { ArrowLeft, RefreshCw } from 'lucide-react';

export default function MobileLiveView() {
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

  const triggerBidToast = useCallback((data) => {
    const teamName = data?.highestBidderName || data?.bid?.teamName || 'TEAM';
    const amount = Number(data?.currentBid ?? data?.bid?.amount ?? 0);
    setLiveBid({ teamName, amount, kind: 'NEW BID' });
    if (bidToastTimerRef.current) clearTimeout(bidToastTimerRef.current);
    bidToastTimerRef.current = setTimeout(() => setLiveBid(null), 1800);
  }, []);

  const loadAndJoin = useCallback(async () => {
    try {
      const aRes = await api.get('/auctions');
      const auctions = aRes.data;
      const auction = paramAuctionId
        ? auctions.find(a => a.id === paramAuctionId)
        : auctions.find(a => a.status === 'LIVE' || a.status === 'SCHEDULED' || a.status === 'READY') || auctions[0];

      if (!auction) {
        setSnapshot(null);
        setRecentBids([]);
        setLoading(false);
        return;
      }

      if (socket) socket.emit('JOIN_AUCTION', { auctionId: auction.id });
      const snapRes = await api.get(`/auctions/${auction.id}/snapshot`);
      if (snapRes.data) {
        setSnapshot(snapRes.data);
        setRecentBids(snapRes.data.recentBids || []);
        if (snapRes.data.sequence) sequenceRef.current = snapRes.data.sequence;
      }
      setLoading(false);
    } catch (err) {
      console.warn('Failed to load live auction snapshot for mobile view:', err.message);
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
        const remaining = Math.max(0, snapshot.endsAt - (getServerTime ? getServerTime() : Date.now()));
        setTimeRemaining(remaining);
      }, 150);
    } else {
      setTimeRemaining(0);
    }
    return () => clearInterval(timerRef.current);
  }, [snapshot?.status, snapshot?.endsAt, getServerTime]);

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: '#F4F5F8',
        fontFamily: "'Barlow Condensed', sans-serif"
      }}>
        <div style={{ textAlign: 'center' }}>
          <div className="spinner" style={{ margin: '0 auto 16px', borderColor: '#E2E8F0', borderTopColor: '#C41230' }} />
          <div style={{ fontWeight: 900, color: '#C41230', letterSpacing: 2, fontSize: 16 }}>
            LOADING VALOR CUP LIVE...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#F4F5F8',
      width: '100%',
      boxSizing: 'border-box',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      fontFamily: "'Barlow Condensed', sans-serif",
      padding: '12px 10px 48px'
    }}>
      {/* Toast Notification */}
      {liveBid && (
        <div className="live-bid-toast visible" aria-live="polite">
          <div className="live-bid-toast-label">{liveBid.kind}</div>
          <div className="live-bid-toast-team">{liveBid.teamName}</div>
          <div className="live-bid-toast-amount">Qc {liveBid.amount.toLocaleString()}</div>
        </div>
      )}

      <div className="vc-mobile-live-wrapper" style={{ width: '100%', maxWidth: 480, margin: '0 auto' }}>
        {/* Top Navigation Bar */}
        <div style={{
          width: '100%',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 12,
          gap: 8
        }}>
          <Link
            to={snapshot?.auction?.id ? `/live/${snapshot.auction.id}` : '/viewer'}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: '#FFFFFF',
              border: '1px solid #CBD5E1',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
              padding: '6px 14px',
              fontSize: 13,
              fontWeight: 800,
              color: '#0D0E12',
              textDecoration: 'none',
              letterSpacing: 1,
              borderRadius: 6,
              transition: 'background 0.15s ease'
            }}
          >
            <ArrowLeft size={14} color="#C41230" /> DESKTOP VIEW
          </Link>

          <button
            onClick={loadAndJoin}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: '#C41230',
              border: '1px solid #9E0F27',
              boxShadow: '0 1px 3px rgba(196,18,48,0.2)',
              padding: '6px 14px',
              fontSize: 13,
              fontWeight: 900,
              color: '#FFFFFF',
              cursor: 'pointer',
              letterSpacing: 1,
              borderRadius: 6
            }}
          >
            <RefreshCw size={13} /> REFRESH
          </button>
        </div>

        {/* The Responsive Mobile Live Card */}
        <MobileLiveCard
          snapshot={snapshot}
          timeRemaining={timeRemaining}
          recentBids={recentBids}
          onSelectTeam={setSelectedTeamModal}
        />
      </div>

      {/* Team Detail / Squad Modal for Mobile */}
      <TeamSquadModal
        isOpen={Boolean(selectedTeamModal)}
        onClose={() => setSelectedTeamModal(null)}
        team={selectedTeamModal ? (snapshot?.teams?.find(t => t.id === selectedTeamModal.id) || selectedTeamModal) : null}
        teams={snapshot?.teams || []}
        onSelectTeam={setSelectedTeamModal}
        maxSquadSize={snapshot?.auction?.maxSquadSize}
        allPlayers={snapshot?.players || []}
      />

      {/* Sold/Unsold Overlay */}
      {soldOverlay && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(13,14,18,0.85)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 16
        }}>
          <div style={{
            background: '#FFFFFF',
            borderTop: `6px solid ${soldOverlay.type === 'SOLD' ? '#16A34A' : '#64748B'}`,
            borderRadius: 12,
            padding: '30px 24px',
            maxWidth: 360,
            width: '100%',
            textAlign: 'center',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.35)'
          }}>
            <div style={{
              fontSize: 44,
              fontWeight: 900,
              letterSpacing: 2,
              color: soldOverlay.type === 'SOLD' ? '#16A34A' : '#64748B',
              textTransform: 'uppercase',
              lineHeight: 1
            }}>
              {soldOverlay.type}
            </div>
            <div style={{
              fontSize: 24,
              fontWeight: 900,
              color: '#0D0E12',
              margin: '14px 0 8px',
              textTransform: 'uppercase'
            }}>
              {soldOverlay.player?.name || soldOverlay.player?.fullName || soldOverlay.player?.full_name || soldOverlay.player?.displayName || 'Player'}
            </div>
            {soldOverlay.type === 'SOLD' && (
              <>
                <div style={{ fontSize: 32, fontWeight: 900, color: '#C41230', marginBottom: 4 }}>
                  Qc {Number(soldOverlay.price || 0).toLocaleString()}
                </div>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: 1 }}>
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
