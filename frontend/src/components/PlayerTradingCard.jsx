import React from 'react';
import { formatCurrency, getImageUrl } from '../utils/api';
import PlayerAvatar from './PlayerAvatar';
import { Trophy, Zap, Sparkles, Star, Award, Shield, Flame, Activity } from 'lucide-react';

export const CATEGORY_TIERS = {
  'Category A': { name: 'Category A', type: 'All Rounders', basePrice: 100, color: '#F6A51A', bg: 'rgba(246,165,26,0.15)', border: '#F6A51A' },
  'Category B': { name: 'Category B', type: 'Segment Specialist', basePrice: 60, color: '#3B82F6', bg: 'rgba(59,130,246,0.15)', border: '#3B82F6' },
  'Category C': { name: 'Category C', type: 'Dark Horses', basePrice: 40, color: '#10B981', bg: 'rgba(16,185,129,0.15)', border: '#10B981' },
  'Category D': { name: 'Category D', type: 'Girl Power', basePrice: 200, color: '#EC4899', bg: 'rgba(236,72,153,0.15)', border: '#EC4899' },
};

export default function PlayerTradingCard({ player, currentBid, highestBidderName, highestBidderLogo, isLive = true }) {
  if (!player) return null;

  const categoryName = typeof player.category === 'object' && player.category !== null ? (player.category.category || 'Category A') : (player.category || 'Category A');
  const tier = CATEGORY_TIERS[categoryName] || CATEGORY_TIERS['Category A'];
  const rating = player.overallRating || player.overall_rating || 85;
  const score = player.scoreOutOf5 ?? player.score_out_of_5 ?? (rating / 20).toFixed(1);
  const ratingColor = rating >= 90 ? '#F6A51A' : rating >= 80 ? '#3B82F6' : '#10B981';
  const isReturning = (player.playerType || player.player_type || (player.isOldPlayer ? 'RETURNING' : 'NEW')).toUpperCase() === 'RETURNING';

  return (
    <div style={{
      background: 'linear-gradient(145deg, #0F233E 0%, #071526 100%)',
      borderRadius: 20,
      border: `2px solid ${tier.border}44`,
      padding: '24px',
      color: '#FFFFFF',
      boxShadow: `0 16px 36px rgba(0,0,0,0.35), 0 0 20px ${tier.border}22`,
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Background glow accent */}
      <div style={{
        position: 'absolute',
        top: -60,
        right: -60,
        width: 160,
        height: 160,
        borderRadius: '50%',
        background: `radial-gradient(circle, ${tier.border}33 0%, transparent 70%)`,
        pointerEvents: 'none'
      }} />

      {/* Card Header: Tier Badge & OVR Rating */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            padding: '4px 12px',
            borderRadius: 99,
            background: tier.bg,
            border: `1px solid ${tier.border}88`,
            color: tier.color,
            fontSize: 12,
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
            display: 'flex',
            alignItems: 'center',
            gap: 5
          }}>
            <Sparkles size={14} /> {categoryName} · {player.playerType || tier.type}
          </div>
          <span style={{
            fontSize: 11,
            padding: '3px 8px',
            borderRadius: 6,
            background: isReturning ? 'rgba(246,165,26,0.2)' : 'rgba(59,130,246,0.2)',
            color: isReturning ? 'var(--orange)' : '#93C5FD',
            fontWeight: 800
          }}>
            {isReturning ? 'RETURNING' : 'NEW'}
          </span>
          {(player.registrationId || player.registration_id) && (
            <span style={{
              fontSize: 11,
              padding: '3px 8px',
              borderRadius: 6,
              background: 'rgba(255,255,255,0.1)',
              color: 'rgba(255,255,255,0.8)',
              fontWeight: 800
            }}>
              {player.registrationId || player.registration_id}
            </span>
          )}
        </div>

        {/* Overall Rating & Score Badge */}
        <div style={{
          background: 'rgba(255,255,255,0.08)',
          border: `1.5px solid ${ratingColor}`,
          borderRadius: 10,
          padding: '4px 10px',
          display: 'flex',
          alignItems: 'center',
          gap: 6
        }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.6)' }}>SCORE</span>
          <span style={{ fontSize: 16, fontWeight: 900, color: '#10B981' }}>⭐ {Number(score).toFixed(1)}</span>
        </div>
      </div>

      {/* Profile & Main Details */}
      <div style={{ display: 'flex', gap: 20, alignItems: 'center', marginBottom: 20 }}>
        <div style={{
          width: 100,
          height: 120,
          borderRadius: 14,
          overflow: 'hidden',
          background: 'linear-gradient(135deg, #16365C, #0B1D33)',
          border: `2px solid ${tier.border}66`,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 8px 20px rgba(0,0,0,0.3)'
        }}>
          <PlayerAvatar
            player={player}
            size={100}
            borderRadius={12}
            style={{ width: '100%', height: '100%' }}
          />
        </div>

        <div style={{ flex: 1 }}>
          <h2 style={{ fontSize: 24, fontWeight: 900, color: '#FFFFFF', marginBottom: 6, lineHeight: 1.2 }}>
            {player.fullName || player.full_name || player.name}
          </h2>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
            {(player.speciality || player.experience) && (
              <span style={{ fontSize: 12, padding: '3px 10px', borderRadius: 6, background: 'rgba(255,255,255,0.08)', color: '#93C5FD', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <Shield size={12} /> {player.speciality || player.experience}
              </span>
            )}
            {(player.xFactor || player.xfactor) && (
              <span style={{ fontSize: 12, padding: '3px 10px', borderRadius: 6, background: 'rgba(246,165,26,0.15)', color: '#F6A51A', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4, border: '1px solid rgba(246,165,26,0.3)' }}>
                <Flame size={12} /> {player.xFactor || player.xfactor}
              </span>
            )}
          </div>

          <div style={{ display: 'flex', gap: 16, fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>
            <div>Base: <strong style={{ color: '#FFFFFF' }}>{formatCurrency(player.basePrice || player.base_price)}</strong></div>
            {(player.lastYearPrice || player.last_year_price) ? (
              <div>Last Year: <strong style={{ color: '#F6A51A' }}>{formatCurrency(player.lastYearPrice || player.last_year_price)}</strong></div>
            ) : null}
            {player.experience ? (
              <div>Exp: <strong style={{ color: '#FFFFFF' }}>{player.experience}</strong></div>
            ) : null}
          </div>
        </div>
      </div>

      {/* Live Bidding Box */}
      {isLive && currentBid !== undefined && (
        <div style={{
          background: 'rgba(0,0,0,0.35)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 14,
          padding: '14px 18px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>
              Current Highest Bid
            </div>
            <div style={{ fontSize: 26, fontWeight: 900, color: '#F6A51A' }}>
              {formatCurrency(currentBid)}
            </div>
          </div>

          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>
              Leading Team
            </div>
            <div style={{ fontSize: 16, fontWeight: 800, color: highestBidderName ? '#10B981' : 'rgba(255,255,255,0.4)', display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
              {highestBidderLogo && (
                <img src={getImageUrl(highestBidderLogo)} alt="" style={{ width: 22, height: 22, borderRadius: 4, objectFit: 'contain', background: '#FFFFFF', padding: 2 }} />
              )}
              {highestBidderName || 'No Bids Yet'}
            </div>
          </div>
        </div>
      )}

      {/* Stats row if available */}
      {player.stats && Object.keys(player.stats).length > 0 && (
        <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: `repeat(${Math.min(Object.keys(player.stats).length, 4)}, 1fr)`, gap: 8, textAlign: 'center' }}>
          {Object.entries(player.stats).map(([k, v]) => (
            <div key={k} style={{ padding: '6px 4px', background: 'rgba(255,255,255,0.04)', borderRadius: 8 }}>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', fontWeight: 600 }}>{k}</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#FFFFFF', marginTop: 2 }}>{v}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
