import { useEffect } from 'react';
import TeamLogo from './TeamLogo';
import PlayerAvatar from './PlayerAvatar';
import { formatCurrency } from '../utils/api';
import { X, Users, Wallet, CheckCircle, Shield } from 'lucide-react';

export default function TeamSquadModal({
  isOpen,
  onClose,
  team,
  teams = [],
  onSelectTeam = null,
  maxSquadSize = 11,
  allPlayers = []
}) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !team) return null;

  const squadLimit = maxSquadSize || team.maxSquadSize || 11;
  const initialBudget = Number(team.initialBudget || 100000);

  // Authoritative players list from team.players or enriched from allPlayers
  const rawPlayers = Array.isArray(team.players) ? team.players : [];
  const squad = rawPlayers.map((p, idx) => {
    const master = allPlayers.find(ap => (ap.id || ap.masterPlayerId) === (p.playerId || p.id)) || {};
    const price = Number(p.soldPrice ?? p.price ?? p.finalPrice ?? master.soldPrice ?? master.price ?? 0);
    return {
      ...master,
      ...p,
      id: p.id || p.playerId || master.id || `p-${idx}`,
      name: p.name || master.full_name || master.name || 'Player',
      category: p.category || master.category || 'Category A',
      registrationId: p.registrationId || master.registration_id || master.registrationId || (p.id ? String(p.id).slice(-3) : ''),
      soldPrice: price,
      price: price
    };
  });

  const totalSpent = squad.reduce((sum, p) => sum + (p.soldPrice || 0), 0);
  const remainingBudget = Math.max(0, initialBudget - totalSpent);
  const budgetPct = Math.round((remainingBudget / (initialBudget || 1)) * 100);
  const slotsRemaining = Math.max(0, squadLimit - squad.length);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(4px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#FFFFFF',
          borderRadius: 12,
          boxShadow: '0 20px 40px -8px rgba(0, 0, 0, 0.35)',
          width: '100%',
          maxWidth: 620,
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          border: '1px solid var(--border-light)',
          overflow: 'hidden'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)',
            padding: '20px 24px',
            color: '#FFFFFF',
            position: 'relative',
            borderBottom: '3px solid var(--crimson)'
          }}
        >
          <button
            onClick={onClose}
            style={{
              position: 'absolute',
              top: 16,
              right: 16,
              background: 'rgba(255, 255, 255, 0.1)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              color: '#FFFFFF',
              width: 32,
              height: 32,
              borderRadius: 6,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'background 0.15s ease'
            }}
            title="Close"
            aria-label="Close modal"
          >
            <X size={18} />
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <TeamLogo
              logoUrl={team.logoUrl}
              name={team.name}
              size={58}
              style={{
                borderRadius: 8,
                background: '#FFFFFF',
                padding: 4,
                boxShadow: '0 4px 10px rgba(0,0,0,0.2)'
              }}
            />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span
                  style={{
                    background: 'var(--crimson)',
                    color: '#FFFFFF',
                    fontFamily: "'Barlow Condensed', sans-serif",
                    fontWeight: 900,
                    fontSize: 11,
                    letterSpacing: 1.5,
                    padding: '2px 8px',
                    borderRadius: 4,
                    textTransform: 'uppercase'
                  }}
                >
                  {team.tag || 'TEAM'}
                </span>
                <span
                  style={{
                    fontFamily: "'Barlow Condensed', sans-serif",
                    fontWeight: 700,
                    fontSize: 11,
                    color: '#94A3B8',
                    letterSpacing: 1,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4
                  }}
                >
                  <Shield size={12} color="var(--crimson-bright)" /> READ-ONLY SQUAD
                </span>
              </div>
              <h2
                style={{
                  fontFamily: "'Barlow Condensed', sans-serif",
                  fontWeight: 900,
                  fontSize: 26,
                  color: '#FFFFFF',
                  margin: '4px 0 2px',
                  letterSpacing: 1,
                  textTransform: 'uppercase',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}
              >
                {team.name}
              </h2>
              {team.captainName && (
                <div
                  style={{
                    fontSize: 12,
                    color: '#CBD5E1',
                    fontFamily: "'Barlow Condensed', sans-serif",
                    fontWeight: 700
                  }}
                >
                  CAPTAIN: <span style={{ color: '#F8FAFC' }}>{team.captainName}</span>
                  {team.captainEmail ? ` (${team.captainEmail})` : ''}
                </div>
              )}
            </div>
          </div>

          {/* Quick Team Switcher tabs if multiple teams provided */}
          {teams.length > 1 && onSelectTeam && (
            <div
              style={{
                display: 'flex',
                gap: 6,
                marginTop: 14,
                overflowX: 'auto',
                paddingBottom: 4
              }}
            >
              {teams.map((t) => {
                const isSelected = t.id === team.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => onSelectTeam(t)}
                    style={{
                      background: isSelected ? 'var(--crimson)' : 'rgba(255,255,255,0.08)',
                      border: `1px solid ${isSelected ? 'var(--crimson-bright)' : 'rgba(255,255,255,0.15)'}`,
                      color: isSelected ? '#FFFFFF' : '#CBD5E1',
                      fontFamily: "'Barlow Condensed', sans-serif",
                      fontWeight: 800,
                      fontSize: 11,
                      letterSpacing: 1,
                      padding: '4px 10px',
                      borderRadius: 4,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6
                    }}
                  >
                    <TeamLogo logoUrl={t.logoUrl} name={t.name} size={14} />
                    {t.name}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Financial & Squad Stats Bar */}
        <div
          style={{
            background: '#F8F9FD',
            borderBottom: '1px solid var(--border-light)',
            padding: '14px 24px'
          }}
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 12,
              textAlign: 'center'
            }}
          >
            <div
              style={{
                background: '#FFFFFF',
                padding: '10px 8px',
                borderRadius: 6,
                border: '1px solid var(--border-light)',
                boxShadow: 'var(--shadow-sm)'
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  fontFamily: "'Barlow Condensed', sans-serif",
                  fontWeight: 800,
                  color: 'var(--text-faint)',
                  letterSpacing: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 4
                }}
              >
                <Users size={12} color="var(--crimson)" /> PLAYERS BOUGHT
              </div>
              <div
                style={{
                  fontFamily: "'Barlow Condensed', sans-serif",
                  fontWeight: 900,
                  fontSize: 18,
                  color: 'var(--text-dark)',
                  marginTop: 2
                }}
              >
                {squad.length} / {squadLimit}
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-faint)', fontWeight: 700 }}>
                {slotsRemaining} SLOTS LEFT
              </div>
            </div>

            <div
              style={{
                background: '#FFFFFF',
                padding: '10px 8px',
                borderRadius: 6,
                border: '1px solid var(--border-light)',
                boxShadow: 'var(--shadow-sm)'
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  fontFamily: "'Barlow Condensed', sans-serif",
                  fontWeight: 800,
                  color: 'var(--text-faint)',
                  letterSpacing: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 4
                }}
              >
                <Wallet size={12} color="#059669" /> REMAINING BUDGET
              </div>
              <div
                style={{
                  fontFamily: "'Barlow Condensed', sans-serif",
                  fontWeight: 900,
                  fontSize: 18,
                  color: budgetPct < 20 ? 'var(--crimson)' : '#059669',
                  marginTop: 2
                }}
              >
                {formatCurrency(remainingBudget)}
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-faint)', fontWeight: 700 }}>
                {budgetPct}% REMAINING
              </div>
            </div>

            <div
              style={{
                background: '#FFFFFF',
                padding: '10px 8px',
                borderRadius: 6,
                border: '1px solid var(--border-light)',
                boxShadow: 'var(--shadow-sm)'
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  fontFamily: "'Barlow Condensed', sans-serif",
                  fontWeight: 800,
                  color: 'var(--text-faint)',
                  letterSpacing: 1
                }}
              >
                TOTAL SPENT
              </div>
              <div
                style={{
                  fontFamily: "'Barlow Condensed', sans-serif",
                  fontWeight: 900,
                  fontSize: 18,
                  color: 'var(--crimson)',
                  marginTop: 2
                }}
              >
                {formatCurrency(totalSpent)}
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-faint)', fontWeight: 700 }}>
                FROM {formatCurrency(initialBudget)}
              </div>
            </div>
          </div>

          {/* Progress bar */}
          <div style={{ marginTop: 10 }}>
            <div
              style={{
                height: 6,
                background: '#E2E8F0',
                borderRadius: 3,
                overflow: 'hidden'
              }}
            >
              <div
                style={{
                  height: '100%',
                  width: `${Math.min(100, Math.round((totalSpent / (initialBudget || 1)) * 100))}%`,
                  background: 'linear-gradient(90deg, var(--crimson), #DC2626)',
                  transition: 'width 0.3s ease'
                }}
              />
            </div>
          </div>
        </div>

        {/* Squad List */}
        <div style={{ padding: '16px 24px', flex: 1, overflowY: 'auto' }}>
          <div
            style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              fontWeight: 900,
              fontSize: 14,
              letterSpacing: 1.5,
              color: 'var(--text-dark)',
              textTransform: 'uppercase',
              marginBottom: 12,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}
          >
            <span>ACQUIRED SQUAD</span>
            <span style={{ fontSize: 11, color: 'var(--text-dim)', fontWeight: 800 }}>
              {squad.length} / {squadLimit} PLAYERS
            </span>
          </div>

          {squad.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: '40px 16px',
                color: 'var(--text-faint)',
                fontFamily: "'Barlow Condensed', sans-serif"
              }}
            >
              <div style={{ fontSize: 32, marginBottom: 8 }}>👥</div>
              <div style={{ fontWeight: 800, fontSize: 16, color: 'var(--text-dark)', letterSpacing: 1 }}>
                NO PLAYERS PURCHASED YET
              </div>
              <div style={{ fontSize: 12, marginTop: 4 }}>
                Full purse of {formatCurrency(initialBudget)} is ready for auction bidding.
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {squad.map((player, idx) => {
                const reg = player.registrationId || (player.id ? String(player.id).slice(-3) : `P${idx + 1}`);
                return (
                  <div
                    key={player.id || idx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 12px',
                      background: idx % 2 === 0 ? '#FFFFFF' : '#F8F9FD',
                      border: '1px solid var(--border-light)',
                      borderRadius: 6,
                      fontSize: 13
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
                      <span
                        style={{
                          fontFamily: "'Barlow Condensed', sans-serif",
                          fontWeight: 800,
                          color: 'var(--text-faint)',
                          fontSize: 12,
                          width: 20
                        }}
                      >
                        {String(idx + 1).padStart(2, '0')}
                      </span>

                      <div
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: 6,
                          overflow: 'hidden',
                          flexShrink: 0,
                          background: 'var(--navy)'
                        }}
                      >
                        <PlayerAvatar
                          player={player}
                          size={36}
                          borderRadius={6}
                        />
                      </div>

                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div
                          style={{
                            fontWeight: 800,
                            color: 'var(--text-dark)',
                            textOverflow: 'ellipsis',
                            overflow: 'hidden',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          {player.name}
                        </div>
                        <div
                          style={{
                            fontSize: 10,
                            color: 'var(--text-faint)',
                            fontFamily: "'Barlow Condensed', sans-serif",
                            fontWeight: 700
                          }}
                        >
                          REG #{reg} · {player.category || 'Category A'}
                        </div>
                      </div>
                    </div>

                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div
                        style={{
                          fontSize: 9,
                          fontFamily: "'Barlow Condensed', sans-serif",
                          fontWeight: 800,
                          color: 'var(--text-faint)',
                          letterSpacing: 1
                        }}
                      >
                        SOLD PRICE
                      </div>
                      <div
                        style={{
                          fontFamily: "'Barlow Condensed', sans-serif",
                          fontWeight: 900,
                          color: 'var(--crimson)',
                          fontSize: 15
                        }}
                      >
                        {formatCurrency(player.soldPrice ?? player.price)}
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Empty slots representation */}
              {slotsRemaining > 0 && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    marginTop: 8,
                    padding: '8px 12px',
                    border: '1px dashed #CBD5E1',
                    borderRadius: 6,
                    color: '#94A3B8',
                    fontSize: 11,
                    fontFamily: "'Barlow Condensed', sans-serif",
                    fontWeight: 700
                  }}
                >
                  <CheckCircle size={14} color="#94A3B8" />
                  <span>{slotsRemaining} EMPTY SQUAD SLOT{slotsRemaining > 1 ? 'S' : ''} REMAINING</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            background: '#F8F9FD',
            borderTop: '1px solid var(--border-light)',
            padding: '12px 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontFamily: "'Barlow Condensed', sans-serif",
              color: 'var(--text-faint)',
              fontWeight: 700
            }}
          >
            AUTHORITATIVE LIVE AUCTION DATA
          </div>
          <button
            onClick={onClose}
            className="btn btn-outline btn-sm"
            style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              fontWeight: 800,
              fontSize: 12,
              letterSpacing: 1
            }}
          >
            CLOSE
          </button>
        </div>
      </div>
    </div>
  );
}
