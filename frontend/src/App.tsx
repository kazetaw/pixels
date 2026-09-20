import { useState } from 'react';
import {
  Layout, Menu, Typography, Alert, Spin, Empty, Divider,
} from 'antd';
import {
  CalculatorOutlined, BarChartOutlined, DatabaseOutlined,
  BookOutlined, SaveOutlined, PlayCircleOutlined,
} from '@ant-design/icons';
import { useAppState } from './hooks/useAppState';
import { TargetItemForm } from './components/Sidebar/TargetItemForm';
import { TargetItemList } from './components/Sidebar/TargetItemList';
import { StockEditor } from './components/Sidebar/StockEditor';
import { ShoppingListTable } from './components/MainPanel/ShoppingListTable';
import { MachineWorkloadTable } from './components/MainPanel/MachineWorkloadTable';
import { UserGuide } from './components/UserGuide';
import { ProductionPlanner } from './components/Planner/ProductionPlanner';
import { DataEditor } from './components/DataEditor/DataEditor';
import { SaveStatus } from './hooks/useAppState';
import { Button, message } from 'antd';

const { Sider, Content } = Layout;
const { Title, Text } = Typography;

type MainView = 'calculator' | 'planner' | 'data' | 'guide';

const NAV_ITEMS = [
  { key: 'calculator', icon: <CalculatorOutlined />, label: 'คำนวณ BOM' },
  { key: 'planner',    icon: <BarChartOutlined />,   label: 'วางแผนการผลิต' },
  { key: 'data',       icon: <DatabaseOutlined />,   label: 'จัดการข้อมูล' },
  { key: 'guide',      icon: <BookOutlined />,        label: 'คู่มือการใช้งาน' },
];

// ── Sidebar action buttons ────────────────────────────────────────────────────
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
  const [messageApi, contextHolder] = message.useMessage();

  const handleSave = async () => {
    await onSave();
    if (saveStatus !== 'error') {
      messageApi.success('บันทึกสต็อกสำเร็จ');
    }
  };

  return (
    <>
      {contextHolder}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {saveError && saveStatus === 'error' && (
          <Alert message={saveError} type="error" showIcon style={{ fontSize: 12 }} />
        )}
        <Button
          icon={<SaveOutlined />}
          onClick={handleSave}
          loading={saveStatus === 'saving'}
          block
        >
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

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [view, setView] = useState<MainView>('calculator');

  const {
    recipes, machines: _machines, stocks, stockImages,
    targetItems, addTargetItem, removeTargetItem,
    updateStock, saveStocks, runCalculation,
    calculationResult, loading,
    initError, calcError, saveStatus, saveError,
  } = useAppState();

  return (
    <Layout style={{ minHeight: '100vh' }}>
      {/* ── Sider ── */}
      <Sider
        width={260}
        style={{
          overflow: 'hidden',
          height: '100vh',
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Logo / brand */}
        <div style={{
          padding: '20px 20px 12px',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
        }}>
          <Text style={{ color: '#fff', fontWeight: 600, fontSize: 15, display: 'block' }}>
            โรงงานคำนวณทรัพยากร
          </Text>
          <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12 }}>
            ระบบวางแผนการผลิต
          </Text>
        </div>

        {/* Navigation */}
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[view]}
          onClick={({ key }) => setView(key as MainView)}
          items={NAV_ITEMS}
          style={{ flex: 'none', borderRight: 0 }}
        />

        <Divider style={{ borderColor: 'rgba(255,255,255,0.08)', margin: '4px 0' }} />

        {/* BOM inputs — only shown on calculator view */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '12px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}>
          {view === 'calculator' && (
            <>
              <TargetItemForm recipes={recipes} onAdd={addTargetItem} />
              {targetItems.length > 0 && (
                <div>
                  <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 12, fontWeight: 500 }}>
                    รายการเป้าหมาย
                  </Text>
                  <div style={{ marginTop: 8 }}>
                    <TargetItemList items={targetItems} recipes={recipes} onRemove={removeTargetItem} />
                  </div>
                </div>
              )}
              <div>
                <Text style={{ color: 'rgba(255,255,255,0.65)', fontSize: 12, fontWeight: 500 }}>
                  สต็อกปัจจุบัน
                </Text>
                <div style={{ marginTop: 8 }}>
                  {recipes.length === 0 ? (
                    <Text style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12 }}>กำลังโหลด…</Text>
                  ) : (
                    <StockEditor recipes={recipes} stocks={stocks} stockImages={stockImages} onUpdate={updateStock} />
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Bottom actions (BOM only) */}
        {view === 'calculator' && (
          <div style={{
            padding: '12px 16px',
            borderTop: '1px solid rgba(255,255,255,0.08)',
            flexShrink: 0,
          }}>
            <SidebarActions
              onSave={saveStocks}
              onCalculate={runCalculation}
              saveStatus={saveStatus}
              saveError={saveError}
              loading={loading}
              canCalculate={targetItems.length > 0}
            />
          </div>
        )}
      </Sider>

      {/* ── Main content ── */}
      <Layout style={{ marginLeft: 260 }}>
        <Content style={{
          minHeight: '100vh',
          background: '#f5f5f5',
          overflowY: 'auto',
        }}>

          {/* Guide */}
          {view === 'guide' && <UserGuide onClose={() => setView('calculator')} />}

          {/* Data Editor */}
          {view === 'data' && (
            <div style={{ maxWidth: 1100, margin: '0 auto', padding: '28px 24px' }}>
              <Title level={4} style={{ marginBottom: 4 }}>จัดการข้อมูล</Title>
              <Text type="secondary" style={{ display: 'block', marginBottom: 20 }}>
                เพิ่ม แก้ไข หรือลบสูตรการผลิตและสต็อกวัตถุดิบ
              </Text>
              <DataEditor
                initialRecipes={recipes}
                initialMachines={_machines}
                initialStocks={stocks}
                initialStockImages={stockImages}
              />
            </div>
          )}

          {/* Production Planner */}
          {view === 'planner' && (
            <div style={{ maxWidth: 1100, margin: '0 auto', padding: '28px 24px' }}>
              <Title level={4} style={{ marginBottom: 4 }}>วางแผนการผลิต</Title>
              <Text type="secondary" style={{ display: 'block', marginBottom: 20 }}>
                กำหนดสูตรแต่ละชั้น ระยะเวลา Event และดูผลการผลิตพร้อมวัตถุดิบที่ต้องใช้
              </Text>
              <ProductionPlanner recipes={recipes} stocks={stocks} machines={_machines} />
            </div>
          )}

          {/* BOM Calculator results */}
          {view === 'calculator' && (
            <div style={{ maxWidth: 900, margin: '0 auto', padding: '28px 24px' }}>
              <Title level={4} style={{ marginBottom: 4 }}>ผลการคำนวณ BOM</Title>
              <Text type="secondary" style={{ display: 'block', marginBottom: 20 }}>
                เพิ่มไอเทมเป้าหมาย ตั้งค่าสต็อก แล้วกดคำนวณ
              </Text>

              {initError && (
                <Alert
                  type="error"
                  message="โหลดข้อมูลไม่สำเร็จ"
                  description={`${initError} — ตรวจสอบว่า Backend รันอยู่ที่ port 3000`}
                  showIcon
                  style={{ marginBottom: 16 }}
                />
              )}
              {calcError && (
                <Alert
                  type="warning"
                  message="เกิดข้อผิดพลาดในการคำนวณ"
                  description={calcError}
                  showIcon
                  style={{ marginBottom: 16 }}
                />
              )}

              {loading && (
                <div style={{ textAlign: 'center', padding: '48px 0' }}>
                  <Spin size="large" tip="กำลังคำนวณ…" />
                </div>
              )}

              {!loading && calculationResult && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                  <div>
                    <Title level={5} style={{ marginBottom: 12 }}>
                      รายการที่ต้องจัดหา
                      <Text type="secondary" style={{ fontSize: 13, fontWeight: 400, marginLeft: 8 }}>
                        {calculationResult.shopping_list.length} รายการ
                      </Text>
                    </Title>
                    <ShoppingListTable entries={calculationResult.shopping_list} stocks={stocks} stockImages={stockImages} />
                  </div>
                  <div>
                    <Title level={5} style={{ marginBottom: 12 }}>
                      ภาระงานเครื่องจักร
                      <Text type="secondary" style={{ fontSize: 13, fontWeight: 400, marginLeft: 8 }}>
                        {calculationResult.machine_workloads.length} เครื่อง
                      </Text>
                    </Title>
                    <MachineWorkloadTable entries={calculationResult.machine_workloads} />
                  </div>
                </div>
              )}

              {!loading && !calculationResult && !initError && !calcError && (
                <Empty
                  description="เพิ่มไอเทมเป้าหมายทางซ้าย แล้วกดคำนวณ"
                  style={{ padding: '64px 0' }}
                />
              )}
            </div>
          )}

        </Content>
      </Layout>
    </Layout>
  );
}
