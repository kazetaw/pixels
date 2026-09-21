/**
 * shared/ImagePicker.tsx
 *
 * Reusable image picker that uploads to Supabase Storage via /api/upload-image.
 * Replaces the old FileReader → base64 pattern in RecipeEditor, MachineEditor,
 * and StockEditorFull.
 *
 * Props:
 *   value    — current image URL (or undefined)
 *   onChange — called with the new public URL after upload, or undefined on remove
 *   folder   — storage sub-folder: "machines" | "recipes" | "stocks"
 *   itemId   — optional entity id used as the storage filename
 *   size     — thumbnail size in px (default 64)
 *   variant  — "button", "box", "recipe", or "table" (compact drag/drop + preview)
 */
import { useRef, useState } from 'react';
import type { ChangeEvent, DragEvent } from 'react';
import { DeleteOutlined, EyeOutlined, UploadOutlined } from '@ant-design/icons';
import { Modal } from 'antd';
import { uploadImage } from '../../api/client';

export interface ImagePickerProps {
  value: string | undefined;
  onChange: (url: string | undefined) => void;
  folder: 'machines' | 'recipes' | 'stocks';
  itemId?: string;
  size?: number;
  variant?: 'box' | 'button' | 'recipe' | 'table';
  /** Extra class applied to the root wrapper */
  className?: string;
}

export function ImagePicker({
  value,
  onChange,
  folder,
  itemId,
  size = 64,
  variant = 'box',
  className = '',
}: ImagePickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  const uploadFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('กรุณาเลือกไฟล์รูปภาพ');
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const result = await uploadImage(file, folder, itemId);
      onChange(result.url);
    } catch (err) {
      setError((err as Error).message ?? 'อัปโหลดไม่สำเร็จ');
    } finally {
      setUploading(false);
    }
  };

  const handleFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Reset so the same file can be selected again.
    e.target.value = '';
    if (file) void uploadFile(file);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!uploading) setIsDragging(true);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && !uploading) void uploadFile(file);
  };

  const triggerPick = () => inputRef.current?.click();

  const fileInput = (
    <input
      ref={inputRef}
      type="file"
      accept="image/*"
      // Inline display avoids an unstyled browser "Choose File" control if a
      // utility stylesheet is unavailable while the modal is mounting.
      style={{ display: 'none' }}
      onChange={handleFile}
    />
  );

  // ── Recipe variant ───────────────────────────────────────────────────────
  // The whole empty state is a drop target. Once a picture exists, clicking
  // the picture only previews it; replacement remains an explicit action.
  if (variant === 'recipe') {
    return (
      <>
        <div
          className={`flex items-center gap-3 ${className}`}
          onDragOver={handleDragOver}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
        >
          {value ? (
            <button
              type="button"
              onClick={() => setPreviewOpen(true)}
              className="group relative shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              style={{ width: size, height: size }}
              title="ดูรูปขนาดใหญ่"
              aria-label="ดูรูปขนาดใหญ่"
            >
              <img src={value} alt="รูปสินค้า" className="h-full w-full object-contain" />
              <span className="absolute inset-0 flex items-center justify-center bg-slate-950/0 text-white opacity-0 transition group-hover:bg-slate-950/45 group-hover:opacity-100 group-focus:bg-slate-950/45 group-focus:opacity-100">
                <EyeOutlined className="text-base" />
              </span>
            </button>
          ) : (
            <button
              type="button"
              onClick={triggerPick}
              disabled={uploading}
              className={`flex shrink-0 flex-col items-center justify-center rounded-lg border-2 border-dashed transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-wait ${
                isDragging ? 'border-blue-500 bg-blue-50 text-blue-600' : 'border-slate-300 bg-slate-50 text-slate-400 hover:border-blue-400 hover:bg-blue-50 hover:text-blue-600'
              }`}
              style={{ width: size + 18, height: size + 18 }}
              aria-label="อัปโหลดรูปสินค้า"
            >
              <UploadOutlined className="text-xl" />
              <span className="mt-0.5 text-[10px] font-medium">{uploading ? 'กำลังอัปโหลด' : 'อัปโหลด'}</span>
            </button>
          )}

          <div className="min-w-0 space-y-1">
            {value ? (
              <>
                <p className="text-xs text-slate-500">คลิกรูปเพื่อดูขนาดใหญ่</p>
                <div className="flex items-center gap-3">
                  <button type="button" onClick={triggerPick} disabled={uploading} className="text-xs font-medium text-blue-600 hover:text-blue-800 disabled:opacity-50">
                    <UploadOutlined className="mr-1" />{uploading ? 'กำลังอัปโหลด…' : 'เปลี่ยนรูป'}
                  </button>
                  <button type="button" onClick={() => onChange(undefined)} disabled={uploading} className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50">
                    <DeleteOutlined className="mr-1" />ลบรูป
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="text-xs font-medium text-slate-700">อัปโหลดรูปสินค้า</p>
                <p className="text-xs text-slate-400">คลิกไอคอน หรือลากไฟล์รูปจากเครื่องมาวาง</p>
              </>
            )}
            {error && <p className="text-xs text-red-500">{error}</p>}
          </div>
          {fileInput}
        </div>

        <Modal open={previewOpen} footer={null} onCancel={() => setPreviewOpen(false)} centered width={720} title="รูปสินค้า">
          {value && <img src={value} alt="รูปสินค้าขนาดใหญ่" className="max-h-[70vh] w-full object-contain" />}
        </Modal>
      </>
    );
  }

  // ── Table variant ────────────────────────────────────────────────────────
  // Keeps the image column actionable without adding controls that widen a row.
  if (variant === 'table') {
    return (
      <>
        <div
          className={`inline-flex ${className}`}
          onDragOver={handleDragOver}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
        >
          {value ? (
            <button
              type="button"
              onClick={() => setPreviewOpen(true)}
              className="group relative h-10 w-10 overflow-hidden rounded border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
              title="ดูรูปขนาดใหญ่"
              aria-label="ดูรูปขนาดใหญ่"
            >
              <img src={value} alt="รูปสินค้า" className="h-full w-full object-contain" />
              <span className="absolute inset-0 flex items-center justify-center bg-slate-950/0 text-white opacity-0 transition group-hover:bg-slate-950/45 group-hover:opacity-100 group-focus:bg-slate-950/45 group-focus:opacity-100">
                <EyeOutlined className="text-sm" />
              </span>
            </button>
          ) : (
            <button
              type="button"
              onClick={triggerPick}
              disabled={uploading}
              className={`flex h-10 w-10 items-center justify-center rounded border border-dashed transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 disabled:cursor-wait ${
                isDragging ? 'border-blue-500 bg-blue-50 text-blue-600' : 'border-slate-300 bg-slate-50 text-slate-400 hover:border-blue-400 hover:bg-blue-50 hover:text-blue-600'
              }`}
              title="อัปโหลดรูปสินค้า"
              aria-label="อัปโหลดรูปสินค้า"
            >
              <UploadOutlined className={uploading ? 'animate-pulse text-base' : 'text-base'} />
            </button>
          )}
          {fileInput}
        </div>

        {error && <p className="mt-1 max-w-24 text-xs text-red-500">{error}</p>}
        <Modal open={previewOpen} footer={null} onCancel={() => setPreviewOpen(false)} centered width={720} title="รูปสินค้า">
          {value && <img src={value} alt="รูปสินค้าขนาดใหญ่" className="max-h-[70vh] w-full object-contain" />}
        </Modal>
      </>
    );
  }

  // ── Box variant ──────────────────────────────────────────────────────────
  if (variant === 'box') {
    return (
      <div className={`flex items-center gap-3 ${className}`}>
        {value ? (
          <div className="relative flex-shrink-0">
            <img
              src={value}
              alt="preview"
              className="rounded-lg object-contain bg-gray-50 border border-gray-200"
              style={{ width: size, height: size }}
            />
            {!uploading && (
              <button
                type="button"
                onClick={() => onChange(undefined)}
                className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-xs leading-none hover:bg-red-600"
                title="ลบรูป"
              >
                ✕
              </button>
            )}
            {uploading && (
              <div
                className="absolute inset-0 rounded-lg bg-black/40 flex items-center justify-center"
              >
                <span className="text-white text-xs">อัปโหลด…</span>
              </div>
            )}
          </div>
        ) : (
          <div
            onClick={triggerPick}
            className="rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors flex-shrink-0"
            style={{ width: size, height: size }}
          >
            {uploading ? (
              <span className="text-xs text-gray-400">…</span>
            ) : (
              <span className="text-2xl text-gray-300">+</span>
            )}
          </div>
        )}

        <div className="space-y-1">
          <button
            type="button"
            onClick={triggerPick}
            disabled={uploading}
            className="text-xs text-blue-600 hover:text-blue-800 font-medium disabled:opacity-50"
          >
            {uploading ? 'กำลังอัปโหลด…' : value ? 'เปลี่ยนรูป' : 'อัปโหลดรูป'}
          </button>
          <p className="text-xs text-gray-400">PNG, JPG — อัปโหลดสู่ Supabase Storage</p>
          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>

        {fileInput}
      </div>
    );
  }

  // ── Button variant (used in MachineEditor / StockEditorFull) ─────────────
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {value && (
        <img
          src={value}
          alt="preview"
          className="rounded object-contain bg-gray-50 border border-gray-200 flex-shrink-0"
          style={{ width: size, height: size }}
        />
      )}
      <div className="flex flex-col gap-1">
        <button
          type="button"
          onClick={triggerPick}
          disabled={uploading}
          className="inline-flex items-center gap-1 rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          <span>↑</span>
          {uploading ? 'กำลังอัปโหลด…' : value ? 'เปลี่ยน' : 'อัปโหลด'}
        </button>
        {value && (
          <button
            type="button"
            onClick={() => onChange(undefined)}
            disabled={uploading}
            className="text-xs text-red-500 hover:text-red-700 text-left disabled:opacity-50"
          >
            ลบรูป
          </button>
        )}
        {error && <p className="text-xs text-red-500">{error}</p>}
      </div>
      {fileInput}
    </div>
  );
}
