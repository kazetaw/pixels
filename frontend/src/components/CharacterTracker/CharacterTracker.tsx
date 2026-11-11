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
type Slot = { itemKey: string; itemName: string; status: SlotStatus; endTime: string };
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
  return { itemKey: '', itemName: '', status: 'idle', endTime: '' };
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

function loadAccounts(): AccountId[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as AccountId[];
  } catch {
    return [];
  }
}

function svgToDataUrl(svg: string): string {
  return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
}

function dotColor(chars: Character[]): string {
  const statuses = chars.flatMap(c => c.slots.map(s => s.status));
  if (statuses.some(s => s === 'over')) return '#ea580c';
  if (statuses.some(s => s === 'run')) return '#2563eb';
  if (statuses.some(s => s === 'done')) return '#16a34a';
  return '#cbd5e1';
}

// ─────────────────────────────────────────────────────────────────────────────
// Fix 1 helper: compute end time from recipe time_per_unit
// ─────────────────────────────────────────────────────────────────────────────

function calcEndTime(timePerUnit: string): string {
  const parts = timePerUnit.split(':').map(Number);
  const [h = 0, m = 0, s = 0] = parts;
  const totalMs = (h * 3600 + m * 60 + s) * 1000;
  const end = new Date(Date.now() + totalMs);
  const hh = String(end.getHours()).padStart(2, '0');
  const mm = String(end.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
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
  const [status, setStatus] = useState<SlotStatus>(slot.status);
  const [endTime, setEndTime] = useState(slot.endTime);

  // Reset when slot changes
  useEffect(() => {
    setSelectedKey(slot.itemKey);
    setSelectedName(slot.itemName);
    setStatus(slot.status);
    setEndTime(slot.endTime);
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
    onSave({ itemKey: selectedKey, itemName: selectedName, status, endTime });
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
              if (!val) { setSelectedKey(''); setSelectedName(''); return; }
              const r = availableRecipes.find(r => r.id === val);
              if (r) {
                setSelectedKey(r.id);
                setSelectedName(r.name);
                // Fix 1: auto-fill end time from recipe duration
                if (r.time_per_unit) setEndTime(calcEndTime(r.time_per_unit));
              }
            }}
            optionFilterProp="label"
            options={availableRecipes.map(r => ({ value: r.id, label: r.name }))}
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

        {/* เวลา + สถานะ */}
        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 4px', fontWeight: 600 }}>เวลาเสร็จ</p>
            <input
              type="time"
              value={endTime}
              onChange={e => setEndTime(e.target.value)}
              style={{ width: '100%', height: 32, border: '1px solid #e2e8f0', borderRadius: 6, padding: '0 8px', fontSize: 14, color: '#0f172a', outline: 'none' }}
            />
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 4px', fontWeight: 600 }}>สถานะ</p>
            <Select
              value={status}
              onChange={v => setStatus(v)}
              style={{ width: '100%' }}
              options={[
                { value: 'idle', label: 'ว่าง' },
                { value: 'run', label: '🔵 กำลังผลิต' },
                { value: 'done', label: '🟢 เสร็จแล้ว' },
                { value: 'over', label: '🟠 เกินเวลา' },
              ]}
            />
          </div>
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
// Fix 2: AccountCard — groups all 3 characters with tab navigation
// ─────────────────────────────────────────────────────────────────────────────

interface AccountCardProps {
  account: AccountId;
  occFilter: Occupation | 'ทั้งหมด';
  recipes: Recipe[];
  machines: Machine[];
  stockImages: StockImageMap;
  onUpdateSlot: (charId: string, slotIndex: number, updated: Slot) => void;
  onUpdateAvatar: (charId: string, dataUrl: string) => void;
}

function AccountCard({ account, occFilter, recipes, machines, stockImages, onUpdateSlot, onUpdateAvatar }: AccountCardProps) {
  const [activeCharIdx, setActiveCharIdx] = useState(0);
  const [slotModal, setSlotModal] = useState<number | null>(null);
  const [cropSrc, setCropSrc] = useState<string | undefined>(undefined);
  const [cropTargetId, setCropTargetId] = useState<string | null>(null);
  const fileInputRefs = useRef<Array<HTMLInputElement | null>>([null, null, null]);

  // If active char is filtered out, switch to first visible one
  useEffect(() => {
    const isVisible = (char: Character) =>
      occFilter === 'ทั้งหมด' || char.occupation === occFilter || char.occupation === 'ทุกอาชีพ';

    if (!isVisible(account.chars[activeCharIdx])) {
      const firstVisible = account.chars.findIndex(isVisible);
      if (firstVisible !== -1) setActiveCharIdx(firstVisible);
    }
  }, [occFilter, account.chars, activeCharIdx]);

  const activeChar = account.chars[activeCharIdx];

  const isFiltered = (char: Character) =>
    occFilter !== 'ทั้งหมด' && char.occupation !== occFilter && char.occupation !== 'ทุกอาชีพ';

  const handleAvatarClick = (charId: string, idx: number) => {
    setCropTargetId(charId);
    fileInputRefs.current[idx]?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setCropSrc(url);
    e.target.value = '';
  };

  const handleCropConfirm = (blob: Blob) => {
    if (!cropTargetId) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        onUpdateAvatar(cropTargetId, reader.result);
      }
    };
    reader.readAsDataURL(blob);
    URL.revokeObjectURL(cropSrc ?? '');
    setCropSrc(undefined);
    setCropTargetId(null);
  };

  const handleClearSlot = (e: React.MouseEvent | React.KeyboardEvent, slotIndex: number) => {
    e.stopPropagation();
    onUpdateSlot(activeChar.id, slotIndex, { itemKey: '', itemName: '', status: 'idle', endTime: '' });
  };

  return (
    <div className="ct-account-card">
      {/* Character tabs */}
      <div className="ct-char-tabs" role="tablist" aria-label="เลือกตัวละคร">
        {account.chars.map((char, idx) => {
          const avatarSvg = PIXEL_AVATARS[OCC_AVATAR_KEY[char.occupation]];
          const avatarSrc = char.avatar ?? svgToDataUrl(avatarSvg);
          const color = dotColor([char]);
          const filtered = isFiltered(char);
          const isActive = idx === activeCharIdx;

          return (
            <button
              key={char.id}
              role="tab"
              aria-selected={isActive}
              className={`ct-char-tab${isActive ? ' is-active' : ''}${filtered ? ' is-filtered' : ''}`}
              onClick={() => { if (!filtered) setActiveCharIdx(idx); }}
              tabIndex={filtered ? -1 : 0}
            >
              {/* Avatar circle — clicking opens file picker */}
              <div
                className="ct-char-tab__avatar"
                role="button"
                tabIndex={filtered ? -1 : 0}
                aria-label={`เปลี่ยนรูปโปรไฟล์ ${char.name}`}
                onClick={e => {
                  e.stopPropagation();
                  if (!filtered) handleAvatarClick(char.id, idx);
                }}
                onKeyDown={e => {
                  if ((e.key === 'Enter' || e.key === ' ') && !filtered) {
                    e.stopPropagation();
                    handleAvatarClick(char.id, idx);
                  }
                }}
              >
                <img src={avatarSrc} alt={char.name} />
              </div>

              {/* Hidden file input per character */}
              <input
                ref={el => { fileInputRefs.current[idx] = el; }}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={handleFileChange}
              />

              <span className="ct-char-tab__name">{char.name}</span>

              {/* Status dot */}
              <span
                style={{ width: 8, height: 8, borderRadius: '50%', background: color, display: 'block', flexShrink: 0 }}
                aria-hidden="true"
              />
            </button>
          );
        })}
      </div>

      {/* Slot grid for active character */}
      <div className="ct-slots">
        {activeChar.slots.map((slot, i) => {
          const imgUrl = slot.itemKey ? stockImages[slot.itemKey] : undefined;
          const hasContent = slot.status !== 'idle' || slot.itemKey !== '';

          return (
            <div
              key={i}
              className={`ct-slot ct-slot--${slot.status}`}
              onClick={() => setSlotModal(i)}
              role="button"
              tabIndex={0}
              aria-label={`ช่อง ${i + 1}: ${slot.itemName || 'ว่าง'}`}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') setSlotModal(i); }}
            >
              <div className="ct-slot__strip" aria-hidden="true" />
              <span className="ct-slot__num">{i + 1}</span>

              {imgUrl ? (
                <img className="ct-slot__icon" src={imgUrl} alt={slot.itemName} />
              ) : slot.status !== 'idle' ? (
                <div style={{ width: '55%', aspectRatio: '1', background: '#e2e8f0', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#94a3b8' }} aria-hidden="true">?</div>
              ) : (
                <div style={{ width: '55%', aspectRatio: '1', background: '#f1f5f9', borderRadius: 4 }} aria-hidden="true" />
              )}

              {slot.itemName && (
                <span className="ct-slot__label">{slot.itemName}</span>
              )}
              <span className="ct-slot__time">{slot.endTime || '--:--'}</span>

              {/* Fix 3: Clear slot button */}
              {hasContent && (
                <button
                  className="ct-slot__clear"
                  aria-label="ล้างช่อง"
                  tabIndex={0}
                  onClick={e => handleClearSlot(e, i)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ' ') handleClearSlot(e, i);
                  }}
                >
                  ✕
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Slot modal for active character */}
      {slotModal !== null && (
        <SlotModal
          open={slotModal !== null}
          slot={activeChar.slots[slotModal]}
          recipes={recipes}
          machines={machines}
          stockImages={stockImages}
          occupation={activeChar.occupation}
          onSave={updated => {
            onUpdateSlot(activeChar.id, slotModal, updated);
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
        onCancel={() => { URL.revokeObjectURL(cropSrc ?? ''); setCropSrc(undefined); setCropTargetId(null); }}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CharacterTracker
// ─────────────────────────────────────────────────────────────────────────────

export function CharacterTracker({ recipes, machines, stockImages }: Props) {
  const [accounts, setAccounts] = useState<AccountId[]>(loadAccounts);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(() => {
    const loaded = loadAccounts();
    return loaded[0]?.id ?? null;
  });
  const [occFilter, setOccFilter] = useState<Occupation | 'ทั้งหมด'>('ทั้งหมด');
  const [addIdOpen, setAddIdOpen] = useState(false);
  const [msgApi, msgCtx] = message.useMessage();

  // Persist to localStorage whenever accounts change
  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(accounts));
    } catch { /* quota exceeded, silent */ }
  }, [accounts]);

  const selectedAccount = accounts.find(a => a.id === selectedAccountId) ?? null;

  const handleAddId = (account: AccountId) => {
    setAccounts(prev => [...prev, account]);
    setSelectedAccountId(account.id);
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

  return (
    <div className="ct-wrap">
      {msgCtx}

      <h2 style={{ fontSize: 18, fontWeight: 600, color: '#0f172a', margin: '0 0 16px' }}>
        ติดตามตัวละคร
      </h2>

      {/* ID row */}
      <div className="ct-id-row" role="tablist" aria-label="เลือกไอดี">
        {accounts.map(acc => (
          <button
            key={acc.id}
            role="tab"
            aria-selected={selectedAccountId === acc.id}
            className={`ct-chip${selectedAccountId === acc.id ? ' is-active' : ''}`}
            onClick={() => setSelectedAccountId(acc.id)}
          >
            {acc.label}
          </button>
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

      {/* Account card or empty state */}
      {!selectedAccount ? (
        <div className="ct-empty">
          ยังไม่มีไอดี — กด "+ เพิ่มไอดี" เพื่อเริ่มต้น
        </div>
      ) : (
        <AccountCard
          account={selectedAccount}
          occFilter={occFilter}
          recipes={recipes}
          machines={machines}
          stockImages={stockImages}
          onUpdateSlot={handleUpdateSlot}
          onUpdateAvatar={handleUpdateAvatar}
        />
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
