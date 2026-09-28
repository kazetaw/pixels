import { fetchAssignments, type ContributorAssignment } from '../../api/client';
import { useEffect, useState } from 'react';
import { Alert, Modal } from 'antd';
import { UnorderedListOutlined } from '@ant-design/icons';
import { contributorLabel, CONTRIBUTOR_PROFILES, type ContributorProfile } from '../shared/contributors';
import { OCCUPATION_IMAGE } from '../shared/OccupationSelect';
import { ItemLabel } from '../shared/ItemVisual';
import type { Occupation } from '../shared/OccupationSelect';
import type { StockMap } from '../../types';

interface OrganizationChartProps {
  stocks?: StockMap;
  itemNames?: Record<string, string>;
  nameToId?: Record<string, string>;
}

// ── Occupation colours ────────────────────────────────────────────────────────

const OCC_BG: Record<string, string> = {
  วิศวะกร: '#dbeafe', หมอ: '#dcfce7', เชฟ: '#ffedd5',
  ไอดอล: '#fce7f3', เกษตร: '#d9f99d', ทุกอาชีพ: '#f1f5f9',
};
const OCC_TEXT: Record<string, string> = {
  วิศวะกร: '#1d4ed8', หมอ: '#15803d', เชฟ: '#c2410c',
  ไอดอล: '#be185d', เกษตร: '#4d7c0f', ทุกอาชีพ: '#475569',
};

// ── Small shared sub-components ──────────────────────────────────────────────

function OccupationBadge({ occ }: { occ: Occupation }) {
  const img = OCCUPATION_IMAGE[occ];
  return (
    <span className="org-occ-badge" style={{ background: OCC_BG[occ] ?? '#f1f5f9', color: OCC_TEXT[occ] ?? '#475569' }}>
      {img && <img src={img} alt="" />}
      {occ}
    </span>
  );
}

function AvatarCircle({ profile, size = 56 }: { profile: ContributorProfile; size?: number }) {
  return (
    <div className="org-avatar" style={{ width: size, height: size, borderRadius: '50%' }}>
      {profile.avatar
        ? <img src={profile.avatar} alt={`รูป ${profile.name}`} className={profile.flipAvatar ? 'is-flipped' : undefined} />
        : <span>{profile.name.slice(0, 1)}</span>}
    </div>
  );
}

// ── Assignment row (used inside modal) ───────────────────────────────────────

function AssignmentRow({ itemId, label, inStock, target }: { itemId: string; label: string; inStock: number; target: number }) {
  const pct = target > 0 ? Math.min(100, Math.round((inStock / target) * 100)) : 0;
  const done = inStock >= target;
  return (
    <div className="org-assignment">
      <div className="org-assignment-header">
        <span className="org-assignment-name"><ItemLabel id={itemId} name={label} size={36} reserveImage /></span>
        <span className="org-assignment-count" style={{ color: done ? '#16a34a' : '#dc2626' }}>
          {inStock.toLocaleString('th-TH')}
          <span className="org-assignment-sep">/</span>
          <strong>{target.toLocaleString('th-TH')}</strong>
        </span>
      </div>
      <div className="org-assignment-bar" aria-label={`${pct}%`}>
        <div className={`org-assignment-fill${done ? ' is-done' : ''}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// ── Assignment modal ──────────────────────────────────────────────────────────

function AssignmentModal({
  profile, open, onClose, stocks, itemNames, nameToId,
}: {
  profile: ContributorProfile;
  open: boolean;
  onClose: () => void;
  stocks: StockMap;
  itemNames: Record<string, string>;
  nameToId: Record<string, string>;
}) {
  const resolveStock = (id: string): number => {
    if (stocks[id] !== undefined) return stocks[id];
    const uuid = nameToId[id];
    if (uuid && stocks[uuid] !== undefined) return stocks[uuid];
    const entry = Object.entries(itemNames).find(([, n]) => n === id);
    return entry ? (stocks[entry[0]] ?? 0) : 0;
  };

  const assignments = profile.assignments ?? [];

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <AvatarCircle profile={profile} size={40} />
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: '#0f172a', lineHeight: 1.3 }}>
              {contributorLabel(profile.name)}
            </div>
            {profile.role && (
              <div style={{ fontSize: 12, color: '#6366f1', marginTop: 2 }}>{profile.role}</div>
            )}
          </div>
        </div>
      }
      styles={{ body: { paddingTop: 8 } }}
    >
      {assignments.length === 0 ? (
        <p style={{ color: '#94a3b8', fontSize: 13, textAlign: 'center', padding: '24px 0' }}>
          ยังไม่มีรายการที่ต้องหา
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingTop: 4 }}>
          {assignments.map((a) => (
            <AssignmentRow
              key={a.item_id}
              itemId={a.item_id}
              label={itemNames[a.item_id] ?? a.label}
              inStock={resolveStock(a.item_id)}
              target={a.target}
            />
          ))}
        </div>
      )}
    </Modal>
  );
}

// ── Member card ───────────────────────────────────────────────────────────────

function MemberCard({
  profile, stocks, itemNames, nameToId, isCeo = false,
}: {
  profile: ContributorProfile;
  stocks: StockMap;
  itemNames: Record<string, string>;
  nameToId: Record<string, string>;
  isCeo?: boolean;
}) {
  const [modalOpen, setModalOpen] = useState(false);
  const hasAssignments = (profile.assignments?.length ?? 0) > 0;

  return (
    <>
      <article className={`org-card${isCeo ? ' org-card--ceo' : ''}`}>
        <div className="org-card-header">
          <AvatarCircle profile={profile} size={isCeo ? 80 : 56} />
          <div className="org-card-identity">
            <strong className="org-card-name">{contributorLabel(profile.name)}</strong>
            {profile.role && <span className="org-card-role">{profile.role}</span>}
            {(profile.occupations?.length ?? 0) > 0 && (
              <div className="org-card-occs">
                {profile.occupations!.map((occ) => <OccupationBadge key={occ} occ={occ} />)}
              </div>
            )}
          </div>
        </div>

        {/* "ต้องหา" button — always shown, greyed out if no assignments */}
        <button
          className={`org-task-btn${hasAssignments ? ' org-task-btn--active' : ''}`}
          onClick={() => setModalOpen(true)}
          aria-label={`ดูรายการต้องหาของ ${profile.name}`}
        >
          <UnorderedListOutlined style={{ fontSize: 13 }} />
          {hasAssignments ? `ต้องหา ${profile.assignments!.length} รายการ` : 'ยังไม่มีรายการ'}
        </button>
      </article>

      <AssignmentModal
        profile={profile}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        stocks={stocks}
        itemNames={itemNames}
        nameToId={nameToId}
      />
    </>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export function OrganizationChart({ stocks = {}, itemNames = {}, nameToId = {} }: OrganizationChartProps) {
  const [assignments, setAssignments] = useState<ContributorAssignment[]>([]);
  const [loadError, setLoadError] = useState('');
  useEffect(() => { fetchAssignments().then(setAssignments).catch(e => setLoadError(e.message)); }, []);
  const profiles = CONTRIBUTOR_PROFILES.map(profile => ({ ...profile, assignments: assignments.filter(a => a.contributor === profile.name).map(a => ({ item_id: a.item_id, label: itemNames[a.item_id] || 'ไม่พบชื่อสินค้า', target: a.target })) }));
  const ceo = profiles.find((p) => p.name === 'เอี๊ยม');
  const members = profiles.filter((p) => p.name !== 'เอี๊ยม');
  const cardProps = { stocks, itemNames, nameToId };

  return (
    <section className="org-chart" aria-label="ผังทีม Pixel Factory">
      {loadError && <Alert type="error" message="โหลดงานส่วนกลางไม่สำเร็จ" description={loadError} />}
      {ceo && (
        <div className="org-ceo-row">
          <MemberCard profile={ceo} isCeo {...cardProps} />
        </div>
      )}
      <div className="org-bridge" aria-hidden="true" />
      <div className="org-team-grid">
        {members.map((p) => <MemberCard key={p.name} profile={p} {...cardProps} />)}
      </div>
    </section>
  );
}
