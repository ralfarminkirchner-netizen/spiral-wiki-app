import { Routes, Route, Link, useParams, useNavigate } from 'react-router-dom';
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

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

interface DashboardProps {
  data: Monograph[];
  readMonographs: string[];
  viewMode: 'galaxy' | 'wiki';
  setViewMode: (mode: 'galaxy' | 'wiki') => void;
}

function Dashboard({ data, readMonographs, viewMode, setViewMode }: DashboardProps) {
  const [search, setSearch] = useState('');
  const viewportRef = useRef<HTMLDivElement>(null);
  
  // Pan and Zoom State
  const [scale, setScale] = useState(0.08); // Start zoomed out to see all
  const positionRef = useRef({ x: 0, y: 0 });
  const [cullPosition, setCullPosition] = useState({ x: 0, y: 0 });
  const canvasRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });

  // 1. Data Processing
  const { globalMinYear, globalMaxYear, processedData } = useMemo(() => {
    let minYear = 9999;
    let maxYear = -9999;

    const pData = data.map(item => {
      const parts = item.category ? item.category.split(' / ') : ['Uncategorized'];
      const topCategory = parts[0];
      const subCategory = parts.length > 1 ? parts[1] : topCategory;
      
      let year = 9999;
      const yearMatch = item.content.match(/\(\*?\s*(\d{4})/);
      if (yearMatch && yearMatch[1]) {
        year = parseInt(yearMatch[1], 10);
      } else {
         const titleYearMatch = item.title.match(/\(\*?\s*(\d{4})/);
         if (titleYearMatch && titleYearMatch[1]) {
            year = parseInt(titleYearMatch[1], 10);
         }
      }
      
      if (year !== 9999) {
        if (year < minYear) minYear = year;
        if (year > maxYear) maxYear = year;
      }

      let finalImageUrl = item.imageUrl || null;
      if (!finalImageUrl) {
        const imgMatch = item.content.match(/!\[.*?\]\((.*?)\)/);
        if (imgMatch && imgMatch[1]) {
          finalImageUrl = imgMatch[1];
        }
      }

      // Fallback: person-specific images for entries missing portraits
      if (!finalImageUrl) {
        const PERSON_IMAGES: Record<string, string> = {
          'ken_wilber': 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5a/Ken_Wilber_10.JPG/440px-Ken_Wilber_10.JPG',
          'donald_hoffman': 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4a/Donald_Hoffman.jpg/440px-Donald_Hoffman.jpg',
          'stanislav_grof': 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a2/Stanislav_Grof%2C_MD.jpg/440px-Stanislav_Grof%2C_MD.jpg',
          'andrei_tarkowski': 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a0/Andrei_Tarkovsky.jpg/440px-Andrei_Tarkovsky.jpg',
        };
        for (const [key, url] of Object.entries(PERSON_IMAGES)) {
          if (item.id.includes(key)) {
            finalImageUrl = url;
            break;
          }
        }
      }

      // (Removed category fallback for individual items so they don't get generic images)

      return {
        ...item,
        topCategory,
        subCategory,
        year,
        finalImageUrl,
        cleanTitle: cleanTitleText(item.title)
      };
    });

    return { globalMinYear: minYear, globalMaxYear: maxYear, processedData: pData };
  }, [data]);

  const filteredData = useMemo(() => {
    return processedData.filter(d => 
      d.title.toLowerCase().includes(search.toLowerCase()) || 
      d.category.toLowerCase().includes(search.toLowerCase())
    );
  }, [processedData, search]);

  // 2. Multi-Arm Galaxy Layout & Culling
  const isSearching = search.trim().length > 0;
  const showGrid = isSearching || viewMode === 'wiki';
  const displayData = showGrid && !isSearching ? processedData : filteredData;
  
  const { macroNodes, mesoNodes, microNodes } = useMemo(() => {
    const itemsToProcess = isSearching ? filteredData : processedData;
    
    const catGroups: Record<string, typeof itemsToProcess> = {};
    itemsToProcess.forEach(d => {
      if (!catGroups[d.topCategory]) catGroups[d.topCategory] = [];
      catGroups[d.topCategory].push(d);
    });

    const sortedCategories = Object.keys(catGroups).sort();
    const N_arms = sortedCategories.length || 1;
    
    const macros: any[] = [];
    const mesos: any[] = [];
    const micros: any[] = [];

    const b = 800; // Adjusted for proper arc length

    sortedCategories.forEach((cat, index) => {
      const armAngle = index * ((2 * Math.PI) / N_arms);
      const catItems = catGroups[cat];
      const readCount = catItems.filter(item => readMonographs.includes(item.id)).length;
      const progress = catItems.length > 0 ? Math.round((readCount / catItems.length) * 100) : 0;

      let s = 600; // Start at the core but with enough radius to prevent overlap

      const placeNode = (paddingBefore: number, paddingAfter: number) => {
        s += paddingBefore;
        const theta = Math.sqrt((2 * s) / b);
        const r = b * theta;
        const x = r * Math.cos(armAngle + theta);
        const y = r * Math.sin(armAngle + theta);
        s += paddingAfter;
        return { x, y };
      };

      const pos = placeNode(200, 400); // Give enough padding so macros form a distinct ring
      macros.push({
        type: 'top-category',
        name: cat,
        id: `cat-${cat}`,
        x: pos.x,
        y: pos.y,
        progress,
        bgUrl: getCatImage(cat)
      });

      const subCats = Array.from(new Set(catItems.map(d => d.subCategory))).sort();

      subCats.forEach((subCat) => {
        const subItems = catItems.filter(d => d.subCategory === subCat).sort((a, b) => a.year - b.year);
        
        const subPos = placeNode(600, 400);
        mesos.push({
          type: 'sub-category',
          name: subCat,
          id: `subcat-${cat}-${subCat}`,
          x: subPos.x,
          y: subPos.y,
          bgUrl: getCatImage(subCat)
        });

        subItems.forEach(item => {
          const itemPos = placeNode(250, 250); // Generous spacing for items
          micros.push({
            type: 'item',
            item,
            id: item.id,
            x: itemPos.x,
            y: itemPos.y
          });
        });
      });
    });

    return { macroNodes: macros, mesoNodes: mesos, microNodes: micros };
  }, [processedData, filteredData, isSearching, readMonographs]);

  const visibleNodes = useMemo(() => {
    if (showGrid) return []; // Don't calculate if grid is shown

    const macroOpacity = 1; 
    const mesoOpacity = Math.max(0, Math.min(1, (scale - 0.04) / 0.04));
    const microOpacity = Math.max(0, Math.min(1, (scale - 0.10) / 0.08));

    const viewportWidth = window.innerWidth || 1920;
    const viewportHeight = window.innerHeight || 1080;
    
    // Reverse math from the transform to find exactly what's on screen
    const canvasLeft = -cullPosition.x / scale - viewportWidth / 2 / scale;
    const canvasRight = canvasLeft + viewportWidth / scale;
    const canvasTop = -cullPosition.y / scale - viewportHeight / 2 / scale;
    const canvasBottom = canvasTop + viewportHeight / scale;
    
    // Tight buffer to strictly cull off-screen nodes and fix GPU stuttering
    const buffer = 500 / Math.max(0.01, scale); 

    const isVisible = (x: number, y: number) => {
       return x >= canvasLeft - buffer && x <= canvasRight + buffer &&
              y >= canvasTop - buffer && y <= canvasBottom + buffer;
    };

    const activeNodes: any[] = [];
    
    // Calculate opacity thresholds directly here for early exit
    const mOpacity = Math.max(0, Math.min(1, (scale - 0.04) / 0.04));
    const uOpacity = Math.max(0, Math.min(1, (scale - 0.10) / 0.08));

    macroNodes.forEach(n => {
      if (isVisible(n.x, n.y)) activeNodes.push(n);
    });
    
    // LOD Culling: Only add meso/micro nodes to the DOM if they are actually visible
    if (mOpacity > 0) {
      mesoNodes.forEach(n => {
        if (isVisible(n.x, n.y)) activeNodes.push(n);
      });
    }
    
    if (uOpacity > 0) {
      microNodes.forEach(n => {
        if (isVisible(n.x, n.y)) activeNodes.push(n);
      });
    }
    
    return activeNodes;
  }, [macroNodes, mesoNodes, microNodes, scale, cullPosition, showGrid]);

  const macroOpacity = 1; 
  const mesoOpacity = Math.max(0, Math.min(1, (scale - 0.04) / 0.04));
  const microOpacity = Math.max(0, Math.min(1, (scale - 0.10) / 0.08));

  const sortedCategories = useMemo(() => {
    const cats = new Set<string>();
    processedData.forEach(d => cats.add(d.topCategory));
    return Array.from(cats).sort();
  }, [processedData]);

  // Pan / Zoom Handlers — zoom toward mouse cursor for natural feel
  const handleWheel = (e: React.WheelEvent) => {
    const factor = e.deltaY > 0 ? 0.90 : 1.10;
    const newScale = Math.min(Math.max(0.03, scale * factor), 5);
    
    // Zoom toward cursor position
    const rect = viewportRef.current?.getBoundingClientRect();
    if (rect) {
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      
      const worldX = (mouseX - rect.width / 2 - positionRef.current.x) / scale;
      const worldY = (mouseY - rect.height / 2 - positionRef.current.y) / scale;
      
      const newPosX = mouseX - rect.width / 2 - worldX * newScale;
      const newPosY = mouseY - rect.height / 2 - worldY * newScale;
      
      positionRef.current = { x: newPosX, y: newPosY };
      setCullPosition({ x: newPosX, y: newPosY });
      setScale(newScale);
      
      if (canvasRef.current) {
         canvasRef.current.style.transform = `translate(calc(50vw + ${positionRef.current.x}px), calc(50vh + ${positionRef.current.y}px)) scale(${newScale})`;
      }
    }
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    // Only drag on left click (button 0) to allow right click context menus, etc.
    if (e.button !== 0) return;
    
    // Check if the user clicked on a link
    const target = e.target as HTMLElement;
    if (target.closest('a') || target.closest('button')) {
      return; // Do not start panning if clicking a link!
    }
    
    isDragging.current = true;
    dragStart.current = {
      x: e.clientX - positionRef.current.x,
      y: e.clientY - positionRef.current.y
    };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (isDragging.current) {
      const newX = e.clientX - dragStart.current.x;
      const newY = e.clientY - dragStart.current.y;
      positionRef.current = { x: newX, y: newY };
      
      if (canvasRef.current) {
        canvasRef.current.style.transform = `translate(calc(50vw + ${newX}px), calc(50vh + ${newY}px)) scale(${scale})`;
      }
      // Removed rapid setCullPosition here to prevent React from re-rendering the 2000 nodes while panning.
      // This guarantees hardware-accelerated 60 FPS performance.
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (isDragging.current) {
      isDragging.current = false;
      // Only update cull position when user STOPS panning
      setCullPosition({ x: positionRef.current.x, y: positionRef.current.y });
    }
  };

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden', touchAction: 'none' }}>
      
      {/* --- HUD OVERLAY (Fixed) --- */}
      <div className="hud-overlay" style={{ pointerEvents: 'none' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100vw', paddingRight: '2rem' }}>
          <div>
            <h1 className="hud-title hud-interactive" style={{ pointerEvents: 'auto' }}>SPiRAL MiND WiKi</h1>
            
            <div className="search-bar-hud hud-interactive" style={{ pointerEvents: 'auto' }}>
              <input 
                type="text" 
                placeholder="Suche im kybernetischen Netz..." 
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          </div>
          
          <div className="view-toggle hud-interactive" style={{ pointerEvents: 'auto' }}>
            <button 
              className="glass"
              style={{ padding: '0.6rem 1.2rem', color: '#fff', cursor: 'pointer', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '12px', fontSize: '0.9rem', fontWeight: 600, boxShadow: '0 4px 15px rgba(0,0,0,0.3)', backdropFilter: 'blur(12px)', transition: 'all 0.2s ease' }}
              onClick={() => setViewMode(viewMode === 'galaxy' ? 'wiki' : 'galaxy')}
            >
              {viewMode === 'galaxy' ? '→ Listenansicht' : '→ Spiralansicht'}
            </button>
          </div>
        </div>
      </div>

      {/* --- GALAXY VIEWPORT (Pan/Zoom) --- */}
      {!showGrid ? (
        <div 
          className="spiral-viewport animate-fade-in" 
          ref={viewportRef}
          onWheel={handleWheel}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          style={{ cursor: isDragging.current ? 'grabbing' : 'grab' }}
        >
          <div 
            ref={canvasRef}
            className="spiral-canvas" 
            style={{ 
              width: '0px', height: '0px',
              transform: `translate(calc(50vw + ${positionRef.current.x}px), calc(50vh + ${positionRef.current.y}px)) scale(${scale})`,
              transformOrigin: '0 0'
            }}
          >
            
            {/* No center text — the thinkers' faces ARE the bright core */}

            {/* Galaxy Nodes — only visible nodes are in the DOM */}
            {visibleNodes.map(node => {
              let currentOpacity = macroOpacity;
              if (node.type === 'sub-category') currentOpacity = mesoOpacity;
              if (node.type === 'item') currentOpacity = microOpacity;

              if (node.type === 'top-category') {
                return (
                  <div 
                    key={node.id} 
                    className="node-positioner"
                    style={{ 
                      transform: `translate(${node.x}px, ${node.y}px)`,
                      opacity: currentOpacity,
                      transition: 'opacity 0.2s ease-in-out'
                    }}
                  >
                    <div 
                      className="orbital-node node-cat" 
                      style={{ 
                        transform: 'translate(-50%, -50%) scale(3.5)', 
                        backgroundImage: `linear-gradient(rgba(10, 11, 20, 0.4), rgba(10, 11, 20, 0.6)), url(${node.bgUrl})`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                        border: '2px solid rgba(189,0,255,0.8)',
                        boxShadow: '0 0 40px rgba(189,0,255,0.5)'
                      }}
                    >
                      <span style={{ fontSize: '1.2rem', fontWeight: '800', textShadow: '0 2px 6px rgba(0,0,0,0.9), 0 0 10px rgba(0,0,0,0.8)', textAlign: 'center' }}>
                        {node.name.replace(/_/g, ' ')}<br/>
                        <span style={{fontSize:'0.6rem', color: '#fff', textShadow: '0 1px 3px #000'}}>{node.progress}% gelesen</span>
                      </span>
                    </div>
                  </div>
                );
              }

              if (node.type === 'sub-category') {
                return (
                  <div 
                    key={node.id} 
                    className="node-positioner"
                    style={{ 
                      transform: `translate(${node.x}px, ${node.y}px)`,
                      opacity: currentOpacity,
                      transition: 'opacity 0.2s ease-in-out'
                    }}
                  >
                    <div 
                      className="orbital-node node-cat" 
                      style={{ 
                        transform: 'translate(-50%, -50%) scale(2.5)',
                        backgroundImage: `linear-gradient(rgba(10, 11, 20, 0.4), rgba(10, 11, 20, 0.6)), url(${node.bgUrl})`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                        border: '2px solid rgba(0,255,255,0.6)',
                        boxShadow: '0 0 25px rgba(0,255,255,0.4)'
                      }}
                    >
                      <span style={{ fontSize: '0.8rem', fontWeight: '800', textShadow: '0 2px 4px rgba(0,0,0,0.9)', textAlign: 'center' }}>
                        {node.name.replace(/_/g, ' ')}
                      </span>
                    </div>
                  </div>
                );
              }

              // Individual Monograph (type === 'item')
              const isRead = readMonographs.includes(node.item.id);
              
              return (
                <div 
                  key={node.id} 
                  className="node-positioner"
                  style={{ 
                    transform: `translate(${node.x}px, ${node.y}px) scale(1.6)`,
                    opacity: currentOpacity,
                    transition: 'opacity 0.2s ease-in-out'
                  }}
                >
                  <Link 
                    to={`/monograph/${node.item.id}`} 
                    className={`orbital-node node-item ${isRead ? 'read' : ''}`}
                    style={{ backgroundImage: node.item.finalImageUrl ? `url(${node.item.finalImageUrl})` : 'none' }}
                  >
                    {!node.item.finalImageUrl && <span className="node-icon">◆</span>}
                  </Link>
                  <div className="node-label" style={{ fontSize: '0.8rem', marginTop: '0.5rem' }}>
                    {node.item.cleanTitle}
                    {node.item.year !== 9999 && <div className="node-label-year" style={{ fontSize: '0.7rem' }}>{node.item.year}</div>}
                  </div>
                </div>
              );
            })}

          </div>
        </div>
      ) : (
        <div className="wiki-view-container animate-fade-in" style={{
          position: 'absolute', top: 0, left: 0, width: '100vw', height: '100vh',
          paddingTop: '7rem', paddingBottom: '2rem', overflowY: 'auto',
          background: 'var(--bg-dark)'
        }}>
          <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '0 1.5rem' }}>
            {/* Category Sections */}
            {sortedCategories.map(cat => {
              const catItems = displayData.filter(d => d.topCategory === cat);
              if (catItems.length === 0) return null;
              const subCats = Array.from(new Set(catItems.map(d => d.subCategory))).sort();
              const readCount = catItems.filter(item => readMonographs.includes(item.id)).length;
              const progress = catItems.length > 0 ? Math.round((readCount / catItems.length) * 100) : 0;

              return (
                <div key={cat} style={{ marginBottom: '2.5rem' }}>
                  {/* Category Header */}
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '1rem',
                    marginBottom: '1rem', paddingBottom: '0.8rem',
                    borderBottom: '1px solid rgba(189,0,255,0.3)'
                  }}>
                    <div style={{
                      width: '48px', height: '48px', borderRadius: '12px',
                      backgroundImage: `url(${getCatImage(cat)})`,
                      backgroundSize: 'cover', backgroundPosition: 'center',
                      border: '2px solid rgba(189,0,255,0.6)',
                      boxShadow: '0 0 15px rgba(189,0,255,0.3)',
                      flexShrink: 0
                    }} />
                    <div style={{ flex: 1 }}>
                      <h2 style={{
                        fontSize: '1.3rem', fontWeight: 800, color: '#fff',
                        letterSpacing: '0.02em', margin: 0
                      }}>{cat.replace(/_/g, ' ')}</h2>
                      <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)', marginTop: '2px' }}>
                        {catItems.length} Einträge · {progress}% gelesen
                      </div>
                    </div>
                    {/* Progress bar */}
                    <div style={{
                      width: '120px', height: '4px', borderRadius: '2px',
                      background: 'rgba(255,255,255,0.1)', overflow: 'hidden', flexShrink: 0
                    }}>
                      <div style={{
                        width: `${progress}%`, height: '100%',
                        background: 'linear-gradient(90deg, rgba(189,0,255,0.8), rgba(0,240,255,0.8))',
                        borderRadius: '2px', transition: 'width 0.5s ease'
                      }} />
                    </div>
                  </div>

                  {/* SubCategory Groups */}
                  {subCats.map(subCat => {
                    const subItems = catItems.filter(d => d.subCategory === subCat).sort((a, b) => a.year - b.year);
                    if (subItems.length === 0) return null;

                    return (
                      <div key={subCat} style={{ marginBottom: '1.5rem' }}>
                        <h3 style={{
                          fontSize: '0.85rem', fontWeight: 600, color: 'rgba(0,240,255,0.8)',
                          letterSpacing: '0.08em', textTransform: 'uppercase',
                          margin: '0 0 0.6rem 0.3rem'
                        }}>{subCat.replace(/_/g, ' ')}</h3>

                        {/* Item Grid */}
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                          gap: '0.8rem'
                        }}>
                          {subItems.map(item => {
                            const isRead = readMonographs.includes(item.id);
                            return (
                              <Link to={`/monograph/${item.id}`} key={item.id} style={{
                                display: 'flex', flexDirection: 'column',
                                background: isRead ? 'rgba(0,240,255,0.04)' : 'rgba(255,255,255,0.03)',
                                border: `1px solid ${isRead ? 'rgba(0,240,255,0.15)' : 'rgba(255,255,255,0.06)'}`,
                                borderRadius: '12px', overflow: 'hidden',
                                textDecoration: 'none', color: '#fff',
                                transition: 'all 0.2s ease',
                              }}
                              onMouseEnter={e => {
                                (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)';
                                (e.currentTarget as HTMLElement).style.boxShadow = '0 8px 25px rgba(0,0,0,0.4)';
                                (e.currentTarget as HTMLElement).style.borderColor = 'rgba(189,0,255,0.4)';
                              }}
                              onMouseLeave={e => {
                                (e.currentTarget as HTMLElement).style.transform = 'none';
                                (e.currentTarget as HTMLElement).style.boxShadow = 'none';
                                (e.currentTarget as HTMLElement).style.borderColor = isRead ? 'rgba(0,240,255,0.15)' : 'rgba(255,255,255,0.06)';
                              }}>
                                {/* Portrait */}
                                <div style={{
                                  width: '100%', aspectRatio: '1', 
                                  backgroundImage: `url(${item.finalImageUrl})`,
                                  backgroundSize: 'cover', backgroundPosition: 'center top',
                                  backgroundColor: 'rgba(189,0,255,0.1)',
                                  position: 'relative'
                                }}>
                                  {isRead && <div style={{
                                    position: 'absolute', top: '6px', right: '6px',
                                    width: '20px', height: '20px', borderRadius: '50%',
                                    background: 'rgba(0,240,255,0.8)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: '0.6rem', fontWeight: 900
                                  }}>✓</div>}
                                </div>
                                {/* Info */}
                                <div style={{ padding: '0.6rem 0.7rem' }}>
                                  <div style={{
                                    fontSize: '0.85rem', fontWeight: 700,
                                    lineHeight: 1.3, marginBottom: '0.2rem',
                                    overflow: 'hidden', textOverflow: 'ellipsis',
                                    display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any
                                  }}>{item.cleanTitle}</div>
                                  {item.year !== 9999 && (
                                    <div style={{ fontSize: '0.7rem', color: 'rgba(0,240,255,0.7)' }}>{item.year}</div>
                                  )}
                                </div>
                              </Link>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
            {displayData.length === 0 && (
              <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '4rem 2rem', fontSize: '1.1rem' }}>
                Keine Einträge gefunden.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

interface ReaderProps {
  data: Monograph[];
  markAsRead: (id: string) => void;
}

function MonographReader({ data, markAsRead }: ReaderProps) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const monograph = data.find(d => d.id === id);

  useEffect(() => {
    if (id && monograph) {
      markAsRead(id);
    }
  }, [id, monograph, markAsRead]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [id]);

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

  return (
    <div style={{ background: 'var(--bg-dark)', minHeight: '100vh' }}>
      <div className="app-layout">
        <div className="reader-wrapper animate-slide-up">
          <nav className="reader-nav glass">
            <button className="btn-back" onClick={() => navigate(-1)}>
              <span style={{ fontSize: '1.2rem', color: 'var(--accent-cyan)' }}>←</span> Zurück
            </button>
            <span className="category-badge">{monograph.category.split(' / ').pop()?.replace(/_/g, ' ')}</span>
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
                }
              }}
            >
              {monograph.content}
            </ReactMarkdown>
          </article>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [data, setData] = useState<Monograph[]>([]);
  const [loading, setLoading] = useState(true);
  const [readMonographs, setReadMonographs] = useLocalStorage<string[]>('spiral-wiki-read', []);
  const [viewMode, setViewMode] = useLocalStorage<'galaxy' | 'wiki'>('spiral-view-mode', 'galaxy');

  const markAsRead = useCallback((id: string) => {
    setReadMonographs(prev => {
      if (!prev.includes(id)) {
        return [...prev, id];
      }
      return prev;
    });
  }, [setReadMonographs]);

  useEffect(() => {
    fetch('/data.json')
      .then(res => res.json())
      .then(json => {
        // Smart Deduplication: Keep the version with an image if possible
        const uniqueDataMap = new Map();
        for (const item of json) {
          if (uniqueDataMap.has(item.id)) {
            const existing = uniqueDataMap.get(item.id);
            const hasImg = !!item.imageUrl || (item.content && item.content.includes("!["));
            const existingHasImg = !!existing.imageUrl || (existing.content && existing.content.includes("!["));
            
            // Override if new has image and existing doesn't, or if both don't but new is longer
            if ((hasImg && !existingHasImg) || (!existingHasImg && item.content?.length > existing.content?.length)) {
              uniqueDataMap.set(item.id, item);
            }
          } else {
            uniqueDataMap.set(item.id, item);
          }
        }
        setData(Array.from(uniqueDataMap.values()));
        setLoading(false);
      })
      .catch(err => {
        console.error("Failed to load wiki data", err);
        setLoading(false);
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
      <Route path="/" element={<Dashboard data={data} readMonographs={readMonographs} viewMode={viewMode} setViewMode={setViewMode} />} />
      <Route path="/monograph/:id" element={<MonographReader data={data} markAsRead={markAsRead} />} />
    </Routes>
  );
}
