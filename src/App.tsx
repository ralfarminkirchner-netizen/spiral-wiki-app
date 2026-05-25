import { Routes, Route, Link, useParams, useNavigate } from 'react-router-dom';
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// ─── Utilities ───

function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T | ((val: T) => T)) => void] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.warn(error);
      return initialValue;
    }
  });

  const setValue = (value: T | ((val: T) => T)) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      window.localStorage.setItem(key, JSON.stringify(valueToStore));
    } catch (error) {
      console.warn(error);
    }
  };
  return [storedValue, setValue];
}

// ─── Types ───

/** Lightweight metadata for the gallery views — NO content field! */
interface MonographMeta {
  id: string;
  title: string;
  category: string;
  topCategory: string;
  year: number;
  finalImageUrl: string | null;
  hasRealImage: boolean;
  wordCount?: number;
  cleanTitle: string;
}

/** Full monograph with content — loaded on demand */
interface MonographFull extends MonographMeta {
  content: string;
}

type ViewMode = 'spiral' | 'circle' | 'portrait';

// ─── Constants ───

const CATEGORY_COLORS: Record<string, string> = {
  'Bewusstseinsforschung': '#a855f7',
  'Kunst_und_Literatur': '#ec4899',
  'Kybernetik': '#06b6d4',
  'Neurologie': '#10b981',
  'Philosophie': '#3b82f6',
  'Physik_und_Mathematik': '#f59e0b',
  'Psychologie': '#f97316',
  'Religion_und_Spiritualitaet': '#eab308',
  'Soziologie': '#ef4444',
  'Synthesen': '#8b5cf6',
  'Tradition': '#78716c',
  'Traumaforschung': '#dc2626',
  'Wirtschaft': '#22c55e',
  'Wissenschaft': '#14b8a6',
};

const getCatColor = (catName: string): string => {
  for (const [key, color] of Object.entries(CATEGORY_COLORS)) {
    if (catName.includes(key)) return color;
  }
  return '#64748b';
};

const CATEGORY_FALLBACK_IMAGES: Record<string, string> = {
  'Bewusstseinsforschung': 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/87/Flammarion_Woodcut_1888.jpg/800px-Flammarion_Woodcut_1888.jpg',
  'Kunst_und_Literatur': 'https://upload.wikimedia.org/wikipedia/commons/e/ec/Mona_Lisa%2C_by_Leonardo_da_Vinci%2C_from_C2RMF_retouched.jpg',
  'Kybernetik': 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/cf/Cybernetics.jpg/800px-Cybernetics.jpg',
  'Neurologie': 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1a/Cajal_cortex_drawings.png/800px-Cajal_cortex_drawings.png',
  'Philosophie': 'https://upload.wikimedia.org/wikipedia/commons/8/8c/David_-_The_Death_of_Socrates.jpg',
  'Physik_und_Mathematik': 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/98/Andromeda_Galaxy_%28with_h-alpha%29.jpg/800px-Andromeda_Galaxy_%28with_h-alpha%29.jpg',
  'Psychologie': 'https://upload.wikimedia.org/wikipedia/commons/6/6e/Rorschach_blot_01.jpg',
  'Religion_und_Spiritualitaet': 'https://upload.wikimedia.org/wikipedia/commons/7/74/The_Creation_of_Adam.jpg',
  'Soziologie': 'https://upload.wikimedia.org/wikipedia/commons/6/6c/Crowd_outside_the_Stock_Exchange%2C_New_York%2C_1900.jpg',
  'Synthesen': 'https://upload.wikimedia.org/wikipedia/commons/a/a2/Alchemical_scroll_by_George_Ripley_%28Wellcome%29.jpg',
  'Tradition': 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/30/Bayeux_Tapestry_scene57.jpg/800px-Bayeux_Tapestry_scene57.jpg',
  'Traumaforschung': 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d4/The_Scream.jpg/800px-The_Scream.jpg',
  'Wirtschaft': 'https://upload.wikimedia.org/wikipedia/commons/e/e0/New_York_Stock_Exchange_1908.jpg',
  'Wissenschaft': 'https://upload.wikimedia.org/wikipedia/commons/3/39/GodfreyKneller-IsaacNewton-1689.jpg',
};

const getFallbackImage = (topCategory: string): string => {
  for (const [key, url] of Object.entries(CATEGORY_FALLBACK_IMAGES)) {
    if (topCategory.includes(key)) return url;
  }
  return 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/13/Hubble_Ultra_Deep_Field_part_d.jpg/800px-Hubble_Ultra_Deep_Field_part_d.jpg';
};

// 13 balanced spiral arms
const SUPER_ARMS: { name: string; cats: string[]; color: string; splitIndex?: number; splitCount?: number }[] = [
  { name: 'Philosophie I', cats: ['Philosophie'], color: '#818cf8', splitIndex: 0, splitCount: 3 },
  { name: 'Philosophie II', cats: ['Philosophie'], color: '#6366f1', splitIndex: 1, splitCount: 3 },
  { name: 'Philosophie III', cats: ['Philosophie'], color: '#4f46e5', splitIndex: 2, splitCount: 3 },
  { name: 'Wissenschaft I', cats: ['Wissenschaft'], color: '#14b8a6', splitIndex: 0, splitCount: 3 },
  { name: 'Wissenschaft II', cats: ['Wissenschaft'], color: '#0d9488', splitIndex: 1, splitCount: 3 },
  { name: 'Wissenschaft III', cats: ['Wissenschaft'], color: '#0f766e', splitIndex: 2, splitCount: 3 },
  { name: 'Psychologie I', cats: ['Psychologie'], color: '#f97316', splitIndex: 0, splitCount: 2 },
  { name: 'Psychologie II', cats: ['Psychologie'], color: '#ea580c', splitIndex: 1, splitCount: 2 },
  { name: 'Soziologie', cats: ['Soziologie'], color: '#ef4444' },
  { name: 'Tradition', cats: ['Tradition'], color: '#78716c' },
  { name: 'Geist & Seele', cats: ['Religion_und_Spiritualitaet', 'Religion und Spiritualitaet', 'Bewusstseinsforschung'], color: '#eab308' },
  { name: 'Kunst & Natur', cats: ['Kunst_und_Literatur', 'Kunst und Literatur', 'Physik_und_Mathematik', 'Physik und Mathematik', 'Synthesen', 'Traumaforschung'], color: '#ec4899' },
  { name: 'Neuro & System', cats: ['Neurologie', 'Kybernetik', 'Wirtschaft'], color: '#10b981' },
];

const getArmIndex = (cat: string): number => {
  const topCat = cat.split('/')[0].trim();
  for (let i = 0; i < SUPER_ARMS.length; i++) {
    if (SUPER_ARMS[i].cats.some(c => topCat.includes(c) || c.includes(topCat))) return i;
  }
  return 0;
};

// ─── Image Error Handler (inline fallback) ───
const handleImgError = (e: React.SyntheticEvent<HTMLImageElement>, topCategory: string) => {
  const img = e.currentTarget;
  const fallback = getFallbackImage(topCategory);
  if (img.src !== fallback) {
    img.src = fallback;
  }
};

// ════════════════════════════════════════════════
//  DASHBOARD (Gallery Views)
// ════════════════════════════════════════════════

interface DashboardProps {
  data: MonographMeta[];
  readMonographs: string[];
  favorites: string[];
  toggleFavorite: (id: string) => void;
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
}

function Dashboard({ data, readMonographs, favorites, toggleFavorite, viewMode, setViewMode }: DashboardProps) {
  const [search, setSearch] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);
  const [activeCategory, setActiveCategory] = useState<string>('Alle');
  const [visibleCount, setVisibleCount] = useState(60);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const [alphaFilter, setAlphaFilter] = useState<string>('');
  const [zoomLevel, setZoomLevel] = useState<number>(1);

  // Reset infinite scroll on filter changes
  useEffect(() => { setVisibleCount(60); }, [search, activeCategory, viewMode]);

  // Keyboard: "/" to focus search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT') {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const navigate = useNavigate();
  const goToRandom = useCallback(() => {
    if (data.length === 0) return;
    const item = data[Math.floor(Math.random() * data.length)];
    navigate(`/monograph/${item.id}`);
  }, [data, navigate]);

  // ── Data Processing (no content = instant) ──
  const sortedCategories = useMemo(() => {
    const cats = new Set<string>();
    data.forEach(d => cats.add(d.topCategory));
    return Array.from(cats).sort();
  }, [data]);

  // Create Sets for O(1) lookups instead of .includes() on arrays
  const readSet = useMemo(() => new Set(readMonographs), [readMonographs]);
  const favSet = useMemo(() => new Set(favorites), [favorites]);

  const filteredData = useMemo(() => {
    return data.filter(d => {
      if (search) {
        const q = search.toLowerCase();
        if (!d.title.toLowerCase().includes(q) && !d.category.toLowerCase().includes(q)) return false;
      }
      if (activeCategory !== 'Alle' && d.topCategory !== activeCategory) return false;
      if (showFavoritesOnly && !favSet.has(d.id)) return false;
      if (showUnreadOnly && readSet.has(d.id)) return false;
      if (alphaFilter && !d.cleanTitle.toUpperCase().startsWith(alphaFilter)) return false;
      return true;
    });
  }, [data, search, activeCategory, showFavoritesOnly, showUnreadOnly, favSet, readSet, alphaFilter]);

  // ── Category counts (computed from filteredData, not groupedByCategory) ──
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredData.forEach(d => { counts[d.topCategory] = (counts[d.topCategory] || 0) + 1; });
    return counts;
  }, [filteredData]);

  // ── Memoized alpha-letter availability (was 26x O(n) per render!) ──
  const availableLetters = useMemo(() => {
    const letters = new Set<string>();
    filteredData.forEach(d => {
      const first = d.cleanTitle.charAt(0).toUpperCase();
      if (first) letters.add(first);
    });
    return letters;
  }, [filteredData]);

  // ── Infinite Scroll Observer ──
  const loaderRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (viewMode !== 'portrait') return;
    const observer = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) {
        setVisibleCount(prev => Math.min(prev + 60, filteredData.length));
      }
    }, { threshold: 0.1 });
    if (loaderRef.current) observer.observe(loaderRef.current);
    return () => observer.disconnect();
  }, [viewMode, filteredData.length]);

  // ── Portrait: Group only sliced data ──
  const ZOOM_SIZES = [60, 90, 150];
  const ZOOM_LABELS = ['S', 'M', 'L'];
  const tileSize = ZOOM_SIZES[zoomLevel];

  const groupedByCategory = useMemo(() => {
    if (viewMode !== 'portrait') return {};
    const sliced = filteredData.slice(0, visibleCount);
    const groups: Record<string, typeof filteredData> = {};
    sliced.forEach(d => {
      if (!groups[d.topCategory]) groups[d.topCategory] = [];
      groups[d.topCategory].push(d);
    });
    for (const key of Object.keys(groups)) {
      groups[key].sort((a, b) => a.cleanTitle.localeCompare(b.cleanTitle));
    }
    return groups;
  }, [filteredData, visibleCount, viewMode]);

  // ── Spiral positions ──
  const spiralPositions = useMemo(() => {
    if (viewMode !== 'spiral') return [];
    const items = filteredData;
    const armCount = SUPER_ARMS.length;
    const catGroups: Map<string, typeof items> = new Map();

    items.forEach(item => {
      const topCat = item.topCategory.split('/')[0].trim();
      let matched = false;
      for (const arm of SUPER_ARMS) {
        if (arm.cats.some(c => topCat.includes(c) || c.includes(topCat))) {
          const key = arm.cats[0];
          if (!catGroups.has(key)) catGroups.set(key, []);
          catGroups.get(key)!.push(item);
          matched = true;
          break;
        }
      }
      if (!matched) {
        if (!catGroups.has('Philosophie')) catGroups.set('Philosophie', []);
        catGroups.get('Philosophie')!.push(item);
      }
    });

    const armBuckets: (typeof items)[] = Array.from({ length: armCount }, () => []);
    for (let a = 0; a < armCount; a++) {
      const arm = SUPER_ARMS[a];
      const primaryCat = arm.cats[0];
      const allItems = catGroups.get(primaryCat) || [];
      if (arm.splitCount && arm.splitCount > 1) {
        const chunkSize = Math.ceil(allItems.length / arm.splitCount);
        const start = (arm.splitIndex || 0) * chunkSize;
        armBuckets[a] = allItems.slice(start, Math.min(start + chunkSize, allItems.length));
      } else {
        arm.cats.forEach(catName => {
          const catItems = catGroups.get(catName);
          if (catItems) {
            armBuckets[a].push(...catItems);
            catGroups.delete(catName);
          }
        });
      }
    }

    const nodeDiam = 58;
    const minDist = nodeDiam;
    const positions: { item: typeof items[0]; x: number; y: number; armIdx: number }[] = [];
    const startR = nodeDiam * 2.5;
    const spiralTightness = 0.18;
    const radialGrowth = nodeDiam * 0.52;

    for (let a = 0; a < armCount; a++) {
      const baseAngle = (a / armCount) * 2 * Math.PI;
      let prevX = 0, prevY = 0;
      armBuckets[a].forEach((item, i) => {
        const theta = i * spiralTightness;
        const r = startR + i * radialGrowth;
        const angle = baseAngle + theta;
        let x = r * Math.cos(angle);
        let y = r * Math.sin(angle);
        if (i > 0) {
          const dx = x - prevX, dy = y - prevY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < minDist && dist > 0) {
            const s = minDist / dist;
            x = prevX + dx * s;
            y = prevY + dy * s;
          }
        }
        prevX = x; prevY = y;
        positions.push({ item, x, y, armIdx: a });
      });
    }
    return positions;
  }, [filteredData, viewMode]);

  // ── Circle positions ──
  const circlePositions = useMemo(() => {
    if (viewMode !== 'circle') return [];
    const items = [...filteredData].sort((a, b) => {
      const ai = SUPER_ARMS.findIndex(arm => arm.cats.some(c => a.topCategory.includes(c) || c.includes(a.topCategory)));
      const bi = SUPER_ARMS.findIndex(arm => arm.cats.some(c => b.topCategory.includes(c) || c.includes(b.topCategory)));
      if (ai !== bi) return ai - bi;
      return a.topCategory.localeCompare(b.topCategory);
    });
    const n = items.length;
    if (n === 0) return [];
    const nodeDiam = 58;
    const positions: { item: typeof items[0]; x: number; y: number; armIdx: number }[] = [];
    let placed = 0;
    if (placed < n) {
      positions.push({ item: items[placed], x: 0, y: 0, armIdx: getArmIndex(items[placed].topCategory) });
      placed++;
    }
    let ring = 1;
    while (placed < n) {
      const r = ring * nodeDiam;
      const circumference = 2 * Math.PI * r;
      const maxInRing = Math.max(1, Math.floor(circumference / nodeDiam));
      const count = Math.min(maxInRing, n - placed);
      for (let j = 0; j < count; j++) {
        const angle = (j / count) * 2 * Math.PI - Math.PI / 2;
        positions.push({
          item: items[placed],
          x: r * Math.cos(angle),
          y: r * Math.sin(angle),
          armIdx: getArmIndex(items[placed].topCategory),
        });
        placed++;
      }
      ring++;
    }
    return positions;
  }, [filteredData, viewMode]);

  return (
    <div className="mosaic-page animate-fade-in">
      {/* --- HEADER --- */}
      <header className="mosaic-header">
        <div className="mosaic-header-left">
          <h1 className="hud-title">SPiRAL MiND WiKi</h1>
          <div className="search-bar-hud">
            <input ref={searchRef} type="text" placeholder="Suche... (/)" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="stats-panel">
            <div className="stat-chip"><span className="stat-value">{data.length}</span> Einträge</div>
            <div className="stat-chip"><span className="stat-value">{readMonographs.length}</span> gelesen</div>
            <div className="stat-chip"><span className="stat-value">{favorites.length}</span> ★</div>
          </div>
        </div>
        <div className="mosaic-header-right">
          {viewMode === 'portrait' && (
            <div className="zoom-controls">
              {ZOOM_LABELS.map((label, i) => (
                <button key={label} className={`zoom-btn ${zoomLevel === i ? 'active' : ''}`}
                  onClick={() => setZoomLevel(i)}>{label}</button>
              ))}
            </div>
          )}
          <div className="view-mode-group">
            {(['spiral', 'circle', 'portrait'] as ViewMode[]).map(m => (
              <button key={m}
                className={`view-toggle-btn ${viewMode === m ? 'active' : ''}`}
                onClick={() => setViewMode(m)}
              >{m === 'spiral' ? '🌀 Spiral' : m === 'circle' ? '⊕ Kreis' : '▦ Porträt'}</button>
            ))}
          </div>
          <button className="random-btn" onClick={goToRandom}>🎲</button>
        </div>
      </header>

      {/* --- CATEGORY LEGEND --- */}
      <div className="cat-legend">
        <button
          className={`cat-legend-item ${activeCategory === 'Alle' ? 'active' : ''}`}
          onClick={() => setActiveCategory('Alle')}
        >
          <span className="cat-dot" style={{ background: 'linear-gradient(135deg, #3b82f6, #a855f7, #ec4899)' }} />
          Alle ({filteredData.length})
        </button>
        {sortedCategories.map(cat => {
          const color = getCatColor(cat);
          const count = categoryCounts[cat] || 0;
          return (
            <button
              key={cat}
              className={`cat-legend-item ${activeCategory === cat ? 'active' : ''}`}
              onClick={() => setActiveCategory(activeCategory === cat ? 'Alle' : cat)}
              style={{ '--cat-color': color } as any}
            >
              <span className="cat-dot" style={{ background: color }} />
              {cat.replace(/_/g, ' ')} ({count})
            </button>
          );
        })}
      </div>

      {/* --- FILTER BAR --- */}
      <div className="filter-bar" style={{ maxWidth: '1600px', margin: '0 auto', padding: '0 1.5rem' }}>
        <button
          className={`filter-toggle ${showFavoritesOnly ? 'active' : ''}`}
          onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
        >★ Favoriten</button>
        <button
          className={`filter-toggle ${showUnreadOnly ? 'active' : ''}`}
          onClick={() => setShowUnreadOnly(!showUnreadOnly)}
        >◯ Ungelesen</button>
        <div className="alpha-index" style={{ flex: 1, marginBottom: 0, padding: '0.3rem 0.4rem' }}>
          {'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(letter => {
            const hasItems = availableLetters.has(letter);
            return (
              <button
                key={letter}
                className={`alpha-letter ${hasItems ? 'has-items' : ''} ${alphaFilter === letter ? 'active' : ''}`}
                onClick={() => setAlphaFilter(alphaFilter === letter ? '' : letter)}
                disabled={!hasItems && alphaFilter !== letter}
              >{letter}</button>
            );
          })}
          {alphaFilter && (
            <button className="alpha-letter active" onClick={() => setAlphaFilter('')} style={{ width: 'auto', padding: '0 8px', fontSize: '0.7rem' }}>✕</button>
          )}
        </div>
        <span className="filter-count">{filteredData.length} Ergebnisse</span>
      </div>

      {/* === PORTRAIT VIEW === */}
      {viewMode === 'portrait' && (
        <div className="mosaic-scroll">
          <div className="mosaic-container">
            {sortedCategories.map(cat => {
              const items = groupedByCategory[cat];
              if (!items || items.length === 0) return null;
              const color = getCatColor(cat);
              return (
                <div key={cat} className="mosaic-category-group">
                  <div className="mosaic-cat-label" style={{ color }}>
                    <span className="cat-dot" style={{ background: color, width: '8px', height: '8px' }} />
                    {cat.replace(/_/g, ' ')} ({categoryCounts[cat] || 0})
                  </div>
                  <div className="mosaic-grid" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${tileSize}px, 1fr))` }}>
                    {items.map(item => {
                      const isRead = readSet.has(item.id);
                      const isFav = favSet.has(item.id);
                      return (
                        <Link to={`/monograph/${item.id}`} key={item.id}
                          className={`mosaic-tile ${isRead ? 'is-read' : ''}`}
                          style={{ '--tile-color': color } as any}>
                          <img
                            className="mosaic-portrait"
                            src={item.finalImageUrl || getFallbackImage(item.topCategory)}
                            alt={item.cleanTitle}
                            loading="lazy"
                            decoding="async"
                            onError={(e) => handleImgError(e, item.topCategory)}
                          />
                          <div className="mosaic-tile-overlay">
                            <div className="mosaic-tile-name">{item.cleanTitle}</div>
                            {item.year !== 9999 && <div className="mosaic-tile-year">{item.year}</div>}
                          </div>
                          {isFav && <span className="mosaic-fav-star">★</span>}
                          {isRead && <span className="mosaic-read-check">✓</span>}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            {visibleCount < filteredData.length && (
              <div ref={loaderRef} style={{ height: '50px', margin: '2rem 0', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                <div className="spinner" style={{ width: '30px', height: '30px', borderTopColor: 'var(--accent-cyan)' }}></div>
              </div>
            )}
            {filteredData.length === 0 && <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '4rem 2rem' }}>Keine Einträge.</div>}
          </div>
        </div>
      )}

      {/* === SPIRAL / CIRCLE VIEW (Canvas) === */}
      {(viewMode === 'spiral' || viewMode === 'circle') && (
        <CanvasSpiral
          positions={viewMode === 'spiral' ? spiralPositions : circlePositions}
          viewMode={viewMode}
          superArms={SUPER_ARMS}
          getArmIndex={getArmIndex}
        />
      )}
    </div>
  );
}

// ════════════════════════════════════════════════
//  CANVAS-BASED SPIRAL/CIRCLE (60fps)
// ════════════════════════════════════════════════

interface CanvasSpiralProps {
  positions: { item: any; x: number; y: number; armIdx: number }[];
  viewMode: ViewMode;
  superArms: { name: string; cats: string[]; color: string }[];
  getArmIndex: (cat: string) => number;
}

function CanvasSpiral({ positions, viewMode, superArms, getArmIndex }: CanvasSpiralProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasElRef = useRef<HTMLCanvasElement>(null);
  const imgCache = useRef<Map<string, HTMLImageElement>>(new Map());
  const rafRef = useRef<number>(0);
  const dragState = useRef({ dragging: false, lastX: 0, lastY: 0, startX: 0, startY: 0 });
  const [hoveredItem, setHoveredItem] = useState<{ item: any; sx: number; sy: number } | null>(null);
  const navigate = useNavigate();
  const localTransform = useRef({ x: 0, y: 0, scale: 0.22 });
  const needsDraw = useRef(true);
  const hoverRef = useRef<any>(null);

  // Pre-load images in batches (don't flood the browser).
  // FIX: Cleanup beim Wechsel — vorher lief die alte Kette weiter, und der
  // Spiral→Kreis-Switch hat zwei parallele Lade-Ketten produziert (1400+
  // gleichzeitige Wikimedia-Requests → Browser-Pool tot → Kreis-Ansicht fror ein).
  useEffect(() => {
    const cache = imgCache.current;
    let cancelled = false;
    let loadIdx = 0;
    let timer: any = null;
    const BATCH_SIZE = 20;

    const loadBatch = () => {
      if (cancelled) return;
      const end = Math.min(loadIdx + BATCH_SIZE, positions.length);
      for (let i = loadIdx; i < end; i++) {
        const { item } = positions[i];
        if (item.finalImageUrl && !cache.has(item.finalImageUrl)) {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => { if (!cancelled) needsDraw.current = true; };
          img.onerror = () => { if (!cancelled) needsDraw.current = true; };
          img.src = item.finalImageUrl;
          cache.set(item.finalImageUrl, img);
        }
      }
      loadIdx = end;
      if (loadIdx < positions.length && !cancelled) {
        timer = setTimeout(loadBatch, 100); // stagger loading
      }
    };
    loadBatch();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [positions]);

  // FIX: Auto-Fit Initial-Scale je nach positions-Layout.
  // Spiral spreizt sich auf Radius ~1600, Kreis bleibt kompakt bei ~800 — ein
  // fix verdrahtetes 0.22 ließ den Kreis als winzigen Klumpen am Zentrum
  // erscheinen ("Kreis-Ansicht geht überhaupt nicht"). Jetzt skaliert es
  // auf ~84% Containerdurchmesser bei jedem positions-Wechsel.
  useEffect(() => {
    const container = containerRef.current;
    if (!container || positions.length === 0) return;
    let maxR = 0;
    for (const p of positions) {
      const d = Math.hypot(p.x, p.y);
      if (d > maxR) maxR = d;
    }
    if (maxR <= 0) return;
    const w = container.clientWidth || 1000;
    const h = container.clientHeight || 800;
    const fitScale = Math.max(0.08, Math.min(0.6, (Math.min(w, h) * 0.42) / maxR));
    localTransform.current = { x: 0, y: 0, scale: fitScale };
    needsDraw.current = true;
  }, [positions]);

  // Draw
  const draw = useCallback(() => {
    const canvas = canvasElRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const dpr = window.devicePixelRatio || 1;
    const w = container.clientWidth;
    const h = container.clientHeight;
    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
    }

    const ctx = canvas.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const { x: tx, y: ty, scale } = localTransform.current;
    const cx = w / 2;
    const cy = h / 2;

    ctx.save();
    ctx.translate(cx + tx, cy + ty);
    ctx.scale(scale, scale);

    // Arm guide curves (spiral only)
    if (viewMode === 'spiral') {
      const guideStartR = 58 * 2.5;
      const guideTightness = 0.18;
      const guideGrowth = 58 * 0.52;
      const guideSteps = 55;
      superArms.forEach((arm, i) => {
        const baseAngle = (i / superArms.length) * 2 * Math.PI;
        ctx.beginPath();
        for (let s = 0; s <= guideSteps; s++) {
          const theta = s * guideTightness;
          const rr = guideStartR + s * guideGrowth;
          const angle = baseAngle + theta;
          const px = rr * Math.cos(angle);
          const py = rr * Math.sin(angle);
          if (s === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.strokeStyle = arm.color + '18';
        ctx.lineWidth = 1;
        ctx.stroke();
      });
    }

    // Draw nodes with frustum culling + LOD
    const r = 22;
    const cache = imgCache.current;

    for (let i = 0; i < positions.length; i++) {
      const { item, x, y } = positions[i];
      const screenX = cx + tx + x * scale;
      const screenY = cy + ty + y * scale;
      const screenR = r * scale;

      // Frustum culling
      if (screenX + screenR < -50 || screenX - screenR > w + 50 || screenY + screenR < -50 || screenY - screenR > h + 50) {
        continue;
      }

      const color = superArms[getArmIndex(item.topCategory)]?.color || '#64748b';

      // LOD: ultra-small dots when zoomed out
      if (scale < 0.1) {
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        continue;
      }

      // Border circle
      ctx.beginPath();
      ctx.arc(x, y, r + 1.5, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();

      // Image circle
      const img = cache.get(item.finalImageUrl);
      const imgLoaded = !!(img && img.complete && img.naturalWidth > 0);
      const imgFailed = !!(img && img.complete && img.naturalWidth === 0);

      ctx.save();
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.clip();

      if (scale >= 0.15 && imgLoaded) {
        ctx.drawImage(img!, x - r, y - r, r * 2, r * 2);
      } else if (imgFailed) {
        // FIX: Bild-Fehler bekommt jetzt Kategorie-Farbe statt dauerhaft schwarzer Lücke
        ctx.fillStyle = color;
        ctx.fill();
      } else {
        // Noch nicht geladen → dunkles Placeholder
        ctx.fillStyle = '#1a1a2e';
        ctx.fill();
      }
      ctx.restore();

      // FIX: Initial-Letter als Ersatz-Identität, wenn das Bild fehlgeschlagen ist
      if (scale >= 0.25 && imgFailed) {
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.font = `bold ${Math.round(r * 0.85)}px Outfit, Inter, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const letter = (item.cleanTitle || '?').charAt(0).toUpperCase();
        ctx.fillText(letter, x, y);
        ctx.textBaseline = 'alphabetic';
      }

      // Label (only when zoomed in enough)
      if (scale > 0.6) {
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.font = '4px Inter, sans-serif';
        ctx.textAlign = 'center';
        const label = item.cleanTitle.length > 12 ? item.cleanTitle.slice(0, 11) + '…' : item.cleanTitle;
        ctx.fillText(label, x, y + r + 6);
      }
    }

    // Center glow
    ctx.fillStyle = 'rgba(0,200,255,0.06)';
    ctx.beginPath();
    ctx.arc(0, 0, 60, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.font = 'bold 10px Outfit, Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('SPiRAL', 0, -4);
    ctx.fillText('MiND', 0, 8);

    ctx.restore();
  }, [positions, viewMode, superArms, getArmIndex]);

  // Animation frame loop — only draws when needed
  useEffect(() => {
    let running = true;
    needsDraw.current = true;
    const loop = () => {
      if (!running) return;
      if (needsDraw.current) {
        draw();
        needsDraw.current = false;
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => { running = false; cancelAnimationFrame(rafRef.current); };
  }, [draw]);

  // Pan
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    dragState.current = { dragging: true, lastX: e.clientX, lastY: e.clientY, startX: e.clientX, startY: e.clientY };
  }, []);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    const ds = dragState.current;
    if (ds.dragging) {
      const dx = e.clientX - ds.lastX;
      const dy = e.clientY - ds.lastY;
      ds.lastX = e.clientX;
      ds.lastY = e.clientY;
      localTransform.current = { ...localTransform.current, x: localTransform.current.x + dx, y: localTransform.current.y + dy };
      needsDraw.current = true;
    } else {
      // Hover hit test
      const canvas = canvasElRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const { x: tx, y: ty, scale } = localTransform.current;
      const cxp = rect.width / 2;
      const cyp = rect.height / 2;
      const wx = (mx - cxp - tx) / scale;
      const wy = (my - cyp - ty) / scale;

      let found: any = null;
      for (const pos of positions) {
        const dx = pos.x - wx;
        const dy = pos.y - wy;
        if (dx * dx + dy * dy < 24 * 24) {
          found = { item: pos.item, sx: e.clientX, sy: e.clientY };
          break;
        }
      }
      if (found?.item?.id !== hoverRef.current?.item?.id) {
        hoverRef.current = found;
        setHoveredItem(found);
      }
    }
  }, [positions]);

  const onMouseUp = useCallback(() => {
    dragState.current.dragging = false;
  }, []);

  const onClick = useCallback((e: React.MouseEvent) => {
    const ds = dragState.current;
    if (Math.abs(e.clientX - ds.startX) > 5 || Math.abs(e.clientY - ds.startY) > 5) return;
    const canvas = canvasElRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const { x: tx, y: ty, scale } = localTransform.current;
    const cxp = rect.width / 2;
    const cyp = rect.height / 2;
    const wx = (mx - cxp - tx) / scale;
    const wy = (my - cyp - ty) / scale;
    for (const pos of positions) {
      const dx = pos.x - wx;
      const dy = pos.y - wy;
      if (dx * dx + dy * dy < 24 * 24) {
        navigate(`/monograph/${pos.item.id}`);
        return;
      }
    }
  }, [positions, navigate]);

  // Wheel zoom
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const factor = e.deltaY > 0 ? 0.92 : 1.08;
      localTransform.current = { ...localTransform.current, scale: Math.max(0.05, Math.min(5, localTransform.current.scale * factor)) };
      needsDraw.current = true;
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  return (
    <div
      ref={containerRef}
      className="spiral-viewport"
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
      onClick={onClick}
      style={{ cursor: 'grab' }}
    >
      <canvas ref={canvasElRef} style={{ display: 'block', width: '100%', height: '100%' }} />
      {hoveredItem && (
        <div className="canvas-tooltip" style={{
          position: 'fixed', left: hoveredItem.sx + 12, top: hoveredItem.sy - 30,
          background: 'rgba(0,0,0,0.9)', color: '#fff', padding: '4px 10px',
          borderRadius: '6px', fontSize: '0.75rem', fontFamily: 'var(--font-sans)',
          pointerEvents: 'none', zIndex: 9999, whiteSpace: 'nowrap',
          border: `1px solid ${superArms[getArmIndex(hoveredItem.item.topCategory)]?.color || '#64748b'}`,
        }}>
          {hoveredItem.item.cleanTitle}
        </div>
      )}
      <div className="spiral-stats">
        {positions.length} Einträge
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════
//  WIKIPEDIA MODAL (REST API Reader)
// ════════════════════════════════════════════════

interface WikipediaModalProps {
  url: string;
  onClose: () => void;
}

function WikipediaModal({ url, onClose }: WikipediaModalProps) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const match = url.match(/\/wiki\/(.+)/);
    if (!match) {
      setLoading(false);
      return;
    }
    const title = match[1].split('#')[0];
    fetch(`https://de.wikipedia.org/api/rest_v1/page/summary/${title}`)
      .then(res => res.json())
      .then(json => {
        setData(json);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [url]);

  // Press ESC to close modal
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div className="wiki-modal-backdrop open" onClick={onClose}>
      <div className="wiki-modal-window" onClick={e => e.stopPropagation()}>
        <div className="wiki-modal-header">
          <h3>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>
            Wikipedia
          </h3>
          <button className="wiki-modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="wiki-modal-content">
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem 0' }}>
              <div className="spinner" style={{ width: '40px', height: '40px' }}></div>
            </div>
          ) : data && data.type !== 'https://mediawiki.org/wiki/HyperSwitch/errors/not_found' ? (
            <>
              <h2 style={{ fontSize: '1.8rem', color: '#fff', marginBottom: '1rem', fontFamily: 'var(--font-display)' }}>{data.title}</h2>
              {data.thumbnail && <img src={data.thumbnail.source} className="wiki-modal-thumbnail" alt={data.title} />}
              <div dangerouslySetInnerHTML={{ __html: data.extract_html || data.extract }} />
            </>
          ) : (
            <p style={{ color: 'var(--accent-gold)' }}>Der Artikel konnte nicht direkt über die Wikipedia-API geladen werden.</p>
          )}
        </div>
        <div className="wiki-modal-footer">
          <a href={url} target="_blank" rel="noopener noreferrer" className="wiki-modal-btn">Den ganzen Artikel auf Wikipedia lesen ↗</a>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════
//  MONOGRAPH READER (Content loaded on demand!)
// ════════════════════════════════════════════════

interface ReaderProps {
  data: MonographMeta[];
  markAsRead: (id: string) => void;
  favorites: string[];
  toggleFavorite: (id: string) => void;
}

function MonographReader({ data, markAsRead, favorites, toggleFavorite }: ReaderProps) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  // O(1) lookup via Map instead of O(n) Array.find()
  const dataMap = useMemo(() => new Map(data.map(d => [d.id, d])), [data]);
  const meta = id ? dataMap.get(id) : undefined;
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [readProgress, setReadProgress] = useState(0);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [showToc, setShowToc] = useState(false);
  const [wikiUrl, setWikiUrl] = useState<string | null>(null);
  const headingIndexRef = useRef(0);

  // ── Lazy-load content on demand ──
  const [content, setContent] = useState<string | null>(null);
  const [loadingContent, setLoadingContent] = useState(true);

  useEffect(() => {
    if (!id) return;
    setLoadingContent(true);
    setContent(null);

    // Try individual content file first, fall back to legacy data.json
    fetch(`/data-content/${id}.json`)
      .then(res => {
        if (!res.ok) throw new Error('Content file not found');
        return res.json();
      })
      .then(data => {
        setContent(data.content);
        setLoadingContent(false);
      })
      .catch(() => {
        // Fallback: fetch from legacy monolithic data.json
        fetch(`/data.json?_=${Date.now()}`)
          .then(res => res.json())
          .then(all => {
            const found = all.find((m: any) => m.id === id);
            setContent(found?.content || 'Inhalt konnte nicht geladen werden.');
            setLoadingContent(false);
          })
          .catch(() => {
            setContent('Inhalt konnte nicht geladen werden.');
            setLoadingContent(false);
          });
      });
  }, [id]);

  // Parse headings for ToC
  const headings = useMemo(() => {
    if (!content) return [];
    return content.split('\n')
      .filter(l => /^#{2,3}\s/.test(l))
      .map((l, i) => {
        const level = l.startsWith('### ') ? 3 : 2;
        const text = l.replace(/^#{2,3}\s+/, '').trim();
        const slug = `toc-${i}-${text.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').slice(0, 40)}`;
        return { level, text, slug };
      });
  }, [content]);

  const scrollToHeading = useCallback((slug: string) => {
    const el = scrollContainerRef.current?.querySelector(`[id="${slug}"]`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setShowToc(false);
  }, []);

  // Related monographs
  const relatedMonographs = useMemo(() => {
    if (!meta) return [];
    const myCat = meta.category.split(' / ')[0];
    return data
      .filter(d => d.id !== meta.id && d.category.split(' / ')[0] === myCat)
      .sort((a, b) => a.title.localeCompare(b.title))
      .slice(0, 4);
  }, [meta, data]);

  useEffect(() => {
    if (id && meta) markAsRead(id);
  }, [id, meta, markAsRead]);

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (el) el.scrollTop = 0;
    setReadProgress(0);
    setShowScrollTop(false);
  }, [id]);

  // Scroll progress
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const handler = () => {
      const { scrollTop, scrollHeight, clientHeight } = el;
      const progress = scrollHeight <= clientHeight ? 100 : (scrollTop / (scrollHeight - clientHeight)) * 100;
      setReadProgress(progress);
      setShowScrollTop(scrollTop > 400);
    };
    el.addEventListener('scroll', handler, { passive: true });
    return () => el.removeEventListener('scroll', handler);
  }, [content]);

  // Escape to go back
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') navigate(-1); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [navigate]);

  if (!meta) {
    return (
      <div className="app-layout">
        <div className="reader-content glass" style={{ textAlign: 'center' }}>
          <h2>Signal verloren. Monographie nicht gefunden.</h2>
          <button className="btn-back" style={{ margin: '2rem auto', border: '1px solid var(--accent-cyan)', padding: '0.5rem 1rem', borderRadius: '8px' }} onClick={() => navigate('/')}>Zurück zur Matrix</button>
        </div>
      </div>
    );
  }

  const isFav = id ? favorites.includes(id) : false;
  const wordCount = meta.wordCount || 0;
  const readTimeMin = Math.max(1, Math.round(wordCount / 200));

  return (
    <div ref={scrollContainerRef} style={{ position: 'absolute', top: 0, left: 0, width: '100vw', height: '100vh', overflowY: 'auto', background: 'var(--bg-dark)' }}>
      <div className="reading-progress-bar" style={{ width: `${readProgress}%` }} />

      <div className="app-layout">
        <div className="reader-wrapper animate-slide-up">
          <nav className="reader-nav glass">
            <button className="btn-back" onClick={() => navigate(-1)}>
              <span style={{ fontSize: '1.2rem', color: 'var(--accent-cyan)' }}>←</span> Zurück
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{readTimeMin} Min. Lesezeit</span>
              {headings.length > 0 && (
                <button className="toc-toggle" onClick={() => setShowToc(!showToc)}>☰ Inhalt</button>
              )}
              <button
                className={`fav-btn ${isFav ? 'is-fav' : ''}`}
                onClick={() => id && toggleFavorite(id)}
                title={isFav ? 'Favorit entfernen' : 'Als Favorit markieren'}
                style={{ fontSize: '1.3rem' }}
              >★</button>
              <span className="category-badge">{meta.category.split(' / ').pop()?.replace(/_/g, ' ')}</span>
            </div>
          </nav>

          <article className="reader-content glass">
            {loadingContent ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '4rem 0' }}>
                <div className="spinner" style={{ width: '40px', height: '40px' }}></div>
                <p style={{ color: 'var(--text-muted)', marginTop: '1rem', fontSize: '0.85rem' }}>Monographie wird geladen...</p>
              </div>
            ) : content ? (
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  a: ({node, ...props}) => {
                    const href = String(props.href || '');
                    if (href.startsWith('/monograph/')) {
                      return <Link to={href} className="wiki-link">{props.children}</Link>;
                    }
                    if (href.includes('wikipedia.org/wiki/')) {
                      return <button className="wiki-inline-link" onClick={() => setWikiUrl(href)}>{props.children}</button>;
                    }
                    return <a target="_blank" rel="noopener noreferrer" className="external-link" {...props}>{props.children}</a>;
                  },
                  h2: ({node, children, ...props}: any) => {
                    const idx = headingIndexRef.current++;
                    const heading = headings.find((h, i) => h.level === 2 && i === idx);
                    const slug = heading ? heading.slug : `h2-${idx}`;
                    return <h2 id={slug} {...props}>{children}</h2>;
                  },
                  h3: ({node, children, ...props}: any) => {
                    const idx = headingIndexRef.current++;
                    const heading = headings.find((h, i) => h.level === 3 && i === idx);
                    const slug = heading ? heading.slug : `h3-${idx}`;
                    return <h3 id={slug} {...props}>{children}</h3>;
                  }
                }}
              >
                {(() => { headingIndexRef.current = 0; return content; })()}
              </ReactMarkdown>
            ) : null}

            {/* Related Monographs */}
            {!loadingContent && relatedMonographs.length > 0 && (
              <div className="related-section">
                <div className="related-title">Verwandte Monographien</div>
                <div className="related-grid">
                  {relatedMonographs.map(rm => (
                    <Link to={`/monograph/${rm.id}`} key={rm.id} className="related-card">
                      <div className="related-card-img" style={{
                        backgroundImage: `url(${rm.finalImageUrl || getFallbackImage(rm.topCategory)})`,
                      }} />
                      <div className="related-card-info">
                        <div className="related-card-title">{rm.cleanTitle}</div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </article>
        </div>
      </div>

      {/* Table of Contents Sidebar */}
      <div className={`toc-backdrop ${showToc ? 'open' : ''}`} onClick={() => setShowToc(false)} />
      <div className={`toc-panel ${showToc ? 'open' : ''}`}>
        <div className="toc-header">
          <h3>Inhaltsverzeichnis</h3>
          <button className="toc-close" onClick={() => setShowToc(false)}>✕</button>
        </div>
        <div className="toc-list">
          {headings.map((h, i) => (
            <button
              key={i}
              className={`toc-item ${h.level === 3 ? 'level-3' : ''}`}
              onClick={() => scrollToHeading(h.slug)}
            >{h.text}</button>
          ))}
        </div>
      </div>

      {/* Wikipedia Modal overlay */}
      {wikiUrl && <WikipediaModal url={wikiUrl} onClose={() => setWikiUrl(null)} />}

      {/* Scroll to Top */}
      <button
        className={`scroll-to-top ${showScrollTop ? 'visible' : ''}`}
        onClick={() => scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}
        title="Nach oben scrollen"
      >↑</button>
    </div>
  );
}

// ════════════════════════════════════════════════
//  APP ROOT
// ════════════════════════════════════════════════

export default function App() {
  const [data, setData] = useState<MonographMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [readMonographs, setReadMonographs] = useLocalStorage<string[]>('spiral-wiki-read', []);
  const [favorites, setFavorites] = useLocalStorage<string[]>('spiral-wiki-favorites', []);
  const [viewMode, setViewMode] = useLocalStorage<ViewMode>('spiral-view-mode', 'spiral');

  const markAsRead = useCallback((id: string) => {
    setReadMonographs(prev => {
      if (!prev.includes(id)) return [...prev, id];
      return prev;
    });
  }, [setReadMonographs]);

  const toggleFavorite = useCallback((id: string) => {
    setFavorites(prev => {
      if (prev.includes(id)) return prev.filter(f => f !== id);
      return [...prev, id];
    });
  }, [setFavorites]);

  useEffect(() => {
    // Load the TINY index file (~50KB) instead of the monolithic 5.9MB data.json
    fetch(`/data-index.json?_=${Date.now()}`)
      .then(res => {
        if (!res.ok) throw new Error('Index not found, falling back to legacy');
        return res.json();
      })
      .then(json => {
        setData(json);
        setLoading(false);
      })
      .catch(() => {
        // Fallback: legacy data.json (if data-index.json not yet built)
        fetch(`/data.json?_=${Date.now()}`)
          .then(res => res.json())
          .then(json => {
            // Strip content from legacy data to keep memory low
            const stripped = json.map((m: any) => ({
              id: m.id,
              title: m.title,
              cleanTitle: m.cleanTitle,
              category: m.category,
              topCategory: m.topCategory,
              year: m.year,
              finalImageUrl: m.finalImageUrl,
              hasRealImage: m.hasRealImage,
              wordCount: m.wordCount,
            }));
            setData(stripped);
            setLoading(false);
          })
          .catch(err => {
            console.error('Failed to load wiki data', err);
            setLoading(false);
          });
      });
  }, []);

  if (loading) {
    return (
      <div style={{ background: 'var(--bg-dark)', height: '100vh', width: '100vw' }}>
        <div className="loader-container">
          <div className="spinner"></div>
          <p style={{ color: 'var(--accent-cyan)', letterSpacing: '0.2em', textTransform: 'uppercase' }}>Initialisiere Spiral Mind...</p>
        </div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/" element={
        <Dashboard data={data} readMonographs={readMonographs} favorites={favorites} toggleFavorite={toggleFavorite} viewMode={viewMode} setViewMode={setViewMode} />
      } />
      <Route path="/monograph/:id" element={
        <MonographReader data={data} markAsRead={markAsRead} favorites={favorites} toggleFavorite={toggleFavorite} />
      } />
    </Routes>
  );
}
