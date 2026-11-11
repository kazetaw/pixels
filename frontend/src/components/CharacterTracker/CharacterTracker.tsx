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
  }, [slot, open]);

  // Filter recipes by occupation via machine
  const filteredRecipes = occupation === 'ทุกอาชีพ'
    ? recipes
    : recipes.filter(r => {
        if (!r.machine_id) return false;
        const m = machines.find(x => x.machine_id === r.machine_id);
        return m?.occupation === occupation || m?.occupation === 'ทุกอาชีพ';
      });

  const handleSelect = (recipeId: string, recipeName: string) => {
    setSelectedKey(recipeId);
    setSelectedName(recipeName);
  };

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
      width={520}
    >
      {/* Product picker — Select with search + image, same style as FloorTimerDashboard */}
      <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 4px' }}>เลือกสินค้า / สูตร</p>
      <Select
        showSearch
        allowClear
        placeholder="ค้นหาสูตร…"
        style={{ width: '100%', marginBottom: 16 }}
        value={selectedKey || undefined}
        onChange={(val: string | undefined) => {
          if (!val) { setSelectedKey(''); setSelectedName(''); return; }
          const r = filteredRecipes.find(r => r.id === val);
          if (r) handleSelect(r.id, r.name);
        }}
        optionFilterProp="label"
        options={filteredRecipes.map(r => ({ value: r.id, label: r.name }))}
        optionRender={option => {
          const r = filteredRecipes.find(x => x.id === option.value);
          const img = r ? stockImages[r.id] ?? r.image : undefined;
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

      {/* Time & status */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 4px' }}>เวลาเสร็จ (HH:MM)</p>
          <input
            type="time"
            value={endTime}
            onChange={e => setEndTime(e.target.value)}
            style={{
              width: '100%', height: 32, border: '1px solid #e2e8f0', borderRadius: 6,
              padding: '0 8px', fontSize: 14, color: '#0f172a', outline: 'none',
            }}
          />
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 4px' }}>สถานะ</p>
          <Select
            value={status}
            onChange={v => setStatus(v)}
            style={{ width: '100%' }}
            options={[
              { value: 'idle', label: 'ว่าง' },
              { value: 'run', label: 'กำลังผลิต' },
              { value: 'done', label: 'เสร็จแล้ว' },
              { value: 'over', label: 'เกินเวลา' },
            ]}
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
// CharacterCard
// ─────────────────────────────────────────────────────────────────────────────

interface CharacterCardProps {
  character: Character;
  recipes: Recipe[];
  machines: Machine[];
  stockImages: StockImageMap;
  onUpdateSlot: (charId: string, slotIndex: number, updated: Slot) => void;
  onUpdateAvatar: (charId: string, dataUrl: string) => void;
}

function CharacterCard({ character, recipes, machines, stockImages, onUpdateSlot, onUpdateAvatar }: CharacterCardProps) {
  const [slotModal, setSlotModal] = useState<number | null>(null);
  const [cropSrc, setCropSrc] = useState<string | undefined>(undefined);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const avatarSvg = PIXEL_AVATARS[OCC_AVATAR_KEY[character.occupation]];
  const avatarSrc = character.avatar ?? svgToDataUrl(avatarSvg);

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setCropSrc(url);
    // reset so same file can be re-selected
    e.target.value = '';
  };

  const handleCropConfirm = (blob: Blob) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        onUpdateAvatar(character.id, reader.result);
      }
    };
    reader.readAsDataURL(blob);
    URL.revokeObjectURL(cropSrc ?? '');
    setCropSrc(undefined);
  };

  const color = dotColor([character]);

  return (
    <div className="ct-card">
      {/* Header */}
      <div className="ct-card__header">
        <div className="ct-avatar" onClick={handleAvatarClick} role="button" tabIndex={0}
          aria-label="เปลี่ยนรูปโปรไฟล์"
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') handleAvatarClick(); }}>
          <img src={avatarSrc} alt={character.name} />
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
        <span className="ct-name">{character.name}</span>
        <span className="ct-occ-badge">
          {OCC_ICONS[character.occupation]}{OCC_ICONS[character.occupation] ? ' ' : ''}{character.occupation}
        </span>
        <span className="ct-dot" style={{ background: color }} aria-hidden="true" />
      </div>

      {/* Slots */}
      <div className="ct-slots">
        {character.slots.map((slot, i) => {
          const imgUrl = slot.itemKey ? stockImages[slot.itemKey] : undefined;

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
            onUpdateSlot(character.id, slotModal, updated);
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

  const visibleChars = selectedAccount
    ? occFilter === 'ทั้งหมด'
      ? selectedAccount.chars
      : selectedAccount.chars.filter(c => c.occupation === occFilter || c.occupation === 'ทุกอาชีพ')
    : [];

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

      {/* Character grid */}
      {!selectedAccount ? (
        <div className="ct-empty">
          ยังไม่มีไอดี — กด "+ เพิ่มไอดี" เพื่อเริ่มต้น
        </div>
      ) : visibleChars.length === 0 ? (
        <div className="ct-empty">ไม่มีตัวละครในอาชีพนี้</div>
      ) : (
        <div className="ct-grid" role="list">
          {visibleChars.map(char => (
            <div key={char.id} role="listitem">
              <CharacterCard
                character={char}
                recipes={recipes}
                machines={machines}
                stockImages={stockImages}
                onUpdateSlot={handleUpdateSlot}
                onUpdateAvatar={handleUpdateAvatar}
              />
            </div>
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
