const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { parseExcelWorkbook, normalizeCategory } = require('./excelImporter');


const app = express();
const server = http.createServer(app);

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST', 'PATCH', 'DELETE'] }
});

app.use(cors());
app.use(express.json());

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
app.use('/uploads', express.static(uploadsDir));

// ─── Multer for image & logo uploads ───────────────────────────────────────
const storage = multer.diskStorage({
  destination: uploadsDir,
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, uuidv4() + ext);
  }
});
const upload = multer({ 
  storage, 
  limits: { fileSize: 2 * 1024 * 1024 } // 2 MB limit
});

// ─── Permanent Database Store (db.json) ─────────────────────────────────────
const dbFilePath = process.env.AUCTION_DB_PATH || path.join(__dirname, 'db.json');
const defaultPlayersPath = path.join(__dirname, 'default_players.json');

let db = {
  users: [
    { id: 'admin-1', name: 'Admin', email: 'admin@spectra.com', password: 'Spectra@2026', role: 'admin' }
  ],
  auctions: [],
  teams: [],
  players: [],
  bids: [],
  purchases: [],
  events: []
};

function getCategoryLabel(value) {
  if (!value) return 'Category A';
  let cat = value;
  while (typeof cat === 'object' && cat !== null) {
    cat = cat.category || cat.player_category || 'Category A';
  }
  return normalizeCategory(String(cat || 'Category A')).category;
}

function enrichPlayer(p) {
  if (!p) return null;
  const name = p.name || p.full_name || p.fullName || p.display_name || p.displayName || 'Player';
  const basePrice = Number(p.basePrice ?? p.base_price ?? p.auction_base_price ?? 100);
  const lastYearPrice = p.lastYearPrice !== undefined ? p.lastYearPrice : (p.last_year_price !== undefined ? p.last_year_price : null);
  const xfactor = p.xfactor || p.xFactor || p.x_factor || '';
  const experience = p.experience || '';
  const category = getCategoryLabel(p.category || p.auction_category);
  const registrationId = p.registrationId || p.registration_id || (p.id ? p.id.slice(-3) : '');
  const imageUrl = p.imageUrl || p.image_url || null;
  const scoreOutOf5 = p.scoreOutOf5 ?? p.score_out_of_5 ?? 3.5;
  const overallRating = p.overallRating ?? p.overall_rating ?? 75;
  const bio = p.bio || p.highlight_reason || '';
  const stats = p.stats || {};
  const status = p.status || p.auction_status || 'WAITING';
  const playerType = p.playerType || p.player_type || p.player_type_name || 'NEW';
  const soldPrice = p.soldPrice !== undefined && p.soldPrice !== null
    ? Number(p.soldPrice)
    : (p.sold_price !== undefined && p.sold_price !== null
      ? Number(p.sold_price)
      : (p.price !== undefined && p.price !== null && status === 'SOLD' ? Number(p.price) : null));
  const soldTo = p.soldTo || p.sold_team_id || null;

  return {
    ...p,
    id: p.id || p.masterPlayerId || p.player_id,
    masterPlayerId: p.masterPlayerId || p.player_id || p.id,
    name,
    fullName: name,
    full_name: name,
    displayName: p.displayName || p.display_name || name,
    display_name: p.displayName || p.display_name || name,
    basePrice,
    base_price: basePrice,
    lastYearPrice,
    last_year_price: lastYearPrice,
    xfactor,
    xFactor: xfactor,
    x_factor: xfactor,
    experience,
    category,
    registrationId,
    registration_id: registrationId,
    imageUrl,
    image_url: imageUrl,
    scoreOutOf5,
    score_out_of_5: scoreOutOf5,
    overallRating,
    overall_rating: overallRating,
    bio,
    stats,
    status,
    playerType,
    player_type: playerType,
    soldPrice,
    sold_price: soldPrice,
    price: soldPrice !== null ? soldPrice : basePrice,
    soldTo,
    sold_team_id: soldTo
  };
}

function enrichTeam(team, auctionId) {
  if (!team) return null;
  const initialBudget = Number(team.initialBudget || 100000);

  let captainName = team.captainName || '';
  let captainEmail = team.captainEmail || '';
  if (team.captainId && (!captainName || !captainEmail)) {
    const cap = (db.users || []).find(u => u.id === team.captainId);
    if (cap) {
      captainName = captainName || cap.name || '';
      captainEmail = captainEmail || cap.email || '';
    }
  }

  const rawPlayers = Array.isArray(team.players) ? team.players : [];
  const players = rawPlayers.map((tp, idx) => {
    const playerId = tp.playerId || tp.id;
    const master = (db.players || []).find(p => p.id === playerId) || {};
    const price = Number(tp.soldPrice ?? tp.price ?? tp.finalPrice ?? master.soldPrice ?? master.price ?? 0);
    const id = playerId || master.id || `tp-${idx}`;
    const name = tp.name || master.full_name || master.name || master.displayName || 'Player';
    const category = getCategoryLabel(tp.category || master.category || master.auction_category);
    const registrationId = tp.registrationId || master.registration_id || master.registrationId || (id ? String(id).slice(-3) : '');
    const imageUrl = tp.imageUrl || master.image_url || master.imageUrl || null;
    const purchasedAt = tp.purchasedAt || master.soldAt || new Date().toISOString();

    return {
      ...tp,
      id,
      playerId: id,
      name,
      fullName: name,
      category,
      price,
      soldPrice: price,
      finalPrice: price,
      registrationId,
      imageUrl,
      purchasedAt
    };
  });

  const totalSpent = players.reduce((sum, p) => sum + (p.soldPrice || 0), 0);
  const remainingBudget = Math.max(0, initialBudget - totalSpent);

  return {
    ...team,
    captainName,
    captainEmail,
    initialBudget,
    totalSpent,
    remainingBudget,
    players
  };
}

function normalizeTeamFinancials() {
  let changed = false;
  if (Array.isArray(db.teams)) {
    db.teams = db.teams.map(t => {
      const enriched = enrichTeam(t, t.auctionId);
      if (t.totalSpent !== enriched.totalSpent || t.remainingBudget !== enriched.remainingBudget) {
        changed = true;
      }
      return enriched;
    });
  }
  if (changed) saveDb();
}

function normalizeAuctionTimers() {
  let changed = false;
  (db.auctions || []).forEach(auction => {
    // Default time of 2 minutes (120 seconds) for each and every auction for 1 player, even for already live test auction
    if (!auction.playerTimer || auction.playerTimer === 20 || auction.playerTimer === 90) {
      auction.playerTimer = 120;
      changed = true;
    }
    if (auction.roundStatus === 'PAUSED' && auction.pausedRemaining && auction.pausedRemaining <= 90000) {
      auction.pausedRemaining = 120000;
      changed = true;
    }
  });
  if (changed) saveDb();
}

function normalizeStoredCategories() {
  let changed = false;
  const normalizeField = (record, field) => {
    if (!record || record[field] === undefined || record[field] === null) return;
    const normalized = getCategoryLabel(record[field]);
    if (record[field] !== normalized) {
      record[field] = normalized;
      changed = true;
    }
  };

  (db.players || []).forEach(player => normalizeField(player, 'category'));
  (db.auction_players || []).forEach(player => normalizeField(player, 'auction_category'));
  (db.teams || []).forEach(team => {
    (team.players || []).forEach(player => normalizeField(player, 'category'));
  });

  if (changed) saveDb();
}

function loadDb() {
  try {
    if (fs.existsSync(dbFilePath)) {
      const data = fs.readFileSync(dbFilePath, 'utf-8');
      db = JSON.parse(data);
      normalizeStoredCategories();
      normalizeAuctionTimers();
      normalizeTeamFinancials();
      console.log(`Loaded ${db.players?.length || 0} players and ${db.auctions?.length || 0} auctions from ${dbFilePath}`);
    } else if (fs.existsSync(defaultPlayersPath)) {
      const defaultPlayers = JSON.parse(fs.readFileSync(defaultPlayersPath, 'utf-8'));
      const defaultAuction = {
        id: 'auction-spectra-2026',
        name: 'SPECTRA 2026 Auction',
        seriesName: 'Valor Cup Season 2',
        tournamentName: 'SPECTRA 2026',
        organizerName: 'Medhavi Skills University',
        scheduledAt: null,
        startedAt: null,
        endedAt: null,
        status: 'DRAFT',
        startingBudget: 100000,
        minimumBid: 1000,
        playerTimer: 120,
        numTeams: 8,
        maxSquadSize: 11,
        minSquadSize: 7,
        allowRebid: true,
        allowUnsoldReauction: true,
        createdAt: Date.now(),
        createdServerTimestamp: new Date().toISOString()
      };
      defaultPlayers.forEach(p => { p.auctionId = defaultAuction.id; });
      db.auctions = [defaultAuction];
      db.players = defaultPlayers;
      normalizeStoredCategories();
      saveDb();
    }
  } catch (err) {
    console.error('Failed to load db.json, using default state:', err);
  }
}

function saveDb() {
  try {
    fs.writeFileSync(dbFilePath, JSON.stringify(db, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to persist db.json:', err);
  }
}

// ─── Auction Engine State ───────────────────────────────────────────────────
let auctionEngine = {
  auctionId: null,
  status: null,          // SCHEDULED, READY, LIVE, PAUSED, SOLD, UNSOLD, COMPLETED
  currentPlayer: null,
  currentBid: 0,
  highestBidder: null,   // teamId
  highestBidderName: null,
  bidStartedAt: null,    // ISO string
  endsAt: null,          // timestamp ms
  timerInterval: null,
  sequence: 0,
  bidExtension: 10,      // seconds to reset timer on new bid
  pausedRemaining: null  // ms remaining when paused
};

function ensureEngineActive(targetAuctionId) {
  if (auctionEngine.auctionId === targetAuctionId && auctionEngine.status) return true;
  const auc = db.auctions.find(a => a.id === targetAuctionId);
  if (!auc) return false;
  auctionEngine.auctionId = targetAuctionId;
  if (!auctionEngine.status || auctionEngine.status === 'DRAFT') {
    auctionEngine.status = auc.status === 'LIVE' ? 'READY' : (auc.status || 'READY');
  }
  return true;
}

loadDb();

// Auto-attach engine to active or first auction
const initialActiveAuction = db.auctions?.find(a => a.currentPlayerId && a.status !== 'COMPLETED') ||
  db.auctions?.find(a => a.status === 'LIVE' || a.status === 'READY') ||
  db.auctions?.[0];
if (initialActiveAuction) {
  ensureEngineActive(initialActiveAuction.id);
}

if (initialActiveAuction?.currentPlayerId) {
  const rawCurrentPlayer = db.players.find(p => p.id === initialActiveAuction.currentPlayerId);
  if (rawCurrentPlayer) {
    const currentPlayer = enrichPlayer(rawCurrentPlayer);
    auctionEngine.currentPlayer = currentPlayer;
    auctionEngine.currentBid = Number(initialActiveAuction.currentBid ?? currentPlayer.basePrice ?? 0);
    auctionEngine.highestBidder = initialActiveAuction.highestBidder || null;
    auctionEngine.highestBidderName = initialActiveAuction.highestBidderName ||
      db.teams.find(t => t.id === auctionEngine.highestBidder)?.name || null;
    auctionEngine.status = initialActiveAuction.roundStatus || 'LIVE';
    auctionEngine.endsAt = Number(initialActiveAuction.endsAt) || null;
    auctionEngine.pausedRemaining = Number(initialActiveAuction.pausedRemaining) || (auctionEngine.status === 'PAUSED' ? 120000 : null);
    if (!initialActiveAuction.playerTimer || initialActiveAuction.playerTimer === 20 || initialActiveAuction.playerTimer === 90) {
      initialActiveAuction.playerTimer = 120;
    }
    auctionEngine.sequence = Math.max(
      0,
      ...db.events
        .filter(event => event.auctionId === initialActiveAuction.id)
        .map(event => Number(event.sequence) || 0)
    );

    if (auctionEngine.status === 'LIVE' && auctionEngine.endsAt) {
      const remaining = auctionEngine.endsAt - Date.now();
      if (remaining > 0) startTimer(remaining);
      else setTimeout(handleTimerExpired, 0);
    }
  }
}

// Atomic lock for starting auction
let startAuctionLock = false;

// ─── Helper: broadcast event ────────────────────────────────────────────────
function broadcast(eventName, payload) {
  auctionEngine.sequence++;
  const now = Date.now();
  const fullPayload = {
    ...payload,
    auctionId: auctionEngine.auctionId,
    sequence: auctionEngine.sequence,
    timestamp: now,
    serverTime: new Date(now).toISOString(),
    serverTimeMs: now
  };
  io.emit(eventName, fullPayload);
  // Record event
  db.events.push({
    id: uuidv4(),
    auctionId: auctionEngine.auctionId,
    type: eventName,
    payload: fullPayload,
    sequence: auctionEngine.sequence,
    createdAt: now,
    serverTimestamp: new Date(now).toISOString()
  });
  saveDb();
}

// ─── Timer logic ────────────────────────────────────────────────────────────
function clearTimer() {
  if (auctionEngine.timerInterval) {
    clearInterval(auctionEngine.timerInterval);
    auctionEngine.timerInterval = null;
  }
}

function startTimer(durationMs) {
  clearTimer();
  const now = Date.now();
  auctionEngine.endsAt = now + durationMs;
  auctionEngine.timerInterval = setInterval(() => {
    const remaining = auctionEngine.endsAt - Date.now();
    if (remaining <= 0) {
      clearTimer();
      handleTimerExpired();
    }
  }, 250);
}

function handleTimerExpired() {
  if (!auctionEngine.currentPlayer) return;
  if (auctionEngine.status !== 'LIVE') return;

  const auction = db.auctions.find(a => a.id === auctionEngine.auctionId);
  if (!auction) return;

  if (auctionEngine.highestBidder && auctionEngine.currentBid > 0) {
    sellCurrentPlayer(auctionEngine.highestBidder, auctionEngine.currentBid, 'auto');
  } else {
    markCurrentPlayerUnsold('auto');
  }
}

function sellCurrentPlayer(teamId, amount, by) {
  const player = auctionEngine.currentPlayer;
  if (!player) return;

  const team = db.teams.find(t => t.id === teamId);
  if (!team) return;

  const numAmount = Number(amount);
  const now = Date.now();

  // Strict team exclusivity: remove player from any previous team's roster
  db.teams.forEach(t => {
    if (t.players) {
      t.players = t.players.filter(tp => (tp.playerId || tp.id) !== player.id);
    }
  });

  // Update auction_players record
  if (!db.auction_players) db.auction_players = [];
  const apIdx = db.auction_players.findIndex(ap => ap.auction_id === auctionEngine.auctionId && ap.player_id === player.id);
  if (apIdx !== -1) {
    db.auction_players[apIdx].auction_status = 'SOLD';
    db.auction_players[apIdx].sold_team_id = teamId;
    db.auction_players[apIdx].sold_price = numAmount;
    db.auction_players[apIdx].soldPrice = numAmount;
    db.auction_players[apIdx].updated_at = now;
  }

  // Update master player cache
  const pIdx = db.players.findIndex(p => p.id === player.id);
  if (pIdx !== -1) {
    db.players[pIdx].status = 'SOLD';
    db.players[pIdx].soldTo = teamId;
    db.players[pIdx].soldPrice = numAmount;
    db.players[pIdx].price = numAmount;
    db.players[pIdx].soldAt = new Date(now).toISOString();
  }

  // Deduct budget & record in winning team
  const tIdx = db.teams.findIndex(t => t.id === teamId);
  if (tIdx !== -1) {
    if (!db.teams[tIdx].players) db.teams[tIdx].players = [];
    const master = db.players[pIdx] || player;
    db.teams[tIdx].players.push({
      id: player.id,
      playerId: player.id,
      name: master.full_name || master.name || player.name,
      fullName: master.full_name || master.name || player.name,
      category: master.category || player.category || 'Category A',
      price: numAmount,
      soldPrice: numAmount,
      finalPrice: numAmount,
      registrationId: master.registration_id || master.registrationId || (player.id ? player.id.slice(-3) : ''),
      imageUrl: master.image_url || master.imageUrl || null,
      purchasedAt: new Date(now).toISOString()
    });

    db.teams[tIdx] = enrichTeam(db.teams[tIdx], auctionEngine.auctionId);
  }

  // Record purchase
  db.purchases.push({
    id: uuidv4(),
    auctionId: auctionEngine.auctionId,
    playerId: player.id,
    teamId,
    finalPrice: numAmount,
    price: numAmount,
    soldPrice: numAmount,
    soldAt: now,
    serverTimestamp: new Date(now).toISOString()
  });

  auctionEngine.status = 'SOLD';
  clearTimer();
  persistCurrentRound();
  saveDb();

  const enrichedSoldTeam = enrichTeam(db.teams[tIdx], auctionEngine.auctionId);
  const enrichedSoldPlayer = {
    ...(db.players[pIdx] || player),
    status: 'SOLD',
    soldTo: teamId,
    soldPrice: numAmount,
    price: numAmount,
    finalPrice: numAmount
  };

  broadcast('PLAYER_SOLD', {
    player: enrichedSoldPlayer,
    team: enrichedSoldTeam,
    finalPrice: numAmount,
    soldPrice: numAmount,
    price: numAmount,
    by
  });

  broadcast('TEAM_UPDATED', {
    team: enrichedSoldTeam
  });

  setTimeout(() => {
    clearCurrentRound();
    broadcast('AUCTION_READY', { message: 'Select next player' });
  }, 3000);
}

function markCurrentPlayerUnsold(by) {
  const player = auctionEngine.currentPlayer;
  if (!player) return;

  const now = Date.now();

  // Update auction_players record
  if (!db.auction_players) db.auction_players = [];
  const apIdx = db.auction_players.findIndex(ap => ap.auction_id === auctionEngine.auctionId && ap.player_id === player.id);
  if (apIdx !== -1) {
    db.auction_players[apIdx].auction_status = 'UNSOLD';
    db.auction_players[apIdx].sold_team_id = null;
    db.auction_players[apIdx].sold_price = null;
    db.auction_players[apIdx].updated_at = now;
  }

  const pIdx = db.players.findIndex(p => p.id === player.id);
  if (pIdx !== -1) {
    db.players[pIdx].status = 'UNSOLD';
    db.players[pIdx].soldTo = null;
    db.players[pIdx].soldPrice = null;
    db.players[pIdx].unsoldAt = new Date(now).toISOString();
  }

  auctionEngine.status = 'UNSOLD';
  clearTimer();
  persistCurrentRound();
  saveDb();

  broadcast('PLAYER_UNSOLD', { player: { ...(db.players[pIdx] || player), status: 'UNSOLD' }, by });

  setTimeout(() => {
    clearCurrentRound();
    broadcast('AUCTION_READY', { message: 'Select next player' });
  }, 2000);
}

// ─── Enriched Auction Players & Snapshots ──────────────────────────────────────
function getEnrichedAuctionPlayers(auctionId) {
  if (!db.auction_players) db.auction_players = [];
  if (!db.players) db.players = [];

  let auctionPlayers = db.auction_players.filter(ap => ap.auction_id === auctionId);

  // Auto-associate active master players if auction has none
  if (auctionPlayers.length === 0 && db.players.length > 0 && auctionId) {
    const activePlayers = db.players.filter(p => p.is_active !== false);
    activePlayers.forEach((p, idx) => {
      const ap = {
        id: uuidv4(),
        auction_id: auctionId,
        player_id: p.id,
        auction_category: p.category || 'Category A',
        auction_base_price: p.base_price || 100,
        auction_status: 'WAITING',
        sold_price: null,
        sold_team_id: null,
        auction_order: idx + 1,
        is_current_player: false,
        current_bid: 0,
        created_at: Date.now(),
        updated_at: Date.now()
      };
      db.auction_players.push(ap);
    });
    saveDb();
    auctionPlayers = db.auction_players.filter(ap => ap.auction_id === auctionId);
  }

  const enriched = auctionPlayers.map(ap => {
    const master = db.players.find(p => p.id === ap.player_id) || {};
    return {
      ...master,
      id: master.id || ap.player_id,
      masterPlayerId: master.id || ap.player_id,
      auctionPlayerId: ap.id,
      auctionId: ap.auction_id,
      status: ap.auction_status || 'WAITING',
      soldTo: ap.sold_team_id || master.soldTo || null,
      soldPrice: ap.sold_price !== null && ap.sold_price !== undefined
        ? Number(ap.sold_price)
        : (master.soldPrice !== null && master.soldPrice !== undefined ? Number(master.soldPrice) : null),
      sold_price: ap.sold_price !== null && ap.sold_price !== undefined
        ? Number(ap.sold_price)
        : (master.soldPrice !== null && master.soldPrice !== undefined ? Number(master.soldPrice) : null),
      price: ap.sold_price !== null && ap.sold_price !== undefined
        ? Number(ap.sold_price)
        : (master.soldPrice !== null && master.soldPrice !== undefined ? Number(master.soldPrice) : (ap.auction_base_price || master.base_price || 100)),
      basePrice: ap.auction_base_price || master.base_price || 100,
      auctionOrder: ap.auction_order || 999,
      isCurrentPlayer: ap.is_current_player || false,
      name: master.full_name || master.name || 'Player',
      fullName: master.full_name || master.name || 'Player',
      displayName: master.display_name || master.full_name || master.name || 'Player',
      registrationId: master.registration_id || master.registrationId || '',
      playerType: master.player_type || master.playerType || 'NEW',
      category: master.category || 'Category A',
      scoreOutOf5: master.score_out_of_5 ?? 3.5,
      overallRating: master.overall_rating ?? 75,
      xFactor: master.x_factor || master.xfactor || '',
      experience: master.experience || '',
      speciality: master.speciality || '',
      bio: master.bio || '',
      imageUrl: master.image_url || master.imageUrl || null,
      isHighlighted: master.is_highlighted || false,
      highlightReason: master.highlight_reason || '',
      stats: master.stats || {}
    };
  });

  return enriched.sort((a, b) => (a.auctionOrder || 999) - (b.auctionOrder || 999));
}

function getSnapshot(customAuctionId) {
  const targetAuctionId = customAuctionId || auctionEngine.auctionId;
  const auction = db.auctions.find(a => a.id === targetAuctionId);
  const teams = db.teams.filter(t => t.auctionId === targetAuctionId).map(t => enrichTeam(t, targetAuctionId));
  const players = getEnrichedAuctionPlayers(targetAuctionId);
  const recentBids = db.bids
    .filter(b => b.auctionId === targetAuctionId &&
      auctionEngine.auctionId === targetAuctionId &&
      auctionEngine.currentPlayer &&
      b.playerId === auctionEngine.currentPlayer.id)
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 15);

  const now = Date.now();
  const isEngineActive = auctionEngine.auctionId === targetAuctionId;

  return {
    auctionId: targetAuctionId,
    auction: auction || null,
    status: isEngineActive ? auctionEngine.status : (auction?.status || 'DRAFT'),
    serverTime: new Date(now).toISOString(),
    serverTimeMs: now,
    currentPlayer: isEngineActive && auctionEngine.currentPlayer ? enrichPlayer(auctionEngine.currentPlayer) : null,
    currentBid: isEngineActive ? auctionEngine.currentBid : 0,
    highestBidder: isEngineActive ? auctionEngine.highestBidder : null,
    highestBidderName: isEngineActive ? auctionEngine.highestBidderName : null,
    endsAt: isEngineActive ? auctionEngine.endsAt : null,
    bidEndsAt: isEngineActive && auctionEngine.endsAt ? new Date(auctionEngine.endsAt).toISOString() : null,
    sequence: auctionEngine.sequence,
    teams,
    players,
    recentBids
  };
}


function persistCurrentRound() {
  const auction = db.auctions.find(a => a.id === auctionEngine.auctionId);
  if (!auction) return;

  auction.currentPlayerId = auctionEngine.currentPlayer?.id || null;
  auction.currentBid = Number(auctionEngine.currentBid) || 0;
  auction.highestBidder = auctionEngine.highestBidder || null;
  auction.highestBidderName = auctionEngine.highestBidderName || null;
  auction.roundStatus = auctionEngine.status;
  auction.endsAt = auctionEngine.endsAt || null;
  auction.pausedRemaining = auctionEngine.pausedRemaining || null;
}

function clearCurrentRound() {
  auctionEngine.currentPlayer = null;
  auctionEngine.currentBid = 0;
  auctionEngine.highestBidder = null;
  auctionEngine.highestBidderName = null;
  auctionEngine.endsAt = null;
  auctionEngine.pausedRemaining = null;
  auctionEngine.status = 'READY';
  persistCurrentRound();
  saveDb();
}

// ─── Authentication & Authorization Middleware ──────────────────────────────
function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.replace(/^Bearer\s+/i, '');

  if (!token) {
    return res.status(401).json({ error: 'Authentication required', reason: 'NO_TOKEN' });
  }

  const userId = token.replace(/^token-/, '');
  const user = db.users.find(u => u.id === userId || `token-${u.id}` === token);

  if (!user) {
    return res.status(401).json({ error: 'Invalid or expired session token', reason: 'INVALID_TOKEN' });
  }

  const { password: _, ...safeUser } = user;
  req.user = safeUser;
  next();
}

function requireRole(roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required', reason: 'UNAUTHENTICATED' });
    }
    const allowed = Array.isArray(roles) ? roles : [roles];
    if (!allowed.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions for this action', reason: 'FORBIDDEN' });
    }
    next();
  };
}

// ═══════════════════════════════════════════════════════════════════════════
//  API ROUTES ROUTER
// ═══════════════════════════════════════════════════════════════════════════
const router = express.Router();

// ── Time Synchronization ────────────────────────────────────────────────────
router.get('/time', (req, res) => {
  const now = Date.now();
  res.json({
    serverTime: new Date(now).toISOString(),
    serverTimeMs: now,
    timezone: 'UTC',
    displayTimezone: 'Asia/Kolkata'
  });
});

// ── Auth ────────────────────────────────────────────────────────────────────
router.post('/auth/login', (req, res) => {
  const cleanEmail = (req.body.email || '').trim().toLowerCase();
  const cleanPassword = (req.body.password || '').trim();
  const user = db.users.find(u => 
    u.email.toLowerCase() === cleanEmail && 
    (u.password === cleanPassword || u.password.toLowerCase() === cleanPassword.toLowerCase())
  );
  if (!user) return res.status(401).json({ error: 'Invalid email or password' });
  const { password: _, ...safeUser } = user;
  res.json({ user: safeUser, token: `token-${user.id}` });
});

router.post('/auth/register', (req, res) => {
  const { name, email, password, role } = req.body;
  if (db.users.find(u => u.email.toLowerCase() === (email || '').toLowerCase())) {
    return res.status(400).json({ error: 'User already exists' });
  }
  const user = { id: uuidv4(), name, email, password, role: role || 'viewer' };
  db.users.push(user);
  saveDb();
  const { password: _, ...safeUser } = user;
  res.json({ user: safeUser, token: `token-${user.id}` });
});

router.get('/auth/me', authenticateToken, (req, res) => {
  res.json({ user: req.user });
});

// ── Auctions ─────────────────────────────────────────────────────────────────
router.get('/auctions', (req, res) => {
  res.json(db.auctions);
});

router.post('/auctions', authenticateToken, requireRole(['admin']), (req, res) => {
  const now = Date.now();
  const auctionSettings = { ...req.body };
  delete auctionSettings.bidIncrement;
  let scheduledAt = req.body.scheduledAt || null;
  
  if (!scheduledAt && req.body.auctionDate) {
    try {
      const parsed = new Date(req.body.auctionDate);
      if (!isNaN(parsed.getTime())) scheduledAt = parsed.toISOString();
    } catch {
      scheduledAt = null;
    }
  }

  const initialStatus = scheduledAt && new Date(scheduledAt).getTime() > now ? 'SCHEDULED' : (req.body.status || 'DRAFT');

  const auction = {
    id: uuidv4(),
    ...auctionSettings,
    scheduledAt,
    startedAt: null,
    endedAt: null,
    status: initialStatus,
    startingBudget: Number(req.body.startingBudget) || 100000,
    minimumBid: Number(req.body.minimumBid) || 1000,
    playerTimer: Number(req.body.playerTimer) || 120,
    numTeams: Number(req.body.numTeams) || 8,
    createdAt: now,
    createdServerTimestamp: new Date(now).toISOString()
  };
  db.auctions.push(auction);

  // If there are master players, clone/attach to this new auction if needed
  if (db.players && db.players.length > 0) {
    const existingForAuction = db.players.filter(p => p.auctionId === auction.id);
    if (existingForAuction.length === 0) {
      // Duplicate master players template for this new auction
      db.players.forEach(p => {
        if (!p.auctionId) p.auctionId = auction.id;
      });
    }
  }

  saveDb();
  res.json(auction);
});

router.get('/auctions/:id', (req, res) => {
  const auction = db.auctions.find(a => a.id === req.params.id);
  if (!auction) return res.status(404).json({ error: 'Auction not found' });
  res.json(auction);
});

router.patch('/auctions/:id', authenticateToken, requireRole(['admin']), (req, res) => {
  const idx = db.auctions.findIndex(a => a.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Auction not found' });
  
  const updates = { ...req.body };
  if (updates.scheduledAt) {
    try {
      updates.scheduledAt = new Date(updates.scheduledAt).toISOString();
    } catch {
      // keep
    }
  }

  db.auctions[idx] = { ...db.auctions[idx], ...updates };
  saveDb();
  res.json(db.auctions[idx]);
});

router.delete('/auctions/:id', authenticateToken, requireRole(['admin']), (req, res) => {
  const idx = db.auctions.findIndex(a => a.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Auction not found' });
  
  const deletedAuction = db.auctions[idx];
  db.auctions.splice(idx, 1);

  // Remove associated teams
  db.teams = db.teams.filter(t => t.auctionId !== req.params.id);
  // Clear auctionId or remove players tied exclusively to this auction
  db.players.forEach(p => {
    if (p.auctionId === req.params.id) {
      p.status = 'WAITING';
      p.soldTo = null;
      p.soldPrice = null;
    }
  });
  // Clear bids & events
  db.bids = db.bids.filter(b => b.auctionId !== req.params.id);
  db.purchases = db.purchases.filter(p => p.auctionId !== req.params.id);
  db.events = db.events.filter(e => e.auctionId !== req.params.id);

  if (auctionEngine.auctionId === req.params.id) {
    clearTimer();
    auctionEngine.auctionId = null;
    auctionEngine.status = null;
    auctionEngine.currentPlayer = null;
    auctionEngine.currentBid = 0;
    auctionEngine.highestBidder = null;
    auctionEngine.highestBidderName = null;
  }

  saveDb();
  broadcast('AUCTION_DELETED', { auctionId: req.params.id });
  res.json({ success: true, message: 'Auction deleted successfully', auction: deletedAuction });
});


// ── State & Snapshots ───────────────────────────────────────────────────────
router.get('/auctions/:id/snapshot', (req, res) => {
  const auction = db.auctions.find(a => a.id === req.params.id);
  if (!auction) return res.status(404).json({ error: 'Auction not found' });
  res.json(getSnapshot(req.params.id));
});

router.get('/auctions/:id/state', (req, res) => {
  const auction = db.auctions.find(a => a.id === req.params.id);
  if (!auction) return res.status(404).json({ error: 'Auction not found' });
  res.json(getSnapshot(req.params.id));
});

// ── Auction Control ─────────────────────────────────────────────────────────
router.post('/auctions/:id/start', authenticateToken, requireRole(['admin']), (req, res) => {
  if (startAuctionLock) {
    return res.status(429).json({ error: 'Auction start operation already in progress', reason: 'CONCURRENT_REQUEST' });
  }

  startAuctionLock = true;
  try {
    const aIdx = db.auctions.findIndex(a => a.id === req.params.id);
    if (aIdx === -1) {
      return res.status(404).json({ error: 'Auction not found', reason: 'NOT_FOUND' });
    }

    const auction = db.auctions[aIdx];
    const now = Date.now();

    if (auction.status === 'LIVE') {
      return res.status(400).json({
        error: 'Auction is already live',
        reason: 'AUCTION_ALREADY_LIVE',
        startedAt: auction.startedAt
      });
    }

    if (auction.scheduledAt) {
      const scheduledTimeMs = new Date(auction.scheduledAt).getTime();
      if (!isNaN(scheduledTimeMs) && scheduledTimeMs > now) {
        return res.status(400).json({
          error: 'Auction scheduled time has not been reached yet',
          reason: 'AUCTION_NOT_STARTED_YET',
          scheduledAt: auction.scheduledAt,
          serverTime: new Date(now).toISOString(),
          msRemaining: scheduledTimeMs - now
        });
      }
    }

    const startedAtIso = new Date(now).toISOString();
    db.auctions[aIdx].status = 'LIVE';
    db.auctions[aIdx].startedAt = startedAtIso;

    clearTimer();
    auctionEngine.auctionId = req.params.id;
    auctionEngine.status = 'READY';
    auctionEngine.currentPlayer = null;
    auctionEngine.currentBid = 0;
    auctionEngine.highestBidder = null;
    auctionEngine.highestBidderName = null;
    auctionEngine.endsAt = null;
    auctionEngine.pausedRemaining = null;

    persistCurrentRound();
    saveDb();

    broadcast('AUCTION_STARTED', {
      auction: db.auctions[aIdx],
      startedAt: startedAtIso
    });

    const snapshot = getSnapshot(req.params.id);
    res.json({ success: true, auction: db.auctions[aIdx], snapshot });
  } finally {
    startAuctionLock = false;
  }
});

router.post('/auctions/:id/pause', authenticateToken, requireRole(['admin']), (req, res) => {
  if (!ensureEngineActive(req.params.id)) {
    return res.status(404).json({ error: 'Auction not found' });
  }
  if (auctionEngine.status === 'LIVE') {
    auctionEngine.pausedRemaining = Math.max(0, auctionEngine.endsAt - Date.now());
    clearTimer();
    auctionEngine.status = 'PAUSED';
    persistCurrentRound();
    saveDb();
    broadcast('AUCTION_PAUSED', { pausedRemaining: auctionEngine.pausedRemaining });
  }
  res.json({ success: true, status: auctionEngine.status });
});

router.post('/auctions/:id/resume', authenticateToken, requireRole(['admin']), (req, res) => {
  if (!ensureEngineActive(req.params.id)) {
    return res.status(404).json({ error: 'Auction not found' });
  }
  if (auctionEngine.status === 'PAUSED') {
    const remaining = auctionEngine.pausedRemaining || 10000;
    auctionEngine.status = 'LIVE';
    auctionEngine.pausedRemaining = null;
    startTimer(remaining);
    persistCurrentRound();
    saveDb();
    broadcast('AUCTION_RESUMED', {
      endsAt: auctionEngine.endsAt,
      bidEndsAt: new Date(auctionEngine.endsAt).toISOString()
    });
  }
  res.json({ success: true, status: auctionEngine.status, endsAt: auctionEngine.endsAt });
});

router.post('/auctions/:id/next-player', authenticateToken, requireRole(['admin']), (req, res) => {
  if (!ensureEngineActive(req.params.id)) {
    return res.status(404).json({ error: 'Auction not found' });
  }

  const enriched = getEnrichedAuctionPlayers(req.params.id);
  const waitingPlayers = enriched.filter(p => p.status === 'WAITING');

  let player = null;
  if (req.body.playerId && req.body.playerId !== 'random') {
    player = enriched.find(p => p.id === req.body.playerId || p.masterPlayerId === req.body.playerId);
  } else {
    if (waitingPlayers.length === 0) {
      return res.status(400).json({ error: 'No waiting players remaining in auction pool' });
    }
    const randIdx = Math.floor(Math.random() * waitingPlayers.length);
    player = waitingPlayers[randIdx];
  }

  if (!player) return res.status(404).json({ error: 'Player not found' });

  const auction = db.auctions.find(a => a.id === req.params.id);
  const timerSec = auction?.playerTimer || 120;
  const timerMs = timerSec * 1000;

  clearTimer();
  auctionEngine.currentPlayer = enrichPlayer(player);
  auctionEngine.currentBid = player.basePrice || player.base_price || 0;
  auctionEngine.highestBidder = null;
  auctionEngine.highestBidderName = null;
  auctionEngine.status = 'LIVE';
  auctionEngine.pausedRemaining = null;
  auctionEngine.bidStartedAt = new Date().toISOString();

  // Update auction_players status
  if (!db.auction_players) db.auction_players = [];
  db.auction_players.forEach(ap => {
    if (ap.auction_id === req.params.id) {
      if (ap.player_id === player.id || ap.player_id === player.masterPlayerId) {
        ap.auction_status = 'LIVE';
        ap.is_current_player = true;
        ap.updated_at = Date.now();
      } else if (ap.is_current_player) {
        ap.is_current_player = false;
      }
    }
  });

  const pIdx = db.players.findIndex(p => p.id === player.id || p.id === player.masterPlayerId);
  if (pIdx !== -1) {
    db.players[pIdx].status = 'LIVE';
  }

  startTimer(timerMs);
  persistCurrentRound();
  saveDb();

  broadcast('PLAYER_STARTED', {
    player: { ...player, status: 'LIVE' },
    currentBid: auctionEngine.currentBid,
    endsAt: auctionEngine.endsAt,
    bidEndsAt: new Date(auctionEngine.endsAt).toISOString(),
    bidStartedAt: auctionEngine.bidStartedAt
  });

  res.json({
    success: true,
    player: { ...player, status: 'LIVE' },
    endsAt: auctionEngine.endsAt,
    bidEndsAt: new Date(auctionEngine.endsAt).toISOString()
  });
});

router.post('/auctions/:id/shuffle-players', authenticateToken, requireRole(['admin']), (req, res) => {
  if (!db.auction_players) db.auction_players = [];
  const waiting = db.auction_players.filter(ap => ap.auction_id === req.params.id && ap.auction_status === 'WAITING');
  for (let i = waiting.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [waiting[i], waiting[j]] = [waiting[j], waiting[i]];
  }
  waiting.forEach((ap, idx) => {
    ap.auction_order = idx + 1;
    ap.updated_at = Date.now();
  });
  saveDb();
  res.json({ success: true, count: waiting.length });
});

// ── Bidding ─────────────────────────────────────────────────────────────────
router.post('/auctions/:id/bid', authenticateToken, requireRole(['captain', 'admin']), (req, res) => {
  const now = Date.now();
  const { teamId, increment, requestId } = req.body;

  if (!ensureEngineActive(req.params.id)) {
    return res.status(404).json({ error: 'Auction not found', reason: 'AUCTION_NOT_ACTIVE' });
  }
  if (auctionEngine.status !== 'LIVE') {
    return res.status(400).json({ error: 'Auction is currently not live for bidding', reason: 'AUCTION_NOT_LIVE' });
  }
  if (!auctionEngine.currentPlayer) {
    return res.status(400).json({ error: 'No active player round', reason: 'NO_ACTIVE_PLAYER' });
  }

  const team = db.teams.find(t => t.id === teamId && t.auctionId === req.params.id);
  if (!team) {
    return res.status(400).json({ error: 'Invalid team or team not found in auction', reason: 'INVALID_TEAM' });
  }

  if (req.user.role === 'captain') {
    const isOwner = (req.user.teamId && req.user.teamId === teamId) ||
                    (team.captainId && team.captainId === req.user.id) ||
                    (team.captainEmail && team.captainEmail.toLowerCase() === req.user.email.toLowerCase());
    if (!isOwner) {
      return res.status(403).json({ error: 'You are not authorized to bid on behalf of this team', reason: 'UNAUTHORIZED_TEAM' });
    }
  }

  if (requestId) {
    const existingBid = db.bids.find(b => b.requestId === requestId);
    if (existingBid) {
      return res.json({ success: true, bid: existingBid, duplicate: true });
    }
  }

  if (auctionEngine.endsAt && now > auctionEngine.endsAt) {
    return res.status(400).json({ error: 'Bidding deadline has expired', reason: 'TIMER_EXPIRED' });
  }

  if (!Number.isSafeInteger(increment) || increment <= 0) {
    return res.status(400).json({ error: 'Bid increment must be a positive whole number', reason: 'INVALID_INCREMENT' });
  }

  const auction = db.auctions.find(a => a.id === req.params.id);
  const teamPlayers = (team.players || []).length;
  if (auction?.maxSquadSize && teamPlayers >= auction.maxSquadSize) {
    return res.status(400).json({ error: 'Team squad is full', reason: 'TEAM_FULL' });
  }

  if (auctionEngine.highestBidder === teamId) {
    return res.status(400).json({ error: 'You are already the highest bidder', reason: 'ALREADY_HIGHEST' });
  }

  const currentBidNum = Number(auctionEngine.currentBid || 0);
  const numAmount = currentBidNum + increment;
  if (!Number.isSafeInteger(numAmount)) {
    return res.status(400).json({ error: 'Resulting bid is out of range', reason: 'INVALID_INCREMENT' });
  }

  if (team.remainingBudget < numAmount) {
    return res.status(400).json({
      error: `Insufficient budget! Remaining: ${team.remainingBudget} QC`,
      reason: 'INSUFFICIENT_BUDGET',
      remainingBudget: team.remainingBudget
    });
  }

  auctionEngine.currentBid = numAmount;
  auctionEngine.highestBidder = teamId;
  auctionEngine.highestBidderName = team.name;
  persistCurrentRound();

  const remaining = auctionEngine.endsAt - now;
  const extensionMs = (auctionEngine.bidExtension || 10) * 1000;
  if (remaining < extensionMs) {
    startTimer(extensionMs);
  }
  persistCurrentRound();

  const bid = {
    id: uuidv4(),
    auctionId: req.params.id,
    playerId: auctionEngine.currentPlayer.id,
    teamId,
    increment,
    amount: numAmount,
    requestId: requestId || uuidv4(),
    sequence: auctionEngine.sequence + 1,
    createdAt: now,
    serverTimestamp: new Date(now).toISOString()
  };
  db.bids.push(bid);
  saveDb();

  broadcast('BID_PLACED', {
    bid,
    currentBid: numAmount,
    highestBidder: teamId,
    highestBidderName: team.name,
    endsAt: auctionEngine.endsAt,
    bidEndsAt: new Date(auctionEngine.endsAt).toISOString(),
    playerId: auctionEngine.currentPlayer.id
  });

  res.json({ success: true, bid });
});

// Admin force sold
router.post('/auctions/:id/force-sold', authenticateToken, requireRole(['admin']), (req, res) => {
  if (!ensureEngineActive(req.params.id)) return res.status(404).json({ error: 'Auction not found' });
  const { teamId, amount } = req.body;
  if (!teamId) return res.status(400).json({ error: 'Team required' });
  sellCurrentPlayer(teamId, amount || auctionEngine.currentBid, 'admin');
  res.json({ success: true });
});

// Admin force unsold
router.post('/auctions/:id/force-unsold', authenticateToken, requireRole(['admin']), (req, res) => {
  if (!ensureEngineActive(req.params.id)) return res.status(404).json({ error: 'Auction not found' });
  markCurrentPlayerUnsold('admin');
  res.json({ success: true });
});

// Admin extend timer
router.post('/auctions/:id/extend-timer', authenticateToken, requireRole(['admin']), (req, res) => {
  if (!ensureEngineActive(req.params.id)) return res.status(404).json({ error: 'Auction not found' });
  const { seconds } = req.body;
  if (auctionEngine.status === 'LIVE' && auctionEngine.endsAt) {
    auctionEngine.endsAt += (seconds || 10) * 1000;
    saveDb();
    broadcast('TIMER_EXTENDED', {
      endsAt: auctionEngine.endsAt,
      bidEndsAt: new Date(auctionEngine.endsAt).toISOString()
    });
  }
  res.json({ success: true, endsAt: auctionEngine.endsAt });
});

// Complete auction
router.post('/auctions/:id/complete', authenticateToken, requireRole(['admin']), (req, res) => {
  const aIdx = db.auctions.findIndex(a => a.id === req.params.id);
  if (aIdx === -1) return res.status(404).json({ error: 'Auction not found' });
  const now = Date.now();
  db.auctions[aIdx].status = 'COMPLETED';
  db.auctions[aIdx].endedAt = new Date(now).toISOString();
  if (auctionEngine.auctionId === req.params.id) {
    clearTimer();
    auctionEngine.status = 'COMPLETED';
  }
  saveDb();
  broadcast('AUCTION_COMPLETED', { auction: db.auctions[aIdx] });
  res.json({ success: true, auction: db.auctions[aIdx] });
});

// ── Teams with Logo Support ─────────────────────────────────────────────────
router.get('/auctions/:id/teams', (req, res) => {
  const teams = db.teams.filter(t => t.auctionId === req.params.id);
  res.json(teams.map(t => enrichTeam(t, req.params.id)));
});

router.get('/teams/:id', (req, res) => {
  const team = db.teams.find(t => t.id === req.params.id);
  if (!team) return res.status(404).json({ error: 'Team not found' });
  res.json(enrichTeam(team, team.auctionId));
});

router.post('/auctions/:id/teams', authenticateToken, requireRole(['admin']), upload.single('logo'), (req, res) => {
  const auction = db.auctions.find(a => a.id === req.params.id);
  if (!auction) return res.status(404).json({ error: 'Auction not found' });

  const budget = Number(req.body.budget) || auction.startingBudget || 100000;
  const logoUrl = req.file ? `/uploads/${req.file.filename}` : (req.body.logoUrl || null);

  const team = enrichTeam({
    id: uuidv4(),
    auctionId: req.params.id,
    name: req.body.name,
    tag: req.body.tag || req.body.name?.substring(0, 3).toUpperCase(),
    logoUrl,
    remainingBudget: budget,
    initialBudget: budget,
    totalSpent: 0,
    captainName: req.body.captainName || '',
    captainEmail: req.body.captainEmail || '',
    players: [],
    createdAt: Date.now()
  }, req.params.id);

  if (req.body.captainEmail && req.body.captainPassword) {
    const existingUser = db.users.find(u => u.email.toLowerCase() === req.body.captainEmail.toLowerCase());
    if (!existingUser) {
      const captainUser = {
        id: uuidv4(),
        name: req.body.captainName || req.body.name + ' Captain',
        email: req.body.captainEmail,
        password: req.body.captainPassword,
        role: 'captain',
        teamId: team.id,
        auctionId: req.params.id
      };
      db.users.push(captainUser);
      team.captainId = captainUser.id;
    } else {
      existingUser.teamId = team.id;
      existingUser.auctionId = req.params.id;
      team.captainId = existingUser.id;
    }
  }

  db.teams.push(team);
  saveDb();
  broadcast('TEAM_UPDATED', { team });
  res.json(team);
});

router.patch('/teams/:id', authenticateToken, requireRole(['admin']), upload.single('logo'), (req, res) => {
  const idx = db.teams.findIndex(t => t.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Team not found' });
  
  const updates = { ...req.body };
  if (req.file) {
    updates.logoUrl = `/uploads/${req.file.filename}`;
  }
  if (req.body.budget !== undefined) {
    const newBudget = Number(req.body.budget);
    const diff = newBudget - (db.teams[idx].initialBudget || 0);
    updates.initialBudget = newBudget;
    updates.remainingBudget = Math.max(0, (db.teams[idx].remainingBudget || 0) + diff);
  }

  db.teams[idx] = enrichTeam({ ...db.teams[idx], ...updates }, db.teams[idx].auctionId);
  saveDb();
  broadcast('TEAM_UPDATED', { team: db.teams[idx] });
  res.json(db.teams[idx]);
});

router.post('/teams/:id/topup', authenticateToken, requireRole(['admin']), (req, res) => {
  const idx = db.teams.findIndex(t => t.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Team not found' });
  const amount = Number(req.body.amount || 0);
  db.teams[idx].initialBudget = (db.teams[idx].initialBudget || 0) + amount;
  db.teams[idx].remainingBudget = (db.teams[idx].remainingBudget || 0) + amount;
  db.teams[idx] = enrichTeam(db.teams[idx], db.teams[idx].auctionId);
  saveDb();
  broadcast('TEAM_UPDATED', { team: db.teams[idx] });
  res.json(db.teams[idx]);
});

router.delete('/teams/:id', authenticateToken, requireRole(['admin']), (req, res) => {
  const idx = db.teams.findIndex(t => t.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Team not found' });
  const deletedId = req.params.id;
  db.teams.splice(idx, 1);
  saveDb();
  broadcast('TEAM_DELETED', { teamId: deletedId });
  res.json({ success: true });
});

// ── Master & Auction Players Directory ──────────────────────────────────────
router.get('/players', (req, res) => {
  const { 
    search, 
    playerType, 
    category, 
    status, 
    isHighlighted, 
    hasPhoto, 
    includeArchived 
  } = req.query;

  let list = db.players.slice();

  // Filter archived by default unless includeArchived=true or status filter explicitly requests
  if (status === 'ARCHIVED') {
    list = list.filter(p => p.is_active === false);
  } else if (status === 'ACTIVE') {
    list = list.filter(p => p.is_active !== false);
  } else if (includeArchived !== 'true') {
    list = list.filter(p => p.is_active !== false);
  }

  if (playerType && playerType !== 'ALL') {
    list = list.filter(p => (p.player_type || p.playerType || '').toUpperCase() === playerType.toUpperCase());
  }

  if (category && category !== 'ALL') {
    list = list.filter(p => (p.category || '').toUpperCase() === category.toUpperCase());
  }

  if (isHighlighted === 'true') {
    list = list.filter(p => p.is_highlighted === true);
  }

  if (hasPhoto === 'true') {
    list = list.filter(p => Boolean(p.image_url || p.imageUrl));
  } else if (hasPhoto === 'false') {
    list = list.filter(p => !p.image_url && !p.imageUrl);
  }

  if (search && search.trim()) {
    const q = search.trim().toLowerCase();
    list = list.filter(p => {
      const name = (p.full_name || p.name || '').toLowerCase();
      const reg = (p.registration_id || p.registrationId || '').toLowerCase();
      const spec = (p.speciality || '').toLowerCase();
      const xf = (p.x_factor || p.xfactor || '').toLowerCase();
      const cat = (p.category || '').toLowerCase();
      return name.includes(q) || reg.includes(q) || spec.includes(q) || xf.includes(q) || cat.includes(q);
    });
  }

  // Consistent sorting & category guarantee
  list = list.map(p => ({
    ...p,
    category: getCategoryLabel(p.category)
  }));

  list.sort((a, b) => {
    const nameA = (a.full_name || a.name || '').toLowerCase();
    const nameB = (b.full_name || b.name || '').toLowerCase();
    return nameA.localeCompare(nameB);
  });

  res.json(list);
});

// Single Player Detail with Complete Auction History
router.get('/players/:id', (req, res) => {
  const player = db.players.find(p => p.id === req.params.id);
  if (!player) return res.status(404).json({ error: 'Player not found in master database' });

  // Gather complete auction history
  const history = (db.auction_players || [])
    .filter(ap => ap.player_id === req.params.id)
    .map(ap => {
      const auc = db.auctions.find(a => a.id === ap.auction_id) || {};
      const team = ap.sold_team_id ? db.teams.find(t => t.id === ap.sold_team_id) : null;
      return {
        auctionId: ap.auction_id,
        auctionName: auc.name || auc.tournamentName || 'Auction',
        seriesName: auc.seriesName || 'Valor Cup',
        status: ap.auction_status || 'WAITING',
        basePrice: ap.auction_base_price || player.base_price || 100,
        soldPrice: ap.sold_price || null,
        soldTeam: team ? { id: team.id, name: team.name, tag: team.tag } : null,
        updatedAt: ap.updated_at || ap.created_at
      };
    });

  res.json({
    ...player,
    category: getCategoryLabel(player.category),
    auctionHistory: history
  });
});

// Create Master Player
router.post('/players', authenticateToken, requireRole(['admin']), upload.single('image'), (req, res) => {
  const { full_name, name, category, player_type, playerType, base_price, basePrice, last_year_price, lastYearPrice, x_factor, xfactor, experience, speciality, bio, is_highlighted, highlight_reason } = req.body;

  const resolvedName = full_name || name;
  if (!resolvedName || !resolvedName.trim()) {
    return res.status(400).json({ error: 'Player full name is required' });
  }

  const pid = uuidv4();
  const count = db.players.length + 1;
  const regId = req.body.registration_id || req.body.registrationId || `#P-${String(count).padStart(3, '0')}`;
  const cat = getCategoryLabel(category);
  const pType = (player_type || playerType || 'NEW').toUpperCase() === 'RETURNING' ? 'RETURNING' : 'NEW';

  const defaultBasePrice = cat === 'Category A' ? 100 : (cat === 'Category B' ? 60 : (cat === 'Category C' ? 40 : 200));
  const resolvedBasePrice = Number(base_price ?? basePrice ?? defaultBasePrice);

  const newPlayer = {
    id: pid,
    registration_id: regId,
    full_name: resolvedName.trim(),
    display_name: req.body.display_name || resolvedName.trim(),
    player_type: pType,
    category: cat,
    base_price: resolvedBasePrice,
    last_year_price: last_year_price ? Number(last_year_price) : (lastYearPrice ? Number(lastYearPrice) : null),
    score_out_of_5: Number(req.body.score_out_of_5) || 3.5,
    overall_rating: Number(req.body.overall_rating) || 75,
    x_factor: x_factor || xfactor || '',
    experience: experience || '',
    speciality: speciality || '',
    bio: bio || '',
    image_url: req.file ? `/uploads/${req.file.filename}` : (req.body.image_url || req.body.imageUrl || null),
    imageUrl: req.file ? `/uploads/${req.file.filename}` : (req.body.image_url || req.body.imageUrl || null),
    image_status: req.file || req.body.image_url || req.body.imageUrl ? 'UPLOADED' : 'PENDING',
    is_active: true,
    is_highlighted: is_highlighted === 'true' || is_highlighted === true,
    highlight_reason: highlight_reason || '',
    stats: req.body.stats ? (typeof req.body.stats === 'string' ? JSON.parse(req.body.stats) : req.body.stats) : {},
    created_at: Date.now(),
    updated_at: Date.now()
  };

  db.players.push(newPlayer);

  // If there are active auctions, auto-attach to auction_players
  db.auctions.forEach(auc => {
    if (auc.status !== 'COMPLETED') {
      if (!db.auction_players) db.auction_players = [];
      const exists = db.auction_players.some(ap => ap.auction_id === auc.id && ap.player_id === pid);
      if (!exists) {
        db.auction_players.push({
          id: uuidv4(),
          auction_id: auc.id,
          player_id: pid,
          auction_category: cat,
          auction_base_price: resolvedBasePrice,
          auction_status: 'WAITING',
          sold_price: null,
          sold_team_id: null,
          auction_order: db.auction_players.filter(ap => ap.auction_id === auc.id).length + 1,
          is_current_player: false,
          current_bid: 0,
          created_at: Date.now(),
          updated_at: Date.now()
        });
      }
    }
  });

  saveDb();
  broadcast('MASTER_PLAYER_CREATED', { player: newPlayer });
  res.status(201).json(newPlayer);
});

// Update Master Player
router.patch('/players/:id', authenticateToken, requireRole(['admin']), upload.single('image'), (req, res) => {
  const idx = db.players.findIndex(p => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Player not found in master database' });

  const existing = db.players[idx];
  const updates = { ...req.body };

  if (req.file) {
    const uploadedUrl = `/uploads/${req.file.filename}`;
    updates.image_url = uploadedUrl;
    updates.imageUrl = uploadedUrl;
    updates.image_status = 'UPLOADED';
  } else {
    if (updates.image_url !== undefined && !updates.imageUrl) {
      updates.imageUrl = updates.image_url;
    } else if (updates.imageUrl !== undefined && !updates.image_url) {
      updates.image_url = updates.imageUrl;
    }
  }
  if (updates.category) {
    updates.category = getCategoryLabel(updates.category);
  }
  if (updates.base_price !== undefined) updates.base_price = Number(updates.base_price);
  if (updates.last_year_price !== undefined) updates.last_year_price = updates.last_year_price ? Number(updates.last_year_price) : null;
  if (updates.score_out_of_5 !== undefined) updates.score_out_of_5 = Number(updates.score_out_of_5);
  if (updates.overall_rating !== undefined) updates.overall_rating = Number(updates.overall_rating);
  if (updates.is_highlighted !== undefined) updates.is_highlighted = updates.is_highlighted === 'true' || updates.is_highlighted === true;
  if (updates.is_active !== undefined) updates.is_active = updates.is_active === 'true' || updates.is_active === true;
  if (updates.stats && typeof updates.stats === 'string') {
    try { updates.stats = JSON.parse(updates.stats); } catch {}
  }
  updates.updated_at = Date.now();

  const updatedPlayer = { ...existing, ...updates };
  db.players[idx] = updatedPlayer;

  // Propagate changes to live auction if player is active round
  if (auctionEngine.currentPlayer && auctionEngine.currentPlayer.id === req.params.id) {
    auctionEngine.currentPlayer = {
      ...auctionEngine.currentPlayer,
      ...updatedPlayer,
      name: updatedPlayer.full_name || updatedPlayer.name,
      imageUrl: updatedPlayer.image_url || updatedPlayer.imageUrl
    };
  }

  saveDb();
  broadcast('PLAYER_UPDATED', { player: updatedPlayer });
  res.json(updatedPlayer);
});

// Upload Photo for Player
router.post('/players/:id/image', authenticateToken, requireRole(['admin']), upload.single('image'), (req, res) => {
  const idx = db.players.findIndex(p => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Player not found' });
  if (!req.file) return res.status(400).json({ error: 'No image file uploaded' });

  const imageUrl = `/uploads/${req.file.filename}`;
  db.players[idx].image_url = imageUrl;
  db.players[idx].imageUrl = imageUrl;
  db.players[idx].image_status = 'UPLOADED';
  db.players[idx].updated_at = Date.now();

  // Propagate to current active player if matched
  if (auctionEngine.currentPlayer && auctionEngine.currentPlayer.id === req.params.id) {
    auctionEngine.currentPlayer.imageUrl = imageUrl;
    auctionEngine.currentPlayer.image_url = imageUrl;
  }

  saveDb();
  broadcast('PLAYER_UPDATED', { player: db.players[idx] });
  res.json({ success: true, imageUrl, player: db.players[idx] });
});

// Remove Photo for Player
router.delete('/players/:id/image', authenticateToken, requireRole(['admin']), (req, res) => {
  const idx = db.players.findIndex(p => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Player not found' });

  db.players[idx].image_url = null;
  db.players[idx].imageUrl = null;
  db.players[idx].image_status = 'REMOVED';
  db.players[idx].updated_at = Date.now();

  if (auctionEngine.currentPlayer && auctionEngine.currentPlayer.id === req.params.id) {
    auctionEngine.currentPlayer.imageUrl = null;
    auctionEngine.currentPlayer.image_url = null;
  }

  saveDb();
  broadcast('PLAYER_UPDATED', { player: db.players[idx] });
  res.json({ success: true, player: db.players[idx] });
});

// Delete or Archive Master Player
router.delete('/players/:id', authenticateToken, requireRole(['admin']), (req, res) => {
  const idx = db.players.findIndex(p => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Player not found' });

  const player = db.players[idx];
  const forcePermanent = req.query.permanent === 'true';

  // Check if player has auction history
  const hasHistory = (db.auction_players || []).some(ap => ap.player_id === req.params.id && (ap.auction_status === 'SOLD' || ap.sold_price)) ||
                     (db.purchases || []).some(p => p.playerId === req.params.id) ||
                     (db.bids || []).some(b => b.playerId === req.params.id);

  if (hasHistory && !forcePermanent) {
    // Safe soft delete / archive
    db.players[idx].is_active = false;
    db.players[idx].updated_at = Date.now();
    saveDb();
    broadcast('PLAYER_ARCHIVED', { playerId: req.params.id, player: db.players[idx] });
    return res.json({ 
      success: true, 
      action: 'ARCHIVED',
      message: `Player "${player.full_name || player.name}" archived to preserve historical auction records.` 
    });
  }

  // Hard delete if no historical bids/sales or if permanent=true
  db.players.splice(idx, 1);
  if (db.auction_players) {
    db.auction_players = db.auction_players.filter(ap => ap.player_id !== req.params.id);
  }
  db.teams.forEach(t => {
    if (t.players) t.players = t.players.filter(item => item.playerId !== req.params.id);
  });

  if (auctionEngine.currentPlayer && auctionEngine.currentPlayer.id === req.params.id) {
    clearTimer();
    auctionEngine.currentPlayer = null;
    auctionEngine.currentBid = 0;
    auctionEngine.highestBidder = null;
    auctionEngine.highestBidderName = null;
    auctionEngine.status = 'READY';
    broadcast('AUCTION_READY', { message: 'Active player was removed' });
  }

  saveDb();
  broadcast('PLAYER_DELETED', { playerId: req.params.id, player });
  res.json({ success: true, action: 'DELETED', message: `Player "${player.full_name || player.name}" permanently deleted.` });
});

// Restore Archived Player
router.post('/players/:id/restore', authenticateToken, requireRole(['admin']), (req, res) => {
  const idx = db.players.findIndex(p => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Player not found' });

  db.players[idx].is_active = true;
  db.players[idx].updated_at = Date.now();
  saveDb();
  broadcast('PLAYER_UPDATED', { player: db.players[idx] });
  res.json({ success: true, player: db.players[idx] });
});

// Bulk Delete Players
router.post('/players/bulk-delete', authenticateToken, requireRole(['admin']), (req, res) => {
  const { playerIds } = req.body;
  if (!Array.isArray(playerIds) || playerIds.length === 0) {
    return res.status(400).json({ error: 'Array of playerIds is required' });
  }

  const idSet = new Set(playerIds);
  let archivedCount = 0;
  let deletedCount = 0;

  playerIds.forEach(id => {
    const idx = db.players.findIndex(p => p.id === id);
    if (idx !== -1) {
      const hasHistory = (db.purchases || []).some(p => p.playerId === id);
      if (hasHistory) {
        db.players[idx].is_active = false;
        archivedCount++;
      } else {
        db.players.splice(idx, 1);
        if (db.auction_players) {
          db.auction_players = db.auction_players.filter(ap => ap.player_id !== id);
        }
        deletedCount++;
      }
    }
  });

  saveDb();
  broadcast('PLAYERS_BULK_UPDATED', { playerIds });
  res.json({ success: true, archivedCount, deletedCount });
});

// ── Excel Import Preview & Commit ──────────────────────────────────────────
const excelUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

router.post('/players/import-excel-preview', authenticateToken, requireRole(['admin']), excelUpload.single('excel'), (req, res) => {
  try {
    let buffer = null;
    if (req.file) {
      buffer = req.file.buffer;
    } else {
      // Default fallback to workspace file if no file passed
      const defaultExcelPath = path.join(__dirname, '..', 'Player_Profile_Updated.xlsx');
      if (fs.existsSync(defaultExcelPath)) {
        buffer = fs.readFileSync(defaultExcelPath);
      }
    }

    if (!buffer) {
      return res.status(400).json({ error: 'Please upload an Excel (.xlsx / .xls) file.' });
    }

    const preview = parseExcelWorkbook(buffer, db.players);
    res.json({
      success: true,
      summary: preview.summary,
      rows: preview.rows,
      duplicates: preview.duplicates,
      invalidRows: preview.invalidRows
    });
  } catch (err) {
    console.error('Excel preview error:', err);
    res.status(500).json({ error: err.message || 'Failed to parse Excel file' });
  }
});

router.post('/players/import-excel-commit', authenticateToken, requireRole(['admin']), (req, res) => {
  try {
    const { rows, resolutions } = req.body; // resolutions: { [excelRowIndexOrName]: 'use_existing' | 'create_new' | 'overwrite' }
    if (!Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ error: 'No player rows provided for import' });
    }

    const resolutionMap = resolutions || {};
    let insertedCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;

    rows.forEach((row, idx) => {
      const resolution = resolutionMap[row.full_name] || resolutionMap[idx] || (row.isDuplicate ? 'use_existing' : 'create_new');

      if (resolution === 'use_existing' && row.isDuplicate) {
        skippedCount++;
        return;
      }

      if (resolution === 'overwrite' && row.isDuplicate && row.matchedPlayerId) {
        const pIdx = db.players.findIndex(p => p.id === row.matchedPlayerId);
        if (pIdx !== -1) {
          db.players[pIdx] = {
            ...db.players[pIdx],
            full_name: row.full_name || db.players[pIdx].full_name,
            category: row.category || db.players[pIdx].category,
            base_price: row.base_price ?? db.players[pIdx].base_price,
            last_year_price: row.last_year_price ?? db.players[pIdx].last_year_price,
            player_type: row.player_type || db.players[pIdx].player_type,
            score_out_of_5: row.score_out_of_5 ?? db.players[pIdx].score_out_of_5,
            overall_rating: row.overall_rating ?? db.players[pIdx].overall_rating,
            x_factor: row.x_factor || db.players[pIdx].x_factor,
            experience: row.experience || db.players[pIdx].experience,
            speciality: row.speciality || db.players[pIdx].speciality,
            bio: row.bio || db.players[pIdx].bio,
            stats: row.stats || db.players[pIdx].stats,
            updated_at: Date.now()
          };
          updatedCount++;
        }
        return;
      }

      // Create new player record
      const pid = uuidv4();
      const newPlayer = {
        id: pid,
        registration_id: row.registration_id || `#P-${String(db.players.length + 1).padStart(3, '0')}`,
        full_name: row.full_name,
        display_name: row.display_name || row.full_name,
        player_type: row.player_type || 'NEW',
        category: row.category || 'Category A',
        base_price: Number(row.base_price) || 100,
        last_year_price: row.last_year_price ? Number(row.last_year_price) : null,
        score_out_of_5: Number(row.score_out_of_5) || 3.5,
        overall_rating: Number(row.overall_rating) || 75,
        x_factor: row.x_factor || '',
        experience: row.experience || '',
        speciality: row.speciality || '',
        bio: row.bio || '',
        image_url: null,
        image_status: 'PENDING',
        is_active: true,
        is_highlighted: row.is_highlighted || false,
        highlight_reason: row.highlight_reason || '',
        stats: row.stats || {},
        created_at: Date.now(),
        updated_at: Date.now()
      };

      db.players.push(newPlayer);
      insertedCount++;

      // Auto link to active/test auctions
      db.auctions.forEach(auc => {
        if (auc.status !== 'COMPLETED') {
          if (!db.auction_players) db.auction_players = [];
          db.auction_players.push({
            id: uuidv4(),
            auction_id: auc.id,
            player_id: pid,
            auction_category: newPlayer.category,
            auction_base_price: newPlayer.base_price,
            auction_status: 'WAITING',
            sold_price: null,
            sold_team_id: null,
            auction_order: db.auction_players.filter(ap => ap.auction_id === auc.id).length + 1,
            is_current_player: false,
            current_bid: 0,
            created_at: Date.now(),
            updated_at: Date.now()
          });
        }
      });
    });

    saveDb();
    broadcast('MASTER_PLAYERS_IMPORTED', { insertedCount, updatedCount, skippedCount });
    res.json({
      success: true,
      insertedCount,
      updatedCount,
      skippedCount,
      totalMasterPlayers: db.players.length
    });
  } catch (err) {
    console.error('Import commit error:', err);
    res.status(500).json({ error: err.message || 'Failed to commit import' });
  }
});

// ── Auction-Player Link & Management ───────────────────────────────────────
router.get('/auctions/:id/players', (req, res) => {
  const players = getEnrichedAuctionPlayers(req.params.id);
  res.json(players);
});

router.post('/auctions/:id/players', authenticateToken, requireRole(['admin']), (req, res) => {
  const auctionId = req.params.id;
  const auction = db.auctions.find(a => a.id === auctionId);
  if (!auction) return res.status(404).json({ error: 'Auction not found' });

  const playerId = uuidv4();
  const player = {
    id: playerId,
    name: req.body.name,
    full_name: req.body.name,
    category: getCategoryLabel(req.body.category),
    base_price: Number(req.body.basePrice || req.body.base_price || 100),
    basePrice: Number(req.body.basePrice || req.body.base_price || 100),
    is_active: true,
    created_at: Date.now()
  };
  db.players.push(player);

  if (!db.auction_players) db.auction_players = [];
  const ap = {
    id: uuidv4(),
    auction_id: auctionId,
    player_id: playerId,
    auction_category: player.category,
    auction_base_price: player.base_price,
    auction_status: 'WAITING',
    sold_price: null,
    sold_team_id: null,
    auction_order: db.auction_players.filter(x => x.auction_id === auctionId).length + 1,
    is_current_player: false,
    current_bid: 0,
    created_at: Date.now(),
    updated_at: Date.now()
  };
  db.auction_players.push(ap);
  saveDb();
  res.json({ ...player, ...ap, id: playerId });
});

router.post('/auctions/:id/add-players', authenticateToken, requireRole(['admin']), (req, res) => {
  const auctionId = req.params.id;
  const auction = db.auctions.find(a => a.id === auctionId);
  if (!auction) return res.status(404).json({ error: 'Auction not found' });

  const { playerIds } = req.body; // 'all' or array of UUIDs
  if (!db.auction_players) db.auction_players = [];

  let playersToAdd = [];
  if (playerIds === 'all' || !playerIds) {
    playersToAdd = db.players.filter(p => p.is_active !== false);
  } else if (Array.isArray(playerIds)) {
    playersToAdd = db.players.filter(p => playerIds.includes(p.id) && p.is_active !== false);
  }

  let addedCount = 0;
  playersToAdd.forEach((p, idx) => {
    const exists = db.auction_players.some(ap => ap.auction_id === auctionId && ap.player_id === p.id);
    if (!exists) {
      db.auction_players.push({
        id: uuidv4(),
        auction_id: auctionId,
        player_id: p.id,
        auction_category: p.category || 'Category A',
        auction_base_price: p.base_price || 100,
        auction_status: 'WAITING',
        sold_price: null,
        sold_team_id: null,
        auction_order: db.auction_players.filter(ap => ap.auction_id === auctionId).length + 1,
        is_current_player: false,
        current_bid: 0,
        created_at: Date.now(),
        updated_at: Date.now()
      });
      addedCount++;
    }
  });

  saveDb();
  res.json({ success: true, addedCount, totalInAuction: db.auction_players.filter(ap => ap.auction_id === auctionId).length });
});

router.post('/players/:id/reauction', authenticateToken, requireRole(['admin']), (req, res) => {
  const targetAuctionId = req.body.auctionId || auctionEngine.auctionId;
  if (!targetAuctionId) return res.status(400).json({ error: 'Auction ID required' });

  if (!db.auction_players) db.auction_players = [];
  const apIdx = db.auction_players.findIndex(ap => ap.auction_id === targetAuctionId && ap.player_id === req.params.id);
  if (apIdx !== -1) {
    db.auction_players[apIdx].auction_status = 'WAITING';
    db.auction_players[apIdx].sold_team_id = null;
    db.auction_players[apIdx].sold_price = null;
    db.auction_players[apIdx].updated_at = Date.now();
  }

  const pIdx = db.players.findIndex(p => p.id === req.params.id);
  if (pIdx !== -1) {
    db.players[pIdx].status = 'WAITING';
    db.players[pIdx].soldTo = null;
    db.players[pIdx].soldPrice = null;
  }

  saveDb();
  broadcast('PLAYER_REAUCTIONED', { playerId: req.params.id, auctionId: targetAuctionId });
  res.json({ success: true });
});

router.patch('/auctions/:id/player-order', authenticateToken, requireRole(['admin']), (req, res) => {
  const { order } = req.body;
  if (Array.isArray(order) && db.auction_players) {
    order.forEach(({ id, auctionOrder }) => {
      const idx = db.auction_players.findIndex(ap => ap.auction_id === req.params.id && (ap.player_id === id || ap.id === id));
      if (idx !== -1) db.auction_players[idx].auction_order = auctionOrder;
    });
    saveDb();
  }
  res.json({ success: true });
});

// ── Bid History ───────────────────────────────────────────────────────────────
router.get('/auctions/:id/bids', (req, res) => {
  const bids = db.bids
    .filter(b => b.auctionId === req.params.id)
    .sort((a, b) => b.createdAt - a.createdAt);
  res.json(bids);
});

router.get('/players/:id/bids', (req, res) => {
  const bids = db.bids
    .filter(b => b.playerId === req.params.id)
    .sort((a, b) => b.createdAt - a.createdAt);
  res.json(bids);
});

// ── Results & Purchases ────────────────────────────────────────────────────────
router.get('/auctions/:id/results', (req, res) => {
  const purchases = db.purchases.filter(p => p.auctionId === req.params.id);
  const teams = db.teams.filter(t => t.auctionId === req.params.id);
  const players = db.players.filter(p => !req.params.id || p.auctionId === req.params.id);
  const sold = players.filter(p => p.status === 'SOLD');
  const unsold = players.filter(p => p.status === 'UNSOLD');
  const totalSpent = purchases.reduce((s, p) => s + p.finalPrice, 0);
  const highest = purchases.reduce((m, p) => p.finalPrice > m ? p.finalPrice : m, 0);
  const avg = purchases.length ? Math.round(totalSpent / purchases.length) : 0;

  res.json({ purchases, teams, players, sold, unsold, totalSpent, highest, avg });
});

// ── Audit Log ────────────────────────────────────────────────────────────────
router.get('/auctions/:id/events', authenticateToken, requireRole(['admin']), (req, res) => {
  const events = db.events
    .filter(e => e.auctionId === req.params.id)
    .sort((a, b) => b.sequence - a.sequence)
    .slice(0, 100);
  res.json(events);
});

// ── Users ─────────────────────────────────────────────────────────────────────
router.get('/users', (req, res) => {
  res.json(db.users.map(({ password, ...u }) => u));
});

router.patch('/users/:id', authenticateToken, requireRole(['admin']), (req, res) => {
  const idx = db.users.findIndex(u => u.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'User not found' });
  db.users[idx] = { ...db.users[idx], ...req.body };
  saveDb();
  const { password, ...safe } = db.users[idx];
  res.json(safe);
});

// Register router on both /api and /
app.use('/api', router);
app.use('/', router);

// Error handler
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ error: 'File too large. Maximum allowed size is 2 MB.' });
  }
  if (err) {
    return res.status(400).json({ error: err.message || 'An error occurred during request processing.' });
  }
  next();
});

// ═══════════════════════════════════════════════════════════════════════════
//  SOCKET.IO
// ═══════════════════════════════════════════════════════════════════════════
io.on('connection', (socket) => {
  const now = Date.now();
  
  socket.emit('CONNECTED', {
    message: 'Connected to auction server',
    serverTime: new Date(now).toISOString(),
    serverTimeMs: now,
    sequence: auctionEngine.sequence
  });

  if (auctionEngine.auctionId) {
    socket.emit('AUCTION_STATE', getSnapshot());
  }

  socket.on('SYNC_TIME', (clientTs, callback) => {
    const currentNow = Date.now();
    const payload = {
      clientSentTime: clientTs,
      serverTime: new Date(currentNow).toISOString(),
      serverTimeMs: currentNow
    };
    if (typeof callback === 'function') {
      callback(payload);
    } else {
      socket.emit('SYNC_TIME_PONG', payload);
    }
  });

  socket.on('JOIN_AUCTION', ({ auctionId }) => {
    socket.join(`auction-${auctionId}`);
    socket.emit('AUCTION_STATE', getSnapshot(auctionId));
  });

  socket.on('disconnect', () => {});
});

// ═══════════════════════════════════════════════════════════════════════════
const PORT = process.env.PORT || 3001;
if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`Auction server running on http://localhost:${PORT}`);
  });
}

module.exports = { app, server, db, auctionEngine, saveDb, loadDb, enrichTeam, enrichPlayer };
