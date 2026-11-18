/**
 * WelcomeBanner.tsx
 * แสดงครั้งแรก ปิดได้ เก็บสถานะใน localStorage
 */
import { useState } from 'react';
import { CloseOutlined, BellOutlined, MobileOutlined, DesktopOutlined, InfoCircleOutlined } from '@ant-design/icons';

interface Section {
  icon: React.ReactNode;
  title: string;
  items: string[];
}

const SECTIONS: Section[] = [
  {
    icon: <InfoCircleOutlined style={{ color: '#2563eb' }} />,
    title: 'ระบบนี้มีอะไรบ้าง',
    items: [
      '🏭 สถานะชั้น — ดูเวลานับถอยหลังของแต่ละชั้นในโรงงาน',
      '🔧 เครื่องนอก — บันทึกและจับเวลาเครื่องของสมาชิกคนอื่น',
      '🧮 คำนวณ BOM — คำนวณวัตถุดิบที่ต้องใช้',
    ],
  },
  {
    icon: <MobileOutlined style={{ color: '#7c3aed' }} />,
    title: 'เครื่องนอก — วิธีใช้',
    items: [
      '1. กด "เครื่องนอก" ในเมนู',
      '2. สมัคร/เข้าสู่ระบบ แล้วเพิ่มเครื่องของสมาชิก',
      '3. กดเริ่มเวลา — ระบบนับถอยหลังให้อัตโนมัติ',
      '4. แจ้งเตือนเมื่อเครื่องเสร็จ แม้ปิดหน้าเว็บไว้',
    ],
  },
  {
    icon: <BellOutlined style={{ color: '#d97706' }} />,
    title: 'เปิดรับแจ้งเตือน',
    items: [
      '🍎 iOS — Safari → Share → เพิ่มหน้าจอโฮม → เปิดจากไอคอน → เปิดแจ้งเตือน',
      '🤖 Android — Chrome → กดเปิดแจ้งเตือนในหน้าเครื่องนอก',
      '🖥️ Windows/Mac — Chrome หรือ Edge → กดอนุญาตแจ้งเตือน',
    ],
  },
  {
    icon: <DesktopOutlined style={{ color: '#059669' }} />,
    title: 'เคล็ดลับ',
    items: [
      'บัญชีเครื่องนอกใช้ร่วมกันได้หลายอุปกรณ์',
      'เปิดแจ้งเตือนบน iPhone ต้องเพิ่มหน้าจอโฮมก่อนเสมอ',
      'กดปุ่มนาฬิกา ⏱ เพื่อกำหนดเวลาเองถ้าลืมกดเริ่ม',
    ],
  },
];

const STORAGE_KEY = 'welcome-banner-dismissed-v1';

export function WelcomeBanner() {
  const [visible, setVisible] = useState(() => {
    try { return !localStorage.getItem(STORAGE_KEY); } catch { return true; }
  });

  if (!visible) return null;

  const dismiss = () => {
    try { localStorage.setItem(STORAGE_KEY, '1'); } catch { /* ignore */ }
    setVisible(false);
  };

  return (
    <div style={{
      background: '#fff',
      border: '1px solid #e2e8f0',
      borderRadius: 12,
      marginBottom: 20,
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
        padding: '16px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div>
          <div style={{ color: '#fff', fontWeight: 700, fontSize: 16 }}>
            👋 ยินดีต้อนรับ
          </div>
          <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: 13, marginTop: 2 }}>
            คู่มือเริ่มต้นใช้งาน — อ่านแล้วปิดได้เลย
          </div>
        </div>
        <button
          onClick={dismiss}
          style={{
            background: 'rgba(255,255,255,0.15)',
            border: 'none',
            borderRadius: 8,
            color: '#fff',
            cursor: 'pointer',
            padding: '6px 10px',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 13,
          }}
        >
          <CloseOutlined /> ปิด
        </button>
      </div>

      {/* Sections */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
        gap: 1,
        background: '#f1f5f9',
      }}>
        {SECTIONS.map((s) => (
          <div key={s.title} style={{ background: '#fff', padding: '14px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              {s.icon}
              <span style={{ fontWeight: 600, fontSize: 13, color: '#0f172a' }}>{s.title}</span>
            </div>
            <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 5 }}>
              {s.items.map((item) => (
                <li key={item} style={{ fontSize: 12, color: '#475569', lineHeight: 1.5 }}>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div style={{
        padding: '10px 20px',
        background: '#f8fafc',
        borderTop: '1px solid #e2e8f0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 8,
      }}>
        <span style={{ fontSize: 12, color: '#94a3b8' }}>
          แบนเนอร์นี้จะไม่แสดงอีก หลังจากกดปิด
        </span>
        <button
          onClick={dismiss}
          style={{
            background: '#2563eb',
            border: 'none',
            borderRadius: 6,
            color: '#fff',
            cursor: 'pointer',
            padding: '6px 16px',
            fontSize: 13,
            fontWeight: 500,
          }}
        >
          เข้าใจแล้ว ปิดได้เลย
        </button>
      </div>
    </div>
  );
}
