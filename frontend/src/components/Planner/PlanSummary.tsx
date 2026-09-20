// frontend/src/components/Planner/PlanSummary.tsx
import { useState } from 'react';
import {
  WarningOutlined, CheckOutlined, RightOutlined, DownOutlined,
  ApartmentOutlined, SwapOutlined, InboxOutlined,
} from '@ant-design/icons';
import { Tag, Alert } from 'antd';
import { PlanResponse, FloorPlanResult } from '../../types';
import { BomTree } from './BomTree';

interface PlanSummaryProps {
  result: PlanResponse;
}

function formatHours(totalHours: number): string {
  const days = Math.floor(totalHours / 24);
  const h = Math.floor(totalHours % 24);
  const m = Math.round((totalHours % 1) * 60);
  const parts = [];
  if (days > 0) parts.push(`${days} วัน`);
  if (h > 0) parts.push(`${h} ชั่วโมง`);
  if (m > 0) parts.push(`${m} นาที`);
  return parts.join(' ') || '0 ชั่วโมง';
}

function FloorCard({ fr }: { fr: FloorPlanResult }) {
  const [showTree, setShowTree] = useState(false);
  const timeLabel = `${fr.time_per_unit} / ชิ้น`;

  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
      <div className="px-4 py-3 flex items-center justify-between bg-gray-50 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold text-gray-700 bg-gray-200 rounded-full w-8 h-8 flex items-center justify-center">
            {fr.floor_number}
          </span>
          <div>
            <p className="font-semibold text-gray-800 text-sm">{fr.recipe_name}</p>
            <p className="text-xs text-gray-500">{timeLabel} · {fr.cycles.toLocaleString()} รอบ</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-lg font-bold text-green-700">{fr.output_qty.toLocaleString()}</p>
          <p className="text-xs text-gray-500">ชิ้น</p>
        </div>
      </div>

      <div className="px-4 py-2">
        <button
          onClick={() => setShowTree((v) => !v)}
          className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
        >
          {showTree ? <DownOutlined style={{ fontSize: 10 }} /> : <RightOutlined style={{ fontSize: 10 }} />} ดู BOM Tree
        </button>
        {showTree && (
          <div className="mt-2 border border-gray-100 rounded-md py-1">
            <BomTree node={fr.bom_tree} />
          </div>
        )}
      </div>
    </div>
  );
}

export function PlanSummary({ result }: PlanSummaryProps) {
  const { event_total_hours, floor_results, intermediate_supply, raw_materials } = result;

  const totalOutput = floor_results.reduce((s, f) => s + f.output_qty, 0);
  const insufficientRaw = raw_materials.filter((r) => !r.sufficient).length;
  const insufficientInter = intermediate_supply.filter((i) => !i.sufficient).length;

  return (
    <div className="space-y-6">

      {/* ── Event summary bar ── */}
      <div className="rounded-lg bg-indigo-50 border border-indigo-200 px-5 py-4 flex flex-wrap gap-6">
        <div>
          <p className="text-xs text-indigo-500 font-medium uppercase tracking-wide">ระยะเวลา Event</p>
          <p className="text-lg font-bold text-indigo-800">{formatHours(event_total_hours)}</p>
          <p className="text-xs text-indigo-500">{event_total_hours.toFixed(2)} ชั่วโมงรวม</p>
        </div>
        <div>
          <p className="text-xs text-indigo-500 font-medium uppercase tracking-wide">ชั้นที่กำหนด</p>
          <p className="text-lg font-bold text-indigo-800">{floor_results.length} ชั้น</p>
        </div>
        <div>
          <p className="text-xs text-indigo-500 font-medium uppercase tracking-wide">ผลผลิตรวม</p>
          <p className="text-lg font-bold text-indigo-800">{totalOutput.toLocaleString()} ชิ้น</p>
        </div>
        {insufficientRaw > 0 && (
          <Alert
            type="error"
            message={`วัตถุดิบดิบไม่พอ ${insufficientRaw} รายการ`}
            showIcon
            icon={<WarningOutlined />}
            style={{ alignSelf: 'center' }}
          />
        )}
        {insufficientInter > 0 && (
          <Alert
            type="warning"
            message={`วัตถุดิบกลางไม่พอ ${insufficientInter} รายการ`}
            showIcon
            icon={<WarningOutlined />}
            style={{ alignSelf: 'center' }}
          />
        )}
      </div>

      {/* ── Floor plan results ── */}
      <section>
        <h3 className="text-base font-bold text-gray-800 mb-3 flex items-center gap-2">
          <ApartmentOutlined /> แผนการผลิตแต่ละชั้น
        </h3>
        <div className="grid grid-cols-1 gap-3">
          {floor_results.map((fr) => (
            <FloorCard key={`${fr.floor_number}-${fr.recipe_id}`} fr={fr} />
          ))}
        </div>
      </section>

      {/* ── Intermediate supply validation ── */}
      {intermediate_supply.length > 0 && (
        <section>
          <h3 className="text-base font-bold text-gray-800 mb-3 flex items-center gap-2">
            <SwapOutlined /> วัตถุดิบกลาง (Intermediate)
          </h3>
          <div className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">สถานะ</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">ชื่อ</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">ต้องใช้</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">ผลิตได้</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">ขาด</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {intermediate_supply.map((item) => (
                  <tr key={item.item_id} className={item.sufficient ? '' : 'bg-orange-50'}>
                    <td className="px-4 py-2">
                      <span className={`inline-block h-3 w-3 rounded-full ${item.sufficient ? 'bg-green-500' : 'bg-orange-500'}`} />
                    </td>
                    <td className="px-4 py-2 font-medium text-gray-800">{item.item_name}</td>
                    <td className="px-4 py-2 text-right text-gray-600">{item.needed.toLocaleString()}</td>
                    <td className="px-4 py-2 text-right text-gray-600">{item.produced.toLocaleString()}</td>
                    <td className={`px-4 py-2 text-right font-semibold ${item.sufficient ? 'text-gray-400' : 'text-orange-600'}`}>
                      {item.shortfall > 0 ? `-${item.shortfall.toLocaleString()}` : <CheckOutlined />}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ── Raw material summary ── */}
      <section>
        <h3 className="text-base font-bold text-gray-800 mb-3 flex items-center gap-2">
          <InboxOutlined /> วัตถุดิบดิบรวมทั้งหมด
        </h3>
        <div className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">สถานะ</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">ชื่อวัตถุดิบ</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">ต้องใช้ทั้งหมด</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">มีในสต็อก</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">ต้องจัดหาเพิ่ม</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {raw_materials.map((r) => (
                <tr key={r.item_id} className={r.sufficient ? '' : 'bg-red-50'}>
                  <td className="px-4 py-2">
                    <span className={`inline-block h-3 w-3 rounded-full ${r.sufficient ? 'bg-green-500' : 'bg-red-500'}`} />
                  </td>
                  <td className="px-4 py-2 font-medium text-gray-800">
                    {!r.sufficient && <WarningOutlined style={{ color: '#ff4d4f', marginRight: 6 }} />}
                    {r.item_name}
                  </td>
                  <td className="px-4 py-2 text-right text-gray-600">{r.total_needed.toLocaleString()}</td>
                  <td className="px-4 py-2 text-right text-gray-500">{r.in_stock.toLocaleString()}</td>
                  <td className={`px-4 py-2 text-right font-semibold ${r.sufficient ? 'text-gray-400' : 'text-red-600'}`}>
                    {r.net_required > 0 ? r.net_required.toLocaleString() : '✓'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

    </div>
  );
}
