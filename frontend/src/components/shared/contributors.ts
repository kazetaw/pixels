import type { Occupation } from './OccupationSelect';

export interface AssignedItem {
  /** item_id (UUID) or display name — used to look up in itemNames / stocks */
  item_id: string;
  /** human-readable fallback shown if itemNames lookup fails */
  label: string;
  target: number;
}

export interface ContributorProfile {
  name: string;
  memberId?: string;
  avatar?: string;
  flipAvatar?: boolean;
  /** อาชีพที่รับผิดชอบ (อาจมีหลายอาชีพ) */
  occupations?: Occupation[];
  /** รายการของที่ต้องหา */
  assignments?: AssignedItem[];
  /** หน้าที่ / บทบาท อธิบายสั้นๆ */
  role?: string;
}

export const CONTRIBUTOR_PROFILES: ContributorProfile[] = [
  {
    name: 'เอี๊ยม',
    memberId: '11369',
    avatar: '/avatars/contributors/iam.png',
    occupations: ['หมอ'],
    role: 'หัวหน้าทีม',
  },
  {
    name: 'พี่ปาม',
    memberId: '85865',
    avatar: '/avatars/contributors/pam.png',
    flipAvatar: true,
    occupations: ['เชฟ','ทุกอาชีพ'],
    role: 'ตำราเครื่องดื่มและขนม',
assignments: [
      { item_id: 'ขนมโมจิ', label: 'ขนมโมจิ', target: 693 },
    ],  },
  {
    name: 'ป้วย',
    memberId: '100162',
    avatar: '/avatars/contributors/puay.png',
    occupations: ['เกษตร'],
  },
  {
    name: 'เนย',
    memberId: '223391',
    avatar: '/avatars/contributors/noey.png',
    occupations: ['ไอดอล', 'เกษตร'],
  },
  {
    name: 'เมย์',
    memberId: '223398',
    occupations: ['วิศวะกร'],
  },
  {
    name: 'ตวัน',
    memberId: '3236',
    avatar: '/avatars/contributors/tawan.png',
    occupations: ['เชฟ'],
    role: 'ฟามของมอน และ ทำช็อค และซัพพอร์ต',
       
  },
  {
    name: 'ตะเอ๊ย',
    memberId: '11612',
    avatar: '/avatars/contributors/taoei.png',
    occupations: ['ไอดอล','ทุกอาชีพ','วิศวะกร','หมอ'],
    role: '',
    assignments: [
      { item_id: 'คลิปท่าเต้นสไตล์ใหม่', label: 'คลิปท่าเต้นสไตล์ใหม่', target: 693 },
    ],
  },
  // {
  //   name: 'ต้วมเตี้ยม',
  //   memberId: '19928',
  // },
];

export const CONTRIBUTOR_NAMES = CONTRIBUTOR_PROFILES.map((p) => p.name);
export const CONTRIBUTOR_AVATARS = Object.fromEntries(
  CONTRIBUTOR_PROFILES.filter((p) => p.avatar).map((p) => [p.name, p.avatar as string]),
);

/** Keep the stored contributor name stable while showing the team's in-game ID in the UI. */
export function contributorLabel(name: string) {
  const profile = CONTRIBUTOR_PROFILES.find((c) => c.name === name.trim());
  return profile?.memberId ? `${profile.name} (${profile.memberId})` : name;
}
