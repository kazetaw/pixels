export interface ContributorProfile {
  name: string;
  avatar?: string;
}

export const CONTRIBUTOR_PROFILES: ContributorProfile[] = [
  { name: 'ตะเอ๊ย', avatar: '/avatars/contributors/taoei.png' },
  { name: 'เอี๊ยม', avatar: '/avatars/contributors/iam.png' },
  { name: 'ป้วย', avatar: '/avatars/contributors/puay.png' },
  { name: 'ตวัน', avatar: '/avatars/contributors/tawan.png' },
  { name: 'พี่ปาม' },
  { name: 'เนย' },
  { name: 'เมย์' },
  { name: 'ต้วมเตี้ยม' },
];

export const CONTRIBUTOR_NAMES = CONTRIBUTOR_PROFILES.map((profile) => profile.name);
export const CONTRIBUTOR_AVATARS = Object.fromEntries(
  CONTRIBUTOR_PROFILES.filter((profile) => profile.avatar).map((profile) => [profile.name, profile.avatar as string]),
);
