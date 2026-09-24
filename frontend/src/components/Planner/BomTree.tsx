import { ItemLabel } from '../shared/ItemVisual';
// frontend/src/components/Planner/BomTree.tsx
import { useState } from 'react';
import { RightOutlined, DownOutlined } from '@ant-design/icons';
import { BomTreeNode } from '../../types';

interface BomTreeProps {
  node: BomTreeNode;
  depth?: number;
}

export function BomTree({ node, depth = 0 }: BomTreeProps) {
  const [open, setOpen] = useState(depth < 2);
  const hasChildren = node.children.length > 0;
  const indent = depth * 20;

  return (
    <div>
      <div
        className={`flex items-center gap-1 py-1 px-2 rounded hover:bg-gray-50 cursor-pointer select-none ${
          node.is_raw ? 'text-gray-500' : 'text-gray-800'
        }`}
        style={{ paddingLeft: `${8 + indent}px` }}
        role={hasChildren ? 'button' : undefined}
        tabIndex={hasChildren ? 0 : undefined}
        aria-expanded={hasChildren ? open : undefined}
        onKeyDown={(event) => {
          if (hasChildren && (event.key === 'Enter' || event.key === ' ')) {
            event.preventDefault();
            setOpen((value) => !value);
          }
        }}
        onClick={() => hasChildren && setOpen((v) => !v)}
      >
        {/* expand/collapse icon */}
        <span className="w-4 text-center text-xs text-gray-400 flex-shrink-0">
          {hasChildren
            ? (open ? <DownOutlined style={{ fontSize: 10 }} /> : <RightOutlined style={{ fontSize: 10 }} />)
            : null}
        </span>

        {/* name + qty */}
        <span className={`text-sm flex-1 ${node.is_raw ? 'text-gray-500' : 'font-medium'}`}>
          <ItemLabel id={node.item_id} name={node.item_name} size={26} />
        </span>
        <span className="text-sm font-semibold text-gray-700 ml-2">
          {node.quantity_needed.toLocaleString()}
        </span>

        {/* produced-by badge */}
        {node.produced_by_floor !== undefined && (
          <span className="ml-2 text-xs bg-blue-100 text-blue-700 rounded-full px-2 py-0.5">
            ชั้น {node.produced_by_floor}
          </span>
        )}

        {/* raw badge */}
        {node.is_raw && (
          <span className="ml-1 text-xs bg-gray-100 text-gray-500 rounded-full px-2 py-0.5">
            ดิบ
          </span>
        )}
      </div>

      {/* children */}
      {hasChildren && open && (
        <div className="border-l border-gray-200 ml-5">
          {node.children.map((child, i) => (
            <BomTree key={`${child.item_id}-${i}`} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}
