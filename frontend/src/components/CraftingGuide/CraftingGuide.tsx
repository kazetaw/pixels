import { useState } from 'react';
import { Button, Empty, Input, InputNumber, Select, Switch } from 'antd';
import { RecipeTree } from './RecipeTree';
import type { Machine, Recipe, StockMap } from '../../types';
import { ItemLabel, ItemThumbnail } from '../shared/ItemVisual';
import './CraftingGuide.css';

export function CraftingGuide({ recipes, machines, stocks }: { recipes: Recipe[]; machines: Machine[]; stocks: StockMap }) {
  const [path, setPath] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [occupation, setOccupation] = useState('ทั้งหมด');
  const [quantity, setQuantity] = useState<number | null>(1);
  const [unit, setUnit] = useState('pieces');
  const [missingOnly, setMissingOnly] = useState(false);
  const recipe = recipes.find(r => r.id === path[path.length - 1]) ?? recipes[0];
  const machine = machines.find(m => m.machine_id === recipe?.machine_id);
  const count = Math.max(0, quantity ?? 0) * (unit === 'stacks' ? 99 : 1);
  const rows = Object.entries(recipe?.ingredients ?? {}).map(([id, amount]) => ({ id, needed: amount * count, owned: stocks[id] ?? 0, child: recipes.find(r => r.id === id || r.name === id) }));
  const filtered = recipes.filter(r => r.name.toLocaleLowerCase().includes(search.toLocaleLowerCase()) && (occupation === 'ทั้งหมด' || machines.find(m => m.machine_id === r.machine_id)?.occupation === occupation));
  if (!recipe) return <Empty description="ยังไม่มีสูตรคราฟ เพิ่มสูตรในจัดการข้อมูลก่อน" />;
  return <div className="craft-guide">
    <header><span className="craft-guide__eyebrow">ห้องทดลองการคราฟ</span><h1>แกะสูตร ดูทุกส่วนประกอบ</h1><p>เลือกของที่อยากทำ แล้วไล่ดูส่วนประกอบจากตรงกลางออกไป</p></header>
    <div className="craft-guide__layout">
      <aside className="craft-guide__catalog">
        <Input.Search aria-label="ค้นหาสูตรคราฟ" placeholder="ค้นหาของที่อยากทำ" value={search} onChange={e => setSearch(e.target.value)} />
        <Select aria-label="หมวดอาชีพ" value={occupation} onChange={setOccupation} options={['ทั้งหมด', ...new Set(machines.map(m => m.occupation).filter(Boolean))].map(value => ({ value, label: value }))} />
        <div className="craft-guide__recipes">{filtered.map(r => <button key={r.id} className={r.id === recipe.id ? 'is-active' : ''} onClick={() => setPath([r.id])} aria-pressed={r.id === recipe.id}><ItemLabel id={r.id} name={r.name} image={r.image} size={36} reserveImage /></button>)}{!filtered.length && <Empty description="ไม่พบสูตรที่ค้นหา" />}</div>
      </aside>
      <main className="craft-guide__workbench">
        <nav aria-label="เส้นทางสูตรคราฟ" className="craft-guide__trail">{path.length > 1 && path.map((id, index) => <Button key={`${id}-${index}`} type="text" onClick={() => setPath(path.slice(0, index + 1))}>{recipes.find(r => r.id === id)?.name ?? id}{index < path.length - 1 ? ' ›' : ''}</Button>)}</nav>
        <div className="craft-guide__title"><ItemThumbnail id={recipe.id} image={recipe.image} size={76} /><div><h2>{recipe.name}</h2><p>{machine?.occupation ?? 'สูตรการผลิต'} · {recipe.time_per_unit ? `${recipe.time_per_unit} / ชิ้น` : 'ยังไม่ระบุเวลา'}</p></div></div>
        <div className="craft-guide__controls"><label htmlFor="craft-count">ต้องการทำ</label><InputNumber id="craft-count" min={1} max={1000000} precision={0} value={quantity} onChange={setQuantity} /><Select aria-label="หน่วยการคราฟ" value={unit} onChange={setUnit} options={[{ value: 'pieces', label: 'ชิ้น' }, { value: 'stacks', label: 'กอง (99 ชิ้น)' }]} /><strong>{count.toLocaleString()} ชิ้น</strong></div>
        <RecipeTree key={recipe.id} recipe={recipe} recipes={recipes} stocks={stocks} quantity={count} />
        <details className="craft-guide__material-details"><summary>รายละเอียดวัตถุดิบ</summary>
        <div className="craft-guide__materials-head"><h3>ของที่ต้องเตรียม</h3><label><Switch size="small" checked={missingOnly} onChange={setMissingOnly} /> เฉพาะที่ขาด</label></div>
        <p className="craft-guide__note">เทียบกับสต็อกรวม ยังไม่หักยอดจอง · แตะ “ดูสูตร” เพื่อดูวิธีทำวัตถุดิบนั้น</p>
        <div className="craft-guide__materials">{rows.filter(row => !missingOnly || row.needed > row.owned).map(row => <article key={row.id}><ItemLabel id={row.id} name={row.child?.name} size={40} reserveImage /><div><strong>ใช้ {row.needed.toLocaleString()}</strong><span>มี {row.owned.toLocaleString()}</span><b className={row.needed > row.owned ? 'is-short' : 'is-ready'}>{row.needed > row.owned ? `ขาด ${(row.needed - row.owned).toLocaleString()}` : 'ครบแล้ว'}</b></div>{row.child && <Button disabled={path.includes(row.child.id) || row.child.id === recipe.id} onClick={() => { setPath([... (path.length ? path : [recipe.id]), row.child!.id]); setQuantity(Math.max(1, Math.ceil(row.needed))); setUnit('pieces'); }}>ดูสูตร</Button>}</article>)}</div>
        {rows.filter(row => !missingOnly || row.needed > row.owned).length === 0 && <p className="craft-guide__ready">{rows.length ? 'วัตถุดิบสำหรับขั้นตอนนี้ครบแล้ว' : 'สูตรนี้ไม่ต้องใช้วัตถุดิบ'}</p>}
        </details>
      </main>
    </div>
  </div>;
}
