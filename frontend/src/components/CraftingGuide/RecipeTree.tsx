import { useEffect, useMemo, useRef, useState } from 'react';
import { animate } from 'animejs';
import { Button } from 'antd';
import type { Recipe, StockMap } from '../../types';
import { ItemLabel, ItemThumbnail } from '../shared/ItemVisual';
import './RecipeTree.css';
import { zoomAt, type TreeCamera } from './treeCamera';

type Node = { key: string; id: string; name?: string; quantity: number; recipe?: Recipe; parent?: Node; depth: number; children: Node[]; cycle: boolean; x: number; y: number };
export function RecipeTree({ recipe, recipes, stocks, quantity }: { recipe: Recipe; recipes: Recipe[]; stocks: StockMap; quantity: number }) {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(['root']));
  const [spread, setSpread] = useState(.1);
  const [camera, setCamera] = useState<TreeCamera>({ x: 0, y: 0, zoom: 1 });
  const cameraRef = useRef(camera);
  const [bounds, setBounds] = useState({ width: 700, height: 600 });
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  function updateCamera(next: TreeCamera) { cameraRef.current = next; setCamera(next); }
  function fit() {
    const element = viewport.current;
    if (element) updateCamera({ x: 0, y: 0, zoom: Math.min(1, (element.clientWidth - 40) / model.size, (element.clientHeight - 40) / model.size) });
  }
  const motion = useRef<ReturnType<typeof animate>>();
  const viewport = useRef<HTMLDivElement>(null);

  const model = useMemo(() => {
    const nodes: Node[] = [];
    const byId = new Map(recipes.map(r => [r.id, r]));
    const byName = new Map(recipes.map(r => [r.name, r]));
    function build(id: string, qty: number, key: string, depth: number, ancestors: Set<string>, parent?: Node): Node {
      const r = byId.get(id) ?? byName.get(id);
      const cycle = !!r && ancestors.has(r.id);
      const node: Node = { key, id, name: r?.name, quantity: qty, recipe: r, parent, depth, children: [], cycle, x: 0, y: 0 };
      nodes.push(node);
      if (r && !cycle && expanded.has(key) && depth < 6) {
        for (const [child, amount] of Object.entries(r.ingredients)) {
          node.children.push(build(child, qty * amount, `${key}/${child}`, depth + 1, new Set([...ancestors, r.id]), node));
        }
      }
      return node;
    }
    const root = build(recipe.id, quantity, 'root', 0, new Set());
    const weight = (node: Node): number => node.children.length ? node.children.reduce((sum, c) => sum + weight(c), 0) : 1;
    const leaves = weight(root);
    const ring = Math.max(240, leaves * 175 / (2 * Math.PI));
    function place(node: Node, start: number, end: number) {
      const angle = (start + end) / 2;
      node.x = node.depth * ring * Math.cos(angle); node.y = node.depth * ring * Math.sin(angle);
      let cursor = start;
      const total = weight(node);
      for (const child of node.children) { const next = cursor + (end - start) * weight(child) / total; place(child, cursor, next); cursor = next; }
    }
    place(root, -Math.PI / 2, Math.PI * 1.5);
    const extent = Math.max(340, ...nodes.map(n => Math.max(Math.abs(n.x), Math.abs(n.y)) + 110));
    return { nodes, root, size: extent * 2 };
  }, [recipe, recipes, quantity, expanded]);
  useEffect(() => {
    motion.current?.cancel();
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setSpread(1); return; }
    const value = { spread: .1 };
    motion.current = animate(value, { spread: 1, duration: 850, ease: 'outExpo', onUpdate: () => setSpread(value.spread) });
    return () => { motion.current?.cancel(); };
  }, [recipe.id]);
  useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const observer = new ResizeObserver(() => {
      setBounds({ width: element.clientWidth, height: element.clientHeight });
    });
    observer.observe(element);
    fit();
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      const current = cameraRef.current;
      const scale = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? element.clientHeight : 1;
      if (event.ctrlKey || event.metaKey) {
        const rect = element.getBoundingClientRect();
        updateCamera(zoomAt(current, current.zoom * Math.exp(-event.deltaY * scale * .01), event.clientX - rect.left - rect.width / 2, event.clientY - rect.top - rect.height / 2));
      } else updateCamera({ ...current, x: current.x - event.deltaX * scale, y: current.y - event.deltaY * scale });
    };
    let previousScale = 1;
    const gesture = (event: Event) => {
      event.preventDefault();
      const e = event as Event & { scale: number; clientX: number; clientY: number };
      if (e.type === 'gesturestart') { previousScale = e.scale || 1; return; }
      const rect = element.getBoundingClientRect();
      updateCamera(zoomAt(cameraRef.current, cameraRef.current.zoom * e.scale / previousScale, (e.clientX || rect.left + rect.width / 2) - rect.left - rect.width / 2, (e.clientY || rect.top + rect.height / 2) - rect.top - rect.height / 2));
      previousScale = e.scale;
    };
    element.addEventListener('wheel', wheel, { passive: false });
    element.addEventListener('gesturestart', gesture, { passive: false });
    element.addEventListener('gesturechange', gesture, { passive: false });
    return () => { observer.disconnect(); element.removeEventListener('wheel', wheel); element.removeEventListener('gesturestart', gesture); element.removeEventListener('gesturechange', gesture); };
  }, []);
  const center = model.size / 2;
  const missingTypes = Object.entries(recipe.ingredients).filter(([id, amount]) => amount * quantity > (stocks[id] ?? 0)).length;
  const readiness = quantity < 1 ? 'ระบุจำนวนที่ต้องการ' : missingTypes ? `ขาดวัตถุดิบ ${missingTypes} ชนิด` : 'วัตถุดิบพร้อมคราฟ';
  function toggle(node: Node) {
    setExpanded(current => { const next = new Set(current); if (next.has(node.key)) next.delete(node.key); else next.add(node.key); return next; });
  }
  return <section className="recipe-tree" aria-label="ต้นไม้ส่วนประกอบการคราฟ">
    <header className="recipe-tree__toolbar"><div><strong>แยกส่วนประกอบ</strong><span>ของสำเร็จอยู่กลาง · แตะวัตถุดิบเพื่อแตกสูตรต่อ</span></div><div><Button aria-label="ย่อผัง" onClick={() => updateCamera(zoomAt(cameraRef.current, cameraRef.current.zoom / 1.2, 0, 0))}>−</Button><span>{Math.round(camera.zoom * 100)}%</span><Button aria-label="ขยายผัง" onClick={() => updateCamera(zoomAt(cameraRef.current, cameraRef.current.zoom * 1.2, 0, 0))}>+</Button><Button onClick={fit}>พอดีจอ</Button></div></header>
    <div className="recipe-tree__viewport" ref={viewport} tabIndex={0} aria-label="ผังคราฟ จีบนิ้วเพื่อซูม เลื่อนสองนิ้วเพื่อเลื่อนผัง" onKeyDown={e => {
      if (e.target !== e.currentTarget) return;
      if (['+', '=', '-'].includes(e.key)) { e.preventDefault(); updateCamera(zoomAt(cameraRef.current, cameraRef.current.zoom * (e.key === '-' ? 1 / 1.2 : 1.2), 0, 0)); }
      if (e.key === '0') { e.preventDefault(); fit(); }
      const movement = { ArrowLeft: [40, 0], ArrowRight: [-40, 0], ArrowUp: [0, 40], ArrowDown: [0, -40] }[e.key];
      if (movement) { e.preventDefault(); updateCamera({ ...cameraRef.current, x: cameraRef.current.x + movement[0], y: cameraRef.current.y + movement[1] }); }
    }} onPointerDown={e => {
      if ((e.target as Element).closest('button') || e.button !== 0) return;
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY }); e.currentTarget.setPointerCapture(e.pointerId);
    }} onPointerMove={e => {
      if (!pointers.current.has(e.pointerId)) return;
      const before = [...pointers.current.values()];
      const previous = pointers.current.get(e.pointerId)!;
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const after = [...pointers.current.values()];
      if (before.length === 2) {
        const distance = (p: typeof before) => Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
        const oldMid = { x: (before[0].x + before[1].x) / 2, y: (before[0].y + before[1].y) / 2 };
        const newMid = { x: (after[0].x + after[1].x) / 2, y: (after[0].y + after[1].y) / 2 };
        const rect = e.currentTarget.getBoundingClientRect();
        const next = zoomAt(cameraRef.current, cameraRef.current.zoom * distance(after) / Math.max(1, distance(before)), oldMid.x - rect.left - rect.width / 2, oldMid.y - rect.top - rect.height / 2);
        updateCamera({ ...next, x: next.x + newMid.x - oldMid.x, y: next.y + newMid.y - oldMid.y });
      } else updateCamera({ ...cameraRef.current, x: cameraRef.current.x + e.clientX - previous.x, y: cameraRef.current.y + e.clientY - previous.y });
    }} onPointerUp={e => pointers.current.delete(e.pointerId)} onPointerCancel={e => pointers.current.delete(e.pointerId)} onLostPointerCapture={e => pointers.current.delete(e.pointerId)}>
      <svg width="100%" height="100%" aria-label={`สูตร ${recipe.name}`}>
        <g transform={`translate(${bounds.width / 2 + camera.x} ${bounds.height / 2 + camera.y}) scale(${camera.zoom}) translate(${-center} ${-center})`}>
        <circle cx={center} cy={center} r={240 * spread} className="recipe-tree__orbit" />
        {model.nodes.filter(n => n.parent).map(n => {
          const p = n.parent!;
          const x1 = center + p.x * spread, y1 = center + p.y * spread;
          const x2 = center + n.x * spread, y2 = center + n.y * spread;
          return <g key={`edge-${n.key}`}><path d={`M ${x1} ${y1} L ${x2} ${y2}`} className={`recipe-tree__edge depth-${n.depth % 3}`} /><circle cx={(x1 + x2) / 2} cy={(y1 + y2) / 2} r="4" className="recipe-tree__joint" /></g>;
        })}
        {model.nodes.map(n => {
          const isRoot = n.depth === 0;
          const canExpand = !!n.recipe && Object.keys(n.recipe.ingredients).length > 0 && !n.cycle && n.depth < 6;
          const missing = Math.max(0, n.quantity - (stocks[n.id] ?? 0));
          return <foreignObject key={n.key} x={center + n.x * spread - (isRoot ? 94 : 80)} y={center + n.y * spread - 100} width={isRoot ? 188 : 160} height="210" opacity={isRoot ? 1 : Math.max(.1, spread)}>
            <button className={`recipe-tree__node${isRoot ? ' is-root' : ''}${expanded.has(n.key) ? ' is-expanded' : ''}`} onClick={() => canExpand && toggle(n)} aria-label={`${n.name ?? 'วัตถุดิบ'} ${n.quantity} ชิ้น${canExpand ? expanded.has(n.key) ? ' หุบสูตร' : ' แตกสูตร' : ''}`} aria-expanded={canExpand ? expanded.has(n.key) : undefined} aria-disabled={!canExpand}>
              <span className="recipe-tree__portrait"><ItemThumbnail id={n.id} image={n.recipe?.image} size={isRoot ? 80 : 56} /></span>
              <ItemLabel id={n.id} name={n.name} size={0} />
              {isRoot ? <strong>ทำ {n.quantity.toLocaleString()} <small>ชิ้น</small></strong> : <>
                <span className="recipe-tree__stock-label">มี / ต้องใช้</span>
                <strong className="recipe-tree__stock"><span className={missing > 0 ? 'is-missing' : 'is-sufficient'}>{(stocks[n.id] ?? 0).toLocaleString()}</span><span className="recipe-tree__slash"> / </span>{n.quantity.toLocaleString()}</strong>
              </>}
              <span className="recipe-tree__hint">{isRoot ? readiness : n.cycle ? 'สูตรวนซ้ำ' : canExpand ? expanded.has(n.key) ? '− หุบส่วนประกอบ' : '+ ดูส่วนประกอบ' : n.depth >= 6 ? 'ถึงระดับที่ 6' : 'วัตถุดิบต้นทาง'}</span>
              {!isRoot && <span className={missing > 0 ? 'recipe-tree__short' : 'recipe-tree__enough'}>{missing > 0 ? `ขาด ${missing.toLocaleString()}` : '✓ มีครบ'}</span>}
            </button>
          </foreignObject>;
        })}
        </g>
      </svg>
    </div>
    <p className="recipe-tree__legend">มี / ต้องใช้ = สต็อกรวม / จำนวนตามสูตร · ยังไม่หักยอดจอง · แต่ละกิ่งเทียบสต็อกแยกกัน · จีบนิ้วเพื่อซูม · เลื่อนสองนิ้วเพื่อเลื่อนผัง</p>
  </section>;
}
