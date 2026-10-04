import React from 'react';
import { getImageUrl, formatTime } from '../utils/api';
import PlayerAvatar from './PlayerAvatar';

export function TeamLogoBadge({ logoUrl, name, size = 22 }) {
  const src = logoUrl ? getImageUrl(logoUrl) : null;
  const initials = (name || '?').slice(0, 2).toUpperCase();

  if (src) {
    return (
      <img
        src={src}
        alt={name}
        style={{
          width: size,
          height: size,
          objectFit: 'contain',
          borderRadius: 4,
          background: '#FFFFFF',
          border: '1.5px solid #111111',
          flexShrink: 0
        }}
        onError={e => { e.target.style.display = 'none'; }}
      />
    );
  }

  return (
    <div style={{
      width: size,
      height: size,
      borderRadius: 4,
      background: '#FFE4E8',
      border: '1.5px solid #111111',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: "'Barlow Condensed', sans-serif",
      fontWeight: 900,
      fontSize: Math.max(9, Math.round(size * 0.45)),
      color: '#C41230',
      flexShrink: 0,
    }}>
      {initials}
    </div>
  );
}

export default function MobileLiveCard({
  snapshot,
  timeRemaining = 12000,
  recentBids = [],
  className = '',
  style = {}
}) {
  const currentPlayer = snapshot?.currentPlayer || {
    name: 'SATYAM',
    category: 'A',
    status: 'RETURNING',
    type: 'Returning Player',
    basePrice: 100,
    lastYearPrice: 160,
    xfactor: 'CLUTCH',
    experience: '2 SEASONS',
    registrationId: '027'
  };

  const currentBid = Number(snapshot?.currentBid ?? 250);
  const auctionStatus = snapshot?.status || 'LIVE';
  const teams = snapshot?.teams && snapshot.teams.length > 0 ? snapshot.teams : [
    { id: 't1', name: 'Phoenix Blitz', remainingBudget: 97610 },
    { id: 't2', name: 'Shadow Strikers', remainingBudget: 99825 }
  ];

  const highestBidderName = snapshot?.highestBidderName;
  const highestBidder = snapshot?.highestBidder;
  const highestBidderTeam = teams.find(t => t.id === highestBidder || t.name === highestBidderName) || (highestBidderName ? { name: highestBidderName } : (teams[0] || null));

  const activeBids = recentBids && recentBids.length > 0 ? recentBids : [
    { id: 'b1', teamName: 'Phoenix Blitz', amount: 250 },
    { id: 'b2', teamName: 'Shadow Strikers', amount: 225 }
  ];

  const secRemaining = Math.ceil(timeRemaining / 1000);
  const isUrgent = secRemaining <= 5 && secRemaining > 0 && auctionStatus === 'LIVE';
  const isWarning = secRemaining <= 10 && secRemaining > 5 && auctionStatus === 'LIVE';

  return (
    <div
      className={`vc-mobile-live-card ${className}`}
      style={{
        fontFamily: "'Barlow Condensed', sans-serif",
        ...style
      }}
    >
      {/* ── SECTION 1: HEADER (VALOR CUP 2026 ● LIVE) ── */}
      <div style={{
        padding: '12px clamp(12px, 3.5vw, 18px)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottom: '2.5px solid #111111',
        background: '#FFFFFF',
        gap: 8
      }}>
        <div style={{
          fontWeight: 900,
          fontSize: 'clamp(17px, 5vw, 22px)',
          letterSpacing: 2,
          color: '#111111',
          textTransform: 'uppercase',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis'
        }}>
          VALOR CUP 2026
        </div>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          background: '#FFE4E8',
          border: '1.5px solid #C41230',
          padding: '3px 8px',
          borderRadius: 4,
          fontWeight: 900,
          fontSize: 12,
          letterSpacing: 1.5,
          color: '#C41230',
          flexShrink: 0
        }}>
          <span style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: '#C41230',
            display: 'inline-block',
            animation: 'pulse 1.2s infinite ease-in-out'
          }} />
          LIVE
        </div>
      </div>

      {/* ── SECTION 2: TIME LEFT (00:12) ── */}
      <div style={{
        padding: '10px clamp(12px, 3.5vw, 18px)',
        borderBottom: '2.5px solid #111111',
        background: isUrgent ? '#FFF0F0' : '#F9F9FB',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start'
      }}>
        <div style={{
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: 1.5,
          color: '#555555',
          textTransform: 'uppercase',
          marginBottom: 2
        }}>
          TIME LEFT
        </div>
        <div style={{
          fontSize: 'clamp(28px, 8.5vw, 36px)',
          fontWeight: 900,
          letterSpacing: 2,
          lineHeight: 1,
          color: isUrgent ? '#C41230' : isWarning ? '#D97706' : '#111111'
        }}>
          {formatTime(timeRemaining)}
        </div>
      </div>

      {/* ── SECTION 3: PLAYER SHOWCASE (PHOTO, NAME, CATEGORY, STATUS) ── */}
      <div style={{
        padding: '20px clamp(12px, 4vw, 22px)',
        borderBottom: '2.5px solid #111111',
        background: '#FFFFFF',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center'
      }}>
        {/* Player Photo */}
        <div style={{
          marginBottom: 14,
          position: 'relative'
        }}>
          <PlayerAvatar
            player={currentPlayer}
            size={135}
            borderRadius={6}
            border="2.5px solid #111111"
            style={{
              boxShadow: '3px 3px 0px #111111',
              maxWidth: 'min(140px, 36vw)',
              maxHeight: 'min(140px, 36vw)'
            }}
          />
        </div>

        {/* Player Name */}
        <div style={{
          fontSize: 'clamp(24px, 7vw, 32px)',
          fontWeight: 900,
          letterSpacing: 1.5,
          color: '#111111',
          textTransform: 'uppercase',
          lineHeight: 1.1,
          marginBottom: 8,
          wordBreak: 'break-word'
        }}>
          {currentPlayer?.name || 'SATYAM'}
        </div>

        {/* Player Category & Status Badges */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          alignItems: 'center'
        }}>
          <div style={{
            fontSize: 'clamp(12px, 3.5vw, 14px)',
            fontWeight: 900,
            letterSpacing: 1.5,
            color: '#C41230',
            textTransform: 'uppercase'
          }}>
            CATEGORY {currentPlayer?.category || 'A'}
          </div>
          <div style={{
            fontSize: 'clamp(11px, 3vw, 13px)',
            fontWeight: 800,
            letterSpacing: 1.5,
            color: '#4B5563',
            textTransform: 'uppercase'
          }}>
            {currentPlayer?.status || currentPlayer?.type || 'RETURNING'}
          </div>
        </div>
      </div>

      {/* ── SECTION 4: CURRENT BID & LEADING TEAM ── */}
      <div style={{
        padding: '14px clamp(12px, 3.5vw, 18px)',
        borderBottom: '2.5px solid #111111',
        background: '#FFFFFF'
      }}>
        <div style={{
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: 2,
          color: '#555555',
          textTransform: 'uppercase',
          marginBottom: 4
        }}>
          CURRENT BID
        </div>
        <div style={{
          fontSize: 'clamp(32px, 9.5vw, 44px)',
          fontWeight: 900,
          color: '#C41230',
          letterSpacing: 1,
          lineHeight: 1,
          marginBottom: 10
        }}>
          Qc {Number(currentBid).toLocaleString()}
        </div>
        <div style={{
          fontSize: 'clamp(12px, 3.5vw, 14px)',
          fontWeight: 900,
          letterSpacing: 1,
          color: '#111111',
          textTransform: 'uppercase',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          flexWrap: 'wrap'
        }}>
          <span>LEADING:</span>
          {highestBidderTeam ? (
            <span style={{ color: '#C41230', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <TeamLogoBadge logoUrl={highestBidderTeam.logoUrl} name={highestBidderTeam.name} size={18} />
              {highestBidderTeam.name.toUpperCase()}
            </span>
          ) : (
            <span style={{ color: '#777777' }}>NONE YET</span>
          )}
        </div>
      </div>

      {/* ── SECTION 5: STATS GRID (BASE, LAST YEAR, X-FACTOR, EXPERIENCE) ── */}
      <div style={{
        padding: '12px clamp(12px, 3.5vw, 18px)',
        borderBottom: '2.5px solid #111111',
        background: '#F9F9FB',
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        rowGap: 10,
        columnGap: 14
      }}>
        {/* Base Price */}
        <div>
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1.5, color: '#666666', textTransform: 'uppercase' }}>
            BASE
          </div>
          <div style={{ fontSize: 'clamp(14px, 4vw, 16px)', fontWeight: 900, color: '#111111', letterSpacing: 0.5 }}>
            Qc {Number(currentPlayer?.basePrice || 100).toLocaleString()}
          </div>
        </div>

        {/* Last Year */}
        <div>
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1.5, color: '#666666', textTransform: 'uppercase' }}>
            LAST YEAR
          </div>
          <div style={{ fontSize: 'clamp(14px, 4vw, 16px)', fontWeight: 900, color: '#111111', letterSpacing: 0.5 }}>
            {currentPlayer?.lastYearPrice ? `Qc ${Number(currentPlayer.lastYearPrice).toLocaleString()}` : 'Qc 160'}
          </div>
        </div>

        {/* X-Factor */}
        <div>
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1.5, color: '#666666', textTransform: 'uppercase' }}>
            X-FACTOR
          </div>
          <div style={{ fontSize: 'clamp(13px, 3.8vw, 15px)', fontWeight: 900, color: '#C41230', letterSpacing: 0.5, textTransform: 'uppercase', wordBreak: 'break-word' }}>
            {currentPlayer?.xfactor || currentPlayer?.xFactor || 'CLUTCH'}
          </div>
        </div>

        {/* Experience */}
        <div>
          <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1.5, color: '#666666', textTransform: 'uppercase' }}>
            EXPERIENCE
          </div>
          <div style={{ fontSize: 'clamp(13px, 3.8vw, 15px)', fontWeight: 900, color: '#111111', letterSpacing: 0.5, textTransform: 'uppercase' }}>
            {currentPlayer?.experience || '2 SEASONS'}
          </div>
        </div>
      </div>

      {/* ── SECTION 6: RECENT BIDS ── */}
      <div style={{
        padding: '12px clamp(12px, 3.5vw, 18px)',
        borderBottom: '2.5px solid #111111',
        background: '#FFFFFF'
      }}>
        <div style={{
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: 2,
          color: '#555555',
          textTransform: 'uppercase',
          marginBottom: 8
        }}>
          RECENT BIDS
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {activeBids.slice(0, 4).map((bid, idx) => (
            <div
              key={bid.id || idx}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '6px 10px',
                background: idx === 0 ? '#FFE4E8' : '#F9F9FB',
                border: idx === 0 ? '1.5px solid #C41230' : '1px solid #E5E7EB',
                borderRadius: 4,
                gap: 8
              }}
            >
              <div style={{
                fontSize: 'clamp(13px, 3.8vw, 15px)',
                fontWeight: 900,
                color: '#111111',
                letterSpacing: 0.5,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                minWidth: 0,
                overflow: 'hidden'
              }}>
                <TeamLogoBadge logoUrl={bid.logoUrl} name={bid.teamName} size={16} />
                <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                  {bid.teamName}
                </span>
              </div>
              <div style={{
                fontSize: 'clamp(13px, 3.8vw, 15px)',
                fontWeight: 900,
                color: idx === 0 ? '#C41230' : '#111111',
                letterSpacing: 0.5,
                flexShrink: 0
              }}>
                Qc {Number(bid.amount || 0).toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── SECTION 7: TEAMS PURSE / BALANCE ── */}
      <div style={{
        padding: '12px clamp(12px, 3.5vw, 18px)',
        background: '#FFFFFF'
      }}>
        <div style={{
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: 2,
          color: '#555555',
          textTransform: 'uppercase',
          marginBottom: 8
        }}>
          TEAMS
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {teams.map((team, idx) => (
            <div
              key={team.id || idx}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '6px 10px',
                background: '#F9F9FB',
                border: '1px solid #E5E7EB',
                borderRadius: 4,
                gap: 8
              }}
            >
              <div style={{
                fontSize: 'clamp(13px, 3.8vw, 14px)',
                fontWeight: 800,
                color: '#111111',
                letterSpacing: 0.5,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                minWidth: 0,
                overflow: 'hidden'
              }}>
                <TeamLogoBadge logoUrl={team.logoUrl} name={team.name} size={16} />
                <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                  {team.name}
                </span>
              </div>
              <div style={{
                fontSize: 'clamp(13px, 3.8vw, 14px)',
                fontWeight: 900,
                color: '#111111',
                letterSpacing: 0.5,
                flexShrink: 0
              }}>
                Qc {Number(team.remainingBudget ?? 100000).toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
