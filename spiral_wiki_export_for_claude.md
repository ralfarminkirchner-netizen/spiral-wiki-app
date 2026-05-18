# Handover Context: Spiral Wiki App

## Current State
The Spiral Wiki App has just undergone a major performance and UI overhaul:

1.  **Image Audit & Fixes**: All 628 monographic entries have had their image URLs verified and fixed. Broken Wikimedia URLs and missing SVGs/TIFs have been systematically replaced with high-resolution, working imagery or deterministic thematic fallbacks.
2.  **Performance Optimization**: The UI was struggling to render 1800+ DOM nodes (images + labels + containers) for the spiral view. This was completely rewritten to use a **single HTML5 `<canvas>` element** for the spiral layout.
    *   Replaced 625 `position: absolute` DOM nodes with a 60fps `requestAnimationFrame` canvas drawing loop.
    *   Pan/Zoom operations are now handled directly on the transform state of the canvas without triggering React re-renders.
    *   Removed expensive CSS transitions, heavy `box-shadow` properties, and GPU-intensive `blur()` filters on the background.
    *   Hover effects are now calculated mathematically on the canvas (distance checks) to show a simple floating tooltip div.
3.  **Spiral Arm Balancing**: The user was unhappy with the "swastika-like" look of straight, uneven arms. 
    *   The spiral layout was adjusted to split large categories (e.g., Philosophie into I, II, III) and merge smaller related categories (e.g., Kunst & Natur) so that there are precisely **13 arms with roughly 48 entries each**.
    *   The arms now form a *true Archimedean spiral* using constant angular steps (`spiralTightness = 0.18`), which results in beautifully curved, uniform spiral arms instead of straight lines.
    *   The background guide lines now also follow these exact Archimedean curves instead of being straight linear gradients.

## Build Process
*   The Vite build is successful (`npm run build`).
*   The output is located in `dist/`.
*   Data generation scripts like `scripts/master-fix.py` govern the data integrity of `public/data.json` and `public/appData.js`.
*   *Important:* After building, `public/appData.js` must be copied to `dist/appData.js` so that the client application has the latest JSON-equivalent metadata.

## Next Steps for Claude Code
*   You are fully cleared to take over. The repository is in a clean Git state.
*   You can run `npm run dev` in `wiki-app` to start the local dev server.
*   The main entry points for the complex UI logic are `src/App.tsx` and `src/index.css`.
*   Review this `CLAUDE_HANDOVER.md` for context.


## src/App.tsx
```tsx

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

```

## src/index.css
```css

:root {
  --bg-dark: #020205;
  --bg-glass: rgba(15, 17, 26, 0.4);
  --border-glass: rgba(255, 255, 255, 0.1);
  --text-main: #e2e8f0;
  --text-muted: #64748b;
  --accent-cyan: #00f0ff;
  --accent-purple: #bd00ff;
  --font-sans: 'Inter', system-ui, -apple-system, sans-serif;
  --font-display: 'Outfit', 'Inter', sans-serif;
}

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html, body {
  overflow: hidden; /* We manage scrolling in our viewport */
  width: 100%;
  height: 100%;
  background-color: var(--bg-dark);
  font-family: var(--font-sans);
  color: var(--text-main);
  -webkit-font-smoothing: antialiased;
}

/* === PORTRAIT MOSAIC === */
.mosaic-page {
  width: 100vw;
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--bg-dark);
  overflow: hidden;
}

.mosaic-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 1.2rem 2rem 0.3rem;
  flex-shrink: 0;
  gap: 1rem;
}
.mosaic-header-left { flex: 1; min-width: 0; }
.mosaic-header-right {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  flex-shrink: 0;
}

/* Category Legend Bar */
.cat-legend {
  display: flex;
  gap: 0.3rem;
  flex-wrap: wrap;
  padding: 0.3rem 2rem;
  flex-shrink: 0;
}
.cat-legend-item {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.25rem 0.6rem;
  background: none;
  border: 1px solid transparent;
  border-radius: 14px;
  color: rgba(255,255,255,0.5);
  font-size: 0.68rem;
  font-family: var(--font-sans);
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;
}
.cat-legend-item:hover {
  background: rgba(255,255,255,0.05);
  color: rgba(255,255,255,0.8);
}
.cat-legend-item.active {
  background: rgba(255,255,255,0.08);
  border-color: rgba(255,255,255,0.15);
  color: white;
  font-weight: 600;
}
.cat-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
  display: inline-block;
}

/* Scrollable content area */
.mosaic-scroll {
  flex: 1;
  overflow-y: auto;
  padding: 0.5rem 0 3rem;
}

/* Mosaic Container */
.mosaic-container {
  padding: 0 0.5rem;
}
.mosaic-category-group {
  margin-bottom: 0.8rem;
}
.mosaic-cat-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.75rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin-bottom: 0.5rem;
  padding-left: 0.2rem;
}

/* The tight portrait grid */
.mosaic-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(72px, 1fr));
  gap: 2px;
}

/* Individual portrait tile */
.mosaic-tile {
  position: relative;
  display: block;
  text-decoration: none;
  color: #fff;
  border: 2px solid var(--tile-color, #64748b);
  border-radius: 4px;
  overflow: hidden;
  transition: transform 0.1s ease-out, box-shadow 0.1s ease-out;
  will-change: transform;
  aspect-ratio: 3/4;
}
.mosaic-tile:hover {
  transform: scale(1.05);
  z-index: 10;
  box-shadow: 0 4px 16px rgba(0,0,0,0.5), 0 0 8px var(--tile-color, #64748b);
  border-color: #fff;
}
.mosaic-tile.is-read {
  opacity: 0.55;
  filter: grayscale(50%);
}
.mosaic-tile.is-read:hover {
  opacity: 1;
  filter: none;
}

/* Portrait image */
.mosaic-portrait {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center top;
  background-color: rgba(30,30,40,1);
  display: block;
}

/* Fallback tile for entries without an image */
.mosaic-initial {
  display: flex;
  align-items: center;
  justify-content: center;
}
.initial-letter {
  font-family: var(--font-display);
  font-size: 2rem;
  font-weight: 700;
  opacity: 0.6;
}

/* Name label — ALWAYS visible */
.mosaic-tile-overlay {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 3px 4px;
  background: rgba(0,0,0,0.75);
  pointer-events: none;
}
.mosaic-tile:hover .mosaic-tile-overlay {
  background: rgba(0,0,0,0.9);
}
.mosaic-tile-name {
  font-family: var(--font-sans);
  font-size: 0.55rem;
  font-weight: 600;
  line-height: 1.15;
  color: #fff;
  letter-spacing: 0.01em;
}
.mosaic-tile-year {
  font-size: 0.48rem;
  font-weight: 500;
  color: #7dd3fc;
  margin-top: 1px;
  font-family: var(--font-sans);
}

/* Favorite star badge */
.mosaic-fav-star {
  position: absolute;
  top: 2px;
  left: 2px;
  font-size: 0.55rem;
  color: #fbbf24;
  filter: drop-shadow(0 1px 2px rgba(0,0,0,0.8));
  pointer-events: none;
}

/* Read checkmark */
.mosaic-read-check {
  position: absolute;
  top: 2px;
  right: 2px;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: rgba(0,240,255,0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.45rem;
  font-weight: 900;
  color: #000;
  pointer-events: none;
}

/* === ZOOM CONTROLS === */
.zoom-controls {
  display: flex;
  gap: 0;
  border: 1px solid rgba(255,255,255,0.15);
  border-radius: 8px;
  overflow: hidden;
}
.zoom-btn {
  padding: 0.35rem 0.7rem;
  background: transparent;
  border: none;
  color: rgba(255,255,255,0.4);
  font-size: 0.7rem;
  font-weight: 700;
  font-family: var(--font-sans);
  cursor: pointer;
  transition: all 0.15s ease;
}
.zoom-btn:not(:last-child) {
  border-right: 1px solid rgba(255,255,255,0.1);
}
.zoom-btn:hover {
  background: rgba(255,255,255,0.05);
  color: rgba(255,255,255,0.7);
}
.zoom-btn.active {
  background: rgba(255,255,255,0.1);
  color: #fff;
}

/* View Toggle Buttons */
.view-mode-group {
  display: flex;
  gap: 0;
  border: 1px solid rgba(255,255,255,0.15);
  border-radius: 10px;
  overflow: hidden;
}
.view-toggle-btn {
  padding: 0.4rem 0.8rem;
  background: transparent;
  border: none;
  color: rgba(255,255,255,0.4);
  font-size: 0.72rem;
  font-weight: 600;
  font-family: var(--font-sans);
  cursor: pointer;
  transition: all 0.15s ease;
}
.view-toggle-btn:not(:last-child) {
  border-right: 1px solid rgba(255,255,255,0.1);
}
.view-toggle-btn:hover { background: rgba(255,255,255,0.06); color: rgba(255,255,255,0.7); }
.view-toggle-btn.active {
  background: rgba(255,255,255,0.1);
  color: #fff;
}

/* Arm labels in spiral */
.spiral-arm-label {
  position: absolute;
  transform: translate(-50%, -50%);
  font-family: var(--font-display);
  font-size: 0.65rem;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  opacity: 0.5;
  pointer-events: none;
  white-space: nowrap;
  text-shadow: 0 0 10px currentColor;
}

/* === SPIRAL GALAXY === */
.spiral-viewport {
  flex: 1;
  position: relative;
  overflow: hidden;
  background: radial-gradient(ellipse at center, #0a0b18 0%, #020205 70%);
  cursor: grab;
  touch-action: none;
}
.spiral-viewport:active { cursor: grabbing; }

/* Visible count stats */
.spiral-stats {
  position: absolute;
  bottom: 8px;
  right: 12px;
  font-size: 0.6rem;
  color: rgba(255,255,255,0.25);
  font-family: var(--font-sans);
  pointer-events: none;
  z-index: 10;
}

/* Star field background — simplified for perf */
.spiral-viewport::before {
  content: '';
  position: absolute;
  inset: 0;
  background-image:
    radial-gradient(1px 1px at 15% 25%, rgba(255,255,255,0.15), transparent),
    radial-gradient(1px 1px at 75% 42%, rgba(255,255,255,0.12), transparent);
  background-size: 300px 300px;
  pointer-events: none;
  z-index: 0;
}

.spiral-canvas {
  position: absolute;
  top: 0; left: 0;
  width: 100%; height: 100%;
  transform-origin: center center;
  will-change: transform;
}

/* Spiral arm guide lines */
.spiral-arm-line {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 3000px;
  height: 1px;
  transform-origin: 0 0;
  pointer-events: none;
  opacity: 0.4;
}

/* Individual portrait node — perf-optimized */
.spiral-node {
  position: absolute;
  width: 48px;
  height: 48px;
  margin-left: -24px;
  margin-top: -24px;
  text-decoration: none;
  z-index: 2;
  contain: strict;
  content-visibility: auto;
}
.spiral-node:hover {
  z-index: 9999 !important;
}

.spiral-node-img {
  width: 100%;
  height: 100%;
  border-radius: 50%;
  background-size: cover;
  background-position: center;
  background-color: #1a1a2e;
  border: 2px solid var(--tile-color, #64748b);
  pointer-events: auto;
}
.spiral-node:hover .spiral-node-img {
  transform: scale(1.25);
  box-shadow: 0 0 8px var(--tile-color, #64748b);
}

/* Label: always visible as tiny text, bigger on hover */
.spiral-node-label {
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  white-space: nowrap;
  pointer-events: none;
  font-family: var(--font-sans);
  font-size: 0.38rem;
  font-weight: 600;
  color: rgba(255,255,255,0.45);
  text-align: center;
  margin-top: 1px;
  max-width: 56px;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: none;
}
.spiral-node:hover .spiral-node-label {
  font-size: 0.65rem;
  color: #fff;
  background: rgba(0,0,0,0.88);
  border: 1px solid var(--tile-color, #444);
  border-radius: 4px;
  padding: 2px 6px;
  max-width: none;
  overflow: visible;
  z-index: 9999;
  margin-top: 2px;
}

/* Center glow */
.spiral-center {
  position: absolute;
  left: 50%; top: 50%;
  transform: translate(-50%, -50%);
  text-align: center;
  z-index: 5;
  pointer-events: none;
}
.spiral-center-glow {
  position: absolute;
  left: 50%; top: 50%;
  transform: translate(-50%, -50%);
  width: 120px; height: 120px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(0,200,255,0.1) 0%, rgba(160,0,255,0.05) 40%, transparent 70%);
}
.spiral-center span {
  position: relative;
  font-family: var(--font-display);
  font-size: 0.9rem;
  font-weight: 800;
  letter-spacing: 0.15em;
  color: rgba(255,255,255,0.3);
  text-transform: uppercase;
  line-height: 1.4;
}

/* --- READER VIEW --- */
.app-layout {
  max-width: 800px;
  margin: 0 auto;
  padding: 3rem 2rem;
  position: relative;
  z-index: 1;
}

.glass {
  background: rgba(15, 17, 26, 0.7);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid var(--border-glass);
  border-radius: 24px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
}

.reader-nav {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 2rem;
  margin-bottom: 2rem;
  position: sticky;
  top: 1rem;
  z-index: 10;
  border-radius: 100px;
}

.btn-back {
  background: none;
  border: none;
  color: var(--text-muted);
  font-family: var(--font-sans);
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  transition: color 0.2s ease;
}

.btn-back:hover { color: white; }

.category-badge {
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  padding: 0.4rem 1rem;
  border-radius: 20px;
  background: rgba(189, 0, 255, 0.1);
  color: #d8b4fe;
  border: 1px solid rgba(189, 0, 255, 0.3);
}

.reader-content {
  padding: 4rem 3.5rem;
  border-radius: 32px;
  font-size: 1.15rem;
  line-height: 1.8;
  color: #cbd5e1;
}

.reader-content img {
  max-width: 100%;
  max-height: 450px;
  object-fit: cover;
  border-radius: 20px;
  display: block;
  margin: 0 auto 3rem;
  box-shadow: 0 20px 40px rgba(0,0,0,0.5);
  border: 1px solid rgba(255,255,255,0.05);
}

.reader-content h1 {
  font-family: var(--font-display);
  font-size: 3rem;
  margin-bottom: 2.5rem;
  line-height: 1.1;
  color: white;
  letter-spacing: -0.02em;
}

.reader-content h2 {
  font-family: var(--font-display);
  font-size: 2rem;
  margin-top: 4rem;
  margin-bottom: 1.5rem;
  color: var(--accent-cyan);
  border-bottom: 1px solid rgba(255,255,255,0.05);
  padding-bottom: 1rem;
}

.reader-content h3 {
  font-family: var(--font-display);
  font-size: 1.5rem;
  margin-top: 2.5rem;
  margin-bottom: 1rem;
  color: #e2e8f0;
}

.reader-content p { margin-bottom: 1.8rem; }
.reader-content ul { margin-bottom: 1.8rem; padding-left: 1.5rem; }
.reader-content li { margin-bottom: 0.8rem; }
.reader-content strong { color: white; font-weight: 600; }

.wiki-link {
  color: var(--accent-cyan);
  text-decoration: none;
  font-weight: 500;
  border-bottom: 1px dashed rgba(0, 240, 255, 0.4);
  padding-bottom: 2px;
  transition: all 0.2s ease;
}

.wiki-link:hover {
  color: #fff;
  border-bottom-style: solid;
  border-bottom-color: var(--accent-cyan);
  text-shadow: 0 0 10px rgba(0, 240, 255, 0.5);
}

/* Animations */
@keyframes fadeIn {
  from { opacity: 0; filter: blur(10px); }
  to { opacity: 1; filter: blur(0); }
}
.animate-fade-in { animation: fadeIn 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
.animate-slide-up { animation: fadeIn 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards; }

/* Loader */
.loader-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100vh;
}

.spinner {
  width: 60px;
  height: 60px;
  border: 2px solid rgba(255, 255, 255, 0.05);
  border-radius: 50%;
  border-top-color: var(--accent-purple);
  border-right-color: var(--accent-cyan);
  animation: spin 1s cubic-bezier(0.68, -0.55, 0.265, 1.55) infinite;
  margin-bottom: 1.5rem;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}


/* === READING PROGRESS BAR === */
.reading-progress-bar {
  position: fixed;
  top: 0;
  left: 0;
  height: 3px;
  background: linear-gradient(90deg, var(--accent-purple), var(--accent-cyan));
  z-index: 9999;
  transition: width 0.1s linear;
  box-shadow: 0 0 10px rgba(0, 240, 255, 0.5);
}

/* === CUSTOM SCROLLBAR === */
::-webkit-scrollbar {
  width: 8px;
}
::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.2);
}
::-webkit-scrollbar-thumb {
  background: linear-gradient(180deg, rgba(189,0,255,0.4), rgba(0,240,255,0.4));
  border-radius: 4px;
}
::-webkit-scrollbar-thumb:hover {
  background: linear-gradient(180deg, rgba(189,0,255,0.7), rgba(0,240,255,0.7));
}

/* === STATS PANEL === */
.stats-panel {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
  margin-top: 0.5rem;
}
.stat-chip {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.35rem 0.8rem;
  background: rgba(15, 17, 26, 0.6);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 20px;
  font-size: 0.75rem;
  color: rgba(255,255,255,0.6);
  letter-spacing: 0.03em;
}
.stat-chip .stat-value {
  color: var(--accent-cyan);
  font-weight: 700;
}

/* === FAVORITE STAR === */
.fav-btn {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 1.1rem;
  padding: 0;
  line-height: 1;
  transition: transform 0.2s ease, filter 0.2s ease;
  filter: grayscale(100%) brightness(0.5);
}
.fav-btn:hover {
  transform: scale(1.3);
  filter: grayscale(0%) brightness(1);
}
.fav-btn.is-fav {
  filter: grayscale(0%) brightness(1) drop-shadow(0 0 6px rgba(255,200,0,0.6));
}

/* === SCROLL TO TOP === */
.scroll-to-top {
  position: fixed;
  bottom: 2rem;
  right: 2rem;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: rgba(15,17,26,0.8);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(0,240,255,0.3);
  color: var(--accent-cyan);
  font-size: 1.2rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  transition: all 0.3s ease;
  opacity: 0;
  transform: translateY(20px);
  pointer-events: none;
}
.scroll-to-top.visible {
  opacity: 1;
  transform: translateY(0);
  pointer-events: auto;
}
.scroll-to-top:hover {
  background: rgba(0,240,255,0.15);
  border-color: var(--accent-cyan);
  box-shadow: 0 0 20px rgba(0,240,255,0.3);
}

/* === RANDOM BUTTON === */
.random-btn {
  padding: 0.5rem 1rem;
  background: rgba(189,0,255,0.1);
  border: 1px solid rgba(189,0,255,0.3);
  border-radius: 20px;
  color: #d8b4fe;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  font-family: var(--font-sans);
}
.random-btn:hover {
  background: rgba(189,0,255,0.2);
  border-color: rgba(189,0,255,0.6);
  box-shadow: 0 0 15px rgba(189,0,255,0.3);
  transform: translateY(-1px);
}

/* === BLOCKQUOTE STYLING === */
.reader-content blockquote {
  border-left: 3px solid var(--accent-purple);
  padding: 1rem 1.5rem;
  margin: 1.5rem 0;
  background: rgba(189,0,255,0.05);
  border-radius: 0 12px 12px 0;
  font-style: italic;
  color: rgba(255,255,255,0.7);
}

/* === TABLE STYLING === */
.reader-content table {
  width: 100%;
  border-collapse: collapse;
  margin: 1.5rem 0;
}
.reader-content th, .reader-content td {
  padding: 0.6rem 1rem;
  border: 1px solid rgba(255,255,255,0.08);
  text-align: left;
}
.reader-content th {
  background: rgba(189,0,255,0.1);
  font-weight: 600;
  color: var(--accent-cyan);
}
.reader-content tr:nth-child(even) {
  background: rgba(255,255,255,0.02);
}

/* === CODE STYLING === */
.reader-content code {
  background: rgba(0,240,255,0.05);
  padding: 0.15rem 0.4rem;
  border-radius: 4px;
  font-size: 0.9em;
  color: var(--accent-cyan);
  border: 1px solid rgba(0,240,255,0.1);
}
.reader-content pre {
  background: rgba(10,11,16,0.9);
  padding: 1.5rem;
  border-radius: 12px;
  overflow-x: auto;
  border: 1px solid rgba(255,255,255,0.05);
  margin: 1.5rem 0;
}
.reader-content pre code {
  background: none;
  border: none;
  padding: 0;
}

/* === FILTER BAR === */
.filter-bar {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  flex-wrap: wrap;
  margin-top: 0.8rem;
  padding: 0.5rem 0;
}
.filter-select {
  padding: 0.4rem 0.8rem;
  background: rgba(15, 17, 26, 0.7);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 20px;
  color: var(--text-main);
  font-size: 0.8rem;
  font-family: var(--font-sans);
  cursor: pointer;
  outline: none;
  transition: all 0.2s ease;
  appearance: none;
  -webkit-appearance: none;
  padding-right: 1.8rem;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%2364748b' d='M6 8L1 3h10z'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 0.6rem center;
}
.filter-select:focus {
  border-color: var(--accent-cyan);
  box-shadow: 0 0 12px rgba(0,240,255,0.2);
}
.filter-select option {
  background: #0a0b14;
  color: var(--text-main);
}
.filter-toggle {
  padding: 0.35rem 0.8rem;
  background: rgba(15, 17, 26, 0.6);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 20px;
  color: rgba(255,255,255,0.5);
  font-size: 0.78rem;
  font-family: var(--font-sans);
  cursor: pointer;
  transition: all 0.2s ease;
}
.filter-toggle:hover {
  border-color: rgba(255,255,255,0.2);
  color: rgba(255,255,255,0.8);
}
.filter-toggle.active {
  background: rgba(189,0,255,0.15);
  border-color: rgba(189,0,255,0.4);
  color: #d8b4fe;
  box-shadow: 0 0 10px rgba(189,0,255,0.2);
}
.filter-count {
  font-size: 0.72rem;
  color: var(--text-muted);
  margin-left: auto;
  letter-spacing: 0.03em;
}

/* === TABLE OF CONTENTS === */
.toc-toggle {
  background: rgba(15,17,26,0.8);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(0,240,255,0.2);
  border-radius: 8px;
  color: var(--accent-cyan);
  font-size: 0.75rem;
  padding: 0.3rem 0.7rem;
  cursor: pointer;
  transition: all 0.2s ease;
  font-family: var(--font-sans);
  white-space: nowrap;
}
.toc-toggle:hover {
  background: rgba(0,240,255,0.1);
  border-color: var(--accent-cyan);
}
.toc-panel {
  position: fixed;
  top: 0;
  right: -320px;
  width: 300px;
  height: 100vh;
  background: rgba(10,11,16,0.95);
  backdrop-filter: blur(20px);
  border-left: 1px solid rgba(255,255,255,0.08);
  z-index: 2000;
  transition: right 0.35s cubic-bezier(0.16, 1, 0.3, 1);
  display: flex;
  flex-direction: column;
  box-shadow: -10px 0 40px rgba(0,0,0,0.5);
}
.toc-panel.open {
  right: 0;
}
.toc-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.2rem 1.5rem;
  border-bottom: 1px solid rgba(255,255,255,0.06);
}
.toc-header h3 {
  font-family: var(--font-display);
  font-size: 1rem;
  font-weight: 700;
  color: var(--accent-cyan);
  margin: 0;
}
.toc-close {
  background: none;
  border: none;
  color: var(--text-muted);
  font-size: 1.2rem;
  cursor: pointer;
  padding: 0.2rem;
  transition: color 0.2s;
}
.toc-close:hover { color: white; }
.toc-list {
  flex: 1;
  overflow-y: auto;
  padding: 1rem 0;
}
.toc-item {
  display: block;
  width: 100%;
  background: none;
  border: none;
  text-align: left;
  padding: 0.5rem 1.5rem;
  color: rgba(255,255,255,0.6);
  font-size: 0.82rem;
  font-family: var(--font-sans);
  cursor: pointer;
  transition: all 0.15s ease;
  line-height: 1.4;
  border-left: 2px solid transparent;
}
.toc-item:hover {
  color: white;
  background: rgba(255,255,255,0.03);
  border-left-color: var(--accent-cyan);
}
.toc-item.level-3 {
  padding-left: 2.5rem;
  font-size: 0.78rem;
  color: rgba(255,255,255,0.45);
}

/* === RELATED MONOGRAPHS === */
.related-section {
  margin-top: 3rem;
  padding-top: 2rem;
  border-top: 1px solid rgba(255,255,255,0.06);
}
.related-title {
  font-family: var(--font-display);
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  margin-bottom: 1.2rem;
}
.related-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 0.8rem;
}
.related-card {
  display: flex;
  flex-direction: column;
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 12px;
  overflow: hidden;
  text-decoration: none;
  color: #fff;
  transition: all 0.25s ease;
}
.related-card:hover {
  transform: translateY(-3px);
  border-color: rgba(189,0,255,0.4);
  box-shadow: 0 8px 25px rgba(0,0,0,0.4);
}
.related-card-img {
  width: 100%;
  aspect-ratio: 1;
  background-size: cover;
  background-position: center top;
  background-color: rgba(189,0,255,0.1);
}
.related-card-info {
  padding: 0.5rem 0.6rem;
}
.related-card-title {
  font-size: 0.78rem;
  font-weight: 600;
  line-height: 1.3;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

/* === ALPHABET INDEX === */
.alpha-index {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
  margin-bottom: 1.5rem;
  padding: 0.6rem;
  background: rgba(15,17,26,0.5);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255,255,255,0.06);
  border-radius: 16px;
}
.alpha-letter {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  background: none;
  border: none;
  color: var(--text-muted);
  font-size: 0.72rem;
  font-weight: 600;
  font-family: var(--font-sans);
  cursor: pointer;
  transition: all 0.15s ease;
}
.alpha-letter:hover {
  background: rgba(189,0,255,0.15);
  color: white;
}
.alpha-letter.has-items {
  color: rgba(255,255,255,0.7);
}
.alpha-letter.active {
  background: rgba(0,240,255,0.15);
  color: var(--accent-cyan);
  border: 1px solid rgba(0,240,255,0.3);
}

/* === ENHANCED MOBILE === */
@media (max-width: 768px) {
  .hud-title { font-size: 1.8rem; }
  .spiral-center-node { width: 120px; height: 120px; }
  .center-title { font-size: 1rem; }
  .reader-content { padding: 1.8rem 1.2rem; }
  .reader-content h1 { font-size: 1.8rem; }
  .reader-content h2 { font-size: 1.4rem; margin-top: 2.5rem; }
  .reader-content h3 { font-size: 1.15rem; }
  .reader-content { font-size: 1rem; line-height: 1.7; }
  .reader-nav { padding: 0.6rem 1rem; border-radius: 16px; }
  .category-badge { font-size: 0.65rem; padding: 0.3rem 0.6rem; }
  .filter-bar { gap: 0.4rem; }
  .filter-select, .filter-toggle { font-size: 0.72rem; padding: 0.3rem 0.6rem; }
  .stats-panel { gap: 0.4rem; }
  .stat-chip { font-size: 0.65rem; padding: 0.25rem 0.5rem; }
  .search-bar-hud input { padding: 0.7rem 1rem; font-size: 0.95rem; }
  .toc-panel { width: 260px; }
  .related-grid { grid-template-columns: repeat(2, 1fr); }
  .alpha-index { gap: 0.2rem; }
  .alpha-letter { width: 24px; height: 24px; font-size: 0.65rem; }
  .view-toggle { gap: 0.3rem !important; }
}
@media (max-width: 480px) {
  .hud-title { font-size: 1.4rem; margin-bottom: 0.5rem; }
  .reader-content { padding: 1.2rem 0.8rem; }
  .reader-content h1 { font-size: 1.5rem; }
  .related-grid { grid-template-columns: repeat(2, 1fr); gap: 0.5rem; }
  .toc-panel { width: 100vw; }
}

/* === EXTERNAL LINK STYLING === */
.external-link {
  color: #a78bfa;
  text-decoration: none;
  border-bottom: 1px dotted rgba(167,139,250,0.4);
  transition: all 0.2s ease;
}
.external-link:hover {
  color: #c4b5fd;
  border-bottom-style: solid;
}

/* === TOC OVERLAY BACKDROP === */
.toc-backdrop {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.5);
  z-index: 1999;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.3s ease;
}
.toc-backdrop.open {
  opacity: 1;
  pointer-events: auto;
}


```

