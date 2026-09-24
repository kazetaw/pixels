import { ItemLabel } from '../shared/ItemVisual';
import { useMemo, useState } from 'react';
import { Button, Checkbox, Drawer, Empty, Input, Table } from 'antd';
import { CheckCircleOutlined, RightOutlined, SearchOutlined, WarningOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { PlanResponse, FloorPlanResult } from '../../types';
import { BomTree } from './BomTree';
import { formatPlanDuration, groupFloorRows, summarizeProducts } from './planPresentation';

type SummaryView = 'overview' | 'floors' | 'raw' | 'intermediate';
interface MaterialRow { key: string; name: string; needed: number; available: number; shortfall: number }
const number = (value: number) => value.toLocaleString('th-TH');

function MaterialTable({ rows, type }: { rows: MaterialRow[]; type: 'raw' | 'intermediate' }) {
  const [query, setQuery] = useState('');
  const [missingOnly, setMissingOnly] = useState(false);
  const [page, setPage] = useState(1);
  const filtered = rows.filter((row) => (!missingOnly || row.shortfall > 0) && row.name.toLocaleLowerCase('th').includes(query.trim().toLocaleLowerCase('th')))
    .sort((a, b) => b.shortfall - a.shortfall || a.name.localeCompare(b.name, 'th'));
  const columns: ColumnsType<MaterialRow> = [
    { title: 'รายการ', dataIndex: 'name', render: (name, row) => <ItemLabel id={row.key} name={name} size={32} reserveImage /> },
    { title: 'ต้องใช้', dataIndex: 'needed', align: 'right', width: 100, render: number },
    { title: type === 'raw' ? 'ในสต็อก' : 'ผลิตในแผน', dataIndex: 'available', align: 'right', width: 110, render: number },
    { title: type === 'raw' ? 'จัดหาเพิ่ม' : 'ยังขาด', dataIndex: 'shortfall', align: 'right', width: 115,
      render: (value) => value > 0 ? <strong className="plan-shortfall">{number(value)}</strong> : <span className="plan-sufficient"><CheckCircleOutlined /> เพียงพอ</span> },
  ];
  return <section className="plan-table-section">
    <div className="plan-table-toolbar">
      <Input aria-label="ค้นหาวัตถุดิบ" placeholder="ค้นหาชื่อรายการ" prefix={<SearchOutlined />} value={query} allowClear onChange={(event) => { setQuery(event.target.value); setPage(1); }} />
      <Checkbox checked={missingOnly} onChange={(event) => { setMissingOnly(event.target.checked); setPage(1); }}>เฉพาะที่ขาด</Checkbox>
      <span>{filtered.length} รายการ · หน่วย: ชิ้น</span>
    </div>
    <Table rowKey="key" size="small" columns={columns} dataSource={filtered} scroll={{ x: 540 }}
      pagination={{ current: page, pageSize: 10, onChange: setPage, showSizeChanger: false, hideOnSinglePage: true }}
      locale={{ emptyText: query ? 'ไม่พบรายการที่ค้นหา' : missingOnly ? 'ไม่มีรายการที่ขาด' : 'ไม่มีวัตถุดิบประเภทนี้ในแผน' }} />
  </section>;
}

export function PlanSummary({ result }: { result: PlanResponse }) {
  const [view, setView] = useState<SummaryView>('overview');
  const [selected, setSelected] = useState<FloorPlanResult | null>(null);
  const products = useMemo(() => summarizeProducts(result.floor_results), [result]);
  const floors = useMemo(() => [...result.floor_results].sort((a, b) => a.floor_number - b.floor_number), [result]);
  const raw: MaterialRow[] = result.raw_materials.map((row) => ({ key: row.item_id, name: row.item_name, needed: row.total_needed, available: row.in_stock, shortfall: row.net_required }));
  const intermediate: MaterialRow[] = result.intermediate_supply.map((row) => ({ key: row.item_id, name: row.item_name, needed: row.needed, available: row.produced, shortfall: row.shortfall }));
  const missingRaw = raw.filter((row) => row.shortfall > 0).sort((a, b) => b.shortfall - a.shortfall);
  const missingIntermediate = intermediate.filter((row) => row.shortfall > 0).sort((a, b) => b.shortfall - a.shortfall);
  const totalOutput = floors.reduce((sum, floor) => sum + floor.output_qty, 0);
  const hasShortfall = missingRaw.length + missingIntermediate.length > 0;
  const outputColumns: ColumnsType<(typeof products)[number]> = [
    { title: 'สินค้าที่ผลิต', dataIndex: 'name', render: (name, product) => <ItemLabel id={product.id} name={name} size={36} reserveImage detail={`ชั้น ${product.floors.join(', ')}`} /> },
    { title: 'จำนวน (ชิ้น)', dataIndex: 'quantity', align: 'right', width: 120, render: (value) => <strong>{number(value)}</strong> },
  ];

  return <div className="plan-summary">
    <div className="plan-summary-heading"><div><h3>สรุปแผนการผลิต</h3><p>Event {formatPlanDuration(result.event_total_hours)} · {number(result.event_total_hours)} ชั่วโมง</p></div>
      <span className={`plan-status ${hasShortfall ? 'plan-status--warning' : 'plan-status--ok'}`}>{hasShortfall ? <WarningOutlined /> : <CheckCircleOutlined />}{hasShortfall ? 'มีรายการที่ต้องจัดหาเพิ่ม' : 'วัตถุดิบครบตามผลคำนวณ'}</span>
    </div>
    <dl className="plan-metrics">
      <div><dt>ผลผลิตรวมทุกชั้น</dt><dd>{number(totalOutput)} <small>ชิ้น</small></dd><span>ก่อนหักส่วนที่ใช้ผลิตต่อ</span></div>
      <div><dt>ชั้นที่วางแผน</dt><dd>{floors.length} <small>ชั้น</small></dd><span>{products.length} ชนิดสินค้า</span></div>
      <div><dt>วัตถุดิบดิบที่ขาด</dt><dd className={missingRaw.length ? 'plan-shortfall' : ''}>{missingRaw.length} <small>รายการ</small></dd><span>เทียบกับสต็อกปัจจุบัน</span></div>
      <div><dt>สินค้าแปรรูปที่ขาด</dt><dd className={missingIntermediate.length ? 'plan-shortfall' : ''}>{missingIntermediate.length} <small>รายการ</small></dd><span>เทียบกับยอดผลิตในแผน</span></div>
    </dl>
    <nav className="plan-summary-navigation" aria-label="รายละเอียดผลคำนวณ">
      {([{ key: 'overview', label: 'ภาพรวม' }, { key: 'floors', label: `แต่ละชั้น (${floors.length})` },
        { key: 'raw', label: `วัตถุดิบดิบ (${raw.length})` }, { key: 'intermediate', label: `สินค้าแปรรูป (${intermediate.length})` }] as const)
        .map((item) => <button type="button" key={item.key} aria-pressed={view === item.key} onClick={() => setView(item.key)}>{item.label}</button>)}
    </nav>

    {view === 'overview' && <div className="plan-overview-grid">
      <section className="plan-overview-output"><div className="plan-panel-heading"><h4>ผลิตอะไรได้บ้าง</h4><Button type="link" onClick={() => setView('floors')}>แยกตามชั้น <RightOutlined /></Button></div>
        <Table rowKey="id" columns={outputColumns} dataSource={products} size="small"
          pagination={{ pageSize: 4, showSizeChanger: false, hideOnSinglePage: true }} locale={{ emptyText: 'ไม่มีผลผลิตในแผน' }} />
      </section>
      <section className="plan-overview-shortages"><div className="plan-panel-heading"><h4>สิ่งที่ต้องเตรียมเพิ่ม</h4><span>ขาดมากที่สุด · ชิ้น</span></div>
        {([{ title: 'วัตถุดิบดิบ', rows: missingRaw, target: 'raw' }, { title: 'สินค้าแปรรูป', rows: missingIntermediate, target: 'intermediate' }] as const).map((section) =>
          <div className="plan-shortage-group" key={section.target}>
            <div className="plan-shortage-heading"><strong>{section.title}</strong><span>{section.rows.length} รายการ</span></div>
            {section.rows.length ? <ul>{section.rows.slice(0, 2).map((row) => <li key={row.key}><ItemLabel id={row.key} name={row.name} size={26} /><strong className="plan-shortfall">+{number(row.shortfall)}</strong></li>)}</ul>
              : <p className="plan-sufficient"><CheckCircleOutlined /> ไม่มีรายการที่ขาด</p>}
            <Button type="link" onClick={() => setView(section.target)}>ดู{section.title}ทั้งหมด <RightOutlined /></Button>
          </div>)}
      </section>
    </div>}

    {view === 'floors' && <section><div className="plan-panel-heading"><h4>ผลผลิตแต่ละชั้น</h4><span>เลือกชั้นเพื่อดูส่วนผสมและจำนวนที่ใช้</span></div>
      {floors.length ? <div className="plan-floor-results-grid">{groupFloorRows(floors).map((group) => <div className="plan-floor-results-group" key={group[0].floor_number}>
        <div className="plan-floor-results-labels"><span>ชั้น</span><span>สูตรการผลิต</span><span>ชิ้น</span><span /></div>
        {group.map((floor) => <button type="button" className="plan-floor-result" key={floor.floor_number} onClick={() => setSelected(floor)} aria-label={`ดูรายละเอียดชั้น ${floor.floor_number} ${floor.recipe_name}`}>
          <span className="planner-floor-number">{String(floor.floor_number).padStart(2, '0')}</span><span className="plan-floor-recipe-name"><ItemLabel id={floor.recipe_id} name={floor.recipe_name} size={24} /></span><strong>{number(floor.output_qty)}</strong><RightOutlined />
        </button>)}
      </div>)}</div> : <Empty description="ยังไม่มีชั้นที่กำหนด" />}
    </section>}
    {view === 'raw' && <MaterialTable key="raw" rows={raw} type="raw" />}
    {view === 'intermediate' && <MaterialTable key="intermediate" rows={intermediate} type="intermediate" />}

    <Drawer open={!!selected} onClose={() => setSelected(null)} title={selected ? `รายละเอียดชั้น ${selected.floor_number}` : ''} size={560} className="plan-detail-drawer">
      {selected && <><h3 className="plan-detail-title"><ItemLabel id={selected.recipe_id} name={selected.recipe_name} size={44} /></h3>
        <dl className="plan-detail-metrics"><div><dt>ผลผลิต</dt><dd>{number(selected.output_qty)} ชิ้น</dd></div><div><dt>รอบ / เครื่อง</dt><dd>{number(selected.cycles)} รอบ</dd></div><div><dt>เวลา / ชิ้น</dt><dd>{selected.time_per_unit}</dd></div></dl>
        <h4 className="plan-detail-subtitle">ส่วนผสมทั้งหมดที่ต้องใช้</h4><p className="plan-detail-note">จำนวนรวมสำหรับชั้นนี้ ก่อนหักสต็อก · หน่วย: ชิ้น</p>
        <BomTree key={selected.floor_number} node={selected.bom_tree} />
      </>}
    </Drawer>
  </div>;
}
