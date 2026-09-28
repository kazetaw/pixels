import { CONTRIBUTOR_PROFILES, contributorLabel } from '../shared/contributors';
import { useEffect, useState } from 'react';
import { Alert, Button, Input, InputNumber, Popconfirm, Select, Tag } from 'antd';
import { ItemLabel, itemSelectVisuals } from '../shared/ItemVisual';
import { fetchAllData } from '../../api/client';
import type { AppData } from '../../types';
type Line = { item_id: string; quantity: number };
type Ticket = { requester_name: string; recipient_name: string; id: string; character_id: string; note: string; status: 'pending'|'sent'|'cancelled'; created_at: string; withdrawal_lines: Line[] };
const labels = { pending: 'รอจัดส่ง', sent: 'ส่งแล้ว', cancelled: 'ยกเลิก' };
async function request(method = 'GET', body?: unknown, id = '') {
  const response = await fetch(`/api/withdrawals${id ? '/' + id : ''}`, { method, headers: { 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'ดำเนินการไม่สำเร็จ');
  return result;
}
export function Withdrawals({ admin = false, onData }: { admin?: boolean; onData: (data: AppData) => void }) {
  const [data, setData] = useState<AppData>();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [character, setCharacter] = useState(() => localStorage.getItem('withdrawal-character') || '');
  const [note, setNote] = useState('');
  const [requester, setRequester] = useState('');
  const [requesterOther, setRequesterOther] = useState('');
  const [recipient, setRecipient] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const peopleOptions = [...CONTRIBUTOR_PROFILES.map(p=>({value:p.name,label:contributorLabel(p.name)})),{value:'other',label:'อื่น ๆ / ตัวรอง'}];
  const requesterName = requester === 'other' ? requesterOther.trim() : requester;
  const [lines, setLines] = useState<Line[]>([{item_id:'',quantity:99}]);
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState('');
  const [catalog, setCatalog] = useState<{item_id: string; enabled: boolean}[]>([]);
  const [newItem, setNewItem] = useState<string>();
  async function refresh() {
    const [next, stock, allowed] = await Promise.all([request(), fetchAllData(), request('GET', undefined, 'catalog')]);
    setCatalog(allowed);
    setTickets(next); setData(stock); onData(stock);
  }
  useEffect(() => { void refresh().catch(e => setError(e.message)); }, []);
  const reserved = (id: string) => tickets.filter(t => t.status === 'pending').flatMap(t => t.withdrawal_lines).filter(l => l.item_id === id).reduce((n,l) => n+l.quantity,0);
  const options = Object.entries(data?.itemNames ?? {}).filter(([id]) => catalog.some(c => c.item_id === id && c.enabled)).map(([id,name]) => ({ value:id, label: name, available: Math.max(0,(data?.stocks[id] ?? 0)-reserved(id)) }));
  const patchLine = (index: number, patch: Partial<Line>) => { setLines(prev => prev.map((l,i) => i === index ? {...l,...patch} : l)); setRequestId(crypto.randomUUID()); };
  async function submit() {
    setBusy(true); setError(''); setSuccess('');
    try {
      await request('POST', {id:requestId,character_id:character.trim(),note,lines,requester_name:requesterName,recipient_name:recipientName.trim()});
      localStorage.setItem('withdrawal-character',character.trim());
      setSuccess(`สร้างใบเบิกแล้ว เลขใบเบิก ${requestId}`); setRequestId(crypto.randomUUID()); setLines([{item_id:'',quantity:99}]); setNote('');
      await refresh();
    } catch(e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  async function change(ticket: Ticket,status: string) {
    setBusy(true); setError('');
    try { await request('PATCH',{status},ticket.id); await refresh(); } catch(e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  async function setAllowed(item_id: string, enabled: boolean) {
    setBusy(true); setError('');
    try { await request('PUT', {item_id, enabled}, 'catalog'); await refresh(); setNewItem(undefined); }
    catch(e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  const visible = tickets.filter(t => !filter || t.character_id.includes(filter)).sort((a,b) => Number(b.status === 'pending')-Number(a.status === 'pending'));
  return <section className="withdrawals"><h2>{admin ? 'จัดการใบเบิก' : 'เบิกสินค้า'}</h2>
    <p>จองของเมื่อสร้างใบเบิก · หักสต็อกเมื่อส่งแล้ว · ยกเลิกแล้วคืนยอดจอง</p>
    {error && <Alert type="error" message={error} action={<Button onClick={() => { setError(''); void refresh().catch(e=>setError(e.message)); }}>โหลดใหม่</Button>} />}
    {success && <Alert type="success" message={success} />}
    {admin && <section className="withdrawal-ticket"><h3>สินค้าที่เปิดให้เบิก</h3><p>เลือกจากสต็อก · ปิดแล้วใบเบิกเดิมยังดำเนินการได้</p>
      <div className="withdrawal-toolbar"><Select style={{width:'min(100%, 360px)'}} aria-label="เพิ่มสินค้าเปิดให้เบิก" placeholder="ค้นหาสินค้าในคลัง" showSearch optionFilterProp="label" value={newItem} onChange={setNewItem} disabled={busy} options={Object.keys(data?.stocks ?? {}).filter(id=>!catalog.some(c=>c.item_id===id && c.enabled)).map(id=>({value:id,label:data?.itemNames[id] || 'ไม่พบชื่อสินค้า'}))} {...itemSelectVisuals} /><Button type="primary" disabled={!newItem || busy} onClick={()=>newItem && void setAllowed(newItem,true)}>เปิดให้เบิก</Button></div>
      {catalog.filter(c=>c.enabled).map(c=><div className="withdrawal-ticket-line" key={c.item_id}><ItemLabel id={c.item_id} name={data?.itemNames[c.item_id] || 'ไม่พบชื่อสินค้า'} reserveImage /><Popconfirm title="ปิดรับใบเบิกใหม่สำหรับสินค้านี้?" onConfirm={()=>setAllowed(c.item_id,false)}><Button disabled={busy}>ปิดให้เบิก</Button></Popconfirm></div>)}
    </section>}
    {!admin && <fieldset disabled={busy} className="withdrawal-form">
      <label>ผู้เบิก<Select aria-label="ผู้เบิก" disabled={busy} placeholder="เลือกคนที่เบิก" options={peopleOptions} value={requester || undefined} onChange={value=>{setRequester(value);setRequestId(crypto.randomUUID());}} /></label>
      {requester === 'other' && <label>ชื่อผู้เบิก<Input maxLength={100} value={requesterOther} onChange={e=>{setRequesterOther(e.target.value);setRequestId(crypto.randomUUID());}} /></label>}
      <label>ส่งให้ตัวละคร<Select aria-label="ตัวละครผู้รับ" disabled={busy} placeholder="เลือกสมาชิก หรืออื่น ๆ / ตัวรอง" options={peopleOptions} value={recipient || undefined} onChange={value=>{
        setRecipient(value); const profile = CONTRIBUTOR_PROFILES.find(p=>p.name===value);
        setRecipientName(profile?.name ?? ''); setCharacter(profile?.memberId ?? ''); setRequestId(crypto.randomUUID());
      }} /></label>
      <label>ชื่อตัวละครผู้รับ<Input maxLength={100} value={recipientName} onChange={e=>{setRecipientName(e.target.value);setRequestId(crypto.randomUUID());}} /></label>
      <label>ไอดีตัวละครผู้รับ<Input value={character} inputMode="numeric" onChange={e => {setCharacter(e.target.value);setRequestId(crypto.randomUUID());}} /></label>
      {lines.map((line,index) => <div className="withdrawal-line" key={index}>
        <Select aria-label="สินค้าเบิก" disabled={busy} placeholder="เลือกสินค้า" showSearch optionFilterProp="label" value={line.item_id || undefined} onChange={id=>patchLine(index,{item_id:id})} options={options} {...itemSelectVisuals} />
        <InputNumber aria-label="จำนวนเบิก" disabled={busy} min={1} max={2147483647} precision={0} value={line.quantity} onChange={quantity=>patchLine(index,{quantity:quantity ?? 0})} />
        <Button disabled={busy} onClick={()=>patchLine(index,{quantity:line.quantity+99})}>+99</Button>
        <Button disabled={busy || lines.length===1} danger onClick={()=>{setLines(lines.filter((_,i)=>i!==index));setRequestId(crypto.randomUUID());}}>ลบ</Button>
        {line.item_id && <small>เหลือให้จอง {options.find(o=>o.value===line.item_id)?.available.toLocaleString() ?? 0} ชิ้น</small>}
      </div>)}
      <Button disabled={busy || lines.length>=50} onClick={()=>{setLines([...lines,{item_id:'',quantity:99}]);setRequestId(crypto.randomUUID());}}>เพิ่มสินค้า</Button>
      <label>หมายเหตุ (ไม่บังคับ)<Input.TextArea maxLength={1000} value={note} onChange={e=>{setNote(e.target.value);setRequestId(crypto.randomUUID());}} /></label>
      <Button type="primary" loading={busy} disabled={!data || !requesterName || !recipientName.trim() || !/^\d{1,30}$/.test(character.trim()) || lines.some(l=>!l.item_id || !Number.isSafeInteger(l.quantity) || l.quantity<=0)} onClick={submit}>สร้างใบเบิกและจองของ</Button>
    </fieldset>}
    <div className="withdrawal-toolbar"><h3>ใบเบิกสินค้า</h3><Input placeholder="ค้นหาไอดีตัวละคร" value={filter} onChange={e=>setFilter(e.target.value)} /><Button disabled={busy} onClick={()=>void refresh().catch(e=>setError(e.message))}>รีเฟรช</Button></div>
    {visible.map(t=><article className="withdrawal-ticket" key={t.id}>
      <header><strong>ผู้รับ {t.recipient_name || 'ไม่ระบุชื่อ'} ({t.character_id})</strong><Tag color={t.status==='pending'?'gold':t.status==='sent'?'green':'default'}>{labels[t.status]}</Tag></header>
      <p>ผู้เบิก: {t.requester_name || 'ไม่ระบุ (ใบเบิกเดิม)'}</p><small>ใบเบิก {t.id} · {new Date(t.created_at).toLocaleString('th-TH')}</small>
      {t.withdrawal_lines.map(l=><div className="withdrawal-ticket-line" key={l.item_id}><ItemLabel id={l.item_id} name={data?.itemNames[l.item_id] ?? 'ไม่พบชื่อสินค้า'} reserveImage /><strong>{l.quantity.toLocaleString()} ชิ้น</strong></div>)}
      {t.note && <p>{t.note}</p>}
      {admin && <div className="withdrawal-toolbar"><Button onClick={()=>void navigator.clipboard.writeText(t.character_id).catch(()=>setError('คัดลอกไม่ได้ กรุณาคัดลอกไอดีด้วยตนเอง'))}>คัดลอกไอดี</Button>{t.status==='pending' && <><Popconfirm title="ยืนยันส่งของแล้วและหักสต็อก?" onConfirm={()=>change(t,'sent')}><Button disabled={busy} type="primary">ส่งแล้ว</Button></Popconfirm><Popconfirm title="ยกเลิกใบเบิกและคืนยอดจอง?" onConfirm={()=>change(t,'cancelled')}><Button disabled={busy} danger>ยกเลิก</Button></Popconfirm></>}</div>}
    </article>)}
    {data && !visible.length && <p>ยังไม่มีใบเบิกที่ตรงกับรายการค้นหา</p>}
  </section>;
}
