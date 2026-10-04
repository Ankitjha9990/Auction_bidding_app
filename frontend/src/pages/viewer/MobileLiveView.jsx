import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useSocket } from '../../context/SocketContext';
import { api } from '../../utils/api';
import MobileLiveCard from '../../components/MobileLiveCard';
import { ArrowLeft, RefreshCw } from 'lucide-react';

const MOCK_FALLBACK = {
  auction: { id: 'mock-1', title: 'VALOR CUP 2026', maxSquadSize: 11 },
  status: 'LIVE',
  endsAt: Date.now() + 12000,
  currentBid: 250,
  highestBidder: 't1',
  highestBidderName: 'Phoenix Blitz',
  currentPlayer: {
    id: 'p-satyam',
    name: 'SATYAM',
    category: 'A',
    status: 'RETURNING',
    type: 'Returning Player',
    basePrice: 100,
    lastYearPrice: 160,
    xfactor: 'CLUTCH',
    experience: '2 SEASONS',
    registrationId: '027',
    role: 'Clutch / All-Rounder'
  },
  recentBids: [
    { id: 'b1', teamName: 'Phoenix Blitz', teamId: 't1', amount: 250, createdAt: Date.now() - 3000 },
    { id: 'b2', teamName: 'Shadow Strikers', teamId: 't2', amount: 225, createdAt: Date.now() - 14000 }
  ],
  teams: [
    { id: 't1', name: 'Phoenix Blitz', remainingBudget: 97610, players: [{}, {}, {}] },
    { id: 't2', name: 'Shadow Strikers', remainingBudget: 99825, players: [{}, {}] }
  ]
};

export default function MobileLiveView() {
  const { auctionId: paramAuctionId } = useParams();
  const { socket, connected, getServerTime } = useSocket();
  const [snapshot, setSnapshot] = useState(null);
  const [recentBids, setRecentBids] = useState([]);
  const [soldOverlay, setSoldOverlay] = useState(null);
  const [loading, setLoading] = useState(true);
  const [timeRemaining, setTimeRemaining] = useState(12000);
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
        setSnapshot(MOCK_FALLBACK);
        setRecentBids(MOCK_FALLBACK.recentBids);
        setLoading(false);
        return;
      }

      if (socket) socket.emit('JOIN_AUCTION', { auctionId: auction.id });
      const snapRes = await api.get(`/auctions/${auction.id}/snapshot`);
      if (snapRes.data) {
        setSnapshot(snapRes.data);
        setRecentBids(snapRes.data.recentBids || []);
        if (snapRes.data.sequence) sequenceRef.current = snapRes.data.sequence;
      } else {
        setSnapshot(MOCK_FALLBACK);
        setRecentBids(MOCK_FALLBACK.recentBids);
      }
      setLoading(false);
    } catch (err) {
      console.warn('Using fallback data for mobile live view:', err.message);
      setSnapshot(MOCK_FALLBACK);
      setRecentBids(MOCK_FALLBACK.recentBids);
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
  }, [socket, snapshot?.auction?.id, triggerBidToast]);

  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (snapshot?.status === 'LIVE' && snapshot?.endsAt) {
      timerRef.current = setInterval(() => {
        const remaining = Math.max(0, snapshot.endsAt - (getServerTime ? getServerTime() : Date.now()));
        setTimeRemaining(remaining);
      }, 150);
    } else if (snapshot?.status === 'LIVE' && !snapshot?.endsAt) {
      setTimeRemaining(12000);
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
        background: '#F7F4EE',
        fontFamily: "'Barlow Condensed', sans-serif"
      }}>
        <div style={{ textAlign: 'center' }}>
          <div className="spinner" style={{ margin: '0 auto 16px', borderColor: '#111111', borderTopColor: '#C41230' }} />
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
      background: '#F7F4EE',
      width: '100%',
      boxSizing: 'border-box',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      fontFamily: "'Barlow Condensed', sans-serif"
    }}>
      {/* Toast Notification */}
      {liveBid && (
        <div className="live-bid-toast visible" aria-live="polite">
          <div className="live-bid-toast-label">{liveBid.kind}</div>
          <div className="live-bid-toast-team">{liveBid.teamName}</div>
          <div className="live-bid-toast-amount">Qc {liveBid.amount.toLocaleString()}</div>
        </div>
      )}

      <div className="vc-mobile-live-wrapper">
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
              border: '2px solid #111111',
              boxShadow: '2px 2px 0px #111111',
              padding: '6px 12px',
              fontSize: 13,
              fontWeight: 800,
              color: '#111111',
              textDecoration: 'none',
              letterSpacing: 1,
              borderRadius: 4
            }}
          >
            <ArrowLeft size={14} /> DESKTOP VIEW
          </Link>
          <button
            onClick={loadAndJoin}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: '#FFD43B',
              border: '2px solid #111111',
              boxShadow: '2px 2px 0px #111111',
              padding: '6px 12px',
              fontSize: 13,
              fontWeight: 900,
              color: '#111111',
              cursor: 'pointer',
              letterSpacing: 1,
              borderRadius: 4
            }}
          >
            <RefreshCw size={13} /> REFRESH
          </button>
        </div>

        {/* The Exact Responsive Mobile Live Card */}
        <MobileLiveCard
          snapshot={snapshot || MOCK_FALLBACK}
          timeRemaining={timeRemaining}
          recentBids={recentBids}
        />
      </div>

      {/* Sold/Unsold Overlay */}
      {soldOverlay && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(17,17,17,0.85)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 16
        }}>
          <div style={{
            background: '#FFFFFF',
            border: '3px solid #111111',
            boxShadow: '6px 6px 0px #111111',
            borderRadius: 8,
            padding: '24px 20px',
            maxWidth: 340,
            width: '100%',
            textAlign: 'center'
          }}>
            <div style={{
              fontSize: 36,
              fontWeight: 900,
              letterSpacing: 2,
              color: soldOverlay.type === 'SOLD' ? '#16A765' : '#C41230',
              textTransform: 'uppercase',
              lineHeight: 1
            }}>
              {soldOverlay.type}
            </div>
            <div style={{
              fontSize: 22,
              fontWeight: 900,
              color: '#111111',
              margin: '12px 0 6px',
              textTransform: 'uppercase'
            }}>
              {soldOverlay.player?.name}
            </div>
            {soldOverlay.type === 'SOLD' && (
              <>
                <div style={{ fontSize: 28, fontWeight: 900, color: '#C41230', marginBottom: 4 }}>
                  Qc {Number(soldOverlay.price || 0).toLocaleString()}
                </div>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#4B5563', textTransform: 'uppercase' }}>
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
