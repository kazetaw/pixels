import { contributorLabel, CONTRIBUTOR_PROFILES, type ContributorProfile } from '../shared/contributors';

function PersonNode({ profile, ceo = false }: { profile: ContributorProfile; ceo?: boolean }) {
  return <article className={`organization-person${ceo ? ' organization-person-ceo' : ''}`}>
    <div className="organization-member-avatar">
      {profile.avatar
        ? <img className={ceo || profile.flipAvatar ? 'is-flipped' : undefined} src={profile.avatar} alt={`รูป ${profile.name}`} />
        : <span>{profile.name.slice(0, 1)}</span>}
    </div>
    <strong>{contributorLabel(profile.name)}</strong>
  </article>;
}

export function OrganizationChart() {
  const ceo = CONTRIBUTOR_PROFILES.find((profile) => profile.name === 'เอี๊ยม');
  const members = CONTRIBUTOR_PROFILES.filter((profile) => profile.name !== 'เอี๊ยม');

  return <section className="organization-chart" aria-label="ผังสมาชิกทีม Pixel Factory">
    <div className="organization-board">
      {ceo && <div className="organization-ceo-stage"><PersonNode profile={ceo} ceo /></div>}

      <div className="organization-team-bridge" aria-hidden="true" />

      <div className="organization-members">
        {members.map((profile) => <PersonNode key={profile.name} profile={profile} />)}
      </div>
    </div>
  </section>;
}
