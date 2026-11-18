import { useState } from 'react';
import { Modal } from 'antd';
import { BellFilled, CloseOutlined, QuestionCircleOutlined } from '@ant-design/icons';
import './WelcomeBanner.css';

const STORAGE_KEY = 'welcome-modal-hidden-v2';

export function WelcomeBanner() {
  const [open, setOpen] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY) !== '1'; } catch { return true; }
  });
  const [hideNextTime, setHideNextTime] = useState(false);
  const close = () => {
    try { if (hideNextTime) localStorage.setItem(STORAGE_KEY, '1'); } catch { /* Storage may be unavailable. */ }
    setOpen(false);
  };
  return <>
    <button className="welcome-help" onClick={() => { setHideNextTime(false); setOpen(true); }}><QuestionCircleOutlined /> วิธีใช้เครื่องนอก</button>
    <Modal open={open} onCancel={close} footer={null} closable={false} centered width={540} className="pocket-welcome" title={<span className="welcome-accessible-title">ยินดีต้อนรับสู่ Pixel Company</span>}>
      <div className="pocket-scene">
        <img className="pocket-art" src="/images/welcome/pocket-factory.png" alt="โรงงานจิ๋วลอยฟ้า พร้อมช่างสองคนและหุ่นยนต์ขนส่ง" width={1536} height={1024} fetchPriority="high" />
        <section className="pocket-card">
          <button className="pocket-close" onClick={close} aria-label="ปิดหน้าต้อนรับ"><CloseOutlined /></button>
          <div className="pocket-brand">Pixel Company</div>
          <h2 className="pocket-title"><span>จับเวลาไว้</span> <span>เดี๋ยวเตือนให้!</span></h2>
          <p className="pocket-subtitle">เลือกสูตร กดเริ่ม แล้วกลับมาเก็บตอนเสร็จ</p>
          <div className="pocket-notification" aria-label="ตัวอย่างแจ้งเตือนเมื่อผลิตเสร็จ">
            <span className="pocket-bell"><BellFilled /></span>
            <div><strong>หน่วยความจำ ผลิตเสร็จแล้ว</strong><p>แลปนอก ชั้น 1–3 · ซันลี่</p></div>
            <span className="pocket-rays" aria-hidden="true" />
          </div>
          <label className="pocket-preference"><input type="checkbox" checked={hideNextTime} onChange={event => setHideNextTime(event.target.checked)} /><span>ไม่แสดงอีก</span></label>
          <button className="pocket-start" onClick={close}>เริ่มใช้งาน</button>
        </section>
      </div>
    </Modal>
  </>;
}
