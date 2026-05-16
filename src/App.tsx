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

interface DashboardProps {
  data: Monograph[];
  readMonographs: string[];
  favorites: string[];
  toggleFavorite: (id: string) => void;
  viewMode: 'galaxy' | 'wiki';
  setViewMode: (mode: 'galaxy' | 'wiki') => void;
}

function Dashboard({ data, readMonographs, favorites, toggleFavorite, viewMode, setViewMode }: DashboardProps) {
  const [search, setSearch] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const [alphaFilter, setAlphaFilter] = useState<string>('');

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
      // Category fallback
      if (!finalImageUrl) finalImageUrl = getCatImage(topCategory);

      return {
        ...item,
        topCategory,
        year,
        finalImageUrl,
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

  const showMosaic = viewMode === 'galaxy';

  return (
    <div className="mosaic-page animate-fade-in">
      {/* --- HEADER --- */}
      <header className="mosaic-header">
        <div className="mosaic-header-left">
          <h1 className="hud-title">SPiRAL MiND WiKi</h1>
          <div className="search-bar-hud">
            <input
              ref={searchRef}
              type="text"
              placeholder="Suche im kybernetischen Netz... (drücke /)"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          {/* Stats */}
          <div className="stats-panel">
            <div className="stat-chip"><span className="stat-value">{data.length}</span> Monographien</div>
            <div className="stat-chip"><span className="stat-value">{readMonographs.length}</span> gelesen</div>
            <div className="stat-chip"><span className="stat-value">{favorites.length}</span> ★ Favoriten</div>
          </div>
        </div>
        <div className="mosaic-header-right">
          <button
            className="glass"
            style={{ padding: '0.6rem 1.2rem', color: '#fff', cursor: 'pointer', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '12px', fontSize: '0.9rem', fontWeight: 600, boxShadow: '0 4px 15px rgba(0,0,0,0.3)', backdropFilter: 'blur(12px)', transition: 'all 0.2s ease' }}
            onClick={() => setViewMode(viewMode === 'galaxy' ? 'wiki' : 'galaxy')}
          >
            {showMosaic ? '→ Listenansicht' : '→ Porträtansicht'}
          </button>
          <button className="random-btn" onClick={goToRandom}>🎲 Zufällige Monographie</button>
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

      {/* --- PORTRAIT MOSAIC or WIKI LIST --- */}
      <div className="mosaic-scroll">
        {showMosaic ? (
          /* ===== MOSAIC VIEW ===== */
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
                  <div className="mosaic-grid">
                    {items.map(item => {
                      const isRead = readMonographs.includes(item.id);
                      const isFav = favorites.includes(item.id);
                      return (
                        <Link
                          to={`/monograph/${item.id}`}
                          key={item.id}
                          className={`mosaic-tile ${isRead ? 'is-read' : ''}`}
                          style={{ '--tile-color': color } as any}
                        >
                          <div
                            className="mosaic-portrait"
                            style={{ backgroundImage: `url(${item.finalImageUrl})` }}
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
          </div>
        ) : (
          /* ===== WIKI LIST VIEW ===== */
          <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '0 1.5rem' }}>
            {sortedCategories.map(cat => {
              const catItems = filteredData.filter(d => d.topCategory === cat);
              if (catItems.length === 0) return null;
              const color = getCatColor(cat);
              const readCount = catItems.filter(item => readMonographs.includes(item.id)).length;
              const progress = catItems.length > 0 ? Math.round((readCount / catItems.length) * 100) : 0;

              return (
                <div key={cat} style={{ marginBottom: '2.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem', paddingBottom: '0.8rem', borderBottom: `1px solid ${color}33` }}>
                    <span className="cat-dot" style={{ background: color, width: '12px', height: '12px', flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#fff', margin: 0 }}>{cat.replace(/_/g, ' ')}</h2>
                      <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)', marginTop: '2px' }}>{catItems.length} Einträge · {progress}% gelesen</div>
                    </div>
                    <div style={{ width: '120px', height: '4px', borderRadius: '2px', background: 'rgba(255,255,255,0.1)', overflow: 'hidden', flexShrink: 0 }}>
                      <div style={{ width: `${progress}%`, height: '100%', background: color, borderRadius: '2px', transition: 'width 0.5s ease' }} />
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.8rem' }}>
                    {catItems.sort((a, b) => a.cleanTitle.localeCompare(b.cleanTitle)).map(item => {
                      const isRead = readMonographs.includes(item.id);
                      return (
                        <Link to={`/monograph/${item.id}`} key={item.id} className={`mosaic-tile ${isRead ? 'is-read' : ''}`} style={{ '--tile-color': color, borderRadius: '12px', textDecoration: 'none', color: '#fff' } as any}>
                          <div className="mosaic-portrait" style={{ backgroundImage: `url(${item.finalImageUrl})`, borderRadius: '12px 12px 0 0' }} />
                          <div style={{ padding: '0.5rem 0.6rem' }}>
                            <div style={{ fontSize: '0.82rem', fontWeight: 600, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any }}>{item.cleanTitle}</div>
                            {item.year !== 9999 && <div style={{ fontSize: '0.7rem', color, marginTop: '2px' }}>{item.year}</div>}
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {filteredData.length === 0 && (
          <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '4rem 2rem', fontSize: '1.1rem' }}>
            Keine Einträge gefunden.
          </div>
        )}
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
  const [viewMode, setViewMode] = useLocalStorage<'galaxy' | 'wiki'>('spiral-view-mode', 'galaxy');

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
      fetch('/data.json')
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
