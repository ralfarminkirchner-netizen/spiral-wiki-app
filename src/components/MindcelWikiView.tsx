import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import ForceGraph3D from 'react-force-graph-3d';
import SpriteText from 'three-spritetext';
import * as THREE from 'three';
import { useNavigate } from 'react-router-dom';

const textureLoader = new THREE.TextureLoader();
textureLoader.crossOrigin = 'anonymous';

// Generates a single, perfect circular texture on the GPU for all nodes
const createCircleTexture = () => {
  const canvas = document.createElement('canvas');
  canvas.width = 128; canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.clearRect(0,0,128,128); // Transparent background!
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(64,64,64,0,Math.PI*2);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  return tex;
};
const circleTexture = createCircleTexture();

// Track loaded materials to prevent memory leaks (Max 3 images at a time)
const activeMaterials = new Map<string, THREE.SpriteMaterial>();

const CATEGORY_COLOR: Record<string, string> = {
  'Religion_und_Spiritualitaet': '#c084fc',
  'Tradition': '#a78bfa',
  'Philosophie': '#93c5fd',
  'Philosophie_und_Konstruktivismus': '#7dd3fc',
  'Anthropologie': '#6ee7b7',
  'Soziologie': '#34d399',
  'Psychologie': '#fbbf24',
  'Traumaforschung': '#f87171',
  'Neurowissenschaften_und_Bewusstsein': '#fb923c',
  'Neurologie': '#fb923c',
  'Bewusstseinsforschung': '#e879f9',
  'Biologie_und_Evolution': '#4ade80',
  'Physik_und_Mathematik': '#38bdf8',
  'Quantenphysik_und_Kosmologie': '#818cf8',
  'Informatik_und_KI': '#22d3ee',
  'Kybernetik': '#2dd4bf',
  'Wirtschaft': '#f59e0b',
  'Wissenschaft': '#60a5fa',
  'Sprachwissenschaft_und_Semiotik': '#f472b6',
  'Kunst_und_Literatur': '#e2e8f0',
  'Oekologie_und_Umwelt': '#86efac',
  'Ökologie_und_Umwelt': '#86efac',
  'Synthesen': '#00ffcc',
};

export default function MindcelWikiView({ data }: { data: any }) {
  const navigate = useNavigate();
  const fgRef = useRef<any>();
  const [hoverNode, setHoverNode] = useState<any>(null);
  const [clickedNode, setClickedNode] = useState<any>(null);
  
  // Build graph data
  const graphData = useMemo(() => {
    let rawNodes: any[] = [];
    let rawLinks: any[] = [];
    let hasExplicitLinks = false;

    if (Array.isArray(data)) {
      rawNodes = data;
    } else if (data && typeof data === 'object') {
      if (Array.isArray(data.nodes)) {
        rawNodes = data.nodes;
      } else if (Array.isArray(data.monographs)) {
        rawNodes = data.monographs;
      }
      if (Array.isArray(data.links)) {
        rawLinks = data.links;
        hasExplicitLinks = true;
      }
    }

    // Deduplicate nodes by ID
    const uniqueMap = new Map();
    rawNodes.forEach(n => {
      if (!uniqueMap.has(n.id)) uniqueMap.set(n.id, n);
    });
    
    const nodes = Array.from(uniqueMap.values()).map(e => ({
      id: e.id,
      name: e.cleanTitle || e.title,
      cluster: e.topCategory || e.category || 'Wissenschaft',
      image: e.finalImageUrl || null,
      hasImage: e.hasRealImage || false,
      year: e.year || null,
      val: e.hasRealImage ? 12 : 8,
      color: CATEGORY_COLOR[e.topCategory || e.category] || '#94a3b8',
      __cachedObj: null
    }));

    let links: any[] = [];

    // Only REAL links are rendered. 'influence' = directed (Wikidata P737),
    // 'association' = undirected (corpus [[wiki-links]]). No links are ever
    // fabricated; if none are supplied the graph simply shows unconnected nodes.
    if (hasExplicitLinks) {
      links = rawLinks.map(l => ({
        source: typeof l.source === 'object' ? l.source.id : l.source,
        target: typeof l.target === 'object' ? l.target.id : l.target,
        type: l.type || 'association'
      }));
    }

    return { nodes, links };
  }, [data]);

  // Click handler: Double-click navigates to standard Wiki article
  const clickTimesRef = useRef<{ [key: string]: number }>({});
  const handleNodeClick = useCallback((node: any) => {
    const now = Date.now();
    const lastClick = clickTimesRef.current[node.id] || 0;
    
    if (now - lastClick < 400) {
      // Double click!
      navigate(`/monograph/${node.id}`);
    } else {
      // Single click (focus camera)
      clickTimesRef.current[node.id] = now;
      
      // If clicking the currently selected node again, deselect it
      if (clickedNode && clickedNode.id === node.id) {
        setClickedNode(null);
        return;
      }
      
      setClickedNode(node);
      if (fgRef.current) {
        const distance = 80;
        const currentCam = fgRef.current.cameraPosition();
        const dx = node.x - currentCam.x;
        const dy = node.y - currentCam.y;
        const dz = node.z - currentCam.z;
        const dist = Math.hypot(dx, dy, dz);
        
        let targetCamPos;
        if (dist === 0) {
          targetCamPos = { x: node.x, y: node.y, z: node.z + distance };
        } else {
          targetCamPos = {
            x: node.x - (dx / dist) * distance,
            y: node.y - (dy / dist) * distance,
            z: node.z - (dz / dist) * distance
          };
        }
        
        fgRef.current.cameraPosition(
          targetCamPos,
          node,
          1000
        );
      }
    }
  }, [navigate, clickedNode]);

  // Full-Network Traversal (BFS) to find the entire connected subgraph
  const activeSubgraph = useMemo(() => {
    if (!clickedNode) return { nodes: new Set<string>(), links: new Set<any>() };
    
    const activeNodes = new Set<string>();
    const activeLinks = new Set<any>();
    
    // Build adjacency list for fast traversal
    const adj = new Map<string, any[]>();
    graphData.links.forEach(l => {
      const src = typeof l.source === 'object' ? l.source.id : l.source;
      const tgt = typeof l.target === 'object' ? l.target.id : l.target;
      if (!adj.has(src)) adj.set(src, []);
      if (!adj.has(tgt)) adj.set(tgt, []);
      adj.get(src)!.push(l);
      adj.get(tgt)!.push(l);
    });
    
    const queue = [clickedNode.id];
    activeNodes.add(clickedNode.id);
    
    while (queue.length > 0) {
      const curr = queue.shift()!;
      const neighbors = adj.get(curr) || [];
      
      neighbors.forEach(link => {
        activeLinks.add(link);
        const src = typeof link.source === 'object' ? link.source.id : link.source;
        const tgt = typeof link.target === 'object' ? link.target.id : link.target;
        const nextNode = src === curr ? tgt : src;
        
        if (!activeNodes.has(nextNode)) {
          activeNodes.add(nextNode);
          queue.push(nextNode);
        }
      });
    }
    
    return { nodes: activeNodes, links: activeLinks };
  }, [clickedNode, graphData]);

  const isLinkActive = useCallback((link: any) => {
    if (!clickedNode) return false;
    return activeSubgraph.links.has(link);
  }, [clickedNode, activeSubgraph]);

  const isNodeActive = useCallback((node: any) => {
    if (!clickedNode) return true; // If nothing clicked, all are "active"
    return activeSubgraph.nodes.has(node.id);
  }, [clickedNode, activeSubgraph]);

  // Dynamic Label LOD and Hover opacity logic
  useEffect(() => {
    let active = true;
    const animate = () => {
      if (!active) return;

      const camera = fgRef.current?.camera();
      if (camera && graphData?.nodes) {
        const camPos = camera.position;
        const maxDist = 70;
        const maxDistSq = maxDist * maxDist;
        const minDist = 30;

        graphData.nodes.forEach((node: any) => {
          if (node.x === undefined || node.y === undefined || node.z === undefined) return;
          if (!node.__labelSprite) return;

          const isHovered = hoverNode && hoverNode.id === node.id;

          if (isHovered) {
            node.__labelSprite.visible = true;
            if (node.__labelSprite.material) {
              node.__labelSprite.material.opacity = 1.0;
              node.__labelSprite.material.transparent = true;
            }
            return;
          }

          const dx = camPos.x - node.x;
          const dy = camPos.y - node.y;
          const dz = camPos.z - node.z;
          const distSq = dx * dx + dy * dy + dz * dz;

          if (distSq > maxDistSq) {
            node.__labelSprite.visible = false;
          } else {
            node.__labelSprite.visible = true;
            const dist = Math.sqrt(distSq);
            let opacity = Math.max(0, Math.min(1, (maxDist - dist) / (maxDist - minDist)));
            
            // Dim label if ghost node
            if (clickedNode && !isNodeActive(node)) {
              opacity *= 0.1; 
            }
            
            if (node.__labelSprite.material) {
              node.__labelSprite.material.opacity = opacity;
              node.__labelSprite.material.transparent = true;
            }
          }
        });
      }

      requestAnimationFrame(animate);
    };

    const frameId = requestAnimationFrame(animate);
    return () => {
      active = false;
      cancelAnimationFrame(frameId);
    };
  }, [graphData, hoverNode]);

  // Image Loading Logic (Only load on click, max 3 active images)
  useEffect(() => {
    if (!clickedNode || !clickedNode.hasImage || !clickedNode.image || !clickedNode.__cachedObj) return;
    
    // The sprite material is the first child of the group
    const material = clickedNode.__cachedObj.children[0].material;
    if (material.map && material.map !== circleTexture) return; // Already loaded
    
    textureLoader.load(clickedNode.image, (texture) => {
      // Draw image onto a canvas with circle clipping to avoid black corners
      const canvas = document.createElement('canvas');
      canvas.width = 256; canvas.height = 256;
      const ctx = canvas.getContext('2d');
      if (ctx && texture.image) {
        ctx.beginPath();
        ctx.arc(128, 128, 128, 0, Math.PI * 2);
        ctx.clip();
        
        const img = texture.image;
        const size = Math.min(img.width, img.height);
        const x = (img.width - size) / 2;
        const y = (img.height - size) / 2;
        ctx.drawImage(img, x, y, size, size, 0, 0, 256, 256);
      }
      
      const tex = new THREE.CanvasTexture(canvas);
      tex.minFilter = THREE.LinearMipmapLinearFilter;
      tex.generateMipmaps = true;
      
      // Enforce LRU cache of 3 images to prevent iPad crashes
      if (activeMaterials.size >= 3) {
        const oldestUrl = activeMaterials.keys().next().value;
        if (oldestUrl) {
          const oldMat = activeMaterials.get(oldestUrl);
          if (oldMat && oldMat !== material) {
            oldMat.map = circleTexture;
            oldMat.color.copy(oldMat.userData.originalColor);
            oldMat.needsUpdate = true;
          }
          activeMaterials.delete(oldestUrl);
        }
      }
      
      activeMaterials.set(clickedNode.image, material);
      material.map = tex;
      material.color.setHex(0xffffff);
      material.needsUpdate = true;
    });
  }, [clickedNode]);

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', background: '#050508' }}>
      <ForceGraph3D
        ref={fgRef}
        graphData={graphData}
        nodeId="id"
        nodeVal="val"
        nodeLabel="name"
        nodeColor="color"
        nodeRelSize={6}
        nodeOpacity={1.0}
        nodeThreeObject={(node: any) => {
          if (node.__cachedObj) return node.__cachedObj;

          const group = new THREE.Group();
          const size = node.val * 1.5;

          // Ghost node dimming
          const nodeOpacity = clickedNode && !isNodeActive(node) ? 0.08 : 1.0;

          const material = new THREE.SpriteMaterial({ 
            color: new THREE.Color(node.color),
            map: circleTexture,
            transparent: true,
            opacity: nodeOpacity,
            alphaTest: 0.05
          });
          material.userData = { originalColor: new THREE.Color(node.color) };
          
          // Re-apply opacity if we are returning a cached object
          if (node.__cachedObj) {
            const mat = node.__cachedObj.children[0].material;
            mat.opacity = nodeOpacity;
          }
          
          const sprite = new THREE.Sprite(material);
          sprite.scale.set(size, size, 1);
          group.add(sprite);
          
          // Name Text Placeholder with Premium typography (Outfit, Inter)
          const nameSprite = new SpriteText(node.name);
          nameSprite.color = '#ffffff'; 
          nameSprite.strokeWidth = 0.5;
          nameSprite.strokeColor = '#000000';
          nameSprite.fontFace = 'Outfit, Inter, sans-serif';
          nameSprite.fontWeight = 'bold';
          nameSprite.textHeight = Math.max(1, size / 5.5);
          nameSprite.position.set(0, 0, 0.1);
          nameSprite.visible = false; // Controlled dynamically via useFrame LOD loop
          group.add(nameSprite);
          node.__labelSprite = nameSprite;

          node.__cachedObj = group;
          return group;
        }}
        nodeThreeObjectExtend={false}
        linkWidth={link => isLinkActive(link) ? 0.8 : 0.05}
        linkResolution={6}
        linkColor={link => {
          if (isLinkActive(link)) return '#00ffff';
          return '#ffffff';
        }}
        linkOpacity={0.6}
        linkDirectionalParticles={link => {
          if (!clickedNode) return 1; // gentle flow everywhere when idle
          if (isLinkActive(link)) return 4; // heavy flow along active network
          return 0; // dead links have no flow
        }}
        linkDirectionalParticleSpeed={link => isLinkActive(link) ? 0.008 : 0.002}
        linkDirectionalParticleWidth={link => isLinkActive(link) ? 3.5 : 1.0}
        linkDirectionalParticleColor={link => isLinkActive(link) ? '#ffffff' : '#4dd0e1'}
        onNodeHover={setHoverNode}
        onNodeClick={handleNodeClick}
        onBackgroundClick={() => setClickedNode(null)}
        backgroundColor="#050508"
        enableNodeDrag={false}
      />
      
      {/* Search & Info overlay */}
      <div style={{ position: 'absolute', bottom: '20px', left: '20px', color: 'white', pointerEvents: 'none' }}>
        <h2 style={{ fontSize: '24px', fontWeight: 'bold', margin: 0 }}>MiNDCEL WiKi</h2>
        <p style={{ opacity: 0.7, margin: '5px 0' }}>Doppelklick auf einen Artikel, um ihn zu öffnen.</p>
        {hoverNode && (
          <div style={{ marginTop: '20px', padding: '10px', background: 'rgba(0,0,0,0.5)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }}>
            <div style={{ fontSize: '12px', color: hoverNode.color, textTransform: 'uppercase', letterSpacing: '1px' }}>{hoverNode.cluster?.replace(/_/g, ' ')}</div>
            <div style={{ fontSize: '18px', fontWeight: 'bold' }}>{hoverNode.name}</div>
          </div>
        )}
      </div>
    </div>
  );
}
