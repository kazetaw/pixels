# Implementation Plan: จ่ายคืน (Contributor Returns) Feature

## Context from codebase exploration

**Key findings:**
- `api/index.ts` is 1238 lines. The final catch-all is the last line: `return res.status(404).json({ error: \`Route not found: ${method} /api/${path}\` });` inside `export default async function handler(...)`. All new routes go immediately before this line, inside the same `try`-less outer scope (each route block has its own try/catch).
- DB pattern: use `getSupabase()` directly (no new db.ts helper needed for the new routes — the select queries are simple enough inline, matching how `assignment-summary` does it).
- `readAllPurchases()` is already exported from `api/lib/db.js` and used in `assignment-summary`. It pages through `stock_purchases` with `contributor` column.
- `stock_purchases.contributor` is `text | null` (migration `20260923_add_purchase_contributor.sql`).
- `contributor_assignments` table has `contributor, item_id, target` — the assignment summary already shows "what each person contributed". The new feature adds a separate return/distribution log.
- The existing store feature has `store_distributions` (stores-specific). The new feature is warehouse-level, not store-specific, so it needs its own `contributor_returns` table.
- Frontend types live in `frontend/src/types/index.ts`. New types go there.
- Frontend API calls live in `frontend/src/api/client.ts`. New functions go at the bottom.
- `MainView` type, `ADMIN_VIEWS`, `NAV_ITEMS` are all in `frontend/src/App.tsx` around lines 56–95.
- The render block for `organization` is the last view block before `</Content>` — new block goes right after it.
- `GiftOutlined` exists in `@ant-design/icons` (confirmed via package directory listing).
- Organization components pattern: functional component, self-contained fetch with `useEffect`, Ant Design `Tabs`, `Table`, `Button`, `Spin`, `Alert`.
- `contributorLabel(name)` from `contributors.ts` formats name + memberId for display.
- `CONTRIBUTOR_PROFILES` provides avatar, name, memberId.

---

## Step 1 — Create the migration file

**What:** Create `supabase/migrations/20261010_03_contributor_returns.sql` with a `contributor_returns` table that records each distribution event (admin returns items to a contributor from the shared warehouse).

**Files:** `supabase/migrations/20261010_03_contributor_returns.sql` (new)

**Exact SQL:**

```sql
-- contributor_returns: tracks when admin returns (distributes back) items
-- that contributors originally brought to the shared warehouse.
create table if not exists public.contributor_returns (
  id             uuid        primary key default gen_random_uuid(),
  contributor    text        not null check (length(trim(contributor)) between 1 and 100),
  item_id        text        not null references public.items(item_id),
  quantity       integer     not null check (quantity > 0),
  note           text        not null default '',
  returned_at    timestamptz not null default now()
);
alter table public.contributor_returns disable row level security;
create index if not exists contributor_returns_contributor_idx
  on public.contributor_returns (contributor);
create index if not exists contributor_returns_returned_at_idx
  on public.contributor_returns (returned_at desc);
```

**Verify:** Run the SQL in Supabase SQL Editor; confirm table appears in Table Editor. No automated test command for raw SQL migrations in this project.

---

## Step 2 — Add 3 API routes to `api/index.ts`

**What:** Add the three new route handlers immediately before the final `return res.status(404)...` line (~line 1237). Follow the exact pattern used by the `assignment-summary` block: `if (segments[0] === '...')` with an inner try/catch.

**Files:** `api/index.ts` (modify)

**Exact insertion point:** Find the comment `// ── 404 ──────────────────────────────────────────────────────────────────────` and insert the new blocks before it.

### Route 1: `GET /api/contributor-summary`

Returns per-contributor totals: items brought in (from `stock_purchases`), items returned (from `contributor_returns`), and balance (brought − returned). This powers the "สรุปรายคน" tab.

```typescript
// ── GET /api/contributor-summary ─────────────────────────────────────────────
if (segments[0] === 'contributor-summary' && method === 'GET') {
  try {
    const db = getSupabase();
    const [purchasesResult, returnsResult, itemsResult] = await Promise.all([
      readAllPurchases(),
      db.from('contributor_returns').select('contributor, item_id, quantity, returned_at'),
      db.from('items').select('item_id, name'),
    ]);

    if (returnsResult.error) throw returnsResult.error;
    if (itemsResult.error) throw itemsResult.error;

    const returns = returnsResult.data ?? [];
    const nameMap = new Map((itemsResult.data ?? []).map((r) => [r.item_id, r.name as string]));

    // Per-contributor, per-item totals
    type ContribItem = { item_id: string; item_name: string; brought: number; returned: number };
    const summaryMap = new Map<string, Map<string, ContribItem>>();

    for (const p of purchasesResult) {
      const contrib = p.contributor?.trim() ?? '';
      if (!contrib) continue;
      if (!summaryMap.has(contrib)) summaryMap.set(contrib, new Map());
      const itemMap = summaryMap.get(contrib)!;
      const existing = itemMap.get(p.item_id) ?? { item_id: p.item_id, item_name: nameMap.get(p.item_id) ?? p.item_id, brought: 0, returned: 0 };
      existing.brought += p.quantity;
      itemMap.set(p.item_id, existing);
    }

    for (const r of returns) {
      const contrib = (r.contributor as string).trim();
      if (!summaryMap.has(contrib)) summaryMap.set(contrib, new Map());
      const itemMap = summaryMap.get(contrib)!;
      const existing = itemMap.get(r.item_id as string) ?? { item_id: r.item_id as string, item_name: nameMap.get(r.item_id as string) ?? r.item_id as string, brought: 0, returned: 0 };
      existing.returned += r.quantity as number;
      itemMap.set(r.item_id as string, existing);
    }

    const result = Array.from(summaryMap.entries()).map(([contributor, itemMap]) => {
      const items = Array.from(itemMap.values()).map((i) => ({
        ...i,
        balance: i.brought - i.returned,
      })).sort((a, b) => a.item_name.localeCompare(b.item_name, 'th'));
      const total_brought = items.reduce((s, i) => s + i.brought, 0);
      const total_returned = items.reduce((s, i) => s + i.returned, 0);
      return { contributor, items, total_brought, total_returned, balance: total_brought - total_returned };
    }).sort((a, b) => a.contributor.localeCompare(b.contributor, 'th'));

    return res.json(result);
  } catch (e) { return res.status(500).json({ error: (e as Error).message }); }
}
```

### Route 2: `GET /api/contributor-returns`

Returns paginated return log. Optional `?contributor=name` filter. Powers the log sub-table in "บันทึกจ่ายคืน" tab.

```typescript
// ── /api/contributor-returns ──────────────────────────────────────────────────
if (segments[0] === 'contributor-returns') {
  const db = getSupabase();
  try {
    if (method === 'GET') {
      const params = new URL(req.url ?? '', 'http://localhost').searchParams;
      const contributor = params.get('contributor')?.trim() ?? '';
      const limit = Math.min(200, Math.max(1, Number(params.get('limit') ?? 100)));
      let query = db
        .from('contributor_returns')
        .select('id, contributor, item_id, quantity, note, returned_at, items(name, image_url)')
        .order('returned_at', { ascending: false })
        .limit(limit);
      if (contributor) query = query.eq('contributor', contributor);
      const { data, error } = await query;
      if (error) throw error;
      const rows = (data ?? []).map((r: Record<string, unknown>) => {
        const item = r.items as { name: string; image_url: string | null } | null;
        return {
          id: r.id,
          contributor: r.contributor,
          item_id: r.item_id,
          quantity: r.quantity,
          note: r.note,
          returned_at: r.returned_at,
          item_name: item?.name ?? '',
          image_url: item?.image_url ?? null,
        };
      });
      return res.json(rows);
    }

    if (method === 'POST') {
      const { contributor, item_id, quantity, note } = req.body ?? {};
      if (typeof contributor !== 'string' || !contributor.trim() || contributor.trim().length > 100)
        return res.status(400).json({ error: 'กรุณาระบุชื่อผู้รับ (ไม่เกิน 100 ตัวอักษร)' });
      if (typeof item_id !== 'string' || !item_id.trim())
        return res.status(400).json({ error: 'กรุณาระบุสินค้า' });
      if (!Number.isSafeInteger(quantity) || quantity <= 0)
        return res.status(400).json({ error: 'จำนวนต้องเป็นจำนวนเต็มมากกว่า 0' });

      // Validate item_id exists in items catalog
      const { data: itemRow, error: itemErr } = await db
        .from('items')
        .select('item_id')
        .eq('item_id', item_id.trim())
        .maybeSingle();
      if (itemErr) throw itemErr;
      if (!itemRow) return res.status(400).json({ error: 'ไม่พบสินค้าในระบบ' });

      const { data, error } = await db
        .from('contributor_returns')
        .insert({
          contributor: contributor.trim(),
          item_id: item_id.trim(),
          quantity,
          note: typeof note === 'string' ? note.trim().slice(0, 500) : '',
        })
        .select('id, contributor, item_id, quantity, note, returned_at')
        .single();
      if (error) throw error;
      return res.status(201).json(data);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) { return res.status(500).json({ error: (e as Error).message }); }
}
```

**Note on import:** Both new routes use `readAllPurchases` (already imported at top of `api/index.ts`) and `getSupabase()` (also already imported). No new imports needed.

**Verify:** `curl http://localhost:3000/api/contributor-summary` should return `[]` (empty array) before any data. `curl -X POST http://localhost:3000/api/contributor-returns -H 'Content-Type: application/json' -d '{"contributor":"test","item_id":"bad","quantity":1}'` should return 400 "ไม่พบสินค้าในระบบ". The project has no automated API test suite — test manually via the UI after the frontend step.

---

## Step 3 — Add types to `frontend/src/types/index.ts`

**What:** Append two new interfaces at the bottom of the types file.

**Files:** `frontend/src/types/index.ts` (modify — append to end)

```typescript
// ── Contributor returns ───────────────────────────────────────────────────────

export interface ContributorReturn {
  id: string;
  contributor: string;
  item_id: string;
  quantity: number;
  note: string;
  returned_at: string;
  item_name: string;
  image_url: string | null;
}

export interface ContributorSummaryItem {
  item_id: string;
  item_name: string;
  brought: number;
  returned: number;
  balance: number;
}

export interface ContributorSummary {
  contributor: string;
  items: ContributorSummaryItem[];
  total_brought: number;
  total_returned: number;
  balance: number;
}
```

**Verify:** `cd frontend && npx tsc --noEmit` — no new errors.

---

## Step 4 — Add API client functions to `frontend/src/api/client.ts`

**What:** Append to the bottom of `client.ts`. Import the new types at the top of the appended block.

**Files:** `frontend/src/api/client.ts` (modify — append to end)

```typescript
// ── Contributor returns ───────────────────────────────────────────────────────

import type { ContributorReturn, ContributorSummary } from '../types';

export async function fetchContributorSummary(): Promise<ContributorSummary[]> {
  return handleResponse<ContributorSummary[]>(await fetch('/api/contributor-summary'));
}

export async function fetchContributorReturns(contributor?: string): Promise<ContributorReturn[]> {
  const qs = contributor ? `?contributor=${encodeURIComponent(contributor)}` : '';
  return handleResponse<ContributorReturn[]>(await fetch(`/api/contributor-returns${qs}`));
}

export async function createContributorReturn(
  payload: { contributor: string; item_id: string; quantity: number; note?: string }
): Promise<ContributorReturn> {
  return handleResponse<ContributorReturn>(await fetch('/api/contributor-returns', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }));
}
```

**Gotcha:** `client.ts` already has several `import` statements scattered throughout the file (e.g. `import { Machine } from '../types'` appears mid-file). TypeScript allows top-level imports anywhere in a module when using ES modules; appending the import block at the bottom is fine here since the file already does this pattern (the `Machine` import is mid-file). Alternatively, add to the existing `import { AppData, Budget, ... }` at line 1 — but given the file's established pattern, appending is consistent.

**Verify:** `cd frontend && npx tsc --noEmit` — no new errors.

---

## Step 5 — Create `frontend/src/components/Organization/ContributorReturns.tsx`

**What:** New React component with two tabs. Tab 1 "สรุปรายคน" — per-contributor card showing items brought vs returned with a balance. Tab 2 "บันทึกจ่ายคืน" — form to record a return + log table.

**Files:** `frontend/src/components/Organization/ContributorReturns.tsx` (new)

### Design plan (per frontend-design rule)

- **Palette:** White base (`#ffffff`), slate-50 section background (`#f8fafc`), indigo-600 (`#4f46e5`) for primary actions, emerald-600 (`#059669`) for "fully returned" state, amber-500 (`#f59e0b`) for outstanding balance. Chosen because it matches the app's existing blue/green/red palette while giving the "return" concept its own indigo anchor.
- **Typography:** System font stack (matches existing app). Numbers in `font-variant-numeric: tabular-nums` for alignment. No display typeface change needed — this is a data-dense admin tool.
- **Layout:** Full-width content area, left-aligned. Contributor cards in a responsive CSS grid (auto-fill, min 300px). Inside each card: avatar + name header, then a compact item table with brought/returned/balance columns.
- **Motion:** None (data table — no animation needed).

### Full component code:

```tsx
import { useEffect, useState, useCallback } from 'react';
import { Tabs, Spin, Alert, Button, Form, Select, InputNumber, Input, Table, Tag, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { ReloadOutlined } from '@ant-design/icons';
import {
  fetchContributorSummary,
  fetchContributorReturns,
  createContributorReturn,
} from '../../api/client';
import { CONTRIBUTOR_PROFILES, contributorLabel } from '../shared/contributors';
import type { ContributorReturn, ContributorSummary } from '../../types';

const { Option } = Select;

function fmt(n: number) { return n.toLocaleString('th-TH'); }

// ── Avatar helper (reuses same pattern as ContributorProgress) ────────────────
function Avatar({ name }: { name: string }) {
  const profile = CONTRIBUTOR_PROFILES.find((p) => p.name === name);
  return (
    <div style={{
      width: 40, height: 40, borderRadius: '50%', overflow: 'hidden',
      background: '#e0e7ff', display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
    }}>
      {profile?.avatar
        ? <img src={profile.avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', transform: profile.flipAvatar ? 'scaleX(-1)' : undefined }} />
        : <span style={{ fontSize: 14, fontWeight: 700, color: '#4f46e5' }}>{name.slice(0, 1)}</span>}
    </div>
  );
}

// ── Balance chip ──────────────────────────────────────────────────────────────
function BalanceChip({ balance }: { balance: number }) {
  if (balance === 0) return <Tag color="success">คืนครบ</Tag>;
  if (balance < 0) return <Tag color="purple">คืนเกิน {fmt(Math.abs(balance))}</Tag>;
  return <Tag color="warning">ค้างจ่าย {fmt(balance)}</Tag>;
}

// ── Tab 1: สรุปรายคน ──────────────────────────────────────────────────────────
function SummaryTab() {
  const [data, setData] = useState<ContributorSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { setData(await fetchContributorSummary()); }
    catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}><Spin /></div>;
  if (error) return <Alert type="error" message={error} action={<Button size="small" icon={<ReloadOutlined />} onClick={() => void load()}>ลองใหม่</Button>} />;
  if (!data.length) return (
    <div style={{ padding: '48px 0', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
      ยังไม่มีข้อมูลการเติมสต็อก — เมื่อมีการบันทึกคนเติมในหน้างบประมาณ ข้อมูลจะปรากฏที่นี่
    </div>
  );

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <Button icon={<ReloadOutlined />} onClick={() => void load()} size="small">รีเฟรช</Button>
      </div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
        gap: 16,
      }}>
        {data.map((c) => (
          <ContributorCard key={c.contributor} summary={c} />
        ))}
      </div>
    </div>
  );
}

function ContributorCard({ summary }: { summary: ContributorSummary }) {
  const [open, setOpen] = useState(false);
  const allReturned = summary.balance === 0 && summary.total_brought > 0;

  return (
    <div style={{
      background: '#ffffff',
      border: `1px solid ${allReturned ? '#bbf7d0' : '#e2e8f0'}`,
      borderRadius: 12,
      overflow: 'hidden',
    }}>
      {/* Card header */}
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          width: '100%', textAlign: 'left', background: 'none', border: 'none',
          padding: '14px 16px', cursor: 'pointer', display: 'flex',
          alignItems: 'center', gap: 12,
        }}
        aria-expanded={open}
      >
        <Avatar name={summary.contributor} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 14, color: '#0f172a' }}>
            {contributorLabel(summary.contributor)}
          </div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
            เติม {fmt(summary.total_brought)} · คืน {fmt(summary.total_returned)} รายการรวม
          </div>
        </div>
        <BalanceChip balance={summary.balance} />
        <span style={{ fontSize: 11, color: '#94a3b8' }}>{open ? '▲' : '▼'}</span>
      </button>

      {/* Expanded item breakdown */}
      {open && (
        <div style={{ borderTop: '1px solid #e2e8f0', padding: '0 16px 16px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginTop: 12 }}>
            <thead>
              <tr style={{ color: '#64748b', fontSize: 11 }}>
                <th style={{ textAlign: 'left', fontWeight: 500, paddingBottom: 6 }}>สินค้า</th>
                <th style={{ textAlign: 'right', fontWeight: 500, paddingBottom: 6 }}>เติม</th>
                <th style={{ textAlign: 'right', fontWeight: 500, paddingBottom: 6 }}>คืน</th>
                <th style={{ textAlign: 'right', fontWeight: 500, paddingBottom: 6 }}>ค้าง</th>
              </tr>
            </thead>
            <tbody>
              {summary.items.map((item) => (
                <tr key={item.item_id} style={{ borderTop: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '6px 0', color: '#0f172a' }}>{item.item_name}</td>
                  <td style={{ textAlign: 'right', color: '#4f46e5', fontVariantNumeric: 'tabular-nums' }}>{fmt(item.brought)}</td>
                  <td style={{ textAlign: 'right', color: '#059669', fontVariantNumeric: 'tabular-nums' }}>{fmt(item.returned)}</td>
                  <td style={{ textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: item.balance === 0 ? '#059669' : item.balance < 0 ? '#7c3aed' : '#b45309' }}>
                    {item.balance === 0 ? '✓' : fmt(item.balance)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Tab 2: บันทึกจ่ายคืน ──────────────────────────────────────────────────────

interface ReturnFormValues {
  contributor: string;
  item_id: string;
  quantity: number;
  note?: string;
}

// ItemOption: built from the contributor's purchase history (from summary)
// We fetch items available in the warehouse (items table) via a separate endpoint.
// For the item dropdown, we use a list of unique item_ids from the summary data
// so admin only sees items actually contributed by that person.

function RecordTab({ summaryData }: { summaryData: ContributorSummary[] }) {
  const [form] = Form.useForm<ReturnFormValues>();
  const [log, setLog] = useState<ContributorReturn[]>([]);
  const [logLoading, setLogLoading] = useState(true);
  const [logError, setLogError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [msgApi, ctx] = message.useMessage();

  // selected contributor to filter item dropdown and log
  const [selectedContrib, setSelectedContrib] = useState<string | undefined>();

  const loadLog = useCallback(async () => {
    setLogLoading(true); setLogError('');
    try { setLog(await fetchContributorReturns()); }
    catch (e) { setLogError((e as Error).message); }
    finally { setLogLoading(false); }
  }, []);

  useEffect(() => { void loadLog(); }, [loadLog]);

  // Item options: items this contributor has brought (from summary), or all if no contributor selected
  const itemOptions: { item_id: string; item_name: string }[] = selectedContrib
    ? (summaryData.find((c) => c.contributor === selectedContrib)?.items ?? [])
    : [];

  const handleSubmit = async (values: ReturnFormValues) => {
    setSubmitting(true);
    try {
      await createContributorReturn({
        contributor: values.contributor,
        item_id: values.item_id,
        quantity: values.quantity,
        note: values.note ?? '',
      });
      msgApi.success('บันทึกการจ่ายคืนสำเร็จ');
      form.resetFields(['item_id', 'quantity', 'note']);
      void loadLog();
    } catch (e) {
      msgApi.error((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const columns: ColumnsType<ContributorReturn> = [
    {
      title: 'ผู้รับ',
      dataIndex: 'contributor',
      key: 'contributor',
      render: (name: string) => contributorLabel(name),
      width: 140,
    },
    {
      title: 'สินค้า',
      dataIndex: 'item_name',
      key: 'item_name',
      render: (name: string, row) => name || row.item_id,
    },
    {
      title: 'จำนวน',
      dataIndex: 'quantity',
      key: 'quantity',
      align: 'right' as const,
      render: (n: number) => fmt(n),
      width: 90,
    },
    {
      title: 'หมายเหตุ',
      dataIndex: 'note',
      key: 'note',
      render: (n: string) => n || '—',
    },
    {
      title: 'วันที่',
      dataIndex: 'returned_at',
      key: 'returned_at',
      width: 160,
      render: (d: string) =>
        new Date(d).toLocaleString('th-TH', {
          year: 'numeric', month: 'short', day: 'numeric',
          hour: '2-digit', minute: '2-digit',
        }),
    },
  ];

  const filteredLog = selectedContrib ? log.filter((r) => r.contributor === selectedContrib) : log;

  return (
    <div>
      {ctx}

      {/* Form */}
      <div style={{
        background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10,
        padding: 20, marginBottom: 24,
      }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#0f172a', marginBottom: 16 }}>
          บันทึกการจ่ายคืน
        </div>
        <Form
          form={form}
          layout="inline"
          onFinish={(values) => void handleSubmit(values)}
          style={{ flexWrap: 'wrap', gap: 8 }}
        >
          <Form.Item name="contributor" rules={[{ required: true, message: 'เลือกผู้รับ' }]}>
            <Select
              placeholder="เลือกผู้รับ"
              style={{ width: 160 }}
              showSearch
              optionFilterProp="label"
              onChange={(v: string) => {
                setSelectedContrib(v);
                form.setFieldValue('item_id', undefined);
              }}
            >
              {CONTRIBUTOR_PROFILES.map((p) => (
                <Option key={p.name} value={p.name} label={contributorLabel(p.name)}>
                  {contributorLabel(p.name)}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item name="item_id" rules={[{ required: true, message: 'เลือกสินค้า' }]}>
            <Select
              placeholder="เลือกสินค้า"
              style={{ width: 200 }}
              showSearch
              optionFilterProp="label"
              disabled={!selectedContrib || itemOptions.length === 0}
            >
              {itemOptions.map((item) => (
                <Option key={item.item_id} value={item.item_id} label={item.item_name}>
                  {item.item_name}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item name="quantity" rules={[{ required: true, message: 'ระบุจำนวน' }]}>
            <InputNumber min={1} placeholder="จำนวน" style={{ width: 110 }} />
          </Form.Item>

          <Form.Item name="note">
            <Input placeholder="หมายเหตุ (ไม่บังคับ)" style={{ width: 200 }} maxLength={200} />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" loading={submitting} style={{ background: '#4f46e5', borderColor: '#4f46e5' }}>
              บันทึก
            </Button>
          </Form.Item>
        </Form>
      </div>

      {/* Log */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#0f172a' }}>
          ประวัติการจ่ายคืน
          {selectedContrib && <span style={{ fontWeight: 400, fontSize: 13, color: '#64748b', marginLeft: 8 }}>
            กรองตาม {contributorLabel(selectedContrib)}
          </span>}
        </div>
        <Button size="small" icon={<ReloadOutlined />} onClick={() => void loadLog()}>รีเฟรช</Button>
      </div>

      {logError && <Alert type="error" message={logError} style={{ marginBottom: 12 }} />}

      <Table<ContributorReturn>
        dataSource={filteredLog}
        columns={columns}
        rowKey="id"
        size="small"
        loading={logLoading}
        pagination={{ pageSize: 20, hideOnSinglePage: true, showSizeChanger: false }}
        locale={{ emptyText: 'ยังไม่มีการบันทึก' }}
      />
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────
export function ContributorReturns() {
  const [summaryData, setSummaryData] = useState<ContributorSummary[]>([]);
  const [summaryLoading, setSummaryLoading] = useState(true);

  useEffect(() => {
    setSummaryLoading(true);
    fetchContributorSummary()
      .then(setSummaryData)
      .catch(() => {/* non-critical for tab 2 */ })
      .finally(() => setSummaryLoading(false));
  }, []);

  const tabItems = [
    {
      key: 'summary',
      label: 'สรุปรายคน',
      children: <SummaryTab />,
    },
    {
      key: 'record',
      label: 'บันทึกจ่ายคืน',
      children: summaryLoading
        ? <div style={{ padding: 40, textAlign: 'center' }}><Spin /></div>
        : <RecordTab summaryData={summaryData} />,
    },
  ];

  return (
    <Tabs
      items={tabItems}
      defaultActiveKey="summary"
      style={{ marginTop: -8 }}
    />
  );
}
```

**TypeScript gotchas:**
- `Form.Item` with `name` prop and `Form.useForm<ReturnFormValues>()` requires the value types match. `quantity` is `number` here — `InputNumber` returns `number | null`; `rules: [{ required: true }]` prevents null from passing submit.
- `align: 'right' as const` is required for the column `align` prop to satisfy Ant Design's `AlignType`.
- `selectedContrib` is `string | undefined` — the `onChange` on the contributor Select sets it; `form.setFieldValue` resets the item field when contributor changes (avoids stale item_id).
- No `import type { ColumnsType }` conflict — it is already used in `BudgetHistory.tsx` in the same pattern.

**Verify:** `cd frontend && npx tsc --noEmit` — no errors. `cd frontend && npm run build` — builds without errors.

---

## Step 6 — Modify `frontend/src/App.tsx`

**What:** Four changes in App.tsx.

### 6a. Add `GiftOutlined` to the icon import block (lines ~17–30)

Find the existing `@ant-design/icons` import:

```typescript
import {
  BarChartOutlined as _BarChartOutlined,
  DatabaseOutlined,
  SaveOutlined,
  PlayCircleOutlined,
  LoadingOutlined,
  MenuOutlined,
  InboxOutlined,
  ArrowLeftOutlined,
  ClockCircleOutlined,
  WalletOutlined,
  AimOutlined,
  CloudOutlined,
  CloseCircleFilled,
  TeamOutlined,
  ApartmentOutlined as _ApartmentOutlined,
} from '@ant-design/icons';
```

Change to (add `GiftOutlined` at the end before the closing `}`):

```typescript
import {
  BarChartOutlined as _BarChartOutlined,
  DatabaseOutlined,
  SaveOutlined,
  PlayCircleOutlined,
  LoadingOutlined,
  MenuOutlined,
  InboxOutlined,
  ArrowLeftOutlined,
  ClockCircleOutlined,
  WalletOutlined,
  AimOutlined,
  CloudOutlined,
  CloseCircleFilled,
  TeamOutlined,
  ApartmentOutlined as _ApartmentOutlined,
  GiftOutlined,
} from '@ant-design/icons';
```

### 6b. Add import for `ContributorReturns` component

Find the existing Organization imports block:

```typescript
import { AssignmentEditor } from './components/Organization/AssignmentEditor';
import { AssignmentSummary } from './components/Organization/AssignmentSummary';
import { OrganizationChart } from './components/Organization/OrganizationChart';
```

Add after it:

```typescript
import { ContributorReturns } from './components/Organization/ContributorReturns';
```

### 6c. Update `MainView` type, `ADMIN_VIEWS`, and `NAV_ITEMS`

**Current `MainView` type** (line ~56):
```typescript
type MainView = 'crafting-guide' | 'machine-layout' | 'withdrawal-admin' | 'withdrawals' | 'assignments' | 'planner' | 'shared-planner' | 'production-flow' | 'data' | 'inventory' | 'floors' | 'targets' | 'budget' | 'organization';
```

**New** (add `'contributor-returns'` at the end):
```typescript
type MainView = 'crafting-guide' | 'machine-layout' | 'withdrawal-admin' | 'withdrawals' | 'assignments' | 'planner' | 'shared-planner' | 'production-flow' | 'data' | 'inventory' | 'floors' | 'targets' | 'budget' | 'organization' | 'contributor-returns';
```

**Current `ADMIN_VIEWS`** (line ~58):
```typescript
const ADMIN_VIEWS: MainView[] = ['crafting-guide', 'machine-layout', 'withdrawal-admin', 'planner', 'production-flow', 'withdrawals', 'assignments', 'shared-planner', 'data', 'inventory', 'floors', 'targets', 'budget', 'organization'];
```

**New** (add `'contributor-returns'` at the end):
```typescript
const ADMIN_VIEWS: MainView[] = ['crafting-guide', 'machine-layout', 'withdrawal-admin', 'planner', 'production-flow', 'withdrawals', 'assignments', 'shared-planner', 'data', 'inventory', 'floors', 'targets', 'budget', 'organization', 'contributor-returns'];
```

**NAV_ITEMS** — add after the `organization` entry (not in `PUBLIC_VIEWS`, so it only shows for admin):

```typescript
  {
    key: 'contributor-returns',
    icon: <GiftOutlined />,
    label: 'จ่ายคืน',
  },
```

The full `NAV_ITEMS` array after modification should end with:
```typescript
  {
    key: 'organization',
    icon: <TeamOutlined />,
    label: 'ผังบริษัท',
  },
  {
    key: 'contributor-returns',
    icon: <GiftOutlined />,
    label: 'จ่ายคืน',
  },
];
```

### 6d. Add the render block

Find the closing `organization` render block:

```typescript
          {view === 'organization' && (
            <div className="page-content organization-page-content">
              <PageHead
                title="ผังบริษัท"
                sub="สมาชิกทีม Pixel Factory"
              />
              <OrganizationChart
                  stocks={stocks}
                  itemNames={itemNames}
                  nameToId={Object.fromEntries(
                    Object.entries(itemNames).map(([id, name]) => [name, id])
                  )}
                />
            </div>
          )}
```

Add immediately after it (before `</Content>`):

```typescript
          {isAdmin && view === 'contributor-returns' && (
            <div className="page-content">
              <PageHead
                title="จ่ายคืน"
                sub="สรุปของที่แต่ละคนเติมมา และบันทึกการส่งคืนให้ผู้เติม"
              />
              <ContributorReturns />
            </div>
          )}
```

**Gotcha:** The `isAdmin &&` guard is important — `contributor-returns` is not in `PUBLIC_VIEWS`, but the guard is an extra safety layer. Other admin-only views like `machine-layout` and `withdrawal-admin` use the same `isAdmin &&` guard.

**Verify:** `cd frontend && npx tsc --noEmit` — no errors. `cd frontend && npm run build` — clean build.

---

## Step 7 — Final integration check

**What:** Verify the full build and that the new menu item appears.

**Files:** No changes.

**Verify:**
1. `cd frontend && npm run build` — exits 0 with no TypeScript or bundler errors.
2. Start the dev server (or use Vercel preview) and navigate to `/admin` — confirm "จ่ายคืน" menu item appears after "ผังบริษัท" with the gift icon.
3. Click "จ่ายคืน" — two tabs appear: "สรุปรายคน" and "บันทึกจ่ายคืน".
4. "สรุปรายคน" tab: loading spinner → empty state if no purchase contributor data, otherwise contributor cards.
5. "บันทึกจ่ายคืน" tab: select a contributor, see their items in the dropdown, fill in quantity, submit — entry appears in the log table below.

---

## Gotchas summary

| Issue | Detail |
|---|---|
| `GiftOutlined` | Confirmed to exist in `@ant-design/icons` package installed in this project. |
| `readAllPurchases` import in `api/index.ts` | Already imported at top of file — no change needed. |
| `getSupabase` import in `api/index.ts` | Already imported — no change needed. |
| `Form.setFieldValue` | Ant Design v5 API — verify version. The project uses Ant Design from `frontend/package.json`. If v4, use `form.setFields([{ name: 'item_id', value: undefined }])` instead. |
| Item dropdown in form | Populated from `summaryData` (already loaded in parent), so no extra API call. Only shows items this contributor has actually contributed — avoids invalid combinations. |
| `contributor-returns` not in `PUBLIC_VIEWS` | Correct — this is admin-only. The `setView` guard already blocks navigation to views not in the current view set. |
| `align: 'right' as const` | Required for Ant Design column `align` prop type narrowing. |
| SQL FK on `item_id` | `contributor_returns.item_id references public.items(item_id)` — safe because the form's item dropdown is populated from items that already exist in `items` via `stock_purchases`. |
| Migration filename | `20261010_03_contributor_returns.sql` — uses same date prefix as `_01_store.sql` and `_02_store_contributor_distribution.sql`, with `_03` suffix. |
