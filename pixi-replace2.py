file_path = "src/App.tsx"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

if "import * as PIXI" not in content:
    content = content.replace("import remarkGfm from 'remark-gfm';", "import remarkGfm from 'remark-gfm';\nimport * as PIXI from 'pixi.js';")

with open("/tmp/target_content.txt", "r", encoding="utf-8") as f:
    target = f.read()

new_component = """function CanvasSpiral({ positions, viewMode, superArms, getArmIndex }: CanvasSpiralProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<PIXI.Application | null>(null);
  const targetTransform = useRef({ x: 0, y: 0, scale: 0.22 });
  const currentTransform = useRef({ x: 0, y: 0, scale: 0.22 });
  const [hoveredItem, setHoveredItem] = useState<{ item: any; sx: number; sy: number } | null>(null);
  const navigate = useNavigate();
  const dragState = useRef({ dragging: false, lastX: 0, lastY: 0, startX: 0, startY: 0 });

  // PixiJS Initialization & Scene Graph
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let isDestroyed = false;
    const app = new PIXI.Application();
    
    app.init({
      resizeTo: el,
      backgroundAlpha: 0,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
      antialias: true
    }).then(() => {
      if (isDestroyed) {
        app.destroy(true);
        return;
      }
      el.appendChild(app.canvas);
      appRef.current = app;

      const world = new PIXI.Container();
      app.stage.addChild(world);

      const r = 22;
      const nodeMap = new Map();
      const loadQueue = new Set<string>();
      const cache = new Set<string>();

      // Center Glow
      const glow = new PIXI.Graphics();
      glow.circle(0, 0, 60).fill({ color: 0x00c8ff, alpha: 0.06 });
      world.addChild(glow);

      const textTitle = new PIXI.Text({
        text: 'SPiRAL\\nMiND',
        style: { fontFamily: 'Outfit, Inter, sans-serif', fontSize: 10, fill: 0xffffff, alpha: 0.2, fontWeight: 'bold', align: 'center' }
      });
      textTitle.anchor.set(0.5);
      world.addChild(textTitle);

      // Spiral Arms Guide
      const armsGraphics = new PIXI.Graphics();
      world.addChild(armsGraphics);
      const drawArms = () => {
        armsGraphics.clear();
        if (viewMode === 'spiral') {
          const guideStartR = 58 * 2.5;
          const guideTightness = 0.18;
          const guideGrowth = 58 * 0.52;
          const guideSteps = 55;
          superArms.forEach((arm, i) => {
            const baseAngle = (i / superArms.length) * 2 * Math.PI;
            armsGraphics.moveTo(guideStartR * Math.cos(baseAngle), guideStartR * Math.sin(baseAngle));
            for (let s = 1; s <= guideSteps; s++) {
              const theta = s * guideTightness;
              const rr = guideStartR + s * guideGrowth;
              const angle = baseAngle + theta;
              armsGraphics.lineTo(rr * Math.cos(angle), rr * Math.sin(angle));
            }
            armsGraphics.stroke({ color: arm.color, alpha: 0.18, width: 1 });
          });
        }
      };

      const nodesContainer = new PIXI.Container();
      world.addChild(nodesContainer);

      // Create GPU Nodes
      positions.forEach(pos => {
        const node = new PIXI.Container();
        node.position.set(pos.x, pos.y);
        node.eventMode = 'none';

        const colorHex = superArms[getArmIndex(pos.item.topCategory)]?.color.replace('#', '0x') || '0x64748b';
        
        const base = new PIXI.Graphics();
        base.circle(0, 0, r + 1.5).fill({ color: Number(colorHex) });
        node.addChild(base);

        const inner = new PIXI.Graphics();
        inner.circle(0, 0, r).fill({ color: 0x1a1a2e });
        node.addChild(inner);

        const sprite = new PIXI.Sprite();
        sprite.anchor.set(0.5);
        sprite.width = r * 2;
        sprite.height = r * 2;
        sprite.visible = false;
        node.addChild(sprite);

        const mask = new PIXI.Graphics();
        mask.circle(0, 0, r).fill({ color: 0xffffff });
        node.addChild(mask);
        sprite.mask = mask;

        const letter = new PIXI.Text({
          text: (pos.item.cleanTitle || '?').charAt(0).toUpperCase(),
          style: { fontFamily: 'Outfit, Inter, sans-serif', fontSize: Math.round(r * 0.85), fill: 0xffffff, alpha: 0.9, fontWeight: 'bold' }
        });
        letter.anchor.set(0.5);
        node.addChild(letter);

        const label = new PIXI.Text({
          text: pos.item.cleanTitle.length > 12 ? pos.item.cleanTitle.slice(0, 11) + '…' : pos.item.cleanTitle,
          style: { fontFamily: 'Inter, sans-serif', fontSize: 4, fill: 0xffffff, alpha: 0.4 }
        });
        label.anchor.set(0.5, 0);
        label.position.set(0, r + 6);
        label.visible = false;
        node.addChild(label);

        nodesContainer.addChild(node);
        nodeMap.set(pos.item.id, { node, sprite, inner, letter, label, pos });
      });

      drawArms();

      // Fit Initial Scale
      let maxR = 0;
      positions.forEach(p => { const d = Math.hypot(p.x, p.y); if (d > maxR) maxR = d; });
      if (maxR > 0) {
        const w = el.clientWidth || 1000;
        const h = el.clientHeight || 800;
        targetTransform.current = { x: 0, y: 0, scale: Math.max(0.08, Math.min(0.6, (Math.min(w, h) * 0.42) / maxR)) };
        currentTransform.current = { ...targetTransform.current };
      }

      // Physics / Camera Loop
      app.ticker.add((ticker) => {
        const dt = ticker.deltaTime * 0.15;
        const cur = currentTransform.current;
        const tar = targetTransform.current;
        
        cur.x += (tar.x - cur.x) * dt;
        cur.y += (tar.y - cur.y) * dt;
        cur.scale += (tar.scale - cur.scale) * dt;
        
        const cx = app.screen.width / 2;
        const cy = app.screen.height / 2;
        
        world.position.set(cx + cur.x, cy + cur.y);
        world.scale.set(cur.scale);
        
        const boundsR = r * cur.scale;
        
        // Frustum & LOD
        nodeMap.forEach((data) => {
          const { node, sprite, inner, letter, label, pos } = data;
          const screenX = cx + cur.x + pos.x * cur.scale;
          const screenY = cy + cur.y + pos.y * cur.scale;
          
          if (screenX + boundsR < -50 || screenX - boundsR > app.screen.width + 50 || 
              screenY + boundsR < -50 || screenY - boundsR > app.screen.height + 50) {
              node.visible = false;
              return;
          }
          
          node.visible = true;
          
          if (cur.scale < 0.12) {
              inner.visible = false;
              sprite.visible = false;
              letter.visible = false;
              label.visible = false;
          } else {
              inner.visible = true;
              label.visible = cur.scale > 0.6;
              
              if (pos.item.finalImageUrl && !cache.has(pos.item.finalImageUrl) && !loadQueue.has(pos.item.finalImageUrl) && loadQueue.size < 15) {
                  loadQueue.add(pos.item.finalImageUrl);
                  PIXI.Assets.load(pos.item.finalImageUrl).then((tex) => {
                      if (tex && sprite) {
                          sprite.texture = tex;
                          sprite.visible = true;
                          letter.visible = false;
                      }
                      cache.add(pos.item.finalImageUrl);
                      loadQueue.delete(pos.item.finalImageUrl);
                  }).catch(() => {
                      cache.add(pos.item.finalImageUrl);
                      loadQueue.delete(pos.item.finalImageUrl);
                  });
              }
              
              if (sprite.texture !== PIXI.Texture.EMPTY) {
                  sprite.visible = true;
                  letter.visible = false;
              } else {
                  sprite.visible = false;
                  letter.visible = true;
              }
          }
        });
      });
    });

    return () => {
      isDestroyed = true;
      if (appRef.current) {
        appRef.current.destroy(true, { children: true, texture: false, baseTexture: false });
      }
    };
  }, [positions, viewMode, superArms, getArmIndex]);

  // Viewport Events
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    dragState.current = { dragging: true, lastX: e.clientX, lastY: e.clientY, startX: e.clientX, startY: e.clientY };
  }, []);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    const ds = dragState.current;
    if (ds.dragging) {
      targetTransform.current.x += (e.clientX - ds.lastX);
      targetTransform.current.y += (e.clientY - ds.lastY);
      ds.lastX = e.clientX;
      ds.lastY = e.clientY;
    } else {
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const { x: tx, y: ty, scale } = currentTransform.current;
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
      setHoveredItem(prev => (prev?.item?.id === found?.item?.id ? prev : found));
    }
  }, [positions]);

  const onMouseUp = useCallback(() => {
    dragState.current.dragging = false;
  }, []);

  const onClick = useCallback((e: React.MouseEvent) => {
    const ds = dragState.current;
    if (Math.abs(e.clientX - ds.startX) > 5 || Math.abs(e.clientY - ds.startY) > 5) return;
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const { x: tx, y: ty, scale } = currentTransform.current;
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

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const factor = e.deltaY > 0 ? 0.8 : 1.25;
      const rect = el.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const cx = rect.width / 2;
      const cy = rect.height / 2;
      const tar = targetTransform.current;
      const newScale = Math.max(0.05, Math.min(5, tar.scale * factor));
      const ratio = newScale / tar.scale;
      tar.x = (tar.x - mx + cx) * ratio + mx - cx;
      tar.y = (tar.y - my + cy) * ratio + my - cy;
      tar.scale = newScale;
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
      style={{ cursor: 'grab', position: 'relative', overflow: 'hidden' }}
    >
      {hoveredItem && (
        <div className="canvas-tooltip" style={{
          position: 'fixed', left: hoveredItem.sx + 12, top: hoveredItem.sy - 30,
          background: 'rgba(0,0,0,0.9)', color: '#fff', padding: '4px 10px',
          borderRadius: '6px', fontSize: '0.75rem', fontFamily: 'var(--font-sans)',
          pointerEvents: 'none', zIndex: 9999, whiteSpace: 'nowrap',
          border: `1px solid ${superArms[getArmIndex(hoveredItem.item.topCategory)]?.color || '#64748b'}`
        }}>
          {hoveredItem.item.cleanTitle}
        </div>
      )}
      <div className="spiral-stats">
        {positions.length} Einträge (WebGL)
      </div>
    </div>
  );
}
"""

if target in content:
    content = content.replace(target, new_component)
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(content)
    print("SUCCESS")
else:
    print("TARGET NOT FOUND IN CONTENT")

