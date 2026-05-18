import { Routes, Route, Link, useParams, useNavigate } from 'react-router-dom';
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// Utility: navigate is used by Dashboard via useNavigate import above

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

interface Monograph {
  id: string;
  title: string;
  category: string;
  content: string;
  imageUrl?: string | null;
  wordCount?: number;
}

// interface ProcessedMonograph removed

const cleanTitleText = (title: string) => {
  return title.replace(/^(Monographie: |Primärquellen: |Masterclass |Monographie )/i, '').replace(/\s*\(.*?\)/, '').trim();
};

const CATEGORY_IMAGES: Record<string, string> = {
  "Wirtschaft": "https://upload.wikimedia.org/wikipedia/commons/e/e0/New_York_Stock_Exchange_1908.jpg",
  "Soziologie": "https://upload.wikimedia.org/wikipedia/commons/6/6c/Crowd_outside_the_Stock_Exchange%2C_New_York%2C_1900.jpg",
  "Kybernetik": "https://upload.wikimedia.org/wikipedia/commons/thumb/c/cf/Cybernetics.jpg/800px-Cybernetics.jpg",
  "Philosophie": "https://upload.wikimedia.org/wikipedia/commons/8/8c/David_-_The_Death_of_Socrates.jpg",
  "Neurologie": "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1a/Cajal_cortex_drawings.png/800px-Cajal_cortex_drawings.png",
  "Psychologie": "https://upload.wikimedia.org/wikipedia/commons/6/6e/Rorschach_blot_01.jpg",
  "Religion und Spiritualitaet": "https://upload.wikimedia.org/wikipedia/commons/7/74/The_Creation_of_Adam.jpg",
  "Wissenschaft": "https://upload.wikimedia.org/wikipedia/commons/3/39/GodfreyKneller-IsaacNewton-1689.jpg",
  "Bewusstseinsforschung": "https://upload.wikimedia.org/wikipedia/commons/thumb/8/87/Flammarion_Woodcut_1888.jpg/800px-Flammarion_Woodcut_1888.jpg",
  "Kunst und Literatur": "https://upload.wikimedia.org/wikipedia/commons/e/ec/Mona_Lisa%2C_by_Leonardo_da_Vinci%2C_from_C2RMF_retouched.jpg",
  "Physik und Mathematik": "https://upload.wikimedia.org/wikipedia/commons/thumb/9/98/Andromeda_Galaxy_%28with_h-alpha%29.jpg/800px-Andromeda_Galaxy_%28with_h-alpha%29.jpg",
  "Synthesen": "https://upload.wikimedia.org/wikipedia/commons/a/a2/Alchemical_scroll_by_George_Ripley_%28Wellcome%29.jpg",
  "Tradition": "https://upload.wikimedia.org/wikipedia/commons/thumb/3/30/Bayeux_Tapestry_scene57.jpg/800px-Bayeux_Tapestry_scene57.jpg",
  "Traumaforschung": "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d4/The_Scream.jpg/800px-The_Scream.jpg",
  "default": "https://upload.wikimedia.org/wikipedia/commons/thumb/1/13/Hubble_Ultra_Deep_Field_part_d.jpg/800px-Hubble_Ultra_Deep_Field_part_d.jpg"
};

const getCatImage = (catName: string) => {
  for (const key of Object.keys(CATEGORY_IMAGES)) {
    if (catName.includes(key)) return CATEGORY_IMAGES[key];
  }
  return CATEGORY_IMAGES.default;
};

// Distinct border colors per category for the portrait mosaic
const CATEGORY_COLORS: Record<string, string> = {
  'Bewusstseinsforschung': '#a855f7',    // violet
  'Kunst_und_Literatur': '#ec4899',       // pink
  'Kybernetik': '#06b6d4',                // cyan
  'Neurologie': '#10b981',                // emerald
  'Philosophie': '#3b82f6',               // blue
  'Physik_und_Mathematik': '#f59e0b',     // amber
  'Psychologie': '#f97316',               // orange
  'Religion_und_Spiritualitaet': '#eab308', // yellow
  'Soziologie': '#ef4444',                // red
  'Synthesen': '#8b5cf6',                 // purple
  'Tradition': '#78716c',                 // stone
  'Traumaforschung': '#dc2626',           // crimson
  'Wirtschaft': '#22c55e',                // green
  'Wissenschaft': '#14b8a6',              // teal
};

const getCatColor = (catName: string): string => {
  for (const [key, color] of Object.entries(CATEGORY_COLORS)) {
    if (catName.includes(key)) return color;
  }
  return '#64748b'; // slate fallback
};

type ViewMode = 'spiral' | 'circle' | 'portrait';

// 13 balanced arms: large categories split, small ones merged → ~48 entries/arm
// This ensures a uniform, beautiful spiral with equal-length arms.
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

interface DashboardProps {
  data: Monograph[];
  readMonographs: string[];
  favorites: string[];
  toggleFavorite: (id: string) => void;
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
}

function Dashboard({ data, readMonographs, favorites, toggleFavorite, viewMode, setViewMode }: DashboardProps) {
  const [search, setSearch] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const [alphaFilter, setAlphaFilter] = useState<string>('');
  const [zoomLevel, setZoomLevel] = useState<number>(1); // 0=S, 1=M, 2=L

  // Spiral/Circle state
  const spiralRef = useRef<HTMLDivElement>(null);
  const [spiralTransform, setSpiralTransform] = useState({ x: 0, y: 0, scale: 0.22 });
  const dragStartPos = useRef({ x: 0, y: 0 });
  const dragRef = useRef({ dragging: false, lastX: 0, lastY: 0 });

  // Keyboard shortcuts
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

  const goToRandom = useCallback(() => {
    if (data.length === 0) return;
    const item = data[Math.floor(Math.random() * data.length)];
    navigate(`/monograph/${item.id}`);
  }, [data, navigate]);

  // Data Processing
  const processedData = useMemo(() => {
    return data.map(item => {
      const parts = item.category ? item.category.split(' / ') : ['Uncategorized'];
      const topCategory = parts[0];

      let year = 9999;
      const yearMatch = item.content.match(/\(\*?\s*(\d{4})/);
      if (yearMatch?.[1]) year = parseInt(yearMatch[1], 10);

      let finalImageUrl = item.imageUrl || null;
      if (!finalImageUrl) {
        const imgMatch = item.content.match(/!\[.*?\]\((.*?)\)/);
        if (imgMatch?.[1]) finalImageUrl = imgMatch[1];
      }
      const hasRealImage = !!finalImageUrl;
      // All entries now have real HTTP images — no null fallback needed

      return {
        ...item,
        topCategory,
        year,
        finalImageUrl,
        hasRealImage,
        cleanTitle: cleanTitleText(item.title),
        catColor: getCatColor(topCategory),
      };
    });
  }, [data]);

  const sortedCategories = useMemo(() => {
    const cats = new Set<string>();
    processedData.forEach(d => cats.add(d.topCategory));
    return Array.from(cats).sort();
  }, [processedData]);

  const filteredData = useMemo(() => {
    return processedData.filter(d => {
      if (search && !d.title.toLowerCase().includes(search.toLowerCase()) && !d.category.toLowerCase().includes(search.toLowerCase())) return false;
      if (selectedCategory !== 'all' && d.topCategory !== selectedCategory) return false;
      if (showFavoritesOnly && !favorites.includes(d.id)) return false;
      if (showUnreadOnly && readMonographs.includes(d.id)) return false;
      if (alphaFilter && !d.cleanTitle.toUpperCase().startsWith(alphaFilter)) return false;
      return true;
    });
  }, [processedData, search, selectedCategory, showFavoritesOnly, showUnreadOnly, favorites, readMonographs, alphaFilter]);

  // Group by category for mosaic view
  const groupedByCategory = useMemo(() => {
    const groups: Record<string, typeof filteredData> = {};
    filteredData.forEach(d => {
      if (!groups[d.topCategory]) groups[d.topCategory] = [];
      groups[d.topCategory].push(d);
    });
    // Sort items within each group by title
    for (const key of Object.keys(groups)) {
      groups[key].sort((a, b) => a.cleanTitle.localeCompare(b.cleanTitle));
    }
    return groups;
  }, [filteredData]);

  const ZOOM_SIZES = [60, 90, 150];
  const ZOOM_LABELS = ['S', 'M', 'L'];
  const tileSize = ZOOM_SIZES[zoomLevel];

  // Assign each item to one of 13 balanced arms
  // For split arms (e.g. Philosophie I/II/III), items are distributed evenly
  const getArmIndex = (cat: string): number => {
    const topCat = cat.split('/')[0].trim();
    // Find first matching arm (for non-split arms and display purposes)
    for (let i = 0; i < SUPER_ARMS.length; i++) {
      if (SUPER_ARMS[i].cats.some(c => topCat.includes(c) || c.includes(topCat))) return i;
    }
    return 0;
  };

  // Spiral positions: 13 BALANCED arms, ~48 entries each
  const spiralPositions = useMemo(() => {
    if (viewMode !== 'spiral') return [];
    const items = filteredData;
    const armCount = SUPER_ARMS.length;

    // Step 1: Collect all items by their matching category group
    // Group by the base category (ignoring splits)
    const catGroups: Map<string, typeof items> = new Map();
    items.forEach(item => {
      const topCat = item.topCategory.split('/')[0].trim();
      let matched = false;
      for (const arm of SUPER_ARMS) {
        if (arm.cats.some(c => topCat.includes(c) || c.includes(topCat))) {
          // Use the primary cat name as key
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

    // Step 2: Distribute into arm buckets, respecting splits
    const armBuckets: (typeof items)[] = Array.from({ length: armCount }, () => []);
    for (let a = 0; a < armCount; a++) {
      const arm = SUPER_ARMS[a];
      const primaryCat = arm.cats[0];
      const allItems = catGroups.get(primaryCat) || [];

      if (arm.splitCount && arm.splitCount > 1) {
        // This arm is a split: take the appropriate chunk
        const chunkSize = Math.ceil(allItems.length / arm.splitCount);
        const start = (arm.splitIndex || 0) * chunkSize;
        const end = Math.min(start + chunkSize, allItems.length);
        armBuckets[a] = allItems.slice(start, end);
      } else {
        // Non-split arm: takes all items from its categories
        arm.cats.forEach(catName => {
          const catItems = catGroups.get(catName);
          if (catItems) {
            armBuckets[a].push(...catItems);
            catGroups.delete(catName); // prevent double-counting
          }
        });
      }
    }

    // Step 3: Layout — all arms start at same radius, uniform spacing
    const nodeDiam = 58;
    const minDist = nodeDiam;
    const positions: { item: typeof items[0]; x: number; y: number; armIdx: number }[] = [];
    const startR = nodeDiam * 2.5; // Same start radius for ALL arms

    for (let a = 0; a < armCount; a++) {
      const baseAngle = (a / armCount) * 2 * Math.PI;
      let prevX = 0, prevY = 0;

      // True Archimedean spiral: r = a + b*θ
      // Constant angular advance per node → curved arms
      const spiralTightness = 0.18; // radians per node (~10°) — controls curvature
      const radialGrowth = nodeDiam * 0.52; // how fast radius grows per node

      armBuckets[a].forEach((item, i) => {
        const theta = i * spiralTightness; // cumulative angle from arm base
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

    // Post-layout collision resolution
    for (let pass = 0; pass < 3; pass++) {
      for (let i = 0; i < positions.length; i++) {
        for (let j = i + 1; j < positions.length; j++) {
          const dx = positions[j].x - positions[i].x;
          const dy = positions[j].y - positions[i].y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < minDist && d > 0) {
            const overlap = (minDist - d) / 2;
            const nx = dx / d, ny = dy / d;
            positions[i].x -= nx * overlap;
            positions[i].y -= ny * overlap;
            positions[j].x += nx * overlap;
            positions[j].y += ny * overlap;
          }
        }
      }
    }

    return positions;
  }, [filteredData, viewMode]);

  // Circle positions: fill a disc with concentric rings, grouped by category
  const circlePositions = useMemo(() => {
    if (viewMode !== 'circle') return [];
    // Sort by category so same-category items sit together
    const items = [...filteredData].sort((a, b) => {
      const ai = SUPER_ARMS.findIndex(arm => arm.cats.some(c => a.topCategory.includes(c) || c.includes(a.topCategory)));
      const bi = SUPER_ARMS.findIndex(arm => arm.cats.some(c => b.topCategory.includes(c) || c.includes(b.topCategory)));
      if (ai !== bi) return ai - bi;
      return a.topCategory.localeCompare(b.topCategory);
    });
    const n = items.length;
    if (n === 0) return [];
    const nodeDiam = 58; // 48px node + 3px border × 2 + 4px guaranteed gap
    const positions: { item: typeof items[0]; x: number; y: number }[] = [];
    let placed = 0;
    // Center item
    if (placed < n) {
      positions.push({ item: items[placed], x: 0, y: 0 });
      placed++;
    }
    // Concentric rings outward
    let ring = 1;
    while (placed < n) {
      const r = ring * nodeDiam;
      const circumference = 2 * Math.PI * r;
      const maxInRing = Math.max(1, Math.floor(circumference / nodeDiam));
      const count = Math.min(maxInRing, n - placed);
      for (let j = 0; j < count; j++) {
        const angle = (j / count) * 2 * Math.PI - Math.PI / 2;
        positions.push({ item: items[placed], x: r * Math.cos(angle), y: r * Math.sin(angle) });
        placed++;
      }
      ring++;
    }
    return positions;
  }, [filteredData, viewMode]);

  // Refs for direct DOM manipulation (avoids React re-renders during pan/zoom)
  const canvasRef = useRef<HTMLDivElement>(null);
  const transformRef = useRef(spiralTransform);
  transformRef.current = spiralTransform;

  const applyTransformDirect = useCallback(() => {
    if (canvasRef.current) {
      const { x, y, scale } = transformRef.current;
      canvasRef.current.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
    }
  }, []);

  // Wheel zoom: must use native event listener with {passive:false} because React adds passive
  useEffect(() => {
    const el = spiralRef.current;
    if (!el || (viewMode !== 'spiral' && viewMode !== 'circle')) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const factor = e.deltaY > 0 ? 0.92 : 1.08;
      const newScale = Math.max(0.05, Math.min(5, transformRef.current.scale * factor));
      transformRef.current = { ...transformRef.current, scale: newScale };
      applyTransformDirect();
      // Debounced state sync for culling update
      clearTimeout((el as any)._zoomTimer);
      (el as any)._zoomTimer = setTimeout(() => {
        setSpiralTransform({ ...transformRef.current });
      }, 150);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [viewMode, applyTransformDirect]);

  // Pan: track drag distance to distinguish click vs drag
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    dragRef.current = { dragging: true, lastX: e.clientX, lastY: e.clientY };
    dragStartPos.current = { x: e.clientX, y: e.clientY };
  }, []);
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragRef.current.dragging) return;
    const dx = e.clientX - dragRef.current.lastX;
    const dy = e.clientY - dragRef.current.lastY;
    dragRef.current.lastX = e.clientX;
    dragRef.current.lastY = e.clientY;
    // Direct DOM update — no React re-render!
    transformRef.current = { ...transformRef.current, x: transformRef.current.x + dx, y: transformRef.current.y + dy };
    applyTransformDirect();
  }, [applyTransformDirect]);
  const handleMouseUp = useCallback(() => {
    if (dragRef.current.dragging) {
      dragRef.current.dragging = false;
      // Sync state for culling update
      setSpiralTransform({ ...transformRef.current });
    }
  }, []);
  // Block link navigation if user was dragging
  const handleNodeClick = useCallback((e: React.MouseEvent) => {
    const dx = Math.abs(e.clientX - dragStartPos.current.x);
    const dy = Math.abs(e.clientY - dragStartPos.current.y);
    if (dx > 5 || dy > 5) e.preventDefault(); // was a drag, not a click
  }, []);

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
          className={`cat-legend-item ${selectedCategory === 'all' ? 'active' : ''}`}
          onClick={() => setSelectedCategory('all')}
        >
          <span className="cat-dot" style={{ background: 'linear-gradient(135deg, #3b82f6, #a855f7, #ec4899)' }} />
          Alle ({filteredData.length})
        </button>
        {sortedCategories.map(cat => {
          const color = getCatColor(cat);
          const count = groupedByCategory[cat]?.length || 0;
          return (
            <button
              key={cat}
              className={`cat-legend-item ${selectedCategory === cat ? 'active' : ''}`}
              onClick={() => setSelectedCategory(selectedCategory === cat ? 'all' : cat)}
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
        {/* Alphabet Quick-Jump */}
        <div className="alpha-index" style={{ flex: 1, marginBottom: 0, padding: '0.3rem 0.4rem' }}>
          {'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(letter => {
            const hasItems = filteredData.some(d => d.cleanTitle.toUpperCase().startsWith(letter));
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
                    {cat.replace(/_/g, ' ')} ({items.length})
                  </div>
                  <div className="mosaic-grid" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${tileSize}px, 1fr))` }}>
                    {items.map(item => {
                      const isRead = readMonographs.includes(item.id);
                      const isFav = favorites.includes(item.id);
                      return (
                        <Link to={`/monograph/${item.id}`} key={item.id}
                          className={`mosaic-tile ${isRead ? 'is-read' : ''}`}
                          style={{ '--tile-color': color } as any}>
                          <img className="mosaic-portrait" src={item.finalImageUrl || ''} alt={item.cleanTitle} loading="lazy" decoding="async" />
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
          </div>
          {filteredData.length === 0 && <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '4rem 2rem' }}>Keine Einträge.</div>}
        </div>
      )}

      {/* === SPIRAL or CIRCLE VIEW (Canvas-based for 60fps) === */}
      {(viewMode === 'spiral' || viewMode === 'circle') && (() => {
        return <CanvasSpiral
          positions={viewMode === 'spiral' ? spiralPositions : circlePositions}
          viewMode={viewMode}
          spiralRef={spiralRef}
          canvasRef={canvasRef}
          spiralTransform={spiralTransform}
          setSpiralTransform={setSpiralTransform}
          transformRef={transformRef}
          applyTransformDirect={applyTransformDirect}
          handleMouseDown={handleMouseDown}
          handleMouseMove={handleMouseMove}
          handleMouseUp={handleMouseUp}
          handleNodeClick={handleNodeClick}
          superArms={SUPER_ARMS}
          getArmIndex={getArmIndex}
        />;
      })()}
    </div>
  );
}

// ==================== CANVAS-BASED SPIRAL (60fps) ====================
interface CanvasSpiralProps {
  positions: { item: any; x: number; y: number; armIdx: number }[];
  viewMode: ViewMode;
  spiralRef: React.RefObject<HTMLDivElement>;
  canvasRef: React.RefObject<HTMLDivElement>;
  spiralTransform: { x: number; y: number; scale: number };
  setSpiralTransform: (t: { x: number; y: number; scale: number }) => void;
  transformRef: React.MutableRefObject<{ x: number; y: number; scale: number }>;
  applyTransformDirect: () => void;
  handleMouseDown: (e: React.MouseEvent) => void;
  handleMouseMove: (e: React.MouseEvent) => void;
  handleMouseUp: () => void;
  handleNodeClick: (e: React.MouseEvent) => void;
  superArms: { name: string; cats: string[]; color: string }[];
  getArmIndex: (cat: string) => number;
}

function CanvasSpiral({ positions, viewMode, spiralTransform, setSpiralTransform, transformRef, superArms, getArmIndex }: CanvasSpiralProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasElRef = useRef<HTMLCanvasElement>(null);
  const imgCache = useRef<Map<string, HTMLImageElement>>(new Map());
  const rafRef = useRef<number>(0);
  const dragState = useRef({ dragging: false, lastX: 0, lastY: 0, startX: 0, startY: 0 });
  const hoverNode = useRef<{ item: any; sx: number; sy: number } | null>(null);
  const [hoveredItem, setHoveredItem] = useState<{ item: any; sx: number; sy: number } | null>(null);
  const navigate = useNavigate();
  const localTransform = useRef(spiralTransform);
  localTransform.current = spiralTransform;

  // Pre-load images
  useEffect(() => {
    const cache = imgCache.current;
    positions.forEach(({ item }) => {
      if (item.finalImageUrl && !cache.has(item.finalImageUrl)) {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = item.finalImageUrl;
        cache.set(item.finalImageUrl, img);
      }
    });
  }, [positions]);

  // Draw loop
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

    // Draw arm guide curves (spiral mode only) — true Archimedean spirals
    if (viewMode === 'spiral') {
      const guideStartR = 58 * 2.5; // must match startR in layout
      const guideTightness = 0.18;   // must match spiralTightness
      const guideGrowth = 58 * 0.52; // must match radialGrowth
      const guideSteps = 55;         // enough points to cover longest arm

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

    // Draw nodes
    const r = 22; // node radius
    const cache = imgCache.current;
    positions.forEach(({ item, x, y }) => {
      const color = superArms[getArmIndex(item.topCategory)]?.color || '#64748b';
      const img = cache.get(item.finalImageUrl);

      // Draw border circle
      ctx.beginPath();
      ctx.arc(x, y, r + 1.5, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();

      // Draw image circle
      ctx.save();
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.clip();
      if (img && img.complete && img.naturalWidth > 0) {
        ctx.drawImage(img, x - r, y - r, r * 2, r * 2);
      } else {
        ctx.fillStyle = '#1a1a2e';
        ctx.fill();
      }
      ctx.restore();

      // Draw tiny label
      if (scale > 0.6) {
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.font = '4px Inter, sans-serif';
        ctx.textAlign = 'center';
        const label = item.cleanTitle.length > 12 ? item.cleanTitle.slice(0, 11) + '…' : item.cleanTitle;
        ctx.fillText(label, x, y + r + 6);
      }
    });

    // Draw center
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

  // Animation frame loop
  useEffect(() => {
    let running = true;
    const loop = () => {
      if (!running) return;
      draw();
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => { running = false; cancelAnimationFrame(rafRef.current); };
  }, [draw]);

  // Mouse handlers (direct, no React state during drag)
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
    } else {
      // Hit test for hover
      const canvas = canvasElRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const { x: tx, y: ty, scale } = localTransform.current;
      const cx = rect.width / 2;
      const cy = rect.height / 2;
      // Convert mouse to world coords
      const wx = (mx - cx - tx) / scale;
      const wy = (my - cy - ty) / scale;

      let found: typeof hoverNode.current = null;
      for (const pos of positions) {
        const dx = pos.x - wx;
        const dy = pos.y - wy;
        if (dx * dx + dy * dy < 24 * 24) {
          found = { item: pos.item, sx: e.clientX, sy: e.clientY };
          break;
        }
      }
      if (found?.item?.id !== hoverNode.current?.item?.id) {
        hoverNode.current = found;
        setHoveredItem(found);
      }
    }
  }, [positions]);

  const onMouseUp = useCallback(() => {
    const ds = dragState.current;
    if (ds.dragging) {
      ds.dragging = false;
      setSpiralTransform({ ...localTransform.current });
    }
  }, [setSpiralTransform]);

  const onClick = useCallback((e: React.MouseEvent) => {
    const ds = dragState.current;
    const dx = Math.abs(e.clientX - ds.startX);
    const dy = Math.abs(e.clientY - ds.startY);
    if (dx > 5 || dy > 5) return; // was a drag

    // Hit test
    const canvas = canvasElRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const { x: tx, y: ty, scale } = localTransform.current;
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const wx = (mx - cx - tx) / scale;
    const wy = (my - cy - ty) / scale;

    for (const pos of positions) {
      const ddx = pos.x - wx;
      const ddy = pos.y - wy;
      if (ddx * ddx + ddy * ddy < 24 * 24) {
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
      style={{ cursor: dragState.current.dragging ? 'grabbing' : 'grab' }}
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

interface ReaderProps {
  data: Monograph[];
  markAsRead: (id: string) => void;
  favorites: string[];
  toggleFavorite: (id: string) => void;
}

function MonographReader({ data, markAsRead, favorites, toggleFavorite }: ReaderProps) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const monograph = data.find(d => d.id === id);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [readProgress, setReadProgress] = useState(0);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [showToc, setShowToc] = useState(false);
  const headingIndexRef = useRef(0);

  // Parse headings for Table of Contents
  const headings = useMemo(() => {
    if (!monograph) return [];
    return monograph.content.split('\n')
      .filter(l => /^#{2,3}\s/.test(l))
      .map((l, i) => {
        const level = l.startsWith('### ') ? 3 : 2;
        const text = l.replace(/^#{2,3}\s+/, '').trim();
        const slug = `toc-${i}-${text.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').slice(0, 40)}`;
        return { level, text, slug };
      });
  }, [monograph]);

  const scrollToHeading = useCallback((slug: string) => {
    const el = scrollContainerRef.current?.querySelector(`[id="${slug}"]`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setShowToc(false);
  }, []);

  // Related monographs from same top-level category
  const relatedMonographs = useMemo(() => {
    if (!monograph) return [];
    const myCat = monograph.category.split(' / ')[0];
    return data
      .filter(d => d.id !== monograph.id && d.category.split(' / ')[0] === myCat)
      .sort((a, b) => a.title.localeCompare(b.title))
      .slice(0, 4);
  }, [monograph, data]);

  useEffect(() => {
    if (id && monograph) markAsRead(id);
  }, [id, monograph, markAsRead]);

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (el) el.scrollTop = 0;
    setReadProgress(0);
    setShowScrollTop(false);
  }, [id]);

  // Scroll progress + scroll-to-top visibility
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
  }, [monograph]);

  // Keyboard: Escape to go back
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') navigate(-1);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [navigate]);

  if (!monograph) {
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
  const wordCount = monograph.wordCount || monograph.content.split(/\s+/).filter(Boolean).length;
  const readTimeMin = Math.max(1, Math.round(wordCount / 200));

  return (
    <div ref={scrollContainerRef} style={{ position: 'absolute', top: 0, left: 0, width: '100vw', height: '100vh', overflowY: 'auto', background: 'var(--bg-dark)' }}>
      {/* Reading Progress Bar */}
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
              <span className="category-badge">{monograph.category.split(' / ').pop()?.replace(/_/g, ' ')}</span>
            </div>
          </nav>
          
          <article className="reader-content glass">
            <ReactMarkdown 
              remarkPlugins={[remarkGfm]}
              components={{
                a: ({node, ...props}) => {
                  const href = props.href || '';
                  if (href.startsWith('/monograph/')) {
                    return <Link to={href} className="wiki-link">{props.children}</Link>;
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
              {(() => { headingIndexRef.current = 0; return monograph.content; })()}
            </ReactMarkdown>

            {/* Related Monographs */}
            {relatedMonographs.length > 0 && (
              <div className="related-section">
                <div className="related-title">Verwandte Monographien</div>
                <div className="related-grid">
                  {relatedMonographs.map(rm => (
                    <Link to={`/monograph/${rm.id}`} key={rm.id} className="related-card">
                      <div className="related-card-img" style={{ backgroundImage: `url(${rm.imageUrl || ''})` }} />
                      <div className="related-card-info">
                        <div className="related-card-title">{cleanTitleText(rm.title)}</div>
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

      {/* Scroll to Top Button */}
      <button
        className={`scroll-to-top ${showScrollTop ? 'visible' : ''}`}
        onClick={() => scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}
        title="Nach oben scrollen"
      >↑</button>
    </div>
  );
}

export default function App() {
  const [data, setData] = useState<Monograph[]>([]);
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
    const processJson = (json: any[]) => {
      // Smart Deduplication: Keep the version with an image if possible
      const uniqueDataMap = new Map();
      for (const item of json) {
        if (uniqueDataMap.has(item.id)) {
          const existing = uniqueDataMap.get(item.id);
          const hasImg = !!item.imageUrl || (item.content && item.content.includes("!["));
          const existingHasImg = !!existing.imageUrl || (existing.content && existing.content.includes("!["));
          if ((hasImg && !existingHasImg) || (!existingHasImg && item.content?.length > existing.content?.length)) {
            uniqueDataMap.set(item.id, item);
          }
        } else {
          uniqueDataMap.set(item.id, item);
        }
      }
      setData(Array.from(uniqueDataMap.values()));
      setLoading(false);
    };

    // Try window.__WIKI_DATA__ first (standalone mode), then fetch
    if ((window as any).__WIKI_DATA__) {
      processJson((window as any).__WIKI_DATA__);
    } else {
      fetch(`/data.json?_=${Date.now()}`)
        .then(res => res.json())
        .then(processJson)
        .catch(err => {
          console.error("Failed to load wiki data", err);
          setLoading(false);
        });
    }
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
