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
 *   variant  — "button" (Ant Design Upload) or "box" (custom dashed box, default)
 */
import { useRef, useState } from 'react';
import { uploadImage } from '../../api/client';

export interface ImagePickerProps {
  value: string | undefined;
  onChange: (url: string | undefined) => void;
  folder: 'machines' | 'recipes' | 'stocks';
  itemId?: string;
  size?: number;
  variant?: 'box' | 'button';
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

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Reset so same file can be re-selected
    e.target.value = '';
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

  const triggerPick = () => inputRef.current?.click();

  // ── Box variant (used in RecipeEditor) ────────────────────────────────────
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

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFile}
        />
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
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFile}
      />
    </div>
  );
}
