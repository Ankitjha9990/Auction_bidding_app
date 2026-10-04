import { useEffect, useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api, formatCurrency, getImageUrl, getPlayerImageUrl, getStatusBadgeClass } from '../../utils/api';
import { CATEGORY_TIERS } from '../../components/PlayerTradingCard';
import PlayerAvatar from '../../components/PlayerAvatar';
import { 
  Users, 
  UserPlus, 
  Shuffle, 
  Search, 
  Filter, 
  Edit, 
  Trash2, 
  RotateCcw, 
  Sparkles, 
  Shield, 
  Star, 
  Flame, 
  Camera,
  Coins,
  CheckCircle2,
  AlertCircle,
  Upload,
  FileSpreadsheet,
  History,
  Archive,
  RefreshCw,
  LayoutGrid,
  List,
  Check,
  X,
  ExternalLink,
  ChevronRight,
  TrendingUp,
  Award
} from 'lucide-react';

const CATEGORY_OPTIONS = [
  { category: 'Category A', playerType: 'All Rounders', defaultBase: 100 },
  { category: 'Category B', playerType: 'Segment Specialist', defaultBase: 60 },
  { category: 'Category C', playerType: 'Dark Horses', defaultBase: 40 },
  { category: 'Category D', playerType: 'Girl Power', defaultBase: 200 },
];

export function getPlayerCategory(p) {
  if (!p) return 'Category A';
  const cat = typeof p === 'object' && p !== null && 'category' in p ? p.category : p;
  if (typeof cat === 'object' && cat !== null) return cat.category || 'Category A';
  return typeof cat === 'string' && cat.trim() ? cat.trim() : 'Category A';
}

const emptyForm = {
  full_name: '',
  display_name: '',
  registration_id: '',
  category: 'Category A',
  player_type: 'NEW',
  speciality: '',
  x_factor: '',
  score_out_of_5: 3.5,
  overall_rating: 75,
  base_price: 100,
  last_year_price: '',
  experience: '',
  bio: '',
  is_highlighted: false,
  highlight_reason: '',
  is_active: true
};

export default function AdminPlayers() {
  const { id: auctionId } = useParams();
  const [players, setPlayers] = useState([]);
  const [auction, setAuction] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // UI Controls
  const [viewMode, setViewMode] = useState('table'); // 'table' | 'cards'
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('ALL'); // ALL, NEW, RETURNING
  const [filterCategory, setFilterCategory] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL'); // ALL, ACTIVE, ARCHIVED
  const [filterPhoto, setFilterPhoto] = useState('ALL'); // ALL, HAS_PHOTO, NO_PHOTO
  const [filterHighlighted, setFilterHighlighted] = useState(false);

  // Modals
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [formImageFile, setFormImageFile] = useState(null);
  const [formImagePreview, setFormImagePreview] = useState(null);
  const [saving, setSaving] = useState(false);

  // Excel Import Modal State
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importPreview, setImportPreview] = useState(null);
  const [importResolutions, setImportResolutions] = useState({});
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);

  // History Modal State
  const [historyPlayer, setHistoryPlayer] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Bulk actions
  const [selectedIds, setSelectedIds] = useState([]);
  const [uploadingId, setUploadingId] = useState(null);

  const fileRef = useRef();
  const quickFileRef = useRef();
  const excelFileRef = useRef();

  const loadPlayers = async () => {
    try {
      setLoading(true);
      const [aucRes, plRes] = await Promise.all([
        api.get('/auctions'),
        api.get('/players?includeArchived=true')
      ]);
      const activeAuction = aucRes.data?.find(a => a.id === auctionId) || aucRes.data?.[0];
      setAuction(activeAuction || null);
      setPlayers(plRes.data || []);
    } catch (err) {
      console.error('Failed to load master players:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPlayers();
  }, [auctionId]);

  // Open Edit Modal
  const openAdd = () => {
    setEditingPlayer(null);
    setForm({
      ...emptyForm,
      registration_id: `#P-${String(players.length + 1).padStart(3, '0')}`
    });
    setFormImageFile(null);
    setFormImagePreview(null);
    setShowEditModal(true);
  };

  const openEdit = (p) => {
    setEditingPlayer(p);
    const cat = getPlayerCategory(p);
    setForm({
      full_name: p.full_name || p.name || '',
      display_name: p.display_name || p.full_name || p.name || '',
      registration_id: p.registration_id || p.registrationId || '',
      category: cat,
      player_type: (p.player_type || p.playerType || (p.isOldPlayer ? 'RETURNING' : 'NEW')).toUpperCase(),
      speciality: p.speciality || '',
      x_factor: p.x_factor || p.xfactor || '',
      score_out_of_5: p.score_out_of_5 ?? 3.5,
      overall_rating: p.overall_rating ?? p.overallRating ?? 75,
      base_price: p.base_price ?? p.basePrice ?? 100,
      last_year_price: p.last_year_price ?? p.lastYearPrice ?? '',
      experience: p.experience || '',
      bio: p.bio || '',
      is_highlighted: Boolean(p.is_highlighted),
      highlight_reason: p.highlight_reason || '',
      is_active: p.is_active !== false
    });
    setFormImagePreview(getPlayerImageUrl(p));
    setFormImageFile(null);
    setShowEditModal(true);
  };

  // Open Player History
  const openHistory = async (p) => {
    setHistoryPlayer({ ...p, auctionHistory: [] });
    setHistoryLoading(true);
    try {
      const res = await api.get(`/players/${p.id}`);
      setHistoryPlayer(res.data);
    } catch (err) {
      console.error('Failed to load player history:', err);
    } finally {
      setHistoryLoading(false);
    }
  };

  // Save Player Form
  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => {
        if (v !== null && v !== undefined) fd.append(k, v);
      });
      if (formImageFile) fd.append('image', formImageFile);

      if (editingPlayer) {
        await api.patch(`/players/${editingPlayer.id}`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      } else {
        await api.post('/players', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      }

      setShowEditModal(false);
      loadPlayers();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to save player');
    } finally {
      setSaving(false);
    }
  };

  // Photo Upload & Delete
  const handleImageFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setFormImageFile(file);
    const reader = new FileReader();
    reader.onload = ev => setFormImagePreview(ev.target.result);
    reader.readAsDataURL(file);
  };

  const removePhoto = async () => {
    if (editingPlayer && getPlayerImageUrl(editingPlayer)) {
      if (!confirm('Remove photo for this player?')) return;
      try {
        await api.delete(`/players/${editingPlayer.id}/image`);
        setFormImagePreview(null);
        setFormImageFile(null);
        loadPlayers();
      } catch (err) {
        alert('Failed to remove photo');
      }
    } else {
      setFormImagePreview(null);
      setFormImageFile(null);
    }
  };

  // Quick Photo from Directory
  const triggerQuickUpload = (id) => {
    setUploadingId(id);
    if (quickFileRef.current) {
      quickFileRef.current.value = '';
      quickFileRef.current.click();
    }
  };

  const handleQuickImageSelected = async (e) => {
    const file = e.target.files[0];
    if (!file || !uploadingId) return;
    try {
      const fd = new FormData();
      fd.append('image', file);
      await api.post(`/players/${uploadingId}/image`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      loadPlayers();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to upload image');
    } finally {
      setUploadingId(null);
    }
  };

  // Safe Archive / Delete Player
  const handleDelete = async (p) => {
    const hasHistory = p.status === 'SOLD' || p.lastYearPrice || p.soldPrice;
    const confirmMsg = hasHistory
      ? `Player "${p.full_name || p.name}" has auction history.\n\nArchive this player? This will remove them from future auction drafts while safely retaining all historical records.`
      : `Delete player "${p.full_name || p.name}" permanently from the master database?`;

    if (!confirm(confirmMsg)) return;

    try {
      const res = await api.delete(`/players/${p.id}`);
      alert(res.data.message || 'Player updated');
      loadPlayers();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete player');
    }
  };

  const handleRestore = async (p) => {
    try {
      await api.post(`/players/${p.id}/restore`);
      loadPlayers();
    } catch (err) {
      alert('Failed to restore player');
    }
  };

  // Excel Import Logic
  const handleExcelFileSelect = async (e) => {
    const file = e.target?.files?.[0] || importFile;
    if (!file && !e.useDefault) return;

    setImporting(true);
    setImportResult(null);
    try {
      const fd = new FormData();
      if (file) fd.append('excel', file);

      const res = await api.post('/players/import-excel-preview', fd, {
        headers: file ? { 'Content-Type': 'multipart/form-data' } : {}
      });

      setImportPreview(res.data);
      // Initialize resolution map default to 'use_existing' for duplicates
      const initResolutions = {};
      (res.data.duplicates || []).forEach(d => {
        initResolutions[d.full_name] = 'use_existing';
      });
      setImportResolutions(initResolutions);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to parse Excel sheet');
    } finally {
      setImporting(false);
    }
  };

  const commitExcelImport = async () => {
    if (!importPreview?.rows?.length) return;
    setImporting(true);
    try {
      const res = await api.post('/players/import-excel-commit', {
        rows: importPreview.rows,
        resolutions: importResolutions
      });
      setImportResult(res.data);
      loadPlayers();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to commit import');
    } finally {
      setImporting(false);
    }
  };

  // Filtered player list
  const filtered = players.filter(p => {
    const name = (p.full_name || p.name || '').toLowerCase();
    const reg = (p.registration_id || p.registrationId || '').toLowerCase();
    const spec = (p.speciality || '').toLowerCase();
    const xf = (p.x_factor || p.xfactor || '').toLowerCase();
    const q = search.toLowerCase().trim();

    const matchSearch = !q || name.includes(q) || reg.includes(q) || spec.includes(q) || xf.includes(q);
    
    const pType = (p.player_type || p.playerType || (p.isOldPlayer ? 'RETURNING' : 'NEW')).toUpperCase();
    const matchType = filterType === 'ALL' || pType === filterType;

    const pCat = getPlayerCategory(p).toUpperCase();
    const matchCat = filterCategory === 'ALL' || pCat === filterCategory.toUpperCase();
    
    let matchStatus = true;
    if (filterStatus === 'ACTIVE') matchStatus = p.is_active !== false;
    else if (filterStatus === 'ARCHIVED') matchStatus = p.is_active === false;

    let matchPhoto = true;
    if (filterPhoto === 'HAS_PHOTO') matchPhoto = Boolean(getPlayerImageUrl(p));
    else if (filterPhoto === 'NO_PHOTO') matchPhoto = !getPlayerImageUrl(p);

    let matchHighlight = true;
    if (filterHighlighted) matchHighlight = Boolean(p.is_highlighted);

    return matchSearch && matchType && matchCat && matchStatus && matchPhoto && matchHighlight;
  });

  // Counters
  const totalCount = players.length;
  const activeCount = players.filter(p => p.is_active !== false).length;
  const returningCount = players.filter(p => (p.player_type || p.playerType || (p.isOldPlayer ? 'RETURNING' : 'NEW')).toUpperCase() === 'RETURNING').length;
  const newCount = totalCount - returningCount;
  const withPhotosCount = players.filter(p => Boolean(getPlayerImageUrl(p))).length;
  const highlightedCount = players.filter(p => p.is_highlighted).length;

  return (
    <div className="page-content" style={{ width: '100%', maxWidth: '100%' }}>
      {/* Hidden quick photo upload file input */}
      <input ref={quickFileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleQuickImageSelected} />

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 14 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h2 className="page-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 10, fontSize: 24, fontWeight: 900, color: 'var(--navy)' }}>
              <Users size={26} color="var(--orange)" /> Master Player Database
            </h2>
            <span style={{ fontSize: 11, fontWeight: 800, padding: '3px 8px', borderRadius: 6, background: 'rgba(15,35,62,0.08)', color: 'var(--navy)', letterSpacing: 0.5 }}>
              VALOR CUP PERMANENT POOL
            </span>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 4 }}>
            Single source of truth for all players across auctions. Manage profiles, upload photos, and import Excel rosters.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Excel Import Button */}
          <button 
            className="btn btn-navy" 
            onClick={() => { setShowImportModal(true); setImportResult(null); }}
            style={{ gap: 7, fontWeight: 700, padding: '8px 16px' }}
          >
            <FileSpreadsheet size={17} /> Import Excel Data
          </button>

          {/* Add Master Player */}
          <button 
            className="btn btn-primary" 
            onClick={openAdd}
            style={{ gap: 7, fontWeight: 800, padding: '8px 18px' }}
          >
            <UserPlus size={18} /> + Add Player
          </button>
        </div>
      </div>

      {/* Stat Metric Cards */}
      <div className="grid grid-4 gap-3" style={{ marginBottom: 20 }}>
        {[
          { label: 'Master Players', value: totalCount, sub: `${activeCount} Active · ${totalCount - activeCount} Archived`, color: 'var(--navy)', onClick: () => { setFilterType('ALL'); setFilterStatus('ALL'); } },
          { label: 'Returning Players', value: returningCount, sub: 'With past pricing & stats', color: 'var(--orange)', onClick: () => setFilterType('RETURNING') },
          { label: 'New Entrants', value: newCount, sub: 'Fresh draft pool', color: '#3B82F6', onClick: () => setFilterType('NEW') },
          { label: 'Uploaded Photos', value: withPhotosCount, sub: `${totalCount - withPhotosCount} with smart avatars`, color: 'var(--green)', onClick: () => setFilterPhoto('HAS_PHOTO') },
        ].map(s => (
          <div key={s.label} className="stat-card" style={{ cursor: 'pointer', transition: 'all 0.2s', padding: '14px 18px', borderLeft: `4px solid ${s.color}` }} onClick={s.onClick}>
            <div className="stat-value" style={{ color: s.color, fontSize: 26, fontWeight: 900 }}>{s.value}</div>
            <div className="stat-label" style={{ marginTop: 2, fontWeight: 700, color: 'var(--text-primary)' }}>{s.label}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Filter & Search Bar */}
      <div className="card" style={{ padding: '12px 18px', marginBottom: 20, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        {/* Search */}
        <div style={{ position: 'relative', width: 240, minWidth: 180 }}>
          <input 
            className="form-input" 
            style={{ paddingLeft: 34, height: 36, fontSize: 13 }} 
            placeholder="Search name, Reg ID, skill..." 
            value={search} 
            onChange={e => setSearch(e.target.value)} 
          />
          <Search size={15} style={{ position: 'absolute', left: 11, top: 10, color: 'var(--text-muted)' }} />
        </div>

        {/* Type Filter */}
        <select className="form-input" style={{ width: 135, height: 36, fontSize: 13 }} value={filterType} onChange={e => setFilterType(e.target.value)}>
          <option value="ALL">All Types</option>
          <option value="RETURNING">Returning ({returningCount})</option>
          <option value="NEW">New ({newCount})</option>
        </select>

        {/* Category Filter */}
        <select className="form-input" style={{ width: 160, height: 36, fontSize: 13 }} value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
          <option value="ALL">All Categories</option>
          {CATEGORY_OPTIONS.map(c => (
            <option key={c.category} value={c.category}>{c.category}</option>
          ))}
        </select>

        {/* Status Filter */}
        <select className="form-input" style={{ width: 130, height: 36, fontSize: 13 }} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="ALL">All Status</option>
          <option value="ACTIVE">Active Pool</option>
          <option value="ARCHIVED">Archived</option>
        </select>

        {/* Photo Filter */}
        <select className="form-input" style={{ width: 130, height: 36, fontSize: 13 }} value={filterPhoto} onChange={e => setFilterPhoto(e.target.value)}>
          <option value="ALL">All Photos</option>
          <option value="HAS_PHOTO">Has Photo</option>
          <option value="NO_PHOTO">Needs Photo</option>
        </select>

        {/* Highlighted Toggle */}
        <button 
          className={`btn btn-sm ${filterHighlighted ? 'btn-primary' : 'btn-outline'}`}
          onClick={() => setFilterHighlighted(prev => !prev)}
          style={{ height: 36, gap: 5, fontSize: 12, fontWeight: 700 }}
        >
          <Sparkles size={14} /> Highlighted ({highlightedCount})
        </button>

        {/* View Mode Toggle */}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 4, background: 'var(--bg)', padding: 3, borderRadius: 6, border: '1px solid var(--border)' }}>
          <button 
            className={`btn btn-sm ${viewMode === 'table' ? 'btn-primary' : 'btn-ghost'}`} 
            onClick={() => setViewMode('table')} 
            style={{ padding: '4px 8px', height: 28 }}
            title="Table View"
          >
            <List size={15} />
          </button>
          <button 
            className={`btn btn-sm ${viewMode === 'cards' ? 'btn-primary' : 'btn-ghost'}`} 
            onClick={() => setViewMode('cards')} 
            style={{ padding: '4px 8px', height: 28 }}
            title="Scouting Cards View"
          >
            <LayoutGrid size={15} />
          </button>
        </div>

        <span style={{ color: 'var(--text-muted)', fontSize: 12, fontWeight: 600, paddingLeft: 6 }}>
          Showing {filtered.length} of {players.length}
        </span>
      </div>

      {/* Main Players Content */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 80 }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
      ) : filtered.length === 0 ? (
        <div className="card empty-state" style={{ padding: 60, textAlign: 'center' }}>
          <div style={{ margin: '0 auto 16px', width: 64, height: 64, borderRadius: '50%', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
            <Users size={32} />
          </div>
          <h3>No matching players found</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Try relaxing search filters or import the Excel file.</p>
        </div>
      ) : viewMode === 'cards' ? (
        /* Scouting Cards View */
        <div className="grid grid-3 gap-4">
          {filtered.map(p => {
            const isReturning = (p.player_type || p.playerType || (p.isOldPlayer ? 'RETURNING' : 'NEW')).toUpperCase() === 'RETURNING';
            const catName = getPlayerCategory(p);
            const tier = CATEGORY_TIERS[catName] || CATEGORY_TIERS['Category A'];
            const score = p.score_out_of_5 !== undefined ? Number(p.score_out_of_5).toFixed(1) : '3.5';

            return (
              <div 
                key={p.id} 
                className="card" 
                style={{ 
                  padding: 16, 
                  position: 'relative', 
                  opacity: p.is_active === false ? 0.65 : 1,
                  borderTop: `4px solid ${tier.border || 'var(--orange)'}`,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12
                }}
              >
                {/* Header: Photo + Main identifiers */}
                <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                  <div 
                    style={{ position: 'relative', width: 64, height: 64, flexShrink: 0, cursor: 'pointer' }}
                    onClick={() => triggerQuickUpload(p.id)}
                    title="Click to upload/change photo"
                  >
                    <PlayerAvatar player={p} size={64} borderRadius={10} border={`2px solid ${tier.border}66`} />
                    <div style={{ position: 'absolute', bottom: -2, right: -2, background: 'var(--navy)', color: '#FFF', borderRadius: '50%', width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Camera size={10} />
                    </div>
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 2 }}>
                      <span style={{ fontSize: 10, fontWeight: 900, background: 'var(--navy)', color: '#FFF', padding: '2px 6px', borderRadius: 4 }}>
                        {p.registration_id || `#P-${p.id?.slice(-3)}`}
                      </span>
                      <span style={{ fontSize: 10, fontWeight: 800, background: isReturning ? 'rgba(246,165,26,0.15)' : 'rgba(59,130,246,0.15)', color: isReturning ? 'var(--orange)' : '#3B82F6', padding: '2px 6px', borderRadius: 4 }}>
                        {isReturning ? 'RETURNING' : 'NEW'}
                      </span>
                      {p.is_highlighted && (
                        <span style={{ fontSize: 10, fontWeight: 800, background: 'rgba(236,72,153,0.15)', color: '#EC4899', padding: '2px 6px', borderRadius: 4 }}>
                          FEATURED
                        </span>
                      )}
                    </div>

                    <h4 style={{ fontSize: 16, fontWeight: 900, color: 'var(--navy)', margin: '4px 0 2px', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                      {p.full_name || p.name}
                    </h4>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>
                      {catName} · {tier.type}
                    </div>
                  </div>
                </div>

                {/* Metrics Box */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, background: 'var(--bg)', padding: 10, borderRadius: 8, textAlign: 'center' }}>
                  <div>
                    <div style={{ fontSize: 9, color: 'var(--text-muted)', fontWeight: 700 }}>BASE PRICE</div>
                    <div style={{ fontSize: 13, fontWeight: 900, color: 'var(--navy)' }}>Qc {p.base_price || p.basePrice || 100}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 9, color: 'var(--text-muted)', fontWeight: 700 }}>LAST YEAR</div>
                    <div style={{ fontSize: 13, fontWeight: 900, color: 'var(--orange)' }}>
                      {p.last_year_price || p.lastYearPrice ? `Qc ${p.last_year_price || p.lastYearPrice}` : '—'}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 9, color: 'var(--text-muted)', fontWeight: 700 }}>SCORE / 5</div>
                    <div style={{ fontSize: 13, fontWeight: 900, color: 'var(--green)' }}>⭐ {score}</div>
                  </div>
                </div>

                {/* Insight Strip */}
                {(p.x_factor || p.xfactor || p.speciality) && (
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', background: 'rgba(0,0,0,0.02)', padding: '6px 8px', borderRadius: 6 }}>
                    <strong>Insight: </strong>{p.x_factor || p.xfactor || p.speciality}
                  </div>
                )}

                {/* Card Actions */}
                <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', marginTop: 'auto', paddingTop: 8, borderTop: '1px solid var(--border)' }}>
                  <button className="btn btn-outline btn-sm" onClick={() => openHistory(p)} title="Auction History">
                    <History size={13} /> History
                  </button>
                  <button className="btn btn-primary btn-sm" onClick={() => openEdit(p)}>
                    <Edit size={13} /> Edit
                  </button>
                  {p.is_active === false ? (
                    <button className="btn btn-green btn-sm" onClick={() => handleRestore(p)} title="Restore Player">
                      <RefreshCw size={13} /> Restore
                    </button>
                  ) : (
                    <button className="btn btn-danger btn-sm" onClick={() => handleDelete(p)} title="Archive / Delete">
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Table View */
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="data-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th style={{ width: 70 }}>Reg ID</th>
                <th>Player Profile</th>
                <th>Type</th>
                <th>Category</th>
                <th>Score / 5</th>
                <th>Base Price</th>
                <th>Last Year</th>
                <th>Key Insights / X-Factor</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => {
                const isReturning = (p.player_type || p.playerType || (p.isOldPlayer ? 'RETURNING' : 'NEW')).toUpperCase() === 'RETURNING';
                const catName = getPlayerCategory(p);
                const tier = CATEGORY_TIERS[catName] || CATEGORY_TIERS['Category A'];
                const score = p.score_out_of_5 !== undefined ? Number(p.score_out_of_5).toFixed(1) : '3.5';

                return (
                  <tr key={p.id} style={{ opacity: p.is_active === false ? 0.6 : 1 }}>
                    <td>
                      <span style={{ fontWeight: 800, fontSize: 11, background: 'var(--navy)', color: '#FFF', padding: '2px 6px', borderRadius: 4 }}>
                        {p.registration_id || `#P-${p.id?.slice(-3)}`}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div 
                          style={{ position: 'relative', width: 42, height: 42, cursor: 'pointer', flexShrink: 0 }}
                          onClick={() => triggerQuickUpload(p.id)}
                          title="Click to upload custom photo"
                        >
                          <PlayerAvatar player={p} size={42} borderRadius={8} border={`2px solid ${tier.border}88`} />
                          <div style={{ position: 'absolute', bottom: -2, right: -2, background: 'var(--navy)', color: '#FFF', borderRadius: '50%', width: 14, height: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Camera size={8} />
                          </div>
                        </div>
                        <div>
                          <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--navy)' }}>
                            {p.full_name || p.name}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                            {p.speciality || p.experience || 'Registered Player'}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span style={{
                        fontSize: 11, fontWeight: 800,
                        padding: '3px 8px', borderRadius: 5,
                        background: isReturning ? 'rgba(246,165,26,0.15)' : 'rgba(59,130,246,0.15)',
                        color: isReturning ? 'var(--orange)' : '#3B82F6'
                      }}>
                        {isReturning ? 'RETURNING' : 'NEW'}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: 12, fontWeight: 700, color: tier.color }}>
                        {catName}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontWeight: 800, color: 'var(--green)', fontSize: 13 }}>
                        ⭐ {score}
                      </span>
                    </td>
                    <td style={{ fontWeight: 800, color: 'var(--navy)' }}>
                      Qc {p.base_price || p.basePrice || 100}
                    </td>
                    <td style={{ color: p.last_year_price || p.lastYearPrice ? 'var(--orange)' : 'var(--text-muted)', fontWeight: 700 }}>
                      {p.last_year_price || p.lastYearPrice ? `Qc ${p.last_year_price || p.lastYearPrice}` : '—'}
                    </td>
                    <td style={{ maxWidth: 220, fontSize: 12, color: 'var(--text-secondary)' }}>
                      {p.x_factor || p.xfactor ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'rgba(246,165,26,0.1)', padding: '2px 6px', borderRadius: 4, color: 'var(--orange)', fontWeight: 600 }}>
                          <Flame size={12} /> {p.x_factor || p.xfactor}
                        </span>
                      ) : p.speciality || '—'}
                    </td>
                    <td>
                      {p.is_active === false ? (
                        <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 6px', borderRadius: 4, background: '#F1F5F9', color: 'var(--text-muted)' }}>
                          ARCHIVED
                        </span>
                      ) : (
                        <span className={getStatusBadgeClass(p.status || 'WAITING')}>
                          {p.status || 'ACTIVE'}
                        </span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: 5 }}>
                        <button className="btn btn-outline btn-sm" onClick={() => openHistory(p)} title="Auction History">
                          <History size={13} />
                        </button>
                        <button className="btn btn-outline btn-sm" onClick={() => openEdit(p)} title="Edit Profile">
                          <Edit size={13} /> Edit
                        </button>
                        {p.is_active === false ? (
                          <button className="btn btn-green btn-sm" onClick={() => handleRestore(p)} title="Restore Player">
                            <RefreshCw size={13} />
                          </button>
                        ) : (
                          <button 
                            className="btn btn-danger btn-sm" 
                            onClick={() => handleDelete(p)} 
                            title="Safe Archive / Delete"
                            style={{ background: '#FEE2E2', color: '#DC2626', border: '1px solid #FCA5A5' }}
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
         EXCEL IMPORT PREVIEW & COMMIT MODAL
      ═══════════════════════════════════════════════════════════════════════ */}
      {showImportModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowImportModal(false)}>
          <div className="modal" style={{ maxWidth: 880, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <FileSpreadsheet size={22} color="var(--orange)" />
                <h3 className="modal-title">Import Players from Excel Workbook</h3>
              </div>
              <button className="modal-close" onClick={() => setShowImportModal(false)}>×</button>
            </div>

            <div className="modal-body" style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Dropzone / Default File Action */}
              <div style={{ padding: '16px 20px', background: '#F8F9FD', borderRadius: 8, border: '2px dashed var(--border)', textAlign: 'center' }}>
                <input 
                  ref={excelFileRef} 
                  type="file" 
                  accept=".xlsx, .xls" 
                  style={{ display: 'none' }} 
                  onChange={handleExcelFileSelect} 
                />
                <div style={{ display: 'flex', justifyContent: 'center', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                  <button className="btn btn-outline" onClick={() => excelFileRef.current?.click()} disabled={importing}>
                    <Upload size={16} /> Choose Excel File (.xlsx)
                  </button>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>or</span>
                  <button className="btn btn-primary" onClick={() => handleExcelFileSelect({ useDefault: true })} disabled={importing}>
                    ⚡ Load Workspace "Player_Profile_Updated.xlsx"
                  </button>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>
                  Reads all sheets (Sheet1: Returning, Form Responses 1: New), calculates scores out of 5, and flags duplicates.
                </div>
              </div>

              {/* Import Preview Summary */}
              {importPreview && (
                <div>
                  <h4 style={{ fontSize: 14, fontWeight: 800, color: 'var(--navy)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <CheckCircle2 size={16} color="var(--green)" /> Import Summary & Validation
                  </h4>

                  <div className="grid grid-4 gap-2" style={{ marginBottom: 14 }}>
                    <div style={{ background: '#FFF', border: '1px solid var(--border)', padding: '10px 12px', borderRadius: 6, textAlign: 'center' }}>
                      <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--navy)' }}>{importPreview.summary?.totalRows || 0}</div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700 }}>TOTAL ROWS</div>
                    </div>
                    <div style={{ background: '#FFF', border: '1px solid var(--border)', padding: '10px 12px', borderRadius: 6, textAlign: 'center' }}>
                      <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--orange)' }}>{importPreview.summary?.returningPlayers || 0}</div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700 }}>RETURNING</div>
                    </div>
                    <div style={{ background: '#FFF', border: '1px solid var(--border)', padding: '10px 12px', borderRadius: 6, textAlign: 'center' }}>
                      <div style={{ fontSize: 18, fontWeight: 900, color: '#3B82F6' }}>{importPreview.summary?.newPlayers || 0}</div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700 }}>NEW PLAYERS</div>
                    </div>
                    <div style={{ background: '#FFF', border: '1px solid var(--border)', padding: '10px 12px', borderRadius: 6, textAlign: 'center' }}>
                      <div style={{ fontSize: 18, fontWeight: 900, color: (importPreview.duplicates?.length || 0) > 0 ? '#EF4444' : 'var(--green)' }}>
                        {importPreview.duplicates?.length || 0}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700 }}>DUPLICATES FLAGGED</div>
                    </div>
                  </div>

                  {/* Duplicate Conflict Resolver */}
                  {importPreview.duplicates?.length > 0 && (
                    <div style={{ marginBottom: 14, background: '#FFF7ED', border: '1px solid #FFEDD5', borderRadius: 8, padding: 12 }}>
                      <div style={{ fontWeight: 800, fontSize: 12, color: '#C2410C', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <AlertCircle size={15} /> Probable Duplicates Detected - Choose Action for Each:
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {importPreview.duplicates.map(dup => (
                          <div key={dup.full_name} style={{ background: '#FFF', padding: '8px 12px', borderRadius: 6, border: '1px solid #FED7AA', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                              <strong style={{ fontSize: 13, color: 'var(--navy)' }}>{dup.full_name}</strong>
                              <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 8 }}>
                                Existing: {dup.matchedRegistrationId} ({dup.matchedCategory})
                              </span>
                            </div>

                            <div style={{ display: 'flex', gap: 6 }}>
                              <button 
                                type="button"
                                className={`btn btn-sm ${importResolutions[dup.full_name] === 'use_existing' ? 'btn-navy' : 'btn-outline'}`}
                                onClick={() => setImportResolutions(r => ({ ...r, [dup.full_name]: 'use_existing' }))}
                                style={{ fontSize: 11, padding: '2px 8px' }}
                              >
                                [Use Existing]
                              </button>
                              <button 
                                type="button"
                                className={`btn btn-sm ${importResolutions[dup.full_name] === 'overwrite' ? 'btn-primary' : 'btn-outline'}`}
                                onClick={() => setImportResolutions(r => ({ ...r, [dup.full_name]: 'overwrite' }))}
                                style={{ fontSize: 11, padding: '2px 8px' }}
                              >
                                [Update Existing]
                              </button>
                              <button 
                                type="button"
                                className={`btn btn-sm ${importResolutions[dup.full_name] === 'create_new' ? 'btn-green' : 'btn-outline'}`}
                                onClick={() => setImportResolutions(r => ({ ...r, [dup.full_name]: 'create_new' }))}
                                style={{ fontSize: 11, padding: '2px 8px' }}
                              >
                                [Create New]
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Sample Preview Rows */}
                  <div style={{ border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden', maxHeight: 240, overflowY: 'auto' }}>
                    <table className="data-table" style={{ width: '100%', fontSize: 12 }}>
                      <thead>
                        <tr>
                          <th>Reg ID</th>
                          <th>Full Name</th>
                          <th>Sheet</th>
                          <th>Type</th>
                          <th>Category</th>
                          <th>Base</th>
                          <th>Score / 5</th>
                        </tr>
                      </thead>
                      <tbody>
                        {importPreview.rows?.slice(0, 15).map((r, idx) => (
                          <tr key={idx}>
                            <td>{r.registration_id}</td>
                            <td style={{ fontWeight: 700 }}>{r.full_name}</td>
                            <td style={{ color: 'var(--text-muted)' }}>{r.sheet_source}</td>
                            <td>{r.player_type}</td>
                            <td>{r.category}</td>
                            <td>Qc {r.base_price}</td>
                            <td style={{ color: 'var(--green)', fontWeight: 700 }}>⭐ {r.score_out_of_5}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {importResult && (
                <div style={{ padding: 14, background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: 6, color: '#065F46', fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <CheckCircle2 size={18} />
                  Successfully imported {importResult.insertedCount} new players and updated {importResult.updatedCount} records into the Master Player Database!
                </div>
              )}
            </div>

            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between' }}>
              <button type="button" className="btn btn-outline" onClick={() => setShowImportModal(false)}>
                Close
              </button>

              {importPreview && (
                <button 
                  type="button" 
                  className="btn btn-primary" 
                  onClick={commitExcelImport} 
                  disabled={importing}
                  style={{ fontWeight: 800 }}
                >
                  {importing ? 'Importing...' : `Confirm & Commit (${importPreview.rows?.length || 0} Players)`}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
         PLAYER AUCTION HISTORY MODAL
      ═══════════════════════════════════════════════════════════════════════ */}
      {historyPlayer && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setHistoryPlayer(null)}>
          <div className="modal" style={{ maxWidth: 640 }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <History size={20} color="var(--orange)" />
                <h3 className="modal-title">Auction History: {historyPlayer.full_name || historyPlayer.name}</h3>
              </div>
              <button className="modal-close" onClick={() => setHistoryPlayer(null)}>×</button>
            </div>

            <div className="modal-body">
              {historyLoading ? (
                <div style={{ textAlign: 'center', padding: 40 }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
              ) : !historyPlayer.auctionHistory || historyPlayer.auctionHistory.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 30, color: 'var(--text-muted)' }}>
                  <p>No past auction participation records found for this player yet.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {historyPlayer.auctionHistory.map((h, i) => (
                    <div key={i} style={{ padding: '12px 14px', background: '#F8F9FD', borderRadius: 8, border: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--navy)' }}>{h.auctionName}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{h.seriesName}</div>
                        {h.soldTeam && (
                          <div style={{ fontSize: 12, color: 'var(--green)', fontWeight: 700, marginTop: 4 }}>
                            Sold to {h.soldTeam.name} ({h.soldTeam.tag})
                          </div>
                        )}
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span className={getStatusBadgeClass(h.status)}>{h.status}</span>
                        {h.soldPrice && (
                          <div style={{ fontSize: 14, fontWeight: 900, color: 'var(--navy)', marginTop: 4 }}>
                            Qc {h.soldPrice.toLocaleString()}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn-outline" onClick={() => setHistoryPlayer(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
         ADD / EDIT MASTER PLAYER MODAL
      ═══════════════════════════════════════════════════════════════════════ */}
      {showEditModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowEditModal(false)}>
          <div className="modal" style={{ maxWidth: 720, maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="modal-header">
              <h3 className="modal-title">
                {editingPlayer ? `Edit Master Profile: ${editingPlayer.full_name || editingPlayer.name}` : 'Add New Master Player'}
              </h3>
              <button className="modal-close" onClick={() => setShowEditModal(false)}>×</button>
            </div>

            <form onSubmit={handleSave}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {/* Photo & Basic Details */}
                <div style={{ display: 'flex', gap: 18, alignItems: 'flex-start' }}>
                  {/* Photo area with placeholder / delete */}
                  <div style={{ flexShrink: 0, textAlign: 'center' }}>
                    <div 
                      style={{
                        width: 110, height: 130, borderRadius: 12, overflow: 'hidden',
                        background: 'var(--bg)', border: '2px dashed var(--border)',
                        cursor: 'pointer', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center'
                      }}
                      onClick={() => fileRef.current?.click()}
                      title="Click to select custom profile photo"
                    >
                      {formImagePreview ? (
                        <img src={formImagePreview} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <PlayerAvatar
                          player={{ full_name: form.full_name, name: form.full_name }}
                          size={110}
                          borderRadius={10}
                          style={{ width: '100%', height: '100%' }}
                        />
                      )}
                    </div>
                    <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImageFileChange} />
                    
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginTop: 6 }}>
                      <button type="button" className="btn btn-outline btn-sm" onClick={() => fileRef.current?.click()} style={{ fontSize: 10, padding: '2px 6px' }}>
                        Upload
                      </button>
                      {formImagePreview && (
                        <button type="button" className="btn btn-danger btn-sm" onClick={removePhoto} style={{ fontSize: 10, padding: '2px 6px' }}>
                          Remove
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Main Inputs */}
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div className="grid grid-2 gap-2">
                      <div className="form-group">
                        <label className="form-label">Full Name *</label>
                        <input className="form-input" required value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} placeholder="Player's official full name" />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Registration ID</label>
                        <input className="form-input" value={form.registration_id} onChange={e => setForm(f => ({ ...f, registration_id: e.target.value }))} placeholder="#RET-01 or #NEW-01" />
                      </div>
                    </div>

                    <div className="grid grid-3 gap-2">
                      <div className="form-group">
                        <label className="form-label">Category *</label>
                        <select 
                          className="form-input" 
                          value={form.category} 
                          onChange={e => {
                            const cat = e.target.value;
                            const matched = CATEGORY_OPTIONS.find(c => c.category === cat);
                            setForm(f => ({ ...f, category: cat, base_price: matched ? matched.defaultBase : f.base_price }));
                          }}
                        >
                          {CATEGORY_OPTIONS.map(c => (
                            <option key={c.category} value={c.category}>{c.category} ({c.defaultBase} QC)</option>
                          ))}
                        </select>
                      </div>

                      <div className="form-group">
                        <label className="form-label">Player Type *</label>
                        <select className="form-input" value={form.player_type} onChange={e => setForm(f => ({ ...f, player_type: e.target.value }))}>
                          <option value="NEW">NEW</option>
                          <option value="RETURNING">RETURNING</option>
                        </select>
                      </div>

                      <div className="form-group">
                        <label className="form-label">Score / 5.0</label>
                        <input className="form-input" type="number" step="0.01" min="1" max="5" value={form.score_out_of_5} onChange={e => setForm(f => ({ ...f, score_out_of_5: Number(e.target.value) }))} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Pricing & Experience */}
                <div className="grid grid-3 gap-3">
                  <div className="form-group">
                    <label className="form-label">Base Starting Bid (QC) *</label>
                    <input className="form-input" type="number" required min="1" value={form.base_price} onChange={e => setForm(f => ({ ...f, base_price: Number(e.target.value) }))} />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Last Year's Price (QC)</label>
                    <input className="form-input" type="number" placeholder="Leave empty for New" value={form.last_year_price} onChange={e => setForm(f => ({ ...f, last_year_price: e.target.value }))} />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Experience</label>
                    <input className="form-input" placeholder="e.g. 2 Seasons / Verified" value={form.experience} onChange={e => setForm(f => ({ ...f, experience: e.target.value }))} />
                  </div>
                </div>

                {/* Speciality & X-Factor */}
                <div className="grid grid-2 gap-3">
                  <div className="form-group">
                    <label className="form-label">Player Speciality / Main Sports Skill</label>
                    <input className="form-input" placeholder="e.g. Cricket bowler, BGMI IGL, Chess player" value={form.speciality} onChange={e => setForm(f => ({ ...f, speciality: e.target.value }))} />
                  </div>

                  <div className="form-group">
                    <label className="form-label">X-Factor</label>
                    <input className="form-input" placeholder="e.g. CLUTCH, High Impact All-Rounder" value={form.x_factor} onChange={e => setForm(f => ({ ...f, x_factor: e.target.value }))} />
                  </div>
                </div>

                {/* Featured / Highlight Controls */}
                <div style={{ padding: '10px 14px', background: 'var(--bg)', borderRadius: 8, border: '1px solid var(--border)' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginBottom: form.is_highlighted ? 8 : 0 }}>
                    <input type="checkbox" checked={form.is_highlighted} onChange={e => setForm(f => ({ ...f, is_highlighted: e.target.checked }))} />
                    <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--navy)' }}>⭐ Mark as Featured / Highlighted Player</span>
                  </label>

                  {form.is_highlighted && (
                    <input 
                      className="form-input" 
                      style={{ marginTop: 4, height: 34, fontSize: 12 }} 
                      placeholder="Highlight Reason (e.g. Top Category B all-rounder, clutch match winner)" 
                      value={form.highlight_reason} 
                      onChange={e => setForm(f => ({ ...f, highlight_reason: e.target.value }))} 
                    />
                  )}
                </div>

                {/* Bio */}
                <div className="form-group">
                  <label className="form-label">Player Bio / Notes</label>
                  <textarea className="form-input" style={{ minHeight: 60 }} value={form.bio} onChange={e => setForm(f => ({ ...f, bio: e.target.value }))} placeholder="Playstyle notes, scouting achievements, team leadership..." />
                </div>
              </div>

              <div className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between' }}>
                {editingPlayer ? (
                  <button type="button" className="btn btn-danger" onClick={() => { setShowEditModal(false); handleDelete(editingPlayer); }}>
                    <Trash2 size={15} /> Delete / Archive
                  </button>
                ) : <div />}

                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button" className="btn btn-outline" onClick={() => setShowEditModal(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary" disabled={saving} style={{ fontWeight: 800 }}>
                    {saving ? 'Saving...' : editingPlayer ? 'Update Master Player' : 'Create Master Player'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
