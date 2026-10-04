import React from 'react';
import { getImageUrl, formatTime, formatDateTimeIST, formatScheduledCountdown, formatCurrency } from '../utils/api';
import PlayerAvatar from './PlayerAvatar';
import { Clock, Radio, Activity, Award, Star, Calendar, Shield, Trophy } from 'lucide-react';

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
          background: '#F1F5F9',
          border: '1px solid #E2E8F0',
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
      background: 'rgba(196,18,48,0.1)',
      border: '1px solid rgba(196,18,48,0.25)',
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
  timeRemaining = 0,
  recentBids = [],
  onSelectTeam = null,
  className = '',
  style = {}
}) {
  const currentPlayer = snapshot?.currentPlayer;
  const currentBid = Number(snapshot?.currentBid ?? (currentPlayer ? (currentPlayer.basePrice || currentPlayer.base_price || 0) : 0));
  const auctionStatus = snapshot?.status || 'DRAFT';
  const teams = snapshot?.teams || [];
  const players = snapshot?.players || [];
  const soldPlayersCount = players.filter(p => p.status === 'SOLD').length;
  const maxSquad = snapshot?.auction?.maxSquadSize || 11;
  const roundNum = String(Math.floor(soldPlayersCount / 10) + 1).padStart(2, '0');
  const lotNum = String(soldPlayersCount + (currentPlayer ? 1 : 0)).padStart(3, '0');

  const highestBidder = snapshot?.highestBidder;
  const highestBidderName = snapshot?.highestBidderName;
  const highestBidderTeam = teams.find(t => t.id === highestBidder || t.name === highestBidderName) || (highestBidderName ? { name: highestBidderName } : null);

  const secRemaining = Math.ceil(timeRemaining / 1000);
  const isUrgent = secRemaining <= 5 && secRemaining > 0 && auctionStatus === 'LIVE';
  const isWarning = secRemaining <= 10 && secRemaining > 5 && auctionStatus === 'LIVE';

  const playerName = currentPlayer
    ? (currentPlayer.name || currentPlayer.fullName || currentPlayer.full_name || currentPlayer.displayName || currentPlayer.display_name || 'Player')
    : '';

  const regId = currentPlayer
    ? (currentPlayer.registrationId || currentPlayer.registration_id || currentPlayer.id?.slice(-3) || '—')
    : '';

  const category = currentPlayer
    ? (currentPlayer.category || currentPlayer.auction_category || 'A')
    : '';

  const playerType = currentPlayer
    ? (currentPlayer.playerType || currentPlayer.player_type || currentPlayer.player_type_name || (currentPlayer.status === 'LIVE' ? '' : currentPlayer.status) || '')
    : '';

  const basePrice = currentPlayer
    ? Number(currentPlayer.basePrice ?? currentPlayer.base_price ?? 0)
    : 0;

  const lastYearPrice = currentPlayer
    ? (currentPlayer.lastYearPrice || currentPlayer.last_year_price)
    : null;

  const xFactor = currentPlayer
    ? (currentPlayer.xfactor || currentPlayer.xFactor || currentPlayer.x_factor || '—')
    : '—';

  const experience = currentPlayer
    ? (currentPlayer.experience || '—')
    : '—';

  const rating = currentPlayer
    ? (currentPlayer.scoreOutOf5 ?? currentPlayer.score_out_of_5)
    : null;

  const insights = currentPlayer
    ? (currentPlayer.bio || currentPlayer.speciality || '')
    : '';

  return (
    <div
      className={`vc-mobile-live-card ${className}`}
      style={{
        fontFamily: "'Barlow Condensed', sans-serif",
        background: '#FFFFFF',
        borderRadius: 8,
        border: '1px solid #E2E8F0',
        boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
        overflow: 'hidden',
        position: 'relative',
        ...style
      }}
    >
      {/* Top Crimson Highlight Bar */}
      <div style={{ height: 5, background: 'linear-gradient(90deg, #6B0E1D, #C41230, #E52E4D)' }} />

      {/* ── SECTION 1: HEADER (VALOR CUP 2026 ● LIVE / ROUND / LOT) ── */}
      <div style={{
        padding: '12px 16px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottom: '1px solid #E2E8F0',
        background: '#FFFFFF',
        gap: 8,
        flexWrap: 'wrap'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontWeight: 900, fontSize: 18, letterSpacing: 1.5, color: '#0D0E12', textTransform: 'uppercase' }}>
            VALOR CUP
          </span>
          <span style={{ fontWeight: 800, fontSize: 11, letterSpacing: 1, color: '#C41230', background: 'rgba(196,18,48,0.1)', padding: '2px 6px', borderRadius: 3 }}>
            2026
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ background: '#1E293B', color: '#FFFFFF', padding: '3px 8px', borderRadius: 4, fontWeight: 800, fontSize: 11, letterSpacing: 1 }}>
            R-{roundNum}
          </div>
          <div style={{ background: '#6B0E1D', color: '#FFB8C2', border: '1px solid #C41230', padding: '3px 8px', borderRadius: 4, fontWeight: 800, fontSize: 11, letterSpacing: 1 }}>
            LOT #{lotNum}
          </div>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            background: auctionStatus === 'LIVE' ? 'rgba(196,18,48,0.08)' : '#F1F5F9',
            border: `1px solid ${auctionStatus === 'LIVE' ? 'rgba(196,18,48,0.3)' : '#CBD5E1'}`,
            padding: '3px 8px',
            borderRadius: 4,
            fontWeight: 900,
            fontSize: 11,
            letterSpacing: 1,
            color: auctionStatus === 'LIVE' ? '#C41230' : '#475569',
            flexShrink: 0
          }}>
            {auctionStatus === 'LIVE' && (
              <span style={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                background: '#C41230',
                display: 'inline-block'
              }} className="pulse" />
            )}
            {auctionStatus}
          </div>
        </div>
      </div>

      {/* ── SECTION 2: TIME LEFT ── */}
      <div style={{
        padding: '10px 16px',
        borderBottom: '1px solid #E2E8F0',
        background: isUrgent ? '#FFF0F3' : isWarning ? '#FFFBEB' : '#F8F9FD',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Clock size={16} color={isUrgent ? '#C41230' : isWarning ? '#D97706' : '#64748B'} />
          <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1.5, color: '#64748B', textTransform: 'uppercase' }}>
            TIME REMAINING
          </span>
        </div>
        <div style={{
          fontSize: 26,
          fontWeight: 900,
          letterSpacing: 2,
          lineHeight: 1,
          color: isUrgent ? '#C41230' : isWarning ? '#D97706' : '#0D0E12'
        }}>
          {formatTime(timeRemaining)}
        </div>
      </div>

      {/* Going Once / Going Twice Urgent Alert */}
      {isUrgent && auctionStatus === 'LIVE' && (
        <div style={{
          background: '#C41230',
          color: '#FFFFFF',
          padding: '4px 12px',
          textAlign: 'center',
          fontWeight: 900,
          fontSize: 12,
          letterSpacing: 2,
          textTransform: 'uppercase'
        }}>
          {secRemaining <= 2 ? 'GOING TWICE... FINAL CALL!' : 'GOING ONCE...'}
        </div>
      )}

      {/* ── SECTION 3: PLAYER SHOWCASE (OR STANDBY) ── */}
      {currentPlayer ? (
        <>
          <div style={{
            padding: '18px 16px 14px',
            borderBottom: '1px solid #E2E8F0',
            background: '#FFFFFF',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center'
          }}>
            {/* Badges */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
              <span style={{ background: '#1E293B', color: '#FFFFFF', fontWeight: 900, fontSize: 11, padding: '3px 8px', borderRadius: 4, letterSpacing: 1 }}>
                REG. ID #{regId}
              </span>
              <span style={{ background: '#C41230', color: '#FFFFFF', fontWeight: 900, fontSize: 11, padding: '3px 8px', borderRadius: 4, letterSpacing: 1 }}>
                CATEGORY {category}
              </span>
              {playerType && (
                <span style={{ background: '#E0E7FF', color: '#3730A3', fontWeight: 900, fontSize: 11, padding: '3px 8px', borderRadius: 4, letterSpacing: 1 }}>
                  {String(playerType).toUpperCase()}
                </span>
              )}
            </div>

            {/* Player Photo */}
            <div style={{ marginBottom: 12, position: 'relative' }}>
              <PlayerAvatar
                player={currentPlayer}
                size={140}
                borderRadius={8}
                border="3px solid #6B0E1D"
                style={{
                  boxShadow: '0 4px 14px rgba(0,0,0,0.1)',
                  maxWidth: 'min(150px, 42vw)',
                  maxHeight: 'min(150px, 42vw)'
                }}
              />
            </div>

            {/* DYNAMIC PLAYER NAME */}
            <div style={{
              fontSize: 'clamp(24px, 7vw, 32px)',
              fontWeight: 900,
              letterSpacing: 1.5,
              color: '#0D0E12',
              textTransform: 'uppercase',
              lineHeight: 1.1,
              marginBottom: 4,
              wordBreak: 'break-word'
            }}>
              {playerName}
            </div>

            {rating && (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#D97706', fontSize: 13, fontWeight: 900, marginTop: 2 }}>
                <Star size={13} fill="#D97706" color="#D97706" />
                <span>{rating} / 5</span>
              </div>
            )}
          </div>

          {/* ── SECTION 4: CURRENT BID & LEADING TEAM ── */}
          <div style={{
            padding: '14px 16px',
            borderBottom: '1px solid #E2E8F0',
            background: '#FFFFFF'
          }}>
            <div style={{
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: 2,
              color: '#64748B',
              textTransform: 'uppercase',
              marginBottom: 4
            }}>
              CURRENT BID
            </div>
            <div style={{
              fontSize: 'clamp(32px, 9vw, 42px)',
              fontWeight: 900,
              color: '#4F46E5',
              letterSpacing: 1,
              lineHeight: 1,
              marginBottom: 10
            }}>
              Qc {Number(currentBid).toLocaleString()}
            </div>
            <div style={{
              fontSize: 13,
              fontWeight: 800,
              letterSpacing: 1,
              color: '#0D0E12',
              textTransform: 'uppercase',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              flexWrap: 'wrap'
            }}>
              <span style={{ color: '#64748B', fontSize: 11 }}>LEADING:</span>
              {highestBidderTeam ? (
                <span style={{ color: '#0D0E12', display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 900 }}>
                  <TeamLogoBadge logoUrl={highestBidderTeam.logoUrl} name={highestBidderTeam.name} size={20} />
                  {highestBidderTeam.name.toUpperCase()}
                </span>
              ) : (
                <span style={{ color: '#94A3B8', fontSize: 12 }}>NO BIDS PLACED YET</span>
              )}
            </div>
          </div>

          {/* ── SECTION 5: STATS GRID ── */}
          <div style={{
            padding: '12px 16px',
            borderBottom: '1px solid #E2E8F0',
            background: '#F8F9FD',
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            rowGap: 10,
            columnGap: 14
          }}>
            {/* Base Price */}
            <div>
              <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1.5, color: '#64748B', textTransform: 'uppercase' }}>
                BASE PRICE
              </div>
              <div style={{ fontSize: 15, fontWeight: 900, color: '#0D0E12', letterSpacing: 0.5 }}>
                Qc {basePrice.toLocaleString()}
              </div>
            </div>

            {/* Last Year */}
            <div>
              <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1.5, color: '#64748B', textTransform: 'uppercase' }}>
                LAST YEAR
              </div>
              <div style={{ fontSize: 15, fontWeight: 900, color: '#475569', letterSpacing: 0.5 }}>
                {lastYearPrice ? `Qc ${Number(lastYearPrice).toLocaleString()}` : '—'}
              </div>
            </div>

            {/* X-Factor */}
            <div>
              <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1.5, color: '#64748B', textTransform: 'uppercase' }}>
                X-FACTOR
              </div>
              <div style={{ fontSize: 14, fontWeight: 900, color: '#C41230', letterSpacing: 0.5, textTransform: 'uppercase', wordBreak: 'break-word' }}>
                {xFactor}
              </div>
            </div>

            {/* Experience */}
            <div>
              <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1.5, color: '#64748B', textTransform: 'uppercase' }}>
                EXPERIENCE
              </div>
              <div style={{ fontSize: 14, fontWeight: 900, color: '#0D0E12', letterSpacing: 0.5, textTransform: 'uppercase' }}>
                {experience}
              </div>
            </div>
          </div>

          {/* Insights Strip */}
          {insights && (
            <div style={{
              padding: '10px 16px',
              borderBottom: '1px solid #E2E8F0',
              background: '#FFFFFF',
              fontSize: 12,
              color: '#475569',
              display: 'flex',
              alignItems: 'center',
              gap: 8
            }}>
              <span style={{ fontWeight: 900, letterSpacing: 1, textTransform: 'uppercase', color: '#C41230', fontSize: 11, flexShrink: 0 }}>
                INSIGHTS:
              </span>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {insights}
              </span>
            </div>
          )}
        </>
      ) : auctionStatus === 'SCHEDULED' ? (
        /* SCHEDULED STATE WHEN AUCTION IS SCHEDULED FOR LATER */
        <div style={{
          padding: '32px 20px',
          textAlign: 'center',
          background: 'linear-gradient(135deg, #1E293B, #0F172A)',
          color: '#FFFFFF',
          borderBottom: '1px solid #E2E8F0'
        }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            background: 'rgba(245,158,11,0.2)',
            border: '1px solid rgba(245,158,11,0.5)',
            padding: '4px 10px',
            borderRadius: 4,
            fontSize: 12,
            fontWeight: 900,
            color: '#FCD34D',
            letterSpacing: 1.5,
            textTransform: 'uppercase',
            marginBottom: 12
          }}>
            <Calendar size={13} color="#FCD34D" />
            UPCOMING TOURNAMENT
          </div>

          <div style={{
            fontSize: 22,
            fontWeight: 900,
            color: '#FFFFFF',
            textTransform: 'uppercase',
            letterSpacing: 1,
            marginBottom: 4
          }}>
            {snapshot?.auction?.name || snapshot?.auction?.tournamentName}
          </div>

          <div style={{ fontSize: 13, color: '#94A3B8', marginBottom: 16 }}>
            {snapshot?.auction?.seriesName || 'Valor Cup Season 2'} · {snapshot?.auction?.organizerName || 'Medhavi Skills University'}
          </div>

          <div style={{
            background: 'rgba(255,255,255,0.06)',
            borderRadius: 8,
            padding: '14px',
            border: '1px solid rgba(255,255,255,0.1)',
            marginBottom: 16
          }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#FCD34D', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 4 }}>
              SCHEDULED DATE & TIME (IST)
            </div>
            <div style={{ fontSize: 16, fontWeight: 900, color: '#FFFFFF' }}>
              {formatDateTimeIST(snapshot?.auction?.scheduledAt || snapshot?.auction?.auctionDate)}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, textAlign: 'left' }}>
            <div style={{ background: 'rgba(255,255,255,0.04)', padding: '10px', borderRadius: 6 }}>
              <div style={{ fontSize: 10, color: '#94A3B8', fontWeight: 800, letterSpacing: 1 }}>SQUAD PURSE</div>
              <div style={{ fontSize: 14, fontWeight: 900, color: '#818CF8' }}>
                {formatCurrency(snapshot?.auction?.startingBudget || 100000)}
              </div>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.04)', padding: '10px', borderRadius: 6 }}>
              <div style={{ fontSize: 10, color: '#94A3B8', fontWeight: 800, letterSpacing: 1 }}>TEAMS / POOL</div>
              <div style={{ fontSize: 14, fontWeight: 900, color: '#34D399' }}>
                {teams.length} Teams · {players.length} Players
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* STANDBY STATE WHEN NO ACTIVE PLAYER */
        <div style={{
          padding: '48px 20px',
          textAlign: 'center',
          background: '#F8F9FD',
          borderBottom: '1px solid #E2E8F0'
        }}>
          <div style={{
            fontWeight: 900,
            fontSize: 22,
            letterSpacing: 2,
            color: '#64748B',
            textTransform: 'uppercase',
            marginBottom: 6
          }}>
            {auctionStatus === 'READY' || auctionStatus === 'LIVE' ? 'STANDBY FOR NEXT PLAYER' : `AUCTION IS ${auctionStatus}`}
          </div>
          <div style={{ fontSize: 13, color: '#94A3B8' }}>
            The live auction is underway. Next player card will appear automatically.
          </div>
        </div>
      )}

      {/* ── SECTION 6: RECENT BIDS ── */}
      <div style={{
        padding: '12px 16px',
        borderBottom: '1px solid #E2E8F0',
        background: '#FFFFFF'
      }}>
        <div style={{
          fontSize: 11,
          fontWeight: 900,
          letterSpacing: 2,
          color: '#0D0E12',
          textTransform: 'uppercase',
          marginBottom: 8,
          display: 'flex',
          alignItems: 'center',
          gap: 6
        }}>
          <Activity size={14} color="#C41230" />
          <span>RECENT BIDS</span>
        </div>

        {recentBids.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '16px 0', color: '#94A3B8', fontSize: 12, letterSpacing: 1 }}>
            Awaiting bids for current player...
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {recentBids.slice(0, 5).map((bid, idx) => {
              const team = teams.find(t => t.id === bid.teamId);
              const teamName = team?.name || bid.teamName || 'Team';
              return (
                <div
                  key={bid.id || idx}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '6px 10px',
                    background: idx === 0 ? '#FFF0F3' : '#F8F9FD',
                    border: idx === 0 ? '1px solid rgba(196,18,48,0.3)' : '1px solid #E2E8F0',
                    borderRadius: 4,
                    gap: 8
                  }}
                >
                  <div style={{
                    fontSize: 13,
                    fontWeight: 900,
                    color: '#0D0E12',
                    letterSpacing: 0.5,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    minWidth: 0,
                    overflow: 'hidden'
                  }}>
                    <TeamLogoBadge logoUrl={team?.logoUrl || bid.logoUrl} name={teamName} size={18} />
                    <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                      {teamName}
                    </span>
                  </div>
                  <div style={{
                    fontSize: 14,
                    fontWeight: 900,
                    color: idx === 0 ? '#C41230' : '#0D0E12',
                    letterSpacing: 0.5,
                    flexShrink: 0
                  }}>
                    Qc {Number(bid.amount || 0).toLocaleString()}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── SECTION 7: TEAMS SCOREBOARD ── */}
      <div style={{
        padding: '12px 16px',
        background: '#FFFFFF'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div style={{
            fontSize: 11,
            fontWeight: 900,
            letterSpacing: 2,
            color: '#64748B',
            textTransform: 'uppercase'
          }}>
            TEAMS SCOREBOARD
          </div>
          <div style={{ fontSize: 10, fontWeight: 800, color: '#C41230', letterSpacing: 0.5 }}>
            TAP TEAM FOR SQUAD ↗
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {teams.map((team, idx) => {
            const pCount = (team.players || []).length;
            const isLeading = team.id === highestBidder;
            return (
              <div
                key={team.id || idx}
                onClick={() => onSelectTeam && onSelectTeam(team)}
                role="button"
                tabIndex={0}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '8px 10px',
                  background: isLeading ? '#FFF0F3' : '#F8F9FD',
                  border: isLeading ? '1px solid rgba(196,18,48,0.4)' : '1px solid #E2E8F0',
                  borderRadius: 4,
                  gap: 8,
                  cursor: onSelectTeam ? 'pointer' : 'default',
                  transition: 'background 0.15s ease'
                }}
              >
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  minWidth: 0,
                  flex: 1,
                  overflow: 'hidden'
                }}>
                  <TeamLogoBadge logoUrl={team.logoUrl} name={team.name} size={22} />
                  <div style={{ minWidth: 0, overflow: 'hidden' }}>
                    <div style={{ fontSize: 13, fontWeight: 900, color: '#0D0E12', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                      {team.name}
                    </div>
                    <div style={{ fontSize: 10, color: '#64748B', fontWeight: 800 }}>
                      {pCount} / {maxSquad} PLAYERS · <span style={{ color: '#C41230' }}>SQUAD ↗</span>
                    </div>
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 8, fontWeight: 800, color: '#94A3B8', letterSpacing: 1 }}>QC LEFT</div>
                  <div style={{ fontSize: 14, fontWeight: 900, color: '#C41230' }}>
                    {(team.remainingBudget || 0).toLocaleString()}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
