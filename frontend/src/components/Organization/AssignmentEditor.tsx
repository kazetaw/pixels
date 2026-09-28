import { useEffect, useState } from 'react';
import { Alert, Button, Empty, InputNumber, Popconfirm, Select, Spin } from 'antd';
import { fetchAssignments, saveAssignment, deleteAssignment, type ContributorAssignment } from '../../api/client';
import type { Recipe, StockMap } from '../../types';
import { CONTRIBUTOR_PROFILES, contributorLabel } from '../shared/contributors';
import { ItemLabel, itemSelectVisuals } from '../shared/ItemVisual';

export function AssignmentEditor({ recipes, stocks, itemNames }: {
  recipes: Recipe[]; stocks: StockMap; itemNames: Record<string, string>;
}) {
  const [rows, setRows] = useState<ContributorAssignment[]>([]);
  const [person, setPerson] = useState<string>();
  const [item, setItem] = useState<string>();
  const [target, setTarget] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  async function refresh() {
    try { setRows(await fetchAssignments()); setError(''); }
    catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }
  useEffect(() => { void refresh(); }, []);
  const options = recipes.filter(r => r.time_per_unit).map(r => ({ value: r.id, label: itemNames[r.id] || r.name }));
  const existing = rows.find(r => r.contributor === person && r.item_id === item);
  async function save() {
    if (!person || !item || !target || !Number.isSafeInteger(target)) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const saved = await saveAssignment({ contributor: person, item_id: item, target });
      setRows(prev => [...prev.filter(r => r.id !== saved.id), saved]);
      setItem(undefined); setTarget(null); setNotice('บันทึกงานส่วนกลางแล้ว');
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  async function remove(id: string) {
    setBusy(true); setError('');
    try { await deleteAssignment(id); setRows(prev => prev.filter(r => r.id !== id)); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  return <section className="assignment-editor">
    <p>เลือกคนและสินค้าที่ต้องทำ งานจะบันทึกส่วนกลาง ส่วนยอดเข้าคลังให้บันทึกผ่านจัดการงบประมาณเมื่อได้รับของจริง</p>
    {error && <Alert type="error" showIcon message="โหลดหรือบันทึกงานไม่สำเร็จ" description={error} action={<Button onClick={refresh}>ลองใหม่</Button>} />}
    {notice && <Alert type="success" showIcon message={notice} closable onClose={() => setNotice('')} />}
    <div className="assignment-entry">
      <label>ผู้รับผิดชอบ<Select aria-label="ผู้รับผิดชอบ" value={person} onChange={setPerson} placeholder="เลือกคน" showSearch optionFilterProp="label" options={CONTRIBUTOR_PROFILES.map(p => ({ value: p.name, label: contributorLabel(p.name) }))} /></label>
      <label>สินค้าแปรรูป<Select aria-label="สินค้าแปรรูปที่มอบหมาย" value={item} onChange={setItem} placeholder="ค้นหาสินค้า" showSearch optionFilterProp="label" options={options} {...itemSelectVisuals} /></label>
      <label>จำนวนที่ต้องทำ<InputNumber aria-label="จำนวนที่ต้องทำ" value={target} onChange={setTarget} min={1} max={Number.MAX_SAFE_INTEGER} precision={0} /></label>
      <Button type="primary" loading={busy} disabled={loading || !person || !item || !target || !!error} onClick={save}>{existing ? 'แก้จำนวนเป้าหมาย' : 'มอบหมายงาน'}</Button>
    </div>
    {existing && <p>มีงานนี้แล้ว {existing.target.toLocaleString()} ชิ้น — บันทึกเพื่อเปลี่ยนจำนวนเป้าหมาย</p>}
    {loading ? <Spin /> : rows.length === 0 ? <Empty description="ยังไม่มีงานที่บันทึกส่วนกลาง" /> :
      <div className="assignment-groups">{[...new Set(rows.map(r => r.contributor))].map(name => <article key={name}>
        <h3>{contributorLabel(name)}</h3>
        {rows.filter(r => r.contributor === name).map(row => <div className="assignment-row" key={row.id}>
          <ItemLabel id={row.item_id} name={itemNames[row.item_id] || recipes.find(r => r.id === row.item_id)?.name || 'ไม่พบชื่อสินค้า'} />
          <div>ต้องทำ <strong>{row.target.toLocaleString()}</strong> ชิ้น<small>คลังรวมทีม {(stocks[row.item_id] ?? 0).toLocaleString()} ชิ้น</small></div>
          <div className="assignment-actions"><Button disabled={busy} onClick={() => { setPerson(row.contributor); setItem(row.item_id); setTarget(row.target); setNotice(''); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>แก้ไข</Button>
          <Popconfirm title="ลบงานนี้? ยอดในคลังไม่เปลี่ยน" onConfirm={() => remove(row.id)}><Button danger disabled={busy}>ลบ</Button></Popconfirm></div>
        </div>)}
      </article>)}</div>}
  </section>;
}
