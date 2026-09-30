import { UserOutlined } from '@ant-design/icons';
import type { SelectProps } from 'antd';
import { CONTRIBUTOR_PROFILES } from '../shared/contributors';
import { useEffect, useRef, useState } from 'react';
import { Avatar, Alert, Button, Input, InputNumber, Modal, Pagination, Popconfirm, Select, Tag } from 'antd';
import { MinusCircleOutlined, PlusCircleOutlined } from '@ant-design/icons';
import { ItemLabel } from '../shared/ItemVisual';
import { fetchAllData, partialFulfillWithdrawal, createStockAdjustment, fetchStockAdjustments, type ActualLine, type StockAdjustment } from '../../api/client';
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

// ── Manual stock adjustment panel ────────────────────────────────────────────
function StockAdjustPanel({ data, onDone }: {
  data: AppData | undefined;
  onDone: () => void;
}) {
  const [itemId, setItemId] = useState<string>();
  const [delta, setDelta] = useState<number | null>(null);
  const [isDeduct, setIsDeduct] = useState(true);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [log, setLog] = useState<StockAdjustment[]>([]);
  const [loadingLog, setLoadingLog] = useState(true);

  useEffect(() => {
    void fetchStockAdjustments(20)
      .then(setLog)
      .catch(() => {/* silent */})
      .finally(() => setLoadingLog(false));
  }, []);

  const itemOptions = Object.entries(data?.itemNames ?? {})
    .map(([id, name]) => ({ value: id, label: name }))
    .sort((a, b) => a.label.localeCompare(b.label, 'th'));

  async function submit() {
    if (!itemId || !delta || delta <= 0) return;
    setBusy(true); setError('');
    try {
      const actualDelta = isDeduct ? -delta : delta;
      await createStockAdjustment(itemId, actualDelta, reason.trim());
      setLog(prev => [{
        id: crypto.randomUUID(), item_id: itemId,
        delta: actualDelta, reason: reason.trim(),
        created_at: new Date().toISOString(),
      }, ...prev].slice(0, 20));
      setDelta(null); setReason(''); setItemId(undefined);
      onDone();
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }

  return (
    <div className="adm-adjust-panel">
      <div className="adm-catalog-header">
        <div>
          <strong>ปรับสต็อกด้วยมือ</strong>
        </div>
      </div>

      {error && <div style={{ padding: '8px 16px' }}><Alert type="error" message={error} showIcon /></div>}

      <div className="adm-adjust-form">
        {/* Mode toggle */}
        <div className="adm-adjust-mode">
          <button
            className={`adm-adjust-mode-btn${isDeduct ? ' active-deduct' : ''}`}
            onClick={() => setIsDeduct(true)}
          >
            <MinusCircleOutlined /> หักออก
          </button>
          <button
            className={`adm-adjust-mode-btn${!isDeduct ? ' active-add' : ''}`}
            onClick={() => setIsDeduct(false)}
          >
            <PlusCircleOutlined /> เพิ่มเข้า
          </button>
        </div>

        <Select
          showSearch
          optionFilterProp="label"
          value={itemId}
          onChange={setItemId}
          placeholder="เลือกสินค้า…"
          options={itemOptions}
          style={{ width: '100%' }}
          disabled={busy}
        />

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <InputNumber
            min={1}
            precision={0}
            value={delta}
            onChange={setDelta}
            placeholder="จำนวน"
            style={{ flex: 1 }}
            disabled={busy}
          />
          {itemId && data && (
            <span style={{ fontSize: 12, color: '#64748b', whiteSpace: 'nowrap' }}>
              คลัง {(data.stocks[itemId] ?? 0).toLocaleString('th-TH')}
            </span>
          )}
        </div>

        <Input.TextArea
          value={reason}
          onChange={e => setReason(e.target.value)}
          placeholder="เหตุผล เช่น แจกไปก่อนมีระบบ / รับของเพิ่ม"
          autoSize={{ minRows: 2, maxRows: 3 }}
          maxLength={300}
          disabled={busy}
        />

        <Button
          type="primary"
          loading={busy}
          disabled={!itemId || !delta || delta <= 0}
          onClick={() => void submit()}
          danger={isDeduct}
          block
        >
          {isDeduct ? `หักออก ${delta ? delta.toLocaleString('th-TH') : ''}` : `เพิ่ม ${delta ? delta.toLocaleString('th-TH') : ''}`} ชิ้น
        </Button>
      </div>

      {/* Recent log */}
      {!loadingLog && log.length > 0 && (
        <div className="adm-adjust-log">
          <p className="adm-adjust-log-label">ล่าสุด</p>
          {log.map(entry => (
            <div key={entry.id} className="adm-adjust-log-row">
              <ItemLabel id={entry.item_id} name={data?.itemNames[entry.item_id] ?? 'ไม่พบชื่อ'} size={22} reserveImage />
              <span style={{ color: entry.delta < 0 ? '#dc2626' : '#16a34a', fontWeight: 600, whiteSpace: 'nowrap', fontSize: 12 }}>
                {entry.delta > 0 ? '+' : ''}{entry.delta.toLocaleString('th-TH')}
              </span>
              <span style={{ fontSize: 11, color: '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {entry.reason || '—'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Partial send modal ────────────────────────────────────────────────────────
function PartialSendModal({ ticket, itemNames, open, busy, onConfirm, onCancel }: {
  ticket: Ticket;
  itemNames: Record<string, string>;
  open: boolean;
  busy: boolean;
  onConfirm: (actualLines: ActualLine[], adminNote: string) => void;
  onCancel: () => void;
}) {
  const [lines, setLines] = useState<ActualLine[]>([]);
  const [note, setNote] = useState('');

  useEffect(() => {
    if (open) {
      setLines(ticket.withdrawal_lines.map(l => ({ item_id: l.item_id, quantity: l.quantity })));
      setNote('');
    }
  }, [open, ticket]);

  const setQty = (item_id: string, quantity: number) => {
    setLines(prev => prev.map(l => l.item_id === item_id ? { ...l, quantity } : l));
  };

  return (
    <Modal
      open={open}
      title="ส่งบางส่วน"
      okText="ยืนยัน — หักสต็อกตามจำนวนจริง"
      cancelText="ยกเลิก"
      onOk={() => onConfirm(lines, note)}
      onCancel={onCancel}
      confirmLoading={busy}
      okButtonProps={{ danger: false }}
    >
      <p style={{ fontSize: 13, color: '#64748b', margin: '0 0 12px' }}>
        แก้จำนวนจริงที่ส่งได้ต่อรายการ — ระบบจะหักสต็อกตามจำนวนนี้และปิดใบเบิก
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
        {lines.map(l => {
          const requested = ticket.withdrawal_lines.find(r => r.item_id === l.item_id)?.quantity ?? 0;
          const name = itemNames[l.item_id] ?? 'ไม่พบชื่อสินค้า';
          return (
            <div key={l.item_id} style={{ display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center', gap: 10 }}>
              <ItemLabel id={l.item_id} name={name} size={28} reserveImage />
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <InputNumber
                  min={0}
                  max={requested}
                  precision={0}
                  value={l.quantity}
                  onChange={v => setQty(l.item_id, v ?? 0)}
                  style={{ width: 90 }}
                />
                <span style={{ fontSize: 12, color: '#94a3b8', whiteSpace: 'nowrap' }}>/ {requested.toLocaleString('th-TH')}</span>
              </div>
            </div>
          );
        })}
      </div>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>หมายเหตุสำหรับ admin (ไม่บังคับ)</span>
        <Input.TextArea
          value={note}
          onChange={e => setNote(e.target.value)}
          placeholder="เช่น ของเหลือน้อย คงคลังไว้ก่อน 50 ชิ้น"
          autoSize={{ minRows: 2, maxRows: 4 }}
          maxLength={500}
        />
      </label>
    </Modal>
  );
}
const stacks = (pieces: number) => `${Math.floor(pieces / 99).toLocaleString()} กอง${pieces % 99 ? ` + ${(pieces % 99).toLocaleString()} ชิ้น` : ''}`;
const labels = { pending: 'รอจัดส่ง', sent: 'ส่งแล้ว', cancelled: 'ยกเลิก' };
async function request(method = 'GET', body?: unknown, id = '') {
  const response = await fetch(`/api/withdrawals${id ? (id.startsWith('?') ? id : '/' + id) : ''}`, { method, headers: { 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const text = await response.text();
  if (!text.trim()) throw new Error(`ระบบเบิกสินค้าไม่ตอบกลับ (HTTP ${response.status}) กรุณาตรวจว่า API เปิดอยู่แล้วลองใหม่`);
  let result;
  try { result = JSON.parse(text); }
  catch { throw new Error(`ระบบเบิกสินค้าตอบกลับผิดรูปแบบ (HTTP ${response.status}) กรุณาลองใหม่`); }
  if (!response.ok) throw new Error(result?.error || `ดำเนินการไม่สำเร็จ (HTTP ${response.status})`);
  if (method === 'GET' && (id === 'catalog' ? !Array.isArray(result) : !Array.isArray(result?.tickets))) throw new Error('ข้อมูลใบเบิกไม่ถูกต้อง กรุณาลองใหม่');
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
  const [loadError, setLoadError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [availability, setAvailability] = useState<Record<string,number>>({});
  const [total, setTotal] = useState(0);
  const [matched, setMatched] = useState(0);
  const [people, setPeople] = useState<string[]>([]);
  const [products, setProducts] = useState<string[]>([]);
  const loadSequence = useRef(0);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState('');
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>();
  const [personFilter, setPersonFilter] = useState<string>();
  const [productFilter, setProductFilter] = useState<string>();
  const [partialTicket, setPartialTicket] = useState<Ticket | null>(null);
  useEffect(() => { setPage(1); }, [filter, statusFilter, personFilter, productFilter]);
  const [catalog, setCatalog] = useState<{item_id: string; enabled: boolean}[]>([]);
  const [newItem, setNewItem] = useState<string>();
  async function refresh() {
    const sequence = ++loadSequence.current;
    setRefreshing(true);
    try {
      const params = new URLSearchParams({ page:String(page),q:filter.trim(),status:statusFilter ?? '',person:personFilter ?? '',item:productFilter ?? '' });
      const [next, stock, allowed] = await Promise.all([request('GET',undefined,'?'+params), fetchAllData(), request('GET', undefined, 'catalog')]);
      if (sequence !== loadSequence.current) return;
      setCatalog(allowed); setTickets(next.tickets); setAvailability(next.availability); setTotal(next.total); setMatched(next.matched); setPeople(next.people); setProducts(next.products);
      setData(stock); onData(stock); setLoadError('');
      if (page > Math.max(1,Math.ceil(next.matched/10))) setPage(Math.max(1,Math.ceil(next.matched/10)));
    } catch(e) {
      if (sequence === loadSequence.current) setLoadError((e as Error).message);
    } finally { if (sequence === loadSequence.current) setRefreshing(false); }
  }
  useEffect(() => {
    const timer = window.setTimeout(() => { void refresh(); }, 250);
    return () => { window.clearTimeout(timer); ++loadSequence.current; };
  }, [page,filter,statusFilter,personFilter,productFilter]);
  const latestRefresh = useRef(refresh); latestRefresh.current = refresh;
  const busyRef = useRef(busy); busyRef.current = busy;
  useEffect(() => {
    const update = () => { if (document.visibilityState === 'visible' && !busyRef.current) void latestRefresh.current(); };
    window.addEventListener('focus',update); document.addEventListener('visibilitychange',update);
    return () => { window.removeEventListener('focus',update); document.removeEventListener('visibilitychange',update); };
  }, []);
  const options = Object.entries(data?.itemNames ?? {}).filter(([id]) => catalog.some(c => c.item_id === id && c.enabled)).map(([id,name]) => ({ value:id, label: name, available: availability[id] ?? 0 }));
  const requested = lines.reduce<Record<string,number>>((result,line)=>{ if(line.item_id) result[line.item_id]=(result[line.item_id] ?? 0)+line.quantity; return result; },{});
  const overLimit = Object.entries(requested).some(([id,quantity])=>quantity>(availability[id] ?? 0));
  const patchLine = (index: number, patch: Partial<Line>) => { setLines(prev => prev.map((l,i) => i === index ? {...l,...patch} : l)); setRequestId(crypto.randomUUID()); };
  async function submit() {
    if (busy || overLimit || refreshing || loadError) return;
    setBusy(true); setError(''); setSuccess('');
    try {
      await request('POST', {id:requestId,character_id:character.trim(),note,lines,requester_name:requesterName,recipient_name:recipientName.trim()});
      try { localStorage.setItem('withdrawal-character',character.trim()); } catch { /* Receipt is already saved even if browser storage is unavailable. */ }
      setSuccess(`สร้างใบเบิกแล้ว เลขใบเบิก ${requestId}`); setRequestId(crypto.randomUUID()); setLines([{item_id:'',quantity:99}]); setNote('');
      await latestRefresh.current();
    } catch(e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  async function change(ticket: Ticket,status: string) {
    setBusy(true); setError('');
    try { await request('PATCH',{status},ticket.id); setSuccess('เปลี่ยนสถานะใบเบิกแล้ว'); await latestRefresh.current(); } catch(e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  async function fulfillPartial(actualLines: ActualLine[], adminNote: string) {
    if (!partialTicket) return;
    setBusy(true); setError('');
    try {
      await partialFulfillWithdrawal(partialTicket.id, actualLines, adminNote);
      setSuccess('ส่งบางส่วนเรียบร้อย — หักสต็อกแล้ว');
      setPartialTicket(null);
      await latestRefresh.current();
    } catch(e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  async function setAllowed(item_id: string, enabled: boolean) {
    setBusy(true); setError('');
    try { await request('PUT', {item_id, enabled}, 'catalog'); setSuccess('บันทึกสินค้าที่เปิดให้เบิกแล้ว'); await latestRefresh.current(); setNewItem(undefined); }
    catch(e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  const visible = tickets;
  const currentPage = page;
  const historyProducts = products.map(id => ({ value:id,label:data?.itemNames[id] || 'ไม่พบชื่อสินค้า' }));

  return <section className="withdrawals"><h2 className="withdrawal-title">{admin ? 'จัดการใบเบิก' : 'เบิกสินค้า'}</h2>
    {error && <Alert type="error" message={error} action={<Button onClick={() => { setError(''); void refresh().catch(e=>setError(e.message)); }}>โหลดใหม่</Button>} />}
    {loadError && <Alert type="warning" message="โหลดข้อมูลไม่สำเร็จ" description={loadError} action={<Button loading={refreshing} onClick={()=>void refresh()}>ลองใหม่</Button>} />}
    {success && <Alert type="success" message={success} closable onClose={() => setSuccess('')} />}

    {admin ? (
      /* ── Admin 2-column layout ── */
      <div className="adm-layout">

        {/* LEFT — catalog panel */}
        <aside className="adm-sidebar">
          <div className="adm-catalog-section">            <div className="adm-catalog-header">
              <div>
                <strong>สินค้าที่เปิดให้เบิก</strong>
                <span className="adm-catalog-count">{catalog.filter(c=>c.enabled).length} / {catalog.length} รายการ</span>
              </div>
            </div>
            <div className="adm-catalog-toolbar">
              <Select
                style={{ flex: 1, minWidth: 0 }}
                aria-label="เพิ่มสินค้าใหม่"
                placeholder="ค้นหาสินค้าในคลัง…"
                showSearch optionFilterProp="label"
                value={newItem} onChange={setNewItem} disabled={busy}
                options={Object.keys(data?.stocks ?? {})
                  .filter(id => !catalog.some(c => c.item_id === id))
                  .map(id => ({ value: id, label: data?.itemNames[id] || 'ไม่พบชื่อสินค้า' }))}
                {...withdrawalItemVisuals} allowClear
              />
              <Button type="primary" disabled={!newItem || busy} onClick={() => newItem && void setAllowed(newItem, true)}>เพิ่ม</Button>
            </div>
            {catalog.length === 0
              ? <p className="adm-catalog-empty">ยังไม่มีสินค้าในรายการ</p>
              : <div className="adm-catalog-items">
                  {catalog
                    .map(c => ({ ...c, name: data?.itemNames[c.item_id] || 'ไม่พบชื่อสินค้า', stock: data?.stocks[c.item_id] ?? 0, available: availability[c.item_id] ?? 0 }))
                    .sort((a, b) => { if (a.enabled !== b.enabled) return a.enabled ? -1 : 1; return a.name.localeCompare(b.name, 'th'); })
                    .map(c => (
                      <div className={`adm-catalog-item${c.enabled ? '' : ' adm-catalog-item--off'}`} key={c.item_id}>
                        <ItemLabel id={c.item_id} name={c.name} reserveImage size={26} />
                        {c.enabled && (
                          <div className="adm-catalog-item-stocks">
                            <span className="adm-catalog-available" title="เบิกได้">{c.available.toLocaleString('th-TH')}<em>เบิกได้</em></span>
                            <span className="adm-catalog-total" title="คลัง">{c.stock.toLocaleString('th-TH')}<em>คลัง</em></span>
                          </div>
                        )}
                        <button
                          className={`adm-toggle${c.enabled ? ' adm-toggle--on' : ''}`}
                          disabled={busy}
                          onClick={() => void setAllowed(c.item_id, !c.enabled)}
                          aria-label={c.enabled ? 'ปิดให้เบิก' : 'เปิดให้เบิก'}
                        ><span className="adm-toggle-thumb" /></button>
                      </div>
                    ))}
                </div>}
          </div>
          <StockAdjustPanel data={data} onDone={() => void refresh()} />
        </aside>

        {/* RIGHT — ticket list */}
        <div className="adm-tickets">
          <div className="withdrawal-history-heading">
            <h3>ใบเบิกสินค้า <small>{matched} / {total} ใบ</small></h3>
            <Button loading={refreshing} disabled={busy} onClick={() => void refresh().catch(e => setError(e.message))}>รีเฟรช</Button>
          </div>
          <div className="withdrawal-history-filters">
            <Input.Search aria-label="ค้นหาใบเบิก" placeholder="ชื่อ ไอดี เลขใบเบิก หรือสินค้า" allowClear value={filter} onChange={e => setFilter(e.target.value)} />
            <Select aria-label="กรองสถานะ" placeholder="ทุกสถานะ" allowClear value={statusFilter} onChange={setStatusFilter} options={Object.entries(labels).map(([value, label]) => ({ value, label }))} />
            <Select {...personSelectVisuals} aria-label="กรองผู้เบิก" placeholder="ผู้เบิกทุกคน" allowClear showSearch optionFilterProp="label" value={personFilter} onChange={setPersonFilter} options={people.map(name => ({ value: name, label: name }))} />
            <Select aria-label="กรองสินค้า" placeholder="สินค้าทั้งหมด" allowClear showSearch optionFilterProp="label" value={productFilter} onChange={setProductFilter} options={historyProducts} {...withdrawalItemVisuals} />
            {(filter || statusFilter || personFilter || productFilter) && <Button type="text" onClick={() => { setFilter(''); setStatusFilter(undefined); setPersonFilter(undefined); setProductFilter(undefined); }}>ล้างตัวกรอง</Button>}
          </div>
          <div className="withdrawal-history-list">
            {visible.map(t => <details className="withdrawal-history-row" key={t.id}>
              <summary>
                <span className="withdrawal-history-person"><PersonLabel name={t.recipient_name || 'ไม่ระบุชื่อ'} characterId={t.character_id} size={24} /><small>{t.character_id}</small></span>
                <span className="withdrawal-history-quantity">{t.withdrawal_lines.length} รายการ</span>
                <Tag color={t.status === 'pending' ? 'gold' : t.status === 'sent' ? 'green' : 'default'}>{labels[t.status]}</Tag>
                <time className="withdrawal-history-time" dateTime={t.created_at} title={new Date(t.created_at).toLocaleString('th-TH')}>{new Date(t.created_at).toLocaleString('th-TH', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' })}</time>
                <span className="withdrawal-history-chevron" aria-hidden="true">⌄</span>
              </summary>
              <div className="withdrawal-history-body">
                <div className="withdrawal-history-owner"><small>ผู้เบิก</small><span>{t.requester_name || 'ไม่ระบุ'}</span></div>
                <small>{new Date(t.created_at).toLocaleString('th-TH')}</small>
                {t.withdrawal_lines.map(l => <div className="withdrawal-ticket-line" key={l.item_id}><ItemLabel id={l.item_id} name={data?.itemNames[l.item_id] ?? 'ไม่พบชื่อสินค้า'} reserveImage /><strong title={`${l.quantity.toLocaleString()} ชิ้น`}>{stacks(l.quantity)}</strong></div>)}
                {t.note && <p>{t.note}</p>}
                <div className="adm-ticket-actions">
                  <Button onClick={() => void navigator.clipboard.writeText(t.character_id).catch(() => setError('คัดลอกไม่ได้'))}>คัดลอกไอดี {t.character_id}</Button>
                  {t.status === 'pending' && <>
                    <Popconfirm title="ยืนยันส่งของแล้วและหักสต็อก?" okText="ยืนยัน" cancelText="ยกเลิก" onConfirm={() => change(t, 'sent')}><Button disabled={busy} type="primary">ส่งครบ — หักสต็อก</Button></Popconfirm>
                    <Button disabled={busy} onClick={() => setPartialTicket(t)}>ส่งบางส่วน…</Button>
                    <Popconfirm title="ยกเลิกใบเบิกและคืนยอดจอง?" okText="ยกเลิกใบเบิก" cancelText="ไม่" onConfirm={() => change(t, 'cancelled')}><Button disabled={busy} danger>ยกเลิกใบเบิก</Button></Popconfirm>
                  </>}
                </div>
                <small className="withdrawal-receipt-number">ใบเบิก {t.id}</small>
              </div>
            </details>)}
          </div>
          <Pagination size="small" current={currentPage} pageSize={10} total={matched} onChange={setPage} showSizeChanger={false} hideOnSinglePage />
          {data && !visible.length && <p>ยังไม่มีใบเบิกที่ตรงกับรายการค้นหา</p>}
        </div>

      </div>
    ) : (
      /* ── User (non-admin) layout ── */
      <>
        <fieldset disabled={busy} className="withdrawal-form">
          <div className="withdrawal-people">
            <label>ผู้เบิก<Select {...personSelectVisuals} aria-label="ผู้เบิก" disabled={busy} placeholder="เลือกคนที่เบิก" options={peopleOptions} value={requester || undefined} onChange={value=>{setRequester(value);if(value !== 'other'){const person=CONTRIBUTOR_PROFILES.find(p=>p.name===value);setRecipient(value);setRecipientName(person?.name ?? '');setCharacter(person?.memberId ?? '');}setRequestId(crypto.randomUUID());}} /></label>
            {requester === 'other' && <label>ชื่อผู้เบิก<Input maxLength={100} value={requesterOther} onChange={e=>{setRequesterOther(e.target.value);setRequestId(crypto.randomUUID());}} /></label>}
            <label>ส่งให้ตัวละคร<Select {...personSelectVisuals} aria-label="ตัวละครผู้รับ" disabled={busy} placeholder="เลือกผู้รับ" options={peopleOptions} value={recipient || undefined} onChange={value=>{setRecipient(value); const profile = CONTRIBUTOR_PROFILES.find(p=>p.name===value); setRecipientName(profile?.name ?? ''); setCharacter(profile?.memberId ?? ''); setRequestId(crypto.randomUUID());}} /></label>
            {recipient && recipient !== 'other' && <span className="withdrawal-recipient-id">ไอดี {character}</span>}
          </div>
          {recipient === 'other' && <div className="withdrawal-custom-recipient"><label>ชื่อตัวละครผู้รับ<Input maxLength={100} value={recipientName} onChange={e=>{setRecipientName(e.target.value);setRequestId(crypto.randomUUID());}} /></label><label>ไอดีตัวละครผู้รับ<Input value={character} inputMode="numeric" onChange={e => {setCharacter(e.target.value);setRequestId(crypto.randomUUID());}} /></label></div>}
          <div className="withdrawal-items-heading"><strong>สินค้า</strong><span>จำนวน (กอง)</span></div>
          {lines.map((line,index) => <div className="withdrawal-line" key={index}>
            <Select aria-label="สินค้าเบิก" disabled={busy} placeholder="เลือกสินค้า" showSearch optionFilterProp="label" value={line.item_id || undefined} onChange={id=>patchLine(index,{item_id:id})} options={options} {...withdrawalItemVisuals} />
            <InputNumber aria-label="จำนวนเบิก (กอง)" disabled={busy} min={1} max={21691754} precision={0} value={line.quantity / 99} onChange={quantity=>patchLine(index,{quantity:(quantity ?? 0) * 99})} />
            <Button disabled={busy} onClick={()=>patchLine(index,{quantity:line.quantity+99})}>+1 กอง</Button>
            <Button disabled={busy || lines.length===1} danger onClick={()=>{setLines(lines.filter((_,i)=>i!==index));setRequestId(crypto.randomUUID());}}>ลบ</Button>
            {line.item_id && <small className={requested[line.item_id] > (availability[line.item_id] ?? 0) ? 'withdrawal-quantity-error' : ''} role="status">{requested[line.item_id] > (availability[line.item_id] ?? 0) ? `เกินยอดที่เบิกได้ ${stacks(requested[line.item_id]-(availability[line.item_id] ?? 0))} · รวมทุกแถว ${stacks(requested[line.item_id])}` : `เหลือให้จอง ${stacks(availability[line.item_id] ?? 0)} · 1 กอง = 99 ชิ้น`}</small>}
          </div>)}
          <div className="withdrawal-extras"><Button className="withdrawal-add" type="dashed" disabled={busy || lines.length>=50} onClick={()=>{setLines([...lines,{item_id:'',quantity:99}]);setRequestId(crypto.randomUUID());}}>เพิ่มสินค้า</Button></div>
          <label className="withdrawal-note-field">หมายเหตุ (ไม่จำเป็น)<Input.TextArea aria-label="หมายเหตุ (ไม่จำเป็น)" placeholder="รายละเอียดเพิ่มเติม" autoSize={{ minRows: 1, maxRows: 3 }} maxLength={1000} value={note} onChange={e=>{setNote(e.target.value);setRequestId(crypto.randomUUID());}} /></label>
          <div className="withdrawal-submit"><span>{lines.filter(l=>l.item_id).length} รายการ</span><Button type="primary" loading={busy} disabled={!data || overLimit || refreshing || !!loadError || !requesterName || !recipientName.trim() || !/^\d{1,30}$/.test(character.trim()) || lines.some(l=>!l.item_id || !Number.isSafeInteger(l.quantity) || l.quantity<=0)} onClick={submit}>ส่งใบเบิก</Button></div>
        </fieldset>
        <div className="withdrawal-history-heading"><h3>ใบเบิกสินค้า <small>{matched} / {total} ใบ</small></h3><Button loading={refreshing} disabled={busy} onClick={()=>void refresh().catch(e=>setError(e.message))}>รีเฟรช</Button></div>
        <div className="withdrawal-history-filters">
          <Input.Search aria-label="ค้นหาใบเบิก" placeholder="ชื่อ ไอดี เลขใบเบิก หรือสินค้า" allowClear value={filter} onChange={e=>setFilter(e.target.value)} />
          <Select aria-label="กรองสถานะ" placeholder="ทุกสถานะ" allowClear value={statusFilter} onChange={setStatusFilter} options={Object.entries(labels).map(([value,label])=>({value,label}))} />
          <Select {...personSelectVisuals} aria-label="กรองผู้เบิก" placeholder="ผู้เบิกทุกคน" allowClear showSearch optionFilterProp="label" value={personFilter} onChange={setPersonFilter} options={people.map(name=>({value:name,label:name}))} />
          <Select aria-label="กรองสินค้า" placeholder="สินค้าทั้งหมด" allowClear showSearch optionFilterProp="label" value={productFilter} onChange={setProductFilter} options={historyProducts} {...withdrawalItemVisuals} />
          {(filter || statusFilter || personFilter || productFilter) && <Button type="text" onClick={()=>{setFilter('');setStatusFilter(undefined);setPersonFilter(undefined);setProductFilter(undefined);}}>ล้างตัวกรอง</Button>}
        </div>
        <div className="withdrawal-history-list">
          {visible.map(t=><details className="withdrawal-history-row" key={t.id}>
            <summary>
              <span className="withdrawal-history-person"><PersonLabel name={t.recipient_name || 'ไม่ระบุชื่อ'} characterId={t.character_id} size={24} /><small>{t.character_id}</small></span>
              <span className="withdrawal-history-quantity">{t.withdrawal_lines.length} รายการ</span>
              <Tag color={t.status==='pending'?'gold':t.status==='sent'?'green':'default'}>{labels[t.status]}</Tag>
              <time className="withdrawal-history-time" dateTime={t.created_at} title={new Date(t.created_at).toLocaleString('th-TH')}>{new Date(t.created_at).toLocaleString('th-TH', {day:'numeric',month:'numeric',hour:'2-digit',minute:'2-digit'})}</time>
              <span className="withdrawal-history-chevron" aria-hidden="true">⌄</span>
            </summary>
            <div className="withdrawal-history-body"><div className="withdrawal-history-owner"><small>ผู้เบิก</small><span>{t.requester_name || 'ไม่ระบุ'}</span></div><small>{new Date(t.created_at).toLocaleString('th-TH')}</small>
            {t.withdrawal_lines.map(l=><div className="withdrawal-ticket-line" key={l.item_id}><ItemLabel id={l.item_id} name={data?.itemNames[l.item_id] ?? 'ไม่พบชื่อสินค้า'} reserveImage /><strong title={`${l.quantity.toLocaleString()} ชิ้น`}>{stacks(l.quantity)}</strong></div>)}
            {t.note && <p>{t.note}</p>}
            <small className="withdrawal-receipt-number">ใบเบิก {t.id}</small>
            </div>
          </details>)}
        </div>
        <Pagination size="small" current={currentPage} pageSize={10} total={matched} onChange={setPage} showSizeChanger={false} hideOnSinglePage />
        {data && !visible.length && <p>ยังไม่มีใบเบิกที่ตรงกับรายการค้นหา</p>}
      </>
    )}
    {partialTicket && (
      <PartialSendModal
        ticket={partialTicket}
        itemNames={data?.itemNames ?? {}}
        open={!!partialTicket}
        busy={busy}
        onConfirm={fulfillPartial}
        onCancel={() => setPartialTicket(null)}
      />
    )}
  </section>;
}
