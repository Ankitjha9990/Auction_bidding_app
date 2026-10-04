import { useState, useEffect } from 'react';
import { getImageUrl } from '../utils/api';

export default function TeamLogo({ logoUrl, name, size = 32, style = {}, className = '' }) {
  const [hasError, setHasError] = useState(false);

  // Reset error state if logoUrl changes
  useEffect(() => {
    setHasError(false);
  }, [logoUrl]);

  const src = logoUrl && !hasError ? getImageUrl(logoUrl) : null;
  const initials = (name || '?').trim().slice(0, 2).toUpperCase();

  if (src) {
    return (
      <img
        src={src}
        alt={name || 'Team'}
        className={className}
        style={{
          width: size,
          height: size,
          objectFit: 'contain',
          borderRadius: 4,
          background: '#F1F5F9',
          border: '1px solid #E2E8F0',
          flexShrink: 0,
          ...style
        }}
        onError={() => setHasError(true)}
      />
    );
  }

  return (
    <div
      className={className}
      style={{
        width: size,
        height: size,
        borderRadius: 4,
        background: 'rgba(196,18,48,0.12)',
        border: '1px solid var(--border-crimson)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: "'Barlow Condensed', sans-serif",
        fontWeight: 800,
        fontSize: Math.max(10, Math.round(size * 0.4)),
        color: 'var(--crimson)',
        flexShrink: 0,
        textTransform: 'uppercase',
        ...style
      }}
    >
      {initials}
    </div>
  );
}
