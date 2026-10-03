import { ItemLabel } from '../shared/ItemVisual';
import { MachineWorkloadEntry } from '../../types';

interface Props {
  entries: MachineWorkloadEntry[];
}

/** 209.17 → "209 ชม. 10 นาที" */
function formatHours(h: number): string {
  const totalMin = Math.round(h * 60);
  const hrs = Math.floor(totalMin / 60);
  const mins = totalMin % 60;
  if (hrs === 0) return `${mins} นาที`;
  if (mins === 0) return `${hrs.toLocaleString('th-TH')} ชม.`;
  return `${hrs.toLocaleString('th-TH')} ชม. ${mins} นาที`;
}

export function MachineWorkloadTable({ entries }: Props) {
  if (entries.length === 0)
    return <p style={{ fontSize: 13, color: '#94a3b8', fontStyle: 'italic' }}>ไม่มีภาระงานเครื่องจักร</p>;

  const sorted = [...entries].sort((a, b) => b.hours_required - a.hours_required);
  const maxHours = sorted[0]?.hours_required ?? 1;

  return (
    <div className="mw-table">
      {sorted.map((row) => {
        const over = row.max_hours_limit > 0 && row.hours_required > row.max_hours_limit;
        const pct = row.max_hours_limit > 0
          ? Math.min(100, Math.round((row.hours_required / row.max_hours_limit) * 100))
          : Math.round((row.hours_required / maxHours) * 100);
        const barColor = over ? '#ef4444' : pct >= 80 ? '#f59e0b' : '#22c55e';

        return (
          <div key={row.machine_id} className={`mw-row${over ? ' mw-row--over' : ''}`}>
            {/* Machine name + floor */}
            <div className="mw-info">
              <ItemLabel id={row.machine_id} name={row.machine_name} size={28} reserveImage />
              {row.floor_number > 0 && (
                <span className="mw-floor">ชั้น {row.floor_number}</span>
              )}
            </div>

            {/* Progress bar + time */}
            <div className="mw-progress-wrap">
              <div className="mw-bar-row">
                <div className="mw-bar">
                  <div className="mw-bar-fill" style={{ width: `${pct}%`, background: barColor }} />
                </div>
                <span className="mw-pct" style={{ color: barColor }}>{pct}%</span>
              </div>
              <div className="mw-times">
                <span className="mw-required" style={{ color: over ? '#ef4444' : '#0f172a' }}>
                  {formatHours(row.hours_required)}
                </span>
                {row.max_hours_limit > 0 && (
                  <span className="mw-limit">สูงสุด {formatHours(row.max_hours_limit)}</span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
