import { useEffect, useRef, useState } from 'react';
import { Button, InputNumber, Popconfirm, Select, Spin, message } from 'antd';
import {
  CheckOutlined, CloseOutlined, DeleteOutlined, EditOutlined, PlusOutlined,
} from '@ant-design/icons';
import {
  fetchAssignments, saveAssignment, deleteAssignment, type ContributorAssignment,
} from '../../api/client';
import type { Recipe, StockMap } from '../../types';
import { CONTRIBUTOR_PROFILES, contributorLabel } from '../shared/contributors';
import { ItemLabel, itemSelectVisuals } from '../shared/ItemVisual';
import { OCCUPATION_IMAGE } from '../shared/OccupationSelect';

interface Props { recipes: Recipe[]; stocks: StockMap; itemNames: Record<string, string> }

function fmt(n: number) { return n.toLocaleString('th-TH'); }

// ── Person avatar chip ────────────────────────────────────────────────────────

function PersonChip({
  name, avatar, flipAvatar, occupations, assignCount, selected, onClick,
}: {
  name: string; avatar?: string; flipAvatar?: boolean;
  occupations?: string[]; assignCount: number; selected: boolean;
  onClick: () => void;
}) {
  const occ = occupations?.[0];
  const occImg = occ ? OCCUPATION_IMAGE[occ as keyof typeof OCCUPATION_IMAGE] : undefined;

  return (
    <button
      className={`ae2-chip${selected ? ' ae2-chip--selected' : ''}`}
      onClick={onClick}
      type="button"
      aria-pressed={selected}
      aria-label={`${name}${assignCount ? ` · ${assignCount} งาน` : ''}`}
    >
      <div className="ae2-chip-avatar">
        {avatar
          ? <img src={avatar} alt="" className={flipAvatar ? 'is-flipped' : undefined} />
          : <span>{name.slice(0, 1)}</span>}
        {assignCount > 0 && (
          <span className="ae2-chip-badge">{assignCount}</span>
        )}
      </div>
      <span className="ae2-chip-name">{name}</span>
      {occImg && (
        <img src={occImg} alt="" className="ae2-chip-occ" />
      )}
    </button>
  );
}

// ── Assignment row (read mode) ────────────────────────────────────────────────

function AssignRow({
  row, stocks, recipes, itemNames, busy, onEdit, onDelete,
}: {
  row: ContributorAssignment; stocks: StockMap; recipes: Recipe[];
  itemNames: Record<string, string>; busy: boolean;
  onEdit: () => void; onDelete: () => void;
}) {
  const name = itemNames[row.item_id] ?? recipes.find(r => r.id === row.item_id)?.name ?? 'ไม่พบชื่อ';
  const inStock = stocks[row.item_id] ?? 0;
  const done = inStock >= row.target;
  const pct = row.target > 0 ? Math.min(100, Math.round((inStock / row.target) * 100)) : 0;

  return (
    <div className="ae2-row">
      <div className="ae2-row-item">
        <ItemLabel id={row.item_id} name={name} size={30} reserveImage />
      </div>
      <div className="ae2-row-right">
        <div className="ae2-row-bar">
          <div
            className={`ae2-row-fill${done ? ' is-done' : ''}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="ae2-row-count" style={{ color: done ? '#16a34a' : '#64748b' }}>
          {fmt(inStock)}<span className="ae2-row-sep">/</span><strong>{fmt(row.target)}</strong>
        </span>
        <div className="ae2-row-actions">
          <Button icon={<EditOutlined />} size="small" onClick={onEdit} disabled={busy} />
          <Popconfirm title="ลบงานนี้?" okText="ลบ" cancelText="ยกเลิก" onConfirm={onDelete}>
            <Button icon={<DeleteOutlined />} size="small" danger disabled={busy} />
          </Popconfirm>
        </div>
      </div>
    </div>
  );
}

// ── Edit / add form ───────────────────────────────────────────────────────────

function EditForm({
  initial, recipes, itemNames, busy, isNew,
  onSave, onCancel,
}: {
  initial: { item_id: string; target: number };
  recipes: Recipe[]; itemNames: Record<string, string>; busy: boolean; isNew: boolean;
  onSave: (item: string, target: number) => void;
  onCancel: () => void;
}) {
  const [item, setItem] = useState(initial.item_id);
  const [target, setTarget] = useState<number | null>(initial.target || null);

  const options = recipes
    .filter(r => r.time_per_unit)
    .map(r => ({ value: r.id, label: itemNames[r.id] ?? r.name }));

  return (
    <div className="ae2-form">
      <Select
        {...itemSelectVisuals}
        showSearch
        optionFilterProp="label"
        value={item || undefined}
        onChange={setItem}
        placeholder="ค้นหาสินค้าแปรรูป…"
        options={options}
        className="ae2-form-item"
      />
      <InputNumber
        min={1}
        precision={0}
        value={target}
        onChange={setTarget}
        placeholder="จำนวน"
        className="ae2-form-qty"
        formatter={v => v ? Number(v).toLocaleString('th-TH') : ''}
        parser={v => Number(v?.replace(/[^0-9]/g, '')) as unknown as 0}
      />
      <Button
        type="primary"
        icon={<CheckOutlined />}
        loading={busy}
        disabled={!item || !target}
        onClick={() => item && target && onSave(item, target)}
        size="small"
      >
        {isNew ? 'เพิ่ม' : 'บันทึก'}
      </Button>
      <Button icon={<CloseOutlined />} onClick={onCancel} size="small" />
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function AssignmentEditor({ recipes, stocks, itemNames }: Props) {
  const [rows, setRows] = useState<ContributorAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<string>(CONTRIBUTOR_PROFILES[0]?.name ?? '');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [msgApi, ctx] = message.useMessage();
  const panelRef = useRef<HTMLDivElement>(null);

  async function refresh() {
    try { setRows(await fetchAssignments()); }
    catch (e) { void msgApi.error((e as Error).message); }
    finally { setLoading(false); }
  }
  useEffect(() => { void refresh(); }, []);

  function selectPerson(name: string) {
    setSelected(name);
    setAdding(false);
    setEditingId(null);
    // scroll panel into view on mobile
    setTimeout(() => panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50);
  }

  async function save(item: string, target: number, existingId?: string) {
    setBusy(true);
    try {
      const saved = await saveAssignment({ contributor: selected, item_id: item, target });
      setRows(prev => [...prev.filter(r => r.id !== saved.id && r.id !== existingId), saved]);
      setEditingId(null);
      setAdding(false);
      void msgApi.success('บันทึกแล้ว');
    } catch (e) { void msgApi.error((e as Error).message); }
    finally { setBusy(false); }
  }

  async function remove(id: string) {
    setBusy(true);
    try {
      await deleteAssignment(id);
      setRows(prev => prev.filter(r => r.id !== id));
    } catch (e) { void msgApi.error((e as Error).message); }
    finally { setBusy(false); }
  }

  const personRows = rows.filter(r => r.contributor === selected);
  const selectedProfile = CONTRIBUTOR_PROFILES.find(p => p.name === selected);

  return (
    <div className="ae2-root">
      {ctx}

      {/* People picker — horizontal scrollable row */}
      <div className="ae2-picker" role="group" aria-label="เลือกสมาชิก">
        {CONTRIBUTOR_PROFILES.map(p => (
          <PersonChip
            key={p.name}
            name={p.name}
            avatar={p.avatar}
            flipAvatar={p.flipAvatar}
            occupations={p.occupations}
            assignCount={rows.filter(r => r.contributor === p.name).length}
            selected={selected === p.name}
            onClick={() => selectPerson(p.name)}
          />
        ))}
      </div>

      {/* Assignment panel for selected person */}
      <div className="ae2-panel" ref={panelRef}>
        {/* Panel header */}
        <div className="ae2-panel-header">
          <div className="ae2-panel-who">
            {selectedProfile?.avatar && (
              <img
                src={selectedProfile.avatar}
                alt=""
                className={`ae2-panel-avatar${selectedProfile.flipAvatar ? ' is-flipped' : ''}`}
              />
            )}
            <div>
              <strong>{contributorLabel(selected)}</strong>
              {selectedProfile?.occupations?.length && (
                <div className="ae2-panel-occs">
                  {selectedProfile.occupations.map(occ => {
                    const img = OCCUPATION_IMAGE[occ as keyof typeof OCCUPATION_IMAGE];
                    return (
                      <span key={occ} className="ae2-panel-occ">
                        {img && <img src={img} alt="" />}{occ}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
          <Button
            type="primary"
            ghost
            icon={<PlusOutlined />}
            size="small"
            disabled={busy || loading}
            onClick={() => { setAdding(true); setEditingId(null); }}
          >
            มอบหมายงาน
          </Button>
        </div>

        {/* Add form */}
        {adding && (
          <div className="ae2-form-wrap">
            <EditForm
              initial={{ item_id: '', target: 0 }}
              recipes={recipes} itemNames={itemNames} busy={busy} isNew
              onSave={(item, target) => save(item, target)}
              onCancel={() => setAdding(false)}
            />
          </div>
        )}

        {/* Rows */}
        {loading ? (
          <div className="ae2-loading"><Spin size="small" /> <span>กำลังโหลด…</span></div>
        ) : personRows.length === 0 && !adding ? (
          <div className="ae2-empty">
            <span>ยังไม่มีงานที่มอบหมาย</span>
            <Button
              type="dashed"
              icon={<PlusOutlined />}
              size="small"
              onClick={() => setAdding(true)}
            >
              เพิ่มงานแรก
            </Button>
          </div>
        ) : (
          <div className="ae2-rows">
            {personRows.map(row =>
              editingId === row.id ? (
                <div className="ae2-form-wrap" key={row.id}>
                  <EditForm
                    initial={{ item_id: row.item_id, target: row.target }}
                    recipes={recipes} itemNames={itemNames} busy={busy} isNew={false}
                    onSave={(item, target) => save(item, target, row.id)}
                    onCancel={() => setEditingId(null)}
                  />
                </div>
              ) : (
                <AssignRow
                  key={row.id}
                  row={row} stocks={stocks} recipes={recipes} itemNames={itemNames} busy={busy}
                  onEdit={() => { setEditingId(row.id); setAdding(false); }}
                  onDelete={() => remove(row.id)}
                />
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
}
