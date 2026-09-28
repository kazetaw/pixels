import { useEffect, useRef, useState } from 'react';
import { Button, InputNumber, Popconfirm, Select, Spin, Tag, message } from 'antd';
import { CheckOutlined, CloseOutlined, DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import { fetchAssignments, saveAssignment, deleteAssignment, type ContributorAssignment } from '../../api/client';
import type { Recipe, StockMap } from '../../types';
import { CONTRIBUTOR_PROFILES, contributorLabel } from '../shared/contributors';
import { ItemLabel, itemSelectVisuals } from '../shared/ItemVisual';

interface Props { recipes: Recipe[]; stocks: StockMap; itemNames: Record<string, string> }

// ── helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number) { return n.toLocaleString('th-TH'); }

// ── Inline edit row ───────────────────────────────────────────────────────────

function EditableRow({
  row, recipes, itemNames, busy,
  onSave, onCancel,
}: {
  row: ContributorAssignment & { editing?: boolean };
  recipes: Recipe[]; itemNames: Record<string, string>; busy: boolean;
  onSave: (item: string, target: number) => void;
  onCancel?: () => void;
}) {
  const [item, setItem] = useState(row.item_id);
  const [target, setTarget] = useState<number | null>(row.target);
  const isNew = !row.id;
  const label = itemNames[item] ?? recipes.find(r => r.id === item)?.name ?? '';

  const options = recipes
    .filter(r => r.time_per_unit)
    .map(r => ({ value: r.id, label: itemNames[r.id] ?? r.name }));

  return (
    <div className="ae-edit-row">
      <Select
        {...itemSelectVisuals}
        showSearch
        optionFilterProp="label"
        value={item || undefined}
        onChange={setItem}
        placeholder="ค้นหาสินค้าแปรรูป…"
        options={options}
        className="ae-edit-item"
      />
      <InputNumber
        min={1}
        precision={0}
        value={target}
        onChange={setTarget}
        placeholder="จำนวน"
        className="ae-edit-qty"
        formatter={v => v ? Number(v).toLocaleString('th-TH') : ''}
        parser={v => Number(v?.replace(/[^0-9]/g, '')) as unknown as 0}
      />
      <div className="ae-edit-actions">
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
        {onCancel && (
          <Button icon={<CloseOutlined />} onClick={onCancel} size="small" />
        )}
      </div>
      {label && !isNew && (
        <span className="ae-edit-preview">
          <ItemLabel id={item} name={label} size={20} reserveImage />
        </span>
      )}
    </div>
  );
}

// ── Assignment row (read mode) ────────────────────────────────────────────────

function AssignRow({
  row, stocks, recipes, itemNames, busy,
  onEdit, onDelete,
}: {
  row: ContributorAssignment; stocks: StockMap; recipes: Recipe[]; itemNames: Record<string, string>; busy: boolean;
  onEdit: () => void; onDelete: () => void;
}) {
  const name = itemNames[row.item_id] ?? recipes.find(r => r.id === row.item_id)?.name ?? 'ไม่พบชื่อ';
  const inStock = stocks[row.item_id] ?? 0;
  const done = inStock >= row.target;
  const pct = row.target > 0 ? Math.min(100, Math.round((inStock / row.target) * 100)) : 0;

  return (
    <div className="ae-row">
      <div className="ae-row-item">
        <ItemLabel id={row.item_id} name={name} size={28} reserveImage />
      </div>
      <div className="ae-row-progress">
        <div className="ae-row-bar">
          <div className={`ae-row-fill${done ? ' is-done' : ''}`} style={{ width: `${pct}%` }} />
        </div>
        <span className="ae-row-count" style={{ color: done ? '#16a34a' : '#64748b' }}>
          {fmt(inStock)} / <strong>{fmt(row.target)}</strong>
        </span>
      </div>
      <div className="ae-row-actions">
        <Button icon={<EditOutlined />} size="small" onClick={onEdit} disabled={busy} />
        <Popconfirm title="ลบงานนี้?" okText="ลบ" cancelText="ยกเลิก" onConfirm={onDelete}>
          <Button icon={<DeleteOutlined />} size="small" danger disabled={busy} />
        </Popconfirm>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function AssignmentEditor({ recipes, stocks, itemNames }: Props) {
  const [rows, setRows] = useState<ContributorAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [activePerson, setActivePerson] = useState<string | undefined>();
  const [editingId, setEditingId] = useState<string | null>(null);   // row id being edited
  const [addingFor, setAddingFor] = useState<string | null>(null);   // contributor name adding new row
  const [msgApi, ctx] = message.useMessage();
  const topRef = useRef<HTMLDivElement>(null);

  async function refresh() {
    try { setRows(await fetchAssignments()); }
    catch (e) { void msgApi.error((e as Error).message); }
    finally { setLoading(false); }
  }
  useEffect(() => { void refresh(); }, []);

  async function save(contributor: string, item: string, target: number, existingId?: string) {
    setBusy(true);
    try {
      const saved = await saveAssignment({ contributor, item_id: item, target });
      setRows(prev => [...prev.filter(r => r.id !== saved.id && r.id !== existingId), saved]);
      setEditingId(null);
      setAddingFor(null);
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

  const people = CONTRIBUTOR_PROFILES.map(p => p.name);
  const shownPeople = activePerson ? [activePerson] : people;

  return (
    <div className="ae-root" ref={topRef}>
      {ctx}

      {/* Filter bar */}
      <div className="ae-toolbar">
        <Select
          allowClear
          placeholder="กรองตามชื่อ…"
          value={activePerson}
          onChange={setActivePerson}
          options={people.map(n => ({ value: n, label: contributorLabel(n) }))}
          style={{ width: 180 }}
        />
        <span className="ae-toolbar-hint">
          {loading ? <Spin size="small" /> : `${rows.length} รายการทั้งหมด`}
        </span>
      </div>

      {/* Per-person sections */}
      <div className="ae-people">
        {shownPeople.map(name => {
          const profile = CONTRIBUTOR_PROFILES.find(p => p.name === name);
          const personRows = rows.filter(r => r.contributor === name);
          const isAdding = addingFor === name;

          return (
            <section key={name} className="ae-person">
              {/* Person header */}
              <div className="ae-person-header">
                <div className="ae-person-info">
                  {profile?.avatar && (
                    <img
                      src={profile.avatar}
                      alt=""
                      className={`ae-person-avatar${profile.flipAvatar ? ' is-flipped' : ''}`}
                    />
                  )}
                  <div>
                    <strong className="ae-person-name">{contributorLabel(name)}</strong>
                    {profile?.occupations && (
                      <div className="ae-person-occs">
                        {profile.occupations.map(occ => (
                          <Tag key={occ} color="blue" style={{ fontSize: 11, marginRight: 4 }}>{occ}</Tag>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <Button
                  type="dashed"
                  icon={<PlusOutlined />}
                  size="small"
                  disabled={busy}
                  onClick={() => { setAddingFor(isAdding ? null : name); setEditingId(null); }}
                >
                  เพิ่มงาน
                </Button>
              </div>

              {/* Add new row form */}
              {isAdding && (
                <div className="ae-add-form">
                  <EditableRow
                    row={{ id: '', contributor: name, item_id: '', target: 0 }}
                    recipes={recipes} itemNames={itemNames} busy={busy}
                    onSave={(item, target) => save(name, item, target)}
                    onCancel={() => setAddingFor(null)}
                  />
                </div>
              )}

              {/* Existing assignments */}
              {personRows.length === 0 && !isAdding ? (
                <p className="ae-empty">ยังไม่มีงานที่มอบหมาย</p>
              ) : (
                <div className="ae-rows">
                  {personRows.map(row =>
                    editingId === row.id ? (
                      <div className="ae-edit-wrap" key={row.id}>
                        <EditableRow
                          row={row}
                          recipes={recipes} itemNames={itemNames} busy={busy}
                          onSave={(item, target) => save(name, item, target, row.id)}
                          onCancel={() => setEditingId(null)}
                        />
                      </div>
                    ) : (
                      <AssignRow
                        key={row.id}
                        row={row} stocks={stocks} recipes={recipes} itemNames={itemNames} busy={busy}
                        onEdit={() => { setEditingId(row.id); setAddingFor(null); }}
                        onDelete={() => remove(row.id)}
                      />
                    )
                  )}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
