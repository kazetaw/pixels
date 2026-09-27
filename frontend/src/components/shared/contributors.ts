export interface ContributorProfile {
  name: string;
  memberId?: string;
  avatar?: string;
  flipAvatar?: boolean;
}

export const CONTRIBUTOR_PROFILES: ContributorProfile[] = [
  { name: 'ตะเอ๊ย', memberId: '11612', avatar: '/avatars/contributors/taoei.png' },
  { name: 'เอี๊ยม', memberId: '11369', avatar: '/avatars/contributors/iam.png' },
  { name: 'ป้วย', memberId: '100162', avatar: '/avatars/contributors/puay.png' },
  { name: 'ตวัน', memberId: '3236', avatar: '/avatars/contributors/tawan.png' },
  { name: 'พี่ปาม', memberId: '85865', avatar: '/avatars/contributors/pam.png', flipAvatar: true },
  { name: 'เนย', memberId: '223391' },
  { name: 'เมย์', memberId: '223398' },
  { name: 'ต้วมเตี้ยม', memberId: '19928' },
];

export const CONTRIBUTOR_NAMES = CONTRIBUTOR_PROFILES.map((profile) => profile.name);
export const CONTRIBUTOR_AVATARS = Object.fromEntries(
  CONTRIBUTOR_PROFILES.filter((profile) => profile.avatar).map((profile) => [profile.name, profile.avatar as string]),
);

/** Keep the stored contributor name stable while showing the team's in-game ID in the UI. */
export function contributorLabel(name: string) {
  const profile = CONTRIBUTOR_PROFILES.find((candidate) => candidate.name === name.trim());
  return profile?.memberId ? `${profile.name} (${profile.memberId})` : name;
}
