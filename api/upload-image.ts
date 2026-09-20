/**
 * api/upload-image.ts  →  POST /api/upload-image
 *
 * Separate function (not in catch-all) so we can disable Vercel's
 * automatic body parser — required for multipart/form-data to work.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Readable } from 'stream';
import { getSupabase } from './lib/db.js';
import { applyCors } from './lib/cors.js';
import { randomUUID } from 'crypto';

// Tell Vercel NOT to parse the body — busboy needs the raw stream
export const config = {
  api: {
    bodyParser: false,
  },
};

function extFromMime(mime: string): string {
  const map: Record<string, string> = {
    'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/png': 'png',
    'image/gif': 'gif', 'image/webp': 'webp', 'image/svg+xml': 'svg',
  };
  return map[mime] ?? 'bin';
}

async function parseMultipart(req: VercelRequest): Promise<{
  file: Buffer; mimetype: string; fields: Record<string, string>;
}> {
  const Busboy = (await import('busboy')).default;
  return new Promise((resolve, reject) => {
    const bb = Busboy({ headers: req.headers as Record<string, string> });
    let fileBuffer: Buffer | null = null;
    let fileMimetype = 'application/octet-stream';
    const fields: Record<string, string> = {};

    bb.on('file', (_fieldname, stream, info) => {
      fileMimetype = info.mimeType;
      const chunks: Buffer[] = [];
      stream.on('data', (c: Buffer) => chunks.push(c));
      stream.on('end', () => { fileBuffer = Buffer.concat(chunks); });
    });
    bb.on('field', (name, value) => { fields[name] = value; });
    bb.on('finish', () => {
      if (!fileBuffer) return reject(new Error('No file received'));
      resolve({ file: fileBuffer, mimetype: fileMimetype, fields });
    });
    bb.on('error', reject);

    // Pipe the raw request stream into busboy
    (req as unknown as Readable).pipe(bb);
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (applyCors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { file, mimetype, fields } = await parseMultipart(req);

    const bucket     = fields.bucket ?? 'images';
    const folder     = fields.folder ?? 'misc';
    const itemId     = fields.itemId ?? randomUUID();
    const ext        = extFromMime(mimetype);
    const storagePath = `${folder}/${itemId}.${ext}`;

    const db = getSupabase();
    const { error: uploadErr } = await db.storage
      .from(bucket)
      .upload(storagePath, file, { contentType: mimetype, upsert: true });

    if (uploadErr) {
      console.error('Storage upload error:', uploadErr);
      return res.status(500).json({ error: uploadErr.message });
    }

    const { data: urlData } = db.storage.from(bucket).getPublicUrl(storagePath);
    return res.json({ url: urlData.publicUrl, path: storagePath });
  } catch (err) {
    console.error('POST /api/upload-image error:', err);
    return res.status(500).json({ error: (err as Error).message ?? 'Upload failed' });
  }
}
