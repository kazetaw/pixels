import { CrownOutlined, HeartFilled } from '@ant-design/icons';
import type { CSSProperties } from 'react';
import { CONTRIBUTOR_PROFILES, type ContributorProfile } from '../shared/contributors';

const MEMBER_COLORS = [
  ['#fce7f3', '#be185d'], ['#e0f2fe', '#0369a1'], ['#fff1d6', '#b45309'], ['#dcfce7', '#15803d'],
  ['#f3e8ff', '#7e22ce'], ['#ffe4e6', '#be123c'], ['#e2e8f0', '#334155'],
];

function MemberCard({ profile, index }: { profile: ContributorProfile; index: number }) {
  const [softColor, accentColor] = MEMBER_COLORS[index % MEMBER_COLORS.length];

  return <article
    className="organization-member"
    style={{ '--member-soft': softColor, '--member-accent': accentColor } as CSSProperties}
  >
    <div className="organization-member-avatar">
      {profile.avatar
        ? <img src={profile.avatar} alt={`รูป ${profile.name}`} />
        : <span>{profile.name.slice(0, 1)}</span>}
    </div>
    <strong>{profile.name}</strong>
    <span>สมาชิกทีม</span>
  </article>;
}

export function OrganizationChart() {
  const ceo = CONTRIBUTOR_PROFILES.find((profile) => profile.name === 'เอี๊ยม');
  const members = CONTRIBUTOR_PROFILES.filter((profile) => profile.name !== 'เอี๊ยม');

  return <section className="organization-chart" aria-label="ผังสมาชิกทีม Pixel Factory">
    <div className="organization-board">
      <span className="organization-doodle organization-doodle-one" aria-hidden="true">✦</span>
      <span className="organization-doodle organization-doodle-two" aria-hidden="true">✿</span>

      <header className="organization-intro">
        <small><HeartFilled /> PIXEL PEOPLE</small>
        <h3>คนเก่งหลังโรงงานของเรา</h3>
        <p>ทีมเล็กๆ ที่ช่วยกันวางแผน ผลิต และดูแลทุกอย่างให้เดินต่อ</p>
      </header>

      {ceo && <div className="organization-ceo-stage">
        <span className="organization-ceo-kicker"><CrownOutlined /> CEO</span>
        <article className="organization-ceo-card">
          <div className="organization-ceo-avatar">
            <img className="is-flipped" src={ceo.avatar} alt={`รูป ${ceo.name}`} />
          </div>
          <div>
            <small>หัวหน้าทีม Pixel Factory</small>
            <strong>{ceo.name}</strong>
            <p>ดูแลภาพรวมและพาทีมไปด้วยกัน</p>
          </div>
        </article>
      </div>}

      <div className="organization-team-bridge" aria-hidden="true"><span>OUR CREW · {members.length} คน</span></div>

      <div className="organization-members">
        {members.map((profile, index) => <MemberCard key={profile.name} profile={profile} index={index} />)}
      </div>

      <footer className="organization-footer"><HeartFilled /> 8 คน 1 ทีม</footer>
    </div>
  </section>;
}
