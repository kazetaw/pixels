import { contributorLabel, CONTRIBUTOR_PROFILES, type ContributorProfile } from '../shared/contributors';
import { OCCUPATION_IMAGE } from '../shared/OccupationSelect';
import type { Occupation } from '../shared/OccupationSelect';
import type { StockMap } from '../../types';

interface OrganizationChartProps {
  stocks?: StockMap;
  itemNames?: Record<string, string>;
  /** item_id → item_id reverse lookup: name string → uuid */
  nameToId?: Record<string, string>;
}

// ── helpers ──────────────────────────────────────────────────────────────────

const OCC_BG: Record<string, string> = {
  วิศวะกร: '#dbeafe',
  หมอ:      '#dcfce7',
  เชฟ:      '#ffedd5',
  ไอดอล:   '#fce7f3',
  เกษตร:   '#d9f99d',
  ทุกอาชีพ: '#f1f5f9',
};

const OCC_TEXT: Record<string, string> = {
  วิศวะกร: '#1d4ed8',
  หมอ:      '#15803d',
  เชฟ:      '#c2410c',
  ไอดอล:   '#be185d',
  เกษตร:   '#4d7c0f',
  ทุกอาชีพ: '#475569',
};

function OccupationBadge({ occ }: { occ: Occupation }) {
  const img = OCCUPATION_IMAGE[occ];
  return (
    <span
      className="org-occ-badge"
      style={{ background: OCC_BG[occ] ?? '#f1f5f9', color: OCC_TEXT[occ] ?? '#475569' }}
    >
      {img && <img src={img} alt="" />}
      {occ}
    </span>
  );
}

function Avatar({ profile, size = 64 }: { profile: ContributorProfile; size?: number }) {
  return (
    <div
      className="org-avatar"
      style={{ width: size, height: size, borderRadius: '50%' }}
    >
      {profile.avatar ? (
        <img
          src={profile.avatar}
          alt={`รูป ${profile.name}`}
          className={profile.flipAvatar ? 'is-flipped' : undefined}
        />
      ) : (
        <span>{profile.name.slice(0, 1)}</span>
      )}
    </div>
  );
}

// ── Assignment row ────────────────────────────────────────────────────────────

function AssignmentRow({
  label,
  inStock,
  target,
}: {
  label: string;
  inStock: number;
  target: number;
}) {
  const pct = target > 0 ? Math.min(100, Math.round((inStock / target) * 100)) : 0;
  const done = inStock >= target;
  return (
    <div className="org-assignment">
      <div className="org-assignment-header">
        <span className="org-assignment-name">{label}</span>
        <span
          className="org-assignment-count"
          style={{ color: done ? '#16a34a' : '#dc2626' }}
        >
          {inStock.toLocaleString('th-TH')}
          <span className="org-assignment-sep">/</span>
          <strong>{target.toLocaleString('th-TH')}</strong>
        </span>
      </div>
      <div className="org-assignment-bar" aria-label={`${pct}%`}>
        <div
          className={`org-assignment-fill${done ? ' is-done' : ''}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ── Member card ───────────────────────────────────────────────────────────────

function MemberCard({
  profile,
  stocks = {},
  itemNames = {},
  nameToId = {},
  isCeo = false,
}: {
  profile: ContributorProfile;
  stocks?: StockMap;
  itemNames?: Record<string, string>;
  nameToId?: Record<string, string>;
  isCeo?: boolean;
}) {
  // resolve item_id from label: try direct UUID key first, then reverse-lookup by name
  const resolveStock = (item_id: string): number => {
    if (stocks[item_id] !== undefined) return stocks[item_id];
    // try nameToId reverse map
    const uuid = nameToId[item_id];
    if (uuid && stocks[uuid] !== undefined) return stocks[uuid];
    // try scanning itemNames values
    const entry = Object.entries(itemNames).find(([, n]) => n === item_id);
    if (entry) return stocks[entry[0]] ?? 0;
    return 0;
  };

  const hasAssignments = (profile.assignments?.length ?? 0) > 0;

  return (
    <article className={`org-card${isCeo ? ' org-card--ceo' : ''}`}>
      {/* header: avatar + name + occupations */}
      <div className="org-card-header">
        <Avatar profile={profile} size={isCeo ? 80 : 56} />
        <div className="org-card-identity">
          <strong className="org-card-name">{contributorLabel(profile.name)}</strong>
          {profile.role && (
            <span className="org-card-role">{profile.role}</span>
          )}
          {(profile.occupations?.length ?? 0) > 0 && (
            <div className="org-card-occs">
              {profile.occupations!.map((occ) => (
                <OccupationBadge key={occ} occ={occ} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* assignments */}
      {hasAssignments && (
        <div className="org-card-assignments">
          <p className="org-card-assignments-label">ต้องหา</p>
          {profile.assignments!.map((a) => (
            <AssignmentRow
              key={a.item_id}
              label={itemNames[a.item_id] ?? a.label}
              inStock={resolveStock(a.item_id)}
              target={a.target}
            />
          ))}
        </div>
      )}
    </article>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export function OrganizationChart({ stocks = {}, itemNames = {}, nameToId = {} }: OrganizationChartProps) {
  const ceo = CONTRIBUTOR_PROFILES.find((p) => p.name === 'เอี๊ยม');
  const members = CONTRIBUTOR_PROFILES.filter((p) => p.name !== 'เอี๊ยม');

  const cardProps = { stocks, itemNames, nameToId };

  return (
    <section className="org-chart" aria-label="ผังทีม Pixel Factory">
      {/* CEO */}
      {ceo && (
        <div className="org-ceo-row">
          <MemberCard profile={ceo} isCeo {...cardProps} />
        </div>
      )}

      <div className="org-bridge" aria-hidden="true" />

      {/* Team grid */}
      <div className="org-team-grid">
        {members.map((p) => (
          <MemberCard key={p.name} profile={p} {...cardProps} />
        ))}
      </div>
    </section>
  );
}
