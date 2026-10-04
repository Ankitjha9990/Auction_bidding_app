import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import '../landing-theme.css';
import { api, formatCurrency, formatDateTimeIST, pickPrimaryAuction } from '../utils/api';
import {
  Trophy,
  Zap,
  Users,
  Eye,
  ShieldCheck,
  Coins,
  ArrowRight,
  ArrowUpRight,
  Sparkles,
  Activity,
  Layers,
  Radio,
  Calendar
} from 'lucide-react';

const featuresList = [
  {
    num: '01',
    icon: <Zap size={20} />,
    title: 'Real-Time Bidding',
    desc: 'Sub-second WebSocket synchronization keeps every captain and spectator on the exact same millisecond pulse.'
  },
  {
    num: '02',
    icon: <Coins size={20} />,
    title: 'Quad Currency Budget Engine',
    desc: 'Automated purse calculation, dynamic increment rules, and hard purse caps eliminate manual errors.'
  },
  {
    num: '03',
    icon: <Users size={20} />,
    title: 'Team Captain Portals',
    desc: 'Dedicated bidding terminals giving team leads instant bid triggers, roster trackers, and budget awareness.'
  },
  {
    num: '04',
    icon: <Eye size={20} />,
    title: 'Broadcast Spectator Mode',
    desc: 'High-definition viewing mode engineered for arena projector walls, live streams, and spectator screens.'
  },
  {
    num: '05',
    icon: <ShieldCheck size={20} />,
    title: 'Tournament Admin Console',
    desc: 'Complete control over the auction gavel, nomination queue, timer overrides, and immediate sale finalization.'
  },
  {
    num: '06',
    icon: <Layers size={20} />,
    title: 'Roster & Analytics Snapshot',
    desc: 'Live squad composition, tier breakdown, category allocation, and historical bidding telemetry.'
  }
];

const flowSteps = [
  {
    num: '01',
    title: 'Player Enters',
    desc: 'Admin nominates the player onto the floor with verified stats, category, and opening base price.'
  },
  {
    num: '02',
    title: 'Captains Bid',
    desc: 'Team captains battle in real time against an active auto-timer with instant outbid notifications.'
  },
  {
    num: '03',
    title: 'QC Updates',
    desc: 'Purse ledgers calculate dynamic spending limits and remaining slot allowances in real time.'
  },
  {
    num: '04',
    title: 'Player Sold',
    desc: 'Gavel drops, the player is locked into the winning squad roster, and the next auction immediately queues.'
  }
];

export default function LandingPage() {
  const [auctions, setAuctions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/auctions')
      .then(res => setAuctions(res.data || []))
      .catch(() => setAuctions([]))
      .finally(() => setLoading(false));
  }, []);

  const primaryAuction = pickPrimaryAuction(auctions);
  const liveAuction = auctions.find(a => a.status === 'LIVE');
  const scheduledAuction = !liveAuction ? auctions.find(a => a.status === 'SCHEDULED') : null;

  return (
    <div className="spectra-landing-page">
      {/* ── HEADER ── */}
      <header className="spectra-header">
        <div className="spectra-header-inner">
          <Link to="/" className="spectra-brand">
            <div className="spectra-logo-mark">
              <Trophy size={16} strokeWidth={2.5} />
            </div>
            <div className="spectra-brand-text">
              <span className="spectra-brand-title">SPECTRA <span>'26</span></span>
              <span className="spectra-brand-sub">ESPORTS AUCTION HUB</span>
            </div>
          </Link>

          <nav className="spectra-nav" aria-label="Main Navigation">
            <a href="#features">Features</a>
            <a href="#floor">The Floor</a>
            <a href="#how-it-works">How It Works</a>
            <a href="#overview">Overview</a>
          </nav>

          <div className="spectra-header-ctas">
            <Link to={primaryAuction ? `/live/${primaryAuction.id}` : '/viewer'} className="sp-btn sp-btn-ghost">
              <Eye size={15} />
              <span>Live Viewer</span>
            </Link>
            <Link to="/login" className="sp-btn sp-btn-primary">
              <span>Portal Login</span>
              <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </header>

      {/* ── MAIN CONTENT ── */}
      <main className="spectra-main">
        {/* ── HERO SECTION ── */}
        <section className="spectra-hero-section">
          <div className="spectra-hero-layout">
            <div className="spectra-hero-content">
              {/* Editorial Eyebrow */}
              <div className="spectra-hero-eyebrow">
                <span className="spectra-eyebrow-tag">SPECTRA 2026 / VALOR CUP</span>
                <span className="spectra-eyebrow-divider" />
                <span className="spectra-eyebrow-sub">LIVE AUCTION PLATFORM</span>
              </div>

              {/* Clean Editorial Headline */}
              <h1 className="spectra-hero-headline">
                Next-Gen real-time<br />
                esports <span className="highlight-amber">bidding arena.</span>
              </h1>

              {/* Description */}
              <p className="spectra-hero-desc">
                Experience sub-second WebSocket bidding, Quad Currency (QC) budget management,
                live team captain strategy panels, and high-definition spectator broadcast.
              </p>

              {/* Action Buttons */}
              <div className="spectra-hero-ctas">
                <Link to={primaryAuction ? `/live/${primaryAuction.id}` : '/viewer'} className="sp-btn sp-btn-primary sp-btn-lg">
                  <Eye size={17} />
                  <span>Open Live Viewer Screen</span>
                </Link>
                <Link to="/login" className="sp-btn sp-btn-secondary sp-btn-lg">
                  <ShieldCheck size={17} />
                  <span>Captain & Admin Login</span>
                </Link>
              </div>
            </div>

            {/* Subtle Product Preview (Hero right side) */}
            <div className="spectra-hero-preview">
              <div className="spectra-preview-card">
                <div className="spectra-preview-card-header">
                  <div className="spectra-preview-badge-live">
                    <span className="spectra-live-pulse-dot" />
                    <span>Live Floor</span>
                  </div>
                  <span className="spectra-preview-room-tag">Room 01 · Valor Cup</span>
                </div>

                <div className="spectra-preview-card-body">
                  <div className="spectra-preview-player-row">
                    <div className="spectra-preview-player-info">
                      <span className="spectra-preview-kicker">Current Player</span>
                      <span className="spectra-preview-player-name">Nova Striker</span>
                      <span className="spectra-preview-player-role">Mid Lane · Assassin Specialist</span>
                    </div>
                    <span className="spectra-preview-tier-badge">TIER S</span>
                  </div>

                  <div className="spectra-preview-bid-box">
                    <div className="spectra-preview-bid-meta">
                      <span>Highest Bid</span>
                      <span>Base: 500K QC</span>
                    </div>
                    <div className="spectra-preview-bid-val">{formatCurrency(1800000)}</div>
                    <div className="spectra-preview-bid-team">
                      <Activity size={14} />
                      <span>Leading: Dragon Fire</span>
                    </div>
                  </div>

                  <div className="spectra-preview-footer-strip">
                    <span>Purse: <strong>5.2M QC Remaining</strong></span>
                    <span>⚡ <strong>12ms</strong> WebSocket</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── LIVE OR UPCOMING AUCTION BANNER ── */}
        {liveAuction ? (
          <section id="auctions" className="spectra-live-banner">
            <div className="spectra-live-banner-content">
              <div className="spectra-live-banner-tag">
                <span className="spectra-live-pulse-dot" />
                <span>Live Tournament Floor Active</span>
              </div>
              <h3>{liveAuction.name}</h3>
              <p>
                {liveAuction.seriesName || liveAuction.tournamentName || 'Valor Cup 2026'} · Starting Purse: {formatCurrency(liveAuction.startingBudget)}
              </p>
            </div>
            <Link to={`/live/${liveAuction.id}`} className="sp-btn sp-btn-primary sp-btn-lg">
              <span>Watch Live Broadcast</span>
              <ArrowUpRight size={16} />
            </Link>
          </section>
        ) : scheduledAuction ? (
          <section id="auctions" className="spectra-live-banner" style={{ background: 'linear-gradient(135deg, #1E293B, #0F172A)', border: '1px solid rgba(245,158,11,0.4)' }}>
            <div className="spectra-live-banner-content">
              <div className="spectra-live-banner-tag" style={{ background: 'rgba(245,158,11,0.2)', borderColor: 'rgba(245,158,11,0.5)', color: '#FCD34D' }}>
                <Calendar size={13} color="#FCD34D" />
                <span>Upcoming Scheduled Tournament</span>
              </div>
              <h3 style={{ color: '#FFFFFF' }}>{scheduledAuction.name}</h3>
              <p style={{ color: 'rgba(255,255,255,0.8)' }}>
                {scheduledAuction.seriesName || scheduledAuction.tournamentName} · Schedule (IST): <strong style={{ color: '#FCD34D' }}>{formatDateTimeIST(scheduledAuction.scheduledAt || scheduledAuction.auctionDate)}</strong> · Purse: {formatCurrency(scheduledAuction.startingBudget)}
              </p>
            </div>
            <Link to={`/live/${scheduledAuction.id}`} className="sp-btn sp-btn-primary sp-btn-lg" style={{ background: '#D97706', borderColor: '#B45309' }}>
              <span>Preview Tournament Hub</span>
              <ArrowUpRight size={16} />
            </Link>
          </section>
        ) : null}

        {/* ── STATEMENT SECTION & HORIZONTAL STRIP ── */}
        <section className="spectra-statement-section">
          <div className="spectra-statement-grid">
            <span className="spectra-statement-kicker">BUILT FOR LIVE AUCTION</span>
            <h2 className="spectra-statement-headline">
              A real-time platform designed for players, captains and spectators.
            </h2>
          </div>

          <div className="spectra-statement-row">
            <div className="spectra-statement-col">
              <span className="spectra-statement-num">01</span>
              <h4>Real-Time Bidding</h4>
              <p>Instantaneous WebSocket dispatch synchronizes every click.</p>
            </div>
            <div className="spectra-statement-col">
              <span className="spectra-statement-num">02</span>
              <h4>Quad Currency</h4>
              <p>Transparent budget ledger tracking every QC transaction.</p>
            </div>
            <div className="spectra-statement-col">
              <span className="spectra-statement-num">03</span>
              <h4>Team Captains</h4>
              <p>Strategic terminals for fast bids and purse protection.</p>
            </div>
            <div className="spectra-statement-col">
              <span className="spectra-statement-num">04</span>
              <h4>Live Viewer</h4>
              <p>Broadcast-ready spectator arena with live stats.</p>
            </div>
          </div>
        </section>

        {/* ── FEATURES SECTION ── */}
        <section id="features" className="spectra-features-section">
          <div className="spectra-section-header">
            <span className="spectra-section-kicker">FEATURES</span>
            <h2 className="spectra-section-title">Built for the high-pressure auction floor.</h2>
            <p className="spectra-section-sub">
              Every tool and interface is tuned for split-second decisions and absolute accuracy.
            </p>
          </div>

          <div className="spectra-features-grid">
            {featuresList.map((item) => (
              <div key={item.num} className="spectra-feature-item">
                <div className="spectra-feature-top">
                  <span className="spectra-feature-num">{item.num}</span>
                  <div className="spectra-feature-icon-box">
                    {item.icon}
                  </div>
                </div>
                <h3>{item.title}</h3>
                <p>{item.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── STATISTICS STRIP ── */}
        <section id="overview" className="spectra-stats-section">
          <div className="spectra-stats-strip">
            <div className="spectra-stat-cell">
              <span className="spectra-stat-val">05</span>
              <span className="spectra-stat-label">Competing Teams</span>
            </div>
            <div className="spectra-stat-cell">
              <span className="spectra-stat-val">100+</span>
              <span className="spectra-stat-label">Registered Players</span>
            </div>
            <div className="spectra-stat-cell">
              <span className="spectra-stat-val accent">QC</span>
              <span className="spectra-stat-label">Quad Currency Budget</span>
            </div>
            <div className="spectra-stat-cell">
              <span className="spectra-stat-val">LIVE</span>
              <span className="spectra-stat-label">Real-Time WebSocket</span>
            </div>
          </div>
        </section>

        {/* ── AUCTION FLOW / HOW IT WORKS ── */}
        <section id="how-it-works" className="spectra-flow-section">
          <div className="spectra-section-header">
            <span className="spectra-section-kicker">HOW IT WORKS</span>
            <h2 className="spectra-section-title">From player entry to final sale.</h2>
            <p className="spectra-section-sub">
              A structured four-phase auction lifecycle designed for fairness and momentum.
            </p>
          </div>

          <div className="spectra-flow-timeline">
            {flowSteps.map((step) => (
              <div key={step.num} className="spectra-flow-card">
                <span className="spectra-flow-step-num">{step.num}</span>
                <h4>{step.title}</h4>
                <p>{step.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── PRODUCT PREVIEW: THE AUCTION FLOOR ── */}
        <section id="floor" className="spectra-floor-section">
          <div className="spectra-section-header">
            <span className="spectra-section-kicker">THE AUCTION FLOOR</span>
            <h2 className="spectra-section-title">Clean precision on every screen.</h2>
            <p className="spectra-section-sub">
              The central arena console synchronizing captains, tournament admins, and broadcast feeds.
            </p>
          </div>

          <div className="spectra-floor-mockup">
            <div className="spectra-floor-topbar">
              <div className="spectra-floor-dots">
                <span className="spectra-floor-dot active" />
                <span className="spectra-floor-dot" />
                <span className="spectra-floor-dot" />
              </div>
              <span className="spectra-floor-title">SPECTRA ’26 · ARENA CONSOLE VIEW</span>
              <div className="spectra-floor-status">
                <span className="spectra-live-pulse-dot" />
                <span>Synchronized (0ms Jitter)</span>
              </div>
            </div>

            <div className="spectra-floor-body">
              <div className="spectra-floor-main-col">
                <div className="spectra-floor-player-card">
                  <div className="spectra-floor-player-header">
                    <div>
                      <span className="spectra-preview-kicker">ON THE AUCTION BLOCK</span>
                      <h3 className="spectra-floor-player-title">VORTEX SHADOW</h3>
                    </div>
                    <span className="spectra-preview-tier-badge">DUELIST · TIER S</span>
                  </div>

                  <div className="spectra-preview-bid-box">
                    <div className="spectra-preview-bid-meta">
                      <span>CURRENT LEADING BID</span>
                      <span>TIME REMAINING: 14s</span>
                    </div>
                    <div className="spectra-preview-bid-val">{formatCurrency(2450000)}</div>
                    <div className="spectra-preview-bid-team">
                      <Radio size={14} />
                      <span>HELD BY TEAM TITAN</span>
                    </div>
                  </div>

                  <div className="spectra-floor-player-stats-grid">
                    <div className="spectra-floor-mini-stat">
                      <span>K/D RATIO</span>
                      <strong>1.48</strong>
                    </div>
                    <div className="spectra-floor-mini-stat">
                      <span>WIN RATE</span>
                      <strong>68.4%</strong>
                    </div>
                    <div className="spectra-floor-mini-stat">
                      <span>BASE VAL</span>
                      <strong>750K QC</strong>
                    </div>
                  </div>
                </div>
              </div>

              <div className="spectra-floor-side-col">
                <div className="spectra-floor-side-head">
                  <h5>LIVE BID STREAM</h5>
                  <span className="spectra-preview-room-tag">REAL-TIME</span>
                </div>

                <div className="spectra-floor-bid-list">
                  <div className="spectra-floor-bid-item active-bid">
                    <span className="spectra-floor-bid-team">TEAM TITAN</span>
                    <span className="spectra-floor-bid-amount">{formatCurrency(2450000)}</span>
                  </div>
                  <div className="spectra-floor-bid-item">
                    <span className="spectra-floor-bid-team">DRAGON FIRE</span>
                    <span className="spectra-floor-bid-amount">{formatCurrency(2300000)}</span>
                  </div>
                  <div className="spectra-floor-bid-item">
                    <span className="spectra-floor-bid-team">CYBER WOLVES</span>
                    <span className="spectra-floor-bid-amount">{formatCurrency(2100000)}</span>
                  </div>
                  <div className="spectra-floor-bid-item">
                    <span className="spectra-floor-bid-team">PHOENIX SQUAD</span>
                    <span className="spectra-floor-bid-amount">{formatCurrency(1900000)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── FINAL CALL TO ACTION ── */}
        <section className="spectra-final-cta">
          <div className="spectra-final-cta-box">
            <h2>Ready to enter the arena?</h2>
            <p>
              Launch the spectator broadcast to follow live bids in real time, or sign in to your team captain portal to place bids.
            </p>
            <div className="spectra-final-cta-buttons">
              <Link to="/viewer" className="sp-btn sp-btn-primary sp-btn-lg">
                <Eye size={18} />
                <span>Open Live Viewer</span>
              </Link>
              <Link to="/login" className="sp-btn sp-btn-secondary sp-btn-lg">
                <ShieldCheck size={18} />
                <span>Captain & Admin Login</span>
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* ── FOOTER ── */}
      <footer className="spectra-footer">
        <div className="spectra-footer-inner">
          <div className="spectra-footer-left">
            <div className="spectra-logo-mark" style={{ width: 28, height: 28 }}>
              <Trophy size={14} strokeWidth={2.5} />
            </div>
            <span className="spectra-brand-title">SPECTRA <span>'26</span></span>
            <span className="spectra-footer-copy">· Esports Auction System</span>
          </div>

          <div className="spectra-footer-links">
            <Link to="/viewer">Live Viewer</Link>
            <Link to="/login">Captain Login</Link>
            <Link to="/login">Admin Portal</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
