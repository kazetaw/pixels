import { ApartmentOutlined } from '@ant-design/icons';
import type { CSSProperties } from 'react';
import { CONTRIBUTOR_PROFILES } from '../shared/contributors';

const MEMBER_COLORS = [
  ['#fee2e2', '#be123c'], ['#e0e7ff', '#4338ca'], ['#cffafe', '#0e7490'], ['#fef3c7', '#b45309'],
  ['#dcfce7', '#15803d'], ['#f3e8ff', '#7e22ce'], ['#fce7f3', '#be185d'], ['#e2e8f0', '#334155'],
];

export function OrganizationChart() {
  return <section className="organization-chart" aria-label="ผังสมาชิกทีม Pixel Factory">
    <div className="organization-hub">
      <span><ApartmentOutlined /></span>
      <div><small>Pixel Factory</small><strong>ทีมของเรา</strong><p>ช่วยกันวางแผน ผลิต และดูแลสต็อก</p></div>
      <b>{CONTRIBUTOR_PROFILES.length} คน</b>
    </div>
    <div className="organization-connector" aria-hidden="true"><i /></div>
    <div className="organization-members">
      {CONTRIBUTOR_PROFILES.map((profile, index) => {
        const [background, color] = MEMBER_COLORS[index % MEMBER_COLORS.length];
        return <article className="organization-member" key={profile.name} style={{ '--member-accent': color } as CSSProperties}>
          <div className="organization-member-avatar" style={{ background }}>
            {profile.avatar
              ? <img src={profile.avatar} alt={`รูป ${profile.name}`} />
              : <span style={{ color }}>{profile.name.slice(0, 1)}</span>}
          </div>
          <div><strong>{profile.name}</strong><span>สมาชิกทีม</span></div>
        </article>;
      })}
    </div>
  </section>;
}
