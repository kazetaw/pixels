import { useState } from 'react';
import { Layout, Menu, Alert, Spin, Empty, Button, message, Skeleton, Drawer } from 'antd';
import {
  CalculatorOutlined,
  BarChartOutlined,
  DatabaseOutlined,
  SaveOutlined,
  PlayCircleOutlined,
  LoadingOutlined,
  MenuOutlined,
} from '@ant-design/icons';
import { useAppState } from './hooks/useAppState';
import { TargetItemForm }       from './components/Sidebar/TargetItemForm';
import { TargetItemList }       from './components/Sidebar/TargetItemList';
import { StockEditor }          from './components/Sidebar/StockEditor';
import { ShoppingListTable }    from './components/MainPanel/ShoppingListTable';
import { MachineWorkloadTable } from './components/MainPanel/MachineWorkloadTable';
import { ProductionPlanner }    from './components/Planner/ProductionPlanner';
import { DataEditor }           from './components/DataEditor/DataEditor';
import type { SaveStatus }      from './hooks/useAppState';

const { Sider, Content } = Layout;

type MainView = 'calculator' | 'planner' | 'data';

const NAV_ITEMS = [
  { key: 'calculator', icon: <CalculatorOutlined />, label: 'คำนวณ BOM' },
  { key: 'planner',    icon: <BarChartOutlined />,   label: 'วางแผนการผลิต' },
  { key: 'data',       icon: <DatabaseOutlined />,   label: 'จัดการข้อมูล' },
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
  recipes,
  stocks,
  stockImages,
  targetItems,
  addTargetItem,
  removeTargetItem,
  updateStock,
  saveStocks,
  runCalculation,
  loading,
  saveStatus,
  saveError,
  onNavClick,
}: {
  view: MainView;
  setView: (v: MainView) => void;
  recipes: ReturnType<typeof useAppState>['recipes'];
  stocks: ReturnType<typeof useAppState>['stocks'];
  stockImages: ReturnType<typeof useAppState>['stockImages'];
  targetItems: ReturnType<typeof useAppState>['targetItems'];
  addTargetItem: ReturnType<typeof useAppState>['addTargetItem'];
  removeTargetItem: ReturnType<typeof useAppState>['removeTargetItem'];
  updateStock: ReturnType<typeof useAppState>['updateStock'];
  saveStocks: ReturnType<typeof useAppState>['saveStocks'];
  runCalculation: ReturnType<typeof useAppState>['runCalculation'];
  loading: boolean;
  saveStatus: SaveStatus;
  saveError: string | null;
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

      {/* BOM inputs — only on calculator view */}
      {view === 'calculator' && (
        <>
          <div style={{
            flex: 1, overflowY: 'auto',
            padding: '10px 14px',
            display: 'flex', flexDirection: 'column', gap: 12,
            borderTop: '1px solid #e2e8f0',
          }}>
            <TargetItemForm recipes={recipes} onAdd={addTargetItem} />

            {targetItems.length > 0 && (
              <div>
                <div style={{ fontSize: 10, fontWeight: 600, color: '#94a3b8', letterSpacing: '0.05em', marginBottom: 5 }}>
                  รายการเป้าหมาย
                </div>
                <TargetItemList items={targetItems} recipes={recipes} onRemove={removeTargetItem} />
              </div>
            )}

            <div>
              <div style={{ fontSize: 10, fontWeight: 600, color: '#94a3b8', letterSpacing: '0.05em', marginBottom: 5 }}>
                สต็อกปัจจุบัน
              </div>
              {recipes.length === 0
                ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {[1,2,3,4].map(i => (
                      <Skeleton.Input key={i} active size="small" block style={{ height: 26, borderRadius: 4 }} />
                    ))}
                  </div>
                )
                : <StockEditor recipes={recipes} stocks={stocks} stockImages={stockImages} onUpdate={updateStock} />
              }
            </div>
          </div>

          <div style={{ padding: '10px 14px', borderTop: '1px solid #e2e8f0', flexShrink: 0 }}>
            <SidebarActions
              onSave={saveStocks}
              onCalculate={runCalculation}
              saveStatus={saveStatus}
              saveError={saveError}
              loading={loading}
              canCalculate={targetItems.length > 0}
            />
          </div>
        </>
      )}
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [view, setView] = useState<MainView>('data');
  const [drawerOpen, setDrawerOpen] = useState(false);

  const {
    recipes, machines: _machines, stocks, stockImages,
    targetItems, addTargetItem, removeTargetItem,
    updateStock, saveStocks, runCalculation,
    calculationResult, loading,
    initError, calcError, saveStatus, saveError,
  } = useAppState();

  const sidebarProps = {
    view, setView, recipes, stocks, stockImages,
    targetItems, addTargetItem, removeTargetItem,
    updateStock, saveStocks, runCalculation,
    loading, saveStatus, saveError,
  };

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
              <PageHead title="จัดการข้อมูล" sub="เพิ่ม แก้ไข หรือลบสูตรการผลิต เครื่องจักร และสต็อกวัตถุดิบ" />
              <DataEditor
                initialRecipes={recipes}
                initialMachines={_machines}
                initialStocks={stocks}
                initialStockImages={stockImages}
              />
            </div>
          )}

          {view === 'planner' && (
            <div className="page-content">
              <PageHead title="วางแผนการผลิต" sub="กำหนดสูตรแต่ละชั้น ระยะเวลา Event และดูผลการผลิตพร้อมวัตถุดิบที่ต้องใช้" />
              <ProductionPlanner recipes={recipes} stocks={stocks} machines={_machines} />
            </div>
          )}

          {view === 'calculator' && (
            <div style={{ maxWidth: 900, margin: '0 auto', padding: '28px 24px' }}>
              <PageHead title="ผลการคำนวณ BOM" sub="เพิ่มไอเทมเป้าหมาย ตั้งค่าสต็อก แล้วกดคำนวณ" />

              {initError && (
                <Alert type="error" message="โหลดข้อมูลไม่สำเร็จ" description={initError} showIcon style={{ marginBottom: 16 }} />
              )}
              {calcError && (
                <Alert type="warning" message="เกิดข้อผิดพลาดในการคำนวณ" description={calcError} showIcon style={{ marginBottom: 16 }} />
              )}

              {loading && (
                <div style={{ textAlign: 'center', padding: '80px 0' }}>
                  <Spin indicator={<LoadingOutlined style={{ fontSize: 32, color: '#2563eb' }} spin />} />
                  <div style={{ fontSize: 13, color: '#64748b', marginTop: 14 }}>กำลังคำนวณ…</div>
                </div>
              )}

              {!loading && calculationResult && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
                  <section>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 12 }}>
                      <span style={{ fontSize: 15, fontWeight: 600, color: '#0f172a' }}>รายการที่ต้องจัดหา</span>
                      <span style={{ fontSize: 12, color: '#94a3b8' }}>{calculationResult.shopping_list.length} รายการ</span>
                    </div>
                    <ShoppingListTable entries={calculationResult.shopping_list} stocks={stocks} stockImages={stockImages} />
                  </section>
                  <section>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 12 }}>
                      <span style={{ fontSize: 15, fontWeight: 600, color: '#0f172a' }}>ภาระงานเครื่องจักร</span>
                      <span style={{ fontSize: 12, color: '#94a3b8' }}>{calculationResult.machine_workloads.length} เครื่อง</span>
                    </div>
                    <MachineWorkloadTable entries={calculationResult.machine_workloads} />
                  </section>
                </div>
              )}

              {!loading && !calculationResult && !initError && !calcError && (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={<span style={{ fontSize: 13, color: '#94a3b8' }}>เพิ่มไอเทมเป้าหมายทางซ้าย แล้วกดคำนวณ</span>}
                  style={{ padding: '80px 0' }}
                />
              )}
            </div>
          )}

        </Content>
      </Layout>
    </Layout>
  );
}
