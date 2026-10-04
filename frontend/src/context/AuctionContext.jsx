import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { useSocket } from './SocketContext';
import { api } from '../utils/api';

const AuctionContext = createContext(null);

export function AuctionProvider({ children, auctionId }) {
  const { socket, connected, getServerTime } = useSocket();
  const [snapshot, setSnapshot] = useState(null);
  const [loading, setLoading] = useState(true);
  const [recentBids, setRecentBids] = useState([]);
  const [soldOverlay, setSoldOverlay] = useState(null);
  const sequenceRef = useRef(0);

  const fetchSnapshot = useCallback(async () => {
    if (!auctionId) return;
    try {
      const res = await api.get(`/auctions/${auctionId}/snapshot`);
      if (res.data) {
        if (!sequenceRef.current || (res.data.sequence && res.data.sequence >= sequenceRef.current)) {
          setSnapshot(res.data);
          setRecentBids(res.data.recentBids || []);
          if (res.data.sequence) sequenceRef.current = res.data.sequence;
        }
      }
    } catch (err) {
      console.error('Failed to fetch snapshot:', err);
    } finally {
      setLoading(false);
    }
  }, [auctionId]);

  // Fetch initial snapshot
  useEffect(() => {
    fetchSnapshot();
  }, [fetchSnapshot]);

  // Re-fetch snapshot whenever socket reconnects
  useEffect(() => {
    if (connected && auctionId) {
      fetchSnapshot();
    }
  }, [connected, auctionId, fetchSnapshot]);

  // Subscribe to socket events with sequence ordering check
  useEffect(() => {
    if (!socket || !auctionId) return;
    socket.emit('JOIN_AUCTION', { auctionId });

    const checkAndSetSequence = (data) => {
      if (data?.auctionId && data.auctionId !== auctionId) return false;
      const sequence = data?.sequence;
      if (sequence && sequence < sequenceRef.current) return false;
      if (sequence) sequenceRef.current = sequence;
      return true;
    };

    const handleState = (data) => {
      if (!checkAndSetSequence(data)) return;
      setSnapshot(data);
      setRecentBids(data.recentBids || []);
    };

    const handleBid = (data) => {
      if (!checkAndSetSequence(data)) return;
      setSnapshot(prev => prev ? {
        ...prev,
        currentBid: data.currentBid,
        highestBidder: data.highestBidder,
        highestBidderName: data.highestBidderName,
        endsAt: data.endsAt,
        bidEndsAt: data.bidEndsAt
      } : prev);
      setRecentBids(prev => [{ ...data.bid, teamName: data.highestBidderName, createdAt: data.bid?.createdAt || Date.now() }, ...prev].slice(0, 15));
    };

    const handlePlayerStarted = (data) => {
      if (!checkAndSetSequence(data)) return;
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
      if (!checkAndSetSequence(data)) return;
      setSoldOverlay({ type: 'SOLD', player: data.player, team: data.team, price: data.finalPrice });
      setSnapshot(prev => prev ? {
        ...prev,
        status: 'SOLD',
        players: prev.players?.map(p => p.id === data.player?.id ? data.player : p),
        teams: prev.teams?.map(t => t.id === data.team?.id ? data.team : t)
      } : prev);
      setTimeout(() => setSoldOverlay(null), 3500);
    };

    const handleUnsold = (data) => {
      if (!checkAndSetSequence(data)) return;
      setSoldOverlay({ type: 'UNSOLD', player: data.player });
      setSnapshot(prev => prev ? {
        ...prev,
        status: 'UNSOLD',
        players: prev.players?.map(p => p.id === data.player?.id ? data.player : p)
      } : prev);
      setTimeout(() => setSoldOverlay(null), 2500);
    };

    const handleReady = (data) => {
      if (!checkAndSetSequence(data)) return;
      setSnapshot(prev => prev ? {
        ...prev,
        status: 'READY',
        currentPlayer: null,
        currentBid: 0,
        highestBidder: null,
        highestBidderName: null,
        endsAt: null,
        bidEndsAt: null
      } : prev);
    };

    const handlePaused = (data) => {
      if (!checkAndSetSequence(data)) return;
      setSnapshot(prev => prev ? { ...prev, status: 'PAUSED' } : prev);
    };

    const handleResumed = (data) => {
      if (!checkAndSetSequence(data)) return;
      setSnapshot(prev => prev ? {
        ...prev,
        status: 'LIVE',
        endsAt: data.endsAt,
        bidEndsAt: data.bidEndsAt
      } : prev);
    };

    const handleTimerExtended = (data) => {
      if (!checkAndSetSequence(data)) return;
      setSnapshot(prev => prev ? {
        ...prev,
        endsAt: data.endsAt,
        bidEndsAt: data.bidEndsAt
      } : prev);
    };

    const handleStarted = (data) => {
      if (!checkAndSetSequence(data)) return;
      setSnapshot(prev => prev ? {
        ...prev,
        status: 'LIVE',
        auction: data.auction
      } : prev);
    };

    const handleCompleted = (data) => {
      if (!checkAndSetSequence(data)) return;
      setSnapshot(prev => prev ? {
        ...prev,
        status: 'COMPLETED',
        auction: data.auction
      } : prev);
    };

    const handleTeamUpdated = (data) => {
      if (!checkAndSetSequence(data)) return;
      setSnapshot(prev => prev ? {
        ...prev,
        teams: prev.teams?.map(t => t.id === data.team?.id ? data.team : t)
      } : prev);
    };

    socket.on('AUCTION_STATE', handleState);
    socket.on('BID_PLACED', handleBid);
    socket.on('PLAYER_STARTED', handlePlayerStarted);
    socket.on('PLAYER_SOLD', handleSold);
    socket.on('PLAYER_UNSOLD', handleUnsold);
    socket.on('AUCTION_READY', handleReady);
    socket.on('AUCTION_PAUSED', handlePaused);
    socket.on('AUCTION_RESUMED', handleResumed);
    socket.on('TIMER_EXTENDED', handleTimerExtended);
    socket.on('AUCTION_STARTED', handleStarted);
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
      socket.off('TIMER_EXTENDED', handleTimerExtended);
      socket.off('AUCTION_STARTED', handleStarted);
      socket.off('AUCTION_COMPLETED', handleCompleted);
      socket.off('TEAM_UPDATED', handleTeamUpdated);
    };
  }, [socket, auctionId]);

  return (
    <AuctionContext.Provider value={{ snapshot, loading, recentBids, soldOverlay, refetchSnapshot: fetchSnapshot, getServerTime }}>
      {children}
    </AuctionContext.Provider>
  );
}

export const useAuction = () => useContext(AuctionContext);
