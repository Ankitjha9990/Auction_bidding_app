const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');

const testDbDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'valor-cup-auction-tests-'));
const testDbPath = path.join(testDbDirectory, 'db.json');
fs.writeFileSync(testDbPath, JSON.stringify({
  users: [{ id: 'admin-1', name: 'Admin', email: 'admin@spectra.com', password: 'test', role: 'admin' }],
  auctions: [],
  teams: [],
  players: [{
    id: 'legacy-category-player',
    full_name: 'Legacy Category Player',
    category: {
      category: 'Category B',
      playerType: 'Segment Specialist',
      defaultBase: 60
    }
  }],
  bids: [],
  purchases: [],
  events: []
}));
process.env.AUCTION_DB_PATH = testDbPath;

const { server, db, auctionEngine, saveDb } = require('./server');

let baseUrl;

function request(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(baseUrl + path);
    const options = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, body: parsed });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function runTests() {
  console.log('====================================================');
  console.log('STARTING AUTOMATED AUCTION FAIRNESS & SECURITY TESTS');
  console.log('====================================================\n');

  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;

  const adminToken = 'token-admin-1';
  const adminHeaders = { Authorization: `Bearer ${adminToken}` };

  let passed = 0;
  let failed = 0;

  function assert(condition, name, details = '') {
    if (condition) {
      console.log(`✅ [PASS] ${name}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${name}: ${details}`);
      failed++;
    }
  }

  try {
    assert(
      db.players.find(player => player.id === 'legacy-category-player')?.category === 'Category B',
      'Legacy object categories are repaired to displayable labels at startup'
    );
    const legacyPlayerIndex = db.players.findIndex(player => player.id === 'legacy-category-player');
    if (legacyPlayerIndex !== -1) db.players.splice(legacyPlayerIndex, 1);
    saveDb();

    const masterPlayerRes = await request('POST', '/api/players', {
      full_name: 'Category Route Test Player',
      category: 'Category B'
    }, adminHeaders);
    assert(
      masterPlayerRes.status === 201 && masterPlayerRes.body.category === 'Category B',
      'Master player creation stores category as a string'
    );

    const updatedMasterPlayerRes = await request('PATCH', `/api/players/${masterPlayerRes.body.id}`, {
      category: 'Category C'
    }, adminHeaders);
    assert(
      updatedMasterPlayerRes.status === 200 && updatedMasterPlayerRes.body.category === 'Category C',
      'Master player updates store category as a string'
    );
    const routeTestPlayerIndex = db.players.findIndex(player => player.id === masterPlayerRes.body.id);
    if (routeTestPlayerIndex !== -1) db.players.splice(routeTestPlayerIndex, 1);
    saveDb();

    // 0. Server Time check
    const timeRes = await request('GET', '/api/time');
    assert(timeRes.status === 200 && timeRes.body.serverTime, 'Server Authoritative Time Endpoint (/api/time)');

    const defaultTimerRes = await request('POST', '/api/auctions', {
      name: 'Default Player Timer Auction'
    }, adminHeaders);
    assert(
      defaultTimerRes.status === 200 && defaultTimerRes.body.playerTimer === 90,
      'New auctions default to a 90-second player timer'
    );

    // 1. Create a Scheduled Auction in the Future
    const futureTime = new Date(Date.now() + 60000).toISOString(); // +1 min
    const auc1Res = await request('POST', '/api/auctions', {
      name: 'Future Scheduled Tournament',
      scheduledAt: futureTime,
      startingBudget: 50000,
      bidIncrement: 500,
      playerTimer: 10
    }, adminHeaders);

    const auctionId1 = auc1Res.body.id;
    assert(auc1Res.status === 200 && auc1Res.body.status === 'SCHEDULED', 'Auction Schedule Initial Status (SCHEDULED)');

    // TEST 1: Admin attempts to start before scheduled time -> REJECTED
    const earlyStartRes = await request('POST', `/api/auctions/${auctionId1}/start`, {}, adminHeaders);
    assert(
      earlyStartRes.status === 400 && earlyStartRes.body.reason === 'AUCTION_NOT_STARTED_YET',
      'TEST 1: Admin attempts to start before scheduled time -> REJECTED (AUCTION_NOT_STARTED_YET)'
    );

    // 2. Create Auction with Scheduled Time in the Past (Ready to start)
    const pastTime = new Date(Date.now() - 5000).toISOString();
    const auc2Res = await request('POST', '/api/auctions', {
      name: 'Ready Live Tournament',
      scheduledAt: pastTime,
      startingBudget: 100000,
      bidIncrement: 500,
      playerTimer: 10
    }, adminHeaders);
    const auctionId2 = auc2Res.body.id;

    // Create Team A and Team B with Captains
    const teamARes = await request('POST', `/api/auctions/${auctionId2}/teams`, {
      name: 'Alpha Titans',
      budget: 5000,
      captainName: 'Captain Alpha',
      captainEmail: 'alpha@team.com',
      captainPassword: 'pass'
    }, adminHeaders);
    const teamA = teamARes.body;
    const captainAUser = db.users.find(u => u.email === 'alpha@team.com');
    const captainAToken = `token-${captainAUser.id}`;
    const captainAHeaders = { Authorization: `Bearer ${captainAToken}` };

    const teamBRes = await request('POST', `/api/auctions/${auctionId2}/teams`, {
      name: 'Beta Warriors',
      budget: 10000,
      captainName: 'Captain Beta',
      captainEmail: 'beta@team.com',
      captainPassword: 'pass'
    }, adminHeaders);
    const teamB = teamBRes.body;
    const captainBUser = db.users.find(u => u.email === 'beta@team.com');
    const captainBToken = `token-${captainBUser.id}`;
    const captainBHeaders = { Authorization: `Bearer ${captainBToken}` };

    // Create Player 1
    const p1Res = await request('POST', `/api/auctions/${auctionId2}/players`, {
      name: 'Phoenix Valor',
      basePrice: 60,
      category: 'Category A'
    }, adminHeaders);
    const player1 = p1Res.body;

    // TEST 2: Admin starts exactly after scheduled time -> LIVE
    const startRes = await request('POST', `/api/auctions/${auctionId2}/start`, {}, adminHeaders);
    assert(
      startRes.status === 200 && startRes.body.auction.status === 'LIVE' && startRes.body.auction.startedAt,
      'TEST 2: Admin starts after scheduled time -> LIVE with authoritative startedAt'
    );

    // TEST 3: Admin double-clicks START / repeated START request -> Only one transition
    const repeatStartRes = await request('POST', `/api/auctions/${auctionId2}/start`, {}, adminHeaders);
    assert(
      repeatStartRes.status === 400 && repeatStartRes.body.reason === 'AUCTION_ALREADY_LIVE',
      'TEST 3: Admin double-clicks START -> REJECTED (AUCTION_ALREADY_LIVE)'
    );

    // Start Player 1 for bidding
    const startPlayerRes = await request('POST', `/api/auctions/${auctionId2}/next-player`, { playerId: player1.id }, adminHeaders);
    assert(startPlayerRes.status === 200 && startPlayerRes.body.player.id === player1.id, 'Start Player for bidding round');

    // TEST 5: Captain submits valid bid before deadline -> ACCEPTED
    const runReqId = `req-valid-${Date.now()}`;
    const validBidRes = await request('POST', `/api/auctions/${auctionId2}/bid`, {
      teamId: teamA.id,
      increment: 10,
      requestId: runReqId
    }, captainAHeaders);
    assert(
      validBidRes.status === 200 && validBidRes.body.bid.amount === 70 && validBidRes.body.bid.increment === 10,
      'TEST 5: Captain submits valid bid before deadline -> ACCEPTED'
    );

    // TEST 13: Captain submits duplicate request (same requestId / double click)
    const dupBidRes = await request('POST', `/api/auctions/${auctionId2}/bid`, {
      teamId: teamA.id,
      increment: 10,
      requestId: runReqId
    }, captainAHeaders);
    assert(
      dupBidRes.status === 200 && dupBidRes.body.duplicate === true,
      'TEST 13: Duplicate bid request with same requestId -> Deduplicated safely (Idempotent)'
    );

    // TEST 12: Captain tries to bid more Qc than available -> REJECTED
    const overbudgetRes = await request('POST', `/api/auctions/${auctionId2}/bid`, {
      teamId: teamB.id,
      increment: 999999,
      requestId: `req-overbudget-${Date.now()}`
    }, captainBHeaders);
    assert(
      overbudgetRes.status === 400 && overbudgetRes.body.reason === 'INSUFFICIENT_BUDGET',
      'TEST 12: Captain bids more QC than remaining purse -> REJECTED (INSUFFICIENT_BUDGET)'
    );

    // TEST 11: Two captains bid nearly simultaneously -> Server determines winning bid & order
    const simReqId1 = `c-bid-1-${Date.now()}`;
    const simReqId2 = `c-bid-2-${Date.now()}`;
    const [bidA, bidB] = await Promise.all([
      request('POST', `/api/auctions/${auctionId2}/bid`, { teamId: teamB.id, increment: 10, requestId: simReqId1 }, captainBHeaders),
      request('POST', `/api/auctions/${auctionId2}/bid`, { teamId: teamA.id, increment: 10, requestId: simReqId2 }, captainAHeaders)
    ]);
    const currentBidSnapshot = await request('GET', `/api/auctions/${auctionId2}/state`);
    assert(
      currentBidSnapshot.body.currentBid > 70 && currentBidSnapshot.body.highestBidder,
      'TEST 11: Nearly simultaneous bids -> Authoritative server sequence & order determined'
    );

    // TEST 14: Admin pauses auction
    const pauseRes = await request('POST', `/api/auctions/${auctionId2}/pause`, {}, adminHeaders);
    assert(pauseRes.status === 200 && pauseRes.body.status === 'PAUSED', 'TEST 14: Admin pauses auction -> Bidding paused server-side');

    // Bid during pause should fail
    const bidWhilePaused = await request('POST', `/api/auctions/${auctionId2}/bid`, { teamId: teamB.id, increment: 10 }, captainBHeaders);
    assert(bidWhilePaused.status === 400, 'TEST 14b: Bidding while paused -> REJECTED');

    // TEST 15: Admin resumes auction
    const resumeRes = await request('POST', `/api/auctions/${auctionId2}/resume`, {}, adminHeaders);
    assert(resumeRes.status === 200 && resumeRes.body.status === 'LIVE', 'TEST 15: Admin resumes auction -> LIVE with authoritative timing');

    // TEST 8 & 9: Audience or captain refreshes / joins after start -> Authoritative snapshot
    const stateRes = await request('GET', `/api/auctions/${auctionId2}/state`);
    assert(
      stateRes.status === 200 && stateRes.body.status === 'LIVE' && stateRes.body.currentPlayer && stateRes.body.currentPlayer.id === player1.id && stateRes.body.serverTime,
      'TEST 8 & 9: Authoritative state snapshot on refresh/reconnect'
    );

    // TEST 6: Captain submits bid after deadline -> REJECTED
    // Fast-forward endsAt to the past to simulate deadline expiry on server
    auctionEngine.endsAt = Date.now() - 1000;
    const lateBidRes = await request('POST', `/api/auctions/${auctionId2}/bid`, {
      teamId: teamA.id,
      increment: 10,
      requestId: 'req-late'
    }, captainAHeaders);
    assert(
      lateBidRes.status === 400 && lateBidRes.body.reason === 'TIMER_EXPIRED',
      'TEST 6: Captain submits bid after deadline -> REJECTED (TIMER_EXPIRED)'
    );

    // TEST 7: Captain manipulates browser clock (client timestamp payload) -> Server ignores and uses server clock
    const fakeClientClockBid = await request('POST', `/api/auctions/${auctionId2}/bid`, {
      teamId: teamA.id,
      increment: 10,
      clientTimestamp: Date.now() - 10000000
    }, captainAHeaders);
    assert(
      fakeClientClockBid.status === 400 && fakeClientClockBid.body.reason === 'TIMER_EXPIRED',
      'TEST 7: Client manipulated clock -> Has zero effect on server validation'
    );

    // TEST 16: Role authorization & Security
    const unauthBid = await request('POST', `/api/auctions/${auctionId2}/bid`, { teamId: teamA.id, increment: 10 });
    assert(unauthBid.status === 401, 'TEST 16a: Unauthenticated bid -> 401 REJECTED');

    const captainAdminStart = await request('POST', `/api/auctions/${auctionId2}/start`, {}, captainAHeaders);
    assert(captainAdminStart.status === 403, 'TEST 16b: Non-admin trying to start auction -> 403 FORBIDDEN');

    const captainCrossBid = await request('POST', `/api/auctions/${auctionId2}/bid`, { teamId: teamB.id, increment: 10 }, captainAHeaders);
    assert(captainCrossBid.status === 403, 'TEST 16c: Captain bidding for different team -> 403 FORBIDDEN');

    // TEST 4: Two simultaneous START requests -> Only one succeeds
    const pastTime3 = new Date(Date.now() - 2000).toISOString();
    const auc3Res = await request('POST', '/api/auctions', { name: 'Concurrent Test', scheduledAt: pastTime3 }, adminHeaders);
    const a3Id = auc3Res.body.id;
    const [c1, c2] = await Promise.all([
      request('POST', `/api/auctions/${a3Id}/start`, {}, adminHeaders),
      request('POST', `/api/auctions/${a3Id}/start`, {}, adminHeaders)
    ]);
    const successCount = (c1.status === 200 ? 1 : 0) + (c2.status === 200 ? 1 : 0);
    assert(successCount === 1, 'TEST 4: Two simultaneous START requests -> Atomic state transition, only one succeeds');

    const integrationAuctionResponse = await request('POST', '/api/auctions', {
      name: 'Preset Bid Integration',
      scheduledAt: new Date(Date.now() - 1000).toISOString(),
      startingBudget: 20000,
      bidIncrement: 500,
      playerTimer: 120
    }, adminHeaders);
    const integrationAuctionId = integrationAuctionResponse.body.id;
    const integrationTeamResponses = await Promise.all([
      request('POST', `/api/auctions/${integrationAuctionId}/teams`, {
        name: 'Integration Alpha',
        budget: 20000,
        captainName: 'Integration Captain Alpha',
        captainEmail: 'integration-alpha@test.com',
        captainPassword: 'test'
      }, adminHeaders),
      request('POST', `/api/auctions/${integrationAuctionId}/teams`, {
        name: 'Integration Beta',
        budget: 20000,
        captainName: 'Integration Captain Beta',
        captainEmail: 'integration-beta@test.com',
        captainPassword: 'test'
      }, adminHeaders)
    ]);
    const integrationTeams = integrationTeamResponses.map(response => response.body);
    const integrationCaptains = integrationTeams.map(team =>
      db.users.find(user => user.id === team.captainId)
    );
    const integrationHeaders = integrationCaptains.map(captain => ({
      Authorization: `token-${captain.id}`
    }));
    const integrationCases = [
      { start: 60, increment: 10, expected: 70, label: 'TEST A: button +10, 60 → 70' },
      { start: 60, increment: 25, expected: 85, label: 'TEST B: button +25, 60 → 85' },
      { start: 60, increment: 50, expected: 110, label: 'TEST C: button +50, 60 → 110' },
      { start: 60, increment: 100, expected: 160, label: 'TEST D: button +100, 60 → 160' },
      { start: 260, increment: 50, expected: 310, label: 'TEST E: button +50, 260 → 310' },
      { start: 540, increment: 100, expected: 640, label: 'TEST F: button +100, 540 → 640' },
      { start: 1000, increment: 100, expected: 1100, label: 'TEST G: button +100, 1000 → 1100' }
    ];

    const integrationStart = await request('POST', `/api/auctions/${integrationAuctionId}/start`, {}, adminHeaders);
    assert(integrationStart.status === 200, 'Bid integration fixture auction starts');

    let integrationStateVerified = true;
    for (const [index, testCase] of integrationCases.entries()) {
      const playerResponse = await request('POST', `/api/auctions/${integrationAuctionId}/players`, {
        name: `Increment Test Player ${index + 1}`,
        basePrice: testCase.start,
        category: 'Category A'
      }, adminHeaders);
      const player = playerResponse.body;
      const roundResponse = await request('POST', `/api/auctions/${integrationAuctionId}/next-player`, {
        playerId: player.id
      }, adminHeaders);
      const initialSnapshot = await request('GET', `/api/auctions/${integrationAuctionId}/snapshot`);
      const teamIndex = index % integrationTeams.length;
      const requestId = `increment-test-${index}-${Date.now()}`;
      const bidResponse = await request('POST', `/api/auctions/${integrationAuctionId}/bid`, {
        teamId: integrationTeams[teamIndex].id,
        increment: testCase.increment,
        requestId
      }, integrationHeaders[teamIndex]);
      const latestEvent = [...db.events]
        .reverse()
        .find(event => event.auctionId === integrationAuctionId && event.type === 'BID_PLACED');
      const persistedBid = db.bids.find(bid => bid.requestId === requestId);
      const finalSnapshot = await request('GET', `/api/auctions/${integrationAuctionId}/snapshot`);
      const passed =
        roundResponse.status === 200 &&
        initialSnapshot.body.currentBid === testCase.start &&
        bidResponse.status === 200 &&
        bidResponse.body.bid.increment === testCase.increment &&
        bidResponse.body.bid.amount === testCase.expected &&
        persistedBid?.amount === testCase.expected &&
        db.auctions.find(auction => auction.id === integrationAuctionId)?.currentBid === testCase.expected &&
        latestEvent?.payload.currentBid === testCase.expected &&
        finalSnapshot.body.currentBid === testCase.expected;
      integrationStateVerified &&= passed;
      assert(passed, testCase.label, JSON.stringify({
        receivedIncrement: bidResponse.body?.bid?.increment,
        submittedAmount: bidResponse.body?.bid?.amount,
        persistedAmount: persistedBid?.amount,
        eventCurrentBid: latestEvent?.payload?.currentBid,
        snapshotCurrentBid: finalSnapshot.body?.currentBid
      }));
    }

    for (const completedId of [auctionId2, a3Id]) {
      const completedAuction = db.auctions.find(auction => auction.id === completedId);
      if (completedAuction) completedAuction.status = 'COMPLETED';
    }
    saveDb();
    const persistedAuction = db.auctions.find(auction => auction.id === integrationAuctionId);
    const restartProbe = require('child_process').spawnSync(process.execPath, [
      '-e',
      `const { auctionEngine } = require(${JSON.stringify(path.join(__dirname, 'server.js'))}); process.stdout.write(JSON.stringify({ auctionId: auctionEngine.auctionId, currentPlayerId: auctionEngine.currentPlayer?.id, currentBid: auctionEngine.currentBid, highestBidder: auctionEngine.highestBidder })); if (auctionEngine.timerInterval) clearInterval(auctionEngine.timerInterval);`
    ], {
      encoding: 'utf8',
      env: { ...process.env, AUCTION_DB_PATH: testDbPath }
    });
    let restoredRound;
    try {
      restoredRound = JSON.parse(restartProbe.stdout.trim().split(/\r?\n/).at(-1));
    } catch {
      restoredRound = null;
    }
    assert(
      integrationStateVerified &&
      restartProbe.status === 0 &&
      restoredRound?.auctionId === integrationAuctionId &&
      restoredRound?.currentPlayerId === persistedAuction?.currentPlayerId &&
      restoredRound?.currentBid === integrationCases.at(-1).expected &&
      restoredRound?.highestBidder === persistedAuction?.highestBidder,
      'Active bid round restores its authoritative amount after a server restart',
      `exit=${restartProbe.status} stdout=${restartProbe.stdout} stderr=${restartProbe.stderr}`
    );

    console.log('\n====================================================');
    console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log('====================================================\n');

    process.exitCode = failed > 0 ? 1 : 0;
  } catch (err) {
    console.error('Test execution error:', err);
    process.exitCode = 1;
  } finally {
    if (auctionEngine.timerInterval) clearInterval(auctionEngine.timerInterval);
    await new Promise(resolve => server.close(resolve));
    fs.unlinkSync(testDbPath);
    fs.rmdirSync(testDbDirectory);
  }
}

runTests();
