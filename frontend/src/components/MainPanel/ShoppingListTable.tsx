import { ShoppingListEntry, StockMap } from '../../types';

interface ShoppingListTableProps {
  entries: ShoppingListEntry[];
  stocks: StockMap;
}

export function ShoppingListTable({ entries, stocks }: ShoppingListTableProps) {
  if (entries.length === 0) {
    return <p className="text-sm text-gray-500 italic">ไม่มีวัตถุดิบที่ต้องจัดหา</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left font-semibold text-gray-600 uppercase tracking-wide text-xs">
              ชื่อวัตถุดิบ
            </th>
            <th className="px-4 py-3 text-right font-semibold text-gray-600 uppercase tracking-wide text-xs">
              ต้องใช้ทั้งหมด
            </th>
            <th className="px-4 py-3 text-right font-semibold text-gray-600 uppercase tracking-wide text-xs">
              ต้องจัดหาเพิ่ม
            </th>
            <th className="px-4 py-3 text-right font-semibold text-gray-600 uppercase tracking-wide text-xs">
              มีในสต็อก
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 bg-white">
          {entries.map((entry) => {
            const inStock = stocks[entry.item_id] ?? 0;
            const isShort = entry.net_required > inStock;
            return (
              <tr
                key={entry.item_id}
                className={isShort ? 'bg-red-50' : ''}
              >
                <td className="px-4 py-2 font-medium text-gray-800">
                  {isShort && (
                    <span className="mr-1 text-red-500" title="สต็อกไม่พอ">⚠</span>
                  )}
                  {entry.item_name}
                </td>
                <td className="px-4 py-2 text-right text-gray-600">
                  {entry.total_needed.toLocaleString()}
                </td>
                <td className={`px-4 py-2 text-right font-semibold ${isShort ? 'text-red-600' : 'text-gray-800'}`}>
                  {entry.net_required.toLocaleString()}
                </td>
                <td className="px-4 py-2 text-right text-gray-500">
                  {inStock.toLocaleString()}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
