import { MachineWorkloadEntry } from '../../types';

interface MachineWorkloadTableProps {
  entries: MachineWorkloadEntry[];
}

export function MachineWorkloadTable({ entries }: MachineWorkloadTableProps) {
  if (entries.length === 0) {
    return <p className="text-sm text-gray-500 italic">ไม่มีภาระงานเครื่องจักร</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left font-semibold text-gray-600 uppercase tracking-wide text-xs">
              สถานะ
            </th>
            <th className="px-4 py-3 text-left font-semibold text-gray-600 uppercase tracking-wide text-xs">
              ชื่อเครื่องจักร
            </th>
            <th className="px-4 py-3 text-center font-semibold text-gray-600 uppercase tracking-wide text-xs">
              ชั้น
            </th>
            <th className="px-4 py-3 text-right font-semibold text-gray-600 uppercase tracking-wide text-xs">
              ชั่วโมงที่ต้องใช้
            </th>
            <th className="px-4 py-3 text-right font-semibold text-gray-600 uppercase tracking-wide text-xs">
              ชั่วโมงสูงสุด
            </th>
            <th className="px-4 py-3 text-right font-semibold text-gray-600 uppercase tracking-wide text-xs">
              การใช้งาน
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 bg-white">
          {entries
            .slice()
            .sort((a, b) => b.hours_required - a.hours_required)
            .map((entry) => {
              const isOver = entry.hours_required > entry.max_hours_limit;
              const utilization = entry.max_hours_limit > 0
                ? Math.round((entry.hours_required / entry.max_hours_limit) * 100)
                : 0;

              return (
                <tr key={entry.machine_id} className={isOver ? 'bg-red-50' : ''}>
                  <td className="px-4 py-2">
                    <span
                      className={`inline-block h-3 w-3 rounded-full ${
                        isOver ? 'bg-red-500' : 'bg-green-500'
                      }`}
                      title={isOver ? 'เกินขีดจำกัด' : 'อยู่ในขีดจำกัด'}
                    />
                  </td>
                  <td className="px-4 py-2 font-medium text-gray-800">{entry.machine_name}</td>
                  <td className="px-4 py-2 text-center text-gray-600">ชั้น {entry.floor_number}</td>
                  <td className={`px-4 py-2 text-right font-semibold ${isOver ? 'text-red-600' : 'text-gray-800'}`}>
                    {entry.hours_required.toFixed(2)}h
                  </td>
                  <td className="px-4 py-2 text-right text-gray-600">{entry.max_hours_limit}h</td>
                  <td className="px-4 py-2 text-right">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        isOver
                          ? 'bg-red-100 text-red-700'
                          : utilization >= 80
                          ? 'bg-yellow-100 text-yellow-700'
                          : 'bg-green-100 text-green-700'
                      }`}
                    >
                      {utilization}%
                    </span>
                  </td>
                </tr>
              );
            })}
        </tbody>
      </table>
    </div>
  );
}
