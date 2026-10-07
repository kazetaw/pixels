import { useRef, useState } from 'react';
import { Button, InputNumber, Popconfirm, Select, Alert, Modal, Tabs, message } from 'antd';
import { ClearOutlined, PlusOutlined, MinusOutlined, CloseOutlined, InboxOutlined } from '@ant-design/icons';
import type { Machine } from '../../types';
import { ItemLabel, ItemThumbnail } from '../shared/ItemVisual';
import { type MachineLayoutData, useSharedMachineLayout } from './useSharedMachineLayout';
import './MachineLayout.css';
import { placeMachines } from './placeMachines';

type Floor = { id: number; slots: (string | null)[] };
type Selection = { machine: string; floor?: number; slot?: number };
const emptyFloor = (id: number): Floor => ({ id, slots: Array(12).fill(null) });
const MIME = 'application/x-pixels-machine';

export function MachineLayout({ machines }: { machines: Machine[] }) {
  const { layout: sharedLayout, setLayout: setSharedLayout, status, error, ready, reload } = useSharedMachineLayout();
  const [mode, setMode] = useState('craft');
  const competitionFloors = sharedLayout.competitionFloors ?? sharedLayout.floors.map(f => emptyFloor(f.id));
  const layout = mode === 'craft' ? sharedLayout : { ...sharedLayout, floors: competitionFloors };
  function setLayout(update: (current: MachineLayoutData) => MachineLayoutData) {
    setSharedLayout(current => {
      const competition = current.competitionFloors ?? current.floors.map(f => emptyFloor(f.id));
      const next = update(mode === 'craft' ? current : { ...current, floors: competition });
      return mode === 'craft'
        ? { ...next, competitionFloors: competition }
        : { ...current, owned: next.owned, competitionFloors: next.floors };
    });
  }
  const [occupation, setOccupation] = useState('ทั้งหมด');
  const occupations = ['ทั้งหมด', ...Array.from(new Set(machines.map(m => m.occupation || 'ไม่ระบุอาชีพ')))];
  const visibleMachines = machines.filter(m => occupation === 'ทั้งหมด' || (m.occupation || 'ไม่ระบุอาชีพ') === occupation);
  const [incomingOccupation, setIncomingOccupation] = useState('ทั้งหมด');
  const incomingMachines = machines.filter(m => incomingOccupation === 'ทั้งหมด' || (m.occupation || 'ไม่ระบุอาชีพ') === incomingOccupation);
  const [incomingMachine, setIncomingMachine] = useState<string>();
  const [incomingQty, setIncomingQty] = useState<number | null>(1);
  const [selected, setSelected] = useState<Selection | null>(null);
  const [placement, setPlacement] = useState<{ machine: string; floor: number; slot: number } | null>(null);
  const [placementQty, setPlacementQty] = useState<number | null>(1);
  const dragging = useRef<Selection | null>(null);
  const pointer = useRef<{ source: Selection; x: number; y: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);
  const [hover, setHover] = useState<string | null>(null);
  const [msg, holder] = message.useMessage();
  const used: Record<string, number> = {};
  layout.floors.forEach(f => f.slots.forEach(id => { if (id) used[id] = (used[id] ?? 0) + 1; }));
  const total = Object.values(layout.owned).reduce((a, b) => a + b, 0);
  const placed = Object.values(used).reduce((a, b) => a + b, 0);
  const machineById = new Map(machines.map(m => [m.machine_id, m]));
  const nameOf = (id: string) => machineById.get(id)?.machine_name ?? 'เครื่องที่ไม่มีในรายการปัจจุบัน';

  const maxPlaced = (id: string, data: MachineLayoutData) => Math.max(...[data.floors, data.competitionFloors ?? []].map(floors => floors.reduce((sum, floor) => sum + floor.slots.filter(value => value === id).length, 0)));
  const availableToRemove = incomingMachine ? (sharedLayout.owned[incomingMachine] ?? 0) - maxPlaced(incomingMachine, sharedLayout) : 0;
  function removeMachines() {
    if (!incomingMachine || !incomingQty || !Number.isSafeInteger(incomingQty) || incomingQty < 1 || incomingQty > availableToRemove) return;
    setSharedLayout(current => {
      const placedCount = maxPlaced(incomingMachine, current);
      const nextCount = (current.owned[incomingMachine] ?? 0) - incomingQty;
      if (nextCount < placedCount) return current;
      return { ...current, owned: { ...current.owned, [incomingMachine]: nextCount } };
    });
    setSelected(null);
    msg.success(`ลด ${nameOf(incomingMachine)} ${incomingQty} เครื่องแล้ว`);
    setIncomingQty(1);
  }

  const placementFloor = layout.floors.find(f => f.id === placement?.floor);
  const freeSlots = placementFloor?.slots.filter(id => id === null).length ?? 0;
  const remainingForPlacement = placement ? (layout.owned[placement.machine] ?? 0) - (used[placement.machine] ?? 0) : 0;
  const placementMax = Math.min(freeSlots, remainingForPlacement);
  const validPlacement = placementQty !== null && Number.isSafeInteger(placementQty) && placementQty > 0 && placementQty <= placementMax;

  function move(source: Selection, floor?: number, slot?: number) {
    if (floor !== undefined && source.floor === undefined && (layout.owned[source.machine] ?? 0) <= (used[source.machine] ?? 0)) {
      msg.warning('เครื่องในคลังหมด กรุณาเพิ่มเครื่องเข้าคลังก่อนวาง');
      return;
    }
    if (source.floor === undefined && floor !== undefined && slot !== undefined) {
      const target = layout.floors.find(f => f.id === floor);
      if (!target || target.slots[slot] !== null) return;
      setPlacement({ machine: source.machine, floor, slot });
      setPlacementQty(1);
      return;
    }
    setLayout(current => {
      // Deep-copy floors so we never mutate shared state
      const next = { ...current, floors: current.floors.map(f => ({ ...f, slots: [...f.slots] })) };
      const origin = next.floors.find(f => f.id === source.floor);

      // Validate source slot still holds the expected machine
      if (source.floor !== undefined) {
        if (!origin || source.slot === undefined) return current;
        if (origin.slots[source.slot] !== source.machine) return current; // already moved by another update
      }

      if (floor !== undefined) {
        const target = next.floors.find(f => f.id === floor);
        if (!target || slot === undefined) return current;
        // Re-check target slot is still empty (concurrent move guard)
        if (target.slots[slot] !== null) return current;
        if (!origin) {
          // Moving from pool — check quota
          const count = next.floors.reduce((sum, f) => sum + f.slots.filter(id => id === source.machine).length, 0);
          if (count >= (next.owned[source.machine] ?? 0)) return current;
        }
        target.slots[slot] = source.machine;
      } else if (!origin) {
        return current; // nothing to return to pool
      }

      // Clear source slot
      if (origin && source.slot !== undefined) origin.slots[source.slot] = null;
      return next;
    });
    setSelected(null);
  }
  function readDrop(e: React.DragEvent): Selection | null {
    e.preventDefault(); e.stopPropagation(); setHover(null);
    try {
      const value = dragging.current ?? JSON.parse(e.dataTransfer.getData(MIME) || e.dataTransfer.getData('text/plain'));
      return typeof value.machine === 'string' ? value : null;
    } catch { return null; }
  }
  const startDrag = (e: React.DragEvent, value: Selection) => {
    e.stopPropagation();
    dragging.current = value;
    e.dataTransfer.setData(MIME, JSON.stringify(value));
    e.dataTransfer.setData('text/plain', JSON.stringify(value));
    e.dataTransfer.effectAllowed = 'move';
  };

  function pointerStart(e: React.PointerEvent, source: Selection) {
    if (e.button !== 0) return;
    pointer.current = { source, x: e.clientX, y: e.clientY, moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function pointerMove(e: React.PointerEvent) {
    const active = pointer.current;
    if (!active) return;
    if (Math.hypot(e.clientX - active.x, e.clientY - active.y) < 6 && !active.moved) return;
    active.moved = true;
    const target = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>('[data-layout-slot]');
    setHover(target?.dataset.layoutSlot ?? null);
  }
  function pointerEnd(e: React.PointerEvent) {
    const active = pointer.current;
    pointer.current = null; setHover(null);
    if (!active?.moved) return;
    suppressClick.current = true;
    const element = document.elementFromPoint(e.clientX, e.clientY);
    const slot = element?.closest<HTMLElement>('[data-layout-slot]');
    if (slot) {
      const [floor, index] = slot.dataset.layoutSlot!.split('-').map(Number);
      move(active.source, floor, index);
    } else if (element?.closest('.machine-pool')) move(active.source);
    window.setTimeout(() => { suppressClick.current = false; }, 0);
  }

  if (!ready) return <div className="machine-layout"><Alert type={error ? 'error' : 'info'} message={error || status} description={error ? 'ข้อมูลเดิมยังเก็บอยู่ในเบราว์เซอร์ เมื่อเชื่อมต่อได้ระบบจะโหลดผังส่วนกลางก่อน' : undefined} action={error ? <Button onClick={reload}>โหลดใหม่</Button> : undefined} /></div>;
  return <div className="machine-layout">
    {holder}
    <Modal title={`วางเครื่องบนชั้น ${placement?.floor ?? ''}`} open={placement !== null} width={420}
      onCancel={() => setPlacement(null)} cancelText="ยกเลิก" okText={`วาง ${placementQty ?? 0} เครื่อง`}
      okButtonProps={{ disabled: !validPlacement }} onOk={() => {
        if (!placement || !validPlacement || placementQty === null) return;
        setLayout(current => placeMachines(current, placement, placementQty));
        setPlacement(null); setSelected(null);
      }}>
      {placement && <div className="machine-placement">
        <ItemLabel id={placement.machine} name={nameOf(placement.machine)} size={56} reserveImage />
        <p>เหลือในคลัง <b>{remainingForPlacement}</b> เครื่อง · ชั้นนี้ว่าง <b>{freeSlots}</b> ช่อง</p>
        <label htmlFor="placement-quantity">จำนวนที่ต้องการวาง</label>
        <InputNumber id="placement-quantity" min={1} max={placementMax} precision={0} value={placementQty} onChange={setPlacementQty} style={{ width: '100%' }} size="large" />
        <div className="machine-placement__presets">
          {[1, 3, 6].map(qty => <Button key={qty} disabled={qty > placementMax} type={placementQty === qty ? 'primary' : 'default'} onClick={() => setPlacementQty(qty)}>{qty}</Button>)}
          <Button disabled={placementMax < 1} onClick={() => setPlacementQty(placementMax)}>{remainingForPlacement >= freeSlots ? 'เต็มชั้น' : 'ทั้งหมดที่เหลือ'} ({placementMax})</Button>
        </div>
        <p>เติมจากช่องที่เลือก แล้วไล่ช่องว่างที่เหลือในชั้น ไม่ทับเครื่องเดิม</p>
      </div>}
    </Modal>
    <header className="machine-layout__header"><div><h2>จัดเครื่องลงชั้น</h2><p>กรอกเครื่องที่มี แล้วลากลงช่องว่าง · ชั้นละ 12 เครื่อง คละชนิดได้</p></div>
      <div style={{ display: 'flex', gap: 8 }}>
        <Popconfirm title="ล้างเครื่องทุกตัวออกจากทุกชั้น?" description="เครื่องจะกลับคืนคลัง ชั้นยังอยู่" okText="ล้างทั้งหมด" cancelText="ยกเลิก" okButtonProps={{ danger: true }}
          onConfirm={() => { setLayout(v => ({ ...v, floors: v.floors.map(f => ({ ...f, slots: Array(12).fill(null) })) })); setSelected(null); msg.success('ล้างเครื่องออกจากทุกชั้นแล้ว'); }}>
          <Button icon={<ClearOutlined />} danger disabled={placed === 0}>ล้างทั้งหมด</Button>
        </Popconfirm>
        <Button icon={<PlusOutlined />} onClick={() => setLayout(v => ({ ...v, floors: [...v.floors, emptyFloor(Math.max(0, ...v.floors.map(f => f.id)) + 1)] }))}>เพิ่มชั้น</Button>
      </div>
    </header>
    <Tabs activeKey={mode} items={[{ key: 'craft', label: 'ตอนคราฟ' }, { key: 'competition', label: 'ตอนแข่งจริง' }]} onChange={value => {
      setMode(value); setSelected(null); setPlacement(null); setHover(null); pointer.current = null; dragging.current = null;
    }} />
    <p>ผัง{mode === 'craft' ? 'ตอนคราฟ' : 'ตอนแข่งจริง'} · จัดวางแยกกัน ใช้จำนวนเครื่องทั้งหมดชุดเดียวกัน</p>
    <div className="machine-layout__totals"><span>มีทั้งหมด <b>{total}</b> เครื่อง</span><span>วางแล้ว <b>{placed}</b></span><span>เหลือในคลัง <b>{total - placed}</b></span><span>ช่องว่าง <b>{layout.floors.length * 12 - placed}</b></span></div>
    <p className="machine-layout__saved">{status} · ใช้ร่วมกันทุกเครื่อง · เป็นผังจัดวาง ไม่เปลี่ยนเวลาผลิตหรือสต็อกสินค้า</p>
    <form className="machine-incoming" onSubmit={e => {
      e.preventDefault();
      if (!incomingMachine || !incomingQty || !Number.isSafeInteger(incomingQty) || incomingQty < 1) return;
      setLayout(v => ({ ...v, owned: { ...v.owned, [incomingMachine]: (v.owned[incomingMachine] ?? 0) + incomingQty } }));
      msg.success(`เพิ่ม ${nameOf(incomingMachine)} ${incomingQty} เครื่องแล้ว`);
      setIncomingQty(1);
    }}>
      <strong>เพิ่ม / ลดเครื่องในคลัง</strong>
      <Select aria-label="อาชีพของเครื่อง" value={incomingOccupation}
        options={occupations.map(name => ({ value: name, label: name === 'ทั้งหมด' ? 'ทุกหมวดอาชีพ' : name }))}
        onChange={value => {
          setIncomingOccupation(value);
          const current = machines.find(m => m.machine_id === incomingMachine);
          if (value !== 'ทั้งหมด' && current && (current.occupation || 'ไม่ระบุอาชีพ') !== value) setIncomingMachine(undefined);
        }} />
      <Select aria-label="เครื่องที่ต้องการปรับจำนวน" placeholder="เลือกเครื่อง" showSearch optionFilterProp="label" value={incomingMachine} onChange={setIncomingMachine}
        options={incomingMachines.map(m => ({ value: m.machine_id, label: m.machine_name }))}
        optionRender={option => <ItemLabel id={String(option.value)} name={option.label} size={26} reserveImage />}
        labelRender={({ value, label }) => <ItemLabel id={String(value)} name={label} size={22} reserveImage />} />
      <InputNumber aria-label="จำนวนเครื่องที่ต้องการปรับ" min={1} precision={0} value={incomingQty} onChange={setIncomingQty} placeholder="จำนวน" />
      <Button htmlType="submit" type="primary" icon={<PlusOutlined />} disabled={!incomingMachine || !incomingQty || incomingQty < 1}>เพิ่มเข้าคลัง</Button>
      <Button htmlType="button" danger icon={<MinusOutlined />} onClick={removeMachines} disabled={!incomingMachine || !incomingQty || !Number.isSafeInteger(incomingQty) || incomingQty < 1 || incomingQty > availableToRemove}>ลดจากคลัง</Button>
      <small>{incomingMachine ? `มีทั้งหมด ${layout.owned[incomingMachine] ?? 0} · วางบนชั้น ${used[incomingMachine] ?? 0} · ลดได้ ${availableToRemove} เครื่อง — การลดจำนวนต้องไม่ต่ำกว่าเครื่องที่วางในแต่ละแท็บ ให้นำคืนคลังก่อน` : 'เลือกเครื่อง แล้วกรอกจำนวนที่ต้องการเพิ่มหรือลด ไม่ต้องกรอกยอดรวม'}</small>
    </form>
    <div className="machine-layout__workspace">
      <aside className="machine-pool" onDragOver={e => e.preventDefault()} onDrop={e => { const value = readDrop(e); if (value) move(value); }}>
        <h3><InboxOutlined /> คลังเครื่อง</h3><p>ตัวเลขบนรูป = เครื่องที่เหลือพร้อมวาง</p>

        {selected?.floor !== undefined && <Button block onClick={() => move(selected)}>นำเครื่องที่เลือกคืนคลัง</Button>}
        <div className="machine-pool__categories" aria-label="กรองเครื่องตามอาชีพ">
          {occupations.map(name => <button type="button" key={name} aria-pressed={occupation === name} onClick={() => setOccupation(name)}>{name}<span>{name === 'ทั้งหมด' ? machines.length : machines.filter(m => (m.occupation || 'ไม่ระบุอาชีพ') === name).length}</span></button>)}
        </div>
        <div className="machine-pool__list">
          {visibleMachines.map(m => {
            const remaining = (layout.owned[m.machine_id] ?? 0) - (used[m.machine_id] ?? 0);
            return <div className="machine-pool__item" key={m.machine_id}>
              <button className={selected?.machine === m.machine_id && selected.floor === undefined ? 'is-selected' : ''} draggable={false} onPointerDown={e => remaining > 0 && pointerStart(e, { machine: m.machine_id })} onPointerMove={pointerMove} onPointerUp={pointerEnd} onPointerCancel={() => { pointer.current = null; setHover(null); }} aria-disabled={remaining <= 0} onDragStart={e => { if (remaining <= 0) { e.preventDefault(); return; } startDrag(e, { machine: m.machine_id }); }} onDragEnd={() => { dragging.current = null; setHover(null); }} onClick={() => { if (suppressClick.current) return; if (remaining <= 0) { msg.info('เพิ่มเครื่องผ่านฟอร์ม เพิ่มเครื่องเข้าคลัง ก่อนวาง'); return; } setSelected({ machine: m.machine_id }); }} aria-label={`${m.machine_name} เหลือ ${remaining} เครื่อง`} title={`${m.machine_name} · เหลือ ${remaining} · วางแล้ว ${used[m.machine_id] ?? 0}`}>
                <span className="machine-pool__picture"><ItemThumbnail id={m.machine_id} image={m.image} size={56} /><span className="machine-pool__remaining" aria-label={`เหลือ ${remaining} เครื่อง`}>{remaining}</span></span>

              </button>

            </div>;
          })}
          {!machines.length && <p>เพิ่มเครื่องจักรใน “จัดการข้อมูล” ก่อนกรอกจำนวนที่มี</p>}
        </div>
        <p className="machine-pool__hint">ลากเครื่องจากชั้นมาวางในกล่องนี้เพื่อคืนคลัง</p>
      </aside>
      <section className="machine-floors" aria-label="ชั้นและเครื่องจักร">
        <div className="machine-selection-status"><Alert type="info" message={selected ? `เลือก ${nameOf(selected.machine)} แล้ว — คลิกช่องว่างเพื่อวาง` : 'กรอกจำนวนที่มี → ลากรูปเครื่องลงช่อง หรือคลิกเลือกเครื่องแล้วคลิกช่องว่าง'} action={selected ? <Button size="small" onClick={() => setSelected(null)}>ยกเลิก</Button> : undefined} /></div>
        {layout.floors.map(floor => {
          const count = floor.slots.filter(Boolean).length;
          const groups = new Map<string, number>(); floor.slots.forEach(id => { if (id) groups.set(id, (groups.get(id) ?? 0) + 1); });
          return <article className="machine-floor" key={floor.id}>
            <header><h3>ชั้น {floor.id}</h3><span className={count === 12 ? 'is-full' : ''}>{count} / 12 เครื่อง {count === 12 ? '· เต็ม' : ''}</span>
              {count > 0 && (
                <Popconfirm title={`ล้างเครื่องทั้งหมด ${count} ตัวในชั้น ${floor.id}?`} okText="ล้าง" cancelText="ยกเลิก" okButtonProps={{ danger: true }}
                  onConfirm={() => { setLayout(v => ({ ...v, floors: v.floors.map(f => f.id === floor.id ? { ...f, slots: Array(12).fill(null) } : f) })); setSelected(null); msg.success(`ล้างชั้น ${floor.id} แล้ว`); }}>
                  <Button size="small" type="text" icon={<ClearOutlined />} title={`ล้างชั้น ${floor.id}`} aria-label={`ล้างชั้น ${floor.id}`} />
                </Popconfirm>
              )}
              <Button size="small" type="text" disabled={count > 0} title={count ? 'ล้างชั้นก่อนลบ' : 'ลบชั้นว่าง'} aria-label={`ลบชั้น ${floor.id}`} icon={<CloseOutlined />} onClick={() => setLayout(v => ({ ...v, floors: v.floors.filter(f => f.id !== floor.id) }))} /></header>
            <div className="machine-floor__slots">
              {floor.slots.map((id, i) => <button key={i} className={`machine-slot${id ? ' is-filled' : ''}${hover === `${floor.id}-${i}` ? ' is-over' : ''}${selected?.floor === floor.id && selected.slot === i ? ' is-selected' : ''}`} data-layout-slot={`${floor.id}-${i}`} draggable={false} onPointerDown={e => id && pointerStart(e, { machine: id, floor: floor.id, slot: i })} onPointerMove={pointerMove} onPointerUp={pointerEnd} onPointerCancel={() => { pointer.current = null; setHover(null); }} title={id ? nameOf(id) : `ช่อง ${i + 1} ว่าง`} aria-label={`ชั้น ${floor.id} ช่อง ${i + 1}: ${id ? nameOf(id) : 'ว่าง'}`} onDragStart={e => id && startDrag(e, { machine: id, floor: floor.id, slot: i })} onDragOver={e => { if (!id) { e.preventDefault(); setHover(`${floor.id}-${i}`); } }} onDragLeave={() => setHover(null)} onDragEnd={() => { dragging.current = null; setHover(null); }} onDrop={e => { const value = readDrop(e); if (value && !id) move(value, floor.id, i); }} onClick={() => { if (suppressClick.current) return; if (id) setSelected({ machine: id, floor: floor.id, slot: i }); else if (selected) move(selected, floor.id, i); else msg.info('เลือกเครื่องจากคลังก่อน แล้วคลิกช่องว่าง'); }}>
                <small>{i + 1}</small>{id ? <><ItemThumbnail id={id} image={machineById.get(id)?.image} size={38} /><span className="machine-slot__name">{nameOf(id)}</span></> : <><PlusOutlined /><span>วางเครื่อง</span></>}
              </button>)}
            </div>
            <footer>{groups.size ? [...groups].map(([id, n]) => <span key={id}>{nameOf(id)} <b>× {n}</b></span>) : 'ชั้นว่าง พร้อมจัดเครื่อง'}</footer>
          </article>;
        })}
        {!layout.floors.length && <Button onClick={() => setLayout(v => ({ ...v, floors: [emptyFloor(1)] }))}>เพิ่มชั้นแรก</Button>}
      </section>
    </div>
  </div>;
}
