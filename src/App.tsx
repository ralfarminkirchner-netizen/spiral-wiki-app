import { Routes, Route, Link, useParams, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// Custom Hook für lokalen Speicher
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

// Hilfsfunktion: Alle Items eines Knotens rekursiv finden
const getAllItems = (n: CategoryNode): Monograph[] => {
  let all = [...n.items];
  for (const sub of Object.values(n.subcats)) {
    all = [...all, ...getAllItems(sub)];
  }
  return all;
};

interface DashboardProps {
  data: Monograph[];
  readMonographs: string[];
}

function Dashboard({ data, readMonographs }: DashboardProps) {
  const [search, setSearch] = useState('');
  const [currentPath, setCurrentPath] = useState<string[]>([]);
  
  const filteredData = data.filter(d => 
    d.title.toLowerCase().includes(search.toLowerCase()) || 
    d.category.toLowerCase().includes(search.toLowerCase())
  );

  const fullTree = buildTree(filteredData);
  
  // Finde den aktuellen Knoten basierend auf currentPath
  let currentNode = fullTree;
  for (const part of currentPath) {
    if (currentNode.subcats[part]) {
      currentNode = currentNode.subcats[part];
    }
  }

  // Wenn gesucht wird, lösche den Pfad, um alles flach zu zeigen
  useEffect(() => {
    if (search.trim().length > 0 && currentPath.length > 0) {
      setCurrentPath([]);
    }
  }, [search]);

  const mainCategoriesCount = Object.keys(fullTree.subcats).length;
  const isRoot = currentPath.length === 0;

  return (
    <div className="dashboard-container animate-fade-in">
      <div className="spiral-bg"></div>
      
      <header className="hero">
        <h1 className="gradient-text">SPiRAL MiND</h1>
        <div className="search-bar">
          <input 
            type="text" 
            placeholder="Suche im kybernetischen Netz..." 
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </header>

      {isRoot && search === '' && (
        <div className="stats-container animate-slide-up">
          <div className="stat-box glass">
            <h3>Entitäten</h3>
            <p className="stat-number">{filteredData.length}</p>
          </div>
          <div className="stat-box glass highlight-box">
            <h3>Erforscht</h3>
            <p className="stat-number">{readMonographs.length}</p>
            <div className="progress-bar-container small">
              <div className="progress-bar-fill" style={{ width: `${Math.round((readMonographs.length / data.length) * 100)}%` }}></div>
            </div>
          </div>
          <div className="stat-box glass">
            <h3>Dimensionen</h3>
            <p className="stat-number">{mainCategoriesCount}</p>
          </div>
        </div>
      )}

      {/* Breadcrumb Navigation */}
      {!isRoot && search === '' && (
        <nav className="breadcrumb-nav glass animate-slide-up">
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

      {/* Grid: Zeige Unterkategorien des aktuellen Knotens */}
      {Object.keys(currentNode.subcats).length > 0 && (
        <div className="bento-grid animate-slide-up" style={{ animationDelay: '0.1s' }}>
          {Object.keys(currentNode.subcats).sort().map(catName => {
            const subNode = currentNode.subcats[catName];
            const allItems = getAllItems(subNode);
            const readCount = allItems.filter(item => readMonographs.includes(item.id)).length;
            const progress = allItems.length > 0 ? Math.round((readCount / allItems.length) * 100) : 0;
            
            return (
              <div 
                key={catName} 
                className="bento-card glass glass-interactive"
                onClick={() => setCurrentPath([...currentPath, catName])}
              >
                <h2>{catName.replace(/_/g, ' ')}</h2>
                
                {/* Visual Progress Bar inside Card */}
                <div className="progress-bar-container small" style={{ marginBottom: '1.5rem', opacity: 0.5 }}>
                  <div className="progress-bar-fill" style={{ width: `${progress}%` }}></div>
                </div>

                <div className="bento-meta">
                  <span className="bento-count">{allItems.length} Einträge</span>
                  <span className="bento-progress">{progress}%</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Liste: Zeige Monographien des aktuellen Knotens */}
      {currentNode.items.length > 0 && (
        <div className="monograph-list-grid animate-slide-up" style={{ animationDelay: '0.2s' }}>
          {currentNode.items.sort((a, b) => a.title.localeCompare(b.title)).map(item => {
            const isRead = readMonographs.includes(item.id);
            return (
              <Link to={`/monograph/${item.id}`} key={item.id} className={`monograph-card glass glass-interactive ${isRead ? 'read' : ''}`}>
                {item.imageUrl ? (
                  <img src={item.imageUrl} alt={item.title} className="monograph-avatar" loading="lazy" />
                ) : (
                  <div className="monograph-avatar"></div>
                )}
                <div className="monograph-info">
                  <span className="monograph-title">{item.title}</span>
                  {isRead && <span className="read-badge-inline">Erforscht</span>}
                </div>
              </Link>
            );
          })}
        </div>
      )}
      
      {/* Wenn gesucht wird und nichts gefunden wird */}
      {search.trim().length > 0 && filteredData.length === 0 && (
        <div className="glass" style={{ padding: '3rem', textAlign: 'center' }}>
          <h2 style={{ color: 'var(--text-muted)' }}>Keine Einträge im kybernetischen Netz gefunden.</h2>
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

  // Scroll to top on load
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [id]);

  if (!monograph) {
    return (
      <div className="app-layout">
        <div className="spiral-bg"></div>
        <div className="reader-content glass" style={{ textAlign: 'center' }}>
          <h2>Signal verloren. Monographie nicht gefunden.</h2>
          <button className="btn-back" style={{ margin: '2rem auto', border: '1px solid var(--accent-cyan)', padding: '0.5rem 1rem', borderRadius: '8px' }} onClick={() => navigate('/')}>Zurück zur Matrix</button>
        </div>
      </div>
    );
  }

  return (
    <div className="app-layout">
      <div className="spiral-bg"></div>
      
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
      <div className="app-layout">
        <div className="spiral-bg"></div>
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
