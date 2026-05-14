import { Routes, Route, Link, useParams, useNavigate } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
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

interface DashboardProps {
  data: Monograph[];
  readMonographs: string[];
}

function Dashboard({ data, readMonographs }: DashboardProps) {
  const [search, setSearch] = useState('');
  const viewportRef = useRef<HTMLDivElement>(null);

  // 1. Data Processing
  const processedData = data.map(item => {
    const topCategory = item.category ? item.category.split(' / ')[0] : 'Uncategorized';
    
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

    let finalImageUrl = item.imageUrl || null;
    if (!finalImageUrl) {
      const imgMatch = item.content.match(/!\[.*?\]\((.*?)\)/);
      if (imgMatch && imgMatch[1]) {
        finalImageUrl = imgMatch[1];
      }
    }

    return {
      ...item,
      topCategory,
      year,
      finalImageUrl,
      cleanTitle: cleanTitleText(item.title)
    };
  });

  const filteredData = processedData.filter(d => 
    d.title.toLowerCase().includes(search.toLowerCase()) || 
    d.category.toLowerCase().includes(search.toLowerCase())
  );

  // 2. Galaxy Math
  const isSearching = search.trim().length > 0;
  const itemsToProcess = isSearching ? filteredData : processedData;
  
  const categories = Array.from(new Set(itemsToProcess.map(d => d.topCategory))).sort();
  const N_cats = categories.length || 1;
  
  let maxR = 0;
  const nodes: any[] = [];
  
  categories.forEach((cat, catIndex) => {
    const alpha = catIndex * ((2 * Math.PI) / N_cats);
    const catItems = itemsToProcess.filter(d => d.topCategory === cat).sort((a, b) => a.year - b.year);
    
    const readCount = catItems.filter(item => readMonographs.includes(item.id)).length;
    const progress = catItems.length > 0 ? Math.round((readCount / catItems.length) * 100) : 0;

    // Category Node
    nodes.push({
      isCategory: true,
      name: cat,
      id: `cat-${cat}`,
      x: 500 * Math.cos(alpha),
      y: 500 * Math.sin(alpha),
      progress
    });

    // Item Nodes
    catItems.forEach((item, i) => {
      const idx = i + 1;
      const r_base = 650;
      const b_r = 100;
      const r = r_base + b_r * idx;
      
      if (r > maxR) maxR = r;
      
      const b_theta = 0.12;
      const theta = alpha + b_theta * idx;

      const x = r * Math.cos(theta);
      const y = r * Math.sin(theta);

      nodes.push({
        isCategory: false,
        item,
        id: item.id,
        x,
        y
      });
    });
  });

  const canvasSize = Math.max(4000, maxR * 2 + 2000);

  // Auto-Center Canvas on Mount
  useEffect(() => {
    if (viewportRef.current) {
      const v = viewportRef.current;
      v.scrollLeft = (canvasSize - v.clientWidth) / 2;
      v.scrollTop = (canvasSize - v.clientHeight) / 2;
    }
  }, [canvasSize]);

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden' }}>
      
      {/* --- HUD OVERLAY (Fixed) --- */}
      <div className="hud-overlay">
        <h1 className="hud-title hud-interactive">SPiRAL MiND V3</h1>
        <div className="hud-subtitle" style={{ color: 'var(--accent-pink)', letterSpacing: '2px', fontSize: '0.9rem', marginBottom: '1rem' }}>CHRONOLOGICAL GALAXY</div>
        
        <div className="search-bar-hud hud-interactive">
          <input 
            type="text" 
            placeholder="Suche im kybernetischen Netz..." 
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* --- GALAXY VIEWPORT (Scrollable) --- */}
      {!isSearching ? (
        <div className="spiral-viewport animate-fade-in" ref={viewportRef}>
          <div className="spiral-canvas" style={{ width: `${canvasSize}px`, height: `${canvasSize}px` }}>
            
            {/* The Central Orb */}
            <div className="spiral-center-node" style={{ transform: 'translate(-50%, -50%)', top: '50%', left: '50%', cursor: 'default' }}>
              <div className="center-title">THE MATRIX</div>
            </div>

            {/* Galaxy Nodes */}
            {nodes.map(node => {
              if (node.isCategory) {
                return (
                  <div 
                    key={node.id} 
                    className="node-positioner node-pulse"
                    style={{ transform: `translate(${node.x}px, ${node.y}px)` }}
                  >
                    <div className="orbital-node node-cat" style={{ transform: 'translate(-50%, -50%) scale(1.3)' }}>
                      <span>{node.name.replace(/_/g, ' ')}<br/>({node.progress}%)</span>
                    </div>
                  </div>
                );
              }

              const isRead = readMonographs.includes(node.item.id);
              
              return (
                <div 
                  key={node.id} 
                  className="node-positioner node-pulse-item"
                  style={{ transform: `translate(${node.x}px, ${node.y}px)` }}
                >
                  <Link 
                    to={`/monograph/${node.item.id}`} 
                    className={`orbital-node node-item ${isRead ? 'read' : ''}`}
                    style={{ backgroundImage: node.item.finalImageUrl ? `url(${node.item.finalImageUrl})` : 'none' }}
                  >
                    {!node.item.finalImageUrl && <span className="node-icon">◆</span>}
                  </Link>
                  <div className="node-label">
                    {node.item.cleanTitle}
                    {node.item.year !== 9999 && <div className="node-label-year">{node.item.year}</div>}
                  </div>
                </div>
              );
            })}

          </div>
        </div>
      ) : (
        /* --- SEARCH RESULTS FALLBACK GRID --- */
        <div className="search-results-overlay animate-fade-in hud-interactive">
          <div className="search-grid">
            {filteredData.map(item => (
              <Link to={`/monograph/${item.id}`} key={item.id} className="search-card">
                {item.finalImageUrl ? (
                  <img src={item.finalImageUrl} alt="" style={{width: 40, height: 40, borderRadius: 8, objectFit: 'cover'}} />
                ) : (
                  <div style={{width: 40, height: 40, borderRadius: 8, background: 'rgba(189,0,255,0.2)', display: 'flex', alignItems:'center', justifyContent:'center'}}>◆</div>
                )}
                <div>
                  <div style={{fontWeight: 500}}>{item.cleanTitle}</div>
                  <div style={{fontSize: '0.8rem', color: 'var(--text-muted)'}}>{item.topCategory}</div>
                </div>
              </Link>
            ))}
            {filteredData.length === 0 && (
              <div style={{ color: 'var(--text-muted)' }}>Keine Einträge gefunden.</div>
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

  const markAsRead = (id: string) => {
    setReadMonographs(prev => {
      if (!prev.includes(id)) {
        return [...prev, id];
      }
      return prev;
    });
  };

  useEffect(() => {
    fetch('/data.json')
      .then(res => res.json())
      .then(json => {
        setData(json);
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
      <Route path="/" element={<Dashboard data={data} readMonographs={readMonographs} />} />
      <Route path="/monograph/:id" element={<MonographReader data={data} markAsRead={markAsRead} />} />
    </Routes>
  );
}
