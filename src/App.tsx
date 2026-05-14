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

interface CategoryNode {
  name: string;
  items: Monograph[];
  subcats: Record<string, CategoryNode>;
}

function buildTree(data: Monograph[]): CategoryNode {
  const root: CategoryNode = { name: 'Root', items: [], subcats: {} };
  for (const item of data) {
    let current = root;
    const pathParts = item.category ? item.category.split(' / ') : ['Uncategorized'];
    
    for (const part of pathParts) {
      if (!current.subcats[part]) {
        current.subcats[part] = { name: part, items: [], subcats: {} };
      }
      current = current.subcats[part];
    }
    current.items.push(item);
  }
  return root;
}

const getAllItems = (n: CategoryNode): Monograph[] => {
  let all = [...n.items];
  for (const sub of Object.values(n.subcats)) {
    all = [...all, ...getAllItems(sub)];
  }
  return all;
};

// Bereinigt die fetten Präfixe für ein elegantes UI
const cleanTitle = (title: string) => {
  return title.replace(/^(Monographie: |Primärquellen: )/i, '').trim();
};

interface DashboardProps {
  data: Monograph[];
  readMonographs: string[];
}

function Dashboard({ data, readMonographs }: DashboardProps) {
  const [search, setSearch] = useState('');
  const [currentPath, setCurrentPath] = useState<string[]>([]);
  const viewportRef = useRef<HTMLDivElement>(null);

  const filteredData = data.filter(d => 
    d.title.toLowerCase().includes(search.toLowerCase()) || 
    d.category.toLowerCase().includes(search.toLowerCase())
  );

  const fullTree = buildTree(filteredData);
  
  let currentNode = fullTree;
  for (const part of currentPath) {
    if (currentNode.subcats[part]) {
      currentNode = currentNode.subcats[part];
    }
  }

  // Auto-Center Canvas on Mount and Path Change
  useEffect(() => {
    if (viewportRef.current) {
      const v = viewportRef.current;
      v.scrollLeft = (4000 - v.clientWidth) / 2;
      v.scrollTop = (4000 - v.clientHeight) / 2;
    }
  }, [currentPath]);

  // Combine subcats and items for the spiral layout
  const subcats = Object.keys(currentNode.subcats).sort();
  const items = currentNode.items.sort((a, b) => cleanTitle(a.title).localeCompare(cleanTitle(b.title)));

  // Spiral Math
  const getSpiralPosition = (index: number) => {
    // Abstandstuning je nach Typ
    const spacing = 180; // Arc length between nodes
    const b = 25; // How fast the spiral grows outward
    const a = 180; // Inner radius buffer (don't overlap the center orb)
    
    // We start index at 1 to push everything outward
    const i = index + 1;
    const s = i * spacing;
    
    // Archimedean spiral arc length approximation
    const theta = Math.sqrt((2 * s) / b);
    const r = a + b * theta;
    
    const x = r * Math.cos(theta);
    const y = r * Math.sin(theta);
    
    return { x, y };
  };

  const isRoot = currentPath.length === 0;
  const isSearching = search.trim().length > 0;

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden' }}>
      
      {/* --- HUD OVERLAY (Fixed) --- */}
      <div className="hud-overlay">
        <h1 className="hud-title hud-interactive">SPiRAL MiND</h1>
        
        <div className="search-bar-hud hud-interactive">
          <input 
            type="text" 
            placeholder="Suche im kybernetischen Netz..." 
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {!isRoot && !isSearching && (
          <nav className="breadcrumb-nav hud-interactive">
            <button className="breadcrumb-item" onClick={() => setCurrentPath([])}>Home</button>
            {currentPath.map((part, index) => (
              <span key={index} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span className="breadcrumb-separator">/</span>
                <button 
                  className={`breadcrumb-item ${index === currentPath.length - 1 ? 'active' : ''}`}
                  onClick={() => setCurrentPath(currentPath.slice(0, index + 1))}
                >
                  {part.replace(/_/g, ' ')}
                </button>
              </span>
            ))}
          </nav>
        )}
      </div>

      {/* --- SPIRAL VIEWPORT (Scrollable) --- */}
      {!isSearching ? (
        <div className="spiral-viewport animate-fade-in" ref={viewportRef}>
          <div className="spiral-canvas">
            
            {/* The Central Orb (Navigates up if not root) */}
            <div 
              className="spiral-center-node"
              onClick={() => {
                if (currentPath.length > 0) {
                  setCurrentPath(currentPath.slice(0, -1));
                }
              }}
            >
              <div className="center-title">
                {isRoot ? "THE MATRIX" : currentPath[currentPath.length - 1].replace(/_/g, ' ')}
              </div>
              {!isRoot && <div className="center-subtitle">← Level Up</div>}
            </div>

            {/* The Orbiting Subcategories */}
            {subcats.map((catName, index) => {
              const pos = getSpiralPosition(index);
              const subNode = currentNode.subcats[catName];
              const allItems = getAllItems(subNode);
              const readCount = allItems.filter(item => readMonographs.includes(item.id)).length;
              const progress = allItems.length > 0 ? Math.round((readCount / allItems.length) * 100) : 0;
              
              return (
                <div 
                  key={catName} 
                  className="node-positioner"
                  style={{ transform: `translate(${pos.x}px, ${pos.y}px)` }}
                >
                  <div 
                    className="orbital-node node-cat"
                    onClick={() => setCurrentPath([...currentPath, catName])}
                  >
                    <span>{catName.replace(/_/g, ' ')}<br/>({progress}%)</span>
                  </div>
                </div>
              );
            })}

            {/* The Orbiting Monographs */}
            {items.map((item, index) => {
              const pos = getSpiralPosition(subcats.length + index);
              const isRead = readMonographs.includes(item.id);
              const clean = cleanTitle(item.title);
              
              return (
                <div 
                  key={item.id} 
                  className="node-positioner"
                  style={{ transform: `translate(${pos.x}px, ${pos.y}px)` }}
                >
                  <Link 
                    to={`/monograph/${item.id}`} 
                    className={`orbital-node node-item ${isRead ? 'read' : ''}`}
                    style={{ backgroundImage: item.imageUrl ? `url(${item.imageUrl})` : 'none' }}
                  >
                    {!item.imageUrl && <span className="node-icon">◆</span>}
                    
                    {/* Elegant Tooltip on Hover */}
                    <div className="node-tooltip">
                      {clean} {isRead ? '(Erforscht)' : ''}
                    </div>
                  </Link>
                </div>
              );
            })}

          </div>
        </div>
      ) : (
        /* --- SEARCH RESULTS FALLBACK GRID --- */
        <div className="search-results-overlay animate-fade-in hud-interactive">
          <div className="search-grid">
            {filteredData.sort((a,b) => cleanTitle(a.title).localeCompare(cleanTitle(b.title))).map(item => (
              <Link to={`/monograph/${item.id}`} key={item.id} className="search-card">
                {item.imageUrl ? (
                  <img src={item.imageUrl} alt="" style={{width: 40, height: 40, borderRadius: 8, objectFit: 'cover'}} />
                ) : (
                  <div style={{width: 40, height: 40, borderRadius: 8, background: 'rgba(189,0,255,0.2)', display: 'flex', alignItems:'center', justifyContent:'center'}}>◆</div>
                )}
                <div>
                  <div style={{fontWeight: 500}}>{cleanTitle(item.title)}</div>
                  <div style={{fontSize: '0.8rem', color: 'var(--text-muted)'}}>{item.category}</div>
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
