import type { AssignmentSummaryItem } from '../../api/client';
import { contributorLabel, CONTRIBUTOR_PROFILES } from '../shared/contributors';

function fmt(n: number) { return n.toLocaleString('th-TH'); }

export function ContributorProgress({ contributors }: { contributors: AssignmentSummaryItem['contributors'] }) {
  return <div className="asmt-contributors">
          {contributors.map(c => {
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
  </div>;
}
