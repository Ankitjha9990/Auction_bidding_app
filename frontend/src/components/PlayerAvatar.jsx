import React, { useState, useEffect } from 'react';
import { getPlayerImageUrl, getImageUrl } from '../utils/api';

export default function PlayerAvatar({
  player,
  name,
  imageUrl,
  size = 46,
  borderRadius = 4,
  border = 'none',
  className = '',
  style = {},
  alt
}) {
  const playerName = player?.full_name || player?.display_name || player?.name || name || 'Player';
  const playerImage = getPlayerImageUrl(player) || (imageUrl ? getImageUrl(imageUrl) : null);
  const [hasError, setHasError] = useState(!playerImage);

  useEffect(() => {
    setHasError(!playerImage);
  }, [playerImage]);

  const initials = playerName
    .split(' ')
    .filter(Boolean)
    .map(n => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || 'VC';

  if (hasError || !playerImage) {
    return (
      <div
        className={`vc-avatar-fallback ${className}`}
        style={{
          width: size,
          height: size,
          minWidth: size,
          minHeight: size,
          borderRadius: borderRadius || 4,
          border: border || '1px solid var(--border-crimson)',
          background: '#F8F9FD',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justify: 'center',
          color: 'var(--text-dark)',
          boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
          flexShrink: 0,
          position: 'relative',
          overflow: 'hidden',
          userSelect: 'none',
          ...style
        }}
      >
        <span style={{
          fontFamily: "'Barlow Condensed', sans-serif",
          fontWeight: 900,
          fontSize: Math.max(12, Math.round(size * 0.38)),
          letterSpacing: 1,
          color: 'var(--text-dark)',
          zIndex: 1,
          lineHeight: 1
        }}>
          {initials}
        </span>
        {size >= 60 && (
          <span style={{
            fontFamily: "'Barlow Condensed', sans-serif",
            fontWeight: 800,
            fontSize: Math.max(7, Math.round(size * 0.12)),
            color: 'var(--text-faint)',
            letterSpacing: 1.5,
            zIndex: 1,
            marginTop: 2,
            textTransform: 'uppercase',
            opacity: 0.7
          }}>
            VALOR CUP
          </span>
        )}
      </div>
    );
  }

  return (
    <img
      src={playerImage}
      alt={alt || playerName}
      className={className}
      onError={() => setHasError(true)}
      style={{
        width: size,
        height: size,
        minWidth: size,
        minHeight: size,
        borderRadius: borderRadius || 4,
        objectFit: 'cover',
        border: border || '1px solid var(--border-crimson)',
        flexShrink: 0,
        background: '#1A0207',
        display: 'block',
        ...style
      }}
    />
  );
}

