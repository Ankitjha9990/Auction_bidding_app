import { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import { BACKEND_URL } from '../utils/api';

const SocketContext = createContext(null);

export function SocketProvider({ children }) {
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [serverOffset, setServerOffset] = useState(0);
  const socketRef = useRef(null);

  const syncTimeWithServer = useCallback((s) => {
    const clientSent = Date.now();
    s.emit('SYNC_TIME', clientSent, (data) => {
      if (data && data.serverTimeMs) {
        const clientRecv = Date.now();
        const rtt = clientRecv - clientSent;
        const estServerNow = data.serverTimeMs + (rtt / 2);
        const offset = estServerNow - clientRecv;
        setServerOffset(offset);
      }
    });
  }, []);

  useEffect(() => {
    const s = io(BACKEND_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 20
    });

    s.on('connect', () => {
      setConnected(true);
      syncTimeWithServer(s);
    });

    s.on('CONNECTED', (data) => {
      if (data?.serverTimeMs) {
        setServerOffset(data.serverTimeMs - Date.now());
      }
    });

    s.on('disconnect', () => setConnected(false));
    s.on('reconnect', () => {
      setConnected(true);
      syncTimeWithServer(s);
    });

    socketRef.current = s;
    setSocket(s);

    // Periodic time sync every 30 seconds
    const interval = setInterval(() => {
      if (s.connected) syncTimeWithServer(s);
    }, 30000);

    return () => {
      clearInterval(interval);
      s.disconnect();
    };
  }, [syncTimeWithServer]);

  const getServerTime = useCallback(() => {
    return Date.now() + serverOffset;
  }, [serverOffset]);

  return (
    <SocketContext.Provider value={{ socket, connected, serverOffset, getServerTime }}>
      {children}
    </SocketContext.Provider>
  );
}

export const useSocket = () => useContext(SocketContext);
