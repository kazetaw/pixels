/**
 * api/upload-image.ts  →  POST /api/upload-image
 *
 * Accepts a multipart/form-data upload with:
 *   - file   : the image file (required)
 *   - bucket : storage bucket name (default: "images")
 *   - folder : sub-folder inside bucket, e.g. "machines" | "recipes" | "stocks" (optional)
 *   - itemId : the entity id used as the filename (optional — uses random uuid if omitted)
 *
 * Returns: { url: string }  — the public URL of the uploaded image.
 *
 * Vercel Functions don't support multipart natively, so we parse the raw body
 * manually using the `busboy` streaming parser (ships with Node, no extra dep).
 *
 * NOTE: Vercel has a 4.5 MB body limit on Hobby plans.
 * Set VERCEL_MAX_PAYLOAD_SIZE=4.5mb in project settings if needed.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Readable } from 'stream';
import { getSupabase } from './lib/db.js';
import { applyCors } from './lib/cors.js';
import { randomUUID } from 'crypto';

// ── Minimal multipart parser using busboy ──────────────────────────────────────
async function parseMultipart(req: VercelRequest): Promise<{
  file: Buffer;
  mimetype: string;
  filename: string;
  fields: Record<string, string>;
}> {
  const Busboy = (await import('busboy')).default;

  return new Promise((resolve, reject) => {
    const bb = Busboy({ headers: req.headers as Record<string, string> });

    let fileBuffer: Buffer | null = null;
    let fileMimetype = 'application/octet-stream';
    let fileFilename = 'upload';
    const fields: Record<string, string> = {};

    bb.on('file', (_fieldname, stream, info) => {
      fileMimetype = info.mimeType;
      fileFilename = info.filename;
      const chunks: Buffer[] = [];
      stream.on('data', (chunk: Buffer) => chunks.push(chunk));
      stream.on('end', () => { fileBuffer = Buffer.concat(chunks); });
    });

    bb.on('field', (name, value) => { fields[name] = value; });

    bb.on('finish', () => {
      if (!fileBuffer) return reject(new Error('No file received'));
      resolve({ file: fileBuffer, mimetype: fileMimetype, filename: fileFilename, fields });
    });

    bb.on('error', reject);

    // Pipe raw body into busboy
    if (Buffer.isBuffer(req.body)) {
      Readable.from(req.body).pipe(bb);
    } else if (typeof req.body === 'string') {
      Readable.from(Buffer.from(req.body)).pipe(bb);
    } else {
      // body already parsed as object — shouldn't happen for multipart
      reject(new Error('Unexpected body type; ensure Content-Type is multipart/form-data'));
    }
  });
}

// ── Helper: extension from mimetype ───────────────────────────────────────────
function extFromMime(mime: string): string {
  const map: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/jpg':  'jpg',
    'image/png':  'png',
    'image/gif':  'gif',
    'image/webp': 'webp',
    'image/svg+xml': 'svg',
  };
  return map[mime] ?? 'bin';
}

// ── Handler ────────────────────────────────────────────────────────────────────
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applyCors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { file, mimetype, fields } = await parseMultipart(req);

    const bucket = fields.bucket ?? 'images';
    const folder = fields.folder ?? 'misc';
    const itemId = fields.itemId ?? randomUUID();
    const ext    = extFromMime(mimetype);
    const path   = `${folder}/${itemId}.${ext}`;

    const db = getSupabase();

    // Upload to Supabase Storage (upsert = overwrite if exists)
    const { error: uploadErr } = await db.storage
      .from(bucket)
      .upload(path, file, {
        contentType: mimetype,
        upsert: true,
      });

    if (uploadErr) {
      console.error('Storage upload error:', uploadErr);
      return res.status(500).json({ error: `Storage upload failed: ${uploadErr.message}` });
    }

    // Get the public URL
    const { data: urlData } = db.storage.from(bucket).getPublicUrl(path);

    res.json({ url: urlData.publicUrl, path });
  } catch (err) {
    console.error('POST /api/upload-image error:', err);
    res.status(500).json({ error: (err as Error).message ?? 'Upload failed' });
  }
}
