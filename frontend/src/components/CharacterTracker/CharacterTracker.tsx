import { useEffect, useRef, useState } from 'react';
import { Modal, Select, Input, message, Button } from 'antd';
import type { Recipe, Machine, StockImageMap } from '../../types';
import { CropModal } from '../shared/CropModal';
import { PIXEL_AVATARS } from './pixelIcons';
import './CharacterTracker.css';
import './CharacterTracker2.css';

// ─────────────────────────────────────────────────────────────────────────────
// Domain types
// ─────────────────────────────────────────────────────────────────────────────

type Occupation = 'วิศวะกร' | 'หมอ' | 'เชฟ' | 'ไอดอล' | 'เกษตร' | 'ทุกอาชีพ';
type SlotStatus = 'idle' | 'run' | 'done' | 'over';

type Slot = {
  id: string;
  itemKey: string;
  itemName: string;
  itemImage: string | null;
  floorNote: string;
  status: SlotStatus;
  startTime: string | null;
  durationSeconds: number;
  endTime: string;
};

type Character = {
  id: string;
  name: string;
  occupation: Occupation;
  avatar: string | null;
  slots: Slot[];
  note: string;
};

type AccountId = {
  id: string;
  label: string;
  chars: Character[];
};

export interface Props {
  recipes: Recipe[];
  machines: Machine[];
  stockImages: StockImageMap;
  itemNames: Record<string, string>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const LS_KEY = 'ct-accounts-v3';

const OCCUPATIONS: Occupation[] = ['ทุกอาชีพ', 'วิศวะกร', 'หมอ', 'เชฟ', 'ไอดอล', 'เกษตร'];

const OCC_DOT_COLOR: Record<Occupation, string> = {
  'วิศวะกร': '#2563EB',
  'หมอ': '#0891B2',
  'เชฟ': '#EA580C',
  'ไอดอล': '#9333EA',
  'เกษตร': '#16A34A',
  'ทุกอาชีพ': '#94A3B8',
};

const OCC_AVATAR_KEY: Record<Occupation, string> = {
  'ทุกอาชีพ': 'engineer',
  'วิศวะกร': 'engineer',
  'หมอ': 'doctor',
  'เชฟ': 'chef',
  'ไอดอล': 'idol',
  'เกษตร': 'farmer',
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function svgToDataUrl(svg: string): string {
  return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
}

/** Parse "H:MM:SS" or "H:MM" → total seconds. Returns 0 if null/unparseable. */
function parseTimeSeconds(timeStr: string | null): number {
  if (!timeStr) return 0;
  const parts = timeStr.split(':').map(Number);
  if (parts.some(isNaN)) return 0;
  const [h = 0, m = 0, s = 0] = parts;
  return h * 3600 + m * 60 + s;
}

/** Format remaining seconds to H:MM:SS */
function formatClock(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/** Format remaining seconds to H:MM (no seconds, for overview chips) */
function formatClockShort(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}:${String(m).padStart(2, '0')}`;
}

function makeSlot(): Slot {
  return {
    id: crypto.randomUUID(),
    itemKey: '',
    itemName: '',
    itemImage: null,
    floorNote: '',
    status: 'idle',
    startTime: null,
    durationSeconds: 0,
    endTime: '',
  };
}

function makeChar(name = 'ตัวละคร', occ: Occupation = 'ทุกอาชีพ'): Character {
  return {
    id: crypto.randomUUID(),
    name,
    occupation: occ,
    avatar: null,
    slots: [],
    note: '',
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

// ─────────────────────────────────────────────────────────────────────────────
// SlotModal helpers
// ─────────────────────────────────────────────────────────────────────────────

function hhmmToTodayISO(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.toISOString();
}

function addSecondsToHHMM(hhmm: string, seconds: number): string {
  const [h, m] = hhmm.split(':').map(Number);
  const totalMins = h * 60 + m + Math.floor(seconds / 60);
  const newH = Math.floor(totalMins / 60) % 24;
  const newM = totalMins % 60;
  return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`;
}

function isoToHHMM(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function getNowHHMM(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function getRoundHourPresets(): string[] {
  const now = new Date();
  const result: string[] = [];
  for (let i = 0; i < 4; i++) {
    const d = new Date(now);
    d.setHours(now.getHours() + i, 0, 0, 0);
    result.push(`${String(d.getHours()).padStart(2, '0')}:00`);
  }
  return result;
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
  onStatusChange: (updated: Slot) => void;
  onClose: () => void;
}

function SlotModal({
  open,
  slot,
  recipes,
  stockImages,
  occupation,
  machines,
  onSave,
  onStatusChange: _onStatusChange,
  onClose,
}: SlotModalProps) {
  const [selectedMachineId, setSelectedMachineId] = useState<string>('');
  const [selectedKey, setSelectedKey] = useState(slot.itemKey);
  const [selectedName, setSelectedName] = useState(slot.itemName);
  const [selectedImage, setSelectedImage] = useState<string | null>(slot.itemImage);
  const [floorNote, setFloorNote] = useState(slot.floorNote);
  const [durationSeconds, setDurationSeconds] = useState(slot.durationSeconds);
  const [manualStartHHMM, setManualStartHHMM] = useState<string>('');
  const [manualEndHHMM, setManualEndHHMM] = useState<string>('');
  const [localStatus, setLocalStatus] = useState<SlotStatus>(slot.status);

  useEffect(() => {
    if (!open) return;
    setSelectedKey(slot.itemKey);
    setSelectedName(slot.itemName);
    setSelectedImage(slot.itemImage);
    setFloorNote(slot.floorNote);
    setDurationSeconds(slot.durationSeconds);
    setLocalStatus(slot.status);
    const existing = recipes.find(r => r.id === slot.itemKey);
    setSelectedMachineId(existing?.machine_id ?? '');
    if (slot.startTime) {
      const startHHMM = isoToHHMM(slot.startTime);
      setManualStartHHMM(startHHMM);
      if (slot.durationSeconds > 0) {
        setManualEndHHMM(addSecondsToHHMM(startHHMM, slot.durationSeconds));
      } else {
        setManualEndHHMM('');
      }
    } else {
      setManualStartHHMM('');
      setManualEndHHMM('');
    }
  }, [slot, open, recipes]);

  const availableMachines =
    occupation === 'ทุกอาชีพ'
      ? machines
      : machines.filter(
          m => m.occupation === occupation || m.occupation === 'ทุกอาชีพ'
        );

  const availableRecipes = selectedMachineId
    ? recipes.filter(r => r.machine_id === selectedMachineId)
    : availableMachines.flatMap(m =>
        recipes.filter(r => r.machine_id === m.machine_id)
      );

  const handleSave = () => {
    const computedStartTime =
      manualStartHHMM ? hhmmToTodayISO(manualStartHHMM) : slot.startTime;
    onSave({
      ...slot,
      itemKey: selectedKey,
      itemName: selectedName,
      itemImage: selectedImage,
      floorNote,
      durationSeconds,
      startTime: computedStartTime,
      status: localStatus,
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
          <Button type="primary" onClick={handleSave}>
            บันทึก
          </Button>
        </div>
      }
      width={480}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingTop: 4 }}>
        {/* Machine */}
        <div>
          <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 4px', fontWeight: 600 }}>
            เครื่องจักร
          </p>
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
              setSelectedImage(null);
            }}
            optionFilterProp="label"
            options={availableMachines.map(m => ({
              value: m.machine_id,
              label: m.machine_name,
            }))}
            optionRender={option => {
              const m = availableMachines.find(x => x.machine_id === option.value);
              return (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {m?.image ? (
                    <img
                      src={m.image}
                      alt=""
                      style={{
                        width: 24,
                        height: 24,
                        objectFit: 'contain',
                        borderRadius: 4,
                        background: '#f1f5f9',
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: 4,
                        background: '#e2e8f0',
                        flexShrink: 0,
                      }}
                    />
                  )}
                  <span style={{ fontSize: 13 }}>{option.label}</span>
                </div>
              );
            }}
          />
        </div>

        {/* Recipe */}
        <div>
          <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 4px', fontWeight: 600 }}>
            สูตรการผลิต
          </p>
          <Select
            showSearch
            allowClear
            placeholder={selectedMachineId ? 'เลือกสูตร…' : 'เลือกเครื่องก่อน'}
            style={{ width: '100%' }}
            value={selectedKey || undefined}
            onChange={(val: string | undefined) => {
              if (!val) {
                setSelectedKey('');
                setSelectedName('');
                setSelectedImage(null);
                setDurationSeconds(0);
                return;
              }
              const r = availableRecipes.find(x => x.id === val);
              if (r) {
                setSelectedKey(r.id);
                setSelectedName(r.name);
                const img = stockImages[r.id] ?? r.image ?? null;
                setSelectedImage(img ?? null);
                const dur = parseTimeSeconds(r.time_per_unit);
                setDurationSeconds(dur);
                if (manualStartHHMM && dur > 0) {
                  setManualEndHHMM(addSecondsToHHMM(manualStartHHMM, dur));
                }
              }
            }}
            optionFilterProp="label"
            options={availableRecipes.map(r => ({
              value: r.id,
              label: r.time_per_unit ? `${r.name} (${r.time_per_unit})` : r.name,
            }))}
            optionRender={option => {
              const r = availableRecipes.find(x => x.id === option.value);
              const img = r ? (stockImages[r.id] ?? r.image) : undefined;
              return (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {img ? (
                    <img
                      src={img}
                      alt=""
                      style={{
                        width: 24,
                        height: 24,
                        objectFit: 'contain',
                        borderRadius: 4,
                        background: '#f1f5f9',
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: 4,
                        background: '#e2e8f0',
                        flexShrink: 0,
                      }}
                    />
                  )}
                  <span style={{ fontSize: 13 }}>{option.label}</span>
                </div>
              );
            }}
          />
        </div>

        {/* Floor note */}
        <div>
          <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 4px', fontWeight: 600 }}>
            ที่อยู่ / โน้ตชั้น
          </p>
          <Input
            value={floorNote}
            onChange={e => setFloorNote(e.target.value)}
            placeholder="ชั้น / แนล (เช่น ชั้น 2 แนล 3 5 7)"
          />
        </div>

        {/* Time section — only when a recipe is selected */}
        {selectedKey && (
          <>
            <div className="ct2-time-section">
              <div className="ct2-time-label">
                ⏱ ตั้งเวลาเริ่ม-เสร็จเอง{' '}
                <span style={{ fontWeight: 400, color: '#94A3B8' }}>(ไม่บังคับ)</span>
              </div>
              <div className="ct2-time-row">
                <div>
                  <p className="ct2-field-label">เริ่มเมื่อ</p>
                  <input
                    type="time"
                    className="ct2-time-input"
                    value={manualStartHHMM}
                    onChange={e => {
                      const v = e.target.value;
                      setManualStartHHMM(v);
                      if (v && durationSeconds > 0) {
                        setManualEndHHMM(addSecondsToHHMM(v, durationSeconds));
                      }
                    }}
                  />
                </div>
                <div>
                  <p className="ct2-field-label">เสร็จเมื่อ (ประมาณ)</p>
                  <input
                    type="time"
                    className="ct2-time-input ct2-time-input--end"
                    value={manualEndHHMM}
                    onChange={e => setManualEndHHMM(e.target.value)}
                  />
                </div>
              </div>
              {manualStartHHMM && durationSeconds > 0 && (
                <p className="ct2-time-hint">
                  ระบบคำนวณจากสูตร: เริ่ม + {Math.round(durationSeconds / 3600)} ชม. ={' '}
                  {manualEndHHMM} · แก้ได้
                </p>
              )}
              <div className="ct2-time-presets">
                <span className="ct2-preset-label">เริ่มตอน:</span>
                <button
                  className={`ct2-preset-btn${manualStartHHMM === getNowHHMM() ? ' on' : ''}`}
                  onClick={() => {
                    const v = getNowHHMM();
                    setManualStartHHMM(v);
                    if (durationSeconds > 0) setManualEndHHMM(addSecondsToHHMM(v, durationSeconds));
                  }}
                >
                  ตอนนี้
                </button>
                {getRoundHourPresets().map(hhmm => (
                  <button
                    key={hhmm}
                    className={`ct2-preset-btn${manualStartHHMM === hhmm ? ' on' : ''}`}
                    onClick={() => {
                      setManualStartHHMM(hhmm);
                      if (durationSeconds > 0) {
                        setManualEndHHMM(addSecondsToHHMM(hhmm, durationSeconds));
                      }
                    }}
                  >
                    {hhmm}
                  </button>
                ))}
                <button
                  className="ct2-preset-btn"
                  onClick={() => {
                    if (!manualStartHHMM) return;
                    const v = addSecondsToHHMM(manualStartHHMM, 3600);
                    setManualStartHHMM(v);
                    if (durationSeconds > 0) {
                      setManualEndHHMM(addSecondsToHHMM(v, durationSeconds));
                    }
                  }}
                >
                  +1 ชม.
                </button>
              </div>
            </div>

            {/* Status buttons */}
            <div>
              <p className="ct2-field-label" style={{ marginBottom: 6 }}>
                สถานะ
              </p>
              <div className="ct2-status-row">
                <button
                  className={`ct2-s-btn${localStatus === 'run' ? ' run' : ''}`}
                  onClick={() => setLocalStatus('run')}
                >
                  ▶ กำลังทำ
                </button>
                <button
                  className={`ct2-s-btn${localStatus === 'done' ? ' done' : ''}`}
                  onClick={() => setLocalStatus('done')}
                >
                  ✓ เสร็จ
                </button>
                <button
                  className={`ct2-s-btn${localStatus === 'over' ? ' over' : ''}`}
                  onClick={() => setLocalStatus('over')}
                >
                  ! เกินเวลา
                </button>
              </div>
            </div>
          </>
        )}
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
  const [msgApi, msgCtx] = message.useMessage();

  const handleSave = () => {
    if (!label.trim()) {
      void msgApi.warning('กรอกชื่อไอดีก่อน');
      return;
    }
    const account: AccountId = {
      id: crypto.randomUUID(),
      label: label.trim(),
      chars: chars.map(c => makeChar(c.name.trim() || 'ตัวละคร', c.occupation)),
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
          <Button type="primary" onClick={handleSave}>
            บันทึก
          </Button>
        </div>
      }
      width={400}
    >
      {msgCtx}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 4px' }}>ชื่อไอดี</p>
          <Input
            value={label}
            onChange={e => setLabel(e.target.value)}
            placeholder="เช่น STW001"
            autoFocus
          />
        </div>

        <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>ตัวละคร 3 คน</p>

        {chars.map((c, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, color: '#94a3b8', width: 20, flexShrink: 0 }}>
              {i + 1}.
            </span>
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
      </div>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SlotRow
// ─────────────────────────────────────────────────────────────────────────────

interface SlotRowProps {
  slot: Slot;
  now: number;
  onOpen: () => void;
  onFloorNoteChange: (note: string) => void;
  onDelete: () => void;
  onAutoOver: () => void;
}

function SlotRow({ slot, now, onOpen, onFloorNoteChange, onDelete, onAutoOver }: SlotRowProps) {
  // Compute timer
  let remaining = 0;
  if (slot.status === 'run' && slot.startTime && slot.durationSeconds > 0) {
    remaining = slot.durationSeconds - Math.floor((now - Date.parse(slot.startTime)) / 1000);
  }

  // Auto-transition to over
  useEffect(() => {
    if (slot.status === 'run' && slot.startTime && slot.durationSeconds > 0 && remaining <= 0) {
      onAutoOver();
    }
  });

  const timerText = (() => {
    if (slot.status === 'run') return formatClock(Math.max(0, remaining));
    if (slot.status === 'over') return 'เกิน!';
    if (slot.status === 'done') return '✓';
    return '--:--';
  })();

  const rowClass = `ct2-slot-row${slot.status !== 'idle' ? ` ${slot.status}` : ''}`;

  return (
    <div
      className={rowClass}
      role="button"
      tabIndex={0}
      aria-label={`ช่อง ${slot.itemName || 'ว่าง'}`}
      onClick={onOpen}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') onOpen();
      }}
    >
      {/* Image */}
      <div className="ct2-slot-img">
        {slot.itemImage ? (
          <img src={slot.itemImage} alt={slot.itemName} />
        ) : null}
      </div>

      {/* Middle */}
      <div className="ct2-slot-mid">
        {slot.itemName && <span className="ct2-slot-name">{slot.itemName}</span>}
        <input
          className="ct2-slot-floor"
          value={slot.floorNote}
          placeholder="ชั้น / แนล…"
          onChange={e => onFloorNoteChange(e.target.value)}
          onClick={e => e.stopPropagation()}
          onKeyDown={e => e.stopPropagation()}
        />
      </div>

      {/* Timer */}
      <span className="ct2-slot-time">{timerText}</span>

      {/* Status dot */}
      <span className="ct2-slot-dot" aria-hidden="true" />

      {/* Delete on hover */}
      <button
        className="ct2-slot-clear"
        aria-label="ลบช่องนี้"
        tabIndex={0}
        onClick={e => {
          e.stopPropagation();
          onDelete();
        }}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.stopPropagation();
            onDelete();
          }
        }}
      >
        ✕
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CharacterCard
// ─────────────────────────────────────────────────────────────────────────────

interface CharacterCardProps {
  character: Character;
  now: number;
  recipes: Recipe[];
  machines: Machine[];
  stockImages: StockImageMap;
  onUpdate: (updated: Character) => void;
}

function CharacterCard({
  character,
  now,
  recipes,
  machines,
  stockImages,
  onUpdate,
}: CharacterCardProps) {
  const [slotModalId, setSlotModalId] = useState<string | null>(null);
  const [cropSrc, setCropSrc] = useState<string | undefined>(undefined);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const avatarSvg = PIXEL_AVATARS[OCC_AVATAR_KEY[character.occupation]];
  const avatarSrc = character.avatar ?? svgToDataUrl(avatarSvg);

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
      if (typeof reader.result === 'string') {
        onUpdate({ ...character, avatar: reader.result });
      }
    };
    reader.readAsDataURL(blob);
    URL.revokeObjectURL(cropSrc ?? '');
    setCropSrc(undefined);
  };

  const handleNameBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const val = e.target.value.trim();
    if (val && val !== character.name) onUpdate({ ...character, name: val });
  };

  const handleNameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
  };

  const addSlot = () => {
    if (character.slots.length >= 6) return;
    const newSlot = makeSlot();
    onUpdate({ ...character, slots: [...character.slots, newSlot] });
    // Open modal immediately so user can pick a recipe
    setSlotModalId(newSlot.id);
  };

  const updateSlot = (slotId: string, updated: Slot) => {
    onUpdate({
      ...character,
      slots: character.slots.map(s => (s.id === slotId ? updated : s)),
    });
  };

  const deleteSlot = (slotId: string) => {
    onUpdate({ ...character, slots: character.slots.filter(s => s.id !== slotId) });
  };

  const activeSlot = slotModalId !== null
    ? character.slots.find(s => s.id === slotModalId)
    : undefined;

  return (
    <div className="ct2-char-card">
      {/* Header */}
      <div className="ct2-char-head">
        <div
          className="ct2-char-ava"
          role="button"
          tabIndex={0}
          aria-label={`เปลี่ยนรูป ${character.name}`}
          onClick={handleAvatarClick}
          onKeyDown={e => {
            if (e.key === 'Enter' || e.key === ' ') handleAvatarClick();
          }}
        >
          <img src={avatarSrc} alt={character.name} />
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />

        <input
          className="ct2-char-name"
          defaultValue={character.name}
          placeholder="ชื่อตัวละคร"
          onBlur={handleNameBlur}
          onKeyDown={handleNameKeyDown}
          aria-label="ชื่อตัวละคร"
        />

        <span
          className="ct2-occ-dot"
          style={{ background: OCC_DOT_COLOR[character.occupation] }}
          title={character.occupation}
        />
      </div>

      {/* Body */}
      <div className="ct2-char-body">
        {character.slots.map(slot => (
          <SlotRow
            key={slot.id}
            slot={slot}
            now={now}
            onOpen={() => setSlotModalId(slot.id)}
            onFloorNoteChange={note => updateSlot(slot.id, { ...slot, floorNote: note })}
            onDelete={() => deleteSlot(slot.id)}
            onAutoOver={() => updateSlot(slot.id, { ...slot, status: 'over' })}
          />
        ))}

        {character.slots.length < 6 && (
          <button className="ct2-slot-add" onClick={addSlot} aria-label="เพิ่มช่องผลิต">
            ＋ เพิ่มช่อง
          </button>
        )}

        <textarea
          className="ct2-char-note"
          rows={2}
          value={character.note}
          placeholder="โน้ต เช่น เข้าตี 2, ต้องเก็บก่อนเที่ยง…"
          onChange={e => onUpdate({ ...character, note: e.target.value })}
          aria-label="โน้ตตัวละคร"
        />
      </div>

      {/* Slot modal */}
      {activeSlot !== undefined && (
        <SlotModal
          open={slotModalId !== null}
          slot={activeSlot}
          recipes={recipes}
          machines={machines}
          stockImages={stockImages}
          occupation={character.occupation}
          onSave={updated => {
            updateSlot(activeSlot.id, updated);
            setSlotModalId(null);
          }}
          onStatusChange={updated => {
            updateSlot(activeSlot.id, updated);
          }}
          onClose={() => setSlotModalId(null)}
        />
      )}

      {/* Crop modal */}
      <CropModal
        open={!!cropSrc}
        src={cropSrc}
        aspect={1}
        outputSize={200}
        onConfirm={handleCropConfirm}
        onCancel={() => {
          URL.revokeObjectURL(cropSrc ?? '');
          setCropSrc(undefined);
        }}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// AccountCard
// ─────────────────────────────────────────────────────────────────────────────

interface AccountCardProps {
  account: AccountId;
  now: number;
  recipes: Recipe[];
  machines: Machine[];
  stockImages: StockImageMap;
  onUpdate: (updated: AccountId) => void;
  onDelete: () => void;
}

function AccountCard({
  account,
  now,
  recipes,
  machines,
  stockImages,
  onUpdate,
  onDelete,
}: AccountCardProps) {
  const runCount = account.chars.reduce(
    (n, c) => n + c.slots.filter(s => s.status === 'run').length,
    0
  );
  const doneCount = account.chars.reduce(
    (n, c) => n + c.slots.filter(s => s.status === 'done' || s.status === 'over').length,
    0
  );

  const metaText =
    runCount > 0 || doneCount > 0
      ? `${runCount} กำลังทำ / ${doneCount} เสร็จ`
      : 'ว่างทั้งหมด';

  return (
    <div className="ct2-id-card">
      {/* Header */}
      <div className="ct2-id-head">
        <span style={{ fontSize: 16 }}>🎮</span>
        <input
          className="ct2-id-head-label"
          defaultValue={account.label}
          placeholder="ชื่อไอดี"
          onBlur={e => {
            const val = e.target.value.trim();
            if (val && val !== account.label) onUpdate({ ...account, label: val });
          }}
          onKeyDown={e => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          }}
          aria-label="ชื่อไอดี"
        />
        <span className="ct2-id-meta">{metaText}</span>
        <button
          className="ct2-id-edit-btn"
          onClick={() => {
            /* inline editing via input blur — no extra step needed */
          }}
          aria-label="แก้ไขชื่อไอดี"
        >
          ✎ แก้ไข
        </button>
        <button
          className="ct2-id-delete-btn"
          onClick={onDelete}
          aria-label="ลบไอดีนี้"
        >
          ✕
        </button>
      </div>

      {/* 3-column grid of character cards */}
      <div className="ct2-id-body">
        {account.chars.map(char => (
          <CharacterCard
            key={char.id}
            character={char}
            now={now}
            recipes={recipes}
            machines={machines}
            stockImages={stockImages}
            onUpdate={updated =>
              onUpdate({
                ...account,
                chars: account.chars.map(c => (c.id === updated.id ? updated : c)),
              })
            }
          />
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// OverviewPanel
// ─────────────────────────────────────────────────────────────────────────────

interface OverviewPanelProps {
  accounts: AccountId[];
  now: number;
}

function OverviewPanel({ accounts, now }: OverviewPanelProps) {
  const [open, setOpen] = useState(true);

  const totalChars = accounts.reduce((n, a) => n + a.chars.length, 0);
  const overCount = accounts.reduce(
    (n, a) =>
      n + a.chars.reduce((m, c) => m + c.slots.filter(s => s.status === 'over').length, 0),
    0
  );

  const summaryText =
    `${totalChars} ตัวละคร` + (overCount > 0 ? ` · ${overCount} เกินเวลา!` : '');

  return (
    <div className="ct2-overview">
      <div className="ct2-ov-head">
        <h2>📋 ภาพรวม</h2>
        <div className="ct2-ov-head-right">
          <span className="ct2-ov-summary">{summaryText}</span>
          <button
            className="ct2-ov-toggle"
            onClick={() => setOpen(o => !o)}
            aria-expanded={open}
            aria-label={open ? 'ย่อ' : 'ขยาย'}
          >
            {open ? '[▾]' : '[▴]'}
          </button>
        </div>
      </div>
      {open && (
        <div className="ct2-ov-body">
          {accounts.flatMap(account =>
            account.chars.map(character => {
              const avatarSvg = PIXEL_AVATARS[OCC_AVATAR_KEY[character.occupation]];
              const avatarSrc = character.avatar ?? svgToDataUrl(avatarSvg);

              const activeSlots = character.slots.filter(s => s.status !== 'idle');

              return (
                <div key={`${account.id}-${character.id}`} className="ct2-ov-row">
                  <div className="ct2-ov-ava">
                    <img src={avatarSrc} alt={character.name} />
                  </div>
                  <span className="ct2-ov-name">{character.name}</span>
                  <span className="ct2-ov-id">{account.label}</span>
                  <div className="ct2-ov-chips">
                    {activeSlots.length === 0 ? (
                      <span className="ct2-ov-empty">ยังไม่มีช่อง</span>
                    ) : (
                      activeSlots.map(slot => {
                        let chipClass = 'ct2-ov-chip';
                        let chipText = slot.itemName;

                        if (slot.status === 'run') {
                          chipClass += ' ct2-ov-chip--run';
                          let remaining = 0;
                          if (slot.startTime && slot.durationSeconds > 0) {
                            remaining = slot.durationSeconds - Math.floor((now - Date.parse(slot.startTime)) / 1000);
                          }
                          chipText = `${slot.itemName} ${formatClockShort(Math.max(0, remaining))}`;
                        } else if (slot.status === 'done') {
                          chipClass += ' ct2-ov-chip--done';
                          chipText = `${slot.itemName} ✓`;
                        } else if (slot.status === 'over') {
                          chipClass += ' ct2-ov-chip--over';
                          chipText = `${slot.itemName} เกิน!`;
                        }

                        return (
                          <span key={slot.id} className={chipClass}>
                            <span className="ct2-ov-chip__dot" />
                            {chipText}
                          </span>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })
          )}
          {totalChars === 0 && (
            <span className="ct2-ov-empty">ยังไม่มีตัวละคร</span>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CharacterTracker (main component)
// ─────────────────────────────────────────────────────────────────────────────

export function CharacterTracker({ recipes, machines, stockImages }: Props) {
  const [accounts, setAccounts] = useState<AccountId[]>(loadAccounts);
  const [occFilter, setOccFilter] = useState<Occupation | 'ทั้งหมด'>('ทั้งหมด');
  const [addIdOpen, setAddIdOpen] = useState(false);
  const [now, setNow] = useState(Date.now);

  // Shared 1-second tick for timers
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  // Persist to localStorage on every change
  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(accounts));
    } catch {
      /* quota exceeded — silent */
    }
  }, [accounts]);

  const handleAddId = (account: AccountId) => {
    setAccounts(prev => [...prev, account]);
    setAddIdOpen(false);
  };

  const handleUpdateAccount = (updated: AccountId) => {
    setAccounts(prev => prev.map(a => (a.id === updated.id ? updated : a)));
  };

  const handleDeleteAccount = (accountId: string) => {
    setAccounts(prev => prev.filter(a => a.id !== accountId));
  };

  // Filter accounts: keep account if any of its chars match the filter
  const filteredAccounts =
    occFilter === 'ทั้งหมด'
      ? accounts
      : accounts.filter(acc =>
          acc.chars.some(
            c => c.occupation === occFilter || c.occupation === 'ทุกอาชีพ'
          )
        );

  const occButtons: Array<Occupation | 'ทั้งหมด'> = [
    'ทั้งหมด',
    'วิศวะกร',
    'หมอ',
    'เชฟ',
    'ไอดอล',
    'เกษตร',
  ];

  return (
    <div className="ct2-wrap">
      {/* Occupation filter */}
      <div className="ct2-occ-row" role="group" aria-label="กรองอาชีพ">
        {occButtons.map(occ => (
          <button
            key={occ}
            className={`ct2-occ-btn${occFilter === occ ? ' on' : ''}`}
            onClick={() => setOccFilter(occ)}
            aria-pressed={occFilter === occ}
          >
            {occ}
          </button>
        ))}
      </div>

      {/* Overview panel — always shows all accounts */}
      {accounts.length > 0 && <OverviewPanel accounts={accounts} now={now} />}

      {/* Account cards */}
      {accounts.length === 0 ? (
        <div className="ct2-empty">ยังไม่มีไอดี — กด "+ เพิ่ม ID ใหม่" เพื่อเริ่มต้น</div>
      ) : filteredAccounts.length === 0 ? (
        <div className="ct2-empty">ไม่มีตัวละครในอาชีพที่เลือก</div>
      ) : (
        filteredAccounts.map(acc => (
          <AccountCard
            key={acc.id}
            account={acc}
            now={now}
            recipes={recipes}
            machines={machines}
            stockImages={stockImages}
            onUpdate={handleUpdateAccount}
            onDelete={() => handleDeleteAccount(acc.id)}
          />
        ))
      )}

      {/* Add ID button */}
      <button
        className="ct2-add-id-btn"
        onClick={() => setAddIdOpen(true)}
        aria-label="เพิ่ม ID ใหม่"
      >
        ＋ เพิ่ม ID ใหม่
      </button>

      {/* Add ID modal */}
      <AddIdModal
        open={addIdOpen}
        onSave={handleAddId}
        onClose={() => setAddIdOpen(false)}
      />
    </div>
  );
}
