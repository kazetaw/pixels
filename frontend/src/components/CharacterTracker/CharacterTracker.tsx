import { useEffect, useRef, useState } from 'react';
import { Modal, Select, Input, message, Button } from 'antd';
import type { Recipe, Machine, StockImageMap } from '../../types';
import { CropModal } from '../shared/CropModal';
import { PIXEL_AVATARS } from './pixelIcons';
import './CharacterTracker.css';

// ─────────────────────────────────────────────────────────────────────────────
// Domain types
// ─────────────────────────────────────────────────────────────────────────────

type Occupation = 'วิศวะกร' | 'หมอ' | 'เชฟ' | 'ไอดอล' | 'เกษตร' | 'ทุกอาชีพ';
type SlotStatus = 'idle' | 'run' | 'done' | 'over';
type Slot = {
  itemKey: string;
  itemName: string;
  status: SlotStatus;
  endTime: string;
  startTime: string | null;
  durationSeconds: number;
};
type Character = { id: string; name: string; occupation: Occupation; avatar: string | null; slots: Slot[] };
type AccountId = { id: string; label: string; chars: Character[] };

export interface Props {
  recipes: Recipe[];
  machines: Machine[];
  stockImages: StockImageMap;
  itemNames: Record<string, string>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const LS_KEY = 'ct-accounts';
const OCCUPATIONS: Occupation[] = ['ทุกอาชีพ', 'วิศวะกร', 'หมอ', 'เชฟ', 'ไอดอล', 'เกษตร'];
const OCC_ICONS: Record<Occupation, string> = {
  'ทุกอาชีพ': '',
  'วิศวะกร': '⚙️',
  'หมอ': '💊',
  'เชฟ': '🍳',
  'ไอดอล': '🌟',
  'เกษตร': '🌾',
};
const OCC_AVATAR_KEY: Record<Occupation, string> = {
  'ทุกอาชีพ': 'engineer',
  'วิศวะกร': 'engineer',
  'หมอ': 'doctor',
  'เชฟ': 'chef',
  'ไอดอล': 'idol',
  'เกษตร': 'farmer',
};

function emptySlot(): Slot {
  return { itemKey: '', itemName: '', status: 'idle', endTime: '', startTime: null, durationSeconds: 0 };
}

function emptyChar(occ: Occupation = 'ทุกอาชีพ', name = ''): Character {
  return {
    id: crypto.randomUUID(),
    name,
    occupation: occ,
    avatar: null,
    slots: Array.from({ length: 6 }, emptySlot),
  };
}

function patchSlot(raw: Partial<Slot> & { itemKey: string; itemName: string; status: SlotStatus; endTime: string }): Slot {
  return {
    ...emptySlot(),
    ...raw,
    startTime: raw.startTime ?? null,
    durationSeconds: raw.durationSeconds ?? 0,
  };
}

function loadAccounts(): AccountId[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as AccountId[];
    // Migration: patch slots that may be missing new fields
    return parsed.map(acc => ({
      ...acc,
      chars: acc.chars.map(char => ({
        ...char,
        slots: char.slots.map(s => patchSlot(s as Parameters<typeof patchSlot>[0])),
      })),
    }));
  } catch {
    return [];
  }
}

function svgToDataUrl(svg: string): string {
  return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
}

/** Parse "HH:MM:SS" or "HH:MM" → total seconds. Returns 0 if unparseable. */
function parseTimeSeconds(timeStr: string | null): number {
  if (!timeStr) return 0;
  const parts = timeStr.split(':').map(Number);
  if (parts.some(isNaN)) return 0;
  const [h = 0, m = 0, s = 0] = parts;
  return h * 3600 + m * 60 + s;
}

/** Format seconds to HH:MM:SS */
function clock(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return [h, m, s].map(n => String(n).padStart(2, '0')).join(':');
}

// ─────────────────────────────────────────────────────────────────────────────
// SlotModal
// ─────────────────────────────────────────────────────────────────────────────

interface SlotModalProps {
  open: boolean;
  slot: Slot;
  recipes: Recipe[];
  stockImages: StockImageMap;
  occupation: Occupation;
  machines: Machine[];
  onSave: (updated: Slot) => void;
  onClose: () => void;
}

function SlotModal({ open, slot, recipes, stockImages, occupation, machines, onSave, onClose }: SlotModalProps) {
  const [selectedMachineId, setSelectedMachineId] = useState<string>('');
  const [selectedKey, setSelectedKey] = useState(slot.itemKey);
  const [selectedName, setSelectedName] = useState(slot.itemName);
  const [endTime, setEndTime] = useState(slot.endTime);
  const [durationSeconds, setDurationSeconds] = useState(slot.durationSeconds);

  // Reset when slot changes
  useEffect(() => {
    setSelectedKey(slot.itemKey);
    setSelectedName(slot.itemName);
    setEndTime(slot.endTime);
    setDurationSeconds(slot.durationSeconds);
    // pre-select machine from current slot's recipe
    const existing = recipes.find(r => r.id === slot.itemKey);
    setSelectedMachineId(existing?.machine_id ?? '');
  }, [slot, open, recipes]);

  // 1. Machines filtered by occupation
  const availableMachines = occupation === 'ทุกอาชีพ'
    ? machines
    : machines.filter(m => m.occupation === occupation || m.occupation === 'ทุกอาชีพ');

  // 2. Recipes filtered by selected machine
  const availableRecipes = selectedMachineId
    ? recipes.filter(r => r.machine_id === selectedMachineId)
    : availableMachines.flatMap(m => recipes.filter(r => r.machine_id === m.machine_id));

  const handleSave = () => {
    onSave({
      itemKey: selectedKey,
      itemName: selectedName,
      status: slot.status,            // status unchanged — controlled by Start/Stop
      endTime,
      startTime: slot.startTime,
      durationSeconds,
    });
  };

  return (
    <Modal
      open={open}
      title="แก้ไขช่องผลิต"
      onCancel={onClose}
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Button onClick={onClose}>ยกเลิก</Button>
          <Button type="primary" onClick={handleSave}>บันทึก</Button>
        </div>
      }
      width={480}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingTop: 4 }}>

        {/* Step 1: เลือกเครื่อง */}
        <div>
          <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 4px', fontWeight: 600 }}>เครื่องจักร</p>
          <Select
            showSearch
            allowClear
            placeholder="เลือกเครื่อง…"
            style={{ width: '100%' }}
            value={selectedMachineId || undefined}
            onChange={(val: string | undefined) => {
              setSelectedMachineId(val ?? '');
              setSelectedKey('');
              setSelectedName('');
            }}
            optionFilterProp="label"
            options={availableMachines.map(m => ({ value: m.machine_id, label: m.machine_name }))}
            optionRender={option => {
              const m = availableMachines.find(x => x.machine_id === option.value);
              return (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {m?.image
                    ? <img src={m.image} alt="" style={{ width: 24, height: 24, objectFit: 'contain', borderRadius: 4, background: '#f1f5f9' }} />
                    : <div style={{ width: 24, height: 24, borderRadius: 4, background: '#e2e8f0', flexShrink: 0 }} />}
                  <span style={{ fontSize: 13 }}>{option.label}</span>
                </div>
              );
            }}
          />
        </div>

        {/* Step 2: เลือกสูตร */}
        <div>
          <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 4px', fontWeight: 600 }}>สูตรการผลิต</p>
          <Select
            showSearch
            allowClear
            placeholder={selectedMachineId ? 'เลือกสูตร…' : 'เลือกเครื่องก่อน'}
            style={{ width: '100%' }}
            value={selectedKey || undefined}
            onChange={(val: string | undefined) => {
              if (!val) { setSelectedKey(''); setSelectedName(''); setDurationSeconds(0); return; }
              const r = availableRecipes.find(x => x.id === val);
              if (r) {
                setSelectedKey(r.id);
                setSelectedName(r.name);
                const secs = parseTimeSeconds(r.time_per_unit);
                setDurationSeconds(secs);
              }
            }}
            optionFilterProp="label"
            options={availableRecipes.map(r => ({ value: r.id, label: r.time_per_unit ? `${r.name} (${r.time_per_unit})` : r.name }))}
            optionRender={option => {
              const r = availableRecipes.find(x => x.id === option.value);
              const img = r ? (stockImages[r.id] ?? r.image) : undefined;
              return (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {img
                    ? <img src={img} alt="" style={{ width: 24, height: 24, objectFit: 'contain', borderRadius: 4, background: '#f1f5f9' }} />
                    : <div style={{ width: 24, height: 24, borderRadius: 4, background: '#e2e8f0', flexShrink: 0 }} />}
                  <span style={{ fontSize: 13 }}>{option.label}</span>
                </div>
              );
            }}
          />
        </div>

        {/* เวลาเสร็จโดยประมาณ (ไม่บังคับ) */}
        <div>
          <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 4px', fontWeight: 600 }}>เวลาเสร็จโดยประมาณ (HH:MM) — ไม่บังคับ</p>
          <input
            type="time"
            value={endTime}
            onChange={e => setEndTime(e.target.value)}
            style={{ width: '100%', height: 32, border: '1px solid #e2e8f0', borderRadius: 6, padding: '0 8px', fontSize: 14, color: '#0f172a', outline: 'none' }}
          />
        </div>

      </div>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// AddIdModal
// ─────────────────────────────────────────────────────────────────────────────

interface AddIdModalProps {
  open: boolean;
  onSave: (account: AccountId) => void;
  onClose: () => void;
}

function AddIdModal({ open, onSave, onClose }: AddIdModalProps) {
  const [label, setLabel] = useState('');
  const [chars, setChars] = useState<Array<{ name: string; occupation: Occupation }>>([
    { name: '', occupation: 'ทุกอาชีพ' },
    { name: '', occupation: 'ทุกอาชีพ' },
    { name: '', occupation: 'ทุกอาชีพ' },
  ]);

  const handleSave = () => {
    if (!label.trim()) {
      void message.warning('กรอกชื่อไอดีก่อน');
      return;
    }
    const account: AccountId = {
      id: crypto.randomUUID(),
      label: label.trim(),
      chars: chars.map(c => emptyChar(c.occupation, c.name.trim() || 'ตัวละคร')),
    };
    onSave(account);
    setLabel('');
    setChars([
      { name: '', occupation: 'ทุกอาชีพ' },
      { name: '', occupation: 'ทุกอาชีพ' },
      { name: '', occupation: 'ทุกอาชีพ' },
    ]);
  };

  return (
    <Modal
      open={open}
      title="เพิ่มไอดีใหม่"
      onCancel={onClose}
      footer={
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Button onClick={onClose}>ยกเลิก</Button>
          <Button type="primary" onClick={handleSave}>บันทึก</Button>
        </div>
      }
      width={400}
    >
      <div style={{ marginBottom: 16 }}>
        <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 4px' }}>ชื่อไอดี</p>
        <Input
          value={label}
          onChange={e => setLabel(e.target.value)}
          placeholder="เช่น ไอดี1"
          autoFocus
        />
      </div>

      <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 8px' }}>ตัวละคร 3 คน</p>

      {chars.map((c, i) => (
        <div key={i} className="ct-add-row">
          <span style={{ fontSize: 12, color: '#94a3b8', width: 20, flexShrink: 0 }}>{i + 1}.</span>
          <Input
            value={c.name}
            onChange={e => {
              const next = [...chars];
              next[i] = { ...next[i], name: e.target.value };
              setChars(next);
            }}
            placeholder={`ชื่อตัวละคร ${i + 1}`}
            style={{ flex: 1 }}
          />
          <Select
            value={c.occupation}
            onChange={v => {
              const next = [...chars];
              next[i] = { ...next[i], occupation: v };
              setChars(next);
            }}
            style={{ width: 120, flexShrink: 0 }}
            options={OCCUPATIONS.map(o => ({ value: o, label: o }))}
          />
        </div>
      ))}
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CharacterRow — one full-width card per character
// ─────────────────────────────────────────────────────────────────────────────

interface CharacterRowProps {
  character: Character;
  accountLabel: string;
  now: number;
  recipes: Recipe[];
  machines: Machine[];
  stockImages: StockImageMap;
  onUpdateSlot: (slotIndex: number, updated: Slot) => void;
  onUpdateAvatar: (dataUrl: string) => void;
  onUpdateName: (name: string) => void;
}

function CharacterRow({
  character,
  accountLabel,
  now,
  recipes,
  machines,
  stockImages,
  onUpdateSlot,
  onUpdateAvatar,
  onUpdateName,
}: CharacterRowProps) {
  const [slotModal, setSlotModal] = useState<number | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(character.name);
  const [cropSrc, setCropSrc] = useState<string | undefined>(undefined);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Auto-transition run → over when timer expires
  useEffect(() => {
    character.slots.forEach((slot, i) => {
      if (slot.status === 'run' && slot.startTime && slot.durationSeconds > 0) {
        const elapsed = Math.floor((now - Date.parse(slot.startTime)) / 1000);
        if (elapsed >= slot.durationSeconds) {
          onUpdateSlot(i, { ...slot, status: 'over' });
        }
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now]);

  const handleAvatarClick = () => fileInputRef.current?.click();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCropSrc(URL.createObjectURL(file));
    e.target.value = '';
  };

  const handleCropConfirm = (blob: Blob) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') onUpdateAvatar(reader.result);
    };
    reader.readAsDataURL(blob);
    URL.revokeObjectURL(cropSrc ?? '');
    setCropSrc(undefined);
  };

  const commitName = () => {
    setEditingName(false);
    const trimmed = nameInput.trim();
    if (trimmed && trimmed !== character.name) onUpdateName(trimmed);
    else setNameInput(character.name);
  };

  const avatarSvg = PIXEL_AVATARS[OCC_AVATAR_KEY[character.occupation]];
  const avatarSrc = character.avatar ?? svgToDataUrl(avatarSvg);

  return (
    <div className="ct-row-card">
      {/* Header */}
      <div className="ct-row-header">
        {/* Avatar */}
        <div
          className="ct-avatar"
          role="button"
          tabIndex={0}
          aria-label={`เปลี่ยนรูปโปรไฟล์ ${character.name}`}
          onClick={handleAvatarClick}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') handleAvatarClick(); }}
        >
          <img src={avatarSrc} alt={character.name} />
        </div>
        <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileChange} />

        {/* Name (editable inline) */}
        {editingName ? (
          <Input
            value={nameInput}
            onChange={e => setNameInput(e.target.value)}
            onBlur={commitName}
            onPressEnter={commitName}
            autoFocus
            size="small"
            style={{ flex: 1, fontSize: 14, fontWeight: 600, maxWidth: 200 }}
          />
        ) : (
          <span className="ct-row-name">{character.name}</span>
        )}

        {/* Occupation badge */}
        <span className="ct-occ-badge">
          {OCC_ICONS[character.occupation]} {character.occupation}
        </span>

        {/* Account label */}
        <span className="ct-row-acct-badge">{accountLabel}</span>

        {/* Edit name button */}
        <button
          className="ct-row-edit"
          aria-label="แก้ไขชื่อตัวละคร"
          onClick={() => { setNameInput(character.name); setEditingName(true); }}
        >
          ✎
        </button>
      </div>

      {/* Slot grid */}
      <div className="ct-row-slots">
        {character.slots.map((slot, i) => {
          const imgUrl = slot.itemKey ? (stockImages[slot.itemKey] ?? recipes.find(r => r.id === slot.itemKey)?.image) : undefined;
          const hasContent = slot.itemKey !== '' || slot.status !== 'idle';

          // Compute timer
          let remaining = 0;
          if (slot.status === 'run' && slot.startTime && slot.durationSeconds > 0) {
            remaining = slot.durationSeconds - Math.floor((now - Date.parse(slot.startTime)) / 1000);
            if (remaining < 0) remaining = 0;
          }

          const timerText = (() => {
            if (slot.status === 'run') return clock(Math.max(0, remaining));
            if (slot.status === 'over') return 'เกิน!';
            if (slot.status === 'done') return '✓ เสร็จ';
            if (slot.status === 'idle' && slot.durationSeconds > 0) return '--:--:--';
            return '';
          })();

          const timerMod = slot.status === 'run'
            ? 'run'
            : slot.status === 'over'
            ? 'over'
            : slot.status === 'done'
            ? 'done'
            : 'idle';

          return (
            <div key={i} className={`ct-slot ct-slot--${slot.status}`} style={{ position: 'relative' }}>
              <div className="ct-slot__strip" aria-hidden="true" />
              <span className="ct-slot__num">{i + 1}</span>

              {/* Item image */}
              {imgUrl ? (
                <img
                  className="ct-slot__icon"
                  src={imgUrl}
                  alt={slot.itemName}
                  style={{ width: 40, height: 40, objectFit: 'contain', flexShrink: 0 }}
                />
              ) : (
                <div
                  style={{ width: 40, height: 40, background: '#f1f5f9', borderRadius: 6, flexShrink: 0 }}
                  aria-hidden="true"
                />
              )}

              {/* Item name */}
              {slot.itemName && (
                <span
                  className="ct-slot__label"
                  style={{
                    fontSize: 10,
                    color: '#64748b',
                    textAlign: 'center',
                    lineHeight: 1.3,
                    maxWidth: '100%',
                    overflow: 'hidden',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    whiteSpace: 'normal',
                    padding: '0 4px',
                  }}
                >
                  {slot.itemName}
                </span>
              )}

              {/* Timer */}
              {timerText && (
                <span className={`ct-slot__timer ct-slot__timer--${timerMod}`}>
                  {timerText}
                </span>
              )}

              {/* Action button */}
              {slot.status === 'idle' && slot.itemKey ? (
                <button
                  className="ct-slot__btn ct-slot__btn--primary"
                  onClick={() => onUpdateSlot(i, { ...slot, status: 'run', startTime: new Date().toISOString() })}
                >
                  ▶ เริ่ม
                </button>
              ) : slot.status === 'run' ? (
                <button
                  className="ct-slot__btn"
                  onClick={() => onUpdateSlot(i, { ...slot, status: 'done' })}
                >
                  ⏹ หยุด
                </button>
              ) : slot.status === 'done' || slot.status === 'over' ? (
                <button
                  className="ct-slot__btn"
                  onClick={() => onUpdateSlot(i, { ...slot, status: 'idle', startTime: null })}
                >
                  รีเซ็ต
                </button>
              ) : (
                // idle, no recipe
                <button
                  className="ct-slot__btn ct-slot__btn--add"
                  onClick={() => setSlotModal(i)}
                >
                  + เพิ่ม
                </button>
              )}

              {/* Clear button — hover reveals, full reset */}
              {hasContent && (
                <button
                  className="ct-slot__clear"
                  aria-label="ล้างช่อง"
                  tabIndex={0}
                  onClick={e => { e.stopPropagation(); onUpdateSlot(i, emptySlot()); }}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.stopPropagation();
                      onUpdateSlot(i, emptySlot());
                    }
                  }}
                >
                  ✕
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Slot modal */}
      {slotModal !== null && (
        <SlotModal
          open={slotModal !== null}
          slot={character.slots[slotModal]}
          recipes={recipes}
          machines={machines}
          stockImages={stockImages}
          occupation={character.occupation}
          onSave={updated => {
            onUpdateSlot(slotModal, updated);
            setSlotModal(null);
          }}
          onClose={() => setSlotModal(null)}
        />
      )}

      {/* Crop modal */}
      <CropModal
        open={!!cropSrc}
        src={cropSrc}
        aspect={1}
        outputSize={200}
        onConfirm={handleCropConfirm}
        onCancel={() => { URL.revokeObjectURL(cropSrc ?? ''); setCropSrc(undefined); }}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CharacterTracker
// ─────────────────────────────────────────────────────────────────────────────

export function CharacterTracker({ recipes, machines, stockImages }: Props) {
  const [accounts, setAccounts] = useState<AccountId[]>(loadAccounts);
  const [occFilter, setOccFilter] = useState<Occupation | 'ทั้งหมด'>('ทั้งหมด');
  const [addIdOpen, setAddIdOpen] = useState(false);
  const [msgApi, msgCtx] = message.useMessage();

  // Single shared timer tick
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  // Persist to localStorage whenever accounts change
  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(accounts));
    } catch { /* quota exceeded, silent */ }
  }, [accounts]);

  const handleAddId = (account: AccountId) => {
    setAccounts(prev => [...prev, account]);
    setAddIdOpen(false);
    void msgApi.success(`เพิ่มไอดี "${account.label}" สำเร็จ`);
  };

  const handleUpdateSlot = (charId: string, slotIndex: number, updated: Slot) => {
    setAccounts(prev => prev.map(acc => ({
      ...acc,
      chars: acc.chars.map(c =>
        c.id !== charId ? c : {
          ...c,
          slots: c.slots.map((s, i) => i === slotIndex ? updated : s),
        }
      ),
    })));
  };

  const handleUpdateAvatar = (charId: string, dataUrl: string) => {
    setAccounts(prev => prev.map(acc => ({
      ...acc,
      chars: acc.chars.map(c => c.id !== charId ? c : { ...c, avatar: dataUrl }),
    })));
  };

  const handleUpdateName = (charId: string, name: string) => {
    setAccounts(prev => prev.map(acc => ({
      ...acc,
      chars: acc.chars.map(c => c.id !== charId ? c : { ...c, name }),
    })));
  };

  // Flatten all characters across all accounts, filtered by occupation
  const filteredRows = accounts.flatMap(acc =>
    acc.chars
      .filter(char =>
        occFilter === 'ทั้งหมด' ||
        char.occupation === occFilter ||
        char.occupation === 'ทุกอาชีพ'
      )
      .map(char => ({ char, accountLabel: acc.label }))
  );

  return (
    <div className="ct-wrap">
      {msgCtx}

      <h2 style={{ fontSize: 18, fontWeight: 600, color: '#0f172a', margin: '0 0 16px' }}>
        ติดตามตัวละคร
      </h2>

      {/* ID row */}
      <div className="ct-id-row" role="tablist" aria-label="ไอดีทั้งหมด">
        {accounts.map(acc => (
          <span key={acc.id} className="ct-chip is-active">
            {acc.label}
          </span>
        ))}
        <button
          className="ct-chip ct-chip--add"
          onClick={() => setAddIdOpen(true)}
          aria-label="เพิ่มไอดีใหม่"
        >
          + เพิ่มไอดี
        </button>
      </div>

      {/* Occupation filter */}
      <div className="ct-occ-row" role="group" aria-label="กรองอาชีพ">
        {(['ทั้งหมด', ...OCCUPATIONS.filter(o => o !== 'ทุกอาชีพ')] as Array<Occupation | 'ทั้งหมด'>).map(occ => {
          const icon = occ === 'ทั้งหมด' ? '' : OCC_ICONS[occ as Occupation];
          return (
            <button
              key={occ}
              className={`ct-occ-btn${occFilter === occ ? ' is-active' : ''}`}
              onClick={() => setOccFilter(occ)}
              aria-pressed={occFilter === occ}
            >
              {icon}{icon ? ' ' : ''}{occ}
            </button>
          );
        })}
      </div>

      {/* Character rows */}
      {accounts.length === 0 ? (
        <div className="ct-empty">
          ยังไม่มีไอดี — กด "+ เพิ่มไอดี" เพื่อเริ่มต้น
        </div>
      ) : filteredRows.length === 0 ? (
        <div className="ct-empty">
          ไม่มีตัวละครในอาชีพที่เลือก
        </div>
      ) : (
        <div style={{ marginTop: 16 }}>
          {filteredRows.map(({ char, accountLabel }) => (
            <CharacterRow
              key={char.id}
              character={char}
              accountLabel={accountLabel}
              now={now}
              recipes={recipes}
              machines={machines}
              stockImages={stockImages}
              onUpdateSlot={(slotIndex, updated) => handleUpdateSlot(char.id, slotIndex, updated)}
              onUpdateAvatar={dataUrl => handleUpdateAvatar(char.id, dataUrl)}
              onUpdateName={name => handleUpdateName(char.id, name)}
            />
          ))}
        </div>
      )}

      {/* Add ID modal */}
      <AddIdModal
        open={addIdOpen}
        onSave={handleAddId}
        onClose={() => setAddIdOpen(false)}
      />
    </div>
  );
}
