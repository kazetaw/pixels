import { ApartmentOutlined } from '@ant-design/icons';
import type { CSSProperties } from 'react';
import { CONTRIBUTOR_PROFILES, type ContributorProfile } from '../shared/contributors';

const MEMBER_COLORS = [
  ['#fee2e2', '#be123c'], ['#e0e7ff', '#4338ca'], ['#cffafe', '#0e7490'], ['#fef3c7', '#b45309'],
  ['#dcfce7', '#15803d'], ['#f3e8ff', '#7e22ce'], ['#fce7f3', '#be185d'], ['#e2e8f0', '#334155'],
];

function MemberCard({ profile, index, isCeo = false }: { profile: ContributorProfile; index: number; isCeo?: boolean }) {
  const [background, color] = MEMBER_COLORS[index % MEMBER_COLORS.length];

  return <article
    className={`organization-member${isCeo ? ' organization-ceo' : ''}`}
    style={{ '--member-accent': color } as CSSProperties}
  >
    <div className="organization-member-avatar" style={{ background }}>
      {profile.avatar
        ? <img className={profile.name === 'เอี๊ยม' ? 'is-flipped' : undefined} src={profile.avatar} alt={`รูป ${profile.name}`} />
        : <span style={{ color }}>{profile.name.slice(0, 1)}</span>}
    </div>
    <div>
      <strong>{profile.name}</strong>
      <span>{isCeo ? 'CEO · ผู้บริหาร' : 'สมาชิกทีม'}</span>
    </div>
  </article>;
}

export function OrganizationChart() {
  const ceo = CONTRIBUTOR_PROFILES.find((profile) => profile.name === 'เอี๊ยม');
  const members = CONTRIBUTOR_PROFILES.filter((profile) => profile.name !== 'เอี๊ยม');

  return <section className="organization-chart" aria-label="ผังสมาชิกทีม Pixel Factory">
    <div className="organization-hub">
      <span><ApartmentOutlined /></span>
      <div><small>Pixel Factory</small><strong>ทีมของเรา</strong><p>ช่วยกันวางแผน ผลิต และดูแลสต็อก</p></div>
      <b>{CONTRIBUTOR_PROFILES.length} คน</b>
    </div>
    {ceo && <>
      <div className="organization-ceo-connector" aria-hidden="true" />
      <MemberCard profile={ceo} index={1} isCeo />
    </>}
    <div className="organization-connector" aria-hidden="true"><i /></div>
    <div className="organization-members">
      {members.map((profile, index) => <MemberCard key={profile.name} profile={profile} index={index} />)}
    </div>
  </section>;
}
