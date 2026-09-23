import { useState } from 'react';
import { Layout, Menu, Alert, Spin, Empty, Button, message, Skeleton, Drawer, Divider } from 'antd';
import {
  BarChartOutlined,
  DatabaseOutlined,
  SaveOutlined,
  PlayCircleOutlined,
  LoadingOutlined,
  MenuOutlined,
  InboxOutlined,
  ArrowLeftOutlined,
  ClockCircleOutlined,
  WalletOutlined,
} from '@ant-design/icons';
import { useAppState } from './hooks/useAppState';
import { TargetItemForm }       from './components/Sidebar/TargetItemForm';
import { TargetItemList }       from './components/Sidebar/TargetItemList';
import { StockEditor }          from './components/Sidebar/StockEditor';
import { ShoppingListTable }    from './components/MainPanel/ShoppingListTable';
import { MachineWorkloadTable } from './components/MainPanel/MachineWorkloadTable';
import { ProductionPlanner }    from './components/Planner/ProductionPlanner';
import { DataEditor }           from './components/DataEditor/DataEditor';
import { StockInventory }       from './components/Inventory/StockInventory';
import { FloorTimerDashboard }  from './components/Floors/FloorTimerDashboard';
import { BudgetHistory }        from './components/DataEditor/BudgetHistory';
import type { SaveStatus }      from './hooks/useAppState';

const { Sider, Content } = Layout;

type MainView = 'planner' | 'data' | 'inventory' | 'floors' | 'budget';

const NAV_ITEMS = [
  { key: 'planner',    icon: <BarChartOutlined />,    label: 'วางแผนการผลิต' },
  { key: 'data',       icon: <DatabaseOutlined />,    label: 'จัดการข้อมูล' },
  { key: 'inventory',  icon: <InboxOutlined />,       label: 'คลังสต็อก' },
  { key: 'floors',     icon: <ClockCircleOutlined />, label: 'สถานะชั้น' },
  { key: 'budget',     icon: <WalletOutlined />,      label: 'งบประมาณ' },
];

const SIDER_W = 200; // px — ลดจาก 240 เพราะชื่อเมนูสั้น

// ── Save + Calculate buttons ──────────────────────────────────────────────────
function SidebarActions({
  onSave, onCalculate, saveStatus, saveError, loading, canCalculate,
}: {
  onSave: () => Promise<void>;
  onCalculate: () => Promise<void>;
  saveStatus: SaveStatus;
  saveError: string | null;
  loading: boolean;
  canCalculate: boolean;
}) {
  const [msgApi, ctx] = message.useMessage();
  const handleSave = async () => {
    await onSave();
    if (saveStatus !== 'error') msgApi.success('บันทึกสต็อกสำเร็จ');
  };

  return (
    <>
      {ctx}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {saveError && saveStatus === 'error' && (
          <Alert message={saveError} type="error" showIcon style={{ fontSize: 12 }} />
        )}
        <Button icon={<SaveOutlined />} onClick={handleSave} loading={saveStatus === 'saving'} block>
          บันทึกสต็อก
        </Button>
        <Button
          type="primary"
          icon={<PlayCircleOutlined />}
          onClick={onCalculate}
          loading={loading}
          disabled={!canCalculate}
          block
        >
          คำนวณ
        </Button>
      </div>
    </>
  );
}

// ── Page heading ──────────────────────────────────────────────────────────────
function PageHead({ title, sub }: { title: string; sub?: string }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <h2 style={{ fontSize: 18, fontWeight: 600, color: '#0f172a', margin: 0 }}>{title}</h2>
      {sub && <p style={{ fontSize: 13, color: '#64748b', margin: '3px 0 0' }}>{sub}</p>}
    </div>
  );
}

// ── Sidebar content (shared between desktop sider + mobile drawer) ─────────────
function SidebarContent({
  view,
  setView,
  onNavClick,
}: {
  view: MainView;
  setView: (v: MainView) => void;
  onNavClick?: () => void; // close drawer on mobile
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Brand */}
      <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid #e2e8f0', flexShrink: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>โรงงานคำนวณทรัพยากร</div>
        <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>ระบบวางแผนการผลิต</div>
      </div>

      {/* Nav */}
      <Menu
        mode="inline"
        selectedKeys={[view]}
        onClick={({ key }) => { setView(key as MainView); onNavClick?.(); }}
        items={NAV_ITEMS}
        style={{ borderRight: 0, paddingTop: 6, fontSize: 13, flexShrink: 0 }}
      />

    </div>
  );
}

function BomWorkspace({
  onBack, recipes, stocks, stockImages, targetItems, addTargetItem, removeTargetItem,
  updateStock, saveStocks, runCalculation, calculationResult, loading, initError,
  calcError, saveStatus, saveError,
}: {
  onBack: () => void;
  recipes: ReturnType<typeof useAppState>['recipes'];
  stocks: ReturnType<typeof useAppState>['stocks'];
  stockImages: ReturnType<typeof useAppState>['stockImages'];
  targetItems: ReturnType<typeof useAppState>['targetItems'];
  addTargetItem: ReturnType<typeof useAppState>['addTargetItem'];
  removeTargetItem: ReturnType<typeof useAppState>['removeTargetItem'];
  updateStock: ReturnType<typeof useAppState>['updateStock'];
  saveStocks: ReturnType<typeof useAppState>['saveStocks'];
  runCalculation: ReturnType<typeof useAppState>['runCalculation'];
  calculationResult: ReturnType<typeof useAppState>['calculationResult'];
  loading: boolean;
  initError: string | null;
  calcError: string | null;
  saveStatus: SaveStatus;
  saveError: string | null;
}) {
  return (
    <main className="bom-workspace">
      <header className="bom-workspace__header">
        <Button type="text" icon={<ArrowLeftOutlined />} onClick={onBack}>กลับไปหน้าหลัก</Button>
        <div>
          <h1>ผลการคำนวณ BOM</h1>
          <p>กำหนดเป้าหมาย ตรวจสต็อก และสรุปทรัพยากรที่ต้องใช้ในพื้นที่เดียว</p>
        </div>
      </header>

      {initError && <Alert type="error" message="โหลดข้อมูลไม่สำเร็จ" description={initError} showIcon />}
      {calcError && <Alert type="warning" message="เกิดข้อผิดพลาดในการคำนวณ" description={calcError} showIcon />}

      <section className="bom-workspace__controls">
        <div className="bom-workspace__targets">
          <h2>รายการที่ต้องการผลิต</h2>
          <TargetItemForm recipes={recipes} onAdd={addTargetItem} />
          {targetItems.length > 0 ? (
            <div style={{ marginTop: 14 }}><TargetItemList items={targetItems} recipes={recipes} onRemove={removeTargetItem} /></div>
          ) : <p className="bom-workspace__hint">เพิ่มรายการและจำนวนที่ต้องการผลิตก่อนคำนวณ</p>}
        </div>
        <div className="bom-workspace__actions">
          <h2>คำนวณทรัพยากร</h2>
          <p>บันทึกสต็อกล่าสุดก่อน แล้วระบบจะคำนวณวัตถุดิบและชั่วโมงเครื่องจักรให้</p>
          <SidebarActions onSave={saveStocks} onCalculate={runCalculation} saveStatus={saveStatus} saveError={saveError} loading={loading} canCalculate={targetItems.length > 0} />
        </div>
      </section>

      <section className="bom-workspace__stock">
        <div><h2>สต็อกปัจจุบัน</h2><p>แก้ไขจำนวนที่มีอยู่เพื่อให้ผลลัพธ์สะท้อนคลังจริง</p></div>
        <Divider style={{ margin: '14px 0' }} />
        {recipes.length === 0 ? <Skeleton active paragraph={{ rows: 5 }} /> : <StockEditor recipes={recipes} stocks={stocks} stockImages={stockImages} onUpdate={updateStock} />}
      </section>

      <section className="bom-workspace__results" aria-live="polite">
        <div className="bom-workspace__results-heading"><h2>สรุปผลการคำนวณ</h2>{calculationResult && <span>อ้างอิง {targetItems.length} รายการเป้าหมาย</span>}</div>
        {loading && <div className="bom-workspace__loading"><Spin indicator={<LoadingOutlined style={{ fontSize: 32, color: '#2563eb' }} spin />} /><p>กำลังคำนวณ…</p></div>}
        {!loading && calculationResult && (
          <div className="bom-workspace__result-grid">
            <section><div className="result-label">รายการที่ต้องจัดหา <span>{calculationResult.shopping_list.length} รายการ</span></div><ShoppingListTable entries={calculationResult.shopping_list} stocks={stocks} stockImages={stockImages} /></section>
            <section><div className="result-label">ภาระงานเครื่องจักร <span>{calculationResult.machine_workloads.length} เครื่อง</span></div><MachineWorkloadTable entries={calculationResult.machine_workloads} /></section>
          </div>
        )}
        {!loading && !calculationResult && !initError && !calcError && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="ผลลัพธ์จะแสดงที่นี่หลังจากกดคำนวณ" style={{ padding: '56px 0' }} />}
      </section>
    </main>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [view, setView] = useState<MainView>('data');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [bomOpen, setBomOpen] = useState(false);

  const {
    recipes, machines: _machines, stocks, stockImages, applyData,
    targetItems, addTargetItem, removeTargetItem,
    updateStock, saveStocks, runCalculation,
    calculationResult, loading,
    initError, calcError, saveStatus, saveError,
  } = useAppState();

  const sidebarProps = { view, setView };

  if (bomOpen) {
    return <BomWorkspace onBack={() => setBomOpen(false)} {...{
      recipes, stocks, stockImages, targetItems, addTargetItem, removeTargetItem,
      updateStock, saveStocks, runCalculation, calculationResult, loading, initError,
      calcError, saveStatus, saveError,
    }} />;
  }

  return (
    <Layout style={{ minHeight: '100vh' }}>

      {/* ── Mobile hamburger bar (hidden on desktop) ────────────────── */}
      <div style={{
        display: 'none',
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 200,
        background: '#ffffff', borderBottom: '1px solid #e2e8f0',
        height: 48, alignItems: 'center', padding: '0 16px',
        justifyContent: 'space-between',
      }} className="mobile-topbar">
        <Button
          type="text"
          icon={<MenuOutlined />}
          onClick={() => setDrawerOpen(true)}
          style={{ color: '#374151' }}
        />
        <span style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>โรงงานคำนวณทรัพยากร</span>
        <div style={{ width: 32 }} />
      </div>

      {/* ── Mobile drawer ───────────────────────────────────────────── */}
      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        placement="left"
        width={220}
        styles={{ body: { padding: 0 }, header: { display: 'none' } }}
        className="mobile-drawer"
      >
        <SidebarContent {...sidebarProps} onNavClick={() => setDrawerOpen(false)} />
      </Drawer>

      {/* ── Desktop sider (hidden on mobile) ────────────────────────── */}
      <Sider
        width={SIDER_W}
        style={{
          background: '#ffffff',
          borderRight: '1px solid #e2e8f0',
          height: '100vh',
          position: 'fixed',
          left: 0, top: 0, bottom: 0,
          overflow: 'hidden',
        }}
        className="desktop-sider"
      >
        <SidebarContent {...sidebarProps} />
      </Sider>

      {/* ── Main content ────────────────────────────────────────────── */}
      <Layout className="main-layout">
        <Content style={{ minHeight: '100vh', background: '#f8fafc', overflowY: 'auto' }}>

          {view === 'data' && (
          <div className="page-content">
              <div className="page-head-with-action"><PageHead title="จัดการข้อมูล" sub="เพิ่ม แก้ไข หรือลบสูตรการผลิต เครื่องจักร และสต็อกวัตถุดิบ" /><Button type="primary" onClick={() => setBomOpen(true)}>เปิดหน้าคำนวณ BOM</Button></div>
              <DataEditor
                initialRecipes={recipes}
                initialMachines={_machines}
                initialStocks={stocks}
                initialStockImages={stockImages}
                onDataChanged={applyData}
              />
            </div>
          )}

          {view === 'planner' && (
            <div className="page-content">
              <PageHead title="วางแผนการผลิต" sub="กำหนดสูตรแต่ละชั้น ระยะเวลา Event และดูผลการผลิตพร้อมวัตถุดิบที่ต้องใช้" />
              <ProductionPlanner recipes={recipes} stocks={stocks} machines={_machines} />
            </div>
          )}

          {view === 'inventory' && (
            <div className="page-content">
              <PageHead
                title="คลังสต็อก"
                sub="รายการวัตถุดิบและสินค้าที่มีอยู่ในคลังตอนนี้"
              />
              <StockInventory
                stocks={stocks}
                stockImages={stockImages}
                recipes={recipes}
              />
            </div>
          )}

          {view === 'floors' && (
            <div className="page-content floor-page-content">
              <PageHead title="สถานะชั้นผลิต" sub="ติดตามเวลาทำงานของแต่ละชั้น และเริ่มรอบการผลิตใหม่ได้จากหน้านี้" />
              <FloorTimerDashboard />
            </div>
          )}

          {view === 'budget' && (
            <div className="page-content">
              <PageHead
                title="งบประมาณ"
                sub="สรุปยอดใช้จ่าย และประวัติการซื้อสต็อก — จัดการงบและบันทึกรายการซื้อได้ที่ จัดการข้อมูล"
              />
              <BudgetHistory recipes={recipes} />
            </div>
          )}

        </Content>
      </Layout>
    </Layout>
  );
}
