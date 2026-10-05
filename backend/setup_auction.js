const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid'); // assuming uuid is installed, or we can just generate a string

const dbPath = path.join(__dirname, 'db.json');
let db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

const AUCTION_ID = 'valor-cup-season-2-fixed';

// 1. Ensure Auction exists
let auctionIndex = db.auctions.findIndex(a => a.id === AUCTION_ID);
const scheduledDate = new Date('2026-10-05T13:00:00+05:30').toISOString();

const auctionData = {
    id: AUCTION_ID,
    name: 'Valor Cup — Season 2',
    seriesName: 'Season 2',
    tournamentName: 'Valor Cup',
    organizerName: 'Quad ai school of technology.',
    scheduledAt: scheduledDate,
    auctionDate: scheduledDate,
    status: 'SCHEDULED',
    startingBudget: 4000,
    minimumBid: 20, // Min bid increment is 20, but the base price is based on player category. Or is this the starting bid for players? No, base prices are category A=100, B=60, C=40, D=200. Usually minimumBid refers to bid increment.
    bidIncrement: 20, // Min bid increment
    maxBidIncrement: 50, // max per turn
    playerTimer: 10, // 10 seconds no-bid timeout
    numTeams: 5,
    maxSquadSize: 11, // or whatever
    minSquadSize: 5, // A=2, B=4, C=2, D=1 => sum is 9. Let's say 9
    allowRebid: true,
    allowUnsoldReauction: true,
    createdAt: Date.now(),
    createdServerTimestamp: new Date().toISOString(),
    currentPlayerId: null,
    currentBid: 0,
    highestBidder: null,
    highestBidderName: null,
    roundStatus: 'WAITING', // or SCHEDULED
    rtmTokens: 1,
    strategicTimeOut: 1 // 1 minute
};

if (auctionIndex >= 0) {
    db.auctions[auctionIndex] = { ...db.auctions[auctionIndex], ...auctionData };
} else {
    db.auctions.push(auctionData);
}

// 2. Ensure Users & Teams
const teamsData = [
    { name: 'Terra Titans', tag: 'TER', captain: 'Shivam', email: 'shivam@gmail.com' },
    { name: 'Vyom Strikers', tag: 'VYO', captain: 'Arvind', email: 'arvind@gmail.com' },
    { name: 'Vayu Strikers', tag: 'VAY', captain: 'Rupesh', email: 'rupesh@gmail.com' },
    { name: 'Agni Force', tag: 'AGN', captain: 'Rohit', email: 'rohit@gmail.com' },
    { name: 'Tide Breakers', tag: 'TID', captain: 'Sunny', email: 'sunny@gmail.com' }
];

teamsData.forEach((td, index) => {
    // Check user
    let user = db.users.find(u => u.email === td.email);
    let userId = user ? user.id : 'cap-' + td.email.split('@')[0];
    let teamId = 'team-' + td.name.toLowerCase().replace(/ /g, '-');

    if (user) {
        user.name = td.captain;
        user.password = td.email;
        user.role = 'captain';
        user.teamId = teamId;
        user.auctionId = AUCTION_ID;
    } else {
        db.users.push({
            id: userId,
            name: td.captain,
            email: td.email,
            password: td.email,
            role: 'captain',
            teamId: teamId,
            auctionId: AUCTION_ID
        });
    }

    // Check team
    let teamIndex = db.teams.findIndex(t => t.id === teamId && t.auctionId === AUCTION_ID);
    const teamObj = {
        id: teamId,
        auctionId: AUCTION_ID,
        name: td.name,
        tag: td.tag,
        logoUrl: null, // preserve if exists
        remainingBudget: 4000,
        initialBudget: 4000,
        captainId: userId,
        captainName: td.captain,
        captainEmail: td.email,
        players: "",
        totalSpent: 0,
        rtmTokens: 1,
        strategicTimeOutAvailable: true,
        squadCount: 0
    };

    if (teamIndex >= 0) {
        db.teams[teamIndex] = { ...db.teams[teamIndex], ...teamObj, logoUrl: db.teams[teamIndex].logoUrl };
    } else {
        teamObj.createdAt = Date.now();
        db.teams.push(teamObj);
    }
});

// 3. Setup Auction Players (from master players)
const masterPlayers = db.players || [];
// We need to map master players to auction_players for this auction.
// Only if they don't already exist.
let existingAuctionPlayers = db.auction_players.filter(ap => ap.auction_id === AUCTION_ID);
let existingPlayerIds = new Set(existingAuctionPlayers.map(ap => ap.player_id));

let newAuctionPlayers = [];
let order = existingAuctionPlayers.length > 0 ? Math.max(...existingAuctionPlayers.map(ap => ap.auction_order || 0)) + 1 : 1;

masterPlayers.forEach(mp => {
    if (!existingPlayerIds.has(mp.id)) {
        // Calculate base price
        let cat = mp.category || mp.auction_category;
        let basePrice = 0;
        if (cat === 'Category A') basePrice = 100;
        else if (cat === 'Category B') basePrice = 60;
        else if (cat === 'Category C') basePrice = 40;
        else if (cat === 'Category D') basePrice = 200;

        // If category is different but known, just assign 0 for now or try to parse
        newAuctionPlayers.push({
            id: 'ap-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9),
            auction_id: AUCTION_ID,
            player_id: mp.id,
            auction_category: cat,
            auction_base_price: basePrice,
            auction_status: 'WAITING',
            sold_price: null,
            sold_team_id: null,
            auction_order: order++,
            is_current_player: false,
            current_bid: 0,
            created_at: Date.now(),
            updated_at: Date.now()
        });
    }
});

db.auction_players.push(...newAuctionPlayers);

// Reset any states if auction exists to SCHEDULED
let theAuction = db.auctions.find(a => a.id === AUCTION_ID);
if (theAuction) {
    theAuction.status = 'SCHEDULED';
    theAuction.currentPlayerId = null;
    theAuction.currentBid = 0;
    theAuction.highestBidder = null;
    theAuction.highestBidderName = null;
    theAuction.startedAt = null;
    theAuction.endedAt = null;
}

// Reset team budgets for this auction to 4000
db.teams.filter(t => t.auctionId === AUCTION_ID).forEach(t => {
    t.remainingBudget = 4000;
    t.totalSpent = 0;
    t.players = "";
    t.squadCount = 0;
    t.rtmTokens = 1;
    t.strategicTimeOutAvailable = true;
});

// Reset auction players for this auction to WAITING
db.auction_players.filter(ap => ap.auction_id === AUCTION_ID).forEach(ap => {
    ap.auction_status = 'WAITING';
    ap.sold_price = null;
    ap.sold_team_id = null;
    ap.is_current_player = false;
    ap.current_bid = 0;
});

fs.writeFileSync(dbPath, JSON.stringify(db, null, 4));
console.log('Auction setup complete.');
