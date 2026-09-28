import { UserOutlined } from '@ant-design/icons';
import type { SelectProps } from 'antd';
import { CONTRIBUTOR_PROFILES } from '../shared/contributors';
import { useEffect, useState } from 'react';
import { Avatar, Alert, Button, Input, InputNumber, Popconfirm, Select, Tag } from 'antd';
import { ItemLabel } from '../shared/ItemVisual';
import { fetchAllData } from '../../api/client';
import type { AppData } from '../../types';
function PersonLabel({ name, characterId, size = 26 }: { name: string; characterId?: string; size?: number }) {
  const profile = CONTRIBUTOR_PROFILES.find(p => characterId ? p.memberId === characterId : p.name === name);
  return <span className="withdrawal-person-label"><Avatar size={size} src={profile?.avatar} style={{ background: '#ede9fe', color: '#7c3aed', flexShrink: 0, transform: profile?.flipAvatar ? 'scaleX(-1)' : undefined }} icon={<UserOutlined />} /><span>{name === 'other' ? 'อื่น ๆ / ตัวรอง' : name || 'ไม่ระบุชื่อ'}</span></span>;
}
const personSelectVisuals: Pick<SelectProps, 'optionRender' | 'labelRender'> = {
  optionRender: option => <PersonLabel name={String(option.value ?? '')} />,
  labelRender: option => <PersonLabel name={String(option.value ?? '')} size={24} />,
};
const withdrawalItemVisuals: Pick<SelectProps, 'optionRender' | 'labelRender'> = {
  optionRender: option => <ItemLabel id={String(option.value ?? '')} name={option.label} reserveImage />,
  labelRender: option => <ItemLabel id={String(option.value ?? '')} name={option.label} size={24} reserveImage />,
};
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
  const peopleOptions = [...CONTRIBUTOR_PROFILES.map(p=>({value:p.name,label:p.name})),{value:'other',label:'อื่น ๆ / ตัวรอง'}];
  const requesterName = requester === 'other' ? requesterOther.trim() : requester;
  const [lines, setLines] = useState<Line[]>([{item_id:'',quantity:99}]);
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>();
  const [personFilter, setPersonFilter] = useState<string>();
  const [productFilter, setProductFilter] = useState<string>();
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
  const query = filter.trim().toLocaleLowerCase('th');
  const visible = tickets.filter(t =>
    (!statusFilter || t.status === statusFilter)
    && (!personFilter || t.requester_name === personFilter)
    && (!productFilter || t.withdrawal_lines.some(l => l.item_id === productFilter))
    && (!query || [t.id, t.character_id, t.requester_name, t.recipient_name, ...t.withdrawal_lines.map(l => data?.itemNames[l.item_id])].some(value => value?.toLocaleLowerCase('th').includes(query)))
  ).sort((a,b) => Number(b.status === 'pending')-Number(a.status === 'pending'));
  const historyProducts = [...new Set(tickets.flatMap(t => t.withdrawal_lines.map(l => l.item_id)))].map(id => ({ value: id, label: data?.itemNames[id] || 'ไม่พบชื่อสินค้า' }));

  return <section className="withdrawals"><h2 className="withdrawal-title">{admin ? 'จัดการใบเบิก' : 'เบิกสินค้า'}</h2>
    <p className="withdrawal-intro">เลือกคน เลือกของ แล้วส่งใบเบิกได้เลย</p>
    {error && <Alert type="error" message={error} action={<Button onClick={() => { setError(''); void refresh().catch(e=>setError(e.message)); }}>โหลดใหม่</Button>} />}
    {success && <Alert type="success" message={success} />}
    {admin && <details className="withdrawal-ticket"><summary>สินค้าที่เปิดให้เบิก ({catalog.filter(c=>c.enabled).length})</summary><p>เลือกจากสต็อก · ปิดแล้วใบเบิกเดิมยังดำเนินการได้</p>
      <div className="withdrawal-toolbar"><Select style={{width:'min(100%, 360px)'}} aria-label="เพิ่มสินค้าเปิดให้เบิก" placeholder="ค้นหาสินค้าในคลัง" showSearch optionFilterProp="label" value={newItem} onChange={setNewItem} disabled={busy} options={Object.keys(data?.stocks ?? {}).filter(id=>!catalog.some(c=>c.item_id===id && c.enabled)).map(id=>({value:id,label:data?.itemNames[id] || 'ไม่พบชื่อสินค้า'}))} {...withdrawalItemVisuals} /><Button type="primary" disabled={!newItem || busy} onClick={()=>newItem && void setAllowed(newItem,true)}>เปิดให้เบิก</Button></div>
      {catalog.filter(c=>c.enabled).map(c=><div className="withdrawal-ticket-line" key={c.item_id}><ItemLabel id={c.item_id} name={data?.itemNames[c.item_id] || 'ไม่พบชื่อสินค้า'} reserveImage /><Popconfirm title="ปิดรับใบเบิกใหม่สำหรับสินค้านี้?" onConfirm={()=>setAllowed(c.item_id,false)}><Button disabled={busy}>ปิดให้เบิก</Button></Popconfirm></div>)}
    </details>}
    {!admin && <fieldset disabled={busy} className="withdrawal-form">
      <div className="withdrawal-people"><label>ผู้เบิก<Select {...personSelectVisuals} aria-label="ผู้เบิก" disabled={busy} placeholder="เลือกคนที่เบิก" options={peopleOptions} value={requester || undefined} onChange={value=>{setRequester(value);if(value !== 'other'){const person=CONTRIBUTOR_PROFILES.find(p=>p.name===value);setRecipient(value);setRecipientName(person?.name ?? '');setCharacter(person?.memberId ?? '');}setRequestId(crypto.randomUUID());}} /></label>
      {requester === 'other' && <label>ชื่อผู้เบิก<Input maxLength={100} value={requesterOther} onChange={e=>{setRequesterOther(e.target.value);setRequestId(crypto.randomUUID());}} /></label>}
      <label>ส่งให้ตัวละคร<Select {...personSelectVisuals} aria-label="ตัวละครผู้รับ" disabled={busy} placeholder="เลือกผู้รับ" options={peopleOptions} value={recipient || undefined} onChange={value=>{
        setRecipient(value); const profile = CONTRIBUTOR_PROFILES.find(p=>p.name===value);
        setRecipientName(profile?.name ?? ''); setCharacter(profile?.memberId ?? ''); setRequestId(crypto.randomUUID());
      }} /></label>
      {recipient && recipient !== 'other' && <span className="withdrawal-recipient-id">ไอดี {character}</span>}
      </div>
      {recipient === 'other' && <div className="withdrawal-custom-recipient"><label>ชื่อตัวละครผู้รับ<Input maxLength={100} value={recipientName} onChange={e=>{setRecipientName(e.target.value);setRequestId(crypto.randomUUID());}} /></label>
      <label>ไอดีตัวละครผู้รับ<Input value={character} inputMode="numeric" onChange={e => {setCharacter(e.target.value);setRequestId(crypto.randomUUID());}} /></label></div>}
      <div className="withdrawal-items-heading"><strong>สินค้า</strong><span>จำนวน (ชิ้น)</span></div>
      {lines.map((line,index) => <div className="withdrawal-line" key={index}>
        <Select aria-label="สินค้าเบิก" disabled={busy} placeholder="เลือกสินค้า" showSearch optionFilterProp="label" value={line.item_id || undefined} onChange={id=>patchLine(index,{item_id:id})} options={options} {...withdrawalItemVisuals} />
        <InputNumber aria-label="จำนวนเบิก" disabled={busy} min={1} max={2147483647} precision={0} value={line.quantity} onChange={quantity=>patchLine(index,{quantity:quantity ?? 0})} />
        <Button disabled={busy} onClick={()=>patchLine(index,{quantity:line.quantity+99})}>+99</Button>
        <Button disabled={busy || lines.length===1} danger onClick={()=>{setLines(lines.filter((_,i)=>i!==index));setRequestId(crypto.randomUUID());}}>ลบ</Button>
        {line.item_id && <small>เหลือให้จอง {options.find(o=>o.value===line.item_id)?.available.toLocaleString() ?? 0} ชิ้น</small>}
      </div>)}
      <Button className="withdrawal-add" type="dashed" disabled={busy || lines.length>=50} onClick={()=>{setLines([...lines,{item_id:'',quantity:99}]);setRequestId(crypto.randomUUID());}}>เพิ่มสินค้า</Button>
      <details className="withdrawal-note"><summary>เพิ่มหมายเหตุ</summary><Input.TextArea aria-label="หมายเหตุ" maxLength={1000} value={note} onChange={e=>{setNote(e.target.value);setRequestId(crypto.randomUUID());}} /></details>
      <div className="withdrawal-submit"><span>{lines.filter(l=>l.item_id).length} รายการ · จองของเมื่อส่งใบเบิก</span><Button type="primary" loading={busy} disabled={!data || !requesterName || !recipientName.trim() || !/^\d{1,30}$/.test(character.trim()) || lines.some(l=>!l.item_id || !Number.isSafeInteger(l.quantity) || l.quantity<=0)} onClick={submit}>ส่งใบเบิก</Button></div>
    </fieldset>}
    <div className="withdrawal-history-heading"><h3>ใบเบิกสินค้า <small>{visible.length} / {tickets.length} ใบ</small></h3><Button disabled={busy} onClick={()=>void refresh().catch(e=>setError(e.message))}>รีเฟรช</Button></div>
    <div className="withdrawal-history-filters">
      <Input.Search aria-label="ค้นหาใบเบิก" placeholder="ชื่อ ไอดี เลขใบเบิก หรือสินค้า" allowClear value={filter} onChange={e=>setFilter(e.target.value)} />
      <Select aria-label="กรองสถานะ" placeholder="ทุกสถานะ" allowClear value={statusFilter} onChange={setStatusFilter} options={Object.entries(labels).map(([value,label])=>({value,label}))} />
      <Select {...personSelectVisuals} aria-label="กรองผู้เบิก" placeholder="ผู้เบิกทุกคน" allowClear showSearch optionFilterProp="label" value={personFilter} onChange={setPersonFilter} options={[...new Set(tickets.map(t=>t.requester_name).filter(Boolean))].map(name=>({value:name,label:name}))} />
      <Select aria-label="กรองสินค้า" placeholder="สินค้าทั้งหมด" allowClear showSearch optionFilterProp="label" value={productFilter} onChange={setProductFilter} options={historyProducts} {...withdrawalItemVisuals} />
      {(filter || statusFilter || personFilter || productFilter) && <Button type="text" onClick={()=>{setFilter('');setStatusFilter(undefined);setPersonFilter(undefined);setProductFilter(undefined);}}>ล้างตัวกรอง</Button>}
    </div>
    {visible.map(t=><article className="withdrawal-ticket" key={t.id}>
      <header><div className="withdrawal-ticket-recipient"><PersonLabel name={t.recipient_name || 'ไม่ระบุชื่อ'} characterId={t.character_id} size={36} /><small>ผู้รับ · ID {t.character_id}</small></div><Tag color={t.status==='pending'?'gold':t.status==='sent'?'green':'default'}>{labels[t.status]}</Tag></header>
      <div className="withdrawal-ticket-meta"><small>เบิกโดย</small><PersonLabel name={t.requester_name || 'ไม่ระบุ'} size={22} /><small>{new Date(t.created_at).toLocaleString('th-TH')}</small></div>
      <details className="withdrawal-ticket-details"><summary>{t.withdrawal_lines.length} รายการ · ดูรายละเอียด</summary><small>ใบเบิก {t.id}</small>
      {t.withdrawal_lines.map(l=><div className="withdrawal-ticket-line" key={l.item_id}><ItemLabel id={l.item_id} name={data?.itemNames[l.item_id] ?? 'ไม่พบชื่อสินค้า'} reserveImage /><strong>{l.quantity.toLocaleString()} ชิ้น</strong></div>)}
      {t.note && <p>{t.note}</p>}
      </details>
      {admin && <div className="withdrawal-toolbar"><Button onClick={()=>void navigator.clipboard.writeText(t.character_id).catch(()=>setError('คัดลอกไม่ได้ กรุณาคัดลอกไอดีด้วยตนเอง'))}>คัดลอกไอดี</Button>{t.status==='pending' && <><Popconfirm title="ยืนยันส่งของแล้วและหักสต็อก?" onConfirm={()=>change(t,'sent')}><Button disabled={busy} type="primary">ส่งแล้ว</Button></Popconfirm><Popconfirm title="ยกเลิกใบเบิกและคืนยอดจอง?" onConfirm={()=>change(t,'cancelled')}><Button disabled={busy} danger>ยกเลิก</Button></Popconfirm></>}</div>}
    </article>)}
    {data && !visible.length && <p>ยังไม่มีใบเบิกที่ตรงกับรายการค้นหา</p>}
  </section>;
}
