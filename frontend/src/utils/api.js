import axios from 'axios';

export const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

export const api = axios.create({ baseURL: BACKEND_URL });

api.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const formatCurrency = (amount) =>
  `Qc ${Number(amount || 0).toLocaleString()}`;


export const formatTime = (ms) => {
  if (!ms || ms <= 0) return '00:00';
  const totalSec = Math.ceil(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

export const formatCountdown = (ms) => {
  if (!ms || ms <= 0) return '00:00:00';
  const totalSec = Math.ceil(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) {
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

export const formatDateTimeIST = (dateStringOrTs) => {
  if (!dateStringOrTs) return '—';
  try {
    const d = new Date(dateStringOrTs);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    }) + ' IST';
  } catch {
    return String(dateStringOrTs);
  }
};

export const getStatusBadgeClass = (status) => {
  const map = {
    SCHEDULED: 'badge-scheduled',
    LIVE: 'badge-live',
    SOLD: 'badge-sold',
    UNSOLD: 'badge-unsold',
    WAITING: 'badge-waiting',
    PAUSED: 'badge-paused',
    DRAFT: 'badge-draft',
    READY: 'badge-ready',
    COMPLETED: 'badge-completed'
  };
  return `badge ${map[status] || 'badge-waiting'}`;
};

export const getImageUrl = (url) => {
  if (!url || typeof url !== 'string') return null;
  const raw = url.trim();
  if (!raw) return null;

  // Handle legacy stored localhost URLs if deployed or backend URL is configured
  if (raw.includes('localhost:3001/uploads/')) {
    const filename = raw.split('/uploads/')[1];
    return `${BACKEND_URL}/uploads/${filename}`;
  }

  if (raw.startsWith('http://') || raw.startsWith('https://') || raw.startsWith('data:') || raw.startsWith('blob:')) {
    return raw;
  }

  const cleanPath = raw.startsWith('/') ? raw : `/${raw}`;
  return `${BACKEND_URL}${cleanPath}`;
};

export const getPlayerImageUrl = (playerOrUrl) => {
  if (!playerOrUrl) return null;

  if (typeof playerOrUrl === 'string') {
    return getImageUrl(playerOrUrl);
  }

  if (typeof playerOrUrl === 'object') {
    const raw = playerOrUrl.image_url ||
                playerOrUrl.imageUrl ||
                playerOrUrl.photoUrl ||
                playerOrUrl.photo ||
                playerOrUrl.image ||
                playerOrUrl.profileImage ||
                playerOrUrl.profilePhoto ||
                null;
    return getImageUrl(raw);
  }

  return null;
};

export const getPlayerAvatarUrl = (nameOrPlayer, customUrl) => {
  const extractedUrl = getPlayerImageUrl(nameOrPlayer) || (customUrl ? getImageUrl(customUrl) : null);
  if (extractedUrl) return extractedUrl;

  const name = typeof nameOrPlayer === 'object'
    ? (nameOrPlayer?.full_name || nameOrPlayer?.display_name || nameOrPlayer?.name || 'Player')
    : (nameOrPlayer || 'Player');

  const cleanSeed = encodeURIComponent((name || 'Player').trim().toLowerCase());
  return `https://api.dicebear.com/7.x/bottts/svg?seed=${cleanSeed}&backgroundColor=0d1b2a,16365c,1e293b,0f172a`;
};

export const timeAgo = (ts) => {
  const diff = (Date.now() - ts) / 1000;
  if (diff < 5) return 'just now';
  if (diff < 60) return `${Math.round(diff)}s ago`;
  if (diff < 3600) return `${Math.round(diff / 60)}m ago`;
  return `${Math.round(diff / 3600)}h ago`;
};
