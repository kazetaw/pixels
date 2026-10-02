import { useEffect, useState } from 'react';
import { Spin, Alert, Button } from 'antd';
import { CheckCircleFilled, ReloadOutlined } from '@ant-design/icons';
import { fetchAssignmentSummary, type AssignmentSummaryItem } from '../../api/client';
import { ItemLabel } from '../shared/ItemVisual';
import { contributorLabel, CONTRIBUTOR_PROFILES } from '../shared/contributors';

function fmt(n: number) { return n.toLocaleString('th-TH'); }

function stacks(n: number) {
  const g = Math.floor(n / 99);
  const r = n % 99;
  if (g === 0) return `${fmt(r)} ชิ้น`;
  if (r === 0) return `${fmt(g)} กอง`;
  return `${fmt(g)} กอง + ${r} ชิ้น`;
}

function SummaryRow({ item }: { item: AssignmentSummaryItem }) {
  const [open, setOpen] = useState(false);
  const sentPct      = item.total_target > 0 ? Math.min(100, Math.round((item.sent / item.total_target) * 100)) : 0;
  const done         = item.remaining === 0;

  return (
    <div className="asmt-row">
      {/* Header */}
      <button className="asmt-row-head" onClick={() => setOpen(o => !o)} aria-expanded={open}>
        <div className="asmt-row-item">
          <ItemLabel id={item.item_id} name={item.item_name} size={30} reserveImage />
        </div>

        {/* Progress bar */}
        <div className="asmt-bar-wrap">
          <div className="asmt-bar">
            <div
              className={`asmt-bar-fill${done ? ' is-done' : ''}`}
              style={{ width: `${sentPct}%` }}
            />
          </div>
          <span className="asmt-bar-pct" style={{ color: done ? '#16a34a' : '#6366f1' }}>{sentPct}%</span>
        </div>

        {/* Numbers */}
        <div className="asmt-nums">
          <span className="asmt-num asmt-num--sent" title="ส่งแล้ว">
            <em>ส่งแล้ว</em>
            {fmt(item.sent)}
          </span>
          <span className="asmt-num asmt-num--target" title="เป้าหมายรวม">
            <em>เป้า</em>
            {fmt(item.total_target)}
          </span>
          <span
            className="asmt-num asmt-num--remain"
            title="คงเหลือต้องส่ง"
            style={{ color: done ? '#16a34a' : '#dc2626' }}
          >
            <em>เหลือ</em>
            {done ? <><CheckCircleFilled /> ครบ</> : stacks(item.remaining)}
          </span>
          <span className="asmt-num asmt-num--stock" title="ในคลังตอนนี้">
            <em>คลัง</em>
            {fmt(item.in_stock)}
          </span>
        </div>

        <span className="asmt-chevron" aria-hidden="true">{open ? '▲' : '▼'}</span>
      </button>

      {/* Expanded contributor breakdown */}
      {open && (
        <div className="asmt-contributors">
          {item.contributors.map(c => {
            const profile = CONTRIBUTOR_PROFILES.find(p => p.name === c.name);
            const sentPct = c.target > 0 ? Math.min(100, Math.round((c.sent / c.target) * 100)) : 0;
            const done = c.sent >= c.target;
            return (
              <div key={c.name} className="asmt-contributor">
                {/* Avatar */}
                <div className="asmt-contributor-avatar">
                  {profile?.avatar
                    ? <img src={profile.avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', transform: profile.flipAvatar ? 'scaleX(-1)' : undefined }} />
                    : <span style={{ fontSize: 11, fontWeight: 700, color: '#6366f1' }}>{c.name.slice(0, 1)}</span>}
                </div>
                {/* Name + mini progress */}
                <div className="asmt-contributor-info">
                  <span className="asmt-contributor-name">{contributorLabel(c.name)}</span>
                  <div className="asmt-contributor-bar">
                    <div className="asmt-bar" style={{ height: 4 }}>
                      <div className={`asmt-bar-fill${done ? ' is-done' : ''}`} style={{ width: `${sentPct}%` }} />
                    </div>
                  </div>
                </div>
                {/* Sent / target */}
                <div className="asmt-contributor-nums">
                  <span style={{ color: done ? '#16a34a' : '#6366f1', fontWeight: 700, fontSize: 13 }}>
                    {fmt(c.sent)}
                  </span>
                  <span style={{ color: '#94a3b8', fontSize: 11 }}>/ {fmt(c.target)}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function AssignmentSummary() {
  const [items, setItems] = useState<AssignmentSummaryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true); setError('');
    try { setItems(await fetchAssignmentSummary()); }
    catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, []);

  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}><Spin /></div>;
  if (error) return <Alert type="error" message={error} action={<Button onClick={() => void load()}>ลองใหม่</Button>} />;
  if (!items.length) return (
    <div style={{ padding: '32px 0', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
      ยังไม่มีการมอบหมายงาน
    </div>
  );

  const totalTarget   = items.reduce((s, i) => s + i.total_target, 0);
  const totalSent     = items.reduce((s, i) => s + i.sent, 0);
  const totalRemaining = items.reduce((s, i) => s + i.remaining, 0);
  const overallPct    = totalTarget > 0 ? Math.round((totalSent / totalTarget) * 100) : 0;

  return (
    <div className="asmt-root">
      {/* Overall header */}
      <div className="asmt-header">
        <div className="asmt-header-stats">
          <div className="asmt-stat">
            <strong>{fmt(totalSent)}</strong>
            <span>ส่งแล้ว</span>
          </div>
          <div className="asmt-stat asmt-stat--divider">/</div>
          <div className="asmt-stat">
            <strong>{fmt(totalTarget)}</strong>
            <span>เป้าหมายรวม</span>
          </div>
          <div className="asmt-stat asmt-stat--remain">
            <strong style={{ color: totalRemaining === 0 ? '#16a34a' : '#dc2626' }}>
            {totalRemaining === 0 ? <><CheckCircleFilled style={{ marginRight: 4 }} />ครบหมดแล้ว</> : stacks(totalRemaining)}
            </strong>
            <span>ยังต้องส่ง</span>
          </div>
        </div>
        <div className="asmt-header-bar">
          <div className="asmt-bar" style={{ height: 8 }}>
            <div
              className={`asmt-bar-fill${totalRemaining === 0 ? ' is-done' : ''}`}
              style={{ width: `${overallPct}%` }}
            />
          </div>
          <span style={{ fontSize: 12, color: '#64748b' }}>{overallPct}%</span>
        </div>
        <Button size="small" icon={<ReloadOutlined />} onClick={() => void load()}>รีเฟรช</Button>
      </div>

      {/* Per-item rows */}
      <div className="asmt-list">
        {items.map(item => <SummaryRow key={item.item_id} item={item} />)}
      </div>
    </div>
  );
}
