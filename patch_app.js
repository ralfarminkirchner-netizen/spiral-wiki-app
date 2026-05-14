const fs = require('fs');

let content = fs.readFileSync('src/App.tsx', 'utf8');

// We need to replace the entire App.tsx contents up to `function MonographReader`

const replacement = `import { Routes, Route, Link, useParams, useNavigate } from 'react-router-dom';
import { useState, useEffect, useRef, useMemo } from 'react';
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

interface ProcessedMonograph extends Monograph {
  topCategory: string;
  year: number;
  finalImageUrl: string | null;
  cleanTitle: string;
}

const cleanTitleText = (title: string) => {
  return title.replace(/^(Monographie: |Primärquellen: |Masterclass |Monographie )/i, '').replace(/\\s*\\(.*?\\)/, '').trim();
};

interface DashboardProps {
  data: Monograph[];
  readMonographs: string[];
}

function Dashboard({ data, readMonographs }: DashboardProps) {
  const [search, setSearch] = useState('');
  const viewportRef = useRef<HTMLDivElement>(null);

  // 1. Data Processing
  const processedData = useMemo(() => {
    return data.map(item => {
      const topCategory = item.category ? item.category.split(' / ')[0] : 'Uncategorized';
      
      let year = 9999;
      const yearMatch = item.content.match(/\\(\\*?\\s*(\\d{4})/);
      if (yearMatch && yearMatch[1]) {
        year = parseInt(yearMatch[1], 10);
      } else {
         const titleYearMatch = item.title.match(/\\(\\*?\\s*(\\d{4})/);
         if (titleYearMatch && titleYearMatch[1]) {
            year = parseInt(titleYearMatch[1], 10);
         }
      }

      let finalImageUrl = item.imageUrl || null;
      if (!finalImageUrl) {
        const imgMatch = item.content.match(/!\\[.*?\\]\\((.*?)\\)/);
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
  }, [data]);

  const filteredData = processedData.filter(d => 
    d.title.toLowerCase().includes(search.toLowerCase()) || 
    d.category.toLowerCase().includes(search.toLowerCase())
  );

  // 2. Galaxy Math
  const { nodes, canvasSize } = useMemo(() => {
    const isSearching = search.trim().length > 0;
    const itemsToProcess = isSearching ? filteredData : processedData;
    
    const categories = Array.from(new Set(itemsToProcess.map(d => d.topCategory))).sort();
    const N_cats = categories.length || 1;
    
    let maxR = 0;
    const generatedNodes: any[] = [];
    
    categories.forEach((cat, catIndex) => {
      const alpha = catIndex * ((2 * Math.PI) / N_cats);
      const catItems = itemsToProcess.filter(d => d.topCategory === cat).sort((a, b) => a.year - b.year);
      
      const readCount = catItems.filter(item => readMonographs.includes(item.id)).length;
      const progress = catItems.length > 0 ? Math.round((readCount / catItems.length) * 100) : 0;

      // Category Node
      generatedNodes.push({
        isCategory: true,
        name: cat,
        id: \`cat-\${cat}\`,
        x: 400 * Math.cos(alpha),
        y: 400 * Math.sin(alpha),
        progress
      });

      // Item Nodes
      catItems.forEach((item, i) => {
        const idx = i + 1;
        const r_base = 500;
        const b_r = 90;
        const r = r_base + b_r * idx;
        
        if (r > maxR) maxR = r;
        
        const b_theta = 0.12;
        const theta = alpha + b_theta * idx;

        const x = r * Math.cos(theta);
        const y = r * Math.sin(theta);

        generatedNodes.push({
          isCategory: false,
          item,
          id: item.id,
          x,
          y
        });
      });
    });

    const finalCanvasSize = Math.max(4000, maxR * 2 + 2000);
    return { nodes: generatedNodes, canvasSize: finalCanvasSize };
  }, [processedData, filteredData, search, readMonographs]);

  // Auto-Center Canvas on Mount
  useEffect(() => {
    if (viewportRef.current) {
      const v = viewportRef.current;
      v.scrollLeft = (canvasSize - v.clientWidth) / 2;
      v.scrollTop = (canvasSize - v.clientHeight) / 2;
    }
  }, [canvasSize]);

  const isSearching = search.trim().length > 0;

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden' }}>
      
      {/* --- HUD OVERLAY (Fixed) --- */}
      <div className="hud-overlay">
        <h1 className="hud-title hud-interactive">SPiRAL MiND V3</h1>
        <div className="hud-subtitle">CHRONOLOGICAL GALAXY</div>
        
        <div className="search-bar-hud hud-interactive" style={{marginTop: '1rem'}}>
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
          <div className="spiral-canvas" style={{ width: \`\${canvasSize}px\`, height: \`\${canvasSize}px\` }}>
            
            {/* The Central Orb */}
            <div className="spiral-center-node" style={{ transform: 'translate(-50%, -50%)', top: '50%', left: '50%' }}>
              <div className="center-title">THE MATRIX</div>
            </div>

            {/* Galaxy Nodes */}
            {nodes.map(node => {
              if (node.isCategory) {
                return (
                  <div 
                    key={node.id} 
                    className="node-positioner node-pulse"
                    style={{ transform: \`translate(\${node.x}px, \${node.y}px)\` }}
                  >
                    <div className="orbital-node node-cat" style={{ transform: 'translate(-50%, -50%) scale(1.5)' }}>
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
                  style={{ transform: \`translate(\${node.x}px, \${node.y}px)\` }}
                >
                  <Link 
                    to={\`/monograph/\${node.item.id}\`} 
                    className={\`orbital-node node-item \${isRead ? 'read' : ''}\`}
                    style={{ backgroundImage: node.item.finalImageUrl ? \`url(\${node.item.finalImageUrl})\` : 'none' }}
                  >
                    {!node.item.finalImageUrl && <span className="node-icon">◆</span>}
                  </Link>
                  <div className="node-label">
                    {node.item.cleanTitle}
                    <div className="node-label-year">{node.item.year !== 9999 ? node.item.year : ''}</div>
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
              <Link to={\`/monograph/\${item.id}\`} key={item.id} className="search-card">
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

`;

const splitString = "interface ReaderProps {";
const parts = content.split(splitString);
if (parts.length === 2) {
  fs.writeFileSync('src/App.tsx', replacement + splitString + parts[1]);
  console.log("App.tsx successfully patched.");
} else {
  console.log("Could not find split string in App.tsx.");
}
