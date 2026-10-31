import { useEffect, useState, useCallback } from 'react';
import { Avatar, Tabs, Spin, Alert, Button, Form, Select, InputNumber, Input, Table, Tag, message } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { ReloadOutlined } from '@ant-design/icons';
import {
  fetchContributorSummary,
  fetchContributorReturns,
  createContributorReturn,
} from '../../api/client';
import { CONTRIBUTOR_PROFILES, contributorLabel } from '../shared/contributors';
import type { ContributorReturn, ContributorSummary, ContributorSummaryItem } from '../../types';

const { Option } = Select;
const LAST_CONTRIBUTOR_KEY = 'contributor-returns-last';

function fmt(n: number) { return n.toLocaleString('th-TH'); }

// ── Avatar helper ─────────────────────────────────────────────────────────────
function ContribAvatar({ name, size = 40 }: { name: string; size?: number }) {
  const profile = CONTRIBUTOR_PROFILES.find((p) => p.name === name);
  return (
    <Avatar
      size={size}
      src={profile?.avatar}
      style={{
        background: '#e0e7ff',
        color: '#4f46e5',
        flexShrink: 0,
        transform: profile?.flipAvatar ? 'scaleX(-1)' : undefined,
      }}
    >
      {!profile?.avatar && name.slice(0, 1)}
    </Avatar>
  );
}

// ── Contributor option label (avatar + name) ──────────────────────────────────
function ContribOptionLabel({ name }: { name: string }) {
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
      <ContribAvatar name={name} size={22} />
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {contributorLabel(name)}
      </span>
    </span>
  );
}

// ── Status chip ───────────────────────────────────────────────────────────────
function StatusTag({ total_pending }: { total_pending: number }) {
  if (total_pending === 0) return <Tag color="success">ครบแล้ว</Tag>;
  return <Tag color="error">ค้างอยู่ {fmt(total_pending)} ชิ้น</Tag>;
}

// ── Contributor card ──────────────────────────────────────────────────────────
function ContributorCard({ summary }: { summary: ContributorSummary }) {
  const [open, setOpen] = useState(false);

  return (
    <div
      style={{
        background: '#ffffff',
        border: `1px solid ${summary.total_pending === 0 && summary.total_contributed > 0 ? '#bbf7d0' : '#e2e8f0'}`,
        borderRadius: 12,
        overflow: 'hidden',
      }}
    >
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          width: '100%',
          textAlign: 'left',
          background: 'none',
          border: 'none',
          padding: '14px 16px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
        aria-expanded={open}
      >
        <ContribAvatar name={summary.contributor} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 14, color: '#0f172a' }}>
            {contributorLabel(summary.contributor)}
          </div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
            เติม {fmt(summary.total_contributed)} · คืนแล้ว {fmt(summary.total_returned)} รายการรวม
          </div>
        </div>
        <StatusTag total_pending={summary.total_pending} />
        <span style={{ fontSize: 11, color: '#94a3b8' }}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div style={{ borderTop: '1px solid #e2e8f0', padding: '0 16px 16px' }}>
          <table
            style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginTop: 12 }}
          >
            <thead>
              <tr style={{ color: '#64748b', fontSize: 11 }}>
                <th style={{ textAlign: 'left', fontWeight: 500, paddingBottom: 6 }}>สินค้า</th>
                <th style={{ textAlign: 'right', fontWeight: 500, paddingBottom: 6 }}>เติมมา</th>
                <th style={{ textAlign: 'right', fontWeight: 500, paddingBottom: 6 }}>รับคืน</th>
                <th style={{ textAlign: 'right', fontWeight: 500, paddingBottom: 6 }}>คงค้าง</th>
              </tr>
            </thead>
            <tbody>
              {summary.items.map((item: ContributorSummaryItem) => (
                <tr key={item.item_id} style={{ borderTop: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '6px 0', color: '#0f172a' }}>{item.item_name}</td>
                  <td
                    style={{
                      textAlign: 'right',
                      color: '#4f46e5',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {fmt(item.contributed_qty)}
                  </td>
                  <td
                    style={{
                      textAlign: 'right',
                      color: '#059669',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {fmt(item.returned_qty)}
                  </td>
                  <td
                    style={{
                      textAlign: 'right',
                      fontWeight: 600,
                      fontVariantNumeric: 'tabular-nums',
                      color: item.pending_qty === 0 ? '#16a34a' : '#ef4444',
                    }}
                  >
                    {item.pending_qty === 0 ? '✓' : fmt(item.pending_qty)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: '2px solid #e2e8f0', fontWeight: 600 }}>
                <td style={{ paddingTop: 8, color: '#0f172a', fontSize: 13 }}>รวม</td>
                <td
                  style={{
                    textAlign: 'right',
                    color: '#4f46e5',
                    paddingTop: 8,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {fmt(summary.total_contributed)}
                </td>
                <td
                  style={{
                    textAlign: 'right',
                    color: '#059669',
                    paddingTop: 8,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {fmt(summary.total_returned)}
                </td>
                <td
                  style={{
                    textAlign: 'right',
                    paddingTop: 8,
                    fontVariantNumeric: 'tabular-nums',
                    color: summary.total_pending === 0 ? '#16a34a' : '#ef4444',
                  }}
                >
                  {fmt(summary.total_pending)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Tab 1: สรุปรายคน ──────────────────────────────────────────────────────────
function SummaryTab({ data, loading, error, onReload }: {
  data: ContributorSummary[];
  loading: boolean;
  error: string;
  onReload: () => void;
}) {
  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <Spin />
      </div>
    );
  }
  if (error) {
    return (
      <Alert
        type="error"
        message={error}
        action={
          <Button size="small" icon={<ReloadOutlined />} onClick={onReload}>
            ลองใหม่
          </Button>
        }
      />
    );
  }
  if (!data.length) {
    return (
      <div style={{ padding: '48px 0', textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
        ยังไม่มีข้อมูลการเติมสต็อก — เมื่อมีการบันทึกคนเติมในหน้างบประมาณ ข้อมูลจะปรากฏที่นี่
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <Button icon={<ReloadOutlined />} onClick={onReload} size="small">
          รีเฟรช
        </Button>
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
          gap: 16,
        }}
      >
        {data.map((c) => (
          <ContributorCard key={c.contributor} summary={c} />
        ))}
      </div>
    </div>
  );
}

// ── Tab 2: บันทึกจ่ายคืน ──────────────────────────────────────────────────────

interface ReturnFormValues {
  contributor: string;
  item_id: string;
  qty: number;
  note?: string;
}

function RecordTab({ summaryData, onSummaryRefresh }: {
  summaryData: ContributorSummary[];
  onSummaryRefresh: () => void;
}) {
  const [form] = Form.useForm<ReturnFormValues>();
  const [log, setLog] = useState<ContributorReturn[]>([]);
  const [logLoading, setLogLoading] = useState(true);
  const [logError, setLogError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [msgApi, ctx] = message.useMessage();
  const [selectedContrib, setSelectedContrib] = useState<string | undefined>(() => {
    // Restore last used contributor
    try { return localStorage.getItem(LAST_CONTRIBUTOR_KEY) ?? undefined; } catch { return undefined; }
  });

  const loadLog = useCallback(async () => {
    setLogLoading(true); setLogError('');
    try { setLog(await fetchContributorReturns()); }
    catch (e) { setLogError((e as Error).message); }
    finally { setLogLoading(false); }
  }, []);

  useEffect(() => { void loadLog(); }, [loadLog]);

  // Restore cached contributor into form on mount
  useEffect(() => {
    if (selectedContrib) form.setFieldValue('contributor', selectedContrib);
  }, []);

  const contribSummary = summaryData.find((c) => c.contributor === selectedContrib);
  const itemOptions = contribSummary?.items ?? [];
  const pendingItems = itemOptions.filter((i) => i.pending_qty > 0);

  const handleSubmit = async (values: ReturnFormValues) => {
    setSubmitting(true);
    try {
      await createContributorReturn({ contributor: values.contributor, item_id: values.item_id, qty: values.qty, note: values.note ?? '' });
      void msgApi.success('บันทึกการจ่ายคืนสำเร็จ');
      // Cache contributor, keep selected for next entry
      try { localStorage.setItem(LAST_CONTRIBUTOR_KEY, values.contributor); } catch { /* ignore */ }
      form.setFieldsValue({ item_id: undefined, qty: undefined, note: undefined });
      void loadLog();
      onSummaryRefresh();
    } catch (e) { void msgApi.error((e as Error).message); }
    finally { setSubmitting(false); }
  };

  const columns: ColumnsType<ContributorReturn> = [
    { title: 'วันที่', dataIndex: 'returned_at', key: 'returned_at', width: 150, render: (d: string) => new Date(d).toLocaleString('th-TH', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) },
    { title: 'ผู้รับ', dataIndex: 'contributor', key: 'contributor', width: 150,
      render: (name: string) => (
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <ContribAvatar name={name} size={24} />
          {contributorLabel(name)}
        </span>
      ),
    },
    { title: 'สินค้า', dataIndex: 'item_name', key: 'item_name', render: (name: string, row) => name || row.item_id },
    { title: 'จำนวน', dataIndex: 'qty', key: 'qty', align: 'right' as const, width: 90, render: (n: number) => fmt(n) },
    { title: 'หมายเหตุ', dataIndex: 'note', key: 'note', render: (n: string) => n || '—' },
  ];

  const filteredLog = selectedContrib ? log.filter((r) => r.contributor === selectedContrib) : log;

  return (
    <div>
      {ctx}
      <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: 20, marginBottom: 24 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#0f172a', marginBottom: 16 }}>บันทึกการจ่ายคืน</div>
        <Form form={form} layout="vertical" onFinish={(values) => void handleSubmit(values)}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
            <Form.Item name="contributor" label="ผู้รับ" rules={[{ required: true, message: 'เลือกผู้รับ' }]} style={{ margin: 0 }}>
              <Select
                placeholder="เลือกผู้รับ"
                showSearch
                optionFilterProp="label"
                popupMatchSelectWidth={false}
                optionRender={(opt) => <ContribOptionLabel name={String(opt.value)} />}
                labelRender={(opt) => <ContribOptionLabel name={String(opt.value)} />}
                onChange={(v: string) => {
                  setSelectedContrib(v);
                  try { localStorage.setItem(LAST_CONTRIBUTOR_KEY, v); } catch { /* ignore */ }
                  form.setFieldsValue({ item_id: undefined, qty: undefined });
                }}
              >
                {CONTRIBUTOR_PROFILES.map((p) => (
                  <Option key={p.name} value={p.name} label={contributorLabel(p.name)}>
                    <ContribOptionLabel name={p.name} />
                  </Option>
                ))}
              </Select>
            </Form.Item>

            <Form.Item name="item_id" label="สินค้า" rules={[{ required: true, message: 'เลือกสินค้า' }]} style={{ margin: 0 }}>
              <Select
                placeholder="เลือกสินค้า"
                showSearch
                optionFilterProp="label"
                popupMatchSelectWidth={false}
                disabled={!selectedContrib || itemOptions.length === 0}
              >
                {itemOptions.map((item) => (
                  <Option key={item.item_id} value={item.item_id} label={item.item_name}>
                    <span style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                      <span>{item.item_name}</span>
                      {item.pending_qty > 0 && <span style={{ fontSize: 11, color: '#ef4444', flexShrink: 0 }}>ค้าง {fmt(item.pending_qty)}</span>}
                    </span>
                  </Option>
                ))}
              </Select>
            </Form.Item>

            <Form.Item name="qty" label="จำนวน" rules={[{ required: true, message: 'ระบุจำนวน' }]} style={{ margin: 0 }}>
              <InputNumber min={1} placeholder="จำนวนชิ้น" style={{ width: '100%' }} />
            </Form.Item>

            <Form.Item name="note" label="หมายเหตุ" style={{ margin: 0 }}>
              <Input placeholder="ไม่บังคับ" maxLength={200} />
            </Form.Item>
          </div>

          <Button type="primary" htmlType="submit" loading={submitting} style={{ marginTop: 14 }}>
            บันทึกจ่ายคืน
          </Button>
        </Form>

        {pendingItems.length > 0 && (
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 12, color: '#64748b', marginBottom: 6 }}>รายการค้างจ่าย — กดเลือก:</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {pendingItems.map((item) => (
                <Tag key={item.item_id} style={{ cursor: 'pointer', userSelect: 'none' }} color="warning"
                  onClick={() => { form.setFieldsValue({ item_id: item.item_id, qty: item.pending_qty }); }}>
                  {item.item_name} ({fmt(item.pending_qty)})
                </Tag>
              ))}
            </div>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#0f172a' }}>
          ประวัติการจ่ายคืน
          {selectedContrib && <span style={{ fontWeight: 400, fontSize: 13, color: '#64748b', marginLeft: 8 }}>— {contributorLabel(selectedContrib)}</span>}
        </div>
        <Button size="small" icon={<ReloadOutlined />} onClick={() => void loadLog()}>รีเฟรช</Button>
      </div>
      {logError && <Alert type="error" message={logError} style={{ marginBottom: 12 }} />}
      <Table<ContributorReturn> dataSource={filteredLog} columns={columns} rowKey="id" size="small" loading={logLoading} scroll={{ x: 600 }} pagination={{ pageSize: 20, hideOnSinglePage: true, showSizeChanger: false }} locale={{ emptyText: 'ยังไม่มีการบันทึก' }} />
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────
export function ContributorReturns() {
  const [summaryData, setSummaryData] = useState<ContributorSummary[]>([]);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summaryError, setSummaryError] = useState('');

  const loadSummary = useCallback(async () => {
    setSummaryLoading(true);
    setSummaryError('');
    try {
      setSummaryData(await fetchContributorSummary());
    } catch (e) {
      setSummaryError((e as Error).message);
    } finally {
      setSummaryLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  const tabItems = [
    {
      key: 'summary',
      label: 'สรุปรายคน',
      children: (
        <SummaryTab
          data={summaryData}
          loading={summaryLoading}
          error={summaryError}
          onReload={() => void loadSummary()}
        />
      ),
    },
    {
      key: 'record',
      label: 'บันทึกจ่ายคืน',
      children: summaryLoading ? (
        <div style={{ padding: 40, textAlign: 'center' }}>
          <Spin />
        </div>
      ) : (
        <RecordTab
          summaryData={summaryData}
          onSummaryRefresh={() => void loadSummary()}
        />
      ),
    },
  ];

  return (
    <Tabs items={tabItems} defaultActiveKey="summary" style={{ marginTop: -8 }} />
  );
}
