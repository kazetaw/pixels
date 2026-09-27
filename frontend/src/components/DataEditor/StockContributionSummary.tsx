import { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Collapse, Drawer, Empty, Input, Spin, Tag, Typography } from 'antd';
import { ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import type { Recipe, StockPurchase } from '../../types';
import { fetchAllStockPurchases } from '../../api/client';
import { ItemLabel } from '../shared/ItemVisual';
import { CONTRIBUTOR_AVATARS } from '../shared/contributors';

const { Text } = Typography;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface ContributorItem {
  itemId: string;
  quantity: number;
  entries: number;
  sources: Set<string>;
  latestAt: string;
}

interface ContributorGroup {
  name: string;
  quantity: number;
  entries: number;
  latestAt: string;
  items: Map<string, ContributorItem>;
}

export function StockContributionSummary({ open, onClose, recipes, itemNames }: {
  open: boolean;
  onClose: () => void;
  recipes: Recipe[];
  itemNames: Record<string, string>;
}) {
  const [purchases, setPurchases] = useState<StockPurchase[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const itemName = (id: string) => {
    const catalogName = itemNames[id];
    return catalogName && !UUID_RE.test(catalogName)
      ? catalogName
      : recipes.find((recipe) => recipe.id === id)?.name ?? 'ไม่พบชื่อสินค้า';
  };

  const load = async () => {
    setLoading(true); setError(null);
    try { setPurchases(await fetchAllStockPurchases()); }
    catch (err) { setError((err as Error).message || 'โหลดสรุปการเติมสต็อกไม่สำเร็จ'); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (open) void load(); }, [open]);

  const groups = useMemo(() => {
    const map = new Map<string, ContributorGroup>();
    for (const purchase of purchases) {
      const name = purchase.contributor?.trim() || 'ไม่ระบุชื่อ';
      const group = map.get(name) ?? { name, quantity: 0, entries: 0, latestAt: purchase.purchased_at, items: new Map<string, ContributorItem>() };
      group.quantity += purchase.quantity;
      group.entries += 1;
      if (Date.parse(purchase.purchased_at) > Date.parse(group.latestAt)) group.latestAt = purchase.purchased_at;
      const item = group.items.get(purchase.item_id) ?? {
        itemId: purchase.item_id, quantity: 0, entries: 0, sources: new Set<string>(), latestAt: purchase.purchased_at,
      };
      item.quantity += purchase.quantity;
      item.entries += 1;
      if (purchase.source) item.sources.add(purchase.source);
      if (Date.parse(purchase.purchased_at) > Date.parse(item.latestAt)) item.latestAt = purchase.purchased_at;
      group.items.set(purchase.item_id, item);
      map.set(name, group);
    }
    const normalized = query.trim().toLocaleLowerCase('th');
    return [...map.values()]
      .map((group) => ({ ...group, items: new Map([...group.items].filter(([, item]) =>
        !normalized || group.name.toLocaleLowerCase('th').includes(normalized) || itemName(item.itemId).toLocaleLowerCase('th').includes(normalized))) }))
      .filter((group) => group.items.size > 0)
      .sort((a, b) => b.quantity - a.quantity || a.name.localeCompare(b.name, 'th'));
  }, [purchases, query, itemNames, recipes]);

  const totalQuantity = purchases.reduce((sum, purchase) => sum + purchase.quantity, 0);
  const contributorCount = new Set(purchases.map((purchase) => purchase.contributor?.trim() || 'ไม่ระบุชื่อ')).size;

  return <Drawer open={open} onClose={onClose} width={760} title="สรุปการเติมสต็อก" className="stock-contribution-drawer"
    extra={<Button size="small" icon={<ReloadOutlined />} loading={loading} onClick={() => void load()}>อัปเดต</Button>}>
    <p className="stock-contribution-note">สรุปจากประวัติการซื้อทั้งหมด โดยใช้ช่อง “งบจาก” เป็นชื่อผู้เติมสต็อก</p>
    <div className="stock-contribution-metrics">
      <div><span>ผู้เติมสต็อก</span><strong>{contributorCount.toLocaleString('th-TH')}</strong><small>คน</small></div>
      <div><span>เพิ่มสต็อกรวม</span><strong>{totalQuantity.toLocaleString('th-TH')}</strong><small>ชิ้น</small></div>
      <div><span>รายการบันทึก</span><strong>{purchases.length.toLocaleString('th-TH')}</strong><small>ครั้ง</small></div>
    </div>
    <Input className="stock-contribution-search" prefix={<SearchOutlined />} allowClear value={query}
      onChange={(event) => setQuery(event.target.value)} placeholder="ค้นหาชื่อคนหรือสินค้า" />
    {error ? <Alert type="error" showIcon message="โหลดข้อมูลไม่สำเร็จ" description={error} /> : loading && !purchases.length
      ? <div className="stock-contribution-loading"><Spin /><span>กำลังรวมประวัติการเติมสต็อก…</span></div>
      : groups.length === 0 ? <Empty description={query ? 'ไม่พบชื่อคนหรือสินค้าที่ค้นหา' : 'ยังไม่มีประวัติการเติมสต็อก'} />
      : <Collapse className="stock-contribution-groups" defaultActiveKey={groups.slice(0, 1).map((group) => group.name)}
        items={groups.map((group) => ({
          key: group.name,
          label: <div className="stock-contribution-person">
            {CONTRIBUTOR_AVATARS[group.name]
              ? <img className="stock-contribution-avatar" src={CONTRIBUTOR_AVATARS[group.name]} alt={`รูป ${group.name}`} />
              : <span className="stock-contribution-avatar">{group.name.slice(0, 1)}</span>}
            <div><strong>{group.name}</strong><span>{group.items.size} สินค้า · {group.entries} ครั้ง</span></div>
          </div>,
          extra: <div className="stock-contribution-total"><strong>+{group.quantity.toLocaleString('th-TH')}</strong><span>ชิ้น</span></div>,
          children: <div className="stock-contribution-items">
            <div className="stock-contribution-item-head"><span>สินค้า</span><span>แหล่งที่มา</span><span>จำนวนรวม</span></div>
            {[...group.items.values()].sort((a, b) => b.quantity - a.quantity || itemName(a.itemId).localeCompare(itemName(b.itemId), 'th')).map((item) =>
              <div className="stock-contribution-item" key={item.itemId}>
                <ItemLabel id={item.itemId} name={itemName(item.itemId)} size={30} reserveImage detail={`ล่าสุด ${new Date(item.latestAt).toLocaleDateString('th-TH', { dateStyle: 'short' })}`} />
                <div>{item.sources.size ? [...item.sources].map((source) => <Tag key={source}>{source}</Tag>) : <Text type="secondary">—</Text>}</div>
                <strong>+{item.quantity.toLocaleString('th-TH')} ชิ้น</strong>
              </div>)}
          </div>,
        }))} />}
  </Drawer>;
}
