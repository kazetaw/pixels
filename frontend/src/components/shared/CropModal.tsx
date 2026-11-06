/**
 * CropModal.tsx
 *
 * Canvas-based image cropper. No external crop library — pure HTML5 Canvas.
 *
 * Usage:
 *   <CropModal
 *     src={blobUrl}           // URL.createObjectURL(file) or data URL
 *     aspect={1}              // 1=square, 4/3, 16/9, undefined=free
 *     onConfirm={(blob) => upload(blob)}
 *     onCancel={() => setSrc(undefined)}
 *   />
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, Button, Slider, Tooltip } from 'antd';
import { RotateRightOutlined, SwapOutlined } from '@ant-design/icons';

/* ── types ─────────────────────────────────────────────────────────────── */
export type AspectOption = { label: string; value: number | undefined };

interface Props {
  open: boolean;
  src: string | undefined;          // image URL to crop
  title?: string;
  aspect?: number;                   // default 1 (square)
  outputSize?: number;               // output canvas size px (default 400)
  onConfirm: (blob: Blob) => void;
  onCancel: () => void;
}

const ASPECTS: AspectOption[] = [
  { label: '1:1', value: 1 },
  { label: '4:3', value: 4 / 3 },
  { label: '16:9', value: 16 / 9 },
  { label: 'ต้นฉบับ', value: undefined },
];

/* ── helpers ──────────────────────────────────────────────────────────── */
function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = src;
  });
}

/* ── component ────────────────────────────────────────────────────────── */
export function CropModal({ open, src, title = 'ครอปรูปภาพ', aspect: defaultAspect = 1, outputSize = 400, onConfirm, onCancel }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  // view state
  const [aspect, setAspect] = useState<number | undefined>(defaultAspect);
  const [zoom, setZoom] = useState(1);          // 1–3
  const [rotate, setRotate] = useState(0);      // degrees
  const [flipX, setFlipX] = useState(false);
  // pan offset in image-space pixels (centre of crop box)
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  const [canvasSize, setCanvasSize] = useState({ w: 320, h: 320 });
  const [ready, setReady] = useState(false);
  const [confirming, setConfirming] = useState(false);

  // drag state (refs to avoid stale closures)
  const dragging = useRef(false);
  const dragStart = useRef({ mx: 0, my: 0, ox: 0, oy: 0 });

  /* Reset when src changes */
  useEffect(() => {
    if (!src || !open) return;
    setZoom(1); setRotate(0); setFlipX(false); setOffset({ x: 0, y: 0 });
    setAspect(defaultAspect); setReady(false);
    loadImage(src).then(img => { imgRef.current = img; setReady(true); }).catch(() => {});
  }, [src, open, defaultAspect]);

  /* Measure container to set canvas size */
  useEffect(() => {
    if (!open || !containerRef.current) return;
    const ro = new ResizeObserver(entries => {
      const { width } = entries[0].contentRect;
      const w = Math.floor(width);
      const h = aspect ? Math.round(w / aspect) : w;
      setCanvasSize({ w, h });
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [open, aspect]);

  /* Redraw main canvas */
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img) return;
    const ctx = canvas.getContext('2d')!;
    const { w, h } = canvasSize;
    canvas.width = w; canvas.height = h;

    ctx.clearRect(0, 0, w, h);

    // Dark background
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    ctx.translate(w / 2 + offset.x, h / 2 + offset.y);
    ctx.rotate((rotate * Math.PI) / 180);
    if (flipX) ctx.scale(-1, 1);

    // Fit image into canvas then apply zoom
    const baseScale = Math.min((w * 0.9) / img.width, (h * 0.9) / img.height);
    const scale = baseScale * zoom;
    ctx.drawImage(img, -img.width / 2 * scale, -img.height / 2 * scale, img.width * scale, img.height * scale);
    ctx.restore();

    // Crop overlay: darken outside the crop rect
    const cropW = w;
    ctx.fillStyle = 'rgba(0,0,0,0.48)';
    // top
    ctx.fillRect(0, 0, cropW, 0);
    // We show the full canvas as the crop area — the output is always the full visible area
    // Draw grid lines (rule-of-thirds)
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 1;
    for (let i = 1; i < 3; i++) {
      ctx.beginPath(); ctx.moveTo(w * i / 3, 0); ctx.lineTo(w * i / 3, h); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, h * i / 3); ctx.lineTo(w, h * i / 3); ctx.stroke();
    }
    // Border
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, w - 2, h - 2);

    // Update preview
    const prev = previewRef.current;
    if (prev) {
      const ps = 56;
      prev.width = ps; prev.height = ps;
      const pc = prev.getContext('2d')!;
      pc.drawImage(canvas, 0, 0, w, h, 0, 0, ps, ps);
    }
  }, [canvasSize, zoom, rotate, flipX, offset]);

  useEffect(() => { if (ready) draw(); }, [ready, draw]);

  /* Pointer events for panning */
  const onPointerDown = (e: React.PointerEvent) => {
    dragging.current = true;
    dragStart.current = { mx: e.clientX, my: e.clientY, ox: offset.x, oy: offset.y };
    (e.target as Element).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    const dx = e.clientX - dragStart.current.mx;
    const dy = e.clientY - dragStart.current.my;
    setOffset({ x: dragStart.current.ox + dx, y: dragStart.current.oy + dy });
  };
  const onPointerUp = () => { dragging.current = false; };

  /* Wheel zoom */
  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    setZoom(z => clamp(z - e.deltaY * 0.001, 1, 3));
  };

  /* Confirm: render at outputSize and return blob */
  const handleConfirm = async () => {
    const img = imgRef.current;
    if (!img) return;
    setConfirming(true);
    try {
      const out = document.createElement('canvas');
      const { w, h } = canvasSize;
      const scaleUp = outputSize / Math.min(w, h);
      out.width = outputSize;
      out.height = aspect ? Math.round(outputSize / aspect) : outputSize;

      const ctx = out.getContext('2d')!;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, out.width, out.height);
      ctx.save();
      ctx.translate(out.width / 2 + offset.x * scaleUp, out.height / 2 + offset.y * scaleUp);
      ctx.rotate((rotate * Math.PI) / 180);
      if (flipX) ctx.scale(-1, 1);
      const baseScale = Math.min((w * 0.9) / img.width, (h * 0.9) / img.height);
      const scale = baseScale * zoom * scaleUp;
      ctx.drawImage(img, -img.width / 2 * scale, -img.height / 2 * scale, img.width * scale, img.height * scale);
      ctx.restore();

      out.toBlob(blob => {
        setConfirming(false);
        if (blob) onConfirm(blob);
      }, 'image/png', 0.95);
    } catch {
      setConfirming(false);
    }
  };

  return (
    <Modal
      open={open}
      title={title}
      width={480}
      style={{ top: 24 }}
      onCancel={onCancel}
      closable={!confirming}
      maskClosable={!confirming}
      footer={null}
      styles={{ body: { padding: 0 } }}
    >
      {/* Canvas area */}
      <div
        ref={containerRef}
        style={{ padding: '12px 16px 0', lineHeight: 0 }}
        onWheel={onWheel}
      >
        <canvas
          ref={canvasRef}
          width={canvasSize.w}
          height={canvasSize.h}
          style={{
            width: '100%',
            height: 'auto',
            borderRadius: 8,
            cursor: 'move',
            display: 'block',
            touchAction: 'none',
          }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
        />
      </div>

      {/* Controls */}
      <div style={{ padding: '12px 16px 8px', display: 'flex', flexDirection: 'column', gap: 10 }}>

        {/* Aspect + Flip + Rotate */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: '#64748B', flexShrink: 0 }}>อัตราส่วน</span>
          <div style={{ display: 'flex', gap: 5 }}>
            {ASPECTS.map(a => (
              <button
                key={a.label}
                onClick={() => { setAspect(a.value); setOffset({ x: 0, y: 0 }); }}
                style={{
                  border: `1.5px solid ${aspect === a.value ? '#0284C7' : '#D1D5DB'}`,
                  background: aspect === a.value ? '#EFF6FF' : '#fff',
                  color: aspect === a.value ? '#0284C7' : '#374151',
                  borderRadius: 6, padding: '2px 10px', fontSize: 12, fontWeight: 600,
                  cursor: 'pointer', transition: 'all .12s',
                }}
              >
                {a.label}
              </button>
            ))}
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
            <Tooltip title="พลิกซ้าย-ขวา">
              <Button
                size="small" icon={<SwapOutlined />}
                style={{ background: flipX ? '#EFF6FF' : undefined, borderColor: flipX ? '#0284C7' : undefined }}
                onClick={() => setFlipX(f => !f)}
              />
            </Tooltip>
            <Tooltip title="หมุน 90°">
              <Button size="small" icon={<RotateRightOutlined />} onClick={() => setRotate(r => (r + 90) % 360)} />
            </Tooltip>
          </div>
        </div>

        {/* Zoom slider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 12, color: '#64748B', width: 32, flexShrink: 0 }}>ซูม</span>
          <Slider
            min={100} max={300} value={Math.round(zoom * 100)}
            onChange={v => setZoom(v / 100)}
            tooltip={{ formatter: v => `${v}%` }}
            style={{ flex: 1 }}
          />
          <span style={{ fontSize: 12, color: '#0284C7', fontWeight: 600, width: 38, textAlign: 'right' }}>
            {Math.round(zoom * 100)}%
          </span>
        </div>

        {/* Rotate slider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 12, color: '#64748B', width: 32, flexShrink: 0 }}>หมุน</span>
          <Slider
            min={-45} max={45} value={rotate % 360 > 180 ? (rotate % 360) - 360 : rotate % 360}
            onChange={v => setRotate(v)}
            tooltip={{ formatter: v => `${v}°` }}
            style={{ flex: 1 }}
          />
          <span style={{ fontSize: 12, color: '#0284C7', fontWeight: 600, width: 38, textAlign: 'right' }}>
            {Math.round(rotate % 360 > 180 ? (rotate % 360) - 360 : rotate % 360)}°
          </span>
        </div>
      </div>

      {/* Preview strip */}
      <div style={{ padding: '4px 16px 12px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 11, color: '#94A3B8' }}>ตัวอย่าง</span>
        <canvas
          ref={previewRef}
          width={56} height={56}
          style={{ width: 56, height: 56, borderRadius: 10, border: '1px solid #E5E7EB', flexShrink: 0 }}
        />
        <canvas
          width={28} height={28}
          ref={c => {
            if (!c || !canvasRef.current) return;
            const ctx = c.getContext('2d');
            if (ctx) ctx.drawImage(canvasRef.current, 0, 0, canvasSize.w, canvasSize.h, 0, 0, 28, 28);
          }}
          style={{ width: 28, height: 28, borderRadius: 6, border: '1px solid #E5E7EB', flexShrink: 0 }}
        />
        <span style={{ fontSize: 11, color: '#64748B' }}>📐 ผลลัพธ์ {outputSize} × {aspect ? Math.round(outputSize / aspect) : outputSize} px · PNG</span>
      </div>

      {/* Footer */}
      <div style={{
        padding: '10px 16px 14px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderTop: '1px solid #F1F5F9', gap: 8,
      }}>
        <button
          onClick={onCancel}
          style={{ background: 'none', border: 'none', color: '#DC2626', fontSize: 12, cursor: 'pointer', fontWeight: 500 }}
        >
          ↩ เลือกรูปใหม่
        </button>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button onClick={onCancel} disabled={confirming}>ยกเลิก</Button>
          <Button type="primary" loading={confirming} onClick={() => void handleConfirm()}>
            ใช้รูปนี้
          </Button>
        </div>
      </div>
    </Modal>
  );
}
